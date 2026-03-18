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

	result, err := tasks.ExtractClassesFromCSV(file)
	if err != nil {
		http.Error(w, "Error extracting classes", http.StatusBadRequest)
		return
	}
	log.Printf("[extract-classes] sessions=%d sample=%+v", len(result.Sessions), firstNSessions(result.Sessions, 3))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":          true,
		"totalSessions":    len(result.Sessions),
		"totalClasses":     countExtractedClasses(result.ClassesBySession),
		"sessions":         result.Sessions,
		"classesBySession": result.ClassesBySession,
	})
}

func firstNSessions(sessions []tasks.ExtractedSession, n int) []tasks.ExtractedSession {
	if n <= 0 || len(sessions) == 0 {
		return []tasks.ExtractedSession{}
	}
	if len(sessions) <= n {
		return sessions
	}
	return sessions[:n]
}

func countExtractedClasses(classesBySession map[string][]tasks.ExtractedClass) int {
	total := 0
	for _, classes := range classesBySession {
		total += len(classes)
	}
	return total
}
