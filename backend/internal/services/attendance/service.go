package attendance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"cob-aquatics/internal/services/files"
	"cob-aquatics/internal/services/pdf"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

const (
	DefaultSessionName      = "Session"
	DefaultAttendanceLayout = "SplashFitness"
	DefaultRenderWorkers    = 2
)

var (
	ErrMissingTemplate  = errors.New("missing attendance template")
	ErrTemplateNotFound = errors.New("attendance template not found")
)

var scriptTagPattern = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)

type Request struct {
	Template string           `json:"template"`
	Sheet    *SheetDefinition `json:"sheet"`
	Session  string           `json:"session"`
	Filename string           `json:"filename"`
	Title    string           `json:"title"`
	Roster   Roster           `json:"roster"`
	Rosters  []Item           `json:"rosters"`
}

type Item struct {
	Template string           `json:"template"`
	Sheet    *SheetDefinition `json:"sheet"`
	Roster   Roster           `json:"roster"`
}

type SheetDefinition struct {
	BaseTemplate       string       `json:"baseTemplate"`
	Title              string       `json:"title"`
	HeaderLabel        string       `json:"headerLabel"`
	SheetWidthPx       int          `json:"sheetWidthPx"`
	RotateHeightPx     int          `json:"rotateHeightPx"`
	RotateTranslatePx  int          `json:"rotateTranslatePx"`
	RotateTopPx        int          `json:"rotateTopPx"`
	SkillColumnWidthPt int          `json:"skillColumnWidthPt"`
	NameColumnWidthPt  int          `json:"nameColumnWidthPt"`
	ShowPreviousLevel  bool         `json:"showPreviousLevel"`
	ShowResult         bool         `json:"showResult"`
	ShowRegisterIn     bool         `json:"showRegisterIn"`
	Skills             []SheetSkill `json:"skills"`
}

type SheetSkill struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	Details []string `json:"details"`
}

type Roster struct {
	Code        string    `json:"code"`
	Level       string    `json:"level"`
	ServiceName string    `json:"serviceName"`
	Time        string    `json:"time"`
	Instructor  string    `json:"instructor"`
	Location    string    `json:"location"`
	Schedule    string    `json:"schedule"`
	Students    []Student `json:"students"`
}

type Student struct {
	Name string `json:"name"`
}

type renderPayload struct {
	Code       string    `json:"code"`
	Time       string    `json:"time"`
	Instructor string    `json:"instructor"`
	Location   string    `json:"location"`
	Schedule   string    `json:"schedule"`
	Session    string    `json:"session"`
	Students   []Student `json:"students"`
}

type pdfPayload struct {
	Session string
	Roster  Roster
	Sheet   *SheetDefinition
}

type templateSections struct {
	HeadInnerHTML  string
	BodyAttrsHTML  string
	DocumentAttrs  string
	PageAttrs      string
	FrontInnerHTML string
	BackInnerHTML  string
}

type renderJob struct {
	templatePath string
	sheet        *SheetDefinition
	payload      pdfPayload
}

func Generate(ctx context.Context, req Request) ([]byte, string, error) {
	session := strings.TrimSpace(req.Session)
	if session == "" {
		session = DefaultSessionName
	}

	items := req.Rosters
	if len(items) == 0 {
		req.Template = strings.TrimSpace(req.Template)
		if req.Template == "" && req.Sheet == nil {
			return nil, "", ErrMissingTemplate
		}
		items = []Item{{Template: req.Template, Sheet: req.Sheet, Roster: req.Roster}}
	}

	pdfs := make([][]byte, 0, len(items))
	firstTemplate := strings.TrimSpace(items[0].Template)
	if firstTemplate == "" && items[0].Sheet != nil {
		firstTemplate = "custom"
	}
	firstCode := items[0].Roster.Code

	if len(items) > 1 {
		rendered, err := renderGroupedItems(ctx, session, items)
		if err != nil {
			return nil, "", fmt.Errorf("unable to render attendance PDF: %w", err)
		}
		pdfs = rendered
	} else {
		template := strings.TrimSpace(items[0].Template)
		if template == "" && items[0].Sheet == nil {
			return nil, "", ErrMissingTemplate
		}

		pdfBytes, err := renderPDF(ctx, template, pdfPayload{
			Session: session,
			Roster:  items[0].Roster,
			Sheet:   items[0].Sheet,
		})
		if err != nil {
			return nil, "", errors.New("unable to render attendance PDF")
		}
		pdfs = append(pdfs, pdfBytes)
	}

	var pdfBytes []byte
	filename := ""
	requestedFilename := files.SanitizeFilename(req.Filename)
	if len(pdfs) == 1 {
		pdfBytes = pdfs[0]
		if requestedFilename != "" {
			filename = buildFilename(requestedFilename, "attendance")
		} else {
			filename = buildFilename(firstCode, firstTemplate)
		}
	} else {
		merged, err := pdf.Merge(pdfs)
		if err != nil {
			return nil, "", fmt.Errorf("unable to merge attendance PDFs: %w", err)
		}
		pdfBytes = merged
		if requestedFilename != "" {
			filename = buildFilename(requestedFilename, "attendance")
		} else {
			filename = buildFilename("", "multi")
		}
	}

	return pdfBytes, filename, nil
}

func buildFilename(code, template string) string {
	base := strings.TrimSpace(code)
	if base == "" {
		base = template
	}
	base = files.SanitizeFilename(base)
	return fmt.Sprintf("attendance-%s.pdf", base)
}

