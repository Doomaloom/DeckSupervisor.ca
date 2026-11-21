package auth

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// providerStub answers the user lookup and the refresh grant with fixed statuses.
func providerStub(t *testing.T, userStatus, tokenStatus int) *Service {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/auth/v1/user":
			w.WriteHeader(userStatus)
			if userStatus == http.StatusOK {
				io.WriteString(w, `{"id":"user-a","email":"a@example.invalid"}`)
			}
		case "/auth/v1/token":
			w.WriteHeader(tokenStatus)
			if tokenStatus == http.StatusOK {
				io.WriteString(w, `{"access_token":"new-access","refresh_token":"new-refresh","expires_in":3600,"user":{"id":"user-a"}}`)
			} else {
				io.WriteString(w, `{"error":"invalid_grant","error_description":"Invalid Refresh Token"}`)
			}
		default:
			t.Fatalf("unexpected provider request %s", r.URL.Path)
		}
	}))
	t.Cleanup(server.Close)
	return &Service{supabaseURL: server.URL, anonKey: "anon", httpClient: server.Client()}
}

func tokenExpiringIn(d time.Duration) string {
	claims := fmt.Sprintf(`{"exp":%d}`, time.Now().Add(d).Unix())
	return "h." + base64.RawURLEncoding.EncodeToString([]byte(claims)) + ".s"
}

func TestSessionFromCookiesReportsProviderOutage(t *testing.T) {
	for _, status := range []int{http.StatusServiceUnavailable, http.StatusBadGateway, http.StatusTooManyRequests} {
		service := providerStub(t, status, status)
		_, _, err := service.SessionFromCookies(context.Background(), tokenExpiringIn(-time.Minute), "refresh-1")
		if !errors.Is(err, ErrAuthUnavailable) {
			t.Fatalf("provider status %d: err=%v, want ErrAuthUnavailable", status, err)
		}
	}
}

func TestSessionFromCookiesReportsUnreachableProvider(t *testing.T) {
	service := providerStub(t, http.StatusOK, http.StatusOK)
	service.supabaseURL = "http://127.0.0.1:1" // nothing listens here
	_, _, err := service.SessionFromCookies(context.Background(), "", "refresh-1")
	if !errors.Is(err, ErrAuthUnavailable) {
		t.Fatalf("err=%v, want ErrAuthUnavailable", err)
	}
}

func TestSessionFromCookiesStillRefusesABadSignIn(t *testing.T) {
	service := providerStub(t, http.StatusUnauthorized, http.StatusBadRequest)
	_, _, err := service.SessionFromCookies(context.Background(), tokenExpiringIn(time.Hour), "refresh-1")
	if err == nil || errors.Is(err, ErrAuthUnavailable) {
		t.Fatalf("err=%v, want a refusal", err)
	}
	if _, _, err := service.SessionFromCookies(context.Background(), "", ""); err == nil || errors.Is(err, ErrAuthUnavailable) {
		t.Fatalf("no cookies: err=%v, want a refusal", err)
	}
}

// The user lookup is down, the access token has not expired, and the refresh
// token is refused (it can be a stale copy). The sign-in was never shown to be
// bad, so this is an outage, not a refusal.
func TestSessionFromCookiesKeepsUncheckedLiveTokenDuringOutage(t *testing.T) {
	service := providerStub(t, http.StatusServiceUnavailable, http.StatusBadRequest)
	_, _, err := service.SessionFromCookies(context.Background(), tokenExpiringIn(time.Hour), "stale-refresh")
	if !errors.Is(err, ErrAuthUnavailable) {
		t.Fatalf("err=%v, want ErrAuthUnavailable", err)
	}
	_, _, err = service.SessionFromCookies(context.Background(), tokenExpiringIn(time.Hour), "")
	if !errors.Is(err, ErrAuthUnavailable) {
		t.Fatalf("no refresh cookie: err=%v, want ErrAuthUnavailable", err)
	}
	// An access token that has already expired gets no such benefit.
	_, _, err = service.SessionFromCookies(context.Background(), tokenExpiringIn(-time.Minute), "stale-refresh")
	if err == nil || errors.Is(err, ErrAuthUnavailable) {
		t.Fatalf("expired token: err=%v, want a refusal", err)
	}
}

func TestSessionFromCookiesRefreshesWhenLookupIsDown(t *testing.T) {
	service := providerStub(t, http.StatusServiceUnavailable, http.StatusOK)
	session, refresh, err := service.SessionFromCookies(context.Background(), tokenExpiringIn(time.Hour), "refresh-1")
	if err != nil || session.AccessToken != "new-access" || refresh != "new-refresh" {
		t.Fatalf("session=%+v refresh=%q err=%v", session, refresh, err)
	}
}
