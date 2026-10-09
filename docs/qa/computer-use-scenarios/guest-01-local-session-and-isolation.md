# GUEST-01 — Create a guest session and isolate guest data

**Priority:** P1  
**Accounts:** Guest, SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Use a dedicated browser profile with no existing guest data. Open `/sign-in`; choose Continue as guest.

## Steps and expected results

1. **Action:** On Home click Start New Session. Set Monday, Fall, 2026, dates 2026-09-14 to 2026-12-07, times 16:00 to 17:30, Display Location QA Guest RUN_ID, and Included Raw Locations QA Pool A. Click Save Session.

   **Expected:** The guest session is created and selected.

2. **Action:** Open Manage Sessions; set Number of instructors to 1, commit with Enter, name it QA Guest Teacher, and click Save Changes.

   **Expected:** The instructor name persists; account-link search is not offered to the guest.

3. **Action:** Reload and use Home → Select Existing Session.

   **Expected:** The guest session can be selected with its saved details.

4. **Action:** Sign in as SUPERVISOR_A and open the existing-session list.

   **Expected:** The guest session is absent from the signed-in account’s list.

5. **Action:** Log out, Continue as guest, and reopen the guest session.

   **Expected:** Its details remain in this browser; no supervisor-only session is present.

## Evidence and result

Capture the guest session before reload and both account-scoped session lists. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Delete only QA Guest RUN_ID using Manage Sessions → Delete Session. Do not clear the whole browser’s data.
