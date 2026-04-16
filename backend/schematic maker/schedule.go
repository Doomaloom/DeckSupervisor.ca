package main

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

func rowHeightForDuration(duration int) int {
	if duration <= 0 {
		return 0
	}
	height := (duration*4 + 29) / 30
	if height < 1 {
		return 1
	}
	return height
}

func rowFromMinutes(startMin int, baseMin int, offset int) int {
	if startMin < baseMin {
		return offset + 1
	}
	return offset + 1 + ((startMin-baseMin)*4)/30
}

func minutesFromHHMM(s string) (int, bool) {
	t, err := time.Parse("15:04", s)
	if err != nil {
		return 0, false
	}
	return t.Hour()*60 + t.Minute(), true
}

func timeLess(a string, b string) bool {
	a = strings.TrimSpace(a)
	b = strings.TrimSpace(b)
	if a == "" && b == "" {
		return false
	}
	if a == "" {
		return false
	}
	if b == "" {
		return true
	}

	am, aok := minutesFromHHMM(a)
	bm, bok := minutesFromHHMM(b)
	if aok && bok {
		return am < bm
	}
	if aok != bok {
		return aok
	}
	return a < b
}

func daySortKey(day string) int {
	switch strings.TrimSpace(day) {
	case "Mo", "Mon", "Monday":
		return 0
	case "Tu", "Tue", "Tuesday":
		return 1
	case "We", "Wed", "Wednesday":
		return 2
	case "Th", "Thu", "Thursday":
		return 3
	case "Fr", "Fri", "Friday":
		return 4
	case "Sa", "Sat", "Saturday":
		return 5
	case "Su", "Sun", "Sunday":
		return 6
	case "Mo,Tu,We,Th,Fr":
		return 7
	case "Mini Session 1":
		return 8
	case "Mini Session 2":
		return 9
	case "Mini Session 3":
		return 10
	case "Mini Session 4":
		return 11
	default:
		return 99
	}
}

func groupClassesByLocationAndDay(classes []ClassInfo) map[string]map[string][]ClassInfo {
	grouped := make(map[string]map[string][]ClassInfo)
	for _, classInfo := range classes {
		location := strings.TrimSpace(classInfo.Location)
		if location == "" {
			location = "Unknown"
		}
		day := strings.TrimSpace(classInfo.Day)
		if day == "" {
			day = "Unknown"
		}

		if _, ok := grouped[location]; !ok {
			grouped[location] = make(map[string][]ClassInfo)
		}
		grouped[location][day] = append(grouped[location][day], classInfo)
	}

	for _, byDay := range grouped {
		for day, classes := range byDay {
			sort.SliceStable(classes, func(i, j int) bool {
				return timeLess(classes[i].StartTime, classes[j].StartTime)
			})
			byDay[day] = classes
		}
	}

	return grouped
}

func formatTimeLabel(minutes int) string {
	minutes = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60)
	h := minutes / 60
	m := minutes % 60
	ampm := "AM"
	if h >= 12 {
		ampm = "PM"
	}
	h12 := h % 12
	if h12 == 0 {
		h12 = 12
	}
	return fmt.Sprintf("%d:%02d %s", h12, m, ampm)
}

func seasonForMonth(m time.Month) string {
	switch {
	case m >= 9:
		return "Fall"
	case m >= 7:
		return "Summer"
	case m >= 3:
		return "Spring"
	default:
		return "Winter"
	}
}
