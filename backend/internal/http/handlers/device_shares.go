package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"

	"cob-aquatics/internal/services/deviceshare"
	"github.com/gorilla/mux"
)

var deviceShareService = deviceshare.New()

type createDeviceShareRequest struct {
	Packages []struct {
		Instructor string          `json:"instructor"`
		Package    json.RawMessage `json:"package"`
	} `json:"packages"`
}
type deviceShareHostRequest struct {
	HostToken string `json:"hostToken"`
}
type redeemDeviceShareRequest struct {
	Code string `json:"code"`
}

func CreateDeviceShare(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, deviceshare.MaxSessionBytes+1024*1024)
	var request createDeviceShareRequest
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&request); err != nil {
		http.Error(w, "Invalid or oversized request body", http.StatusBadRequest)
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	packages := make([]deviceshare.InstructorPackage, 0, len(request.Packages))
	for _, item := range request.Packages {
		var contract struct {
			SchemaVersion int               `json:"schemaVersion"`
			Kind          string            `json:"kind"`
			Instructor    string            `json:"instructor"`
			DatasetID     string            `json:"datasetId"`
			Courses       []json.RawMessage `json:"courses"`
		}
		if len(item.Package) == 0 || !json.Valid(item.Package) || json.Unmarshal(item.Package, &contract) != nil || contract.SchemaVersion != 1 || contract.Kind != "rec-tablet-classes" || strings.TrimSpace(contract.Instructor) != strings.TrimSpace(item.Instructor) || strings.TrimSpace(contract.DatasetID) == "" || len(contract.Courses) == 0 || len(contract.Courses) > 1000 {
			http.Error(w, "Invalid instructor package", http.StatusBadRequest)
			return
		}
		packages = append(packages, deviceshare.InstructorPackage{Instructor: item.Instructor, Package: item.Package})
	}
	client, _, splitErr := net.SplitHostPort(r.RemoteAddr)
	if splitErr != nil {
		client = r.RemoteAddr
	}
	started, err := deviceShareService.Create(packages, client)
	if err != nil {
		if errors.Is(err, deviceshare.ErrRateLimited) {
			writeDeviceShareError(w, err)
		} else {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}
	writeDeviceShareJSON(w, http.StatusCreated, started)
}

func HeartbeatDeviceShare(w http.ResponseWriter, r *http.Request) {
	var request deviceShareHostRequest
	if err := decodeDeviceShareBody(w, r, &request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	expires, err := deviceShareService.Heartbeat(mux.Vars(r)["id"], request.HostToken)
	if err != nil {
		writeDeviceShareError(w, err)
		return
	}
	writeDeviceShareJSON(w, http.StatusOK, map[string]any{"expiresAt": expires})
}

func CloseDeviceShare(w http.ResponseWriter, r *http.Request) {
	var request deviceShareHostRequest
	if err := decodeDeviceShareBody(w, r, &request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if err := deviceShareService.Close(mux.Vars(r)["id"], request.HostToken); err != nil {
		writeDeviceShareError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func RedeemDeviceShare(w http.ResponseWriter, r *http.Request) {
	var request redeemDeviceShareRequest
	if err := decodeDeviceShareBody(w, r, &request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	client, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		client = r.RemoteAddr
	}
	data, err := deviceShareService.Redeem(strings.TrimSpace(request.Code), client)
	if err != nil {
		writeDeviceShareError(w, err)
		return
	}
	var packageJSON json.RawMessage = data
	writeDeviceShareJSON(w, http.StatusOK, map[string]json.RawMessage{"package": packageJSON})
}

func decodeDeviceShareBody(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return err
	}
	return nil
}
func writeDeviceShareJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store, private")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func writeDeviceShareError(w http.ResponseWriter, err error) {
	switch err {
	case deviceshare.ErrNotFound:
		http.Error(w, err.Error(), http.StatusNotFound)
	case deviceshare.ErrForbidden:
		http.Error(w, err.Error(), http.StatusForbidden)
	case deviceshare.ErrRateLimited:
		http.Error(w, err.Error(), http.StatusTooManyRequests)
	default:
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
}
