package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/pdfcpu/pdfcpu/pkg/api"
)

const (
	defaultSessionName      = "Summer 2025"
	defaultAttendanceLayout = "SplashFitness"
)

var scriptTagPattern = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)

type attendancePDFRequest struct {
	Template string              `json:"template"`
	Session  string              `json:"session"`
	Filename string              `json:"filename"`
	Roster   attendanceRoster    `json:"roster"`
	Rosters  []attendancePDFItem `json:"rosters"`
}

type attendancePDFItem struct {
	Template string           `json:"template"`
	Roster   attendanceRoster `json:"roster"`
}

type attendanceRoster struct {
	Code        string              `json:"code"`
	Level       string              `json:"level"`
	ServiceName string              `json:"serviceName"`
	Time        string              `json:"time"`
	Instructor  string              `json:"instructor"`
	Location    string              `json:"location"`
	Schedule    string              `json:"schedule"`
	Students    []attendanceStudent `json:"students"`
}

type attendanceStudent struct {
	Name string `json:"name"`
}

type attendancePDFPayload struct {
	Session string
	Roster  attendanceRoster
}

type attendanceRenderPayload struct {
	Code       string              `json:"code"`
	Time       string              `json:"time"`
	Instructor string              `json:"instructor"`
	Location   string              `json:"location"`
	Schedule   string              `json:"schedule"`
	Session    string              `json:"session"`
	Students   []attendanceStudent `json:"students"`
}

func attendancePDFHandler(w http.ResponseWriter, r *http.Request) {
	var req attendancePDFRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	session := strings.TrimSpace(req.Session)
	if session == "" {
		session = defaultSessionName
	}

	items := req.Rosters
	if len(items) == 0 {
		req.Template = strings.TrimSpace(req.Template)
		if req.Template == "" {
			http.Error(w, "Missing attendance template", http.StatusBadRequest)
			return
		}
		items = []attendancePDFItem{{Template: req.Template, Roster: req.Roster}}
	}

	pdfs := make([][]byte, 0, len(items))
	firstTemplate := strings.TrimSpace(items[0].Template)
	firstCode := items[0].Roster.Code

	if len(items) > 1 {
		rendered, err := renderAttendancePDFManyTabs(r.Context(), session, items)
		if err != nil {
			log.Printf("attendance pdf: multi-tab render failed: %v", err)
			rendered, err = renderAttendancePDFSequential(r.Context(), session, items)
			if err != nil {
				log.Printf("attendance pdf: sequential fallback failed: %v", err)
				http.Error(w, fmt.Sprintf("Unable to render attendance PDF: %v", err), http.StatusInternalServerError)
				return
			}
		}
		pdfs = rendered
	} else {
		template := strings.TrimSpace(items[0].Template)
		if template == "" {
			http.Error(w, "Missing attendance template", http.StatusBadRequest)
			return
		}

		templatePath, err := resolveAttendanceTemplate(template)
		if err != nil {
			http.Error(w, "Attendance template not found", http.StatusNotFound)
			return
		}

		pdfBytes, err := renderAttendancePDF(r.Context(), templatePath, attendancePDFPayload{
			Session: session,
			Roster:  items[0].Roster,
		})
		if err != nil {
			http.Error(w, "Unable to render attendance PDF", http.StatusInternalServerError)
			return
		}
		pdfs = append(pdfs, pdfBytes)
	}

	var pdfBytes []byte
	filename := ""
	requestedFilename := sanitizeFilename(req.Filename)
	if len(pdfs) == 1 {
		pdfBytes = pdfs[0]
		if requestedFilename != "" {
			filename = buildAttendanceFilename(requestedFilename, "attendance")
		} else {
			filename = buildAttendanceFilename(firstCode, firstTemplate)
		}
	} else {
		merged, err := mergePDFs(pdfs)
		if err != nil {
			http.Error(w, fmt.Sprintf("Unable to merge attendance PDFs: %v", err), http.StatusInternalServerError)
			return
		}
		pdfBytes = merged
		if requestedFilename != "" {
			filename = buildAttendanceFilename(requestedFilename, "attendance")
		} else {
			filename = buildAttendanceFilename("", "multi")
		}
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	w.Write(pdfBytes)
}

func resolveAttendanceTemplate(template string) (string, error) {
	templatesDir, err := attendanceTemplatesDir()
	if err != nil {
		return "", err
	}

	templatePath := filepath.Join(templatesDir, fmt.Sprintf("%s.html", template))
	if _, err := os.Stat(templatePath); err == nil {
		return templatePath, nil
	}

	fallbackPath := filepath.Join(templatesDir, fmt.Sprintf("%s.html", defaultAttendanceLayout))
	if _, err := os.Stat(fallbackPath); err == nil {
		return fallbackPath, nil
	}

	return "", errors.New("attendance template not found")
}

func attendanceTemplatesDir() (string, error) {
	_, filename, _, ok := runtime.Caller(0)
	if ok {
		path := filepath.Join(filepath.Dir(filename), "swimming attendance")
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

func buildAttendanceFilename(code, template string) string {
	base := strings.TrimSpace(code)
	if base == "" {
		base = template
	}
	base = sanitizeFilename(base)
	return fmt.Sprintf("attendance-%s.pdf", base)
}

func sanitizeFilename(input string) string {
	const fallback = "sheet"
	clean := strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' {
			return r
		}
		if r >= 'A' && r <= 'Z' {
			return r
		}
		if r >= '0' && r <= '9' {
			return r
		}
		if r == '-' || r == '_' {
			return r
		}
		if r == ' ' {
			return '-'
		}
		return -1
	}, input)
	if clean == "" {
		return fallback
	}
	return clean
}

