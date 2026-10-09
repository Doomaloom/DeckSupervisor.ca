# DS-15 — Collaborate through a shared planner link

**Priority:** P1  
**Accounts:** SUPERVISOR_A, SUPERVISOR_B

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Prepare ds-14 baseline in A’s browser. B uses a separate browser session. Both accounts are part-time. Existing local planner data must be disposable.

## Steps and expected results

1. **Action:** As A open the planner sharing controls, enter shared session name QA Planner RUN_ID, and click Start Sharing. Copy Share Link.

   **Expected:** A shared-session panel and link are available.

2. **Action:** Open the link in B’s browser, enter Display name QA Cover, and choose Join Shared Planner.

   **Expected:** B sees the same five-class planner without performing a CSV import.

3. **Action:** In B’s planner mark 91002 Pending Cancellation.

   **Expected:** After synchronization, A sees 91002 with the same status.

4. **Action:** As A update shared callback details to synthetic phone 905-555-1234 and click Update Shared Info.

   **Expected:** B’s shared call details reflect the change.

5. **Action:** As B choose Leave Shared Planner, then reopen and rejoin the link.

   **Expected:** The shared state remains available while A is hosting.

6. **Action:** As A choose Stop Sharing; reload the link in B.

   **Expected:** B cannot continue editing that ended shared workspace; the UI gives an ended/unavailable state.

## Evidence and result

Capture both browsers showing the synchronized status and the ended-share result. Keep live share links out of public reports. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Stop sharing and close the participant tab. Restore any changed local planner status if retained.
