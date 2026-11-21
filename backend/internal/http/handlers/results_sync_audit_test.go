package handlers_test

// Completion-audit regressions for the results-sync HTTP layer. Each test names
// the contract requirement (docs/results-sync-contract.md) it proves.

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	httpapi "cob-aquatics/internal/http"
)

type auditCall struct {
	Path, Authorization, APIKey string
	Body                        map[string]any
	Raw                         string
}

// auditUpstream records every Supabase call. respond may be nil (returns {}).
func auditUpstream(t *testing.T, respond func(c auditCall, w http.ResponseWriter)) *[]auditCall {
	t.Helper()
	var mu sync.Mutex
	calls := &[]auditCall{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		c := auditCall{Path: r.URL.Path, Authorization: r.Header.Get("Authorization"), APIKey: r.Header.Get("apikey"), Raw: string(raw)}
		_ = json.Unmarshal(raw, &c.Body)
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/auth/v1/user" {
			io.WriteString(w, `{"id":"`+testUser+`"}`)
			return
		}
		mu.Lock()
		*calls = append(*calls, c)
		mu.Unlock()
		if respond == nil {
			io.WriteString(w, `{}`)
			return
		}
		respond(c, w)
	}))
	t.Cleanup(server.Close)
	t.Setenv("SUPABASE_URL", server.URL)
	t.Setenv("SUPABASE_ANON_KEY", "anon-key")
	t.Setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_results_audit")
	return calls
}

// auditRequest uses a per-test remote address so the in-memory share service's
// per-client rate limits never couple unrelated tests.
func auditRequest(method, path, body, remote string, signedIn bool, headers ...string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.RemoteAddr = remote + ":4000"
	if signedIn {
		r.AddCookie(&http.Cookie{Name: "decksupervisor_access_token", Value: "user-access-token"})
	}
	for i := 0; i+1 < len(headers); i += 2 {
		r.Header.Set(headers[i], headers[i+1])
	}
	w := httptest.NewRecorder()
	httpapi.NewRouter().ServeHTTP(w, r)
	return w
}

func sha(v string) string { s := sha256.Sum256([]byte(v)); return hex.EncodeToString(s[:]) }

const auditRegistry = `{"datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","courses":[{"sourceId":"course-a","classId":"class-a","instructorId":"instructor-a","swimmers":[{"sourceId":"swimmer-a","enrollmentId":"enrollment-a","active":true},{"sourceId":"swimmer-old","enrollmentId":"enrollment-old","active":false}]}]}`

func auditBindingResponder(t *testing.T) func(c auditCall, w http.ResponseWriter) {
	return func(c auditCall, w http.ResponseWriter) {
		switch c.Path {
		case "/rest/v1/rpc/result_mint":
			io.WriteString(w, `{"id":"grant","expiresAt":"2026-12-16T00:00:00Z"}`)
		case "/rest/v1/rpc/result_registry":
			io.WriteString(w, auditRegistry)
		case "/rest/v1/rpc/result_admin":
			io.WriteString(w, `{"classes":[]}`)
		case "/rest/v1/rpc/session_instructor_roster":
			io.WriteString(w, `[{"id":"instructor-a","name":"Alex"}]`)
		default:
			t.Errorf("unexpected upstream path %s", c.Path)
		}
	}
}

func auditCodes(t *testing.T, w *httptest.ResponseRecorder) (id, host string, codes []string) {
	t.Helper()
	var started struct {
		ID        string `json:"id"`
		HostToken string `json:"hostToken"`
		Codes     []struct {
			Code string `json:"code"`
		} `json:"codes"`
	}
	if w.Code != 201 || json.Unmarshal(w.Body.Bytes(), &started) != nil || len(started.Codes) == 0 {
		t.Fatalf("share not created: %d %s", w.Code, w.Body)
	}
	for _, c := range started.Codes {
		codes = append(codes, c.Code)
	}
	return started.ID, started.HostToken, codes
}

