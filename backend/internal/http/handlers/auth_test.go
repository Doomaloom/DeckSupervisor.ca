package handlers_test

import (
	httpapi "cob-aquatics/internal/http"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func signOutRequest(t *testing.T, provider http.HandlerFunc, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	server := httptest.NewServer(provider)
	t.Cleanup(server.Close)
	t.Setenv("SUPABASE_URL", server.URL)
	t.Setenv("SUPABASE_ANON_KEY", "signout-anon")
	r := httptest.NewRequest(http.MethodPost, "/api/auth/sign-out", nil)
	for _, cookie := range cookies {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	httpapi.NewRouter().ServeHTTP(w, r)
	return w
}

func assertSessionCookiesCleared(t *testing.T, w *httptest.ResponseRecorder) {
	t.Helper()
	if w.Code != http.StatusNoContent {
		t.Fatalf("status=%d, want 204", w.Code)
	}
	cleared := map[string]bool{}
	for _, cookie := range w.Result().Cookies() {
		if cookie.MaxAge < 0 && cookie.Value == "" {
			cleared[cookie.Name] = true
		}
	}
	if !cleared["decksupervisor_access_token"] || !cleared["decksupervisor_refresh_token"] {
		t.Fatalf("session cookies not cleared: %v", w.Result().Cookies())
	}
}

func TestSignOutEndsOnlyThisBrowserSession(t *testing.T) {
	var logoutScopes []string
	w := signOutRequest(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/auth/v1/user":
			io.WriteString(w, `{"id":"user-1","email":"a@example.invalid"}`)
		case "/auth/v1/logout":
			if r.Header.Get("Authorization") != "Bearer live-access" {
				t.Fatalf("logout used token %q", r.Header.Get("Authorization"))
			}
			logoutScopes = append(logoutScopes, r.URL.Query().Get("scope"))
			w.WriteHeader(http.StatusNoContent)
		default:
			t.Fatalf("unexpected provider request %s", r.URL.Path)
		}
	}, &http.Cookie{Name: "decksupervisor_access_token", Value: "live-access"},
		&http.Cookie{Name: "decksupervisor_refresh_token", Value: "refresh-1"})
	if len(logoutScopes) != 1 || logoutScopes[0] != "local" {
		t.Fatalf("logout scopes=%v, want [local]", logoutScopes)
	}
	assertSessionCookiesCleared(t, w)
}

func TestSignOutWithExpiredAccessTokenStillSignsOut(t *testing.T) {
	var logoutScopes []string
	w := signOutRequest(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/auth/v1/user":
			w.WriteHeader(http.StatusUnauthorized)
		case "/auth/v1/token":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			if body["refresh_token"] != "refresh-1" {
				t.Fatalf("refresh used %q", body["refresh_token"])
			}
			io.WriteString(w, `{"access_token":"refreshed-access","refresh_token":"refresh-2","expires_in":3600,"user":{"id":"user-1"}}`)
		case "/auth/v1/logout":
			if r.Header.Get("Authorization") != "Bearer refreshed-access" {
				t.Fatalf("logout used token %q", r.Header.Get("Authorization"))
			}
			logoutScopes = append(logoutScopes, r.URL.Query().Get("scope"))
			w.WriteHeader(http.StatusNoContent)
		default:
			t.Fatalf("unexpected provider request %s", r.URL.Path)
		}
	}, &http.Cookie{Name: "decksupervisor_access_token", Value: "expired-access"},
		&http.Cookie{Name: "decksupervisor_refresh_token", Value: "refresh-1"})
	if len(logoutScopes) != 1 || logoutScopes[0] != "local" {
		t.Fatalf("logout scopes=%v, want [local]", logoutScopes)
	}
	assertSessionCookiesCleared(t, w)
}

func TestSignOutClearsCookiesWhenProviderRejectsEverything(t *testing.T) {
	w := signOutRequest(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		io.WriteString(w, `{"msg":"invalid"}`)
	}, &http.Cookie{Name: "decksupervisor_access_token", Value: "expired-access"},
		&http.Cookie{Name: "decksupervisor_refresh_token", Value: "revoked-refresh"})
	assertSessionCookiesCleared(t, w)
}
