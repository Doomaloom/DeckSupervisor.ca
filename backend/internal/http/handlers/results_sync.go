package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	authsvc "cob-aquatics/internal/services/auth"
	"cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

const resultUnavailable = "Results service is unavailable right now. Try again in a moment."

const conflictChanged = "This conflict changed or was already resolved. Reload the page to see the latest."

// resultServerFailure reports upstream failures that are not the caller's fault:
// transport errors, PostgREST 5xx, and 404 (an RPC missing from the schema).
func resultServerFailure(err error) bool {
	var api *supabase.APIError
	return !errors.As(err, &api) || api.StatusCode >= 500 || api.StatusCode == 404
}

// Never return/log database exception text: input may contain rejected PII.
func resultError(w http.ResponseWriter, err error) {
	if resultServerFailure(err) {
		http.Error(w, resultUnavailable, 502)
		return
	}
	var api *supabase.APIError
	errors.As(err, &api)
	switch api.StatusCode {
	case 401:
		http.Error(w, "Unauthorized", 401)
	case 403:
		http.Error(w, "Request not authorized or invalid", 403)
	case 409:
		http.Error(w, "Request conflicts with current results; refresh and try again", 409)
	default:
		http.Error(w, "Invalid request", 400)
	}
}
func resultClient(w http.ResponseWriter, r *http.Request, device bool) *supabase.Client {
	var c *supabase.Client
	var err error
	if device {
		c, err = supabase.NewServiceClientFromEnv()
	} else {
		c, err = supabase.NewClientFromRequest(r)
	}
	if errors.Is(err, authsvc.ErrAuthUnavailable) {
		http.Error(w, resultUnavailable, 502)
		return nil
	}
	if err != nil {
		http.Error(w, "Unauthorized", 401)
		return nil
	}
	return c
}
func resultBody(w http.ResponseWriter, r *http.Request, out any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(out) != nil || d.Decode(&struct{}{}) != io.EOF {
		http.Error(w, "Invalid request body", 400)
		return false
	}
	return true
}
func resultRPC(w http.ResponseWriter, r *http.Request, name string, args map[string]any, device bool) {
	c := resultClient(w, r, device)
	if c == nil {
		return
	}
	var out json.RawMessage
	if err := c.RPC(r.Context(), name, args, &out); err != nil {
		resultError(w, err)
		return
	}
	if string(out) == "null" {
		http.Error(w, "Not found", 404)
		return
	}
	writeDeviceShareJSON(w, 200, out)
}
func ResultsRegistry(w http.ResponseWriter, r *http.Request) {
	args := map[string]any{"p_session": mux.Vars(r)["sessionId"]}
	if r.Method != "GET" {
		var body json.RawMessage
		if !resultBody(w, r, &body, 2<<20) {
			return
		}
		args["p_body"] = body
		args["p_reconcile"] = strings.HasSuffix(r.URL.Path, "/reconcile")
	}
	resultRPC(w, r, "result_registry", args, false)
}
func ResultsAdmin(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	action := "grants"
	body := map[string]any{}
	if strings.HasSuffix(r.URL.Path, "result-classes") {
		action = "classes"
	}
	if r.Method == "DELETE" {
		action = "revoke"
		body["id"] = vars["grantId"]
	}
	if vars["conflictId"] != "" {
		action = "resolve"
		var input struct {
			Choice           string `json:"choice"`
			ExpectedRevision *int   `json:"expectedRevision,omitempty"`
		}
		if !resultBody(w, r, &input, 1024) {
			return
		}
		body["choice"] = input.Choice
		if input.ExpectedRevision != nil {
			body["expectedRevision"] = *input.ExpectedRevision
		}
		body["id"] = vars["conflictId"]
	}
	c := resultClient(w, r, false)
	if c == nil {
		return
	}
	var out json.RawMessage
	if err := c.RPC(r.Context(), "result_admin", map[string]any{"p_session": vars["sessionId"], "p_action": action, "p_body": body}, &out); err != nil {
		// The database raises a plain exception (HTTP 400) when someone else changed or resolved
		// the conflict first. Say so in plain words instead of "Invalid request".
		var api *supabase.APIError
		if action == "resolve" && errors.As(err, &api) && api.StatusCode == 400 && strings.HasPrefix(api.Message, "Conflict changed") {
			http.Error(w, conflictChanged, 409)
			return
		}
		resultError(w, err)
		return
	}
	if action == "revoke" {
		w.WriteHeader(204)
		return
	}
	writeDeviceShareJSON(w, 200, out)
}
func Results(w http.ResponseWriter, r *http.Request) {
	device := strings.HasPrefix(r.URL.Path, "/api/device-results")
	session := mux.Vars(r)["sessionId"]
	token := ""
	if device {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") || len(auth) != 71 {
			http.Error(w, "Unauthorized", 401)
			return
		}
		token = strings.TrimPrefix(auth, "Bearer ")
	}
	args := map[string]any{}
	if session != "" {
		args["p_session"] = session
	}
	if device {
		args["p_token"] = token
	}
	if r.Method == "GET" {
		if cls := r.URL.Query().Get("classId"); cls != "" {
			args["p_class"] = cls
		}
		resultRPC(w, r, "result_snapshot", args, device)
		return
	}
	var body struct {
		SchemaVersion int               `json:"schemaVersion"`
		Operations    []json.RawMessage `json:"operations"`
	}
	if !resultBody(w, r, &body, 2<<20) {
		return
	}
	if body.SchemaVersion != 1 || len(body.Operations) == 0 || len(body.Operations) > 200 {
		http.Error(w, "Invalid operations", 400)
		return
	}
	c := resultClient(w, r, device)
	if c == nil {
		return
	}
	receipts := []json.RawMessage{}
	for _, op := range body.Operations {
		var id struct {
			SessionID   string `json:"sessionId"`
			OperationID string `json:"operationId"`
		}
		_ = json.Unmarshal(op, &id)
		opSession := session
		if device {
			opSession = id.SessionID
		}
		args["p_session"] = opSession
		args["op"] = op
		var receipt json.RawMessage
		// Each RPC is its own transaction; a bad operation cannot roll back its siblings.
		if err := c.RPC(r.Context(), "result_apply", args, &receipt); err != nil {
			// Still per operation, so one failing operation cannot block its siblings; the reason
			// tells an outage apart from a refusal (clients keep rejected operations queued).
			reason := "unauthorized_or_invalid"
			if resultServerFailure(err) {
				reason = "temporarily_unavailable"
			}
			receipt, _ = json.Marshal(map[string]any{"operationId": id.OperationID, "status": "rejected", "revision": 0, "reason": reason})
		}
		receipts = append(receipts, receipt)
	}
	writeDeviceShareJSON(w, 200, map[string]any{"schemaVersion": 1, "receipts": receipts})
}
