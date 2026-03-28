package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"cob-aquatics/tasks"
)

func summarizeProcessCSVClasses(classes []tasks.ClassRoster) []map[string]interface{} {
	summaries := make([]map[string]interface{}, 0, len(classes))
	for _, class := range classes {
		waitlistCount := 0
		students := make([]map[string]interface{}, 0, len(class.Students))
		for _, student := range class.Students {
			if student.Waitlist {
				waitlistCount++
			}
			students = append(students, map[string]interface{}{
				"name":     student.Name,
				"waitlist": student.Waitlist,
			})
		}
		summaries = append(summaries, map[string]interface{}{
			"code":          class.Code,
			"studentCount":  len(class.Students),
			"waitlistCount": waitlistCount,
			"students":      students,
		})
	}
	return summaries
}

func ProcessCSV(w http.ResponseWriter, r *http.Request) {
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

	day := r.FormValue("day")

	instructorMap := map[string]string{}
	if r.MultipartForm != nil {
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

	classes, total, err := tasks.ProcessCSVFromCSV(file, instructorMap, day)
	if err != nil {
		http.Error(w, "Error processing CSV", http.StatusInternalServerError)
		return
	}

	log.Printf("[process-csv] parsed classes day=%q total=%d classCount=%d classes=%v",
		day,
		total,
		len(classes),
		summarizeProcessCSVClasses(classes),
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"day":     day,
		"total":   total,
		"classes": classes,
	})
}
