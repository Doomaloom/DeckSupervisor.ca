package handlers

import (
	"strings"
	"unicode/utf8"
)

type lessonWorkoutTiming struct {
	Kind    string `json:"kind"`
	Seconds int    `json:"seconds"`
}
type lessonWorkoutSet struct {
	Repetitions int                  `json:"repetitions"`
	Distance    int                  `json:"distance"`
	Activity    string               `json:"activity"`
	Notes       string               `json:"notes"`
	Timing      *lessonWorkoutTiming `json:"timing,omitempty"`
}
type lessonWorkoutSections struct {
	WarmUp   []lessonWorkoutSet `json:"warmUp"`
	MainSet  []lessonWorkoutSet `json:"mainSet"`
	CoolDown []lessonWorkoutSet `json:"coolDown"`
}
type lessonWorkout struct {
	Version  int                   `json:"version"`
	Title    string                `json:"title"`
	Sections lessonWorkoutSections `json:"sections"`
}

func validLessonWorkout(workout *lessonWorkout) bool {
	if workout == nil {
		return true
	}
	if workout.Version != 1 || strings.TrimSpace(workout.Title) == "" || utf8.RuneCountInString(workout.Title) > 200 {
		return false
	}
	count := 0
	for _, section := range [][]lessonWorkoutSet{workout.Sections.WarmUp, workout.Sections.MainSet, workout.Sections.CoolDown} {
		if len(section) == 0 {
			return false
		}
		count += len(section)
		for _, set := range section {
			if set.Repetitions < 1 || set.Repetitions > 1000 || set.Distance < 1 || set.Distance > 10000 || strings.TrimSpace(set.Activity) == "" || utf8.RuneCountInString(set.Activity) > 200 || utf8.RuneCountInString(set.Notes) > 1000 {
				return false
			}
			if set.Timing != nil && ((set.Timing.Kind != "rest" && set.Timing.Kind != "interval") || set.Timing.Seconds < 1 || set.Timing.Seconds > 3600) {
				return false
			}
		}
	}
	return count <= 100
}
