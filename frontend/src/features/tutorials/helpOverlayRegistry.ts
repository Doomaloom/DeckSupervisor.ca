import type { HelpOverlayDefinition } from './helpOverlayTypes'

const defaultUnsupportedMessage =
  'Quick tips are not available on this page yet. Use Help / Tutorials on Home for the full prep walkthrough.'

export const helpOverlayRegistry: Record<HelpOverlayDefinition['id'], HelpOverlayDefinition> = {
  'manage-session': {
    id: 'manage-session',
    routePaths: ['/manage-sessions'],
    title: 'Manage Sessions Quick Tips',
    introTitle: 'Confirm the session before you schedule or print',
    introBody: [
      'Use this page to confirm the session identity, location mapping, and instructor list before you move into the schematic or print flow.',
      'Click a numbered area for details on the parts that usually need the most attention.',
    ],
    unsupportedMessage: defaultUnsupportedMessage,
    tips: [
      {
        id: 'summary',
        title: 'Session Summary',
        body: [
          'This confirms which session is currently active before you edit anything.',
          'Check the title, date range, team, and location here first so you do not update the wrong session.',
        ],
        selector: '[data-help-anchor="manage-session-summary"]',
        order: 1,
        placement: 'top-left',
      },
      {
        id: 'details',
        title: 'Session Details',
        body: [
          'Day, season, year, dates, and times define the session itself.',
          'If these are wrong, downstream scheduling and print outputs will be wrong too.',
        ],
        selector: '[data-help-anchor="manage-session-fields"]',
        order: 2,
        placement: 'top-right',
      },
      {
        id: 'locations',
        title: 'Display Location vs Source Locations',
        body: [
          'Display Location is the label shown around the app and on outputs.',
          'Source Locations are the raw CSV locations that should all map into this single session.',
        ],
        selector: '[data-help-anchor="manage-session-location-mapping"]',
        order: 3,
        placement: 'bottom-left',
      },
      {
        id: 'instructors',
        title: 'Instructor List',
        body: [
          'This list feeds the schematic columns and the instructor print flow.',
          'Make sure the teaching staff is correct before you start assigning classes.',
        ],
        selector: '[data-help-anchor="manage-session-instructors"]',
        order: 4,
        placement: 'center-right',
      },
      {
        id: 'save',
        title: 'Save and Overlap Warning',
        body: [
          'If an overlap warning appears, review it before saving.',
          'Use Save Changes after you confirm the session setup so later pages use the right session data.',
        ],
        selector: '[data-help-anchor="manage-session-actions"]',
        order: 5,
        placement: 'bottom-right',
      },
      {
        id: 'shared',
        title: 'Shared Session Notice',
        body: [
          'Shared access can make this page view-only.',
          'If this notice is visible, use it as confirmation that editing is disabled for this session.',
        ],
        selector: '[data-help-anchor="manage-session-shared-notice"]',
        order: 6,
        placement: 'bottom-right',
        optional: true,
      },
    ],
  },
  schematic: {
    id: 'schematic',
    routePaths: ['/schematic'],
    title: 'Schematic Quick Tips',
    introTitle: 'Use the board to place classes visually',
    introBody: [
      'The schematic is the main scheduling surface for part-time prep.',
      'Click a numbered area to see how the board, move modes, and cleanup actions work.',
    ],
    unsupportedMessage: defaultUnsupportedMessage,
    tips: [
      {
        id: 'board',
        title: 'Board Structure',
        body: [
          'Each column represents an instructor lane and the cards are the classes assigned into that lane.',
          'The time rails show where classes fall across the day.',
        ],
        selector: '[data-help-anchor="schematic-board"]',
        order: 1,
        placement: 'top-left',
      },
      {
        id: 'single-move',
        title: 'Single Move',
        body: [
          'Drag one course card when you only need a one-class move or swap.',
          'This is the fastest way to fix one assignment without restructuring a whole block.',
        ],
        selector: '[data-help-anchor="schematic-single-move"]',
        order: 2,
        placement: 'top-left',
      },
      {
        id: 'multi-move',
        title: 'Multi-Move',
        body: [
          'Build a same-column selection first, then drag the selected block together.',
          'Multi-move is for grouped shifts, not arbitrary cards from different columns.',
        ],
        selector: '[data-help-anchor="schematic-multi-move"]',
        order: 3,
        placement: 'top-right',
      },
      {
        id: 'add-column',
        title: 'Add Temporary Column',
        body: [
          'Use a temporary column when you need extra space to reshuffle classes before final cleanup.',
        ],
        selector: '[data-help-anchor="schematic-add-column"]',
        order: 4,
        placement: 'bottom-left',
      },
      {
        id: 'remove-column',
        title: 'Remove Empty Columns',
        body: [
          'After moving classes around, remove empty columns to clean the board back up.',
        ],
        selector: '[data-help-anchor="schematic-remove-empty-columns"]',
        order: 5,
        placement: 'bottom-left',
      },
      {
        id: 'save',
        title: 'Save Schedule',
        body: [
          'Board changes are not the final saved layout until you use Save Schedule.',
          'If the page is read-only, this area becomes View Only instead.',
        ],
        selector: '[data-help-anchor="schematic-save-schedule"]',
        order: 6,
        placement: 'bottom-right',
      },
    ],
  },
  rosters: {
    id: 'rosters',
    routePaths: ['/rosters'],
    title: 'Rosters Quick Tips',
    introTitle: 'Use rosters to review the day before printing',
    introBody: [
      'This page is for roster review, level adjustments, and roster-level printing.',
      'Click a numbered area to focus on the parts that matter most during prep.',
    ],
    unsupportedMessage: defaultUnsupportedMessage,
    tips: [
      {
        id: 'filters',
        title: 'Filters and Search',
        body: [
          'Use these controls to narrow the page by instructor, service name, student, or course code.',
          'This is the quickest way to find one problem roster without scanning the full list.',
        ],
        selector: '[data-help-anchor="roster-filters"]',
        order: 1,
        placement: 'top-right',
      },
      {
        id: 'card',
        title: 'Roster Card Overview',
        body: [
          'Each roster card represents one class for the selected day.',
          'Review the class title, instructor, level, and student list here before printing.',
        ],
        selector: '[data-help-anchor="roster-card-overview"]',
        order: 2,
        placement: 'top-left',
      },
      {
        id: 'level-mode',
        title: 'Class Level vs Individual Level',
        body: [
          'Class Level changes the whole roster quickly.',
          'Individual Level lets you adjust specific students. If you only have shared access without roster edits, these changes stay locked.',
        ],
        selector: '[data-help-anchor="roster-level-mode"]',
        order: 3,
        placement: 'center-right',
      },
      {
        id: 'print',
        title: 'Roster Print Button',
        body: [
          'Use this Print button when you only need output for one class instead of the full print page.',
        ],
        selector: '[data-help-anchor="roster-print-button"]',
        order: 4,
        placement: 'top-right',
      },
    ],
  },
  print: {
    id: 'print',
    routePaths: ['/print'],
    title: 'Print Quick Tips',
    introTitle: 'Pick the output that matches the document you need',
    introBody: [
      'The Print page is the last prep step before pool-deck operations.',
      'Click a numbered area to see what each print action is for.',
    ],
    unsupportedMessage: defaultUnsupportedMessage,
    tips: [
      {
        id: 'overview',
        title: 'Print Page Overview',
        body: [
          'This page is the central print hub for the session.',
          'Choose by the kind of document you need, not by habit.',
        ],
        selector: '[data-help-anchor="print-page-header"]',
        order: 1,
        placement: 'top-left',
      },
      {
        id: 'day1',
        title: 'Day 1 Print',
        body: [
          'This creates the day-one starter packet, including attendance-oriented materials.',
        ],
        selector: '[data-help-anchor="print-day1"]',
        order: 2,
        placement: 'top-left',
      },
      {
        id: 'instructors',
        title: 'Print Instructor Sheets',
        body: [
          'This creates instructor packets grouped for teaching use.',
        ],
        selector: '[data-help-anchor="print-instructors"]',
        order: 3,
        placement: 'top-right',
      },
      {
        id: 'masterlist',
        title: 'Print Masterlist',
        body: [
          'This creates the condensed admin and front-desk summary sheet.',
        ],
        selector: '[data-help-anchor="print-masterlist"]',
        order: 4,
        placement: 'bottom-left',
      },
      {
        id: 'schematic',
        title: 'Print Schematic',
        body: [
          'This exports the visual schedule board for quick on-deck reference.',
        ],
        selector: '[data-help-anchor="print-schematic"]',
        order: 5,
        placement: 'bottom-right',
      },
      {
        id: 'options',
        title: 'Options and Preview Expectations',
        body: [
          'Some print actions open an options modal before generating PDFs.',
          'Use those screens to adjust covers, highlights, orientation, or previews before printing.',
        ],
        selector: '[data-help-anchor="print-options-grid"]',
        order: 6,
        placement: 'center-right',
      },
    ],
  },
}
