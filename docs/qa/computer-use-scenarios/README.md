# Computer-use QA: supervisors and instructors

This directory is a UI-driven QA playbook, not evidence that tests have passed. It targets a provided test site. Full-time accounts, team administration, requests/full-timer tools, and integrations requiring full-time users are excluded. Guest use, part-time coverage, and supervisor-to-instructor links are included. Instructor Attendance is currently a placeholder.

## Handoff to the runner

Supply these values privately before execution:

| Input | Required value |
| --- | --- |
| BASE_URL | Exact test-site origin and expected build/version |
| RUN_ID | Unique tag, for example `20261008-qa01` |
| SUPERVISOR_A / SUPERVISOR_B | Two disposable part-time accounts with supervisor capability |
| INSTRUCTOR_A / INSTRUCTOR_B | Two disposable part-time accounts with instructor-view capability; no full-time account |
| INSTRUCTOR_UNLINKED | An unlinked instructor account, or INSTRUCTOR_B before linking |
| RECOVERY_ACCOUNT | Optional separate disposable account, mailbox access, replacement password, and email delivery window |
| Coverage team | Existing shared team for the two supervisors; only coverage needs this |
| Files | Absolute local path to this directory’s `fixtures/` and a writable evidence/download directory |
| Browser tools | Visible interaction, file picker upload, download handling, PDF viewer, separate authenticated profiles, and optional offline toggle |

Credentials are provided at execution time; do not put passwords, auth tokens, recovery links, or active share codes in committed results. Instructor capability is not a request to create a new account type. Verify supplied accounts can open the intended workflow before proceeding.

## How to execute

1. Read [setup.md](setup.md), populate a private run manifest, and choose one scenario. Perform missing setup through the UI or record BLOCKED. Never use a full-time account to repair prerequisites.
2. Append each route in backticks to BASE_URL. Replace RUN_ID in entered text. Locate controls by visible label and nearby context, not coordinates remembered from screenshots.
3. Use computer interaction only: clicks, typing, scrolling, dragging, native file dialogs, browser navigation, and visible PDF inspection. Do not use shell commands, browser-console JavaScript, hidden state, direct APIs, database changes, or automation that bypasses the UI to make a case pass.
4. Default viewport: 1440 × 1000 at 100% zoom. Wait until loading/processing settles, up to 30 seconds; allow up to 60 seconds for initial loading/PDF generation. If still waiting, capture it and record the timeout. Do not repeatedly submit saves or imports.
5. Lesson plans autosave after editing; there is no required visible Saved badge. Pause two seconds, check for errors, and verify through navigation/reload. A disappearance before persistence is not a pass. Manage Sessions does expose save status; Schematic requires Save Schedule.
6. Scope mutations to supplied disposable accounts and tagged sessions. Use Save as PDF, not a physical printer. Simulate planner call outcomes without placing calls or sending email. Never delete unrelated records or clear all browser storage.
7. Separate browser profiles isolate simultaneous logins; two ordinary tabs share authentication. If the tool cannot provide separate sessions, sequential account switching is acceptable except where simultaneous hosting is required—mark that portion BLOCKED.
8. Screenshots and saved artifacts are evidence. A successful download does not prove its internal schema or identity preservation. Record UI/build mismatches as findings; do not silently substitute different expected behavior.

## Execution order and reset

- Start with access-01/02, guest-01, and in-01 (before account linking). Run recovery last using its separate account.
- Prepare the baseline via setup, ds-02, ds-05, and ds-07. Run ds-01/04 using separate disposable sessions.
- Run supervisor printing/counts/notes/custom-roster cases, then ds-12 linking, in-02/03, and in-04 through in-09 in order.
- Run ds-13 after the saved plan exists, then cross-01/02 after restoring links. Planner, device-sharing, and coverage cases can run independently with their declared prerequisites.
- ds-19 needs a fresh roster-update baseline: run it immediately after first import or use a fresh disposable setup. Restore its roster before count/print cases. Do not run mutating cases concurrently on the same session or lesson week.
- Perform each file’s cleanup. Delete shared baseline sessions only after all dependent cases finish and evidence is captured; unlink test accounts first if those accounts will be reused. Log unresolved cleanup items for the run owner.

P0 covers the critical data/access workflow; P1 covers extended operations and regressions. Missing optional infrastructure blocks only dependent cases, not the whole suite. FAIL means an observed expected/actual mismatch; BLOCKED means the check could not be performed. A case with a blocked mandatory assertion cannot be reported PASS.

## Scenario index

