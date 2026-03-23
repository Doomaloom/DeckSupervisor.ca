# Frontend Function Inventory

This file maps what each app/page/component/hook module currently defines and what it depends on, with an eye toward reuse and future extraction.

## Shared Reuse Hubs

### `frontend/src/shared/session/sessionLabels.ts`
- Exports:
  - `getDayLabel`
  - `getYearFromDate`
  - `resolveSessionYear`
  - `formatSessionTermLabel`
  - `formatSessionDisplayName`
- Current consumers:
  - `components/Layout/Layout.tsx`
  - `features/dashboard/DashboardPage.tsx`
  - `features/sessions/ManageSessionsPage.tsx`
  - `features/full-timer-tools/FullTimerToolsPage.tsx`
  - `features/schematic/hooks/useFullTimeSchematicView.ts`
  - `features/schematic/hooks/useSchematicSchedule.ts`
  - `features/rosters/hooks/useRosterPrint.ts`
  - `lib/reportCardSync.ts`
- Reuse status: shared and active.

### `frontend/src/shared/csv/csvUtils.ts`
- Exports:
  - `parseCsvText`
  - `normalizeCsvHeader`
  - `buildCsvHeaderIndex`
  - `hasAnyCsvHeader`
  - `getCsvHeaderValue`
- Current consumers:
  - `lib/csv.ts`
  - `lib/sessionPlanner.ts`
  - `features/requests/requestsAnalysis.ts`
- Reuse status: shared and active.

### `frontend/src/features/requests/utils/assignmentKeys.ts`
- Exports:
  - `formatDayLabel`
  - `buildRosterClassKey`
  - `buildAssignmentKey`
  - `sortAssignments`
- Current consumers:
  - `features/requests/RequestsPage.tsx`
- Reuse status: feature-local shared helper.

## App Shell

### `app/App.tsx`
- Local functions:
  - `App`
- Uses:
  - router shell
  - `Layout`
  - `CsvImportFlowProvider`
  - `AppRoutes`
- Reuse note: orchestration-only; keep thin.

### `app/AuthContext.tsx`
- Local functions:
  - `AuthProvider`
  - `useAuth`
  - `applySession`
- Uses:
  - auth/session APIs
  - storage scope changes
- Reuse note: keep app-level only.

### `app/CsvImportFlowContext.tsx`
- Local functions:
  - `createLocalId`
  - `buildInstructorUploadConfig`
  - `mergeInstructorUploadConfigs`
  - `loadAutofillAssignments`
  - `getCandidateLabel`
  - `toGuestCandidates`
  - `CsvImportFlowProvider`
  - `useCsvImportFlow`
  - `inspectCsv`
  - `createGuestSessionFromCandidate`
  - `createRemoteSessionFromCandidate`
  - `syncPostImportState`
  - `handleSelectCandidate`
- Uses:
  - auth/day/team/term contexts
  - CSV API helpers
  - report-card sync helpers
  - server API session/request endpoints
  - `CsvSessionImportModal`
- Reuse note: several CSV/session transformation helpers are candidates for `features/sessions` or `shared/session`.

### `app/DayContext.tsx`
- Local functions:
  - `DayProvider`
  - `useDay`
  - `setSelectedDay`
- Uses:
  - scoped day storage
- Reuse note: app-level state only.

### `app/routes.tsx`
- Local functions:
  - `RequireFullTime`
  - `AppRoutes`
- Uses:
  - route pages
  - auth context
- Reuse note: keep thin; move guard if route gating grows further.

### `app/useCurrentSession.ts`
- Local functions:
  - `useCurrentSession`
  - `load`
- Uses:
  - auth context
  - current-session storage
  - session fetch APIs
- Reuse note: app-level hook.

### `app/useCurrentTeam.ts`
- Local functions:
  - `useCurrentTeam`
  - `load`
- Uses:
  - auth context
  - team fetch APIs
  - storage-scope updates
- Reuse note: app-level hook.

### `app/useCurrentTerm.ts`
- Local functions:
  - `createTermKey`
  - `formatTermLabel`
  - `parseTermKey`
  - `useCurrentTerm`
- Uses:
  - storage-scope persistence
- Reuse note: `createTermKey` and `formatTermLabel` are already shared across features.

## Shared Components

