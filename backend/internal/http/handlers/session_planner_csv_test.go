package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAnalyzeSessionPlannerCSVRequiresActivitySummary(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/api/session-planner/analyze", strings.NewReader(""))
	request.Header.Set("Content-Type", "multipart/form-data; boundary=test")
	response := httptest.NewRecorder()

	AnalyzeSessionPlannerCSV(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
}
