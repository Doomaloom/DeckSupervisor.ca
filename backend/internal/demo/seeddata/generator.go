package seeddata

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"cob-aquatics/tasks"
)

const (
	TeamName     = "DeckSupervisor Demo Aquatics"
	DefaultPass  = "DemoPass123!"
	TermSeason   = "Spring"
	TermYear     = 2026
	TermLabel    = "Spring 2026"
	SingleDay    = "Tuesday"
	SingleDayISO = "2026-04-28"
	StartDateISO = "2026-04-27"
	EndDateISO   = "2026-05-03"
)

var Locations = []string{"Bayside Community Pool", "Hillcrest Aquatic Centre"}

var CSVHeaders = []string{
	"ServiceName",
	"MaximumCapacity",
	"Booked",
	"DayOfTheWeek",
	"EventName",
	"EventTime",
	"EventID",
	"EventSchedule",
	"Facility",
	"AttendeeName",
	"AttendeeStatus",
	"AttendeePhone",
	"AttendeeEmail",
	"Age",
	"GroupName",
	"MainFacility",
	"Day",
	"Starts",
	"Ends",
	"ID",
	"Duration",
	"Max",
	"Min",
	"RegTotal",
	"PercentFilled",
}

type Account struct {
	Email       string
	Password    string
	FirstName   string
	LastName    string
	Location    string
	AccountType string
}

type Student struct {
	FirstName string
	LastName  string
	Phone     string
	Email     string
	Age       string
	Waitlist  bool
}

type Class struct {
	SessionKey    string
	EventID       string
	ServiceName   string
	EventName     string
	Day           string
	DateISO       string
	Location      string
	Start24       string
	End24         string
	StartDate     string
	EndDate       string
	SessionSeason string
	SessionYear   int
	Capacity      int
	Booked        int
	Min           int
	Students      []Student
	Instructor    string
	OwnerEmail    string
	ColumnIndex   int
	RequestOwner  string
}

type Session struct {
	Key           string
	Day           string
	DateISO       string
	StartDate     string
	EndDate       string
	SessionSeason string
	SessionYear   int
	Location      string
	Start24       string
	End24         string
	OwnerEmail    string
	Instructors   []string
	Classes       []Class
}

type Note struct {
	SessionKey   string
	Type         string
	Text         string
	EmployeeName string
	Done         bool
}

type Report struct {
	SessionKey string
	Title      string
	Data       map[string]any
}

type ReportCardTotal struct {
	SessionKey string
	Session    string
	Day        string
	Instructor string
	Total      int
	CreatedBy  string
}

type AttendanceSheet struct {
	Name               string
	BaseTemplate       string
	DefaultForTemplate string
	SheetData          map[string]any
}

type Dataset struct {
	Accounts           []Account
	FullTimeEmail      string
	PartTimeEmails     []string
	Locations          []string
	SelectedSingleDay  string
	Sessions           []Session
	Classes            []Class
	SingleDayClasses   []Class
	RequestAssignments []Class
	Notes              []Note
	Reports            []Report
	ReportCards        []ReportCardTotal
	AttendanceSheets   []AttendanceSheet
}

type SourceCSVOptions struct {
	SourceFileName string
	Anonymize      bool
	SingleDay      string
}

func Generate() Dataset {
	accounts := demoAccounts()

	var classes []Class
	days := []struct {
		Name string
		Date string
	}{
		{"Monday", "2026-04-27"},
		{"Tuesday", "2026-04-28"},
		{"Wednesday", "2026-04-29"},
		{"Thursday", "2026-04-30"},
		{"Friday", "2026-05-01"},
		{"Saturday", "2026-05-02"},
		{"Sunday", "2026-05-03"},
	}

	for dayIndex, day := range days {
		for locationIndex, location := range Locations {
			templates := weekdayTemplates()
			if day.Name == "Saturday" || day.Name == "Sunday" {
				templates = weekendTemplates()
			}
			for classIndex, template := range templates {
				eventID := fmt.Sprintf("%d", 520000+dayIndex*1000+locationIndex*100+classIndex+1)
				owner := ownerFor(day.Name, location)
				instructor := instructorFor(classIndex, locationIndex)
				class := Class{
					SessionKey:    sessionKey(day.Name, location),
					EventID:       eventID,
					ServiceName:   template.Level,
					EventName:     template.Level + " Demo",
					Day:           day.Name,
					DateISO:       day.Date,
					StartDate:     StartDateISO,
					EndDate:       EndDateISO,
					SessionSeason: TermSeason,
					SessionYear:   TermYear,
					Location:      location,
					Start24:       template.Start24,
					End24:         template.End24,
					Capacity:      template.Capacity,
					Booked:        template.Booked,
					Min:           3,
					OwnerEmail:    owner,
					Instructor:    instructor,
					ColumnIndex:   classIndex % 4,
					RequestOwner:  requestInstructorFor(dayIndex, locationIndex, classIndex),
				}
				class.Students = buildStudents(class, dayIndex, locationIndex, classIndex)
				classes = append(classes, class)
			}
		}
	}

	sessions := buildSessions(classes)
	return Dataset{
		Accounts:           accounts,
		FullTimeEmail:      accounts[0].Email,
		PartTimeEmails:     []string{accounts[1].Email, accounts[2].Email, accounts[3].Email, accounts[4].Email},
		Locations:          append([]string(nil), Locations...),
		SelectedSingleDay:  SingleDay,
		Sessions:           sessions,
		Classes:            classes,
		SingleDayClasses:   filterClassesByDay(classes, SingleDay),
		RequestAssignments: requestAssignmentClasses(classes),
		Notes:              buildNotes(sessions),
		Reports:            buildReports(sessions),
		ReportCards:        buildReportCards(sessions),
		AttendanceSheets:   buildAttendanceSheets(),
	}
}

