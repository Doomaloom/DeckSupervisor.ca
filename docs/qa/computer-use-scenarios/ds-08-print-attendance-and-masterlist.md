# DS-08 — Print attendance and format a masterlist

**Priority:** P0  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete ds-05 and ds-07. Allow preview popups and use Save as PDF; no physical printing.

## Steps and expected results

1. **Action:** Open Rosters, find 91001, and click its Print button.

   **Expected:** Attendance output contains QA Avery and QA Blair, correct class/time, and readable unclipped columns.

2. **Action:** Open `/print` → Print Masterlist.

   **Expected:** Masterlist Options opens with a Live Preview for the selected session.

3. **Action:** Change Font Size to 12 and choose another available Time Header Style and Course Header Style; record selections.

   **Expected:** The preview refreshes and reflects the selected formatting without missing roster content.

4. **Action:** Enable Include Schematic Coverpage and choose Landscape. Click Print and save the PDF.

   **Expected:** A landscape schematic cover precedes the masterlist; all four courses and five baseline swimmers are present.

5. **Action:** Inspect every page at readable zoom, including page edges and breaks.

   **Expected:** Text is not clipped or overlapping; headings match A, and B’s QA Morgan is absent.

## Evidence and result

Save attendance and masterlist PDFs plus screenshots of cover and body pages; report visual inspection only. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Close preview tabs and restore format selections recorded at entry. Retain PDFs with run evidence.
