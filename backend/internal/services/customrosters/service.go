package customrosters

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode"

	"github.com/golang-jwt/jwt/v5"
)

type Service struct {
	supabaseURL    string
	serviceRoleKey string
	jwtSecret      string
	pepper         string
	httpClient     *http.Client
}

type SaveRosterInput struct {
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
	jwtSecret := strings.TrimSpace(os.Getenv("SUPABASE_JWT_SECRET"))
	pepper := strings.TrimSpace(os.Getenv("CUSTOM_ROSTER_PEPPER"))

	if supabaseURL == "" || serviceRoleKey == "" || jwtSecret == "" || pepper == "" {
		return nil, errors.New("missing supabase env config")
	}

	return &Service{
		supabaseURL:    strings.TrimSuffix(supabaseURL, "/"),
		serviceRoleKey: serviceRoleKey,
		jwtSecret:      jwtSecret,
		pepper:         pepper,
		httpClient:     &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (s *Service) UserIDFromRequest(r *http.Request) (string, error) {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
		return "", errors.New("missing auth token")
	}
	tokenString := strings.TrimPrefix(auth, "Bearer ")
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", t.Method.Alg())
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return "", errors.New("invalid auth token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid auth claims")
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return "", errors.New("missing user id")
	}
	return sub, nil
}

func (s *Service) SaveRoster(ctx context.Context, userID string, input SaveRosterInput) error {
	if input.ID == "" || input.Day == "" || input.ServiceName == "" {
		return errors.New("missing required roster fields")
	}

	sourceCodes := input.SourceCodes
	if sourceCodes == nil {
		sourceCodes = []string{}
	}
	hashes := hashNames(input.StudentNames, s.pepper)
	payload := map[string]interface{}{
		"day":            input.Day,
		"service_name":   input.ServiceName,
		"instructor":     strings.TrimSpace(input.Instructor),
		"source_codes":   sourceCodes,
		"student_hashes": hashes,
		"updated_at":     time.Now().UTC().Format(time.RFC3339),
	}

	updated, err := s.patchRoster(ctx, userID, input.ID, payload)
	if err != nil {
		return err
	}
	if updated {
		return nil
	}

	payload["id"] = input.ID
	payload["owner_id"] = userID
	payload["created_at"] = time.Now().UTC().Format(time.RFC3339)
	return s.insertRoster(ctx, payload)
}

func (s *Service) ResolveRosters(ctx context.Context, userID, day string, students []StudentRef) ([]ResolvedRoster, error) {
	if day == "" {
		return nil, errors.New("missing day")
	}
	rows, err := s.fetchRosters(ctx, userID, day)
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

func (s *Service) DeleteRoster(ctx context.Context, userID, rosterID string) error {
	if rosterID == "" {
		return errors.New("missing roster id")
	}
	endpoint := fmt.Sprintf("%s/rest/v1/custom_rosters?id=eq.%s&owner_id=eq.%s", s.supabaseURL, rosterID, userID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)
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

func (s *Service) patchRoster(ctx context.Context, userID, rosterID string, payload map[string]interface{}) (bool, error) {
	endpoint := fmt.Sprintf("%s/rest/v1/custom_rosters?id=eq.%s&owner_id=eq.%s", s.supabaseURL, rosterID, userID)
	body, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, endpoint, bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	req.Header.Set("apikey", s.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")
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

func (s *Service) insertRoster(ctx context.Context, payload map[string]interface{}) error {
	endpoint := fmt.Sprintf("%s/rest/v1/custom_rosters", s.supabaseURL)
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")
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

func (s *Service) fetchRosters(ctx context.Context, userID, day string) ([]rosterRow, error) {
	endpoint := fmt.Sprintf("%s/rest/v1/custom_rosters?owner_id=eq.%s&day=eq.%s&select=id,service_name,instructor,source_codes,student_hashes,created_at", s.supabaseURL, userID, day)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", s.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+s.serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")

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
