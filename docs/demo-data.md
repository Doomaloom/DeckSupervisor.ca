# Demo Data Seeder

Use the demo seeder to create a complete current-week DeckSupervisor demo dataset.

```bash
./scripts/seed-demo-data.sh
```

To build the demo from a real full-week lessons CSV instead of the synthetic fixture:

```bash
./scripts/seed-demo-data.sh --source-csv ~/Downloads/my-real-week.csv
```

The default run writes:

- `demo-data/current-week/demo_single_day_classes.csv`
- `demo-data/current-week/demo_full_week_classes.csv`

It also replaces the existing demo Supabase data for the demo users/team, then recreates accounts, profiles, team membership, sessions, schematics, session shares, notes, reports, report card totals, request assignments, and attendance sheet templates.

When `--source-csv` is provided, the same supporting demo data is seeded around the parsed class structure from your file. The generated upload CSVs are rewritten under `demo-data/current-week/`, with student names, phone numbers, and emails anonymized by default.

## Demo Accounts

All accounts use the default password:

```text
DemoPass123!
```

| Role | Name | Email |
|---|---|---|
| Full-time | Alex Rivera | `demo.fulltime@decksupervisor.local` |
| Part-time | Jamie Chen | `demo.jamie@decksupervisor.local` |
| Part-time | Morgan Patel | `demo.morgan@decksupervisor.local` |
| Part-time | Taylor Brooks | `demo.taylor@decksupervisor.local` |
| Part-time | Sam Nguyen | `demo.sam@decksupervisor.local` |

## Seeded Scope

The generated week is Monday, April 27, 2026 through Sunday, May 3, 2026.

Locations:

- `Bayside Community Pool`
- `Hillcrest Aquatic Centre`

The single-day CSV uses Tuesday, April 28, 2026. That same day is also seeded with session shares so the shared-session workflow can be demonstrated immediately.

In source CSV mode, dates, days, locations, time windows, season, and year come from the parsed CSV whenever available. The single-day CSV uses `--single-day` when provided, otherwise Tuesday when present, otherwise the first parsed day in week order.

## Useful Flags

```bash
./scripts/seed-demo-data.sh --dry-run
./scripts/seed-demo-data.sh --skip-auth
./scripts/seed-demo-data.sh --output demo-data/custom
./scripts/seed-demo-data.sh --password 'AnotherPass123!'
./scripts/seed-demo-data.sh --source-csv ~/Downloads/my-real-week.csv
./scripts/seed-demo-data.sh --source-csv ~/Downloads/my-real-week.csv --single-day Thursday
./scripts/seed-demo-data.sh --source-csv ~/Downloads/my-real-week.csv --anonymize-source-csv=false
```

- `--dry-run` writes CSVs and prints the intended seed counts without touching Supabase.
- `--skip-auth` writes only the CSV files.
- `--replace` is enabled by default and recreates the demo set.
- `--source-csv` parses your real CSV with the app's normal class extraction path, then seeds demo sessions and saved schematics from those parsed sessions.
- `--anonymize-source-csv=false` keeps source student contact data in the generated demo CSVs. Use it only for private/internal demos.
- `--single-day` controls which parsed day is written to `demo_single_day_classes.csv` and preferred for seeded shares.

## Requirements

The script loads `.env.local` through `scripts/with-env.sh`.

Required variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY` is the preferred server-side key for both Auth Admin and database service calls. `SUPABASE_SERVICE_KEY` is supported only as a fallback for older local env files.

The wrapper sets `TMPDIR` and `GOTMPDIR` to `backend/.tmp` by default so `go run` and Air builds do not depend on the system `/tmp` quota.

## Source CSV Mode

Source CSV mode keeps your real lesson structure but makes it demo-safe:

- Sessions are created from the parsed CSV day, location, term, and time windows.
- Demo part-time staff own the sessions automatically.
- Saved schematic layouts are generated for every parsed session, so you do not have to manually place each class.
- A deterministic subset of classes gets request assignments using demo instructors.
- The generated full-week and single-day CSVs are the files to upload during the demo.
- Session planner data is still excluded.

## Suggested Demo Path

1. Sign in as Alex Rivera.
2. Confirm the `DeckSupervisor Demo Aquatics` team and four part-time members.
3. Upload `demo_single_day_classes.csv` to show matched Tuesday sessions at both locations.
4. Upload `demo_full_week_classes.csv` to show full-week extraction and filtering.
5. Open team schematics to show saved layouts across days and locations.
6. Sign in as Sam Nguyen to show the shared Tuesday Bayside session with roster edit access.
7. Sign in as Taylor Brooks to show the shared Tuesday Hillcrest session without roster edit access.
8. Open notes, report cards, rosters, print, and full-time tools to show seeded supporting data.

The seeder intentionally does not create session planner data.
