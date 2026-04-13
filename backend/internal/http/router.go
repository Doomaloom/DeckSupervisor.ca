package httpapi

import (
	//"net/http"

	"cob-aquatics/internal/http/handlers"
	"github.com/gorilla/mux"
)

func NewRouter() *mux.Router {
	r := mux.NewRouter()

	// Auth and account
	r.HandleFunc("/api/auth/sign-in", handlers.SignIn).Methods("POST")
	r.HandleFunc("/api/auth/sign-up", handlers.SignUp).Methods("POST")
	r.HandleFunc("/api/auth/session", handlers.Session).Methods("GET")
	r.HandleFunc("/api/auth/sign-out", handlers.SignOut).Methods("POST")
	r.HandleFunc("/api/account", handlers.AccountData).Methods("GET")
	r.HandleFunc("/api/profile", handlers.UpdateProfile).Methods("PUT")

	// Teams, memberships, and invites
	r.HandleFunc("/api/teams/current", handlers.CurrentTeams).Methods("GET")
	r.HandleFunc("/api/request-assignments", handlers.GetRequestAssignments).Methods("GET")
	r.HandleFunc("/api/request-assignments", handlers.CreateRequestAssignment).Methods("POST")
	r.HandleFunc("/api/request-assignments/{id}", handlers.UpdateRequestAssignment).Methods("PATCH")
	r.HandleFunc("/api/request-assignments/{id}", handlers.DeleteRequestAssignment).Methods("DELETE")
	r.HandleFunc("/api/teams/owned", handlers.OwnedTeams).Methods("GET")
	r.HandleFunc("/api/teams/member", handlers.MemberTeams).Methods("GET")
	r.HandleFunc("/api/teams", handlers.CreateTeam).Methods("POST")
	r.HandleFunc("/api/teams/{id}", handlers.UpdateTeam).Methods("PATCH")
	r.HandleFunc("/api/teams/{id}/details", handlers.TeamDetails).Methods("GET")
	r.HandleFunc("/api/teams/{id}/members", handlers.TeamMembers).Methods("GET")
	r.HandleFunc("/api/teams/{id}/members/{userId}", handlers.RemoveTeamMember).Methods("DELETE")
	r.HandleFunc("/api/teams/{id}/invitable-profiles", handlers.SearchInvitableProfiles).Methods("GET")
	r.HandleFunc("/api/teams/{id}/invites", handlers.CreateTeamInvite).Methods("POST")
	r.HandleFunc("/api/team-invites/{id}/accept", handlers.AcceptTeamInvite).Methods("POST")
	r.HandleFunc("/api/team-invites/{id}/decline", handlers.DeclineTeamInvite).Methods("POST")
	r.HandleFunc("/api/team-invites/{id}/revoke", handlers.RevokeTeamInvite).Methods("POST")

	// Session sharing and session management
	r.HandleFunc("/api/session-shares", handlers.CreateSessionShare).Methods("POST")
	r.HandleFunc("/api/session-shares/today", handlers.SharedSessionsToday).Methods("GET")
	r.HandleFunc("/api/sessions/mine", handlers.MySessions).Methods("GET")
	r.HandleFunc("/api/sessions", handlers.CreateSession).Methods("POST")
	r.HandleFunc("/api/sessions/current/{id}", handlers.CurrentSession).Methods("GET")
	r.HandleFunc("/api/sessions/{id}", handlers.UpdateSession).Methods("PATCH")
	r.HandleFunc("/api/sessions/{id}", handlers.DeleteSession).Methods("DELETE")
	r.HandleFunc("/api/teams/{id}/sessions", handlers.TeamSessions).Methods("GET")

	// Session notes
	r.HandleFunc("/api/session-notes", handlers.SessionNotes).Methods("GET")
	r.HandleFunc("/api/session-notes", handlers.CreateSessionNote).Methods("POST")
	r.HandleFunc("/api/session-notes/{id}", handlers.UpdateSessionNote).Methods("PATCH")
	r.HandleFunc("/api/session-notes/{id}", handlers.DeleteSessionNote).Methods("DELETE")

	// Report cards and schematics
	r.HandleFunc("/api/report-cards/totals", handlers.ReportCardTotals).Methods("GET")
	r.HandleFunc("/api/report-cards/sync", handlers.SyncReportCards).Methods("POST")
	r.HandleFunc("/api/schematics/{sessionId}", handlers.GetSchematic).Methods("GET")
	r.HandleFunc("/api/schematics/{sessionId}", handlers.UpsertSchematic).Methods("PUT")
	r.HandleFunc("/api/schematics", handlers.GetSchematics).Methods("GET")

	// Roster edits
	r.HandleFunc("/api/roster-edits", handlers.GetRosterEdits).Methods("GET")
	r.HandleFunc("/api/roster-edits/level", handlers.UpsertRosterLevelEdit).Methods("POST")
	r.HandleFunc("/api/roster-edits/student", handlers.UpsertRosterStudentLevelEdit).Methods("POST")

	// CSV import and export flows
	r.HandleFunc("/api/analyzeCSV", handlers.AnalyzeCSV).Methods("POST")
	//	r.HandleFunc("/api/process-csv", handlers.ProcessCSV).Methods("POST")
	//	r.HandleFunc("/api/extract-classes", handlers.ExtractClasses).Methods("POST")
	//	r.HandleFunc("/api/csv/session-candidates", handlers.CSVSessionCandidates).Methods("POST")
	r.HandleFunc("/api/masterlist-rosters", handlers.MasterlistRosters).Methods("POST")

	// PDF generation and document exports
	r.HandleFunc("/api/attendance-pdf", handlers.AttendancePDF).Methods("POST")
	r.HandleFunc("/api/concat-pdfs", handlers.ConcatPDF).Methods("POST")
	r.HandleFunc("/api/blank-pdf", handlers.BlankPDF).Methods("POST")
	r.HandleFunc("/api/schematic-maker", handlers.SchematicMaker).Methods("POST")
	r.HandleFunc("/api/schematic-pdf", handlers.SchematicPDF).Methods("POST")
	r.HandleFunc("/api/session-report-pdf", handlers.SessionReportPDF).Methods("POST")

	// Custom rosters
	r.HandleFunc("/api/custom-rosters", handlers.SaveCustomRoster).Methods("POST")
	r.HandleFunc("/api/custom-rosters/resolve", handlers.ResolveCustomRosters).Methods("POST")
	r.HandleFunc("/api/custom-rosters/{id}", handlers.DeleteCustomRoster).Methods("DELETE")

	// Planner sharing
	r.HandleFunc("/api/planner-shares", handlers.CreatePlannerShare).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}", handlers.GetPlannerShare).Methods("GET")
	r.HandleFunc("/api/planner-shares/{code}/join", handlers.JoinPlannerShare).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/heartbeat", handlers.HeartbeatPlannerShare).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/leave", handlers.LeavePlannerShare).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/close", handlers.ClosePlannerShare).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/class-status", handlers.UpdatePlannerShareClassStatus).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/class-lanes", handlers.UpdatePlannerShareClassLanes).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/class-move", handlers.UpdatePlannerShareClassMove).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/class-metadata", handlers.UpdatePlannerShareClassMetadata).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/call-record", handlers.UpdatePlannerShareCallRecord).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/details", handlers.UpdatePlannerShareDetails).Methods("POST")
	r.HandleFunc("/api/planner-shares/{code}/save-state", handlers.ApplyPlannerShareSaveState).Methods("POST")

	// Health
	//r.HandleFunc("/api/health", handlers.Health).Methods("GET")
	//r.NotFoundHandler = http.NotFoundHandler()
	return r
}
