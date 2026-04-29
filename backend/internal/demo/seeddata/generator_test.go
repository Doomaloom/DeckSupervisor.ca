package seeddata

import (
	"bytes"
	"encoding/csv"
	"strings"
	"testing"

	"cob-aquatics/tasks"
)

func TestGeneratedSingleDayCSVParses(t *testing.T) {
	dataset := Generate()
	payload, err := WriteCSV(dataset.SingleDayClasses)
	if err != nil {
		t.Fatalf("WriteCSV returned error: %v", err)
	}

	result, err := tasks.ExtractClassesFromCSV(bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("ExtractClassesFromCSV returned error: %v", err)
	}

	if got := len(result.Sessions); got != 2 {
		t.Fatalf("expected 2 single-day sessions, got %d", got)
	}
	if got := countClasses(result.ClassesBySession); got != 16 {
		t.Fatalf("expected 16 single-day classes, got %d", got)
	}
	assertLocations(t, result.Sessions)
	assertWaitlists(t, result.Sessions)
	assertCSVHeaders(t, payload)
}

func TestGenerateFromCSVBuildsDataset(t *testing.T) {
	dataset, err := GenerateFromCSV(strings.NewReader(sourceCSVFixture()), SourceCSVOptions{Anonymize: true})
	if err != nil {
		t.Fatalf("GenerateFromCSV returned error: %v", err)
	}

	if len(dataset.Sessions) != 2 {
		t.Fatalf("expected 2 parsed sessions, got %d", len(dataset.Sessions))
	}
	if len(dataset.Classes) != 4 {
		t.Fatalf("expected 4 parsed classes, got %d", len(dataset.Classes))
	}
	if dataset.Locations[0] != "Real Pool" {
		t.Fatalf("expected Real Pool location, got %#v", dataset.Locations)
	}
	if dataset.Sessions[0].SessionSeason != "Summer" || dataset.Sessions[0].SessionYear != 2026 {
		t.Fatalf("expected parsed Summer 2026 term, got %+v", dataset.Sessions[0])
	}
}

func TestGenerateFromCSVAnonymizesStudents(t *testing.T) {
	dataset, err := GenerateFromCSV(strings.NewReader(sourceCSVFixture()), SourceCSVOptions{Anonymize: true})
	if err != nil {
		t.Fatalf("GenerateFromCSV returned error: %v", err)
	}

	payload, err := WriteCSV(dataset.Classes)
	if err != nil {
		t.Fatalf("WriteCSV returned error: %v", err)
	}
	text := string(payload)
	for _, realValue := range []string{"RealKid", "Example", "416-555-0101", "real@example.test"} {
		if strings.Contains(text, realValue) {
			t.Fatalf("expected anonymized CSV to omit %q", realValue)
		}
	}
	for _, expected := range []string{"900001", "Monday", "Tuesday", "Real Pool", "Splash 1"} {
		if !strings.Contains(text, expected) {
			t.Fatalf("expected anonymized CSV to keep %q", expected)
		}
	}
}

func TestGenerateFromCSVBuildsSchematicCompatibleSessions(t *testing.T) {
	dataset, err := GenerateFromCSV(strings.NewReader(sourceCSVFixture()), SourceCSVOptions{Anonymize: true})
	if err != nil {
		t.Fatalf("GenerateFromCSV returned error: %v", err)
	}

	for _, session := range dataset.Sessions {
		if len(session.Classes) == 0 {
			t.Fatalf("session has no classes: %+v", session)
		}
		codes, instructors := SchematicLayout(session)
		if len(codes) == 0 || len(instructors) == 0 {
			t.Fatalf("expected schematic layout for session: %+v", session)
		}
		if session.Day == "Monday" && len(codes) < 2 {
			t.Fatalf("expected overlapping Monday classes to require multiple columns, got %#v", codes)
		}
	}
	for _, class := range dataset.Classes {
		if class.ColumnIndex < 0 {
			t.Fatalf("expected non-negative column index for %+v", class)
		}
	}
}

