# Historical attendance templates

These 23 files are copied from commit `c315c452d8c0b3aabfff324f702f89aee3ce8a2e`
and are the production source of truth for attendance printing.

The filename without `.html` is the template key. `SplashFitness.html` is the
fallback for unknown keys. Each file must retain the `instructor`, `start_time`,
`session`, `location`, and `barcode` placeholders, the `attendance-rows` body,
the `student-rows` header, and the `.break-before-page` front/back boundary.

Template scripts are deliberately stripped before the browser mounts a print
document. Shared local replacements for the Tailwind utilities and bundled font
aliases live in `../attendanceCompatibility.css`.

After editing a template, run:

```bash
npm run test:attendance-html-visual -- Splash1
```

Substitute the applicable template key when targeting another sheet.

## Weekly marking template

`SkillMarking.html` is a separate, dynamically filled attendance-style sheet.
`buildSkillMarkingDocument.ts` fills the class metadata and rotates the saved
plan's skill and sub-skill headers, retaining student-name rows, black grid borders, and landscape printing. Daily
attendance fields are omitted; names come from matching local roster data when
available. It does not change
the historical templates. Up to 32 criteria fit across one sheet. Denser plans continue on additional
sheets; classes over fourteen students continue with the remaining names.
Without roster data, ten blank student rows are provided.

Run `npm run test:attendance-html-visual -- marking-all` to generate the marking,
continuation, private-curriculum, and empty-plan visual fixtures.

## Completed session sheets

The optional `roster.completed` input fills these same historical templates with
saved dated attendance and zero to three earned checks. Administrative columns
stay blank. Each student must have a resolved local name, stable enrollment ID,
and accepted results; unresolved conflicts or a mismatched curriculum block
completed printing. Private classes use their swimmers' assessed level sheets,
since the private reference sheet has no individual skill columns.

`completedPrintMap.json` pins each printed column to its curriculum skill ID,
including repeated numbers and component columns. The generator checks the
actual header text against the tablet catalog before writing the mapping.
`npm run generate:lesson-skills` regenerates this mapping too. The tablet sibling
checkout must be available; commit and review the generated outputs together.

A completed sheet keeps the whole class on one page: completed rows omit the
handwritten Absent/Present prompt, and `fitCompletedAttendancePages` zooms each
page to the paper (the same shrink Chrome applies to these wide templates, plus
more only for a page still too tall). Classes over 18 students
(`COMPLETED_STUDENTS_PER_SHEET`) or sessions over fourteen lesson dates continue
on another sheet that repeats class metadata, numbers rows on from the first
sheet, and preserves the original reverse-side requirements.
The current catalog's OR skills remain single assessment skills; separate
required components are never added together to invent extra earned checks.

Run `npm run test:run -- src/shared/attendance-print` and
`npm run test:attendance-html-visual -- completed-all`. The latter produces
synthetic PDFs for every assessable level and a large-class continuation fixture.
Blank-sheet visual parity remains `npm run test:attendance-html-visual -- all`.
