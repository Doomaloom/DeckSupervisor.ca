package attendance

import (
	"strings"
	"testing"
)

func TestExtractTemplateSections(t *testing.T) {
	templateHTML := `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Test</title>
</head>
<body class="test-body">
  <div class="relative">
    <div id="document" class="doc-shell">
      <div class="templatePage page-shell" style="--sheet-width: 100px;">
        <table id="front-table"><tbody id="attendance-rows"><tr id="student-rows"><td>Front</td></tr></tbody></table>
        <p class="break-before-page"><span></span></p>
        <div class="h-0"></div>
        <table id="back-table"><tbody><tr><td>Back</td></tr></tbody></table>
      </div>
    </div>
  </div>
</body>
</html>`

	sections, err := extractTemplateSections(templateHTML)
	if err != nil {
		t.Fatalf("extractTemplateSections returned error: %v", err)
	}

	if !strings.Contains(sections.BodyAttrsHTML, `class="test-body"`) {
		t.Fatalf("expected body attrs to be preserved, got %q", sections.BodyAttrsHTML)
	}
	if !strings.Contains(sections.DocumentAttrs, `id="document"`) {
		t.Fatalf("expected document attrs to include id=document, got %q", sections.DocumentAttrs)
	}
	if !strings.Contains(sections.PageAttrs, `class="templatePage page-shell"`) {
		t.Fatalf("expected page attrs to preserve template page classes, got %q", sections.PageAttrs)
	}
	if !strings.Contains(sections.FrontInnerHTML, `id="attendance-rows"`) {
		t.Fatalf("expected front html to include attendance table, got %q", sections.FrontInnerHTML)
	}
	if strings.Contains(sections.FrontInnerHTML, `break-before-page`) {
		t.Fatalf("expected front html to exclude break marker, got %q", sections.FrontInnerHTML)
	}
	if !strings.Contains(sections.BackInnerHTML, `id="back-table"`) {
		t.Fatalf("expected back html to include back content, got %q", sections.BackInnerHTML)
	}
}

func TestBuildCombinedTemplateHTML(t *testing.T) {
	combinedHTML, err := buildCombinedTemplateHTML([]templateSections{
		{
			HeadInnerHTML:  `<title>One</title>`,
			BodyAttrsHTML:  ` class="bg-white"`,
			DocumentAttrs:  ` id="document" class="doc-shell"`,
			PageAttrs:      ` class="templatePage page-one" style="--sheet-width: 100px;"`,
			FrontInnerHTML: `<div id="front-one">Front One</div>`,
			BackInnerHTML:  `<div id="back-one">Back One</div>`,
		},
		{
			HeadInnerHTML:  `<title>Two</title>`,
			BodyAttrsHTML:  ` class="bg-white"`,
			DocumentAttrs:  ` id="document" class="doc-shell"`,
			PageAttrs:      ` class="templatePage page-two" style="--sheet-width: 100px;"`,
			FrontInnerHTML: `<div id="front-two">Front Two</div>`,
			BackInnerHTML:  `<div id="back-two">Back Two</div>`,
		},
	})
	if err != nil {
		t.Fatalf("buildCombinedTemplateHTML returned error: %v", err)
	}

	if strings.Count(combinedHTML, `data-attendance-root="0"`) != 2 {
		t.Fatalf("expected two rendered fragments for roster 0, got html %q", combinedHTML)
	}
	if strings.Count(combinedHTML, `data-attendance-root="1"`) != 2 {
		t.Fatalf("expected two rendered fragments for roster 1, got html %q", combinedHTML)
	}

	frontOneIndex := strings.Index(combinedHTML, "Front One")
	frontTwoIndex := strings.Index(combinedHTML, "Front Two")
	backOneIndex := strings.Index(combinedHTML, "Back One")
	backTwoIndex := strings.Index(combinedHTML, "Back Two")
	if !(frontOneIndex >= 0 && frontTwoIndex > frontOneIndex && backOneIndex > frontTwoIndex && backTwoIndex > backOneIndex) {
		t.Fatalf("expected fronts before backs in combined html, got %q", combinedHTML)
	}
}

func TestBuildCustomSheetHTMLFromTemplatePreservesTemplateShellAndReplacesEditableContent(t *testing.T) {
	html, err := buildCustomSheetHTMLFromTemplate("Splash1", NormalizeSheetDefinition(SheetDefinition{
		BaseTemplate:       "Splash1",
		Title:              "Custom Splash 1",
		ShowPreviousLevel:  true,
		ShowResult:         true,
		ShowRegisterIn:     true,
		SkillColumnWidthPt: 50,
		Skills: []SheetSkill{
			{
				ID:      "custom-entry",
				Label:   "1. Custom Entry Skill",
				Details: []string{"Custom detail line"},
			},
		},
	}, "Splash 1"))
	if err != nil {
		t.Fatalf("buildCustomSheetHTMLFromTemplate returned error: %v", err)
	}

	required := []string{
		`class="templatePage`,
		`id="attendance-rows"`,
		`id="student-rows"`,
		`id="instructor"`,
		`id="start_time"`,
		`id="session"`,
		`id="location"`,
		`id="barcode"`,
		"Custom Splash 1",
		"1. Custom Entry Skill",
		"Custom detail line",
	}
	for _, needle := range required {
		if !strings.Contains(html, needle) {
			t.Fatalf("expected custom template html to contain %q", needle)
		}
	}
	if strings.Contains(html, "Enter and Exit Shallow Water") {
		t.Fatal("expected original skill label to be replaced")
	}
}

func TestBuildCustomSheetHTMLUsesGenericLayoutForBlankSheets(t *testing.T) {
	html := buildCustomSheetHTML(NormalizeSheetDefinition(SheetDefinition{
		Title:             "Blank Custom",
		ShowPreviousLevel: false,
		ShowResult:        true,
		ShowRegisterIn:    false,
		Skills: []SheetSkill{
			{Label: "1. Blank Skill", Details: []string{"Blank detail"}},
		},
	}, "Blank Custom"))

	if !strings.Contains(html, "Blank Custom") || !strings.Contains(html, "1. Blank Skill") {
		t.Fatalf("expected generic custom html to contain blank sheet content")
	}
	if strings.Contains(html, "Previous Level") || strings.Contains(html, "Register In") {
		t.Fatalf("expected disabled fixed columns to be omitted")
	}
}
