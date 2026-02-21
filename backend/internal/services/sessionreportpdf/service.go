package sessionreportpdf

import (
	"context"
	"errors"
	"fmt"
	"html"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"cob-aquatics/internal/services/files"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

type InstructorTextEntry struct {
	Instructor string `json:"instructor"`
	Text       string `json:"text"`
}

type StrengthWeaknessEntry struct {
	Instructor string   `json:"instructor"`
	Strengths  []string `json:"strengths"`
	Weaknesses []string `json:"weaknesses"`
}

type InstructorCoverEntry struct {
	Instructor string `json:"instructor"`
	CoveredBy  string `json:"coveredBy"`
	Details    string `json:"details"`
}

type StaffSection struct {
	Performance      []InstructorTextEntry   `json:"performance"`
	StrengthWeakness []StrengthWeaknessEntry `json:"strengthWeakness"`
	SuccessionPlans  []InstructorTextEntry   `json:"successionPlans"`
	InstructorCovers []InstructorCoverEntry  `json:"instructorCovers"`
}

type ChallengingTimeEntry struct {
	Time        string `json:"time"`
	Lessons     string `json:"lessons"`
	Description string `json:"description"`
}

type NewClassLayoutEntry struct {
	Level       string `json:"level"`
	Description string `json:"description"`
}

type LessonStructureSection struct {
	ChallengingTimes []ChallengingTimeEntry `json:"challengingTimes"`
	NewClassLayouts  []NewClassLayoutEntry  `json:"newClassLayouts"`
}

type SafetyConcernEntry struct {
	ConcernType string `json:"concernType"`
	Description string `json:"description"`
}

type ItemDescriptionEntry struct {
	Item        string `json:"item"`
	Description string `json:"description"`
}

type SafetyFacilitySection struct {
	SafetyConcerns       []SafetyConcernEntry   `json:"safetyConcerns"`
	MaintenanceIssues    []ItemDescriptionEntry `json:"maintenanceIssues"`
	PoolDeckWorksWell    []ItemDescriptionEntry `json:"poolDeckWorksWell"`
	PoolDeckImprovements []ItemDescriptionEntry `json:"poolDeckImprovements"`
}

type ParentFeedbackEntry struct {
	FeedbackType string `json:"feedbackType"`
	Description  string `json:"description"`
}

type AdminWorkEntry struct {
	Work        string `json:"work"`
	Description string `json:"description"`
}

type InitiativeEntry struct {
	Title string `json:"title"`
	Brief string `json:"brief"`
}

type ProjectsInitiativesSection struct {
	AdminWork   []AdminWorkEntry  `json:"adminWork"`
	Initiatives []InitiativeEntry `json:"initiatives"`
}

type Request struct {
	Title                  string                     `json:"title"`
	SessionContext         string                     `json:"sessionContext"`
	AuthorName             string                     `json:"authorName"`
	CreatedAt              string                     `json:"createdAt"`
	UpdatedAt              string                     `json:"updatedAt"`
	Staff                  StaffSection               `json:"staff"`
	LessonStructure        LessonStructureSection     `json:"lessonStructure"`
	SafetyFacility         SafetyFacilitySection      `json:"safetyFacility"`
	ParentCustomerFeedback []ParentFeedbackEntry      `json:"parentCustomerFeedback"`
	ProjectsInitiatives    ProjectsInitiativesSection `json:"projectsInitiatives"`
}

type Output struct {
	Data     []byte
	Filename string
}

func BuildPDF(ctx context.Context, req Request) (Output, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Session Report"
	}

	htmlContent := buildHTML(req, title)
	pdfBytes, err := renderPDF(ctx, htmlContent)
	if err != nil {
		return Output{}, err
	}

	filename := fmt.Sprintf("%s.pdf", files.SanitizeFilename(title))
	if filename == "sheet.pdf" {
		filename = fmt.Sprintf("session-report-%s.pdf", time.Now().Format("2006-01-02"))
	}

	return Output{
		Data:     pdfBytes,
		Filename: filename,
	}, nil
}

