package tasks

import (
	"fmt"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

type FormatOptions struct {
	TimeHeaders       bool
	InstructorHeaders bool
	CourseHeaders     bool
	Borders           bool
	CenterTime        bool
	BoldTime          bool
	CenterCourse      bool
	BoldCourse        bool
}

type MasterListResult struct {
	Filename string
	Data     []byte
}

func ProcessMasterList(records [][]string, options FormatOptions, instructorMap map[string]string) (MasterListResult, error) {
	if len(records) < 2 {
		return MasterListResult{}, fmt.Errorf("no rows to process")
	}

	headers := records[0]
	columnIndex := map[string]int{}
	for i, header := range headers {
		columnIndex[header] = i
	}

	getColumn := func(row []string, name string) string {
		idx, ok := columnIndex[name]
		if !ok || idx >= len(row) {
			return ""
		}
		return row[idx]
	}

	_, isSeries := columnIndex["ServiceName"]

	outputHeaders := []string{"EventID", "EventTime", "Instructor"}
	if isSeries {
		outputHeaders = append(outputHeaders, "ServiceName", "AttendeeName", "AttendeePhone")
	} else {
		outputHeaders = append(outputHeaders, "Service", "AttendeeName", "Phone")
	}

	outputRows := [][]string{}
	for i := 1; i < len(records); i++ {
		row := records[i]
		if len(row) == 0 {
			continue
		}

		eventID := getColumn(row, "EventID")
		eventTime := getColumn(row, "EventTime")
		instructor := instructorMap[eventID]

		if isSeries {
			outputRows = append(outputRows, []string{
				eventID,
				eventTime,
				instructor,
				getColumn(row, "ServiceName"),
				getColumn(row, "AttendeeName"),
				getColumn(row, "AttendeePhone"),
			})
		} else {
			outputRows = append(outputRows, []string{
				eventID,
				eventTime,
				instructor,
				getColumn(row, "Service"),
				getColumn(row, "AttendeeName"),
				getColumn(row, "Phone"),
			})
		}
	}

	file := excelize.NewFile()
	sheet := file.GetSheetName(0)

	for colIndex, header := range outputHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIndex+1, 1)
		file.SetCellValue(sheet, cell, header)
	}

	for rowIndex, row := range outputRows {
		for colIndex, value := range row {
			cell, _ := excelize.CoordinatesToCellName(colIndex+1, rowIndex+2)
			file.SetCellValue(sheet, cell, value)
		}
	}

	if options.TimeHeaders {
		addTimeHeaders(file, sheet, 2, len(outputRows)+1)
	}
	if options.CourseHeaders {
		addCourseHeaders(file, sheet, 2, len(outputRows)+1)
	}
	if options.InstructorHeaders {
		addInstructorHeaders(file, sheet, 2, len(outputRows)+1)
	}

	rows, _ := file.GetRows(sheet)
	lastRow := len(rows)
	if options.BoldTime || options.BoldCourse || options.CenterTime || options.CenterCourse {
		applyHeaderStyles(file, sheet, 2, lastRow, options)
	}

	if options.Borders {
		applyBorders(file, sheet, 1, lastRow, len(outputHeaders))
	}

	autoSizeColumns(file, sheet, len(outputHeaders), lastRow)

	buffer, err := file.WriteToBuffer()
	if err != nil {
		return MasterListResult{}, err
	}

	now := time.Now()
	filename := fmt.Sprintf("MasterList_%d_%d_%d.xlsx", now.Month(), now.Day(), now.Year())
	return MasterListResult{
		Filename: filename,
		Data:     buffer.Bytes(),
	}, nil
}

func addTimeHeaders(file *excelize.File, sheet string, startRow int, endRow int) {
	previous := ""
	row := startRow
	for row <= endRow {
		timeValue, _ := file.GetCellValue(sheet, fmt.Sprintf("B%d", row))
		if timeValue != previous {
			file.InsertRows(sheet, row, 1)
			file.SetCellValue(sheet, fmt.Sprintf("A%d", row), timeValue)
			previous = timeValue
			endRow++
			row++
		}
		previous = timeValue
		row++
	}
}