func resolveTemplate(template string) (string, error) {
	templatesDir, err := templatesDir()
	if err != nil {
		return "", err
	}

	templatePath := filepath.Join(templatesDir, fmt.Sprintf("%s.html", template))
	if _, err := os.Stat(templatePath); err == nil {
		return templatePath, nil
	}

	fallbackPath := filepath.Join(templatesDir, fmt.Sprintf("%s.html", DefaultAttendanceLayout))
	if _, err := os.Stat(fallbackPath); err == nil {
		return fallbackPath, nil
	}

	return "", ErrTemplateNotFound
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

	return "", errors.New("unable to resolve backend path")
}

func renderPDF(ctx context.Context, template string, data pdfPayload) ([]byte, error) {
	return renderHTMLAsPDF(ctx, func() (string, []renderPayload, error) {
		var templateHTML string
		if data.Sheet != nil {
			sheet := NormalizeSheetDefinition(*data.Sheet, data.Roster.Level)
			if strings.TrimSpace(sheet.BaseTemplate) != "" {
				var err error
				templateHTML, err = buildCustomSheetHTMLFromTemplate(sheet.BaseTemplate, sheet)
				if err != nil {
					return "", nil, err
				}
			} else {
				templateHTML = buildCustomSheetHTML(sheet)
			}
		} else {
			templatePath, err := resolveTemplate(template)
			if err != nil {
				return "", nil, err
			}
			templateHTML, err = readTemplateHTML(templatePath)
			if err != nil {
				return "", nil, err
			}
		}
		return templateHTML, []renderPayload{buildRenderPayload(data.Session, data.Roster)}, nil
	})
}

func renderHTMLAsPDF(ctx context.Context, build func() (string, []renderPayload, error)) ([]byte, error) {
	htmlContent, rosters, err := build()
	if err != nil {
		return nil, err
	}

	allocatorOptions, err := buildChromeAllocatorOptions()
	if err != nil {
		return nil, err
	}

	allocatorCtx, allocatorCancel := chromedp.NewExecAllocator(ctx, allocatorOptions...)
	defer allocatorCancel()

	browserCtx, browserCancel := chromedp.NewContext(allocatorCtx)
	defer browserCancel()

	return renderHTMLInTab(browserCtx, htmlContent, rosters)
}

func renderPDFInTab(browserCtx context.Context, templatePath string, data pdfPayload) ([]byte, error) {
	templateHTML, err := readTemplateHTML(templatePath)
	if err != nil {
		return nil, err
	}
	return renderHTMLInTab(browserCtx, templateHTML, []renderPayload{buildRenderPayload(data.Session, data.Roster)})
}

func renderHTMLInTab(browserCtx context.Context, htmlContent string, rosters []renderPayload) ([]byte, error) {
	tabCtx, tabCancel := chromedp.NewContext(browserCtx)
	defer tabCancel()

	tabCtx, timeoutCancel := context.WithTimeout(tabCtx, 25*time.Second)
	defer timeoutCancel()

	return renderHTMLWithContext(tabCtx, htmlContent, rosters)
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

func readTemplateHTML(templatePath string) (string, error) {
	templateHTML, err := os.ReadFile(templatePath)
	if err != nil {
		return "", err
	}
	return stripScriptTags(string(templateHTML)), nil
}

func buildRenderPayload(session string, roster Roster) renderPayload {
	return renderPayload{
		Code:       roster.Code,
		Time:       roster.Time,
		Instructor: roster.Instructor,
		Location:   roster.Location,
		Schedule:   roster.Schedule,
		Session:    session,
		Students:   roster.Students,
	}
}

func renderHTMLWithContext(ctx context.Context, htmlContent string, rosters []renderPayload) ([]byte, error) {
	rosterJSON, err := json.Marshal(rosters)
	if err != nil {
		return nil, err
	}

	var pdfBytes []byte
	err = chromedp.Run(ctx,
		chromedp.EmulateViewport(1400, 900),
		chromedp.Navigate("about:blank"),
		chromedp.ActionFunc(func(ctx context.Context) error {
			frameTree, err := page.GetFrameTree().Do(ctx)
			if err != nil {
				return err
			}
			return page.SetDocumentContent(frameTree.Frame.ID, htmlContent).Do(ctx)
		}),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Evaluate(fmt.Sprintf("window.__ROSTERS__ = %s; window.__ROSTER__ = window.__ROSTERS__[0] || null;", rosterJSON), nil),
		chromedp.Evaluate(fillAttendanceTemplateJS, nil),
		chromedp.Sleep(200*time.Millisecond),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBytes, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithLandscape(true).
				WithMarginBottom(0.2).
				WithMarginTop(0.2).
				WithMarginLeft(0.2).
				WithMarginRight(0.2).
				Do(ctx)
			return err
		}),
	)
	if err != nil {
		return nil, err
	}
	return pdfBytes, nil
}

