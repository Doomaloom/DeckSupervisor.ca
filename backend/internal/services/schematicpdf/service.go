package schematicpdf

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"

	"cob-aquatics/internal/services/pdf"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

type Course struct {
	Code            string `json:"code"`
	Level           string `json:"level"`
	StartMinutes    int    `json:"startMinutes"`
	DurationMinutes int    `json:"durationMinutes"`
	StudentCount    int    `json:"studentCount"`
	Capacity        int    `json:"capacity"`
}

type Request struct {
	Orientation              string     `json:"orientation"`
	Title                    string     `json:"title"`
	DateRange                string     `json:"dateRange"`
	WeeksLabel               string     `json:"weeksLabel"`
	Highlight                bool       `json:"highlightInstructor"`
	Selected                 string     `json:"selectedInstructor"`
	Instructors              []string   `json:"instructors"`
	Columns                  [][]Course `json:"columns"`
	RotateCounterClockwise90 bool       `json:"rotateCounterClockwise90"`
}

type Output struct {
	Data     []byte
	Filename string
}

var splashLevelRegex = regexp.MustCompile(`(?i)\bsplash\s*(10|[7-9])\b`)
var splashAdultRegex = regexp.MustCompile(`(?i)\bsplash\s*adult\s*(1|2|3)\b`)

func BuildPDF(ctx context.Context, req Request) (Output, error) {
	columns := req.Columns
	if len(columns) == 0 {
		return Output{}, errors.New("missing schematic columns")
	}

	columnCount := len(columns)
	if len(req.Instructors) > columnCount {
		columnCount = len(req.Instructors)
	}
	if columnCount == 0 {
		columnCount = 1
	}

	orientation := strings.ToLower(strings.TrimSpace(req.Orientation))
	if orientation != "landscape" {
		orientation = "portrait"
	}

	baseMin, maxEnd, ok := findTimeBounds(columns)
	if !ok {
		return Output{}, errors.New("no schedule data found")
	}

	totalBlocks := int((maxEnd - baseMin) / 30)
	if (maxEnd-baseMin)%30 != 0 {
		totalBlocks += 1
	}
	totalRows := totalBlocks * 4

	cells := buildCellMatrix(columns, columnCount, baseMin, totalRows)
	timeLabels := buildTimeLabels(baseMin, totalBlocks)

	highlightCols := resolveHighlightColumns(req, columnCount)
	htmlContent := buildHTML(req, columnCount, totalRows, timeLabels, cells, orientation, highlightCols)
	scale := computeScale(orientation, totalRows)
	pdfBytes, err := renderPDF(ctx, htmlContent, scale)
	if err != nil {
		return Output{}, err
	}
	if req.RotateCounterClockwise90 {
		pdfBytes, err = pdf.RotateAllPages(pdfBytes, 270)
		if err != nil {
			return Output{}, err
		}
	}

	filename := fmt.Sprintf("schematic-%s.pdf", time.Now().Format("2006-01-02"))
	return Output{Data: pdfBytes, Filename: filename}, nil
}

type cell struct {
	kind        string
	text        string
	colorClass  string
	showCorner  bool
	borderClass string
}

func findTimeBounds(columns [][]Course) (int, int, bool) {
	baseMin := 1 << 30
	maxEnd := -1
	for _, column := range columns {
		for _, course := range column {
			start := course.StartMinutes
			if start < baseMin {
				baseMin = start
			}
			end := course.StartMinutes + maxDuration(course)
			if end > maxEnd {
				maxEnd = end
			}
		}
	}
	if maxEnd == -1 || baseMin == 1<<30 {
		return 0, 0, false
	}
	return baseMin, maxEnd, true
}

func maxDuration(course Course) int {
	if course.DurationMinutes > 0 {
		return course.DurationMinutes
	}
	return 30
}

