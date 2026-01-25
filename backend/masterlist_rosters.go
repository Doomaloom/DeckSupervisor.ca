package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/http"
	"os"
	"strings"
	"time"

	"cob-aquatics/tasks"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

type masterListRostersRequest struct {
	Rosters []tasks.ClassRoster     `json:"rosters"`
	Options masterListRosterOptions `json:"options"`
}

type masterListRosterOptions struct {
	TimeHeaders       bool `json:"time_headers"`
	InstructorHeaders bool `json:"instructor_headers"`
	CourseHeaders     bool `json:"course_headers"`
	Borders           bool `json:"borders"`
	CenterTime        bool `json:"center_time"`
	BoldTime          bool `json:"bold_time"`
	CenterCourse      bool `json:"center_course"`
	BoldCourse        bool `json:"bold_course"`
}

type masterListRowKind int

const (
	masterListRowData masterListRowKind = iota
	masterListRowTimeHeader
	masterListRowCourseHeader
)

type masterListRow struct {
	kind  masterListRowKind
	label string
	cells []string
}

func masterListRostersHandler(w http.ResponseWriter, r *http.Request) {
	var req masterListRostersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Rosters) == 0 {
		http.Error(w, "Missing rosters", http.StatusBadRequest)
		return
	}

	rows, err := buildMasterListRows(req.Rosters, req.Options)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error building master list: %v", err), http.StatusBadRequest)
		return
	}

	htmlContent := buildMasterListHTML(rows, req.Options)
	pdfBytes, err := renderMasterListPDF(r.Context(), htmlContent)
	if err != nil {
		http.Error(w, fmt.Sprintf("Unable to render master list PDF: %v", err), http.StatusInternalServerError)
		return
	}

	filename := buildMasterListPdfFilename()
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	w.Write(pdfBytes)
}

func buildMasterListRows(
	rosters []tasks.ClassRoster,
	options masterListRosterOptions,
) ([]masterListRow, error) {
	rows := make([]masterListRow, 0)
	currentTime := ""
	dataCount := 0

	for _, roster := range rosters {
		timeValue := strings.TrimSpace(roster.Time)
		if options.TimeHeaders && timeValue != "" && timeValue != currentTime {
			rows = append(rows, masterListRow{
				kind:  masterListRowTimeHeader,
				label: timeValue,
			})
			currentTime = timeValue
		}

		if options.CourseHeaders {
			label := strings.TrimSpace(roster.ServiceName)
			if label == "" {
				label = strings.TrimSpace(roster.Code)
			}

			if options.InstructorHeaders {
				instructor := strings.TrimSpace(roster.Instructor)
				if instructor == "" && len(roster.Students) > 0 {
					instructor = strings.TrimSpace(roster.Students[0].Instructor)
				}
				if instructor != "" {
					label = fmt.Sprintf("%s - %s", label, instructor)
				}
			}

			if label != "" {
				rows = append(rows, masterListRow{
					kind:  masterListRowCourseHeader,
					label: label,
				})
			}
		}

		for _, student := range roster.Students {
			name := strings.TrimSpace(student.Name)
			if name == "" {
				continue
			}

			code := strings.TrimSpace(roster.Code)
			if code == "" {
				continue
			}

			serviceName := strings.TrimSpace(roster.ServiceName)
			if serviceName == "" {
				serviceName = strings.TrimSpace(student.Level)
			}

			instructor := strings.TrimSpace(roster.Instructor)
			if instructor == "" {
				instructor = strings.TrimSpace(student.Instructor)
			}

			rows = append(rows, masterListRow{
				kind: masterListRowData,
				cells: []string{
					code,
					timeValue,
					instructor,
					serviceName,
					name,
					strings.TrimSpace(student.Phone),
				},
			})
			dataCount++
		}
	}

	if dataCount == 0 {
		return nil, errors.New("no student rows to process")
	}

	return rows, nil
}

