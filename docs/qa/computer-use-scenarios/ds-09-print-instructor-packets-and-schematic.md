# DS-09 — Print instructor packets and schematic variants

**Priority:** P1  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete ds-07; assignments must match setup. Use Save as PDF.

## Steps and expected results

1. **Action:** Open `/print` → Print Instructor Sheets. Select QA Alpha’s print action.

   **Expected:** Its packet includes 91001, 91003, and 91004; 91002 is not assigned to Alpha.

2. **Action:** Enable Schematic Coverpage, Landscape, and Highlight Instructor on Cover; print Alpha again.

   **Expected:** The cover is landscape and highlights Alpha; body pages remain readable.

3. **Action:** Choose Print all as one.

   **Expected:** The combined output includes both instructors’ packets and their assigned source classes.

4. **Action:** Close the modal; open Print Schematic. Choose Portrait, enable Highlight Instructor Name, and choose QA Beta.

   **Expected:** Preview contains all four classes, correct times, and Beta’s highlighting.

5. **Action:** Switch Orientation to Landscape, adjust Scale, then click Reset and Print.

   **Expected:** Orientation and scale preview respond; Reset restores the default scale, and printed layout matches the final preview.

6. **Action:** Open Day 1 Print, enable its schematic-cover option, and Print.

   **Expected:** A readable day-one packet is produced for the selected session without another session’s data.

## Evidence and result

Save representative individual, combined, day-one, and schematic outputs. Inspect all pages. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Close previews and restore options to their entry values.
