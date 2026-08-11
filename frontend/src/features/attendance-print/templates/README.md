# Historical attendance templates

These 23 files are copied byte-for-byte from `backend/swimming attendance/` on
the `main` branch at commit `3bbb1f61c93f2b384186a545b4218cd5f14d01fb` and
are the production source of truth for attendance printing.

The filename without `.html` is the template key. `SplashFitness.html` is the
fallback for unknown keys. Each file must retain the `instructor`, `start_time`,
`session`, `location`, and `barcode` placeholders, the `attendance-rows` body,
the `student-rows` header, and the original `page-break-before: always`
front/back boundary.

Template scripts are deliberately stripped before the browser mounts a print
document. Shared local replacements for the Tailwind utilities and bundled font
aliases live in `../attendanceCompatibility.css`.

After editing a template, run:

```bash
npm run test:attendance-html-visual -- Splash1
```

Substitute the applicable template key when targeting another sheet.