// Contract: "Guest/unbound packages remain import-only" and "Server ... never
// trusts submitted sync metadata". Go's JSON decoder matches struct fields
// case-insensitively, so differently-cased copies of the private envelope keys
// must be stripped just like the exact spellings.
func TestGuestPackageCannotForgeBoundEnvelopeWithAnyKeyCasing(t *testing.T) {
	calls := auditUpstream(t, nil)
	forgedSync := `{"schemaVersion":1,"sessionId":"victim-session","datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","instructorId":"instructor-a","courses":[{"sourceId":"course-a","classId":"class-a","swimmers":[{"sourceId":"swimmer-a","enrollmentId":"enrollment-a"}]}]}`
	for i, keys := range [][3]string{
		{"_creatorId", "_sync", "_resultPackage"},
		{"_CREATORID", "_SYNC", "_RESULTPACKAGE"},
		{"_CreatorID", "_Sync", "_ResultPackage"},
		{"_creatorid", "_ſync", "_resultpacKage"}, // Unicode simple-fold spellings
	} {
		pkg := `{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","instructor":"Alex","SYNC":{"instructorId":"forged-upper"},"Sync":{"instructorId":"forged-title"},"courses":[{"sourceId":"course-a"}],` +
			`"` + keys[0] + `":"victim-owner","` + keys[1] + `":` + forgedSync + `,"` + keys[2] + `":{"forged":"package"}}`
		remote := "198.51.100." + string(rune('1'+i))
		w := auditRequest("POST", "/api/device-shares", `{"packages":[{"instructor":"Alex","package":`+pkg+`}]}`, remote, true)
		_, _, codes := auditCodes(t, w)
		w = auditRequest("POST", "/api/device-shares/redeem", `{"code":"`+codes[0]+`"}`, remote, false)
		if w.Code != 200 {
			t.Fatalf("%v: guest redeem %d %s", keys, w.Code, w.Body)
		}
		var response map[string]json.RawMessage
		if json.Unmarshal(w.Body.Bytes(), &response) != nil {
			t.Fatalf("bad redeem body %s", w.Body)
		}
		if _, ok := response["sync"]; ok || len(response) != 1 {
			t.Fatalf("%v: guest package received sync capabilities: %s", keys, w.Body)
		}
		for _, banned := range []string{"uploadToken", "readToken", "victim", "forged", "expiresAt"} {
			if strings.Contains(w.Body.String(), banned) {
				t.Fatalf("%v: guest redeem leaked %q: %s", keys, banned, w.Body)
			}
		}
	}
	if len(*calls) != 0 {
		t.Fatalf("guest packages reached the database (%d calls, first %s): forged envelope trusted", len(*calls), (*calls)[0].Path)
	}
}

// Contract: authenticated bound packages only; a guest naming a session is refused
// and an authenticated share without sessionId stays import-only.
func TestGuestCannotBindSessionAndUnboundAuthenticatedShareIsImportOnly(t *testing.T) {
	calls := auditUpstream(t, nil)
	pkg := `{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","instructor":"Alex","courses":[{"sourceId":"course-a","swimmers":[{"sourceId":"swimmer-a"}]}]}`
	w := auditRequest("POST", "/api/device-shares", `{"sessionId":"session-a","packages":[{"instructor":"Alex","package":`+pkg+`}]}`, "198.51.100.20", false)
	if w.Code != 401 || len(*calls) != 0 {
		t.Fatalf("guest bound a session: %d %s calls=%d", w.Code, w.Body, len(*calls))
	}
	w = auditRequest("POST", "/api/device-shares", `{"packages":[{"instructor":"Alex","package":`+pkg+`}]}`, "198.51.100.20", false)
	if w.Code != 401 || strings.Contains(w.Body.String(), "code") || len(*calls) != 0 {
		t.Fatalf("guest created a device share: %d %s calls=%d", w.Code, w.Body, len(*calls))
	}
	w = auditRequest("POST", "/api/device-shares", `{"packages":[{"instructor":"Alex","package":`+pkg+`}]}`, "198.51.100.20", true)
	_, _, codes := auditCodes(t, w)
	w = auditRequest("POST", "/api/device-shares/redeem", `{"code":"`+codes[0]+`"}`, "198.51.100.20", false)
	if w.Code != 200 || strings.Contains(w.Body.String(), `"sync"`) || strings.Contains(w.Body.String(), "Token") || len(*calls) != 0 {
		t.Fatalf("unbound share was not import-only: %d %s calls=%d", w.Code, w.Body, len(*calls))
	}
}

