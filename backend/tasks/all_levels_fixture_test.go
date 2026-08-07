package tasks

import (
	"os"
	"testing"
)

func TestAllAttendanceLevelsFixture(t *testing.T) {
	file, err := os.Open("../../frontend/test-fixtures/csv/all-attendance-levels-one-instructor.csv")
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}
	defer file.Close()

	result, err := ExtractClassesFromCSV(file, ExtractOptions{
		InstructorMap: map[string]string{
			"90001": "Test Instructor", "90002": "Test Instructor", "90003": "Test Instructor",
			"90004": "Test Instructor", "90005": "Test Instructor", "90006": "Test Instructor",
			"90007": "Test Instructor", "90008": "Test Instructor", "90009": "Test Instructor",
			"90010": "Test Instructor", "90011": "Test Instructor", "90012": "Test Instructor",
			"90013": "Test Instructor", "90014": "Test Instructor", "90015": "Test Instructor",
			"90016": "Test Instructor", "90017": "Test Instructor", "90018": "Test Instructor",
			"90019": "Test Instructor", "90020": "Test Instructor", "90021": "Test Instructor",
			"90022": "Test Instructor", "90023": "Test Instructor",
		},
	})
	if err != nil {
		t.Fatalf("extract fixture: %v", err)
	}
	if len(result.Sessions) != 1 {
		t.Fatalf("expected one session, got %d", len(result.Sessions))
	}

	classes := result.ClassesBySession[result.Sessions[0].SessionKey]
	if len(classes) != 23 {
		t.Fatalf("expected 23 classes, got %d", len(classes))
	}
	for _, class := range classes {
		if class.Instructor != "Test Instructor" {
			t.Fatalf("class %s has instructor %q", class.CourseCode, class.Instructor)
		}
		if len(class.Roster) != 1 {
			t.Fatalf("class %s has %d roster entries", class.CourseCode, len(class.Roster))
		}
	}
}