func GenerateFromCSV(r io.Reader, opts SourceCSVOptions) (Dataset, error) {
	sourceBytes, err := io.ReadAll(r)
	if err != nil {
		return Dataset{}, err
	}
	extracted, err := tasks.ExtractClassesFromCSV(bytes.NewReader(sourceBytes))
	if err != nil {
		return Dataset{}, err
	}
	if extracted == nil || len(extracted.Sessions) == 0 {
		return Dataset{}, errors.New("source CSV did not produce any sessions")
	}

	locations := collectExtractedLocations(extracted.Sessions)
	locationIndex := make(map[string]int, len(locations))
	for index, location := range locations {
		locationIndex[normalizeKey(location)] = index
	}

	classes := make([]Class, 0)
	for _, session := range extracted.Sessions {
		if strings.TrimSpace(session.DayOfWeek) == "" || strings.TrimSpace(session.Location) == "" || strings.TrimSpace(session.SessionStartTime24) == "" || strings.TrimSpace(session.SessionEndTime24) == "" {
			return Dataset{}, fmt.Errorf("source CSV produced an incomplete session: %+v", session)
		}
		sessionClasses := append([]tasks.ExtractedClass(nil), extracted.ClassesBySession[session.SessionKey]...)
		if len(sessionClasses) == 0 {
			return Dataset{}, fmt.Errorf("source CSV produced session %q without classes", session.SessionKey)
		}
		sortExtractedClasses(sessionClasses)
		owner := ownerForParsedSession(session.DayOfWeek, locationIndex[normalizeKey(session.Location)])
		for classIndex, extractedClass := range sessionClasses {
			if strings.TrimSpace(extractedClass.CourseCode) == "" || strings.TrimSpace(extractedClass.ServiceName) == "" || strings.TrimSpace(extractedClass.StartTime24) == "" || strings.TrimSpace(extractedClass.EndTime24) == "" || strings.TrimSpace(extractedClass.Location) == "" {
				return Dataset{}, fmt.Errorf("source CSV produced an incomplete class: %+v", extractedClass)
			}
			next := Class{
				SessionKey:    session.SessionKey,
				EventID:       extractedClass.CourseCode,
				ServiceName:   extractedClass.ServiceName,
				EventName:     extractedClass.ServiceName + " Demo",
				Day:           session.DayOfWeek,
				DateISO:       firstNonEmpty(extractedClass.StartDate, session.StartDate, StartDateISO),
				StartDate:     firstNonEmpty(session.StartDate, extractedClass.StartDate, StartDateISO),
				EndDate:       firstNonEmpty(session.EndDate, extractedClass.EndDate, EndDateISO),
				SessionSeason: firstNonEmpty(session.SessionSeason, extractedClass.SessionSeason, TermSeason),
				SessionYear:   firstPositive(session.SessionYear, extractedClass.SessionYear, TermYear),
				Location:      extractedClass.Location,
				Start24:       extractedClass.StartTime24,
				End24:         extractedClass.EndTime24,
				Capacity:      maxInt(extractedClass.StudentCount+extractedClass.WaitlistCount, extractedClass.StudentCount, len(extractedClass.Roster), 1),
				Booked:        maxInt(extractedClass.StudentCount, countBookedRoster(extractedClass.Roster), 1),
				Min:           1,
				OwnerEmail:    owner,
				Instructor:    demoInstructorForColumn(classIndex),
				RequestOwner:  sourceRequestInstructor(classIndex),
			}
			next.Students = sourceStudents(extractedClass.Roster, opts.Anonymize, len(classes), next.Booked)
			classes = append(classes, next)
		}
	}
	assignSchematicColumns(classes)
	requestClasses := sourceRequestAssignmentClasses(classes)
	sessions := buildSessions(classes)
	selectedDay := selectSingleDay(classes, opts.SingleDay)
	accounts := demoAccounts()

	return Dataset{
		Accounts:           accounts,
		FullTimeEmail:      accounts[0].Email,
		PartTimeEmails:     []string{accounts[1].Email, accounts[2].Email, accounts[3].Email, accounts[4].Email},
		Locations:          locations,
		SelectedSingleDay:  selectedDay,
		Sessions:           sessions,
		Classes:            classes,
		SingleDayClasses:   filterClassesByDay(classes, selectedDay),
		RequestAssignments: requestClasses,
		Notes:              buildNotes(sessions),
		Reports:            buildReports(sessions),
		ReportCards:        buildReportCards(sessions),
		AttendanceSheets:   buildAttendanceSheets(),
	}, nil
}

