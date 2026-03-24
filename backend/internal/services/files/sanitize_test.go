package files

import "testing"

func TestSanitizeFilename(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "preserves readable characters", input: "Master List_2026-03-23", want: "Master-List_2026-03-23"},
		{name: "strips unsafe punctuation", input: "report: pool/a?.pdf", want: "report-poolapdf"},
		{name: "uses fallback for empty output", input: "   !!!   ", want: "sheet"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := SanitizeFilename(tt.input); got != tt.want {
				t.Fatalf("SanitizeFilename(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
