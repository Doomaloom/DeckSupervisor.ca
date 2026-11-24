# Report card print maps

Filled report cards print the Lifesaving Society progress-report scans with the swimmer's results marked on them.
Each card is a tri-fold: an **outside** page (cover with Participant / Instructor / Date / Session and the
"Recommended Next Level" boxes) and an **inside** page (a tick box for each skill criterion). Both are landscape
letter pages (11 × 8.5 in) and print back to back (duplex, flip on the short edge).

## Files

- `frontend/public/report-cards/<card>-outside.jpg`, `<card>-inside.jpg`: 150 dpi page images, made with
  `scripts/report-cards/rc_page_image.sh` from the scans in `~/Documents/rec-tec/*-report-cards-combined.pdf`.
- `maps/<LevelId>.json`: one map per carded level (`LevelId` as in the catalog). Parent and Tot 1-3 share one printed card
  but keep a map each. Splash Fitness and Splash Private have no card.

## Where the maps come from

The maps are **generated** from rec-tablet's report card transcriptions
(`rec-tablet/src/workflows/swimming/curriculum/reportcards/<LevelId>.json`), which are the source of truth for the
current catalog's skills and subskills (ids, card text, box positions). Do not hand-edit `criteria`, `extraBoxes` or
`skills`; fix the transcription (and regenerate the catalog in rec-tablet) instead. To regenerate:

```
cd frontend
node scripts/report-cards/generate-maps-from-reportcards.mjs [path/to/reportcards]
```

The script keeps `level`, `images`, `source`, `fields` and `nextLevel` from the existing map and rebuilds `criteria`
(every subskill, keyed by its new id, with its `box`), `extraBoxes` (the transcription's `derivedBoxes`), `skills`
(skill heading rects, omitted where the card has none) and `unmapped` (always empty). `reportCardMaps.test.ts` checks
the result against rec-tablet's `catalog.json`: every subskill mapped exactly once, `ticksWith` ids real, coordinates in
range, images present, no two criteria in one box.

`scripts/report-cards/rc_highlights.py` (and `rc_boxes.py`) belong to the old hand-made maps; running it would overwrite
the generated highlights and ids, so do not use it on these maps. `rc_overlay.py` is still fine for checking a map by eye.

## Map format

All `x`/`y` are percentages of the landscape page (0–100, origin top left). Tick positions are box **centres**.

```json
{
  "level": "Splash1",
  "images": { "outside": "splash-1-outside.jpg", "inside": "splash-1-inside.jpg" },
  "source": { "pdf": "splash-1-to-6-report-cards-combined.pdf", "outsidePage": 1, "insidePage": 2 },
  "fields": {
    "participant": { "page": "outside", "x": 76.6, "y": 72.4 },
    "instructor":  { "page": "outside", "x": 75.8, "y": 77.0 },
    "date":        { "page": "outside", "x": 74.0, "y": 81.7 },
    "session":     { "page": "outside", "x": 87.2, "y": 81.7 }
  },
  "nextLevel": [ { "level": "Splash1", "page": "outside", "x": 36.7, "y": 20.3 } ],
  "criteria": { "Splash1:1:1": { "page": "inside", "x": 4.1, "y": 13.5 } },
  "unmapped": [ { "criterionId": "Splash1:9:3", "reason": "no box on the card" } ],
  "extraBoxes": [ { "page": "outside", "x": 4.5, "y": 38.1, "label": "Water Smart participation (no criterion)" } ]
}
```

- `fields` x/y: where the written text starts (left edge) and the vertical middle of the writing line.
- `nextLevel`: every "Recommended Next Level" box on the card, with the curriculum level it names
  (`level` may be a name outside the curriculum, such as `"Swim Patrol"`, written as on the card).
- `criteria`: every subskill of the level in the current catalog (each has a box on the card).
- `unmapped` (always empty now) / `extraBoxes`: boxes with no subskill of their own, such as the shared Water Smart participation box.
- An `extraBoxes` entry may add `"ticksWith": ["<criterionId>", …]` (and `"match": "any"`; default `"all"`) so a box the
  curriculum folds into other criteria still ticks: the Water Smart participation box ticks with any of the `…:1`
  participation criteria (`match: "any"`), the "roll back to front" boxes tick with the matching roll criteria, and a
  second per-stroke distance box ticks with the shared distance criterion.

Highlights: each criterion (and each linked extra box) may carry `"highlight": {x,y,w,h}` covering its box and text, and
`skills` maps a curriculum skill id to its heading area `{page,x,y,w,h}`, or a list of areas when the card prints
the skill under two headings (e.g. "Roll laterally front to back" and "back to front"). When "Highlight skills not yet achieved" is on,
unticked criteria and the headings of skills with any unticked criterion print under a translucent yellow highlight.
The generator copies these from the transcription.

Check a map by eye with `scripts/report-cards/rc_overlay.py maps/<LevelId>.json /tmp/out`.
