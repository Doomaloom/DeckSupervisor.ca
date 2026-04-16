package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"cob-aquatics/internal/services/masterlist"
	"cob-aquatics/internal/services/pdf"
	"cob-aquatics/tasks"
)

var errMissingMasterlistRosters = errors.New("missing rosters")

type masterlistRostersRequest struct {
	Rosters              []tasks.ClassRoster `json:"rosters"`
	Options              masterlist.Options  `json:"options"`
	SessionName          string              `json:"sessionName"`
	GeneratedDate        string              `json:"generatedDate"`
	SessionWeek          int                 `json:"sessionWeek"`
	SessionProgressLabel string              `json:"sessionProgressLabel"`
}

func decodeMasterlistRostersRequest(r *http.Request) (masterlistRostersRequest, error) {
	var req masterlistRostersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return masterlistRostersRequest{}, err
	}

	if len(req.Rosters) == 0 {
		return masterlistRostersRequest{}, errMissingMasterlistRosters
	}
	return req, nil
}

func MasterlistRosters(w http.ResponseWriter, r *http.Request) {
	req, err := decodeMasterlistRostersRequest(r)
	if err != nil {
		if errors.Is(err, errMissingMasterlistRosters) {
			http.Error(w, "Missing rosters", http.StatusBadRequest)
			return
		}
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	pdfBytes, filename, err := masterlist.BuildPDF(
		r.Context(),
		req.Rosters,
		req.Options,
		req.SessionName,
		req.GeneratedDate,
		req.SessionWeek,
		req.SessionProgressLabel,
	)
	if err != nil {
		if errors.Is(err, masterlist.ErrRenderPDF) {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if stamped, stampErr := pdf.SetDocumentTitle(pdfBytes, "Masterlist"); stampErr == nil {
		pdfBytes = stamped
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\""+filename+"\"")
	w.Write(pdfBytes)
}

func MasterlistPreview(w http.ResponseWriter, r *http.Request) {
	req, err := decodeMasterlistRostersRequest(r)
	if err != nil {
		if errors.Is(err, errMissingMasterlistRosters) {
			http.Error(w, "Missing rosters", http.StatusBadRequest)
			return
		}
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	htmlContent, err := masterlist.BuildHTMLPreview(
		req.Rosters,
		req.Options,
		req.SessionName,
		req.GeneratedDate,
		req.SessionWeek,
		req.SessionProgressLabel,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(htmlContent))
}
