# DS-10 — Reconcile report-card counts with roster edits

**Priority:** P1  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Use the baseline five booked swimmers only; complete ds-05 and ds-07. No custom roster is required.

## Steps and expected results

1. **Action:** Open `/report-cards`.

   **Expected:** Lesson Block Overview totals five swimmers. Instructor totals are QA Alpha = 4 and QA Beta = 1.

2. **Action:** Check level totals after ds-05.

   **Expected:** Splash 1 = 3 (Avery, Blair, Devon), Splash 2A = 1 (Casey), Splash Fitness = 1 (Ellis); total remains five.

3. **Action:** Return to Rosters and change QA Devon’s individual level to Splash 3. Reopen Report Cards.

   **Expected:** Splash 1 drops to two and Splash 3 becomes one; instructor totals stay 4/1.

4. **Action:** Reload Report Cards.

   **Expected:** The edited totals remain consistent. Record any synchronization error separately.

5. **Action:** Restore Devon to Splash 1 in Rosters and reopen Report Cards.

   **Expected:** The original level totals return.

## Evidence and result

Capture before/after totals alongside the edited swimmer level. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Leave Devon at Splash 1. Do not inspect team-wide or full-time totals.
