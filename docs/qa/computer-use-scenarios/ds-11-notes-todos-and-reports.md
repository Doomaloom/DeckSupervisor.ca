# DS-11 — Persist session notes, todos, and reports

**Priority:** P1  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Session B also exists. Open `/staff-notes`.

## Steps and expected results

1. **Action:** In General Session Notes enter QA note RUN_ID in Write a note, then Add Note.

   **Expected:** The note appears once in A.

2. **Action:** Open Todo, enter QA todo RUN_ID, click Add Todo, and check its completion box.

   **Expected:** The todo is visibly completed.

3. **Action:** Open Report → Create New Report. Set Report Title to QA report RUN_ID; add one safety concern with text QA slippery edge RUN_ID.

   **Expected:** A report and its entered section data are displayed.

4. **Action:** Wait for edits to settle, navigate away, return, then reload.

   **Expected:** The note, completed todo, report title, and safety text persist. No invented Save button is required for report autosave.

5. **Action:** Select B and open Notes.

   **Expected:** A’s uniquely tagged entries are absent.

6. **Action:** Return to A; delete the tagged note and todo and use Delete Report on the tagged report. Reload.

   **Expected:** Only the test entries disappear.

## Evidence and result

Capture persisted values after reload, B’s isolation, and cleanup. If autosave fails, capture its visible message and whether the draft remains. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Remove all RUN_ID entries; retain unrelated records.
