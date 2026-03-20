package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	authsvc "cob-aquatics/internal/services/auth"
	"cob-aquatics/internal/services/plannershare"
	"github.com/gorilla/mux"
)

var plannerShareService = plannershare.NewService()

type createPlannerShareRequest struct {
	DisplayName         string                      `json:"displayName"`
	LocationOverrides   map[string]string           `json:"locationOverrides"`
	CallbackPhoneNumber string                      `json:"callbackPhoneNumber"`
	Dataset             plannershare.PlannerDataset `json:"dataset"`
}

type joinPlannerShareRequest struct {
	DisplayName string `json:"displayName"`
}

type participantRequest struct {
	ParticipantID string `json:"participantId"`
}

type updatePlannerClassStatusRequest struct {
	ParticipantID string `json:"participantId"`
	ClassKey      string `json:"classKey"`
	Status        string `json:"status"`
}

type updatePlannerClassLanesRequest struct {
	ParticipantID     string         `json:"participantId"`
	ClassLaneIndexes  map[string]int `json:"classLaneIndexes"`
}

type updatePlannerClassMoveRequest struct {
	ParticipantID          string `json:"participantId"`
	ClassKey               string `json:"classKey"`
	PlannedMoveType        string `json:"plannedMoveType"`
	PlannedMoveTime        string `json:"plannedMoveTime"`
	PlannedMoveTargetKey   string `json:"plannedMoveTargetClassKey"`
}

type updatePlannerCallRecordRequest struct {
	ParticipantID       string                               `json:"participantId"`
	ParticipantRecordID string                               `json:"participantRecordId"`
	Update              plannershare.PlannerCallRecordUpdate `json:"update"`
}

type updatePlannerShareDetailsRequest struct {
	ParticipantID       string            `json:"participantId"`
	LocationOverrides   map[string]string `json:"locationOverrides"`
	CallbackPhoneNumber string            `json:"callbackPhoneNumber"`
}

type applyPlannerShareSaveStateRequest struct {
	ParticipantID       string                                          `json:"participantId"`
	ClassStatuses       map[string]string                               `json:"classStatuses"`
	ClassLaneIndexes    map[string]int                                  `json:"classLaneIndexes"`
	ClassMoves          map[string]plannershare.PlannerClassMoveUpdate  `json:"classMoves"`
	CallRecordUpdates   map[string]plannershare.PlannerCallRecordUpdate `json:"callRecords"`
	LocationOverrides   map[string]string                               `json:"locationOverrides"`
	CallbackPhoneNumber string                                          `json:"callbackPhoneNumber"`
}