func demoAccounts() []Account {
	return []Account{
		{Email: "demo.fulltime@decksupervisor.local", Password: DefaultPass, FirstName: "Alex", LastName: "Rivera", Location: "Bayside Community Pool", AccountType: "full_time"},
		{Email: "demo.jamie@decksupervisor.local", Password: DefaultPass, FirstName: "Jamie", LastName: "Chen", Location: "Bayside Community Pool", AccountType: "part_time"},
		{Email: "demo.morgan@decksupervisor.local", Password: DefaultPass, FirstName: "Morgan", LastName: "Patel", Location: "Hillcrest Aquatic Centre", AccountType: "part_time"},
		{Email: "demo.taylor@decksupervisor.local", Password: DefaultPass, FirstName: "Taylor", LastName: "Brooks", Location: "Bayside Community Pool", AccountType: "part_time"},
		{Email: "demo.sam@decksupervisor.local", Password: DefaultPass, FirstName: "Sam", LastName: "Nguyen", Location: "Hillcrest Aquatic Centre", AccountType: "part_time"},
	}
}

type classTemplate struct {
	Level    string
	Start24  string
	End24    string
	Capacity int
	Booked   int
}

func weekdayTemplates() []classTemplate {
	return []classTemplate{
		{"Little Splash 1", "16:00", "16:30", 6, 5},
		{"Splash 1", "16:00", "16:30", 6, 6},
		{"Parent and Tot 1", "16:30", "17:00", 8, 7},
		{"Splash 4", "16:30", "17:15", 8, 6},
		{"Splash 7", "17:15", "18:00", 8, 7},
		{"Teen Adult 1", "17:15", "18:00", 8, 5},
		{"Private Lesson", "18:00", "18:30", 1, 1},
		{"Splash Fitness", "18:30", "19:15", 10, 8},
	}
}

func weekendTemplates() []classTemplate {
	return []classTemplate{
		{"Parent and Tot 1", "08:30", "09:00", 8, 7},
		{"Little Splash 3", "08:30", "09:00", 6, 6},
		{"Splash 1", "09:00", "09:30", 6, 5},
		{"Splash 4", "09:00", "09:45", 8, 7},
		{"Splash 7", "09:45", "10:30", 8, 6},
		{"Private Lesson", "10:30", "11:00", 1, 1},
		{"Teen Adult 1", "11:00", "11:45", 8, 6},
		{"Splash Fitness", "11:45", "12:30", 10, 8},
	}
}

func ownerFor(day string, location string) string {
	weekend := day == "Saturday" || day == "Sunday"
	if location == "Bayside Community Pool" {
		if weekend {
			return "demo.taylor@decksupervisor.local"
		}
		return "demo.jamie@decksupervisor.local"
	}
	if weekend {
		return "demo.sam@decksupervisor.local"
	}
	return "demo.morgan@decksupervisor.local"
}

func ownerForParsedSession(day string, locationIndex int) string {
	weekend := isWeekend(day)
	if locationIndex == 0 {
		if weekend {
			return "demo.taylor@decksupervisor.local"
		}
		return "demo.jamie@decksupervisor.local"
	}
	if locationIndex == 1 {
		if weekend {
			return "demo.sam@decksupervisor.local"
		}
		return "demo.morgan@decksupervisor.local"
	}
	owners := []string{
		"demo.jamie@decksupervisor.local",
		"demo.morgan@decksupervisor.local",
		"demo.taylor@decksupervisor.local",
		"demo.sam@decksupervisor.local",
	}
	return owners[locationIndex%len(owners)]
}

func isWeekend(day string) bool {
	trimmed := strings.ToLower(strings.TrimSpace(day))
	return trimmed == "saturday" || trimmed == "sunday" || trimmed == "sa" || trimmed == "su"
}

