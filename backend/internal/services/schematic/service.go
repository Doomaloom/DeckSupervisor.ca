package schematic

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"cob-aquatics/internal/services/files"
	"github.com/go-gota/gota/dataframe"
	"github.com/xuri/excelize/v2"
)

type Output struct {
	Data        []byte
	Filename    string
	ContentType string
}

type classInfo struct {
	Name          string
	id            int
	Code          string
	Location      string
	Duration      int
	Day           string
	Starts        string
	Ends          string
	MaxSlots      int
	MinSlots      int
	Registered    int
	PercentFilled float64
	StartTime     string
	EndTime       string
}

func BuildFromCSVReader(csvReader io.Reader) (Output, error) {
	df := dataframe.ReadCSV(csvReader)
	if df.Err != nil {
		return Output{}, fmt.Errorf("unable to read csv: %w", df.Err)
	}

	classes, err := parseCSVRows(df.Maps())
	if err != nil {
		return Output{}, err
	}
	grouped := groupByLocationAndDay(classes)
	if len(grouped) == 0 {
		return Output{}, errors.New("no schedule data found in CSV")
	}

	if len(grouped) == 1 {
		for location, byDay := range grouped {
			payload, filename, err := buildWorkbook(location, byDay)
			if err != nil {
				return Output{}, fmt.Errorf("unable to build workbook: %w", err)
			}
			return Output{
				Data:        payload,
				Filename:    filename,
				ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}, nil
		}
	}

	zipBytes, zipName, err := buildZip(grouped)
	if err != nil {
		return Output{}, fmt.Errorf("unable to build workbook archive: %w", err)
	}
	return Output{
		Data:        zipBytes,
		Filename:    zipName,
		ContentType: "application/zip",
	}, nil
}

func parseCSVRows(rows []map[string]interface{}) ([]classInfo, error) {
	if len(rows) == 0 {
		return nil, errors.New("no rows to process")
	}

	firstRow := normalizeSchematicRow(rows[0])

	required := []string{"GroupName", "MainFacility", "Day", "Starts", "Ends"}
	missing := make([]string, 0)
	for _, col := range required {
		if _, ok := firstRow[normalizeSchematicHeader(col)]; !ok {
			missing = append(missing, col)
		}
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required columns: %s", strings.Join(missing, ", "))
	}

	classInfos := make([]classInfo, 0, len(rows))
	for _, rawRow := range rows {
		row := normalizeSchematicRow(rawRow)
		info := classInfo{
			Name:     schematicRowValue(row, "GroupName"),
			Location: schematicRowValue(row, "MainFacility"),
			Day:      schematicRowValue(row, "Day"),
			Starts:   schematicRowValue(row, "Starts"),
			Ends:     schematicRowValue(row, "Ends"),
			Code:     strings.TrimSpace(schematicRowValue(row, "ID")),
		}

		info.id = parseInt(schematicRowValue(row, "ID"))
		info.Duration = parseInt(schematicRowValue(row, "Duration"))
		info.MaxSlots = parseInt(schematicRowValue(row, "Max"))
		info.MinSlots = parseInt(schematicRowValue(row, "Min"))
		info.Registered = parseInt(schematicRowValue(row, "RegTotal"))
		info.PercentFilled = parseFloat(schematicRowValue(row, "PercentFilled"))

		startString := schematicRowValue(row, "Starts")
		endString := schematicRowValue(row, "Ends")

		info.StartTime = extract24hTime(startString)
		info.EndTime = extract24hTime(endString)
		if computed := calculateDurationMinutes(info.StartTime, info.EndTime); computed > 0 {
			info.Duration = computed
		}

		classInfos = append(classInfos, info)
	}

	return classInfos, nil
}

func normalizeSchematicHeader(header string) string {
	clean := strings.TrimSpace(header)
	clean = strings.TrimPrefix(clean, "\uFEFF")
	return strings.ToLower(clean)
}

func normalizeSchematicRow(row map[string]interface{}) map[string]string {
	normalized := make(map[string]string, len(row))
	for key, value := range row {
		text := ""
		if value != nil {
			text = fmt.Sprint(value)
		}
		normalized[normalizeSchematicHeader(key)] = strings.TrimSpace(text)
	}
	return normalized
}

