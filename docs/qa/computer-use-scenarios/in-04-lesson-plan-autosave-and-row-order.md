# IN-04 — Create and persist a weekly lesson plan

**Priority:** P0  
**Accounts:** INSTRUCTOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Open 91001 through My Classes. Explicitly select week/date 2026-09-14; do not rely on the current-date default. Use a disposable week with no existing plan.

## Steps and expected results

1. **Action:** Inspect the empty editor, then visit Print for that week without editing.

   **Expected:** No saved plan is available and merely opening the editor did not create printable content.

2. **Action:** Return to 91001. Click Add activity. Choose Shallow entry & exit in the Skill selector. Click Custom on the row to expose its activity text field. Enter QA warmup RUN_ID in Activity / drill 1, choose Shallow end, and set Duration (minutes) 1 to 5.

   **Expected:** The row shows the chosen skill, activity, location, and duration without an autosave error.

3. **Action:** Click Add activity for a second row, select Chest-deep jump, click Custom, and enter QA practice RUN_ID in its activity field; choose Lane and set duration to 10. Pause two seconds after editing. Navigate away and back, then reload.

   **Expected:** Both complete rows persist. Do not require a visible Saved badge: this editor autosaves without one.

4. **Action:** Drag the second row’s reorder handle above the first. Pause, navigate away/back, and reload.

   **Expected:** QA practice is now first; its skill, location, and duration moved with it.

5. **Action:** Add an untouched blank row, then navigate away/back after two seconds.

   **Expected:** The untouched blank row was not persisted as lesson content.

6. **Action:** Delete the QA warmup row. Pause and reload.

   **Expected:** Only QA practice remains; no deleted row reappears.

## Evidence and result

Capture the saved two-row plan, reordered plan, and final one-row plan after reload. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Retain the saved QA practice plan and URL/week for linking, printing, and isolation scenarios. Record its exact values.