func buildCellMatrix(columns [][]Course, columnCount int, baseMin int, totalRows int) [][]cell {
	matrix := make([][]cell, totalRows)
	for r := 0; r < totalRows; r++ {
		matrix[r] = make([]cell, columnCount)
		for c := 0; c < columnCount; c++ {
			matrix[r][c] = cell{kind: "empty"}
		}
	}

	for colIndex := 0; colIndex < columnCount; colIndex++ {
		var column []Course
		if colIndex < len(columns) {
			column = columns[colIndex]
		}
		for _, course := range column {
			startRow := rowFromMinutes(course.StartMinutes, baseMin)
			height := rowHeightForDuration(maxDuration(course))
			if startRow < 0 {
				continue
			}
			if startRow+height > totalRows {
				height = totalRows - startRow
			}
			if height <= 0 {
				continue
			}

			nameRow := startRow + 1
			codeRow := startRow + 2
			capacityRow := capacityRowForClass(course, startRow, height)

			for r := 0; r < height; r++ {
				rowIndex := startRow + r
				borderClass := "middle"
				if r == 0 {
					borderClass = "top"
				} else if r == height-1 {
					borderClass = "bottom"
				}
				entry := cell{kind: "block", borderClass: borderClass}
				if rowIndex == nameRow {
					entry.text = sanitizeLevelName(course.Level)
				} else if rowIndex == codeRow {
					entry.text = course.Code
				} else if rowIndex == capacityRow {
					entry.text = fmt.Sprintf("%d of %d", course.StudentCount, course.Capacity)
					entry.colorClass = capacityColor(course)
				}
				entry.showCorner = rowIndex == nameRow
				matrix[rowIndex][colIndex] = entry
			}
		}
	}

	return matrix
}

func sanitizeLevelName(level string) string {
	normalized := strings.ToLower(strings.TrimSpace(level))
	if strings.Contains(normalized, "private lesson") {
		return "Private"
	}
	if strings.Contains(normalized, "inclusion") {
		return "Inclusion"
	}
	if match := splashLevelRegex.FindStringSubmatch(normalized); len(match) > 1 {
		return "Splash " + match[1]
	}
	if match := splashAdultRegex.FindStringSubmatch(normalized); len(match) > 1 {
		return "Splash Adult " + match[1]
	}
	return level
}

func rowHeightForDuration(duration int) int {
	if duration <= 0 {
		return 0
	}
	height := (duration*4 + 29) / 30
	if height < 1 {
		return 1
	}
	return height
}

func rowFromMinutes(startMin int, baseMin int) int {
	if startMin < baseMin {
		return 0
	}
	return ((startMin - baseMin) * 4) / 30
}

func capacityRowForClass(course Course, startRow int, height int) int {
	switch maxDuration(course) {
	case 30:
		return startRow + 3
	case 45:
		return startRow + 4
	case 60:
		return startRow + 5
	default:
		if height > 0 {
			return startRow + height - 1
		}
	}
	return startRow
}

func capacityColor(course Course) string {
	if course.Capacity <= 0 {
		return "green"
	}
	percent := (float64(course.StudentCount) * 100) / float64(course.Capacity)
	switch {
	case percent < 50:
		return "red"
	case percent < 70:
		return "yellow"
	default:
		return "green"
	}
}

func buildTimeLabels(baseMin int, totalBlocks int) []string {
	labels := make([]string, 0, totalBlocks)
	for i := 0; i < totalBlocks; i++ {
		labels = append(labels, formatTimeLabel(baseMin+i*30))
	}
	return labels
}

func formatTimeLabel(minutes int) string {
	minutes = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60)
	h := minutes / 60
	m := minutes % 60
	ampm := "AM"
	if h >= 12 {
		ampm = "PM"
	}
	h12 := h % 12
	if h12 == 0 {
		h12 = 12
	}
	return fmt.Sprintf("%d:%02d %s", h12, m, ampm)
}

