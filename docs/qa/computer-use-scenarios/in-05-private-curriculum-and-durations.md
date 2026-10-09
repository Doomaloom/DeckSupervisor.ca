# IN-05 — Choose private-class curriculum and compare lesson duration

**Priority:** P1  
**Accounts:** INSTRUCTOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Open private course 91003; choose week 2026-09-14. This uses a disposable plan.

## Steps and expected results

1. **Action:** Inspect Curriculum level, choose Splash 1, click Add activity, choose Shallow entry & exit, click Custom on that row, and enter QA private RUN_ID.

   **Expected:** The skill choices follow the selected curriculum; the row remains editable.

2. **Action:** Set the row’s duration to 10 minutes.

   **Expected:** The header reads 10 / 30 min planned; do not require a separate remaining-time warning.

3. **Action:** Click Add activity, select Chest-deep jump, click Custom, enter QA private practice RUN_ID, and set its duration to 20 minutes.

   **Expected:** The total is 30 minutes, matching the lesson length.

4. **Action:** Increase the second row to 25 minutes.

   **Expected:** The header reads 35 / 30 min planned; activity text is preserved. No separate warning badge is required.

5. **Action:** Change Curriculum level to Splash 2A, pause, and reload.

   **Expected:** The selected curriculum persists; existing activity text is retained even if a previous skill is no longer in the new catalog.

6. **Action:** Restore the second duration to 20 and reload.

   **Expected:** The 30-minute total persists without losing the selected curriculum.

## Evidence and result

Capture curriculum selection, under/equal/over totals, and the reloaded retained rows. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Retain the synthetic plan for printing; record its level and row text.
