# Attendance browser-print architecture

Attendance sheets are assembled from the historical HTML templates in
`frontend/src/features/attendance-print/templates/`. Those files are copied
byte-for-byte from `backend/swimming attendance/` on the `main` branch at commit
`3bbb1f61c93f2b384186a545b4218cd5f14d01fb` and remain the content and
template-specific geometry authority.

## How printing works

The click handler opens a window synchronously, then lazy-loads the required
templates and local fonts. Scripts and external links are removed, roster data
is inserted with DOM APIs, and the original front/back fragments are grouped
into explicit Letter-landscape print pages. Chrome or Edge then opens its native
print dialog. Selecting **Save as PDF** produces selectable text without a
backend renderer, canvas capture, or PDF cache.

Only adjacent rosters with the same course code pair. Paired output places both
front fragments on one page and both back fragments on the next with the
historical `1.25rem` gap. Odd rosters retain their own front/back pages.
Instructor jobs can prepend an HTML schematic cover and blank back page.

## Where to make visual changes

- Edit a file in `templates/` for one level's wording, column widths, rotated
  headings, or private-lesson catalog.
- Edit `attendanceCompatibility.css` for shared page behavior, paired spacing,
  local utility definitions, or print-only adjustments.
- Edit `templateDom.ts` only when the roster-injection behavior itself changes.
- Edit `schematicCover.ts` for instructor-packet cover styling. Standalone
  schematic PDFs are still controlled by the React-PDF schematic feature.

The historical backend removed the Tailwind CDN script before Chromium printed
the templates. The compatibility utilities are therefore screen-only: they make
the preparation document readable but deliberately remain inert in print so the
old computed layout is preserved. No attendance print document makes an
external network request.

## Manual print settings

Use current Chrome or Edge with Letter paper, Landscape layout, default/100%
scale, default margins, and background graphics enabled when schematic covers
are included. The application cannot receive the bytes created by the browser
print dialog, so attendance downloads and IndexedDB PDF caching are intentionally
not available.

## Tests

Run the unit suite and a targeted historical comparison after changes:

```bash
cd frontend
npm run test:run -- src/features/attendance-print
npm run test:attendance-html-visual -- Splash1
```

Use `SplashPrivate`, `paired`, `odd`, or `covers` for those focused fixtures.
Running `npm run test:attendance-html-visual` renders all 23 templates using an
installed Chrome/Chromium/Edge (`CHROME_PATH` may override discovery), then uses
Poppler and ImageMagick to compare historical and current pages. Temporary PDFs
and diffs are written under `tmp/pdf-parity/`.
