# Activity library source review

The application uses `activities.json`, a reviewed, read-only collection derived
from the user-supplied `COB-Aquatics-SPA/Activity library.pdf` (Lifesaving
Society, _Teaching Swim for Life_). The 164 MB scan is not needed by the
application or included in its build.

Source SHA-256:
`2a39fe105e7349f954c8bbbf70029d07ded16d923f45433daab69b29e076b8e3`.

## Extraction and coverage

The PDF contains 24 image-only pages. Poppler rendering and Tesseract OCR were
used to inspect it; OCR alone is not a reliable import format. Two-page spreads
were split into left/right pages; the sideways drill tables were rotated 90
degrees clockwise. Relevant pages were rendered at a maximum dimension of 3600
pixels and checked visually against OCR before entering the data.

| Scan pages | Printed pages | Included entries                                                  |
| ---------- | ------------- | ----------------------------------------------------------------- |
| 1-3        | 7-11          | 37 song guides and 4 games                                        |
| 8-11       | 20-27         | 18 front crawl, 20 back crawl, and 15 breaststroke drills         |
| 23         | 58-59         | 13 dry-land stretches/exercises                                   |
| 23-24      | 59-61         | 6 main sets, 6 complete interval workouts, 1 warm-up, 1 cool-down |

Total: **121 entries** (Songs 37, Games 4, Drills 66, Workouts 14).

Songs contain titles and original descriptions of their themes/actions, not full
lyrics. Games and drills use edited instructions preserving the practical steps,
variations, equipment, and coaching purpose. Source suitability labels remain in
the PDF's terminology. Workout repetition counts, distances, send-off times, and
rest periods are retained. “Start every” denotes the source's interval; “rest”
denotes its explicit recovery time. Do not silently treat these as equivalent.

Excluded: general Water Smart commentary, stroke definitions and assessment
charts (scan pages 4-7), blank registers and planning forms (12-22), and general
workout-design commentary. Named dry-land exercises are classified as Drills.
Warm-up, main-set, and cool-down components are identified as components rather
than represented as complete workouts.

Review details:

- Join “Going on a Lion Hunt (2)” across scan pages 1-2 and “Swimming Duck”
  across 2-3. Keep the two lion-hunt and two monkey variants distinct. Join the
  actions for “My Aunt Greet” across the two halves of scan page 2.
- Qualify repeated drill titles with their stroke, retaining their different
  instructions.
- OCR scrambled the first three breaststroke kicking rows on scan page 11. The
  verified order is vertical kicking, vertical wall kicking, and kicking
  with/without a board.
- Restore the end of “Shooters” from the scan: the arms recover forward quickly
  after the hands meet at the body's centre.
- Scan page 23's shoulder-stretch text repeats “left arm” inconsistently. The
  edited guide describes the cross-chest action without repeating that
  side-label error.
- Preserve both the 4 × 50 m pace sequence and the 25/50/75/100 m progression
  shown under the sample warm-up, without inventing rest times. Unspecified
  ladder strokes and main-set intervals remain unspecified.
- The 13-18 main set A uses 2:45 and 2:35 send-offs; the 11-14 main set A uses
  2:00, 1:20, and 55 seconds. The final workout uses a 200 m middle repetition,
  not 75 or 100 m.

## Skill links

`skillIds` are manually curated presentation metadata referencing the existing
curriculum IDs, not runtime keyword matching or renamed assessment requirements.
Match teaching purpose and technique as well as source difficulty. Beginner
front-crawl activities include PFD-supported skills where the source permits a
buoyant aid; advanced high-elbow and bent-arm drills are restricted to the
reviewed advanced skills. Front- and back-crawl mappings remain separate.
Vertical whip-kick exercises and horizontal kick exercises have different links.

The source explicitly associates sample workouts with Fitness Swimmer interval
sets and workout design; these entries link to `SplashFitness:4` and/or
`SplashFitness:6`. An age band alone does not justify mapping a workout to every
class's stroke or distance requirement. Dry-land exercises link to
`SplashFitness:2`.

Generic songs and games without a defensible skill-specific action have empty
mappings (21 entries). They remain searchable in the full collection and are
omitted only when filtering by a skill. This is a relevance aid, not an
assertion that an activity completes an assessment requirement.

## Maintenance and checks

Edit the reviewed JSON rather than importing raw OCR. Keep IDs stable, document
new source pages, verify every instruction against the scan, and audit skill
links when curricula change. Do not expand song entries into lyric
transcriptions.

Run from `frontend`:

```sh
npm run test:run -- src/features/activity-library src/features/instructor/LessonPlans.test.tsx src/features/instructor/InstructorSession.test.tsx src/features/instructor/InstructorLayout.test.tsx src/features/pdf/lessonPlan/LessonPlanDocument.test.ts
node scripts/test-activity-library-browser.mjs /tmp/activity-library-qa
npm run build
```

The browser check uses a temporary localhost Vite server, synthetic account/API
modules, and an isolated headless Chromium context. It never signs into a real
account or writes real lesson data. Set `CHROMIUM_PATH` if Chromium is installed
elsewhere. Screenshots and results go to the requested output directory.

## Structured workout presets

`../workout-builder/workoutPresets.ts` contains 26 editable section presets from
scan pages 23–24 (printed pages 59–61): sample warm-up/cool-down, six age-group
main sets, and the three sections of each of six interval workouts. Age
filtering is explicit and defaults to All. Rest and send-off timing remain
separate. The sample warm-up retains both the 4 × 50 m progression and the
printed 25/50/75/100 m progression; instructors can remove sets if using them as
alternatives. Unspecified strokes use Choice of stroke and unspecified timing
remains empty. Presets are cloned into the builder; editing does not alter the
reference library.

Run the workout tests alongside the checks above:
`npm run test:run -- src/features/workout-builder`. The browser script also
checks workout creation, confirmations, native dialog behavior, saved metadata
reopening, and conversion to text at desktop and mobile sizes.
