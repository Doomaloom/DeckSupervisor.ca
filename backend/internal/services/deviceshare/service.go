package deviceshare

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	IdleLifetime    = time.Minute
	MaxSessions     = 64
	MaxPackages     = 64
	MaxPackageBytes = 10 * 1024 * 1024
	MaxSessionBytes = 64 * 1024 * 1024
)

var (
	ErrNotFound    = errors.New("shared device session not found")
	ErrForbidden   = errors.New("host token is invalid")
	ErrRateLimited = errors.New("too many code attempts; try again shortly")
)

type InstructorPackage struct {
	Instructor string `json:"instructor"`
	Package    []byte `json:"package"`
}
type Code struct {
	Instructor string `json:"instructor"`
	Code       string `json:"code"`
}
type Started struct {
	ID        string    `json:"id"`
	HostToken string    `json:"hostToken"`
	Codes     []Code    `json:"codes"`
	ExpiresAt time.Time `json:"expiresAt"`
}
type room struct {
	id, token string
	packages  map[string][]byte
	codes     map[string]string
	expires   time.Time
	timer     *time.Timer
}
type attempt struct {
	start time.Time
	count int
}

// Service keeps active packages in process memory; deployments must route all share
// operations to one backend instance.
type Service struct {
	mu             sync.Mutex
	rooms          map[string]*room
	attempts       map[string]attempt
	createAttempts map[string]attempt
	globalRedeems  attempt
}

func New() *Service {
	return &Service{rooms: map[string]*room{}, attempts: map[string]attempt{}, createAttempts: map[string]attempt{}}
}

func (s *Service) Create(packages []InstructorPackage, client string) (Started, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	s.cleanup(now)
	if !s.allow(s.createAttempts, client, 10, now) {
		return Started{}, ErrRateLimited
	}
	if len(s.rooms) >= MaxSessions {
		return Started{}, errors.New("too many active device shares")
	}
	if s.usedBytes() >= MaxSessionBytes {
		return Started{}, errors.New("active device shares exceed the 64 MB storage limit")
	}
	if len(packages) == 0 || len(packages) > MaxPackages {
		return Started{}, errors.New("share must contain 1–64 instructor packages")
	}
	id, err := randomHex(24)
	if err != nil {
		return Started{}, err
	}
	token, err := randomHex(32)
	if err != nil {
		return Started{}, err
	}
	r := &room{id: id, token: token, packages: map[string][]byte{}, codes: map[string]string{}, expires: now.Add(IdleLifetime)}
	used := map[string]bool{}
	for _, active := range s.rooms {
		for code := range active.codes {
			used[code] = true
		}
	}
	total := s.usedBytes()
	for _, item := range packages {
		instructor := strings.TrimSpace(item.Instructor)
		if instructor == "" || len(instructor) > 200 || len(item.Package) == 0 || len(item.Package) > MaxPackageBytes {
			return Started{}, errors.New("invalid instructor package")
		}
		if _, ok := r.packages[instructor]; ok {
			return Started{}, errors.New("duplicate instructor package")
		}
		total += len(item.Package)
		if total > MaxSessionBytes {
			return Started{}, errors.New("active device shares exceed the 64 MB storage limit")
		}
		code := ""
		for tries := 0; tries < 100; tries++ {
			code, err = randomCode()
			if err != nil {
				return Started{}, err
			}
			if !used[code] {
				used[code] = true
				break
			}
			code = ""
		}
		if code == "" {
			return Started{}, errors.New("could not allocate instructor codes")
		}
		r.packages[instructor] = append([]byte(nil), item.Package...)
		r.codes[code] = instructor
	}
	s.rooms[r.id] = r
	r.timer = time.AfterFunc(IdleLifetime, func() { s.expire(r.id) })
	codes := make([]Code, 0, len(r.codes))
	for code, instructor := range r.codes {
		codes = append(codes, Code{Instructor: instructor, Code: code})
	}
	sort.Slice(codes, func(i, j int) bool { return codes[i].Instructor < codes[j].Instructor })
	return Started{ID: r.id, HostToken: token, Codes: codes, ExpiresAt: r.expires}, nil
}

func (s *Service) Heartbeat(id, token string) (time.Time, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	s.cleanup(now)
	r := s.rooms[id]
	if r == nil {
		return time.Time{}, ErrNotFound
	}
	if !secureEqual(token, r.token) {
		return time.Time{}, ErrForbidden
	}
	r.expires = now.Add(IdleLifetime)
	if r.timer != nil {
		r.timer.Reset(IdleLifetime)
	}
	return r.expires, nil
}
func (s *Service) Close(id, token string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cleanup(time.Now().UTC())
	r := s.rooms[id]
	if r == nil {
		return ErrNotFound
	}
	if !secureEqual(token, r.token) {
		return ErrForbidden
	}
	if r.timer != nil {
		r.timer.Stop()
	}
	delete(s.rooms, id)
	return nil
}
func (s *Service) Redeem(code, client string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	s.cleanup(now)
	if !s.allow(s.attempts, client, 20, now) || !s.allowGlobalRedeem(now) {
		return nil, ErrRateLimited
	}
	if len(code) != 6 {
		return nil, ErrNotFound
	}
	for _, r := range s.rooms {
		if instructor, ok := r.codes[code]; ok {
			return append([]byte(nil), r.packages[instructor]...), nil
		}
	}
	return nil, ErrNotFound
}
func (s *Service) allow(limits map[string]attempt, client string, maximum int, now time.Time) bool {
	client = strings.TrimSpace(client)
	if client == "" {
		client = "unknown"
	}
	if _, exists := limits[client]; !exists && len(limits) >= 4096 {
		return false
	}
	item := limits[client]
	if now.Sub(item.start) >= time.Minute {
		item = attempt{start: now}
	}
	if item.count >= maximum {
		limits[client] = item
		return false
	}
	item.count++
	limits[client] = item
	return true
}

func (s *Service) allowGlobalRedeem(now time.Time) bool {
	if now.Sub(s.globalRedeems.start) >= time.Minute {
		s.globalRedeems = attempt{start: now}
	}
	if s.globalRedeems.count >= 200 {
		return false
	}
	s.globalRedeems.count++
	return true
}

func (s *Service) usedBytes() int {
	total := 0
	for _, r := range s.rooms {
		for _, data := range r.packages {
			total += len(data)
		}
	}
	return total
}

func (s *Service) expire(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r := s.rooms[id]
	if r == nil {
		return
	}
	if time.Now().UTC().Before(r.expires) {
		r.timer.Reset(time.Until(r.expires))
		return
	}
	delete(s.rooms, id)
}

func (s *Service) cleanup(now time.Time) {
	for id, r := range s.rooms {
		if !now.Before(r.expires) {
			if r.timer != nil {
				r.timer.Stop()
			}
			delete(s.rooms, id)
		}
	}
	for client, a := range s.attempts {
		if now.Sub(a.start) >= time.Minute {
			delete(s.attempts, client)
		}
	}
	for client, a := range s.createAttempts {
		if now.Sub(a.start) >= time.Minute {
			delete(s.createAttempts, client)
		}
	}
}
func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, e := rand.Read(b); e != nil {
		return "", e
	}
	return hex.EncodeToString(b), nil
}
func randomCode() (string, error) {
	n, e := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if e != nil {
		return "", e
	}
	return formatCode(n.Int64()), nil
}
func formatCode(value int64) string {
	text := strconv.FormatInt(value, 10)
	return strings.Repeat("0", 6-len(text)) + text
}

func secureEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var d byte
	for i := range a {
		d |= a[i] ^ b[i]
	}
	return d == 0
}
