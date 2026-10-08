package rosterupdates

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

type Student struct {
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Age      string `json:"age"`
	Level    string `json:"level"`
	Waitlist bool   `json:"waitlist"`
}

// ClassDetails deliberately excludes student information from persisted rows.
type ClassDetails struct {
	Code        string `json:"code"`
	ServiceName string `json:"serviceName"`
	Day         string `json:"day"`
	Time        string `json:"time"`
	Location    string `json:"location"`
	Schedule    string `json:"schedule"`
	Instructor  string `json:"instructor"`
}

type Class struct {
	ClassDetails
	Students []Student `json:"students"`
}

type ClassHash struct {
	Code    string       `json:"code"`
	Hash    string       `json:"roster_hash"`
	Details ClassDetails `json:"class_details"`
}

// Student ordering and incidental whitespace do not create roster changes.
// Keep duplicate student rows: two people with the same name still count twice.
func HashStudents(students []Student) string {
	rows := make([]string, 0, len(students))
	normalize := func(s string) string { return strings.ToLower(strings.Join(strings.Fields(s), " ")) }
	for _, s := range students {
		row, _ := json.Marshal([]string{normalize(s.Name), normalize(s.Phone), normalize(s.Age), normalize(s.Level), strconv.FormatBool(s.Waitlist)})
		rows = append(rows, string(row))
	}
	sort.Strings(rows)
	payload, _ := json.Marshal(rows)
	hash := sha256.Sum256(payload)
	return hex.EncodeToString(hash[:])
}

func HashClasses(classes []Class) ([]ClassHash, error) {
	rows := make([]ClassHash, 0, len(classes))
	seen := map[string]bool{}
	for _, class := range classes {
		code := strings.TrimSpace(class.Code)
		if code == "" || seen[code] {
			return nil, fmt.Errorf("missing or duplicate course code: %q", code)
		}
		seen[code] = true
		class.Code = code
		rows = append(rows, ClassHash{Code: code, Hash: HashStudents(class.Students), Details: class.ClassDetails})
	}
	return rows, nil
}
