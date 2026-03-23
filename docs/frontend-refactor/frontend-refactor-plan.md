# Frontend Refactor Plan

## Current Baseline
- Frontend stack: React 18, Vite 5, TypeScript, Tailwind.
- Build status after the first cleanup pass: `npm run build` succeeds.
- There is still no frontend test harness in the repo.
- The main maintainability problem is concentrated in a small set of oversized page/view-model files rather than the entire codebase.

## Groundwork Completed
- Added shared CSV helpers in `frontend/src/shared/csv/csvUtils.ts`.
- Added shared session-label helpers in `frontend/src/shared/session/sessionLabels.ts`.
- Added request assignment helpers in `frontend/src/features/requests/utils/assignmentKeys.ts`.
- Rewired duplicated session/date logic in:
  - `frontend/src/components/Layout/Layout.tsx`
  - `frontend/src/features/dashboard/DashboardPage.tsx`
  - `frontend/src/features/sessions/ManageSessionsPage.tsx`
  - `frontend/src/features/full-timer-tools/FullTimerToolsPage.tsx`
  - `frontend/src/features/schematic/hooks/useFullTimeSchematicView.ts`
  - `frontend/src/features/rosters/hooks/useRosterPrint.ts`
  - `frontend/src/features/schematic/hooks/useSchematicSchedule.ts`
  - `frontend/src/lib/reportCardSync.ts`
- Rewired duplicated CSV parsing/header access logic in:
  - `frontend/src/lib/csv.ts`
  - `frontend/src/lib/sessionPlanner.ts`
  - `frontend/src/features/requests/requestsAnalysis.ts`

## Target Structure
Use a clearer ownership model under `frontend/src`:

- `app/`
  - App bootstrapping, routing, guards, and global providers only.
- `shared/`
  - Cross-feature utilities, generic hooks, and reusable domain helpers.
  - Initial shared modules now live here for session labels and CSV parsing.
- `features/<feature>/`
  - Each feature owns its page, subcomponents, hooks, utils, constants, and types.
  - Cross-feature concerns should only leave the feature when reuse is proven.
- `lib/`
  - Keep only infrastructure and transport concerns here: server/API adapters, browser storage, Supabase setup, and low-level persistence.
- `components/`
  - Reduce this folder over time. Keep only truly shared presentational shells or migrate items into `shared/components/`.

## Priority Hotspots
Current largest files after the first pass:

1. `frontend/src/features/print/PrintPage.tsx` (~1478 LOC)
2. `frontend/src/lib/sessionPlanner.ts` (~1532 LOC)
3. `frontend/src/features/dashboard/DashboardPage.tsx` (~898 LOC)
4. `frontend/src/features/requests/RequestsPage.tsx` (~831 LOC)
5. `frontend/src/features/staff-notes/StaffNotesPage.tsx` (~723 LOC)
6. `frontend/src/features/schematic/hooks/useSchematicSchedule.ts` (~711 LOC)
7. `frontend/src/features/rosters/RostersPage.tsx` (~661 LOC)
8. `frontend/src/features/session-planning/SessionPlanningPage.tsx` (~637 LOC)
9. `frontend/src/features/teams/TeamPage.tsx` (~620 LOC)
10. `frontend/src/features/sessions/ManageSessionsPage.tsx` (~573 LOC)

## Implementation Phases

### Phase 1: Shared Helpers and Duplication Removal
- Keep consolidating repeated session/date/term formatting into `shared/session/`.
- Keep consolidating repeated CSV parsing/header access into `shared/csv/`.
- Continue deleting page-local helper copies once a shared version exists.
- Preserve runtime behavior while moving logic.

### Phase 2: App Shell Cleanup
- Split `Layout.tsx` into:
  - navigation config
  - sidebar shell
  - profile completion modal
  - page-title/session-title helpers
- Keep `App.tsx` and `routes.tsx` thin orchestration files.
- Move route guards into `app/guards/` if more route-role logic is added.

### Phase 3: Session Management Consolidation
- Treat `DashboardPage.tsx` and `ManageSessionsPage.tsx` as a single refactor unit.
- Extract:
  - session label helpers
  - session creation/edit form state
  - guest vs full-time flows
  - session selection panels
  - term/team option derivation
- End state:
  - page files orchestrate
  - form sections/components render
  - async loaders live in feature hooks/services

### Phase 4: Requests Feature Cleanup
- Keep `requestsAnalysis.ts` as the pure analysis engine.
- Split `RequestsPage.tsx` into:
  - upload panel
  - summary view
  - assignment editor
  - assignment API state hook
- Keep request-specific keys/sorting in `features/requests/utils/`.
- Add a thin feature service module if the assignment CRUD flow keeps growing.

### Phase 5: Print Feature Cleanup
- Split `PrintPage.tsx` into:
  - modal state hook
  - date/session presentation helpers
  - schematic payload builders
  - instructor packet refresh/print helpers
  - PDF window helpers
- Keep feature-specific print helpers inside `features/print/` unless another feature genuinely needs them.
- This feature is the largest remaining UI page and should be the next major split.

### Phase 6: Scheduler and Planner Cleanup
- Split `useSchematicSchedule.ts` into:
  - request-assignment loading
  - column placement algorithms
  - drag/drop transitions
  - schedule persistence
- Split `SessionPlanningPage.tsx` into:
  - dataset import/export actions
  - local mutation actions
  - share-session orchestration
  - call modal/planned-change modal orchestration
- Split `sessionPlanner.ts` only after its shared parsing/util pieces are stable; it is large but logic-heavy, so avoid a risky all-at-once rewrite.

### Phase 7: Rosters, Staff Notes, Teams
- `RostersPage.tsx`
  - separate full-time upload flow from roster/custom-roster view logic
  - keep schematic preview utilities out of the main page body
- `StaffNotesPage.tsx`
  - isolate tab orchestration, DB loading, and note/todo/report mutations
- `TeamPage.tsx`
  - split team search, member management, invites, and session sharing into separate hooks/sections

## Directory and Naming Rules
- New shared code should go into `frontend/src/shared/<domain>/`.
- New feature-only code should go into `frontend/src/features/<feature>/{components,hooks,utils,services}`.
- Use `Page.tsx` files as orchestration containers, not helper dumping grounds.
- Prefer one exported responsibility per helper module.
- If a function is used in only one feature, keep it in that feature even if it feels “generic.”

## Acceptance Criteria
- No duplicated session/year/term helper logic across pages.
- No duplicated CSV parsing/header-index logic across features/libs.
- Largest page files steadily shrink as helpers/components/hooks move out.
- New shared modules are imported from one place rather than redefined inline.
- `npm run build` continues to pass after each refactor slice.
- Every new extraction updates `frontend-function-inventory.md` so reuse decisions stay visible.

## Recommended Next Slice
If continuing immediately, refactor `frontend/src/features/print/PrintPage.tsx` next:
- extract print date/session helpers
- extract PDF/window helpers
- extract instructor-packet refresh logic
- move payload builders into `features/print/utils/`
- keep the page focused on state wiring and modal orchestration
