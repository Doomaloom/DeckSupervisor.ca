# DS-19 — Track roster changes through print and acknowledgement

**Priority:** P1  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Use a fresh Session A import baseline for reliable change tracking. If an earlier run changed the tracking baseline, prepare a fresh disposable account/session rather than claiming an empty queue. Complete ds-07.

## Steps and expected results

1. **Action:** Open Print → Print Updates after the first baseline upload.

   **Expected:** No classes are waiting to be printed; the initial upload establishes the baseline.

2. **Action:** Upload `session-a-updated-rosters.csv` and select the existing A session; reopen Print Updates.

   **Expected:** Course 91001 is queued for its new swimmer QA Finley; unchanged classes are not falsely queued.

3. **Action:** Print that queued class and cancel/close the print dialog, then choose Keep queued.

   **Expected:** The update remains pending; starting a print alone does not clear it.

4. **Action:** Print again, save output to PDF, then choose Mark printed.

   **Expected:** The acknowledged class leaves the queue.

5. **Action:** Reload Print Updates.

   **Expected:** The acknowledgement persists; the PDF includes QA Finley.

## Evidence and result

Capture initial empty queue, added swimmer update, retained queue after cancellation, and cleared queue after acknowledgement. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Re-import baseline A CSV to restore five swimmers. This removal may create another update: record it and use Dismiss on the synthetic queue entry.
