package attendancesheets

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"

	"cob-aquatics/internal/services/attendance"
	supabasesvc "cob-aquatics/internal/services/supabase"
)

const (
	MaxNameLength       = 120
	MaxSkills           = 40
	MaxSkillLabelLength = 180
	MaxDetailLines      = 12
	MaxDetailLineLength = 240
)

type Service struct {
	client *supabasesvc.Client
}

type Sheet struct {
	ID                 string                     `json:"id"`
	TeamID             string                     `json:"teamId"`
	Name               string                     `json:"name"`
	BaseTemplate       *string                    `json:"baseTemplate"`
	DefaultForTemplate *string                    `json:"defaultForTemplate"`
	SheetData          attendance.SheetDefinition `json:"sheetData"`
	CreatedAt          string                     `json:"createdAt"`
	UpdatedAt          string                     `json:"updatedAt"`
}

type SaveInput struct {
	TeamID             string                     `json:"teamId"`
	Name               string                     `json:"name"`
	BaseTemplate       *string                    `json:"baseTemplate"`
	DefaultForTemplate *string                    `json:"defaultForTemplate"`
	SheetData          attendance.SheetDefinition `json:"sheetData"`
}

type row struct {
	ID                 string                     `json:"id"`
	TeamID             string                     `json:"team_id"`
	CreatedBy          string                     `json:"created_by"`
	Name               string                     `json:"name"`
	BaseTemplate       *string                    `json:"base_template"`
	DefaultForTemplate *string                    `json:"default_for_template"`
	SheetData          attendance.SheetDefinition `json:"sheet_data"`
	CreatedAt          string                     `json:"created_at"`
	UpdatedAt          string                     `json:"updated_at"`
}

type TemplateSeed struct {
	Template  string                     `json:"template"`
	SheetData attendance.SheetDefinition `json:"sheetData"`
}

var (
	tagPattern        = regexp.MustCompile(`(?is)<[^>]+>`)
	spacePattern      = regexp.MustCompile(`\s+`)
	rotateCellPattern = regexp.MustCompile(`(?is)<td[^>]*class="[^"]*rotate[^"]*"[^>]*>(.*?)</td>`)
	paragraphPattern  = regexp.MustCompile(`(?is)<p[^>]*>(.*?)</p>`)
	styleVarPattern   = regexp.MustCompile(`--([a-z-]+)\s*:\s*([0-9]+)px`)
	widthPattern      = regexp.MustCompile(`width:\s*([0-9]+)pt`)
)

func NewService(client *supabasesvc.Client) *Service {
	return &Service{client: client}
}

func (s *Service) List(ctx context.Context, teamID string) ([]Sheet, error) {
	teamID = strings.TrimSpace(teamID)
	if teamID == "" {
		return nil, errors.New("missing team id")
	}
	query := url.Values{}
	query.Set("team_id", "eq."+teamID)
	query.Set("select", "id,team_id,created_by,name,base_template,default_for_template,sheet_data,created_at,updated_at")
	query.Set("order", "updated_at.desc")
	var rows []row
	if err := s.client.Get(ctx, "/rest/v1/attendance_sheets", query, &rows); err != nil {
		return nil, err
	}
	sheets := make([]Sheet, 0, len(rows))
	for _, row := range rows {
		sheets = append(sheets, mapRow(row))
	}
	return sheets, nil
}

func (s *Service) Create(ctx context.Context, input SaveInput) (Sheet, error) {
	payload, err := s.payload(input)
	if err != nil {
		return Sheet{}, err
	}
	payload["created_by"] = s.client.User.ID
	var rows []row
	if err := s.client.Post(ctx, "/rest/v1/attendance_sheets", nil, payload, "return=representation", &rows); err != nil {
		return Sheet{}, err
	}
	if len(rows) == 0 {
		return Sheet{}, errors.New("failed to create attendance sheet")
	}
	return mapRow(rows[0]), nil
}

func (s *Service) Update(ctx context.Context, id string, input SaveInput) (Sheet, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return Sheet{}, errors.New("missing sheet id")
	}
	payload, err := s.payload(input)
	if err != nil {
		return Sheet{}, err
	}
	query := url.Values{}
	query.Set("id", "eq."+id)
	query.Set("team_id", "eq."+strings.TrimSpace(input.TeamID))
	var rows []row
	if err := s.client.Patch(ctx, "/rest/v1/attendance_sheets", query, payload, "return=representation", &rows); err != nil {
		return Sheet{}, err
	}
	if len(rows) == 0 {
		return Sheet{}, errors.New("attendance sheet not found")
	}
	return mapRow(rows[0]), nil
}

