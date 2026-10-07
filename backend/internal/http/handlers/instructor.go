package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"cob-aquatics/internal/curriculum"
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
		err = c.RPC(r.Context(), "link_session_instructor_assignment", map[string]any{"p_session": sid, "p_assignment": mux.Vars(r)["assignmentId"], "p_account": body.AccountID}, &rows)
	} else {
		err = c.RPC(r.Context(), "instructor_assignment_accounts", map[string]any{"p_session": sid}, &rows)
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

// Search is scoped to session ownership, including sessions without a team.
func SearchLinkableProfiles(w http.ResponseWriter, r *http.Request) {
	c, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	sid := mux.Vars(r)["sessionId"]
	var allowed bool
	if err = c.RPC(r.Context(), "can_edit_session", map[string]any{"p_session_id": sid, "p_uid": c.User.ID}, &allowed); err != nil || !allowed {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	rows := []map[string]any{}
	if err = c.RPC(r.Context(), "search_linkable_part_time_profiles", map[string]any{"p_session": sid, "p_query": strings.TrimSpace(r.URL.Query().Get("q")), "p_limit": 25}, &rows); err != nil {
		http.Error(w, "Unable to search accounts", http.StatusBadRequest)
		return
	}
	if rows == nil {
		rows = []map[string]any{}
	}
	writeJSON(w, map[string]any{"results": rows})
}

var poolLocationPattern = regexp.MustCompile(`^(Lane( [1-9][0-9]?)?|Shallow end|Deep end)$`)

type lessonRow struct {
	Skill      string           `json:"skill"`
	Activity   string           `json:"activity"`
	Activities []lessonActivity `json:"activities,omitempty"`
	Location   string           `json:"location"`
	Duration   int              `json:"duration"`
	Workout    *lessonWorkout   `json:"workout,omitempty"`
}

type lessonActivity struct {
	Kind string `json:"kind"`
	Text string `json:"text"`
}

func InstructorPlan(w http.ResponseWriter, r *http.Request) {
	c, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	v := mux.Vars(r)
	sid, cid, week := v["sessionId"], v["classId"], v["week"]
	var allowed bool
	if err = c.RPC(r.Context(), "can_plan_class", map[string]any{"p_session": sid, "p_class": cid, "p_week": week}, &allowed); err != nil || !allowed {
		http.Error(w, "Class or week unavailable", 403)
		return
	}
	q := url.Values{"session_id": {"eq." + sid}, "class_id": {"eq." + cid}, "week": {"eq." + week}, "select": {"session_id,class_id,week,rows,curriculum_level,updated_at"}}
	var plans []map[string]any
	if r.Method == "PUT" {
		var body struct {
			Rows            []lessonRow `json:"rows"`
			CurriculumLevel *string     `json:"curriculum_level"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 3<<20))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&body) != nil || body.Rows == nil || len(body.Rows) > 200 {
			http.Error(w, "Invalid activity rows", 400)
			return
		}
		if body.CurriculumLevel != nil && !curriculum.SupportsLevel(*body.CurriculumLevel) {
			http.Error(w, "Invalid curriculum level", 400)
			return
		}
		for _, row := range body.Rows {
			if len(row.Skill) > 2000 || len(row.Activity) > 10000 || row.Duration < 1 || row.Duration > 240 || !poolLocationPattern.MatchString(row.Location) || !validLessonWorkout(row.Workout) {
				http.Error(w, "Invalid activity row", 400)
				return
			}
			if len(row.Activities) > 100 || (row.Workout != nil && len(row.Activities) > 0) {
				http.Error(w, "Invalid activity row", 400)
				return
			}
			texts := make([]string, 0, len(row.Activities))
			for _, activity := range row.Activities {
				if (activity.Kind != "library" && activity.Kind != "custom") || len(activity.Text) > 10000 || strings.TrimSpace(activity.Text) == "" {
					http.Error(w, "Invalid activity row", 400)
					return
				}
				texts = append(texts, activity.Text)
			}
			if len(texts) > 0 && row.Activity != strings.Join(texts, "\n\n") {
				http.Error(w, "Invalid activity row", 400)
				return
			}
		}
		q = url.Values{"on_conflict": {"session_id,class_id,week"}, "select": {"session_id,class_id,week,rows,curriculum_level,updated_at"}}
		err = c.Post(r.Context(), "/rest/v1/instructor_plans", q, map[string]any{"session_id": sid, "class_id": cid, "week": week, "rows": body.Rows, "curriculum_level": body.CurriculumLevel, "updated_by": c.User.ID}, "resolution=merge-duplicates,return=representation", &plans)
	} else {
		err = c.Get(r.Context(), "/rest/v1/instructor_plans", q, &plans)
	}
	if err != nil {
		http.Error(w, "Unable to load or save plan", 400)
		return
	}
	var plan any
	if len(plans) > 0 {
		plan = plans[0]
	}
	writeJSON(w, map[string]any{"plan": plan})
}

func SessionInstructorRoster(w http.ResponseWriter, r *http.Request) {
	c, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	sid := mux.Vars(r)["sessionId"]
	var allowed bool
	if err = c.RPC(r.Context(), "can_edit_session", map[string]any{"p_session_id": sid, "p_uid": c.User.ID}, &allowed); err != nil || !allowed {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	rows := []map[string]any{}
	if err = c.RPC(r.Context(), "session_instructor_roster", map[string]any{"p_session": sid}, &rows); err != nil {
		http.Error(w, "Unable to load session instructors", http.StatusBadRequest)
		return
	}
	if rows == nil {
		rows = []map[string]any{}
	}
	writeJSON(w, map[string]any{"instructors": rows})
}
