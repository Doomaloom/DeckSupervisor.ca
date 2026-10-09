# DS-04 — Delete only the selected disposable session

**Priority:** P1  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Create a standalone manual session using ds-01 values with Display Location QA Delete RUN_ID. Baseline A/B must already exist.

## Steps and expected results

1. **Action:** Select QA Delete RUN_ID and open `/manage-sessions`; click Delete Session. Cancel any confirmation if offered.

   **Expected:** If confirmation is offered, cancellation leaves the session intact. Record whether confirmation exists rather than requiring one.

2. **Action:** Click Delete Session again and complete any confirmation.

   **Expected:** The disposable session is removed and cannot remain a usable current session.

3. **Action:** Reload Home → Select Existing Session.

   **Expected:** QA Delete RUN_ID is absent; A/B remain selectable.

4. **Action:** Select A and inspect Manage Sessions.

   **Expected:** A’s details and instructor list remain intact.

## Evidence and result

Capture the selected target before deletion and the remaining session list afterward. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

No additional deletion is necessary.