func buildHTML(req Request, title string) string {
	var b strings.Builder
	b.WriteString("<!doctype html><html><head><meta charset=\"utf-8\"/>")
	b.WriteString("<style>")
	b.WriteString(`
@page { size: letter portrait; margin: 1in; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Times New Roman", Times, serif; color: #000; font-size: 12pt; line-height: 1.45; }
h1 { margin: 0; font-size: 20pt; font-weight: 700; text-align: center; }
h2 { margin: 0; font-size: 14pt; font-weight: 700; }
h3 { margin: 0; font-size: 12pt; font-weight: 700; }
p { margin: 0 0 6pt 0; }
ul { margin: 4pt 0 8pt 20pt; padding: 0; }
li { margin: 0 0 2pt 0; }
.page-title { margin: 0 0 14pt 0; page-break-inside: avoid; }
.meta-grid { margin: 0 0 10pt 0; page-break-inside: avoid; }
.meta-card { margin: 0 0 4pt 0; }
.meta-label { display: inline; font-size: 11pt; font-weight: 700; margin-right: 6pt; }
.section { margin-top: 12pt; page-break-inside: avoid; }
.section-title { margin: 0 0 8pt 0; border-bottom: 1px solid #000; padding-bottom: 3pt; }
.subsection { margin-top: 8pt; page-break-inside: avoid; }
.subsection h3 { margin-bottom: 4pt; }
.entry { margin: 6pt 0 0 10pt; padding-left: 8pt; border-left: 1.5pt solid #000; page-break-inside: avoid; }
.entry-title { font-weight: 700; margin-bottom: 3pt; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }
.muted { color: #444; font-style: italic; }
.small-label { font-size: 10pt; font-weight: 700; display: block; margin-bottom: 2pt; }
.pair { margin-top: 3pt; }
.divider { margin-top: 8pt; border-top: 1px solid #000; }
`)
	b.WriteString("</style></head><body>")

	b.WriteString("<div class=\"page-title\">")
	b.WriteString("<h1>" + escape(title) + "</h1>")
	b.WriteString("<p class=\"muted\" style=\"margin-top:4pt;text-align:center;\">Formal Session Report</p>")
	b.WriteString("</div>")

	b.WriteString("<div class=\"meta-grid\">")
	b.WriteString(metaCard("Author", req.AuthorName))
	b.WriteString(metaCard("Session", req.SessionContext))
	b.WriteString(metaCard("Created", formatTime(req.CreatedAt)))
	b.WriteString(metaCard("Last Updated", formatTime(req.UpdatedAt)))
	b.WriteString("</div>")

	b.WriteString("<section class=\"section\"><h2 class=\"section-title\">1) Staff</h2>")
	b.WriteString(renderInstructorTextEntries("Performance", req.Staff.Performance))
	b.WriteString(renderStrengthWeakness(req.Staff.StrengthWeakness))
	b.WriteString(renderInstructorTextEntries("Succession Plans", req.Staff.SuccessionPlans))
	b.WriteString(renderInstructorCovers(req.Staff.InstructorCovers))
	b.WriteString("</section>")

	b.WriteString("<section class=\"section\"><h2 class=\"section-title\">2) Lesson Structure</h2>")
	b.WriteString(renderChallengingTimes(req.LessonStructure.ChallengingTimes))
	b.WriteString(renderNewClassLayouts(req.LessonStructure.NewClassLayouts))
	b.WriteString("</section>")

	b.WriteString("<section class=\"section\"><h2 class=\"section-title\">3) Safety and Facility Observations</h2>")
	b.WriteString(renderSafetyConcerns(req.SafetyFacility.SafetyConcerns))
	b.WriteString(renderItemDescriptionEntries("Recurring Equipment / Maintenance Issues", req.SafetyFacility.MaintenanceIssues))
	b.WriteString(renderItemDescriptionEntries("Pool Deck Setup - What Works Well", req.SafetyFacility.PoolDeckWorksWell))
	b.WriteString(renderItemDescriptionEntries("Pool Deck Setup - What Can Improve", req.SafetyFacility.PoolDeckImprovements))
	b.WriteString("</section>")

	b.WriteString("<section class=\"section\"><h2 class=\"section-title\">4) Parent / Customer Feedback</h2>")
	b.WriteString(renderParentFeedback(req.ParentCustomerFeedback))
	b.WriteString("</section>")

	b.WriteString("<section class=\"section\"><h2 class=\"section-title\">5) Projects and/or Initiatives</h2>")
	b.WriteString(renderAdminWork(req.ProjectsInitiatives.AdminWork))
	b.WriteString(renderInitiatives(req.ProjectsInitiatives.Initiatives))
	b.WriteString("</section>")

	b.WriteString("</body></html>")
	return b.String()
}