func schematicRowValue(row map[string]string, names ...string) string {
	for _, name := range names {
		if value, ok := row[normalizeSchematicHeader(name)]; ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func parseInt(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return v
}

func parseFloat(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	s = strings.TrimSuffix(s, "%")
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

func calculateDurationMinutes(start24h string, end24h string) int {
	start24h = strings.TrimSpace(start24h)
	end24h = strings.TrimSpace(end24h)
	if start24h == "" || end24h == "" {
		return 0
	}

	startTime, err := time.Parse("15:04", start24h)
	if err != nil {
		return 0
	}
	endTime, err := time.Parse("15:04", end24h)
	if err != nil {
		return 0
	}

	if endTime.Before(startTime) {
		endTime = endTime.Add(24 * time.Hour)
	}

	return int(endTime.Sub(startTime).Minutes())
}

func extract24hTime(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}

	layouts := []string{
		"2006-01-02 03:04 PM",
		"2006-01-02 3:04 PM",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Format("15:04")
		}
	}

	parts := strings.Fields(s)
	if len(parts) >= 3 {
		ampm := strings.ToUpper(parts[len(parts)-1])
		timePart := parts[len(parts)-2]
		if ampm == "AM" || ampm == "PM" {
			return get24hFormat(timePart + " " + ampm)
		}
	}
	if len(parts) >= 2 {
		return get24hFormat(parts[len(parts)-1])
	}

	return get24hFormat(s)
}

func get24hFormat(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}

	layouts := []string{
		"3:04 PM",
		"3:04PM",
		"03:04 PM",
		"03:04PM",
		"3 PM",
		"3PM",
		"15:04",
		"15:04:05",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Format("15:04")
		}
	}

	lower := strings.ToLower(s)
	lower = strings.ReplaceAll(lower, " ", "")
	if strings.HasSuffix(lower, "am") || strings.HasSuffix(lower, "pm") {
		ampm := lower[len(lower)-2:]
		timePart := strings.TrimSuffix(lower, ampm)
		if t, err := time.Parse("3:04", timePart); err == nil {
			hour := t.Hour()
			if ampm == "pm" && hour < 12 {
				hour += 12
			} else if ampm == "am" && hour == 12 {
				hour = 0
			}
			return fmt.Sprintf("%02d:%02d", hour, t.Minute())
		}
	}

	return s
}

