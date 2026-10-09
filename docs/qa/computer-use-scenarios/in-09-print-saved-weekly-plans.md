# IN-09 — Print saved plans and handle weeks without plans

**Priority:** P0  
**Accounts:** INSTRUCTOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Complete in-04 through in-07. Record the final row content and choose 2026-09-14 explicitly. Use Save as PDF.

## Steps and expected results

1. **Action:** Open `/instructor/print`, select A and 2026-09-14.

   **Expected:** Live Preview contains saved plans from A’s linked classes for this week; Print PDF becomes available.

2. **Action:** Inspect preview pages for 91001, private 91003, and fitness 91004.

   **Expected:** Class/session/date labels and saved activity text, library instructions, locations, and durations match the editors. No 91002 or swimmer roster appears.

3. **Action:** Click Print PDF and save. Inspect all pages in the visible PDF viewer.

   **Expected:** No clipped rows, overlapping text, missing activity content, or unreadable page breaks.

4. **Action:** Choose unused week 2026-09-28.

   **Expected:** No saved lesson plans for this week. appears and Print PDF is absent; the previous week’s preview is not left visible.

5. **Action:** Visit that week’s lesson editor and then return to Print without editing.

   **Expected:** It remains an unsaved week with no printable plan.

6. **Action:** Return to 2026-09-14.

   **Expected:** The original saved preview returns without being overwritten.

## Evidence and result

Save the combined PDF plus screenshots of a long activity row and the no-plan state. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Close print tabs. Retain the synthetic PDFs and leave plans available for isolation tests.