func metaCard(label, value string) string {
	return fmt.Sprintf("<p class=\"meta-card\"><span class=\"meta-label\">%s:</span>%s</p>", escape(label), optionalText(value))
}

func renderInstructorTextEntries(title string, entries []InstructorTextEntry) string {
	var b strings.Builder
	b.WriteString("<div class=\"subsection\"><h3>" + escape(title) + "</h3>")
	filtered := make([]InstructorTextEntry, 0, len(entries))
	for _, entry := range entries {
		if strings.TrimSpace(entry.Instructor) == "" {
			continue
		}
		filtered = append(filtered, entry)
	}
	if len(filtered) == 0 {
		b.WriteString("<p class=\"muted\">None reported.</p></div>")
		return b.String()
	}
	for _, entry := range filtered {
		b.WriteString("<div class=\"entry\"><p class=\"entry-title\">" + escape(entry.Instructor) + "</p>")
		b.WriteString("<p>" + optionalMultiline(entry.Text) + "</p></div>")
	}
	b.WriteString("</div>")
	return b.String()
}

func renderStrengthWeakness(entries []StrengthWeaknessEntry) string {
	var b strings.Builder
	b.WriteString("<div class=\"subsection\"><h3>Strengths / Weaknesses</h3>")
	if len(entries) == 0 {
		b.WriteString("<p class=\"muted\">None reported.</p></div>")
		return b.String()
	}
	hasAny := false
	for _, entry := range entries {
		if strings.TrimSpace(entry.Instructor) == "" {
			continue
		}
		strengths := sanitizeList(entry.Strengths)
		weaknesses := sanitizeList(entry.Weaknesses)
		if len(strengths) == 0 && len(weaknesses) == 0 {
			continue
		}
		hasAny = true
		b.WriteString("<div class=\"entry\"><p class=\"entry-title\">" + escape(entry.Instructor) + "</p>")
		b.WriteString("<div class=\"row\">")
		b.WriteString("<div><span class=\"small-label\">Strengths</span>" + renderList(strengths) + "</div>")
		b.WriteString("<div><span class=\"small-label\">Weaknesses</span>" + renderList(weaknesses) + "</div>")
		b.WriteString("</div></div>")
	}
	if !hasAny {
		b.WriteString("<p class=\"muted\">None reported.</p>")
	}
	b.WriteString("</div>")
	return b.String()
}

func renderInstructorCovers(entries []InstructorCoverEntry) string {
	var b strings.Builder
	b.WriteString("<div class=\"subsection\"><h3>Instructor Covers</h3>")
	if len(entries) == 0 {
		b.WriteString("<p class=\"muted\">None reported.</p></div>")
		return b.String()
	}
	hasAny := false
	for _, entry := range entries {
		if strings.TrimSpace(entry.Instructor) == "" && strings.TrimSpace(entry.CoveredBy) == "" && strings.TrimSpace(entry.Details) == "" {
			continue
		}
		hasAny = true
		b.WriteString("<div class=\"entry\">")
		b.WriteString("<div class=\"row\">")
		b.WriteString("<div><span class=\"small-label\">Instructor</span><p>" + optionalText(entry.Instructor) + "</p></div>")
		b.WriteString("<div><span class=\"small-label\">Covered By</span><p>" + optionalText(entry.CoveredBy) + "</p></div>")
		b.WriteString("</div>")
		b.WriteString("<div class=\"pair\"><span class=\"small-label\">Details</span><p>" + optionalMultiline(entry.Details) + "</p></div>")
		b.WriteString("</div>")
	}
	if !hasAny {
		b.WriteString("<p class=\"muted\">None reported.</p>")
	}
	b.WriteString("</div>")
	return b.String()
}

