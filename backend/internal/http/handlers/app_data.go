package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	supabasesvc "cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

type profileRow struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	Location    *string `json:"location"`
	AccountType string  `json:"account_type"`
}

type teamInviteRow struct {
	ID     string `json:"id"`
	TeamID string `json:"team_id"`
	Status string `json:"status"`
	Teams  *struct {
		Name string `json:"name"`
	} `json:"teams"`
}

type teamMembershipRow struct {
	TeamID string `json:"team_id"`
	Role   string `json:"role"`
	Teams  *struct {
		Name string `json:"name"`
	} `json:"teams"`
}

type teamRow struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	OwnerID            string   `json:"owner_id,omitempty"`
	AvailableLocations []string `json:"available_locations"`
}

type sessionRow struct {
	ID                 string              `json:"id"`
	TeamID             *string             `json:"team_id"`
	CreatedBy          string              `json:"created_by"`
	SessionDay         string              `json:"session_day"`
	SessionSeason      *string             `json:"session_season"`
	SessionYear        *int                `json:"session_year"`
	StartDate          *string             `json:"start_date"`
	EndDate            *string             `json:"end_date"`
	Location           *string             `json:"location"`
	SourceLocations    []string            `json:"source_locations"`
	SessionStartTime24 *string             `json:"session_start_time24"`
	SessionEndTime24   *string             `json:"session_end_time24"`
	Instructors        []map[string]string `json:"instructors"`
	UpdatedAt          *string             `json:"updated_at,omitempty"`
}

type shareRow struct {
	AllowRosterEdits bool   `json:"allow_roster_edits"`
	ShareDate        string `json:"share_date"`
}

type sessionNoteRow struct {
	ID           string  `json:"id"`
	CreatedAt    string  `json:"created_at"`
	NoteType     string  `json:"note_type"`
	Text         string  `json:"text"`
	EmployeeName *string `json:"employee_name"`
	Done         *bool   `json:"done"`
}

type reportCardRow struct {
	Instructor          *string `json:"instructor"`
	NumberOfReportCards *int    `json:"number_of_report_cards"`
}

type schematicRow struct {
	SessionID string         `json:"session_id"`
	Data      map[string]any `json:"data"`
}

type rosterLevelEditRow struct {
	Code  string `json:"code"`
	Level string `json:"level"`
}

type rosterStudentLevelEditRow struct {
	Code            string `json:"code"`
	StudentNameHash string `json:"student_name_hash"`
	Level           string `json:"level"`
}

func AccountData(w http.ResponseWriter, r *http.Request) {
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

	invitesQuery := url.Values{}
	invitesQuery.Set("invitee_id", "eq."+client.User.ID)
	invitesQuery.Set("status", "eq.pending")
	invitesQuery.Set("select", "id,team_id,status,teams(name)")
	var invites []teamInviteRow
	if err := client.Get(r.Context(), "/rest/v1/team_invites", invitesQuery, &invites); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	membershipsQuery := url.Values{}
	membershipsQuery.Set("user_id", "eq."+client.User.ID)
	membershipsQuery.Set("select", "team_id,role,teams(name)")
	var memberships []teamMembershipRow
	if err := client.Get(r.Context(), "/rest/v1/team_members", membershipsQuery, &memberships); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, map[string]any{
		"profile":     profile,
		"invites":     invites,
		"memberships": memberships,
	})
}

