package customrosters

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode"
)

type Service struct {
	supabaseURL    string
	serviceRoleKey string
	pepper         string
	httpClient     *http.Client
}

type SaveRosterInput struct {
	SessionID    string
	ID           string
	Day          string
	ServiceName  string
	Instructor   string
	SourceCodes  []string
	StudentNames []string
}

type StudentRef struct {
	ID   string
	Name string
}

type ResolvedRoster struct {
	ID          string   `json:"id"`
	ServiceName string   `json:"serviceName"`
	Instructor  string   `json:"instructor"`
	SourceCodes []string `json:"sourceCodes"`
	StudentIds  []string `json:"studentIds"`
	CreatedAt   string   `json:"createdAt"`
}

type rosterRow struct {
	ID            string   `json:"id"`
	ServiceName   string   `json:"service_name"`
	Instructor    *string  `json:"instructor"`
	SourceCodes   []string `json:"source_codes"`
	StudentHashes []string `json:"student_hashes"`
	CreatedAt     string   `json:"created_at"`
}

func NewServiceFromEnv() (*Service, error) {
	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	serviceRoleKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	pepper := strings.TrimSpace(os.Getenv("CUSTOM_ROSTER_PEPPER"))

	if supabaseURL == "" || serviceRoleKey == "" || pepper == "" {
		return nil, errors.New("missing supabase env config")
	}

	return &Service{
		supabaseURL:    strings.TrimSuffix(supabaseURL, "/"),
		serviceRoleKey: serviceRoleKey,
		pepper:         pepper,
		httpClient:     &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (s *Service) UserIDFromRequest(r *http.Request) (string, string, error) {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
		return "", "", errors.New("missing auth token")
	}

	tokenString := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	if tokenString == "" {
		return "", "", errors.New("missing auth token")
	}

	endpoint := fmt.Sprintf("%s/auth/v1/user", s.supabaseURL)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, endpoint, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("apikey", s.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+tokenString)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", errors.New("invalid auth token")
	}

	var user struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return "", "", errors.New("invalid auth response")
	}
	if user.ID == "" {
		return "", "", errors.New("missing user id")
	}
	return user.ID, tokenString, nil
}

func (s *Service) SaveRoster(ctx context.Context, requestToken, userID string, input SaveRosterInput) error {
	if input.ID == "" || input.SessionID == "" || input.Day == "" || input.ServiceName == "" {
		return errors.New("missing required roster fields")
	}

	canEdit, err := s.canEditSession(ctx, requestToken, userID, input.SessionID)
	if err != nil {
		return err
	}
	if !canEdit {
		return errors.New("forbidden")
	}

	sourceCodes := input.SourceCodes
	if sourceCodes == nil {
		sourceCodes = []string{}
	}
	hashes := hashNames(input.StudentNames, s.pepper)
	payload := map[string]interface{}{
		"session_id":     input.SessionID,
		"day":            input.Day,
		"service_name":   input.ServiceName,
		"instructor":     strings.TrimSpace(input.Instructor),
		"source_codes":   sourceCodes,
		"student_hashes": hashes,
		"updated_at":     time.Now().UTC().Format(time.RFC3339),
	}

	updated, err := s.patchRoster(ctx, requestToken, userID, input.SessionID, input.ID, payload)
	if err != nil {
		return err
	}
	if updated {
		return nil
	}

	payload["id"] = input.ID
	payload["owner_id"] = userID
	payload["created_at"] = time.Now().UTC().Format(time.RFC3339)
	return s.insertRoster(ctx, requestToken, payload)
}

