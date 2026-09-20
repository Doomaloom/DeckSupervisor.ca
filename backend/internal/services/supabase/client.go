package supabase

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	authsvc "cob-aquatics/internal/services/auth"
)

type Client struct {
	supabaseURL string
	apiKey      string
	httpClient  *http.Client
	accessToken string
	User        authsvc.User
}

// APIError preserves PostgREST's permission status for HTTP handlers.
type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string { return e.Message }

func NewClientFromRequest(r *http.Request) (*Client, error) {
	authService, err := authsvc.NewServiceFromEnv()
	if err != nil {
		return nil, err
	}
	session, _, err := authService.SessionFromRequest(r)
	if err != nil || session == nil {
		return nil, errors.New("unauthorized")
	}

	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	anonKey := strings.TrimSpace(os.Getenv("SUPABASE_ANON_KEY"))
	if anonKey == "" {
		anonKey = strings.TrimSpace(os.Getenv("VITE_SUPABASE_ANON_KEY"))
	}
	if supabaseURL == "" || anonKey == "" {
		return nil, errors.New("missing supabase env config")
	}

	return &Client{
		supabaseURL: strings.TrimSuffix(supabaseURL, "/"),
		apiKey:      anonKey,
		httpClient:  &http.Client{Timeout: 15 * time.Second},
		accessToken: session.AccessToken,
		User:        session.User,
	}, nil
}

func NewServiceClientFromEnv() (*Client, error) {
	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	serviceRoleKey, err := ServiceKeyFromEnv()
	if supabaseURL == "" || err != nil {
		return nil, errors.New("missing supabase service env config")
	}

	return &Client{
		supabaseURL: strings.TrimSuffix(supabaseURL, "/"),
		apiKey:      serviceRoleKey,
		httpClient:  &http.Client{Timeout: 15 * time.Second},
	}, nil
}

// ServiceKeyFromEnv supports the legacy deployment name, but never treats a
// publishable/anon key as an administrative credential. Supabase validates the
// credential itself; decoding the configured JWT here only selects its kind.
func ServiceKeyFromEnv() (string, error) {
	for _, name := range []string{"SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"} {
		key := strings.TrimSpace(os.Getenv(name))
		if strings.HasPrefix(key, "sb_secret_") && len(key) > len("sb_secret_") {
			return key, nil
		}
		parts := strings.Split(key, ".")
		if len(parts) != 3 {
			continue
		}
		payload, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			continue
		}
		var claims struct {
			Role string `json:"role"`
		}
		if json.Unmarshal(payload, &claims) == nil && claims.Role == "service_role" {
			return key, nil
		}
	}
	return "", errors.New("missing valid Supabase service-role key")
}

func (c *Client) Get(ctx context.Context, path string, query url.Values, out any) error {
	return c.request(ctx, http.MethodGet, path, query, nil, "", out)
}

func (c *Client) Post(ctx context.Context, path string, query url.Values, body any, prefer string, out any) error {
	return c.request(ctx, http.MethodPost, path, query, body, prefer, out)
}

func (c *Client) Patch(ctx context.Context, path string, query url.Values, body any, prefer string, out any) error {
	return c.request(ctx, http.MethodPatch, path, query, body, prefer, out)
}

func (c *Client) Delete(ctx context.Context, path string, query url.Values, prefer string, out any) error {
	return c.request(ctx, http.MethodDelete, path, query, nil, prefer, out)
}

func (c *Client) RPC(ctx context.Context, name string, body any, out any) error {
	return c.request(ctx, http.MethodPost, "/rest/v1/rpc/"+name, nil, body, "", out)
}

func (c *Client) request(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	body any,
	prefer string,
	out any,
) error {
	fullURL := c.supabaseURL + path
	if len(query) > 0 {
		fullURL += "?" + query.Encode()
	}

	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		payload, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, reader)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", c.apiKey)
	if strings.TrimSpace(c.accessToken) != "" {
		req.Header.Set("Authorization", "Bearer "+c.accessToken)
	} else if looksLikeJWT(c.apiKey) {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	req.Header.Set("Content-Type", "application/json")
	if prefer != "" {
		req.Header.Set("Prefer", prefer)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var apiErr map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&apiErr); err == nil {
			if message, ok := apiErr["message"].(string); ok && strings.TrimSpace(message) != "" {
				return &APIError{StatusCode: resp.StatusCode, Message: message}
			}
			if message, ok := apiErr["msg"].(string); ok && strings.TrimSpace(message) != "" {
				return &APIError{StatusCode: resp.StatusCode, Message: message}
			}
			if message, ok := apiErr["error"].(string); ok && strings.TrimSpace(message) != "" {
				return &APIError{StatusCode: resp.StatusCode, Message: message}
			}
		}
		return &APIError{StatusCode: resp.StatusCode, Message: fmt.Sprintf("supabase request failed: %s", resp.Status)}
	}

	if out == nil || resp.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func looksLikeJWT(value string) bool {
	parts := strings.Split(strings.TrimSpace(value), ".")
	return len(parts) == 3
}
