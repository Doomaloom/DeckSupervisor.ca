package handlers

import "testing"

func TestNormalizeShareDates(t *testing.T) {
	dates, err := normalizeShareDates([]string{"2026-04-28", "2026-04-21", "2026-04-28"}, "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []string{"2026-04-21", "2026-04-28"}
	if len(dates) != len(expected) {
		t.Fatalf("expected %d dates, got %d", len(expected), len(dates))
	}
	for index, expectedDate := range expected {
		if dates[index] != expectedDate {
			t.Fatalf("expected date %q at index %d, got %q", expectedDate, index, dates[index])
		}
	}
}

func TestNormalizeShareDatesRejectsInvalidDate(t *testing.T) {
	if _, err := normalizeShareDates([]string{"2026-99-21"}, ""); err == nil {
		t.Fatal("expected invalid date error")
	}
}

func TestIsSessionActiveToday(t *testing.T) {
	session := sessionRow{
		StartDate: stringPointer("2026-04-01"),
		EndDate:   stringPointer("2026-05-01"),
	}

	if !isSessionActiveToday(session, "2026-04-21") {
		t.Fatal("expected session to be active")
	}
	if isSessionActiveToday(session, "2026-03-31") {
		t.Fatal("expected session before start date to be inactive")
	}
	if isSessionActiveToday(session, "2026-05-02") {
		t.Fatal("expected session after end date to be inactive")
	}
}

func TestEnsureShareDatesWithinSessionWindow(t *testing.T) {
	session := sessionRow{
		StartDate: stringPointer("2026-04-01"),
		EndDate:   stringPointer("2026-05-01"),
	}

	if err := ensureShareDatesWithinSessionWindow(session, []string{"2026-04-07", "2026-04-14"}); err != nil {
		t.Fatalf("expected dates within schedule to pass, got %v", err)
	}
	if err := ensureShareDatesWithinSessionWindow(session, []string{"2026-05-05"}); err == nil {
		t.Fatal("expected out-of-window date to fail")
	}
}

func stringPointer(value string) *string {
	return &value
}
