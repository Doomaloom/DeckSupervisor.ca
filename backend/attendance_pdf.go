package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

const (
	defaultSessionName      = "Summer 2025"
	defaultAttendanceLayout = "SplashFitness"
)

var scriptTagPattern = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)

type attendancePDFRequest struct {
	Template string           `json:"template"`
	Session  string           `json:"session"`
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

	req.Template = strings.TrimSpace(req.Template)
	if req.Template == "" {
		http.Error(w, "Missing attendance template", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Session) == "" {
		req.Session = defaultSessionName
	}

	templatePath, err := resolveAttendanceTemplate(req.Template)
	if err != nil {
		http.Error(w, "Attendance template not found", http.StatusNotFound)
		return
	}

	pdfBytes, err := renderAttendancePDF(r.Context(), templatePath, req)
	if err != nil {
		http.Error(w, "Unable to render attendance PDF", http.StatusInternalServerError)
		return
	}

	filename := buildAttendanceFilename(req.Roster.Code, req.Template)
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
	if !ok {
		return "", errors.New("unable to resolve backend path")
	}
	return filepath.Join(filepath.Dir(filename), "swimming attendance"), nil
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

func renderAttendancePDF(ctx context.Context, templatePath string, req attendancePDFRequest) ([]byte, error) {
	templateHTML, err := os.ReadFile(templatePath)
	if err != nil {
		return nil, err
	}
	htmlContent := stripScriptTags(string(templateHTML))

	payload := attendanceRenderPayload{
		Code:       req.Roster.Code,
		Time:       req.Roster.Time,
		Instructor: req.Roster.Instructor,
		Location:   req.Roster.Location,
		Schedule:   req.Roster.Schedule,
		Session:    req.Session,
		Students:   req.Roster.Students,
	}
	rosterJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	allocatorOptions := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.NoSandbox,
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("disable-dev-shm-usage", true),
	)
	allocatorCtx, allocatorCancel := chromedp.NewExecAllocator(ctx, allocatorOptions...)
	defer allocatorCancel()

	taskCtx, taskCancel := chromedp.NewContext(allocatorCtx)
	defer taskCancel()

	var pdfBytes []byte
	err = chromedp.Run(taskCtx,
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
