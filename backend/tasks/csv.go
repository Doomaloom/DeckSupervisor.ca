package tasks

import (
	"fmt"
	"strings"
)

type RosterStudent struct {
	Name       string `json:"name"`
	Phone      string `json:"phone"`
	Instructor string `json:"instructor"`
	Level      string `json:"level"`
}

type ClassRoster struct {
	Code        string          `json:"code"`
	ServiceName string          `json:"serviceName"`
	Day         string          `json:"day"`
	Time        string          `json:"time"`
	Location    string          `json:"location"`
	Schedule    string          `json:"schedule"`
	Instructor  string          `json:"instructor"`
	Students    []RosterStudent `json:"students"`
}

func ProcessCSV(records [][]string, instructorMap map[string]string, fallbackDay string) ([]ClassRoster, int, error) {
	if len(records) < 2 {
		return nil, 0, fmt.Errorf("no rows to process")
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

	classMap := map[string]*ClassRoster{}
	totalStudents := 0

	for i := 1; i < len(records); i++ {
		row := records[i]
		if len(row) == 0 {
			continue
		}

		serviceName := getByName(row, []string{"ServiceName", "Service", "Service Name"})
		code := getByName(row, []string{"EventID", "Event Id", "ClassCode", "Code"})
		day := getByName(row, []string{"Day", "DayOfWeek"})
		timeValue := getByName(row, []string{"EventTime", "Time"})
		location := getByName(row, []string{"Location", "Facility"})
		schedule := getByName(row, []string{"EventSchedule", "Schedule"})
		phone := getByName(row, []string{"AttendeePhone", "Phone"})

		name := getByName(row, []string{"AttendeeName", "Name"})
		if strings.Contains(name, ",") {
			parts := strings.SplitN(name, ",", 2)
			name = strings.TrimSpace(parts[1]) + " " + strings.TrimSpace(parts[0])
		}
		if name == "" {
			firstName := getByName(row, []string{"FirstName", "First Name"})
			lastName := getByName(row, []string{"LastName", "Last Name"})
			if firstName != "" || lastName != "" {
				name = strings.TrimSpace(strings.Join([]string{firstName, lastName}, " "))
			}
		}

		if name == "" || code == "" {
			continue
		}

		if day == "" {
			day = fallbackDay
		}
		day = normalizeDay(day)
		if schedule == "" {
			schedule = day
		}

		instructor := instructorMap[code]
		level := serviceName

		roster, ok := classMap[code]
		if !ok {
			roster = &ClassRoster{
				Code:        code,
				ServiceName: serviceName,
				Day:         day,
				Time:        timeValue,
				Location:    location,
				Schedule:    schedule,
				Instructor:  instructor,
				Students:    []RosterStudent{},
			}
			classMap[code] = roster
		}

		roster.Students = append(roster.Students, RosterStudent{
			Name:       name,
			Phone:      phone,
			Instructor: instructor,
			Level:      level,
		})
		totalStudents++
	}

	classes := make([]ClassRoster, 0, len(classMap))
	for _, roster := range classMap {
		classes = append(classes, *roster)
	}

	return classes, totalStudents, nil
}

func normalizeHeader(header string) string {
	clean := strings.TrimSpace(header)
	clean = strings.TrimPrefix(clean, "\uFEFF")
	clean = strings.ToLower(clean)
	return clean
}

func normalizeDay(day string) string {
	value := strings.TrimSpace(day)
	if value == "" {
		return value
	}
	if value == "Mo Tu We Th Fr" {
		return "Mo,Tu,We,Th,Fr"
	}
	normalized := strings.ToLower(value)
	switch normalized {
	case "monday":
		return "Mo"
	case "tuesday":
		return "Tu"
	case "wednesday":
		return "We"
	case "thursday":
		return "Th"
	case "friday":
		return "Fr"
	case "saturday":
		return "Sa"
	case "sunday":
		return "Su"
	}
	return value
}
