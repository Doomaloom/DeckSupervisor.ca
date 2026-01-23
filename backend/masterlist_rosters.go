package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"cob-aquatics/tasks"
)

type masterListRostersRequest struct {
	Rosters []tasks.ClassRoster     `json:"rosters"`
	Options masterListRosterOptions `json:"options"`
}

type masterListRosterOptions struct {
	TimeHeaders       bool `json:"time_headers"`
	InstructorHeaders bool `json:"instructor_headers"`
	CourseHeaders     bool `json:"course_headers"`
	Borders           bool `json:"borders"`
	CenterTime        bool `json:"center_time"`
	BoldTime          bool `json:"bold_time"`
	CenterCourse      bool `json:"center_course"`
	BoldCourse        bool `json:"bold_course"`
}

func masterListRostersHandler(w http.ResponseWriter, r *http.Request) {
	var req masterListRostersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Rosters) == 0 {
		http.Error(w, "Missing rosters", http.StatusBadRequest)
		return
	}

	options := tasks.FormatOptions{
		TimeHeaders:       req.Options.TimeHeaders,
		InstructorHeaders: req.Options.InstructorHeaders,
		CourseHeaders:     req.Options.CourseHeaders,
		Borders:           req.Options.Borders,
		CenterTime:        req.Options.CenterTime,
		BoldTime:          req.Options.BoldTime,
		CenterCourse:      req.Options.CenterCourse,
		BoldCourse:        req.Options.BoldCourse,
	}

	result, err := tasks.ProcessMasterListFromRosters(req.Rosters, options)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error building master list: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", result.Filename))
	w.Write(result.Data)
}
