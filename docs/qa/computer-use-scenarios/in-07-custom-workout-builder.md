# IN-07 — Build and persist a structured workout

**Priority:** P1  
**Accounts:** INSTRUCTOR_A

## Before starting

Read the [runner guide](README.md). Use the supplied `BASE_URL`, private credentials, and run manifest. All actions below use visible UI.

Session A is the disposable Monday session at QA Pool A, with `session-a-rosters.csv` loaded. See [setup](setup.md) for exact records and assignments. Complete [instructor linking](ds-12-link-instructor-accounts.md). INSTRUCTOR_A has courses 91001, 91003, and 91004; INSTRUCTOR_B has 91002. Use 91004 / Splash Fitness for week 2026-09-14. A workout-capable curriculum skill must be available; record its visible label.

## Steps and expected results

1. **Action:** Add a row and select Workout 300m. Inspect its prescribed workout, then click Use custom workout.

   **Expected:** The row displays a prescribed workout; Workout builder opens with Warm-up, Main set, and Cool-down sections.

2. **Action:** Set Workout title to QA Workout RUN_ID. Add one set to each section: warm-up 1 × 25 m, main set 2 × 50 m, cool-down 1 × 25 m. Set Stroke / drill to Front crawl on each.

   **Expected:** Workout preview totals 150 m and reflects all three sections.

3. **Action:** Click Use workout. Set the lesson row duration to 15 minutes; pause and reload.

   **Expected:** The structured workout summary and 15-minute duration persist. Distance does not silently estimate or replace lesson time.

4. **Action:** Click Use custom workout again.

   **Expected:** A fresh builder opens; it does not prepopulate the previous custom workout. Closing it leaves the saved row unchanged.

5. **Action:** Change the row skill to Pace Clocks and Timers; cancel the conversion confirmation.

   **Expected:** The original workout remains intact.

6. **Action:** Repeat the skill change and accept conversion. Pause and reload.

   **Expected:** Workout instructions remain readable as text under the new skill; the workout builder is no longer offered for that ordinary skill.

## Evidence and result

Capture prescribed/default content, 150 m preview, persisted summary, fresh builder, and conversion result. Record actual results by step using the README result template. PASS requires every mandatory assertion; FAIL means an observed mismatch; BLOCKED means a required prerequisite or interaction capability is missing. Report any passed steps before a blocker.

## Cleanup

Retain the converted synthetic plan or restore the original skill with a newly built workout if later evidence needs it; record the final state.
