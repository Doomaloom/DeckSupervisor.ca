package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"

	"github.com/gorilla/mux"
	"testing"
)

func TestDeviceShareHTTPHostAndInstructorRedemption(t *testing.T) {
	payload := []byte(`{"packages":[{"instructor":"Alex","package":{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"demo","instructor":"Alex","courses":[{"sourceId":"course-a"}] }},{"instructor":"Sam","package":{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"demo","instructor":"Sam","courses":[{"sourceId":"course-b"}]}}]}`)
	request := httptest.NewRequest(http.MethodPost, "/api/device-shares", bytes.NewReader(payload))
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
	request := httptest.NewRequest(http.MethodPost, "/api/device-shares", bytes.NewBufferString(`{"packages":[{"instructor":"Alex","package":{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"demo","instructor":"Sam","courses":[{}]}}]}`))
	recorder := httptest.NewRecorder()
	CreateDeviceShare(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("mismatched package accepted with status %d", recorder.Code)
	}
}
