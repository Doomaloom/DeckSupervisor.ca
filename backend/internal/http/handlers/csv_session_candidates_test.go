package handlers

import (
	"testing"

	"cob-aquatics/tasks"
)

func TestMatchCSVSessionCandidatePrefersExactTimeWindow(t *testing.T) {
	t.Parallel()

	startA := "09:00"
	endA := "13:00"
	startB := "16:00"
	endB := "19:00"
	updatedOld := "2026-01-01T10:00:00Z"
	updatedNew := "2026-01-02T10:00:00Z"
	spring := "Winter"
	location := "Pool"

	match := matchCSVSessionCandidate(&csvCandidateBucket{
		dayOfWeek:     "Sa",
		sessionSeason: "Winter",
		sessionYear:   2026,
		location:      "Pool",
		startTime24:   "16:00",
		endTime24:     "19:00",
	}, []sessionRow{
		{
			ID:                 "older",
			CreatedBy:          "user-1",
			SessionDay:         "Sa",
			SessionSeason:      &spring,
			SessionYear:        intPtr(2026),
			Location:           &location,
			SourceLocations:    []string{"Pool"},
			SessionStartTime24: &startA,
			SessionEndTime24:   &endA,
			UpdatedAt:          &updatedOld,
		},
		{
			ID:                 "newer",
			CreatedBy:          "user-1",
			SessionDay:         "Sa",
			SessionSeason:      &spring,
			SessionYear:        intPtr(2026),
			Location:           &location,
			SourceLocations:    []string{"Pool"},
			SessionStartTime24: &startB,
			SessionEndTime24:   &endB,
			UpdatedAt:          &updatedNew,
		},
	}, "user-1")

	if match == nil {
		t.Fatalf("expected exact match")
	}
	if match.ID != "newer" {
		t.Fatalf("expected newer exact match, got %q", match.ID)
	}
}

func TestMatchCSVSessionCandidateFallsBackToSingleLegacyWindowlessSession(t *testing.T) {
	t.Parallel()

	winter := "Winter"
	location := "Pool"

	match := matchCSVSessionCandidate(&csvCandidateBucket{
		dayOfWeek:     "Sa",
		sessionSeason: "Winter",
		sessionYear:   2026,
		location:      "Pool",
		startTime24:   "09:00",
		endTime24:     "13:00",
	}, []sessionRow{
		{
			ID:              "legacy",
			CreatedBy:       "user-1",
			SessionDay:      "Sa",
			SessionSeason:   &winter,
			SessionYear:     intPtr(2026),
			Location:        &location,
			SourceLocations: []string{"Pool"},
		},
	}, "user-1")

	if match == nil {
		t.Fatalf("expected fallback match")
	}
	if match.ID != "legacy" {
		t.Fatalf("expected legacy match, got %q", match.ID)
	}
}

func TestMatchCSVSessionCandidatePrefersCombinedSessionOverSingleLocationOverlap(t *testing.T) {
	t.Parallel()

	winter := "Winter"
	combinedLocation := "Main Pool"
	singleLocation := "Small Pool"
	updatedOld := "2026-01-01T10:00:00Z"
	updatedNew := "2026-01-02T10:00:00Z"

	match := matchCSVSessionCandidate(&csvCandidateBucket{
		dayOfWeek:     "Sa",
		sessionSeason: "Winter",
		sessionYear:   2026,
		location:      "Small Pool",
		startTime24:   "09:00",
		endTime24:     "13:00",
	}, []sessionRow{
		{
			ID:                 "single",
			CreatedBy:          "user-1",
			SessionDay:         "Sa",
			SessionSeason:      &winter,
			SessionYear:        intPtr(2026),
			Location:           &singleLocation,
			SourceLocations:    []string{"Small Pool"},
			SessionStartTime24: strPtr("09:00"),
			SessionEndTime24:   strPtr("13:00"),
			UpdatedAt:          &updatedOld,
		},
		{
			ID:                 "combined",
			CreatedBy:          "user-1",
			SessionDay:         "Sa",
			SessionSeason:      &winter,
			SessionYear:        intPtr(2026),
			Location:           &combinedLocation,
			SourceLocations:    []string{"Big Pool", "Small Pool"},
			SessionStartTime24: strPtr("09:00"),
			SessionEndTime24:   strPtr("13:00"),
			UpdatedAt:          &updatedNew,
		},
	}, "user-1")

	if match == nil {
		t.Fatalf("expected a match")
	}
	if match.ID != "combined" {
		t.Fatalf("expected combined session match, got %q", match.ID)
	}
}

