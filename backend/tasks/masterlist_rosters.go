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

	records := make([][]string, 0, totalStudents+1)
	records = append(records, []string{"EventID", "EventTime", "ServiceName", "AttendeeName", "AttendeePhone"})
	instructorMap := map[string]string{}

	for _, roster := range rosters {
		code := strings.TrimSpace(roster.Code)
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

			records = append(records, []string{
				code,
				eventTime,
				rowService,
				name,
				phone,
			})
		}
	}

	if len(records) == 1 {
		return MasterListResult{}, fmt.Errorf("no student rows to process")
	}

	return ProcessMasterList(records, options, instructorMap)
}
