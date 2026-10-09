# ACCESS-02 — Edit and restore an account profile

**Priority:** P1  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Open `/account`. Record the original First name, Last name, and Default work location. Run before linking/name-sensitive scenarios.

## Steps and expected results

1. **Action:** Set First name to QA, Last name to Profile Check, and Default work location to QA Profile Pool. Click Save Profile.

   **Expected:** A successful save is shown without changing account identity.

2. **Action:** Reload `/account`.

   **Expected:** All three values persist.

3. **Action:** Log out, sign in again, and revisit Account.

   **Expected:** The saved profile remains associated with this account.

4. **Action:** Restore all three original values and click Save Profile; reload.

   **Expected:** The original profile is restored.

## Evidence and result

Capture the saved and restored profile, excluding private credentials. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Restore the original values even if a later step fails. Do not accept or decline team invitations.
