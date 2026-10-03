package handlers_test

import (
	httpapi "cob-aquatics/internal/http"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

var recoveryTestRun atomic.Uint64

func recoveryRequest(method, path, body string, cookie *http.Cookie, ip string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.RemoteAddr = fmt.Sprintf("%s-%d:1234", ip, recoveryTestRun.Load())
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	httpapi.NewRouter().ServeHTTP(w, r)
	return w
}
func recoveryConfig(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	recoveryTestRun.Add(1)
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	t.Setenv("SUPABASE_URL", server.URL)
	t.Setenv("SUPABASE_ANON_KEY", "recovery-anon")
	t.Setenv("AUTH_RECOVERY_KEY", base64.StdEncoding.EncodeToString([]byte("01234567890123456789012345678901")))
	t.Setenv("SUPABASE_RECOVERY_REDIRECT_URL", "http://localhost:3000/reset-password")
}
func TestRecoveryUniformConfirmationAndThrottling(t *testing.T) {
	calls := 0
	recoveryConfig(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/auth/v1/recover" || r.Header.Get("apikey") != "recovery-anon" {
			t.Fatal("unexpected recovery request")
		}
		if r.URL.Query().Get("redirect_to") != "http://localhost:3000/reset-password" {
			t.Fatal("untrusted redirect")
		}
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		if strings.Contains(body["email"], "unknown") {
			w.WriteHeader(400)
			io.WriteString(w, `{"msg":"Unknown account"}`)
		} else {
			io.WriteString(w, "{}")
		}
	})
	email := fmt.Sprintf("recovery-known-%d@example.invalid", recoveryTestRun.Load())
	known := recoveryRequest("POST", "/api/auth/recovery/request", `{"email":"`+email+`"}`, nil, "192.0.2.60")
	unknown := recoveryRequest("POST", "/api/auth/recovery/request", fmt.Sprintf(`{"email":"recovery-unknown-%d@example.invalid"}`, recoveryTestRun.Load()), nil, "192.0.2.61")
	if known.Code != 200 || unknown.Code != 200 || known.Body.String() != unknown.Body.String() {
		t.Fatal("account existence was disclosed")
	}
	for i := 0; i < 2; i++ {
		w := recoveryRequest("POST", "/api/auth/recovery/request", `{"email":"`+email+`"}`, nil, "192.0.2.60")
		if w.Code != 200 {
			t.Fatal(w.Code)
		}
	}
	blocked := recoveryRequest("POST", "/api/auth/recovery/request", `{"email":"`+email+`"}`, nil, "192.0.2.60")
	if blocked.Code != 429 || blocked.Header().Get("Retry-After") == "" || calls != 4 {
		t.Fatalf("throttle %d calls %d", blocked.Code, calls)
	}
}
func TestRecoveryVerificationPolicyRetryReplayAndNewLogin(t *testing.T) {
	var mu sync.Mutex
	used := false
	grantState := ""
	password := "old-password"
	writes := 0
	recoveryConfig(t, func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		switch r.URL.Path {
		case "/auth/v1/verify":
			if body["type"] != "recovery" {
				t.Fatal("wrong token purpose")
			}
			if body["token_hash"] != "valid-hash" || used {
				w.WriteHeader(400)
				io.WriteString(w, `{"msg":"Expired or used"}`)
				return
			}
			used = true
			io.WriteString(w, `{"access_token":"recovery-access","expires_in":3600,"user":{"id":"`+testUser+`"}}`)
		case "/auth/v1/user":
			if r.Header.Get("Authorization") != "Bearer recovery-access" {
				t.Fatal("wrong recovered identity")
			}
			if r.Method == "PUT" {
				writes++
				if body["password"] == "ProviderReject!" {
					w.WriteHeader(422)
					io.WriteString(w, `{"msg":"Weak password"}`)
					return
				}
				password = body["password"].(string)
			}
			io.WriteString(w, `{"id":"`+testUser+`"}`)
		case "/rest/v1/rpc/register_recovery_grant":
			grantState = "pending"
			io.WriteString(w, "null")
		case "/rest/v1/rpc/claim_recovery_grant":
			if r.Header.Get("Authorization") != "Bearer recovery-access" {
				t.Fatal("grant operation lost caller token")
			}
			if grantState == "pending" {
				grantState = "claimed"
				io.WriteString(w, "true")
			} else {
				io.WriteString(w, "false")
			}
		case "/rest/v1/rpc/finish_recovery_grant":
			if body["p_success"] == true {
				grantState = "used"
			} else {
				grantState = "pending"
			}
			io.WriteString(w, "null")
		case "/auth/v1/logout":
			w.WriteHeader(204)
		case "/auth/v1/token":
			if body["password"] != password {
				w.WriteHeader(401)
				io.WriteString(w, `{"msg":"Invalid credentials"}`)
				return
			}
			io.WriteString(w, `{"access_token":"new-access","expires_in":3600,"user":{"id":"`+testUser+`"}}`)
		default:
			t.Fatalf("unexpected provider request %s", r.URL.Path)
		}
	})
	for _, hash := range []string{"invalid", "expired"} {
		w := recoveryRequest("POST", "/api/auth/recovery/verify", `{"token_hash":"`+hash+`"}`, nil, "192.0.2.62")
		if w.Code != 400 || !strings.Contains(w.Body.String(), "Request another") {
			t.Fatalf("invalid %d %s", w.Code, w.Body)
		}
	}
	verified := recoveryRequest("POST", "/api/auth/recovery/verify", `{"token_hash":"valid-hash","user_id":"forged"}`, nil, "192.0.2.62")
	if verified.Code != 200 {
		t.Fatalf("verify %d %s", verified.Code, verified.Body)
	}
	var cookie *http.Cookie
	for _, c := range verified.Result().Cookies() {
		if c.Name == "decksupervisor_recovery" {
			cookie = c
		}
	}
	if cookie == nil || !cookie.HttpOnly || cookie.Path != "/api/auth/recovery" || cookie.MaxAge > 900 {
		t.Fatal("unsafe recovery cookie")
	}
	if strings.Contains(verified.Body.String(), "recovery-access") || strings.Contains(cookie.Value, "recovery-access") {
		t.Fatal("exposed provider token")
	}
	mismatch := recoveryRequest("POST", "/api/auth/recovery/reset", `{"password":"strong-password","confirm_password":"different"}`, cookie, "192.0.2.63")
	if mismatch.Code != 400 || writes != 0 {
		t.Fatal("mismatch updated password")
	}
	reject := recoveryRequest("POST", "/api/auth/recovery/reset", `{"password":"ProviderReject!","confirm_password":"ProviderReject!"}`, cookie, "192.0.2.63")
	if reject.Code != 400 || grantState != "pending" {
		t.Fatal("provider policy rejection discarded recovery")
	}
	good := recoveryRequest("POST", "/api/auth/recovery/reset", `{"password":"new-strong-password","confirm_password":"new-strong-password"}`, cookie, "192.0.2.63")
	if good.Code != 200 || grantState != "used" {
		t.Fatalf("reset %d %s", good.Code, good.Body)
	}
	reused := recoveryRequest("POST", "/api/auth/recovery/reset", `{"password":"another-password","confirm_password":"another-password"}`, cookie, "192.0.2.63")
	if reused.Code != 400 || writes != 2 {
		t.Fatal("reset cookie replay succeeded")
	}
	usedLink := recoveryRequest("POST", "/api/auth/recovery/verify", `{"token_hash":"valid-hash"}`, nil, "192.0.2.62")
	if usedLink.Code != 400 {
		t.Fatal("reused email link succeeded")
	}
	for _, tc := range []struct {
		password string
		status   int
	}{{"old-password", 401}, {"new-strong-password", 200}} {
		w := recoveryRequest("POST", "/api/auth/sign-in", `{"email":"qa@example.invalid","password":"`+tc.password+`"}`, nil, "192.0.2.64")
		if w.Code != tc.status {
			t.Fatalf("login %s returned %d", tc.password, w.Code)
		}
	}
}
func TestRecoveryRequiresVerifiedCookie(t *testing.T) {
	for _, cookie := range []*http.Cookie{nil, {Name: "decksupervisor_recovery", Value: "tampered"}} {
		w := recoveryRequest("POST", "/api/auth/recovery/reset", `{"password":"strong-password","confirm_password":"strong-password"}`, cookie, "192.0.2.65")
		if w.Code != 400 || !strings.Contains(w.Body.String(), "invalid, expired") {
			t.Fatalf("unverified %d %s", w.Code, w.Body)
		}
	}
}

func TestRecoveryUnavailableForMissingOrUnsafeConfiguration(t *testing.T) {
	recoveryConfig(t, func(w http.ResponseWriter, r *http.Request) {
		t.Error("provider must not receive misconfigured requests")
	})
	for i, redirect := range []string{"", "http://example.invalid/reset-password", "https://example.invalid/reset-password?other=1", "https://example.invalid/another-route"} {
		t.Setenv("SUPABASE_RECOVERY_REDIRECT_URL", redirect)
		w := recoveryRequest("POST", "/api/auth/recovery/request", fmt.Sprintf(`{"email":"config-%d-%d@example.invalid"}`, recoveryTestRun.Load(), i), nil, redirect)
		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("unsafe redirect returned %d", w.Code)
		}
	}
	t.Setenv("SUPABASE_RECOVERY_REDIRECT_URL", "https://example.invalid/reset-password")
	t.Setenv("AUTH_RECOVERY_KEY", "")
	w := recoveryRequest("POST", "/api/auth/recovery/verify", `{"token_hash":"valid-hash"}`, nil, "missing-key")
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("missing key returned %d", w.Code)
	}
}
