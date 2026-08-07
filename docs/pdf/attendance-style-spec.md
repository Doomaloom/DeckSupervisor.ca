# Attendance PDF style specification

The 23 attendance documents are derived from the historical HTML templates at
`c315c452d8c0b3aabfff324f702f89aee3ce8a2e`. Production rendering remains
frontend-only, selectable vector output through React-PDF.

## Shared page

- Letter landscape: 792 × 612 points.
- Margin: 19.2 points; printable area: 753.6 × 573.6 points.
- White background, black Liberation Sans text.
- No decorative back-page title, border, fill, or divider.

All manually adjustable values live in
`frontend/src/features/pdf/attendance/attendanceStyle.ts`. Generated template
content and per-template geometry live in `attendanceTemplateData.generated.json`.

## Front sheet

The historical sheet width, header width, rotated-heading dimensions, and skill
column weights remain template-specific. Those values are relative geometry, not
style overrides. The renderer fits them to the printable width with:

`frontFit = printableWidth / (sheetWidthPx × 0.75)`

Shared logical sizes are 18 pt for the title, 12 pt for metadata, 7.5 pt for
rotated headings/student text, and 8.25 pt for the grey day labels, each multiplied
by `frontFit`. Borders are 0.75 pt multiplied by the same fit. Metadata order is
Instructor, Start Day/Time, Session, Location, and Barcode. Empty rosters have no
generated student row.

## Assessment back sheet

Ordinary templates use three equal columns. Historical narrow spacer cells are
treated as gutters; historical skill blocks retain their source column and order.
The physical style is based on a 1200 pt logical sheet fitted to 753.6 pt:

- Scale: 0.628.
- Gutter: 5.024 pt.
- Horizontal padding: 2.512 pt.
- Font: 4.71 pt Liberation Sans with 1.25 line height.
- Block spacing: 4.71 pt.
- Bullet indentation: 5.65 pt.
- Numbered skill headings are bold; assessment criteria are regular.

Headings, criteria, bullets, dashes, bold spans, and explicit line boundaries are
structured content. They must never be flattened or redistributed by item count.

## Splash Private back sheet

Splash Private intentionally uses a compact reference catalog rather than one
level's assessment criteria. It has three equal columns, a 6.28 pt gap, 5.42 pt
text at 1.05 line height, and 1.88 pt between program blocks. Distribution is:

1. Splash 1–6.
2. Splash 7–9 and Teen/Adult 1.
3. Teen/Adult 2–3 and Little Splash 1–5.

## Paired sheets

Adjacent same-code rosters pair. Both fronts precede both backs. Paired fragments
are separated by 15 pt and each receives 279.3 pt of vertical space. Typography and
vertical spacing may density-scale to fit; columns remain full width and content is
never cropped.

## Regeneration and review

- `npm run attendance:catalog:check` checks the generated catalog against the
  pinned HTML source.
- `npm run test:attendance-visual` renders the current fixture suite and compares
  it with historical references.
- Target a template with `npm run test:attendance-visual -- Splash1`, or back-page
  contact sheets with `npm run test:attendance-visual -- backs`.
- Poppler and ImageMagick are required for calibration and image comparison.
- Temporary PDFs, rasters, bounding boxes, and contact sheets belong under
  `tmp/pdf-parity/`.
