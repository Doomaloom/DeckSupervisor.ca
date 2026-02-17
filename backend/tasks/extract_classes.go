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

func ExtractClassesFromCSV(csvReader io.Reader) ([]ExtractedClass, error) {
	df := dataframe.ReadCSV(csvReader)
	if df.Err != nil {
		return nil, fmt.Errorf("failed to read csv: %w", df.Err)
	}
	return ExtractClasses(df.Records())
}

func ExtractClasses(records [][]string) ([]ExtractedClass, error) {
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

		sessionSeason, sessionYear := getSeasonAndYear(startDate, endDate)

		studentCountFromRoster := parsePositiveInt(getByName(row, []string{"RegTotal", "Registered", "Enrollment", "Students"}))
		hasAttendee := strings.TrimSpace(getByName(row, []string{"AttendeeName", "Name", "FirstName"})) != ""

		key := strings.Join([]string{
			dayValue,
			strings.ToLower(strings.TrimSpace(location)),
			courseCode,
			startTime24,
			endTime24,
		}, "|")

		existing, exists := classMap[key]
		if !exists {
			existing = &ExtractedClass{
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

	classes := make([]ExtractedClass, 0, len(classMap))
	for _, class := range classMap {
		classes = append(classes, *class)
	}

	sort.Slice(classes, func(i, j int) bool {
		dayI := daySortKey(classes[i].DayOfWeek)
		dayJ := daySortKey(classes[j].DayOfWeek)
		if dayI != dayJ {
			return dayI < dayJ
		}
		if classes[i].StartTime24 != classes[j].StartTime24 {
			return classes[i].StartTime24 < classes[j].StartTime24
		}
		if classes[i].EndTime24 != classes[j].EndTime24 {
			return classes[i].EndTime24 < classes[j].EndTime24
		}
		if classes[i].CourseCode != classes[j].CourseCode {
			return classes[i].CourseCode < classes[j].CourseCode
		}
		return classes[i].Location < classes[j].Location
	})

	return classes, nil
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

func getDurationMinutes(startTime24 string, endTime24 string) int {
	start, err := time.Parse("15:04", startTime24)
	if err != nil {
		return 0
	}
	end, err := time.Parse("15:04", endTime24)
	if err != nil {
		return 0
	}

	startMinutes := start.Hour()*60 + start.Minute()
	endMinutes := end.Hour()*60 + end.Minute()
	if endMinutes < startMinutes {
		endMinutes += 24 * 60
	}

	duration := endMinutes - startMinutes
	if duration <= 0 {
		return 0
	}
	return duration
}

func getSeasonAndYear(startDate time.Time, endDate time.Time) (string, int) {
	if !startDate.IsZero() {
		return seasonForMonth(startDate.Month()), startDate.Year()
	}
	if !endDate.IsZero() {
		return seasonForMonth(endDate.Month()), endDate.Year()
	}
	return "", 0
}

func seasonForMonth(month time.Month) string {
	switch month {
	case time.March, time.April, time.May:
		return "spring"
	case time.June, time.July, time.August:
		return "summer"
	case time.September, time.October, time.November, time.December:
		return "fall"
	default:
		return "winter"
	}
}

func parsePositiveInt(value string) int {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil || parsed < 0 {
		return 0
	}
	return parsed
}

func daySortKey(day string) int {
	switch normalizeDay(day) {
	case "Mo":
		return 0
	case "Tu":
		return 1
	case "We":
		return 2
	case "Th":
		return 3
	case "Fr":
		return 4
	case "Sa":
		return 5
	case "Su":
		return 6
	default:
		return 99
	}
}