func TestGenerateFromCSVSingleDaySelection(t *testing.T) {
	dataset, err := GenerateFromCSV(strings.NewReader(sourceCSVFixture()), SourceCSVOptions{Anonymize: true})
	if err != nil {
		t.Fatalf("GenerateFromCSV returned error: %v", err)
	}
	if dataset.SelectedSingleDay != "Tuesday" {
		t.Fatalf("expected Tuesday to be preferred, got %q", dataset.SelectedSingleDay)
	}

	dataset, err = GenerateFromCSV(strings.NewReader(sourceCSVFixture()), SourceCSVOptions{Anonymize: true, SingleDay: "Monday"})
	if err != nil {
		t.Fatalf("GenerateFromCSV returned error: %v", err)
	}
	if dataset.SelectedSingleDay != "Monday" {
		t.Fatalf("expected explicit Monday, got %q", dataset.SelectedSingleDay)
	}
}

func TestGeneratedFullWeekCSVParses(t *testing.T) {
	dataset := Generate()
	payload, err := WriteCSV(dataset.Classes)
	if err != nil {
		t.Fatalf("WriteCSV returned error: %v", err)
	}

	result, err := tasks.ExtractClassesFromCSV(bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("ExtractClassesFromCSV returned error: %v", err)
	}

	if got := len(result.Sessions); got != 14 {
		t.Fatalf("expected 14 full-week sessions, got %d", got)
	}
	if got := countClasses(result.ClassesBySession); got != 112 {
		t.Fatalf("expected 112 full-week classes, got %d", got)
	}
	assertLocations(t, result.Sessions)
	assertWaitlists(t, result.Sessions)
	assertCSVHeaders(t, payload)
}

func TestGeneratedDatasetCoversDemoWorkflows(t *testing.T) {
	dataset := Generate()
	if len(dataset.Accounts) != 5 {
		t.Fatalf("expected 5 accounts, got %d", len(dataset.Accounts))
	}
	if len(dataset.RequestAssignments) == 0 {
		t.Fatal("expected request assignments")
	}
	if len(dataset.Notes) == 0 {
		t.Fatal("expected notes")
	}
	if len(dataset.Reports) == 0 {
		t.Fatal("expected reports")
	}
	if len(dataset.ReportCards) == 0 {
		t.Fatal("expected report card totals")
	}
	if len(dataset.AttendanceSheets) != 2 {
		t.Fatalf("expected 2 attendance sheets, got %d", len(dataset.AttendanceSheets))
	}
	for _, class := range dataset.Classes {
		if class.EventID == "" || class.ServiceName == "" || class.Location == "" {
			t.Fatalf("class has missing required data: %+v", class)
		}
		for _, student := range class.Students {
			if student.FirstName == "" || student.LastName == "" || student.Phone == "" || student.Age == "" {
				t.Fatalf("student has missing required data: %+v", student)
			}
		}
	}
}

func TestGeneratedReportCardsUseTermLabels(t *testing.T) {
	dataset := Generate()
	if len(dataset.ReportCards) == 0 {
		t.Fatal("expected report cards")
	}
	for _, card := range dataset.ReportCards {
		if card.Session != TermLabel {
			t.Fatalf("expected report card session %q, got %q", TermLabel, card.Session)
		}
		if strings.Contains(card.Session, "|") {
			t.Fatalf("expected term-only report card session, got %q", card.Session)
		}
		if strings.HasPrefix(card.Session, card.Day+" ") {
			t.Fatalf("expected report card session not to include day %q: %q", card.Day, card.Session)
		}
	}
}

func TestSourceCSVReportCardsUseParsedTerm(t *testing.T) {
	dataset, err := GenerateFromCSV(strings.NewReader(sourceCSVFixture()), SourceCSVOptions{Anonymize: true})
	if err != nil {
		t.Fatalf("GenerateFromCSV returned error: %v", err)
	}
	if len(dataset.ReportCards) == 0 {
		t.Fatal("expected report cards")
	}
	for _, card := range dataset.ReportCards {
		if card.Session != "Summer 2026" {
			t.Fatalf("expected source report card session %q, got %q", "Summer 2026", card.Session)
		}
	}
}

