package tasks

import (
	"fmt"
	"io"
	"strings"

	"github.com/go-gota/gota/dataframe"
)

type csvRow map[string]string

func readCSVRows(csvReader io.Reader) ([]csvRow, error) {
	df := dataframe.ReadCSV(csvReader)
	if df.Err != nil {
		return nil, fmt.Errorf("failed to read csv: %w", df.Err)
	}

	rows := df.Maps()
	out := make([]csvRow, 0, len(rows))
	for _, row := range rows {
		normalized := make(csvRow, len(row))
		for header, value := range row {
			key := normalizeHeader(header)
			if key == "" {
				continue
			}
			text := ""
			if value != nil {
				text = fmt.Sprint(value)
			}
			normalized[key] = strings.TrimSpace(text)
		}
		out = append(out, normalized)
	}

	return out, nil
}

func rowValue(row csvRow, names ...string) string {
	for _, name := range names {
		value, ok := row[normalizeHeader(name)]
		if !ok {
			continue
		}
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}
