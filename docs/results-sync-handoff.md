# Rec Tec implementation handoff

Prepared November 16, 2026, at the user's request to wrap up the current tasks and
hand remaining work to another agent orchestrator. The full implementation goal
has **not** been declared complete. Do not deploy or apply hosted migrations as
part of resuming local verification.

## Start here

1. Read this document, `results-sync-contract.md`, and `results-sync-acceptance.md`.
2. Inspect current Git status and commits in both repositories; do not assume the
   old worktree branches are newer than the main working branches.
3. Run the outstanding integrated tablet race gate. Then audit the original plan
   against code and evidence; fill gaps rather than treating passing tests alone
   as proof of the entire plan.
4. Update the acceptance record with final commits, commands, evidence, migration
   state, and any remaining limitations. Only claim implementation completion
   when that audit supports it.

The user explicitly requires **Sol subagents**. Use `gpt-6.1-sol`, at most three
concurrent subagents, isolated worktrees, explicit file ownership, and coordinator
integration. Do not create new user-owned chats for these subtasks.

## Repositories and checkpoint

| Repository | Main working path | Branch | Implementation head |
| --- | --- | --- | --- |
| Website/API | `/home/frank/Documents/rec-tec/COB-Aquatics-SPA` | `develop` | `450c445306c5d60317532d02af94ff68a6d3a935` |
| Tablet | `/home/frank/Documents/rec-tec/rec-tablet` | `ui-redesign` | `631cc5f2ecdb1c61e9f944d879f4a18b2b4db765` |

This handoff and the acceptance-record update are committed after the website
implementation head above. Original inspected baselines were website `55fb9df`
and tablet `3bda080`. No push, deployment, or hosted migration was performed.

Persistent worktrees under `/home/frank/Documents/rec-tec/.implementation-worktrees`:

- `backend`, branch `codex/results-backend`, head `e6ee267`.
- `web`, branch `codex/results-web`, head `fbda144`.
- `tablet`, branch `codex/results-tablet`, head `b6fc90c`.
- `tablet-verification`, branch `codex/tablet-verification`, head `a00a062`.
- `print-baseline`, detached website baseline `55fb9df`.

Their completed work has been integrated into the main working branches. Do not
cherry-pick it again. Some worktrees have untracked dependency symlinks; do not
commit those. Another tablet worktree outside this project is unrelated and must
not be modified. Earlier `/tmp` worktrees disappeared during an environment
restart, so use the persistent paths above.

## Intended behavior and implementation now present

The approved objective is the website → six-digit tablet login → local teaching
→ logout upload → website correction/review → next-login refresh → completed
attendance-sheet workflow. Existing instructor pages, lesson planning, activity
library, tablet plan viewing, class imports, and manual exports are preserved.

- Website stores canonical session/dataset/class/instructor/swimmer-source and
  enrollment identities, opaque session-scoped matching keys, and results. Names
  and contact information remain in local rosters and temporary sharing packages.
- Existing browser registry IDs are retained. Fresh browsers recover unchanged
  unambiguous signatures; changed signatures require explicit reconciliation.
  Transfers use new enrollments and keep earlier history. Indistinguishable
  duplicate entries require source-roster correction by an operator.
- Authenticated session-bound code shares mint upload-only capabilities with
  separate short-lived read capabilities. Server stores hashes. Default upload
  expiry is 30 days; read expiry is 12 hours. Assignment/revocation checks apply
  before even returning a duplicate receipt. Guest/legacy packages are import-only.
- Tablet uses transactionally captured SQLite outbox operations for submitted
  attendance, criteria/timed attempts, corrections, undo, and reset tombstones.
  Drafts stay local. Frozen operation IDs survive interrupted responses.
- Logout drains local writes, then uploads in a worker with a bounded timeout.
  Failure retains data. Any subsequent verified login retries saved profiles'
  queues using their own credentials; only aggregate status is shown. The active
  profile pulls accepted results before teaching. Offline-resume bypasses were
  removed; an open shift still works offline.
- Same-name instructors have separate canonical profiles. Renames retain the
  profile. Guest imports cannot inherit credentials. Missing reassigned classes
  are retired from current teaching while historical work remains stored.
- Server revisions drive conflicts. Pending submissions are durably recorded;
  supervisors select a version with an expected-revision guard. History, deletion
  tombstones, and independent operation acknowledgements are retained.
- Instructor `/instructor/attendance` and supervisor `/results` provide results,
  corrections/history, accepted progress, local name resolution, conflict review,
  identity reconciliation, and grant revocation with server authorization.
