# Frontend Feature Architecture

Implemented October 8, 2026. This replaces the previous flat feature layout.

## Ownership

- `src/features/decksupervisor/`: Dashboard, ManageSessions, DeviceExport, Print, Rosters, Schematic, ReportCards, StaffNotes, FullTimerTools, Requests, Team, and SessionPlanning.
- `src/features/instructor/`: InstructorHome, MyClasses, LessonPlans, ActivityLibrary, PrintPlans, and Attendance, plus instructor layout, plan selection, and session context.
- `src/shared/pages/`: SignIn, ForgotPassword, ResetPassword, and Account.
- `src/shared/`: reusable components, session-management support, scheduling/time helpers, level normalization, workout models, PDF generation, attendance printing, and masterlist controls, alongside the existing session and CSV utilities.

Shared modules do not import either feature workspace. Pages within the same workspace may reuse each other's components and helpers; cross-workspace reuse belongs in shared. The existing app providers, infrastructure in lib, general-components library, and components directory retain their ownership.

## Module Convention

Each page has a PascalCase folder containing `Name.component.tsx`, `Name.logic.ts`, and `Name.test.tsx`. The component renders the UI and wires event callbacks. The logic module owns state, effects, computed values, and actions, exposed through a typed hook return value. Static pages put their presentation data in the logic module.

Subcomponents live in their own directories under the owning page and use the same file naming. Subcomponents with state or substantial behavior have a logic module; purely presentational components do not need one. Existing focused hooks, utility tests, constants, types, and assets remain separate. Services folders contain feature-specific export, persistence, and printing operations where already appropriate; infrastructure remains in lib.

Large views have been separated into lesson editing/workout building, print previews and options, device export sessions, roster schedules, request uploads/day summaries/unmatched requests/assignments, planner panels, staff-note sections, and team rendering/logic. Existing named exports used by consumers and integration tests remain available from their component modules.

## Compatibility and Verification

Routes, guards, provider placement, component keys, API payloads, storage keys, event names, and print/download gesture timing are preserved. There are no backend changes or storage migrations. Dynamic imports, browser fixture entrypoints, test mocks, and curriculum-generation paths use the new locations.

See `frontend-feature-test-cases.md` for verification results and `frontend-function-inventory.md` for current ownership.
