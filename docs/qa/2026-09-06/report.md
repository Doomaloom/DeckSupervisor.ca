# DeckSupervisor browser QA report

**Result: six confirmed defects, including three high-priority workflow/data issues.** Full-time testing was blocked by rejected credentials. This is a findings report; application code was not changed.

Tested September 5–6, 2026 on the existing working tree at commit `ee43f6c`, including its pre-existing uncommitted changes. The frontend ran at `http://127.0.0.1:3000` against the local Go API and the configured Supabase environment. Chromium was controlled through Playwright with isolated browser profiles. Desktop testing used 1440×1000; the mobile layout check used 390×844. This was browser automation and screenshot inspection, not native desktop or physical-printer testing.

Inputs: the supplied mixed normal/mini-session CSV and `frontend/test-fixtures/csv/all-attendance-levels-one-instructor.csv`. Credentials are omitted. Student names are masked in the mixed-session evidence; the PDF examples use the repository's synthetic fixture.

## Confirmed defects

### QA-01 — High: switching sessions shows another session's rosters

**Reproduce:** Sign in as part-time. Import the all-levels fixture into Monday Fall 2026. Import the mixed CSV into Monday Summer 2026, then its Mini Session 1. From Home → Select Existing Session, select Monday Fall 2026 and open Rosters. Reload the page.

**Expected:** The selected Fall session's 23 classes and 23 roster rows, or a clear requirement to reload its CSV.

**Actual:** The sidebar identifies Monday Fall 2026, 7:00 AM–6:30 PM, but Rosters shows the Summer Monday data: 33 classes, 157 roster rows, beginning with course `473209` at 4:00 PM. Reloading does not correct the mismatch. This can cause staff to work on the wrong lesson block.

**Evidence:** [Wrong-session rosters, student names masked](evidence/wrong-session-rosters.png). Device Exports correctly detects this same mismatch and blocks export: [existing guard](evidence/device-export-session-guard.png).

**Code pointer / repair direction:** `frontend/src/features/rosters/hooks/useRosterData.ts:60` loads rows by weekday, without validating their session provenance. Restore the selected session's dataset or enforce the existing loaded-roster session guard across roster consumers. Verify two sessions on the same weekday in different terms, including reloads and downstream print/report actions.

### QA-02 — High: guest CSV import fails and retries create duplicate empty sessions

**Reproduce:** In a fresh guest browser, upload the mixed CSV through Upload CSV and Choose Session. Select the normal Monday candidate or Mini Session 1. Retry the same candidate, then close the dialog and open Select Existing Session.

**Expected:** A session with loaded classes, or a failure that leaves no new empty records.

**Actual:** Candidate detection succeeds, but selection displays “Failed to process CSV.” `POST /api/process-csv` returns 404. The app has already created and selected an empty guest session. Two clicks produced two local sessions; the modal continues to advertise “CREATE NEW SESSION.” Schematic remains empty.

**Evidence:** [Normal session failure](evidence/guest-normal-created.png), [mini-session failure](evidence/guest-mini-failed.png), [duplicate sessions](evidence/guest-duplicate-sessions.png).

**Code pointer / repair direction:** `backend/internal/http/router.go:66` does not register `/api/process-csv`, although its handler still exists and `frontend/src/lib/api.ts:43` calls it. `frontend/src/app/CsvImportFlowContext.tsx:302` creates the session before processing succeeds. Restore a supported import path and make failed import/retry behavior avoid orphaned sessions.

### QA-03 — High: bulk attendance can ignore a saved class-level change

**Reproduce:** Import the all-levels fixture under the part-time account, add an instructor, assign the schematic column, and save. Change course `90001` from Little Splash 1 to Little Splash 2 in Rosters. Confirm the saved change after reload. In Manage Session, edit the end date and save. Go directly to Print → Print Instructor Sheets → Print all as one. Compare with printing that class from Rosters after its saved edits load.

**Expected:** Both print paths use the saved Little Splash 2 level and matching assessment sheet.

**Actual:** The bulk packet uses Little Splash 1; the individual roster print uses Little Splash 2. The different templates contain different assessment criteria.

**Evidence:** [Saved roster level](evidence/edited-roster.png), [individual print: Little Splash 2](evidence/edited-attendance-page1.png), [bulk print: Little Splash 1](evidence/attendance-page1.png). Full documents: [individual PDF](evidence/edited-single-attendance.pdf) and [bulk packet](evidence/all-levels-attendance.pdf).

**Code pointer / repair direction:** `frontend/src/features/print/PrintPage.tsx:686` builds attendance groups from day storage. Manage Session reconciliation can refill that storage from the imported dataset; the roster page separately reapplies persisted edits. Resolve saved class/student edits consistently before preparing every attendance print path. Test direct navigation to Print after a session edit or reimport, without visiting Rosters first.

### QA-04 — Medium: imported session dates collapse to the first lesson date

**Reproduce:** Import the all-levels fixture and select Monday Fall 2026. Inspect Manage Session before editing dates.

**Expected:** September 14 through December 7, 2026, matching `EventSchedule`.

**Actual:** Both start and end dates are September 14. The fixture's `EventTime` contains the first occurrence's date on both ends; that overrides the term date range and can affect date-dependent exports.

**Evidence:** [Imported one-day session](evidence/part-time-all-levels-imported.png). The fixture states `From 2026-09-14 to 2026-12-07`.

**Code pointer / repair direction:** `backend/tasks/extract_classes.go:131` uses the schedule dates only if the dates parsed from EventTime are absent. Separate occurrence time parsing from session date-range inference. The supplied mixed CSV did correctly retain its mini-session range, June 29–July 10, so this is input-format dependent.

### QA-05 — Medium: end dates before start dates are accepted and persisted

