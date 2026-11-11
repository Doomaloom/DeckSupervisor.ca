package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

// Never return/log database exception text: input may contain rejected PII.
func resultError(w http.ResponseWriter, err error) {
	var api *supabase.APIError
	if errors.As(err, &api) && api.StatusCode == 401 {
		http.Error(w, "Unauthorized", 401)
		return
	}
	http.Error(w, "Request not authorized or invalid", 403)
}
func resultClient(w http.ResponseWriter, r *http.Request, device bool) *supabase.Client {
	var c *supabase.Client
	var err error
	if device {
		c, err = supabase.NewServiceClientFromEnv()
	} else {
		c, err = supabase.NewClientFromRequest(r)
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
			receipt, _ = json.Marshal(map[string]any{"operationId": id.OperationID, "status": "rejected", "revision": 0, "reason": "unauthorized_or_invalid"})
		}
		receipts = append(receipts, receipt)
	}
	writeDeviceShareJSON(w, 200, map[string]any{"schemaVersion": 1, "receipts": receipts})
}
