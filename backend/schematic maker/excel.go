package main

import (
	"fmt"
	"github.com/xuri/excelize/v2"
	"sort"
	"strconv"
	"strings"
	"time"
)

func sanitizeFilename(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "location"
	}
	var b strings.Builder
	b.Grow(len(name))
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == ' ' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	out := strings.TrimSpace(b.String())
	if out == "" {
		return "location"
	}
	return out
}

func capacityText(classInfo ClassInfo) string {
	if classInfo.MaxSlots <= 0 && classInfo.Registered <= 0 {
		return ""
	}
	return fmt.Sprintf("%d of %d", classInfo.Registered, classInfo.MaxSlots)
}

func percentFilledValue(classInfo ClassInfo) float64 {
	if classInfo.PercentFilled > 0 {
		return classInfo.PercentFilled
	}
	if classInfo.MaxSlots > 0 {
		return (float64(classInfo.Registered) * 100) / float64(classInfo.MaxSlots)
	}
	return classInfo.PercentFilled
}

func classCode(classInfo ClassInfo) string {
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

func capacityRowForClass(classInfo ClassInfo, startRow int, height int) (int, bool) {
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

func fillClassBlock(f *excelize.File, sheet string, colName string, startRow int, height int, classInfo ClassInfo, maxWidth *int) error {
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

func writeLocationWorkbook(location string, byDay map[string][]ClassInfo) error {
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
		return err
	}
	borderTopStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderTop,
	})
	if err != nil {
		return err
	}
	borderMiddleStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderMiddle,
	})
	if err != nil {
		return err
	}
	borderBottomStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderBottom,
	})
	if err != nil {
		return err
	}
	headerStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Font:      &excelize.Font{Size: 20, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"000000"}, Pattern: 1},
	})
	if err != nil {
		return err
	}
	labelStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
	})
	if err != nil {
		return err
	}
	labelWrapStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})
	if err != nil {
		return err
	}
	labelBorderStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderAll,
	})
	if err != nil {
		return err
	}
	timeTopStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderTop,
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"FFFFFF"}, Pattern: 1},
	})
	if err != nil {
		return err
	}
	timeMiddleStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderMiddle,
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"FFFFFF"}, Pattern: 1},
	})
	if err != nil {
		return err
	}
	timeBottomStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &centerAlignment,
		Border:    borderBottom,
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"FFFFFF"}, Pattern: 1},
	})
	if err != nil {
		return err
	}
	scheduleGreyStyle, err := f.NewStyle(&excelize.Style{
		Fill: excelize.Fill{Type: "pattern", Color: []string{"D9D9D9"}, Pattern: 1},
	})
	if err != nil {
		return err
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
		return err
	}
	capRedTop, err := makeFillStyle("FF0000", borderTop)
	if err != nil {
		return err
	}
	capRedMiddle, err := makeFillStyle("FF0000", borderMiddle)
	if err != nil {
		return err
	}
	capRedBottom, err := makeFillStyle("FF0000", borderBottom)
	if err != nil {
		return err
	}

	capYellowAll, err := makeFillStyle("FFC000", borderAll)
	if err != nil {
		return err
	}
	capYellowTop, err := makeFillStyle("FFC000", borderTop)
	if err != nil {
		return err
	}
	capYellowMiddle, err := makeFillStyle("FFC000", borderMiddle)
	if err != nil {
		return err
	}
	capYellowBottom, err := makeFillStyle("FFC000", borderBottom)
	if err != nil {
		return err
	}

	capGreenAll, err := makeFillStyle("00B050", borderAll)
	if err != nil {
		return err
	}
	capGreenTop, err := makeFillStyle("00B050", borderTop)
	if err != nil {
		return err
	}
	capGreenMiddle, err := makeFillStyle("00B050", borderMiddle)
	if err != nil {
		return err
	}
	capGreenBottom, err := makeFillStyle("00B050", borderBottom)
	if err != nil {
		return err
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
		return nil
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
			return err
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
			return err
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
				return err
			}

			startRow := rowFromMinutes(startMin, baseMin, headerOffset)
			endRow := startRow + height - 1
			startCell := fmt.Sprintf("%s%d", colName, startRow)
			endCell := fmt.Sprintf("%s%d", colName, endRow)
			if err := fillClassBlock(f, day, colName, startRow, height, classInfo, &maxClassWidth); err != nil {
				return err
			}
			if startRow == endRow {
				if err := f.SetCellStyle(day, startCell, endCell, borderAllStyle); err != nil {
					return err
				}
			} else {
				if err := f.SetCellStyle(day, startCell, startCell, borderTopStyle); err != nil {
					return err
				}
				if endRow > startRow+1 {
					midStart := fmt.Sprintf("%s%d", colName, startRow+1)
					midEnd := fmt.Sprintf("%s%d", colName, endRow-1)
					if err := f.SetCellStyle(day, midStart, midEnd, borderMiddleStyle); err != nil {
						return err
					}
				}
				if err := f.SetCellStyle(day, endCell, endCell, borderBottomStyle); err != nil {
					return err
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
						return err
					}
				}
			}
		}

		rightTimeCol, err := excelize.ColumnNumberToName(rightTimeColIndex)
		if err != nil {
			return err
		}
		headerStart := "A1"
		headerEnd := fmt.Sprintf("%s1", rightTimeCol)
		if err := f.MergeCell(day, headerStart, headerEnd); err != nil {
			return err
		}
		subHeaderStart := "A3"
		subHeaderEnd := fmt.Sprintf("%s3", rightTimeCol)
		if err := f.MergeCell(day, subHeaderStart, subHeaderEnd); err != nil {
			return err
		}
		if err := f.SetRowHeight(day, 1, headerHeight); err != nil {
			return err
		}
		if err := f.SetRowHeight(day, 2, spacerHeight); err != nil {
			return err
		}
		if err := f.SetRowHeight(day, 3, headerHeight); err != nil {
			return err
		}
		if err := f.SetRowHeight(day, 4, headerHeight); err != nil {
			return err
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
				return err
			}
			if err := f.SetCellStyle(day, "A1", "A1", headerStyle); err != nil {
				return err
			}
		}

		startDateText := ""
		endDateText := ""
		if haveStartDate {
			startDateText = minStart.Format("2006-01-02")
		}
		if haveEndDate {
			endDateText = maxEndDate.Format("2006-01-02")
		}
		if startDateText != "" || endDateText != "" {
			dateRange := strings.TrimSpace(strings.Trim(startDateText+" - "+endDateText, " -"))
			if err := f.SetCellValue(day, "A3", dateRange); err != nil {
				return err
			}
			if err := f.SetCellStyle(day, "A3", "A3", headerStyle); err != nil {
				return err
			}
		}

		deckStart := "A4"
		deckEnd := "B4"
		if err := f.MergeCell(day, deckStart, deckEnd); err != nil {
			return err
		}
		if err := f.SetCellValue(day, "A4", "Deck Supervisor: "); err != nil {
			return err
		}
		if err := f.SetCellStyle(day, "A4", "A4", labelStyle); err != nil {
			return err
		}

		cancelStart := "C4"
		cancelEnd := fmt.Sprintf("%s4", rightTimeCol)
		if err := f.MergeCell(day, cancelStart, cancelEnd); err != nil {
			return err
		}
		weekCount := 0
		if haveStartDate && haveEndDate {
			weekCount = weeksBetweenDates(minStart, maxEndDate)
		}
		cancelText := fmt.Sprintf("Cancelled Dates: \n# of weeks %d classes", weekCount)
		if err := f.SetCellValue(day, cancelStart, cancelText); err != nil {
			return err
		}
		if err := f.SetCellStyle(day, cancelStart, cancelStart, labelWrapStyle); err != nil {
			return err
		}

		timeHeaderStart := "A5"
		timeHeaderEnd := "A6"
		if err := f.MergeCell(day, timeHeaderStart, timeHeaderEnd); err != nil {
			return err
		}
		if err := f.SetCellValue(day, "A5", "TIME"); err != nil {
			return err
		}
		if err := f.SetCellStyle(day, timeHeaderStart, timeHeaderEnd, labelBorderStyle); err != nil {
			return err
		}

		rightTimeHeaderStart := fmt.Sprintf("%s5", rightTimeCol)
		rightTimeHeaderEnd := fmt.Sprintf("%s6", rightTimeCol)
		if err := f.MergeCell(day, rightTimeHeaderStart, rightTimeHeaderEnd); err != nil {
			return err
		}
		if err := f.SetCellValue(day, rightTimeHeaderStart, "TIME"); err != nil {
			return err
		}
		if err := f.SetCellStyle(day, rightTimeHeaderStart, rightTimeHeaderEnd, labelBorderStyle); err != nil {
			return err
		}

		classHeaderStart := "B5"
		classHeaderEnd := fmt.Sprintf("%s5", classEndCol)
		if err := f.MergeCell(day, classHeaderStart, classHeaderEnd); err != nil {
			return err
		}
		if err := f.SetCellValue(day, classHeaderStart, "Instructors / Level"); err != nil {
			return err
		}
		if err := f.SetCellStyle(day, classHeaderStart, classHeaderEnd, labelBorderStyle); err != nil {
			return err
		}

		for i := 0; i < maxColumns; i++ {
			colName, err := excelize.ColumnNumberToName(classColOffset + i)
			if err != nil {
				return err
			}
			cell := fmt.Sprintf("%s6", colName)
			if err := f.SetCellValue(day, cell, fmt.Sprintf("Instructor %d", i+1)); err != nil {
				return err
			}
			if err := f.SetCellStyle(day, cell, cell, labelBorderStyle); err != nil {
				return err
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
				return err
			}
			if err := f.SetCellValue(day, rightCell, label); err != nil {
				return err
			}
			leftTop := leftCell
			leftBottom := fmt.Sprintf("A%d", endRow)
			leftMidStart := fmt.Sprintf("A%d", row+1)
			leftMidEnd := fmt.Sprintf("A%d", row+2)
			if err := f.SetCellStyle(day, leftTop, leftTop, timeTopStyle); err != nil {
				return err
			}
			if err := f.SetCellStyle(day, leftMidStart, leftMidEnd, timeMiddleStyle); err != nil {
				return err
			}
			if err := f.SetCellStyle(day, leftBottom, leftBottom, timeBottomStyle); err != nil {
				return err
			}

			rightTop := rightCell
			rightBottom := fmt.Sprintf("%s%d", rightTimeCol, endRow)
			rightMidStart := fmt.Sprintf("%s%d", rightTimeCol, row+1)
			rightMidEnd := fmt.Sprintf("%s%d", rightTimeCol, row+2)
			if err := f.SetCellStyle(day, rightTop, rightTop, timeTopStyle); err != nil {
				return err
			}
			if err := f.SetCellStyle(day, rightMidStart, rightMidEnd, timeMiddleStyle); err != nil {
				return err
			}
			if err := f.SetCellStyle(day, rightBottom, rightBottom, timeBottomStyle); err != nil {
				return err
			}
		}
		if maxTimeWidth > 0 {
			timeWidth := float64(maxTimeWidth) + 2
			if err := f.SetColWidth(day, "A", "A", timeWidth); err != nil {
				return err
			}
			if err := f.SetColWidth(day, rightTimeCol, rightTimeCol, timeWidth); err != nil {
				return err
			}
		}
		if maxClassWidth > 0 && maxColumns > 0 {
			classWidth := float64(maxClassWidth) + 2
			classEndColIndex := rightTimeColIndex - 1
			classEndCol, err := excelize.ColumnNumberToName(classEndColIndex)
			if err != nil {
				return err
			}
			if err := f.SetColWidth(day, "B", classEndCol, classWidth); err != nil {
				return err
			}
		}
	}

	filename := sanitizeFilename(location) + ".xlsx"
	return f.SaveAs(filename)
}