func renderGroupedItems(ctx context.Context, session string, items []Item) ([][]byte, error) {
	if len(items) == 0 {
		return nil, errors.New("no attendance items provided")
	}

	jobs := make([]renderJob, 0, len(items))
	for index, item := range items {
		template := strings.TrimSpace(item.Template)
		if template == "" && item.Sheet == nil {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrMissingTemplate)
		}
		templatePath := ""
		if item.Sheet == nil {
			resolved, err := resolveTemplate(template)
			if err != nil {
				return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrTemplateNotFound)
			}
			templatePath = resolved
		}
		jobs = append(jobs, renderJob{
			templatePath: templatePath,
			sheet:        item.Sheet,
			payload: pdfPayload{
				Session: session,
				Roster:  item.Roster,
				Sheet:   item.Sheet,
			},
		})
	}

	output := make([][]byte, 0, len(jobs))
	for start := 0; start < len(jobs); {
		end := start + 1
		for end < len(jobs) && jobs[end].payload.Roster.Code == jobs[start].payload.Roster.Code {
			end += 1
		}

		group := jobs[start:end]
		for pairStart := 0; pairStart < len(group); pairStart += 2 {
			pairEnd := pairStart + 2
			if pairEnd > len(group) {
				pairEnd = len(group)
			}
			chunk := group[pairStart:pairEnd]

			var pdfBytes []byte
			var err error
			if len(chunk) == 2 && chunk[0].sheet == nil && chunk[1].sheet == nil {
				pdfBytes, err = renderCombinedPDF(ctx, chunk)
			} else {
				pdfBytes, err = renderSingleJobPDF(ctx, chunk[0])
			}
			if err != nil {
				return nil, fmt.Errorf("attendance item %d: %w", start+pairStart+1, err)
			}
			output = append(output, pdfBytes)
			if len(chunk) == 2 && (chunk[0].sheet != nil || chunk[1].sheet != nil) {
				pdfBytes, err = renderSingleJobPDF(ctx, chunk[1])
				if err != nil {
					return nil, fmt.Errorf("attendance item %d: %w", start+pairStart+2, err)
				}
				output = append(output, pdfBytes)
			}
		}

		start = end
	}

	return output, nil
}

func renderSingleJobPDF(ctx context.Context, job renderJob) ([]byte, error) {
	if job.sheet != nil {
		return renderPDF(ctx, "", job.payload)
	}
	return renderHTMLAsPDF(ctx, func() (string, []renderPayload, error) {
		templateHTML, err := readTemplateHTML(job.templatePath)
		if err != nil {
			return "", nil, err
		}
		return templateHTML, []renderPayload{buildRenderPayload(job.payload.Session, job.payload.Roster)}, nil
	})
}

func renderCombinedPDF(ctx context.Context, items []renderJob) ([]byte, error) {
	if len(items) != 2 {
		return nil, fmt.Errorf("combined attendance render requires exactly 2 items, got %d", len(items))
	}

	return renderHTMLAsPDF(ctx, func() (string, []renderPayload, error) {
		sections := make([]templateSections, 0, len(items))
		payloads := make([]renderPayload, 0, len(items))
		for _, item := range items {
			templateHTML, err := readTemplateHTML(item.templatePath)
			if err != nil {
				return "", nil, err
			}
			section, err := extractTemplateSections(templateHTML)
			if err != nil {
				return "", nil, err
			}
			sections = append(sections, section)
			payloads = append(payloads, buildRenderPayload(item.payload.Session, item.payload.Roster))
		}

		combinedHTML, err := buildCombinedTemplateHTML(sections)
		if err != nil {
			return "", nil, err
		}

		return combinedHTML, payloads, nil
	})
}

