# IN-02 — Select sessions and keep instructor context across pages

**Priority:** P0  
**Accounts:** INSTRUCTOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Also link B’s 92001 column to INSTRUCTOR_A using ds-12 steps. Both sessions are Mondays; B is at QA Pool B.

## Steps and expected results

1. **Action:** Open `/instructor`; select A. Visit My Classes, Lesson Plans, and Print.

   **Expected:** All pages use A; selection is shared across instructor navigation.

2. **Action:** In My Classes open the lesson-plan link for 91001 and copy the full URL into the private run manifest.

   **Expected:** The editor selects A and 91001 without guessing a class from its name.

3. **Action:** Use Current session to choose B. Visit My Classes and Lesson Plans.

   **Expected:** Only 92001 appears for B; A’s selected class is not reused.

4. **Action:** Reload.

   **Expected:** B remains the selected session.

5. **Action:** Paste the saved A/91001 lesson-plan URL into the address bar.

   **Expected:** A and 91001 are selected, with the correct session’s plan rather than B’s.

6. **Action:** Return to Home and compare both session titles with the supervisor’s recorded titles.

   **Expected:** Same-weekday sessions remain distinguishable by their displayed context and time/location details.

## Evidence and result

Capture A/B labels, classes, and the resolved deep link after reload. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Return to A; retain B’s link for later isolation checks.
