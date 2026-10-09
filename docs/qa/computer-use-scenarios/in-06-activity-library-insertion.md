# IN-06 — Insert library activities alongside custom instructions

**Priority:** P1  
**Accounts:** INSTRUCTOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Use the saved 91001 plan from in-04. Record its row skill, location, and duration.

## Steps and expected results

1. **Action:** In the existing row click Browse library. Inspect a matching activity; record its title and instructions.

   **Expected:** The modal opens with categories/search and a Use activity action.

2. **Action:** Click Use activity on that entry.

   **Expected:** The modal closes; the library activity is appended while QA practice text, selected skill, location, and duration remain intact.

3. **Action:** Click Custom on the same row and enter QA extra instruction RUN_ID in the new activity field. Pause and reload.

   **Expected:** Custom and library entries persist together, in their displayed order.

4. **Action:** Open Browse library again, then press Escape. Reopen and click Close.

   **Expected:** Both dismissal methods close the modal without inserting another activity.

5. **Action:** Remove only the newly added custom activity using its Remove control; pause and reload.

   **Expected:** That entry disappears while the library entry and original QA practice text remain.

## Evidence and result

Capture the row before insertion and after reload; include modal dismissal and retained unrelated fields. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Retain one library entry for PDF checks and record its title.
