package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"cob-aquatics/internal/services/attendance"
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
	w.Write(pdfBytes)
}
