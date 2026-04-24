import React from 'react'
import {
  MockBrowserFrame,
  MockButton,
  MockInput,
  MockSelect,
} from './TutorialScenePrimitives'

type SceneDefinition = {
  ariaLabel: string
  render: () => React.ReactNode
}

function WorkflowRoadmapScene() {
  const steps = [
    { label: 'Input CSV', icon: '📄' },
    { label: 'Manage Session', icon: '⚙️' },
    { label: 'Schematic', icon: '🗺️' },
    { label: 'Rosters', icon: '📋' },
    { label: 'Print', icon: '🖨️' },
  ]

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-6">
      <div className="grid w-full max-w-3xl grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="relative flex flex-col items-center">
            {index < steps.length - 1 ? (
              <div className="absolute left-[50%] top-6 hidden h-0.5 w-full bg-secondary/20 md:block" />
            ) : null}
            <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-secondary bg-accent text-xl shadow-md ring-4 ring-bg">
              {step.icon}
            </div>
            <p className="mt-3 text-center text-[0.6rem] font-bold text-secondary uppercase tracking-wider">{step.label}</p>
            <div className="mt-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[0.5rem] font-bold text-secondary">
               Step {index + 1}
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-lg rounded-2xl border border-secondary/10 bg-accent p-4 text-center text-xs leading-relaxed text-secondary/70 shadow-sm">
        <p className="font-semibold text-secondary">Ready to prepare your session?</p>
        <p className="mt-1">This 5-step workflow guide will show you exactly how to go from a raw roster export to a fully scheduled and printed swim session.</p>
      </div>
    </div>
  )
}

function PrepDashboardScene() {
  return (
    <MockBrowserFrame title="Home" activePath="/" sessionName="No session selected">
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <MockButton variant="secondary" className="w-56 py-4 text-sm">
          Upload CSV and Choose Session
        </MockButton>
        <MockButton variant="accent" className="w-56 py-4 text-sm">
          Help / Tutorials
        </MockButton>
        <MockButton variant="accent" className="w-56 py-4 text-sm">
          Select Existing Session
        </MockButton>
      </div>
    </MockBrowserFrame>
  )
}

function ManageSessionOverviewScene() {
  return (
    <MockBrowserFrame title="Manage Sessions" activePath="/manage-sessions" sessionName="Monday Winter 2026 • Main Pool">
      <div className="rounded-card border-2 border-secondary/10 bg-accent p-6 text-secondary shadow-md">
         <div className="mb-6 rounded-2xl border border-secondary/10 bg-bg p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-secondary/60">Current Session</p>
            <p className="mt-1 text-sm font-bold">Monday Winter 2026 • Main Pool</p>
         </div>
         <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
               <MockSelect label="Session Day" value="Monday" />
               <MockSelect label="Session Season" value="Winter" />
               <MockInput label="Session Year" value="2026" />
            </div>
            <div className="space-y-4">
               <MockInput label="Start Date" value="2026-01-05" />
               <MockInput label="End Date" value="2026-03-23" />
               <MockSelect label="Display Location" value="Main Pool" />
            </div>
         </div>
         <div className="mt-8 flex gap-3">
            <MockButton variant="primary">Save Changes</MockButton>
            <MockButton variant="danger">Delete Session</MockButton>
         </div>
      </div>
    </MockBrowserFrame>
  )
}

function SchematicMoveModesScene() {
  return (
    <MockBrowserFrame title="Class Schedule" activePath="/schematic" sessionName="Monday Winter 2026 • Main Pool">
      <div className="flex flex-col gap-4">
        <div className="flex justify-center gap-3">
          <MockButton variant="accent">Add Temporary Column</MockButton>
          <MockButton variant="accent">Remove Empty Columns</MockButton>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg p-3">
            <h5 className="text-[0.65rem] font-bold text-secondary">Alex</h5>
            <div className="rounded-xl border border-secondary bg-secondary px-3 py-2 text-[0.6rem] font-semibold text-accent shadow-sm">
              Splash 3 • 5:00
            </div>
            <div className="rounded-xl border-2 border-dashed border-secondary px-3 py-2 text-[0.6rem] font-semibold text-secondary">
              Splash 4 • 5:30
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg p-3">
            <h5 className="text-[0.65rem] font-bold text-secondary">Jamie</h5>
            <div className="rounded-xl border-2 border-secondary bg-secondary px-3 py-2 text-[0.6rem] font-semibold text-accent shadow-sm ring-2 ring-secondary/30">
              Little Splash 2 • 5:00
            </div>
            <div className="rounded-xl border-2 border-secondary bg-secondary px-3 py-2 text-[0.6rem] font-semibold text-accent shadow-sm ring-2 ring-secondary/30">
              Parent & Tot • 5:30
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg p-3">
            <h5 className="text-[0.65rem] font-bold text-secondary">Morgan</h5>
            <div className="rounded-xl border border-dashed border-secondary/40 bg-accent px-3 py-2 text-[0.6rem] font-semibold text-secondary/50">
              Drop target
            </div>
          </div>
        </div>
        <div className="flex justify-center">
          <MockButton variant="primary" className="px-10">Save Schedule</MockButton>
        </div>
      </div>
    </MockBrowserFrame>
  )
}