func parseDateTime(s string) (time.Time, bool) {
	layouts := []string{
		"2006-01-02 03:04 PM",
		"2006-01-02 3:04 PM",
		"2006-01-02 03:04PM",
		"2006-01-02 3:04PM",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, strings.TrimSpace(s)); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func groupByLocationAndDay(classes []classInfo) map[string]map[string][]classInfo {
	grouped := make(map[string]map[string][]classInfo)
	for _, info := range classes {
		location := strings.TrimSpace(info.Location)
		if location == "" {
			location = "Unknown"
		}
		day := strings.TrimSpace(info.Day)
		if day == "" {
			day = "Unknown"
		}

		if _, ok := grouped[location]; !ok {
			grouped[location] = make(map[string][]classInfo)
		}
		grouped[location][day] = append(grouped[location][day], info)
	}

	for _, byDay := range grouped {
		for day, classes := range byDay {
			sort.SliceStable(classes, func(i, j int) bool {
				return timeLess(classes[i].StartTime, classes[j].StartTime)
			})
			byDay[day] = classes
		}
	}

	return grouped
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

func rowFromMinutes(startMin int, baseMin int, offset int) int {
	if startMin < baseMin {
		return offset + 1
	}
	return offset + 1 + ((startMin-baseMin)*4)/30
}

func minutesFromHHMM(s string) (int, bool) {
	t, err := time.Parse("15:04", s)
	if err != nil {
		return 0, false
	}
	return t.Hour()*60 + t.Minute(), true
}

func timeLess(a string, b string) bool {
	a = strings.TrimSpace(a)
	b = strings.TrimSpace(b)
	if a == "" && b == "" {
		return false
	}
	if a == "" {
		return false
	}
	if b == "" {
		return true
	}

	am, aok := minutesFromHHMM(a)
	bm, bok := minutesFromHHMM(b)
	if aok && bok {
		return am < bm
	}
	if aok != bok {
		return aok
	}
	return a < b
}

func daySortKey(day string) int {
	switch strings.TrimSpace(day) {
	case "Mo", "Mon", "Monday":
		return 0
	case "Tu", "Tue", "Tuesday":
		return 1
	case "We", "Wed", "Wednesday":
		return 2
	case "Th", "Thu", "Thursday":
		return 3
	case "Fr", "Fri", "Friday":
		return 4
	case "Sa", "Sat", "Saturday":
		return 5
	case "Su", "Sun", "Sunday":
		return 6
	case "Mo,Tu,We,Th,Fr":
		return 7
	case "Mini Session 1":
		return 8
	case "Mini Session 2":
		return 9
	case "Mini Session 3":
		return 10
	case "Mini Session 4":
		return 11
	default:
		return 99
	}
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

func seasonForMonth(m time.Month) string {
	switch {
	case m >= 9:
		return "Fall"
	case m >= 7:
		return "Summer"
	case m >= 3:
		return "Spring"
	default:
		return "Winter"
	}
}

func capacityText(classInfo classInfo) string {
	if classInfo.MaxSlots <= 0 && classInfo.Registered <= 0 {
		return ""
	}
	return fmt.Sprintf("%d of %d", classInfo.Registered, classInfo.MaxSlots)
}

func percentFilledValue(classInfo classInfo) float64 {
	if classInfo.PercentFilled > 0 {
		return classInfo.PercentFilled
	}
	if classInfo.MaxSlots > 0 {
		return (float64(classInfo.Registered) * 100) / float64(classInfo.MaxSlots)
	}
	return classInfo.PercentFilled
}

func classCode(classInfo classInfo) string {
	if classInfo.Code != "" {
		return classInfo.Code
	}
	if classInfo.id != 0 {
		return strconv.Itoa(classInfo.id)
	}
	return ""
}

func setCellIfNotEmpty(f *excelize.File, sheet string, colName string, row int, value string) error {
	if value == "" {
		return nil
	}
	cell := fmt.Sprintf("%s%d", colName, row)
	return f.SetCellValue(sheet, cell, value)
}

func capacityRowForClass(classInfo classInfo, startRow int, height int) (int, bool) {
	if capacityText(classInfo) == "" {
		return 0, false
	}
	switch classInfo.Duration {
	case 30:
		return startRow + 3, true
	case 45:
		return startRow + 4, true
	case 60:
		return startRow + 5, true
	default:
		if height > 0 {
			return startRow + height - 1, true
		}
	}
	return 0, false
}

func updateMaxWidth(maxWidth *int, value string) {
	if value == "" {
		return
	}
	if l := len([]rune(value)); l > *maxWidth {
		*maxWidth = l
	}
}

func weeksBetweenDates(start time.Time, end time.Time) int {
	startDate := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	endDate := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)
	if endDate.Before(startDate) {
		return 0
	}
	days := int(endDate.Sub(startDate).Hours()/24) + 1
	return (days + 6) / 7
}

func formatMonthDay(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("Jan 2")
}

func fillClassBlock(
	f *excelize.File,
	sheet string,
	colName string,
	startRow int,
	height int,
	classInfo classInfo,
	maxWidth *int,
) error {
	name := strings.TrimSpace(classInfo.Name)
	code := classCode(classInfo)
	capacity := capacityText(classInfo)
	updateMaxWidth(maxWidth, name)
	updateMaxWidth(maxWidth, code)
	updateMaxWidth(maxWidth, capacity)

	switch classInfo.Duration {
	case 30:
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+1, name); err != nil {
			return err
		}
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+2, code); err != nil {
			return err
		}
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+3, capacity); err != nil {
			return err
		}
	case 45:
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+1, name); err != nil {
			return err
		}
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+2, code); err != nil {
			return err
		}
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+4, capacity); err != nil {
			return err
		}
	case 60:
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+1, name); err != nil {
			return err
		}
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+2, code); err != nil {
			return err
		}
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+5, capacity); err != nil {
			return err
		}
	default:
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+1, name); err != nil {
			return err
		}
		if err := setCellIfNotEmpty(f, sheet, colName, startRow+2, code); err != nil {
			return err
		}
		if height > 0 {
			if err := setCellIfNotEmpty(f, sheet, colName, startRow+height-1, capacity); err != nil {
				return err
			}
		}
	}

	return nil
}