func buildCombinedTemplateHTML(sections []templateSections) (string, error) {
	if len(sections) != 2 {
		return "", fmt.Errorf("combined attendance template requires exactly 2 sections, got %d", len(sections))
	}

	headInner := sections[0].HeadInnerHTML
	bodyAttrs := sections[0].BodyAttrsHTML
	documentAttrs := sections[0].DocumentAttrs
	if strings.TrimSpace(documentAttrs) == "" {
		documentAttrs = ` id="document"`
	}

	frontSlots := make([]string, 0, len(sections))
	backSlots := make([]string, 0, len(sections))
	for index, section := range sections {
		frontSlots = append(frontSlots, buildCombinedSlot(section.PageAttrs, index, section.FrontInnerHTML))
		backSlots = append(backSlots, buildCombinedSlot(section.PageAttrs, index, section.BackInnerHTML))
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
%s
<style>
  .combined-document .templatePage:not(:last-child) {
    page-break-after: auto !important;
  }

  .combined-document br {
    display: block;
    content: "";
  }

  .combined-document .rotate-cell br {
    display: block;
  }

  .combined-page .combined-slot + .combined-slot {
    margin-top: 1.25rem;
  }
</style>
</head>
<body%s>
  <div class="relative combined-document">
    <div%s>
      <div class="combined-page">
        %s
      </div>
      <p class="break-before-page"><span></span></p>
      <div class="combined-page">
        %s
      </div>
    </div>
  </div>
</body>
</html>`, headInner, bodyAttrs, documentAttrs, strings.Join(frontSlots, "\n"), strings.Join(backSlots, "\n")), nil
}

func buildCombinedSlot(pageAttrs string, rosterIndex int, innerHTML string) string {
	return fmt.Sprintf(`<div class="combined-slot" data-attendance-root="%d"><div%s>%s</div></div>`, rosterIndex, pageAttrs, innerHTML)
}

func extractTemplateSections(htmlContent string) (templateSections, error) {
	lower := strings.ToLower(htmlContent)

	headInner, err := rawTagInner(htmlContent, lower, "head")
	if err != nil {
		return templateSections{}, err
	}

	bodyAttrs, _, _, err := rawTagByName(htmlContent, lower, "body")
	if err != nil {
		return templateSections{}, err
	}

	documentAttrs, _, documentInner, err := rawTagContaining(htmlContent, lower, `id="document"`)
	if err != nil {
		return templateSections{}, err
	}

	pageAttrs, _, pageInner, err := rawTagContaining(documentInner, strings.ToLower(documentInner), "templatepage")
	if err != nil {
		return templateSections{}, err
	}

	breakStart, breakEnd, err := rawTagBoundsContaining(pageInner, strings.ToLower(pageInner), "break-before-page")
	if err != nil {
		return templateSections{}, err
	}

	return templateSections{
		HeadInnerHTML:  headInner,
		BodyAttrsHTML:  bodyAttrs,
		DocumentAttrs:  documentAttrs,
		PageAttrs:      pageAttrs,
		FrontInnerHTML: pageInner[:breakStart],
		BackInnerHTML:  pageInner[breakEnd:],
	}, nil
}

func rawTagInner(htmlContent, lower, tagName string) (string, error) {
	_, _, inner, err := rawTagByName(htmlContent, lower, tagName)
	if err != nil {
		return "", err
	}
	return inner, nil
}

func rawTagByName(htmlContent, lower, tagName string) (string, string, string, error) {
	openStart, openEnd, err := rawOpeningTagBounds(lower, tagName, 0)
	if err != nil {
		return "", "", "", err
	}

	attrs := rawTagAttrs(htmlContent[openStart:openEnd+1], tagName)
	closeStart, closeEnd, err := rawMatchingCloseBounds(lower, tagName, openStart, openEnd)
	if err != nil {
		return "", "", "", err
	}

	return normalizeRawAttrs(attrs), htmlContent[openStart : closeEnd+1], htmlContent[openEnd+1 : closeStart], nil
}

func rawTagContaining(htmlContent, lower, needle string) (string, string, string, error) {
	openStart, openEnd, tagName, err := rawOpeningTagContaining(lower, needle)
	if err != nil {
		return "", "", "", err
	}

	attrs := rawTagAttrs(htmlContent[openStart:openEnd+1], tagName)
	closeStart, closeEnd, err := rawMatchingCloseBounds(lower, tagName, openStart, openEnd)
	if err != nil {
		return "", "", "", err
	}

	return normalizeRawAttrs(attrs), htmlContent[openStart : closeEnd+1], htmlContent[openEnd+1 : closeStart], nil
}

func rawTagBoundsContaining(htmlContent, lower, needle string) (int, int, error) {
	openStart, openEnd, tagName, err := rawOpeningTagContaining(lower, needle)
	if err != nil {
		return 0, 0, err
	}
	_, closeEnd, err := rawMatchingCloseBounds(lower, tagName, openStart, openEnd)
	if err != nil {
		return 0, 0, err
	}
	return openStart, closeEnd + 1, nil
}

func rawOpeningTagContaining(lower, needle string) (int, int, string, error) {
	match := strings.Index(lower, needle)
	if match < 0 {
		return 0, 0, "", fmt.Errorf("attendance template missing %s marker", needle)
	}

	openStart := strings.LastIndex(lower[:match], "<")
	if openStart < 0 {
		return 0, 0, "", fmt.Errorf("attendance template missing opening tag for %s", needle)
	}

	openEnd := strings.Index(lower[match:], ">")
	if openEnd < 0 {
		return 0, 0, "", fmt.Errorf("attendance template has unterminated opening tag for %s", needle)
	}
	openEnd += match

	tagName := rawTagName(lower[openStart : openEnd+1])
	if tagName == "" {
		return 0, 0, "", fmt.Errorf("attendance template has invalid opening tag for %s", needle)
	}

	return openStart, openEnd, tagName, nil
}

func rawOpeningTagBounds(lower, tagName string, start int) (int, int, error) {
	token := "<" + tagName
	for offset := start; offset < len(lower); {
		index := strings.Index(lower[offset:], token)
		if index < 0 {
			return 0, 0, fmt.Errorf("attendance template missing %s tag", tagName)
		}
		openStart := offset + index
		nameEnd := openStart + len(token)
		if nameEnd < len(lower) && !isTagBoundary(lower[nameEnd]) {
			offset = nameEnd
			continue
		}
		openEndRel := strings.Index(lower[nameEnd:], ">")
		if openEndRel < 0 {
			return 0, 0, fmt.Errorf("attendance template has unterminated %s tag", tagName)
		}
		return openStart, nameEnd + openEndRel, nil
	}
	return 0, 0, fmt.Errorf("attendance template missing %s tag", tagName)
}

func rawMatchingCloseBounds(lower, tagName string, openStart, openEnd int) (int, int, error) {
	depth := 1
	searchFrom := openEnd + 1
	openToken := "<" + tagName
	closeToken := "</" + tagName

	for searchFrom < len(lower) {
		nextOpen := strings.Index(lower[searchFrom:], openToken)
		if nextOpen >= 0 {
			nextOpen += searchFrom
		}
		nextClose := strings.Index(lower[searchFrom:], closeToken)
		if nextClose >= 0 {
			nextClose += searchFrom
		}

		if nextClose < 0 {
			return 0, 0, fmt.Errorf("attendance template missing closing %s tag", tagName)
		}

		if nextOpen >= 0 && nextOpen < nextClose {
			nameEnd := nextOpen + len(openToken)
			if nameEnd < len(lower) && !isTagBoundary(lower[nameEnd]) {
				searchFrom = nameEnd
				continue
			}
			depth += 1
			searchFrom = nameEnd
			continue
		}

		nameEnd := nextClose + len(closeToken)
		if nameEnd < len(lower) && !isTagBoundary(lower[nameEnd]) {
			searchFrom = nameEnd
			continue
		}

		depth -= 1
		closeEndRel := strings.Index(lower[nameEnd:], ">")
		if closeEndRel < 0 {
			return 0, 0, fmt.Errorf("attendance template has unterminated closing %s tag", tagName)
		}
		closeEnd := nameEnd + closeEndRel
		if depth == 0 {
			return nextClose, closeEnd, nil
		}
		searchFrom = closeEnd + 1
	}

	return 0, 0, fmt.Errorf("attendance template missing closing %s tag", tagName)
}

func rawTagName(openTag string) string {
	trimmed := strings.TrimSpace(openTag)
	if !strings.HasPrefix(trimmed, "<") {
		return ""
	}
	trimmed = trimmed[1:]
	end := 0
	for end < len(trimmed) && !isTagBoundary(trimmed[end]) {
		end += 1
	}
	return strings.TrimSpace(trimmed[:end])
}

func rawTagAttrs(openTag, tagName string) string {
	trimmed := strings.TrimSpace(openTag)
	if strings.HasSuffix(trimmed, ">") {
		trimmed = trimmed[:len(trimmed)-1]
	}
	trimmed = strings.TrimPrefix(trimmed, "<"+tagName)
	return trimmed
}

func normalizeRawAttrs(attrs string) string {
	trimmed := strings.TrimSpace(attrs)
	if trimmed == "" {
		return ""
	}
	return " " + trimmed
}

func isTagBoundary(char byte) bool {
	switch char {
	case ' ', '\n', '\r', '\t', '>', '/':
		return true
	default:
		return false
	}
}

func NormalizeSheetDefinition(sheet SheetDefinition, fallbackTitle string) SheetDefinition {
	sheet.BaseTemplate = strings.TrimSpace(sheet.BaseTemplate)
	sheet.Title = strings.TrimSpace(sheet.Title)
	if sheet.Title == "" {
		sheet.Title = strings.TrimSpace(fallbackTitle)
	}
	if sheet.Title == "" {
		sheet.Title = "Custom Attendance"
	}
	sheet.HeaderLabel = strings.TrimSpace(sheet.HeaderLabel)
	if sheet.HeaderLabel == "" {
		sheet.HeaderLabel = "Day/Time"
	}
	if sheet.SheetWidthPx <= 0 {
		sheet.SheetWidthPx = 1300
	}
	if sheet.RotateHeightPx <= 0 {
		sheet.RotateHeightPx = 300
	}
	if sheet.RotateTranslatePx <= 0 {
		sheet.RotateTranslatePx = 190
	}
	if sheet.RotateTopPx <= 0 {
		sheet.RotateTopPx = 100
	}
	if sheet.SkillColumnWidthPt <= 0 {
		sheet.SkillColumnWidthPt = 50
	}
	if sheet.NameColumnWidthPt <= 0 {
		sheet.NameColumnWidthPt = 630
	}
	for index := range sheet.Skills {
		sheet.Skills[index].ID = strings.TrimSpace(sheet.Skills[index].ID)
		sheet.Skills[index].Label = strings.TrimSpace(sheet.Skills[index].Label)
		details := make([]string, 0, len(sheet.Skills[index].Details))
		for _, detail := range sheet.Skills[index].Details {
			if trimmed := strings.TrimSpace(detail); trimmed != "" {
				details = append(details, trimmed)
			}
		}
		sheet.Skills[index].Details = details
	}
	return sheet
}

func buildCustomSheetHTMLFromTemplate(template string, sheet SheetDefinition) (string, error) {
	templatePath, err := resolveTemplate(strings.TrimSpace(template))
	if err != nil {
		return "", err
	}
	templateHTML, err := readTemplateHTML(templatePath)
	if err != nil {
		return "", err
	}

	sections, err := extractTemplateSections(templateHTML)
	if err != nil {
		return "", err
	}

	frontHTML, err := buildCustomTemplateFrontHTML(sections.FrontInnerHTML, sheet)
	if err != nil {
		return "", err
	}
	backHTML := buildCustomTemplateBackHTML(sections.BackInnerHTML, sheet)

	headInner := replaceHTMLTitle(sections.HeadInnerHTML, sheet.Title)
	bodyAttrs := sections.BodyAttrsHTML
	documentAttrs := sections.DocumentAttrs
	if strings.TrimSpace(documentAttrs) == "" {
		documentAttrs = ` id="document"`
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
%s
</head>
<body%s>
	<div class="relative">
		<div%s>
			<div%s>%s
			<p class="break-before-page"><span
						style="font-size: 0.9em; background-color: rgb(255, 255, 255);"></span></p>
%s</div>
		</div>
	</div>
</body>
</html>`, headInner, bodyAttrs, documentAttrs, sections.PageAttrs, frontHTML, backHTML), nil
}

