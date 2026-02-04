package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"cob-aquatics/tasks"
)

func Masterlist(w http.ResponseWriter, r *http.Request) {
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
			trimmed := tasks.NormalizeEventID(code)
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

func Health(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
