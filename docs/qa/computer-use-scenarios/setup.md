# Baseline setup and synthetic data

Read [README.md](README.md) first. All setup uses the test-site UI; no credentials or production data are in this directory. Do not create teams, promote accounts, or invoke full-time integrations.

## Run manifest

Record BASE_URL, build, RUN_ID, account aliases, browser-profile purpose, absolute fixture/download paths, session IDs if visible in URLs, displayed session titles, account-link mapping, selected plan week, and modified values. If an ID is not visible, use the exact session day/location/time label; do not invent an ID or retrieve hidden state.

Use fresh disposable accounts for a run, or confirm there are no conflicting QA Pool A/B sessions. Fixtures deliberately have stable course codes and locations. Merely changing a display label does not make a CSV import a new session. If matching pre-existing sessions are not disposable, stop setup as BLOCKED rather than overwrite them.

## Session A: import and configure

1. Sign in as SUPERVISOR_A. Home → Upload CSV and Choose Session → choose `fixtures/session-a-rosters.csv`.
2. Select the Monday / QA Pool A candidate. It has four classes and five booked swimmers. Create the session only if it does not already exist; otherwise load the correct disposable existing session.
3. In Manage Sessions verify Monday, Fall 2026, Start Date `2026-09-14`, End Date `2026-12-07`, Session Start Time `16:00`, Session End Time `17:30`, Display Location `QA Pool A`, and Included Raw Locations `QA Pool A`. Correct through the form, then Save Changes. Use No team unless preparing the separate coverage case.
4. Set Number of instructors to 2 and press Enter. Name instructor 1 `QA Alpha`, instructor 2 `QA Beta`. Save Changes. Do not link accounts until in-01's unlinked checks are complete.
5. Open Rosters. Resolve 91002 to Splash 2A. Set the level beside QA Devon in private class 91003 to Splash 1. Do not change the private class itself into a standard class.
6. Open Schematic, add a column if needed, and drag courses into the desired columns. An empty unassigned column shows Delete instead of an instructor selector; move a class into it first. Select QA Alpha/QA Beta in the populated column headers and finish the assignments in the table. Preserve their original times. Save Schedule and verify after reload.

| Code | Raw service | Monday time | Booked swimmers | Instructor |
| --- | --- | --- | --- | --- |
| 91001 | Splash 1 | 16:00–16:30 | QA Avery, QA Blair | QA Alpha |
| 91002 | Splash 2 (resolve to 2A) | 16:00–16:30 | QA Casey | QA Beta |
| 91003 | Splash Private | 16:30–17:00 | QA Devon (individual level Splash 1) | QA Alpha |
| 91004 | Splash Fitness | 17:00–17:30 | QA Ellis | QA Alpha |

Source CSV staff fields are blank so the schematic can assign classes. Baseline total: five booked swimmers; Alpha four, Beta one. With the level edits above: Splash 1 three, Splash 2A one, Splash Fitness one. No baseline waitlisted swimmers.

## Session B: same weekday, different location

Upload `fixtures/session-b-rosters.csv` via Home and create/load QA Pool B. Verify the same Monday date range, Fall 2026, and `16:00–16:30`. Create instructor QA Alpha, assign course 92001 to that column, and Save Schedule. Its only swimmer is QA Morgan in Splash 1. This is a separate session, not another day within A.

For instructor session-switch tests, link B’s QA Alpha column to INSTRUCTOR_A using Manage Sessions → Optional account for instructor 1 → search exact email → Select account → Save Changes, then Save Schedule. Follow [ds-12](ds-12-link-instructor-accounts.md) to link A’s columns. A saved schematic publishes the class metadata instructors need.

Raw rosters are browser-local. Each supervisor browser may need to upload the matching CSV after selecting a saved session. Never assume choosing a saved Monday session also loads the right CSV. Instructor views need the saved class links/metadata, not student CSV uploads.

## Lesson dates and plan state

The fixture contains 13 Mondays: September 14, 21, 28; October 5, 12, 19, 26; November 2, 9, 16, 23, 30; December 7, 2026. Dates are synthetic and do not imply real holiday cancellations. Explicitly select `2026-09-14` for saved-plan scenarios; reserve `2026-09-28` as an untouched week for no-plan checks. The app’s initial week can depend on the current date; never depend on that default.

Device-export date restoration uses these ISO dates, one per line:

```text
2026-09-14
2026-09-21
2026-09-28
2026-10-05
2026-10-12
2026-10-19
2026-10-26
2026-11-02
2026-11-09
2026-11-16
2026-11-23
2026-11-30
2026-12-07
```

## Fixture inventory

- `session-a-rosters.csv`: primary four-class, five-swimmer baseline; also the exact-schema roster input for Session Planning.
- `session-b-rosters.csv`: distinct Monday session at QA Pool B, 92001 / QA Morgan.
- `session-a-updated-rosters.csv`: baseline plus QA Finley in 91001; six booked swimmers, for Print Updates. Restore baseline afterward.
- `session-a-waitlist-rosters.csv`: baseline plus QA Waiting with Waiting status in 91001. Optional device-export check: upload it into A, inspect Alpha’s export list, and verify QA Waiting is excluded while the four booked Alpha swimmers remain. Restore baseline afterward. This does not define report-card waitlist expectations.
- `planner-activity-summary.csv`: exact-schema summary for the four A classes plus empty Splash 1 class 91005 at 17:30–18:00. Pair with baseline A roster; expect five planner classes, four matched classes, one summary-only class, and five booked participants.
- `coverage-read-rosters.csv`, `coverage-edit-rosters.csv`, `coverage-future-rosters.csv`: baseline-shaped data at distinct QA Coverage locations, with course codes 93001–93004, 94001–94004, and 95001–95004 respectively. These prevent coverage setup from overwriting A or ambiguously matching duplicate sessions. Associate each with the supplied existing team in Manage Sessions.
- `invalid-rosters.csv`: deliberately missing the required headers; must not import as usable roster data.
- Existing broad-level fixture: [all-attendance-levels-one-instructor.csv](../../../frontend/test-fixtures/csv/all-attendance-levels-one-instructor.csv), available for a separate all-level print spot-check. It uses Test Pool/Test Instructor, different codes, and 23 swimmers; do not substitute it into the five-swimmer baseline assertions.

Planner interactions operate on a separate planner dataset. Replacing planner data is allowed only in a disposable workspace. Existing team memberships and coverage copies must be supplied or created through part-time UI; if unavailable, coverage is BLOCKED while unrelated cases continue.
