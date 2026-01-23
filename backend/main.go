package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"cob-aquatics/tasks"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func main() {
	r := mux.NewRouter()

	// API routes
	r.HandleFunc("/api/process-csv", processCSVHandler).Methods("POST")
	r.HandleFunc("/api/masterlist", masterListHandler).Methods("POST")
	r.HandleFunc("/api/masterlist-rosters", masterListRostersHandler).Methods("POST")
	r.HandleFunc("/api/attendance-pdf", attendancePDFHandler).Methods("POST")
	r.HandleFunc("/api/concat-pdfs", concatPDFHandler).Methods("POST")
	r.HandleFunc("/api/health", healthHandler).Methods("GET")

	// Serve React app
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("../frontend/dist/")))

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:3000"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	})

	handler := c.Handler(r)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server running on port %s\n", port)
	http.ListenAndServe(":"+port, handler)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func processCSVHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("backend called for process csv")
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

func masterListHandler(w http.ResponseWriter, r *http.Request) {
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

	options := tasks.FormatOptions{
		TimeHeaders:       r.FormValue("time_headers") != "",
		InstructorHeaders: r.FormValue("instructor_headers") != "",
		CourseHeaders:     r.FormValue("course_headers") != "",
		Borders:           r.FormValue("borders") != "",
		CenterTime:        r.FormValue("center_time") != "",
		BoldTime:          r.FormValue("bold_time") != "",
		CenterCourse:      r.FormValue("center_course") != "",
		BoldCourse:        r.FormValue("bold_course") != "",
	}

	nameList := r.MultipartForm.Value["instructor_names[]"]
	codeList := r.MultipartForm.Value["instructor_codes[]"]
	instructorMap := map[string]string{}

	for i, name := range nameList {
		if strings.TrimSpace(name) == "" {
			continue
		}
		codes := ""
		if i < len(codeList) {
			codes = codeList[i]
		}
		for _, code := range strings.Split(codes, ",") {
			trimmed := strings.TrimSpace(code)
			if trimmed == "" {
				continue
			}
			instructorMap[trimmed] = strings.TrimSpace(name)
		}
	}

	result, err := tasks.ProcessMasterList(records, options, instructorMap)
	if err != nil {
		http.Error(w, "Error processing CSV", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", result.Filename))
	w.Write(result.Data)
}
