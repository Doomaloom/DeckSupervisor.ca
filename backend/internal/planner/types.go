package planner

type Dataset struct {
	SourceFileName string                           `json:"sourceFileName"`
	ImportedAt     string                           `json:"importedAt"`
	Sessions       []Session                        `json:"sessions"`
	Classes        []Class                          `json:"classes"`
	Participants   []Participant                    `json:"participants"`
	CallRecords    map[string]ParticipantCallRecord `json:"callRecords"`
}

type Session struct {
	SessionKey    string   `json:"sessionKey"`
	DayOfWeek     string   `json:"dayOfWeek"`
	SessionSeason string   `json:"sessionSeason"`
	SessionYear   int      `json:"sessionYear"`
	Facility      string   `json:"facility"`
	ClassKeys     []string `json:"classKeys"`
}

type Class struct {
	ClassKey              string   `json:"classKey"`
	EventID               string   `json:"eventId"`
	SessionKey            string   `json:"sessionKey"`
	ServiceName           string   `json:"serviceName"`
	DayOfWeek             string   `json:"dayOfWeek"`
	EventTime             string   `json:"eventTime"`
	Facility              string   `json:"facility"`
	SessionSeason         string   `json:"sessionSeason"`
	SessionYear           int      `json:"sessionYear"`
	MinimumCapacity       int      `json:"minimumCapacity"`
	MaximumCapacity       int      `json:"maximumCapacity"`
	BookedCount           int      `json:"bookedCount"`
	WaitlistCount         int      `json:"waitlistCount"`
	ParticipantIDs        []string `json:"participantIds"`
	WaitingParticipantIDs []string `json:"waitingParticipantIds"`
	LaneIndex             int      `json:"laneIndex"`
	PlanningStatus        string   `json:"planningStatus"`
	PlannedMoveType       string   `json:"plannedMoveType"`
	PlannedMoveTime       string   `json:"plannedMoveTime"`
	PlannedMoveTargetKey  string   `json:"plannedMoveTargetClassKey"`
	BarcodeCancelledAt    string   `json:"barcodeCancelledAt"`
}

type Participant struct {
	ID             string `json:"id"`
	ClassKey       string `json:"classKey"`
	EventID        string `json:"eventId"`
	ServiceName    string `json:"serviceName"`
	Name           string `json:"name"`
	Phone          string `json:"phone"`
	Email          string `json:"email"`
	Age            string `json:"age"`
	AttendeeStatus string `json:"attendeeStatus"`
}

type ParticipantCallRecord struct {
	ParticipantID                  string `json:"participantId"`
	ClassKey                       string `json:"classKey"`
	Status                         string `json:"status"`
	Notes                          string `json:"notes"`
	OfferedAlternativeClassKey     string `json:"offeredAlternativeClassKey"`
	AcceptedAlternativeClassKey    string `json:"acceptedAlternativeClassKey"`
	CompletedAt                    string `json:"completedAt"`
	EmailSentAt                    string `json:"emailSentAt"`
	WithdrawRefundAt               string `json:"withdrawRefundAt"`
	RefundReceiptSentAt            string `json:"refundReceiptSentAt"`
	ReRegisteredAt                 string `json:"reRegisteredAt"`
	RegistrationConfirmationSentAt string `json:"registrationConfirmationSentAt"`
}