func buildHTML(req Request, columnCount int, totalRows int, timeLabels []string, cells [][]cell, orientation string, highlightCols []bool) string {
	timeWidth := 16.5
	classWidth := 26.0
	totalWidth := timeWidth*2 + classWidth*float64(columnCount)
	colWidths := make([]float64, 0, columnCount+2)
	colWidths = append(colWidths, timeWidth/totalWidth*100)
	for i := 0; i < columnCount; i++ {
		colWidths = append(colWidths, classWidth/totalWidth*100)
	}
	colWidths = append(colWidths, timeWidth/totalWidth*100)

	var buf bytes.Buffer
	buf.WriteString("<!doctype html><html><head><meta charset=\"utf-8\"/>")
	buf.WriteString("<style>")
	buf.WriteString(fmt.Sprintf(`@page { size: letter %s; margin: 0.25in; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Calibri, Arial, sans-serif; color: #111; }
table { width: 100%%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px 4px; font-size: 11pt; line-height: 1.1; }
.title { background: #000; color: #fff; font-size: 20pt; font-weight: 700; height: 30pt; }
.subtitle { background: #000; color: #fff; font-size: 16pt; font-weight: 700; height: 30pt; }
.spacer { height: 3.75pt; border: none; }
.meta { height: 30pt; font-size: 11pt; font-weight: 600; }
.meta .meta-sub { font-weight: 500; font-size: 10pt; margin-top: 2px; }
.time-header { font-weight: 700; }
.instructor-header { font-weight: 600; }
.time-cell { font-weight: 400; white-space: nowrap; }
.header-row { height: 18pt; }
.time-top { border-bottom: none; }
.time-middle { border-top: none; border-bottom: none; }
.time-bottom { border-top: none; }
.row { height: 15pt; }
.row td { height: 15pt; max-height: 15pt; padding: 0 4px; line-height: 1; overflow: hidden; }
.cell-inner { position: relative; height: 100%%; display: flex; flex-direction: column; justify-content: space-between; padding: 0; }
.cap-red { background: #FF0000; }
.cap-yellow { background: #FFC000; }
.cap-green { background: #00B050; }
.empty-cell { background: #D9D9D9; border: none; }
.highlight-col { background: #FFEB3B; }
.highlight-col.instructor-header { background: #FFEB3B; }
.border-top { border-bottom: none; }
.border-middle { border-top: none; border-bottom: none; }
.border-bottom { border-top: none; }
`, orientation))
	buf.WriteString("</style></head><body>")

	buf.WriteString("<table><colgroup>")
	for _, w := range colWidths {
		buf.WriteString(fmt.Sprintf("<col style=\"width:%.4f%%\"/>", w))
	}
	buf.WriteString("</colgroup><thead>")
	buf.WriteString("<tr><th class=\"title\" colspan=\"" + fmt.Sprintf("%d", columnCount+2) + "\">")
	buf.WriteString(html.EscapeString(req.Title))
	buf.WriteString("</th></tr>")
	buf.WriteString("<tr><th class=\"spacer\" colspan=\"" + fmt.Sprintf("%d", columnCount+2) + "\"></th></tr>")
	buf.WriteString("<tr><th class=\"subtitle\" colspan=\"" + fmt.Sprintf("%d", columnCount+2) + "\">")
	buf.WriteString(html.EscapeString(req.DateRange))
	buf.WriteString("</th></tr>")

	leftSpan := 1 + (columnCount / 2)
	rightSpan := columnCount + 2 - leftSpan
	buf.WriteString("<tr>")
	buf.WriteString("<th class=\"meta\" colspan=\"" + fmt.Sprintf("%d", leftSpan) + "\">Deck Supervisor:</th>")
	buf.WriteString("<th class=\"meta\" colspan=\"" + fmt.Sprintf("%d", rightSpan) + "\">Cancelled Dates:")
	if strings.TrimSpace(req.WeeksLabel) != "" {
		buf.WriteString("<div class=\"meta-sub\">" + html.EscapeString(req.WeeksLabel) + "</div>")
	}
	buf.WriteString("</th>")
	buf.WriteString("</tr>")

	buf.WriteString("<tr class=\"header-row\">")
	buf.WriteString("<th class=\"time-header\" rowspan=\"2\">TIME</th>")
	buf.WriteString("<th colspan=\"" + fmt.Sprintf("%d", columnCount) + "\">Instructors / Level</th>")
	buf.WriteString("<th class=\"time-header\" rowspan=\"2\">TIME</th>")
	buf.WriteString("</tr>")
	buf.WriteString("<tr class=\"header-row\">")
	for i := 0; i < columnCount; i++ {
		label := fmt.Sprintf("Instructor %d", i+1)
		if i < len(req.Instructors) && strings.TrimSpace(req.Instructors[i]) != "" {
			label = strings.TrimSpace(req.Instructors[i])
		}
		classes := "instructor-header"
		if i < len(highlightCols) && highlightCols[i] {
			classes += " highlight-col"
		}
		buf.WriteString("<th class=\"" + classes + "\">" + html.EscapeString(label) + "</th>")
	}
	buf.WriteString("</tr></thead><tbody>")

	for rowIndex := 0; rowIndex < totalRows; rowIndex++ {
		timeLabel := ""
		if rowIndex%4 == 0 && (rowIndex/4) < len(timeLabels) {
			timeLabel = timeLabels[rowIndex/4]
		}
		timeCellClass := "time-cell"
		switch rowIndex % 4 {
		case 0:
			timeCellClass += " time-top"
		case 3:
			timeCellClass += " time-bottom"
		default:
			timeCellClass += " time-middle"
		}
		buf.WriteString("<tr class=\"row\">")
		buf.WriteString("<td class=\"" + timeCellClass + "\">" + html.EscapeString(timeLabel) + "</td>")

		for colIndex := 0; colIndex < columnCount; colIndex++ {
			entry := cells[rowIndex][colIndex]
			classes := []string{}
			if colIndex < len(highlightCols) && highlightCols[colIndex] {
				classes = append(classes, "highlight-col")
			}
			if entry.kind == "empty" {
				classes = append(classes, "empty-cell")
			}
			switch entry.borderClass {
			case "top":
				classes = append(classes, "border-top")
			case "middle":
				classes = append(classes, "border-middle")
			case "bottom":
				classes = append(classes, "border-bottom")
			}
			if entry.colorClass != "" {
				classes = append(classes, "cap-"+entry.colorClass)
			}
			classAttr := ""
			if len(classes) > 0 {
				classAttr = " class=\"" + strings.Join(classes, " ") + "\""
			}
			buf.WriteString("<td" + classAttr + ">")
			if entry.text != "" {
				buf.WriteString("<div class=\"cell-inner\">")
				buf.WriteString(html.EscapeString(entry.text))
				buf.WriteString("</div>")
			}
			buf.WriteString("</td>")
		}

		buf.WriteString("<td class=\"" + timeCellClass + "\">" + html.EscapeString(timeLabel) + "</td>")
		buf.WriteString("</tr>")
	}

	buf.WriteString("</tbody></table></body></html>")
	return buf.String()
}

