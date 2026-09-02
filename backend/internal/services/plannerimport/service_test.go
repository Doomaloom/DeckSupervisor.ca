package plannerimport

import (
	"bytes"
	"encoding/csv"
	"strings"
	"testing"
)

func TestAnalyzeReconcilesExactSchemas(t *testing.T) {
	activity := csvText(t, activitySummaryHeaders,
		activityRow(map[string]string{
			"GroupName": "Splash 1", "ID": "00450001", "Status": "Confirmed",
			"MainFacility": "Test Pool - Test Recreation Centre", "Starts": "2026-03-30 04:00 PM",
			"Ends": "2026-06-08 04:30 PM", "Day": "Mo", "Min": "3", "Max": "6",
			"RegTotal": "1", "Waitlist": "0",
		}),
		activityRow(map[string]string{
			"GroupName": "Splash 2", "ID": "00450002", "Status": "Confirmed",
			"MainFacility": "Test Pool - Test Recreation Centre", "Starts": "2026-03-30 04:30 PM",
			"Ends": "2026-06-08 05:00 PM", "Day": "Mo", "Min": "3", "Max": "6",
			"RegTotal": "0", "Waitlist": "0",
		}),
	)
	roster := csvText(t, rosterHeaders,
		rosterRow(map[string]string{
			"ServiceName": "Splash 1", "MinimumCapacity": "3", "MaximumCapacity": "6", "Booked": "1",
			"DayOfTheWeek": "Mo", "EventTime": "04:00 PM - 04:30 PM", "EventID": "00450001",
			"EventSchedule": "From 2026-03-30 to 2026-06-08", "Facility": "Test Pool",
			"AttendeeName": "Student, One", "AttendeeStatus": "Booked", "AttendeePhone": "555-0101",
			"Age": "7", "E-mail": "student@example.com",
		}),
		rosterRow(map[string]string{
			"ServiceName": "Private Lesson", "MinimumCapacity": "1", "MaximumCapacity": "1", "Booked": "1",
			"DayOfTheWeek": "Tu", "EventTime": "05:00 PM - 05:30 PM", "EventID": "00450003",
			"EventSchedule": "From 2026-03-31 to 2026-06-09", "Facility": "Test Pool",
			"AttendeeName": "Student Two", "AttendeeStatus": "Booked", "AttendeePhone": "555-0102",
			"Age": "8", "E-mail": "student2@example.com",
		}),
	)

	result, err := Analyze(strings.NewReader(activity), "activity.csv", strings.NewReader(roster), "roster.csv")
	if err != nil {
		t.Fatalf("Analyze returned an error: %v", err)
	}
	if len(result.Dataset.Classes) != 3 {
		t.Fatalf("expected 3 classes, got %d", len(result.Dataset.Classes))
	}
	if len(result.Dataset.Participants) != 2 || len(result.Dataset.CallRecords) != 2 {
		t.Fatalf("expected two participants and call records, got %d and %d", len(result.Dataset.Participants), len(result.Dataset.CallRecords))
	}
	if result.Meta.MatchedClassCount != 1 || result.Meta.ActivityOnlyClassCount != 1 || result.Meta.RosterOnlyClassCount != 1 {
		t.Fatalf("unexpected reconciliation metadata: %+v", result.Meta)
	}

	var emptyClassFound bool
	for _, class := range result.Dataset.Classes {
		if class.EventID == "00450002" {
			emptyClassFound = true
			if class.BookedCount != 0 || len(class.ParticipantIDs) != 0 {
				t.Fatalf("empty activity class was not preserved correctly: %+v", class)
			}
		}
	}
	if !emptyClassFound {
		t.Fatal("expected the empty activity-summary class to be retained")
	}
	if result.Dataset.Participants[0].EventID != "00450001" && result.Dataset.Participants[1].EventID != "00450001" {
		t.Fatal("expected leading-zero EventID to be preserved")
	}
}

func TestAnalyzeRejectsNonExactHeader(t *testing.T) {
	headers := append([]string(nil), activitySummaryHeaders...)
	headers[0] = "Group Name"
	activity := csvText(t, headers, make([]string, len(headers)))
	roster := csvText(t, rosterHeaders, rosterRow(map[string]string{"EventID": "1"}))

	_, err := Analyze(strings.NewReader(activity), "activity.csv", strings.NewReader(roster), "roster.csv")
	if err == nil || !strings.Contains(err.Error(), `column 1 is "Group Name"; expected exactly "GroupName"`) {
		t.Fatalf("expected exact-header error, got %v", err)
	}
}

func csvText(t *testing.T, headers []string, rows ...[]string) string {
	t.Helper()
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	if err := writer.Write(headers); err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			t.Fatal(err)
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		t.Fatal(err)
	}
	return buffer.String()
}

func activityRow(values map[string]string) []string {
	return rowForHeaders(activitySummaryHeaders, values)
}
func rosterRow(values map[string]string) []string { return rowForHeaders(rosterHeaders, values) }

func rowForHeaders(headers []string, values map[string]string) []string {
	row := make([]string, len(headers))
	for index, header := range headers {
		row[index] = values[header]
	}
	return row
}
