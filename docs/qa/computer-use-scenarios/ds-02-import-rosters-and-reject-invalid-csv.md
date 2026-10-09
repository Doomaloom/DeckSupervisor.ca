# DS-02 — Import synthetic rosters and reject malformed CSV

**Priority:** P0  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Use the fixture files in [fixtures](fixtures/). This scenario can create baseline Session A; record its ID/context in the run manifest.

## Steps and expected results

1. **Action:** On Home click Upload CSV and Choose Session; choose `fixtures/invalid-rosters.csv`.

   **Expected:** An import error or no usable-session state appears; no new usable session/roster is created.

2. **Action:** Close the import dialog. Upload `fixtures/session-a-rosters.csv`.

   **Expected:** The session chooser identifies Monday, QA Pool A, the fixture date range, four classes, and five swimmers.

3. **Action:** Choose the QA Pool A candidate, using Load Existing Session when A already exists, otherwise Create New Session.

   **Expected:** The chosen session becomes active; processing completes.

4. **Action:** Open `/rosters`. Search 91001, then QA Devon, clearing Search between queries.

   **Expected:** 91001 shows QA Avery and QA Blair; QA Devon belongs to private course 91003. The unfiltered view contains all four fixture classes.

5. **Action:** Reload, then repeat the valid upload and choose the existing candidate.

   **Expected:** The same session is reused; neither classes nor swimmers are duplicated.

## Evidence and result

Capture candidate counts, malformed-file result, and the 91001 roster. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Leave the shared baseline intact for dependent scenarios. Record any remaining changes in the run manifest.
