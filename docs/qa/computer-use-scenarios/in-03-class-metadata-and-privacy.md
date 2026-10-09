# IN-03 — Show only linked class metadata in My Classes

**Priority:** P0  
**Accounts:** INSTRUCTOR_A, INSTRUCTOR_B

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002.

## Steps and expected results

1. **Action:** As A open `/instructor/my-classes` for A. Inspect every card and time position.

   **Expected:** 91001 is 16:00–16:30, 91003 is 16:30–17:00, and 91004 is 17:00–17:30, under Alpha with corresponding levels.

2. **Action:** Inspect the page and each visible class control.

   **Expected:** No swimmer names, contact information, student counts, or coverage-management controls appear in this instructor view.

3. **Action:** Open the lesson-plan action for 91003.

   **Expected:** The private class is selected in the lesson editor for the same session.

4. **Action:** In B’s separate profile open My Classes for A.

   **Expected:** Only 91002 is visible; B cannot browse Alpha’s three classes through the class selector.

5. **Action:** Reload both pages.

   **Expected:** The access boundary and displayed metadata remain unchanged.

## Evidence and result

Capture both class views, time labels, and the private-class lesson link destination. This establishes visible isolation, not API/RLS proof. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Leave the shared baseline intact for dependent scenarios. Record any remaining changes in the run manifest.
