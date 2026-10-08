package rosterupdates

import "testing"

func TestHashStudentsIgnoresOrderAndWhitespace(t *testing.T) {
	a := Student{Name: " Alice  Smith ", Phone: "555-0100", Age: "8", Level: "Splash 1"}
	b := Student{Name: "Bob", Waitlist: true}
	canonical := a
	canonical.Name = "alice smith"
	if HashStudents([]Student{a, b}) != HashStudents([]Student{b, canonical}) {
		t.Fatal("incidental ordering/formatting changed the hash")
	}
	if HashStudents(nil) != HashStudents([]Student{}) {
		t.Fatal("empty rosters must have the same hash")
	}
}

func TestHashStudentsDetectsPrintedRosterChanges(t *testing.T) {
	student := Student{Name: "Alice", Phone: "555-0100", Age: "8", Level: "Splash 1"}
	base := HashStudents([]Student{student})
	for _, mutate := range []func(*Student){
		func(s *Student) { s.Name = "Bob" }, func(s *Student) { s.Phone = "555-0200" },
		func(s *Student) { s.Age = "9" }, func(s *Student) { s.Level = "Splash 2" }, func(s *Student) { s.Waitlist = true },
	} {
		changed := student
		mutate(&changed)
		if HashStudents([]Student{changed}) == base {
			t.Fatal("student change was not detected")
		}
	}
	if HashStudents([]Student{student, student}) == base {
		t.Fatal("duplicate student identity lost a person")
	}
	if HashStudents(nil) == base {
		t.Fatal("student removal was not detected")
	}
}

func TestHashClassesRejectsDuplicateCourseCodes(t *testing.T) {
	_, err := HashClasses([]Class{{ClassDetails: ClassDetails{Code: " A "}}, {ClassDetails: ClassDetails{Code: "A"}}})
	if err == nil {
		t.Fatal("duplicate codes accepted")
	}
	rows, err := HashClasses([]Class{{ClassDetails: ClassDetails{Code: " A ", Instructor: "One"}}})
	if err != nil || rows[0].Code != "A" || len(rows[0].Hash) != 64 {
		t.Fatalf("invalid normalized hash: %v %v", rows, err)
	}
	other, _ := HashClasses([]Class{{ClassDetails: ClassDetails{Code: "A", Instructor: "Two"}}})
	if rows[0].Hash != other[0].Hash {
		t.Fatal("instructor metadata must not change a student hash")
	}
}