func (s *Service) ResolveRosters(ctx context.Context, requestToken, userID, sessionID, day string, students []StudentRef) ([]ResolvedRoster, error) {
	if day == "" || sessionID == "" {
		return nil, errors.New("missing session context")
	}

	canRead, err := s.canReadSession(ctx, requestToken, userID, sessionID)
	if err != nil {
		return nil, err
	}
	if !canRead {
		return nil, errors.New("forbidden")
	}

	rows, err := s.fetchRosters(ctx, requestToken, sessionID, day)
	if err != nil {
		return nil, err
	}
	hashToStudentIds := make(map[string][]string)
	for _, student := range students {
		if student.ID == "" || strings.TrimSpace(student.Name) == "" {
			continue
		}
		hash := hashName(student.Name, s.pepper)
		if hash == "" {
			continue
		}
		hashToStudentIds[hash] = append(hashToStudentIds[hash], student.ID)
	}

	resolved := make([]ResolvedRoster, 0, len(rows))
	for _, row := range rows {
		idsSet := make(map[string]struct{})
		for _, hash := range row.StudentHashes {
			ids := hashToStudentIds[hash]
			for _, id := range ids {
				idsSet[id] = struct{}{}
			}
		}
		studentIds := make([]string, 0, len(idsSet))
		for id := range idsSet {
			studentIds = append(studentIds, id)
		}
		instructor := ""
		if row.Instructor != nil {
			instructor = *row.Instructor
		}
		resolved = append(resolved, ResolvedRoster{
			ID:          row.ID,
			ServiceName: row.ServiceName,
			Instructor:  instructor,
			SourceCodes: row.SourceCodes,
			StudentIds:  studentIds,
			CreatedAt:   row.CreatedAt,
		})
	}
	return resolved, nil
}

func (s *Service) DeleteRoster(ctx context.Context, requestToken, userID, sessionID, rosterID string) error {
	if rosterID == "" || sessionID == "" {
		return errors.New("missing roster context")
	}

	canEdit, err := s.canEditSession(ctx, requestToken, userID, sessionID)
	if err != nil {
		return err
	}
	if !canEdit {
		return errors.New("forbidden")
	}
	endpoint := fmt.Sprintf(
		"%s/rest/v1/custom_rosters?id=eq.%s&owner_id=eq.%s&session_id=eq.%s",
		s.supabaseURL,
		url.QueryEscape(rosterID),
		url.QueryEscape(userID),
		url.QueryEscape(sessionID),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return err
	}
	s.applyServiceHeaders(req, requestToken)
	req.Header.Set("Prefer", "return=representation")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("delete failed: %s", resp.Status)
	}
	return nil
}

func (s *Service) patchRoster(ctx context.Context, requestToken, userID, sessionID, rosterID string, payload map[string]interface{}) (bool, error) {
	endpoint := fmt.Sprintf(
		"%s/rest/v1/custom_rosters?id=eq.%s&owner_id=eq.%s&session_id=eq.%s",
		s.supabaseURL,
		url.QueryEscape(rosterID),
		url.QueryEscape(userID),
		url.QueryEscape(sessionID),
	)
	body, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, endpoint, bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	s.applyServiceHeaders(req, requestToken)
	req.Header.Set("Prefer", "return=representation")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return false, fmt.Errorf("update failed: %s", resp.Status)
	}
	var rows []rosterRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return false, err
	}
	return len(rows) > 0, nil
}

func (s *Service) insertRoster(ctx context.Context, requestToken string, payload map[string]interface{}) error {
	endpoint := fmt.Sprintf("%s/rest/v1/custom_rosters", s.supabaseURL)
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	s.applyServiceHeaders(req, requestToken)
	req.Header.Set("Prefer", "return=representation")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("insert failed: %s", resp.Status)
	}
	return nil
}