func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		FirstName string  `json:"first_name"`
		LastName  string  `json:"last_name"`
		Location  *string `json:"location"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	body := map[string]any{
		"id":         client.User.ID,
		"email":      client.User.Email,
		"first_name": strings.TrimSpace(payload.FirstName),
		"last_name":  strings.TrimSpace(payload.LastName),
		"location":   payload.Location,
	}

	var rows []profileRow
	if err := client.Post(r.Context(), "/rest/v1/profiles", nil, body, "resolution=merge-duplicates,return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(rows) == 0 {
		http.Error(w, "Failed to update profile", http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"profile": rows[0]})
}

func CurrentTeams(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	memberQuery := url.Values{}
	memberQuery.Set("user_id", "eq."+client.User.ID)
	memberQuery.Set("select", "team_id")
	var memberRows []struct {
		TeamID string `json:"team_id"`
	}
	if err := client.Get(r.Context(), "/rest/v1/team_members", memberQuery, &memberRows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ownedQuery := url.Values{}
	ownedQuery.Set("owner_id", "eq."+client.User.ID)
	ownedQuery.Set("select", "id,name,available_locations")
	var owned []teamRow
	if err := client.Get(r.Context(), "/rest/v1/teams", ownedQuery, &owned); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ids := make([]string, 0, len(memberRows)+len(owned))
	seen := make(map[string]struct{})
	for _, row := range memberRows {
		if row.TeamID == "" {
			continue
		}
		if _, ok := seen[row.TeamID]; ok {
			continue
		}
		seen[row.TeamID] = struct{}{}
		ids = append(ids, row.TeamID)
	}
	for _, team := range owned {
		if _, ok := seen[team.ID]; ok {
			continue
		}
		seen[team.ID] = struct{}{}
		ids = append(ids, team.ID)
	}

	allTeams := owned
	if len(ids) > 0 {
		query := url.Values{}
		query.Set("id", "in.("+strings.Join(ids, ",")+")")
		query.Set("select", "id,name,available_locations")
		var memberTeams []teamRow
		if err := client.Get(r.Context(), "/rest/v1/teams", query, &memberTeams); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		merged := make(map[string]teamRow)
		for _, team := range append(owned, memberTeams...) {
			merged[team.ID] = team
		}
		allTeams = make([]teamRow, 0, len(merged))
		for _, team := range merged {
			allTeams = append(allTeams, team)
		}
	}
	writeJSON(w, map[string]any{"teams": allTeams})
}

func CurrentSession(w http.ResponseWriter, r *http.Request) {
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
	sessionID := mux.Vars(r)["id"]
	if strings.TrimSpace(sessionID) == "" {
		http.Error(w, "Missing session id", http.StatusBadRequest)
		return
	}

	query := url.Values{}
	query.Set("id", "eq."+sessionID)
	query.Set("select", "id,team_id,created_by,session_day,session_season,session_year,start_date,end_date,location,source_locations,session_start_time24,session_end_time24,instructors")
	var rows []sessionRow
	if err := client.Get(r.Context(), "/rest/v1/sessions", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(rows) == 0 {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	row := rows[0]
	row.SourceLocations = effectiveSessionSourceLocations(row.Location, row.SourceLocations)

	access := map[string]any{"mode": "none", "allowRosterEdits": false}
	if row.CreatedBy == profile.ID {
		access["mode"] = "owner"
		access["allowRosterEdits"] = true
		writeJSON(w, map[string]any{"session": row, "access": access})
		return
	}

	shareQuery := url.Values{}
	shareQuery.Set("session_id", "eq."+sessionID)
	shareQuery.Set("shared_with", "eq."+client.User.ID)
	shareQuery.Set("share_date", "eq."+torontoToday())
	shareQuery.Set("select", "allow_roster_edits,share_date")
	shareQuery.Set("limit", "1")
	var shares []shareRow
	if err := client.Get(r.Context(), "/rest/v1/session_shares", shareQuery, &shares); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(shares) > 0 {
		access["mode"] = "shared"
		access["allowRosterEdits"] = shares[0].AllowRosterEdits
		access["shareDate"] = shares[0].ShareDate
	}

	writeJSON(w, map[string]any{"session": row, "access": access})
}

func MySessions(w http.ResponseWriter, r *http.Request) {
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
	query := url.Values{}
	query.Set("created_by", "eq."+profile.ID)
	query.Set("select", "id,team_id,created_by,session_day,session_season,session_year,start_date,end_date,location,source_locations,session_start_time24,session_end_time24,instructors")
	var rows []sessionRow
	if err := client.Get(r.Context(), "/rest/v1/sessions", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	for index := range rows {
		rows[index].SourceLocations = effectiveSessionSourceLocations(rows[index].Location, rows[index].SourceLocations)
	}
	writeJSON(w, map[string]any{"sessions": rows})
}

func SharedSessionsToday(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	query := url.Values{}
	query.Set("shared_with", "eq."+client.User.ID)
	query.Set("share_date", "eq."+torontoToday())
	query.Set("select", "id,share_date,allow_roster_edits,sessions(id,team_id,created_by,session_day,session_season,session_year,start_date,end_date,location,source_locations,session_start_time24,session_end_time24,instructors)")
	var rows []map[string]any
	if err := client.Get(r.Context(), "/rest/v1/session_shares", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"sharedSessions": rows})
}

func TeamSessions(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	teamID := mux.Vars(r)["id"]
	if teamID == "" {
		http.Error(w, "Missing team id", http.StatusBadRequest)
		return
	}
	selectFields := r.URL.Query().Get("select")
	if selectFields == "" {
		selectFields = "id,team_id,created_by,session_day,session_season,session_year,start_date,end_date,location,source_locations,session_start_time24,session_end_time24,instructors,updated_at"
	}
	query := url.Values{}
	query.Set("team_id", "eq."+teamID)
	query.Set("select", selectFields)
	var rows []map[string]any
	if err := client.Get(r.Context(), "/rest/v1/sessions", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"sessions": rows})
}

func CreateSession(w http.ResponseWriter, r *http.Request) {
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
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	teamID, _ := payload["team_id"].(string)
	if teamID = strings.TrimSpace(teamID); teamID != "" {
		if !userCanCreateSessionForTeam(r, client, teamID) {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	}
	normalizeSessionPayloadLocations(payload)
	payload["created_by"] = profile.ID
	serviceClient, err := supabasesvc.NewServiceClientFromEnv()
	if err != nil {
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}
	var rows []map[string]any
	if err := serviceClient.Post(r.Context(), "/rest/v1/sessions", nil, payload, "return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"session": firstMap(rows)})
}

func userCanCreateSessionForTeam(r *http.Request, client *supabasesvc.Client, teamID string) bool {
	ownedQuery := url.Values{}
	ownedQuery.Set("id", "eq."+teamID)
	ownedQuery.Set("owner_id", "eq."+client.User.ID)
	ownedQuery.Set("select", "id")
	ownedQuery.Set("limit", "1")
	var owned []teamRow
	if err := client.Get(r.Context(), "/rest/v1/teams", ownedQuery, &owned); err == nil && len(owned) > 0 {
		return true
	}

	memberQuery := url.Values{}
	memberQuery.Set("team_id", "eq."+teamID)
	memberQuery.Set("user_id", "eq."+client.User.ID)
	memberQuery.Set("select", "team_id")
	memberQuery.Set("limit", "1")
	var members []struct {
		TeamID string `json:"team_id"`
	}
	return client.Get(r.Context(), "/rest/v1/team_members", memberQuery, &members) == nil && len(members) > 0
}

func UpdateSession(w http.ResponseWriter, r *http.Request) {
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
	sessionID := mux.Vars(r)["id"]
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	normalizeSessionPayloadLocations(payload)
	reportCardSync, _ := payload["report_card_sync"].(map[string]any)
	delete(payload, "report_card_sync")

	query := url.Values{}
	query.Set("id", "eq."+sessionID)
	query.Set("created_by", "eq."+profile.ID)
	var rows []map[string]any
	if err := client.Patch(r.Context(), "/rest/v1/sessions", query, payload, "return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(rows) == 0 {
		http.Error(w, "Session update did not apply", http.StatusForbidden)
		return
	}
	if reportCardSync != nil {
		if err := syncReportCardScope(r, client, reportCardSync); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}
	writeJSON(w, map[string]any{"session": rows[0]})
}

func DeleteSession(w http.ResponseWriter, r *http.Request) {
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
	sessionID := mux.Vars(r)["id"]
	query := url.Values{}
	query.Set("id", "eq."+sessionID)
	query.Set("created_by", "eq."+profile.ID)
	if err := client.Delete(r.Context(), "/rest/v1/sessions", query, "", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func SessionNotes(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		http.Error(w, "Missing session id", http.StatusBadRequest)
		return
	}
	query := url.Values{}
	query.Set("session_id", "eq."+sessionID)
	query.Set("select", "id,created_at,note_type,text,employee_name,done")
	query.Set("order", "created_at.desc")
	var rows []sessionNoteRow
	if err := client.Get(r.Context(), "/rest/v1/session_notes", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"notes": rows})
}

func CreateSessionNote(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	payload["created_by"] = client.User.ID
	var rows []sessionNoteRow
	if err := client.Post(r.Context(), "/rest/v1/session_notes", nil, payload, "return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"note": firstSessionNote(rows)})
}

func UpdateSessionNote(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	noteID := mux.Vars(r)["id"]
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	query := url.Values{}
	query.Set("id", "eq."+noteID)
	var rows []sessionNoteRow
	if err := client.Patch(r.Context(), "/rest/v1/session_notes", query, payload, "return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"note": firstSessionNote(rows)})
}

func DeleteSessionNote(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	noteID := mux.Vars(r)["id"]
	query := url.Values{}
	query.Set("id", "eq."+noteID)
	if err := client.Delete(r.Context(), "/rest/v1/session_notes", query, "", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func ReportCardTotals(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	sessionLabel := r.URL.Query().Get("session")
	if sessionLabel == "" {
		http.Error(w, "Missing session label", http.StatusBadRequest)
		return
	}
	query := url.Values{}
	query.Set("session", "eq."+sessionLabel)
	query.Set("select", "instructor,number_of_report_cards")
	if teamID := r.URL.Query().Get("teamId"); teamID != "" {
		query.Set("team_id", "eq."+teamID)
	}
	var rows []reportCardRow
	if err := client.Get(r.Context(), "/rest/v1/report_cards", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"totals": rows})
}

func SyncReportCards(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var payload struct {
		Day          string           `json:"day"`
		SessionLabel string           `json:"sessionLabel"`
		TeamID       *string          `json:"teamId"`
		Students     []map[string]any `json:"students"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	totals := make(map[string]int)
	for _, student := range payload.Students {
		name, _ := student["instructor"].(string)
		name = strings.TrimSpace(name)
		if name == "" {
			writeJSON(w, map[string]any{"status": "blocked_unassigned"})
			return
		}
		totals[name]++
	}

	clearQuery := url.Values{}
	clearQuery.Set("session", "eq."+payload.SessionLabel)
	clearQuery.Set("day", "eq."+payload.Day)
	clearQuery.Set("created_by", "eq."+client.User.ID)
	if payload.TeamID != nil && strings.TrimSpace(*payload.TeamID) != "" {
		clearQuery.Set("team_id", "eq."+*payload.TeamID)
	} else {
		clearQuery.Set("team_id", "is.null")
	}
	if err := client.Delete(r.Context(), "/rest/v1/report_cards", clearQuery, "", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(totals) == 0 {
		writeJSON(w, map[string]any{"status": "empty"})
		return
	}
	rows := make([]map[string]any, 0, len(totals))
	updatedAt := time.Now().UTC().Format(time.RFC3339)
	for instructor, total := range totals {
		rows = append(rows, map[string]any{
			"session":                payload.SessionLabel,
			"day":                    payload.Day,
			"instructor":             instructor,
			"number_of_report_cards": total,
			"team_id":                payload.TeamID,
			"created_by":             client.User.ID,
			"updated_at":             updatedAt,
		})
	}
	if err := client.Post(r.Context(), "/rest/v1/report_cards", nil, rows, "", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"status": "synced"})
}

