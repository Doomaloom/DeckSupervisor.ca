package tasks

import "testing"

func TestNormalizeEventIDTreatsLeadingZerosAsEquivalent(t *testing.T) {
	t.Parallel()

	if got := NormalizeEventID("00012234234234"); got != "12234234234" {
		t.Fatalf("expected leading zeros to be removed, got %q", got)
	}
	if got := NormalizeEventID("12234234234"); got != "12234234234" {
		t.Fatalf("expected unchanged numeric event id, got %q", got)
	}
}

func TestExtractClassesRowsBuildsSessionAndClassSummaries(t *testing.T) {
	t.Parallel()

	rows := []csvRow{
		{
			"eventid":       "00123",
			"servicename":   "Splash 2A",
			"location":      "Pool A",
			"dayoftheweek":  "Monday",
			"starts":        "2026-03-23 3:15 PM",
			"ends":          "2026-03-23 3:45 PM",
			"eventschedule": "From 2026-03-01 to 2026-05-30",
			"attendeename":  "Jane Doe",
			"booked":        "2",
		},
		{
			"eventid":       "00123",
			"servicename":   "Splash 2A",
			"location":      "Pool A",
			"dayoftheweek":  "Monday",
			"starts":        "2026-03-23 3:15 PM",
			"ends":          "2026-03-23 3:45 PM",
			"eventschedule": "From 2026-03-01 to 2026-05-30",
			"attendeename":  "John Doe",
			"booked":        "2",
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
	if session.SessionKey != "Mo|spring|2026|pool a|15:15|15:45" {
		t.Fatalf("unexpected session key %q", session.SessionKey)
	}
	if session.SessionStartTime24 != "15:15" || session.SessionEndTime24 != "15:45" {
		t.Fatalf("unexpected session window %s-%s", session.SessionStartTime24, session.SessionEndTime24)
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
	if class.WaitlistCount != 0 {
		t.Fatalf("expected waitlist count 0, got %d", class.WaitlistCount)
	}
}

func TestExtractClassesRowsUsesBookedColumnAndCountsWaitingAttendees(t *testing.T) {
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
			"attendeestatus": "Booked",
			"booked":         "5",
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
			"attendeestatus": "Waiting",
			"booked":         "5",
		},
	}

	result, err := ExtractClassesRows(rows)
	if err != nil {
		t.Fatalf("ExtractClassesRows returned error: %v", err)
	}

	session := result.Sessions[0]
	if session.StudentCount != 5 {
		t.Fatalf("expected session student count 5, got %d", session.StudentCount)
	}
	if session.WaitlistCount != 1 {
		t.Fatalf("expected session waitlist count 1, got %d", session.WaitlistCount)
	}

	classes := result.ClassesBySession[session.SessionKey]
	if classes[0].StudentCount != 5 {
		t.Fatalf("expected class student count 5, got %d", classes[0].StudentCount)
	}
	if classes[0].WaitlistCount != 1 {
		t.Fatalf("expected class waitlist count 1, got %d", classes[0].WaitlistCount)
	}
}

func TestExtractClassesRowsUsesBookedColumnWithoutAttendeeRows(t *testing.T) {
	t.Parallel()

	rows := []csvRow{
		{
			"eventid":       "00456",
			"servicename":   "Splash 4",
			"location":      "Pool B",
			"dayoftheweek":  "Tuesday",
			"starts":        "2026-03-24 4:00 PM",
			"ends":          "2026-03-24 4:30 PM",
			"eventschedule": "From 2026-03-01 to 2026-05-30",
			"booked":        "5",
		},
	}

	result, err := ExtractClassesRows(rows)
	if err != nil {
		t.Fatalf("ExtractClassesRows returned error: %v", err)
	}

	session := result.Sessions[0]
	if session.StudentCount != 5 {
		t.Fatalf("expected session student count 5, got %d", session.StudentCount)
	}
	if session.WaitlistCount != 0 {
		t.Fatalf("expected session waitlist count 0, got %d", session.WaitlistCount)
	}

	classes := result.ClassesBySession[session.SessionKey]
	if classes[0].StudentCount != 5 {
		t.Fatalf("expected class student count 5, got %d", classes[0].StudentCount)
	}
	if classes[0].WaitlistCount != 0 {
		t.Fatalf("expected class waitlist count 0, got %d", classes[0].WaitlistCount)
	}
}

func TestExtractHelpers(t *testing.T) {
	t.Parallel()

	if got := BuildExtractedSessionKey("Mo", "Spring", 2026, "Pool A", "15:15", "15:45"); got != "Mo|spring|2026|pool a|15:15|15:45" {
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

func TestExtractClassesRowsSplitsSessionsWhenGapExceedsThirtyMinutes(t *testing.T) {
	t.Parallel()

	rows := []csvRow{
		{
			"eventid":       "00100",
			"servicename":   "Splash 1",
			"location":      "Pool",
			"dayoftheweek":  "Saturday",
			"starts":        "2026-01-10 9:00 AM",
			"ends":          "2026-01-10 1:00 PM",
			"eventschedule": "From 2026-01-03 to 2026-02-28",
			"booked":        "8",
		},
		{
			"eventid":       "00200",
			"servicename":   "Splash 4",
			"location":      "Pool",
			"dayoftheweek":  "Saturday",
			"starts":        "2026-01-10 4:00 PM",
			"ends":          "2026-01-10 7:00 PM",
			"eventschedule": "From 2026-01-03 to 2026-02-28",
			"booked":        "6",
		},
	}

	result, err := ExtractClassesRows(rows)
	if err != nil {
		t.Fatalf("ExtractClassesRows returned error: %v", err)
	}

	if len(result.Sessions) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(result.Sessions))
	}

	first := result.Sessions[0]
	if first.SessionKey != "Sa|winter|2026|pool|09:00|13:00" {
		t.Fatalf("unexpected first session key %q", first.SessionKey)
	}
	second := result.Sessions[1]
	if second.SessionKey != "Sa|winter|2026|pool|16:00|19:00" {
		t.Fatalf("unexpected second session key %q", second.SessionKey)
	}
}

func TestExtractClassesRowsKeepsClassesTogetherWhenGapIsThirtyMinutesOrLess(t *testing.T) {
	t.Parallel()

	rows := []csvRow{
		{
			"eventid":       "00100",
			"servicename":   "Splash 1",
			"location":      "Pool",
			"dayoftheweek":  "Saturday",
			"starts":        "2026-01-10 9:00 AM",
			"ends":          "2026-01-10 10:00 AM",
			"eventschedule": "From 2026-01-03 to 2026-02-28",
			"booked":        "8",
		},
		{
			"eventid":       "00200",
			"servicename":   "Splash 4",
			"location":      "Pool",
			"dayoftheweek":  "Saturday",
			"starts":        "2026-01-10 10:30 AM",
			"ends":          "2026-01-10 11:00 AM",
			"eventschedule": "From 2026-01-03 to 2026-02-28",
			"booked":        "6",
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
	if session.SessionStartTime24 != "09:00" || session.SessionEndTime24 != "11:00" {
		t.Fatalf("unexpected merged session window %s-%s", session.SessionStartTime24, session.SessionEndTime24)
	}
}

func TestExtractClassesRowsUsesRollingEndBeforeSplitting(t *testing.T) {
	t.Parallel()

	rows := []csvRow{
		{
			"eventid":       "00100",
			"servicename":   "Splash 1",
			"location":      "Pool",
			"dayoftheweek":  "Saturday",
			"starts":        "2026-01-10 9:00 AM",
			"ends":          "2026-01-10 10:00 AM",
			"eventschedule": "From 2026-01-03 to 2026-02-28",
			"booked":        "8",
		},
		{
			"eventid":       "00200",
			"servicename":   "Splash 2",
			"location":      "Pool",
			"dayoftheweek":  "Saturday",
			"starts":        "2026-01-10 9:45 AM",
			"ends":          "2026-01-10 11:00 AM",
			"eventschedule": "From 2026-01-03 to 2026-02-28",
			"booked":        "6",
		},
		{
			"eventid":       "00300",
			"servicename":   "Splash 3",
			"location":      "Pool",
			"dayoftheweek":  "Saturday",
			"starts":        "2026-01-10 11:20 AM",
			"ends":          "2026-01-10 12:00 PM",
			"eventschedule": "From 2026-01-03 to 2026-02-28",
			"booked":        "5",
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
	if session.SessionStartTime24 != "09:00" || session.SessionEndTime24 != "12:00" {
		t.Fatalf("unexpected rolling session window %s-%s", session.SessionStartTime24, session.SessionEndTime24)
	}
}
