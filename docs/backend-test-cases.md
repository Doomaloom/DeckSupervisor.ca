# Backend Test Cases

This document is an automated-first test inventory for the current backend. It is meant to guide step-by-step implementation, starting with deterministic helpers and service logic before moving into handler-heavy or external-integration-heavy paths.

## Legend
- `P0`: highest-value tests to implement first
- `P1`: important follow-up coverage after `P0`
- `P2`: lower-priority or polish coverage
- `unit`: pure functions and deterministic transformations
- `http`: router or handler behavior tested through `net/http` and `httptest`
- `integration`: service or handler behavior with mocked external boundaries
- `manual-later`: real external dependency or browser/file workflow validation deferred until after automated coverage exists

## Current Constraints
- The backend currently has no `_test.go` files.
- The backend depends on Supabase, Chromium/PDF generation, CSV ingestion, and file-processing flows.
- The first rollout should avoid starting with high-mock browser/PDF paths when smaller deterministic helpers can provide faster value.
- Implementation order should prioritize pure services and helpers first, then router smoke tests, then heavier HTTP and external-integration flows.

## 1. Router And HTTP Surface

### P0
- `http` `internal/http/router.go`: router registers representative auth, session, team, requests, planner-share, CSV, PDF, and health routes.
- `http` `internal/http/router.go`: unknown routes fall through to the not-found handler.
- `http` `internal/http/router.go`: `/api/health` responds successfully through the registered router.

### P1
- `http` `internal/http/router.go`: representative routes reject unsupported methods with the expected status behavior.
- `http` `internal/http/router.go`: router path parameters for ids and share codes are passed through correctly to handlers.

## 2. Auth And Session Services

### P0
- `unit` `internal/services/auth/service.go`: token extraction and session parsing helpers handle valid, missing, and malformed auth inputs.
- `unit` auth-related request user extraction logic: protected request paths reject missing auth context cleanly.

### P1
- `integration` auth service flows: sign-in, sign-up, session lookup, and sign-out handle expected upstream success and error responses using mocked boundaries.

## 3. CSV And Class Extraction Workflows

### P0
- `unit` `backend/tasks/csv.go` and `backend/tasks/csv_rows.go`: CSV parsing handles normal rows, blank rows, header variants, and malformed records.
- `unit` `backend/tasks/extract_classes.go`: class extraction groups rows into expected class/session outputs.
- `unit` CSV normalization helpers: day, time, location, and service-name normalization return stable values from representative roster exports.

### P1
- `integration` `/api/process-csv`: valid CSV payloads return expected parsed class structures.
- `integration` `/api/extract-classes`: representative CSV/session payloads return expected extracted-class outputs.
- `integration` `/api/csv/session-candidates`: candidate generation returns expected session groupings from representative uploads.

## 4. Files, Naming, And Sanitization

### P0
- `unit` `internal/services/files/sanitize.go`: unsafe filename characters are stripped or replaced.
- `unit` `internal/services/files/sanitize.go`: readable filenames are preserved when possible.
- `unit` `internal/services/files/sanitize.go`: empty, whitespace-only, and punctuation-only inputs fall back safely.

## 5. PDF Utility Layer

### P0
- `unit` `internal/services/pdf/merge.go`: merge helpers validate inputs and fail cleanly on empty or invalid PDF lists.
- `unit` `internal/services/pdf/rotate.go`: rotation helpers validate orientation/page settings and reject malformed inputs safely.

### P1
- `integration` PDF merge utility: merges representative fixture PDFs into a single output successfully.
- `integration` PDF rotate utility: rotates representative fixture PDFs and preserves expected page count/output validity.

## 6. Attendance, Masterlist, Blank PDF, Schematic PDF, And Session Report PDF

### P0
- `unit` `internal/services/attendance/service.go`: template resolution and request validation logic choose the correct attendance template or return clear errors.
- `unit` `internal/services/masterlist/service.go`: request validation and grouping helpers return expected outputs from representative roster inputs.
- `unit` `internal/services/blankpdf/service.go`: blank PDF request validation handles page count and option edge cases.
- `unit` `internal/services/schematicpdf/service.go`: request payload validation and page-orientation option handling behave correctly.
- `unit` `internal/services/sessionreportpdf/service.go`: request validation and file/template dependency checks fail clearly for invalid inputs.

### P1
- `integration` attendance/masterlist/schematic/session-report services: representative request payloads return non-empty PDF bytes or structured errors using fixture assets.

### Manual Later
- `manual-later` Chromium-rendered layout fidelity and real print-output verification for attendance, schematic, masterlist, blank, and session-report PDFs.

## 7. Custom Rosters

### P0
- `unit` `internal/services/customrosters/service.go`: student-name normalization produces stable deterministic values.
- `unit` `internal/services/customrosters/service.go`: hashing and deduplication helpers treat semantically equivalent names consistently.
- `unit` `internal/services/customrosters/service.go`: source-class and student resolution handles missing, duplicate, and partially matching records safely.

### P1
- `integration` save/resolve/delete custom-roster flows persist and restore expected records using mocked storage boundaries.

## 8. Schematic And Planner Share Services

### P0
- `unit` `internal/services/schematic/service.go`: schematic save/load shape validation and normalization logic preserve expected lane/instructor structures.
- `unit` `internal/services/plannershare/service.go`: join, heartbeat, leave, close, and update payload normalization behaves correctly.
- `unit` planner-share class-status, class-lane, class-move, call-record, and details update logic applies expected deterministic mutations.

### P1
- `integration` planner-share service flows: create, join, heartbeat, leave, close, and save-state paths succeed or fail correctly with mocked persistence/client boundaries.
- `integration` schematic service flows: get and upsert operations send and receive expected schematic payloads with mocked backend storage.

## 9. Supabase Client And Service Boundaries

### P0
- `unit` `internal/services/supabase/client.go`: request construction, auth header usage, and response parsing helpers behave correctly for representative success and error payloads.

### P1
- `integration` Supabase-backed service calls: representative account/team/session/report-card/request-assignment flows handle upstream success, auth failure, and malformed payloads with mocked HTTP boundaries.

### Manual Later
- `manual-later` live Supabase auth, team/session CRUD, and report-card sync against a real environment.

## 10. Deferred Manual-Smoke Coverage

### Manual Later
- `manual-later` real auth flows against Supabase.
- `manual-later` real Chromium-backed PDF generation in deployment-like environments.
- `manual-later` end-to-end CSV uploads through the running server with production-like files.
- `manual-later` planner-share multi-user concurrency and presence behavior.
- `manual-later` large file, large roster, and performance-sensitive operational workflows.

## Recommended Step-By-Step Implementation Order
1. File/name sanitization helpers.
2. CSV parsing and class extraction helpers in `backend/tasks`.
3. Custom-roster deterministic helpers.
4. Planner-share and schematic pure service logic.
5. Router smoke tests and health endpoint coverage.
6. Supabase client seams and auth/session helper coverage.
7. HTTP handler coverage for CSV, team, session, and request flows.
8. PDF utility integration tests with fixture files.
9. Chromium/PDF manual-smoke and live external-system validation.
