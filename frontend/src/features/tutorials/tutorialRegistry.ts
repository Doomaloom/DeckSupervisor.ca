import type { TutorialDefinition } from './types'

export const tutorialRegistry: Record<TutorialDefinition['id'], TutorialDefinition> = {
  'prep-workflow': {
    id: 'prep-workflow',
    title: 'Prep Workflow',
    shortDescription: 'The five-step sequence from CSV import through to printing.',
    audience: 'part-time',
    keywords: ['prep', 'workflow', 'csv', 'schematic', 'print'],
    prerequisites: ['Have the roster export CSV ready before starting.'],
    steps: [
      {
        kind: 'scene',
        title: 'The Preparation Workflow',
        body: [
          'Effective prep follows a standard sequence. This tutorial walks you through each of the five core stages to ensure your session is set up correctly before you hit the pool deck.',
        ],
        sceneId: 'workflow-roadmap',
        annotations: [],
      },
      {
        kind: 'scene',
        title: 'Step 1: Input the CSV on the Dashboard',
        body: [
          'Prep starts on the dashboard. Use "Upload CSV" to let the app inspect your roster export and extract session candidates.',
          'Selecting an extracted session will either load an existing session or create a new one based on the CSV data.',
        ],
        sceneId: 'prep-dashboard',
        annotations: [
          {
            id: 'upload',
            label: 'Upload CSV and Choose Session',
            description: 'This is the primary prep entry point.',
            x: 50,
            y: 34,
            width: 50,
            height: 14,
          },
        ],
      },
      {
        kind: 'scene',
        title: 'Step 2: Adjust Session Settings in Manage Sessions',
        body: [
          'After choosing the extracted session, use Manage Sessions as your confirmation page. Verify the session identity, dates, times, and location mapping.',
          'Confirm your instructor list here so it correctly feeds the schematic board and print packets.',
        ],
        sceneId: 'manage-session-overview',
        annotations: [
          {
            id: 'fields',
            label: 'Session identity',
            description: 'Check day, season, dates, times, and location mapping.',
            x: 50,
            y: 46,
            width: 90,
            height: 35,
          },
          {
            id: 'instructors',
            label: 'Instructors',
            description: 'Make sure the staff list is correct.',
            x: 50,
            y: 72,
            width: 90,
            height: 18,
          },
        ],
      },
      {
        kind: 'scene',
        title: 'Step 3: Make the Schematic',
        body: [
          'Use the schematic to assign classes visually across instructor columns.',
          'Drag cards individually or use multi-move for grouped blocks. Save the schedule once the board reflects the real plan.',
        ],
        sceneId: 'schematic-move-modes',
        annotations: [
          {
            id: 'single',
            label: 'Single move',
            description: 'Drag one class card.',
            x: 18,
            y: 52,
            width: 28,
            height: 34,
          },
          {
            id: 'multi',
            label: 'Multi-move',
            description: 'Drag a selected block.',
            x: 50,
            y: 52,
            width: 28,
            height: 34,
          },
        ],
      },
      {
        kind: 'scene',
        title: 'Step 4: Adjust Rosters if needed',
        body: [
          'Use the Rosters page to review student lists and make level changes.',
          'Adjust levels at the class or individual level to ensure your attendance sheets are accurate.',
        ],
        sceneId: 'rosters-overview',
        annotations: [
          {
            id: 'filters',
            label: 'Review tools',
            description: 'Search and filter to check specific rosters.',
            x: 50,
            y: 38,
            width: 90,
            height: 12,
          },
          {
            id: 'level-mode',
            label: 'Level Edits',
            description: 'Change levels for the whole class or specific students.',
            x: 73,
            y: 54,
            width: 14,
            height: 10,
          },
        ],
      },
      {
        kind: 'scene',
        title: 'Step 5: Print',
        body: [
          'Finally, use the Print page to generate your documents. Choose the button that matches the document you need.',
          'The previews show exactly what each print action produces.',
        ],
        sceneId: 'print-output-overview',
        annotations: [
          {
            id: 'day1',
            label: 'Outputs',
            description: 'Day 1 Sheets, Instructor Packets, Masterlists, and Schematic exports.',
            x: 18,
            y: 53,
            width: 18,
            height: 66,
          },
        ],
      },
      {
        kind: 'related',
        title: 'Deep dives',
        tutorialIds: ['manage-session', 'schematic', 'rosters', 'print'],
      },
    ],
  },
  dashboard: {
    id: 'dashboard',
    title: 'Dashboard / Home',
    shortDescription: 'Get oriented on the dashboard and know where the prep flow starts.',
    audience: 'part-time',
    routePaths: ['/'],
    keywords: ['dashboard', 'home', 'prep'],
    steps: [
      {
        kind: 'scene',
        title: 'Home is the prep entry point',
        body: [
          'The dashboard is where you start prep, resume an existing session, or open the full prep workflow tutorial.',
        ],
        sceneId: 'prep-dashboard',
        annotations: [
          {
            id: 'upload',
            label: 'Upload CSV and Choose Session',
            description: 'The main prep path starts here.',
            x: 50,
            y: 34,
            width: 50,
            height: 14,
          },
          {
            id: 'help',
            label: 'Help / Tutorials',
            description: 'Open the full prep workflow tutorial from here.',
            x: 50,
            y: 53,
            width: 50,
            height: 14,
          },
        ],
      },
      {
        kind: 'warning',
        title: 'Before you continue',
        items: [
          'Confirm that you are working from the correct session context before making changes elsewhere in the app.',
          'If the roster export is driving the day, start with the CSV rather than jumping straight to other pages.',
        ],
      },
      {
        kind: 'related',
        title: 'Open the full prep flow',
        tutorialIds: ['prep-workflow', 'manage-session'],
      },
    ],
  },
  'upload-csv': {
    id: 'upload-csv',
    title: 'Upload CSV and Choose Session',
    shortDescription: 'Legacy split tutorial now folded into Prep Workflow.',
    audience: 'part-time',
    visibleInCatalog: false,
    keywords: ['csv', 'upload', 'legacy'],
    steps: [
      {
        kind: 'related',
        title: 'Use the main workflow instead',
        tutorialIds: ['prep-workflow'],
      },
    ],
  },
  'start-session': {
    id: 'start-session',
    title: 'Start New Session',
    shortDescription: 'Legacy split tutorial now folded into Prep Workflow.',
    audience: 'part-time',
    visibleInCatalog: false,
    keywords: ['start session', 'legacy'],
    steps: [
      {
        kind: 'related',
        title: 'Use the main workflow instead',
        tutorialIds: ['prep-workflow'],
      },
    ],
  },
  'manage-session': {
    id: 'manage-session',
    title: 'Manage Sessions',
    shortDescription: 'Confirm the session setup before you move into scheduling and print prep.',
    audience: 'part-time',
    routePaths: ['/manage-sessions'],
    keywords: ['manage session', 'save changes', 'session details'],
    steps: [
      {
        kind: 'scene',
        title: 'What this page is for',
        body: [
          'Use this page to confirm the session identity after import or when resuming work on a saved session.',
        ],
        sceneId: 'manage-session-overview',
        annotations: [
          {
            id: 'fields',
            label: 'Session details',
            description: 'Check the dates, times, location mapping, and other session identity fields here.',
            x: 27,
            y: 46,
            width: 38,
            height: 36,
          },
          {
            id: 'instructors',
            label: 'Instructor list',
            description: 'Make sure the instructors on shift are correct before scheduling.',
            x: 73,
            y: 46,
            width: 38,
            height: 36,
          },
        ],
      },
      {
        kind: 'tips',
        title: 'What to confirm',
        items: [
          'Check day, season, dates, time range, display location, and source locations.',
          'Make sure the instructors listed here are the ones you expect to schedule in the schematic.',
        ],
      },
      {
        kind: 'warning',
        title: 'Save and read-only cautions',
        items: [
          'Use Save Changes before moving on to Schematic, Rosters, or Print.',
          'If you opened a shared coverage session, editing can be disabled and the page may be view-only.',
        ],
      },
    ],
  },
  schematic: {
    id: 'schematic',
    title: 'Schematic',
    shortDescription: 'Use the board to place classes visually and save the finished schedule.',
    audience: 'part-time',
    routePaths: ['/schematic'],
    keywords: ['schematic', 'single move', 'multi-move', 'save schedule'],
    steps: [
      {
        kind: 'scene',
        title: 'Read the board',
        body: [
          'Instructor columns organize the day by teaching lane. Course cards are the classes you can move and rebalance.',
        ],
        sceneId: 'schematic-move-modes',
        annotations: [
          {
            id: 'board',
            label: 'Instructor columns',
            description: 'The board is grouped by instructor columns with time-based class cards inside them.',
            x: 50,
            y: 62,
            width: 90,
            height: 32,
          },
        ],
      },
      {
        kind: 'tips',
        title: 'Single move vs multi-move',
        items: [
          'Single move: drag one course into another column or onto a target course when you only need a one-card change.',
          'Multi-move: click multiple courses from the same column to build a selected block, then drag that selection together.',
        ],
      },
      {
        kind: 'warning',
        title: 'Finish the board cleanly',
        items: [
          'Use Save Schedule after the board reflects the real plan.',
          'Remove leftover empty temporary columns unless they are intentionally part of the saved layout.',
        ],
      },
    ],
  },
  rosters: {
    id: 'rosters',
    title: 'Rosters',
    shortDescription: 'Review classes, adjust levels, and print attendance from the roster cards.',
    audience: 'part-time',
    routePaths: ['/rosters'],
    keywords: ['rosters', 'class level', 'individual level', 'print'],
    steps: [
      {
        kind: 'scene',
        title: 'Use the page to review the day',
        body: [
          'Rosters is where you search, filter, review class composition, and make level changes before printing.',
        ],
        sceneId: 'rosters-overview',
        annotations: [
          {
            id: 'filters',
            label: 'Filters and search',
            description: 'Use these controls to narrow the page to the classes or students you need.',
            x: 50,
            y: 18,
            width: 70,
            height: 12,
          },
          {
            id: 'print',
            label: 'Roster card actions',
            description: 'Each roster card includes level controls and its own Print action.',
            x: 58,
            y: 48,
            width: 44,
            height: 18,
          },
        ],
      },
      {
        kind: 'tips',
        title: 'Level editing modes',
        items: [
          'Use Class Level when the whole roster needs the same level.',
          'Use Individual Level when you only need to adjust specific students.',
        ],
      },
      {
        kind: 'warning',
        title: 'Shared-session caveat',
        items: [
          'If roster edits are locked in a shared coverage session, treat the page as read-only.',
        ],
      },
    ],
  },
  'custom-rosters': {
    id: 'custom-rosters',
    title: 'Custom Rosters',
    shortDescription: 'Hidden from the current main tutorial flow.',
    audience: 'part-time',
    visibleInCatalog: false,
    keywords: ['custom rosters', 'hidden'],
    steps: [
      {
        kind: 'related',
        title: 'Use the default roster prep flow',
        tutorialIds: ['rosters', 'prep-workflow'],
      },
    ],
  },
  print: {
    id: 'print',
    title: 'Print',
    shortDescription: 'Match each print button to the document it produces.',
    audience: 'part-time',
    routePaths: ['/print'],
    keywords: ['print', 'day 1', 'masterlist', 'schematic'],
    steps: [
      {
        kind: 'intro',
        title: 'What this page does',
        body: [
          'The Print page is a document hub. Each button produces a different kind of output for a different operational need.',
        ],
      },
      {
        kind: 'scene',
        title: 'See what each print button produces',
        body: [
          'Each print option is paired with a mock of the document it creates so you can choose by outcome, not just by label.',
        ],
        sceneId: 'print-output-overview',
        annotations: [
          {
            id: 'day1',
            label: 'Day 1 Print',
            description: 'Attendance-sheet style output for the first day of the session.',
            x: 18,
            y: 26,
            width: 18,
            height: 12,
          },
          {
            id: 'instructors',
            label: 'Print Instructor Sheets',
            description: 'Instructor packet output grouped for teaching use.',
            x: 18,
            y: 44,
            width: 18,
            height: 12,
          },
          {
            id: 'masterlist',
            label: 'Print Masterlist',
            description: 'Condensed admin or front-desk summary output.',
            x: 18,
            y: 62,
            width: 18,
            height: 12,
          },
          {
            id: 'schematic',
            label: 'Print Schematic',
            description: 'Visual schedule export of the board.',
            x: 18,
            y: 80,
            width: 18,
            height: 12,
          },
        ],
      },
      {
        kind: 'warning',
        title: 'Options and popup cautions',
        items: [
          'Cover page, highlight, orientation, and preview options can change the result substantially.',
          'If the browser blocks a print popup, use the recovery flow instead of repeatedly reopening new print jobs.',
        ],
      },
    ],
  },
  'report-cards': {
    id: 'report-cards',
    title: 'Report Cards',
    shortDescription: 'See the report-card counts created by the current roster and schematic setup.',
    audience: 'part-time',
    routePaths: ['/report-cards'],
    keywords: ['report cards', 'totals', 'instructors'],
    steps: [
      {
        kind: 'scene',
        title: 'How to read the totals',
        body: [
          'Lesson block totals come from the current roster data. Instructor totals also depend on the instructor assignments saved in the schematic.',
        ],
        sceneId: 'report-cards',
        annotations: [
          {
            id: 'overview',
            label: 'Lesson Block Overview',
            description: 'Shows totals by level for the selected day.',
            x: 27,
            y: 38,
            width: 31,
            height: 22,
          },
          {
            id: 'instructors',
            label: 'Instructor totals',
            description: 'Shows how report-card counts are distributed across instructors.',
            x: 73,
            y: 38,
            width: 31,
            height: 22,
          },
        ],
      },
      {
        kind: 'warning',
        title: 'When totals look wrong',
        items: [
          'If instructor assignments are missing in the schematic, report-card syncing can be blocked or incomplete.',
          'Re-check this page after major roster level changes.',
        ],
      },
    ],
  },
  notes: {
    id: 'notes',
    title: 'Notes',
    shortDescription: 'Keep session-scoped notes, to-dos, and reports in one place.',
    audience: 'part-time',
    routePaths: ['/staff-notes'],
    keywords: ['notes', 'todo', 'report'],
    steps: [
      {
        kind: 'scene',
        title: 'Use the tabs intentionally',
        body: [
          'General Notes, To-Do, and Report each store a different kind of session-scoped information.',
        ],
        sceneId: 'notes-tabs',
        annotations: [
          {
            id: 'tabs',
            label: 'Tabs',
            description: 'Switch between note types depending on what you are recording.',
            x: 41,
            y: 16,
            width: 54,
            height: 10,
          },
        ],
      },
      {
        kind: 'warning',
        title: 'Session scope matters',
        items: [
          'Notes are tied to the current session context, not just to your account globally.',
        ],
      },
    ],
  },
  'share-sessions': {
    id: 'share-sessions',
    title: 'Share Sessions',
    shortDescription: 'Schedule coverage dates for a session and confirm exactly what is being shared.',
    audience: 'part-time',
    routePaths: ['/share-sessions'],
    keywords: ['share', 'coverage', 'dates'],
    steps: [
      {
        kind: 'scene',
        title: 'Follow the wizard',
        body: [
          'Sharing works as a four-step wizard: choose the session, choose the teammate, choose dates, then review and confirm.',
        ],
        sceneId: 'share-wizard',
        annotations: [
          {
            id: 'dates',
            label: 'Select Dates',
            description: 'Single date shares one day. Date range shares only matching weekdays inside the range.',
            x: 27,
            y: 75,
            width: 38,
            height: 22,
          },
          {
            id: 'review',
            label: 'Review and Confirm',
            description: 'Check exact share dates and whether roster edits are allowed.',
            x: 73,
            y: 75,
            width: 38,
            height: 22,
          },
        ],
      },
      {
        kind: 'warning',
        title: 'Coverage rules',
        items: [
          'Date range mode only creates shares on the session weekday, not on every date in the range.',
          'Allow roster edits only when the covering staff member should be able to change roster levels.',
        ],
      },
    ],
  },
  team: {
    id: 'team',
    title: 'My Team',
    shortDescription: 'See your memberships and move into the sharing workflow when coverage is needed.',
    audience: 'part-time',
    routePaths: ['/team'],
    keywords: ['team', 'memberships', 'locations'],
    steps: [
      {
        kind: 'scene',
        title: 'What this page is for',
        body: [
          'This page shows team memberships and gives you a handoff into the dedicated Share Sessions workflow.',
        ],
        sceneId: 'team-overview',
        annotations: [
          {
            id: 'teams',
            label: 'Teams',
            description: 'See the teams you currently belong to and their reference locations.',
            x: 24,
            y: 33,
            width: 30,
            height: 18,
          },
        ],
      },
      {
        kind: 'warning',
        title: 'Membership caution',
        items: [
          'Leaving a team changes your access. Treat it as an account change, not a harmless preference toggle.',
        ],
      },
    ],
  },
  account: {
    id: 'account',
    title: 'Account',
    shortDescription: 'Manage your profile, invites, and team memberships.',
    audience: 'part-time',
    routePaths: ['/account'],
    keywords: ['account', 'profile', 'invites'],
    steps: [
      {
        kind: 'scene',
        title: 'Account sections',
        body: [
          'Profile, invites, and memberships each solve a different access problem. Keep account settings separate from per-session setup.',
        ],
        sceneId: 'account-overview',
        annotations: [
          {
            id: 'profile',
            label: 'Profile',
            description: 'Set first name, last name, and optional default work location here.',
            x: 24,
            y: 33,
            width: 30,
            height: 18,
          },
          {
            id: 'invites',
            label: 'Invites',
            description: 'Accept or decline team invites here.',
            x: 76,
            y: 33,
            width: 30,
            height: 18,
          },
        ],
      },
      {
        kind: 'warning',
        title: 'Scope warning',
        items: [
          'Default work location does not automatically replace per-session location setup.',
          'Guest mode and signed-in mode use different data scopes.',
        ],
      },
    ],
  },
}
