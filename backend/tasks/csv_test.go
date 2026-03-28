package tasks

import (
	"strings"
	"testing"
)

func TestReadCSVRowsNormalizesHeadersAndValues(t *testing.T) {
	t.Parallel()

	rows, err := readCSVRows(strings.NewReader("\uFEFF EventID , AttendeeName , Instructor Name \n00123, Jane Doe , Coach Amy \n"))
	if err != nil {
		t.Fatalf("readCSVRows returned error: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows))
	}
	if got := rows[0]["eventid"]; got != "123" {
		t.Fatalf("expected normalized event id, got %q", got)
	}
	if got := rowValue(rows[0], "Instructor", "Instructor Name"); got != "Coach Amy" {
		t.Fatalf("rowValue returned %q", got)
	}
}

func TestProcessCSVRowsBuildsClassRosters(t *testing.T) {
	t.Parallel()

	rows := []csvRow{
		{
			"servicename":    "Splash 2A",
			"eventid":        "0007",
			"dayoftheweek":   "",
			"eventtime":      "09:00-09:30",
			"location":       "Pool A",
			"eventschedule":  "",
			"attendeename":   "Doe, Jane",
			"attendeephone":  "5551112222",
			"instructorname": "Coach From Row",
		},
		{
			"servicename":   "Splash 2A",
			"eventid":       "0007",
			"firstname":     "John",
			"lastname":      "Smith",
			"attendeephone": "5551113333",
			"status":        "Waitlist",
		},
	}

	classes, totalStudents, err := ProcessCSVRows(rows, map[string]string{"0007": "Coach Map"}, "Wednesday")
	if err != nil {
		t.Fatalf("ProcessCSVRows returned error: %v", err)
	}
	if totalStudents != 2 {
		t.Fatalf("expected 2 students, got %d", totalStudents)
	}
	if len(classes) != 1 {
		t.Fatalf("expected 1 class, got %d", len(classes))
	}

	class := classes[0]
	if class.Day != "We" {
		t.Fatalf("expected fallback day to normalize to We, got %q", class.Day)
	}
	if class.Schedule != "We" {
		t.Fatalf("expected empty schedule to fall back to normalized day, got %q", class.Schedule)
	}
	if class.Instructor != "Coach Map" {
		t.Fatalf("expected instructor map to win, got %q", class.Instructor)
	}
	if class.Students[0].Name != "Jane Doe" {
		t.Fatalf("expected comma-separated name to be reordered, got %q", class.Students[0].Name)
	}
	if class.Students[1].Name != "John Smith" {
		t.Fatalf("expected first/last name fallback, got %q", class.Students[1].Name)
	}
	if !class.Students[1].Waitlist {
		t.Fatalf("expected second student to be marked waitlist")
	}
}

func TestProcessCSVRowsTreatsWaitingStatusAsWaitlist(t *testing.T) {
	t.Parallel()

	rows := []csvRow{
		{
			"servicename":  "Splash 3",
			"eventid":      "0010",
			"attendeename": "Taylor Swift",
			"status":       "Waiting",
		},
	}

	classes, totalStudents, err := ProcessCSVRows(rows, nil, "Monday")
	if err != nil {
		t.Fatalf("ProcessCSVRows returned error: %v", err)
	}
	if totalStudents != 1 {
		t.Fatalf("expected 1 student, got %d", totalStudents)
	}
	if len(classes) != 1 {
		t.Fatalf("expected 1 class, got %d", len(classes))
	}
	if !classes[0].Students[0].Waitlist {
		t.Fatalf("expected Waiting status to be marked waitlist")
	}
}

func TestNormalizeHeaderAndDay(t *testing.T) {
	t.Parallel()

	if got := normalizeHeader("\uFEFF Day Of The Week "); got != "day of the week" {
		t.Fatalf("normalizeHeader returned %q", got)
	}
	if got := normalizeDay("Monday"); got != "Mo" {
		t.Fatalf("normalizeDay returned %q", got)
	}
	if got := normalizeDay("Mo Tu We Th Fr"); got != "Mo,Tu,We,Th,Fr" {
		t.Fatalf("normalizeDay weekday range returned %q", got)
	}
}
