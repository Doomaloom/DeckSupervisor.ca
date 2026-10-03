# DEC-45 local hands-on evidence — October 3, 2026

The real React SPA and Go cookie-authenticated handlers were exercised in isolated Chromium contexts at 1440×1000 and 390×844. The Browser plugin was initialized and reported no available browser sessions; installed Chromium was used as the local test fallback. Authentication was simulated by the committed test-only Supabase adapter. Reads/writes used caller-specific PostgreSQL `authenticated` roles and actual RLS policies in a newly initialized local database, not a hosted project.

Run `bash scripts/instructor-qa.sh`, then `node frontend/scripts/test-instructor-browser.mjs docs/qa/cycle-2/screenshots` and `node frontend/scripts/test-instructor-links.mjs`. The adapter implements only the subset of PostgREST needed here and is not a production provider substitute. All endpoints bind to localhost. Accounts use reserved `.invalid` emails.

| Check | Evidence/result |
| --- | --- |
| Enter Instructor View above Logout, retain login | Desktop/mobile browser login and switch passed |
| Linked-only column with duplicate display names | Account A saw Swimmer 1/2; account B saw OTHER; no other instructor column |
| Separate same-weekday sessions | Distinct class UUID links and different dates/pools; switching and reload preserved selection |
| Explicit-save planning and persistence | Saved activity survived page reload through PostgreSQL |
| Failed save and unsaved-navigation prompt | Aborted PUT retained edited skill; declining prompt retained editor |
| Untouched week | Null/no-plan state; no rows created |
| Attendance placeholder | Accessible coming-later text; no attendance editing |
| Unlinked account | Clear empty state on mobile |
| Guest direct API | HTTP 401 |
| Cross-account direct plan API | HTTP 403; screenshot retained |
| Supervisor link/unlink UI | Saved-column links displayed; Unlink immediately hid account A's classes |
| Reassignment | Account B could read account A's previously saved plan; account A received 403 |
| Authorized return | Switching to Instructor View and back retained selected supervisor session |
| PDF preview | Existing viewer opened and PDF generation succeeded; headless Chromium did not render its native PDF plugin content in screenshots |
| PDF content/layout | Separate Poppler rendering verified single-page and 11-page synthetic outputs, all 32 activities, complete repeated headers, long text wrapping and margins |

Machine results are in `screenshots/results.json` and `screenshots/link-results.json`. Screenshots contain only synthetic metadata. PDF render screenshots are in `pdf/`; fixture PDFs are not needed to rerun validation and are retained only in temporary output.

Limitations: no physical printer dialog, actual Supabase email delivery, or hosted deployment was exercised. Native PDF plugin screenshot is a viewer-shell check; the Poppler page renders establish PDF content/layout. Other supervisor workflows are outside this test adapter's subset.

Cleanup: stopping the QA runner terminates the provider, backend, Vite and disposable PostgreSQL process, then deletes the cluster, synthetic accounts, classes, links and plans. No production systems, `rec-tablet`, or unrelated untracked files were modified.