### `components/CsvSessionImportModal.tsx`
- Local functions:
  - `getCandidateLabel`
  - `CsvSessionImportModal`
- Uses:
  - CSV session types
- Reuse note: could move under `shared/components/` or `features/sessions/components/` depending on future ownership.

### `components/Layout/Layout.tsx`
- Local functions:
  - `Layout`
  - `getPageTitle`
- Uses:
  - day/auth/session/team/term contexts
  - `formatSessionDisplayName`
  - custom roster resolution
  - scoped storage sync
- Reuse note: split target.
  - extract nav config
  - extract profile modal state/UI
  - extract page/session title helpers

## Pages

### `features/account/AccountPage.tsx`
- Local functions:
  - `AccountPage`
  - `loadData`
  - `handleSaveProfile`
  - `handleAcceptInvite`
  - `handleDeclineInvite`
- Uses:
  - auth context
  - account/invite server APIs
- Reuse note: mutation handlers can move into a feature hook if this page grows.

### `features/auth/SignInPage.tsx`
- Local functions:
  - `SignInPage`
  - `handleSubmit`
- Uses:
  - auth context
  - navigation
- Reuse note: small and acceptable as-is.

### `features/dashboard/DashboardPage.tsx`
- Local functions:
  - `getSessionName`
  - `getDbSessionName`
  - `Dashboard`
  - `addInstructor`
  - `updateInstructor`
  - `handleSaveSession`
  - `handleSelectLocalSession`
  - `handleSelectDbSession`
  - `handleOpenSharedSession`
  - `resetCurrentSessionScope`
  - `handleSelectFullTimeTeam`
  - `handleSelectFullTimeYear`
  - `handleSelectFullTimeSeason`
  - `loadTeamSessions`
  - `loadSessionsFromDb`
  - `loadShared`
- Uses:
  - day/auth/team/term contexts
  - `formatSessionDisplayName`
  - `getYearFromDate`
  - `resolveSessionYear`
  - session/team/server APIs
  - storage-scope updates
- Reuse note: high-priority split target.
  - move session-form logic into a hook
  - move team-term derivation into a feature utility
  - move guest/full-time panels into separate subcomponents

### `features/full-timer-tools/FullTimerToolsPage.tsx`
- Local functions:
  - `toTitleCase`
  - `FullTimerToolsPage`
  - `load`
  - `handleSelectTermYear`
  - `handleSelectTermSeason`
  - `handleGenerate`
- Uses:
  - current team/term hooks
  - `getYearFromDate`
  - team-session fetch API
- Reuse note: `toTitleCase` is local; term derivation logic may eventually share a helper with dashboard/team features.

### `features/print/PrintPage.tsx`
- Local functions:
  - `PrintPage`
  - `formatGeneratedDate`
  - `getSessionWeek`
  - `formatMonthDay`
  - modal handlers
  - schematic payload builders
  - PDF/window helpers
  - instructor packet refresh/print handlers
  - masterlist/day-one print handlers
- Uses:
  - day/session hooks
  - storage helpers
  - instructor PDF cache helpers
  - roster grouping helpers
  - session instructor hook
  - print modals/components
  - schematic schedule/capacity helpers
- Reuse note: biggest remaining UI refactor target.
  - extract date helpers
  - extract PDF window helpers
  - extract instructor packet services
  - extract print payload builders

### `features/report-cards/ReportCardsPage.tsx`
- Local functions:
  - `ReportCardsPage`
  - `normalizeLevel`
  - `normalizeInstructor`
  - `loadEmployeeTotals`
  - `sync`
- Uses:
  - auth/session/team/term hooks
  - `getSessionTermLabel`
  - report-card sync APIs
  - day storage
- Reuse note: normalization helpers may be candidates for `features/report-cards/utils/` if reused elsewhere.

### `features/requests/RequestsPage.tsx`
- Local functions:
  - `tabButtonClass`
  - `RequestsPage`
  - `loadAssignments`
  - `handleRequestsUpload`
  - `handleRosterUpload`
  - `handleAnalyze`
  - `beginAssignmentDraft`
  - `handleAddFromSummary`
  - `handleEditAssignment`
  - `resetAssignmentDraft`
  - `handleSaveAssignment`
  - `handleDeleteAssignment`
  - `handleAutoAssignMissing`
