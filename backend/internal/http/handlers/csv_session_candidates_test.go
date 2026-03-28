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
			ID:            "legacy",
			CreatedBy:     "user-1",
			SessionDay:    "Sa",
			SessionSeason: &winter,
			SessionYear:   intPtr(2026),
			Location:      &location,
		},
	}, "user-1")

	if match == nil {
		t.Fatalf("expected fallback match")
	}
	if match.ID != "legacy" {
		t.Fatalf("expected legacy match, got %q", match.ID)
	}
}

func TestMatchCSVSessionCandidateSkipsAmbiguousLegacyWindowlessSessions(t *testing.T) {
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
			ID:            "legacy-a",
			CreatedBy:     "user-1",
			SessionDay:    "Sa",
			SessionSeason: &winter,
			SessionYear:   intPtr(2026),
			Location:      &location,
		},
		{
			ID:            "legacy-b",
			CreatedBy:     "user-1",
			SessionDay:    "Sa",
			SessionSeason: &winter,
			SessionYear:   intPtr(2026),
			Location:      &location,
		},
	}, "user-1")

	if match != nil {
		t.Fatalf("expected no match for ambiguous legacy sessions")
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

func intPtr(value int) *int {
	return &value
}
