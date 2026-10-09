# DS-17 — Start and end temporary device sharing

**Priority:** P1  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete ds-05 and ds-07; open `/device-exports` with no active share.

## Steps and expected results

1. **Action:** Click Start Session and Create Codes.

   **Expected:** One six-digit code per instructor appears; Alpha and Beta have distinct codes.

2. **Action:** Observe the sharing controls and attempt the individual-download control.

   **Expected:** End Sharing is offered; conflicting export actions are disabled while sharing is active.

3. **Action:** Click End Sharing.

   **Expected:** Codes disappear and the start action becomes available again.

4. **Action:** Start another share, then navigate to Home and return to Device Exports.

   **Expected:** The page no longer presents the prior active host session; it can start a new share.

5. **Action:** If a new share was started, click End Sharing.

   **Expected:** The page returns to its inactive state.

## Evidence and result

Capture active and inactive panels. This scenario does not verify server expiry, code redemption, or Rec Tablet import; those require a separate integration test. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

End every share created during this test.
