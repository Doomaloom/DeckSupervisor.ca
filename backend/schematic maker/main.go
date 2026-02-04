package main

import (
	"fmt"
	"github.com/go-gota/gota/dataframe"
	"os"
	"sort"
)

func main() {
	csvFile, err := os.Open("classes.csv")
	if err != nil {
		fmt.Println("Error opening CSV file:", err)
		return
	}
	defer csvFile.Close()

	df := dataframe.ReadCSV(csvFile)

	classInfos := getClassInfos(df)
	groupedClasses := groupClassesByLocationAndDay(classInfos)

	fmt.Printf("Parsed %d class entries\n", len(classInfos))
	fmt.Printf("Sample entry: %+v\n", classInfos[0])

	locations := make([]string, 0, len(groupedClasses))
	for location := range groupedClasses {
		locations = append(locations, location)
	}
	sort.Strings(locations)

	for _, location := range locations {
		if err := writeLocationWorkbook(location, groupedClasses[location]); err != nil {
			fmt.Printf("Error writing workbook for %s: %v\n", location, err)
		}
	}
}
