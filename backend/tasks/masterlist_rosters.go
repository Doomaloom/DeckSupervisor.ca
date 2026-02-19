package tasks

import (
	"fmt"
	"strings"
)

func ProcessMasterListFromRosters(rosters []ClassRoster, options FormatOptions) (MasterListResult, error) {
	if len(rosters) == 0 {
		return MasterListResult{}, fmt.Errorf("no rosters to process")
	}

	totalStudents := 0
	for _, roster := range rosters {
		totalStudents += len(roster.Students)
	}

	rows := make([]csvRow, 0, totalStudents)
	instructorMap := map[string]string{}

	for _, roster := range rosters {
		code := NormalizeEventID(roster.Code)
		if code == "" {
			continue
		}

		serviceName := strings.TrimSpace(roster.ServiceName)
		eventTime := strings.TrimSpace(roster.Time)
		instructor := strings.TrimSpace(roster.Instructor)
		if instructor != "" {
			instructorMap[code] = instructor
		}

		for _, student := range roster.Students {
			name := strings.TrimSpace(student.Name)
			if name == "" {
				continue
			}
			phone := strings.TrimSpace(student.Phone)
			rowService := serviceName
			if rowService == "" {
				rowService = strings.TrimSpace(student.Level)
			}
			if instructorMap[code] == "" {
				if studentInstructor := strings.TrimSpace(student.Instructor); studentInstructor != "" {
					instructorMap[code] = studentInstructor
				}
			}

			rows = append(rows, csvRow{
				normalizeHeader("EventID"):       code,
				normalizeHeader("EventTime"):     eventTime,
				normalizeHeader("ServiceName"):   rowService,
				normalizeHeader("AttendeeName"):  name,
				normalizeHeader("AttendeePhone"): phone,
			})
		}
	}

	if len(rows) == 0 {
		return MasterListResult{}, fmt.Errorf("no student rows to process")
	}

	return ProcessMasterListRows(rows, options, instructorMap)
}
