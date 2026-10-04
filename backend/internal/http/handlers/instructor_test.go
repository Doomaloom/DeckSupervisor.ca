package handlers_test

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestInstructorMetadataUsesCallerAndExplicitProjection(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/rest/v1/instructor_assignments":
			if r.URL.Query().Get("account_id") != "eq."+testUser || r.URL.Query().Get("session_id") != "eq.session-a" {
				t.Fatal("missing caller/session scope")
			}
			if r.URL.Query().Get("select") != "id,name" {
				t.Fatal("overbroad assignment projection")
			}
			io.WriteString(w, `[{"id":"column-a","name":"Alex"}]`)
		case "/rest/v1/instructor_classes":
			if r.URL.Query().Get("assignment_id") != "eq.column-a" || r.URL.Query().Get("session_id") != "eq.session-a" {
				t.Fatal("missing linked column scope")
			}
			if r.URL.Query().Get("select") != "id,session_id,assignment_id,code,level,start_time,end_time" {
				t.Fatal("overbroad class projection")
			}
			io.WriteString(w, `[{"id":"class-a","session_id":"session-a","assignment_id":"column-a","code":"A","level":"Swimmer 1","start_time":"09:00","end_time":"09:30"}]`)
		default:
			t.Fatalf("unexpected data request: %s", r.URL.Path)
		}
	})
	w := staffRequest("GET", "/api/instructor/sessions/session-a/classes", "", true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"instructor":"Alex"`) {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	for _, word := range []string{"student", "roster", "count", "phone", "email", "account_id"} {
		if strings.Contains(w.Body.String(), word) {
			t.Fatalf("leaked %s", word)
		}
	}
}
func TestInstructorDirectRequestsDenied(t *testing.T) {
	for _, path := range []string{"/api/instructor/sessions", "/api/instructor/sessions/other/classes", "/api/instructor/sessions/other/classes/class/plans/2026-10-05", "/api/sessions/other/instructor-assignments", "/api/sessions/other/linkable-profiles?q=Alex"} {
		w := staffRequest("GET", path, "", false)
		if w.Code != 401 {
			t.Fatalf("guest %s returned %d", path, w.Code)
		}
	}
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/rest/v1/rpc/") {
			t.Fatalf("denied request touched storage: %s", r.URL.Path)
		}
		io.WriteString(w, "false")
	})
	for _, method := range []string{"GET", "PUT"} {
		w := staffRequest(method, "/api/instructor/sessions/other/classes/class/plans/2026-10-05", `{"rows":[]}`, true)
		if w.Code != 403 {
			t.Fatalf("plan denial %d", w.Code)
		}
	}
	w := staffRequest("PATCH", "/api/sessions/other/instructor-assignments/column", `{"account_id":"forged"}`, true)
	if w.Code != 403 {
		t.Fatalf("link denial %d", w.Code)
	}
	w = staffRequest("GET", "/api/sessions/other/linkable-profiles?q=Alex", "", true)
	if w.Code != 403 {
		t.Fatalf("search denial %d", w.Code)
	}
}

func TestInstructorAccountSearchAndDisplayUseSessionScope(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		switch r.URL.Path {
		case "/rest/v1/rpc/can_edit_session":
			if body["p_session_id"] != "session-a" || body["p_uid"] != testUser {
				t.Fatalf("bad permission scope %v", body)
			}
			io.WriteString(w, "true")
		case "/rest/v1/rpc/search_linkable_part_time_profiles":
			if body["p_session"] != "session-a" || body["p_query"] != "alex@example.invalid" || body["p_limit"] != float64(25) {
				t.Fatalf("bad search %v", body)
			}
			io.WriteString(w, `[{"id":"account-a","first_name":"Alex","last_name":"Staff","email":"alex@example.invalid"}]`)
		case "/rest/v1/rpc/instructor_assignment_accounts":
			if body["p_session"] != "session-a" {
				t.Fatalf("bad assignment scope %v", body)
			}
			io.WriteString(w, `[{"id":"column-a","name":"Alex column","account_id":"account-a","account":{"id":"account-a","first_name":"Alex","last_name":"Staff","email":"alex@example.invalid"}}]`)
		default:
			t.Fatalf("unexpected account request %s", r.URL.Path)
		}
	})
	w := staffRequest("GET", "/api/sessions/session-a/linkable-profiles?q=%20alex%40example.invalid%20", "", true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"results":[`) {
		t.Fatalf("search %d %s", w.Code, w.Body)
	}
	w = staffRequest("GET", "/api/sessions/session-a/instructor-assignments", "", true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"account":{`) {
		t.Fatalf("display %d %s", w.Code, w.Body)
	}
}

func TestInstructorAccountSearchEmptyAndFailure(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/can_edit_session") {
			io.WriteString(w, "true")
			return
		}
		if !strings.HasSuffix(r.URL.Path, "/search_linkable_part_time_profiles") {
			t.Fatalf("unexpected %s", r.URL.Path)
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["p_query"] == "fail" {
			http.Error(w, "Unavailable", 500)
			return
		}
		io.WriteString(w, "null")
	})
	w := staffRequest("GET", "/api/sessions/session-a/linkable-profiles?q=empty", "", true)
	if w.Code != 200 || w.Body.String() != "{\"results\":[]}\n" {
		t.Fatalf("empty %d %s", w.Code, w.Body)
	}
	w = staffRequest("GET", "/api/sessions/session-a/linkable-profiles?q=fail", "", true)
	if w.Code != 400 {
		t.Fatalf("failure %d %s", w.Code, w.Body)
	}
}
func TestInstructorUnlinkedEmptyAndPlanAttribution(t *testing.T) {
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/rest/v1/instructor_assignments":
			io.WriteString(w, "[]")
		case "/rest/v1/rpc/can_plan_class":
			io.WriteString(w, "true")
		case "/rest/v1/instructor_plans":
			var body map[string]any
			json.NewDecoder(r.Body).Decode(&body)
			if body["updated_by"] != testUser || body["session_id"] != "session-a" || body["class_id"] != "class-a" {
				t.Fatalf("bad attribution %v", body)
			}
			io.WriteString(w, `[{"rows":[]}]`)
		default:
			t.Fatalf("unexpected %s", r.URL.Path)
		}
	})
	w := staffRequest("GET", "/api/instructor/sessions/session-a/classes", "", true)
	if w.Body.String() != "{\"classes\":[]}\n" {
		t.Fatalf("empty %s", w.Body)
	}
	w = staffRequest("PUT", "/api/instructor/sessions/session-a/classes/class-a/plans/2026-10-05", `{"rows":[]}`, true)
	if w.Code != 200 {
		t.Fatalf("save %d %s", w.Code, w.Body)
	}
	w = staffRequest("PUT", "/api/instructor/sessions/session-a/classes/class-a/plans/2026-10-05", `{"rows":[],"updated_by":"forged"}`, true)
	if w.Code != 400 {
		t.Fatal("accepted forged identity")
	}
}

func TestInstructorPlanCurriculumRoundTrip(t *testing.T) {
	var saved map[string]any
	staffServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/rest/v1/rpc/can_plan_class":
			io.WriteString(w, "true")
		case "/rest/v1/instructor_plans":
			if !strings.Contains(r.URL.Query().Get("select"), "curriculum_level") {
				t.Fatal("missing curriculum projection")
			}
			if r.Method == "POST" {
				if err := json.NewDecoder(r.Body).Decode(&saved); err != nil {
					t.Fatal(err)
				}
			}
			json.NewEncoder(w).Encode([]map[string]any{saved})
		default:
			t.Fatalf("unexpected %s", r.URL.Path)
		}
	})
	path := "/api/instructor/sessions/session-a/classes/class-a/plans/2026-10-05"
	for _, level := range []string{"Splash2A", "TeenAdult1"} {
		w := staffRequest("PUT", path, `{"rows":[],"curriculum_level":"`+level+`"}`, true)
		if w.Code != 200 || saved["curriculum_level"] != level {
			t.Fatalf("save %d %s", w.Code, w.Body)
		}
		w = staffRequest("GET", path, "", true)
		if w.Code != 200 || !strings.Contains(w.Body.String(), `"curriculum_level":"`+level+`"`) {
			t.Fatalf("load %d %s", w.Code, w.Body)
		}
	}
	for _, body := range []string{`{"rows":[]}`, `{"rows":[],"curriculum_level":null}`} {
		w := staffRequest("PUT", path, body, true)
		if w.Code != 200 {
			t.Fatalf("legacy/null save %d %s", w.Code, w.Body)
		}
	}
	for _, level := range []string{"", "SplashPrivate", "Splash 1", "Invalid"} {
		w := staffRequest("PUT", path, `{"rows":[],"curriculum_level":"`+level+`"}`, true)
		if w.Code != 400 {
			t.Fatalf("accepted invalid level %q: %d", level, w.Code)
		}
	}
}
