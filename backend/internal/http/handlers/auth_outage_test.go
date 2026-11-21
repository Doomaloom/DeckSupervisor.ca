package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// authProviderDown points the sign-in provider at a stub that fails every call
// with the given status.
func authProviderDown(t *testing.T, status int) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		io.WriteString(w, `{"error":"invalid_grant"}`)
	}))
	t.Cleanup(server.Close)
	t.Setenv("SUPABASE_URL", server.URL)
	t.Setenv("SUPABASE_ANON_KEY", "anon-key")
}

func signedInRequest(method, path string) *http.Request {
	r := httptest.NewRequest(method, path, strings.NewReader(`{}`))
	r.AddCookie(&http.Cookie{Name: "decksupervisor_access_token", Value: "access-1"})
	r.AddCookie(&http.Cookie{Name: "decksupervisor_refresh_token", Value: "refresh-1"})
	return r
}

func TestSessionCheckKeepsCookiesDuringProviderOutage(t *testing.T) {
	authProviderDown(t, http.StatusServiceUnavailable)
	w := httptest.NewRecorder()
	Session(w, signedInRequest(http.MethodGet, "/api/auth/session"))
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d, want 503: %s", w.Code, w.Body.String())
	}
	if cookies := w.Result().Cookies(); len(cookies) != 0 {
		t.Fatalf("an outage must not touch the sign-in cookies, got %v", cookies)
	}
	if !strings.Contains(w.Body.String(), "unavailable") {
		t.Fatalf("body=%q", w.Body.String())
	}
}

func TestSessionCheckStillSignsOutARefusedSignIn(t *testing.T) {
	authProviderDown(t, http.StatusBadRequest)
	w := httptest.NewRecorder()
	Session(w, signedInRequest(http.MethodGet, "/api/auth/session"))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d, want 401", w.Code)
	}
	cleared := 0
	for _, cookie := range w.Result().Cookies() {
		if cookie.MaxAge < 0 && cookie.Value == "" {
			cleared++
		}
	}
	if cleared != 2 {
		t.Fatalf("both sign-in cookies should be cleared, got %v", w.Result().Cookies())
	}
}

func TestResultsReportOutageNotExpiredSignIn(t *testing.T) {
	authProviderDown(t, http.StatusBadGateway)
	w := httptest.NewRecorder()
	if c := resultClient(w, signedInRequest(http.MethodGet, "/api/sessions/s/result-identities"), false); c != nil {
		t.Fatal("no client expected during an outage")
	}
	if w.Code != http.StatusBadGateway || strings.TrimSpace(w.Body.String()) != resultUnavailable {
		t.Fatalf("status=%d body=%q", w.Code, w.Body.String())
	}

	authProviderDown(t, http.StatusBadRequest)
	w = httptest.NewRecorder()
	resultClient(w, signedInRequest(http.MethodGet, "/api/sessions/s/result-identities"), false)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("refused sign-in: status=%d, want 401", w.Code)
	}
}

func TestDeviceShareCreateReportsSignInOutage(t *testing.T) {
	authProviderDown(t, http.StatusServiceUnavailable)
	w := httptest.NewRecorder()
	CreateDeviceShare(w, signedInRequest(http.MethodPost, "/api/device-shares"))
	if w.Code != http.StatusServiceUnavailable || strings.Contains(w.Body.String(), "Sign in to share") {
		t.Fatalf("status=%d body=%q", w.Code, w.Body.String())
	}
}
