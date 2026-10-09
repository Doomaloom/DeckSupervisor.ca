# DS-13 — Preserve assignment identity across rename and relinking

**Priority:** P0  
**Accounts:** SUPERVISOR_A, INSTRUCTOR_A, INSTRUCTOR_B

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Complete in-04 first and record the saved 91001 lesson-plan URL and week.

## Steps and expected results

1. **Action:** As supervisor rename QA Alpha to QA Alpha Renamed in Manage Sessions, save, and save the schematic. Reload INSTRUCTOR_A’s My Classes and saved plan.

   **Expected:** The display name changes without losing A’s three classes or saved lesson content.

2. **Action:** Temporarily rename both instructor rows QA Same Name and save. Reload both instructor views.

   **Expected:** Duplicate display names do not merge class access: A still has three assigned codes and B only 91002.

3. **Action:** Restore QA Alpha/QA Beta names. Use Unlink on Alpha’s row and save. Reload INSTRUCTOR_A’s previously saved lesson-plan URL.

   **Expected:** A loses access to that assignment; previously saved content cannot be reopened through the stale link.

4. **Action:** Link Alpha’s row to INSTRUCTOR_B, save, and reload B’s class list and the 91001 plan/week.

   **Expected:** B gains Alpha’s classes and can see the previously saved plan; A still cannot.

5. **Action:** Unlink B from Alpha and restore INSTRUCTOR_A there; retain B on Beta. Save and reload both views.

   **Expected:** Original class sets and saved plan are restored.

## Evidence and result

Capture class codes for duplicate names, the denied stale link, and the retained plan after reassignment. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Restore names and original account links even on partial failure. Never delete instructor rows to simulate unlinking.
