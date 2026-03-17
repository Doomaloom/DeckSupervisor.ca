package handlers

import (
	"encoding/json"
	"net/http"

	authsvc "cob-aquatics/internal/services/auth"
)

type authCredentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type browserSessionResponse struct {
	TokenType string       `json:"token_type"`
	ExpiresIn int          `json:"expires_in"`
	ExpiresAt int64        `json:"expires_at"`
	User      authsvc.User `json:"user"`
}

func SignIn(w http.ResponseWriter, r *http.Request) {
	service, err := authsvc.NewServiceFromEnv()
	if err != nil {
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	var req authCredentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	session, refreshToken, err := service.SignIn(r.Context(), req.Email, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	service.SetSessionCookies(w, r, session, refreshToken)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": toBrowserSession(session), "user": session.User})
}

func SignUp(w http.ResponseWriter, r *http.Request) {
	service, err := authsvc.NewServiceFromEnv()
	if err != nil {
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	var req authCredentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, refreshToken, err := service.SignUp(r.Context(), req.Email, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if result.Session != nil {
		service.SetSessionCookies(w, r, result.Session, refreshToken)
	}

	w.Header().Set("Content-Type", "application/json")
	if result.Session != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"session": toBrowserSession(result.Session),
			"message": result.Message,
		})
		return
	}
	_ = json.NewEncoder(w).Encode(result)
}

func Session(w http.ResponseWriter, r *http.Request) {
	service, err := authsvc.NewServiceFromEnv()
	if err != nil {
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	session, refreshToken, err := service.SessionFromRequest(r)
	if err != nil {
		authsvc.ClearSessionCookies(w, r)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	service.SetSessionCookies(w, r, session, refreshToken)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"session": toBrowserSession(session), "user": session.User})
}

func SignOut(w http.ResponseWriter, r *http.Request) {
	service, err := authsvc.NewServiceFromEnv()
	if err != nil {
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	session, _, _ := service.SessionFromRequest(r)
	if session != nil {
		_ = service.SignOut(r.Context(), session.AccessToken)
	}

	authsvc.ClearSessionCookies(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func toBrowserSession(session *authsvc.Session) *browserSessionResponse {
	if session == nil {
		return nil
	}
	return &browserSessionResponse{
		TokenType: session.TokenType,
		ExpiresIn: session.ExpiresIn,
		ExpiresAt: session.ExpiresAt,
		User:      session.User,
	}
}