- Uses:
  - CSV parsing/extraction APIs
  - request assignment server APIs
  - `parseRequestsCsv`
  - `analyzeInstructorRequests`
  - `buildAssignmentKey`
  - `buildRosterClassKey`
  - `sortAssignments`
  - `formatDayLabel`
- Reuse note: actively split.
  - upload flow, summary rendering, and assignment editor should become separate submodules

### `features/rosters/RostersPage.tsx`
- Local functions:
  - `getFullTimeRostersStorageKey`
  - `saveStoredFullTimeRosters`
  - `convertClassRosterToItem`
  - `sortCoursesByStart`
  - `canFitCourse`
  - `buildPreviewColumns`
  - `RostersPage`
  - `handleToggleStudentLevelEdits`
  - `handleFullTimeRosterUpload`
  - `handleFullTimeInstructorChange`
- Uses:
  - CSV import flow
  - day/team/term/auth/current-session hooks
  - roster data/edit/filter/custom-roster/print hooks
  - browser storage
  - schematic preview components/helpers
- Reuse note: split target.
  - move full-time upload flow out
  - move preview-column helpers to a feature utility

### `features/schematic/SchematicPage.tsx`
- Local functions:
  - `SchematicPage`
  - `tabButtonClass`
- Uses:
  - auth/day/session/team/term hooks
  - `useFullTimeSchematicView`
  - `useSchematicSchedule`
  - schematic board
- Reuse note: page is acceptable; most complexity lives in hooks.

### `features/session-planning/SessionPlanningPage.tsx`
- Local functions:
  - `SessionPlanningPage`
  - `persistLocalDataset`
  - upload/import/export handlers
  - dataset mutation handlers
  - share/call/planned-change handlers
- Uses:
  - planner data helpers from `lib/sessionPlanner`
  - planner share APIs
  - planner components
  - `usePlannerShareSession`
  - `usePlannerViewModel`
  - planner email utility
- Reuse note: split target.
  - page should become orchestration only
  - mutation/import/export actions should move to feature hooks/services

### `features/sessions/ManageSessionsPage.tsx`
- Local functions:
  - `getSessionName`
  - `getDbSessionName`
  - `ManageSessionsPage`
  - `addEditInstructor`
  - `removeEditInstructor`
  - `updateEditInstructor`
  - `loadTeam`
  - `handleUpdateSession`
  - `handleDeleteSession`
- Uses:
  - day/auth/team/current-session hooks
  - `formatSessionDisplayName`
  - `formatSessionTermLabel`
  - `getYearFromDate`
  - `resolveSessionYear`
  - session APIs
  - storage-scope updates
- Reuse note: refactor together with dashboard.

### `features/staff-notes/StaffNotesPage.tsx`
- Local functions:
  - `StaffNotesPage`
  - `createId`
  - `loadTeamTermNotes`
  - `loadFromDb`
  - note/todo mutation handlers
- Uses:
  - auth/session/team/term hooks
  - instructor packet cache
  - Supabase client
  - session report hooks
  - notes/report storage utilities
  - note/todo/report tab components
- Reuse note: high-priority split target.
  - DB loading and tab orchestration should move out of the page file

### `features/teams/TeamPage.tsx`
- Local functions:
  - `getSessionLabel`
  - `TeamPage`
  - `loadTeams`
  - `loadMemberTeams`
  - `loadSessions`
  - `loadTeamDetails`
  - `loadMembers`
  - `handleCreateTeam`
  - `handleSearch`
  - `handleInvite`
  - `handleRevokeInvite`
  - `handleUpdateLocations`
  - `handleShareSession`
  - `handleRemoveMember`
- Uses:
  - auth context
  - Toronto-date helper
  - team storage/APIs
- Reuse note: split into team-search, membership, invites, and session-sharing sections/hooks.

## Feature Components and Hooks

### Print
- `features/print/components/*`
  - Pure UI components around modal shells and print options.
  - Reuse note: keep feature-local.
- `features/print/hooks/useSessionInstructors.ts`
  - Loads instructor names from current session context.
  - Reuse note: feature-local unless another feature needs the same fetch pattern.

