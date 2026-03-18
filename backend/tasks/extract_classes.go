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

type ExtractedClass struct {
	SessionKey      string `json:"sessionKey"`
	DayOfWeek       string `json:"dayOfWeek"`
	SessionSeason   string `json:"sessionSeason"`
	SessionYear     int    `json:"sessionYear"`
	CourseCode      string `json:"courseCode"`
	ServiceName     string `json:"serviceName"`
	Location        string `json:"location"`
	StartTime24     string `json:"startTime24"`
	EndTime24       string `json:"endTime24"`
	DurationMinutes int    `json:"durationMinutes"`
	StudentCount    int    `json:"studentCount"`
}

type ExtractedSession struct {
	SessionKey    string   `json:"sessionKey"`
	DayOfWeek     string   `json:"dayOfWeek"`
	SessionSeason string   `json:"sessionSeason"`
	SessionYear   int      `json:"sessionYear"`
	Location      string   `json:"location"`
	ClassCount    int      `json:"classCount"`
	StudentCount  int      `json:"studentCount"`
	CourseCodes   []string `json:"courseCodes"`
}

type ExtractedCSVResult struct {
	Sessions         []ExtractedSession          `json:"sessions"`
	ClassesBySession map[string][]ExtractedClass `json:"classesBySession"`
}

func ExtractClassesFromCSV(csvReader io.Reader) (*ExtractedCSVResult, error) {
	df := dataframe.ReadCSV(csvReader)
	if df.Err != nil {
		return nil, fmt.Errorf("failed to read csv: %w", df.Err)
	}
	return ExtractClasses(df.Records())
}