func TestBuildCSVSessionCandidatesIncludesSessionWindow(t *testing.T) {
	t.Parallel()

	candidates := buildCSVSessionCandidates([]tasks.ExtractedSession{
		{
			SessionKey:         "Sa|winter|2026|pool|09:00|13:00",
			DayOfWeek:          "Sa",
			SessionSeason:      "Winter",
			SessionYear:        2026,
			Location:           "Pool",
			SessionStartTime24: "09:00",
			SessionEndTime24:   "13:00",
			ClassCount:         1,
			StudentCount:       8,
		},
	}, nil, "user-1")

	if len(candidates) != 1 {
		t.Fatalf("expected 1 candidate, got %d", len(candidates))
	}
	if candidates[0].SessionStartTime24 != "09:00" || candidates[0].SessionEndTime24 != "13:00" {
		t.Fatalf("unexpected candidate window %s-%s", candidates[0].SessionStartTime24, candidates[0].SessionEndTime24)
	}
}

func TestBuildCSVSessionCandidatesGroupsRawSessionsByMatchedCombinedSession(t *testing.T) {
	t.Parallel()

	winter := "Winter"
	location := "Main Pool"
	updatedAt := "2026-01-02T10:00:00Z"

	candidates := buildCSVSessionCandidates([]tasks.ExtractedSession{
		{
			SessionKey:         "Sa|winter|2026|big pool|09:00|11:00",
			DayOfWeek:          "Sa",
			SessionSeason:      "Winter",
			SessionYear:        2026,
			StartDate:          "2026-01-01",
			EndDate:            "2026-03-01",
			Location:           "Big Pool",
			SessionStartTime24: "09:00",
			SessionEndTime24:   "11:00",
			ClassCount:         1,
			StudentCount:       8,
			WaitlistCount:      1,
			CourseCodes:        []string{"100"},
		},
		{
			SessionKey:         "Sa|winter|2026|small pool|10:00|11:00",
			DayOfWeek:          "Sa",
			SessionSeason:      "Winter",
			SessionYear:        2026,
			StartDate:          "2026-01-01",
			EndDate:            "2026-03-01",
			Location:           "Small Pool",
			SessionStartTime24: "09:00",
			SessionEndTime24:   "11:00",
			ClassCount:         1,
			StudentCount:       10,
			WaitlistCount:      2,
			CourseCodes:        []string{"200"},
		},
	}, []sessionRow{
		{
			ID:                 "combined-session",
			CreatedBy:          "user-1",
			SessionDay:         "Sa",
			SessionSeason:      &winter,
			SessionYear:        intPtr(2026),
			Location:           &location,
			SourceLocations:    []string{"Big Pool", "Small Pool"},
			SessionStartTime24: strPtr("09:00"),
			SessionEndTime24:   strPtr("11:00"),
			UpdatedAt:          &updatedAt,
		},
	}, "user-1")

	if len(candidates) != 1 {
		t.Fatalf("expected 1 grouped candidate, got %d", len(candidates))
	}
	candidate := candidates[0]
	if candidate.SessionKey != "combined-session" {
		t.Fatalf("expected grouped candidate key to be session id, got %q", candidate.SessionKey)
	}
	if candidate.ClassCount != 2 || candidate.StudentCount != 18 || candidate.WaitlistCount != 3 {
		t.Fatalf("unexpected grouped counts: %+v", candidate)
	}
	if candidate.SessionStartTime24 != "09:00" || candidate.SessionEndTime24 != "11:00" {
		t.Fatalf("unexpected grouped time window %s-%s", candidate.SessionStartTime24, candidate.SessionEndTime24)
	}
	if len(candidate.SourceSessionKeys) != 2 {
		t.Fatalf("expected 2 source session keys, got %v", candidate.SourceSessionKeys)
	}
	if len(candidate.RawLocations) != 2 {
		t.Fatalf("expected 2 raw locations, got %v", candidate.RawLocations)
	}
	if candidate.MatchedSession == nil || candidate.MatchedSession.ID != "combined-session" {
		t.Fatalf("expected grouped matched session")
	}
}

func intPtr(value int) *int {
	return &value
}

func strPtr(value string) *string {
	return &value
}