func instructorFor(classIndex int, locationIndex int) string {
	names := [][]string{
		{"Jamie Chen", "Taylor Brooks", "Sam Nguyen", "Morgan Patel"},
		{"Morgan Patel", "Sam Nguyen", "Taylor Brooks", "Jamie Chen"},
	}
	return names[locationIndex%len(names)][classIndex%4]
}

func requestInstructorFor(dayIndex int, locationIndex int, classIndex int) string {
	if classIndex > 2 {
		return ""
	}
	return instructorFor(classIndex+dayIndex+1, locationIndex)
}

func sourceRequestInstructor(classIndex int) string {
	if classIndex%3 != 0 {
		return ""
	}
	return demoInstructorForColumn(classIndex + 1)
}

func demoInstructorForColumn(index int) string {
	names := []string{"Jamie Chen", "Morgan Patel", "Taylor Brooks", "Sam Nguyen"}
	return names[index%len(names)]
}

func buildStudents(class Class, dayIndex int, locationIndex int, classIndex int) []Student {
	firstNames := []string{"Avery", "Blake", "Casey", "Drew", "Emery", "Finley", "Harper", "Jordan", "Kai", "Logan", "Maya", "Noah"}
	lastNames := []string{"Stone", "Lee", "Martin", "Singh", "Cooper", "Walker", "Young", "Hall", "Allen", "Wright", "King", "Scott"}
	total := class.Booked
	if (dayIndex+locationIndex+classIndex)%3 == 0 {
		total++
	}
	students := make([]Student, 0, total)
	for i := 0; i < total; i++ {
		seed := dayIndex*1000 + locationIndex*100 + classIndex*10 + i
		first := firstNames[seed%len(firstNames)]
		last := lastNames[(seed/2)%len(lastNames)]
		waitlist := i >= class.Booked
		students = append(students, Student{
			FirstName: first,
			LastName:  last,
			Phone:     fmt.Sprintf("555-01%02d-%04d", locationIndex+10, 1000+seed),
			Email:     fmt.Sprintf("%s.%s.%d@example.test", strings.ToLower(first), strings.ToLower(last), seed),
			Age:       fmt.Sprintf("%d", 3+(seed%9)),
			Waitlist:  waitlist,
		})
	}
	return students
}

func buildSessions(classes []Class) []Session {
	byKey := map[string]*Session{}
	for _, class := range classes {
		key := firstNonEmpty(class.SessionKey, sessionKey(class.Day, class.Location))
		session := byKey[key]
		if session == nil {
			session = &Session{
				Key:           key,
				Day:           class.Day,
				DateISO:       class.DateISO,
				StartDate:     firstNonEmpty(class.StartDate, StartDateISO),
				EndDate:       firstNonEmpty(class.EndDate, EndDateISO),
				SessionSeason: firstNonEmpty(class.SessionSeason, TermSeason),
				SessionYear:   firstPositive(class.SessionYear, TermYear),
				Location:      class.Location,
				Start24:       class.Start24,
				End24:         class.End24,
				OwnerEmail:    class.OwnerEmail,
			}
			byKey[key] = session
		}
		if class.Start24 < session.Start24 {
			session.Start24 = class.Start24
		}
		if class.End24 > session.End24 {
			session.End24 = class.End24
		}
		if class.StartDate != "" && (session.StartDate == "" || class.StartDate < session.StartDate) {
			session.StartDate = class.StartDate
		}
		if class.EndDate != "" && class.EndDate > session.EndDate {
			session.EndDate = class.EndDate
		}
		session.Classes = append(session.Classes, class)
	}

	keys := make([]string, 0, len(byKey))
	for key := range byKey {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	sessions := make([]Session, 0, len(keys))
	for _, key := range keys {
		session := byKey[key]
		instructors := map[string]struct{}{}
		sort.Slice(session.Classes, func(i, j int) bool {
			if session.Classes[i].Start24 != session.Classes[j].Start24 {
				return session.Classes[i].Start24 < session.Classes[j].Start24
			}
			return session.Classes[i].EventID < session.Classes[j].EventID
		})
		for _, class := range session.Classes {
			instructors[class.Instructor] = struct{}{}
			if class.RequestOwner != "" {
				instructors[class.RequestOwner] = struct{}{}
			}
		}
		for instructor := range instructors {
			session.Instructors = append(session.Instructors, instructor)
		}
		sort.Strings(session.Instructors)
		sessions = append(sessions, *session)
	}
	return sessions
}

func sessionKey(day string, location string) string {
	return strings.ToLower(strings.ReplaceAll(day+"-"+location, " ", "-"))
}

func filterClassesByDay(classes []Class, day string) []Class {
	var out []Class
	for _, class := range classes {
		if class.Day == day {
			out = append(out, class)
		}
	}
	return out
}

func requestAssignmentClasses(classes []Class) []Class {
	var out []Class
	for _, class := range classes {
		if class.RequestOwner != "" {
			out = append(out, class)
		}
	}
	return out
}

func sourceRequestAssignmentClasses(classes []Class) []Class {
	byLocation := map[string][]Class{}
	for _, class := range classes {
		byLocation[class.Location] = append(byLocation[class.Location], class)
	}
	var out []Class
	for _, locationClasses := range byLocation {
		sort.Slice(locationClasses, func(i, j int) bool {
			if locationClasses[i].Day != locationClasses[j].Day {
				return daySortKey(locationClasses[i].Day) < daySortKey(locationClasses[j].Day)
			}
			if locationClasses[i].Start24 != locationClasses[j].Start24 {
				return locationClasses[i].Start24 < locationClasses[j].Start24
			}
			return locationClasses[i].EventID < locationClasses[j].EventID
		})
		limit := (len(locationClasses)*4 + 9) / 10
		if limit > 24 {
			limit = 24
		}
		for index, class := range locationClasses {
			if index >= limit {
				break
			}
			if class.RequestOwner == "" {
				class.RequestOwner = demoInstructorForColumn(index)
			}
			out = append(out, class)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].EventID < out[j].EventID
	})
	return out
}