func ExtractClasses(records [][]string) (*ExtractedCSVResult, error) {
	if len(records) < 2 {
		return nil, fmt.Errorf("no rows to process")
	}

	headers := records[0]
	headerIndex := map[string]int{}
	for i, header := range headers {
		normalized := normalizeHeader(header)
		if normalized == "" {
			continue
		}
		headerIndex[normalized] = i
	}

	getByName := func(row []string, names []string) string {
		for _, name := range names {
			if idx, ok := headerIndex[normalizeHeader(name)]; ok && idx < len(row) {
				return strings.TrimSpace(row[idx])
			}
		}
		return ""
	}

	classMap := map[string]*ExtractedClass{}

	for i := 1; i < len(records); i++ {
		row := records[i]
		if len(row) == 0 {
			continue
		}

		courseCode := NormalizeEventID(getByName(row, []string{"EventID", "Event Id", "ClassCode", "Code", "ID"}))
		if courseCode == "" {
			continue
		}

		serviceName := getByName(row, []string{"ServiceName", "Service", "Service Name", "GroupName", "Level"})
		location := getByName(row, []string{"Location", "Facility", "MainFacility"})

		dayValue := normalizeDay(getByName(row, []string{"DayOfTheWeek", "Day Of The Week"}))
		if dayValue == "" {
			continue
		}

		startRaw := getByName(row, []string{"Starts", "Start", "StartTime"})
		endRaw := getByName(row, []string{"Ends", "End", "EndTime"})
		eventSchedule := getByName(row, []string{"EventSchedule", "Schedule"})
		timeRange := getByName(row, []string{"EventTime", "Time"})
		if startRaw == "" || endRaw == "" {
			left, right := splitTimeRange(timeRange)
			if startRaw == "" {
				startRaw = left
			}
			if endRaw == "" {
				endRaw = right
			}
		}

		startTime24, startDate := extractTimeAndDate(startRaw)
		endTime24, endDate := extractTimeAndDate(endRaw)
		if startTime24 == "" || endTime24 == "" {
			continue
		}

		durationMinutes := getDurationMinutes(startTime24, endTime24)
		if durationMinutes <= 0 {
			durationMinutes = parsePositiveInt(getByName(row, []string{"Duration"}))
		}
		if durationMinutes <= 0 {
			continue
		}

		sessionSeason, sessionYear := getSeasonAndYear(eventSchedule, startDate, endDate)
		sessionKey := BuildExtractedSessionKey(dayValue, sessionSeason, sessionYear, location)

		studentCountFromRoster := parsePositiveInt(getByName(row, []string{"RegTotal", "Registered", "Enrollment", "Students"}))
		hasAttendee := strings.TrimSpace(getByName(row, []string{"AttendeeName", "Name", "FirstName"})) != ""

		key := strings.Join([]string{
			sessionKey,
			courseCode,
			startTime24,
			endTime24,
		}, "|")

		existing, exists := classMap[key]
		if !exists {
			existing = &ExtractedClass{
				SessionKey:      sessionKey,
				DayOfWeek:       dayValue,
				SessionSeason:   sessionSeason,
				SessionYear:     sessionYear,
				CourseCode:      courseCode,
				ServiceName:     serviceName,
				Location:        location,
				StartTime24:     startTime24,
				EndTime24:       endTime24,
				DurationMinutes: durationMinutes,
				StudentCount:    0,
			}
			classMap[key] = existing
		}

		if existing.ServiceName == "" && serviceName != "" {
			existing.ServiceName = serviceName
		}
		if existing.Location == "" && location != "" {
			existing.Location = location
		}
		if existing.SessionSeason == "" && sessionSeason != "" {
			existing.SessionSeason = sessionSeason
		}
		if existing.SessionYear == 0 && sessionYear > 0 {
			existing.SessionYear = sessionYear
		}

		if studentCountFromRoster > 0 {
			if studentCountFromRoster > existing.StudentCount {
				existing.StudentCount = studentCountFromRoster
			}
		} else if hasAttendee {
			existing.StudentCount += 1
		}
	}

	classesBySession := map[string][]ExtractedClass{}
	sessionCourseCodes := map[string]map[string]struct{}{}
	sessionMeta := map[string]*ExtractedSession{}

	for _, class := range classMap {
		classesBySession[class.SessionKey] = append(classesBySession[class.SessionKey], *class)

		meta, exists := sessionMeta[class.SessionKey]
		if !exists {
			meta = &ExtractedSession{
				SessionKey:    class.SessionKey,
				DayOfWeek:     class.DayOfWeek,
				SessionSeason: class.SessionSeason,
				SessionYear:   class.SessionYear,
				Location:      class.Location,
			}
			sessionMeta[class.SessionKey] = meta
			sessionCourseCodes[class.SessionKey] = map[string]struct{}{}
		}

		meta.ClassCount++
		meta.StudentCount += class.StudentCount
		if code := strings.TrimSpace(class.CourseCode); code != "" {
			sessionCourseCodes[class.SessionKey][code] = struct{}{}
		}
	}

	sessions := make([]ExtractedSession, 0, len(sessionMeta))
	for sessionKey, meta := range sessionMeta {
		courseCodes := make([]string, 0, len(sessionCourseCodes[sessionKey]))
		for code := range sessionCourseCodes[sessionKey] {
			courseCodes = append(courseCodes, code)
		}
		sort.Strings(courseCodes)
		meta.CourseCodes = courseCodes

		sort.Slice(classesBySession[sessionKey], func(i, j int) bool {
			left := classesBySession[sessionKey][i]
			right := classesBySession[sessionKey][j]
			if left.StartTime24 != right.StartTime24 {
				return left.StartTime24 < right.StartTime24
			}
			if left.EndTime24 != right.EndTime24 {
				return left.EndTime24 < right.EndTime24
			}
			return left.CourseCode < right.CourseCode
		})

		sessions = append(sessions, *meta)
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
		return strings.ToLower(strings.TrimSpace(sessions[i].Location)) < strings.ToLower(strings.TrimSpace(sessions[j].Location))
	})

	return &ExtractedCSVResult{
		Sessions:         sessions,
		ClassesBySession: classesBySession,
	}, nil
}

func BuildExtractedSessionKey(dayOfWeek, sessionSeason string, sessionYear int, location string) string {
	return strings.Join([]string{
		strings.TrimSpace(dayOfWeek),
		strings.ToLower(strings.TrimSpace(sessionSeason)),
		strconv.Itoa(sessionYear),
		strings.ToLower(strings.TrimSpace(location)),
	}, "|")
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
	case month >= time.January && month <= time.March:
		return "Winter", source.Year()
	case month >= time.April && month <= time.June:
		return "Spring", source.Year()
	case month >= time.July && month <= time.September:
		return "Summer", source.Year()
	default:
		return "Fall", source.Year()
	}
}

func extractScheduleStartDate(value string) time.Time {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Time{}
	}

	normalized := strings.TrimSpace(strings.TrimPrefix(trimmed, "From "))
	parts := strings.SplitN(normalized, " to ", 2)
	if len(parts) == 0 {
		return time.Time{}
	}

	startRaw := strings.TrimSpace(parts[0])
	if startRaw == "" {
		return time.Time{}
	}

	for _, layout := range []string{
		"2006-01-02",
		"01/02/2006",
		"1/2/2006",
	} {
		if parsed, err := time.Parse(layout, startRaw); err == nil {
			return parsed
		}
	}

	return time.Time{}
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
	default:
		return 99
	}
}
