package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"cob-aquatics/internal/demo/seeddata"
	supabasesvc "cob-aquatics/internal/services/supabase"
)

type options struct {
	output             string
	password           string
	replace            bool
	dryRun             bool
	skipAuth           bool
	sourceCSV          string
	anonymizeSourceCSV bool
	singleDay          string
}

type authAdmin struct {
	baseURL    string
	serviceKey string
	client     *http.Client
}

type authUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func main() {
	if err := run(context.Background(), parseOptions()); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func parseOptions() options {
	var opts options
	flag.StringVar(&opts.output, "output", "../demo-data/current-week", "directory for generated CSV files")
	flag.StringVar(&opts.password, "password", seeddata.DefaultPass, "password for generated demo accounts")
	flag.BoolVar(&opts.replace, "replace", true, "replace existing demo data")
	flag.BoolVar(&opts.dryRun, "dry-run", false, "print intended operations without writing Supabase data")
	flag.BoolVar(&opts.skipAuth, "skip-auth", false, "only write CSV files")
	flag.StringVar(&opts.sourceCSV, "source-csv", "", "optional full-week source CSV to convert into demo data")
	flag.BoolVar(&opts.anonymizeSourceCSV, "anonymize-source-csv", true, "anonymize names, phones, and emails when using --source-csv")
	flag.StringVar(&opts.singleDay, "single-day", "", "day to use for demo_single_day_classes.csv when using --source-csv")
	flag.Parse()
	return opts
}

func run(ctx context.Context, opts options) error {
	dataset, err := loadDataset(opts)
	if err != nil {
		return err
	}
	for index := range dataset.Accounts {
		dataset.Accounts[index].Password = opts.password
	}
	if err := validateDatasetReferences(dataset); err != nil {
		return err
	}

	if err := writeCSVs(opts.output, dataset); err != nil {
		return err
	}
	fmt.Printf("Wrote demo CSV files in %s\n", opts.output)

	if opts.skipAuth {
		fmt.Println("Skipped Supabase seed because --skip-auth was provided.")
		return nil
	}
	if opts.dryRun {
		printDryRun(dataset)
		return nil
	}

	serviceClient, err := supabasesvc.NewServiceClientFromEnv()
	if err != nil {
		return err
	}
	admin, err := newAuthAdminFromEnv()
	if err != nil {
		return err
	}

	if opts.replace {
		if err := replaceDemoData(ctx, serviceClient, admin, dataset); err != nil {
			return err
		}
	}

	userIDs, err := createAuthUsers(ctx, admin, dataset.Accounts)
	if err != nil {
		return err
	}
	if err := seedDatabase(ctx, serviceClient, dataset, userIDs); err != nil {
		return err
	}

	fmt.Println("Seeded demo accounts and Supabase demo data.")
	fmt.Println("Full-time demo login: " + dataset.FullTimeEmail)
	fmt.Println("Part-time demo logins: " + strings.Join(dataset.PartTimeEmails, ", "))
	return nil
}

func writeCSVs(output string, dataset seeddata.Dataset) error {
	if err := os.MkdirAll(output, 0o755); err != nil {
		return err
	}
	single, err := seeddata.WriteCSV(dataset.SingleDayClasses)
	if err != nil {
		return err
	}
	week, err := seeddata.WriteCSV(dataset.Classes)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(output, "demo_single_day_classes.csv"), single, 0o644); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(output, "demo_full_week_classes.csv"), week, 0o644)
}

func printDryRun(dataset seeddata.Dataset) {
	fmt.Printf("Dry run: would create %d auth users, 1 team, %d sessions, %d classes, %d request assignments, %d notes, %d reports, %d report card rows. Terms: %s. Locations: %s. Single-day CSV: %s.\n",
		len(dataset.Accounts),
		len(dataset.Sessions),
		len(dataset.Classes),
		len(dataset.RequestAssignments),
		len(dataset.Notes),
		len(dataset.Reports),
		len(dataset.ReportCards),
		strings.Join(datasetTerms(dataset), ", "),
		strings.Join(dataset.Locations, ", "),
		dataset.SelectedSingleDay,
	)
}

