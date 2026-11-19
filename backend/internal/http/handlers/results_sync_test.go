package handlers_test

import (
	httpapi "cob-aquatics/internal/http"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestResultsWebsiteUsesCallerAndIndependentOperationRPCs(t *testing.T) {
	calls := 0
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/rest/v1/rpc/result_apply" {
			t.Fatalf("unexpected RPC %s", r.URL.Path)
		}
		var b struct {
			Session string         `json:"p_session"`
			Op      map[string]any `json:"op"`
			Token   string         `json:"p_token"`
		}
		_ = json.NewDecoder(r.Body).Decode(&b)
		if b.Session != "session-a" || b.Token != "" {
			t.Fatalf("incorrect caller scope: %#v", b)
		}
		calls++
		if calls == 2 {
			w.WriteHeader(403)
			io.WriteString(w, `{"message":"DO-NOT-RETURN-DB-TEXT"}`)
			return
		}
		io.WriteString(w, `{"operationId":"one","status":"accepted","revision":1}`)
	})
	w := staffRequest("POST", "/api/sessions/session-a/results", `{"schemaVersion":1,"operations":[{"operationId":"one","sessionId":"session-a"},{"operationId":"two","sessionId":"other"}]}`, true)
	if w.Code != 200 || calls != 2 || !strings.Contains(w.Body.String(), `"status":"rejected"`) || strings.Contains(w.Body.String(), "DO-NOT") {
		t.Fatalf("%d %s calls=%d", w.Code, w.Body, calls)
	}
}
func TestResultsAuthenticationAndBodyValidation(t *testing.T) {
	for _, path := range []string{"/api/sessions/s/result-identities", "/api/sessions/s/result-classes", "/api/sessions/s/results", "/api/sessions/s/result-grants", "/api/device-results"} {
		if w := staffRequest("GET", path, "", false); w.Code != 401 {
			t.Fatalf("guest %s: %d", path, w.Code)
		}
	}
	for _, body := range []string{`{"schemaVersion":1,"operations":[]}`, `{"schemaVersion":1,"operations":[{}],"name":"no"}`, `{"schemaVersion":1,"operations":[{}]} {}`} {
		if w := staffRequest("POST", "/api/sessions/s/results", body, false); w.Code != 400 {
			t.Fatalf("invalid body: %d", w.Code)
		}
	}
}
func TestResultsDeviceUsesOnlyServiceClientAndSeparateToken(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" || r.Header.Get("apikey") != "sb_secret_results_test" {
			t.Fatal("device request did not use service client")
		}
		if r.URL.Path != "/rest/v1/rpc/result_snapshot" {
			t.Fatalf("unexpected request %s", r.URL.Path)
		}
		var b map[string]any
		_ = json.NewDecoder(r.Body).Decode(&b)
		if b["p_token"] != strings.Repeat("a", 64) {
			t.Fatal("missing raw credential for server hash check")
		}
		io.WriteString(w, `{"schemaVersion":1,"records":[],"conflicts":[],"history":[]}`)
	}))
	defer upstream.Close()
	t.Setenv("SUPABASE_URL", upstream.URL)
	t.Setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_results_test")
	r := httptest.NewRequest("GET", "/api/device-results", nil)
	r.Header.Set("Authorization", "Bearer "+strings.Repeat("a", 64))
	w := httptest.NewRecorder()
	httpapi.NewRouter().ServeHTTP(w, r)
	if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store, private" {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
}

