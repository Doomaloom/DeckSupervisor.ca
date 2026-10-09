# IN-01 — Use Instructor View without linked classes

**Priority:** P0  
**Accounts:** INSTRUCTOR_UNLINKED

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Use an instructor-capable part-time account with no assignment links. This may be INSTRUCTOR_B before ds-12; never unlink a shared account merely to satisfy setup.

## Steps and expected results

1. **Action:** Sign in and open `/instructor`.

   **Expected:** Home explains that no sessions are linked and directs the user to their supervisor.

2. **Action:** Open `/instructor/my-classes` and `/instructor/lesson-plans`.

   **Expected:** No unrelated classes or lesson content appears; the UI explains the missing selection/link.

3. **Action:** Open `/instructor/activity-library`. Search an activity term shown on an initial card, then open a result.

   **Expected:** The library works without a linked session; readable activity instructions appear.

4. **Action:** Search QA_NONEXISTENT_ACTIVITY_987; click Clear filters.

   **Expected:** An explicit no-matches state appears, then results return.

5. **Action:** Open `/instructor/attendance`.

   **Expected:** Attendance is coming later. Attendance editing is not available yet. is displayed, with no attendance editing controls.

## Evidence and result

Capture unlinked Home, library results/no-results, and the Attendance placeholder. Do not report missing attendance editing as a defect. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Clear library filters and log out.
