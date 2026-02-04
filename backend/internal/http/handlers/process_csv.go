package handlers

import (
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strings"

	"cob-aquatics/tasks"
)

func ProcessCSV(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("csv_file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	day := r.FormValue("day")

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "Error reading CSV", http.StatusInternalServerError)
		return
	}

	instructorMap := map[string]string{}
	if err := r.ParseMultipartForm(32 << 20); err == nil && r.MultipartForm != nil {
		names := r.MultipartForm.Value["instructor_names[]"]
		codes := r.MultipartForm.Value["instructor_codes[]"]
		for i, name := range names {
			if strings.TrimSpace(name) == "" {
				continue
			}
			codeList := ""
			if i < len(codes) {
				codeList = codes[i]
			}
			for _, code := range strings.Split(codeList, ",") {
				trimmed := strings.TrimSpace(code)
				if trimmed == "" {
					continue
				}
				instructorMap[trimmed] = strings.TrimSpace(name)
			}
		}
	}

	classes, total, err := tasks.ProcessCSV(records, instructorMap, day)
	if err != nil {
		http.Error(w, "Error processing CSV", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"day":     day,
		"total":   total,
		"classes": classes,
	})
}