func validateDatasetReferences(dataset seeddata.Dataset) error {
	sessionKeys := make(map[string]struct{}, len(dataset.Sessions))
	for _, session := range dataset.Sessions {
		sessionKeys[session.Key] = struct{}{}
	}
	for _, note := range dataset.Notes {
		if _, ok := sessionKeys[note.SessionKey]; !ok {
			return fmt.Errorf("demo note references unknown session key %q", note.SessionKey)
		}
	}
	for _, report := range dataset.Reports {
		if _, ok := sessionKeys[report.SessionKey]; !ok {
			return fmt.Errorf("demo report references unknown session key %q", report.SessionKey)
		}
	}
	for _, card := range dataset.ReportCards {
		if strings.TrimSpace(card.SessionKey) == "" {
			continue
		}
		if _, ok := sessionKeys[card.SessionKey]; !ok {
			return fmt.Errorf("demo report card references unknown session key %q", card.SessionKey)
		}
	}
	return nil
}

func datasetTerms(dataset seeddata.Dataset) []string {
	seen := map[string]struct{}{}
	for _, session := range dataset.Sessions {
		seen[termLabel(session.SessionSeason, session.SessionYear)] = struct{}{}
	}
	terms := make([]string, 0, len(seen))
	for term := range seen {
		terms = append(terms, term)
	}
	sort.Strings(terms)
	if len(terms) == 0 {
		return []string{"none"}
	}
	return terms
}

func loadDataset(opts options) (seeddata.Dataset, error) {
	if strings.TrimSpace(opts.sourceCSV) == "" {
		return seeddata.Generate(), nil
	}
	sourcePath := resolveSourceCSVPath(opts.sourceCSV)
	file, err := os.Open(sourcePath)
	if err != nil {
		return seeddata.Dataset{}, err
	}
	defer file.Close()
	return seeddata.GenerateFromCSV(file, seeddata.SourceCSVOptions{
		SourceFileName: filepath.Base(sourcePath),
		Anonymize:      opts.anonymizeSourceCSV,
		SingleDay:      opts.singleDay,
	})
}

func resolveSourceCSVPath(path string) string {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" || filepath.IsAbs(trimmed) {
		return trimmed
	}
	if callerDir := strings.TrimSpace(os.Getenv("DEMO_SEED_CALLER_DIR")); callerDir != "" {
		candidate := filepath.Join(callerDir, trimmed)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	if _, err := os.Stat(trimmed); err == nil {
		return trimmed
	}
	parentCandidate := filepath.Join("..", trimmed)
	if _, err := os.Stat(parentCandidate); err == nil {
		return parentCandidate
	}
	return trimmed
}

func newAuthAdminFromEnv() (*authAdmin, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/")
	serviceKey := serviceKeyFromEnv()
	if baseURL == "" || serviceKey == "" {
		return nil, errors.New("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
	}
	return &authAdmin{
		baseURL:    baseURL,
		serviceKey: serviceKey,
		client:     &http.Client{Timeout: 20 * time.Second},
	}, nil
}

func serviceKeyFromEnv() string {
	if value := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY")); value != "" {
		return value
	}
	return strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY"))
}

func (a *authAdmin) request(ctx context.Context, method string, path string, body any, out any) error {
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		payload, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, a.baseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", a.serviceKey)
	req.Header.Set("Authorization", "Bearer "+a.serviceKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var apiErr map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&apiErr); err == nil {
			for _, key := range []string{"message", "msg", "error_description", "error"} {
				if message, ok := apiErr[key].(string); ok && strings.TrimSpace(message) != "" {
					return fmt.Errorf("auth admin %s %s failed: %s", method, path, message)
				}
			}
		}
		return fmt.Errorf("auth admin %s %s failed: %s", method, path, resp.Status)
	}
	if out == nil || resp.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (a *authAdmin) listUsers(ctx context.Context) ([]authUser, error) {
	var all []authUser
	for page := 1; page <= 20; page++ {
		var payload struct {
			Users []authUser `json:"users"`
		}
		path := fmt.Sprintf("/auth/v1/admin/users?page=%d&per_page=1000", page)
		if err := a.request(ctx, http.MethodGet, path, nil, &payload); err != nil {
			return nil, err
		}
		all = append(all, payload.Users...)
		if len(payload.Users) < 1000 {
			break
		}
	}
	return all, nil
}

