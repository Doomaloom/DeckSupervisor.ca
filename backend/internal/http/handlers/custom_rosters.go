package handlers

import (
	"encoding/json"
	"net/http"

	"cob-aquatics/internal/services/customrosters"
	"github.com/gorilla/mux"
)

type saveCustomRosterRequest struct {
	Day    string `json:"day"`
	Roster struct {
		ID           string   `json:"id"`
		ServiceName  string   `json:"serviceName"`
		Instructor   string   `json:"instructor"`
		SourceCodes  []string `json:"sourceCodes"`
		StudentNames []string `json:"studentNames"`
		CreatedAt    string   `json:"createdAt"`
	} `json:"roster"`
}

type resolveCustomRosterRequest struct {
	Day      string `json:"day"`
	Students []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"students"`
}

type resolveCustomRosterResponse struct {
	Rosters []customrosters.ResolvedRoster `json:"rosters"`
}

func SaveCustomRoster(w http.ResponseWriter, r *http.Request) {
	service, err := customrosters.NewServiceFromEnv()
	if err != nil {
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}
	userID, err := service.UserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req saveCustomRosterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	input := customrosters.SaveRosterInput{
		ID:           req.Roster.ID,
		Day:          req.Day,
		ServiceName:  req.Roster.ServiceName,
		Instructor:   req.Roster.Instructor,
		SourceCodes:  req.Roster.SourceCodes,
		StudentNames: req.Roster.StudentNames,
	}

	if err := service.SaveRoster(r.Context(), userID, input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func ResolveCustomRosters(w http.ResponseWriter, r *http.Request) {
	service, err := customrosters.NewServiceFromEnv()
	if err != nil {
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}
	userID, err := service.UserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req resolveCustomRosterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	students := make([]customrosters.StudentRef, 0, len(req.Students))
	for _, student := range req.Students {
		students = append(students, customrosters.StudentRef{ID: student.ID, Name: student.Name})
	}

	rosters, err := service.ResolveRosters(r.Context(), userID, req.Day, students)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resolveCustomRosterResponse{Rosters: rosters})
}

func DeleteCustomRoster(w http.ResponseWriter, r *http.Request) {
	service, err := customrosters.NewServiceFromEnv()
	if err != nil {
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}
	userID, err := service.UserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	rosterID := vars["id"]
	if rosterID == "" {
		http.Error(w, "Missing roster id", http.StatusBadRequest)
		return
	}

	if err := service.DeleteRoster(r.Context(), userID, rosterID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