func addCourseHeaders(file *excelize.File, sheet string, startRow int, endRow int) {
	previous := ""
	row := startRow
	for row <= endRow {
		courseValue, _ := file.GetCellValue(sheet, fmt.Sprintf("A%d", row))
		timeValue, _ := file.GetCellValue(sheet, fmt.Sprintf("B%d", row))
		serviceName, _ := file.GetCellValue(sheet, fmt.Sprintf("D%d", row))
		if courseValue != previous && timeValue != "" {
			file.InsertRows(sheet, row, 1)
			file.SetCellValue(sheet, fmt.Sprintf("A%d", row), serviceName)
			previous = courseValue
			endRow++
			row++
		}
		previous = courseValue
		row++
	}
}

func addInstructorHeaders(file *excelize.File, sheet string, startRow int, endRow int) {
	for row := startRow; row < endRow; row++ {
		timeValue, _ := file.GetCellValue(sheet, fmt.Sprintf("B%d", row))
		headerValue, _ := file.GetCellValue(sheet, fmt.Sprintf("A%d", row))
		if timeValue == "" && !strings.Contains(headerValue, ":") {
			instructorValue, _ := file.GetCellValue(sheet, fmt.Sprintf("C%d", row+1))
			if instructorValue != "" {
				file.SetCellValue(sheet, fmt.Sprintf("A%d", row), fmt.Sprintf("%s - %s", headerValue, instructorValue))
			}
		}
	}
}

func applyHeaderStyles(file *excelize.File, sheet string, startRow int, endRow int, options FormatOptions) {
	boldStyle, _ := file.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	centerStyle, _ := file.NewStyle(&excelize.Style{Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"}})

	for row := startRow; row <= endRow; row++ {
		timeValue, _ := file.GetCellValue(sheet, fmt.Sprintf("B%d", row))
		headerValue, _ := file.GetCellValue(sheet, fmt.Sprintf("A%d", row))
		if timeValue != "" {
			continue
		}

		isTimeHeader := strings.Contains(headerValue, ":")
		if isTimeHeader && options.BoldTime {
			file.SetCellStyle(sheet, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), boldStyle)
		}
		if !isTimeHeader && options.BoldCourse {
			file.SetCellStyle(sheet, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), boldStyle)
		}

		if isTimeHeader && options.CenterTime {
			file.MergeCell(sheet, fmt.Sprintf("A%d", row), fmt.Sprintf("G%d", row))
			file.SetCellStyle(sheet, fmt.Sprintf("A%d", row), fmt.Sprintf("G%d", row), centerStyle)
		}
		if !isTimeHeader && options.CenterCourse {
			file.MergeCell(sheet, fmt.Sprintf("A%d", row), fmt.Sprintf("G%d", row))
			file.SetCellStyle(sheet, fmt.Sprintf("A%d", row), fmt.Sprintf("G%d", row), centerStyle)
		}
	}
}

func applyBorders(file *excelize.File, sheet string, startRow int, endRow int, columns int) {
	borderStyle, _ := file.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
	})

	for row := startRow; row <= endRow; row++ {
		startCell, _ := excelize.CoordinatesToCellName(1, row)
		endCell, _ := excelize.CoordinatesToCellName(columns, row)
		file.SetCellStyle(sheet, startCell, endCell, borderStyle)
	}
}

func autoSizeColumns(file *excelize.File, sheet string, columns int, endRow int) {
	for col := 1; col <= columns; col++ {
		maxLen := 0
		for row := 1; row <= endRow; row++ {
			cell, _ := excelize.CoordinatesToCellName(col, row)
			value, _ := file.GetCellValue(sheet, cell)
			if len(value) > maxLen {
				maxLen = len(value)
			}
		}
		columnName, _ := excelize.ColumnNumberToName(col)
		if maxLen < 10 {
			maxLen = 10
		}
		file.SetColWidth(sheet, columnName, columnName, float64(maxLen+2))
	}
}
