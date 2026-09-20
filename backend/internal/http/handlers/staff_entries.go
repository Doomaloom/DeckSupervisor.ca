package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	supabasesvc "cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

const staffEntryRelations = ",author:profiles(first_name,last_name,email),session:sessions(session_day,session_season,session_year,start_date,location)"

type staffEntryMeta struct {
	ID        string `json:"id"`
	SessionID string `json:"session_id"`
	CreatedBy string `json:"created_by"`
	CreatedAt string `json:"created_at"`
	Author    *struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
	} `json:"author,omitempty"`
	Session *sessionRow `json:"session,omitempty"`
}

type sessionNoteRow struct {
	staffEntryMeta
	NoteType     string  `json:"note_type"`
	Text         string  `json:"text"`
	EmployeeName *string `json:"employee_name"`
	Done         bool    `json:"done"`
}

type sessionReportRow struct {
	staffEntryMeta
	Title      string         `json:"title"`
	ReportData map[string]any `json:"report_data"`
	UpdatedAt  string         `json:"updated_at"`
}

// Every lookup uses the caller's token. Team filters narrow RLS-visible rows;
// they never authorize access or use the service-role client.
func staffEntryScope(r *http.Request, client *supabasesvc.Client) (url.Values, bool, error) {
	params := r.URL.Query()
	sessionID, teamID := strings.TrimSpace(params.Get("sessionId")), strings.TrimSpace(params.Get("teamId"))
	query := url.Values{}
	if sessionID != "" && teamID == "" {
		query.Set("session_id", "eq."+sessionID)
		return query, false, nil
	}
	year, err := strconv.Atoi(params.Get("year"))
	season := strings.ToLower(strings.TrimSpace(params.Get("season")))
	if sessionID != "" || teamID == "" || season == "" || err != nil || year <= 0 {
		return nil, false, errors.New("Provide sessionId or teamId, season, and year")
	}
	var sessions []sessionRow
	if err := client.Get(r.Context(), "/rest/v1/sessions", url.Values{
		"team_id": {"eq." + teamID}, "select": {"id,session_season,session_year,start_date"},
	}, &sessions); err != nil {
		return nil, false, err
	}
	ids := []string{}
	for _, session := range sessions {
		sessionYear := 0
		if session.SessionYear != nil {
			sessionYear = *session.SessionYear
		}
		if sessionYear <= 0 && session.StartDate != nil {
			if date, err := time.Parse("2006-01-02", *session.StartDate); err == nil {
				sessionYear = date.Year()
			}
		}
		if session.SessionSeason != nil && strings.EqualFold(strings.TrimSpace(*session.SessionSeason), season) && sessionYear == year {
			ids = append(ids, session.ID)
		}
	}
	if len(ids) == 0 {
		return query, true, nil
	}
	// Preserve the team's existing current-member/owner author filter.
	var teams []teamRow
	if err := client.Get(r.Context(), "/rest/v1/teams", url.Values{"id": {"eq." + teamID}, "select": {"owner_id"}}, &teams); err != nil {
		return nil, false, err
	}
	var members []struct {
		UserID string `json:"user_id"`
	}
	if err := client.Get(r.Context(), "/rest/v1/team_members", url.Values{"team_id": {"eq." + teamID}, "select": {"user_id"}}, &members); err != nil {
		return nil, false, err
	}
	authors := []string{}
	for _, team := range teams {
		if team.OwnerID != "" {
			authors = append(authors, team.OwnerID)
		}
	}
	for _, member := range members {
		if member.UserID != "" {
			authors = append(authors, member.UserID)
		}
	}
	if len(authors) == 0 {
		return query, true, nil
	}
	query.Set("session_id", "in.("+strings.Join(ids, ",")+")")
	query.Set("created_by", "in.("+strings.Join(authors, ",")+")")
	return query, false, nil
}

func staffEntryError(w http.ResponseWriter, err error) {
	status := http.StatusBadRequest
	var upstream *supabasesvc.APIError
	if errors.As(err, &upstream) && (upstream.StatusCode == http.StatusForbidden || upstream.StatusCode == http.StatusUnauthorized) {
		status = upstream.StatusCode
	}
	http.Error(w, err.Error(), status)
}

