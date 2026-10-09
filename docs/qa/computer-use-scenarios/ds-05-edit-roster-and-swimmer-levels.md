# DS-05 — Persist class levels and individual swimmer overrides

**Priority:** P0  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments.

## Steps and expected results

1. **Action:** Open `/rosters`; find 91002 and change its roster level from generic Splash 2 to Splash 2A.

   **Expected:** The class and QA Casey use the resolved level.

2. **Action:** Find 91003 and set QA Devon’s individual level to Splash 1 using the selector beside their name.

   **Expected:** The private swimmer has the override without changing QA Avery or QA Casey.

3. **Action:** Navigate away, return, and reload.

   **Expected:** Both edits persist for A.

4. **Action:** Re-upload the baseline A CSV using its existing-session candidate.

   **Expected:** Saved level edits are reapplied to the matching class/swimmer.

5. **Action:** Use 91003’s Print button and inspect the visible attendance output.

   **Expected:** The edited private swimmer level is represented; the wrong swimmer or class is not substituted.

## Evidence and result

Capture both edited controls after reload and private attendance output. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Keep 91002 = Splash 2A and QA Devon = Splash 1 as the documented baseline for exports; record them in the manifest.