func resolveHighlightColumns(req Request, columnCount int) []bool {
	if !req.Highlight {
		return nil
	}
	selected := strings.TrimSpace(req.Selected)
	if selected == "" || strings.EqualFold(selected, "none") || strings.EqualFold(selected, "one-each") {
		return nil
	}

	highlight := make([]bool, columnCount)
	for i := 0; i < columnCount; i++ {
		if i >= len(req.Instructors) {
			continue
		}
		name := strings.TrimSpace(req.Instructors[i])
		if name == "" {
			continue
		}
		if strings.EqualFold(name, selected) {
			highlight[i] = true
		}
	}
	return highlight
}

func renderPDF(ctx context.Context, htmlContent string, scale float64) ([]byte, error) {
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

	file, err := os.CreateTemp("", "schematic-*.html")
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

	if scale <= 0 {
		scale = 1
	}
	if scale < 0.1 {
		scale = 0.1
	}
	if scale > 2 {
		scale = 2
	}

	err = chromedp.Run(taskCtx,
		chromedp.Navigate(fileURL),
		chromedp.WaitReady("table", chromedp.ByQuery),
		chromedp.Sleep(400*time.Millisecond),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBytes, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithScale(scale).
				WithPreferCSSPageSize(true).
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

func computeScale(orientation string, totalRows int) float64 {
	paperHeight := 11.0
	if strings.ToLower(strings.TrimSpace(orientation)) == "landscape" {
		paperHeight = 8.5
	}
	printableHeight := paperHeight - 0.5
	if printableHeight <= 0 {
		return 1
	}

	headerPt := 30.0 + 3.75 + 30.0 + 30.0 + 18.0 + 18.0
	bodyPt := float64(totalRows) * 15.0
	contentHeightIn := (headerPt + bodyPt) / 72.0
	if contentHeightIn <= 0 {
		return 1
	}
	safetyFactor := 0.85
	scale := (printableHeight / contentHeightIn) * safetyFactor
	if scale > 1 {
		return 1
	}
	return scale
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
