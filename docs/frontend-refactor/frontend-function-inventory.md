# Frontend Function Inventory

Updated for the workspace refactor on October 8, 2026. Each page directory below contains component, logic, and regression-test files. Logic hooks expose inferred TypeScript view models; rendering imports those hooks rather than redefining effects or loaders.

## Pages and Nested Components

| Page directory under src | Page logic hook | Nested components |
| --- | --- | --- |
| `features/decksupervisor/Dashboard` | `useDashboardLogic` | — |
| `features/decksupervisor/DeviceExport` | `useDeviceExportLogic` | ExportSession |
| `features/decksupervisor/FullTimerTools` | `useFullTimerToolsLogic` | — |
| `features/decksupervisor/ManageSessions` | `useManageSessionsLogic` | — |
| `features/decksupervisor/Print` | `usePrintLogic` | Day1OptionsModal, InstructorOptionsModal, MasterlistOptionsModal, OptionsGroup, PrintModalShell, PrintOptionButton, PrintUpdatesModal, SchematicOptionsModal, SchematicPrintTable, SchematicScaleControl |
| `features/decksupervisor/ReportCards` | `useReportCardsLogic` | — |
| `features/decksupervisor/Requests` | `useRequestsLogic` | RequestsAssignments, RequestsDaySummary, RequestsUnmatched, RequestsUpload |
| `features/decksupervisor/Rosters` | `useRostersLogic` | CustomRostersPanel, FullTimeInstructorAssignmentsPanel, FullTimeRequestListPanel, FullTimeSchedule, InstructorSelect, LevelSelect, RosterCard, RosterFiltersBar, RosterList, RostersTabs, StudentRow |
| `features/decksupervisor/Schematic` | `useSchematicLogic` | CourseCard, FullTimeRostersPanel, InstructorColumn, SchematicBoard |
| `features/decksupervisor/SessionPlanning` | `useSessionPlanningLogic` | PlannerBoard, PlannerCallModal, PlannerDetailsPanel, PlannerHeader, PlannerPlannedChangesModal |
| `features/decksupervisor/StaffNotes` | `useStaffNotesLogic` | LessonStructureSection, NoteTab, ParentFeedbackSection, ProjectsSection, ReportTab, SafetyFacilitySection, StaffSection, TabBar, TodoTab |
| `features/decksupervisor/Team` | `useTeamLogic` | — |
| `features/instructor/ActivityLibrary` | `useActivityLibraryLogic` | ActivityLibraryBrowser, ActivityLibraryModal |
| `features/instructor/Attendance` | `useInstructorPlaceholderLogic` | — |
| `features/instructor/InstructorHome` | `useInstructorHomeLogic` | — |
| `features/instructor/InstructorLayout` | `useInstructorLayoutLogic` | InstructorWorkspace |
| `features/instructor/LessonPlans` | `useLessonPlansLogic` | DurationPicker, LessonEditor, WorkoutBuilderModal |
| `features/instructor/MyClasses` | `useMyClassesLogic` | — |
| `features/instructor/PrintPlans` | `usePrintPlansLogic` | CombinedPlansPrint, PlanPrintPreview, SavedPlanPrint |
| `shared/pages/Account` | `useAccountLogic` | — |
| `shared/pages/ForgotPassword` | `useForgotPasswordLogic` | — |
| `shared/pages/ResetPassword` | `useResetPasswordLogic` | — |
| `shared/pages/SignIn` | `useSignInLogic` | — |

## Shared Reuse Hubs

| Domain | Responsibilities |
| --- | --- |
| `shared/session` | Session labels, instructor session labels, day ordering, source locations, and time inference |
| `shared/csv` | CSV parsing and header lookup |
| `shared/schedule` | Schedule constants and time conversion; reused by both workspaces |
| `shared/levels` | Level normalization used by rosters and instructor curriculum |
| `shared/workouts` | Workout model, validation, distances, and text serialization used by UI/API types |
| `shared/components/TimeRail` | Schedule time rail used by instructor classes and supervisor planning |
| `shared/session-management` | Session selection, forms, instructor editors, identity/collection helpers, and autosave |
| `shared/pdf` | Lazy PDF rendering, fonts, PDF artifacts, schematic/masterlist/session-report/lesson-plan documents |
| `shared/attendance-print` | HTML attendance templates, compatibility CSS, document construction, and popup printing |
| `shared/masterlist` | Formatting and layout controls shared by print options |

## Feature Services and Support

- DeviceExport services own package construction, registry persistence, and course loading.
- Print services own PDF API adapters, cache prefetch, and roster updates; payload builders remain separately tested utilities.
- Instructor session context and class hooks stay under `features/instructor/session`; PlanSelection is instructor-owned.
- LessonEditor logic owns serialization, autosave, dirty-navigation signals, duration calculations, edits, row reordering, and pointer dragging. Workout UI/presets are nested beneath LessonEditor; the workout model is shared.
- Existing focused roster, schematic, planner, staff-note, and session-management hooks retain their individual responsibilities.
- Routing, global providers, server transport, storage adapters, the existing app layout, and the general component library stay in their original top-level directories.
