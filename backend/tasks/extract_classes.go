package tasks

import (
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-gota/gota/dataframe"
)

type ClassRoster struct {
	SessionKey    string `json:"sessionKey"`
	Code          string `json:"courseCode"`
	ServiceName   string `json:"serviceName"`
	Location      string `json:"location"`
	Time          string `json:"time"`
	Instructor    string `json:"instructor"`
	StudentCount  int    `json:"studentCount"`
	WaitlistCount int    `json:"waitlistCount"`
	Students      []RosterStudent
}

type RosterStudent struct {
	Name       string `json:"name"`
	Phone      string `json:"phone"`
	Age        string `json:"age"`
	Instructor string `json:"instructor"`
	Level      string `json:"level"`
	Waitlist   bool   `json:"waitlist"`
}

type ExtractOptions struct {
	FallbackDay   string
	InstructorMap map[string]string
}

type ExtractedClass struct {
	SessionKey      string          `json:"sessionKey"`
	DayOfWeek       string          `json:"dayOfWeek"`
	SessionSeason   string          `json:"sessionSeason"`
	SessionYear     int             `json:"sessionYear"`
	StartDate       string          `json:"startDate"`
	EndDate         string          `json:"endDate"`
	CourseCode      string          `json:"courseCode"`
	ServiceName     string          `json:"serviceName"`
	Location        string          `json:"location"`
	StartTime24     string          `json:"startTime24"`
	EndTime24       string          `json:"endTime24"`
	DurationMinutes int             `json:"durationMinutes"`
	StudentCount    int             `json:"studentCount"`
	WaitlistCount   int             `json:"waitlistCount"`
	Instructor      string          `json:"instructor"`
	Roster          []RosterStudent `json:"roster"`
}

type ExtractedSession struct {
	SessionKey         string   `json:"sessionKey"`
	DayOfWeek          string   `json:"dayOfWeek"`
	SessionSeason      string   `json:"sessionSeason"`
	SessionYear        int      `json:"sessionYear"`
	StartDate          string   `json:"startDate"`
	EndDate            string   `json:"endDate"`
	Location           string   `json:"location"`
	SessionStartTime24 string   `json:"sessionStartTime24"`
	SessionEndTime24   string   `json:"sessionEndTime24"`
	ClassCount         int      `json:"classCount"`
	StudentCount       int      `json:"studentCount"`
	WaitlistCount      int      `json:"waitlistCount"`
	CourseCodes        []string `json:"courseCodes"`
}

type ExtractedCSVResult struct {
	Sessions         []ExtractedSession          `json:"sessions"`
	ClassesBySession map[string][]ExtractedClass `json:"classesBySession"`
}

type extractedClassAccumulator struct {
	Class                 ExtractedClass
	BookedCountFromRoster int
	WaitlistAttendeeRows  int
}

func ExtractClassesFromCSV(csvReader io.Reader, opts ...ExtractOptions) (*ExtractedCSVResult, error) {
	rows, err := readCSVDataFrame(csvReader)
	if err != nil {
		return nil, err
	}
	return extractClassesDataFrame(rows, resolveExtractOptions(opts...))
}

func ExtractClassesRows(rows []csvRow, opts ...ExtractOptions) (*ExtractedCSVResult, error) {
	df := dataframe.LoadMaps(csvRowsToMaps(rows))
	return extractClassesDataFrame(df, resolveExtractOptions(opts...))
}