// Contract: "Only hashes persisted. Each redemption issues independent grants.
// Closing share does not revoke grants." Also: expiry is never client-chosen,
// names never reach the database, and inactive enrollments cannot be bound.
func TestEachRedemptionMintsIndependentHashOnlyGrantsAndCloseDoesNotRevoke(t *testing.T) {
	calls := auditUpstream(t, auditBindingResponder(t))
	pkg := func(swimmer string) string {
		return `{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","instructor":"Alex","sync":{"sessionId":"forged-session","instructorId":"forged","courses":[]},"courses":[{"sourceId":"course-a","swimmers":[{"sourceId":"` + swimmer + `","name":"LOCAL-NAME","phone":"555-0100"}]}]}`
	}
	// An inactive (removed/transferred) enrollment cannot be bound into a grant.
	w := auditRequest("POST", "/api/device-shares", `{"sessionId":"session-a","packages":[{"instructor":"Alex","package":`+pkg("swimmer-old")+`}]}`, "198.51.100.30", true)
	if w.Code != 403 {
		t.Fatalf("inactive enrollment bound: %d %s", w.Code, w.Body)
	}
	// A package whose instructor label is not the registry instructor's roster name is refused.
	w = auditRequest("POST", "/api/device-shares", `{"sessionId":"session-a","packages":[{"instructor":"Sam","package":`+strings.ReplaceAll(pkg("swimmer-a"), `"instructor":"Alex"`, `"instructor":"Sam"`)+`}]}`, "198.51.100.30", true)
	if w.Code != 403 {
		t.Fatalf("mismatched instructor bound: %d %s", w.Code, w.Body)
	}
	w = auditRequest("POST", "/api/device-shares", `{"sessionId":"session-a","packages":[{"instructor":"Alex","package":`+pkg("swimmer-a")+`}]}`, "198.51.100.30", true)
	id, host, codes := auditCodes(t, w)
	for _, c := range *calls {
		if c.Path != "/rest/v1/rpc/result_mint" && (c.Authorization != "Bearer user-access-token" || c.APIKey != "anon-key") {
			t.Fatalf("binding lookup %s did not use the caller's own authorization", c.Path)
		}
		if c.Path == "/rest/v1/rpc/result_mint" {
			t.Fatal("grant minted before any redemption")
		}
	}
	type redeemed struct {
		Package map[string]json.RawMessage `json:"package"`
		Sync    struct {
			SchemaVersion int    `json:"schemaVersion"`
			SessionID     string `json:"sessionId"`
			InstructorID  string `json:"instructorId"`
			Upload        string `json:"uploadToken"`
			Read          string `json:"readToken"`
			ExpiresAt     string `json:"expiresAt"`
		} `json:"sync"`
	}
	var got [2]redeemed
	for i := range got {
		w = auditRequest("POST", "/api/device-shares/redeem", `{"code":"`+codes[0]+`"}`, "198.51.100.30", false)
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got[i]) != nil {
			t.Fatalf("redeem %d: %d %s", i, w.Code, w.Body)
		}
		if strings.Contains(w.Body.String(), "forged") || strings.Contains(w.Body.String(), "_creatorId") || strings.Contains(w.Body.String(), "uploadHash") {
			t.Fatalf("redeem exposed forged or private fields: %s", w.Body)
		}
		if got[i].Sync.SessionID != "session-a" || got[i].Sync.InstructorID != "instructor-a" || got[i].Sync.SchemaVersion != 1 || got[i].Sync.ExpiresAt != "2026-12-16T00:00:00Z" {
			t.Fatalf("sync not derived from the registry: %s", w.Body)
		}
		var embedded struct {
			SessionID    string `json:"sessionId"`
			InstructorID string `json:"instructorId"`
		}
		if json.Unmarshal(got[i].Package["sync"], &embedded) != nil || embedded.SessionID != "session-a" || embedded.InstructorID != "instructor-a" {
			t.Fatalf("package sync metadata not server-derived: %s", got[i].Package["sync"])
		}
	}
	tokens := map[string]bool{got[0].Sync.Upload: true, got[0].Sync.Read: true, got[1].Sync.Upload: true, got[1].Sync.Read: true}
	if len(tokens) != 4 {
		t.Fatal("redemptions shared a capability")
	}
	var mints []auditCall
	for _, c := range *calls {
		if c.Path == "/rest/v1/rpc/result_mint" {
			mints = append(mints, c)
		}
	}
	if len(mints) != 2 {
		t.Fatalf("expected one mint per redemption, got %d", len(mints))
	}
	for i, m := range mints {
		body, _ := m.Body["p_body"].(map[string]any)
		if m.APIKey != "sb_secret_results_audit" || m.Body["p_creator"] != testUser || m.Body["p_session"] != "session-a" {
			t.Fatalf("mint %d not service-scoped to the verified creator/session: %#v", i, m.Body)
		}
		if body["uploadHash"] != sha(got[i].Sync.Upload) || body["readHash"] != sha(got[i].Sync.Read) {
			t.Fatalf("mint %d did not persist SHA-256 hashes of the issued tokens", i)
		}
		for raw := range tokens {
			if strings.Contains(m.Raw, raw) {
				t.Fatalf("mint %d sent a raw token to the database", i)
			}
		}
		for _, banned := range []string{"LOCAL-NAME", "555-0100", "Alex", "forged", "expires", "Expires"} {
			if strings.Contains(m.Raw, banned) {
				t.Fatalf("mint %d sent %q to the database: %s", i, banned, m.Raw)
			}
		}
	}
	before := len(*calls)
	w = auditRequest("POST", "/api/device-shares/"+id+"/close", `{"hostToken":"`+host+`"}`, "198.51.100.30", false)
	if w.Code != 204 || len(*calls) != before {
		t.Fatalf("closing the share touched grants: %d, %d new database calls", w.Code, len(*calls)-before)
	}
	if w = auditRequest("POST", "/api/device-shares/redeem", `{"code":"`+codes[0]+`"}`, "198.51.100.30", false); w.Code != 404 || len(*calls) != before {
		t.Fatalf("closed share still redeemable: %d", w.Code)
	}
}