func buildWorkbook(location string, byDay map[string][]classInfo) ([]byte, string, error) {
	f := excelize.NewFile()
	centerAlignment := excelize.Alignment{Horizontal: "center", Vertical: "center"}
	borderAll := []excelize.Border{
		{Type: "left", Color: "000000", Style: 1},
		{Type: "right", Color: "000000", Style: 1},
		{Type: "top", Color: "000000", Style: 1},
		{Type: "bottom", Color: "000000", Style: 1},
	}
	borderTop := []excelize.Border{
		{Type: "left", Color: "000000", Style: 1},
		{Type: "right", Color: "000000", Style: 1},
		{Type: "top", Color: "000000", Style: 1},
	}
	borderMiddle := []excelize.Border{
		{Type: "left", Color: "000000", Style: 1},
		{Type: "right", Color: "000000", Style: 1},
	}
	borderBottom := []excelize.Border{
		{Type: "left", Color: "000000", Style: 1},
		{Type: "right", Color: "000000", Style: 1},
		{Type: "bottom", Color: "000000", Style: 1},
	}
	borderAllStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderAll,
	})
	if err != nil {
		return nil, "", err
	}
	borderTopStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderTop,
	})
	if err != nil {
		return nil, "", err
	}
	borderMiddleStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderMiddle,
	})
	if err != nil {
		return nil, "", err
	}
	borderBottomStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderBottom,
	})
	if err != nil {
		return nil, "", err
	}
	headerStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Font:      &excelize.Font{Size: 20, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"000000"}, Pattern: 1},
	})
	if err != nil {
		return nil, "", err
	}
	labelStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
	})
	if err != nil {
		return nil, "", err
	}
	labelWrapStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})
	if err != nil {
		return nil, "", err
	}
	labelBorderStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderAll,
	})
	if err != nil {
		return nil, "", err
	}
	timeTopStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderTop,
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"FFFFFF"}, Pattern: 1},
	})
	if err != nil {
		return nil, "", err
	}
	timeMiddleStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderMiddle,
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"FFFFFF"}, Pattern: 1},
	})
	if err != nil {
		return nil, "", err
	}
	timeBottomStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderBottom,
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"FFFFFF"}, Pattern: 1},
	})
	if err != nil {
		return nil, "", err
	}
	scheduleGreyStyle, err := f.NewStyle(&excelize.Style{
		Fill: excelize.Fill{Type: "pattern", Color: []string{"D9D9D9"}, Pattern: 1},
	})
	if err != nil {
		return nil, "", err
	}
	makeFillStyle := func(color string, border []excelize.Border) (int, error) {
		return f.NewStyle(&excelize.Style{
			Alignment: &centerAlignment,
			Border:    border,
			Fill:      excelize.Fill{Type: "pattern", Color: []string{color}, Pattern: 1},
		})
	}

	capRedAll, err := makeFillStyle("FF0000", borderAll)
	if err != nil {
		return nil, "", err
	}
	capRedTop, err := makeFillStyle("FF0000", borderTop)
	if err != nil {
		return nil, "", err
	}
	capRedMiddle, err := makeFillStyle("FF0000", borderMiddle)
	if err != nil {
		return nil, "", err
	}
	capRedBottom, err := makeFillStyle("FF0000", borderBottom)
	if err != nil {
		return nil, "", err
	}

	capYellowAll, err := makeFillStyle("FFC000", borderAll)
	if err != nil {
		return nil, "", err
	}
	capYellowTop, err := makeFillStyle("FFC000", borderTop)
	if err != nil {
		return nil, "", err
	}
	capYellowMiddle, err := makeFillStyle("FFC000", borderMiddle)
	if err != nil {
		return nil, "", err
	}
	capYellowBottom, err := makeFillStyle("FFC000", borderBottom)
	if err != nil {
		return nil, "", err
	}

	capGreenAll, err := makeFillStyle("00B050", borderAll)
	if err != nil {
		return nil, "", err
	}
	capGreenTop, err := makeFillStyle("00B050", borderTop)
	if err != nil {
		return nil, "", err
	}
	capGreenMiddle, err := makeFillStyle("00B050", borderMiddle)
	if err != nil {
		return nil, "", err
	}
	capGreenBottom, err := makeFillStyle("00B050", borderBottom)
	if err != nil {
		return nil, "", err
	}

	dayKeys := make([]string, 0, len(byDay))
	for day := range byDay {
		dayKeys = append(dayKeys, day)
	}
	sort.Slice(dayKeys, func(i, j int) bool {
		di := daySortKey(dayKeys[i])
		dj := daySortKey(dayKeys[j])
		if di == dj {
			return dayKeys[i] < dayKeys[j]
		}
		return di < dj
	})

	if len(dayKeys) == 0 {
		return nil, "", errors.New("no day data found")
	}

	defaultSheet := f.GetSheetName(0)
	_ = f.SetSheetName(defaultSheet, dayKeys[0])
	for _, day := range dayKeys[1:] {
		f.NewSheet(day)
	}

	for _, day := range dayKeys {
		classes := byDay[day]
		baseMin := -1
		maxEnd := -1
		maxClassWidth := 0
		maxTimeWidth := 0
		classColOffset := 2
		headerOffset := 6
		normalRowHeight := 15.0
		headerHeight := normalRowHeight * 2
		spacerHeight := normalRowHeight * 0.25
		var minStart time.Time
		var maxEndDate time.Time
		haveStartDate := false
		haveEndDate := false

		for _, classInfo := range classes {
			startMin, okStart := minutesFromHHMM(classInfo.StartTime)
			endMin, okEnd := minutesFromHHMM(classInfo.EndTime)
			if okStart && okEnd && endMin < startMin {
				endMin += 24 * 60
			}
			if !okStart {
				continue
			}
			if baseMin == -1 || startMin < baseMin {
				baseMin = startMin
			}
			if okStart && okEnd {
				if maxEnd == -1 || endMin > maxEnd {
					maxEnd = endMin
				}
			}

			if t, ok := parseDateTime(classInfo.Starts); ok {
				if !haveStartDate || t.Before(minStart) {
					minStart = t
					haveStartDate = true
				}
			}
			if t, ok := parseDateTime(classInfo.Ends); ok {
				if !haveEndDate || t.After(maxEndDate) {
					maxEndDate = t
					haveEndDate = true
				}
			}
		}
		if baseMin == -1 {
			continue
		}
		if maxEnd == -1 {
			maxEnd = baseMin
		}

		columnsEnd := make([]int, 0, 4)
		maxColumns := 1
		for _, classInfo := range classes {
			startMin, okStart := minutesFromHHMM(classInfo.StartTime)
			endMin, okEnd := minutesFromHHMM(classInfo.EndTime)
			if !okStart || !okEnd {
				continue
			}
			if endMin < startMin {
				endMin += 24 * 60
			}

			col := -1
			for i, end := range columnsEnd {
				if end <= startMin {
					col = i
					break
				}
			}
			if col == -1 {
				col = len(columnsEnd)
				columnsEnd = append(columnsEnd, endMin)
			} else {
				columnsEnd[col] = endMin
			}
			if col+1 > maxColumns {
				maxColumns = col + 1
			}
		}

		rightTimeColIndex := classColOffset + maxColumns
		classEndColIndex := rightTimeColIndex - 1
		if classEndColIndex < classColOffset {
			classEndColIndex = classColOffset
		}
		classEndCol, err := excelize.ColumnNumberToName(classEndColIndex)
		if err != nil {
			return nil, "", err
		}
		scheduleStartRow := headerOffset + 1
		lastBlockStart := maxEnd - 30
		if lastBlockStart < baseMin {
			lastBlockStart = baseMin
		}
		scheduleEndRow := rowFromMinutes(lastBlockStart, baseMin, headerOffset) + 3
		if scheduleEndRow < scheduleStartRow {
			scheduleEndRow = scheduleStartRow
		}
		scheduleStartCell := fmt.Sprintf("B%d", scheduleStartRow)
		scheduleEndCell := fmt.Sprintf("%s%d", classEndCol, scheduleEndRow)
		if err := f.SetCellStyle(day, scheduleStartCell, scheduleEndCell, scheduleGreyStyle); err != nil {
			return nil, "", err
		}

		columnsEnd = columnsEnd[:0]
		for _, classInfo := range classes {
			startMin, okStart := minutesFromHHMM(classInfo.StartTime)
			endMin, okEnd := minutesFromHHMM(classInfo.EndTime)
			if !okStart || !okEnd {
				continue
			}
			if endMin < startMin {
				endMin += 24 * 60
			}

			col := -1
			for i, end := range columnsEnd {
				if end <= startMin {
					col = i
					break
				}
			}
			if col == -1 {
				col = len(columnsEnd)
				columnsEnd = append(columnsEnd, endMin)
			} else {
				columnsEnd[col] = endMin
			}

			durationMin := classInfo.Duration
			if durationMin <= 0 {
				durationMin = endMin - startMin
			}
			height := rowHeightForDuration(durationMin)
			if height == 0 {
				continue
			}

			colName, err := excelize.ColumnNumberToName(col + classColOffset)
			if err != nil {
				return nil, "", err
			}

			startRow := rowFromMinutes(startMin, baseMin, headerOffset)
			endRow := startRow + height - 1
			startCell := fmt.Sprintf("%s%d", colName, startRow)
			endCell := fmt.Sprintf("%s%d", colName, endRow)
			if err := fillClassBlock(f, day, colName, startRow, height, classInfo, &maxClassWidth); err != nil {
				return nil, "", err
			}
			if startRow == endRow {
				if err := f.SetCellStyle(day, startCell, endCell, borderAllStyle); err != nil {
					return nil, "", err
				}
			} else {
				if err := f.SetCellStyle(day, startCell, startCell, borderTopStyle); err != nil {
					return nil, "", err
				}
				if endRow > startRow+1 {
					midStart := fmt.Sprintf("%s%d", colName, startRow+1)
					midEnd := fmt.Sprintf("%s%d", colName, endRow-1)
					if err := f.SetCellStyle(day, midStart, midEnd, borderMiddleStyle); err != nil {
						return nil, "", err
					}
				}
				if err := f.SetCellStyle(day, endCell, endCell, borderBottomStyle); err != nil {
					return nil, "", err
				}
			}

			capacity := capacityText(classInfo)
			if capacity != "" {
				capRow, ok := capacityRowForClass(classInfo, startRow, height)
				if ok {
					percent := percentFilledValue(classInfo)
					capCell := fmt.Sprintf("%s%d", colName, capRow)
					var styleID int
					if percent < 50 {
						if startRow == endRow {
							styleID = capRedAll
						} else if capRow == startRow {
							styleID = capRedTop
						} else if capRow == endRow {
							styleID = capRedBottom
						} else {
							styleID = capRedMiddle
						}
					} else if percent < 70 {
						if startRow == endRow {
							styleID = capYellowAll
						} else if capRow == startRow {
							styleID = capYellowTop
						} else if capRow == endRow {
							styleID = capYellowBottom
						} else {
							styleID = capYellowMiddle
						}
					} else {
						if startRow == endRow {
							styleID = capGreenAll
						} else if capRow == startRow {
							styleID = capGreenTop
						} else if capRow == endRow {
							styleID = capGreenBottom
						} else {
							styleID = capGreenMiddle
						}
					}
					if err := f.SetCellStyle(day, capCell, capCell, styleID); err != nil {
						return nil, "", err
					}
				}
			}
		}

		rightTimeCol, err := excelize.ColumnNumberToName(rightTimeColIndex)
		if err != nil {
			return nil, "", err
		}
		headerStart := "A1"
		headerEnd := fmt.Sprintf("%s1", rightTimeCol)
		if err := f.MergeCell(day, headerStart, headerEnd); err != nil {
			return nil, "", err
		}
		subHeaderStart := "A3"
		subHeaderEnd := fmt.Sprintf("%s3", rightTimeCol)
		if err := f.MergeCell(day, subHeaderStart, subHeaderEnd); err != nil {
			return nil, "", err
		}
		if err := f.SetRowHeight(day, 1, headerHeight); err != nil {
			return nil, "", err
		}
		if err := f.SetRowHeight(day, 2, spacerHeight); err != nil {
			return nil, "", err
		}
		if err := f.SetRowHeight(day, 3, headerHeight); err != nil {
			return nil, "", err
		}
		if err := f.SetRowHeight(day, 4, headerHeight); err != nil {
			return nil, "", err
		}

		dayText := day
		seasonText := ""
		yearText := ""
		if haveStartDate {
			dayText = minStart.Weekday().String()
			seasonText = seasonForMonth(minStart.Month())
			yearText = strconv.Itoa(minStart.Year())
		} else if haveEndDate {
			dayText = maxEndDate.Weekday().String()
			seasonText = seasonForMonth(maxEndDate.Month())
			yearText = strconv.Itoa(maxEndDate.Year())
		}
		headerTitle := strings.TrimSpace(strings.Join([]string{dayText, seasonText, yearText}, " "))
		if headerTitle != "" {
			if err := f.SetCellValue(day, "A1", headerTitle); err != nil {
				return nil, "", err
			}
			if err := f.SetCellStyle(day, "A1", "A1", headerStyle); err != nil {
				return nil, "", err
			}
		}

		startDateText := ""
		endDateText := ""
		if haveStartDate {
			startDateText = formatMonthDay(minStart)
		}
		if haveEndDate {
			endDateText = formatMonthDay(maxEndDate)
		}
		if startDateText != "" || endDateText != "" {
			dateRange := strings.TrimSpace(strings.Trim(startDateText+" - "+endDateText, " -"))
			if err := f.SetCellValue(day, "A3", dateRange); err != nil {
				return nil, "", err
			}
			if err := f.SetCellStyle(day, "A3", "A3", headerStyle); err != nil {
				return nil, "", err
			}
		}

		deckStart := "A4"
		deckEnd := "B4"
		if err := f.MergeCell(day, deckStart, deckEnd); err != nil {
			return nil, "", err
		}
		if err := f.SetCellValue(day, "A4", "Deck Supervisor: "); err != nil {
			return nil, "", err
		}
		if err := f.SetCellStyle(day, "A4", "A4", labelStyle); err != nil {
			return nil, "", err
		}

		cancelStart := "C4"
		cancelEnd := fmt.Sprintf("%s4", rightTimeCol)
		if err := f.MergeCell(day, cancelStart, cancelEnd); err != nil {
			return nil, "", err
		}
		weekCount := 0
		if haveStartDate && haveEndDate {
			weekCount = weeksBetweenDates(minStart, maxEndDate)
		}
		cancelText := fmt.Sprintf("Cancelled Dates: \n# of weeks %d classes", weekCount)
		if err := f.SetCellValue(day, cancelStart, cancelText); err != nil {
			return nil, "", err
		}
		if err := f.SetCellStyle(day, cancelStart, cancelStart, labelWrapStyle); err != nil {
			return nil, "", err
		}

		timeHeaderStart := "A5"
		timeHeaderEnd := "A6"
		if err := f.MergeCell(day, timeHeaderStart, timeHeaderEnd); err != nil {
			return nil, "", err
		}
		if err := f.SetCellValue(day, "A5", "TIME"); err != nil {
			return nil, "", err
		}
		if err := f.SetCellStyle(day, timeHeaderStart, timeHeaderEnd, labelBorderStyle); err != nil {
			return nil, "", err
		}

		rightTimeHeaderStart := fmt.Sprintf("%s5", rightTimeCol)
		rightTimeHeaderEnd := fmt.Sprintf("%s6", rightTimeCol)
		if err := f.MergeCell(day, rightTimeHeaderStart, rightTimeHeaderEnd); err != nil {
			return nil, "", err
		}
		if err := f.SetCellValue(day, rightTimeHeaderStart, "TIME"); err != nil {
			return nil, "", err
		}
		if err := f.SetCellStyle(day, rightTimeHeaderStart, rightTimeHeaderEnd, labelBorderStyle); err != nil {
			return nil, "", err
		}

		classHeaderStart := "B5"
		classHeaderEnd := fmt.Sprintf("%s5", classEndCol)
		if err := f.MergeCell(day, classHeaderStart, classHeaderEnd); err != nil {
			return nil, "", err
		}
		if err := f.SetCellValue(day, classHeaderStart, "Instructors / Level"); err != nil {
			return nil, "", err
		}
		if err := f.SetCellStyle(day, classHeaderStart, classHeaderEnd, labelBorderStyle); err != nil {
			return nil, "", err
		}

		for i := 0; i < maxColumns; i++ {
			colName, err := excelize.ColumnNumberToName(classColOffset + i)
			if err != nil {
				return nil, "", err
			}
			cell := fmt.Sprintf("%s6", colName)
			if err := f.SetCellValue(day, cell, fmt.Sprintf("Instructor %d", i+1)); err != nil {
				return nil, "", err
			}
			if err := f.SetCellStyle(day, cell, cell, labelBorderStyle); err != nil {
				return nil, "", err
			}
		}

		for t := baseMin; t <= lastBlockStart; t += 30 {
			row := rowFromMinutes(t, baseMin, headerOffset)
			endRow := row + 3
			label := formatTimeLabel(t)
			updateMaxWidth(&maxTimeWidth, label)
			leftCell := fmt.Sprintf("A%d", row)
			rightCell := fmt.Sprintf("%s%d", rightTimeCol, row)
			if err := f.SetCellValue(day, leftCell, label); err != nil {
				return nil, "", err
			}
			if err := f.SetCellValue(day, rightCell, label); err != nil {
				return nil, "", err
			}
			leftTop := leftCell
			leftBottom := fmt.Sprintf("A%d", endRow)
			leftMidStart := fmt.Sprintf("A%d", row+1)
			leftMidEnd := fmt.Sprintf("A%d", row+2)
			if err := f.SetCellStyle(day, leftTop, leftTop, timeTopStyle); err != nil {
				return nil, "", err
			}
			if err := f.SetCellStyle(day, leftMidStart, leftMidEnd, timeMiddleStyle); err != nil {
				return nil, "", err
			}
			if err := f.SetCellStyle(day, leftBottom, leftBottom, timeBottomStyle); err != nil {
				return nil, "", err
			}

			rightTop := rightCell
			rightBottom := fmt.Sprintf("%s%d", rightTimeCol, endRow)
			rightMidStart := fmt.Sprintf("%s%d", rightTimeCol, row+1)
			rightMidEnd := fmt.Sprintf("%s%d", rightTimeCol, row+2)
			if err := f.SetCellStyle(day, rightTop, rightTop, timeTopStyle); err != nil {
				return nil, "", err
			}
			if err := f.SetCellStyle(day, rightMidStart, rightMidEnd, timeMiddleStyle); err != nil {
				return nil, "", err
			}
			if err := f.SetCellStyle(day, rightBottom, rightBottom, timeBottomStyle); err != nil {
				return nil, "", err
			}
		}
		if maxTimeWidth > 0 {
			timeWidth := float64(maxTimeWidth) + 2
			if err := f.SetColWidth(day, "A", "A", timeWidth); err != nil {
				return nil, "", err
			}
			if err := f.SetColWidth(day, rightTimeCol, rightTimeCol, timeWidth); err != nil {
				return nil, "", err
			}
		}
		if maxClassWidth > 0 && maxColumns > 0 {
			classWidth := float64(maxClassWidth) + 2
			classEndColIndex := rightTimeColIndex - 1
			classEndCol, err := excelize.ColumnNumberToName(classEndColIndex)
			if err != nil {
				return nil, "", err
			}
			if err := f.SetColWidth(day, "B", classEndCol, classWidth); err != nil {
				return nil, "", err
			}
		}
	}

	filename := fmt.Sprintf("schematic-%s.xlsx", files.SanitizeFilename(location))
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, "", err
	}
	return buf.Bytes(), filename, nil
}

func buildZip(grouped map[string]map[string][]classInfo) ([]byte, string, error) {
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	locations := make([]string, 0, len(grouped))
	for location := range grouped {
		locations = append(locations, location)
	}
	sort.Strings(locations)

	for _, location := range locations {
		byDay := grouped[location]
		payload, filename, err := buildWorkbook(location, byDay)
		if err != nil {
			zipWriter.Close()
			return nil, "", err
		}
		entry, err := zipWriter.Create(filename)
		if err != nil {
			zipWriter.Close()
			return nil, "", err
		}
		if _, err := entry.Write(payload); err != nil {
			zipWriter.Close()
			return nil, "", err
		}
	}

	if err := zipWriter.Close(); err != nil {
		return nil, "", err
	}

	now := time.Now()
	zipName := fmt.Sprintf("schematic-maker-%d-%02d-%02d.zip", now.Year(), now.Month(), now.Day())
	return buf.Bytes(), zipName, nil
}
