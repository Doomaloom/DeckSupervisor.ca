package httpapi

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const guestRosterCSV = "ServiceName,Booked,DayOfTheWeek,EventTime,EventID,EventSchedule,Facility,AttendeeName,AttendeeStatus\n" +
	"Little Splash 1,2,Th,03:30 PM - 04:00 PM,98001,From 2026-09-17 to 2026-12-10,Lakeside Demo Pool,Avery Test,Booked\n" +
	"Little Splash 1,2,Th,03:30 PM - 04:00 PM,98001,From 2026-09-17 to 2026-12-10,Lakeside Demo Pool,Blair Test,Booked\n"

func multipartCSV(t *testing.T, field string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(field, "roster.csv")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return body, writer.FormDataContentType()
}

func serveGuest(t *testing.T, method, path string, body *bytes.Buffer, contentType string) *httptest.ResponseRecorder {
	t.Helper()
	t.Setenv("SUPABASE_URL", "")
	t.Setenv("SUPABASE_ANON_KEY", "")
	if body == nil {
		body = &bytes.Buffer{}
	}
	request := httptest.NewRequest(method, path, body)
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	response := httptest.NewRecorder()
	NewRouter().ServeHTTP(response, request)
	return response
}

// Signed-out roster upload goes through /api/analyzeCSV (triage W4).
func TestGuestRosterUploadIsRoutedAndParsedWithoutAccount(t *testing.T) {
	body, contentType := multipartCSV(t, "csv_file", []byte(guestRosterCSV))
	response := serveGuest(t, http.MethodPost, "/api/analyzeCSV", body, contentType)
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Meta struct {
			AccountScope string `json:"accountScope"`
		} `json:"meta"`
		Candidates []struct {
			CandidateKey string `json:"candidateKey"`
		} `json:"candidates"`
		RostersByCandidateKey map[string][]struct {
			Code     string `json:"courseCode"`
			Students []struct {
				Name string `json:"name"`
			} `json:"students"`
		} `json:"rostersByCandidateKey"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Meta.AccountScope != "guest" {
		t.Fatalf("expected guest scope, got %q", payload.Meta.AccountScope)
	}
	if len(payload.Candidates) != 1 {
		t.Fatalf("expected one session candidate, got %d", len(payload.Candidates))
	}
	rosters := payload.RostersByCandidateKey[payload.Candidates[0].CandidateKey]
	if len(rosters) != 1 || rosters[0].Code != "98001" || len(rosters[0].Students) != 2 {
		t.Fatalf("expected the candidate's roster with both swimmers, got %+v", rosters)
	}
}

func TestGuestRosterUploadRejectsMissingFile(t *testing.T) {
	body, contentType := multipartCSV(t, "other_field", []byte(guestRosterCSV))
	response := serveGuest(t, http.MethodPost, "/api/analyzeCSV", body, contentType)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", response.Code)
	}
}

func TestGuestRosterUploadRejectsNonMultipartBody(t *testing.T) {
	response := serveGuest(t, http.MethodPost, "/api/analyzeCSV", bytes.NewBufferString("not a form"), "text/plain")
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", response.Code)
	}
}

func TestGuestRosterUploadRejectsUnparseableCSV(t *testing.T) {
	body, contentType := multipartCSV(t, "csv_file", []byte("a,b\n\"unterminated,1\n"))
	response := serveGuest(t, http.MethodPost, "/api/analyzeCSV", body, contentType)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", response.Code, response.Body.String())
	}
}

func TestGuestRosterUploadRejectsOversizedFile(t *testing.T) {
	oversized := []byte(guestRosterCSV + strings.Repeat("x", 33<<20))
	body, contentType := multipartCSV(t, "csv_file", oversized)
	response := serveGuest(t, http.MethodPost, "/api/analyzeCSV", body, contentType)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", response.Code)
	}
}

// The pre-April endpoints stay unregistered; the SPA no longer calls them.
func TestLegacyGuestCSVEndpointsAreNotRegistered(t *testing.T) {
	for _, path := range []string{"/api/process-csv", "/api/extract-classes"} {
		body, contentType := multipartCSV(t, "csv_file", []byte(guestRosterCSV))
		response := serveGuest(t, http.MethodPost, path, body, contentType)
		if response.Code != http.StatusNotFound {
			t.Fatalf("%s: expected 404, got %d", path, response.Code)
		}
	}
}