func buildMasterListHTML(rows []masterListRow, options masterListRosterOptions) string {
	const (
		tableID = "masterlist-table"
	)
	headers := []string{
		"EventID",
		"EventTime",
		"Instructor",
		"ServiceName",
		"AttendeeName",
		"AttendeePhone",
	}

	borderClass := "no-borders"
	if options.Borders {
		borderClass = "with-borders"
	}

	var buf bytes.Buffer
	buf.WriteString("<!doctype html><html><head><meta charset=\"utf-8\"/>")
	buf.WriteString("<title>Masterlist</title>")
	buf.WriteString("<style>")
	buf.WriteString(`@page { size: Letter; margin: 0.35in; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Arial", sans-serif; color: #111; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
th, td { padding: 2px 4px; font-size: 9px; vertical-align: top; word-break: break-word; }
.` + borderClass + ` th, .` + borderClass + ` td { border: 1px solid #000; }
.no-borders th, .no-borders td { border: none; }
.header-row td { background: #f4f4f4; }
.header-row.bold td { font-weight: 700; }
.header-row.center td { text-align: center; }
tr { page-break-inside: avoid; }`)
	buf.WriteString("</style></head><body>")
	buf.WriteString("<table id=\"" + tableID + "\" class=\"" + borderClass + "\">")
	buf.WriteString("<colgroup>")
	for _, width := range buildMasterListColumnWidths(rows, headers) {
		buf.WriteString(fmt.Sprintf("<col style=\"width:%.2f%%\"/>", width))
	}
	buf.WriteString("</colgroup>")
	buf.WriteString("<thead><tr>")
	for _, header := range headers {
		buf.WriteString("<th>")
		buf.WriteString(html.EscapeString(header))
		buf.WriteString("</th>")
	}
	buf.WriteString("</tr></thead><tbody>")

	for _, row := range rows {
		switch row.kind {
		case masterListRowData:
			buf.WriteString("<tr>")
			for _, cell := range row.cells {
				buf.WriteString("<td>")
				buf.WriteString(html.EscapeString(cell))
				buf.WriteString("</td>")
			}
			buf.WriteString("</tr>")
		case masterListRowTimeHeader, masterListRowCourseHeader:
			className := buildMasterListHeaderClass(row.kind, options)
			buf.WriteString("<tr class=\"header-row")
			if className != "" {
				buf.WriteString(" ")
				buf.WriteString(className)
			}
			buf.WriteString("\"><td colspan=\"6\">")
			buf.WriteString(html.EscapeString(row.label))
			buf.WriteString("</td></tr>")
		}
	}

	buf.WriteString("</tbody></table></body></html>")
	return buf.String()
}

func buildMasterListHeaderClass(kind masterListRowKind, options masterListRosterOptions) string {
	classes := make([]string, 0, 2)
	switch kind {
	case masterListRowTimeHeader:
		if options.BoldTime {
			classes = append(classes, "bold")
		}
		if options.CenterTime {
			classes = append(classes, "center")
		}
	case masterListRowCourseHeader:
		if options.BoldCourse {
			classes = append(classes, "bold")
		}
		if options.CenterCourse {
			classes = append(classes, "center")
		}
	}
	return strings.Join(classes, " ")
}

func buildMasterListColumnWidths(rows []masterListRow, headers []string) []float64 {
	maxLengths := make([]int, len(headers))
	for i, header := range headers {
		maxLengths[i] = len([]rune(header))
	}

	for _, row := range rows {
		if row.kind != masterListRowData {
			continue
		}
		for i, cell := range row.cells {
			if i >= len(maxLengths) {
				break
			}
			length := len([]rune(cell))
			if length > maxLengths[i] {
				maxLengths[i] = length
			}
		}
	}

	total := 0
	for _, length := range maxLengths {
		if length < 1 {
			length = 1
		}
		total += length
	}
	if total == 0 {
		widths := make([]float64, len(headers))
		if len(headers) == 0 {
			return widths
		}
		width := 100.0 / float64(len(headers))
		for i := range widths {
			widths[i] = width
		}
		return widths
	}

	widths := make([]float64, len(headers))
	for i, length := range maxLengths {
		if length < 1 {
			length = 1
		}
		widths[i] = (float64(length) / float64(total)) * 100
	}
	return widths
}

func renderMasterListPDF(ctx context.Context, htmlContent string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	allocatorOptions, err := buildChromeAllocatorOptions()
	if err != nil {
		return nil, err
	}

	allocatorCtx, allocatorCancel := chromedp.NewExecAllocator(ctx, allocatorOptions...)
	defer allocatorCancel()

	taskCtx, taskCancel := chromedp.NewContext(allocatorCtx)
	defer taskCancel()

	file, err := os.CreateTemp("", "masterlist-*.html")
	if err != nil {
		return nil, err
	}
	filePath := file.Name()
	if _, err := file.WriteString(htmlContent); err != nil {
		file.Close()
		return nil, err
	}
	if err := file.Close(); err != nil {
		return nil, err
	}
	defer os.Remove(filePath)

	fileURL := "file://" + filePath
	var pdfBytes []byte

	err = chromedp.Run(taskCtx,
		chromedp.Navigate(fileURL),
		chromedp.WaitReady("#masterlist-table", chromedp.ByID),
		chromedp.Sleep(400*time.Millisecond),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBytes, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithPreferCSSPageSize(true).
				WithScale(0.9).
				Do(ctx)
			return err
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

func buildMasterListPdfFilename() string {
	now := time.Now()
	return fmt.Sprintf("MasterList_%d_%d_%d.pdf", now.Month(), now.Day(), now.Year())
}
