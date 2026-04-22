import React from 'react'
import {
  TutorialCardMock,
  TutorialPageFrame,
  TutorialSidebarMock,
  TutorialToolbarMock,
} from './TutorialScenePrimitives'

type SceneDefinition = {
  ariaLabel: string
  render: () => React.ReactNode
}

function FieldList({ items }: { items: string[] }) {
  return (
    <div className="mt-3 grid gap-2">
      {items.map(item => (
        <div
          key={item}
          className="rounded-xl border border-secondary/15 bg-accent px-3 py-2 text-xs font-semibold text-secondary"
        >
          {item}
        </div>
      ))}
    </div>
  )
}

function PrepDashboardScene() {
  return (
    <TutorialPageFrame title="Home" toolbarLabel="Part-time Dashboard">
      <div className="flex gap-4">
        <TutorialSidebarMock items={['Home', 'Manage Session', 'Share Sessions', 'Rosters', 'Help']} />
        <div className="grid flex-1 grid-cols-1 gap-3">
          <TutorialCardMock
            title="Upload CSV and Choose Session"
            subtitle="Primary prep path for roster-driven work"
            accent="primary"
          />
          <TutorialCardMock title="Help / Tutorials" subtitle="Open the full prep workflow" />
          <TutorialCardMock title="Select Existing Session" subtitle="Resume a saved session" />
          <TutorialCardMock title="Share Sessions" subtitle="Coverage workflow, not part of the main prep sequence" />
        </div>
      </div>
    </TutorialPageFrame>
  )
}

