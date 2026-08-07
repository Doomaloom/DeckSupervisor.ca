# Historical attendance templates

These 23 files are copied from commit
`c315c452d8c0b3aabfff324f702f89aee3ce8a2e` and are the production source of
truth for attendance printing.

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