func (a *authAdmin) createUser(ctx context.Context, account seeddata.Account) (authUser, error) {
	body := map[string]any{
		"email":         account.Email,
		"password":      account.Password,
		"email_confirm": true,
		"user_metadata": map[string]any{
			"first_name": account.FirstName,
			"last_name":  account.LastName,
		},
	}
	var raw json.RawMessage
	if err := a.request(ctx, http.MethodPost, "/auth/v1/admin/users", body, &raw); err != nil {
		return authUser{}, err
	}
	var direct authUser
	if err := json.Unmarshal(raw, &direct); err != nil {
		return authUser{}, err
	}
	if direct.ID != "" {
		return direct, nil
	}
	var wrapped struct {
		User authUser `json:"user"`
	}
	if err := json.Unmarshal(raw, &wrapped); err != nil {
		return authUser{}, err
	}
	if wrapped.User.ID == "" {
		return authUser{}, fmt.Errorf("auth admin create user returned no id for %s", account.Email)
	}
	return wrapped.User, nil
}

func (a *authAdmin) deleteUser(ctx context.Context, id string) error {
	return a.request(ctx, http.MethodDelete, "/auth/v1/admin/users/"+url.PathEscape(id), nil, nil)
}

func replaceDemoData(ctx context.Context, client *supabasesvc.Client, admin *authAdmin, dataset seeddata.Dataset) error {
	emails := make([]string, 0, len(dataset.Accounts))
	for _, account := range dataset.Accounts {
		emails = append(emails, account.Email)
	}

	var profiles []struct {
		ID string `json:"id"`
	}
	if err := client.Get(ctx, "/rest/v1/profiles", values(map[string]string{
		"email":  "in.(" + strings.Join(emails, ",") + ")",
		"select": "id",
	}), &profiles); err != nil {
		return err
	}

	if err := deleteGeneratedRequestAssignments(ctx, client, dataset); err != nil {
		return err
	}
	if err := client.Delete(ctx, "/rest/v1/teams", values(map[string]string{
		"name": "eq." + seeddata.TeamName,
	}), "", nil); err != nil {
		return err
	}
	for _, profile := range profiles {
		if profile.ID == "" {
			continue
		}
		if err := client.Delete(ctx, "/rest/v1/sessions", values(map[string]string{"created_by": "eq." + profile.ID}), "", nil); err != nil {
			return err
		}
	}

	users, err := admin.listUsers(ctx)
	if err != nil {
		return err
	}
	emailSet := make(map[string]struct{}, len(emails))
	for _, email := range emails {
		emailSet[strings.ToLower(email)] = struct{}{}
	}
	for _, user := range users {
		if _, ok := emailSet[strings.ToLower(user.Email)]; !ok {
			continue
		}
		if err := admin.deleteUser(ctx, user.ID); err != nil {
			return err
		}
	}
	return nil
}

func deleteGeneratedRequestAssignments(ctx context.Context, client *supabasesvc.Client, dataset seeddata.Dataset) error {
	seen := map[string]struct{}{}
	for _, class := range dataset.RequestAssignments {
		key := strings.Join([]string{class.EventID, termLabel(class.SessionSeason, class.SessionYear), class.Location}, "\x00")
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		if err := client.Delete(ctx, "/rest/v1/request_assignments", values(map[string]string{
			"event_id": "eq." + class.EventID,
			"term":     "eq." + termLabel(class.SessionSeason, class.SessionYear),
			"location": "eq." + class.Location,
		}), "", nil); err != nil {
			return err
		}
	}
	return nil
}

