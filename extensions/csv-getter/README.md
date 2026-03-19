# CSV Getter Helper

Firefox test steps:

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on`
3. Select [manifest.json](/Users/frankkocun/Documents/DeckSupervisor.ca/extensions/csv-getter/manifest.json)
4. Open the CSV getter page in a tab
5. Click the extension button
6. Choose `Jim Archdekin` or `Paul Palleschi`
7. Enter the first day of the session in `YYYY-MM-DD` format when prompted

What it does:

- fills the report filters on the active tab
- sets `From` and `To` to the prompted date
- sets the fixed season/show/status values
- turns on `Save Filter Selection`
- clicks `Preview`

Notes:

- This is currently a Firefox-style MV2 extension for easy temporary loading and testing.
- It uses `activeTab`, so it only runs on the tab you click from.
- If the CSV getter page markup changes, the automation may need selector updates in [automation.js](/Users/frankkocun/Documents/DeckSupervisor.ca/extensions/csv-getter/automation.js).
