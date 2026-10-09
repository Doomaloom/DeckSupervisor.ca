# DS-07 — Assign and move classes on the schematic

**Priority:** P0  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Manage Sessions must contain QA Alpha and QA Beta, with no fixed CSV staff assignments.

## Steps and expected results

1. **Action:** Open `/schematic`. Use Add column if needed so two instructor columns are available; drag a class into any empty column that shows Delete instead of a selector, then select QA Alpha and QA Beta in the populated header selectors.

   **Expected:** The board offers the configured session instructors.

2. **Action:** Drag course 91002 to QA Beta’s column; arrange 91001, 91003, and 91004 under QA Alpha. Keep class times unchanged.

   **Expected:** All four course codes appear exactly once; the simultaneous 91001/91002 classes are in separate columns.

3. **Action:** Click Save Schedule and wait for Schedule saved successfully!. Reload.

   **Expected:** The same assignments and times persist.

4. **Action:** Move 91003 into QA Beta’s column, save, and reload.

   **Expected:** Only that class changes instructor; its 16:30–17:00 time remains unchanged.

5. **Action:** Move 91003 back to QA Alpha, save, then add and delete an unused empty column.

   **Expected:** Baseline assignments are restored; removing an empty column loses no courses. Save and reload once more.

## Evidence and result

Capture the saved baseline and the moved class after reload. A drag that the tool cannot perform is BLOCKED, not a product failure. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Leave the shared baseline intact for dependent scenarios. Record any remaining changes in the run manifest.