function RostersOverviewScene() {
  return (
    <MockBrowserFrame title="Class Rosters" activePath="/rosters" sessionName="Monday Winter 2026 • Main Pool">
      <div className="space-y-4">
        <div className="rounded-2xl border border-secondary/10 bg-accent p-4 shadow-sm">
           <div className="flex items-center justify-between">
              <div>
                 <p className="text-[0.6rem] font-bold uppercase tracking-wider text-secondary/60">Roster Data</p>
                 <h4 className="text-sm font-bold">Upload and Review Rosters</h4>
              </div>
              <MockButton variant="primary">Upload Roster</MockButton>
           </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl border border-secondary/20 bg-bg px-3 py-1.5 text-[0.65rem] font-semibold text-secondary/60">All Instructors ▼</div>
          <div className="flex-1 rounded-xl border border-secondary/20 bg-bg px-3 py-1.5 text-[0.65rem] font-semibold text-secondary/60">Search Students...</div>
        </div>
        <div className="rounded-card border border-secondary/15 bg-accent p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.7rem] font-bold text-secondary">Splash 3 - A12 : 5:00 PM</p>
              <p className="text-[0.6rem] text-secondary/60">Instructor: Alex</p>
            </div>
            <div className="flex gap-2">
               <div className="rounded-lg border border-secondary/20 bg-bg px-2 py-0.5 text-[0.55rem] font-bold text-secondary">Class Level</div>
               <div className="rounded-lg bg-secondary px-2 py-0.5 text-[0.55rem] font-bold text-accent">Print</div>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="rounded-lg border border-secondary/10 bg-bg px-3 py-1.5 text-[0.6rem] font-semibold text-secondary/80 flex justify-between">
              <span>Maya Chen</span>
              <span className="opacity-60">Splash 3</span>
            </div>
            <div className="rounded-lg border border-secondary/10 bg-bg px-3 py-1.5 text-[0.6rem] font-semibold text-secondary/80 flex justify-between">
              <span>Liam Park</span>
              <span className="opacity-60">Splash 3</span>
            </div>
          </div>
        </div>
      </div>
    </MockBrowserFrame>
  )
}

function PrintOutputOverviewScene() {
  return (
    <MockBrowserFrame title="Print" activePath="/print" sessionName="Monday Winter 2026 • Main Pool">
       <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
             <MockButton variant="accent" className="w-full text-left justify-start py-3">🖨️ Day 1 Print</MockButton>
             <MockButton variant="accent" className="w-full text-left justify-start py-3">📂 Print Instructor Sheets</MockButton>
             <MockButton variant="accent" className="w-full text-left justify-start py-3">📑 Print Masterlist</MockButton>
             <MockButton variant="accent" className="w-full text-left justify-start py-3">🗺️ Print Schematic</MockButton>
          </div>
          <div className="rounded-2xl border border-dashed border-secondary/30 bg-bg/50 flex items-center justify-center p-6 text-center">
             <div className="space-y-2">
                <div className="mx-auto h-12 w-10 border border-secondary/20 bg-accent shadow-sm" />
                <p className="text-[0.6rem] font-bold text-secondary/40 uppercase tracking-widest">Preview Area</p>
             </div>
          </div>
       </div>
    </MockBrowserFrame>
  )
}

const sceneRegistry: Record<string, SceneDefinition> = {
  'workflow-roadmap': {
    ariaLabel: 'Workflow roadmap showing the five steps from CSV input to printing',
    render: () => <WorkflowRoadmapScene />,
  },
  'prep-dashboard': {
    ariaLabel: 'Dashboard showing the main prep workflow entry points',
    render: () => <PrepDashboardScene />,
  },
  'csv-import-modal': {
    ariaLabel: 'CSV import modal showing extracted session candidates',
    render: () => <PrepDashboardScene />, // Simplified for roadmap
  },
  'manage-session-overview': {
    ariaLabel: 'Manage Sessions page showing session details and save action',
    render: () => <ManageSessionOverviewScene />,
  },
  'schematic-move-modes': {
    ariaLabel: 'Schematic board showing columns and class cards',
    render: () => <SchematicMoveModesScene />,
  },
  'rosters-overview': {
    ariaLabel: 'Rosters page showing filters and roster cards',
    render: () => <RostersOverviewScene />,
  },
  'print-output-overview': {
    ariaLabel: 'Print page showing output options',
    render: () => <PrintOutputOverviewScene />,
  },
  'notes-tabs': {
    ariaLabel: 'Notes page',
    render: () => <MockBrowserFrame title="Notes" activePath="/staff-notes" sessionName="Monday Winter 2026"><div className="rounded-xl bg-accent p-8 h-32 border border-secondary/10" /></MockBrowserFrame>,
  },
  'report-cards': {
    ariaLabel: 'Report cards page',
    render: () => <MockBrowserFrame title="Report Cards" activePath="/report-cards" sessionName="Monday Winter 2026"><div className="rounded-xl bg-accent p-8 h-32 border border-secondary/10" /></MockBrowserFrame>,
  },
  'share-wizard': {
    ariaLabel: 'Share sessions wizard',
    render: () => <MockBrowserFrame title="Share Sessions" activePath="/share-sessions" sessionName="Monday Winter 2026"><div className="rounded-xl bg-accent p-8 h-32 border border-secondary/10" /></MockBrowserFrame>,
  },
  'team-overview': {
    ariaLabel: 'Team page',
    render: () => <MockBrowserFrame title="My Team" activePath="/team" sessionName="No session selected"><div className="rounded-xl bg-accent p-8 h-32 border border-secondary/10" /></MockBrowserFrame>,
  },
  'account-overview': {
    ariaLabel: 'Account page',
    render: () => <MockBrowserFrame title="Account" activePath="/account" sessionName="No session selected"><div className="rounded-xl bg-accent p-8 h-32 border border-secondary/10" /></MockBrowserFrame>,
  },
}

export function getTutorialSceneDefinition(sceneId: string) {
  return sceneRegistry[sceneId] ?? null
}

export const tutorialSceneIds = Object.keys(sceneRegistry)