func TestReportCardsReflectBookedStudents(t *testing.T) {
	for name, dataset := range map[string]Dataset{
		"synthetic": Generate(),
		"source":    mustGenerateFromCSV(t, sourceCSVFixture()),
	} {
		t.Run(name, func(t *testing.T) {
			expected := expectedReportCardTotals(dataset.Sessions)
			actual := reportCardTotalsByScope(dataset.ReportCards)
			if len(actual) != len(expected) {
				t.Fatalf("expected %d report card rows, got %d\nexpected=%#v\nactual=%#v", len(expected), len(actual), expected, actual)
			}
			for key, expectedTotal := range expected {
				if actual[key] != expectedTotal {
					t.Fatalf("scope %q: expected total %d, got %d", key, expectedTotal, actual[key])
				}
			}
		})
	}
}

func TestNotesReferenceGeneratedSessions(t *testing.T) {
	for name, dataset := range map[string]Dataset{
		"synthetic": Generate(),
		"source":    mustGenerateFromCSV(t, sourceCSVFixture()),
	} {
		t.Run(name, func(t *testing.T) {
			sessionKeys := sessionKeySet(dataset.Sessions)
			for _, note := range dataset.Notes {
				if !sessionKeys[note.SessionKey] {
					t.Fatalf("note references unknown session key %q", note.SessionKey)
				}
			}
			for _, report := range dataset.Reports {
				if !sessionKeys[report.SessionKey] {
					t.Fatalf("report references unknown session key %q", report.SessionKey)
				}
			}
		})
	}
}

func TestSourceCSVNotesCoverEveryParsedSession(t *testing.T) {
	dataset := mustGenerateFromCSV(t, sourceCSVFixture())
	bySession := map[string]map[string]int{}
	for _, note := range dataset.Notes {
		if bySession[note.SessionKey] == nil {
			bySession[note.SessionKey] = map[string]int{}
		}
		bySession[note.SessionKey][note.Type]++
	}
	for _, session := range dataset.Sessions {
		counts := bySession[session.Key]
		for _, noteType := range []string{"general", "recognition", "feedback", "coaching", "todo"} {
			if counts[noteType] == 0 {
				t.Fatalf("session %q missing %s note", session.Key, noteType)
			}
		}
	}
}

func TestSourceCSVReportsCoverEveryParsedSession(t *testing.T) {
	dataset := mustGenerateFromCSV(t, sourceCSVFixture())
	bySession := map[string]int{}
	for _, report := range dataset.Reports {
		bySession[report.SessionKey]++
	}
	for _, session := range dataset.Sessions {
		if bySession[session.Key] != 1 {
			t.Fatalf("expected one report for session %q, got %d", session.Key, bySession[session.Key])
		}
	}
}

func TestGeneratedNotesIncludeSessionContext(t *testing.T) {
	for name, dataset := range map[string]Dataset{
		"synthetic": Generate(),
		"source":    mustGenerateFromCSV(t, sourceCSVFixture()),
	} {
		t.Run(name, func(t *testing.T) {
			text := notesText(dataset.Notes)
			if name == "source" {
				for _, expected := range []string{"Real Pool", "Splash 1"} {
					if !strings.Contains(text, expected) {
						t.Fatalf("expected source notes to include %q in %q", expected, text)
					}
				}
			}
			for _, note := range dataset.Notes {
				if (note.Type == "recognition" || note.Type == "feedback" || note.Type == "coaching") && strings.TrimSpace(note.EmployeeName) == "" {
					t.Fatalf("expected %s note to include employee name: %+v", note.Type, note)
				}
			}
		})
	}
}

