package handlers

import (
	"net/http"

	"cob-aquatics/internal/services/plannerimport"
)

const maxSessionPlannerImportBytes = 32 << 20

func AnalyzeSessionPlannerCSV(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxSessionPlannerImportBytes)
	if err := r.ParseMultipartForm(maxSessionPlannerImportBytes); err != nil {
		http.Error(w, "Invalid or oversized planner import", http.StatusBadRequest)
		return
	}

	activityFile, activityHeader, err := r.FormFile("activity_summary_file")
	if err != nil {
		http.Error(w, "No activity summary file uploaded", http.StatusBadRequest)
		return
	}
	defer activityFile.Close()

	rosterFile, rosterHeader, err := r.FormFile("roster_file")
	if err != nil {
		http.Error(w, "No roster file uploaded", http.StatusBadRequest)
		return
	}
	defer rosterFile.Close()

	result, err := plannerimport.Analyze(
		activityFile,
		activityHeader.Filename,
		rosterFile,
		rosterHeader.Filename,
	)
	if err != nil {
		http.Error(w, "Failed to analyze session planner CSVs: "+err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, result)
}
