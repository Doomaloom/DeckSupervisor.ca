package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"cob-aquatics/internal/services/attendance"
	"cob-aquatics/internal/services/attendancesheets"
	supabasesvc "cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

type saveAttendanceSheetRequest = attendancesheets.SaveInput

type previewAttendanceSheetRequest struct {
	SheetData attendancesheets.SaveInput `json:"sheet"`
	Roster    attendance.Roster          `json:"roster"`
	Session   string                     `json:"session"`
	Title     string                     `json:"title"`
}

func AttendanceSheets(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	teamID := strings.TrimSpace(r.URL.Query().Get("teamId"))
	service := attendancesheets.NewService(client)
	sheets, err := service.List(r.Context(), teamID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"sheets": sheets})
}

func AttendanceSheetTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := attendancesheets.Templates()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"templates": templates})
}

func AttendanceSheetTemplateSeed(w http.ResponseWriter, r *http.Request) {
	template := mux.Vars(r)["template"]
	seed, err := attendancesheets.SeedTemplate(template)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, seed)
}

func CreateAttendanceSheet(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var req saveAttendanceSheetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	service := attendancesheets.NewService(client)
	sheet, err := service.Create(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"sheet": sheet})
}

func UpdateAttendanceSheet(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var req saveAttendanceSheetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	service := attendancesheets.NewService(client)
	sheet, err := service.Update(r.Context(), mux.Vars(r)["id"], req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"sheet": sheet})
}

func DeleteAttendanceSheet(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	service := attendancesheets.NewService(client)
	if err := service.Delete(r.Context(), mux.Vars(r)["id"], r.URL.Query().Get("teamId")); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func AttendanceSheetPreviewPDF(w http.ResponseWriter, r *http.Request) {
	var req previewAttendanceSheetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	normalized, err := attendancesheets.NormalizeInput(req.SheetData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if normalized.BaseTemplate != nil {
		normalized.SheetData.BaseTemplate = *normalized.BaseTemplate
	}
	roster := req.Roster
	if strings.TrimSpace(roster.Code) == "" {
		roster.Code = "SAMPLE"
	}
	if strings.TrimSpace(roster.Level) == "" {
		roster.Level = normalized.SheetData.Title
	}
	if strings.TrimSpace(roster.ServiceName) == "" {
		roster.ServiceName = normalized.SheetData.Title
	}
	if len(roster.Students) == 0 {
		roster.Students = []attendance.Student{
			{Name: "Alex Sample"},
			{Name: "Jordan Sample"},
			{Name: "Taylor Sample"},
		}
	}
	session := strings.TrimSpace(req.Session)
	if session == "" {
		session = attendance.DefaultSessionName
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Attendance - " + normalized.Name
	}
	pdfBytes, filename, err := attendance.Generate(r.Context(), attendance.Request{
		Session:  session,
		Filename: normalized.Name,
		Title:    title,
		Sheet:    &normalized.SheetData,
		Roster:   roster,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\""+filename+"\"")
	w.Write(pdfBytes)
}