func TestGeneratedReportsIncludeSessionContext(t *testing.T) {
	for name, dataset := range map[string]Dataset{
		"synthetic": Generate(),
		"source":    mustGenerateFromCSV(t, sourceCSVFixture()),
	} {
		t.Run(name, func(t *testing.T) {
			sessionByKey := map[string]Session{}
			for _, session := range dataset.Sessions {
				sessionByKey[session.Key] = session
			}
			for _, report := range dataset.Reports {
				session := sessionByKey[report.SessionKey]
				if !strings.Contains(report.Title, session.Day) || !strings.Contains(report.Title, session.Location) {
					t.Fatalf("report title %q does not include session day/location %+v", report.Title, session)
				}
				level := sessionLevelExamples(session, 1)[0]
				if !strings.Contains(reportDataText(report.Data), level) {
					t.Fatalf("expected report for %q to include level %q", report.SessionKey, level)
				}
			}
		})
	}
}

func TestGeneratedReportsCoverAllSections(t *testing.T) {
	dataset := Generate()
	if len(dataset.Reports) != len(dataset.Sessions) {
		t.Fatalf("expected one report per session, got %d reports for %d sessions", len(dataset.Reports), len(dataset.Sessions))
	}
	for _, report := range dataset.Reports {
		assertReportArray(t, report, "staff", "performance")
		assertReportArray(t, report, "staff", "strengthWeakness")
		assertReportArray(t, report, "staff", "successionPlans")
		assertReportArray(t, report, "staff", "instructorCovers")
		assertReportArray(t, report, "lessonStructure", "challengingTimes")
		assertReportArray(t, report, "lessonStructure", "newClassLayouts")
		assertReportArray(t, report, "safetyFacility", "safetyConcerns")
		assertReportArray(t, report, "safetyFacility", "maintenanceIssues")
		assertReportArray(t, report, "safetyFacility", "poolDeckWorksWell")
		assertReportArray(t, report, "safetyFacility", "poolDeckImprovements")
		if values, ok := report.Data["parentCustomerFeedback"].([]map[string]string); !ok || len(values) == 0 {
			t.Fatalf("report %q missing parentCustomerFeedback", report.SessionKey)
		}
		assertReportArray(t, report, "projectsInitiatives", "adminWork")
		assertReportArray(t, report, "projectsInitiatives", "initiatives")
	}
}

func TestGeneratedReportsUseMultipleEmployees(t *testing.T) {
	dataset := Generate()
	staff := map[string]struct{}{}
	for _, report := range dataset.Reports {
		collectReportInstructors(report.Data, staff)
	}
	if len(staff) < 4 {
		t.Fatalf("expected at least 4 staff in reports, got %d: %#v", len(staff), staff)
	}
}

func countClasses(classesBySession map[string][]tasks.ExtractedClass) int {
	total := 0
	for _, classes := range classesBySession {
		total += len(classes)
	}
	return total
}

func mustGenerateFromCSV(t *testing.T, payload string) Dataset {
	t.Helper()
	dataset, err := GenerateFromCSV(strings.NewReader(payload), SourceCSVOptions{Anonymize: true})
	if err != nil {
		t.Fatalf("GenerateFromCSV returned error: %v", err)
	}
	return dataset
}

func sessionKeySet(sessions []Session) map[string]bool {
	out := map[string]bool{}
	for _, session := range sessions {
		out[session.Key] = true
	}
	return out
}

func notesText(notes []Note) string {
	var parts []string
	for _, note := range notes {
		parts = append(parts, note.Text)
	}
	return strings.Join(parts, "\n")
}

func reportDataText(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case map[string]any:
		parts := make([]string, 0, len(typed))
		for _, next := range typed {
			parts = append(parts, reportDataText(next))
		}
		return strings.Join(parts, "\n")
	case []map[string]string:
		var parts []string
		for _, row := range typed {
			for _, value := range row {
				parts = append(parts, value)
			}
		}
		return strings.Join(parts, "\n")
	default:
		return ""
	}
}

func assertReportArray(t *testing.T, report Report, section string, field string) {
	t.Helper()
	parent, ok := report.Data[section].(map[string]any)
	if !ok {
		t.Fatalf("report %q missing section %q", report.SessionKey, section)
	}
	values, ok := parent[field].([]map[string]string)
	if !ok || len(values) == 0 {
		t.Fatalf("report %q missing %s.%s", report.SessionKey, section, field)
	}
}

