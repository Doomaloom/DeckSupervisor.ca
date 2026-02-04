package main

type ClassInfo struct {
	Name          string `csv:"GroupName"`
	id            int    `csv:"ID"`
	Code          string
	Location      string `csv:"MainFacility"`
	Duration      int
	Day           string  `csv:"Day"`
	Starts        string  `csv:"Starts"`
	Ends          string  `csv:"Ends"`
	MaxSlots      int     `csv:"Max"`
	MinSlots      int     `csv:"Min"`
	Registered    int     `csv:"RegTotal"`
	PercentFilled float64 `csv:"PercentFilled"`
	StartTime     string
	EndTime       string
}