func buildCustomTemplateFrontHTML(frontHTML string, sheet SheetDefinition) (string, error) {
	rowStart, rowEnd, err := rawTagBoundsContaining(frontHTML, strings.ToLower(frontHTML), `id="student-rows"`)
	if err != nil {
		return "", err
	}
	rowHTML := frontHTML[rowStart:rowEnd]
	rowAttrs, _, rowInner, err := rawTagByName(rowHTML, strings.ToLower(rowHTML), "tr")
	if err != nil {
		return "", err
	}

	cells := tableCells(rowInner)
	if len(cells) == 0 {
		return "", errors.New("attendance template missing header cells")
	}

	headerCell := replaceTemplateHeaderTitle(cells[0], sheet.Title)
	var previousCell string
	var resultCell string
	var registerCell string
	blankCells := make([]string, 0)
	skillPrototype := ""

	for _, cell := range cells[1:] {
		label := cleanTemplateCellText(cell)
		lower := strings.ToLower(label)
		switch {
		case strings.Contains(lower, "previous level"):
			if previousCell == "" {
				previousCell = cell
			}
		case label == "":
			blankCells = append(blankCells, cell)
		case strings.Contains(lower, "result:") || strings.Contains(lower, "complete (c)"):
			if resultCell == "" {
				resultCell = cell
			}
		case strings.Contains(lower, "register"):
			if registerCell == "" {
				registerCell = cell
			}
		default:
			if skillPrototype == "" {
				skillPrototype = cell
			}
		}
	}
	if skillPrototype == "" {
		skillPrototype = `<td class="rotate rotate-cell align-top text-left" style="width: 50pt; height: 50pt; text-align: left; vertical-align: top;"><span style="font-family: Arial;"><font size="1"><strong></strong></font></span></td>`
	}

	nextCells := []string{headerCell}
	if sheet.ShowPreviousLevel && previousCell != "" {
		nextCells = append(nextCells, previousCell)
	}
	for _, skill := range sheet.Skills {
		if strings.TrimSpace(skill.Label) == "" {
			continue
		}
		nextCells = append(nextCells, replaceTemplateCellLabel(skillPrototype, skill.Label))
	}
	nextCells = append(nextCells, blankCells...)
	if sheet.ShowResult && resultCell != "" {
		nextCells = append(nextCells, resultCell)
	}
	if sheet.ShowRegisterIn && registerCell != "" {
		nextCells = append(nextCells, registerCell)
	}

	nextRow := fmt.Sprintf("<tr%s>\n%s\n</tr>", rowAttrs, strings.Join(nextCells, "\n"))
	return frontHTML[:rowStart] + nextRow + frontHTML[rowEnd:], nil
}

