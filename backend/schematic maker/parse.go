package main

import (
	"fmt"
	"github.com/go-gota/gota/dataframe"
	"strconv"
	"strings"
	"time"
)

func parseInt(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return v
}

func parseFloat(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	s = strings.TrimSuffix(s, "%")
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

func calculateDurationMinutes(start24h string, end24h string) int {
	start24h = strings.TrimSpace(start24h)
	end24h = strings.TrimSpace(end24h)
	if start24h == "" || end24h == "" {
		return 0
	}

	startTime, err := time.Parse("15:04", start24h)
	if err != nil {
		return 0
	}
	endTime, err := time.Parse("15:04", end24h)
	if err != nil {
		return 0
	}

	if endTime.Before(startTime) {
		endTime = endTime.Add(24 * time.Hour)
	}

	return int(endTime.Sub(startTime).Minutes())
}

func extract24hTime(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}

	layouts := []string{
		"2006-01-02 03:04 PM",
		"2006-01-02 3:04 PM",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Format("15:04")
		}
	}

	parts := strings.Fields(s)
	if len(parts) >= 3 {
		ampm := strings.ToUpper(parts[len(parts)-1])
		timePart := parts[len(parts)-2]
		if ampm == "AM" || ampm == "PM" {
			return get24hFormat(timePart + " " + ampm)
		}
	}
	if len(parts) >= 2 {
		return get24hFormat(parts[len(parts)-1])
	}

	return get24hFormat(s)
}

func get24hFormat(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}

	layouts := []string{
		"3:04 PM",
		"3:04PM",
		"03:04 PM",
		"03:04PM",
		"3 PM",
		"3PM",
		"15:04",
		"15:04:05",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Format("15:04")
		}
	}

	// Fallback for inputs like "10:00am" or "10:00 pm"
	lower := strings.ToLower(s)
	lower = strings.ReplaceAll(lower, " ", "")
	if strings.HasSuffix(lower, "am") || strings.HasSuffix(lower, "pm") {
		ampm := lower[len(lower)-2:]
		timePart := strings.TrimSuffix(lower, ampm)
		if t, err := time.Parse("3:04", timePart); err == nil {
			hour := t.Hour()
			if ampm == "pm" && hour < 12 {
				hour += 12
			} else if ampm == "am" && hour == 12 {
				hour = 0
			}
			return fmt.Sprintf("%02d:%02d", hour, t.Minute())
		}
	}

	return s
}

func parseDateTime(s string) (time.Time, bool) {
	layouts := []string{
		"2006-01-02 03:04 PM",
		"2006-01-02 3:04 PM",
		"2006-01-02 03:04PM",
		"2006-01-02 3:04PM",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, strings.TrimSpace(s)); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func getClassInfos(df dataframe.DataFrame) []ClassInfo {
	records := df.Records()
	if len(records) <= 1 {
		return nil
	}

	header := records[0]
	colIndex := make(map[string]int, len(header))
	for i, name := range header {
		colIndex[name] = i
	}

	get := func(row []string, col string) string {
		idx, ok := colIndex[col]
		if !ok || idx >= len(row) {
			return ""
		}
		return row[idx]
	}

	classInfos := make([]ClassInfo, 0, len(records)-1)
	for _, row := range records[1:] {
		info := ClassInfo{
			Name:     get(row, "GroupName"),
			Location: get(row, "MainFacility"),
			Day:      get(row, "Day"),
			Starts:   get(row, "Starts"),
			Ends:     get(row, "Ends"),
			Code:     strings.TrimSpace(get(row, "ID")),
		}

		info.id = parseInt(get(row, "ID"))
		info.Duration = parseInt(get(row, "Duration"))
		info.MaxSlots = parseInt(get(row, "Max"))
		info.MinSlots = parseInt(get(row, "Min"))
		info.Registered = parseInt(get(row, "RegTotal"))
		info.PercentFilled = parseFloat(get(row, "PercentFilled"))

		startString := get(row, "Starts")
		endString := get(row, "Ends")

		start24h := extract24hTime(startString)
		end24h := extract24hTime(endString)

		info.StartTime = start24h
		info.EndTime = end24h
		if computed := calculateDurationMinutes(info.StartTime, info.EndTime); computed > 0 {
			info.Duration = computed
		}

		classInfos = append(classInfos, info)
	}

	return classInfos
}
