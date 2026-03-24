# Frontend Feature Test Cases

This document is an automated-first test inventory for the current frontend. It is meant to guide step-by-step implementation, starting with the most deterministic cases before broader page flows.

## Legend
- `P0`: highest-value tests to implement first
- `P1`: important follow-up coverage after `P0`
- `P2`: lower-priority or polish coverage
- `unit`: pure functions and deterministic transformations
- `hook`: hook-level state and side-effect logic
- `integration`: rendered component/page behavior with mocked dependencies
- `manual-later`: real-browser or real-service validation deferred until after automated coverage exists

## Current Constraints
- The frontend currently has no test runner configured.
- This file is a test-case plan only; it does not set up Vitest, React Testing Library, or Playwright.
- Implementation order should follow route/feature order from `frontend/src/app/routes.tsx`, while still doing pure utility tests first within each feature.

## 1. App Shell And Routing

### P0
- `integration` `app/routes.tsx`: root route renders `DashboardPage` for the normal authenticated flow.
- `integration` `app/routes.tsx`: `/requests` renders `SignInPage` for guest users.
- `integration` `app/routes.tsx`: `/requests` renders the full-time access gate message for non-full-time authenticated users.

### P1
- `integration` `components/Layout/Layout.tsx`: page title updates when navigating between major routes.
- `integration` `components/Layout/Layout.tsx`: current session/team/term labels render the expected values from context.

## 2. Sign In

### P0
- `integration` `features/auth/SignInPage.tsx`: submit calls the auth flow with entered credentials.
- `integration` `features/auth/SignInPage.tsx`: auth failure surfaces the expected error state.

### P1
- `integration` `features/auth/SignInPage.tsx`: successful sign-in redirects into the app shell.

## 3. Account

### P0
- `integration` `features/account/AccountPage.tsx`: loads profile and invite data on mount.
- `integration` `features/account/AccountPage.tsx`: save profile sends updated fields and refreshes local UI state.
- `integration` `features/account/AccountPage.tsx`: accept invite updates the pending invite list and membership state.
- `integration` `features/account/AccountPage.tsx`: decline invite removes the invite from the visible list.

## 4. Team

### P0
- `integration` `features/teams/TeamPage.tsx`: loads owned teams and member teams on entry.
- `integration` `features/teams/TeamPage.tsx`: create team adds the created team to page state.
- `integration` `features/teams/TeamPage.tsx`: search flow filters or finds teams using the current query.
- `integration` `features/teams/TeamPage.tsx`: invite flow submits the invite and refreshes pending invites.

### P1
- `integration` `features/teams/TeamPage.tsx`: revoke invite removes the pending invite from state.
- `integration` `features/teams/TeamPage.tsx`: update locations persists the edited location list.
- `integration` `features/teams/TeamPage.tsx`: share-session flow submits the selected session/date/team target.
- `integration` `features/teams/TeamPage.tsx`: remove-member flow updates the visible team member list.

## 5. Dashboard

### P0
- `integration` `features/dashboard/DashboardPage.tsx`: selecting a guest/local session updates current session scope correctly.
- `integration` `features/dashboard/DashboardPage.tsx`: selecting a database session updates current session scope correctly.
- `integration` `features/dashboard/DashboardPage.tsx`: opening a shared session switches into the expected shared-session scope.

### P1
- `integration` `features/dashboard/DashboardPage.tsx`: full-time team/year/season selectors narrow the session list correctly.
- `integration` `features/dashboard/DashboardPage.tsx`: save session submits the expected session and instructor payload.
- `integration` `features/dashboard/DashboardPage.tsx`: session display labels render the expected title text for selected sessions.

## 6. Manage Sessions

### P0
- `integration` `features/sessions/ManageSessionsPage.tsx`: loads existing team sessions on entry.
- `integration` `features/sessions/ManageSessionsPage.tsx`: edit session flow updates instructor list state in the form.
- `integration` `features/sessions/ManageSessionsPage.tsx`: update session submits the normalized payload.
- `integration` `features/sessions/ManageSessionsPage.tsx`: delete session removes the session and clears current scope when required.

## 7. Print

### P0
- `unit` `features/print/PrintPage.tsx` helpers: generated-date, session-week, and month-day formatting return stable labels.
- `unit` print payload builders: schematic, masterlist, and day-one payload construction returns the expected shapes.
- `integration` `features/print/PrintPage.tsx`: print option modals open and close correctly for each print type.

### P1
- `integration` `features/print/PrintPage.tsx`: instructor packet refresh path calls the expected cache and refresh helpers.
- `integration` `features/print/PrintPage.tsx`: print action dispatches the correct PDF/window helper for the selected mode.

## 8. Rosters

