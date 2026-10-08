package handlers_test

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestRosterUpdateSyncPersistsOnlyHashesAndMetadata(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/rest/v1/rpc/sync_roster_class_hashes" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		payload, _ := io.ReadAll(r.Body)
		if strings.Contains(string(payload), "Alice") || strings.Contains(string(payload), "555-0100") || strings.Contains(string(payload), "students") {
			t.Fatalf("student data sent to DB: %s", payload)
		}
		var body struct {
			Session string `json:"p_session"`
			Classes []struct {
				Code string `json:"code"`
				Hash string `json:"roster_hash"`
			} `json:"p_classes"`
		}
		if json.Unmarshal(payload, &body) != nil || body.Session != "session-a" || len(body.Classes) != 1 || body.Classes[0].Code != "A" || len(body.Classes[0].Hash) != 64 {
			t.Fatalf("invalid hash request %s", payload)
		}
		io.WriteString(w, `[]`)
	})
	w := staffRequest("POST", "/api/sessions/session-a/roster-hashes", `{"classes":[{"code":" A ","serviceName":"Splash 1","students":[{"name":"Alice","phone":"555-0100"}]}]}`, true)
	if w.Code != 200 {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	w = staffRequest("POST", "/api/sessions/session-a/roster-hashes", `{"classes":[{"code":"A"},{"code":"A"}]}`, true)
	if w.Code != 400 {
		t.Fatalf("duplicate codes returned %d", w.Code)
	}
}

func TestRosterUpdateQueueScopeAndConditionalAcknowledgement(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/rest/v1/rpc/can_read_session":
			io.WriteString(w, "true")
		case "/rest/v1/roster_print_updates":
			if r.URL.Query().Get("session_id") != "eq.session-a" || r.URL.Query().Get("select") != "code,roster_hash,revision,changed_at" {
				t.Fatal("queue not scoped")
			}
			io.WriteString(w, `[]`)
		case "/rest/v1/rpc/resolve_roster_print_updates":
			var body map[string]any
			json.NewDecoder(r.Body).Decode(&body)
			if body["p_session"] != "session-a" {
				t.Fatal("incorrect acknowledgement session")
			}
			updates := body["p_updates"].([]any)
			if updates[0].(map[string]any)["revision"] != "revision-a" {
				t.Fatal("missing revision guard")
			}
			io.WriteString(w, `["A"]`)
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	})
	for _, test := range []struct{ method, path, body string }{
		{"GET", "/api/sessions/session-a/print-updates", ""},
		{"POST", "/api/sessions/session-a/print-updates/resolve", `{"updates":[{"code":"A","revision":"revision-a","roster_hash":"ignored"}]}`},
	} {
		w := staffRequest(test.method, test.path, test.body, true)
		if w.Code != 200 {
			t.Fatalf("%d %s", w.Code, w.Body)
		}
		w = staffRequest(test.method, test.path, test.body, false)
		if w.Code != 401 {
			t.Fatalf("guest returned %d", w.Code)
		}
	}
}

func TestRosterUpdateQueueDeniesSessionAccessBeforeReading(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/rest/v1/rpc/can_read_session" {
			t.Fatal("denied request touched the queue")
		}
		io.WriteString(w, "false")
	})
	if w := staffRequest("GET", "/api/sessions/other/print-updates", "", true); w.Code != 403 {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
}
