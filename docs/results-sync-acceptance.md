# Results synchronization: implementation and acceptance

This change completes the code-login website/tablet results path. It does not deploy
services, apply hosted migrations, certify physical hardware, or enable website-account
login on the tablet.

## Release order

1. Back up the database and apply the existing instructor, lesson-plan and
   session-instructor migrations required by the current application. Apply
   `backend/supabase_results_sync.sql` afterwards. This additive migration can be
   reapplied; new result tables use RLS with writes restricted to scoped RPCs.
2. Configure the backend's existing `SUPABASE_SERVICE_ROLE_KEY` (or supported
   service-key setting). Only server-side device-capability RPCs use it. No service
   credential belongs in frontend or tablet configuration.
3. Deploy the compatible backend and frontend, then install the updated tablet.
   Guest and old unbound packages remain import-only. Existing class package
   schemaVersion 1 is retained with optional sync metadata.
4. Verify the exact frontend/backend/tablet revisions in a synthetic rehearsal.
   A saved code is not a persistent login: every launch or post-logout login needs
   an active sharing code. Issued upload grants survive closing the sharing page.

## Contracts and privacy

See `results-sync-contract.md` for endpoints, operation payloads, revision semantics,
scoped grants and conflict resolution. Names/contact fields remain in local roster
storage and temporary in-memory sharing packages; persistent result identities use
opaque scoped match keys and source IDs. Never send a full tablet snapshot or the
name-bearing browser export registry to the results API.

Accepted operations and their revisions are durable. Duplicate operation IDs do not
create another attempt. Conflicting edits require supervisor review, and the review
uses the displayed accepted revision to prevent overwriting a newer unseen edit.
Undo/reset are explicit deletions. Draft observations remain local. Revocation and
assignment changes are checked before every device request, including retries.

Regenerate curriculum metadata together after a reviewed catalog change:

- `cd frontend && npm run generate:lesson-skills` (also refreshes completed print mappings).
- `node frontend/scripts/generate-results-curriculum.mjs ../rec-tablet/src/workflows/swimming/curriculum/catalog.json`.
- `python3 scripts/generate-result-curriculum.py ../rec-tablet/src/workflows/swimming/curriculum/catalog.json`.

Review the benchmark limits against the tablet's `benchmarks.go` as well as criterion
IDs. A bound tablet database must preserve existing versioned results and drafts
rather than turning a catalog upgrade into synchronized deletions.

## Reproducible synthetic verification

Run from the website repository:

```sh
(cd frontend && npm run test:run && npm run build)
(cd backend && GOCACHE=/tmp/rec-tec-backend-check go test ./...)
bash scripts/test-rls.sh
bash scripts/instructor-qa.sh bash scripts/test-results-roundtrip.sh
bash scripts/instructor-qa.sh node frontend/scripts/test-instructor-browser.mjs "$PWD/tmp/results-sync/instructor-browser"
```

The local QA wrapper creates disposable PostgreSQL, fake synthetic authentication,
the real Go API, and Vite. It runs its command after startup and always removes its
disposable data/processes on exit. It never uses hosted credentials. The round-trip
wrapper executes the tablet repository's real-API test, then browser results and
completed-PDF acceptance. Output goes to `tmp/results-sync/`. Local sockets and
Chromium must be available to these commands.

Run in the tablet repository:

```sh
GOCACHE=/tmp/rec-tec-tablet-check make test
GOCACHE=/tmp/rec-tec-tablet-check make race
GOCACHE=/tmp/rec-tec-tablet-check make vet
GOCACHE=/tmp/rec-tec-tablet-check make smoke
```

Print fixtures: `cd frontend && npm run test:attendance-html-visual -- completed-all`.
The historical PDF goldens predate the current audited template content. During this
implementation, their 46-page mismatch was reproduced on unchanged baseline
`55fb9df`; a same-browser direct comparison of all 23 baseline/current blank templates
passed with no differences. Do not replace historical goldens merely to hide that
pre-existing mismatch.

## Acceptance record

Baseline: website `55fb9df`, tablet `3bda080`.

Verified so far on integrated changes:

- Website frontend: 97 test files, 405 tests passed; production build passed.
- Instructor desktop/mobile browser: save failure retains draft, cancelled navigation
  retains draft, retry/reload persists, same-weekday sessions remain separate,
  untouched week stays empty, guest API denied and cross-account plans denied.
