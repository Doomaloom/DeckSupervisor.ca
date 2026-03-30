package attendance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
		rendered, err := renderManyTabs(ctx, session, items)
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
	allocatorOptions, err := buildChromeAllocatorOptions()
	if err != nil {
		return nil, err
	}

	allocatorCtx, allocatorCancel := chromedp.NewExecAllocator(ctx, allocatorOptions...)
	defer allocatorCancel()

	browserCtx, browserCancel := chromedp.NewContext(allocatorCtx)
	defer browserCancel()

	return renderPDFInTab(browserCtx, templatePath, data)
}

func renderPDFInTab(browserCtx context.Context, templatePath string, data pdfPayload) ([]byte, error) {
	tabCtx, tabCancel := chromedp.NewContext(browserCtx)
	defer tabCancel()

	tabCtx, timeoutCancel := context.WithTimeout(tabCtx, 25*time.Second)
	defer timeoutCancel()

	return renderPDFWithContext(tabCtx, templatePath, data)
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

func renderPDFWithContext(ctx context.Context, templatePath string, data pdfPayload) ([]byte, error) {
	templateHTML, err := os.ReadFile(templatePath)
	if err != nil {
		return nil, err
	}
	htmlContent := stripScriptTags(string(templateHTML))

	payload := renderPayload{
		Code:       data.Roster.Code,
		Time:       data.Roster.Time,
		Instructor: data.Roster.Instructor,
		Location:   data.Roster.Location,
		Schedule:   data.Roster.Schedule,
		Session:    data.Session,
		Students:   data.Roster.Students,
	}
	rosterJSON, err := json.Marshal(payload)
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
		chromedp.WaitReady("#attendance-rows", chromedp.ByID),
		chromedp.Evaluate(fmt.Sprintf("window.__ROSTER__ = %s;", rosterJSON), nil),
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
  const roster = window.__ROSTER__;
  if (!roster) {
    return;
  }

  const schedule = roster.schedule || '';
  const startDate = schedule.split(' ')[1] || '';
  const startTimeValue = [startDate, roster.time || ''].filter(Boolean).join(' ').trim();

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value || '';
    }
  };

  if (roster.instructor) {
    document.title = roster.instructor;
  }

  setText('instructor', roster.instructor);
  setText('start_time', startTimeValue);
  setText('session', roster.session);
  setText('location', roster.location);
  setText('barcode', roster.code);

  const tbody = document.getElementById('attendance-rows');
  if (!tbody) {
    return;
  }

  const templateRow = document.getElementById('student-rows');
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
})();`
