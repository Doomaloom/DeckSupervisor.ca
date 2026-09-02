package plannerimport

import (
	"encoding/csv"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	plannerdomain "cob-aquatics/internal/planner"
)

type Meta struct {
	ActivitySummaryRows    int      `json:"activitySummaryRows"`
	RosterRows             int      `json:"rosterRows"`
	MatchedClassCount      int      `json:"matchedClassCount"`
	ActivityOnlyClassCount int      `json:"activityOnlyClassCount"`
	RosterOnlyClassCount   int      `json:"rosterOnlyClassCount"`
	ClassCount             int      `json:"classCount"`
	ParticipantCount       int      `json:"participantCount"`
	Warnings               []string `json:"warnings"`
}

type Result struct {
	Success bool                  `json:"success"`
	Dataset plannerdomain.Dataset `json:"dataset"`
	Meta    Meta                  `json:"meta"`
}

type importClass struct {
	Class     plannerdomain.Class
	StartDate time.Time
	EndDate   time.Time
	Source    string
}

var (
	parentheticalPattern = regexp.MustCompile(`\(.*?\)`)
	recreationPattern    = regexp.MustCompile(`\b(recreation|centre|center)\b`)
	nonAlphanumeric      = regexp.MustCompile(`[^a-z0-9]+`)
)

func Analyze(activitySummary io.Reader, activitySummaryName string, roster io.Reader, rosterName string) (Result, error) {
	activityRows, err := readExactCSV(activitySummary, "activity summary", activitySummaryHeaders)
	if err != nil {
		return Result{}, err
	}
	rosterRows, err := readExactCSV(roster, "roster", rosterHeaders)
	if err != nil {
		return Result{}, err
	}

	classesByEventID := make(map[string]*importClass, len(activityRows))
	activityIDs := make(map[string]struct{}, len(activityRows))
	for rowIndex, row := range activityRows {
		parsed, err := parseActivityClass(row)
		if err != nil {
			return Result{}, fmt.Errorf("activity summary row %d: %w", rowIndex+2, err)
		}
		if _, exists := classesByEventID[parsed.Class.EventID]; exists {
			return Result{}, fmt.Errorf("activity summary row %d: duplicate ID %q", rowIndex+2, parsed.Class.EventID)
		}
		classesByEventID[parsed.Class.EventID] = parsed
		activityIDs[parsed.Class.EventID] = struct{}{}
	}

	participantsByID := make(map[string]plannerdomain.Participant, len(rosterRows))
	rosterIDs := make(map[string]struct{})
	for rowIndex, row := range rosterRows {
		parsedClass, participant, err := parseRosterRow(row)
		if err != nil {
			return Result{}, fmt.Errorf("roster row %d: %w", rowIndex+2, err)
		}
		rosterIDs[parsedClass.Class.EventID] = struct{}{}

		existing := classesByEventID[parsedClass.Class.EventID]
		if existing == nil {
			classesByEventID[parsedClass.Class.EventID] = parsedClass
			existing = parsedClass
		} else if err := validateMatchingClass(existing, parsedClass); err != nil {
			return Result{}, fmt.Errorf("roster row %d, EventID %q: %w", rowIndex+2, parsedClass.Class.EventID, err)
		}

		participant.ClassKey = existing.Class.ClassKey
		participant.ServiceName = existing.Class.ServiceName
		participant.ID = buildParticipantID(existing.Class.ClassKey, participant.Name, participant.Phone)
		if _, duplicate := participantsByID[participant.ID]; duplicate {
			return Result{}, fmt.Errorf("roster row %d: duplicate participant for EventID %q", rowIndex+2, participant.EventID)
		}
		participantsByID[participant.ID] = participant
		if participant.AttendeeStatus == "waiting" {
			existing.Class.WaitingParticipantIDs = append(existing.Class.WaitingParticipantIDs, participant.ID)
			if existing.Source == "roster" {
				existing.Class.WaitlistCount++
			}
		} else {
			existing.Class.ParticipantIDs = append(existing.Class.ParticipantIDs, participant.ID)
		}
	}

	classes := make([]plannerdomain.Class, 0, len(classesByEventID))
	for _, imported := range classesByEventID {
		classes = append(classes, imported.Class)
	}
	assignLanes(classes)
	sort.Slice(classes, func(i, j int) bool {
		if classes[i].DayOfWeek != classes[j].DayOfWeek {
			return classes[i].DayOfWeek < classes[j].DayOfWeek
		}
		if classes[i].Facility != classes[j].Facility {
			return classes[i].Facility < classes[j].Facility
		}
		if classes[i].LaneIndex != classes[j].LaneIndex {
			return classes[i].LaneIndex < classes[j].LaneIndex
		}
		return classes[i].EventTime < classes[j].EventTime
	})

	participants := make([]plannerdomain.Participant, 0, len(participantsByID))
	callRecords := make(map[string]plannerdomain.ParticipantCallRecord, len(participantsByID))
	for _, participant := range participantsByID {
		participants = append(participants, participant)
		callRecords[participant.ID] = plannerdomain.ParticipantCallRecord{
			ParticipantID: participant.ID,
			ClassKey:      participant.ClassKey,
			Status:        "not_started",
		}
	}
	sort.Slice(participants, func(i, j int) bool { return participants[i].Name < participants[j].Name })

	sessions := buildSessions(classes)
	matched, activityOnly, rosterOnly := countClassSources(activityIDs, rosterIDs)
	warnings := make([]string, 0, 2)
	if activityOnly > 0 {
		warnings = append(warnings, fmt.Sprintf("%d activity-summary classes have no roster participants.", activityOnly))
	}
	if rosterOnly > 0 {
		warnings = append(warnings, fmt.Sprintf("%d roster classes were not present in the activity summary and were included from the roster.", rosterOnly))
	}

	return Result{
		Success: true,
		Dataset: plannerdomain.Dataset{
			SourceFileName: strings.TrimSpace(activitySummaryName) + ", " + strings.TrimSpace(rosterName),
			ImportedAt:     time.Now().UTC().Format(time.RFC3339),
			Sessions:       sessions,
			Classes:        classes,
			Participants:   participants,
			CallRecords:    callRecords,
		},
		Meta: Meta{
			ActivitySummaryRows:    len(activityRows),
			RosterRows:             len(rosterRows),
			MatchedClassCount:      matched,
			ActivityOnlyClassCount: activityOnly,
			RosterOnlyClassCount:   rosterOnly,
			ClassCount:             len(classes),
			ParticipantCount:       len(participants),
			Warnings:               warnings,
		},
	}, nil
}

