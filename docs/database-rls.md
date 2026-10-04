# Database RLS replacement

Use [`backend/supabase_rls_reset.sql`](../backend/supabase_rls_reset.sql) as the single policy installation/update script. It supersedes the three historical RLS/invite scripts; do not run those afterward. It covers all 14 application tables defined in this repository. The script does not provision missing tables, change application records, or touch policies on other tables or Supabase-managed schemas.

## Apply

1. Confirm the existing database has the current application schema. For a **new, empty database**, apply `backend/supabase_tables.sql` followed by `backend/supabase_tables_update.sql` first. The existing schema reconciliation/update scripts contain data updates and deduplication; they are not prerequisites to rerun on an already current database.
2. Review the permission matrix below, including the deliberately preserved global scope of request assignments. The replacement removes **every existing policy on the 14 named tables**, including policies added manually in Supabase.
3. Open Supabase **SQL Editor**, select the `postgres` role, paste the **entire** contents of `backend/supabase_rls_reset.sql`, and run once. All replacement changes are in one transaction. A SQL error or the 5-second lock timeout rolls them back; correct the issue and rerun the entire file. In clients that retain a failed transaction, run `ROLLBACK` first.
4. The final result should list 14 tables with `rls_enabled = true` and policy counts of 3 for profiles/teams/team_members, 2 for team_invites, and 4 for the other tables. The `app_private` schema must remain outside Supabase's exposed API schemas (the standard configuration already excludes it).

After application, check sign-in/profile loading, team invitations, coverage recipient selection, session/schematic saves, roster overrides, and report creation through the app. Local tests use the repository schema; they cannot establish whether a hosted database has additional custom policies, views, triggers, columns, or role grants. This work has not applied SQL to a hosted project.

## Permissions

The default is the app's existing ownership/team/coverage model, with the specific repairs below.

| Data | Read | Write |
| --- | --- | --- |
| Profiles | Self, teammates, related team owners; pending invite owner/invitee relationship | Self; new profiles are part-time; account type changes require an administrative/service-role operation |
| Teams | Owner, members, pending invitees | Full-time users create their own teams; owner updates; no client deletion |
| Team members | Team owner and members, including the teammate directory used for coverage | Team owner adds/removes; invitation acceptance adds the invitee |
| Team invites | Invitee and team owner | Owner creates pending invites; authorized RPCs accept, decline, or revoke |
| Sessions | Creator, today's coverage recipients, full-time members/owner of that team | Creator only; creation in a team requires membership or ownership |
| Schematics / custom rosters | Anyone who can read the session | Session creator only |
| Class/student level overrides | Anyone who can read the session | Session creator, or today's coverage recipient with roster edit permission |
| Session notes / reports | Anyone who can read the session | Readers create their own entries; authors and session creators edit/delete while session access remains active |
| Session shares | Recipient and session creator | Session creator only |
| Report card totals | Author and team members/owner | Author only; assigning a team requires membership or ownership |
| Request assignments | All signed-in users | All full-time users; this table has no team key |

Coverage validity uses the calendar date in `America/Toronto`, including daylight saving time. Yesterday's and tomorrow's shares do not grant access today. A coverage share permits note/report contributions even without roster edit permission, matching the existing app. Share recipients are not newly restricted to teammates at the database level; the UI selects teammates. Introducing that restriction would change the existing model.

## Repairs and compatibility

- The historical update omitted teams/team_members and renamed `can_read_profile` parameters from `profile_id, uid` to `p_profile_id, p_uid`, which PostgreSQL does not allow through `CREATE OR REPLACE`. The replacement uses new private helpers and does not recreate that legacy signature.
- Every policy on each named application table is replaced, so an old permissive policy cannot remain active under a different name. Anonymous/PUBLIC table and column grants are removed; authenticated roles receive only the supported table operations, with RLS controlling the rows.
- Policy helpers take the authenticated identity from `auth.uid()` and have fixed search paths. Unused legacy public helpers lose client execution privileges. The custom-roster backend's public `can_read_session(p_session_id, p_uid)` and `can_edit_session(p_session_id, p_uid)` RPCs remain available and reject another user's ID.
- Invite RPCs explicitly reject missing identities, revoke execution from `PUBLIC` as well as `anon`, and lock a pending invitation before changing it. This closes the old NULL-comparison authentication gap and serializes competing accept/decline/revoke operations. RPC names and parameters stay compatible with the backend.
- Members can read the teammate directory required by the coverage picker. Pending invitees can also read the inviting team's owner profile.
- Update triggers prevent clients from transferring record identities, creators, and parent-session references. Session owners may change a session's team to one they belong to, or make it personal. Roster upserts retain the backend's existing behavior of recording the last editor in `created_by`.
- A note/report author cannot continue writing or deleting after their session access expires. Share management always requires current session ownership.

The backend currently creates sessions using a service-role client after doing its own membership checks. Service roles bypass RLS; this script preserves that path, so those backend authorization checks still matter. This is not an audit of additional hosted views/RPCs or nonstandard database roles.

## Local verification

With PostgreSQL tools installed, run from the repository root:

```bash
bash scripts/test-rls.sh
```

The runner creates a temporary PostgreSQL cluster under `/tmp`, listens only on a private Unix socket, loads the repository schema and old base policies, and installs the replacement twice. It tests row preservation, all-table anonymous denial, owner/member/outsider/full-time access, current/expired/future coverage, upserts, immutable security fields, profile promotion, invite authorization, and service-role compatibility. A deliberately injected policy-creation failure verifies transaction rollback restores policies and table grants. The server stops on exit; the temporary database and logs are retained at the printed path for inspection. No hosted credentials are used. Do not run the test fixture SQL against a real project.

## Application authentication and part-time QA

The app signs in through the Go backend and stores its session in HTTP-only cookies. Staff notes and reports use `/api/session-notes` and `/api/session-reports`; those handlers forward the caller's access token to Supabase. Direct browser Supabase requests without that identity are anonymous and are intentionally denied. Team/term filtering and author/session metadata are also queried using the caller's token. A zero-row note/report mutation is an error, not a successful save/delete.

Session creation and custom-roster server operations retain their existing authorization checks and service-client behavior. Their service credential must be a service-role JWT or a Supabase secret key. The backend selects a valid key kind from `SUPABASE_SERVICE_ROLE_KEY`, then the legacy `SUPABASE_SERVICE_KEY`; publishable/anon keys are never accepted as service credentials. Keep these variables server-side.

The [September 20 part-time QA report](../backend/tests/part_time_qa.md) records local policy tests, hosted API checks, browser results, cleanup, and remaining unrelated workflow defects. The tested permission failures were repaired in application authentication/configuration; `supabase_rls_reset.sql` did not require further changes. The regression suite now includes application payloads and repeated writes in `backend/tests/rls_part_time_workflow.sql`.


References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html), [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html).

## Instructor account search

After the base schema and `supabase_rls_reset.sql` are installed, apply the entire
`backend/supabase_instructor.sql` in the SQL Editor as `postgres`. For existing
instructor installations, rerun that file before deploying the updated API and
frontend. It is transactional and repeatable and preserves saved links and plans.
The update adds session-owner account search, linked-account display, and validation
that new links target part-time accounts. Existing full-time links remain readable
and can be unlinked. No team membership or invitation is created by linking.

Instructor account links are managed on **Manage Sessions**. Save the schematic
first to publish its columns, then refresh saved columns and search staff by name
or email. Account links save independently of the session details form.
