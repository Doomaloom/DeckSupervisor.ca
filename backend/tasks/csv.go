package tasks

import (
	"fmt"
	"io"
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

func ProcessCSVFromCSV(csvReader io.Reader, instructorMap map[string]string, fallbackDay string) ([]ClassRoster, int, error) {
	rows, err := readCSVRows(csvReader)
	if err != nil {
		return nil, 0, err
	}
	return ProcessCSVRows(rows, instructorMap, fallbackDay)
}

func ProcessCSVRows(rows []csvRow, instructorMap map[string]string, fallbackDay string) ([]ClassRoster, int, error) {
	if len(rows) == 0 {
		return nil, 0, fmt.Errorf("no rows to process")
	}

	classMap := map[string]*ClassRoster{}
	totalStudents := 0

	for _, row := range rows {
		serviceName := rowValue(row, "ServiceName", "Service", "Service Name")
		code := rowValue(row, "EventID", "Event Id", "ClassCode", "Code")
		day := rowValue(row, "DayOfTheWeek", "Day Of The Week", "DayOfWeek", "Day")
		timeValue := rowValue(row, "EventTime", "Time")
		location := rowValue(row, "Location", "Facility")
		schedule := rowValue(row, "EventSchedule", "Schedule")
		phone := rowValue(row, "AttendeePhone", "Phone")
		instructorFromRow := rowValue(row, "Instructor", "Instructor Name", "InstructorName", "Teacher", "Staff")

		name := rowValue(row, "AttendeeName", "Name")
		if strings.Contains(name, ",") {
			parts := strings.SplitN(name, ",", 2)
			name = strings.TrimSpace(parts[1]) + " " + strings.TrimSpace(parts[0])
		}
		if name == "" {
			firstName := rowValue(row, "FirstName", "First Name")
			lastName := rowValue(row, "LastName", "Last Name")
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

		instructor := strings.TrimSpace(instructorMap[code])
		if instructor == "" {
			instructor = strings.TrimSpace(instructorFromRow)
		}
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
		} else if roster.Instructor == "" && instructor != "" {
			roster.Instructor = instructor
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
	clean = strings.TrimSpace(clean)
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