func readExactCSV(reader io.Reader, label string, expectedHeaders []string) ([][]string, error) {
	csvReader := csv.NewReader(reader)
	csvReader.FieldsPerRecord = -1
	header, err := csvReader.Read()
	if err == io.EOF {
		return nil, fmt.Errorf("the %s CSV is empty", label)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to read %s CSV header: %w", label, err)
	}
	if len(header) > 0 {
		header[0] = strings.TrimPrefix(header[0], "\uFEFF")
	}
	if len(header) != len(expectedHeaders) {
		return nil, fmt.Errorf("the %s CSV header has %d columns; expected exactly %d", label, len(header), len(expectedHeaders))
	}
	for index := range expectedHeaders {
		if header[index] != expectedHeaders[index] {
			return nil, fmt.Errorf("the %s CSV column %d is %q; expected exactly %q", label, index+1, header[index], expectedHeaders[index])
		}
	}

	rows := make([][]string, 0)
	for {
		row, readErr := csvReader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return nil, fmt.Errorf("failed to read %s CSV: %w", label, readErr)
		}
		if len(row) != len(expectedHeaders) {
			return nil, fmt.Errorf("the %s CSV row %d has %d columns; expected exactly %d", label, len(rows)+2, len(row), len(expectedHeaders))
		}
		if isBlankRow(row) {
			continue
		}
		rows = append(rows, row)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("the %s CSV does not contain any data rows", label)
	}
	return rows, nil
}