- Instructor links browser: rename, unlink, reassignment, failed autosave recovery,
  removal/revocation and retained plans passed.
- Activity library desktop/mobile: multiple activities, autosave/reload, structured
  workout persistence and overflow checks passed.
- Backend Go suite and disposable SQL/RLS regressions passed, including repeat
  migration, idempotency, conflict review, aliases, scope, revocation, historical
  corrections and timed validation.
- Completed print mapping tests passed for all 23 template keys. Synthetic PDFs
  cover every assessable level, zero through three checks and continuation pages.

Checkpoint on November 16, 2026:

- Final website frontend run: 97 files / 405 tests passed; production build passed.
- Integrated tablet `make test`, `make vet`, and `make smoke` passed.
- The full integrated `make race` run failed only `TestExtractionParity`. The
  bundled catalog had omitted source qualifiers from 21 split-stroke criteria.
  Commit `631cc5f` restores the 42 affected text/source-line fields without changing
  IDs, version, scoring, or source hashes. The corrected curriculum package passes
  `go test -race -tags ci ./src/workflows/swimming/curriculum`; a final full
  `make race` rerun remains outstanding. Independent integration race suites and
  the screenshot-enabled large/timed subset passed.
- Actual tablet repository → real API → website browser → completed PDF passed,
  including ordered lesson-plan code delivery, offline SQLite reopen, re-sharing
  changed plans without losing assessments/drafts, upload, correction/deletion,
  pull without echo, conflict review, and cross-account denial. The wrapper also
  restarted PostgreSQL and the Go API before browser verification.
- Completed PDF front/reverse pages and desktop/mobile screenshots were visually
  inspected. Mobile spacing was repaired, and browser checks wait for the sidebar
  transition before measuring readable content width.

Implementation heads: website `450c445`, tablet `631cc5f`. The last combined demo
ran on website `992539c` and tablet `631cc5f`; the subsequent website change only
regenerated lesson-plan criterion labels from the restored source text. Its full
frontend tests/build passed. Logs and generated evidence are under each repo's
`tmp/results-sync/` directory and are local artifacts, not committed release assets.

This is a handoff checkpoint, not final certification. See
`results-sync-handoff.md` for remaining verification and completion-audit work.

### Evidence map for final review

| Requirement | Authoritative checks |
| --- | --- |
| Canonical identity, fresh-browser recovery, changed names/contact, duplicates, transfers and legacy IDs | `frontend/src/features/results/identity.test.ts`, `DeviceExport/services/resultRegistry.test.ts`, `backend/tests/rls_results_sync.sql` |
| Assignment isolation, expired/revoked grants, wrong-session upload, upload-only capability | Backend results handler tests and `rls_results_sync.sql`; the SQL checks authorization before returning even a previously accepted receipt |
| Atomic outbox, draft exclusion, correction/undo/reset, interrupted retry and idempotency | Tablet `repository/sync_test.go`, including injected outbox-write failure and interrupted HTTP receipt |
| Offline logout, another instructor's login, same-name profile isolation and rename | Tablet `next/runtime/results_sync_test.go` |
| Existing database migration, protected credential storage, manual exports, curriculum upgrade | Tablet `repository/sync_test.go` and runtime profile migration tests |
| Accepted corrections/deletions, draft preservation and no synchronization echo | Tablet repository pull tests and `TestLiveResultsRoundTrip` against the real Go API |
| Conflict review, concurrent third edit and historical corrections | SQL/RLS tests, frontend results component tests and `test-results-browser.mjs` |
| Existing instructor, lesson-plan and activity workflows | `test-instructor-browser.mjs`, instructor-links/activity browser evidence, and tablet `lesson_plans_test.go` |
| All template columns, required/alternative skills, 0–3 checks, continuation pages and print blocking | `completedAttendance.test.ts`, all-level visual fixtures, live browser-generated completed PDF |
| Blank-template parity | Direct same-browser comparison of all 46 pages against baseline `55fb9df`; historical golden mismatch reproduced on that baseline |
| Server restart durability | Round-trip wrapper restarts the disposable PostgreSQL and Go API after tablet upload, then browser acceptance checks the retained records and history |

The restart hook is exported only by the disposable QA wrapper. It is not a service
administration command and cannot restart the deployed application.

Physical tablet touch/fullscreen/readability, enclosure/wet-touch/battery, projector,
deployed revision checks, and a rehearsal/backup recording remain release gates.
