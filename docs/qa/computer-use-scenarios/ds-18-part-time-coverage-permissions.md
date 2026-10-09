# DS-18 — Share coverage with read-only and editable roster permissions

**Priority:** P0  
**Accounts:** SUPERVISOR_A, SUPERVISOR_B

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

The two supervisors must already share a team. Import `fixtures/coverage-read-rosters.csv`, `fixtures/coverage-edit-rosters.csv`, and `fixtures/coverage-future-rosters.csv` from Home to create three distinct disposable sessions at QA Coverage Read, QA Coverage Edit, and QA Coverage Future. For each, open Manage Sessions, select the supplied existing Team, add QA Alpha and QA Beta, and Save Changes. Assign/save its schematic as in ds-07 (the final code digits 001–004 identify the equivalent A courses). Add owner note QA coverage owner RUN_ID in General Session Notes. Record the matching filename for each session. Do not create teams or use full-time accounts.

## Steps and expected results

1. **Action:** As A open `/team`. Share QA Coverage Read with B for today (Toronto date) with roster edits unchecked; share QA Coverage Edit for today with roster edits checked; share QA Coverage Future for tomorrow.

   **Expected:** Each request reports Session shared. Record the exact dates and permissions.

2. **Action:** As B open Home → Select Existing Session.

   **Expected:** Today’s two shares are available; tomorrow’s share cannot be opened as active coverage today.

3. **Action:** Open QA Coverage Read. Inspect Manage Sessions and Schematic.

   **Expected:** Session details and instructor links cannot be changed; schematic is View Only and cannot be saved or rearranged.

4. **Action:** Open Rosters; if local raw data is requested, upload the matching synthetic CSV for this shared context. Try changing a class/swimmer level.

   **Expected:** The share remains read-only; edits are unavailable. If the UI cannot load matching raw data into the share, mark this roster subcheck BLOCKED, not passed.

5. **Action:** Open Notes and inspect A’s tagged note.

   **Expected:** The owner note can be read but B cannot delete or edit it.

6. **Action:** Open QA Coverage Edit and load matching local roster data if needed; change QA Devon’s level to Splash 3. Reload, and verify from A’s browser with matching data loaded.

   **Expected:** Roster edit persists and is visible to A; Manage Sessions and Schematic remain read-only for B.

## Evidence and result

Capture both permission variants, disabled owner controls, future-share behavior, and the owner-side edited level. Missing pre-existing team membership blocks this scenario only. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

A deletes only the three disposable coverage sessions after evidence. Record any remaining date-scoped grants if cleanup cannot finish; do not invent a revoke control.