// A redemption whose binding the database no longer authorizes yields no package.
func TestRedeemRefusesWhenMintIsDenied(t *testing.T) {
	bind := auditBindingResponder(t)
	auditUpstream(t, func(c auditCall, w http.ResponseWriter) {
		if c.Path == "/rest/v1/rpc/result_mint" {
			w.WriteHeader(403)
			io.WriteString(w, `{"message":"DB-DETAIL"}`)
			return
		}
		bind(c, w)
	})
	pkg := `{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","instructor":"Alex","courses":[{"sourceId":"course-a","swimmers":[{"sourceId":"swimmer-a","name":"LOCAL-NAME"}]}]}`
	w := auditRequest("POST", "/api/device-shares", `{"sessionId":"session-a","packages":[{"instructor":"Alex","package":`+pkg+`}]}`, "198.51.100.40", true)
	_, _, codes := auditCodes(t, w)
	w = auditRequest("POST", "/api/device-shares/redeem", `{"code":"`+codes[0]+`"}`, "198.51.100.40", false)
	if w.Code != 403 || strings.Contains(w.Body.String(), "LOCAL-NAME") || strings.Contains(w.Body.String(), "DB-DETAIL") || strings.Contains(w.Body.String(), "course-a") {
		t.Fatalf("denied mint still released data: %d %s", w.Code, w.Body)
	}
}

// Contract: every website route is cookie-authenticated; device routes need a
// 64-character bearer capability. Nothing reaches the database otherwise.
func TestEveryResultsRouteRequiresAuthenticationBeforeAnyDatabaseCall(t *testing.T) {
	calls := auditUpstream(t, nil)
	op := `{"schemaVersion":1,"operations":[{"operationId":"one","sessionId":"s"}]}`
	for _, tc := range []struct{ method, path, body string }{
		{"GET", "/api/sessions/s/result-identities", ""},
		{"PUT", "/api/sessions/s/result-identities", `{"schemaVersion":1}`},
		{"POST", "/api/sessions/s/result-identities/reconcile", `{"courseId":"c"}`},
		{"GET", "/api/sessions/s/result-classes", ""},
		{"GET", "/api/sessions/s/results", ""},
		{"GET", "/api/sessions/s/results?classId=c", ""},
		{"POST", "/api/sessions/s/results", op},
		{"POST", "/api/sessions/s/results/conflicts/c/resolve", `{"choice":"incoming","expectedRevision":1}`},
		{"GET", "/api/sessions/s/result-grants", ""},
		{"DELETE", "/api/sessions/s/result-grants/g", ""},
		{"GET", "/api/device-results", ""},
		{"POST", "/api/device-results/upload", op},
	} {
		if w := auditRequest(tc.method, tc.path, tc.body, "198.51.100.50", false); w.Code != 401 {
			t.Errorf("guest %s %s: %d %s", tc.method, tc.path, w.Code, w.Body)
		}
	}
	// A website cookie is not a device capability, and malformed bearers are refused.
	for _, auth := range []string{"", "Bearer short", "Bearer " + strings.Repeat("a", 63), "Bearer " + strings.Repeat("a", 65), "Basic " + strings.Repeat("a", 65), "bearer " + strings.Repeat("a", 64)} {
		for _, tc := range [][2]string{{"GET", "/api/device-results"}, {"POST", "/api/device-results/upload"}} {
			if w := auditRequest(tc[0], tc[1], op, "198.51.100.50", true, "Authorization", auth); w.Code != 401 {
				t.Errorf("%s %s with %q: %d", tc[0], tc[1], auth, w.Code)
			}
		}
	}
	if len(*calls) != 0 {
		t.Fatalf("unauthenticated requests reached the database: %s", (*calls)[0].Path)
	}
}

