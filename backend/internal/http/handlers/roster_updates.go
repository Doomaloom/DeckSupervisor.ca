package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"

	"cob-aquatics/internal/services/rosterupdates"
	supabasesvc "cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

func rosterUpdatesError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	var apiErr *supabasesvc.APIError
	if errors.As(err, &apiErr) && (apiErr.StatusCode == 400 || apiErr.StatusCode == 401 || apiErr.StatusCode == 403) {
		status = apiErr.StatusCode
	}
	http.Error(w, "Unable to update roster print tracking: "+err.Error(), status)
}

// All operations use the caller's token. The RPCs enforce session permissions.
func SyncRosterClassHashes(w http.ResponseWriter, r *http.Request) {
	c, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	var body struct {
		Classes []rosterupdates.Class `json:"classes"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<20)).Decode(&body) != nil || body.Classes == nil {
		http.Error(w, "Expected an array of classes", 400)
		return
	}
	hashes, err := rosterupdates.HashClasses(body.Classes)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	var rows []rosterupdates.ClassHash
	err = c.RPC(r.Context(), "sync_roster_class_hashes", map[string]any{
		"p_session": mux.Vars(r)["sessionId"], "p_classes": hashes, "p_empty_hash": rosterupdates.HashStudents(nil),
	}, &rows)
	if err != nil {
		rosterUpdatesError(w, err)
		return
	}
	if rows == nil {
		rows = []rosterupdates.ClassHash{}
	}
	writeJSON(w, map[string]any{"classes": rows})
}

func GetRosterPrintUpdates(w http.ResponseWriter, r *http.Request) {
	c, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	sessionID := mux.Vars(r)["sessionId"]
	var allowed bool
	if err = c.RPC(r.Context(), "can_read_session", map[string]any{"p_session_id": sessionID, "p_uid": c.User.ID}, &allowed); err != nil {
		rosterUpdatesError(w, err)
		return
	}
	if !allowed {
		http.Error(w, "Forbidden", 403)
		return
	}
	var rows []map[string]any
	err = c.Get(r.Context(), "/rest/v1/roster_print_updates", url.Values{
		"session_id": {"eq." + sessionID}, "select": {"code,roster_hash,revision,changed_at"}, "order": {"changed_at,code"},
	}, &rows)
	if err != nil {
		rosterUpdatesError(w, err)
		return
	}
	if rows == nil {
		rows = []map[string]any{}
	}
	writeJSON(w, map[string]any{"updates": rows})
}

func ResolveRosterPrintUpdates(w http.ResponseWriter, r *http.Request) {
	c, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", 401)
		return
	}
	var body struct {
		Updates []struct {
			Code     string `json:"code"`
			Revision string `json:"revision"`
		} `json:"updates"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body) != nil || len(body.Updates) == 0 {
		http.Error(w, "Select updates to resolve", 400)
		return
	}
	var removed []string
	err = c.RPC(r.Context(), "resolve_roster_print_updates", map[string]any{"p_session": mux.Vars(r)["sessionId"], "p_updates": body.Updates}, &removed)
	if err != nil {
		rosterUpdatesError(w, err)
		return
	}
	if removed == nil {
		removed = []string{}
	}
	writeJSON(w, map[string]any{"removed": removed})
}