func extractClassesDataFrame(df dataframe.DataFrame, opts ExtractOptions) (*ExtractedCSVResult, error) {
	classMap := map[string]*extractedClassAccumulator{}

	for i := 0; i < df.Nrow(); i++ {
		row := df.Subset([]int{i, i})
		courseCode := NormalizeEventID(strings.TrimSpace(row.Col("EventID").Elem(0).String()))
		serviceName := strings.TrimSpace(row.Col("ServiceName").Elem(0).String())
		location := strings.TrimSpace(row.Col("Facility").Elem(0).String())
		dayValue := row.Col("DayOfTheWeek").Elem(0).String()
		eventSchedule := strings.TrimSpace(row.Col("EventSchedule").Elem(0).String())
		timeRange := strings.TrimSpace(row.Col("EventTime").Elem(0).String())
		if courseCode == "" {
			continue
		}
		if dayValue == "" {
			dayValue = opts.FallbackDay
		}
		if dayValue == "" {
			continue
		}

		fmt.Printf("Processing row %d: courseCode=%s, dayValue=%s, timeRange=%s\n", i, courseCode, dayValue, timeRange)

		start, end := splitTimeRange(timeRange)

		startTime24, startDate := extractTimeAndDate(start)
		endTime24, endDate := extractTimeAndDate(end)
		if startTime24 == "" || endTime24 == "" {
			continue
		}

		durationMinutes := getDurationMinutes(startTime24, endTime24)

		scheduleStartDate, scheduleEndDate := extractScheduleDateRange(eventSchedule)
		if startDate.IsZero() && !scheduleStartDate.IsZero() {
			startDate = scheduleStartDate
		}
		if endDate.IsZero() && !scheduleEndDate.IsZero() {
			endDate = scheduleEndDate
		}

		sessionSeason, sessionYear := getSeasonAndYear(eventSchedule, startDate, endDate)
		dayValue = normalizeExtractedSessionDay(dayValue, sessionSeason, sessionYear, scheduleStartDate, startDate)
		sessionBucketKey := buildExtractedSessionBucketKey(dayValue, sessionSeason, sessionYear, location)
		bookedCountFromRoster := parsePositiveInt(strings.TrimSpace(row.Col("Booked").Elem(0).String()))

		statusValue := strings.TrimSpace(row.Col("AttendeeStatus").Elem(0).String())
		isWaitlist := isWaitingStatus(statusValue)

		phone := strings.TrimSpace(row.Col("AttendeePhone").Elem(0).String())
		name := normalizeExtractedStudentName(strings.TrimSpace(row.Col("AttendeeName").Elem(0).String()))
		age := strings.TrimSpace(row.Col("Age").Elem(0).String())
		hasAttendee := name != ""
		instructor := resolveExtractedInstructor(courseCode, opts.InstructorMap)

		key := strings.Join([]string{
			sessionBucketKey,
			courseCode,
			startTime24,
			endTime24,
		}, "|")

		existing, exists := classMap[key]
		if !exists {
			existing = &extractedClassAccumulator{
				Class: ExtractedClass{
					SessionKey:      sessionBucketKey,
					DayOfWeek:       dayValue,
					SessionSeason:   sessionSeason,
					SessionYear:     sessionYear,
					StartDate:       formatDate(startDate),
					EndDate:         formatDate(endDate),
					CourseCode:      courseCode,
					ServiceName:     serviceName,
					Location:        location,
					StartTime24:     startTime24,
					EndTime24:       endTime24,
					DurationMinutes: durationMinutes,
					StudentCount:    0,
					Instructor:      instructor,
					Roster:          []RosterStudent{},
				},
			}
			classMap[key] = existing
		}

		if existing.Class.Instructor == "" && instructor != "" {
			existing.Class.Instructor = instructor
		}

		if bookedCountFromRoster > existing.BookedCountFromRoster {
			existing.BookedCountFromRoster = bookedCountFromRoster
		}
		if hasAttendee {
			existing.Class.Roster = append(existing.Class.Roster, RosterStudent{
				Name:       name,
				Phone:      phone,
				Age:        age,
				Instructor: instructor,
				Level:      serviceName,
				Waitlist:   isWaitlist,
			})
			if isWaitlist {
				existing.WaitlistAttendeeRows += 1
			}
		}
	}

	classesByBucket := map[string][]ExtractedClass{}
	for _, class := range classMap {
		extractedClass := class.Class
		extractedClass.StudentCount = class.BookedCountFromRoster
		if extractedClass.StudentCount == 0 {
			extractedClass.StudentCount = len(extractedClass.Roster)
		}
		extractedClass.WaitlistCount = class.WaitlistAttendeeRows
		classesByBucket[extractedClass.SessionKey] = append(classesByBucket[extractedClass.SessionKey], extractedClass)
	}

	classesBySession := map[string][]ExtractedClass{}
	sessions := make([]ExtractedSession, 0, len(classesByBucket))
	for _, bucketClasses := range classesByBucket {
		sort.Slice(bucketClasses, func(i, j int) bool {
			left := bucketClasses[i]
			right := bucketClasses[j]
			if left.StartTime24 != right.StartTime24 {
				return left.StartTime24 < right.StartTime24
			}
			if left.EndTime24 != right.EndTime24 {
				return left.EndTime24 < right.EndTime24
			}
			return left.CourseCode < right.CourseCode
		})

		for _, segment := range splitExtractedSessionClasses(bucketClasses) {
			sessionKey := BuildExtractedSessionKey(
				segment.DayOfWeek,
				segment.SessionSeason,
				segment.SessionYear,
				segment.Location,
				segment.SessionStartTime24,
				segment.SessionEndTime24,
			)

			assigned := make([]ExtractedClass, 0, len(segment.Classes))
			for _, class := range segment.Classes {
				class.SessionKey = sessionKey
				assigned = append(assigned, class)
			}
			classesBySession[sessionKey] = assigned
			sessions = append(sessions, ExtractedSession{
				SessionKey:         sessionKey,
				DayOfWeek:          segment.DayOfWeek,
				SessionSeason:      segment.SessionSeason,
				SessionYear:        segment.SessionYear,
				StartDate:          segment.StartDate,
				EndDate:            segment.EndDate,
				Location:           segment.Location,
				SessionStartTime24: segment.SessionStartTime24,
				SessionEndTime24:   segment.SessionEndTime24,
				ClassCount:         segment.ClassCount,
				StudentCount:       segment.StudentCount,
				WaitlistCount:      segment.WaitlistCount,
				CourseCodes:        segment.CourseCodes,
			})
		}
	}

	sort.Slice(sessions, func(i, j int) bool {
		dayI := daySortKey(sessions[i].DayOfWeek)
		dayJ := daySortKey(sessions[j].DayOfWeek)
		if dayI != dayJ {
			return dayI < dayJ
		}
		if sessions[i].SessionYear != sessions[j].SessionYear {
			return sessions[j].SessionYear < sessions[i].SessionYear
		}
		seasonI := strings.ToLower(strings.TrimSpace(sessions[i].SessionSeason))
		seasonJ := strings.ToLower(strings.TrimSpace(sessions[j].SessionSeason))
		if seasonI != seasonJ {
			return seasonI < seasonJ
		}
		locationI := strings.ToLower(strings.TrimSpace(sessions[i].Location))
		locationJ := strings.ToLower(strings.TrimSpace(sessions[j].Location))
		if locationI != locationJ {
			return locationI < locationJ
		}
		if sessions[i].SessionStartTime24 != sessions[j].SessionStartTime24 {
			return sessions[i].SessionStartTime24 < sessions[j].SessionStartTime24
		}
		if sessions[i].SessionEndTime24 != sessions[j].SessionEndTime24 {
			return sessions[i].SessionEndTime24 < sessions[j].SessionEndTime24
		}
		return sessions[i].SessionKey < sessions[j].SessionKey
	})

	return &ExtractedCSVResult{
		Sessions:         sessions,
		ClassesBySession: classesBySession,
	}, nil
}

