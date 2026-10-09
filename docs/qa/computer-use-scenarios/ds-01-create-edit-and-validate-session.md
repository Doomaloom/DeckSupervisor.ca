# DS-01 — Create, edit, and validate a supervisor session

**Priority:** P0  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Open `/`. Use a fresh Display Location `QA Manual RUN_ID`; this session is separate from baseline Session A.

## Steps and expected results

1. **Action:** Click Start New Session and try Save Session with required fields empty.

   **Expected:** Validation prevents an incomplete session from being created.

2. **Action:** Fill Monday, Fall, 2026, start 2026-09-14, end 2026-09-07, times 16:00–17:30, Display Location QA Manual RUN_ID, raw location QA Pool A; choose No team when offered. Try Save Session.

   **Expected:** The reversed date range is rejected.

3. **Action:** Correct End Date to 2026-12-07 and click Save Session.

   **Expected:** Exactly one session is created and selected.

4. **Action:** Open `/manage-sessions`. Change Display Location to QA Manual Updated RUN_ID. Set Number of instructors to 2, press Enter, and enter QA Alpha and QA Beta. Click Save Changes.

   **Expected:** Changes save without duplicating the session.

5. **Action:** Reload, then select this session again from Home.

   **Expected:** Correct dates, time range, location, and both instructor names persist.

## Evidence and result

Capture both validation cases and reloaded session details. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Delete this standalone manual test session after recording evidence; retain Session A/B.
