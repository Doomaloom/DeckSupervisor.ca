package supabase

import (
	"encoding/base64"
	"testing"
)

func TestServiceKeyFromEnv(t *testing.T) {
	serviceJWT := "header." + base64.RawURLEncoding.EncodeToString([]byte(`{"role":"service_role"}`)) + ".signature"
	anonJWT := "header." + base64.RawURLEncoding.EncodeToString([]byte(`{"role":"anon"}`)) + ".signature"
	for _, tc := range []struct{ name, primary, legacy, want string }{
		{"primary secret", "sb_secret_test", serviceJWT, "sb_secret_test"},
		{"primary JWT", serviceJWT, "sb_secret_legacy", serviceJWT},
		{"publishable primary falls back", "sb_publishable_test", serviceJWT, serviceJWT},
		{"anon JWT falls back", anonJWT, serviceJWT, serviceJWT},
		{"legacy only", "", serviceJWT, serviceJWT},
		{"reject public keys", "sb_publishable_test", anonJWT, ""},
		{"reject missing", "", "", ""},
		{"reject malformed", "bad.token.value", "sb_secret_", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("SUPABASE_SERVICE_ROLE_KEY", tc.primary)
			t.Setenv("SUPABASE_SERVICE_KEY", tc.legacy)
			got, err := ServiceKeyFromEnv()
			if got != tc.want || (err != nil) != (tc.want == "") {
				t.Fatalf("unexpected key selection or error: %v", err)
			}
		})
	}
}