// Contract: operations max 200, schemaVersion 1, bounded body, strict JSON.
func TestResultsUploadLimitsAreEnforcedBeforeAnyDatabaseCall(t *testing.T) {
	calls := auditUpstream(t, nil)
	ops := func(n int) string {
		return `{"schemaVersion":1,"operations":[` + strings.TrimSuffix(strings.Repeat(`{"operationId":"x","sessionId":"s"},`, n), ",") + `]}`
	}
	token := "Bearer " + strings.Repeat("a", 64)
	for name, body := range map[string]string{
		"201 operations":     ops(201),
		"schemaVersion 2":    `{"schemaVersion":2,"operations":[{}]}`,
		"missing version":    `{"operations":[{}]}`,
		"no operations":      `{"schemaVersion":1}`,
		"null operations":    `{"schemaVersion":1,"operations":null}`,
		"unknown top level":  `{"schemaVersion":1,"operations":[{}],"snapshot":{"name":"DO-NOT-PERSIST"}}`,
		"trailing document":  `{"schemaVersion":1,"operations":[{}]}{"schemaVersion":1,"operations":[{}]}`,
		"not json":           `operations`,
		"oversized (>2 MiB)": `{"schemaVersion":1,"operations":[{"operationId":"` + strings.Repeat("x", 2<<20) + `"}]}`,
	} {
		if w := auditRequest("POST", "/api/sessions/s/results", body, "198.51.100.60", true); w.Code != 400 {
			t.Errorf("website %s: %d", name, w.Code)
		}
		if w := auditRequest("POST", "/api/device-results/upload", body, "198.51.100.60", false, "Authorization", token); w.Code != 400 {
			t.Errorf("device %s: %d", name, w.Code)
		}
	}
	if len(*calls) != 0 {
		t.Fatalf("invalid upload reached the database: %s", (*calls)[0].Path)
	}
	// Exactly 200 is allowed and each operation is its own RPC/transaction.
	if w := auditRequest("POST", "/api/sessions/s/results", ops(200), "198.51.100.60", true); w.Code != 200 || len(*calls) != 200 {
		t.Fatalf("200 operations: %d with %d RPCs", w.Code, len(*calls))
	}
}

