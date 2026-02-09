# User Workflows

This document defines user workflows and storage rules for DeckSupervisor.

## Shared Concepts
- **Session**: A lesson block configuration created on the dashboard. Sessions include day, season, start/end dates, instructors, team, and a work location.
- **Schematic**: The schedule layout for a session. One schematic per session.
- **Team**: A set of users managed by a full-time team lead.
- **Account Types**: Part-time (default) and full-time (manually promoted in DB).

## Part-time User Workflow

**Home / Dashboard**
- Create new sessions.
- Select existing sessions.

**Manage Sessions**
- Edit session details (day, season, start/end dates, instructors).
- If the user is on multiple teams, they must choose the team for the session.
- If the user is on one team, the team is auto-selected.
- Work location is selected from a dropdown of the team’s available locations.
- Sessions are stored in the database.
- If a user needs two days, they create separate sessions per day.

**Schematic**
- Create/edit the schematic for a session.
- Schematic is stored in the database and linked to the session.

**Rosters**
- View class rosters.
- Assign levels.
- Create custom rosters.

**Print**
- Print all lesson-block materials.

**Report Cards**
- View report card stats for the current session.

**Notes**
- Notes page as-is.
- Notes are stored in the database per session.
- Sessions are private to the creator unless shared for a calendar date.

**Team**
- View your team and teammates.
- Share your session for a day when covered by another staff member.
  - Cover staff can view all session data for that day.
  - Schematic is view-only for cover staff.
  - Roster level edits are locked unless explicitly unlocked by the sharer.

**Account**
- Set first/last name.
- (Optional display) Default work location; actual location is selected per session.

## Full-time User Workflow

**Team**
- Create and manage teams.
- Define and edit available locations for each team.
- Invite part-time users by name.
- Remove team members.
- Full-time users can belong to multiple teams.

**Schematic**
- View schematics for sessions created by team members.
- Schematics are view-only from the team view.

**Report Cards**
- View report card stats for the whole team.

**Full Timer Tools**
- Access full-timer utilities.

**Account**
- Standard account settings.

## Guest Workflow

Guest users can use the app exactly as it works now:
- No sign-in required.
- Local data only (per browser).
- All existing features remain available.

## Data Storage Map (DB vs Local)

**Stored in Supabase (DB)**
- Auth users (Supabase Auth)
- Profiles (`profiles`): first/last name, account type, email, default work location
- Teams (`teams`): name, owner_id
- Team locations (`teams.available_locations`): editable list of available locations
- Team membership (`team_members`)
- Invites (`team_invites`)
- Sessions (`sessions`): day, season, start/end, instructors, team_id, location
- Schematics (`schematics`): one per session, linked by `session_id`
- Session sharing (`session_shares`): session_id, share_date, shared_by, shared_with, permissions
- Notes (`session_notes`): notes stored per session
- Custom rosters (`custom_rosters`): roster metadata + hashed student names only
- Roster level edits
  - Roster-level: code + level
  - Student-level overrides: code + level + student_name_hash

**Stored locally (per user scope)**
- Raw roster student data (PII)
- Local cache of roster-level edits (optional)
- UI state and view preferences

**Guest**
- All data remains local in the guest namespace.

## Schema Notes (High Level)

**Sessions**
- Fields: `id`, `team_id`, `created_by`, `session_day`, `session_season`, `start_date`, `end_date`, `location`, `instructors` (jsonb), `created_at`

**Teams**
- Fields: `id`, `owner_id`, `name`, `available_locations` (text[])

**Schematics**
- Fields: `id`, `session_id`, `data` (jsonb), `created_by`, `created_at`, `updated_at`

**Session Shares**
- Fields: `id`, `session_id`, `share_date`, `shared_by`, `shared_with`, `allow_roster_edits`, `created_at`

**Roster Level Edits**
- Roster-level: `session_id`, `code`, `level`
- Student-level overrides: `session_id`, `code`, `level`, `student_name_hash`

**Notes**
- Fields: `id`, `session_id`, `created_by`, `type`, `text`, `created_at`
