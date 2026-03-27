package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"cob-aquatics/internal/services/attendance"
	"cob-aquatics/internal/services/pdf"
)

func AttendancePDF(w http.ResponseWriter, r *http.Request) {
	var req attendance.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	pdfBytes, filename, err := attendance.Generate(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, attendance.ErrMissingTemplate):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, attendance.ErrTemplateNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\""+filename+"\"")
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = strings.TrimSuffix(filename, ".pdf")
	}
	if stamped, stampErr := pdf.SetDocumentTitle(pdfBytes, title); stampErr == nil {
		pdfBytes = stamped
	}
	w.Write(pdfBytes)
}
