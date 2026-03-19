# CSV Getter Helper

Chrome test steps:

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select [extensions/csv-getter](/Users/frankkocun/Documents/DeckSupervisor.ca/extensions/csv-getter)
5. Open the CSV getter page in a tab
6. Click the extension button
7. Pick the first day of the session from the popup calendar
8. Choose `Single day`, `Planner week`, or `Planner 2 weeks`
9. Choose `Jim Archdekin` or `Paul Palleschi`

Firefox test steps:

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on`
3. Select [manifest.json](/Users/frankkocun/Documents/DeckSupervisor.ca/extensions/csv-getter/manifest.json)
4. Open the CSV getter page in a tab
5. Click the extension button
6. Pick the first day of the session from the popup calendar
7. Choose `Single day`, `Planner week`, or `Planner 2 weeks`
8. Choose `Jim Archdekin` or `Paul Palleschi`

What it does:

- fills the report filters on the active tab
- sets `From` to the selected date
- sets `To` to the same date, 6 days later, or 13 days later depending on the selected range
- sets `Status` to `Booked` for single-day exports
- sets `Status` to `Booked` and `Waiting` for planner-week and planner-2-weeks exports
- sets the fixed season/show values
- turns on `Save Filter Selection`
- clicks `Preview`

Notes:

- The extension now uses Manifest V3 so it can be loaded unpacked in Chrome.
- It uses `activeTab`, so it only runs on the tab you click from.
- If the CSV getter page markup changes, the automation may need selector updates in [automation.js](/Users/frankkocun/Documents/DeckSupervisor.ca/extensions/csv-getter/automation.js).
