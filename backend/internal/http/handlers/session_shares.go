package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	supabasesvc "cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

type createSessionShareRequest struct {
	SessionID        string   `json:"session_id"`
	SharedWith       string   `json:"shared_with"`
	ShareDate        string   `json:"share_date"`
	ShareDates       []string `json:"share_dates"`
	AllowRosterEdits bool     `json:"allow_roster_edits"`
}

type sessionShareRecipientRow struct {
	ID        string `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
}

type ownedSessionShareRow struct {
	ID                string                    `json:"id"`
	ShareDate         string                    `json:"share_date"`
	AllowRosterEdits  bool                      `json:"allow_roster_edits"`
	CreatedAt         string                    `json:"created_at"`
	Session           *sessionRow               `json:"sessions"`
	SharedWithProfile *sessionShareRecipientRow `json:"shared_with_profile"`
}

func SearchSessionShareRecipients(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if _, err := loadOrCreateProfile(r, client); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	queryText := sanitizeProfileSearchQuery(r.URL.Query().Get("q"))
	if queryText == "" {
		writeJSON(w, map[string]any{"results": []sessionShareRecipientRow{}})
		return
	}

	serviceClient, err := supabasesvc.NewServiceClientFromEnv()
	if err != nil {
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	query := url.Values{}
	query.Set("select", "id,first_name,last_name,email")
	query.Set("account_type", "eq.part_time")
	query.Set("id", "neq."+client.User.ID)
	query.Set("or", fmt.Sprintf("(first_name.ilike.*%[1]s*,last_name.ilike.*%[1]s*,email.ilike.*%[1]s*)", queryText))
	query.Set("order", "first_name.asc,last_name.asc,email.asc")
	query.Set("limit", "25")

	var rows []sessionShareRecipientRow
	if err := serviceClient.Get(r.Context(), "/rest/v1/profiles", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"results": rows})
}

func CreateSessionShare(w http.ResponseWriter, r *http.Request) {
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

	var req createSessionShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	shareDates, err := normalizeShareDates(req.ShareDates, req.ShareDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	sessionID := strings.TrimSpace(req.SessionID)
	sharedWith := strings.TrimSpace(req.SharedWith)
	if sessionID == "" || sharedWith == "" {
		http.Error(w, "Session and recipient are required", http.StatusBadRequest)
		return
	}
	if sharedWith == profile.ID {
		http.Error(w, "You cannot share a session with yourself", http.StatusBadRequest)
		return
	}

	session, err := loadOwnedShareableSession(r, client, profile.ID, sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if !isSessionActiveToday(*session, torontoToday()) {
		http.Error(w, "Only sessions currently within their active schedule can be shared", http.StatusBadRequest)
		return
	}
	if err := ensureRecipientExists(r, sharedWith); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := ensureShareDatesWithinSessionWindow(*session, shareDates); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := ensureShareDatesAvailable(r, client, sessionID, sharedWith, shareDates); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	rows := make([]map[string]any, 0, len(shareDates))
	for _, shareDate := range shareDates {
		rows = append(rows, map[string]any{
			"session_id":         sessionID,
			"share_date":         shareDate,
			"shared_by":          profile.ID,
			"shared_with":        sharedWith,
			"allow_roster_edits": req.AllowRosterEdits,
		})
	}
	if err := client.Post(r.Context(), "/rest/v1/session_shares", nil, rows, "", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func OwnedSessionShares(w http.ResponseWriter, r *http.Request) {
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

	shares, err := fetchOwnedSessionShares(r, client, profile.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"shares": shares})
}

func RevokeSessionShare(w http.ResponseWriter, r *http.Request) {
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

	shareID := strings.TrimSpace(mux.Vars(r)["id"])
	if shareID == "" {
		http.Error(w, "Missing share id", http.StatusBadRequest)
		return
	}

	existsQuery := url.Values{}
	existsQuery.Set("id", "eq."+shareID)
	existsQuery.Set("shared_by", "eq."+profile.ID)
	existsQuery.Set("select", "id")
	existsQuery.Set("limit", "1")
	var rows []map[string]any
	if err := client.Get(r.Context(), "/rest/v1/session_shares", existsQuery, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(rows) == 0 {
		http.Error(w, "Session share not found", http.StatusNotFound)
		return
	}

	deleteQuery := url.Values{}
	deleteQuery.Set("id", "eq."+shareID)
	deleteQuery.Set("shared_by", "eq."+profile.ID)
	if err := client.Delete(r.Context(), "/rest/v1/session_shares", deleteQuery, "", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func fetchOwnedSessionShares(
	r *http.Request,
	client *supabasesvc.Client,
	profileID string,
) ([]ownedSessionShareRow, error) {
	query := url.Values{}
	query.Set("shared_by", "eq."+profileID)
	query.Set("share_date", "gte."+torontoToday())
	query.Set(
		"select",
		"id,share_date,allow_roster_edits,created_at,sessions(id,team_id,created_by,session_day,session_season,session_year,start_date,end_date,location,source_locations,session_start_time24,session_end_time24,instructors),shared_with_profile:profiles!session_shares_shared_with_fkey(id,first_name,last_name,email)",
	)
	query.Set("order", "share_date.asc")

	var rows []ownedSessionShareRow
	if err := client.Get(r.Context(), "/rest/v1/session_shares", query, &rows); err != nil {
		return nil, err
	}
	for index := range rows {
		if rows[index].Session != nil {
			rows[index].Session.SourceLocations = effectiveSessionSourceLocations(
				rows[index].Session.Location,
				rows[index].Session.SourceLocations,
			)
		}
	}
	return rows, nil
}

func loadOwnedShareableSession(
	r *http.Request,
	client *supabasesvc.Client,
	profileID string,
	sessionID string,
) (*sessionRow, error) {
	query := url.Values{}
	query.Set("id", "eq."+strings.TrimSpace(sessionID))
	query.Set("created_by", "eq."+profileID)
	query.Set(
		"select",
		"id,team_id,created_by,session_day,session_season,session_year,start_date,end_date,location,source_locations,session_start_time24,session_end_time24,instructors",
	)
	query.Set("limit", "1")

	var rows []sessionRow
	if err := client.Get(r.Context(), "/rest/v1/sessions", query, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("Session not found")
	}
	rows[0].SourceLocations = effectiveSessionSourceLocations(rows[0].Location, rows[0].SourceLocations)
	return &rows[0], nil
}

func ensureRecipientExists(r *http.Request, recipientID string) error {
	serviceClient, err := supabasesvc.NewServiceClientFromEnv()
	if err != nil {
		return fmt.Errorf("Server configuration error")
	}
	query := url.Values{}
	query.Set("id", "eq."+strings.TrimSpace(recipientID))
	query.Set("select", "id")
	query.Set("limit", "1")

	var rows []map[string]any
	if err := serviceClient.Get(r.Context(), "/rest/v1/profiles", query, &rows); err != nil {
		return err
	}
	if len(rows) == 0 {
		return fmt.Errorf("Selected user does not exist")
	}
	return nil
}

func ensureShareDatesAvailable(
	r *http.Request,
	client *supabasesvc.Client,
	sessionID string,
	recipientID string,
	shareDates []string,
) error {
	query := url.Values{}
	query.Set("session_id", "eq."+strings.TrimSpace(sessionID))
	query.Set("shared_with", "eq."+strings.TrimSpace(recipientID))
	query.Set("share_date", "in.("+strings.Join(shareDates, ",")+")")
	query.Set("select", "share_date")

	var rows []shareRow
	if err := client.Get(r.Context(), "/rest/v1/session_shares", query, &rows); err != nil {
		return err
	}
	if len(rows) == 0 {
		return nil
	}

	existingDates := make([]string, 0, len(rows))
	for _, row := range rows {
		existingDates = append(existingDates, row.ShareDate)
	}
	sort.Strings(existingDates)
	return fmt.Errorf("Session already shared for: %s", strings.Join(existingDates, ", "))
}

func normalizeShareDates(shareDates []string, legacyShareDate string) ([]string, error) {
	allDates := append([]string{}, shareDates...)
	if strings.TrimSpace(legacyShareDate) != "" {
		allDates = append(allDates, legacyShareDate)
	}
	if len(allDates) == 0 {
		return nil, fmt.Errorf("At least one share date is required")
	}

	seen := make(map[string]struct{}, len(allDates))
	normalized := make([]string, 0, len(allDates))
	for _, value := range allDates {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, err := time.Parse("2006-01-02", trimmed); err != nil {
			return nil, fmt.Errorf("Invalid share date: %s", trimmed)
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	if len(normalized) == 0 {
		return nil, fmt.Errorf("At least one share date is required")
	}
	sort.Strings(normalized)
	return normalized, nil
}

func isSessionActiveToday(session sessionRow, today string) bool {
	startDate := strings.TrimSpace(pointerStringValue(session.StartDate))
	endDate := strings.TrimSpace(pointerStringValue(session.EndDate))
	if startDate != "" && today < startDate {
		return false
	}
	if endDate != "" && today > endDate {
		return false
	}
	return true
}

func ensureShareDatesWithinSessionWindow(session sessionRow, shareDates []string) error {
	startDate := strings.TrimSpace(pointerStringValue(session.StartDate))
	endDate := strings.TrimSpace(pointerStringValue(session.EndDate))
	for _, shareDate := range shareDates {
		if startDate != "" && shareDate < startDate {
			return fmt.Errorf("Share dates must stay within the session schedule")
		}
		if endDate != "" && shareDate > endDate {
			return fmt.Errorf("Share dates must stay within the session schedule")
		}
	}
	return nil
}

func pointerStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func sanitizeProfileSearchQuery(value string) string {
	replacer := strings.NewReplacer(",", " ", "(", " ", ")", " ", "*", " ", "%", " ")
	return strings.TrimSpace(replacer.Replace(value))
}
