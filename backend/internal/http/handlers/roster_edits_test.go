package handlers_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

type upstreamCall struct {
	method string
	path   string
	query  url.Values
	body   map[string]any
	prefer string
}

// rosterEditsUpstream stands in for the data API. existing is what a read of a
// table returns, and removed is what a delete reports it deleted.
func rosterEditsUpstream(t *testing.T, existing, removed map[string]string, calls *[]upstreamCall) {
	t.Helper()
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		call := upstreamCall{
			method: r.Method,
			path:   r.URL.Path,
			query:  r.URL.Query(),
			prefer: r.Header.Get("Prefer"),
		}
		if r.Method == "POST" {
			json.NewDecoder(r.Body).Decode(&call.body)
		}
		*calls = append(*calls, call)
		table := strings.TrimPrefix(r.URL.Path, "/rest/v1/")
		switch r.Method {
		case "GET":
			io.WriteString(w, orEmptyList(existing[table]))
		case "DELETE":
			io.WriteString(w, orEmptyList(removed[table]))
		default:
			w.WriteHeader(http.StatusCreated)
		}
	})
}

func orEmptyList(value string) string {
	if value == "" {
		return "[]"
	}
	return value
}

func TestDeleteRosterStudentEditRemovesOneSwimmer(t *testing.T) {
	var calls []upstreamCall
	rosterEditsUpstream(t,
		map[string]string{"roster_student_level_edits": `[{"code":"1001"}]`},
		map[string]string{"roster_student_level_edits": `[{"code":"1001"}]`},
		&calls)
	w := staffRequest("DELETE", "/api/roster-edits/student?sessionId=s1&code=1001&studentNameHash=abc", "", true)
	if w.Code != 204 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body)
	}
	var deleted *upstreamCall
	for i := range calls {
		if calls[i].method == "DELETE" {
			deleted = &calls[i]
		}
	}
	if deleted == nil || deleted.path != "/rest/v1/roster_student_level_edits" {
		t.Fatalf("no swimmer edit delete: %+v", calls)
	}
	for key, want := range map[string]string{"session_id": "eq.s1", "code": "eq.1001", "student_name_hash": "eq.abc"} {
		if got := deleted.query.Get(key); got != want {
			t.Errorf("filter %s = %q, want %q", key, got, want)
		}
	}
}

func TestDeleteRosterStudentEditNeedsAllFilters(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) { t.Fatalf("incomplete request reached data API") })
	for _, query := range []string{"code=1&studentNameHash=a", "sessionId=s&studentNameHash=a", "sessionId=s&code=1"} {
		if w := staffRequest("DELETE", "/api/roster-edits/student?"+query, "", true); w.Code != 400 {
			t.Errorf("%s status=%d", query, w.Code)
		}
	}
}

func TestSetRosterClassLevelSavesClassEditAndClearsSwimmerEdits(t *testing.T) {
	var calls []upstreamCall
	rosterEditsUpstream(t,
		map[string]string{"roster_student_level_edits": `[{"code":"1001"},{"code":"1001"}]`},
		map[string]string{"roster_student_level_edits": `[{"code":"1001"},{"code":"1001"}]`},
		&calls)
	w := staffRequest("POST", "/api/roster-edits/class", `{"session_id":"s1","code":"1001","level":"Splash 4","created_by":"forged"}`, true)
	if w.Code != 204 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body)
	}
	var upsert, deleteStudents *upstreamCall
	for i := range calls {
		switch {
		case calls[i].method == "POST" && calls[i].path == "/rest/v1/roster_level_edits":
			upsert = &calls[i]
		case calls[i].method == "DELETE" && calls[i].path == "/rest/v1/roster_student_level_edits":
			deleteStudents = &calls[i]
		case calls[i].method == "DELETE":
			t.Errorf("class edit must not be deleted when a level is set: %+v", calls[i])
		}
	}
	if upsert == nil || upsert.body["level"] != "Splash 4" || upsert.body["created_by"] != testUser {
		t.Fatalf("class edit not saved as the caller: %+v", upsert)
	}
	if deleteStudents == nil {
		t.Fatal("swimmer edits were not cleared")
	}
	if deleteStudents.query.Get("code") != "eq.1001" || deleteStudents.query.Get("session_id") != "eq.s1" {
		t.Errorf("swimmer delete not scoped to the class: %v", deleteStudents.query)
	}
	if deleteStudents.query.Get("student_name_hash") != "" {
		t.Error("clearing a class must cover every swimmer, not one")
	}
}

