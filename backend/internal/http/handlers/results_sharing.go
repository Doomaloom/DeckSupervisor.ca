package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"cob-aquatics/internal/services/supabase"
)

type resultSwimmerBinding struct {
	SourceID     string `json:"sourceId"`
	EnrollmentID string `json:"enrollmentId"`
}
type resultCourseBinding struct {
	SourceID string                 `json:"sourceId"`
	ClassID  string                 `json:"classId"`
	Swimmers []resultSwimmerBinding `json:"swimmers"`
}
type resultSyncBinding struct {
	SchemaVersion int                   `json:"schemaVersion"`
	SessionID     string                `json:"sessionId"`
	DatasetID     string                `json:"datasetId"`
	InstructorID  string                `json:"instructorId"`
	Courses       []resultCourseBinding `json:"courses"`
}
type boundResultEnvelope struct {
	Package   json.RawMessage   `json:"_resultPackage"`
	CreatorID string            `json:"_creatorId"`
	Sync      resultSyncBinding `json:"_sync"`
}

// This envelope exists only inside the existing bounded, expiring memory service.
// No submitted sync/envelope fields are ever trusted to mint capabilities.
func bindResultPackage(r *http.Request, session string, data json.RawMessage) (json.RawMessage, error) {
	var p map[string]json.RawMessage
	if json.Unmarshal(data, &p) != nil {
		return nil, errors.New("invalid package")
	}
	// encoding/json matches struct fields case-insensitively, so every case
	// variant of a reserved key must go, not only its exact spelling.
	for k := range p {
		for _, reserved := range []string{"sync", "_resultPackage", "_creatorId", "_sync"} {
			if strings.EqualFold(k, reserved) {
				delete(p, k)
			}
		}
	}
	clean, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	if session == "" {
		return clean, nil
	}
	c, err := supabase.NewClientFromRequest(r)
	if err != nil {
		return nil, err
	}
	var auth json.RawMessage
	if err = c.RPC(r.Context(), "result_admin", map[string]any{"p_session": session, "p_action": "classes"}, &auth); err != nil {
		return nil, err
	}
	var registry struct {
		DatasetID string `json:"datasetId"`
		Courses   []struct {
			SourceID     string `json:"sourceId"`
			ClassID      string `json:"classId"`
			InstructorID string `json:"instructorId"`
			Swimmers     []struct {
				resultSwimmerBinding
				Active bool `json:"active"`
			} `json:"swimmers"`
		} `json:"courses"`
	}
	if err = c.RPC(r.Context(), "result_registry", map[string]any{"p_session": session}, &registry); err != nil {
		return nil, err
	}
	var pkg struct {
		DatasetID string `json:"datasetId"`
		Courses   []struct {
			SourceID string `json:"sourceId"`
			Swimmers []struct {
				SourceID string `json:"sourceId"`
			} `json:"swimmers"`
		} `json:"courses"`
	}
	if json.Unmarshal(clean, &pkg) != nil || registry.DatasetID == "" || registry.DatasetID != pkg.DatasetID || len(pkg.Courses) == 0 {
		return nil, errors.New("invalid dataset binding")
	}
	binding := resultSyncBinding{SchemaVersion: 1, SessionID: session, DatasetID: pkg.DatasetID, Courses: []resultCourseBinding{}}
	seenCourses := map[string]bool{}
	seenSwimmers := map[string]bool{}
	for _, pc := range pkg.Courses {
		if seenCourses[pc.SourceID] {
			return nil, errors.New("duplicate course")
		}
		seenCourses[pc.SourceID] = true
		found := false
		for _, rc := range registry.Courses {
			if rc.SourceID != pc.SourceID {
				continue
			}
			found = true
			if binding.InstructorID != "" && binding.InstructorID != rc.InstructorID {
				return nil, errors.New("mixed instructors")
			}
			binding.InstructorID = rc.InstructorID
			course := resultCourseBinding{SourceID: rc.SourceID, ClassID: rc.ClassID, Swimmers: []resultSwimmerBinding{}}
			for _, ps := range pc.Swimmers {
				if seenSwimmers[ps.SourceID] {
					return nil, errors.New("duplicate swimmer")
				}
				seenSwimmers[ps.SourceID] = true
				matched := false
				for _, rs := range rc.Swimmers {
					if rs.SourceID == ps.SourceID && rs.Active {
						course.Swimmers = append(course.Swimmers, rs.resultSwimmerBinding)
						matched = true
						break
					}
				}
				if !matched {
					return nil, errors.New("unknown swimmer")
				}
			}
			binding.Courses = append(binding.Courses, course)
			break
		}
		if !found {
			return nil, errors.New("unknown course")
		}
	}
	var instructors []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err = c.RPC(r.Context(), "session_instructor_roster", map[string]any{"p_session": session}, &instructors); err != nil {
		return nil, err
	}
	var packageInstructor string
	_ = json.Unmarshal(p["instructor"], &packageInstructor)
	validName := false
	for _, i := range instructors {
		if i.ID == binding.InstructorID && strings.TrimSpace(i.Name) == strings.TrimSpace(packageInstructor) {
			validName = true
		}
	}
	if !validName {
		return nil, errors.New("instructor binding mismatch")
	}
	syncData, _ := json.Marshal(binding)
	p["sync"] = syncData
	clean, err = json.Marshal(p)
	if err != nil {
		return nil, err
	}
	return json.Marshal(boundResultEnvelope{Package: clean, CreatorID: c.User.ID, Sync: binding})
}
func redeemResultPackage(r *http.Request, data []byte) (map[string]any, error) {
	var env boundResultEnvelope
	// Only the exact envelope written by bindResultPackage is a bound package;
	// anything else, including look-alike keys, stays import-only.
	var keys map[string]json.RawMessage
	if json.Unmarshal(data, &keys) != nil || len(keys) != 3 || keys["_creatorId"] == nil || keys["_sync"] == nil || keys["_resultPackage"] == nil {
		return map[string]any{"package": json.RawMessage(data)}, nil
	}
	_ = json.Unmarshal(data, &env)
	if env.CreatorID == "" {
		return map[string]any{"package": json.RawMessage(data)}, nil
	}
	token := func() (string, error) {
		b := make([]byte, 32)
		_, err := rand.Read(b)
		return hex.EncodeToString(b), err
	}
	upload, err := token()
	if err != nil {
		return nil, err
	}
	read, err := token()
	if err != nil {
		return nil, err
	}
	hash := func(v string) string { s := sha256.Sum256([]byte(v)); return hex.EncodeToString(s[:]) }
	bodyData, _ := json.Marshal(env.Sync)
	var body map[string]any
	_ = json.Unmarshal(bodyData, &body)
	body["uploadHash"] = hash(upload)
	body["readHash"] = hash(read)
	c, err := supabase.NewServiceClientFromEnv()
	if err != nil {
		return nil, err
	}
	var minted struct {
		ExpiresAt string `json:"expiresAt"`
	}
	if err = c.RPC(r.Context(), "result_mint", map[string]any{"p_session": env.Sync.SessionID, "p_creator": env.CreatorID, "p_body": body}, &minted); err != nil {
		return nil, err
	}
	delete(body, "uploadHash")
	delete(body, "readHash")
	body["uploadToken"] = upload
	body["readToken"] = read
	body["expiresAt"] = minted.ExpiresAt
	return map[string]any{"package": env.Package, "sync": body}, nil
}
