# DS-16 — Export instructor classes and restore date/ID backups

**Priority:** P0  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete ds-05 and ds-07. A second clean browser profile signed into the same supervisor is required for restore. Raw download internals are outside this UI-only test.

## Steps and expected results

1. **Action:** Open `/device-exports`, wait for loading to finish, and select QA Alpha. Expand the displayed classes.

   **Expected:** Only 91001, 91003, and 91004 belong to this selection, with four booked swimmers in total.

2. **Action:** In Lesson dates for 91001 retain only 2026-09-14 and 2026-09-21, one per line. Click Download instructor classes.

   **Expected:** A download completes without a validation error.

3. **Action:** Select QA Beta and download.

   **Expected:** The displayed selection contains only 91002 and QA Casey; the download completes.

4. **Action:** Click Download ID backup. Reload A and select Alpha again.

   **Expected:** The reviewed dates for 91001 are retained.

5. **Action:** In a clean second browser signed into SUPERVISOR_A, select A and load its roster CSV. Open Device Exports and Restore ID backup with the downloaded backup.

   **Expected:** Restore succeeds; selecting Alpha shows the same two reviewed dates. A subsequent download succeeds.

6. **Action:** In that second browser select B and attempt to restore A’s backup.

   **Expected:** A mismatched-session backup is rejected without replacing B’s export state.

## Evidence and result

Capture selection lists, reviewed/restored dates, download completion, and rejected restore. Do not claim UUID equality or schema validation from download success alone. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Keep the backup private to the test run. Restore A’s full date list from setup after evidence if later tests require it. Do not clear export IDs.
