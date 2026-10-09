# ACCESS-03 — Recover a disposable account password

**Priority:** P1  
**Accounts:** RECOVERY_ACCOUNT

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

A separate disposable account, accessible test mailbox, and privately supplied replacement password are required. Never reset the shared supervisor/instructor accounts. Open `/sign-in`.

## Steps and expected results

1. **Action:** Click Forgot password?, enter the recovery email, and submit the request.

   **Expected:** The UI acknowledges the request without claiming account existence or guaranteeing delivery.

2. **Action:** Open the delivered reset link using the test mailbox UI.

   **Expected:** Reset password appears. If no email arrives within the environment’s supplied delivery window (default five minutes), mark delivery BLOCKED and retain request evidence.

3. **Action:** Enter mismatched new passwords and submit.

   **Expected:** Validation prevents completion; the user can correct the values.

4. **Action:** Enter matching supplied replacement passwords and submit.

   **Expected:** Success returns to sign-in with the password-reset message.

5. **Action:** Attempt the previous password once, then the replacement password.

   **Expected:** The old password fails and the replacement signs in.

6. **Action:** Log out and reopen the used reset link; try to submit again.

   **Expected:** The used link cannot reset the password again; another reset request is offered.

## Evidence and result

Capture validation and success/error messages with tokens and email content excluded. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Leave the replacement password with the run owner privately; log out. Never put either password or the recovery URL in screenshots or committed results.
