# DeckSupervisor

A full-stack operations platform for aquatics programs, built to turn raw roster exports into actionable schedules, print packets, and team-wide reporting workflows.

## Project Overview

DeckSupervisor solves a real operational problem: program supervisors often juggle disconnected tools for lesson scheduling, attendance sheets, instructor coverage, and report card planning.
This project consolidates those workflows into a single product with role-aware access, data boundaries, and consistent print output.

The app supports:

- Session planning by day, season, term, location, and instructor roster
- Schematic management for visual schedule organization
- Roster workflows including level edits and custom group creation
- Print center automation for instructor packets, masterlists, and schematic covers
- Report card reporting by instructor (part-time) and by employee/team term (full-time)
- Team operations including invites and same-day session sharing for coverage

## Product Scope

### Session Lifecycle

- Create/select sessions with day, season/year, date range, location, and instructors
- Track current session context across the app
- Separate workflows for guest users, part-time staff, and full-time supervisors

### Schematic Workflow

- Build or view day-based schedule columns
- Drag/drop-friendly organization of classes by instructor and time
- Save schematic state and generate print-ready schematic PDFs with orientation and highlight options

### Roster Workflow

- Parse roster CSVs into class groupings
- Edit roster-level and student-level classifications
- Create custom rosters that combine source classes for operational flexibility

### Print Workflow

- Generate attendance PDFs from roster data
- Generate masterlist PDFs with format controls
- Build instructor-specific packets and combine documents into print batches
- Add optional schematic cover pages and blank inserts for packet consistency

### Team Workflow

- Full-time users can create/manage teams and invite part-time staff
- Part-time staff can share a session for a specific date when coverage is needed
- Shared users receive explicit permissions (including optional roster edit access)

## Architecture

### Frontend

- React + TypeScript + Vite
- Route-driven SPA with feature modules (dashboard, rosters, schematic, print, report cards, team, auth)
- Context-based app state (auth, day/session/team/term selection)
- Tailwind-based UI system with a consistent visual language (rounded cards, high-contrast controls, utility-first styling)

### Backend

- Go (`net/http` + `gorilla/mux`)
- Endpoint-oriented API for CSV analysis, authentication, persistence, sharing, and spreadsheet exports
- Lightweight stateless runtime; PDF rendering and assembly stay in the browser

### Data and Identity

- Supabase Auth + Postgres
- Account profiles and role metadata
- Team, session, schematic, sharing, and report-card records
- Hybrid persistence model:
  - Supabase for shared operational state
  - Scoped local storage for guest and user-specific browser data

### Deployment Topology

- Frontend deployed separately from API
- Frontend rewrites `/api/*` to backend service
- Backend containerized as a small Go + CA-certificates image
- Fly runs one shared-CPU/1 GB Machine that suspends to zero while idle

## Fly Deploy Notes

The Fly app builds from `fly.toml` using `backend/Dockerfile`.
To keep deploys fast:

- `.dockerignore` excludes the frontend tree, local binaries, temp output, and sample files from the Docker build context
- the backend Dockerfile uses BuildKit cache mounts for Go module and build caches
- the runtime stage contains only the statically compiled server and CA certificates

### Deploy

Use the deployment helper from the repository root:

```bash
./scripts/deploy-fly.sh
```

The helper validates configuration, deploys with Fly high availability disabled, and enforces a single Machine. Override the app or configuration when needed:

```bash
APP_NAME=decksupervisor CONFIG_FILE=fly.toml ./scripts/deploy-fly.sh
```

`auto_stop_machines = "suspend"`, `auto_start_machines = true`, and `min_machines_running = 0` let the API suspend fully when idle. The first API request after an idle period can take longer while Fly resumes the Machine; subsequent requests use the already-running process. Frontend PDF preview, generation, and packet assembly do not wake the API.

## Key Design Choices

### 1) Role-Aware Product Design

The app is intentionally split by guest, part-time, full-time, and shared-session contexts.
This keeps each workflow focused and prevents accidental overexposure of sensitive actions.

Tradeoff: more branching in UI and state logic, but clearer permission boundaries.

### 2) Scoped Client Storage Model

Client-side state is namespaced by storage scope (`guest` or user id), preventing data leakage between identities in the same browser.

Tradeoff: slightly more complexity in state utilities, but stronger local isolation guarantees.

### 3) Privacy-First Custom Roster Persistence

Custom roster records persist hashed student names (with normalization + pepper) rather than raw PII, then resolve to local student IDs at runtime.

Tradeoff: deterministic hash resolution adds complexity, but meaningfully reduces sensitive data exposure risk.

### 4) Browser-Rendered PDF Pipeline

Attendance, schematic, masterlist, and session-report outputs are rendered as vector PDFs in the SPA with `@react-pdf/renderer`. Blank pages, rotation, metadata, and packet merging use `pdf-lib`.

Tradeoff: the PDF engine is a sizeable lazy-loaded browser chunk, but document work no longer consumes Fly CPU or RAM.

### 5) Operational Performance Controls

Instructor packet generation supports concurrency limits and versioned incremental caching (IndexedDB + packet refresh strategy) to reduce repeated render costs.

Tradeoff: added caching complexity, but faster repeat print workflows for supervisors.

### 6) Term/Team/Day Data Modeling

Full-time workflows are modeled around team + term filters, while part-time workflows remain session-centric.
This aligns data access patterns with real staffing responsibilities.

## Security and Data Handling

- JWT-based user extraction for protected custom-roster endpoints
- Access checks enforce session ownership or valid same-day share permissions
- Explicit control over roster edit privileges in shared-session scenarios
- Separation of shared database records vs local-only operational data
- Custom roster persistence avoids storing raw student names in backend records

## Technical Highlights

- Flexible CSV normalization for inconsistent export formats
- Feature-level frontend architecture with typed models and reusable hooks
- End-to-end print orchestration (single, batch, merged, highlighted, oriented)
- Document utility layer for merge, rotate, blank insertion, and filename sanitization
- Team collaboration model with invitation and date-scoped coverage access
- Deployment split with API rewrite strategy and containerized backend
### PDF visual parity tests

Historical PDF comparisons require Chromium, Liberation fonts, Poppler (`pdfinfo` and
`pdftoppm`), and ImageMagick 7. Current and diagnostic files belong under
`tmp/pdf-parity/`; only synthetic historical goldens and their manifest are committed.
Regenerate pinned historical attendance goldens with
`scripts/pdf-parity/generate-historical.sh`; the script exports the pinned tree and runs
the isolated Go harness without restoring Chromium dependencies to production.
Run `cd frontend && npm run test:pdf-visual` after producing the current fixture set.
Failures retain both rasterized pages and a highlighted difference image. Contact sheets
can be rebuilt with `scripts/pdf-parity/contact-sheets.sh`.
