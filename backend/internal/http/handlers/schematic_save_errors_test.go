package handlers_test

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestSchematicSaveReportsTheRealReason(t *testing.T) {
	for _, tc := range []struct {
		name, upstreamBody string
		upstreamStatus     int
		wantStatus         int
		wantMessage        string
	}{
		{"removed instructor", `{"code":"23514","message":"Instructor was removed. Reload the session."}`, 400, 409, "Instructor was removed. Reload the session."},
		{"permission refused", `{"code":"42501","message":"Session editing denied"}`, 403, 403, "You don't have permission to edit this session's schematic."},
		{"expired sign-in", `{"message":"JWT expired"}`, 401, 401, "Your sign-in has expired."},
		{"unknown database text is hidden", `{"code":"23505","message":"duplicate key value violates unique constraint \"instructor_classes_pkey\""}`, 409, 400, "Unable to save schematic. Reload the session and try again."},
	} {
		t.Run(tc.name, func(t *testing.T) {
			staffServer(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.upstreamStatus)
				io.WriteString(w, tc.upstreamBody)
			})
			w := staffRequest("PUT", "/api/schematics/session-a", `{"data":{"assignments":[]}}`, true)
			if w.Code != tc.wantStatus || !strings.Contains(w.Body.String(), tc.wantMessage) {
				t.Fatalf("got %d %q", w.Code, w.Body.String())
			}
			if strings.Contains(w.Body.String(), "constraint") || strings.Contains(w.Body.String(), "pkey") {
				t.Fatalf("raw database text leaked: %q", w.Body.String())
			}
		})
	}
}