func resolveExtractOptions(opts ...ExtractOptions) ExtractOptions {
	if len(opts) == 0 {
		return ExtractOptions{}
	}
	return opts[0]
}

func csvRowsToMaps(rows []csvRow) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		next := make(map[string]interface{}, len(row))
		for key, value := range row {
			next[key] = value
		}
		out = append(out, next)
	}
	return out
}

func normalizeExtractedStudentName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	if strings.Contains(name, ",") {
		parts := strings.SplitN(name, ",", 2)
		return strings.TrimSpace(parts[1]) + " " + strings.TrimSpace(parts[0])
	}
	return name
}

func NormalizeEventID(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	for _, r := range trimmed {
		if r < '0' || r > '9' {
			return trimmed
		}
	}
	normalized := strings.TrimLeft(trimmed, "0")
	if normalized == "" {
		return "0"
	}
	return normalized
}

func resolveExtractedInstructor(courseCode string, instructorMap map[string]string) string {
	if len(instructorMap) == 0 {
		return ""
	}
	return strings.TrimSpace(instructorMap[NormalizeEventID(courseCode)])
}

func BuildExtractedSessionKey(dayOfWeek, sessionSeason string, sessionYear int, location, sessionStartTime24, sessionEndTime24 string) string {
	return strings.Join([]string{
		buildExtractedSessionBucketKey(dayOfWeek, sessionSeason, sessionYear, location),
		strings.TrimSpace(sessionStartTime24),
		strings.TrimSpace(sessionEndTime24),
	}, "|")
}

