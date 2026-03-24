package customrosters

import "testing"

func TestNormalizeNameAndHashing(t *testing.T) {
	t.Parallel()

	if got := normalizeName("  Jane   Doe-Smith  "); got != "jane doe smith" {
		t.Fatalf("normalizeName returned %q", got)
	}

	hashA := hashName("Jane Doe", "pepper")
	hashB := hashName("jane   doe", "pepper")
	if hashA == "" || hashA != hashB {
		t.Fatalf("expected stable equivalent hashes, got %q and %q", hashA, hashB)
	}

	hashes := hashNames([]string{"Jane Doe", " jane doe ", "", "John Doe"}, "pepper")
	if len(hashes) != 2 {
		t.Fatalf("expected deduped hashes length 2, got %d", len(hashes))
	}
}

func TestParseRPCBooleanAndJWTDetection(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		payload      string
		functionName string
		want         bool
		wantErr      bool
	}{
		{name: "scalar", payload: `true`, functionName: "can_read_session", want: true},
		{name: "object", payload: `{"result":false}`, functionName: "can_read_session", want: false},
		{name: "row object", payload: `[{"can_edit_session":true}]`, functionName: "can_edit_session", want: true},
		{name: "invalid", payload: `{"unexpected":true}`, functionName: "can_edit_session", wantErr: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := parseRPCBoolean([]byte(tt.payload), tt.functionName)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error for payload %s", tt.payload)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseRPCBoolean returned error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("parseRPCBoolean returned %v, want %v", got, tt.want)
			}
		})
	}

	if !looksLikeJWT("a.b.c") {
		t.Fatal("expected JWT-like token to be detected")
	}
	if looksLikeJWT("sb_secret_value") {
		t.Fatal("expected secret key not to be treated as JWT")
	}
}
