package handlers

import (
	"encoding/json"
	"net/http"

	"cob-aquatics/internal/services/blankpdf"
	"cob-aquatics/internal/services/pdf"
)

func BlankPDF(w http.ResponseWriter, r *http.Request) {
	var req blankpdf.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	output, err := blankpdf.BuildPDF(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	data := output.Data
	if stamped, stampErr := pdf.SetDocumentTitle(data, "Blank"); stampErr == nil {
		data = stamped
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\""+output.Filename+"\"")
	w.Write(data)
}