func collectReportInstructors(value any, staff map[string]struct{}) {
	switch typed := value.(type) {
	case map[string]any:
		for _, next := range typed {
			collectReportInstructors(next, staff)
		}
	case []map[string]string:
		for _, row := range typed {
			for _, key := range []string{"instructor", "coveredBy"} {
				if name := strings.TrimSpace(row[key]); name != "" {
					staff[name] = struct{}{}
				}
			}
		}
	}
}

func expectedReportCardTotals(sessions []Session) map[string]int {
	totals := map[string]int{}
	for _, session := range sessions {
		label := termLabel(session.SessionSeason, session.SessionYear)
		for _, class := range session.Classes {
			instructor := firstNonEmpty(class.RequestOwner, class.Instructor)
			if instructor == "" {
				continue
			}
			booked := 0
			for _, student := range class.Students {
				if !student.Waitlist {
					booked++
				}
			}
			if booked == 0 {
				continue
			}
			totals[reportCardScopeKey(label, session.Day, instructor, session.OwnerEmail)] += booked
		}
	}
	return totals
}

func reportCardTotalsByScope(cards []ReportCardTotal) map[string]int {
	totals := map[string]int{}
	for _, card := range cards {
		totals[reportCardScopeKey(card.Session, card.Day, card.Instructor, card.CreatedBy)] += card.Total
	}
	return totals
}

func reportCardScopeKey(session string, day string, instructor string, createdBy string) string {
	return strings.Join([]string{session, day, instructor, createdBy}, "\x00")
}

func assertLocations(t *testing.T, sessions []tasks.ExtractedSession) {
	t.Helper()
	found := map[string]bool{}
	for _, session := range sessions {
		found[session.Location] = true
		if session.SessionSeason != TermSeason {
			t.Fatalf("expected term season %q, got %q", TermSeason, session.SessionSeason)
		}
		if session.SessionYear != TermYear {
			t.Fatalf("expected term year %d, got %d", TermYear, session.SessionYear)
		}
	}
	for _, location := range Locations {
		if !found[location] {
			t.Fatalf("expected location %q in extracted sessions", location)
		}
	}
}

func assertWaitlists(t *testing.T, sessions []tasks.ExtractedSession) {
	t.Helper()
	waitlists := 0
	for _, session := range sessions {
		waitlists += session.WaitlistCount
	}
	if waitlists == 0 {
		t.Fatal("expected at least one waitlist student")
	}
}

func assertCSVHeaders(t *testing.T, payload []byte) {
	t.Helper()
	reader := csv.NewReader(bytes.NewReader(payload))
	headers, err := reader.Read()
	if err != nil {
		t.Fatalf("failed to read headers: %v", err)
	}
	if len(headers) != len(CSVHeaders) {
		t.Fatalf("expected %d headers, got %d", len(CSVHeaders), len(headers))
	}
	for index, header := range CSVHeaders {
		if headers[index] != header {
			t.Fatalf("header %d: expected %q, got %q", index, header, headers[index])
		}
	}
}

func sourceCSVFixture() string {
	return strings.Join([]string{
		strings.Join(CSVHeaders[:14], ","),
		`Splash 1,6,2,Monday,Splash 1 Demo,9:00 AM - 9:30 AM,900001,From 2026-07-06 to 2026-07-12,Real Pool,"RealKid, Example",Booked,416-555-0101,real@example.test,7`,
		`Splash 2,6,1,Monday,Splash 2 Demo,9:00 AM - 9:30 AM,900002,From 2026-07-06 to 2026-07-12,Real Pool,"Second, Student",Booked,416-555-0102,second@example.test,8`,
		`Splash 4,8,1,Monday,Splash 4 Demo,9:30 AM - 10:00 AM,900003,From 2026-07-06 to 2026-07-12,Real Pool,"Third, Student",Waiting,416-555-0103,third@example.test,9`,
		`Teen Adult 1,8,1,Tuesday,Teen Adult 1 Demo,10:00 AM - 10:45 AM,900004,From 2026-07-06 to 2026-07-12,Real Pool,"Fourth, Student",Booked,416-555-0104,fourth@example.test,15`,
		"",
	}, "\n")
}