func CreatePlannerShare(w http.ResponseWriter, r *http.Request) {
	var req createPlannerShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	participantID, session, err := plannerShareService.Create(
		requestBaseURL(r),
		req.Dataset,
		req.DisplayName,
		req.LocationOverrides,
		req.CallbackPhoneNumber,
		isGuestRequest(r),
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writePlannerShareResponse(w, participantID, session)
}

func JoinPlannerShare(w http.ResponseWriter, r *http.Request) {
	var req joinPlannerShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	code := mux.Vars(r)["code"]
	participantID, session, err := plannerShareService.Join(requestBaseURL(r), code, req.DisplayName, isGuestRequest(r))
	if err != nil {
		writePlannerShareError(w, err)
		return
	}

	writePlannerShareResponse(w, participantID, session)
}

func GetPlannerShare(w http.ResponseWriter, r *http.Request) {
	code := mux.Vars(r)["code"]
	participantID := r.URL.Query().Get("participantId")
	session, err := plannerShareService.Get(requestBaseURL(r), code, participantID)
	if err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": session})
}

func HeartbeatPlannerShare(w http.ResponseWriter, r *http.Request) {
	var req participantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	code := mux.Vars(r)["code"]
	session, err := plannerShareService.Heartbeat(requestBaseURL(r), code, req.ParticipantID)
	if err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": session})
}

func LeavePlannerShare(w http.ResponseWriter, r *http.Request) {
	var req participantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	code := mux.Vars(r)["code"]
	if err := plannerShareService.Leave(code, req.ParticipantID); err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func ClosePlannerShare(w http.ResponseWriter, r *http.Request) {
	var req participantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	code := mux.Vars(r)["code"]
	if err := plannerShareService.Close(code, req.ParticipantID); err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func UpdatePlannerShareClassStatus(w http.ResponseWriter, r *http.Request) {
	var req updatePlannerClassStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	code := mux.Vars(r)["code"]
	session, err := plannerShareService.UpdateClassStatus(requestBaseURL(r), code, req.ParticipantID, req.ClassKey, req.Status)
	if err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": session})
}

func UpdatePlannerShareClassLanes(w http.ResponseWriter, r *http.Request) {
	var req updatePlannerClassLanesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	code := mux.Vars(r)["code"]
	session, err := plannerShareService.UpdateClassLanes(requestBaseURL(r), code, req.ParticipantID, req.ClassLaneIndexes)
	if err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": session})
}

func UpdatePlannerShareClassMove(w http.ResponseWriter, r *http.Request) {
	var req updatePlannerClassMoveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	code := mux.Vars(r)["code"]
	session, err := plannerShareService.UpdateClassMove(
		requestBaseURL(r),
		code,
		req.ParticipantID,
		req.ClassKey,
		plannershare.PlannerClassMoveUpdate{
			PlannedMoveType:      &req.PlannedMoveType,
			PlannedMoveTime:      &req.PlannedMoveTime,
			PlannedMoveTargetKey: &req.PlannedMoveTargetKey,
		},
	)
	if err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": session})
}

func UpdatePlannerShareCallRecord(w http.ResponseWriter, r *http.Request) {
	var req updatePlannerCallRecordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	code := mux.Vars(r)["code"]
	session, err := plannerShareService.UpdateCallRecord(requestBaseURL(r), code, req.ParticipantID, req.ParticipantRecordID, req.Update)
	if err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": session})
}

func UpdatePlannerShareDetails(w http.ResponseWriter, r *http.Request) {
	var req updatePlannerShareDetailsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	code := mux.Vars(r)["code"]
	session, err := plannerShareService.UpdateSessionDetails(
		requestBaseURL(r),
		code,
		req.ParticipantID,
		req.LocationOverrides,
		req.CallbackPhoneNumber,
	)
	if err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": session})
}

func ApplyPlannerShareSaveState(w http.ResponseWriter, r *http.Request) {
	var req applyPlannerShareSaveStateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	code := mux.Vars(r)["code"]
	session, err := plannerShareService.ApplySavedState(
		requestBaseURL(r),
		code,
		req.ParticipantID,
		plannershare.SavedStateApplyInput{
			ClassStatuses:       req.ClassStatuses,
			ClassLaneIndexes:    req.ClassLaneIndexes,
			ClassMoves:          req.ClassMoves,
			CallRecords:         req.CallRecordUpdates,
			LocationOverrides:   req.LocationOverrides,
			CallbackPhoneNumber: req.CallbackPhoneNumber,
		},
	)
	if err != nil {
		writePlannerShareError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": session})
}

func writePlannerShareResponse(w http.ResponseWriter, participantID string, session plannershare.ShareSession) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"participantId": participantID,
		"session":       session,
	})
}

func writePlannerShareError(w http.ResponseWriter, err error) {
	switch err {
	case plannershare.ErrSessionNotFound:
		http.Error(w, err.Error(), http.StatusNotFound)
	case plannershare.ErrParticipantNotFound:
		http.Error(w, err.Error(), http.StatusUnauthorized)
	case plannershare.ErrForbidden:
		http.Error(w, err.Error(), http.StatusForbidden)
	default:
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
}

func requestBaseURL(r *http.Request) string {
	if origin := strings.TrimSpace(r.Header.Get("Origin")); origin != "" {
		return strings.TrimRight(origin, "/")
	}
	if referer := strings.TrimSpace(r.Header.Get("Referer")); referer != "" {
		if parsed, err := url.Parse(referer); err == nil && parsed.Scheme != "" && parsed.Host != "" {
			return parsed.Scheme + "://" + parsed.Host
		}
	}
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

func isGuestRequest(r *http.Request) bool {
	service, err := authsvc.NewServiceFromEnv()
	if err != nil {
		return true
	}
	session, _, err := service.SessionFromRequest(r)
	return err != nil || session == nil || strings.TrimSpace(session.User.ID) == ""
}
