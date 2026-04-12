package tasks

import (
	"io"
	"sort"
	"strings"
)

func ProcessCSVFromCSV(csvReader io.Reader, instructorMap map[string]string, fallbackDay string) ([]ClassRoster, int, error) {
	normalizedMap := make(map[string]string, len(instructorMap))
	for code, instructor := range instructorMap {
		normalizedCode := NormalizeEventID(code)
		if normalizedCode == "" {
			continue
		}
		normalizedMap[normalizedCode] = strings.TrimSpace(instructor)
	}

	result, err := ExtractClassesFromCSV(csvReader, ExtractOptions{
		FallbackDay:   strings.TrimSpace(fallbackDay),
		InstructorMap: normalizedMap,
	})
	if err != nil {
		return nil, 0, err
	}

	sessionKeys := make([]string, 0, len(result.ClassesBySession))
	for sessionKey := range result.ClassesBySession {
		sessionKeys = append(sessionKeys, sessionKey)
	}
	sort.Strings(sessionKeys)

	classes := make([]ClassRoster, 0)
	totalStudents := 0
	for _, sessionKey := range sessionKeys {
		sessionClasses := append([]ExtractedClass(nil), result.ClassesBySession[sessionKey]...)
		sort.Slice(sessionClasses, func(i, j int) bool {
			if sessionClasses[i].StartTime24 != sessionClasses[j].StartTime24 {
				return sessionClasses[i].StartTime24 < sessionClasses[j].StartTime24
			}
			if sessionClasses[i].EndTime24 != sessionClasses[j].EndTime24 {
				return sessionClasses[i].EndTime24 < sessionClasses[j].EndTime24
			}
			return sessionClasses[i].CourseCode < sessionClasses[j].CourseCode
		})

		for _, class := range sessionClasses {
			classes = append(classes, ClassRoster{
				SessionKey:    class.SessionKey,
				Code:          class.CourseCode,
				ServiceName:   class.ServiceName,
				Location:      class.Location,
				Time:          formatProcessCSVTimeRange(class.StartTime24, class.EndTime24),
				Instructor:    strings.TrimSpace(class.Instructor),
				StudentCount:  class.StudentCount,
				WaitlistCount: class.WaitlistCount,
				Students:      append([]RosterStudent(nil), class.Roster...),
			})
			totalStudents += class.StudentCount
		}
	}

	return classes, totalStudents, nil
}

func formatProcessCSVTimeRange(startTime24, endTime24 string) string {
	start := strings.TrimSpace(startTime24)
	end := strings.TrimSpace(endTime24)
	if start == "" || end == "" {
		return ""
	}
	return start + "-" + end
}
