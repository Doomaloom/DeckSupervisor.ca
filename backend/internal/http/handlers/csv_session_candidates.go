package handlers

import (
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	supabasesvc "cob-aquatics/internal/services/supabase"
	"cob-aquatics/tasks"
)

type csvSessionCandidate struct {
	SessionKey     string             `json:"sessionKey"`
	DayOfWeek      string             `json:"dayOfWeek"`
	SessionSeason  string             `json:"sessionSeason"`
	SessionYear    int                `json:"sessionYear"`
	StartDate      string             `json:"startDate"`
	EndDate        string             `json:"endDate"`
	Location       string             `json:"location"`
	ClassCount     int                `json:"classCount"`
	StudentCount   int                `json:"studentCount"`
	CourseCodes    []string           `json:"courseCodes"`
	MatchedSession *csvMatchedSession `json:"matchedSession"`
}

type csvMatchedSession struct {
	ID          string         `json:"id"`
	Label       string         `json:"label"`
	OwnedByUser bool           `json:"ownedByUser"`
	Session     map[string]any `json:"session"`
}

type csvCandidateBucket struct {
	sessionKey    string
	dayOfWeek     string
	sessionSeason string
	sessionYear   int
	location      string
}

func CSVSessionCandidates(w http.ResponseWriter, r *http.Request) {
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

	file, _, err := r.FormFile("csv_file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	extracted, err := tasks.ExtractClassesFromCSV(file)
	if err != nil {
		http.Error(w, "Error extracting classes from CSV", http.StatusBadRequest)
		return
	}

	termSeason := strings.TrimSpace(r.FormValue("termSeason"))
	termYear := 0
	if rawYear := strings.TrimSpace(r.FormValue("termYear")); rawYear != "" {
		if parsedYear, parseErr := strconv.Atoi(rawYear); parseErr == nil && parsedYear > 0 {
			termYear = parsedYear
		}
	}

	if profile.AccountType == "full_time" {
		if strings.TrimSpace(r.FormValue("teamId")) == "" {
			http.Error(w, "Missing team id", http.StatusBadRequest)
			return
		}
		if termSeason == "" || termYear <= 0 {
			http.Error(w, "Missing term scope", http.StatusBadRequest)
			return
		}
		extracted = filterExtractedClassesByTerm(extracted, termSeason, termYear)
	}

	scopeSessions, err := loadCSVMatchScopeSessions(r, client, profile)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	candidates := buildCSVSessionCandidates(extracted.Sessions, scopeSessions, client.User.ID)
	writeJSON(w, map[string]any{
		"sessions":         candidates,
		"classesBySession": extracted.ClassesBySession,
	})
}

func loadCSVMatchScopeSessions(r *http.Request, client *supabasesvc.Client, profile *profileRow) ([]sessionRow, error) {
	if profile.AccountType == "full_time" {
		teamID := strings.TrimSpace(r.FormValue("teamId"))
		termSeason := strings.ToLower(strings.TrimSpace(r.FormValue("termSeason")))
		termYear, _ := strconv.Atoi(strings.TrimSpace(r.FormValue("termYear")))

		query := url.Values{}
		query.Set("team_id", "eq."+teamID)
		query.Set("select", "id,team_id,created_by,session_day,session_season,session_year,start_date,end_date,location,instructors,updated_at")
		var rows []sessionRow
		if err := client.Get(r.Context(), "/rest/v1/sessions", query, &rows); err != nil {
			return nil, err
		}

		filtered := make([]sessionRow, 0, len(rows))
		for _, row := range rows {
			season := strings.ToLower(strings.TrimSpace(csvStringValue(row.SessionSeason)))
			year := sessionYearValue(row)
			if season != termSeason || year != termYear {
				continue
			}
			filtered = append(filtered, row)
		}
		return filtered, nil
	}

	ownQuery := url.Values{}
	ownQuery.Set("created_by", "eq."+client.User.ID)
	ownQuery.Set("select", "id,team_id,created_by,session_day,session_season,session_year,start_date,end_date,location,instructors,updated_at")
	var ownRows []sessionRow
	if err := client.Get(r.Context(), "/rest/v1/sessions", ownQuery, &ownRows); err != nil {
		return nil, err
	}

	shareQuery := url.Values{}
	shareQuery.Set("shared_with", "eq."+client.User.ID)
	shareQuery.Set("share_date", "eq."+torontoToday())
	shareQuery.Set("select", "sessions(id,team_id,created_by,session_day,session_season,session_year,start_date,end_date,location,instructors,updated_at)")
	var sharedRows []struct {
		Sessions *sessionRow `json:"sessions"`
	}
	if err := client.Get(r.Context(), "/rest/v1/session_shares", shareQuery, &sharedRows); err != nil {
		return nil, err
	}

	merged := make(map[string]sessionRow)
	for _, row := range ownRows {
		merged[row.ID] = row
	}
	for _, row := range sharedRows {
		if row.Sessions == nil || strings.TrimSpace(row.Sessions.ID) == "" {
			continue
		}
		merged[row.Sessions.ID] = *row.Sessions
	}

	rows := make([]sessionRow, 0, len(merged))
	for _, row := range merged {
		rows = append(rows, row)
	}
	return rows, nil
}

func filterExtractedClassesByTerm(result *tasks.ExtractedCSVResult, season string, year int) *tasks.ExtractedCSVResult {
	normalizedSeason := strings.ToLower(strings.TrimSpace(season))
	if normalizedSeason == "" || year <= 0 {
		return result
	}

	filteredSessions := make([]tasks.ExtractedSession, 0, len(result.Sessions))
	filteredClassesBySession := make(map[string][]tasks.ExtractedClass)
	for _, session := range result.Sessions {
		if strings.ToLower(strings.TrimSpace(session.SessionSeason)) != normalizedSeason {
			continue
		}
		if session.SessionYear != year {
			continue
		}
		filteredSessions = append(filteredSessions, session)
		if classes := result.ClassesBySession[session.SessionKey]; len(classes) > 0 {
			filteredClassesBySession[session.SessionKey] = classes
		}
	}
	return &tasks.ExtractedCSVResult{
		Sessions:         filteredSessions,
		ClassesBySession: filteredClassesBySession,
	}
}

func buildCSVSessionCandidates(extractedSessions []tasks.ExtractedSession, sessions []sessionRow, userID string) []csvSessionCandidate {
	candidates := make([]csvSessionCandidate, 0, len(extractedSessions))
	for _, extractedSession := range extractedSessions {
		candidate := csvSessionCandidate{
			SessionKey:    extractedSession.SessionKey,
			DayOfWeek:     extractedSession.DayOfWeek,
			SessionSeason: extractedSession.SessionSeason,
			SessionYear:   extractedSession.SessionYear,
			StartDate:     extractedSession.StartDate,
			EndDate:       extractedSession.EndDate,
			Location:      extractedSession.Location,
			ClassCount:    extractedSession.ClassCount,
			StudentCount:  extractedSession.StudentCount,
			CourseCodes:   extractedSession.CourseCodes,
			MatchedSession: matchCSVSessionCandidate(&csvCandidateBucket{
				sessionKey:    extractedSession.SessionKey,
				dayOfWeek:     extractedSession.DayOfWeek,
				sessionSeason: extractedSession.SessionSeason,
				sessionYear:   extractedSession.SessionYear,
				location:      extractedSession.Location,
			}, sessions, userID),
		}
		candidates = append(candidates, candidate)
	}

	sort.Slice(candidates, func(i, j int) bool {
		dayI := csvCandidateDaySortKey(candidates[i].DayOfWeek)
		dayJ := csvCandidateDaySortKey(candidates[j].DayOfWeek)
		if dayI != dayJ {
			return dayI < dayJ
		}
		if candidates[i].SessionYear != candidates[j].SessionYear {
			return candidates[j].SessionYear < candidates[i].SessionYear
		}
		seasonI := strings.ToLower(strings.TrimSpace(candidates[i].SessionSeason))
		seasonJ := strings.ToLower(strings.TrimSpace(candidates[j].SessionSeason))
		if seasonI != seasonJ {
			return seasonI < seasonJ
		}
		return strings.ToLower(candidates[i].Location) < strings.ToLower(candidates[j].Location)
	})

	return candidates
}

func matchCSVSessionCandidate(bucket *csvCandidateBucket, sessions []sessionRow, userID string) *csvMatchedSession {
	matches := make([]sessionRow, 0, len(sessions))
	candidateSeason := strings.ToLower(strings.TrimSpace(bucket.sessionSeason))
	candidateLocation := strings.ToLower(strings.TrimSpace(bucket.location))
	for _, session := range sessions {
		sessionSeason := strings.ToLower(strings.TrimSpace(csvStringValue(session.SessionSeason)))
		sessionLocation := strings.ToLower(strings.TrimSpace(csvStringValue(session.Location)))
		if strings.TrimSpace(session.SessionDay) != bucket.dayOfWeek {
			continue
		}
		if sessionSeason != candidateSeason {
			continue
		}
		if sessionYearValue(session) != bucket.sessionYear {
			continue
		}
		if sessionLocation != candidateLocation {
			continue
		}
		matches = append(matches, session)
	}
	if len(matches) == 0 {
		return nil
	}

	sort.Slice(matches, func(i, j int) bool {
		left := strings.TrimSpace(csvStringValue(matches[i].UpdatedAt))
		right := strings.TrimSpace(csvStringValue(matches[j].UpdatedAt))
		if left != right {
			return left > right
		}
		return matches[i].ID > matches[j].ID
	})

	match := matches[0]
	return &csvMatchedSession{
		ID:          match.ID,
		Label:       csvSessionLabel(match),
		OwnedByUser: match.CreatedBy == userID,
		Session: map[string]any{
			"id":             match.ID,
			"team_id":        match.TeamID,
			"created_by":     match.CreatedBy,
			"session_day":    match.SessionDay,
			"session_season": match.SessionSeason,
			"session_year":   match.SessionYear,
			"start_date":     match.StartDate,
			"end_date":       match.EndDate,
			"location":       match.Location,
			"instructors":    match.Instructors,
		},
	}
}

func sessionYearValue(row sessionRow) int {
	if row.SessionYear != nil && *row.SessionYear > 0 {
		return *row.SessionYear
	}
	if row.StartDate == nil || strings.TrimSpace(*row.StartDate) == "" {
		return 0
	}
	if len(*row.StartDate) < 4 {
		return 0
	}
	year, err := strconv.Atoi((*row.StartDate)[:4])
	if err != nil {
		return 0
	}
	return year
}

func csvSessionLabel(row sessionRow) string {
	parts := make([]string, 0, 4)
	if day := strings.TrimSpace(row.SessionDay); day != "" {
		parts = append(parts, day)
	}
	if season := strings.TrimSpace(csvStringValue(row.SessionSeason)); season != "" {
		parts = append(parts, season)
	}
	if year := sessionYearValue(row); year > 0 {
		parts = append(parts, strconv.Itoa(year))
	}
	if location := strings.TrimSpace(csvStringValue(row.Location)); location != "" {
		parts = append(parts, location)
	}
	if len(parts) == 0 {
		return "Session"
	}
	return strings.Join(parts, " ")
}

func csvStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func csvCandidateDaySortKey(day string) int {
	switch strings.TrimSpace(day) {
	case "Mo":
		return 1
	case "Tu":
		return 2
	case "We":
		return 3
	case "Th":
		return 4
	case "Fr":
		return 5
	case "Sa":
		return 6
	case "Su":
		return 7
	default:
		return 99
	}
}