func renderAttendancePDF(ctx context.Context, templatePath string, data attendancePDFPayload) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	allocatorOptions, err := buildChromeAllocatorOptions()
	if err != nil {
		return nil, err
	}

	allocatorCtx, allocatorCancel := chromedp.NewExecAllocator(ctx, allocatorOptions...)
	defer allocatorCancel()

	taskCtx, taskCancel := chromedp.NewContext(allocatorCtx)
	defer taskCancel()

	return renderAttendancePDFWithContext(taskCtx, templatePath, data)
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

func renderAttendancePDFWithContext(ctx context.Context, templatePath string, data attendancePDFPayload) ([]byte, error) {
	templateHTML, err := os.ReadFile(templatePath)
	if err != nil {
		return nil, err
	}
	htmlContent := stripScriptTags(string(templateHTML))

	payload := attendanceRenderPayload{
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

func renderAttendancePDFManyTabs(ctx context.Context, session string, items []attendancePDFItem) ([][]byte, error) {
	if len(items) == 0 {
		return nil, errors.New("no attendance items provided")
	}

	type renderJob struct {
		templatePath string
		payload      attendancePDFPayload
	}

	jobs := make([]renderJob, 0, len(items))
	for index, item := range items {
		template := strings.TrimSpace(item.Template)
		if template == "" {
			return nil, fmt.Errorf("attendance item %d: missing attendance template", index+1)
		}
		templatePath, err := resolveAttendanceTemplate(template)
		if err != nil {
			return nil, fmt.Errorf("attendance item %d: attendance template not found", index+1)
		}
		jobs = append(jobs, renderJob{
			templatePath: templatePath,
			payload: attendancePDFPayload{
				Session: session,
				Roster:  item.Roster,
			},
		})
	}

	allocatorOptions, err := buildChromeAllocatorOptions()
	if err != nil {
		return nil, err
	}
	allocatorCtx, allocatorCancel := chromedp.NewExecAllocator(ctx, allocatorOptions...)
	defer allocatorCancel()

	browserCtx, browserCancel := chromedp.NewContext(allocatorCtx)
	defer browserCancel()

	if err := chromedp.Run(browserCtx, chromedp.Navigate("about:blank")); err != nil {
		return nil, err
	}

	type result struct {
		index int
		pdf   []byte
		err   error
	}

	results := make(chan result, len(jobs))
	var wg sync.WaitGroup

	for index, job := range jobs {
		wg.Add(1)
		go func(idx int, data renderJob) {
			defer wg.Done()
			tabCtx, tabCancel := chromedp.NewContext(browserCtx)
			defer tabCancel()

			tabCtx, timeoutCancel := context.WithTimeout(tabCtx, 25*time.Second)
			defer timeoutCancel()

			pdfBytes, err := renderAttendancePDFWithContext(tabCtx, data.templatePath, data.payload)
			results <- result{index: idx, pdf: pdfBytes, err: err}
		}(index, job)
	}

	wg.Wait()
	close(results)

	output := make([][]byte, len(jobs))
	for res := range results {
		if res.err != nil {
			return nil, res.err
		}
		output[res.index] = res.pdf
	}
	return output, nil
}

func resolveChromePath() (string, error) {
	if envPath := strings.TrimSpace(os.Getenv("CHROME_PATH")); envPath != "" {
		if _, err := os.Stat(envPath); err == nil {
			return envPath, nil
		}
		return "", fmt.Errorf("chrome executable not found at CHROME_PATH: %s", envPath)
	}

	if path, err := exec.LookPath("google-chrome"); err == nil {
		return path, nil
	}
	if path, err := exec.LookPath("chromium"); err == nil {
		return path, nil
	}
	if path, err := exec.LookPath("chromium-browser"); err == nil {
		return path, nil
	}

	if runtime.GOOS == "darwin" {
		candidates := []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		}
		for _, candidate := range candidates {
			if _, err := os.Stat(candidate); err == nil {
				return candidate, nil
			}
		}
	}

	return "", errors.New("chrome executable not found; install Chrome/Chromium or set CHROME_PATH")
}

func renderAttendancePDFSequential(ctx context.Context, session string, items []attendancePDFItem) ([][]byte, error) {
	if len(items) == 0 {
		return nil, errors.New("no attendance items provided")
	}

	output := make([][]byte, 0, len(items))
	for index, item := range items {
		template := strings.TrimSpace(item.Template)
		if template == "" {
			return nil, fmt.Errorf("attendance item %d: missing attendance template", index+1)
		}
		templatePath, err := resolveAttendanceTemplate(template)
		if err != nil {
			return nil, fmt.Errorf("attendance item %d: attendance template not found", index+1)
		}

		pdfBytes, err := renderAttendancePDF(ctx, templatePath, attendancePDFPayload{
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

func stripScriptTags(html string) string {
	return scriptTagPattern.ReplaceAllString(html, "")
}

func mergePDFs(pdfs [][]byte) ([]byte, error) {
	if len(pdfs) == 0 {
		return nil, errors.New("no PDFs to merge")
	}

	readers := make([]io.ReadSeeker, 0, len(pdfs))
	for _, pdf := range pdfs {
		if len(pdf) == 0 {
			return nil, errors.New("empty PDF payload")
		}
		readers = append(readers, bytes.NewReader(pdf))
	}

	var buf bytes.Buffer
	if err := api.MergeRaw(readers, &buf, false, nil); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
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
    font.size = '2';
    font.innerHTML = '<br><span style="text-decoration: underline;">A</span>bsent/<span style="text-decoration: underline;">P</span>resent<br><span style="color: rgb(191, 191, 191);">[Day 1] [Day 2] [Day 3] [Day 4] [Day 5] [Day 6] [Day 7] [Day 8] [Day 9] [Day 10] [Day 11] [Day 12] [Day 13] [Day 14]</span>';
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
