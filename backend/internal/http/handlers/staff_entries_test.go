package handlers_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	httpapi "cob-aquatics/internal/http"
)

const testUser = "00000000-0000-0000-0000-000000000002"

func staffServer(t *testing.T, upstream http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer user-access-token" {
			t.Errorf("request did not forward caller token: %s", r.URL.Path)
		}
		if r.Header.Get("apikey") != "anon-key" {
			t.Error("request did not use the anon API key")
		}
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/auth/v1/user" {
			io.WriteString(w, `{"id":"`+testUser+`","email":"qa@example.invalid"}`)
			return
		}
		upstream(w, r)
	}))
	t.Cleanup(server.Close)
	t.Setenv("SUPABASE_URL", server.URL)
	t.Setenv("SUPABASE_ANON_KEY", "anon-key")
	t.Setenv("SUPABASE_SERVICE_ROLE_KEY", "must-not-be-used")
}

func staffRequest(method, path, body string, signedIn bool) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if signedIn {
		r.AddCookie(&http.Cookie{Name: "decksupervisor_access_token", Value: "user-access-token"})
	}
	w := httptest.NewRecorder()
	httpapi.NewRouter().ServeHTTP(w, r)
	return w
}

func TestStaffEntryWritesUseCallerAndProtectIdentity(t *testing.T) {
	for _, tc := range []struct {
		method, path, table, body string
		create                    bool
	}{
		{"POST", "/api/session-reports", "session_reports", `{"session_id":"session-a","created_by":"forged","title":"Report","report_data":{"saved":true}}`, true},
		{"PATCH", "/api/session-reports/report-a", "session_reports", `{"session_id":"forged","created_by":"forged","id":"forged","title":"Edited","report_data":{}}`, false},
		{"POST", "/api/session-notes", "session_notes", `{"session_id":"session-a","created_by":"forged","note_type":"todo","text":"Task","done":false}`, true},
		{"PATCH", "/api/session-notes/note-a", "session_notes", `{"session_id":"forged","created_by":"forged","done":true}`, false},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			called := false
			staffServer(t, func(w http.ResponseWriter, r *http.Request) {
				called = true
				if r.URL.Path != "/rest/v1/"+tc.table || r.Method != tc.method {
					t.Fatalf("unexpected upstream %s %s", r.Method, r.URL.Path)
				}
				if r.Header.Get("Prefer") != "return=representation" {
					t.Error("must check affected row")
				}
				var body map[string]any
				json.NewDecoder(r.Body).Decode(&body)
				if tc.create {
					if body["created_by"] != testUser || body["session_id"] != "session-a" {
						t.Errorf("incorrect attribution: %v", body)
					}
				} else {
					for _, key := range []string{"created_by", "session_id", "id"} {
						if _, ok := body[key]; ok {
							t.Errorf("forwarded protected field %s", key)
						}
					}
					if r.URL.Query().Get("id") == "" {
						t.Error("missing row filter")
					}
				}
				io.WriteString(w, `[{"id":"saved","created_by":"`+testUser+`"}]`)
			})
			w := staffRequest(tc.method, tc.path, tc.body, true)
			if w.Code != 200 || !called {
				t.Fatalf("status=%d body=%s called=%v", w.Code, w.Body, called)
			}
		})
	}
}

func TestStaffEntryDenialsAreNotSuccessfulMutations(t *testing.T) {
	for _, path := range []string{"/api/session-notes/entry", "/api/session-reports/entry"} {
		for _, method := range []string{"PATCH", "DELETE"} {
			for _, upstreamStatus := range []int{200, 403} {
				t.Run(path+method+http.StatusText(upstreamStatus), func(t *testing.T) {
					staffServer(t, func(w http.ResponseWriter, r *http.Request) {
						if r.Header.Get("Prefer") != "return=representation" {
							t.Error("missing affected-row response")
						}
						w.WriteHeader(upstreamStatus)
						if upstreamStatus == 403 {
							io.WriteString(w, `{"message":"RLS denied"}`)
						} else {
							io.WriteString(w, `[]`)
						}
					})
					w := staffRequest(method, path, `{"title":"x","done":true}`, true)
					if w.Code != 403 {
						t.Fatalf("status=%d body=%s", w.Code, w.Body)
					}
				})
			}
		}
	}
}

func TestStaffEntryRoutesRejectAnonymous(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) { t.Fatalf("anonymous request reached data API") })
	for _, path := range []string{"/api/session-notes", "/api/session-reports"} {
		for _, method := range []string{"GET", "POST", "PATCH", "DELETE"} {
			endpoint := path
			if method == "PATCH" || method == "DELETE" {
				endpoint += "/entry"
			}
			if w := staffRequest(method, endpoint, `{}`, false); w.Code != 401 {
				t.Errorf("%s %s status=%d", method, endpoint, w.Code)
			}
		}
	}
}

func TestStaffEntryTeamScopePreservesTermAndAuthorFilters(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/rest/v1/sessions":
			if r.URL.Query().Get("team_id") != "eq.team-a" {
				t.Error("missing team filter")
			}
			io.WriteString(w, `[{"id":"fall","session_season":" Fall ","start_date":"2026-09-14"},{"id":"other-year","session_season":"fall","session_year":2025}]`)
		case "/rest/v1/teams":
			io.WriteString(w, `[{"owner_id":"supervisor"}]`)
		case "/rest/v1/team_members":
			io.WriteString(w, `[{"user_id":"member"}]`)
		case "/rest/v1/session_reports":
			if r.URL.Query().Get("session_id") != "in.(fall)" || r.URL.Query().Get("created_by") != "in.(supervisor,member)" {
				t.Errorf("wrong scope: %v", r.URL.Query())
			}
			if !strings.Contains(r.URL.Query().Get("select"), "author:profiles") {
				t.Error("missing RLS-bound author lookup")
			}
			io.WriteString(w, `[{"id":"report","created_by":"member","title":"Saved"}]`)
		default:
			t.Errorf("unexpected %s", r.URL.Path)
		}
	})
	w := staffRequest("GET", "/api/session-reports?teamId=team-a&season=fall&year=2026", "", true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Saved") {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
}
