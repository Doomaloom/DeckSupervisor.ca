# DS-12 — Link instructors to their assigned classes

**Priority:** P0  
**Accounts:** SUPERVISOR_A, INSTRUCTOR_A, INSTRUCTOR_B

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete ds-07. Use separate authenticated browser profiles for supervisor and instructors.

## Steps and expected results

1. **Action:** As SUPERVISOR_A open Manage Sessions. Under Optional account for instructor 1, search INSTRUCTOR_A’s supplied email; choose Select account on the exact matching result for QA Alpha.

   **Expected:** The selected account’s name/email appears beside Alpha.

2. **Action:** Link QA Beta to INSTRUCTOR_B the same way, then click Save Changes. Open Schematic and Save Schedule.

   **Expected:** Links and schematic save successfully.

3. **Action:** As INSTRUCTOR_A open `/instructor`, select A, then My Classes.

   **Expected:** Only 91001, 91003, and 91004 appear.

4. **Action:** As INSTRUCTOR_B open Instructor Home, select A, and open My Classes.

   **Expected:** Only 91002 appears.

5. **Action:** Reload both instructor views and supervisor Manage Sessions.

   **Expected:** The same account links and class visibility persist.

## Evidence and result

Capture selected account identities (no secrets), both class lists, and the saved instructor rows. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Leave the shared baseline intact for dependent scenarios. Record any remaining changes in the run manifest.