func (s *Service) Delete(ctx context.Context, id string, teamID string) error {
	id = strings.TrimSpace(id)
	teamID = strings.TrimSpace(teamID)
	if id == "" || teamID == "" {
		return errors.New("missing sheet context")
	}
	query := url.Values{}
	query.Set("id", "eq."+id)
	query.Set("team_id", "eq."+teamID)
	var rows []row
	return s.client.Delete(ctx, "/rest/v1/attendance_sheets", query, "return=representation", &rows)
}

func (s *Service) payload(input SaveInput) (map[string]any, error) {
	normalized, err := NormalizeInput(input)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	return map[string]any{
		"team_id":              normalized.TeamID,
		"name":                 normalized.Name,
		"base_template":        normalized.BaseTemplate,
		"default_for_template": normalized.DefaultForTemplate,
		"sheet_data":           normalized.SheetData,
		"updated_at":           now,
	}, nil
}

func NormalizeInput(input SaveInput) (SaveInput, error) {
	input.TeamID = strings.TrimSpace(input.TeamID)
	input.Name = strings.TrimSpace(input.Name)
	if input.TeamID == "" {
		return input, errors.New("missing team id")
	}
	if input.Name == "" {
		return input, errors.New("missing sheet name")
	}
	if len(input.Name) > MaxNameLength {
		return input, fmt.Errorf("sheet name must be %d characters or less", MaxNameLength)
	}
	input.BaseTemplate = cleanOptional(input.BaseTemplate)
	input.DefaultForTemplate = cleanOptional(input.DefaultForTemplate)
	sheet, err := NormalizeSheetData(input.SheetData, input.Name)
	if err != nil {
		return input, err
	}
	input.SheetData = sheet
	return input, nil
}

func NormalizeSheetData(sheet attendance.SheetDefinition, fallbackTitle string) (attendance.SheetDefinition, error) {
	if len(sheet.Skills) > MaxSkills {
		return sheet, fmt.Errorf("attendance sheet can have at most %d skills", MaxSkills)
	}
	sheet = attendance.NormalizeSheetDefinition(sheet, fallbackTitle)
	skills := make([]attendance.SheetSkill, 0, len(sheet.Skills))
	for _, skill := range sheet.Skills {
		skill.ID = strings.TrimSpace(skill.ID)
		skill.Label = strings.TrimSpace(skill.Label)
		if len(skill.Label) > MaxSkillLabelLength {
			return sheet, fmt.Errorf("skill labels must be %d characters or less", MaxSkillLabelLength)
		}
		if skill.Label == "" {
			continue
		}
		if len(skill.Details) > MaxDetailLines {
			return sheet, fmt.Errorf("each skill can have at most %d detail lines", MaxDetailLines)
		}
		details := make([]string, 0, len(skill.Details))
		for _, detail := range skill.Details {
			trimmed := strings.TrimSpace(detail)
			if trimmed == "" {
				continue
			}
			if len(trimmed) > MaxDetailLineLength {
				return sheet, fmt.Errorf("skill detail lines must be %d characters or less", MaxDetailLineLength)
			}
			details = append(details, trimmed)
		}
		skill.Details = details
		skills = append(skills, skill)
	}
	sheet.Skills = skills
	return sheet, nil
}

func Templates() ([]string, error) {
	dir, err := templatesDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	templates := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".html" {
			continue
		}
		templates = append(templates, strings.TrimSuffix(entry.Name(), ".html"))
	}
	sort.Strings(templates)
	return templates, nil
}

func SeedTemplate(template string) (TemplateSeed, error) {
	template = strings.TrimSpace(template)
	if template == "" {
		return TemplateSeed{}, errors.New("missing template")
	}
	dir, err := templatesDir()
	if err != nil {
		return TemplateSeed{}, err
	}
	path := filepath.Join(dir, template+".html")
	bytes, err := os.ReadFile(path)
	if err != nil {
		return TemplateSeed{}, errors.New("attendance template not found")
	}
	return TemplateSeed{
		Template:  template,
		SheetData: parseTemplateHTML(template, string(bytes)),
	}, nil
}

func parseTemplateHTML(template string, content string) attendance.SheetDefinition {
	title := templateTitle(template, content)
	sheet := attendance.SheetDefinition{
		Title:              title,
		HeaderLabel:        headerLabel(content),
		SheetWidthPx:       1300,
		RotateHeightPx:     300,
		RotateTranslatePx:  190,
		RotateTopPx:        100,
		SkillColumnWidthPt: 50,
		NameColumnWidthPt:  630,
		ShowPreviousLevel:  true,
		ShowResult:         true,
		ShowRegisterIn:     true,
	}
	applyTemplateDimensions(&sheet, content)

	details := extractDetails(content)
	matches := rotateCellPattern.FindAllStringSubmatch(content, -1)
	for _, match := range matches {
		label := cleanHTMLText(match[1])
		if shouldSkipHeader(label) {
			continue
		}
		skill := attendance.SheetSkill{
			ID:      stableSkillID(label),
			Label:   label,
			Details: details[skillNumber(label)],
		}
		sheet.Skills = append(sheet.Skills, skill)
	}
	return attendance.NormalizeSheetDefinition(sheet, title)
}

