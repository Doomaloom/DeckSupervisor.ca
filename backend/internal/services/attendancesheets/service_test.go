package attendancesheets

import (
	"strings"
	"testing"

	"cob-aquatics/internal/services/attendance"
)

func TestNormalizeSheetDataDefaultsAndLimits(t *testing.T) {
	t.Parallel()

	sheet, err := NormalizeSheetData(attendance.SheetDefinition{
		Skills: []attendance.SheetSkill{
			{ID: " a ", Label: " 1. Float ", Details: []string{" relaxed body ", ""}},
			{ID: "empty", Label: "   "},
		},
	}, "Fallback")
	if err != nil {
		t.Fatalf("NormalizeSheetData returned error: %v", err)
	}

	if sheet.Title != "Fallback" {
		t.Fatalf("expected fallback title, got %q", sheet.Title)
	}
	if sheet.HeaderLabel != "Day/Time" {
		t.Fatalf("expected default header label, got %q", sheet.HeaderLabel)
	}
	if len(sheet.Skills) != 1 {
		t.Fatalf("expected one non-empty skill, got %d", len(sheet.Skills))
	}
	if sheet.Skills[0].Details[0] != "relaxed body" {
		t.Fatalf("expected trimmed detail, got %#v", sheet.Skills[0].Details)
	}

	tooMany := attendance.SheetDefinition{}
	for i := 0; i < MaxSkills+1; i++ {
		tooMany.Skills = append(tooMany.Skills, attendance.SheetSkill{Label: "Skill"})
	}
	if _, err := NormalizeSheetData(tooMany, "Too Many"); err == nil {
		t.Fatal("expected max skills validation error")
	}
}

func TestNormalizeInputCleansOptionalFields(t *testing.T) {
	t.Parallel()

	base := " Splash1 "
	defaultFor := " "
	input, err := NormalizeInput(SaveInput{
		TeamID:             " team-1 ",
		Name:               " Custom ",
		BaseTemplate:       &base,
		DefaultForTemplate: &defaultFor,
		SheetData: attendance.SheetDefinition{
			Title: "Custom",
		},
	})
	if err != nil {
		t.Fatalf("NormalizeInput returned error: %v", err)
	}
	if input.TeamID != "team-1" || input.Name != "Custom" {
		t.Fatalf("expected trimmed team/name, got %q/%q", input.TeamID, input.Name)
	}
	if input.BaseTemplate == nil || *input.BaseTemplate != "Splash1" {
		t.Fatalf("expected cleaned base template, got %#v", input.BaseTemplate)
	}
	if input.DefaultForTemplate != nil {
		t.Fatalf("expected blank default to become nil, got %#v", input.DefaultForTemplate)
	}
}

func TestSeedTemplateParsesBuiltInSplash1(t *testing.T) {
	t.Parallel()

	seed, err := SeedTemplate("Splash1")
	if err != nil {
		t.Fatalf("SeedTemplate returned error: %v", err)
	}
	if seed.Template != "Splash1" {
		t.Fatalf("unexpected template %q", seed.Template)
	}
	if seed.SheetData.Title != "Splash 1" {
		t.Fatalf("unexpected title %q", seed.SheetData.Title)
	}
	if len(seed.SheetData.Skills) == 0 {
		t.Fatal("expected parsed skills")
	}
	if strings.Contains(strings.ToLower(seed.SheetData.Skills[0].Label), "previous level") {
		t.Fatalf("expected previous level to be skipped, got %q", seed.SheetData.Skills[0].Label)
	}
	found := false
	for _, skill := range seed.SheetData.Skills {
		if strings.Contains(skill.Label, "Enter and Exit Shallow Water") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected Splash 1 skills, got %#v", seed.SheetData.Skills[:min(3, len(seed.SheetData.Skills))])
	}
}
