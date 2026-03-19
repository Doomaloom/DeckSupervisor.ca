package plannershare

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"math/big"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	codeLength               = 6
	sessionLifetime          = 24 * time.Hour
	staleParticipantDuration = 45 * time.Second
)

var (
	ErrSessionNotFound  = errors.New("shared planner session not found")
	ErrParticipantNotFound = errors.New("participant not found")
	ErrForbidden        = errors.New("forbidden")
)

type PlannerDataset struct {
	SourceFileName string                           `json:"sourceFileName"`
	ImportedAt     string                           `json:"importedAt"`
	Sessions       []PlannerSession                 `json:"sessions"`
	Classes        []PlannerClass                   `json:"classes"`
	Participants   []PlannerParticipant             `json:"participants"`
	CallRecords    map[string]PlannerParticipantCallRecord `json:"callRecords"`
}

type PlannerSession struct {
	SessionKey    string   `json:"sessionKey"`
	DayOfWeek     string   `json:"dayOfWeek"`
	SessionSeason string   `json:"sessionSeason"`
	SessionYear   int      `json:"sessionYear"`
	Facility      string   `json:"facility"`
	ClassKeys     []string `json:"classKeys"`
}

type PlannerClass struct {
	ClassKey        string `json:"classKey"`
	EventID         string `json:"eventId"`
	SessionKey      string `json:"sessionKey"`
	ServiceName     string `json:"serviceName"`
	DayOfWeek       string `json:"dayOfWeek"`
	EventTime       string `json:"eventTime"`
	Facility        string `json:"facility"`
	SessionSeason   string `json:"sessionSeason"`
	SessionYear     int    `json:"sessionYear"`
	MinimumCapacity int    `json:"minimumCapacity"`
	MaximumCapacity int    `json:"maximumCapacity"`
	BookedCount     int    `json:"bookedCount"`
	WaitlistCount   int    `json:"waitlistCount"`
	ParticipantIDs  []string `json:"participantIds"`
	WaitingParticipantIDs []string `json:"waitingParticipantIds"`
	PlanningStatus  string `json:"planningStatus"`
}

