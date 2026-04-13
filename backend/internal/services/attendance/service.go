package attendance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	stdhtml "html"
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
	xhtml "golang.org/x/net/html"
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
	Template string `json:"template"`
	Session  string `json:"session"`
	Filename string `json:"filename"`
	Title    string `json:"title"`
	Roster   Roster `json:"roster"`
	Rosters  []Item `json:"rosters"`
}

type Item struct {
	Template string `json:"template"`
	Roster   Roster `json:"roster"`
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
		if req.Template == "" {
			return nil, "", ErrMissingTemplate
		}
		items = []Item{{Template: req.Template, Roster: req.Roster}}
	}

	pdfs := make([][]byte, 0, len(items))
	firstTemplate := strings.TrimSpace(items[0].Template)
	firstCode := items[0].Roster.Code

	if len(items) > 1 {
		rendered, err := renderGroupedItems(ctx, session, items)
		if err != nil {
			return nil, "", fmt.Errorf("unable to render attendance PDF: %w", err)
		}
		pdfs = rendered
	} else {
		template := strings.TrimSpace(items[0].Template)
		if template == "" {
			return nil, "", ErrMissingTemplate
		}

		templatePath, err := resolveTemplate(template)
		if err != nil {
			return nil, "", ErrTemplateNotFound
		}

		pdfBytes, err := renderPDF(ctx, templatePath, pdfPayload{
			Session: session,
			Roster:  items[0].Roster,
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

func renderPDF(ctx context.Context, templatePath string, data pdfPayload) ([]byte, error) {
	return renderHTMLAsPDF(ctx, func() (string, []renderPayload, error) {
		templateHTML, err := readTemplateHTML(templatePath)
		if err != nil {
			return "", nil, err
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
		if template == "" {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrMissingTemplate)
		}
		templatePath, err := resolveTemplate(template)
		if err != nil {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrTemplateNotFound)
		}
		jobs = append(jobs, renderJob{
			templatePath: templatePath,
			payload: pdfPayload{
				Session: session,
				Roster:  item.Roster,
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
			if len(chunk) == 2 {
				pdfBytes, err = renderCombinedPDF(ctx, chunk)
			} else {
				pdfBytes, err = renderPDF(ctx, chunk[0].templatePath, chunk[0].payload)
			}
			if err != nil {
				return nil, fmt.Errorf("attendance item %d: %w", start+pairStart+1, err)
			}
			output = append(output, pdfBytes)
		}

		start = end
	}

	return output, nil
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
	root, err := xhtml.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return templateSections{}, err
	}

	headNode := findElement(root, "head")
	bodyNode := findElement(root, "body")
	documentNode := findNodeByID(root, "document")
	if headNode == nil || bodyNode == nil || documentNode == nil {
		return templateSections{}, errors.New("attendance template missing head/body/document structure")
	}

	pageNode := findFirstClassNode(documentNode, "templatePage")
	if pageNode == nil {
		return templateSections{}, errors.New("attendance template missing templatePage section")
	}

	breakNode := findFirstDirectChildWithClass(pageNode, "break-before-page")
	if breakNode == nil {
		return templateSections{}, errors.New("attendance template missing break-before-page marker")
	}

	return templateSections{
		HeadInnerHTML:  renderChildren(headNode),
		BodyAttrsHTML:  renderAttrs(bodyNode.Attr),
		DocumentAttrs:  renderAttrs(documentNode.Attr),
		PageAttrs:      renderAttrs(pageNode.Attr),
		FrontInnerHTML: renderSiblingsUntil(pageNode.FirstChild, breakNode),
		BackInnerHTML:  renderSiblingsFrom(breakNode.NextSibling),
	}, nil
}

func findElement(root *xhtml.Node, tag string) *xhtml.Node {
	var found *xhtml.Node
	var walk func(*xhtml.Node)
	walk = func(node *xhtml.Node) {
		if found != nil || node == nil {
			return
		}
		if node.Type == xhtml.ElementNode && node.Data == tag {
			found = node
			return
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return found
}

func findNodeByID(root *xhtml.Node, id string) *xhtml.Node {
	var found *xhtml.Node
	var walk func(*xhtml.Node)
	walk = func(node *xhtml.Node) {
		if found != nil || node == nil {
			return
		}
		if node.Type == xhtml.ElementNode && attrValue(node, "id") == id {
			found = node
			return
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return found
}

func findFirstClassNode(root *xhtml.Node, className string) *xhtml.Node {
	var found *xhtml.Node
	var walk func(*xhtml.Node)
	walk = func(node *xhtml.Node) {
		if found != nil || node == nil {
			return
		}
		if node.Type == xhtml.ElementNode && hasClass(node, className) {
			found = node
			return
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return found
}

func findFirstDirectChildWithClass(root *xhtml.Node, className string) *xhtml.Node {
	for child := root.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == xhtml.ElementNode && hasClass(child, className) {
			return child
		}
	}
	return nil
}

func hasClass(node *xhtml.Node, className string) bool {
	classes := strings.Fields(attrValue(node, "class"))
	for _, class := range classes {
		if class == className {
			return true
		}
	}
	return false
}

func attrValue(node *xhtml.Node, key string) string {
	for _, attr := range node.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return ""
}

func renderChildren(node *xhtml.Node) string {
	return renderSiblingsFrom(node.FirstChild)
}

func renderSiblingsUntil(start, end *xhtml.Node) string {
	var builder strings.Builder
	for node := start; node != nil && node != end; node = node.NextSibling {
		builder.WriteString(renderNode(node))
	}
	return builder.String()
}

func renderSiblingsFrom(start *xhtml.Node) string {
	var builder strings.Builder
	for node := start; node != nil; node = node.NextSibling {
		builder.WriteString(renderNode(node))
	}
	return builder.String()
}

func renderNode(node *xhtml.Node) string {
	var builder strings.Builder
	if err := xhtml.Render(&builder, node); err != nil {
		return ""
	}
	return builder.String()
}

func renderAttrs(attrs []xhtml.Attribute) string {
	if len(attrs) == 0 {
		return ""
	}
	var builder strings.Builder
	for _, attr := range attrs {
		builder.WriteString(" ")
		if attr.Namespace != "" {
			builder.WriteString(attr.Namespace)
			builder.WriteString(":")
		}
		builder.WriteString(attr.Key)
		builder.WriteString(`="`)
		builder.WriteString(stdhtml.EscapeString(attr.Val))
		builder.WriteString(`"`)
	}
	return builder.String()
}

func renderSequential(ctx context.Context, session string, items []Item) ([][]byte, error) {
	if len(items) == 0 {
		return nil, errors.New("no attendance items provided")
	}

	output := make([][]byte, 0, len(items))
	for index, item := range items {
		template := strings.TrimSpace(item.Template)
		if template == "" {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrMissingTemplate)
		}
		templatePath, err := resolveTemplate(template)
		if err != nil {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrTemplateNotFound)
		}

		pdfBytes, err := renderPDF(ctx, templatePath, pdfPayload{
			Session: session,
			Roster:  item.Roster,
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

	type renderJob struct {
		templatePath string
		payload      pdfPayload
	}

	jobs := make([]renderJob, 0, len(items))
	for index, item := range items {
		template := strings.TrimSpace(item.Template)
		if template == "" {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrMissingTemplate)
		}
		templatePath, err := resolveTemplate(template)
		if err != nil {
			return nil, fmt.Errorf("attendance item %d: %w", index+1, ErrTemplateNotFound)
		}
		jobs = append(jobs, renderJob{
			templatePath: templatePath,
			payload: pdfPayload{
				Session: session,
				Roster:  item.Roster,
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
				pdfBytes, err := renderPDFInTab(browserCtx, job.templatePath, job.payload)
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
			pdfBytes, retryErr := renderPDF(ctx, jobs[index].templatePath, jobs[index].payload)
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
	  font.innerHTML = '<br><span style="text-decoration: underline;">A</span>bsent/<span style="text-decoration: underline;">P</span>resent<br><span style="color: rgb(191, 191, 191);font-size: 11px;">[Day 1] [Day 2] [Day 3] [Day 4] [Day 5] [Day 6] [Day 7] [Day 8] [Day 9] [Day 10] [Day 11] [Day 12] [Day 13] [Day 14]</span>';
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
