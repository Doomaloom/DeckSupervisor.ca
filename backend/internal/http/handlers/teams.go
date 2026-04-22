package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	supabasesvc "cob-aquatics/internal/services/supabase"
	"github.com/gorilla/mux"
)

func OwnedTeams(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	query := url.Values{}
	query.Set("owner_id", "eq."+client.User.ID)
	query.Set("select", "id,name,available_locations")
	query.Set("order", "created_at.asc")
	var rows []teamRow
	if err := client.Get(r.Context(), "/rest/v1/teams", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"teams": rows})
}

func MemberTeams(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	query := url.Values{}
	query.Set("user_id", "eq."+client.User.ID)
	query.Set("select", "team_id,teams(id,name,available_locations)")
	var rows []map[string]any
	if err := client.Get(r.Context(), "/rest/v1/team_members", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"teams": rows})
}

func TeamDetails(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	teamID := mux.Vars(r)["id"]
	invitesQuery := url.Values{}
	invitesQuery.Set("team_id", "eq."+teamID)
	invitesQuery.Set("status", "eq.pending")
	invitesQuery.Set("select", "id,invitee_id,status,profiles(first_name,last_name,email)")
	membersQuery := url.Values{}
	membersQuery.Set("team_id", "eq."+teamID)
	membersQuery.Set("select", "user_id,role,profiles(first_name,last_name,email)")
	var invites []map[string]any
	var members []map[string]any
	if err := client.Get(r.Context(), "/rest/v1/team_invites", invitesQuery, &invites); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := client.Get(r.Context(), "/rest/v1/team_members", membersQuery, &members); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"invites": invites, "members": members})
}

func TeamMembers(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	teamID := mux.Vars(r)["id"]
	query := url.Values{}
	query.Set("team_id", "eq."+teamID)
	query.Set("select", "user_id,role,profiles(first_name,last_name,email)")
	var rows []map[string]any
	if err := client.Get(r.Context(), "/rest/v1/team_members", query, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"members": rows})
}

func CreateTeam(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	payload["owner_id"] = client.User.ID
	var rows []teamRow
	if err := client.Post(r.Context(), "/rest/v1/teams", nil, payload, "return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(rows) == 0 {
		http.Error(w, "Failed to create team", http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"team": rows[0]})
}

func UpdateTeam(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	teamID := mux.Vars(r)["id"]
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	query := url.Values{}
	query.Set("id", "eq."+teamID)
	var rows []teamRow
	if err := client.Patch(r.Context(), "/rest/v1/teams", query, payload, "return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"team": rows})
}

func SearchInvitableProfiles(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	teamID := mux.Vars(r)["id"]
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	var rows []map[string]any
	if err := client.RPC(r.Context(), "search_invitable_part_time_profiles", map[string]any{
		"p_team_id": teamID,
		"p_query":   query,
		"p_limit":   25,
	}, &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"results": rows})
}

func CreateTeamInvite(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	teamID := mux.Vars(r)["id"]
	var payload struct {
		InviteeID string `json:"invitee_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	body := map[string]any{"team_id": teamID, "invitee_id": payload.InviteeID, "status": "pending"}
	var rows []map[string]any
	if err := client.Post(r.Context(), "/rest/v1/team_invites", nil, body, "return=representation", &rows); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"invite": firstMap(rows)})
}

func AcceptTeamInvite(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	inviteID := mux.Vars(r)["id"]
	var out any
	if err := client.RPC(r.Context(), "accept_team_invite", map[string]any{"invite_id": inviteID}, &out); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func DeclineTeamInvite(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	inviteID := mux.Vars(r)["id"]
	var out any
	if err := client.RPC(r.Context(), "decline_team_invite", map[string]any{"invite_id": inviteID}, &out); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func RevokeTeamInvite(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	inviteID := mux.Vars(r)["id"]
	var out any
	if err := client.RPC(r.Context(), "revoke_team_invite", map[string]any{"invite_id": inviteID}, &out); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func RemoveTeamMember(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	teamID := mux.Vars(r)["id"]
	userID := mux.Vars(r)["userId"]
	query := url.Values{}
	query.Set("team_id", "eq."+teamID)
	query.Set("user_id", "eq."+userID)
	if err := client.Delete(r.Context(), "/rest/v1/team_members", query, "", nil); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func LeaveTeam(w http.ResponseWriter, r *http.Request) {
	client, err := supabasesvc.NewClientFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	teamID := mux.Vars(r)["id"]
	var out any
	if err := client.RPC(r.Context(), "leave_team", map[string]any{"p_team_id": teamID}, &out); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