func renderChallengingTimes(entries []ChallengingTimeEntry) string {
	var b strings.Builder
	b.WriteString("<div class=\"subsection\"><h3>Challenging Times for Lesson Layouts</h3>")
	filtered := make([]ChallengingTimeEntry, 0, len(entries))
	for _, entry := range entries {
		if strings.TrimSpace(entry.Time) == "" && strings.TrimSpace(entry.Lessons) == "" && strings.TrimSpace(entry.Description) == "" {
			continue
		}
		filtered = append(filtered, entry)
	}
	if len(filtered) == 0 {
		b.WriteString("<p class=\"muted\">None reported.</p></div>")
		return b.String()
	}
	for _, entry := range filtered {
		b.WriteString("<div class=\"entry\"><div class=\"row\">")
		b.WriteString("<div><span class=\"small-label\">Time</span><p>" + optionalText(entry.Time) + "</p></div>")
		b.WriteString("<div><span class=\"small-label\">Lessons</span><p>" + optionalText(entry.Lessons) + "</p></div>")
		b.WriteString("</div><div class=\"pair\"><span class=\"small-label\">Description</span><p>" + optionalMultiline(entry.Description) + "</p></div></div>")
	}
	b.WriteString("</div>")
	return b.String()
}

func renderNewClassLayouts(entries []NewClassLayoutEntry) string {
	var b strings.Builder
	b.WriteString("<div class=\"subsection\"><h3>New Class Layouts</h3>")
	if len(entries) == 0 {
		b.WriteString("<p class=\"muted\">None reported.</p></div>")
		return b.String()
	}
	hasAny := false
	for _, entry := range entries {
		if strings.TrimSpace(entry.Level) == "" && strings.TrimSpace(entry.Description) == "" {
			continue
		}
		hasAny = true
		b.WriteString("<div class=\"entry\"><div class=\"row\">")
		b.WriteString("<div><span class=\"small-label\">Level</span><p>" + optionalText(entry.Level) + "</p></div>")
		b.WriteString("<div><span class=\"small-label\">Layout / Location</span><p>" + optionalMultiline(entry.Description) + "</p></div>")
		b.WriteString("</div></div>")
	}
	if !hasAny {
		b.WriteString("<p class=\"muted\">None reported.</p>")
	}
	b.WriteString("</div>")
	return b.String()
}

func renderSafetyConcerns(entries []SafetyConcernEntry) string {
	var b strings.Builder
	b.WriteString("<div class=\"subsection\"><h3>Safety Concerns</h3>")
	if len(entries) == 0 {
		b.WriteString("<p class=\"muted\">None reported.</p></div>")
		return b.String()
	}
	hasAny := false
	for _, entry := range entries {
		if strings.TrimSpace(entry.ConcernType) == "" && strings.TrimSpace(entry.Description) == "" {
			continue
		}
		hasAny = true
		b.WriteString("<div class=\"entry\"><div class=\"row\">")
		b.WriteString("<div><span class=\"small-label\">Concern Type</span><p>" + optionalText(entry.ConcernType) + "</p></div>")
		b.WriteString("<div><span class=\"small-label\">Description</span><p>" + optionalMultiline(entry.Description) + "</p></div>")
		b.WriteString("</div></div>")
	}
	if !hasAny {
		b.WriteString("<p class=\"muted\">None reported.</p>")
	}
	b.WriteString("</div>")
	return b.String()
}

