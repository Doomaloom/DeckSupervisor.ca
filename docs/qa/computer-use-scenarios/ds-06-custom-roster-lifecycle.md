# DS-06 — Combine same-time classes into a custom roster

**Priority:** P1  
**Accounts:** SUPERVISOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Prepare instructor names via setup. Courses 91001 and 91002 share the 16:00 time slot.

## Steps and expected results

1. **Action:** Open Rosters → Custom Rosters → Create New Custom Roster. Choose Splash 1 and QA Alpha.

   **Expected:** The editor offers source classes and student selection.

2. **Action:** Select source 91001, then 91002. Inspect availability of 91003.

   **Expected:** Same-time 91002 can be selected; different-time 91003 is not available for combining into this group.

3. **Action:** Select QA Avery and QA Casey only and click Create Custom Roster.

   **Expected:** One custom roster contains exactly those two swimmers.

4. **Action:** Reload; click Edit on that custom roster and add QA Blair; click Save Changes.

   **Expected:** The group contains exactly three selected swimmers after reload.

5. **Action:** Click its Print button and inspect output.

   **Expected:** The custom level, instructor, and selected swimmers appear once each.

6. **Action:** Delete this custom roster; revisit the ordinary Rosters tab.

   **Expected:** The custom group disappears while all four source classes and their original swimmers remain.

## Evidence and result

Capture same-time selection, edited membership, printed output, and intact source rosters. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Remove only the created custom roster.