func TestBoundSameNameInstructorSharingMintsHashOnlyGrants(t *testing.T) {
	minted := 0
	registry := `{"datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","courses":[{"sourceId":"course-a","classId":"class-a","instructorId":"instructor-a","swimmers":[{"sourceId":"swimmer-a","enrollmentId":"enrollment-a","active":true}]},{"sourceId":"course-b","classId":"class-b","instructorId":"instructor-b","swimmers":[{"sourceId":"swimmer-b","enrollmentId":"enrollment-b","active":true}]}]}`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/auth/v1/user" {
			io.WriteString(w, `{"id":"`+testUser+`"}`)
			return
		}
		if r.URL.Path == "/rest/v1/rpc/result_mint" {
			if r.Header.Get("apikey") != "sb_secret_results_test" {
				t.Fatal("mint not service-authenticated")
			}
			var b struct {
				Creator string         `json:"p_creator"`
				Body    map[string]any `json:"p_body"`
			}
			_ = json.NewDecoder(r.Body).Decode(&b)
			if b.Creator != testUser || len(fmt.Sprint(b.Body["uploadHash"])) != 64 || len(fmt.Sprint(b.Body["readHash"])) != 64 || b.Body["uploadHash"] == b.Body["readHash"] {
				t.Fatalf("bad mint credentials %#v", b)
			}
			encoded, _ := json.Marshal(b.Body)
			if strings.Contains(string(encoded), "Alex") || strings.Contains(string(encoded), "LOCAL-NAME") {
				t.Fatal("participant name sent to database")
			}
			minted++
			io.WriteString(w, `{"id":"grant","expiresAt":"2026-12-10T00:00:00Z"}`)
			return
		}
		if r.Header.Get("Authorization") != "Bearer user-access-token" {
			t.Fatal("binding did not use caller auth")
		}
		switch r.URL.Path {
		case "/rest/v1/rpc/result_registry":
			io.WriteString(w, registry)
		case "/rest/v1/rpc/result_admin":
			io.WriteString(w, `{"classes":[]}`)
		case "/rest/v1/rpc/session_instructor_roster":
			io.WriteString(w, `[{"id":"instructor-a","name":"Alex"},{"id":"instructor-b","name":"Alex"}]`)
		default:
			t.Fatalf("unexpected binding path %s", r.URL.Path)
		}
	}))
	defer upstream.Close()
	t.Setenv("SUPABASE_URL", upstream.URL)
	t.Setenv("SUPABASE_ANON_KEY", "anon-key")
	t.Setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_results_test")
	payload := `{"sessionId":"session-a","packages":[{"instructor":"Alex","package":{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","instructor":"Alex","sync":{"instructorId":"forged"},"courses":[{"sourceId":"course-a","swimmers":[{"sourceId":"swimmer-a","name":"LOCAL-NAME"}]}]}},{"instructor":"Alex","package":{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","instructor":"Alex","courses":[{"sourceId":"course-b","swimmers":[{"sourceId":"swimmer-b","name":"LOCAL-NAME"}]}]}}]}`
	w := staffRequest("POST", "/api/device-shares", payload, true)
	if w.Code != 201 {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	var started struct {
		Codes []struct {
			Code         string `json:"code"`
			InstructorID string `json:"instructorId"`
		} `json:"codes"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &started)
	if len(started.Codes) != 2 || started.Codes[0].InstructorID == started.Codes[1].InstructorID {
		t.Fatal("same name instructors combined")
	}
	for _, code := range started.Codes {
		w = staffRequest("POST", "/api/device-shares/redeem", `{"code":"`+code.Code+`"}`, false)
		if w.Code != 200 {
			t.Fatalf("%d %s", w.Code, w.Body)
		}
		var response struct {
			Sync struct {
				InstructorID string `json:"instructorId"`
				Upload       string `json:"uploadToken"`
				Read         string `json:"readToken"`
				Courses      []struct {
					ClassID string `json:"classId"`
				} `json:"courses"`
			} `json:"sync"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &response)
		if response.Sync.InstructorID != code.InstructorID || len(response.Sync.Courses) != 1 || len(response.Sync.Upload) != 64 || len(response.Sync.Read) != 64 || response.Sync.Upload == response.Sync.Read || strings.Contains(w.Body.String(), "_creatorId") || strings.Contains(w.Body.String(), "forged") {
			t.Fatalf("unsafe redeem: %s", w.Body)
		}
	}
	if minted != 2 {
		t.Fatalf("minted %d", minted)
	}
}
func TestResultsUploadOutageIsReportedAsUnavailableNotUnauthorized(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(503)
		io.WriteString(w, `{"message":"DO-NOT-RETURN-DB-TEXT"}`)
	})
	w := staffRequest("POST", "/api/sessions/session-a/results", `{"schemaVersion":1,"operations":[{"operationId":"one","sessionId":"session-a"}]}`, true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"reason":"temporarily_unavailable"`) || strings.Contains(w.Body.String(), "DO-NOT") {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
}