func renderItemDescriptionEntries(title string, entries []ItemDescriptionEntry) string {
	var b strings.Builder
	b.WriteString("<div class=\"subsection\"><h3>" + escape(title) + "</h3>")
	if len(entries) == 0 {
		b.WriteString("<p class=\"muted\">None reported.</p></div>")
		return b.String()
	}
	hasAny := false
	for _, entry := range entries {
		if strings.TrimSpace(entry.Item) == "" && strings.TrimSpace(entry.Description) == "" {
			continue
		}
		hasAny = true
		b.WriteString("<div class=\"entry\"><div class=\"row\">")
		b.WriteString("<div><span class=\"small-label\">Item</span><p>" + optionalText(entry.Item) + "</p></div>")
		b.WriteString("<div><span class=\"small-label\">Description</span><p>" + optionalMultiline(entry.Description) + "</p></div>")
		b.WriteString("</div></div>")
	}
	if !hasAny {
		b.WriteString("<p class=\"muted\">None reported.</p>")
	}
	b.WriteString("</div>")
	return b.String()
}

func renderParentFeedback(entries []ParentFeedbackEntry) string {
	var b strings.Builder
	if len(entries) == 0 {
		return "<p class=\"muted\">None reported.</p>"
	}
	hasAny := false
	for _, entry := range entries {
		if strings.TrimSpace(entry.FeedbackType) == "" && strings.TrimSpace(entry.Description) == "" {
			continue
		}
		hasAny = true
		b.WriteString("<div class=\"entry\"><div class=\"row\">")
		b.WriteString("<div><span class=\"small-label\">Type</span><p>" + optionalText(entry.FeedbackType) + "</p></div>")
		b.WriteString("<div><span class=\"small-label\">Description</span><p>" + optionalMultiline(entry.Description) + "</p></div>")
		b.WriteString("</div></div>")
	}
	if !hasAny {
		return "<p class=\"muted\">None reported.</p>"
	}
	return b.String()
}

func renderAdminWork(entries []AdminWorkEntry) string {
	var b strings.Builder
	b.WriteString("<div class=\"subsection\"><h3>Admin Work</h3>")
	if len(entries) == 0 {
		b.WriteString("<p class=\"muted\">None reported.</p></div>")
		return b.String()
	}
	hasAny := false
	for _, entry := range entries {
		if strings.TrimSpace(entry.Work) == "" && strings.TrimSpace(entry.Description) == "" {
			continue
		}
		hasAny = true
		b.WriteString("<div class=\"entry\"><div class=\"row\">")
		b.WriteString("<div><span class=\"small-label\">Work Item</span><p>" + optionalText(entry.Work) + "</p></div>")
		b.WriteString("<div><span class=\"small-label\">Description</span><p>" + optionalMultiline(entry.Description) + "</p></div>")
		b.WriteString("</div></div>")
	}
	if !hasAny {
		b.WriteString("<p class=\"muted\">None reported.</p>")
	}
	b.WriteString("</div>")
	return b.String()
}

func renderInitiatives(entries []InitiativeEntry) string {
	var b strings.Builder
	b.WriteString("<div class=\"subsection\"><h3>Projects to Initiate</h3>")
	if len(entries) == 0 {
		b.WriteString("<p class=\"muted\">None reported.</p></div>")
		return b.String()
	}
	hasAny := false
	for _, entry := range entries {
		if strings.TrimSpace(entry.Title) == "" && strings.TrimSpace(entry.Brief) == "" {
			continue
		}
		hasAny = true
		b.WriteString("<div class=\"entry\"><div class=\"row\">")
		b.WriteString("<div><span class=\"small-label\">Title</span><p>" + optionalText(entry.Title) + "</p></div>")
		b.WriteString("<div><span class=\"small-label\">Brief</span><p>" + optionalMultiline(entry.Brief) + "</p></div>")
		b.WriteString("</div></div>")
	}
	if !hasAny {
		b.WriteString("<p class=\"muted\">None reported.</p>")
	}
	b.WriteString("</div>")
	return b.String()
}

