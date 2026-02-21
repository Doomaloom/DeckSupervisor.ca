package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"cob-aquatics/internal/services/sessionreportpdf"
)

func SessionReportPDF(w http.ResponseWriter, r *http.Request) {
	var req sessionreportpdf.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	output, err := sessionreportpdf.BuildPDF(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", output.Filename))
	w.Write(output.Data)
}