func GetSchematic(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	sessionID := mux.Vars(r)["sessionId"]
	query := url.Values{}
	query.Set("session_id", "eq."+sessionID)
	query.Set("select", "session_id,data")
	query.Set("limit", "1")
	var rows []schematicRow
	if err := client.Get(r.Context(), "/rest/v1/schematics", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"schematic": firstSchematic(rows)})
}

func GetSchematics(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	sessionIDs := splitCSV(r.URL.Query().Get("sessionIds"))
	query := url.Values{}
	query.Set("select", "session_id,data")
	if len(sessionIDs) > 0 {
		query.Set("session_id", "in.("+strings.Join(sessionIDs, ",")+")")
	}
	var rows []schematicRow
	if err := client.Get(r.Context(), "/rest/v1/schematics", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"schematics": rows})
}

func UpsertSchematic(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	sessionID := mux.Vars(r)["sessionId"]
	var payload struct {
		Data map[string]any `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	body := map[string]any{
		"session_id": sessionID,
		"created_by": client.User.ID,
		"data":       payload.Data,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}
	query := url.Values{}
	query.Set("on_conflict", "session_id")
	var rows []schematicRow
	if err := client.Post(r.Context(), "/rest/v1/schematics", query, body, "resolution=merge-duplicates,return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"schematic": firstSchematic(rows)})
}

func GetRosterEdits(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		http.Error(w, "Missing session id", http.StatusBadRequest)
		return
	}
	levelQuery := url.Values{}
	levelQuery.Set("session_id", "eq."+sessionID)
	levelQuery.Set("select", "code,level")
	studentQuery := url.Values{}
	studentQuery.Set("session_id", "eq."+sessionID)
	studentQuery.Set("select", "code,student_name_hash,level")
	var levelRows []rosterLevelEditRow
	var studentRows []rosterStudentLevelEditRow
	if err := client.Get(r.Context(), "/rest/v1/roster_level_edits", levelQuery, &levelRows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := client.Get(r.Context(), "/rest/v1/roster_student_level_edits", studentQuery, &studentRows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"rosterEdits": levelRows, "studentEdits": studentRows})
}

func UpsertRosterLevelEdit(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	payload["created_by"] = client.User.ID
	payload["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	if err := client.Post(r.Context(), "/rest/v1/roster_level_edits", nil, payload, "resolution=merge-duplicates", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func UpsertRosterStudentLevelEdit(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	payload["created_by"] = client.User.ID
	payload["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	if err := client.Post(r.Context(), "/rest/v1/roster_student_level_edits", nil, payload, "resolution=merge-duplicates", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func loadOrCreateProfile(r *http.Request, client *supabasesvc.Client) (*profileRow, error) {
	query := url.Values{}
	query.Set("id", "eq."+client.User.ID)
	query.Set("select", "id,email,first_name,last_name,location,account_type")
	query.Set("limit", "1")
	var rows []profileRow
	if err := client.Get(r.Context(), "/rest/v1/profiles", query, &rows); err != nil {
		return nil, err
	}
	if len(rows) > 0 {
		return &rows[0], nil
	}

	insertBody := map[string]any{
		"id":    client.User.ID,
		"email": client.User.Email,
	}
	if err := client.Post(r.Context(), "/rest/v1/profiles", nil, insertBody, "", nil); err != nil {
		return nil, err
	}
	if err := client.Get(r.Context(), "/rest/v1/profiles", query, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, errors.New("profile not found")
	}
	return &rows[0], nil
}

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}

func torontoToday() string {
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		return time.Now().UTC().Format("2006-01-02")
	}
	return time.Now().In(loc).Format("2006-01-02")
}

func splitCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func firstMap(rows []map[string]any) map[string]any {
	if len(rows) == 0 {
		return nil
	}
	return rows[0]
}

func firstSessionNote(rows []sessionNoteRow) *sessionNoteRow {
	if len(rows) == 0 {
		return nil
	}
	return &rows[0]
}

func firstSchematic(rows []schematicRow) *schematicRow {
	if len(rows) == 0 {
		return nil
	}
	return &rows[0]
}

func syncReportCardScope(r *http.Request, client *supabasesvc.Client, syncData map[string]any) error {
	previousSessionLabel := stringValue(syncData["previousSessionLabel"])
	previousSessionDay := stringValue(syncData["previousSessionDay"])
	nextSessionLabel := stringValue(syncData["nextSessionLabel"])
	nextSessionDay := stringValue(syncData["nextSessionDay"])
	if previousSessionLabel == "" || previousSessionDay == "" || nextSessionLabel == "" || nextSessionDay == "" {
		return nil
	}
	clearQuery := url.Values{}
	clearQuery.Set("created_by", "eq."+client.User.ID)
	clearQuery.Set("session", "eq."+nextSessionLabel)
	clearQuery.Set("day", "eq."+nextSessionDay)
	if nextTeamID := stringValue(syncData["nextTeamId"]); nextTeamID != "" {
		clearQuery.Set("team_id", "eq."+nextTeamID)
	} else {
		clearQuery.Set("team_id", "is.null")
	}
	if err := client.Delete(r.Context(), "/rest/v1/report_cards", clearQuery, "", nil); err != nil {
		return err
	}

	updateBody := map[string]any{
		"team_id":    nullableString(syncData["nextTeamId"]),
		"session":    nextSessionLabel,
		"day":        nextSessionDay,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}
	updateQuery := url.Values{}
	updateQuery.Set("created_by", "eq."+client.User.ID)
	updateQuery.Set("session", "eq."+previousSessionLabel)
	updateQuery.Set("day", "eq."+previousSessionDay)
	if previousTeamID := stringValue(syncData["previousTeamId"]); previousTeamID != "" {
		updateQuery.Set("team_id", "eq."+previousTeamID)
	} else {
		updateQuery.Set("team_id", "is.null")
	}
	return client.Patch(r.Context(), "/rest/v1/report_cards", updateQuery, updateBody, "", nil)
}

func stringValue(value any) string {
	if s, ok := value.(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func nullableString(value any) any {
	if s := stringValue(value); s != "" {
		return s
	}
	return nil
}