func renderList(items []string) string {
	if len(items) == 0 {
		return "<p class=\"muted\">None listed.</p>"
	}
	var b strings.Builder
	b.WriteString("<ul>")
	for _, item := range items {
		b.WriteString("<li>" + escape(item) + "</li>")
	}
	b.WriteString("</ul>")
	return b.String()
}

func sanitizeList(items []string) []string {
	clean := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		clean = append(clean, trimmed)
	}
	return clean
}

func optionalText(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "<span class=\"muted\">Not provided.</span>"
	}
	return escape(trimmed)
}

func optionalMultiline(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "<span class=\"muted\">Not provided.</span>"
	}
	return strings.ReplaceAll(escape(trimmed), "\n", "<br/>")
}

func formatTime(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "Not provided"
	}
	layouts := []string{time.RFC3339Nano, time.RFC3339}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return parsed.Local().Format("Jan 2, 2006 3:04 PM")
		}
	}
	return trimmed
}

func escape(value string) string {
	return html.EscapeString(value)
}

func renderPDF(ctx context.Context, htmlContent string) ([]byte, error) {
	timeoutCtx, timeoutCancel := context.WithTimeout(ctx, 40*time.Second)
	defer timeoutCancel()

	allocatorOptions, err := buildChromeAllocatorOptions()
	if err != nil {
		return nil, err
	}

	allocatorCtx, allocatorCancel := chromedp.NewExecAllocator(timeoutCtx, allocatorOptions...)
	defer allocatorCancel()

	browserCtx, browserCancel := chromedp.NewContext(allocatorCtx)
	defer browserCancel()

	var pdfBytes []byte
	err = chromedp.Run(browserCtx,
		chromedp.EmulateViewport(1280, 720),
		chromedp.Navigate("about:blank"),
		chromedp.ActionFunc(func(ctx context.Context) error {
			frameTree, err := page.GetFrameTree().Do(ctx)
			if err != nil {
				return err
			}
			return page.SetDocumentContent(frameTree.Frame.ID, htmlContent).Do(ctx)
		}),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Sleep(250*time.Millisecond),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var printErr error
			pdfBytes, _, printErr = page.PrintToPDF().
				WithPrintBackground(true).
				WithPreferCSSPageSize(true).
				Do(ctx)
			return printErr
		}),
	)
	if err != nil {
		return nil, err
	}
	if len(pdfBytes) == 0 {
		return nil, errors.New("empty PDF payload")
	}
	return pdfBytes, nil
}

func buildChromeAllocatorOptions() ([]chromedp.ExecAllocatorOption, error) {
	allocatorOptions := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.NoSandbox,
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("disable-dev-shm-usage", true),
	)
	chromePath, err := resolveChromePath()
	if err != nil {
		return nil, err
	}
	if chromePath != "" {
		allocatorOptions = append(allocatorOptions, chromedp.ExecPath(chromePath))
	}
	return allocatorOptions, nil
}

func resolveChromePath() (string, error) {
	if value := os.Getenv("CHROME_PATH"); value != "" {
		return value, nil
	}
	if runtime.GOOS == "linux" {
		paths := []string{"google-chrome", "chromium-browser", "chromium"}
		for _, path := range paths {
			if resolved, err := exec.LookPath(path); err == nil {
				return resolved, nil
			}
		}
		return "", errors.New("chrome executable not found; install Chrome/Chromium or set CHROME_PATH")
	}
	if runtime.GOOS == "darwin" {
		path := "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
		path = "/Applications/Chromium.app/Contents/MacOS/Chromium"
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
		return "", errors.New("chrome executable not found; install Chrome/Chromium or set CHROME_PATH")
	}
	return "", errors.New("chrome executable not found; install Chrome/Chromium or set CHROME_PATH")
}