func isBlankRow(row []string) bool {
	for _, value := range row {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return true
}

func parseActivityClass(row []string) (*importClass, error) {
	values := indexRow(activitySummaryHeaders, row)
	eventID := strings.TrimSpace(values["ID"])
	serviceName := strings.TrimSpace(values["GroupName"])
	day := strings.TrimSpace(values["Day"])
	facility := canonicalSummaryFacility(values["MainFacility"])
	if eventID == "" || serviceName == "" || day == "" || facility == "" {
		return nil, fmt.Errorf("ID, GroupName, Day, and MainFacility are required")
	}
	start, err := time.Parse("2006-01-02 03:04 PM", strings.TrimSpace(values["Starts"]))
	if err != nil {
		return nil, fmt.Errorf("invalid Starts value %q", values["Starts"])
	}
	end, err := time.Parse("2006-01-02 03:04 PM", strings.TrimSpace(values["Ends"]))
	if err != nil {
		return nil, fmt.Errorf("invalid Ends value %q", values["Ends"])
	}
	minimum, err := parseNonNegativeInt(values["Min"], "Min")
	if err != nil {
		return nil, err
	}
	maximum, err := parseNonNegativeInt(values["Max"], "Max")
	if err != nil {
		return nil, err
	}
	booked, err := parseNonNegativeInt(values["RegTotal"], "RegTotal")
	if err != nil {
		return nil, err
	}
	waitlist, err := parseNonNegativeInt(values["Waitlist"], "Waitlist")
	if err != nil {
		return nil, err
	}

	season, year := seasonAndYear(start)
	eventTime := formatEventTime(start, end)
	class := newPlannerClass(eventID, serviceName, day, eventTime, facility, season, year, minimum, maximum, booked, waitlist)
	return &importClass{Class: class, StartDate: dateOnly(start), EndDate: dateOnly(end), Source: "activity_summary"}, nil
}

func parseRosterRow(row []string) (*importClass, plannerdomain.Participant, error) {
	values := indexRow(rosterHeaders, row)
	eventID := strings.TrimSpace(values["EventID"])
	serviceName := strings.TrimSpace(values["ServiceName"])
	day := strings.TrimSpace(values["DayOfTheWeek"])
	eventTime := strings.TrimSpace(values["EventTime"])
	facility := strings.TrimSpace(values["Facility"])
	if eventID == "" || serviceName == "" || day == "" || eventTime == "" || facility == "" {
		return nil, plannerdomain.Participant{}, fmt.Errorf("EventID, ServiceName, DayOfTheWeek, EventTime, and Facility are required")
	}
	startTime, endTime, err := parseEventTime(eventTime)
	if err != nil {
		return nil, plannerdomain.Participant{}, err
	}
	startDate, endDate, err := parseEventSchedule(values["EventSchedule"])
	if err != nil {
		return nil, plannerdomain.Participant{}, err
	}
	minimum, err := parseNonNegativeInt(values["MinimumCapacity"], "MinimumCapacity")
	if err != nil {
		return nil, plannerdomain.Participant{}, err
	}
	maximum, err := parseNonNegativeInt(values["MaximumCapacity"], "MaximumCapacity")
	if err != nil {
		return nil, plannerdomain.Participant{}, err
	}
	booked, err := parseNonNegativeInt(values["Booked"], "Booked")
	if err != nil {
		return nil, plannerdomain.Participant{}, err
	}
	season, year := seasonAndYear(startDate)
	canonicalTime := formatClock(startTime) + " - " + formatClock(endTime)
	class := newPlannerClass(eventID, serviceName, day, canonicalTime, facility, season, year, minimum, maximum, booked, 0)

	name := normalizeParticipantName(values["AttendeeName"])
	if name == "" {
		return nil, plannerdomain.Participant{}, fmt.Errorf("AttendeeName is required")
	}
	status := strings.TrimSpace(values["AttendeeStatus"])
	normalizedStatus := ""
	switch status {
	case "Booked":
		normalizedStatus = "booked"
	case "Waiting":
		normalizedStatus = "waiting"
	default:
		return nil, plannerdomain.Participant{}, fmt.Errorf("unsupported AttendeeStatus %q", status)
	}

	return &importClass{Class: class, StartDate: startDate, EndDate: endDate, Source: "roster"}, plannerdomain.Participant{
		EventID:        eventID,
		Name:           name,
		Phone:          strings.TrimSpace(values["AttendeePhone"]),
		Email:          strings.TrimSpace(values["E-mail"]),
		Age:            strings.TrimSpace(values["Age"]),
		AttendeeStatus: normalizedStatus,
	}, nil
}

func validateMatchingClass(activity, roster *importClass) error {
	checks := []struct {
		name        string
		activityVal string
		rosterVal   string
	}{
		{"service name", activity.Class.ServiceName, roster.Class.ServiceName},
		{"day", activity.Class.DayOfWeek, roster.Class.DayOfWeek},
		{"event time", activity.Class.EventTime, roster.Class.EventTime},
		{"facility", normalizeFacilityKey(activity.Class.Facility), normalizeFacilityKey(roster.Class.Facility)},
		{"minimum capacity", strconv.Itoa(activity.Class.MinimumCapacity), strconv.Itoa(roster.Class.MinimumCapacity)},
		{"maximum capacity", strconv.Itoa(activity.Class.MaximumCapacity), strconv.Itoa(roster.Class.MaximumCapacity)},
		{"booked count", strconv.Itoa(activity.Class.BookedCount), strconv.Itoa(roster.Class.BookedCount)},
		{"start date", formatDate(activity.StartDate), formatDate(roster.StartDate)},
		{"end date", formatDate(activity.EndDate), formatDate(roster.EndDate)},
	}
	for _, check := range checks {
		if check.activityVal != check.rosterVal {
			return fmt.Errorf("%s conflicts: activity summary has %q, roster has %q", check.name, check.activityVal, check.rosterVal)
		}
	}
	return nil
}

func newPlannerClass(eventID, serviceName, day, eventTime, facility, season string, year, minimum, maximum, booked, waitlist int) plannerdomain.Class {
	sessionKey := buildSessionKey(day, season, year, facility)
	return plannerdomain.Class{
		ClassKey:              buildClassKey(eventID, day, eventTime, facility, season, year),
		EventID:               eventID,
		SessionKey:            sessionKey,
		ServiceName:           serviceName,
		DayOfWeek:             day,
		EventTime:             eventTime,
		Facility:              facility,
		SessionSeason:         season,
		SessionYear:           year,
		MinimumCapacity:       minimum,
		MaximumCapacity:       maximum,
		BookedCount:           booked,
		WaitlistCount:         waitlist,
		ParticipantIDs:        []string{},
		WaitingParticipantIDs: []string{},
		PlanningStatus:        "active",
	}
}

func buildSessions(classes []plannerdomain.Class) []plannerdomain.Session {
	sessionsByKey := make(map[string]*plannerdomain.Session)
	for _, class := range classes {
		session := sessionsByKey[class.SessionKey]
		if session == nil {
			session = &plannerdomain.Session{
				SessionKey:    class.SessionKey,
				DayOfWeek:     class.DayOfWeek,
				SessionSeason: class.SessionSeason,
				SessionYear:   class.SessionYear,
				Facility:      class.Facility,
				ClassKeys:     []string{},
			}
			sessionsByKey[class.SessionKey] = session
		}
		session.ClassKeys = append(session.ClassKeys, class.ClassKey)
	}
	sessions := make([]plannerdomain.Session, 0, len(sessionsByKey))
	for _, session := range sessionsByKey {
		sort.Strings(session.ClassKeys)
		sessions = append(sessions, *session)
	}
	sort.Slice(sessions, func(i, j int) bool {
		if sessions[i].DayOfWeek != sessions[j].DayOfWeek {
			return sessions[i].DayOfWeek < sessions[j].DayOfWeek
		}
		return sessions[i].Facility < sessions[j].Facility
	})
	return sessions
}

func assignLanes(classes []plannerdomain.Class) {
	groups := make(map[string][]*plannerdomain.Class)
	for index := range classes {
		key := classes[index].DayOfWeek + "|" + classes[index].Facility
		groups[key] = append(groups[key], &classes[index])
	}
	for _, group := range groups {
		sort.Slice(group, func(i, j int) bool {
			leftStart, leftEnd := eventBounds(group[i].EventTime)
			rightStart, rightEnd := eventBounds(group[j].EventTime)
			if leftStart != rightStart {
				return leftStart < rightStart
			}
			return leftEnd < rightEnd
		})
		laneEnds := make([]int, 0)
		for _, class := range group {
			start, end := eventBounds(class.EventTime)
			lane := -1
			for index, laneEnd := range laneEnds {
				if laneEnd <= start {
					lane = index
					break
				}
			}
			if lane == -1 {
				lane = len(laneEnds)
				laneEnds = append(laneEnds, end)
			} else {
				laneEnds[lane] = end
			}
			class.LaneIndex = lane
		}
	}
}

func eventBounds(value string) (int, int) {
	start, end, err := parseEventTime(value)
	if err != nil {
		return 0, 0
	}
	startMinutes := start.Hour()*60 + start.Minute()
	endMinutes := end.Hour()*60 + end.Minute()
	if endMinutes < startMinutes {
		endMinutes += 24 * 60
	}
	return startMinutes, endMinutes
}

func indexRow(headers, row []string) map[string]string {
	values := make(map[string]string, len(headers))
	for index, header := range headers {
		values[header] = row[index]
	}
	return values
}

func parseNonNegativeInt(value, field string) (int, error) {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed < 0 {
		return 0, fmt.Errorf("%s must be a non-negative integer; got %q", field, value)
	}
	return parsed, nil
}

func parseEventTime(value string) (time.Time, time.Time, error) {
	parts := strings.Split(strings.TrimSpace(value), " - ")
	if len(parts) != 2 {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid EventTime value %q", value)
	}
	start, err := time.Parse("03:04 PM", parts[0])
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid EventTime value %q", value)
	}
	end, err := time.Parse("03:04 PM", parts[1])
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid EventTime value %q", value)
	}
	return start, end, nil
}

