package handlers

import (
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	supabasesvc "cob-aquatics/internal/services/supabase"
	"cob-aquatics/tasks"
)

type CSVAnalyzeResponse struct {
	Success            bool                           `json:"success"`
	Meta               CSVAnalyzeMeta                 `json:"meta"`
	Rosters            []tasks.ClassRoster            `json:"rosters"`
	TotalStudents      int                            `json:"totalStudents"`
	Extracted          CSVAnalyzeExtracted            `json:"extracted"`
	Candidates         []CSVAnalyzeCandidate          `json:"candidates"`
	RostersByCandidate map[string][]tasks.ClassRoster `json:"rostersByCandidateKey"`
}

type CSVAnalyzeMeta struct {
	SourceFileName      string   `json:"sourceFileName"`
	AccountScope        string   `json:"accountScope"` // guest | part_time | full_time
	MatchingEnabled     bool     `json:"matchingEnabled"`
	RequestedDay        string   `json:"requestedDay"`
	AppliedDayFallback  string   `json:"appliedDayFallback"`
	RequestedTermSeason string   `json:"requestedTermSeason"`
	RequestedTermYear   int      `json:"requestedTermYear"`
	TeamID              string   `json:"teamId"`
	Warnings            []string `json:"warnings"`
}

type CSVAnalyzeExtracted struct {
	TotalSessions    int                               `json:"totalSessions"`
	TotalClasses     int                               `json:"totalClasses"`
	Sessions         []tasks.ExtractedSession          `json:"sessions"`
	ClassesBySession map[string][]tasks.ExtractedClass `json:"classesBySession"`
}

type CSVAnalyzeCandidate struct {
	CandidateKey         string             `json:"candidateKey"`
	ExtractedSessionKeys []string           `json:"extractedSessionKeys"`
	RawLocations         []string           `json:"rawLocations"`
	DayOfWeek            string             `json:"dayOfWeek"`
	SessionSeason        string             `json:"sessionSeason"`
	SessionYear          int                `json:"sessionYear"`
	StartDate            string             `json:"startDate"`
	EndDate              string             `json:"endDate"`
	Location             string             `json:"location"`
	SessionStartTime24   string             `json:"sessionStartTime24"`
	SessionEndTime24     string             `json:"sessionEndTime24"`
	ClassCount           int                `json:"classCount"`
	StudentCount         int                `json:"studentCount"`
	WaitlistCount        int                `json:"waitlistCount"`
	CourseCodes          []string           `json:"courseCodes"`
	MatchedSession       *CSVMatchedSession `json:"matchedSession"`
}

type CSVMatchedSession struct {
	ID          string                `json:"id"`
	Label       string                `json:"label"`
	OwnedByUser bool                  `json:"ownedByUser"`
	Session     CSVMatchedSessionData `json:"session"`
}

type CSVMatchedSessionData struct {
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
}

