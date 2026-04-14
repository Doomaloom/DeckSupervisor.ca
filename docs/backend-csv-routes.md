# Backend CSV Routes

I found 5 backend routes that directly ingest a CSV upload, all registered in `backend/internal/http/router.go`. There is also 1 CSV-adjacent route that does not accept a CSV file itself.

## Direct CSV Routes

### `POST /api/process-csv`

Registered in `backend/internal/http/router.go`, handled in `backend/internal/http/handlers/process_csv.go`.

Flow:

1. Parses multipart form and requires `csv_file`; optional `day`, `instructor_names[]`, `instructor_codes[]`.
2. Builds an `instructorMap` from the posted name/code arrays.
3. Calls `tasks.ProcessCSVFromCSV`, which first normalizes CSV headers and values through `backend/tasks/csv_rows.go`.
4. `ProcessCSVRows` groups rows by event/class code, normalizes attendee names and day values, falls back to the posted `day` when the CSV row has no day, and marks waitlist students from attendee status in `backend/tasks/csv.go`.
5. Returns JSON: `success`, `day`, `total`, `classes`.

This is the route that turns a roster CSV into class rosters.

## `POST /api/extract-classes`

Registered in `backend/internal/http/router.go`, handled in `backend/internal/http/handlers/extract_classes.go`.

Flow:

1. Reads `csv_file`.
2. Calls `tasks.ExtractClassesFromCSV`.
3. The extractor normalizes rows, then for each class row derives course code, service name, location, normalized day, start/end time, duration, season/year, start/end dates, booked count, and waitlist count in `backend/tasks/extract_classes.go`.
4. It groups classes into session buckets, then splits them into session windows and builds `sessions` plus `classesBySession`.
5. Returns JSON with `totalSessions`, `totalClasses`, `sessions`, and `classesBySession`.

This is the route that inspects a CSV and infers session/class structure.

## `POST /api/csv/session-candidates`

Registered in `backend/internal/http/router.go`, handled in `backend/internal/http/handlers/csv_session_candidates.go`.

Flow:

1. Authenticates through Supabase and loads or creates the caller profile.
2. Reads `csv_file`.
3. Reuses the same `tasks.ExtractClassesFromCSV` pipeline as `/api/extract-classes`.
4. Reads optional `termSeason` and `termYear`; for `full_time` users it requires `teamId` and can filter extracted CSV sessions by term.
5. Loads the set of existing sessions that are in scope for matching:
   - full-time: team sessions, optionally filtered by term
   - other users: own sessions plus today's shared sessions
6. Matches extracted CSV sessions against existing session rows by day, season/year, normalized location, and time window, then groups or merges candidates when multiple raw CSV buckets map to one existing session.
7. Returns JSON with matched or unmatched `sessions` candidates plus `classesBySession`.

This is the route that uploads a CSV and figures out which app session it belongs to or should create.

## `POST /api/masterlist`

Registered in `backend/internal/http/router.go`, handled in `backend/internal/http/handlers/masterlist.go`.

Flow:

1. Parses multipart form and requires `csv_file`.
2. Reads formatting flags like `time_headers`, `instructor_headers`, `course_headers`, `borders`, `center_time`, `bold_time`, `center_course`, `bold_course`.
3. Builds an instructor map from `instructor_names[]` and `instructor_codes[]`, normalizing event IDs.
4. Calls `tasks.ProcessMasterListFromCSV`, which:
   - normalizes CSV rows with the shared reader
   - decides whether the file is "series" style by checking for `ServiceName`
   - rewrites rows into a smaller output schema
   - builds an Excel workbook with optional inserted headers, styles, borders, and autosizing in `backend/tasks/masterlist.go`
5. Returns an `.xlsx` attachment.

This is the CSV-to-masterlist-export route.

## `POST /api/schematic-maker`

Registered in `backend/internal/http/router.go`, handled in `backend/internal/http/handlers/schematic.go`.

Flow:

1. Parses multipart form and requires `csv_file`.
2. Calls `schematic.BuildFromCSVReader`.
3. That service reads the CSV into a dataframe, validates required columns (`GroupName`, `MainFacility`, `Day`, `Starts`, `Ends`), parses schedule/class metadata, groups by location and day, then builds either:
   - one workbook if there is one location grouping
   - a zip of workbooks if there are multiple groupings
4. Returns either an `.xlsx` or `.zip` download.

This is the CSV-to-schematic-workbook generator.

## CSV-Adjacent Route

### `POST /api/masterlist-rosters`

Registered in `backend/internal/http/router.go`, handled in `backend/internal/http/handlers/masterlist_rosters.go`.

This route does not upload or parse CSV directly. It accepts JSON `rosters []tasks.ClassRoster`, which is usually downstream of `/api/process-csv`, then renders a PDF masterlist.

## Shared Backend Shape

The CSV backend is split into three main pipelines:

- Shared CSV normalization: `backend/tasks/csv_rows.go`
- Roster and class grouping pipeline: `backend/tasks/csv.go`
- Session and class extraction pipeline: `backend/tasks/extract_classes.go`

That means `/api/process-csv`, `/api/extract-classes`, `/api/csv/session-candidates`, and `/api/masterlist` are not isolated implementations. They share parsing assumptions, header normalization behavior, and some row interpretation logic, which is likely part of why the CSV backend feels tangled.
