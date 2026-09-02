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

	plannerdomain "cob-aquatics/internal/planner"
)

const (
	codeLength               = 6
	sessionLifetime          = 24 * time.Hour
	staleParticipantDuration = 45 * time.Second
)

var (
	ErrSessionNotFound     = errors.New("shared planner session not found")
	ErrParticipantNotFound = errors.New("participant not found")
	ErrForbidden           = errors.New("forbidden")
)

type PlannerDataset = plannerdomain.Dataset
type PlannerSession = plannerdomain.Session
type PlannerClass = plannerdomain.Class
type PlannerParticipant = plannerdomain.Participant
type PlannerParticipantCallRecord = plannerdomain.ParticipantCallRecord

type PlannerCallRecordUpdate struct {
	Status                         *string `json:"status,omitempty"`
	Notes                          *string `json:"notes,omitempty"`
	OfferedAlternativeClassKey     *string `json:"offeredAlternativeClassKey,omitempty"`
	AcceptedAlternativeClassKey    *string `json:"acceptedAlternativeClassKey,omitempty"`
	CompletedAt                    *string `json:"completedAt,omitempty"`
	EmailSentAt                    *string `json:"emailSentAt,omitempty"`
	WithdrawRefundAt               *string `json:"withdrawRefundAt,omitempty"`
	RefundReceiptSentAt            *string `json:"refundReceiptSentAt,omitempty"`
	ReRegisteredAt                 *string `json:"reRegisteredAt,omitempty"`
	RegistrationConfirmationSentAt *string `json:"registrationConfirmationSentAt,omitempty"`
}

type PlannerClassMetadataUpdate struct {
	BarcodeCancelledAt *string `json:"barcodeCancelledAt,omitempty"`
}

type SavedStateApplyInput struct {
	ClassStatuses           map[string]string                  `json:"classStatuses"`
	ClassLaneIndexes        map[string]int                     `json:"classLaneIndexes"`
	ClassMoves              map[string]PlannerClassMoveUpdate  `json:"classMoves"`
	ClassBarcodeCancelledAt map[string]string                  `json:"classBarcodeCancelledAt"`
	CallRecords             map[string]PlannerCallRecordUpdate `json:"callRecords"`
	LocationOverrides       map[string]string                  `json:"locationOverrides"`
	CallbackPhoneNumber     string                             `json:"callbackPhoneNumber"`
}

type PlannerClassMoveUpdate struct {
	PlannedMoveType      *string `json:"plannedMoveType,omitempty"`
	PlannedMoveTime      *string `json:"plannedMoveTime,omitempty"`
	PlannedMoveTargetKey *string `json:"plannedMoveTargetClassKey,omitempty"`
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
	Code                string             `json:"code"`
	ShareURL            string             `json:"shareUrl"`
	HostParticipantID   string             `json:"hostParticipantId"`
	LocationOverrides   map[string]string  `json:"locationOverrides"`
	CallbackPhoneNumber string             `json:"callbackPhoneNumber"`
	CCEmail             string             `json:"ccEmail"`
	ExpiresAt           time.Time          `json:"expiresAt"`
	Participants        []ShareParticipant `json:"participants"`
	Dataset             PlannerDataset     `json:"dataset"`
	Version             int                `json:"version"`
}