func TestSetRosterClassLevelWithoutLevelClearsClassEdit(t *testing.T) {
	var calls []upstreamCall
	rosterEditsUpstream(t,
		map[string]string{"roster_level_edits": `[{"code":"1001"}]`},
		map[string]string{"roster_level_edits": `[{"code":"1001"}]`},
		&calls)
	w := staffRequest("POST", "/api/roster-edits/class", `{"session_id":"s1","code":"1001","level":""}`, true)
	if w.Code != 204 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body)
	}
	deletedClass := false
	for _, call := range calls {
		if call.method == "POST" {
			t.Errorf("clearing must not upsert: %+v", call)
		}
		if call.method == "DELETE" && call.path == "/rest/v1/roster_level_edits" {
			deletedClass = true
		}
	}
	if !deletedClass {
		t.Fatal("class edit was not deleted")
	}
}

func TestSetRosterClassLevelWithNothingSavedSucceeds(t *testing.T) {
	var calls []upstreamCall
	rosterEditsUpstream(t, map[string]string{"roster_level_edits": `[]`, "roster_student_level_edits": `[]`}, map[string]string{}, &calls)
	response := staffRequest("POST", "/api/roster-edits/class", `{"session_id":"s1","code":"1001","level":""}`, true)
	if response.Code != 204 {
		t.Fatalf("status=%d body=%s", response.Code, response.Body)
	}
	for _, call := range calls {
		if call.method == "DELETE" {
			t.Errorf("nothing to delete, but a delete was sent: %+v", call)
		}
	}
}

func TestRosterEditDeletesRefuseSessionTheUserCannotEdit(t *testing.T) {
	for _, tc := range []struct{ name, method, path, body string }{
		{"one swimmer", "DELETE", "/api/roster-edits/student?sessionId=s1&code=1001&studentNameHash=abc", ""},
		{"whole class", "POST", "/api/roster-edits/class", `{"session_id":"s1","code":"1001","level":""}`},
	} {
		t.Run(tc.name+" denied silently", func(t *testing.T) {
			// Row-level security hides nothing on read but deletes no rows.
			var calls []upstreamCall
			rosterEditsUpstream(t,
				map[string]string{"roster_level_edits": `[{"code":"1001"}]`, "roster_student_level_edits": `[{"code":"1001"}]`},
				map[string]string{"roster_level_edits": `[]`, "roster_student_level_edits": `[]`},
				&calls)
			if w := staffRequest(tc.method, tc.path, tc.body, true); w.Code != 403 {
				t.Fatalf("status=%d body=%s", w.Code, w.Body)
			}
		})
		t.Run(tc.name+" denied with an error", func(t *testing.T) {
			staffServer(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Method == "GET" {
					io.WriteString(w, `[{"code":"1001"}]`)
					return
				}
				w.WriteHeader(403)
				io.WriteString(w, `{"message":"RLS denied"}`)
			})
			if w := staffRequest(tc.method, tc.path, tc.body, true); w.Code != 403 {
				t.Fatalf("status=%d body=%s", w.Code, w.Body)
			}
		})
	}
}

func TestSetRosterClassLevelDeniedUpsertIsNotSuccess(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			w.WriteHeader(403)
			io.WriteString(w, `{"message":"new row violates row-level security policy"}`)
			return
		}
		t.Errorf("swimmer edits must not be cleared after a denied class save: %s %s", r.Method, r.URL.Path)
	})
	if w := staffRequest("POST", "/api/roster-edits/class", `{"session_id":"s1","code":"1001","level":"Splash 4"}`, true); w.Code != 403 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body)
	}
}

func TestRosterEditChangesRejectAnonymousAndBadBodies(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) { t.Fatalf("request reached data API") })
	if w := staffRequest("POST", "/api/roster-edits/class", `{"session_id":"s1","code":"1"}`, false); w.Code != 401 {
		t.Errorf("anonymous class save status=%d", w.Code)
	}
	if w := staffRequest("DELETE", "/api/roster-edits/student?sessionId=s&code=1&studentNameHash=a", "", false); w.Code != 401 {
		t.Errorf("anonymous delete status=%d", w.Code)
	}
	if w := staffRequest("POST", "/api/roster-edits/class", `{"code":"1"}`, true); w.Code != 400 {
		t.Errorf("missing session status=%d", w.Code)
	}
	if w := staffRequest("POST", "/api/roster-edits/class", `not json`, true); w.Code != 400 {
		t.Errorf("bad body status=%d", w.Code)
	}
}
