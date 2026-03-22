package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	supabasesvc "cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

type requestAssignmentRow struct {
	ID         string `json:"id"`
	EventID    string `json:"event_id"`
	Term       string `json:"term"`
	Location   string `json:"location"`
	Instructor string `json:"instructor"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

func GetRequestAssignments(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if _, err := loadOrCreateProfile(r, client); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	query := url.Values{}
	query.Set("select", "id,event_id,term,location,instructor,created_at,updated_at")
	query.Set("order", "term.desc,location.asc,event_id.asc")
	if term := strings.TrimSpace(r.URL.Query().Get("term")); term != "" {
		query.Set("term", "eq."+term)
	}
	if location := strings.TrimSpace(r.URL.Query().Get("location")); location != "" {
		query.Set("location", "eq."+location)
	}

	var rows []requestAssignmentRow
	if err := client.Get(r.Context(), "/rest/v1/request_assignments", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, map[string]any{"assignments": mapRequestAssignments(rows)})
}

func CreateRequestAssignment(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	profile, err := loadOrCreateProfile(r, client)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if profile.AccountType != "full_time" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var payload struct {
		EventID    string `json:"eventId"`
		Term       string `json:"term"`
		Location   string `json:"location"`
		Instructor string `json:"instructor"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	body := map[string]any{
		"event_id":   strings.TrimSpace(payload.EventID),
		"term":       normalizeRequestAssignmentTerm(payload.Term),
		"location":   strings.TrimSpace(payload.Location),
		"instructor": strings.TrimSpace(payload.Instructor),
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}
	if body["event_id"] == "" || body["term"] == "" || body["location"] == "" || body["instructor"] == "" {
		http.Error(w, "Missing required assignment fields", http.StatusBadRequest)
		return
	}

	var rows []requestAssignmentRow
	if err := client.Post(
		r.Context(),
		"/rest/v1/request_assignments",
		nil,
		body,
		"resolution=merge-duplicates,return=representation",
		&rows,
	); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, map[string]any{"assignment": firstRequestAssignment(rows)})
}

func UpdateRequestAssignment(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	profile, err := loadOrCreateProfile(r, client)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if profile.AccountType != "full_time" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var payload struct {
		EventID    *string `json:"eventId"`
		Term       *string `json:"term"`
		Location   *string `json:"location"`
		Instructor *string `json:"instructor"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	update := map[string]any{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}
	if payload.EventID != nil {
		update["event_id"] = strings.TrimSpace(*payload.EventID)
	}
	if payload.Term != nil {
		update["term"] = normalizeRequestAssignmentTerm(*payload.Term)
	}
	if payload.Location != nil {
		update["location"] = strings.TrimSpace(*payload.Location)
	}
	if payload.Instructor != nil {
		update["instructor"] = strings.TrimSpace(*payload.Instructor)
	}

	query := url.Values{}
	query.Set("id", "eq."+mux.Vars(r)["id"])
	var rows []requestAssignmentRow
	if err := client.Patch(r.Context(), "/rest/v1/request_assignments", query, update, "return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(rows) == 0 {
		http.Error(w, "Assignment update did not apply", http.StatusNotFound)
		return
	}

	writeJSON(w, map[string]any{"assignment": firstRequestAssignment(rows)})
}

func DeleteRequestAssignment(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	profile, err := loadOrCreateProfile(r, client)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if profile.AccountType != "full_time" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	query := url.Values{}
	query.Set("id", "eq."+mux.Vars(r)["id"])
	if err := client.Delete(r.Context(), "/rest/v1/request_assignments", query, "", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func mapRequestAssignments(rows []requestAssignmentRow) []map[string]any {
	assignments := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		assignments = append(assignments, map[string]any{
			"id":         row.ID,
			"eventId":    row.EventID,
			"term":       row.Term,
			"location":   row.Location,
			"instructor": row.Instructor,
			"createdAt":  row.CreatedAt,
			"updatedAt":  row.UpdatedAt,
		})
	}
	return assignments
}

func firstRequestAssignment(rows []requestAssignmentRow) map[string]any {
	if len(rows) == 0 {
		return nil
	}
	return mapRequestAssignments(rows[:1])[0]
}

func normalizeRequestAssignmentTerm(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	return strings.Join(strings.Fields(trimmed), " ")
}
