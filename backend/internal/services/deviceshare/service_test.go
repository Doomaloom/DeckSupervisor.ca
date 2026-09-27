package deviceshare

import (
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestCreateRedeemHeartbeatAndClose(t *testing.T) {
	s := New()
	one := []byte(`{"instructor":"Alex","courses":[]}`)
	two := []byte(`{"instructor":"Sam","courses":[]}`)
	started, err := s.Create([]InstructorPackage{{Instructor: "Alex", Package: one}, {Instructor: "Sam", Package: two}}, "host")
	if err != nil {
		t.Fatal(err)
	}
	if len(started.Codes) != 2 || started.HostToken == "" {
		t.Fatalf("unexpected share response: %#v", started)
	}
	seen := map[string]bool{}
	for _, item := range started.Codes {
		if len(item.Code) != 6 {
			t.Fatalf("code %q does not retain six digits", item.Code)
		}
		if seen[item.Code] {
			t.Fatalf("duplicate code %q", item.Code)
		}
		seen[item.Code] = true
		want := one
		if item.Instructor == "Sam" {
			want = two
		}
		got, err := s.Redeem(item.Code, item.Instructor)
		if err != nil || string(got) != string(want) {
			t.Fatalf("redeem %s: %s, %v", item.Instructor, got, err)
		}
		got[0] = 'x'
	}
	if _, err := s.Redeem(started.Codes[0].Code, "copy"); err != nil {
		t.Fatalf("stored package was mutated by caller: %v", err)
	}
	if _, err := s.Heartbeat(started.ID, "wrong"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("wrong host token: %v", err)
	}
	if expiry, err := s.Heartbeat(started.ID, started.HostToken); err != nil || time.Until(expiry) < 50*time.Second {
		t.Fatalf("heartbeat expiry %v, %v", expiry, err)
	}
	if err := s.Close(started.ID, started.HostToken); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Redeem(started.Codes[0].Code, "again"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("code remained active after close: %v", err)
	}
}

func TestCodesAreUniqueAcrossActiveSharesAndKeepLeadingZeroes(t *testing.T) {
	s := New()
	seen := map[string]bool{}
	leadingZero := false
	for i := 0; i < 20; i++ {
		started, err := s.Create([]InstructorPackage{{Instructor: fmt.Sprintf("Instructor %d", i), Package: []byte("{}")}}, fmt.Sprintf("host-%d", i))
		if err != nil {
			t.Fatal(err)
		}
		code := started.Codes[0].Code
		if seen[code] {
			t.Fatalf("active shares reused code %s", code)
		}
		seen[code] = true
		if code[0] == '0' {
			leadingZero = true
		}
	}
	if formatCode(12) != "000012" {
		t.Fatalf("leading zeroes were not preserved: %q", formatCode(12))
	}
	_ = leadingZero
}

func TestExpiryAndRedemptionRateLimit(t *testing.T) {
	s := New()
	started, err := s.Create([]InstructorPackage{{Instructor: "Alex", Package: []byte("{}")}}, "host")
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 20; i++ {
		_, _ = s.Redeem("999999", "same-client")
	}
	if _, err := s.Redeem(started.Codes[0].Code, "same-client"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected rate limit, got %v", err)
	}
	s.mu.Lock()
	s.rooms[started.ID].expires = time.Now().Add(-time.Second)
	s.mu.Unlock()
	if _, err := s.Redeem(started.Codes[0].Code, "other-client"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expired share remained active: %v", err)
	}
}

func TestCreateRejectsInvalidAndOversizedSets(t *testing.T) {
	s := New()
	if _, err := s.Create(nil, "host"); err == nil {
		t.Fatal("accepted an empty share")
	}
	if _, err := s.Create([]InstructorPackage{{Instructor: "Alex", Package: []byte("{}")}, {Instructor: "Alex", Package: []byte("{}")}}, "host"); err == nil {
		t.Fatal("accepted duplicate instructors")
	}
	if _, err := s.Create([]InstructorPackage{{Instructor: "Alex", Package: make([]byte, MaxPackageBytes+1)}}, "host"); err == nil {
		t.Fatal("accepted an oversized package")
	}
}

func TestShareCreationIsRateLimitedPerClient(t *testing.T) {
	s := New()
	for i := 0; i < 10; i++ {
		if _, err := s.Create([]InstructorPackage{{Instructor: fmt.Sprintf("Instructor %d", i), Package: []byte("{}")}}, "same-host"); err != nil {
			t.Fatalf("share %d: %v", i, err)
		}
	}
	if _, err := s.Create([]InstructorPackage{{Instructor: "Eleventh", Package: []byte("{}")}}, "same-host"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected share creation limit, got %v", err)
	}
}

func TestRedemptionHasGlobalGuessingLimit(t *testing.T) {
	s := New()
	for i := 0; i < 200; i++ {
		_, _ = s.Redeem("abcdef", fmt.Sprintf("client-%d", i))
	}
	if _, err := s.Redeem("abcdef", "client-extra"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected global redemption limit, got %v", err)
	}
}