type PlannerParticipant struct {
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

type PlannerParticipantCallRecord struct {
	ParticipantID              string `json:"participantId"`
	ClassKey                   string `json:"classKey"`
	Status                     string `json:"status"`
	Notes                      string `json:"notes"`
	OfferedAlternativeClassKey string `json:"offeredAlternativeClassKey"`
	AcceptedAlternativeClassKey string `json:"acceptedAlternativeClassKey"`
}

type PlannerCallRecordUpdate struct {
	Status                     *string `json:"status,omitempty"`
	Notes                      *string `json:"notes,omitempty"`
	OfferedAlternativeClassKey *string `json:"offeredAlternativeClassKey,omitempty"`
	AcceptedAlternativeClassKey *string `json:"acceptedAlternativeClassKey,omitempty"`
}

type ShareParticipant struct {
	ID          string    `json:"id"`
	DisplayName string    `json:"displayName"`
	IsHost      bool      `json:"isHost"`
	IsGuest     bool      `json:"isGuest"`
	JoinedAt    time.Time `json:"joinedAt"`
	LastSeenAt  time.Time `json:"lastSeenAt"`
}

type ShareSession struct {
	Code              string             `json:"code"`
	ShareURL          string             `json:"shareUrl"`
	HostParticipantID string             `json:"hostParticipantId"`
	ExpiresAt         time.Time          `json:"expiresAt"`
	Participants      []ShareParticipant `json:"participants"`
	Dataset           PlannerDataset     `json:"dataset"`
	Version           int                `json:"version"`
}

type shareRoom struct {
	Code              string
	HostParticipantID string
	ExpiresAt         time.Time
	Version           int
	Dataset           PlannerDataset
	Participants      map[string]*ShareParticipant
}

type Service struct {
	mu       sync.Mutex
	sessions map[string]*shareRoom
}

func NewService() *Service {
	return &Service{
		sessions: make(map[string]*shareRoom),
	}
}

func (s *Service) Create(baseURL string, dataset PlannerDataset, displayName string, isGuest bool) (string, ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cleanupLocked(time.Now())
	if len(dataset.Classes) == 0 {
		return "", ShareSession{}, errors.New("planner dataset is empty")
	}

	code, err := s.generateCodeLocked()
	if err != nil {
		return "", ShareSession{}, err
	}
	now := time.Now().UTC()
	participantID, err := randomID()
	if err != nil {
		return "", ShareSession{}, err
	}

	room := &shareRoom{
		Code:              code,
		HostParticipantID: participantID,
		ExpiresAt:         now.Add(sessionLifetime),
		Version:           1,
		Dataset:           cloneDataset(dataset),
		Participants: map[string]*ShareParticipant{
			participantID: {
				ID:          participantID,
				DisplayName: normalizeDisplayName(displayName),
				IsHost:      true,
				IsGuest:     isGuest,
				JoinedAt:    now,
				LastSeenAt:  now,
			},
		},
	}
	s.sessions[code] = room
	return participantID, s.snapshotLocked(baseURL, room), nil
}

func (s *Service) Join(baseURL, code, displayName string, isGuest bool) (string, ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	s.cleanupLocked(now)
	room := s.sessions[strings.ToUpper(strings.TrimSpace(code))]
	if room == nil || now.After(room.ExpiresAt) {
		return "", ShareSession{}, ErrSessionNotFound
	}
	participantID, err := randomID()
	if err != nil {
		return "", ShareSession{}, err
	}
	room.Participants[participantID] = &ShareParticipant{
		ID:          participantID,
		DisplayName: normalizeDisplayName(displayName),
		IsHost:      false,
		IsGuest:     isGuest,
		JoinedAt:    now,
		LastSeenAt:  now,
	}
	return participantID, s.snapshotLocked(baseURL, room), nil
}

func (s *Service) Get(baseURL, code, participantID string) (ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return ShareSession{}, err
	}
	room.Participants[participantID].LastSeenAt = time.Now().UTC()
	s.cleanupRoomLocked(room, time.Now().UTC())
	return s.snapshotLocked(baseURL, room), nil
}

func (s *Service) Heartbeat(baseURL, code, participantID string) (ShareSession, error) {
	return s.Get(baseURL, code, participantID)
}

func (s *Service) Leave(code, participantID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return err
	}
	delete(room.Participants, participantID)
	s.cleanupRoomLocked(room, time.Now().UTC())
	if len(room.Participants) == 0 {
		delete(s.sessions, room.Code)
	}
	return nil
}

func (s *Service) Close(code, participantID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return err
	}
	if room.HostParticipantID != participantID {
		return ErrForbidden
	}
	delete(s.sessions, room.Code)
	return nil
}

func (s *Service) UpdateClassStatus(baseURL, code, participantID, classKey, status string) (ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return ShareSession{}, err
	}
	for index := range room.Dataset.Classes {
		if room.Dataset.Classes[index].ClassKey == classKey {
			room.Dataset.Classes[index].PlanningStatus = status
			room.Version += 1
			room.Participants[participantID].LastSeenAt = time.Now().UTC()
			return s.snapshotLocked(baseURL, room), nil
		}
	}
	return ShareSession{}, errors.New("class not found")
}

func (s *Service) UpdateCallRecord(baseURL, code, participantID, recordID string, update PlannerCallRecordUpdate) (ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return ShareSession{}, err
	}
	record, ok := room.Dataset.CallRecords[recordID]
	if !ok {
		return ShareSession{}, errors.New("call record not found")
	}
	if update.Status != nil {
		record.Status = *update.Status
	}
	if update.Notes != nil {
		record.Notes = *update.Notes
	}
	if update.OfferedAlternativeClassKey != nil {
		record.OfferedAlternativeClassKey = *update.OfferedAlternativeClassKey
	}
	if update.AcceptedAlternativeClassKey != nil {
		record.AcceptedAlternativeClassKey = *update.AcceptedAlternativeClassKey
	}
	room.Dataset.CallRecords[recordID] = record
	room.Version += 1
	room.Participants[participantID].LastSeenAt = time.Now().UTC()
	return s.snapshotLocked(baseURL, room), nil
}

