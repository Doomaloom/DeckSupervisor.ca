package schematicpdf

import "testing"

func TestNormalizeScalePercent(t *testing.T) {
	tests := []struct {
		name  string
		value float64
		want  float64
	}{
		{name: "missing defaults to 100", value: 0, want: 100},
		{name: "negative defaults to 100", value: -10, want: 100},
		{name: "below minimum clamps to 60", value: 45, want: 60},
		{name: "above maximum clamps to 120", value: 150, want: 120},
		{name: "valid value is preserved", value: 85, want: 85},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeScalePercent(tt.value); got != tt.want {
				t.Fatalf("normalizeScalePercent(%v) = %v, want %v", tt.value, got, tt.want)
			}
		})
	}
}

func TestEffectiveScale(t *testing.T) {
	got := effectiveScale(0.8, 85)
	want := 0.68
	if got < want-0.000001 || got > want+0.000001 {
		t.Fatalf("effectiveScale(0.8, 85) = %v, want %v", got, want)
	}
}