func buildCustomTemplateBackHTML(backHTML string, sheet SheetDefinition) string {
	tableStart := strings.Index(strings.ToLower(backHTML), "<table")
	if tableStart < 0 {
		return backHTML + buildCustomTemplateDetailsTable(sheet)
	}
	tableEndRel := strings.LastIndex(strings.ToLower(backHTML[tableStart:]), "</table>")
	if tableEndRel < 0 {
		return backHTML[:tableStart] + buildCustomTemplateDetailsTable(sheet)
	}
	tableEnd := tableStart + tableEndRel + len("</table>")
	return backHTML[:tableStart] + buildCustomTemplateDetailsTable(sheet) + backHTML[tableEnd:]
}

func buildCustomTemplateDetailsTable(sheet SheetDefinition) string {
	cells := make([][]string, 4)
	for index, skill := range sheet.Skills {
		if strings.TrimSpace(skill.Label) == "" {
			continue
		}
		lines := make([]string, 0, len(skill.Details))
		for _, detail := range skill.Details {
			if trimmed := strings.TrimSpace(detail); trimmed != "" {
				lines = append(lines, "&nbsp;&nbsp;&nbsp;&bull;&nbsp;"+html.EscapeString(trimmed))
			}
		}
		body := ""
		if len(lines) > 0 {
			body = "<br>" + strings.Join(lines, "<br>")
		}
		cells[index%4] = append(cells[index%4], fmt.Sprintf(`<p><font size="1"><b>%s</b>%s</font></p>`, html.EscapeString(skill.Label), body))
	}
	return fmt.Sprintf(`<div class="h-0"></div>
				<table border="0" class="w-[1200pt] border-collapse text-[9px] leading-tight text-black">
					<tbody>
						<tr>
							<td width="300" valign="top" style="padding: 0in 4pt; width: 280pt;">%s</td>
							<td width="300" valign="top" style="padding: 0in 4pt; width: 280pt;">%s</td>
							<td width="300" valign="top" style="padding: 0in 4pt; width: 280pt;">%s</td>
							<td width="300" valign="top" style="padding: 0in 4pt; width: 280pt;">%s</td>
						</tr>
					</tbody>
				</table>`,
		strings.Join(cells[0], "\n"),
		strings.Join(cells[1], "\n"),
		strings.Join(cells[2], "\n"),
		strings.Join(cells[3], "\n"),
	)
}

func replaceHTMLTitle(headInner string, title string) string {
	re := regexp.MustCompile(`(?is)<title>.*?</title>`)
	if re.MatchString(headInner) {
		return re.ReplaceAllString(headInner, "<title>"+html.EscapeString(title)+"</title>")
	}
	return "<title>" + html.EscapeString(title) + "</title>\n" + headInner
}

func replaceTemplateHeaderTitle(cell string, title string) string {
	re := regexp.MustCompile(`(?is)<font([^>]*)size=["']?5["']?([^>]*)>.*?</font>`)
	if re.MatchString(cell) {
		return re.ReplaceAllString(cell, "<font$1size=\"5\"$2>"+html.EscapeString(title)+"</font>")
	}
	return cell
}

func replaceTemplateCellLabel(cell string, label string) string {
	re := regexp.MustCompile(`(?is)<strong([^>]*)>.*?</strong>`)
	if re.MatchString(cell) {
		return re.ReplaceAllString(cell, "<strong$1>"+html.EscapeString(label)+"</strong>")
	}
	return cell
}

func tableCells(rowInner string) []string {
	re := regexp.MustCompile(`(?is)<td\b[^>]*>.*?</td>`)
	return re.FindAllString(rowInner, -1)
}

func cleanTemplateCellText(cell string) string {
	value := regexp.MustCompile(`(?is)<[^>]+>`).ReplaceAllString(cell, " ")
	value = html.UnescapeString(value)
	value = strings.ReplaceAll(value, "\u00a0", " ")
	value = regexp.MustCompile(`\s+`).ReplaceAllString(value, " ")
	return strings.TrimSpace(value)
}