func AnalyzeCSV(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	isGuest := err != nil

	var profile *profileRow
	if !isGuest {
		profile, err = loadOrCreateProfile(r, client)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	file, header, err := r.FormFile("csv_file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	requestedDay := strings.TrimSpace(r.FormValue("day"))
	termSeason := strings.TrimSpace(r.FormValue("termSeason"))
	termYear := 0
	if rawYear := strings.TrimSpace(r.FormValue("termYear")); rawYear != "" {
		if parsedYear, parseErr := strconv.Atoi(rawYear); parseErr == nil && parsedYear > 0 {
			termYear = parsedYear
		}
	}
	teamID := strings.TrimSpace(r.FormValue("teamId"))

	accountScope := "guest"
	if profile != nil && strings.TrimSpace(profile.AccountType) != "" {
		accountScope = strings.TrimSpace(profile.AccountType)
	}

	if accountScope == "full_time" && teamID == "" {
		http.Error(w, "Missing team id", http.StatusBadRequest)
		return
	}

	initialExtracted, err := tasks.ExtractClassesFromCSV(file, tasks.ExtractOptions{
		FallbackDay: requestedDay,
	})
	if err != nil {
		http.Error(w, "Failed to analyze CSV: "+err.Error(), http.StatusBadRequest)
		return
	}
	if accountScope == "full_time" && termSeason != "" && termYear > 0 {
		initialExtracted = filterExtractedClassesByTerm(initialExtracted, termSeason, termYear)
	}

	instructorMap := map[string]string{}
	warnings := []string(nil)
	if !isGuest {
		instructorMap, warnings, err = loadCSVAnalyzeInstructorMap(r, client, initialExtracted)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		http.Error(w, "Failed to rewind uploaded CSV", http.StatusInternalServerError)
		return
	}

	extractedData, err := tasks.ExtractClassesFromCSV(file, tasks.ExtractOptions{
		FallbackDay:   requestedDay,
		InstructorMap: instructorMap,
	})
	if err != nil {
		http.Error(w, "Failed to analyze CSV: "+err.Error(), http.StatusBadRequest)
		return
	}
	if accountScope == "full_time" && termSeason != "" && termYear > 0 {
		extractedData = filterExtractedClassesByTerm(extractedData, termSeason, termYear)
	}

	scopeSessions := []sessionRow(nil)
	userID := ""
	if !isGuest {
		scopeSessions, err = loadCSVMatchScopeSessions(r, client, profile)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		userID = profile.ID
	}

	rawCandidates := buildCSVSessionCandidates(extractedData.Sessions, scopeSessions, userID)
	rosters := buildCSVAnalyzeRosters(extractedData.ClassesBySession)

	response := CSVAnalyzeResponse{
		Success:       true,
		Meta:          buildCSVAnalyzeMeta(header.Filename, accountScope, requestedDay, termSeason, termYear, teamID, warnings),
		Rosters:       rosters,
		TotalStudents: sumRosterStudentCounts(rosters),
		Extracted: CSVAnalyzeExtracted{
			TotalSessions:    len(extractedData.Sessions),
			TotalClasses:     countExtractedClasses(extractedData.ClassesBySession),
			Sessions:         extractedData.Sessions,
			ClassesBySession: extractedData.ClassesBySession,
		},
		Candidates:         convertCSVAnalyzeCandidates(rawCandidates),
		RostersByCandidate: buildCSVAnalyzeRostersByCandidate(rawCandidates, extractedData.ClassesBySession),
	}

	writeJSON(w, response)
}

func buildCSVAnalyzeMeta(
	sourceFileName string,
	accountScope string,
	requestedDay string,
	termSeason string,
	termYear int,
	teamID string,
	warnings []string,
) CSVAnalyzeMeta {
	return CSVAnalyzeMeta{
		SourceFileName:      strings.TrimSpace(sourceFileName),
		AccountScope:        strings.TrimSpace(accountScope),
		MatchingEnabled:     true,
		RequestedDay:        requestedDay,
		AppliedDayFallback:  requestedDay,
		RequestedTermSeason: termSeason,
		RequestedTermYear:   termYear,
		TeamID:              teamID,
		Warnings:            append([]string(nil), warnings...),
	}
}

func loadCSVAnalyzeInstructorMap(r *http.Request, client *supabasesvc.Client, extracted *tasks.ExtractedCSVResult) (map[string]string, []string, error) {
	if extracted == nil || len(extracted.Sessions) == 0 {
		return map[string]string{}, nil, nil
	}

	allowedTerms := collectCSVAnalyzeTermLabels(r, extracted)
	allowedLocations := collectCSVAnalyzeLocationKeys(extracted)

	query := url.Values{}
	query.Set("select", "event_id,term,location,instructor")
	if len(allowedTerms) == 1 {
		for term := range allowedTerms {
			query.Set("term", "eq."+term)
		}
	}

	var rows []requestAssignmentRow
	if err := client.Get(r.Context(), "/rest/v1/request_assignments", query, &rows); err != nil {
		return nil, nil, err
	}

	instructorsByCode := make(map[string]map[string]struct{})
	for _, row := range rows {
		code := tasks.NormalizeEventID(row.EventID)
		instructor := strings.TrimSpace(row.Instructor)
		term := normalizeRequestAssignmentTerm(row.Term)
		locationKey := normalizeSessionLocationKey(row.Location)
		if code == "" || instructor == "" {
			continue
		}
		if len(allowedTerms) > 0 {
			if _, ok := allowedTerms[term]; !ok {
				continue
			}
		}
		if len(allowedLocations) > 0 {
			if _, ok := allowedLocations[locationKey]; !ok {
				continue
			}
		}
		if _, ok := instructorsByCode[code]; !ok {
			instructorsByCode[code] = make(map[string]struct{})
		}
		instructorsByCode[code][instructor] = struct{}{}
	}

	instructorMap := make(map[string]string, len(instructorsByCode))
	warnings := make([]string, 0)
	for code, instructorSet := range instructorsByCode {
		if len(instructorSet) != 1 {
			warnings = append(warnings, "Skipped instructor mapping for event "+code+" because multiple instructors matched the selected scope.")
			continue
		}
		for instructor := range instructorSet {
			instructorMap[code] = instructor
		}
	}
	sort.Strings(warnings)

	return instructorMap, warnings, nil
}

func collectCSVAnalyzeTermLabels(r *http.Request, extracted *tasks.ExtractedCSVResult) map[string]struct{} {
	terms := make(map[string]struct{})

	termSeason := strings.TrimSpace(r.FormValue("termSeason"))
	termYear := 0
	if rawYear := strings.TrimSpace(r.FormValue("termYear")); rawYear != "" {
		if parsedYear, err := strconv.Atoi(rawYear); err == nil && parsedYear > 0 {
			termYear = parsedYear
		}
	}
	if label := formatCSVAnalyzeTermLabel(termSeason, termYear); label != "" {
		terms[label] = struct{}{}
		return terms
	}

	for _, session := range extracted.Sessions {
		if label := formatCSVAnalyzeTermLabel(session.SessionSeason, session.SessionYear); label != "" {
			terms[label] = struct{}{}
		}
	}
	return terms
}

func collectCSVAnalyzeLocationKeys(extracted *tasks.ExtractedCSVResult) map[string]struct{} {
	locations := make(map[string]struct{})
	for _, session := range extracted.Sessions {
		key := normalizeSessionLocationKey(session.Location)
		if key == "" {
			continue
		}
		locations[key] = struct{}{}
	}
	return locations
}

func formatCSVAnalyzeTermLabel(season string, year int) string {
	normalizedSeason := strings.TrimSpace(season)
	if normalizedSeason != "" {
		normalizedSeason = strings.ToUpper(normalizedSeason[:1]) + strings.ToLower(normalizedSeason[1:])
	}
	yearLabel := ""
	if year > 0 {
		yearLabel = strconv.Itoa(year)
	}
	return normalizeRequestAssignmentTerm(strings.TrimSpace(strings.Join([]string{normalizedSeason, yearLabel}, " ")))
}

func buildCSVAnalyzeRosters(classesBySession map[string][]tasks.ExtractedClass) []tasks.ClassRoster {
	sessionKeys := make([]string, 0, len(classesBySession))
	for sessionKey := range classesBySession {
		sessionKeys = append(sessionKeys, sessionKey)
	}
	sort.Strings(sessionKeys)

	rosters := make([]tasks.ClassRoster, 0)
	for _, sessionKey := range sessionKeys {
		classes := append([]tasks.ExtractedClass(nil), classesBySession[sessionKey]...)
		sort.Slice(classes, func(i, j int) bool {
			if classes[i].StartTime24 != classes[j].StartTime24 {
				return classes[i].StartTime24 < classes[j].StartTime24
			}
			if classes[i].EndTime24 != classes[j].EndTime24 {
				return classes[i].EndTime24 < classes[j].EndTime24
			}
			return classes[i].CourseCode < classes[j].CourseCode
		})
		for _, class := range classes {
			rosters = append(rosters, extractedClassToRoster(class))
		}
	}
	return rosters
}

func buildCSVAnalyzeRostersByCandidate(
	candidates []csvSessionCandidate,
	classesBySession map[string][]tasks.ExtractedClass,
) map[string][]tasks.ClassRoster {
	result := make(map[string][]tasks.ClassRoster, len(candidates))
	for _, candidate := range candidates {
		seen := make(map[string]struct{})
		rosters := make([]tasks.ClassRoster, 0)
		for _, sessionKey := range candidate.SourceSessionKeys {
			for _, class := range classesBySession[sessionKey] {
				key := strings.Join([]string{
					class.SessionKey,
					class.CourseCode,
					class.Location,
					class.StartTime24,
					class.EndTime24,
				}, "|")
				if _, ok := seen[key]; ok {
					continue
				}
				seen[key] = struct{}{}
				rosters = append(rosters, extractedClassToRoster(class))
			}
		}
		sort.Slice(rosters, func(i, j int) bool {
			if rosters[i].SessionKey != rosters[j].SessionKey {
				return rosters[i].SessionKey < rosters[j].SessionKey
			}
			if rosters[i].Time != rosters[j].Time {
				return rosters[i].Time < rosters[j].Time
			}
			return rosters[i].Code < rosters[j].Code
		})
		result[candidate.SessionKey] = rosters
	}
	return result
}

func extractedClassToRoster(class tasks.ExtractedClass) tasks.ClassRoster {
	return tasks.ClassRoster{
		SessionKey:    class.SessionKey,
		Code:          class.CourseCode,
		ServiceName:   class.ServiceName,
		Location:      class.Location,
		Time:          formatSessionTimeRange(class.StartTime24, class.EndTime24),
		Instructor:    strings.TrimSpace(class.Instructor),
		StudentCount:  class.StudentCount,
		WaitlistCount: class.WaitlistCount,
		Students:      append([]tasks.RosterStudent(nil), class.Roster...),
	}
}

func sumRosterStudentCounts(rosters []tasks.ClassRoster) int {
	total := 0
	for _, roster := range rosters {
		total += roster.StudentCount
	}
	return total
}

func convertCSVAnalyzeCandidates(candidates []csvSessionCandidate) []CSVAnalyzeCandidate {
	result := make([]CSVAnalyzeCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		result = append(result, CSVAnalyzeCandidate{
			CandidateKey:         candidate.SessionKey,
			ExtractedSessionKeys: append([]string(nil), candidate.SourceSessionKeys...),
			RawLocations:         append([]string(nil), candidate.RawLocations...),
			DayOfWeek:            candidate.DayOfWeek,
			SessionSeason:        candidate.SessionSeason,
			SessionYear:          candidate.SessionYear,
			StartDate:            candidate.StartDate,
			EndDate:              candidate.EndDate,
			Location:             candidate.Location,
			SessionStartTime24:   candidate.SessionStartTime24,
			SessionEndTime24:     candidate.SessionEndTime24,
			ClassCount:           candidate.ClassCount,
			StudentCount:         candidate.StudentCount,
			WaitlistCount:        candidate.WaitlistCount,
			CourseCodes:          append([]string(nil), candidate.CourseCodes...),
			MatchedSession:       convertCSVAnalyzeMatchedSession(candidate.MatchedSession),
		})
	}
	return result
}

func convertCSVAnalyzeMatchedSession(match *csvMatchedSession) *CSVMatchedSession {
	if match == nil {
		return nil
	}
	return &CSVMatchedSession{
		ID:          match.ID,
		Label:       match.Label,
		OwnedByUser: match.OwnedByUser,
		Session: CSVMatchedSessionData{
			ID:                 stringValueFromAny(match.Session["id"]),
			TeamID:             stringPtrFromAny(match.Session["team_id"]),
			CreatedBy:          stringValueFromAny(match.Session["created_by"]),
			SessionDay:         stringValueFromAny(match.Session["session_day"]),
			SessionSeason:      stringPtrFromAny(match.Session["session_season"]),
			SessionYear:        intPtrFromAny(match.Session["session_year"]),
			StartDate:          stringPtrFromAny(match.Session["start_date"]),
			EndDate:            stringPtrFromAny(match.Session["end_date"]),
			Location:           stringPtrFromAny(match.Session["location"]),
			SourceLocations:    stringSliceFromAny(match.Session["source_locations"]),
			SessionStartTime24: stringPtrFromAny(match.Session["session_start_time24"]),
			SessionEndTime24:   stringPtrFromAny(match.Session["session_end_time24"]),
			Instructors:        instructorSliceFromAny(match.Session["instructors"]),
		},
	}
}

func stringValueFromAny(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case *string:
		if typed == nil {
			return ""
		}
		return *typed
	default:
		return ""
	}
}

func stringPtrFromAny(value any) *string {
	switch typed := value.(type) {
	case string:
		copy := typed
		return &copy
	case *string:
		return typed
	default:
		return nil
	}
}

func intPtrFromAny(value any) *int {
	switch typed := value.(type) {
	case int:
		copy := typed
		return &copy
	case *int:
		return typed
	case float64:
		copy := int(typed)
		return &copy
	default:
		return nil
	}
}

func stringSliceFromAny(value any) []string {
	switch typed := value.(type) {
	case []string:
		return append([]string(nil), typed...)
	case []any:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
				result = append(result, text)
			}
		}
		return result
	default:
		return nil
	}
}

func instructorSliceFromAny(value any) []map[string]string {
	switch typed := value.(type) {
	case []map[string]string:
		result := make([]map[string]string, 0, len(typed))
		for _, entry := range typed {
			copyEntry := make(map[string]string, len(entry))
			for key, val := range entry {
				copyEntry[key] = val
			}
			result = append(result, copyEntry)
		}
		return result
	case []any:
		result := make([]map[string]string, 0, len(typed))
		for _, item := range typed {
			entryMap, ok := item.(map[string]any)
			if !ok {
				continue
			}
			next := make(map[string]string, len(entryMap))
			for key, val := range entryMap {
				if text, ok := val.(string); ok {
					next[key] = text
				}
			}
			result = append(result, next)
		}
		return result
	default:
		return nil
	}
}
