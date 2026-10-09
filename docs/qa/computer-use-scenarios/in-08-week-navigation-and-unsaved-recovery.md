# IN-08 — Navigate lesson weeks and protect an unsaved draft

**Priority:** P0  
**Accounts:** INSTRUCTOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Use 91001’s saved first-week plan. For draft-failure steps, the computer-use tool must support toggling offline mode through browser UI; otherwise mark those steps BLOCKED and finish the week checks.

## Steps and expected results

1. **Action:** Open Lesson Plans and choose 2026-09-14 in Selected week. Use Next week.

   **Expected:** The date becomes 2026-09-21; first-week QA practice text is not copied into an unsaved second week.

2. **Action:** Use Previous week to return, then try Previous week at the first date.

   **Expected:** The saved first-week plan returns; navigation cannot go before the session’s first lesson date.

3. **Action:** Choose the final date, 2026-12-07, and inspect Next week.

   **Expected:** Navigation cannot advance beyond the last session lesson. Print uses the same scheduled date options.

4. **Action:** Return to the saved first week. Through browser UI only, go offline and append QA offline RUN_ID to the existing activity. Wait for a visible save failure.

   **Expected:** The editor reports a save failure and retains the draft text.

5. **Action:** Choose another week; cancel Discard unsaved lesson plan changes?.

   **Expected:** The editor stays on the original week with the unsaved text intact.

6. **Action:** Restore connectivity. Make a small new edit to the retained row to trigger retry, pause, and reload.

   **Expected:** The updated draft now persists and the error clears.

7. **Action:** Repeat the offline edit with marker QA discard RUN_ID; after failure choose another week and accept discard. Restore connectivity and return to the original week.

   **Expected:** The discarded marker is absent; the last successfully saved content remains.

## Evidence and result

Capture date bounds, retained draft/error, cancelled navigation, successful retry, and discarded marker absence. Never use DevTools scripts or request mocking. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Always restore connectivity. Remove offline test markers with a normal online edit and confirm persistence.