func buildCustomSheetHTML(sheet SheetDefinition) string {
	columns := make([]string, 0, len(sheet.Skills)+3)
	if sheet.ShowPreviousLevel {
		columns = append(columns, buildCustomRotatedHeader("Previous Level", sheet.SkillColumnWidthPt))
	}
	for _, skill := range sheet.Skills {
		if strings.TrimSpace(skill.Label) == "" {
			continue
		}
		columns = append(columns, buildCustomRotatedHeader(skill.Label, sheet.SkillColumnWidthPt))
	}
	if sheet.ShowResult {
		columns = append(columns, buildCustomRotatedHeader("Result: Complete (c) Incomplete (I)", sheet.SkillColumnWidthPt))
	}
	if sheet.ShowRegisterIn {
		columns = append(columns, buildCustomRotatedHeader("Register In", sheet.SkillColumnWidthPt))
	}

	detailsHTML := buildCustomSheetDetailsHTML(sheet.Skills)
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>%s</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #000; font-family: Arial, sans-serif; }
    #document { width: fit-content; padding: 0; }
    .templatePage { --sheet-width: %dpx; --rotate-height: %dpx; --rotate-translate: %dpx; --rotate-top: %dpx; page-break-after: always; padding: 0; }
    .templatePage:last-child { page-break-after: auto; }
    .attendance-table { width: var(--sheet-width); border-collapse: collapse; border: 1px solid #000; font-size: 10px; line-height: 1.2; }
    .attendance-table td { border: 1px solid #000; }
    .header-cell { width: %dpt; height: 50pt; padding: 8pt; vertical-align: top; white-space: nowrap; font-size: 13px; }
    .header-title { display: block; margin-bottom: 8px; font-size: 24px; font-weight: 700; }
    .rotate-cell { position: relative; width: %dpt; height: var(--rotate-height) !important; vertical-align: top; text-align: left; white-space: nowrap; }
    .rotate-cell > span { position: absolute; top: var(--rotate-top); left: 0; display: block; transform: translate(0, var(--rotate-translate)) rotate(-90deg); transform-origin: left top; font-size: 9px; font-weight: 700; }
    .details-table { width: 1200pt; border-collapse: collapse; font-size: 9px; line-height: 1.25; }
    .details-table td { width: 300pt; padding: 0 4pt; vertical-align: top; }
    .skill-detail { break-inside: avoid; page-break-inside: avoid; margin: 0 0 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div id="document">
    <div class="templatePage">
      <table border="1" class="attendance-table">
        <tbody id="attendance-rows">
          <tr id="student-rows">
            <td class="header-cell">
              <span class="header-title">%s</span>
              <strong>Instructor: <span id="instructor"></span></strong><br>
              <strong>%s: </strong><span id="start_time"></span><br>
              <strong>Session: </strong><span id="session"></span><br>
              <strong>Location: </strong><span id="location"></span><br>
              <strong>Barcode: </strong><span id="barcode"></span>
            </td>
            %s
          </tr>
        </tbody>
      </table>
    </div>
    <div class="templatePage">
      %s
    </div>
  </div>
</body>
</html>`,
		html.EscapeString(sheet.Title),
		sheet.SheetWidthPx,
		sheet.RotateHeightPx,
		sheet.RotateTranslatePx,
		sheet.RotateTopPx,
		sheet.NameColumnWidthPt,
		sheet.SkillColumnWidthPt,
		html.EscapeString(sheet.Title),
		html.EscapeString(sheet.HeaderLabel),
		strings.Join(columns, "\n"),
		detailsHTML,
	)
}

func buildCustomRotatedHeader(label string, widthPt int) string {
	return fmt.Sprintf(`<td class="rotate rotate-cell" style="width: %dpt;"><span>%s</span></td>`, widthPt, html.EscapeString(label))
}

func buildCustomSheetDetailsHTML(skills []SheetSkill) string {
	cells := make([][]string, 4)
	for index, skill := range skills {
		if strings.TrimSpace(skill.Label) == "" {
			continue
		}
		detailLines := make([]string, 0, len(skill.Details))
		for _, detail := range skill.Details {
			detailLines = append(detailLines, "&nbsp;&nbsp;&nbsp;&bull;&nbsp;"+html.EscapeString(detail))
		}
		body := strings.Join(detailLines, "<br>")
		if body != "" {
			body = "<br>" + body
		}
		block := fmt.Sprintf(`<p class="skill-detail"><strong>%s</strong>%s</p>`, html.EscapeString(skill.Label), body)
		cells[index%4] = append(cells[index%4], block)
	}
	if len(cells[0])+len(cells[1])+len(cells[2])+len(cells[3]) == 0 {
		return `<table border="0" class="details-table"><tbody><tr><td></td><td></td><td></td><td></td></tr></tbody></table>`
	}
	return fmt.Sprintf(`<table border="0" class="details-table"><tbody><tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr></tbody></table>`,
		strings.Join(cells[0], "\n"),
		strings.Join(cells[1], "\n"),
		strings.Join(cells[2], "\n"),
		strings.Join(cells[3], "\n"),
	)
}

func renderSequential(ctx context.Context, session string, items []Item) ([][]byte, error) {
	if len(items) == 0 {
		return nil, errors.New("no attendance items provided")
	}

	output := make([][]byte, 0, len(items))
	for index, item := range items {
		template := strings.TrimSpace(item.Template)
		if template == "" && item.Sheet == nil {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrMissingTemplate)
		}

		pdfBytes, err := renderPDF(ctx, template, pdfPayload{
			Session: session,
			Roster:  item.Roster,
			Sheet:   item.Sheet,
		})
		if err != nil {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, err)
		}
		output = append(output, pdfBytes)
	}
	return output, nil
}

func renderManyTabs(ctx context.Context, session string, items []Item) ([][]byte, error) {
	if len(items) == 0 {
		return nil, errors.New("no attendance items provided")
	}

	jobs := make([]renderJob, 0, len(items))
	for index, item := range items {
		template := strings.TrimSpace(item.Template)
		if template == "" && item.Sheet == nil {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrMissingTemplate)
		}
		templatePath := ""
		if item.Sheet == nil {
			resolved, err := resolveTemplate(template)
			if err != nil {
				return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrTemplateNotFound)
			}
			templatePath = resolved
		}
		jobs = append(jobs, renderJob{
			templatePath: templatePath,
			sheet:        item.Sheet,
			payload: pdfPayload{
				Session: session,
				Roster:  item.Roster,
				Sheet:   item.Sheet,
			},
		})
	}

	output := make([][]byte, len(jobs))
	errs := make([]error, len(jobs))

	allocatorOptions, err := buildChromeAllocatorOptions()
	if err != nil {
		return nil, err
	}

	allocatorCtx, allocatorCancel := chromedp.NewExecAllocator(ctx, allocatorOptions...)
	defer allocatorCancel()

	browserCtx, browserCancel := chromedp.NewContext(allocatorCtx)
	defer browserCancel()

	workerCount := attendanceRenderWorkers()
	if workerCount > len(jobs) {
		workerCount = len(jobs)
	}
	if workerCount < 1 {
		workerCount = 1
	}

	jobIndexes := make(chan int, len(jobs))
	var wg sync.WaitGroup
	wg.Add(workerCount)

	for worker := 0; worker < workerCount; worker++ {
		go func() {
			defer wg.Done()
			for index := range jobIndexes {
				job := jobs[index]
				var pdfBytes []byte
				var err error
				if job.sheet != nil {
					pdfBytes, err = renderHTMLInTab(browserCtx, buildCustomSheetHTML(NormalizeSheetDefinition(*job.sheet, job.payload.Roster.Level)), []renderPayload{buildRenderPayload(job.payload.Session, job.payload.Roster)})
				} else {
					pdfBytes, err = renderPDFInTab(browserCtx, job.templatePath, job.payload)
				}
				if err != nil {
					errs[index] = fmt.Errorf("attendance item %d: %w", index+1, err)
					continue
				}
				output[index] = pdfBytes
			}
		}()
	}

	for i := range jobs {
		jobIndexes <- i
	}
	close(jobIndexes)
	wg.Wait()

	for index, err := range errs {
		if err != nil {
			pdfBytes, retryErr := renderSingleJobPDF(ctx, jobs[index])
			if retryErr != nil {
				return nil, fmt.Errorf("attendance item %d: %w", index+1, retryErr)
			}
			output[index] = pdfBytes
		}
	}

	return output, nil
}

func attendanceRenderWorkers() int {
	raw := strings.TrimSpace(os.Getenv("ATTENDANCE_PDF_CONCURRENCY"))
	if raw == "" {
		return DefaultRenderWorkers
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 1 {
		return DefaultRenderWorkers
	}
	if parsed > 6 {
		return 6
	}
	return parsed
}

func stripScriptTags(html string) string {
	return scriptTagPattern.ReplaceAllString(html, "")
}

const fillAttendanceTemplateJS = `(function () {
  const rosters = Array.isArray(window.__ROSTERS__)
    ? window.__ROSTERS__
    : (window.__ROSTER__ ? [window.__ROSTER__] : []);
  if (rosters.length === 0) {
    return;
  }

  const setText = (root, id, value) => {
    const el = root.querySelector('#' + id);
    if (el) {
      el.textContent = value || '';
    }
  };

  const fillRoster = (root, roster) => {
    if (!roster) {
      return;
    }

    const schedule = roster.schedule || '';
    const startDate = schedule.split(' ')[1] || '';
    const startTimeValue = [startDate, roster.time || ''].filter(Boolean).join(' ').trim();

    setText(root, 'instructor', roster.instructor);
    setText(root, 'start_time', startTimeValue);
    setText(root, 'session', roster.session);
    setText(root, 'location', roster.location);
    setText(root, 'barcode', roster.code);

    const tbody = root.querySelector('#attendance-rows');
    if (!tbody) {
      return;
    }

    const templateRow = root.querySelector('#student-rows');
    const totalColumns = templateRow ? templateRow.children.length : 1;
    const emptyCells = Math.max(totalColumns - 1, 0);

    Array.from(tbody.querySelectorAll('tr')).forEach(row => {
      if (row !== templateRow) {
        tbody.removeChild(row);
      }
    });

    (roster.students || []).forEach((student, index) => {
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');

      const strong = document.createElement('strong');
      strong.style.fontFamily = 'Arial';
      strong.textContent = (index + 1) + '. ' + (student.name || '');
      nameCell.appendChild(strong);

      const font = document.createElement('font');
	  font.innerHTML = '<br><span style="text-decoration: underline;">A</span>bsent/<span style="text-decoration: underline;">P</span>resent<br><span style="color: rgb(98, 98, 98);font-size: 11px;">[Day 1] [Day 2] [Day 3] [Day 4] [Day 5] [Day 6] [Day 7] [Day 8] [Day 9] [Day 10] [Day 11] [Day 12] [Day 13] [Day 14]</span>';
      nameCell.appendChild(font);
      row.appendChild(nameCell);

      for (let i = 0; i < emptyCells; i += 1) {
        const cell = document.createElement('td');
        cell.innerHTML = '&nbsp;';
        row.appendChild(cell);
      }

      tbody.appendChild(row);
    });
  };

  if (rosters[0] && rosters[0].instructor) {
    document.title = rosters[0].instructor;
  }

  const combinedRoots = Array.from(document.querySelectorAll('[data-attendance-root]'));
  if (combinedRoots.length > 0) {
    rosters.forEach((roster, index) => {
      document.querySelectorAll('[data-attendance-root="' + index + '"]').forEach(root => {
        fillRoster(root, roster);
      });
    });
    return;
  }

  fillRoster(document, rosters[0]);
})();`
