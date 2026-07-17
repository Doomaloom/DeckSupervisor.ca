# Historical attendance templates

These 23 files are the editable source of truth for attendance PDFs. They were restored
unchanged from commit `c315c452d8c0b3aabfff324f702f89aee3ce8a2e`.

Template keys are the filenames without `.html`. Unknown keys fall back to
`SplashFitness.html`. Each template must retain `#instructor`, `#start_time`, `#session`,
`#location`, `#barcode`, `#attendance-rows`, and the `#student-rows` header row. The
element with `.break-before-page` separates the front and back fragments.

The historical Tailwind CDN scripts remain in these files for provenance, but the
frontend strips every script before rendering and injects local compatibility CSS.
Do not add external images, stylesheets, fonts, or scripts.

After editing a template, run a focused Chromium comparison from `frontend/`:

```bash
npm run test:pdf-visual -- attendance-Splash1
```