func createAuthUsers(ctx context.Context, admin *authAdmin, accounts []seeddata.Account) (map[string]string, error) {
	userIDs := make(map[string]string, len(accounts))
	for _, account := range accounts {
		user, err := admin.createUser(ctx, account)
		if err != nil {
			return nil, err
		}
		userIDs[account.Email] = user.ID
	}
	return userIDs, nil
}

func seedDatabase(ctx context.Context, client *supabasesvc.Client, dataset seeddata.Dataset, userIDs map[string]string) error {
	if err := upsertProfiles(ctx, client, dataset.Accounts, userIDs); err != nil {
		return err
	}
	teamID, err := createTeam(ctx, client, userIDs[dataset.FullTimeEmail], dataset.Locations)
	if err != nil {
		return err
	}
	if err := createMemberships(ctx, client, teamID, dataset.PartTimeEmails, userIDs); err != nil {
		return err
	}
	sessionIDs, err := createSessions(ctx, client, teamID, dataset.Sessions, userIDs)
	if err != nil {
		return err
	}
	if err := createRequestAssignments(ctx, client, dataset.RequestAssignments); err != nil {
		return err
	}
	if err := createSchematics(ctx, client, dataset.Sessions, sessionIDs, userIDs); err != nil {
		return err
	}
	if err := createSessionShares(ctx, client, dataset.Sessions, sessionIDs, userIDs, dataset.SelectedSingleDay); err != nil {
		return err
	}
	if err := createNotes(ctx, client, dataset.Notes, sessionIDs, userIDs[dataset.FullTimeEmail]); err != nil {
		return err
	}
	if err := createReports(ctx, client, dataset.Reports, sessionIDs, userIDs[dataset.FullTimeEmail]); err != nil {
		return err
	}
	if err := createReportCards(ctx, client, dataset.ReportCards, teamID, userIDs); err != nil {
		return err
	}
	return createAttendanceSheets(ctx, client, dataset.AttendanceSheets, teamID, userIDs[dataset.FullTimeEmail])
}

func upsertProfiles(ctx context.Context, client *supabasesvc.Client, accounts []seeddata.Account, userIDs map[string]string) error {
	rows := make([]map[string]any, 0, len(accounts))
	for _, account := range accounts {
		rows = append(rows, map[string]any{
			"id":           userIDs[account.Email],
			"email":        account.Email,
			"first_name":   account.FirstName,
			"last_name":    account.LastName,
			"location":     account.Location,
			"account_type": account.AccountType,
		})
	}
	return client.Post(ctx, "/rest/v1/profiles", values(map[string]string{"on_conflict": "id"}), rows, "resolution=merge-duplicates", nil)
}

func createTeam(ctx context.Context, client *supabasesvc.Client, ownerID string, locations []string) (string, error) {
	if len(locations) == 0 {
		locations = seeddata.Locations
	}
	body := map[string]any{
		"owner_id":            ownerID,
		"name":                seeddata.TeamName,
		"available_locations": locations,
	}
	var rows []struct {
		ID string `json:"id"`
	}
	if err := client.Post(ctx, "/rest/v1/teams", nil, body, "return=representation", &rows); err != nil {
		return "", err
	}
	if len(rows) == 0 || rows[0].ID == "" {
		return "", errors.New("failed to create demo team")
	}
	return rows[0].ID, nil
}

func createMemberships(ctx context.Context, client *supabasesvc.Client, teamID string, emails []string, userIDs map[string]string) error {
	rows := make([]map[string]any, 0, len(emails))
	for _, email := range emails {
		rows = append(rows, map[string]any{
			"team_id": teamID,
			"user_id": userIDs[email],
			"role":    "member",
		})
	}
	return client.Post(ctx, "/rest/v1/team_members", nil, rows, "", nil)
}