- Completed printing extends the existing templates: 0–3 earned checks, dated
  attendance, unchanged reverse sides, blank administrative fields, explicit
  curriculum-column mappings, required-minimum/alternative-maximum aggregation,
  and blocking for unresolved identities/conflicts.

Website-account tablet login, completed report cards, additional programs,
expanded activity content, and live lesson-time plan synchronization are deferred.
Plans refresh through renewed sharing/login.

## Important implementation locations

Website:

- `backend/supabase_results_sync.sql`: additive/repeatable schema, scoped RPCs,
  identity registry, grant hashes, revisions, conflict handling, timing validation.
- `backend/internal/http/handlers/results_sync.go`: results HTTP interfaces.
- `backend/tests/rls_results_sync.sql`: authorization, privacy, idempotency,
  historical corrections, conflicts, revocation, and expiry regressions.
- `frontend/src/features/results/`: results UI, local identity resolution,
  progress model, and generated criterion labels.
- `frontend/src/features/decksupervisor/DeviceExport/services/resultRegistry.ts`:
  authenticated identity publication/recovery.
- `frontend/src/shared/attendance-print/`: existing print pipeline plus completed
  inputs, mapping, validation, and tests.
- `scripts/instructor-qa.sh`, `scripts/test-results-roundtrip.sh`, and
  `frontend/scripts/test-results-browser.mjs`: disposable real-stack acceptance.

Tablet:

- `src/workflows/swimming/repository/sync*.go`: capture, upload, pull, scope,
  credential persistence, migration, and regression tests.
- `next/runtime/session.go`, `profiles.go`, `sync_status.go`: boundary sync,
  canonical profile isolation, worker logout, and private notices.
- `src/workflows/swimming/repository/sync_live_test.go`: opt-in real API test.
- `next/integration/integration_view_test.go` and legacy equivalent: test-driver
  callback queue; real timer/hold callbacks are pumped on the test thread.

## Verification completed at this checkpoint

| Gate | Result and evidence |
| --- | --- |
| Website Vitest | 97 files / 405 tests passed on final generated labels; `tmp/results-sync/frontend-final-tests.log` |
| Website production build | Passed; `tmp/results-sync/frontend-final-build.log` (existing bundle-size/Browserslist warnings) |
| Backend Go | Passed; `tmp/results-sync/backend-final.log` |
| SQL/RLS | Passed, including repeat migration/rollback, expired and wrong-session grant checks; `tmp/results-sync/rls-final.log` |
| Tablet `make test` | Passed after catalog repair; tablet `tmp/results-sync/test-final.log` |
| Tablet `make vet` / `make smoke` | Passed; tablet `tmp/results-sync/vet-final.log`, `smoke-final.log` |
| Integrated tablet `make race` | Ran to completion but failed the then-unfixed catalog parity test only; `race-final.log`. No data-race report. Final full rerun still needed |
| Corrected catalog under race | Passed; tablet `tmp/results-sync/curriculum-race-final.log` |
| Independent integration race checks | Next 229.531s, legacy 223.142s, screenshot subset 91.403s passed; agent logs `/tmp/tablet-race2.log`, `/tmp/tablet-shot-race.log` may be ephemeral |
| Real repository/API/browser/PDF round trip | Passed; website `tmp/results-sync/roundtrip-final.log`, `tablet-live.log`, `backend-restart.log`, `results-browser.log` |
| Existing instructor/plan/library flows | Passed desktop/mobile browser suites; website `tmp/results-sync/instructor-browser`, `instructor-links`, `activity-browser` |
| Printing | All mapping/unit checks pass; all-level visual fixtures produced; live completed PDF front/reverse visually inspected; blank baseline direct comparison passed |

The final combined demo was on website `992539c` / tablet `631cc5f`. Website
`450c445` subsequently regenerates only lesson-plan criterion labels and passes
the full frontend suite/build. Demo evidence includes two ordered plan rows,
offline reopening, and plan-refresh preservation flags in
`tmp/results-sync/tablet-evidence.json`.

The live round trip calls the actual tablet repository/transfer client and real
Go API; it is **not** a physical-tablet or full native-touch-UI rehearsal. Runtime
login/logout orchestration has separate tests. Keep that distinction in reports.

Generated evidence is local and mostly ignored by Git. Useful deliverables:

- `tmp/results-sync/results-browser/completed-results.pdf`
- `tmp/results-sync/results-browser/desktop-results.png`
- `tmp/results-sync/results-browser/mobile-results.png`
- `tmp/results-sync/results-browser/results.json`