func applyTemplateDimensions(sheet *attendance.SheetDefinition, content string) {
	for _, match := range styleVarPattern.FindAllStringSubmatch(content, -1) {
		value := parsePositiveInt(match[2])
		switch match[1] {
		case "sheet-width":
			sheet.SheetWidthPx = value
		case "rotate-height":
			sheet.RotateHeightPx = value
		case "rotate-translate":
			sheet.RotateTranslatePx = value
		case "rotate-top":
			sheet.RotateTopPx = value
		}
	}
	if matches := widthPattern.FindAllStringSubmatch(content, -1); len(matches) > 0 {
		sheet.NameColumnWidthPt = parsePositiveInt(matches[0][1])
		if len(matches) > 1 {
			sheet.SkillColumnWidthPt = parsePositiveInt(matches[1][1])
		}
	}
}

func extractDetails(content string) map[string][]string {
	output := make(map[string][]string)
	for _, match := range paragraphPattern.FindAllStringSubmatch(content, -1) {
		text := cleanHTMLText(match[1])
		number := skillNumber(text)
		if number == "" {
			continue
		}
		lines := strings.Split(text, "•")
		if len(lines) <= 1 {
			continue
		}
		details := make([]string, 0, len(lines)-1)
		for _, line := range lines[1:] {
			if trimmed := strings.TrimSpace(line); trimmed != "" {
				details = append(details, trimmed)
			}
		}
		if len(details) > 0 {
			output[number] = details
		}
	}
	return output
}

func templateTitle(template string, content string) string {
	marker := regexp.MustCompile(`(?is)<font[^>]*size=["']?5["']?[^>]*>(.*?)</font>`)
	if match := marker.FindStringSubmatch(content); len(match) > 1 {
		if title := cleanHTMLText(match[1]); title != "" {
			return title
		}
	}
	return template
}

func headerLabel(content string) string {
	if strings.Contains(content, "Start Day/Time") {
		return "Start Day/Time"
	}
	return "Day/Time"
}

func cleanHTMLText(value string) string {
	value = strings.ReplaceAll(value, "<br>", " • ")
	value = strings.ReplaceAll(value, "<br/>", " • ")
	value = strings.ReplaceAll(value, "<br />", " • ")
	value = tagPattern.ReplaceAllString(value, " ")
	value = html.UnescapeString(value)
	value = strings.ReplaceAll(value, "\u00a0", " ")
	value = spacePattern.ReplaceAllString(value, " ")
	return strings.TrimSpace(value)
}

func shouldSkipHeader(label string) bool {
	normalized := strings.ToLower(strings.TrimSpace(label))
	return normalized == "" ||
		normalized == "previous level" ||
		strings.Contains(normalized, "result:") ||
		strings.Contains(normalized, "complete (c)") ||
		strings.Contains(normalized, "register in")
}

func skillNumber(label string) string {
	label = strings.TrimSpace(label)
	match := regexp.MustCompile(`^([0-9]+[a-z]?)\s*[.\x{00a0} ]`).FindStringSubmatch(strings.ToLower(label))
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

func stableSkillID(label string) string {
	normalized := strings.ToLower(label)
	normalized = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(normalized, "-")
	normalized = strings.Trim(normalized, "-")
	if normalized == "" {
		return "skill"
	}
	return normalized
}

func parsePositiveInt(value string) int {
	var parsed int
	_, _ = fmt.Sscanf(value, "%d", &parsed)
	return parsed
}

func cleanOptional(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func mapRow(row row) Sheet {
	return Sheet{
		ID:                 row.ID,
		TeamID:             row.TeamID,
		Name:               row.Name,
		BaseTemplate:       row.BaseTemplate,
		DefaultForTemplate: row.DefaultForTemplate,
		SheetData:          row.SheetData,
		CreatedAt:          row.CreatedAt,
		UpdatedAt:          row.UpdatedAt,
	}
}

func templatesDir() (string, error) {
	_, filename, _, ok := runtime.Caller(0)
	if ok {
		path := filepath.Join(filepath.Dir(filename), "..", "..", "..", "swimming attendance")
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}
	executable, err := os.Executable()
	if err == nil {
		path := filepath.Join(filepath.Dir(executable), "swimming attendance")
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}
	return "", errors.New("unable to resolve attendance templates path")
}

func MarshalSheetData(sheet attendance.SheetDefinition) json.RawMessage {
	bytes, _ := json.Marshal(sheet)
	return bytes
}