type shareRoom struct {
	Code                string
	HostParticipantID   string
	LocationOverrides   map[string]string
	CallbackPhoneNumber string
	CCEmail             string
	ExpiresAt           time.Time
	Version             int
	Dataset             PlannerDataset
	Participants        map[string]*ShareParticipant
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

func (s *Service) Create(baseURL string, dataset PlannerDataset, displayName string, locationOverrides map[string]string, callbackPhoneNumber string, ccEmail string, isGuest bool) (string, ShareSession, error) {
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
		Code:                code,
		HostParticipantID:   participantID,
		LocationOverrides:   normalizeLocationOverrides(locationOverrides),
		CallbackPhoneNumber: strings.TrimSpace(callbackPhoneNumber),
		CCEmail:             strings.TrimSpace(ccEmail),
		ExpiresAt:           now.Add(sessionLifetime),
		Version:             1,
		Dataset:             cloneDataset(dataset),
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

func (s *Service) UpdateClassLanes(baseURL, code, participantID string, laneIndexes map[string]int) (ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return ShareSession{}, err
	}
	if len(laneIndexes) == 0 {
		return s.snapshotLocked(baseURL, room), nil
	}
	updated := false
	for index := range room.Dataset.Classes {
		if laneIndex, ok := laneIndexes[room.Dataset.Classes[index].ClassKey]; ok {
			if laneIndex < 0 {
				laneIndex = 0
			}
			room.Dataset.Classes[index].LaneIndex = laneIndex
			updated = true
		}
	}
	if updated {
		room.Version += 1
	}
	room.Participants[participantID].LastSeenAt = time.Now().UTC()
	return s.snapshotLocked(baseURL, room), nil
}

func applyPlannerClassMove(current PlannerClass, update PlannerClassMoveUpdate) PlannerClass {
	moveType := strings.TrimSpace(current.PlannedMoveType)
	moveTime := strings.TrimSpace(current.PlannedMoveTime)
	moveTargetKey := strings.TrimSpace(current.PlannedMoveTargetKey)

	if update.PlannedMoveType != nil {
		nextType := strings.TrimSpace(*update.PlannedMoveType)
		if nextType == "new_time" || nextType == "target_class" {
			moveType = nextType
		} else {
			moveType = ""
		}
	}
	if update.PlannedMoveTime != nil {
		moveTime = strings.TrimSpace(*update.PlannedMoveTime)
	}
	if update.PlannedMoveTargetKey != nil {
		moveTargetKey = strings.TrimSpace(*update.PlannedMoveTargetKey)
	}

	if moveType == "new_time" {
		moveTargetKey = ""
	} else if moveType == "target_class" {
		moveTime = ""
	} else {
		moveTime = ""
		moveTargetKey = ""
	}

	current.PlannedMoveType = moveType
	current.PlannedMoveTime = moveTime
	current.PlannedMoveTargetKey = moveTargetKey
	return current
}

func (s *Service) UpdateClassMove(baseURL, code, participantID, classKey string, update PlannerClassMoveUpdate) (ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return ShareSession{}, err
	}
	for index := range room.Dataset.Classes {
		if room.Dataset.Classes[index].ClassKey == classKey {
			room.Dataset.Classes[index] = applyPlannerClassMove(room.Dataset.Classes[index], update)
			room.Version += 1
			room.Participants[participantID].LastSeenAt = time.Now().UTC()
			return s.snapshotLocked(baseURL, room), nil
		}
	}
	return ShareSession{}, errors.New("class not found")
}

func (s *Service) UpdateClassMetadata(baseURL, code, participantID, classKey string, update PlannerClassMetadataUpdate) (ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return ShareSession{}, err
	}
	for index := range room.Dataset.Classes {
		if room.Dataset.Classes[index].ClassKey == classKey {
			if update.BarcodeCancelledAt != nil {
				room.Dataset.Classes[index].BarcodeCancelledAt = strings.TrimSpace(*update.BarcodeCancelledAt)
			}
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
	if update.CompletedAt != nil {
		record.CompletedAt = *update.CompletedAt
	}
	if update.EmailSentAt != nil {
		record.EmailSentAt = *update.EmailSentAt
	}
	if update.WithdrawRefundAt != nil {
		record.WithdrawRefundAt = *update.WithdrawRefundAt
	}
	if update.RefundReceiptSentAt != nil {
		record.RefundReceiptSentAt = *update.RefundReceiptSentAt
	}
	if update.ReRegisteredAt != nil {
		record.ReRegisteredAt = *update.ReRegisteredAt
	}
	if update.RegistrationConfirmationSentAt != nil {
		record.RegistrationConfirmationSentAt = *update.RegistrationConfirmationSentAt
	}
	room.Dataset.CallRecords[recordID] = record
	room.Version += 1
	room.Participants[participantID].LastSeenAt = time.Now().UTC()
	return s.snapshotLocked(baseURL, room), nil
}

func (s *Service) UpdateSessionDetails(baseURL, code, participantID string, locationOverrides map[string]string, callbackPhoneNumber string, ccEmail string) (ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return ShareSession{}, err
	}
	if room.HostParticipantID != participantID {
		return ShareSession{}, ErrForbidden
	}
	room.LocationOverrides = normalizeLocationOverrides(locationOverrides)
	room.CallbackPhoneNumber = strings.TrimSpace(callbackPhoneNumber)
	room.CCEmail = strings.TrimSpace(ccEmail)
	room.Version += 1
	room.Participants[participantID].LastSeenAt = time.Now().UTC()
	return s.snapshotLocked(baseURL, room), nil
}