### P0
- `hook` `features/rosters/hooks/useRosterFilters.ts`: filters by instructor, level, and text query correctly.
- `unit` `features/rosters/fullTimePlanning.ts`: request CSV parsing accepts required headers and rejects malformed inputs.
- `unit` `features/rosters/fullTimePlanning.ts`: auto-assignment matches by normalized phone number when there is a unique phone match.
- `unit` `features/rosters/fullTimePlanning.ts`: sibling-phone cases require first-name confirmation before assignment.
- `unit` `features/rosters/fullTimePlanning.ts`: fallback exact-name and fuzzy-name matches are assigned and marked for manual review when phone matching fails.
- `unit` `features/rosters/fullTimePlanning.ts`: unmatched requests are marked `student_not_registered`.
- `unit` `features/rosters/fullTimePlanning.ts`: matched request counts are aggregated per class plus requested instructor.
- `unit` `features/rosters/fullTimePlanning.ts`: auto-assignment updates roster instructor values based on the strongest accommodated request count.
- `unit` `features/rosters/fullTimePlanning.ts`: instructor-period splitting returns `allDay` when no common break exists and returns `am`/`pm` when a break larger than 30 minutes exists across all columns.
- `integration` `features/rosters/RostersPage.tsx`: default roster list filters and searches by class code, student name, and phone number.
- `integration` `features/rosters/RostersPage.tsx`: roster-level and student-level edits persist expected changes through the edit hooks.
- `integration` `features/rosters/components/CustomRostersPanel.tsx`: custom roster creation, edit, and delete update visible roster groups.
- `integration` `features/rosters/RostersPage.tsx`: full-time roster upload loads classes and populates day and level filters.
- `integration` `features/rosters/RostersPage.tsx`: clear-all-assignments resets both class-level and student-level instructor values.
- `integration` `features/rosters/RostersPage.tsx`: full-time instructor tab persists `allDay`, `am`, and `pm` assignments.
- `integration` `features/rosters/RostersPage.tsx`: request list add, edit, and delete flows update stored request entries.
- `integration` `features/rosters/RostersPage.tsx`: request CSV import appends parsed requests with clean default flags.
- `integration` `features/rosters/RostersPage.tsx`: bulk auto-assign updates matched fields and syncs roster instructor assignment.
- `integration` `features/rosters/RostersPage.tsx`: single-request reattempt assignment only updates that request plus derived counts and roster sync.
- `integration` `features/rosters/components/FullTimeRequestListPanel.tsx`: non-accommodated filter shows only unresolved requests.
- `integration` `features/rosters/components/FullTimeRequestListPanel.tsx`: selecting `other` as the reason reveals a note field and persists the note.
- `integration` `features/rosters/RostersPage.tsx`: full-time selected-class panel shows linked requests for the selected schematic class.
- `integration` `features/rosters/RostersPage.tsx`: selected-class actions can mark one or all accommodated requests as `conflicting_request`.

### P1
- `integration` `features/rosters/fullTimeStorage.ts`: request and instructor-assignment storage loads normalized data and survives partial/malformed stored values.
- `integration` `features/rosters/hooks/useCustomRosters.ts`: custom-roster persistence restores saved custom rosters correctly across reload boundaries.

## 9. Schematic

### P0
- `unit` `features/schematic/utils/layout.ts`: non-overlapping classes are placed into stable columns in time order.
- `unit` `features/schematic/utils/layout.ts`: request-aware layout prefers an existing locked instructor lane when the course fits.
- `unit` `features/schematic/utils/drag.ts`: drag helpers allow legal swaps and reject overlaps or locked-class moves.
- `unit` `features/schematic/utils/courses.ts`: `buildCourses` produces correctly ordered course objects with request metadata when instructor assignments exist.
- `integration` `features/schematic/hooks/useSchematicSchedule.ts`: standard schematic loads saved layout and request-aware layout inputs correctly.
- `integration` `features/schematic/hooks/useSchematicBoard.ts`: locked/requested classes remain selectable as single selections.
- `integration` `features/schematic/hooks/useSchematicBoard.ts`: dragging movable classes updates columns for legal moves.
- `integration` `features/schematic/SchematicPage.tsx`: page switches between standard and full-time schematic flows correctly based on account/session context.

### P1
- `integration` `features/schematic/components/SchematicBoard.tsx`: add/remove temporary column controls change board shape correctly.
- `integration` `features/schematic/hooks/useFullTimeSchematicView.ts`: full-time schematic renders with request-aware lanes and expected instructor labels.

## 10. Report Cards

### P0
- `unit` `features/report-cards/ReportCardsPage.tsx` helpers: level and instructor normalization return expected normalized values.
- `integration` `features/report-cards/ReportCardsPage.tsx`: page loads employee totals for the selected context.

### P1
- `integration` `features/report-cards/ReportCardsPage.tsx`: changing day/session/team-term inputs triggers the correct reload path.
- `integration` `features/report-cards/ReportCardsPage.tsx`: sync action submits the expected report-card payload and updates local status.

## 11. Staff Notes