func assignSchematicColumns(classes []Class) {
	sessionIndexes := map[string][]int{}
	for index, class := range classes {
		key := firstNonEmpty(class.SessionKey, sessionKey(class.Day, class.Location))
		sessionIndexes[key] = append(sessionIndexes[key], index)
	}
	for _, indexes := range sessionIndexes {
		sort.Slice(indexes, func(i, j int) bool {
			left := classes[indexes[i]]
			right := classes[indexes[j]]
			if left.Start24 != right.Start24 {
				return left.Start24 < right.Start24
			}
			if left.End24 != right.End24 {
				return left.End24 < right.End24
			}
			return left.EventID < right.EventID
		})
		columnEnds := []string{}
		for _, classIndex := range indexes {
			column := -1
			for candidate, end := range columnEnds {
				if end <= classes[classIndex].Start24 {
					column = candidate
					break
				}
			}
			if column == -1 {
				column = len(columnEnds)
				columnEnds = append(columnEnds, classes[classIndex].End24)
			} else {
				columnEnds[column] = classes[classIndex].End24
			}
			classes[classIndex].ColumnIndex = column
			if classes[classIndex].Instructor == "" {
				classes[classIndex].Instructor = demoInstructorForColumn(column)
			}
		}
	}
}

func SchematicLayout(session Session) ([]string, []string) {
	columns := map[int][]string{}
	instructors := map[int]string{}
	for _, class := range session.Classes {
		columns[class.ColumnIndex] = append(columns[class.ColumnIndex], class.EventID)
		if instructors[class.ColumnIndex] == "" {
			instructors[class.ColumnIndex] = class.Instructor
		}
		if class.RequestOwner != "" && (instructors[class.ColumnIndex] == "" || instructors[class.ColumnIndex] == class.RequestOwner) {
			instructors[class.ColumnIndex] = class.RequestOwner
		}
	}
	var indexes []int
	for index := range columns {
		indexes = append(indexes, index)
	}
	sort.Ints(indexes)
	codes := make([]string, 0, len(indexes))
	names := make([]string, 0, len(indexes))
	for _, index := range indexes {
		sort.Strings(columns[index])
		codes = append(codes, strings.Join(columns[index], ","))
		names = append(names, firstNonEmpty(instructors[index], demoInstructorForColumn(index)))
	}
	return codes, names
}

