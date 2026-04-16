package masterlist

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html"
	"strings"
	"time"

	"cob-aquatics/internal/services/pdf"
	"cob-aquatics/tasks"
	"github.com/chromedp/cdproto/page"
)

type Options struct {
	TimeHeaders       bool `json:"time_headers"`
	InstructorHeaders bool `json:"instructor_headers"`
	CourseHeaders     bool `json:"course_headers"`
	Borders           bool `json:"borders"`
	CenterTime        bool `json:"center_time"`
	BoldTime          bool `json:"bold_time"`
	CenterCourse      bool `json:"center_course"`
	BoldCourse        bool `json:"bold_course"`
	FontSize          int  `json:"font_size"`
}

var (
	ErrBuildRows = errors.New("unable to build master list")
	ErrRenderPDF = errors.New("unable to render master list pdf")
)

const (
	defaultFontSizePx         = 14
	minFontSizePx             = 8
	maxFontSizePx             = 18
	masterlistTitleFontSizePx = 14
	masterlistCellPaddingY    = 3
	masterlistCellPaddingX    = 6
)

// Editable width weights in column order:
// EventID, EventTime, Instructor, ServiceName, AttendeeName, Age, AttendeePhone.
var masterlistColumnWidthWeights = []float64{11, 22, 14, 18, 24, 8, 20}

type RowKind int

const (
	rowData RowKind = iota
	rowTimeHeader
	rowCourseHeader
)

type row struct {
	kind  RowKind
	label string
	cells []string
}

func BuildPDF(ctx context.Context, rosters []tasks.ClassRoster, options Options, sessionName, generatedDate string, sessionWeek int, sessionProgressLabel string) ([]byte, string, error) {
	htmlContent, err := BuildHTMLPreview(rosters, options, sessionName, generatedDate, sessionWeek, sessionProgressLabel)
	if err != nil {
		return nil, "", err
	}

	pdfBytes, err := renderPDF(ctx, htmlContent)
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrRenderPDF, err)
	}

	filename := buildFilename()
	return pdfBytes, filename, nil
}

func BuildHTMLPreview(rosters []tasks.ClassRoster, options Options, sessionName, generatedDate string, sessionWeek int, sessionProgressLabel string) (string, error) {
	if len(rosters) == 0 {
		return "", errors.New("missing rosters")
	}

	rows, err := buildRows(rosters, options)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrBuildRows, err)
	}

	title := buildTitle(sessionName, sessionWeek, sessionProgressLabel, generatedDate)
	return buildHTML(rows, options, title), nil
}

