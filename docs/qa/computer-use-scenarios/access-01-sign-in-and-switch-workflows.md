# ACCESS-01 — Sign in, switch workflows, and sign out

**Priority:** P0  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Open `/sign-in` in a dedicated test browser. SUPERVISOR_A must have supervisor and instructor-view access. Do not create an account during this scenario.

## Steps and expected results

1. **Action:** Enter the supplied email with an intentionally incorrect password and click Sign in.

   **Expected:** An error appears; the account is not signed in.

2. **Action:** Enter the correct password and click Sign in. Open `/account`.

   **Expected:** The supplied account identity/profile appears; no previous test user is shown.

3. **Action:** Open Home, select Session A if already prepared, then click Instructor View.

   **Expected:** Instructor Home opens with instructor navigation; the account remains signed in. An unlinked empty state is valid when this account has no assignments.

4. **Action:** Click Supervisor View.

   **Expected:** Supervisor navigation returns; a previously selected supervisor session is retained.

5. **Action:** Click Logout, then directly visit `/instructor/my-classes`.

   **Expected:** The sign-in requirement appears; no linked-class content is shown.

6. **Action:** Sign in again with the correct credentials.

   **Expected:** Access is restored without another account’s data flashing into view.

## Evidence and result

Capture failed sign-in, both workflow navigation states, and the signed-out instructor route. Do not capture passwords. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Leave the shared baseline intact for dependent scenarios. Record any remaining changes in the run manifest.