func WriteCSV(classes []Class) ([]byte, error) {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	if err := writer.Write(CSVHeaders); err != nil {
		return nil, err
	}
	for _, class := range classes {
		for _, student := range class.Students {
			row := map[string]string{
				"ServiceName":     class.ServiceName,
				"MaximumCapacity": fmt.Sprintf("%d", class.Capacity),
				"Booked":          fmt.Sprintf("%d", class.Booked),
				"DayOfTheWeek":    class.Day,
				"EventName":       firstNonEmpty(class.EventName, class.ServiceName+" Demo"),
				"EventTime":       formatTimeRange(class.Start24, class.End24),
				"EventID":         class.EventID,
				"EventSchedule":   "From " + firstNonEmpty(class.StartDate, StartDateISO) + " to " + firstNonEmpty(class.EndDate, EndDateISO),
				"Facility":        class.Location,
				"AttendeeName":    student.LastName + ", " + student.FirstName,
				"AttendeeStatus":  attendeeStatus(student.Waitlist),
				"AttendeePhone":   student.Phone,
				"AttendeeEmail":   student.Email,
				"Age":             student.Age,
				"GroupName":       class.ServiceName,
				"MainFacility":    class.Location,
				"Day":             class.Day,
				"Starts":          firstNonEmpty(class.DateISO, class.StartDate, StartDateISO) + " " + formatClock(class.Start24),
				"Ends":            firstNonEmpty(class.DateISO, class.EndDate, EndDateISO) + " " + formatClock(class.End24),
				"ID":              class.EventID,
				"Duration":        fmt.Sprintf("%d", durationMinutes(class.Start24, class.End24)),
				"Max":             fmt.Sprintf("%d", class.Capacity),
				"Min":             fmt.Sprintf("%d", class.Min),
				"RegTotal":        fmt.Sprintf("%d", class.Booked),
				"PercentFilled":   fmt.Sprintf("%.0f%%", float64(class.Booked)/float64(class.Capacity)*100),
			}
			values := make([]string, 0, len(CSVHeaders))
			for _, header := range CSVHeaders {
				values = append(values, row[header])
			}
			if err := writer.Write(values); err != nil {
				return nil, err
			}
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func sourceStudents(roster []tasks.RosterStudent, anonymize bool, classSeed int, bookedFallback int) []Student {
	if len(roster) == 0 {
		total := maxInt(bookedFallback, 1)
		students := make([]Student, 0, total)
		for index := 0; index < total; index++ {
			students = append(students, anonymizedStudent(classSeed, index, false))
		}
		return students
	}

	students := make([]Student, 0, len(roster))
	for index, row := range roster {
		if anonymize {
			students = append(students, anonymizedStudent(classSeed, index, row.Waitlist))
			continue
		}
		first, last := splitStudentName(row.Name)
		emailLocal := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(first+"."+last), " ", "."))
		if emailLocal == "." || emailLocal == "" {
			emailLocal = fmt.Sprintf("student.%d.%d", classSeed, index)
		}
		students = append(students, Student{
			FirstName: first,
			LastName:  last,
			Phone:     row.Phone,
			Email:     firstNonEmpty(row.Email, emailLocal+"@example.test"),
			Age:       firstNonEmpty(row.Age, "6"),
			Waitlist:  row.Waitlist,
		})
	}
	return students
}

func anonymizedStudent(classSeed int, index int, waitlist bool) Student {
	firstNames := []string{"Avery", "Blake", "Casey", "Drew", "Emery", "Finley", "Harper", "Jordan", "Kai", "Logan", "Maya", "Noah"}
	lastNames := []string{"Stone", "Lee", "Martin", "Singh", "Cooper", "Walker", "Young", "Hall", "Allen", "Wright", "King", "Scott"}
	seed := classSeed*100 + index
	first := firstNames[seed%len(firstNames)]
	last := lastNames[(seed/2)%len(lastNames)]
	return Student{
		FirstName: first,
		LastName:  last,
		Phone:     fmt.Sprintf("555-01%02d-%04d", classSeed%90+10, 1000+seed),
		Email:     fmt.Sprintf("student.%d.%d@example.test", classSeed, index),
		Age:       fmt.Sprintf("%d", 3+(seed%10)),
		Waitlist:  waitlist,
	}
}

func splitStudentName(name string) (string, string) {
	fields := strings.Fields(strings.TrimSpace(name))
	if len(fields) == 0 {
		return "Demo", "Student"
	}
	if len(fields) == 1 {
		return fields[0], "Student"
	}
	return strings.Join(fields[:len(fields)-1], " "), fields[len(fields)-1]
}

func attendeeStatus(waitlist bool) string {
	if waitlist {
		return "Waiting"
	}
	return "Booked"
}

func formatTimeRange(start24 string, end24 string) string {
	return formatClock(start24) + " - " + formatClock(end24)
}

func formatClock(value string) string {
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		return value
	}
	return parsed.Format("3:04 PM")
}

func durationMinutes(start24 string, end24 string) int {
	start, err := time.Parse("15:04", start24)
	if err != nil {
		return 0
	}
	end, err := time.Parse("15:04", end24)
	if err != nil {
		return 0
	}
	return int(end.Sub(start).Minutes())
}

