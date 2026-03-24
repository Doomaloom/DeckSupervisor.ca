package plannershare

import (
	"testing"
	"time"
)

func TestApplyPlannerClassMove(t *testing.T) {
	t.Parallel()

	current := PlannerClass{
		PlannedMoveType:      "target_class",
		PlannedMoveTime:      "",
		PlannedMoveTargetKey: "class-2",
	}

	newTime := "10:30"
	next := applyPlannerClassMove(current, PlannerClassMoveUpdate{
		PlannedMoveType: ptr("new_time"),
		PlannedMoveTime: &newTime,
	})
	if next.PlannedMoveType != "new_time" || next.PlannedMoveTime != "10:30" || next.PlannedMoveTargetKey != "" {
		t.Fatalf("unexpected new_time result: %+v", next)
	}

	targetClass := "class-9"
	next = applyPlannerClassMove(next, PlannerClassMoveUpdate{
		PlannedMoveType:      ptr("target_class"),
		PlannedMoveTargetKey: &targetClass,
	})
	if next.PlannedMoveType != "target_class" || next.PlannedMoveTime != "" || next.PlannedMoveTargetKey != "class-9" {
		t.Fatalf("unexpected target_class result: %+v", next)
	}

	next = applyPlannerClassMove(next, PlannerClassMoveUpdate{
		PlannedMoveType: ptr("invalid"),
	})
	if next.PlannedMoveType != "" || next.PlannedMoveTime != "" || next.PlannedMoveTargetKey != "" {
		t.Fatalf("expected invalid move type to clear move fields: %+v", next)
	}
}

func TestNormalizeHelpersAndCloneDataset(t *testing.T) {
	t.Parallel()

	if got := normalizeDisplayName("   "); got != "Guest" {
		t.Fatalf("normalizeDisplayName returned %q", got)
	}

	overrides := normalizeLocationOverrides(map[string]string{
		" Pool A ": " Lane 1 ",
		"":         "ignored",
		"Pool B":   "",
	})
	if len(overrides) != 1 || overrides["Pool A"] != "Lane 1" {
		t.Fatalf("unexpected normalized overrides: %#v", overrides)
	}

	original := PlannerDataset{
		SourceFileName: "planner.csv",
		Classes:        []PlannerClass{{ClassKey: "class-1", LaneIndex: 1}},
		CallRecords:    nil,
	}
	cloned := cloneDataset(original)
	cloned.Classes[0].LaneIndex = 9
	if original.Classes[0].LaneIndex != 1 {
		t.Fatalf("expected cloneDataset to deep clone classes")
	}
	if cloned.CallRecords == nil {
		t.Fatal("expected cloneDataset to initialize call records map")
	}
}

func TestCleanupRoomLockedReassignsHostAndRemovesStaleParticipants(t *testing.T) {
	t.Parallel()

	service := NewService()
	now := time.Now().UTC()
	room := &shareRoom{
		Code:              "ABC123",
		HostParticipantID: "host",
		Participants: map[string]*ShareParticipant{
			"host":  {ID: "host", DisplayName: "Host", IsHost: true, JoinedAt: now.Add(-2 * time.Minute), LastSeenAt: now.Add(-2 * time.Minute)},
			"guest": {ID: "guest", DisplayName: "Guest", JoinedAt: now.Add(-time.Minute), LastSeenAt: now},
		},
	}

	service.cleanupRoomLocked(room, now)

	if room.HostParticipantID != "guest" {
		t.Fatalf("expected guest to become host, got %q", room.HostParticipantID)
	}
	if _, ok := room.Participants["host"]; ok {
		t.Fatal("expected stale host to be removed")
	}
	if !room.Participants["guest"].IsHost {
		t.Fatal("expected reassigned host flag to be updated")
	}
}

func ptr(value string) *string {
	return &value
}
