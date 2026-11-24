# Report card print maps

Filled report cards print the Lifesaving Society progress-report scans with the swimmer's results marked on them.
Each card is a tri-fold: an **outside** page (cover with Participant / Instructor / Date / Session and the
"Recommended Next Level" boxes) and an **inside** page (a tick box for each skill criterion). Both are landscape
letter pages (11 × 8.5 in) and print back to back (duplex, flip on the short edge).

## Files

- `frontend/public/report-cards/<card>-outside.jpg`, `<card>-inside.jpg`: 150 dpi page images, made with
  `scripts/report-cards/rc_page_image.sh` from the scans in `~/Documents/rec-tec/*-report-cards-combined.pdf`.
- `maps/<LevelId>.json`: one map per curriculum level (`LevelId` as in `features/results/curriculum.json`).

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
- `criteria`: every curriculum criterion of the level that has a box on the card.
- `unmapped` / `extraBoxes`: criteria with no box, and boxes with no criterion. Both are reviewed, never guessed.

Check a map by eye with `scripts/report-cards/rc_overlay.py maps/<LevelId>.json /tmp/out`.