func buildNotes(sessions []Session) []Note {
	selected := firstSessions(sessions, 3)
	notes := []Note(nil)
	types := []string{"general", "recognition", "feedback", "coaching", "todo", "todo"}
	texts := []string{
		"Demo note: confirm extra flutter boards are on deck before the first lesson block.",
		"Demo recognition: instructor handled a nervous swimmer with a calm entry progression.",
		"Demo feedback: parent asked about moving from Splash 1 to Splash 2 next term.",
		"Demo coaching: review tighter transitions between 30-minute lessons.",
		"Demo todo: follow up with the waitlisted family for the 4:30 class.",
		"Demo todo: print spare attendance sheets for coverage staff.",
	}
	for index, session := range selected {
		for noteIndex, noteType := range types {
			notes = append(notes, Note{
				SessionKey:   session.Key,
				Type:         noteType,
				Text:         texts[noteIndex],
				EmployeeName: session.Instructors[noteIndex%len(session.Instructors)],
				Done:         noteType == "todo" && noteIndex%2 == 1,
			})
		}
		_ = index
	}
	return notes
}

func buildReports(sessions []Session) []Report {
	var reports []Report
	for _, session := range firstSessions(sessions, 2) {
		instructor := "Jamie Chen"
		if len(session.Instructors) > 0 {
			instructor = session.Instructors[0]
		}
		reports = append(reports, Report{
			SessionKey: session.Key,
			Title:      "Demo operations report - " + session.Day + " " + session.Location,
			Data: map[string]any{
				"staff": map[string]any{
					"performance":      []map[string]string{{"instructor": instructor, "text": "Strong class control and consistent parent communication."}},
					"strengthWeakness": []map[string]string{{"instructor": instructor, "text": "strengths:Clear demonstrations|Positive corrections|weaknesses:Needs faster equipment reset"}},
					"successionPlans":  []map[string]string{{"instructor": instructor, "text": "Ready to shadow private lessons next week."}},
					"instructorCovers": []map[string]string{{"instructor": instructor, "coveredBy": "Sam Nguyen", "details": "Covered the final 30-minute block during guard rotation."}},
				},
				"lessonStructure": map[string]any{
					"challengingTimes": []map[string]string{{"time": formatTimeRange(session.Start24, session.End24), "lessons": "Overlapping preschool and Splash classes", "description": "High parent traffic at transition; use one check-in point."}},
					"newClassLayouts":  []map[string]string{{"level": "Splash 4", "description": "Split deep-end skills into a second lane for pacing."}},
				},
				"safetyFacility": map[string]any{
					"safetyConcerns":       []map[string]string{{"concernType": "equipment", "description": "One kickboard bin should be moved away from the wet walkway."}},
					"maintenanceIssues":    []map[string]string{{"item": "Lane rope", "description": "Tension needs adjustment before the next block."}},
					"poolDeckWorksWell":    []map[string]string{{"item": "Entry table", "description": "Single table kept parents out of the lesson lanes."}},
					"poolDeckImprovements": []map[string]string{{"item": "Signage", "description": "Add level signs near the shallow end."}},
				},
				"parentCustomerFeedback": []map[string]string{{"feedbackType": "praise", "description": "Parent complimented the clear progress update after class."}},
				"projectsInitiatives": map[string]any{
					"adminWork":   []map[string]string{{"work": "Report cards", "description": "Demo totals synced by instructor."}},
					"initiatives": []map[string]string{{"title": "Deck traffic pilot", "brief": "Trial one-way parent flow during weekend blocks."}},
				},
			},
		})
	}
	return reports
}

func buildReportCards(sessions []Session) []ReportCardTotal {
	totals := map[string]*ReportCardTotal{}
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
			key := strings.Join([]string{label, session.Day, instructor, session.OwnerEmail}, "\x00")
			card := totals[key]
			if card == nil {
				card = &ReportCardTotal{
					SessionKey: session.Key,
					Session:    label,
					Day:        session.Day,
					Instructor: instructor,
					CreatedBy:  session.OwnerEmail,
				}
				totals[key] = card
			}
			card.Total += booked
		}
	}

	cards := make([]ReportCardTotal, 0, len(totals))
	for _, card := range totals {
		cards = append(cards, *card)
	}
	sort.Slice(cards, func(i, j int) bool {
		if cards[i].Session != cards[j].Session {
			return cards[i].Session < cards[j].Session
		}
		leftDay := daySortKey(cards[i].Day)
		rightDay := daySortKey(cards[j].Day)
		if leftDay != rightDay {
			return leftDay < rightDay
		}
		if cards[i].Instructor != cards[j].Instructor {
			return cards[i].Instructor < cards[j].Instructor
		}
		return cards[i].CreatedBy < cards[j].CreatedBy
	})
	return cards
}

func termLabel(season string, year int) string {
	season = firstNonEmpty(season, TermSeason)
	year = firstPositive(year, TermYear)
	season = strings.ToLower(season)
	season = strings.ToUpper(season[:1]) + season[1:]
	return fmt.Sprintf("%s %d", season, year)
}