func parseEventSchedule(value string) (time.Time, time.Time, error) {
	parts := strings.Split(strings.TrimSpace(value), " to ")
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "From ") {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid EventSchedule value %q", value)
	}
	start, err := time.Parse("2006-01-02", strings.TrimPrefix(parts[0], "From "))
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid EventSchedule value %q", value)
	}
	end, err := time.Parse("2006-01-02", parts[1])
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid EventSchedule value %q", value)
	}
	return start, end, nil
}

func seasonAndYear(value time.Time) (string, int) {
	switch value.Month() {
	case time.January, time.February:
		return "Winter", value.Year()
	case time.March, time.April, time.May:
		return "Spring", value.Year()
	case time.June, time.July, time.August:
		return "Summer", value.Year()
	default:
		return "Fall", value.Year()
	}
}

func formatEventTime(start, end time.Time) string {
	return formatClock(start) + " - " + formatClock(end)
}

func formatClock(value time.Time) string { return value.Format("03:04 PM") }
func formatDate(value time.Time) string  { return value.Format("2006-01-02") }
func dateOnly(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}

func canonicalSummaryFacility(value string) string {
	parts := strings.SplitN(strings.TrimSpace(value), " - ", 2)
	return strings.TrimSpace(parts[0])
}

func normalizeFacilityKey(value string) string {
	base := canonicalSummaryFacility(value)
	base = strings.ToLower(base)
	base = strings.ReplaceAll(base, "&", " and ")
	base = parentheticalPattern.ReplaceAllString(base, " ")
	base = recreationPattern.ReplaceAllString(base, " ")
	base = nonAlphanumeric.ReplaceAllString(base, " ")
	return strings.Join(strings.Fields(base), " ")
}

