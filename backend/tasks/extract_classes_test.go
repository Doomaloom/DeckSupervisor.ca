package tasks

import "testing"

func TestExtractClassesRowsBuildsSessionAndClassSummaries(t *testing.T) {
	t.Parallel()

	rows := []csvRow{
		{
			"eventid":        "00123",
			"servicename":    "Splash 2A",
			"location":       "Pool A",
			"dayoftheweek":   "Monday",
			"starts":         "2026-03-23 3:15 PM",
			"ends":           "2026-03-23 3:45 PM",
			"eventschedule":  "From 2026-03-01 to 2026-05-30",
			"attendeename":   "Jane Doe",
			"registered":     "",
			"regtotal":       "",
		},
		{
			"eventid":        "00123",
			"servicename":    "Splash 2A",
			"location":       "Pool A",
			"dayoftheweek":   "Monday",
			"starts":         "2026-03-23 3:15 PM",
			"ends":           "2026-03-23 3:45 PM",
			"eventschedule":  "From 2026-03-01 to 2026-05-30",
			"attendeename":   "John Doe",
		},
	}

	result, err := ExtractClassesRows(rows)
	if err != nil {
		t.Fatalf("ExtractClassesRows returned error: %v", err)
	}

	if len(result.Sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(result.Sessions))
	}
	session := result.Sessions[0]
	if session.SessionKey != "Mo|spring|2026|pool a" {
		t.Fatalf("unexpected session key %q", session.SessionKey)
	}
	if session.ClassCount != 1 || session.StudentCount != 2 {
		t.Fatalf("unexpected session counts: %+v", session)
	}

	classes := result.ClassesBySession[session.SessionKey]
	if len(classes) != 1 {
		t.Fatalf("expected 1 class in session, got %d", len(classes))
	}
	class := classes[0]
	if class.CourseCode != "123" {
		t.Fatalf("expected normalized course code 123, got %q", class.CourseCode)
	}
	if class.StartTime24 != "15:15" || class.EndTime24 != "15:45" {
		t.Fatalf("unexpected time range %s-%s", class.StartTime24, class.EndTime24)
	}
	if class.DurationMinutes != 30 {
		t.Fatalf("expected 30 minute duration, got %d", class.DurationMinutes)
	}
	if class.StudentCount != 2 {
		t.Fatalf("expected student count 2, got %d", class.StudentCount)
	}
}

func TestExtractHelpers(t *testing.T) {
	t.Parallel()

	if got := BuildExtractedSessionKey("Mo", "Spring", 2026, "Pool A"); got != "Mo|spring|2026|pool a" {
		t.Fatalf("BuildExtractedSessionKey returned %q", got)
	}

	start, end := splitTimeRange("3:15 PM - 3:45 PM")
	if start != "3:15 PM" || end != "3:45 PM" {
		t.Fatalf("unexpected split time range: %q %q", start, end)
	}

	startTime24, _ := extractTimeAndDate("2026-03-23 3:15 PM")
	if startTime24 != "15:15" {
		t.Fatalf("extractTimeAndDate returned %q", startTime24)
	}

	if got := getDurationMinutes("23:45", "00:15"); got != 30 {
		t.Fatalf("expected overnight duration 30, got %d", got)
	}

	if got := parsePositiveInt("12"); got != 12 {
		t.Fatalf("parsePositiveInt returned %d", got)
	}
	if got := daySortKey("Fr"); got != 5 {
		t.Fatalf("daySortKey returned %d", got)
	}
}