type extractedSessionSegment struct {
	DayOfWeek          string
	SessionSeason      string
	SessionYear        int
	StartDate          string
	EndDate            string
	Location           string
	SessionStartTime24 string
	SessionEndTime24   string
	ClassCount         int
	StudentCount       int
	WaitlistCount      int
	CourseCodes        []string
	Classes            []ExtractedClass
}

func buildExtractedSessionBucketKey(dayOfWeek, sessionSeason string, sessionYear int, location string) string {
	return strings.Join([]string{
		strings.TrimSpace(dayOfWeek),
		strings.ToLower(strings.TrimSpace(sessionSeason)),
		strconv.Itoa(sessionYear),
		strings.ToLower(strings.TrimSpace(location)),
	}, "|")
}

func splitExtractedSessionClasses(classes []ExtractedClass) []extractedSessionSegment {
	if len(classes) == 0 {
		return nil
	}

	segments := make([]extractedSessionSegment, 0, 1)
	current := initExtractedSessionSegment(classes[0])
	currentEndMinutes := time24ToMinutes(current.SessionEndTime24)

	for _, class := range classes[1:] {
		startMinutes := time24ToMinutes(class.StartTime24)
		if startMinutes-currentEndMinutes > 30 {
			segments = append(segments, finalizeExtractedSessionSegment(current))
			current = initExtractedSessionSegment(class)
			currentEndMinutes = time24ToMinutes(current.SessionEndTime24)
			continue
		}

		appendClassToExtractedSessionSegment(&current, class)
		if endMinutes := time24ToMinutes(class.EndTime24); endMinutes > currentEndMinutes {
			currentEndMinutes = endMinutes
			current.SessionEndTime24 = class.EndTime24
		}
	}

	segments = append(segments, finalizeExtractedSessionSegment(current))
	return segments
}

func initExtractedSessionSegment(class ExtractedClass) extractedSessionSegment {
	segment := extractedSessionSegment{
		DayOfWeek:          class.DayOfWeek,
		SessionSeason:      class.SessionSeason,
		SessionYear:        class.SessionYear,
		StartDate:          class.StartDate,
		EndDate:            class.EndDate,
		Location:           class.Location,
		SessionStartTime24: class.StartTime24,
		SessionEndTime24:   class.EndTime24,
	}
	appendClassToExtractedSessionSegment(&segment, class)
	return segment
}

func appendClassToExtractedSessionSegment(segment *extractedSessionSegment, class ExtractedClass) {
	segment.Classes = append(segment.Classes, class)
	segment.ClassCount++
	segment.StudentCount += class.StudentCount
	segment.WaitlistCount += class.WaitlistCount
	if segment.StartDate == "" && class.StartDate != "" {
		segment.StartDate = class.StartDate
	}
	if segment.EndDate == "" && class.EndDate != "" {
		segment.EndDate = class.EndDate
	}
	if segment.Location == "" && class.Location != "" {
		segment.Location = class.Location
	}
}

