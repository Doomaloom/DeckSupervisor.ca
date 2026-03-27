package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"cob-aquatics/internal/services/pdf"
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

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Session Report"
	}

	data := output.Data
	if stamped, stampErr := pdf.SetDocumentTitle(data, title); stampErr == nil {
		data = stamped
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", output.Filename))
	w.Write(data)
}
