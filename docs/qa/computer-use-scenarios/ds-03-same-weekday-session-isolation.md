# DS-03 — Keep two Monday sessions distinct

**Priority:** P0  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Prepare Session A and B following [setup](setup.md), loading each fixture into its own session. Keep track of which CSV is loaded in this browser.

## Steps and expected results

1. **Action:** Select A from Home and load A’s CSV. Visit Manage Sessions, Rosters, and Schematic.

   **Expected:** The context is QA Pool A; classes use 91001–91004 and include QA Avery.

2. **Action:** Upload `session-b-rosters.csv` from Home and select B. Visit the same pages.

   **Expected:** Context changes to QA Pool B; its roster is 92001 / QA Morgan, without A’s swimmers.

3. **Action:** Select A from Home without uploading A’s CSV; open Device Exports.

   **Expected:** B’s roster must not be exportable as A. A matching-data requirement is acceptable. Record any stale roster shown on other pages as a finding, not a pass.

4. **Action:** Upload A’s CSV, select A, and reload.

   **Expected:** A’s correct roster returns; B’s details/assignments have not overwritten A.

5. **Action:** Switch to B and reload; re-upload B’s CSV if required for local roster data.

   **Expected:** B remains a distinct saved session, with its own course and swimmer.

## Evidence and result

Capture both session labels, roster identities, and the mismatched-data export guard. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Return to A and load A’s baseline CSV.