| Scenario file | Priority | Goal |
| --- | --- | --- |
| [access-01-sign-in-and-switch-workflows.md](access-01-sign-in-and-switch-workflows.md) | P0 | Sign in, switch workflows, and sign out |
| [access-02-profile-persistence.md](access-02-profile-persistence.md) | P1 | Edit and restore an account profile |
| [access-03-password-recovery.md](access-03-password-recovery.md) | P1 | Recover a disposable account password |
| [guest-01-local-session-and-isolation.md](guest-01-local-session-and-isolation.md) | P1 | Create a guest session and isolate guest data |
| [ds-01-create-edit-and-validate-session.md](ds-01-create-edit-and-validate-session.md) | P0 | Create, edit, and validate a supervisor session |
| [ds-02-import-rosters-and-reject-invalid-csv.md](ds-02-import-rosters-and-reject-invalid-csv.md) | P0 | Import synthetic rosters and reject malformed CSV |
| [ds-03-same-weekday-session-isolation.md](ds-03-same-weekday-session-isolation.md) | P0 | Keep two Monday sessions distinct |
| [ds-04-delete-disposable-session.md](ds-04-delete-disposable-session.md) | P1 | Delete only the selected disposable session |
| [ds-05-edit-roster-and-swimmer-levels.md](ds-05-edit-roster-and-swimmer-levels.md) | P0 | Persist class levels and individual swimmer overrides |
| [ds-06-custom-roster-lifecycle.md](ds-06-custom-roster-lifecycle.md) | P1 | Combine same-time classes into a custom roster |
| [ds-07-schematic-assign-move-and-save.md](ds-07-schematic-assign-move-and-save.md) | P0 | Assign and move classes on the schematic |
| [ds-08-print-attendance-and-masterlist.md](ds-08-print-attendance-and-masterlist.md) | P0 | Print attendance and format a masterlist |
| [ds-09-print-instructor-packets-and-schematic.md](ds-09-print-instructor-packets-and-schematic.md) | P1 | Print instructor packets and schematic variants |
| [ds-10-report-card-counts.md](ds-10-report-card-counts.md) | P1 | Reconcile report-card counts with roster edits |
| [ds-11-notes-todos-and-reports.md](ds-11-notes-todos-and-reports.md) | P1 | Persist session notes, todos, and reports |
| [ds-12-link-instructor-accounts.md](ds-12-link-instructor-accounts.md) | P0 | Link instructors to their assigned classes |
| [ds-13-rename-unlink-and-reassign-instructor.md](ds-13-rename-unlink-and-reassign-instructor.md) | P0 | Preserve assignment identity across rename and relinking |
| [ds-14-planner-import-and-local-changes.md](ds-14-planner-import-and-local-changes.md) | P1 | Import planner files and persist cancellation planning |
| [ds-15-shared-planner-collaboration.md](ds-15-shared-planner-collaboration.md) | P1 | Collaborate through a shared planner link |
| [ds-16-device-export-dates-and-backups.md](ds-16-device-export-dates-and-backups.md) | P0 | Export instructor classes and restore date/ID backups |
| [ds-17-device-sharing-code-lifecycle.md](ds-17-device-sharing-code-lifecycle.md) | P1 | Start and end temporary device sharing |
| [ds-18-part-time-coverage-permissions.md](ds-18-part-time-coverage-permissions.md) | P0 | Share coverage with read-only and editable roster permissions |
| [in-01-unlinked-home-library-and-attendance.md](in-01-unlinked-home-library-and-attendance.md) | P0 | Use Instructor View without linked classes |
| [in-02-select-sessions-and-follow-deep-links.md](in-02-select-sessions-and-follow-deep-links.md) | P0 | Select sessions and keep instructor context across pages |
| [in-03-class-metadata-and-privacy.md](in-03-class-metadata-and-privacy.md) | P0 | Show only linked class metadata in My Classes |
| [in-04-lesson-plan-autosave-and-row-order.md](in-04-lesson-plan-autosave-and-row-order.md) | P0 | Create and persist a weekly lesson plan |
| [in-05-private-curriculum-and-durations.md](in-05-private-curriculum-and-durations.md) | P1 | Choose private-class curriculum and compare lesson duration |
| [in-06-activity-library-insertion.md](in-06-activity-library-insertion.md) | P1 | Insert library activities alongside custom instructions |
| [in-07-custom-workout-builder.md](in-07-custom-workout-builder.md) | P1 | Build and persist a structured workout |
| [in-08-week-navigation-and-unsaved-recovery.md](in-08-week-navigation-and-unsaved-recovery.md) | P0 | Navigate lesson weeks and protect an unsaved draft |
| [in-09-print-saved-weekly-plans.md](in-09-print-saved-weekly-plans.md) | P0 | Print saved plans and handle weeks without plans |
| [cross-01-account-and-deep-link-isolation.md](cross-01-account-and-deep-link-isolation.md) | P0 | Deny another account’s lesson-plan deep link |
| [cross-02-mobile-navigation-and-editor.md](cross-02-mobile-navigation-and-editor.md) | P1 | Use supervisor and instructor workflows on a narrow screen |
| [ds-19-print-roster-updates.md](ds-19-print-roster-updates.md) | P1 | Track roster changes through print and acknowledgement |

## Run result template

Store results under a separate run/evidence directory, not by overwriting the scenario instructions.

```markdown
# <scenario filename> — <PASS / FAIL / BLOCKED>
- Run ID, date/time/timezone:
- Site/build, browser, viewport:
- Account aliases (no passwords):
- Session labels/IDs, course codes, lesson dates:
- Fixture filenames and prerequisite state:
- Steps executed and actual result for each:
- Failed/blocked step, expected result, actual result:
- Reproduction from the declared starting state:
- Screenshot/download evidence paths:
- Checks not performed and why:
- Cleanup completed / remaining changes:
```

Use explicit status per assertion when a case is partially blocked. A visual check cannot establish backend/RLS enforcement; these scenarios complement the repository’s automated tests.