func createSessions(ctx context.Context, client *supabasesvc.Client, teamID string, sessions []seeddata.Session, userIDs map[string]string) (map[string]string, error) {
	sessionIDs := make(map[string]string, len(sessions))
	for _, session := range sessions {
		instructors := make([]map[string]string, 0, len(session.Instructors))
		for _, instructor := range session.Instructors {
			instructors = append(instructors, map[string]string{"name": instructor})
		}
		body := map[string]any{
			"team_id":              teamID,
			"created_by":           userIDs[session.OwnerEmail],
			"session_day":          session.Day,
			"session_season":       session.SessionSeason,
			"session_year":         session.SessionYear,
			"start_date":           session.StartDate,
			"end_date":             session.EndDate,
			"location":             session.Location,
			"source_locations":     []string{session.Location},
			"session_start_time24": session.Start24,
			"session_end_time24":   session.End24,
			"instructors":          instructors,
		}
		var rows []struct {
			ID string `json:"id"`
		}
		if err := client.Post(ctx, "/rest/v1/sessions", nil, body, "return=representation", &rows); err != nil {
			return nil, err
		}
		if len(rows) == 0 || rows[0].ID == "" {
			return nil, fmt.Errorf("failed to create session %s", session.Key)
		}
		sessionIDs[session.Key] = rows[0].ID
	}
	return sessionIDs, nil
}

func createRequestAssignments(ctx context.Context, client *supabasesvc.Client, classes []seeddata.Class) error {
	rows := make([]map[string]any, 0, len(classes))
	now := time.Now().UTC().Format(time.RFC3339)
	for _, class := range classes {
		rows = append(rows, map[string]any{
			"event_id":   class.EventID,
			"term":       termLabel(class.SessionSeason, class.SessionYear),
			"location":   class.Location,
			"instructor": class.RequestOwner,
			"updated_at": now,
		})
	}
	return postChunks(ctx, client, "/rest/v1/request_assignments", rows)
}

func createSchematics(ctx context.Context, client *supabasesvc.Client, sessions []seeddata.Session, sessionIDs map[string]string, userIDs map[string]string) error {
	rows := make([]map[string]any, 0, len(sessions))
	for _, session := range sessions {
		codes, instructors := seeddata.SchematicLayout(session)
		rows = append(rows, map[string]any{
			"session_id": sessionIDs[session.Key],
			"created_by": userIDs[session.OwnerEmail],
			"data": map[string]any{
				"codes":       codes,
				"instructors": instructors,
			},
			"updated_at": time.Now().UTC().Format(time.RFC3339),
		})
	}
	return postChunks(ctx, client, "/rest/v1/schematics", rows)
}

func createSessionShares(ctx context.Context, client *supabasesvc.Client, sessions []seeddata.Session, sessionIDs map[string]string, userIDs map[string]string, selectedDay string) error {
	var candidates []seeddata.Session
	for _, session := range sessions {
		if session.DateISO == "" || !sameDay(session.Day, selectedDay) {
			continue
		}
		candidates = append(candidates, session)
	}
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Day != candidates[j].Day {
			return candidates[i].Day < candidates[j].Day
		}
		if candidates[i].Location != candidates[j].Location {
			return candidates[i].Location < candidates[j].Location
		}
		return candidates[i].Start24 < candidates[j].Start24
	})
	var rows []map[string]any
	if len(candidates) > 0 {
		first := candidates[0]
		rows = append(rows, map[string]any{
			"session_id":         sessionIDs[first.Key],
			"share_date":         first.DateISO,
			"shared_by":          userIDs[first.OwnerEmail],
			"shared_with":        userIDs["demo.sam@decksupervisor.local"],
			"allow_roster_edits": true,
		})
	}
	if len(candidates) > 1 {
		second := candidates[1]
		rows = append(rows, map[string]any{
			"session_id":         sessionIDs[second.Key],
			"share_date":         second.DateISO,
			"shared_by":          userIDs[second.OwnerEmail],
			"shared_with":        userIDs["demo.taylor@decksupervisor.local"],
			"allow_roster_edits": false,
		})
	}
	if len(rows) == 0 {
		return nil
	}
	return client.Post(ctx, "/rest/v1/session_shares", nil, rows, "", nil)
}