### Requests
- `features/requests/requestsAnalysis.ts`
  - Exports:
    - `normalizePersonName`
    - `normalizeDayToken`
    - `parseRequestsCsv`
    - `analyzeInstructorRequests`
  - Uses:
    - shared CSV helpers
    - request/day normalization logic
  - Reuse note: pure-analysis module; good candidate for unit tests first.

### Rosters
- `features/rosters/components/CustomRostersPanel.tsx`
  - Local editor and selection handlers.
  - Uses print hook, time helpers, roster utilities.
  - Reuse note: large local component, but feature-local.
- `features/rosters/hooks/useCustomRosters.ts`
  - Loads/saves custom rosters and level updates.
  - Reuse note: feature-local state hook.
- `features/rosters/hooks/useRosterData.ts`
  - Builds instructor map, applies assignments, loads schematic/edits.
  - Reuse note: candidate for smaller data hook split.
- `features/rosters/hooks/useRosterEdits.ts`
  - Encapsulates level-edit persistence.
  - Reuse note: good feature hook boundary.
- `features/rosters/hooks/useRosterFilters.ts`
  - Encapsulates roster filter state.
  - Reuse note: good feature hook boundary.
- `features/rosters/hooks/useRosterPrint.ts`
  - Uses `formatSessionDisplayName` and attendance PDF printing.
  - Reuse note: PDF/window helpers could eventually move into `features/print` or `shared/browser`.

### Schematic
- `features/schematic/hooks/useFullTimeSchematicView.ts`
  - Local helpers:
    - `normalizeLocation`
    - `normalizeLocationMatch`
    - `locationToKey`
    - `getSessionSeason`
  - Uses:
    - current team/term hooks
    - extracted class storage
    - student storage
    - `getYearFromDate`
    - schematic fetch APIs
  - Reuse note: location normalization could move into a schematic utils module if reused.
- `features/schematic/hooks/useSchematicSchedule.ts`
  - Owns:
    - course ordering
    - fit calculations
    - request-aware layout
    - drag/drop transitions
    - schedule load/save logic
  - Uses:
    - current session hook
    - request assignments API
    - schematic fetch/save APIs
    - instructor PDF prefetch
    - `formatSessionTermLabel`
  - Reuse note: major split target; keep algorithm pieces pure and separately testable.

### Session Planning
- `features/session-planning/components/*`
  - Mostly presentational plus UI event bridging.
  - Reuse note: keep feature-local.
- `features/session-planning/hooks/usePlannerShareSession.ts`
  - Owns shared-session lifecycle and query-param sync.
  - Reuse note: good hook boundary.
- `features/session-planning/hooks/usePlannerViewModel.ts`
  - Owns page projection/view-model shaping.
  - Reuse note: good hook boundary.

### Staff Notes
- `features/staff-notes/hooks/useReportInstructorOptions.ts`
  - Derives instructor options for report tabs.
  - Reuse note: feature-local.
- `features/staff-notes/hooks/useSessionReports.ts`
  - Loads and mutates session report state.
  - Reuse note: candidate for additional extraction if report persistence logic grows.

## Duplication and Extraction Candidates

### Already Consolidated
- Session label/year logic:
  - now centralized in `shared/session/sessionLabels.ts`
- CSV parsing/header access:
  - now centralized in `shared/csv/csvUtils.ts`
- Request assignment key/sort/day-label helpers:
  - now centralized in `features/requests/utils/assignmentKeys.ts`

### Still Worth Extracting Next
- `features/print/PrintPage.tsx`
  - print date helpers
  - PDF/window lifecycle helpers
  - instructor packet refresh helpers
  - print payload builders
- `features/dashboard/DashboardPage.tsx`
  - form-state helpers
  - full-time term/team selection logic
  - shared session selection panels
- `features/sessions/ManageSessionsPage.tsx`
  - edit form sections
  - team-location loading hook
- `features/rosters/RostersPage.tsx`
  - full-time roster upload flow
  - preview-column building
- `features/schematic/hooks/useSchematicSchedule.ts`
  - drag/drop algorithms
  - request-assignment loading
  - persistence layer boundaries
- `features/session-planning/SessionPlanningPage.tsx`
  - import/export actions
  - dataset mutation services
  - modal state orchestration

## Verification Reference
- Latest verification after the current cleanup pass:
  - `cd frontend && npm run build`
  - Status: passes
