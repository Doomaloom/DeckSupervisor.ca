package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"cob-aquatics/tasks"
)

func ExtractClasses(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("csv_file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	classes, err := tasks.ExtractClassesFromCSV(file)
	if err != nil {
		http.Error(w, "Error extracting classes", http.StatusBadRequest)
		return
	}
	log.Printf("[extract-classes] total=%d sample=%+v", len(classes), firstNClasses(classes, 3))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"total":   len(classes),
		"classes": classes,
	})
}

func firstNClasses(classes []tasks.ExtractedClass, n int) []tasks.ExtractedClass {
	if n <= 0 || len(classes) == 0 {
		return []tasks.ExtractedClass{}
	}
	if len(classes) <= n {
		return classes
	}
	return classes[:n]
}
