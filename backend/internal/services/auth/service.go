package auth

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	AccessCookieName  = "decksupervisor_access_token"
	RefreshCookieName = "decksupervisor_refresh_token"
)

type Service struct {
	supabaseURL string
	anonKey     string
	httpClient  *http.Client
}

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type Session struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
	ExpiresAt   int64  `json:"expires_at"`
	User        User   `json:"user"`
}

type SignUpResult struct {
	Session *Session `json:"session,omitempty"`
	Message string   `json:"message,omitempty"`
}

type authResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	ExpiresAt    int64  `json:"expires_at"`
	RefreshToken string `json:"refresh_token"`
	User         User   `json:"user"`
}

func NewServiceFromEnv() (*Service, error) {
	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	anonKey := strings.TrimSpace(os.Getenv("SUPABASE_ANON_KEY"))
	if anonKey == "" {
		anonKey = strings.TrimSpace(os.Getenv("VITE_SUPABASE_ANON_KEY"))
	}
	if supabaseURL == "" || anonKey == "" {
		return nil, errors.New("missing supabase auth env config")
	}
	return &Service{
		supabaseURL: strings.TrimSuffix(supabaseURL, "/"),
		anonKey:     anonKey,
		httpClient:  &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (s *Service) SignIn(ctx context.Context, email, password string) (*Session, string, error) {
	payload, err := s.authRequest(ctx, "/auth/v1/token?grant_type=password", map[string]string{
		"email":    strings.TrimSpace(email),
		"password": password,
	})
	if err != nil {
		return nil, "", err
	}
	session := payload.toSession()
	return &session, payload.RefreshToken, nil
}

func (s *Service) SignUp(ctx context.Context, email, password string) (*SignUpResult, string, error) {
	payload, err := s.authRequest(ctx, "/auth/v1/signup", map[string]string{
		"email":    strings.TrimSpace(email),
		"password": password,
	})
	if err != nil {
		return nil, "", err
	}

	result := &SignUpResult{}
	if payload.AccessToken != "" {
		session := payload.toSession()
		result.Session = &session
		return result, payload.RefreshToken, nil
	}
	result.Message = "Check your email for a confirmation link."
	if payload.User.ID != "" {
		result.Session = nil
	}
	return result, "", nil
}

func (s *Service) SessionFromCookies(ctx context.Context, accessToken, refreshToken string) (*Session, string, error) {
	if strings.TrimSpace(accessToken) != "" {
		user, err := s.fetchUser(ctx, accessToken)
		if err == nil {
			return &Session{
				AccessToken: accessToken,
				TokenType:   "bearer",
				ExpiresAt:   parseJWTExpiry(accessToken),
				User:        user,
			}, refreshToken, nil
		}
	}
	if strings.TrimSpace(refreshToken) == "" {
		return nil, "", errors.New("missing refresh token")
	}
	payload, err := s.authRequest(ctx, "/auth/v1/token?grant_type=refresh_token", map[string]string{
		"refresh_token": refreshToken,
	})
	if err != nil {
		return nil, "", err
	}
	session := payload.toSession()
	return &session, payload.RefreshToken, nil
}

func (s *Service) SessionFromRequest(r *http.Request) (*Session, string, error) {
	accessToken := readCookie(r, AccessCookieName)
	refreshToken := readCookie(r, RefreshCookieName)
	return s.SessionFromCookies(r.Context(), accessToken, refreshToken)
}

func (s *Service) SignOut(ctx context.Context, accessToken string) error {
	if strings.TrimSpace(accessToken) == "" {
		return nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.supabaseURL+"/auth/v1/logout", nil)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.anonKey)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("logout failed: %s", resp.Status)
	}
	return nil
}

func (s *Service) authRequest(ctx context.Context, path string, payload map[string]string) (*authResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.supabaseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", s.anonKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var authErr struct {
			Msg              string `json:"msg"`
			Error            string `json:"error"`
			ErrorDescription string `json:"error_description"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&authErr); err == nil {
			message := firstNonEmpty(authErr.Msg, authErr.ErrorDescription, authErr.Error, resp.Status)
			return nil, errors.New(message)
		}
		return nil, fmt.Errorf("auth request failed: %s", resp.Status)
	}

	var result authResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) fetchUser(ctx context.Context, accessToken string) (User, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.supabaseURL+"/auth/v1/user", nil)
	if err != nil {
		return User{}, err
	}
	req.Header.Set("apikey", s.anonKey)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return User{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return User{}, fmt.Errorf("user lookup failed: %s", resp.Status)
	}

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return User{}, err
	}
	if user.ID == "" {
		return User{}, errors.New("missing user id")
	}
	return user, nil
}

func (s *Service) SetSessionCookies(w http.ResponseWriter, r *http.Request, session *Session, refreshToken string) {
	http.SetCookie(w, &http.Cookie{
		Name:     AccessCookieName,
		Value:    session.AccessToken,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(r),
		Expires:  expiryTime(session.ExpiresAt, session.ExpiresIn),
	})
	if strings.TrimSpace(refreshToken) != "" {
		http.SetCookie(w, &http.Cookie{
			Name:     RefreshCookieName,
			Value:    refreshToken,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   isSecureRequest(r),
			Expires:  time.Now().Add(30 * 24 * time.Hour),
		})
	}
}

func ClearSessionCookies(w http.ResponseWriter, r *http.Request) {
	for _, name := range []string{AccessCookieName, RefreshCookieName} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   isSecureRequest(r),
			MaxAge:   -1,
			Expires:  time.Unix(0, 0),
		})
	}
}

func (a *authResponse) toSession() Session {
	expiresAt := a.ExpiresAt
	if expiresAt == 0 {
		expiresAt = time.Now().Add(time.Duration(a.ExpiresIn) * time.Second).Unix()
	}
	return Session{
		AccessToken: a.AccessToken,
		TokenType:   firstNonEmpty(a.TokenType, "bearer"),
		ExpiresIn:   a.ExpiresIn,
		ExpiresAt:   expiresAt,
		User:        a.User,
	}
}

func readCookie(r *http.Request, name string) string {
	cookie, err := r.Cookie(name)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(cookie.Value)
}

func parseJWTExpiry(token string) int64 {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 3 {
		return 0
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return 0
	}
	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return 0
	}
	return claims.Exp
}

func expiryTime(expiresAt int64, expiresIn int) time.Time {
	if expiresAt > 0 {
		return time.Unix(expiresAt, 0)
	}
	if expiresIn > 0 {
		return time.Now().Add(time.Duration(expiresIn) * time.Second)
	}
	return time.Now().Add(time.Hour)
}

func isSecureRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