func buildSessionKey(day, season string, year int, facility string) string {
	return strings.Join([]string{strings.TrimSpace(day), strings.ToLower(strings.TrimSpace(season)), strconv.Itoa(year), normalizeFacilityKey(facility)}, "|")
}

func buildClassKey(eventID, day, eventTime, facility, season string, year int) string {
	return strings.Join([]string{strings.TrimSpace(eventID), strings.TrimSpace(day), strings.ToLower(strings.TrimSpace(eventTime)), normalizeFacilityKey(facility), strings.ToLower(strings.TrimSpace(season)), strconv.Itoa(year)}, "|")
}

func buildParticipantID(classKey, name, phone string) string {
	return classKey + "::" + strings.ToLower(strings.TrimSpace(name)) + "::" + strings.TrimSpace(phone)
}

func normalizeParticipantName(value string) string {
	trimmed := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	if !strings.Contains(trimmed, ",") {
		return trimmed
	}
	parts := strings.SplitN(trimmed, ",", 2)
	return strings.TrimSpace(parts[1]) + " " + strings.TrimSpace(parts[0])
}

func countClassSources(activityIDs, rosterIDs map[string]struct{}) (matched, activityOnly, rosterOnly int) {
	for id := range activityIDs {
		if _, exists := rosterIDs[id]; exists {
			matched++
		} else {
			activityOnly++
		}
	}
	for id := range rosterIDs {
		if _, exists := activityIDs[id]; !exists {
			rosterOnly++
		}
	}
	return matched, activityOnly, rosterOnly
}