function CsvImportModalScene() {
  return (
    <div className="rounded-[2rem] border border-secondary/20 bg-white shadow-[0_32px_80px_rgba(14,68,79,0.12)]">
      <div className="border-b border-secondary/10 px-6 py-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-secondary/50">
          CSV Session Import
        </p>
        <h4 className="mt-1 text-lg font-semibold text-secondary">
          Choose a session from the uploaded CSV
        </h4>
        <p className="mt-2 text-sm text-secondary/70">winter-rosters.csv</p>
      </div>
      <div className="space-y-4 p-6">
        <div className="rounded-[1.5rem] border border-secondary bg-bg p-4 text-secondary shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Monday Winter 2026 | Main Pool</p>
              <p className="mt-1 text-xs text-secondary/70">12 classes • 84 students</p>
              <p className="mt-2 text-xs font-semibold text-secondary">Existing: Monday Winter 2026</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent">
              Load Existing Session
            </span>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-secondary/20 bg-bg p-4 text-secondary shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Wednesday Winter 2026 | Training Pool</p>
              <p className="mt-1 text-xs text-secondary/70">9 classes • 58 students</p>
              <p className="mt-2 text-xs text-secondary/70">No existing session matched. Selecting this will create one from the CSV.</p>
            </div>
            <span className="rounded-full border border-secondary/20 bg-accent px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-secondary">
              Create New Session
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ManageSessionOverviewScene() {
  return (
    <TutorialPageFrame title="Manage Sessions" toolbarLabel="Confirm Before Scheduling">
      <div className="space-y-4">
        <div className="rounded-[1.5rem] border border-secondary/15 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
          Current session: Monday Winter 2026 • Main Pool
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TutorialCardMock title="Session Details" subtitle="Session identity and CSV mapping">
            <FieldList
              items={[
                'Session Day',
                'Session Season',
                'Session Year',
                'Start Date / End Date',
                'Session Start Time / End Time',
                'Display Location / Source Locations',
              ]}
            />
          </TutorialCardMock>
          <TutorialCardMock title="Instructors on Shift" subtitle="Instructor list for schematic and print">
            <FieldList items={['Alex', 'Jamie', 'Morgan']} />
          </TutorialCardMock>
        </div>
        <div className="flex gap-3">
          <span className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-accent">
            Save Changes
          </span>
          <span className="rounded-full border border-danger/40 px-4 py-2 text-sm font-semibold text-danger">
            Delete Session
          </span>
        </div>
      </div>
    </TutorialPageFrame>
  )
}

function SchematicMoveModesScene() {
  return (
    <TutorialPageFrame title="Schematic" toolbarLabel="Single Move and Multi-Move">
      <div className="space-y-4">
        <TutorialToolbarMock items={['Add Temporary Column', 'Remove Empty Columns', 'Save Schedule']} />
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-[1.5rem] border border-secondary/20 bg-bg p-4">
            <h5 className="text-sm font-semibold text-secondary">Alex</h5>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-secondary bg-secondary px-3 py-2 text-xs font-semibold text-accent shadow-sm">
                Splash 3 • 5:00
              </div>
              <div className="rounded-xl border-2 border-dashed border-secondary px-3 py-2 text-xs font-semibold text-secondary">
                Splash 4 • 5:30
              </div>
            </div>
            <p className="mt-3 text-xs text-secondary/70">Single move: drag one course.</p>
          </div>
          <div className="rounded-[1.5rem] border border-secondary/20 bg-bg p-4">
            <h5 className="text-sm font-semibold text-secondary">Jamie</h5>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border-2 border-secondary bg-secondary px-3 py-2 text-xs font-semibold text-accent shadow-sm ring-2 ring-secondary/30">
                Little Splash 2 • 5:00
              </div>
              <div className="rounded-xl border-2 border-secondary bg-secondary px-3 py-2 text-xs font-semibold text-accent shadow-sm ring-2 ring-secondary/30">
                Parent & Tot • 5:30
              </div>
            </div>
            <p className="mt-3 text-xs text-secondary/70">Multi-move: selected block from one column.</p>
          </div>
          <div className="rounded-[1.5rem] border border-secondary/20 bg-bg p-4">
            <h5 className="text-sm font-semibold text-secondary">Open Column</h5>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-dashed border-secondary/40 bg-accent px-3 py-2 text-xs font-semibold text-secondary/70">
                Drop target
              </div>
              <div className="rounded-xl border border-dashed border-secondary/40 bg-accent px-3 py-2 text-xs font-semibold text-secondary/70">
                Drop target
              </div>
            </div>
            <p className="mt-3 text-xs text-secondary/70">Use temporary space when rebalancing the board.</p>
          </div>
        </div>
      </div>
    </TutorialPageFrame>
  )
}

function RostersOverviewScene() {
  return (
    <TutorialPageFrame title="Rosters" toolbarLabel="Review Before Printing">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {['Filter Classes by Instructor', 'Filter Classes by Service Name', 'Search student or course code'].map(item => (
            <div
              key={item}
              className="rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary/70"
            >
              {item}
            </div>
          ))}
        </div>
        <TutorialCardMock title="Splash 3 - A12 : 5:00 PM" subtitle="Instructor: Alex">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-secondary/20 bg-bg px-3 py-1 text-secondary">
              Class Level
            </span>
            <span className="rounded-full border border-secondary bg-secondary px-3 py-1 text-accent">
              Individual Level
            </span>
            <span className="rounded-full border border-secondary/20 bg-bg px-3 py-1 text-secondary">
              Print
            </span>
          </div>
          <FieldList items={['Maya Chen • Splash 3', 'Liam Park • Splash 2A', 'Avery Ross • Splash 3']} />
        </TutorialCardMock>
      </div>
    </TutorialPageFrame>
  )
}

function OutputPreview({
  title,
  lines,
}: {
  title: string
  lines: string[]
}) {
  return (
    <div className="rounded-[1.25rem] border border-secondary/15 bg-white p-3 shadow-sm">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-secondary/50">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {lines.map(line => (
          <div
            key={line}
            className="rounded-lg border border-secondary/10 bg-bg px-3 py-2 text-[0.72rem] font-semibold text-secondary/75"
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

function PrintOutputOverviewScene() {
  const rows = [
    {
      button: 'Day 1 Print',
      previewTitle: 'Attendance Sheet',
      lines: ['Class / Instructor', 'Student rows', 'Attendance checkboxes'],
    },
    {
      button: 'Print Instructor Sheets',
      previewTitle: 'Instructor Packet',
      lines: ['Instructor cover', 'Grouped class sheets', 'Packet pages'],
    },
    {
      button: 'Print Masterlist',
      previewTitle: 'Masterlist',
      lines: ['Condensed roster table', 'Admin/front-desk summary', 'Printable list'],
    },
    {
      button: 'Print Schematic',
      previewTitle: 'Schematic Export',
      lines: ['Instructor columns', 'Course blocks', 'Schedule layout'],
    },
  ]

  return (
    <TutorialPageFrame title="Print" toolbarLabel="Button to Output Pairing">
      <div className="space-y-3">
        {rows.map(row => (
          <div
            key={row.button}
            className="grid grid-cols-[0.9fr,1.1fr] gap-4 rounded-[1.5rem] border border-secondary/15 bg-bg p-4"
          >
            <div className="flex items-center">
              <div className="w-full rounded-[1.25rem] border border-secondary/20 bg-accent px-4 py-4 text-sm font-semibold text-secondary shadow-sm">
                {row.button}
              </div>
            </div>
            <OutputPreview title={row.previewTitle} lines={row.lines} />
          </div>
        ))}
      </div>
    </TutorialPageFrame>
  )
}

function NotesScene() {
  return (
    <TutorialPageFrame title="Notes" toolbarLabel="Session Notes">
      <div className="space-y-4">
        <TutorialToolbarMock items={['General', 'To-Do', 'Report']} />
        <div className="grid grid-cols-2 gap-4">
          <TutorialCardMock title="General Notes" subtitle="Operational notes tied to the current session" />
          <TutorialCardMock title="Report" subtitle="Structured feedback and export-ready reporting" accent="primary" />
        </div>
      </div>
    </TutorialPageFrame>
  )
}

function ReportCardsScene() {
  return (
    <TutorialPageFrame title="Report Cards" toolbarLabel="Session Totals">
      <div className="grid grid-cols-2 gap-4">
        <TutorialCardMock title="Lesson Block Overview" subtitle="Totals by level for the selected day" accent="primary" />
        <TutorialCardMock title="Instructor Report Card Needs" subtitle="Counts per instructor" />
      </div>
    </TutorialPageFrame>
  )
}

function ShareSessionsScene() {
  return (
    <TutorialPageFrame title="Share Sessions" toolbarLabel="Coverage Wizard">
      <div className="space-y-4">
        <TutorialToolbarMock items={['1. Select Session', '2. Select User', '3. Select Dates', '4. Review']} />
        <div className="grid grid-cols-2 gap-4">
          <TutorialCardMock title="Select Session" subtitle="Choose the active session you want to share" accent="primary" />
          <TutorialCardMock title="Review and Confirm" subtitle="Check exact dates and roster edit permission" />
        </div>
      </div>
    </TutorialPageFrame>
  )
}

function TeamScene() {
  return (
    <TutorialPageFrame title="My Team" toolbarLabel="Membership View">
      <div className="grid grid-cols-2 gap-4">
        <TutorialCardMock title="Teams" subtitle="View the teams you belong to" accent="primary" />
        <TutorialCardMock title="Open Share Sessions" subtitle="Jump into the dedicated coverage workflow" />
      </div>
    </TutorialPageFrame>
  )
}

function AccountScene() {
  return (
    <TutorialPageFrame title="Account" toolbarLabel="Profile and Invites">
      <div className="grid grid-cols-2 gap-4">
        <TutorialCardMock title="Profile" subtitle="First name, last name, default work location" accent="primary" />
        <TutorialCardMock title="Invites" subtitle="Accept or decline team invites" />
      </div>
    </TutorialPageFrame>
  )
}

const sceneRegistry: Record<string, SceneDefinition> = {
  'prep-dashboard': {
    ariaLabel: 'Dashboard showing the main prep workflow entry points',
    render: () => <PrepDashboardScene />,
  },
  'csv-import-modal': {
    ariaLabel: 'CSV import modal showing extracted session candidates and whether they load an existing session or create a new one',
    render: () => <CsvImportModalScene />,
  },
  'manage-session-overview': {
    ariaLabel: 'Manage Sessions page showing session details, instructor list, and save action',
    render: () => <ManageSessionOverviewScene />,
  },
  'schematic-move-modes': {
    ariaLabel: 'Schematic board showing single-card drag and multi-card selected block movement',
    render: () => <SchematicMoveModesScene />,
  },
  'rosters-overview': {
    ariaLabel: 'Rosters page showing filters, level mode controls, roster card, and print action',
    render: () => <RostersOverviewScene />,
  },
  'print-output-overview': {
    ariaLabel: 'Print page pairing each print button with the kind of document it produces',
    render: () => <PrintOutputOverviewScene />,
  },
  'notes-tabs': {
    ariaLabel: 'Notes page showing tabs for general notes and report content',
    render: () => <NotesScene />,
  },
  'report-cards': {
    ariaLabel: 'Report cards page showing lesson block totals and instructor counts',
    render: () => <ReportCardsScene />,
  },
  'share-wizard': {
    ariaLabel: 'Share sessions wizard showing the sequence for scheduling coverage',
    render: () => <ShareSessionsScene />,
  },
  'team-overview': {
    ariaLabel: 'Team page showing memberships and the link into the sharing workflow',
    render: () => <TeamScene />,
  },
  'account-overview': {
    ariaLabel: 'Account page showing profile and invite sections',
    render: () => <AccountScene />,
  },
}

export function getTutorialSceneDefinition(sceneId: string) {
  return sceneRegistry[sceneId] ?? null
}

export const tutorialSceneIds = Object.keys(sceneRegistry)
