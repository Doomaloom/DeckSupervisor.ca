package tasks

import (
	"strings"
	"testing"
)

const testRosterHeader = "ServiceName,Booked,DayOfTheWeek,EventName,EventTime,EventID,EventSchedule,Facility,AttendeeName,AttendeeStatus,AttendeePhone,Age\n"

func TestExtractClassesFromCSVGivesPlainMessagesForBadFiles(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		input string
		want  string
	}{
		"empty":       {"", "This file is empty"},
		"blank":       {"\n  \n", "This file is empty"},
		"header only": {testRosterHeader, "header row but no roster rows"},
		"no EventTime": {
			"ServiceName,EventID,AttendeeName\nSplash 1,123,Jane\n",
			"EventTime column is missing",
		},
		"binary": {"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", "not a CSV roster"},
	}
	for name, tc := range cases {
		tc := tc
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			_, err := ExtractClassesFromCSV(strings.NewReader(tc.input))
			fileErr, ok := IsCSVFileError(err)
			if !ok {
				t.Fatalf("expected a file error, got %v", err)
			}
			if !strings.Contains(fileErr.Message, tc.want) {
				t.Fatalf("message %q does not contain %q", fileErr.Message, tc.want)
			}
			if strings.Contains(fileErr.Message, "DataFrame") {
				t.Fatalf("message is technical: %q", fileErr.Message)
			}
		})
	}
}

func TestExtractClassesFromCSVBlankAgeAndPhoneStayBlank(t *testing.T) {
	t.Parallel()

	csv := testRosterHeader +
		"Splash 1,2,Thursday,Splash 1,4:00 PM - 4:30 PM,98001,From 2026-09-01 to 2026-12-01,Pool,Jane Doe,Booked,5551234567,4\n" +
		"Splash 1,2,Thursday,Splash 1,4:00 PM - 4:30 PM,98001,From 2026-09-01 to 2026-12-01,Pool,John Roe,Booked,,\n"
	result, err := ExtractClassesFromCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	found := 0
	for _, classes := range result.ClassesBySession {
		for _, class := range classes {
			for _, student := range class.Roster {
				found++
				if student.Name == "John Roe" && (student.Age != "" || student.Phone != "") {
					t.Fatalf("blank cells came out as age %q phone %q", student.Age, student.Phone)
				}
			}
		}
	}
	if found != 2 {
		t.Fatalf("expected 2 students, got %d", found)
	}
}
