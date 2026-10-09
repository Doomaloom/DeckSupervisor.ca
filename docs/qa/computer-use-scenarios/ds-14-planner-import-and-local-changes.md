# DS-14 — Import planner files and persist cancellation planning

**Priority:** P1  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Use a dedicated planner workspace with no valuable existing plan. Open `/session-planning`. Files: planner-activity-summary.csv and session-a-rosters.csv. No real calls or emails are performed.

## Steps and expected results

1. **Action:** Choose Activity Summary CSV and Choose Roster CSV using the named fixtures; click Load Planner (or Replace Planner Data if a disposable dataset is already loaded).

   **Expected:** Five classes are available: four matched roster classes and empty class 91005. There are five booked participants; 91005 has none.

2. **Action:** Select Monday / QA Pool A; open 91001 and click Pending Cancellation.

   **Expected:** The class status visibly changes and participant call-workflow controls become available.

3. **Action:** Open Call Parent / Guardian for QA Avery. Inspect Live Script and Voicemail Script, select Voicemail, and click Finish Call without making a call.

   **Expected:** A simulated voicemail outcome is recorded for Avery only.

4. **Action:** Open Planned Changes.

   **Expected:** Avery’s outcome appears with the correct source class; untouched participants are not falsely marked contacted.

5. **Action:** Click Save State to download a backup. Reload the page.

   **Expected:** The local workspace retains its planned status and recorded outcome.

6. **Action:** Use Load State to select the saved backup and accept any replacement confirmation.

   **Expected:** The saved state is restored without duplicate participants or lost empty class 91005.

## Evidence and result

Capture import reconciliation, class status, simulated call outcome, and restored Planned Changes. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Retain the state download as synthetic evidence. Restore the baseline by replacing planner data with the two original fixtures when finished. Do not send email drafts.
