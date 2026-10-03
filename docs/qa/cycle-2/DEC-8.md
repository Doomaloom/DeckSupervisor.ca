# DEC-8 parent integration acceptance — October 3, 2026

Local acceptance is demonstrated for the revised instructor-only scope. DEC-70/67 prerequisites, DEC-39 schematic, and DEC-68 planner are integrated; DEC-42 automated coverage and DEC-45 browser/database evidence support the matrix below.

| Parent requirement | Implementation and evidence |
| --- | --- |
| Only explicitly linked columns | Caller-token instructor APIs filter by account/session/assignment; class/assignment RLS; handler projection tests and desktop/mobile screenshots |
| Reuse schematic styling, times, levels, context | Existing TimeRail and 15-minute grid constants; accessible class cards; metadata fields only |
| No student rosters, counts, coverage | Narrow class table and explicit API select list; no supervisor layout mounted under `/instructor`; storage/API tests assert no roster data |
| Unlinked clear empty state | My Classes UI test, mobile screenshot, API/RLS empty response checks |
| Duplicate names and renames preserve access | UUID links, session/course class uniqueness; RLS regression renames and reverses columns while retaining identities/access |
| Multiple sessions stay distinct | Session UUID keys, distinct server contexts/week dates; same-weekday DB test and browser switch/reload tests |
| Direct route/API isolation | Guest UI denies child mounting; guest API 401, unrelated plan API 403; cross-account PostgreSQL reads/writes denied |
| Instructor navigation and authorized return | Desktop/mobile switch above Logout, four destinations, existing login and supervisor selection preserved |
| Stable lesson-plan links | Schematic links include session/class UUID; planner validates live assignment and server week before accessing records |
| Link/unlink/reassignment | Session-owner authorization reused; real UI unlink/reassignment transferred access and retained saved plan |

Integration corrections in this ticket: account-link inputs remount when the stored account changes so successful unlink displays a blank value; full-time users who own the selected supervisor session see link controls, while other full-time viewers retain existing read-only rights. The mobile planner now explains horizontal table scrolling and provides a focusable labeled scroll region.

Migration order for local or later approved deployment: existing schema reconciliation/RLS migrations, `backend/supabase_instructor.sql`, then `backend/supabase_lesson_plans.sql`. Saving an existing supervisor schematic publishes only the required class metadata; legacy schematics without that metadata require a supervisor save before linking. Instructor links grant no whole-session or schematic access.

Validation: targeted instructor/schematic tests, Vite build, disposable RLS migration reapplication/permission preservation suite, and previously recorded real local browser/database flows. Existing unrelated TypeScript baseline errors are documented; Vite production build and runtime checks pass. No production migration/configuration, push, deployment, attendance/student workflow, tablet synchronization, or broader roster-cache repair is included.