func buildAttendanceSheets() []AttendanceSheet {
	return []AttendanceSheet{
		{
			Name:               "Demo Core Swim Attendance",
			BaseTemplate:       "Splash1",
			DefaultForTemplate: "Splash1",
			SheetData: sheetData("Demo Core Swim Attendance", "Core Skills", "Splash1", []map[string]any{
				{"id": "front-float", "label": "Front Float", "details": []string{"Relaxed body position", "Face in water"}},
				{"id": "back-glide", "label": "Back Glide", "details": []string{"Eyes up", "Streamline"}},
				{"id": "side-kick", "label": "Side Kick", "details": []string{"Body line", "Consistent kick"}},
			}),
		},
		{
			Name:               "Demo Preschool Progress Sheet",
			BaseTemplate:       "LittleSplash1",
			DefaultForTemplate: "LittleSplash1",
			SheetData: sheetData("Demo Preschool Progress Sheet", "Preschool Skills", "LittleSplash1", []map[string]any{
				{"id": "water-entry", "label": "Safe Entry", "details": []string{"Waits for cue", "Uses wall"}},
				{"id": "bubbles", "label": "Bubbles", "details": []string{"Mouth bubbles", "Nose bubbles"}},
				{"id": "assisted-float", "label": "Assisted Float", "details": []string{"Front", "Back"}},
			}),
		},
	}
}

func sheetData(title string, header string, baseTemplate string, skills []map[string]any) map[string]any {
	return map[string]any{
		"baseTemplate":       baseTemplate,
		"title":              title,
		"headerLabel":        header,
		"sheetWidthPx":       1056,
		"rotateHeightPx":     180,
		"rotateTranslatePx":  56,
		"rotateTopPx":        144,
		"skillColumnWidthPt": 42,
		"nameColumnWidthPt":  140,
		"showPreviousLevel":  true,
		"showResult":         true,
		"showRegisterIn":     true,
		"skills":             skills,
	}
}

func firstSessions(sessions []Session, count int) []Session {
	if len(sessions) < count {
		return sessions
	}
	return sessions[:count]
}

func collectExtractedLocations(sessions []tasks.ExtractedSession) []string {
	seen := map[string]struct{}{}
	var locations []string
	for _, session := range sessions {
		location := strings.TrimSpace(session.Location)
		if location == "" {
			continue
		}
		key := normalizeKey(location)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		locations = append(locations, location)
	}
	sort.Strings(locations)
	if len(locations) == 0 {
		return append([]string(nil), Locations...)
	}
	return locations
}

func sortExtractedClasses(classes []tasks.ExtractedClass) {
	sort.Slice(classes, func(i, j int) bool {
		if classes[i].StartTime24 != classes[j].StartTime24 {
			return classes[i].StartTime24 < classes[j].StartTime24
		}
		if classes[i].EndTime24 != classes[j].EndTime24 {
			return classes[i].EndTime24 < classes[j].EndTime24
		}
		return classes[i].CourseCode < classes[j].CourseCode
	})
}

func selectSingleDay(classes []Class, requested string) string {
	available := map[string]string{}
	for _, class := range classes {
		if strings.TrimSpace(class.Day) == "" {
			continue
		}
		available[normalizeKey(class.Day)] = class.Day
	}
	if requested = strings.TrimSpace(requested); requested != "" {
		if day, ok := available[normalizeKey(requested)]; ok {
			return day
		}
		return requested
	}
	if day, ok := available[normalizeKey(SingleDay)]; ok {
		return day
	}
	var days []string
	for _, day := range available {
		days = append(days, day)
	}
	sort.Slice(days, func(i, j int) bool {
		left := daySortKey(days[i])
		right := daySortKey(days[j])
		if left != right {
			return left < right
		}
		return days[i] < days[j]
	})
	if len(days) == 0 {
		return SingleDay
	}
	return days[0]
}

func countBookedRoster(roster []tasks.RosterStudent) int {
	count := 0
	for _, student := range roster {
		if !student.Waitlist {
			count++
		}
	}
	return count
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func firstPositive(values ...int) int {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func maxInt(values ...int) int {
	max := 0
	for _, value := range values {
		if value > max {
			max = value
		}
	}
	return max
}

func normalizeKey(value string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(value)), " "))
}

func daySortKey(day string) int {
	switch normalizeKey(day) {
	case "monday", "mo":
		return 1
	case "tuesday", "tu":
		return 2
	case "wednesday", "we":
		return 3
	case "thursday", "th":
		return 4
	case "friday", "fr":
		return 5
	case "saturday", "sa":
		return 6
	case "sunday", "su":
		return 7
	default:
		return 99
	}
}

func AccountByEmail(accounts []Account) map[string]Account {
	out := make(map[string]Account, len(accounts))
	for _, account := range accounts {
		out[account.Email] = account
	}
	return out
}
