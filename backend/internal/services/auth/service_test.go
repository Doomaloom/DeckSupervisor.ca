package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func logoutTestService(t *testing.T, gotScope *string, calls *int) *Service {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/auth/v1/logout" {
			t.Fatalf("unexpected provider request %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer access-1" || r.Header.Get("apikey") != "anon" {
			t.Fatal("logout request missing token or api key")
		}
		*calls++
		*gotScope = r.URL.Query().Get("scope")
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(server.Close)
	return &Service{supabaseURL: server.URL, anonKey: "anon", httpClient: server.Client()}
}

func TestSignOutLocalEndsOnlyThisSession(t *testing.T) {
	var scope string
	calls := 0
	service := logoutTestService(t, &scope, &calls)
	if err := service.SignOutLocal(context.Background(), "access-1"); err != nil {
		t.Fatalf("SignOutLocal: %v", err)
	}
	if calls != 1 || scope != "local" {
		t.Fatalf("calls=%d scope=%q, want one logout with scope=local", calls, scope)
	}
}

func TestSignOutKeepsProviderDefaultScope(t *testing.T) {
	var scope string
	calls := 0
	service := logoutTestService(t, &scope, &calls)
	if err := service.SignOut(context.Background(), "access-1"); err != nil {
		t.Fatalf("SignOut: %v", err)
	}
	if calls != 1 || scope != "" {
		t.Fatalf("calls=%d scope=%q, want one logout with no scope (global)", calls, scope)
	}
}

func TestSignOutLocalSkipsEmptyToken(t *testing.T) {
	var scope string
	calls := 0
	service := logoutTestService(t, &scope, &calls)
	if err := service.SignOutLocal(context.Background(), "  "); err != nil {
		t.Fatalf("SignOutLocal: %v", err)
	}
	if calls != 0 {
		t.Fatalf("calls=%d, want no provider call for an empty token", calls)
	}
}