**Reproduce:** In Manage Session for the disposable Fall session, leave Start Date at September 14, 2026, set End Date to January 1, 2026, and Save Changes. Reload.

**Expected:** Reject the reversed range with a clear validation message.

**Actual:** “Session updated” appears, and the reversed range survives reload.

**Evidence:** [Invalid date range accepted](evidence/invalid-date-range.png).

**Code pointer / repair direction:** `frontend/src/features/session-management/hooks/useManageSessionForm.ts:438` validates paired times and locations but does not reject reversed dates. Validate the range in both the form and the API. The test record's dates were restored before cleanup.

### QA-06 — Medium: mobile dashboard controls are clipped

**Reproduce:** Open Home at 390×844, first with the default sidebar, then collapse the sidebar.

**Expected:** Navigation and dashboard actions fit within the available viewport.

**Actual:** The expanded 288px sidebar leaves most dashboard buttons clipped. Collapsing it helps, but the fixed 320px buttons still extend beyond the available content area; the measured first button spans x=77 to x=397 in a 390px viewport. Document-level overflow measurements alone miss the clipping.

**Evidence:** [Expanded sidebar](evidence/mobile-expanded.png), [collapsed sidebar](evidence/mobile-collapsed.png).

**Code pointer / repair direction:** The fixed sidebar widths and main padding are in `frontend/src/components/Layout/Layout.tsx:392`; dashboard buttons use fixed `w-80` sizing. Add a mobile navigation treatment and constrain action widths to the available content area.

## Coverage and validation

| Area | Result and limits |
| --- | --- |
| Authentication | Part-time sign-in succeeds. Signed-out state eventually displays Guest and no roster cards; the session endpoint returns 401. Full-time sign-in was rejected. |
| Role restrictions | Direct navigation to `/requests` as part-time displays “Full-time access only.” This verifies the UI guard, not comprehensive backend authorization. |
| CSV analysis/import | Mixed CSV identifies two candidates. Part-time normal import loads 33 classes/157 rows; mini import loads 33 classes/160 rows, separately by day. All-levels import loads 23 classes/23 rows. Guest selection fails as QA-02. Malformed-column CSV shows no candidates without crashing. |
| Session management | Creation, instructor/date edits, and reload persistence exercised. Same-weekday switching and date handling fail as above. Three disposable sessions were deleted. |
| Schematics | Instructor assignment, saving, adding a temporary column, and mouse drag/drop exercised. Moving one class produced columns with 22 and 1 classes, preserved after reload. |
| Rosters and notes | Saved roster level applied after reload; custom-roster required-level validation, creation, reload, and deletion passed. Session note creation, reload, and deletion passed. |
| Report cards | The part-time overview counts 23 students and reflects the changed level: two Little Splash 2 students. Team-wide totals and successful remote synchronization were not verified. |
| PDFs and attendance | Masterlist generated one page with all 23 fixture rows; portrait and landscape schematic PDFs generated. Attendance packet generated 46 pages and contains all 23 course codes. Representative masterlist, schematic, and attendance pages were visually inspected; this is not a pixel comparison of every page. Bulk edited-level consistency fails as QA-03. |
| Device export | Wrong-session data is blocked. Unassigned class is excluded with a warning. Private lesson requires an individual skill level; after assigning it, the browser downloaded 22 classes/22 swimmers. The resulting JSON has no phone/email fields. ID-backup round trips were not exercised in this manual pass. |
| Session Planning | Empty-state page renders and requests both activity-summary and roster CSVs. No matching activity-summary input was supplied, so its import/reorganization workflow was not completed. |
| Responsive/keyboard | Desktop pages and import/print dialogs inspected; 390px dashboard fails as QA-06. Escape did not dismiss the CSV chooser. This was not a full accessibility audit. |

Automated checks also passed:

- `cd frontend && npm run test:run`: **45 files, 156 tests passed**.
- `cd backend && go test ./...`: **all packages passed**.
- `cd frontend && npm run build`: **passed**, with the existing large-chunk and outdated Browserslist warnings.

These green checks do not cover the confirmed browser failures. Raw test/build logs and additional diagnostic artifacts are under `/tmp/decksupervisor-qa/`.

## Blocked coverage and additional observations

- `TestFulltime@gamail.com` returned “Invalid login credentials.” A correction was requested; no corrected credentials were available during this run. Full-time workflows, team management, cross-account shared sessions, and shared-session edit permissions remain **unverified**. No invitations or messages were sent.
- One early single-roster print displayed the fallback “Session: Session”; a later print after metadata settled displayed the correct term. This timing-sensitive observation is not included in the six confirmed defects.
- During cleanup/sign-out navigation, three unhandled `Unauthorized` page errors appeared alongside protected requests returning 401. The UI subsequently settled to Guest with no roster data. Cancellation/error handling for requests in flight at sign-out warrants a focused regression test; this was not reproduced as a standalone finding.
- A report-card sync request returned 400 during the no-team test workflow. The local counts rendered, but remote/team synchronization is not claimed as passing.
- Native print dialogs were suppressed only while capturing generated attendance HTML as PDFs, preventing automatic popup closure. Physical printing and native desktop interaction were not tested.

## Cleanup and next steps

The three sessions created by this run were removed. The final authenticated session listing contained none of their IDs and retained three unrelated pre-existing sessions. The disposable note and custom roster were deleted. The final cleanup used the API for the last known test session after rapid UI navigation failed to expose its delete form. Signed-out roster isolation was then checked.

Fix QA-01, QA-02, and QA-03 first, then rerun their exact browser reproductions. Complete full-time/shared-role coverage with corrected credentials and planner coverage with a matching activity-summary CSV before treating the whole planned matrix as verified.
