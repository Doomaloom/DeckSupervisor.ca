package tasks

import (
	"fmt"
	"io"

	"github.com/go-gota/gota/dataframe"
)

type csvRow map[string]string

var KEEP_COLUMNS = []string{"ServiceName", "MaximumCapacity", "Booked", "DayOfTheWeek", "EventName", "EventTime", "EventID", "EventSchedule", "Facility", "AttendeeName", "AttendeeStatus", "AttendeePhone", "AttendeeEmail", "Age"}

func readCSVDataFrame(csvReader io.Reader) (dataframe.DataFrame, error) {
	df := dataframe.ReadCSV(csvReader)
	if df.Err != nil {
		return df, fmt.Errorf("failed to read csv: %w", df.Err)
	}
	dfKeep := df
	fmt.Printf("Read CSV with %d rows, keeping %d rows\n", df.Nrow(), dfKeep.Nrow())

	return dfKeep, nil
}