func (s *Service) ApplySavedState(baseURL, code, participantID string, input SavedStateApplyInput) (ShareSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, err := s.requireParticipantLocked(strings.ToUpper(strings.TrimSpace(code)), participantID)
	if err != nil {
		return ShareSession{}, err
	}

	for index := range room.Dataset.Classes {
		if status, ok := input.ClassStatuses[room.Dataset.Classes[index].ClassKey]; ok && status != "" {
			room.Dataset.Classes[index].PlanningStatus = status
		}
		if laneIndex, ok := input.ClassLaneIndexes[room.Dataset.Classes[index].ClassKey]; ok && laneIndex >= 0 {
			room.Dataset.Classes[index].LaneIndex = laneIndex
		}
		if move, ok := input.ClassMoves[room.Dataset.Classes[index].ClassKey]; ok {
			room.Dataset.Classes[index] = applyPlannerClassMove(room.Dataset.Classes[index], move)
		}
		if barcodeCancelledAt, ok := input.ClassBarcodeCancelledAt[room.Dataset.Classes[index].ClassKey]; ok {
			room.Dataset.Classes[index].BarcodeCancelledAt = strings.TrimSpace(barcodeCancelledAt)
		}
	}

	for recordID, update := range input.CallRecords {
		record, ok := room.Dataset.CallRecords[recordID]
		if !ok {
			continue
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
		if update.CompletedAt != nil {
			record.CompletedAt = *update.CompletedAt
		}
		if update.EmailSentAt != nil {
			record.EmailSentAt = *update.EmailSentAt
		}
		if update.WithdrawRefundAt != nil {
			record.WithdrawRefundAt = *update.WithdrawRefundAt
		}
		if update.RefundReceiptSentAt != nil {
			record.RefundReceiptSentAt = *update.RefundReceiptSentAt
		}
		if update.ReRegisteredAt != nil {
			record.ReRegisteredAt = *update.ReRegisteredAt
		}
		if update.RegistrationConfirmationSentAt != nil {
			record.RegistrationConfirmationSentAt = *update.RegistrationConfirmationSentAt
		}
		room.Dataset.CallRecords[recordID] = record
	}

	if room.HostParticipantID == participantID {
		room.LocationOverrides = normalizeLocationOverrides(input.LocationOverrides)
		room.CallbackPhoneNumber = strings.TrimSpace(input.CallbackPhoneNumber)
	}

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
		Code:                room.Code,
		ShareURL:            strings.TrimRight(baseURL, "/") + "/session-planning?share=" + room.Code,
		HostParticipantID:   room.HostParticipantID,
		LocationOverrides:   cloneLocationOverrides(room.LocationOverrides),
		CallbackPhoneNumber: room.CallbackPhoneNumber,
		CCEmail:             room.CCEmail,
		ExpiresAt:           room.ExpiresAt,
		Participants:        participants,
		Dataset:             cloneDataset(room.Dataset),
		Version:             room.Version,
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

func normalizeLocationOverrides(input map[string]string) map[string]string {
	if len(input) == 0 {
		return map[string]string{}
	}
	normalized := make(map[string]string, len(input))
	for facility, name := range input {
		trimmedFacility := strings.TrimSpace(facility)
		trimmedName := strings.TrimSpace(name)
		if trimmedFacility == "" || trimmedName == "" {
			continue
		}
		normalized[trimmedFacility] = trimmedName
	}
	return normalized
}

func cloneLocationOverrides(input map[string]string) map[string]string {
	cloned := make(map[string]string, len(input))
	for facility, name := range input {
		cloned[facility] = name
	}
	return cloned
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