func (s *Service) requireParticipantLocked(code, participantID string) (*shareRoom, error) {
	now := time.Now().UTC()
	s.cleanupLocked(now)
	room := s.sessions[code]
	if room == nil || now.After(room.ExpiresAt) {
		return nil, ErrSessionNotFound
	}
	participant := room.Participants[strings.TrimSpace(participantID)]
	if participant == nil {
		return nil, ErrParticipantNotFound
	}
	return room, nil
}

func (s *Service) cleanupLocked(now time.Time) {
	for code, room := range s.sessions {
		if now.After(room.ExpiresAt) {
			delete(s.sessions, code)
			continue
		}
		s.cleanupRoomLocked(room, now)
		if len(room.Participants) == 0 {
			delete(s.sessions, code)
		}
	}
}

func (s *Service) cleanupRoomLocked(room *shareRoom, now time.Time) {
	for id, participant := range room.Participants {
		if now.Sub(participant.LastSeenAt) > staleParticipantDuration {
			delete(room.Participants, id)
		}
	}
	if len(room.Participants) == 0 {
		return
	}
	if _, ok := room.Participants[room.HostParticipantID]; ok {
		for id, participant := range room.Participants {
			participant.IsHost = id == room.HostParticipantID
		}
		return
	}
	var nextHost *ShareParticipant
	for _, participant := range room.Participants {
		if nextHost == nil || participant.JoinedAt.Before(nextHost.JoinedAt) {
			nextHost = participant
		}
	}
	if nextHost == nil {
		return
	}
	room.HostParticipantID = nextHost.ID
	for id, participant := range room.Participants {
		participant.IsHost = id == room.HostParticipantID
	}
}

func (s *Service) snapshotLocked(baseURL string, room *shareRoom) ShareSession {
	participants := make([]ShareParticipant, 0, len(room.Participants))
	for _, participant := range room.Participants {
		copyParticipant := *participant
		copyParticipant.IsHost = participant.ID == room.HostParticipantID
		participants = append(participants, copyParticipant)
	}
	sort.Slice(participants, func(i, j int) bool {
		if participants[i].IsHost != participants[j].IsHost {
			return participants[i].IsHost
		}
		return participants[i].JoinedAt.Before(participants[j].JoinedAt)
	})
	return ShareSession{
		Code:              room.Code,
		ShareURL:          strings.TrimRight(baseURL, "/") + "/session-planning?share=" + room.Code,
		HostParticipantID: room.HostParticipantID,
		ExpiresAt:         room.ExpiresAt,
		Participants:      participants,
		Dataset:           cloneDataset(room.Dataset),
		Version:           room.Version,
	}
}

func (s *Service) generateCodeLocked() (string, error) {
	for attempts := 0; attempts < 20; attempts += 1 {
		code, err := randomCode(codeLength)
		if err != nil {
			return "", err
		}
		if _, exists := s.sessions[code]; !exists {
			return code, nil
		}
	}
	return "", errors.New("failed to generate share code")
}

func randomCode(length int) (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var builder strings.Builder
	for index := 0; index < length; index += 1 {
		value, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		builder.WriteByte(alphabet[value.Int64()])
	}
	return builder.String(), nil
}

func randomID() (string, error) {
	const length = 16
	return randomCode(length)
}

func normalizeDisplayName(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "Guest"
	}
	return trimmed
}

func cloneDataset(dataset PlannerDataset) PlannerDataset {
	bytes, err := json.Marshal(dataset)
	if err != nil {
		return dataset
	}
	var cloned PlannerDataset
	if err := json.Unmarshal(bytes, &cloned); err != nil {
		return dataset
	}
	if cloned.CallRecords == nil {
		cloned.CallRecords = map[string]PlannerParticipantCallRecord{}
	}
	return cloned
}
