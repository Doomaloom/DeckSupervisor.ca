package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"cob-aquatics/internal/services/masterlist"
	"cob-aquatics/internal/services/pdf"
	"cob-aquatics/tasks"
)

type masterlistRostersRequest struct {
	Rosters       []tasks.ClassRoster `json:"rosters"`
	Options       masterlist.Options  `json:"options"`
	SessionName   string              `json:"sessionName"`
	GeneratedDate string              `json:"generatedDate"`
	SessionWeek   int                 `json:"sessionWeek"`
}

func MasterlistRosters(w http.ResponseWriter, r *http.Request) {
	var req masterlistRostersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Rosters) == 0 {
		http.Error(w, "Missing rosters", http.StatusBadRequest)
		return
	}

	pdfBytes, filename, err := masterlist.BuildPDF(
		r.Context(),
		req.Rosters,
		req.Options,
		req.SessionName,
		req.GeneratedDate,
		req.SessionWeek,
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