// Contract: device upload uses the service client plus the raw capability, the
// session comes from each operation (the grant check rejects a mismatch), a
// failed operation never aborts its siblings, and database text is not echoed.
func TestDeviceUploadForwardsCapabilityPerOperationAndIsolatesFailures(t *testing.T) {
	token := strings.Repeat("b", 64)
	calls := auditUpstream(t, func(c auditCall, w http.ResponseWriter) {
		op, _ := c.Body["op"].(map[string]any)
		switch op["operationId"] {
		case "two":
			w.WriteHeader(403)
			io.WriteString(w, `{"message":"permission denied DO-NOT-RETURN-DB-TEXT"}`)
		case "three":
			w.WriteHeader(500)
			io.WriteString(w, `{"message":"DO-NOT-RETURN-DB-TEXT"}`)
		default:
			io.WriteString(w, `{"operationId":"`+op["operationId"].(string)+`","status":"accepted","revision":1}`)
		}
	})
	body := `{"schemaVersion":1,"operations":[{"operationId":"one","sessionId":"session-a"},{"operationId":"two","sessionId":"session-b"},{"operationId":"three","sessionId":"session-a"},{"operationId":"four","sessionId":"session-a","payload":{"status":"present"}}]}`
	w := auditRequest("POST", "/api/device-results/upload", body, "198.51.100.70", true, "Authorization", "Bearer "+token)
	var response struct {
		SchemaVersion int `json:"schemaVersion"`
		Receipts      []struct {
			OperationID string `json:"operationId"`
			Status      string `json:"status"`
			Revision    int    `json:"revision"`
			Reason      string `json:"reason"`
		} `json:"receipts"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &response) != nil || response.SchemaVersion != 1 || len(response.Receipts) != 4 {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	want := []string{"accepted", "rejected", "rejected", "accepted"}
	for i, r := range response.Receipts {
		if r.Status != want[i] || r.OperationID != []string{"one", "two", "three", "four"}[i] {
			t.Fatalf("receipt %d out of order or wrong: %+v", i, r)
		}
		if r.Status == "rejected" && (r.Revision != 0 || r.Reason != map[string]string{"two": "unauthorized_or_invalid", "three": "temporarily_unavailable"}[r.OperationID]) {
			t.Fatalf("rejection leaked detail: %+v", r)
		}
	}
	if strings.Contains(w.Body.String(), "DO-NOT") || strings.Contains(w.Body.String(), token) || w.Header().Get("Cache-Control") != "no-store, private" {
		t.Fatalf("unsafe response: %s", w.Body)
	}
	if len(*calls) != 4 {
		t.Fatalf("expected one RPC per operation, got %d", len(*calls))
	}
	for i, c := range *calls {
		op, _ := c.Body["op"].(map[string]any)
		if c.Path != "/rest/v1/rpc/result_apply" || c.APIKey != "sb_secret_results_audit" || strings.Contains(c.Authorization, "user-access-token") || c.Body["p_token"] != token || c.Body["p_session"] != op["sessionId"] {
			t.Fatalf("call %d not a service-role, capability-scoped apply: %#v", i, c)
		}
	}
	if last, _ := (*calls)[3].Body["op"].(map[string]any); last["payload"] == nil {
		t.Fatal("operation not forwarded verbatim for server-side validation")
	}
}

// Website upload: the URL session always wins over the operation's own sessionId
// and no capability token is ever attached to a cookie-authenticated call.
func TestWebsiteUploadBindsEveryOperationToTheRouteSession(t *testing.T) {
	calls := auditUpstream(t, func(c auditCall, w http.ResponseWriter) {
		io.WriteString(w, `{"operationId":"x","status":"accepted","revision":1}`)
	})
	w := auditRequest("POST", "/api/sessions/session-a/results", `{"schemaVersion":1,"operations":[{"operationId":"x","sessionId":"session-b"}]}`, "198.51.100.80", true, "Authorization", "Bearer "+strings.Repeat("c", 64))
	if w.Code != 200 || len(*calls) != 1 {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	c := (*calls)[0]
	if _, has := c.Body["p_token"]; has || c.Body["p_session"] != "session-a" || c.Authorization != "Bearer user-access-token" || c.APIKey != "anon-key" {
		t.Fatalf("website upload not bound to caller and route session: %#v", c)
	}
}

// Contract: GET results (optional classId) for website and device.
func TestSnapshotRoutesForwardScopeAndHideDatabaseErrors(t *testing.T) {
	fail := 0
	calls := auditUpstream(t, func(c auditCall, w http.ResponseWriter) {
		if fail != 0 {
			w.WriteHeader(fail)
			io.WriteString(w, `{"message":"DO-NOT-RETURN-DB-TEXT"}`)
			return
		}
		io.WriteString(w, `{"schemaVersion":1,"records":[],"conflicts":[],"history":[]}`)
	})
	w := auditRequest("GET", "/api/sessions/session-a/results?classId=class-a", "", "198.51.100.90", true)
	c := (*calls)[0]
	if _, has := c.Body["p_token"]; w.Code != 200 || has || c.Path != "/rest/v1/rpc/result_snapshot" || c.Body["p_session"] != "session-a" || c.Body["p_class"] != "class-a" || c.Authorization != "Bearer user-access-token" {
		t.Fatalf("website snapshot: %d %#v", w.Code, c)
	}
	w = auditRequest("GET", "/api/sessions/session-a/results", "", "198.51.100.90", true)
	if _, has := (*calls)[1].Body["p_class"]; has || w.Code != 200 {
		t.Fatal("classId must be optional")
	}
	token := strings.Repeat("d", 64)
	w = auditRequest("GET", "/api/device-results?classId=class-a", "", "198.51.100.90", false, "Authorization", "Bearer "+token)
	c = (*calls)[2]
	if _, has := c.Body["p_session"]; w.Code != 200 || has || c.Body["p_token"] != token || c.Body["p_class"] != "class-a" || c.APIKey != "sb_secret_results_audit" {
		t.Fatalf("device snapshot: %d %#v", w.Code, c)
	}
	for status, want := range map[int]int{401: 401, 403: 403, 400: 400, 409: 409, 404: 502, 500: 502, 503: 502} {
		fail = status
		for _, device := range []bool{false, true} {
			if device {
				w = auditRequest("GET", "/api/device-results", "", "198.51.100.90", false, "Authorization", "Bearer "+token)
			} else {
				w = auditRequest("GET", "/api/sessions/session-a/results", "", "198.51.100.90", true)
			}
			if w.Code != want || strings.Contains(w.Body.String(), "DO-NOT") || strings.Contains(w.Body.String(), token) {
				t.Fatalf("upstream %d (device=%v) mapped to %d %s", status, device, w.Code, w.Body)
			}
		}
	}
}

// Contract: identity registry GET/PUT/reconcile, 404 before registration.
func TestRegistryRoutesMapToScopedRPCAndNotFoundBeforeRegistration(t *testing.T) {
	reply := `null`
	calls := auditUpstream(t, func(c auditCall, w http.ResponseWriter) { io.WriteString(w, reply) })
	if w := auditRequest("GET", "/api/sessions/session-a/result-identities", "", "198.51.100.100", true); w.Code != 404 {
		t.Fatalf("unregistered registry: %d %s", w.Code, w.Body)
	}
	c := (*calls)[0]
	if _, has := c.Body["p_body"]; has || len(c.Body) != 1 || c.Body["p_session"] != "session-a" || c.Path != "/rest/v1/rpc/result_registry" || c.Authorization != "Bearer user-access-token" {
		t.Fatalf("registry read not a caller-scoped, body-less call: %#v", c)
	}
	reply = `{"schemaVersion":1,"sessionId":"session-a","datasetId":"d","courses":[]}`
	put := `{"schemaVersion":1,"sessionId":"session-a","datasetId":"d","courses":[{"sourceId":"browser-course-id","swimmers":[{"sourceId":"browser-swimmer-id","active":false}]}]}`
	w := auditRequest("PUT", "/api/sessions/session-a/result-identities", put, "198.51.100.100", true)
	c = (*calls)[1]
	forwarded, _ := json.Marshal(c.Body["p_body"])
	var a, b any
	_ = json.Unmarshal(forwarded, &a)
	_ = json.Unmarshal([]byte(put), &b)
	ja, _ := json.Marshal(a)
	jb, _ := json.Marshal(b)
	if w.Code != 200 || c.Body["p_reconcile"] != false || !bytes.Equal(ja, jb) || !strings.Contains(w.Body.String(), `"datasetId":"d"`) {
		t.Fatalf("registry PUT altered or misrouted: %d %#v", w.Code, c.Body)
	}
	alias := `{"courseId":"c","swimmerId":"s","enrollmentId":"e","matchKey":"` + strings.Repeat("a", 64) + `"}`
	w = auditRequest("POST", "/api/sessions/session-a/result-identities/reconcile", alias, "198.51.100.100", true)
	c = (*calls)[2]
	if body, _ := c.Body["p_body"].(map[string]any); w.Code != 200 || c.Body["p_reconcile"] != true || body["matchKey"] != strings.Repeat("a", 64) || c.Body["p_session"] != "session-a" {
		t.Fatalf("reconcile misrouted: %d %#v", w.Code, c.Body)
	}
	before := len(*calls)
	for _, bad := range []string{``, `{} {}`, `[`, strings.Repeat(" ", 2<<20) + `{}`} {
		if w = auditRequest("PUT", "/api/sessions/session-a/result-identities", bad, "198.51.100.100", true); w.Code != 400 {
			t.Fatalf("invalid registry body accepted: %d", w.Code)
		}
	}
	if len(*calls) != before {
		t.Fatal("invalid registry body reached the database")
	}
}

// Contract: result-classes, result-grants list/revoke (204) and conflict resolve.
func TestAdminRoutesMapToSupervisorRPCActions(t *testing.T) {
	fail := false
	calls := auditUpstream(t, func(c auditCall, w http.ResponseWriter) {
		if fail {
			w.WriteHeader(403)
			io.WriteString(w, `{"message":"DO-NOT-RETURN-DB-TEXT"}`)
			return
		}
		io.WriteString(w, `{"resolved":true}`)
	})
	check := func(i int, action string, body map[string]any) {
		t.Helper()
		c := (*calls)[i]
		got, _ := json.Marshal(c.Body["p_body"])
		want, _ := json.Marshal(body)
		if c.Path != "/rest/v1/rpc/result_admin" || c.Body["p_session"] != "session-a" || c.Body["p_action"] != action || !bytes.Equal(got, want) || c.Authorization != "Bearer user-access-token" || c.APIKey != "anon-key" {
			t.Fatalf("call %d: want %s %s, got %#v", i, action, want, c.Body)
		}
	}
	if w := auditRequest("GET", "/api/sessions/session-a/result-classes", "", "198.51.100.110", true); w.Code != 200 {
		t.Fatalf("classes %d", w.Code)
	}
	check(0, "classes", map[string]any{})
	if w := auditRequest("GET", "/api/sessions/session-a/result-grants", "", "198.51.100.110", true); w.Code != 200 {
		t.Fatalf("grants %d", w.Code)
	}
	check(1, "grants", map[string]any{})
	if w := auditRequest("DELETE", "/api/sessions/session-a/result-grants/grant-1", "", "198.51.100.110", true); w.Code != 204 || w.Body.Len() != 0 {
		t.Fatalf("revoke %d %s", w.Code, w.Body)
	}
	check(2, "revoke", map[string]any{"id": "grant-1"})
	w := auditRequest("POST", "/api/sessions/session-a/results/conflicts/conflict-1/resolve", `{"choice":"incoming","expectedRevision":0}`, "198.51.100.110", true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"resolved":true`) {
		t.Fatalf("resolve %d %s", w.Code, w.Body)
	}
	// expectedRevision 0 ("no accepted record yet") must be forwarded, not dropped.
	check(3, "resolve", map[string]any{"choice": "incoming", "expectedRevision": 0, "id": "conflict-1"})
	auditRequest("POST", "/api/sessions/session-a/results/conflicts/conflict-1/resolve", `{"choice":"current","expectedRevision":7}`, "198.51.100.110", true)
	check(4, "resolve", map[string]any{"choice": "current", "expectedRevision": 7, "id": "conflict-1"})
	before := len(*calls)
	for _, bad := range []string{`{"choice":"incoming","expectedRevision":1,"id":"other-conflict"}`, `{"choice":"incoming","note":"DO-NOT-PERSIST"}`, `{"choice":"incoming","expectedRevision":"1"}`, `{"choice":"incoming"} {}`, `{"choice":"` + strings.Repeat("x", 2048) + `"}`} {
		if w = auditRequest("POST", "/api/sessions/session-a/results/conflicts/conflict-1/resolve", bad, "198.51.100.110", true); w.Code != 400 {
			t.Fatalf("invalid resolve body accepted (%d): %.60s", w.Code, bad)
		}
	}
	if len(*calls) != before {
		t.Fatal("invalid resolve body reached the database")
	}
	fail = true
	for _, tc := range [][3]string{{"GET", "/api/sessions/session-a/result-classes", ""}, {"GET", "/api/sessions/session-a/result-grants", ""}, {"DELETE", "/api/sessions/session-a/result-grants/grant-1", ""}, {"POST", "/api/sessions/session-a/results/conflicts/c/resolve", `{"choice":"incoming","expectedRevision":1}`}, {"GET", "/api/sessions/session-a/result-identities", ""}, {"PUT", "/api/sessions/session-a/result-identities", `{}`}} {
		if w = auditRequest(tc[0], tc[1], tc[2], "198.51.100.110", true); w.Code != 403 || strings.Contains(w.Body.String(), "DO-NOT") {
			t.Fatalf("denied %s %s: %d %s", tc[0], tc[1], w.Code, w.Body)
		}
	}
}

// Contract/handoff: no capability, payload or database text is logged.
func TestResultsHandlersWriteNothingToTheProcessLog(t *testing.T) {
	var logged bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&logged)
	t.Cleanup(func() { log.SetOutput(previous) })
	bind := auditBindingResponder(t)
	auditUpstream(t, func(c auditCall, w http.ResponseWriter) {
		if c.Path == "/rest/v1/rpc/result_apply" || c.Path == "/rest/v1/rpc/result_snapshot" {
			w.WriteHeader(403)
			io.WriteString(w, `{"message":"DB-TEXT-WITH-PII"}`)
			return
		}
		bind(c, w)
	})
	token := strings.Repeat("e", 64)
	auditRequest("POST", "/api/device-results/upload", `{"schemaVersion":1,"operations":[{"operationId":"one","sessionId":"s","payload":{"name":"PII-NAME"}}]}`, "198.51.100.120", false, "Authorization", "Bearer "+token)
	auditRequest("GET", "/api/device-results", "", "198.51.100.120", false, "Authorization", "Bearer "+token)
	auditRequest("POST", "/api/sessions/s/results", `{"schemaVersion":1,"operations":[{"operationId":"one","payload":{"name":"PII-NAME"}}]}`, "198.51.100.120", true)
	pkg := `{"schemaVersion":1,"kind":"rec-tablet-classes","datasetId":"decksupervisor:80000000-0000-0000-0000-000000000001","instructor":"Alex","courses":[{"sourceId":"course-a","swimmers":[{"sourceId":"swimmer-a","name":"PII-NAME"}]}]}`
	w := auditRequest("POST", "/api/device-shares", `{"sessionId":"session-a","packages":[{"instructor":"Alex","package":`+pkg+`}]}`, "198.51.100.120", true)
	_, _, codes := auditCodes(t, w)
	auditRequest("POST", "/api/device-shares/redeem", `{"code":"`+codes[0]+`"}`, "198.51.100.120", false)
	if logged.Len() != 0 {
		t.Fatalf("results handlers logged: %q", logged.String())
	}
}