func createNotes(ctx context.Context, client *supabasesvc.Client, notes []seeddata.Note, sessionIDs map[string]string, createdBy string) error {
	rows := make([]map[string]any, 0, len(notes))
	for _, note := range notes {
		rows = append(rows, map[string]any{
			"session_id":    sessionIDs[note.SessionKey],
			"created_by":    createdBy,
			"note_type":     note.Type,
			"text":          note.Text,
			"employee_name": note.EmployeeName,
			"done":          note.Done,
		})
	}
	return postChunks(ctx, client, "/rest/v1/session_notes", rows)
}

func createReports(ctx context.Context, client *supabasesvc.Client, reports []seeddata.Report, sessionIDs map[string]string, createdBy string) error {
	rows := make([]map[string]any, 0, len(reports))
	now := time.Now().UTC().Format(time.RFC3339)
	for _, report := range reports {
		rows = append(rows, map[string]any{
			"session_id":  sessionIDs[report.SessionKey],
			"created_by":  createdBy,
			"title":       report.Title,
			"report_data": report.Data,
			"updated_at":  now,
		})
	}
	return client.Post(ctx, "/rest/v1/session_reports", nil, rows, "", nil)
}

func createReportCards(ctx context.Context, client *supabasesvc.Client, cards []seeddata.ReportCardTotal, teamID string, userIDs map[string]string) error {
	rows := make([]map[string]any, 0, len(cards))
	now := time.Now().UTC().Format(time.RFC3339)
	for _, card := range cards {
		rows = append(rows, map[string]any{
			"session":                card.Session,
			"day":                    card.Day,
			"instructor":             card.Instructor,
			"number_of_report_cards": card.Total,
			"team_id":                teamID,
			"created_by":             userIDs[card.CreatedBy],
			"updated_at":             now,
		})
	}
	return postChunks(ctx, client, "/rest/v1/report_cards", rows)
}

func createAttendanceSheets(ctx context.Context, client *supabasesvc.Client, sheets []seeddata.AttendanceSheet, teamID string, createdBy string) error {
	rows := make([]map[string]any, 0, len(sheets))
	now := time.Now().UTC().Format(time.RFC3339)
	for _, sheet := range sheets {
		rows = append(rows, map[string]any{
			"team_id":              teamID,
			"created_by":           createdBy,
			"name":                 sheet.Name,
			"base_template":        sheet.BaseTemplate,
			"default_for_template": sheet.DefaultForTemplate,
			"sheet_data":           sheet.SheetData,
			"updated_at":           now,
		})
	}
	return client.Post(ctx, "/rest/v1/attendance_sheets", nil, rows, "", nil)
}

func postChunks(ctx context.Context, client *supabasesvc.Client, path string, rows []map[string]any) error {
	for len(rows) > 0 {
		chunkSize := 50
		if len(rows) < chunkSize {
			chunkSize = len(rows)
		}
		chunk := rows[:chunkSize]
		rows = rows[chunkSize:]
		if err := client.Post(ctx, path, nil, chunk, "", nil); err != nil {
			return err
		}
	}
	return nil
}

func values(input map[string]string) url.Values {
	out := url.Values{}
	for key, value := range input {
		out.Set(key, value)
	}
	return out
}

func termLabel(season string, year int) string {
	season = strings.TrimSpace(season)
	if season == "" {
		season = seeddata.TermSeason
	}
	if year <= 0 {
		year = seeddata.TermYear
	}
	return strings.TrimSpace(fmt.Sprintf("%s %d", season, year))
}

func sameDay(left string, right string) bool {
	if strings.TrimSpace(right) == "" {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(left), strings.TrimSpace(right))
}
