package handlers

import (
	"encoding/csv"
	"net/http"

	"cob-aquatics/internal/services/schematic"
)

func SchematicMaker(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("csv_file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "Error reading CSV", http.StatusBadRequest)
		return
	}

	output, err := schematic.BuildFromCSV(records)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", output.ContentType)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+output.Filename+"\"")
	w.Write(output.Data)
}