func (s *Service) fetchRosters(ctx context.Context, requestToken, sessionID, day string) ([]rosterRow, error) {
	endpoint := fmt.Sprintf(
		"%s/rest/v1/custom_rosters?session_id=eq.%s&day=eq.%s&select=id,service_name,instructor,source_codes,student_hashes,created_at",
		s.supabaseURL,
		url.QueryEscape(sessionID),
		url.QueryEscape(day),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	s.applyServiceHeaders(req, requestToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("fetch failed: %s", resp.Status)
	}
	var rows []rosterRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *Service) canEditSession(ctx context.Context, requestToken, userID, sessionID string) (bool, error) {
	if allowed, err := s.sessionAccessRPC(ctx, requestToken, "can_edit_session", userID, sessionID); err == nil {
		return allowed, nil
	}
	return s.legacyCanEditSession(ctx, requestToken, userID, sessionID)
}

func (s *Service) canReadSession(ctx context.Context, requestToken, userID, sessionID string) (bool, error) {
	if allowed, err := s.sessionAccessRPC(ctx, requestToken, "can_read_session", userID, sessionID); err == nil {
		return allowed, nil
	}
	return s.legacyCanReadSession(ctx, requestToken, userID, sessionID)
}

func (s *Service) sessionAccessRPC(
	ctx context.Context,
	requestToken string,
	functionName string,
	userID string,
	sessionID string,
) (bool, error) {
	endpoint := fmt.Sprintf("%s/rest/v1/rpc/%s", s.supabaseURL, functionName)
	body, err := json.Marshal(map[string]string{
		"p_session_id": sessionID,
		"p_uid":        userID,
	})
	if err != nil {
		return false, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	s.applyServiceHeaders(req, requestToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return false, fmt.Errorf("rpc %s failed: %s", functionName, resp.Status)
	}
	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, err
	}
	return parseRPCBoolean(payload, functionName)
}

func parseRPCBoolean(payload []byte, functionName string) (bool, error) {
	var scalar bool
	if err := json.Unmarshal(payload, &scalar); err == nil {
		return scalar, nil
	}

	var object map[string]bool
	if err := json.Unmarshal(payload, &object); err == nil {
		if value, ok := object[functionName]; ok {
			return value, nil
		}
		if value, ok := object["result"]; ok {
			return value, nil
		}
	}

	var rows []map[string]bool
	if err := json.Unmarshal(payload, &rows); err == nil && len(rows) > 0 {
		if value, ok := rows[0][functionName]; ok {
			return value, nil
		}
		if value, ok := rows[0]["result"]; ok {
			return value, nil
		}
	}

	return false, errors.New("unexpected rpc response")
}

func (s *Service) legacyCanEditSession(ctx context.Context, requestToken, userID, sessionID string) (bool, error) {
	endpoint := fmt.Sprintf(
		"%s/rest/v1/sessions?id=eq.%s&created_by=eq.%s&select=id&limit=1",
		s.supabaseURL,
		url.QueryEscape(sessionID),
		url.QueryEscape(userID),
	)
	return s.endpointHasRows(ctx, requestToken, endpoint)
}

func (s *Service) legacyCanReadSession(ctx context.Context, requestToken, userID, sessionID string) (bool, error) {
	canEdit, err := s.legacyCanEditSession(ctx, requestToken, userID, sessionID)
	if err != nil {
		return false, err
	}
	if canEdit {
		return true, nil
	}
	endpoint := fmt.Sprintf(
		"%s/rest/v1/session_shares?session_id=eq.%s&shared_with=eq.%s&share_date=eq.%s&select=id&limit=1",
		s.supabaseURL,
		url.QueryEscape(sessionID),
		url.QueryEscape(userID),
		url.QueryEscape(torontoToday()),
	)
	return s.endpointHasRows(ctx, requestToken, endpoint)
}

func torontoToday() string {
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		return time.Now().UTC().Format("2006-01-02")
	}
	return time.Now().In(loc).Format("2006-01-02")
}

func (s *Service) endpointHasRows(ctx context.Context, requestToken, endpoint string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return false, err
	}
	s.applyServiceHeaders(req, requestToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return false, fmt.Errorf("access check failed: %s", resp.Status)
	}

	var rows []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return false, err
	}
	return len(rows) > 0, nil
}

func hashNames(names []string, pepper string) []string {
	hashes := make([]string, 0, len(names))
	seen := make(map[string]struct{})
	for _, name := range names {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}
		hash := hashName(trimmed, pepper)
		if hash == "" {
			continue
		}
		if _, exists := seen[hash]; exists {
			continue
		}
		seen[hash] = struct{}{}
		hashes = append(hashes, hash)
	}
	return hashes
}

func hashName(name string, pepper string) string {
	normalized := normalizeName(name)
	if normalized == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(normalized + ":" + pepper))
	return hex.EncodeToString(sum[:])
}

func normalizeName(name string) string {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return ""
	}
	var builder strings.Builder
	prevSpace := false
	for _, r := range lower {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			builder.WriteRune(r)
			prevSpace = false
			continue
		}
		if !prevSpace {
			builder.WriteRune(' ')
			prevSpace = true
		}
	}
	return strings.TrimSpace(builder.String())
}

func (s *Service) applyServiceHeaders(req *http.Request, requestToken string) {
	req.Header.Set("apikey", s.serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(requestToken) != "" {
		req.Header.Set("Authorization", "Bearer "+requestToken)
		return
	}
	// Newer Supabase "secret keys" (sb_secret_*) are not JWTs and cannot be used as Bearer tokens.
	if looksLikeJWT(s.serviceRoleKey) {
		req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)
	}
}

func looksLikeJWT(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	return strings.Count(trimmed, ".") == 2
}
