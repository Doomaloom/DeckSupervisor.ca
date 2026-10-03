package handlers

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/mail"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	authsvc "cob-aquatics/internal/services/auth"
	supabasesvc "cob-aquatics/internal/services/supabase"
)

const recoveryCookie = "decksupervisor_recovery"
const recoveryInvalid = "This recovery link is invalid, expired, or already used. Request another reset email."

type recoveryEnvelope struct {
	Token   string `json:"token"`
	Grant   string `json:"grant"`
	Expires int64  `json:"expires"`
}
type recoveryBudget struct {
	Until time.Time
	Count int
}

var recoveryLimits = struct {
	sync.Mutex
	Rows map[string]recoveryBudget
}{Rows: map[string]recoveryBudget{}}

func recoveryAllowed(r *http.Request, kind, email string) bool {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	now := time.Now()
	recoveryLimits.Lock()
	defer recoveryLimits.Unlock()
	for key, row := range recoveryLimits.Rows {
		if !row.Until.After(now) {
			delete(recoveryLimits.Rows, key)
		}
	}
	keys := []string{kind + ":ip:" + ip}
	limits := []int{10}
	if email != "" {
		keys = append(keys, kind+":email:"+strings.ToLower(email))
		limits = append(limits, 3)
	}
	if len(recoveryLimits.Rows) > 10000 {
		return false
	}
	for i, key := range keys {
		hash := sha256.Sum256([]byte(key))
		stored := hex.EncodeToString(hash[:])
		row := recoveryLimits.Rows[stored]
		if row.Count >= limits[i] {
			return false
		}
	}
	for _, key := range keys {
		hash := sha256.Sum256([]byte(key))
		stored := hex.EncodeToString(hash[:])
		row := recoveryLimits.Rows[stored]
		if row.Count == 0 {
			row.Until = now.Add(15 * time.Minute)
		}
		row.Count++
		recoveryLimits.Rows[stored] = row
	}
	return true
}
func recoveryCipher() (cipher.AEAD, error) {
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(os.Getenv("AUTH_RECOVERY_KEY")))
	if err != nil || len(key) != 32 {
		return nil, errors.New("missing recovery encryption key")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
func sealRecovery(data recoveryEnvelope) (string, error) {
	aead, err := recoveryCipher()
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return "", err
	}
	payload, _ := json.Marshal(data)
	return base64.RawURLEncoding.EncodeToString(aead.Seal(nonce, nonce, payload, []byte(recoveryCookie))), nil
}
func openRecovery(r *http.Request) (recoveryEnvelope, error) {
	var out recoveryEnvelope
	cookie, err := r.Cookie(recoveryCookie)
	if err != nil {
		return out, err
	}
	aead, err := recoveryCipher()
	if err != nil {
		return out, err
	}
	raw, err := base64.RawURLEncoding.DecodeString(cookie.Value)
	if err != nil || len(raw) < aead.NonceSize() {
		return out, errors.New("invalid recovery")
	}
	payload, err := aead.Open(nil, raw[:aead.NonceSize()], raw[aead.NonceSize():], []byte(recoveryCookie))
	if err != nil {
		return out, err
	}
	if json.Unmarshal(payload, &out) != nil || out.Expires <= time.Now().Unix() || out.Token == "" || len(out.Grant) != 64 {
		return out, errors.New("expired recovery")
	}
	return out, nil
}
func setRecoveryCookie(w http.ResponseWriter, r *http.Request, value string, age int) {
	http.SetCookie(w, &http.Cookie{Name: recoveryCookie, Value: value, Path: "/api/auth/recovery", HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https", MaxAge: age})
}
func RequestPasswordRecovery(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	var body struct {
		Email string `json:"email"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body) != nil {
		http.Error(w, "Enter a valid email address.", 400)
		return
	}
	email := strings.TrimSpace(body.Email)
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || len(email) > 254 {
		http.Error(w, "Enter a valid email address.", 400)
		return
	}
	if !recoveryAllowed(r, "request", email) {
		w.Header().Set("Retry-After", "900")
		http.Error(w, "Too many reset requests. Try again later.", 429)
		return
	}
	service, err := authsvc.NewServiceFromEnv()
	if err != nil {
		http.Error(w, "Recovery is temporarily unavailable.", 503)
		return
	}
	if _, err = recoveryCipher(); err != nil {
		http.Error(w, "Recovery is temporarily unavailable.", 503)
		return
	}
	if _, err = authsvc.RecoveryRedirectURL(); err != nil {
		http.Error(w, "Recovery is temporarily unavailable.", 503)
		return
	}
	// Provider responses never reveal account existence. Confirmation is not delivery evidence.
	_ = service.RequestRecovery(r.Context(), email)
	writeJSON(w, map[string]any{"message": "If an account exists for that email, you will receive a password reset link."})
}
func VerifyPasswordRecovery(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if !recoveryAllowed(r, "verify", "") {
		w.Header().Set("Retry-After", "900")
		http.Error(w, "Too many verification attempts. Try again later.", 429)
		return
	}
	var body struct {
		TokenHash string `json:"token_hash"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body) != nil || body.TokenHash == "" || len(body.TokenHash) > 1024 {
		http.Error(w, recoveryInvalid, 400)
		return
	}
	if _, err := recoveryCipher(); err != nil {
		http.Error(w, "Recovery is temporarily unavailable.", 503)
		return
	}
	service, err := authsvc.NewServiceFromEnv()
	if err != nil {
		http.Error(w, "Recovery is temporarily unavailable.", 503)
		return
	}
	session, err := service.VerifyRecovery(r.Context(), body.TokenHash)
	if err != nil {
		setRecoveryCookie(w, r, "", -1)
		http.Error(w, recoveryInvalid, 400)
		return
	}
	random := make([]byte, 32)
	if _, err = rand.Read(random); err != nil {
		http.Error(w, "Recovery is temporarily unavailable.", 503)
		return
	}
	hash := sha256.Sum256(random)
	expires := time.Now().Add(15 * time.Minute).Unix()
	if session.ExpiresAt > 0 && session.ExpiresAt < expires {
		expires = session.ExpiresAt
	}
	data := recoveryEnvelope{Token: session.AccessToken, Grant: hex.EncodeToString(hash[:]), Expires: expires}
	client, err := supabasesvc.NewClientForSession(session)
	if err != nil {
		http.Error(w, "Recovery is temporarily unavailable.", 503)
		return
	}
	if err = client.RPC(r.Context(), "register_recovery_grant", map[string]any{"p_id": data.Grant, "p_expires": time.Unix(expires, 0).UTC().Format(time.RFC3339)}, nil); err != nil {
		http.Error(w, "Recovery is temporarily unavailable. Request another reset email.", 503)
		return
	}
	cookie, err := sealRecovery(data)
	if err != nil {
		http.Error(w, "Recovery is temporarily unavailable.", 503)
		return
	}
	setRecoveryCookie(w, r, cookie, int(expires-time.Now().Unix()))
	writeJSON(w, map[string]any{"verified": true})
}
func recoverySession(r *http.Request) (recoveryEnvelope, *authsvc.Service, *supabasesvc.Client, error) {
	data, err := openRecovery(r)
	if err != nil {
		return data, nil, nil, err
	}
	service, err := authsvc.NewServiceFromEnv()
	if err != nil {
		return data, nil, nil, err
	}
	session, _, err := service.SessionFromCookies(r.Context(), data.Token, "")
	if err != nil {
		return data, nil, nil, err
	}
	client, err := supabasesvc.NewClientForSession(session)
	return data, service, client, err
}
func PasswordRecoveryStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	data, _, client, err := recoverySession(r)
	if err != nil {
		http.Error(w, recoveryInvalid, 400)
		return
	}
	var rows []map[string]any
	err = client.Get(r.Context(), "/rest/v1/password_recovery_grants", url.Values{"id": {"eq." + data.Grant}, "state": {"eq.pending"}, "select": {"id"}}, &rows)
	if err != nil || len(rows) != 1 {
		http.Error(w, recoveryInvalid, 400)
		return
	}
	writeJSON(w, map[string]any{"verified": true})
}
func ResetRecoveredPassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	var body struct {
		Password string `json:"password"`
		Confirm  string `json:"confirm_password"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&body) != nil || body.Password != body.Confirm {
		http.Error(w, "Passwords must match.", 400)
		return
	}
	if utf8.RuneCountInString(body.Password) < 6 || len(body.Password) > 1024 {
		http.Error(w, "Use at least six characters and meet your account's password requirements.", 400)
		return
	}
	if !recoveryAllowed(r, "reset", "") {
		w.Header().Set("Retry-After", "900")
		http.Error(w, "Too many reset attempts. Try again later.", 429)
		return
	}
	data, service, client, err := recoverySession(r)
	if err != nil {
		http.Error(w, recoveryInvalid, 400)
		return
	}
	var claimed bool
	if err = client.RPC(r.Context(), "claim_recovery_grant", map[string]any{"p_id": data.Grant}, &claimed); err != nil || !claimed {
		http.Error(w, recoveryInvalid, 400)
		return
	}
	if err = service.UpdateRecoveredPassword(r.Context(), data.Token, body.Password); err != nil {
		_ = client.RPC(r.Context(), "finish_recovery_grant", map[string]any{"p_id": data.Grant, "p_success": false}, nil)
		http.Error(w, "Password rejected by your account's policy. Choose a stronger password and try again.", 400)
		return
	}
	// A failed ledger finalization leaves the grant claimed, which also prevents replay.
	_ = client.RPC(r.Context(), "finish_recovery_grant", map[string]any{"p_id": data.Grant, "p_success": true}, nil)
	_ = service.SignOut(r.Context(), data.Token)
	setRecoveryCookie(w, r, "", -1)
	authsvc.ClearSessionCookies(w, r)
	writeJSON(w, map[string]any{"message": "Password reset. Sign in with your new password."})
}
