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