// R2-C5: the database raises a plain exception when the conflict already changed; the
// supervisor must get a plain 409 message, not "Invalid request".
func TestResolveConflictThatAlreadyChangedReportsPlainConflict(t *testing.T) {
	message := "Conflict changed; refresh review"
	calls := auditUpstream(t, func(c auditCall, w http.ResponseWriter) {
		w.WriteHeader(400)
		io.WriteString(w, `{"code":"P0001","message":"`+message+`"}`)
	})
	_ = calls
	w := auditRequest("POST", "/api/sessions/session-a/results/conflicts/conflict-1/resolve", `{"choice":"current","expectedRevision":2}`, "198.51.100.111", true)
	if w.Code != 409 || !strings.Contains(w.Body.String(), "already resolved") || strings.Contains(w.Body.String(), "Invalid request") || strings.Contains(w.Body.String(), "refresh review") {
		t.Fatalf("changed conflict: %d %s", w.Code, w.Body)
	}
	message = "Invalid conflict"
	w = auditRequest("POST", "/api/sessions/session-a/results/conflicts/conflict-1/resolve", `{"choice":"current","expectedRevision":2}`, "198.51.100.111", true)
	if w.Code != 400 {
		t.Fatalf("other 400s must stay 400: %d %s", w.Code, w.Body)
	}
}