func finalizeExtractedSessionSegment(segment extractedSessionSegment) extractedSessionSegment {
	courseCodeSet := make(map[string]struct{}, len(segment.Classes))
	for _, class := range segment.Classes {
		if code := strings.TrimSpace(class.CourseCode); code != "" {
			courseCodeSet[code] = struct{}{}
		}
	}

	segment.CourseCodes = make([]string, 0, len(courseCodeSet))
	for code := range courseCodeSet {
		segment.CourseCodes = append(segment.CourseCodes, code)
	}
	sort.Strings(segment.CourseCodes)
	return segment
}

func time24ToMinutes(value string) int {
	parsed, err := time.Parse("15:04", strings.TrimSpace(value))
	if err != nil {
		return 0
	}
	return parsed.Hour()*60 + parsed.Minute()
}

func splitTimeRange(value string) (string, string) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", ""
	}

	for _, delimiter := range []string{" - ", " to ", "–", "—"} {
		if strings.Contains(trimmed, delimiter) {
			parts := strings.SplitN(trimmed, delimiter, 2)
			return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
		}
	}

	if strings.Count(trimmed, "-") == 1 {
		parts := strings.SplitN(trimmed, "-", 2)
		return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
	}

	return trimmed, ""
}

func extractTimeAndDate(value string) (string, time.Time) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", time.Time{}
	}

	dateTimeLayouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02 03:04:05 PM",
		"2006-01-02 03:04 PM",
		"2006-01-02 3:04 PM",
		"2006-01-02 03:04PM",
		"2006-01-02 3:04PM",
		"01/02/2006 03:04 PM",
		"01/02/2006 3:04 PM",
		"1/2/2006 3:04 PM",
		"1/2/2006 03:04 PM",
		"1/2/2006 15:04",
	}

	for _, layout := range dateTimeLayouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return parsed.Format("15:04"), parsed
		}
	}

	timeOnlyLayouts := []string{
		"15:04:05",
		"15:04",
		"03:04 PM",
		"3:04 PM",
		"03:04PM",
		"3:04PM",
		"3 PM",
		"3PM",
	}

	for _, layout := range timeOnlyLayouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return parsed.Format("15:04"), time.Time{}
		}
	}

	if parts := strings.Fields(trimmed); len(parts) >= 2 {
		for i := 0; i < len(parts)-1; i++ {
			candidate := strings.TrimSpace(parts[i] + " " + parts[i+1])
			for _, layout := range []string{"3:04 PM", "03:04 PM", "3:04PM", "03:04PM"} {
				if parsed, err := time.Parse(layout, candidate); err == nil {
					return parsed.Format("15:04"), time.Time{}
				}
			}
		}
	}

	return "", time.Time{}
}

func getDurationMinutes(startTime24, endTime24 string) int {
	if startTime24 == "" || endTime24 == "" {
		return 0
	}
	start, err := time.Parse("15:04", startTime24)
	if err != nil {
		return 0
	}
	end, err := time.Parse("15:04", endTime24)
	if err != nil {
		return 0
	}
	duration := int(end.Sub(start).Minutes())
	if duration <= 0 {
		duration += 24 * 60
	}
	return duration
}

func getSeasonAndYear(eventSchedule string, startDate, endDate time.Time) (string, int) {
	if scheduleDate := extractScheduleStartDate(eventSchedule); !scheduleDate.IsZero() {
		return seasonAndYearFromDate(scheduleDate)
	}

	var source time.Time
	switch {
	case !startDate.IsZero():
		source = startDate
	case !endDate.IsZero():
		source = endDate
	default:
		return "", 0
	}

	return seasonAndYearFromDate(source)
}

func seasonAndYearFromDate(source time.Time) (string, int) {
	month := source.Month()
	switch {
	case month >= time.January && month < time.March:
		return "Winter", source.Year()
	case month >= time.March && month < time.June:
		return "Spring", source.Year()
	case month >= time.June && month < time.September:
		return "Summer", source.Year()
	default:
		return "Fall", source.Year()
	}
}

