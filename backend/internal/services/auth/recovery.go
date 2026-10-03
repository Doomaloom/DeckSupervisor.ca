package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// The redirect is server configuration, never a value supplied by the requesting browser.
func RecoveryRedirectURL() (string, error) {
	redirect, err := url.Parse(strings.TrimSpace(os.Getenv("SUPABASE_RECOVERY_REDIRECT_URL")))
	if err != nil || redirect.Host == "" || (redirect.Scheme != "https" && !(redirect.Scheme == "http" && (redirect.Hostname() == "localhost" || redirect.Hostname() == "127.0.0.1"))) {
		return "", errors.New("missing recovery redirect configuration")
	}
	if redirect.Path != "/reset-password" || redirect.RawQuery != "" || redirect.Fragment != "" {
		return "", errors.New("invalid recovery redirect path")
	}
	return redirect.String(), nil
}
func (s *Service) RequestRecovery(ctx context.Context, email string) error {
	redirect, err := RecoveryRedirectURL()
	if err != nil {
		return err
	}
	return s.recoveryRequest(ctx, http.MethodPost, "/auth/v1/recover?redirect_to="+url.QueryEscape(redirect), "", map[string]string{"email": email})
}
func (s *Service) VerifyRecovery(ctx context.Context, hash string) (*Session, error) {
	payload, err := s.authRequest(ctx, "/auth/v1/verify", map[string]string{"token_hash": hash, "type": "recovery"})
	if err != nil {
		return nil, err
	}
	session := payload.toSession()
	if session.User.ID == "" || session.AccessToken == "" {
		return nil, errors.New("invalid recovery session")
	}
	return &session, nil
}
func (s *Service) UpdateRecoveredPassword(ctx context.Context, token, password string) error {
	return s.recoveryRequest(ctx, http.MethodPut, "/auth/v1/user", token, map[string]string{"password": password})
}
func (s *Service) recoveryRequest(ctx context.Context, method, path, token string, payload map[string]string) error {
	data, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, method, s.supabaseURL+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.anonKey)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return errors.New("provider rejected password recovery request")
	}
	return nil
}
