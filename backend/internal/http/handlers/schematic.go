package handlers

import (
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

	output, err := schematic.BuildFromCSVReader(file)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", output.ContentType)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+output.Filename+"\"")
	w.Write(output.Data)
}
