# Part-time permissions QA — September 20, 2026

**Permission checks pass with the application fixes. The entire workflow is not defect-free:** two previously reported client/import defects remain, described below. No policy changes were needed in `supabase_rls_reset.sql`.

## Scope and fixes

Tested the uncommitted RLS replacement in temporary PostgreSQL and the local Go API/production frontend build against the configured Supabase project. Hosted testing used four disposable accounts (part-time owner, coverage recipient, unrelated part-time user, and full-time supervisor), one synthetic team, three sessions, and the repository's `all-attendance-levels-one-instructor.csv` fixture. Browser checks used isolated Chromium at 1440×1000. The in-app browser was unavailable, so the run used local Playwright.

- **Reports lacked the signed-in identity.** The frontend's direct Supabase queries did not share the backend's HTTP-only authentication cookies. Notes/report reads and report mutations now use authenticated backend endpoints. The backend forwards the caller's token to Supabase, preserving RLS for session and team/term scopes, including author metadata.
- **The configured service-role variable contained a publishable key.** Server-only client creation now selects a service-role JWT or secret key from `SUPABASE_SERVICE_ROLE_KEY`, with the existing `SUPABASE_SERVICE_KEY` name as fallback. This repairs session creation and custom-roster operations in the tested configuration without changing their authorization checks.
- **Denied mutations looked successful.** Note/report handlers require an affected row and return an error for zero-row writes/deletes. Note/todo UI changes wait for server success, author/owner controls match permissions, and failed report autosaves retain the draft and prevent report selection/creation from discarding it.

No hosted SQL migration or application deployment was performed. The existing RLS replacement was left unchanged.

## Verified behavior

| Area | Result |
| --- | --- |
| Account and team | Part-time sign-in, profile save, accepted invitation, membership, and teammate directory pass. |
| Sessions | Personal and team session creation, owner read, and edits pass through the authenticated API. Browser CSV import creates/loads the synthetic session. |
| Schematics | Initial and repeated saves persist; browser instructor assignment and save pass. |
| Rosters | Class/student override writes and reads pass. Browser class override survives reload after the session permission lookup completes. Custom-roster create, repeated save, resolve, and delete pass through the API. |
| Notes and todos | Browser create/reload and todo completion/reload pass. Regression tests verify failed delete/update retains the displayed row/state and shows an error. |
| Reports | Browser create, autosave, reload, PDF export, and delete pass. Supervisor team/term reads pass. Failed autosave preserves the draft in the frontend regression test. |
| Report cards | Authenticated initial synchronization and replacement totals pass. The part-time overview renders in the browser. |
| Coverage | Today's share grants access. Read-only coverage cannot edit rosters; editable coverage can. Coverage can contribute its own report but cannot modify the owner's todo. Yesterday's/tomorrow's shares deny access and prevent author deletion. |
| Isolation | Unrelated account cannot read the session/reports, mutate notes/reports, or create a session in the test team. Anonymous route/database operations are denied. |
| Printing/export | Individual attendance view, instructor packet containing 23 classes, masterlist PDF preview, schematic PDF preview, report PDF, and device JSON export pass. Device export contains 23 classes after assigning an actual skill level to the private class. Physical printing was not tested. |

The hosted API run passed all nine scenario groups. The browser runs passed 18 checks; the additional same-weekday switching check failed as described below. Generated files and runner output are retained locally under `/tmp/cob-permissions-fix/`; credentials are not included in this report.

## Remaining defects outside RLS

These reproduce findings already recorded in [the September 6 QA report](../../docs/qa/2026-09-06/report.md).

1. **Same-weekday switching retains another session's roster (QA-01).** Import the 23-class fixture into Monday Fall 2026 at Test Pool. Select the separately created Monday session at QA Pool, then open Rosters and reload. All 23 previous-session cards remain. The authenticated session lookup correctly identifies the newly selected session and owner; the stale rows come from weekday-based browser storage. This remains a data-integrity risk and is not fixed by granting additional database access.
2. **CSV dates collapse to the first occurrence (QA-04).** The fixture specifies September 14–December 7, 2026, but Manage Session shows September 14 for both dates. The browser device export consequently starts with that one-day schedule; successful download does not verify that the inferred term dates are correct.

The previously reported bulk-print consistency, guest import, date validation, and mobile defects were not requalified by this permissions pass. Session Planning with activity-summary input and physical printer output are also outside this run's coverage.

## Automated validation

- `bash scripts/test-rls.sh` from the repository root: passes, including 117 regression assertions, repeated installation/row preservation, and transaction rollback verification. `tests/rls_part_time_workflow.sql` adds application-shaped payloads, repeated saves, `RETURNING`, report-card replacement, and cleanup/cascade assertions.
- `go test ./...` from `backend`: all packages pass, including new authenticated route and service-key selection tests.
- `npm run test:run` from `frontend`: 46 files, 160 tests pass.
- `npm run build` from `frontend`: passes, with existing bundle-size warnings.
- `tsc --noEmit --pretty false`: still fails on pre-existing diagnostics. The captured baseline has 66 diagnostics; the final tree has 59, with no new diagnostic messages after normalizing line numbers. This is not a clean TypeScript gate.
- Staged and unstaged `git diff --check`: pass.

## Cleanup

Cleanup completed: all three synthetic sessions, their child records, report-card rows, the team, and all four auth accounts were removed. Follow-up reads verified account deletion and zero QA rows in 11 application tables. Temporary account passwords were removed from the private QA state. Existing user records were not targeted.
