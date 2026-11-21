package tasks

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/go-gota/gota/dataframe"
)

type csvRow map[string]string

var KEEP_COLUMNS = []string{"ServiceName", "MaximumCapacity", "Booked", "DayOfTheWeek", "EventName", "EventTime", "EventID", "EventSchedule", "Facility", "AttendeeName", "AttendeeStatus", "AttendeePhone", "AttendeeEmail", "Age"}

// CSVFileError is a problem with the uploaded file itself. Its message is
// written for a supervisor and is safe to show as is.
type CSVFileError struct {
	Message string
}

func (e *CSVFileError) Error() string { return e.Message }

// requiredCSVColumns lists, per needed field, the header names the extractor
// accepts (see extractClassesDataFrame).
var requiredCSVColumns = []struct {
	label string
	names []string
}{
	{"EventID", []string{"EventID", "Event ID", "Code"}},
	{"EventTime", []string{"EventTime", "Time", "Starts", "Start"}},
}

func readCSVDataFrame(csvReader io.Reader) (dataframe.DataFrame, error) {
	data, err := io.ReadAll(csvReader)
	if err != nil {
		return dataframe.DataFrame{}, fmt.Errorf("failed to read csv: %w", err)
	}
	if err := checkCSVFileShape(data); err != nil {
		return dataframe.DataFrame{}, err
	}

	df := dataframe.ReadCSV(bytes.NewReader(data))
	if df.Err != nil {
		if strings.Contains(df.Err.Error(), "empty DataFrame") {
			return df, &CSVFileError{Message: "This file has no roster rows. Export the roster again and upload that file."}
		}
		return df, fmt.Errorf("failed to read csv: %w", df.Err)
	}
	if missing := missingCSVColumns(df.Names()); len(missing) > 0 {
		return df, &CSVFileError{Message: fmt.Sprintf(
			"This does not look like a roster export: the %s column is missing. Upload the roster CSV exported from the booking system.",
			strings.Join(missing, " and "),
		)}
	}
	dfKeep := df
	fmt.Printf("Read CSV with %d rows, keeping %d rows\n", df.Nrow(), dfKeep.Nrow())

	return dfKeep, nil
}

func checkCSVFileShape(data []byte) error {
	if len(bytes.TrimSpace(bytes.TrimPrefix(data, []byte("\xEF\xBB\xBF")))) == 0 {
		return &CSVFileError{Message: "This file is empty. Export the roster again and upload that file."}
	}
	sniff := data
	if len(sniff) > 1024 {
		sniff = sniff[:1024]
	}
	if bytes.IndexByte(sniff, 0) >= 0 {
		return &CSVFileError{Message: "This file is not a CSV roster. Upload the roster CSV exported from the booking system."}
	}
	lines := 0
	for _, line := range bytes.Split(data, []byte("\n")) {
		if len(bytes.TrimSpace(line)) > 0 {
			lines++
		}
	}
	if lines < 2 {
		return &CSVFileError{Message: "This file has a header row but no roster rows. Export the roster again and upload that file."}
	}
	return nil
}

func missingCSVColumns(names []string) []string {
	have := map[string]bool{}
	for _, name := range names {
		have[normalizeColumnName(name)] = true
	}
	var missing []string
	for _, column := range requiredCSVColumns {
		found := false
		for _, candidate := range column.names {
			if have[normalizeColumnName(candidate)] {
				found = true
				break
			}
		}
		if !found {
			missing = append(missing, column.label)
		}
	}
	return missing
}

// IsCSVFileError reports whether err is a problem with the file itself.
func IsCSVFileError(err error) (*CSVFileError, bool) {
	var fileErr *CSVFileError
	if errors.As(err, &fileErr) {
		return fileErr, true
	}
	return nil, false
}