func buildRows(rosters []tasks.ClassRoster, options Options) ([]row, error) {
	rows := make([]row, 0)
	currentTime := ""
	dataCount := 0

	for _, roster := range rosters {
		timeValue := strings.TrimSpace(roster.Time)
		if options.TimeHeaders && timeValue != "" && timeValue != currentTime {
			rows = append(rows, row{
				kind:  rowTimeHeader,
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
				rows = append(rows, row{
					kind:  rowCourseHeader,
					label: label,
				})
			}
		}

		for _, student := range roster.Students {
			name := strings.TrimSpace(student.Name)
			if name == "" {
				continue
			}

			code := tasks.NormalizeEventID(roster.Code)
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

			rows = append(rows, row{
				kind: rowData,
				cells: []string{
					code,
					timeValue,
					instructor,
					serviceName,
					name,
					strings.TrimSpace(student.Age),
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

func buildHTML(rows []row, options Options, title string) string {
	const tableID = "masterlist-table"
	headers := []string{
		"EventID",
		"EventTime",
		"Instructor",
		"ServiceName",
		"AttendeeName",
		"Age",
		"AttendeePhone",
	}

	borderClass := "no-borders"
	if options.Borders {
		borderClass = "with-borders"
	}
	fontSizePx := normalizeFontSize(options.FontSize)

	var buf bytes.Buffer
	buf.WriteString("<!doctype html><html><head><meta charset=\"utf-8\"/>")
	buf.WriteString("<title>Masterlist</title>")
	buf.WriteString("<style>")
	buf.WriteString(`@page { size: Letter; margin: 0.35in; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Arial", sans-serif; color: #111; }
.masterlist-title { font-size: ` + fmt.Sprintf("%dpx", masterlistTitleFontSizePx) + `; font-weight: 700; text-align: center; margin: 0 0 8px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
th, td { padding: ` + fmt.Sprintf("%dpx %dpx", masterlistCellPaddingY, masterlistCellPaddingX) + `; font-size: ` + fmt.Sprintf("%dpx", fontSizePx) + `; line-height: 1.2; vertical-align: top; word-break: break-word; }
.` + borderClass + ` th, .` + borderClass + ` td { border: 1px solid #000; }
.no-borders th, .no-borders td { border: none; }
th:nth-child(6), td:nth-child(6) { text-align: center; }
.header-row td { background: #f4f4f4; }
.header-row.bold td { font-weight: 700; }
.header-row.center td { text-align: center; }
tr { page-break-inside: avoid; }`)
	buf.WriteString("</style></head><body>")
	if title != "" {
		buf.WriteString("<div class=\"masterlist-title\">")
		buf.WriteString(html.EscapeString(title))
		buf.WriteString("</div>")
	}
	buf.WriteString("<table id=\"" + tableID + "\" class=\"" + borderClass + "\">")
	buf.WriteString("<colgroup>")
	for _, width := range resolveColumnWidths(len(headers)) {
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
		case rowData:
			buf.WriteString("<tr>")
			for _, cell := range row.cells {
				buf.WriteString("<td>")
				buf.WriteString(html.EscapeString(cell))
				buf.WriteString("</td>")
			}
			buf.WriteString("</tr>")
		case rowTimeHeader, rowCourseHeader:
			className := buildHeaderClass(row.kind, options)
			buf.WriteString("<tr class=\"header-row")
			if className != "" {
				buf.WriteString(" ")
				buf.WriteString(className)
			}
			buf.WriteString("\"><td colspan=\"7\">")
			buf.WriteString(html.EscapeString(row.label))
			buf.WriteString("</td></tr>")
		}
	}

	buf.WriteString("</tbody></table></body></html>")
	return buf.String()
}

func buildTitle(sessionName string, sessionWeek int, sessionProgressLabel string, generatedDate string) string {
	parts := make([]string, 0, 3)
	if strings.TrimSpace(sessionName) != "" {
		parts = append(parts, strings.TrimSpace(sessionName))
	}
	if strings.TrimSpace(sessionProgressLabel) != "" {
		parts = append(parts, strings.TrimSpace(sessionProgressLabel))
	} else if sessionWeek > 0 {
		parts = append(parts, fmt.Sprintf("Week %d", sessionWeek))
	}
	if strings.TrimSpace(generatedDate) != "" {
		parts = append(parts, strings.TrimSpace(generatedDate))
	}
	return strings.Join(parts, " - ")
}

func buildHeaderClass(kind RowKind, options Options) string {
	classes := make([]string, 0, 2)
	switch kind {
	case rowTimeHeader:
		if options.BoldTime {
			classes = append(classes, "bold")
		}
		if options.CenterTime {
			classes = append(classes, "center")
		}
	case rowCourseHeader:
		if options.BoldCourse {
			classes = append(classes, "bold")
		}
		if options.CenterCourse {
			classes = append(classes, "center")
		}
	}
	return strings.Join(classes, " ")
}

func normalizeFontSize(value int) int {
	if value <= 0 {
		return defaultFontSizePx
	}
	if value < minFontSizePx {
		return minFontSizePx
	}
	if value > maxFontSizePx {
		return maxFontSizePx
	}
	return value
}

func resolveColumnWidths(columnCount int) []float64 {
	widths := make([]float64, columnCount)
	if columnCount == 0 {
		return widths
	}

	if len(masterlistColumnWidthWeights) != columnCount {
		width := 100.0 / float64(columnCount)
		for i := range widths {
			widths[i] = width
		}
		return widths
	}

	total := 0.0
	for _, weight := range masterlistColumnWidthWeights {
		if weight > 0 {
			total += weight
		}
	}
	if total <= 0 {
		width := 100.0 / float64(columnCount)
		for i := range widths {
			widths[i] = width
		}
		return widths
	}

	for i, weight := range masterlistColumnWidthWeights {
		if weight <= 0 {
			continue
		}
		widths[i] = (weight / total) * 100
	}
	return widths
}

func renderPDF(ctx context.Context, htmlContent string) ([]byte, error) {
	return pdf.RenderHTML(ctx, pdf.RenderRequest{
		HTML:            htmlContent,
		ReadySelector:   "#masterlist-table",
		AfterReadyDelay: 400 * time.Millisecond,
		Timeout:         30 * time.Second,
		ConfigurePrint: func(params *page.PrintToPDFParams) *page.PrintToPDFParams {
			return params.WithPrintBackground(true).
				WithPreferCSSPageSize(true).
				WithScale(1.0)
		},
	})
}

func buildFilename() string {
	now := time.Now()
	return fmt.Sprintf("MasterList_%d_%d_%d.pdf", now.Month(), now.Day(), now.Year())
}