func extractScheduleStartDate(value string) time.Time {
	startDate, _ := extractScheduleDateRange(value)
	return startDate
}

func extractScheduleDateRange(value string) (time.Time, time.Time) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Time{}, time.Time{}
	}

	normalized := strings.TrimSpace(strings.TrimPrefix(trimmed, "From "))
	parts := strings.SplitN(normalized, " to ", 2)
	if len(parts) == 0 {
		return time.Time{}, time.Time{}
	}

	startRaw := strings.TrimSpace(parts[0])
	endRaw := ""
	if len(parts) > 1 {
		endRaw = strings.TrimSpace(parts[1])
	}

	var startDate time.Time
	var endDate time.Time
	for _, layout := range []string{
		"2006-01-02",
		"01/02/2006",
		"1/2/2006",
	} {
		if startRaw != "" {
			if parsed, err := time.Parse(layout, startRaw); err == nil {
				startDate = parsed
			}
		}
		if endRaw != "" {
			if parsed, err := time.Parse(layout, endRaw); err == nil {
				endDate = parsed
			}
		}
		if !startDate.IsZero() || !endDate.IsZero() {
			break
		}
	}

	return startDate, endDate
}

func formatDate(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("2006-01-02")
}

func parsePositiveInt(value string) int {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil || parsed <= 0 {
		return 0
	}
	return parsed
}

func normalizeExtractedSessionDay(dayValue, sessionSeason string, sessionYear int, scheduleStartDate, startDate time.Time) string {
	normalizedDay := strings.TrimSpace(dayValue)
	if normalizedDay != "Mo,Tu,We,Th,Fr" {
		return normalizedDay
	}
	if strings.ToLower(strings.TrimSpace(sessionSeason)) != "summer" || sessionYear <= 0 {
		return normalizedDay
	}

	sourceDate := scheduleStartDate
	if sourceDate.IsZero() {
		sourceDate = startDate
	}
	if sourceDate.IsZero() {
		return normalizedDay
	}

	miniSession := summerMiniSessionLabel(sourceDate)
	if miniSession == "" {
		return normalizedDay
	}
	return miniSession
}

func summerMiniSessionLabel(startDate time.Time) string {
	date := dateOnly(startDate)
	if date.IsZero() {
		return ""
	}

	anchor := mondayOfWeekContainingJulyFirst(date.Year())
	daysFromAnchor := int(date.Sub(anchor).Hours() / 24)
	if daysFromAnchor < 0 || daysFromAnchor >= 56 {
		return ""
	}

	index := daysFromAnchor/14 + 1
	if index < 1 || index > 4 {
		return ""
	}
	return fmt.Sprintf("Mini Session %d", index)
}

func mondayOfWeekContainingJulyFirst(year int) time.Time {
	julyFirst := time.Date(year, time.July, 1, 0, 0, 0, 0, time.UTC)
	offset := (int(julyFirst.Weekday()) + 6) % 7
	return julyFirst.AddDate(0, 0, -offset)
}

func dateOnly(value time.Time) time.Time {
	if value.IsZero() {
		return time.Time{}
	}
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}

func daySortKey(day string) int {
	switch strings.TrimSpace(day) {
	case "Mo":
		return 1
	case "Tu":
		return 2
	case "We":
		return 3
	case "Th":
		return 4
	case "Fr":
		return 5
	case "Sa":
		return 6
	case "Su":
		return 7
	case "Mo,Tu,We,Th,Fr":
		return 8
	case "Mini Session 1":
		return 9
	case "Mini Session 2":
		return 10
	case "Mini Session 3":
		return 11
	case "Mini Session 4":
		return 12
	default:
		return 99
	}
}

func isWaitingStatus(value string) bool {
	normalized := strings.TrimSpace(strings.ToLower(value))
	return normalized == "waiting" || normalized == "waitlist"
}
