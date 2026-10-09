# CROSS-02 — Use supervisor and instructor workflows on a narrow screen

**Priority:** P1  
**Accounts:** SUPERVISOR_A, INSTRUCTOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Complete in-04. Use a 390 × 844 viewport configured by browser UI or computer-use viewport controls, at 100% zoom.

## Steps and expected results

1. **Action:** As supervisor open Home, open/close the navigation menu, and select Manage Sessions.

   **Expected:** Navigation fits, opens, closes, and reaches the correct page without covering the active form indefinitely.

2. **Action:** Open Rosters, search 91001, and open its Print preview; return to Schematic and scroll its schedule horizontally.

   **Expected:** Search and print controls are reachable; schedule scrolling exposes columns without losing class content.

3. **Action:** Sign in as A; open Instructor Home and select A, then visit My Classes.

   **Expected:** Session selection and class actions fit the screen and can be activated.

4. **Action:** Open the saved 91001 lesson plan. Scroll the activity table sideways to Pool location and Duration. Change location to Deep end, pause, and reload.

   **Expected:** The horizontal-scroll hint is visible; controls are reachable and the edit persists.

5. **Action:** Open Browse library, scroll its content, then Close. Open Print and inspect the PDF preview.

   **Expected:** Modal close controls remain reachable; the preview is usable without hiding navigation permanently.

6. **Action:** Restore the row’s original location and restore the desktop viewport.

   **Expected:** Both changes take effect; the lesson data remains intact.

## Evidence and result

Capture mobile menu, session picker, horizontally scrolled editor, modal, and print preview; record any inaccessible control precisely. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Restore viewport and edited location.
