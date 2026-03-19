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
- Endpoint-oriented API for CSV processing and PDF generation
- Service-layer design for attendance rendering, schematic PDF creation, custom roster handling, and PDF operations

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
- Backend containerized and configured for Chromium-based PDF rendering

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

Attendance and schematic outputs are rendered through Chromium (`chromedp`) to preserve print layout, then merged/rotated with `pdfcpu` when needed.

Tradeoff: heavier server runtime requirements, but better formatting fidelity for operations-critical printouts.

### 5) Operational Performance Controls

Instructor packet generation supports concurrency limits and incremental caching (IndexedDB + packet refresh strategy) to reduce repeated render costs.

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
