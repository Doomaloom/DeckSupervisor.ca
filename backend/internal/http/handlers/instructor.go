package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"

	supabasesvc "cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

// Every request uses the caller's token; RLS provides the storage boundary.
func InstructorSessions(w http.ResponseWriter, r *http.Request) {
	c, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	var rows []map[string]any
	if err = c.RPC(r.Context(), "instructor_sessions", map[string]any{}, &rows); err != nil {
		http.Error(w, "Unable to load sessions", 500)
		return
	}
	if rows == nil {
		rows = []map[string]any{}
	}
	writeJSON(w, map[string]any{"sessions": rows})
}
func InstructorClasses(w http.ResponseWriter, r *http.Request) {
	c, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	sid := mux.Vars(r)["sessionId"]
	// Filter by account as well as RLS: a supervisor in Instructor View sees only their own links.
	q := url.Values{"session_id": {"eq." + sid}, "account_id": {"eq." + c.User.ID}, "active": {"eq.true"}, "select": {"id,name"}}
	var assignments []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err = c.Get(r.Context(), "/rest/v1/instructor_assignments", q, &assignments); err != nil {
		http.Error(w, "Unable to load assignments", 500)
		return
	}
	rows := []map[string]any{}
	for _, a := range assignments {
		var classes []map[string]any
		q = url.Values{"session_id": {"eq." + sid}, "assignment_id": {"eq." + a.ID}, "active": {"eq.true"}, "select": {"id,session_id,assignment_id,code,level,start_time,end_time"}, "order": {"start_time,id"}}
		if err = c.Get(r.Context(), "/rest/v1/instructor_classes", q, &classes); err != nil {
			http.Error(w, "Unable to load classes", 500)
			return
		}
		for _, row := range classes {
			row["instructor"] = a.Name
			rows = append(rows, row)
		}
	}
	writeJSON(w, map[string]any{"classes": rows})
}
func InstructorAssignments(w http.ResponseWriter, r *http.Request) {
	c, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	sid := mux.Vars(r)["sessionId"]
	var allowed bool
	if err = c.RPC(r.Context(), "can_edit_session", map[string]any{"p_session_id": sid, "p_uid": c.User.ID}, &allowed); err != nil || !allowed {
		http.Error(w, "Forbidden", 403)
		return
	}
	q := url.Values{"session_id": {"eq." + sid}, "active": {"eq.true"}, "select": {"id,name,account_id"}, "order": {"id"}}
	var rows []map[string]any
	if r.Method == "PATCH" {
		var body struct {
			AccountID *string `json:"account_id"`
		}
		if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body) != nil {
			http.Error(w, "Invalid request", 400)
			return
		}
		q.Set("id", "eq."+mux.Vars(r)["assignmentId"])
		err = c.Patch(r.Context(), "/rest/v1/instructor_assignments", q, map[string]any{"account_id": body.AccountID}, "return=representation", &rows)
	} else {
		err = c.Get(r.Context(), "/rest/v1/instructor_assignments", q, &rows)
	}
	if err != nil {
		http.Error(w, "Unable to update or load account links", 400)
		return
	}
	if rows == nil {
		rows = []map[string]any{}
	}
	writeJSON(w, map[string]any{"assignments": rows})
}
