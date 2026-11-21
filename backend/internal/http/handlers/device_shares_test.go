package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"

	"github.com/gorilla/mux"
	"testing"
)

// signedInDeviceShareRequest stubs the sign-in provider's user lookup so a
// create request counts as signed in.
func signedInDeviceShareRequest(t *testing.T, payload []byte) *http.Request {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"id":"user-a"}`)
	}))
	t.Cleanup(server.Close)
	t.Setenv("SUPABASE_URL", server.URL)
	t.Setenv("SUPABASE_ANON_KEY", "anon-key")
	request := httptest.NewRequest(http.MethodPost, "/api/device-shares", bytes.NewReader(payload))
	request.AddCookie(&http.Cookie{Name: "decksupervisor_access_token", Value: "user-access-token"})
	return request
}

func TestDeviceShareCreateRequiresSignIn(t *testing.T) {
	t.Setenv("SUPABASE_URL", "")
	t.Setenv("SUPABASE_ANON_KEY", "")
	t.Setenv("VITE_SUPABASE_ANON_KEY", "")
	payload := `{"packages":[{"instructor":"Alex","package":{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"demo","instructor":"Alex","courses":[{"sourceId":"course-a"}]}}]}`
	request := httptest.NewRequest(http.MethodPost, "/api/device-shares", bytes.NewBufferString(payload))
	recorder := httptest.NewRecorder()
	CreateDeviceShare(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("guest create status %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestDeviceShareHTTPHostAndInstructorRedemption(t *testing.T) {
	payload := []byte(`{"packages":[{"instructor":"Alex","package":{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"demo","instructor":"Alex","courses":[{"sourceId":"course-a"}] }},{"instructor":"Sam","package":{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"demo","instructor":"Sam","courses":[{"sourceId":"course-b"}]}}]}`)
	request := signedInDeviceShareRequest(t, payload)
	recorder := httptest.NewRecorder()
	CreateDeviceShare(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create status %d: %s", recorder.Code, recorder.Body.String())
	}
	var started struct {
		ID        string `json:"id"`
		HostToken string `json:"hostToken"`
		Codes     []struct {
			Instructor string `json:"instructor"`
			Code       string `json:"code"`
		} `json:"codes"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &started); err != nil {
		t.Fatal(err)
	}
	if started.ID == "" || started.HostToken == "" || len(started.Codes) != 2 {
		t.Fatalf("incomplete share response: %#v", started)
	}
	for _, item := range started.Codes {
		request = httptest.NewRequest(http.MethodPost, "/api/device-shares/redeem", bytes.NewBufferString(`{"code":"`+item.Code+`"}`))
		request.RemoteAddr = "192.0.2.20:1234"
		recorder = httptest.NewRecorder()
		RedeemDeviceShare(recorder, request)
		if recorder.Code != http.StatusOK {
			t.Fatalf("redeem %s status %d: %s", item.Instructor, recorder.Code, recorder.Body.String())
		}
		var response struct {
			Package struct {
				Instructor string `json:"instructor"`
			} `json:"package"`
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		if response.Package.Instructor != item.Instructor {
			t.Fatalf("code for %s returned %s", item.Instructor, response.Package.Instructor)
		}
		if recorder.Header().Get("Cache-Control") != "no-store, private" {
			t.Fatal("package response may be cached")
		}
	}
	request = httptest.NewRequest(http.MethodPost, "/api/device-shares/"+started.ID+"/close", bytes.NewBufferString(`{"hostToken":"invalid"}`))
	request = mux.SetURLVars(request, map[string]string{"id": started.ID})
	recorder = httptest.NewRecorder()
	CloseDeviceShare(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("invalid host token status %d", recorder.Code)
	}
	request = httptest.NewRequest(http.MethodPost, "/api/device-shares/"+started.ID+"/close", bytes.NewBufferString(`{"hostToken":"`+started.HostToken+`"}`))
	request = mux.SetURLVars(request, map[string]string{"id": started.ID})
	recorder = httptest.NewRecorder()
	CloseDeviceShare(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("close status %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestDeviceShareCreateRejectsMismatchedInstructorPackage(t *testing.T) {
	request := signedInDeviceShareRequest(t, []byte(`{"packages":[{"instructor":"Alex","package":{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"demo","instructor":"Sam","courses":[{}]}}]}`))
	recorder := httptest.NewRecorder()
	CreateDeviceShare(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("mismatched package accepted with status %d", recorder.Code)
	}
}
