# Instructor device exports

Open **Device Exports** (`/device-exports`) after selecting and loading a session. Select an instructor, expand their classes, review levels and dates, then download the JSON. Import it using Rec Tablet's **Import Class Data** maintenance action. Downloads use the unchanged `rec-tablet-classes` schema version 1; no new backend endpoint is involved.

The page reads the selected session's extracted class list and current loaded roster rows. Signed-in sessions also await the current saved schematic assignments and roster/student level edits using existing APIs. Guest sessions work from loaded browser data. A loading or refresh error disables exports. Changing sessions or accounts cancels pending work and clears the prior view. New CSV loads record session provenance because the older roster cache is keyed by weekday; a different session's rows are rejected. Legacy loaded rows without that marker are matched against the selected session's course code, day, location, and start time.

Source classes are exported under their assigned instructor; unassigned classes are listed for correction. Custom printable roster groupings do not create additional device courses. Conflicting instructor assignments block export rather than emitting partial snapshots of a source class. Waitlisted swimmers, contact fields, ages, and credentials are excluded. Empty classes can export when their assignment is known. Private classes require each swimmer's actual level; generic Splash 2 must be resolved to 2A or 2B. Unrecognized curricula retain their level name for the device's missing-curriculum handling.

Lesson dates are proposed from the selected session's start/end dates and weekday(s), narrowed by an unambiguous ISO range in the source schedule when present. Dates use UTC calendar arithmetic. Holidays and cancellations are not known automatically: review and edit each class's dates. Mini-session labels without known weekdays require explicit dates. Reviewed dates are saved alongside export IDs for repeat exports and in ID backups. Rec Tablet's import adds dates; it does not delete historical lessons omitted by a later file.

## Identity and repeat imports

The export registry assigns random UUIDs, persists them in this browser's local storage before download, and isolates them by account scope and session. Every instructor export for the same session uses the same dataset ID. A different session produces a different dataset and needs a separate Rec Tablet database under the current device contract.

Course IDs combine the selected session ID and source course code, identifying an offering. Swimmer export IDs identify an enrollment within that course. A SHA-256 signature of course ID, exact trimmed name, and source contact value finds the saved UUID; generated UI row IDs, row order, skill levels, class times, and instructor assignment do not participate. This is a conservative POC mapping, not an upstream registration ID. Indistinguishable duplicate entries are rejected. A changed contact value behind a previously exported name is rejected for source correction. A changed name is a new signature and must be reviewed as a potential new enrollment; do not rename a swimmer as a substitute for an upstream identity reconciliation.

Use **Download ID backup** after exports. Restore it before exporting from another browser/profile or after clearing browser data. The backup retains dataset/swimmer IDs and reviewed dates. It contains names and matching signatures and should be handled with the roster files. Restores are validated against the selected session and cannot overwrite conflicting existing identities. Missing or failed local storage blocks download. Clearing the registry and creating new IDs does not silently replace the device's dataset: Rec Tablet rejects a different dataset ID.

Moving a class to another instructor retains its source ID. An instructor package does not remove omitted courses from a device; retiring classes or moving devices between datasets remains a device-management step under the existing importer contract.

## Verification

From `frontend/`:

```bash
npm run test:run -- src/features/device-export
npm run build
REC_TABLET_EXPORT_FIXTURES=/tmp/rec-tablet-contract node scripts/test-device-export.mjs
```

The browser script uses installed Chromium (`CHROME_PATH` overrides `/usr/bin/chromium`), starts a local Vite server, seeds synthetic guest session data, and checks the real route, downloads, reload, ID restore, roster changes, and session switching. It writes a screenshot and actual downloaded `initial.json`, `updated.json`, and `returned.json` files. No backend or real roster is needed. `DEVICE_EXPORT_TEST_PORT` overrides port 5193.

Then, from the Rec Tablet repository:

```bash
REC_TABLET_EXPORT_FIXTURES=/tmp/rec-tablet-contract go test ./internal/store -run TestDeckSupervisorExportRoundTrip -v
```

That test imports the browser downloads into SQLite, saves attendance and an assessed skill, applies roster and level changes, and verifies identities and progress survive. The TypeScript feature tests can also emit those contract files when given the same environment variable.