func SessionNotes(w http.ResponseWriter, r *http.Request)   { listStaffEntries(w, r, false) }
func SessionReports(w http.ResponseWriter, r *http.Request) { listStaffEntries(w, r, true) }

func listStaffEntries(w http.ResponseWriter, r *http.Request, reports bool) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	query, empty, err := staffEntryScope(r, client)
	if err != nil {
		staffEntryError(w, err)
		return
	}
	if reports {
		rows := []sessionReportRow{}
		query.Set("select", "id,session_id,created_by,created_at,updated_at,title,report_data"+staffEntryRelations)
		query.Set("order", "updated_at.desc")
		if !empty {
			err = client.Get(r.Context(), "/rest/v1/session_reports", query, &rows)
		}
		if err != nil {
			staffEntryError(w, err)
			return
		}
		writeJSON(w, map[string]any{"reports": rows})
	} else {
		rows := []sessionNoteRow{}
		query.Set("select", "id,session_id,created_by,created_at,note_type,text,employee_name,done"+staffEntryRelations)
		query.Set("order", "created_at.desc")
		if !empty {
			err = client.Get(r.Context(), "/rest/v1/session_notes", query, &rows)
		}
		if err != nil {
			staffEntryError(w, err)
			return
		}
		writeJSON(w, map[string]any{"notes": rows})
	}
}

func CreateSessionReport(w http.ResponseWriter, r *http.Request) { writeStaffEntry(w, r, true, true) }
func UpdateSessionReport(w http.ResponseWriter, r *http.Request) { writeStaffEntry(w, r, true, false) }
func CreateSessionNote(w http.ResponseWriter, r *http.Request)   { writeStaffEntry(w, r, false, true) }
func UpdateSessionNote(w http.ResponseWriter, r *http.Request)   { writeStaffEntry(w, r, false, false) }

func writeStaffEntry(w http.ResponseWriter, r *http.Request, reports, create bool) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var input map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input == nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	fields := []string{"text", "employee_name", "done"}
	table, key := "session_notes", "note"
	if reports {
		fields = []string{"title", "report_data"}
		table, key = "session_reports", "report"
	}
	if create {
		fields = append(fields, "session_id")
		if !reports {
			fields = append(fields, "note_type")
		}
	}
	body := map[string]any{}
	for _, field := range fields {
		if value, exists := input[field]; exists {
			body[field] = value
		}
	}
	if len(body) == 0 {
		http.Error(w, "No editable fields provided", http.StatusBadRequest)
		return
	}
	query := url.Values{}
	if create {
		var sessionID string
		if json.Unmarshal(input["session_id"], &sessionID) != nil || strings.TrimSpace(sessionID) == "" {
			http.Error(w, "Missing session id", http.StatusBadRequest)
			return
		}
		body["created_by"] = client.User.ID
	} else {
		query.Set("id", "eq."+mux.Vars(r)["id"])
	}
	if reports {
		body["updated_at"] = time.Now().UTC().Format(time.RFC3339Nano)
	}
	var rows []map[string]any
	if create {
		err = client.Post(r.Context(), "/rest/v1/"+table, query, body, "return=representation", &rows)
	} else {
		err = client.Patch(r.Context(), "/rest/v1/"+table, query, body, "return=representation", &rows)
	}
	if err != nil {
		staffEntryError(w, err)
		return
	}
	if len(rows) != 1 {
		http.Error(w, "Entry was not saved; it may no longer be accessible", http.StatusForbidden)
		return
	}
	writeJSON(w, map[string]any{key: rows[0]})
}

func DeleteSessionNote(w http.ResponseWriter, r *http.Request) {
	deleteStaffEntry(w, r, "session_notes")
}
func DeleteSessionReport(w http.ResponseWriter, r *http.Request) {
	deleteStaffEntry(w, r, "session_reports")
}

func deleteStaffEntry(w http.ResponseWriter, r *http.Request, table string) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	query := url.Values{"id": {"eq." + mux.Vars(r)["id"]}, "select": {"id"}}
	var rows []struct {
		ID string `json:"id"`
	}
	if err := client.Delete(r.Context(), "/rest/v1/"+table, query, "return=representation", &rows); err != nil {
		staffEntryError(w, err)
		return
	}
	if len(rows) != 1 {
		http.Error(w, "Entry was not deleted; it may no longer be accessible", http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