### P0
- `unit` `features/staff-notes/utils/reportData.ts`: report section normalization and conversion utilities return expected shapes.
- `unit` `features/staff-notes/utils/storage.ts`: note/todo/report storage helpers read and write the expected data structures.
- `integration` `features/staff-notes/StaffNotesPage.tsx`: tab switching shows note, todo, and report sections correctly.
- `integration` `features/staff-notes/StaffNotesPage.tsx`: load-from-db hydrates the current note, todo, and report state.
- `integration` `features/staff-notes/StaffNotesPage.tsx`: note create, update, and delete flows mutate state and persistence correctly.
- `integration` `features/staff-notes/StaffNotesPage.tsx`: todo create, update, and delete flows mutate state and persistence correctly.

### P1
- `integration` `features/staff-notes/hooks/useReportInstructorOptions.ts`: instructor options derive correctly from the current session/team context.
- `integration` `features/staff-notes/hooks/useSessionReports.ts`: report save and update paths persist the expected section payload.

## 12. Session Planning

### P0
- `unit` `features/session-planning/utils/plannerDrag.ts`: move rules, swap rules, and ordering constraints behave correctly.
- `unit` `features/session-planning/utils/plannerPresentation.ts`: derived display values for the planner board are stable and correct.
- `unit` `features/session-planning/utils/plannerEmailDraft.ts`: email draft output contains the expected class and participant details.
- `integration` `features/session-planning/SessionPlanningPage.tsx`: dataset import hydrates planner state correctly.
- `integration` `features/session-planning/SessionPlanningPage.tsx`: export path produces the expected dataset shape and file trigger.
- `integration` `features/session-planning/SessionPlanningPage.tsx`: call modal and planned-changes modal open, save, and close correctly.

### P1
- `integration` `features/session-planning/hooks/usePlannerShareSession.ts`: shared-session lifecycle updates URL and state correctly.
- `integration` `features/session-planning/hooks/usePlannerViewModel.ts`: board interactions update the derived planner view-model correctly.

## 13. Requests

### P0
- `unit` `features/requests/requestsAnalysis.ts`: request CSV parsing handles expected headers and row normalization.
- `unit` `features/requests/requestsAnalysis.ts`: analysis groups requests by instructor, day, and class using normalized person-name and day-token logic.
- `integration` `features/requests/RequestsPage.tsx`: request upload plus roster upload enables the analyze flow.
- `integration` `features/requests/RequestsPage.tsx`: analyze action produces the expected summary buckets and totals.
- `integration` `features/requests/RequestsPage.tsx`: add, edit, and delete assignment flows update draft and saved assignments correctly.

### P1
- `integration` `features/requests/RequestsPage.tsx`: auto-assign-missing fills remaining assignment gaps correctly.
- `integration` `features/requests/utils/assignmentKeys.ts`: assignment key and sort helpers produce stable ordering and deduplication keys.

## 14. Full-Timer Tools

### P0
- `integration` `features/full-timer-tools/FullTimerToolsPage.tsx`: term year and season selection changes the available data set correctly.
- `integration` `features/full-timer-tools/FullTimerToolsPage.tsx`: generate action submits the expected request and updates UI state.

## 15. Shared And Pure Utility Coverage

### P0
- `unit` `shared/csv/csvUtils.ts`: CSV parsing, header normalization, header index building, and value lookup behave correctly for expected and malformed header input.
- `unit` `shared/session/sessionLabels.ts`: day labels, year resolution, term labels, and session display labels return expected values.
- `unit` `features/schematic/utils/capacity.ts`: capacity helpers return expected capacity values and class names.
- `unit` `features/schematic/utils/time.ts`: time conversion and label-building functions return stable outputs.
- `unit` `features/schematic/utils/courseCode.ts`: course-code parsing and normalization behave correctly for valid and invalid inputs.
- `unit` `features/rosters/utils.ts`: roster grouping and empty-state helpers return expected outputs from representative roster inputs.

### P1
- `unit` `app/useCurrentTerm.ts`: term key formatting and parsing round-trip correctly.
- `unit` `app/CsvImportFlowContext.tsx` pure helpers: candidate labeling and merge helpers behave correctly when separated from UI orchestration.

## 16. Deferred Manual-Smoke Coverage

### Manual Later
- `manual-later` sign-in happy path against real authentication.
- `manual-later` print flows that open real PDFs or windows in the browser.
- `manual-later` browser-storage persistence across full reloads and identity switches.
- `manual-later` drag and drop fidelity for schematic and planner interactions in a real browser.
- `manual-later` large CSV imports and performance-sensitive pages under production-like data volume.
- `manual-later` real shared-session and team permission combinations across multiple accounts.

## Recommended Step-By-Step Implementation Order
1. Shared pure utilities (`shared/csv`, `shared/session`, schematic utils, roster/request analysis utils).
2. App shell and routing guards.
3. Auth, account, and team flows.
4. Dashboard and manage-sessions flows.
5. Requests analysis and assignment flows.
6. Rosters and full-time request planning flows.
7. Schematic board and layout behavior.
8. Staff notes and report-cards state flows.
9. Session-planning utilities and modals.
10. Print and remaining full-time tools coverage.
