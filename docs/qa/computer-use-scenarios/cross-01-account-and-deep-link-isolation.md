# CROSS-01 — Deny another account’s lesson-plan deep link

**Priority:** P0  
**Accounts:** INSTRUCTOR_A, INSTRUCTOR_B, Guest

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Complete in-04 and restore original links after ds-13. Obtain A’s actual 91001 plan URL from the visible address bar.

## Steps and expected results

1. **Action:** As A open the saved 91001 plan and record its unique QA activity marker. Log out.

   **Expected:** The protected editor is no longer available as an authenticated A view.

2. **Action:** Sign in as B in the same browser and paste A’s 91001 URL.

   **Expected:** B cannot read or edit A’s plan; an access/invalid-selection state appears without the QA marker.

3. **Action:** Choose B’s valid A-session class 91002 and an unused week.

   **Expected:** The editor is usable for B’s assignment; it contains no A lesson content.

4. **Action:** Log out and open A’s plan URL as guest.

   **Expected:** Sign in to Instructor View appears; protected class/plan content is absent.

5. **Action:** Sign in as A and reopen the original URL.

   **Expected:** The saved QA activity is intact; denied attempts did not alter it.

## Evidence and result

Capture A’s baseline, B’s denied deep link, guest sign-in requirement, and A’s restored view. Do not infer API authorization coverage from UI results. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Log out of the shared browser when finished.