## Outstanding work, in order

1. **Rerun final integrated tablet `make race`.** The prior full run started
   before the catalog-text repair. Its only failure was `TestExtractionParity`.
   The corrected package passes separately, but do not report the full command
   green until a fresh full invocation succeeds.
2. **Finish the requirement-by-requirement completion audit.** Use the evidence map
   in the acceptance record and inspect test coverage. Explicitly check every
   original identity, synchronization, privacy, durability, permission, and print
   scenario, including negative cases. Add targeted tests or fixes for uncovered
   behavior. Do not infer complete coverage from filenames or green totals.
3. **Close acceptance documentation.** Record final implementation/demo commits,
   exact commands/results, additive migration state, and limits. The current
   acceptance record intentionally says checkpoint, not final certification.
4. **Release-only gates remain separate:** apply hosted migrations in the agreed
   order, deploy compatible website/backend then tablet, verify deployed commits,
   physical tablet touch/readability/battery/wet-touch, projector, rehearsal, and
   backup demo recording. None was performed or authorized as a deployment here.

No known unresolved production defect was identified at wrap-up. The remaining
verification/audit is real work, not permission to assume implementation complete.

## Exact commands and environment notes

```sh
# Tablet, from /home/frank/Documents/rec-tec/rec-tablet
GOCACHE=/tmp/rec-tec-go-cache make race
GOCACHE=/tmp/rec-tec-tablet-final make test
GOCACHE=/tmp/rec-tec-tablet-final make vet
GOCACHE=/tmp/rec-tec-tablet-final make smoke

# Website, from /home/frank/Documents/rec-tec/COB-Aquatics-SPA
(cd frontend && npm run test:run && npm run build)
(cd backend && GOCACHE=/tmp/rec-tec-backend-check go test ./...)
bash scripts/test-rls.sh
bash scripts/instructor-qa.sh bash scripts/test-results-roundtrip.sh
```

Local sockets/Chromium require the tool's sandbox escalation on this environment.
The default Go cache is read-only in the sandbox; use the explicit `/tmp` cache.
Race UI suites can take several minutes. Poll the actual process handle; do not
restart merely because output is quiet. Do not inspect unrelated process arguments
or credentials. No fixture/test process is intentionally left running at handoff.

The QA wrapper creates a disposable PostgreSQL database (port 55440, Unix socket),
synthetic auth provider (18081), real API (18080), and Vite (18082). It never uses
hosted credentials. It runs the requested command and cleans up its processes and
database on exit. The round-trip child restarts PostgreSQL/API before browser
review. Run only one fixture lifecycle at a time. Do not assume a previous process
survived a chat/environment restart. Use `REC_TEC_QA_TABLET` only to intentionally
test a different tablet checkout.

## Traps already diagnosed

- Blank historical PDF goldens fail 46 pages on unchanged baseline `55fb9df` too.
  Direct same-browser baseline/current comparison of all 23 templates / 46 pages
  passed. Do not replace goldens just to hide the inherited mismatch.
- Worktree curriculum parity tests can skip if the website sibling isn't present.
  Run them from the actual main tablet checkout with the actual website sibling.
- Catalog repair restored 42 string fields across 21 skills, retaining version
  `templates-b50c7f987e101b7e`, IDs, hashes, and scoring. Generated website results
  and lesson-plan labels were updated. Do not invent a new curriculum version for
  this source-text restoration.
- Old large-tablet tests expected removed sidebar/Single/Multi controls. They now
  test the current direct-Class workflow; compact tests retain undo, draft,
  correction, Multi, saved-result preservation, and roster-isolation coverage.
- Fyne's test driver executes background callbacks directly unless the test
  harness queues them. Removing timer coverage to silence races is not acceptable.
- Browser file import must wait until the input is enabled. Hidden `<option>` text
  is not visible result evidence. Mobile width checks must wait for sidebar
  animation completion. Chromium PDF capture triggers `afterprint`; the test-only
  popup close stub preserves the window during capture without changing product
  behavior.

## Migration and compatibility

Apply the existing instructor/lesson-plan/session-instructor migrations first,
then `backend/supabase_results_sync.sql`. Deploy compatible API/frontend, then
tablet. The SQL migration is additive and repeatable; tests ran on disposable
databases only. Backend service credentials stay server-side. Existing import-only
clients and full manual exports remain supported. See the contract for payloads,
API examples, revocation, reconciliation, and conflict semantics.
