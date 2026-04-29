import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, customRender, screen } from '../../test/render'
import StaffNotesPage from './StaffNotesPage'
import type { SessionReportData } from './types'

type Row = Record<string, any>
type TableRows = Record<string, Row[]>

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCurrentSession: vi.fn(),
  useCurrentTeam: vi.fn(),
  useCurrentTerm: vi.fn(),
  useSessionInstructors: vi.fn(),
  getCurrentSessionId: vi.fn(),
  fetchTeamSessions: vi.fn(),
  fetchSessionNotes: vi.fn(),
  fetchTeamTermSessionNotes: vi.fn(),
  fetchTeamTermSessionReports: vi.fn(),
  createSessionNote: vi.fn(),
  deleteSessionNote: vi.fn(),
  updateSessionNote: vi.fn(),
  supabaseFrom: vi.fn(),
}))

vi.mock('../../app/AuthContext', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../app/useCurrentSession', () => ({
  useCurrentSession: mocks.useCurrentSession,
}))

vi.mock('../../app/useCurrentTeam', () => ({
  useCurrentTeam: mocks.useCurrentTeam,
}))

vi.mock('../../app/useCurrentTerm', () => ({
  useCurrentTerm: mocks.useCurrentTerm,
}))

vi.mock('../../lib/instructorPdfCache', () => ({
  getCurrentSessionId: mocks.getCurrentSessionId,
}))

vi.mock('../../lib/serverApi', () => ({
  fetchTeamSessions: mocks.fetchTeamSessions,
  fetchSessionNotes: mocks.fetchSessionNotes,
  fetchTeamTermSessionNotes: mocks.fetchTeamTermSessionNotes,
  fetchTeamTermSessionReports: mocks.fetchTeamTermSessionReports,
  createSessionNote: mocks.createSessionNote,
  deleteSessionNote: mocks.deleteSessionNote,
  updateSessionNote: mocks.updateSessionNote,
}))

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: mocks.supabaseFrom,
  },
}))

vi.mock('../print/hooks/useSessionInstructors', () => ({
  useSessionInstructors: mocks.useSessionInstructors,
}))

const team = {
  id: 'team-1',
  name: 'DeckSupervisor Demo Aquatics',
  available_locations: ['Paul Palleschi Full Pool'],
}

const currentTerm = {
  key: 'spring-2026',
  season: 'spring',
  year: 2026,
  label: 'Spring 2026',
}

const sessions = Array.from({ length: 7 }, (_, index) => ({
  id: `session-${index + 1}`,
  team_id: 'team-1',
  session_day: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][index],
  session_season: 'Spring',
  session_year: 2026,
  start_date: '2026-04-27',
  location: 'Paul Palleschi Full Pool',
}))

const reportData: SessionReportData = {
  staff: {
    performance: [{ instructor: 'Jamie Chen', text: 'Strong lane pacing.' }],
    strengthWeakness: [{ instructor: 'Morgan Patel', text: 'Strengths: clear cues. Weaknesses: spacing.' }],
    successionPlans: [{ instructor: 'Taylor Brooks', text: 'Ready for lead coverage.' }],
    instructorCovers: [{ instructor: 'Sam Nguyen', coveredBy: 'Jamie Chen', details: 'Covered the private lesson lane.' }],
  },
  lessonStructure: {
    challengingTimes: [{ time: '5:00 PM', lessons: 'Splash 1', description: 'Busy transition.' }],
    newClassLayouts: [{ level: 'Splash 1', description: 'Worked well in shallow lanes.' }],
  },
  safetyFacility: {
    safetyConcerns: [{ concernType: 'supervision', description: 'Watch the stairs during transitions.' }],
    maintenanceIssues: [{ item: 'Lane rope', description: 'Needs tightening.' }],
    poolDeckWorksWell: [{ item: 'Kickboard station', description: 'Kept classes moving.' }],
    poolDeckImprovements: [{ item: 'Signage', description: 'Add a waitlist check-in sign.' }],
  },
  parentCustomerFeedback: [{ feedbackType: 'praise', description: 'Parent praised the instructor team.' }],
  projectsInitiatives: {
    adminWork: [{ work: 'Report cards', description: 'Started totals after lessons.' }],
    initiatives: [{ title: 'Demo flow', brief: 'Show notes and reports from seeded sessions.' }],
  },
}

function createNotes() {
  const rows: Row[] = []
  const types = ['general', 'recognition', 'feedback', 'coaching'] as const
  sessions.forEach((session, index) => {
    types.forEach(type => {
      rows.push({
        id: `${type}-${index + 1}`,
        session_id: session.id,
        team_id: 'team-1',
        session_season: 'Spring',
        session_year: 2026,
        created_by: index % 2 === 0 ? 'owner-1' : 'member-1',
        created_at: `2026-04-2${index}T12:00:00Z`,
        note_type: type,
        text: `${type} seeded note ${index + 1} for Splash 1`,
        employee_name: type === 'general' ? null : 'Jamie Chen',
        done: null,
      })
    })
    rows.push({
      id: `todo-open-${index + 1}`,
      session_id: session.id,
      team_id: 'team-1',
      session_season: 'Spring',
      session_year: 2026,
      created_by: 'member-1',
      created_at: `2026-04-2${index}T13:00:00Z`,
      note_type: 'todo',
      text: `Open seeded todo ${index + 1}`,
      employee_name: null,
      done: false,
    })
    rows.push({
      id: `todo-done-${index + 1}`,
      session_id: session.id,
      team_id: 'team-1',
      session_season: 'Spring',
      session_year: 2026,
      created_by: 'member-1',
      created_at: `2026-04-2${index}T14:00:00Z`,
      note_type: 'todo',
      text: `Done seeded todo ${index + 1}`,
      employee_name: null,
      done: true,
    })
  })
  return rows
}

function createReports() {
  return sessions.map((session, index) => ({
    id: `report-${index + 1}`,
    session_id: session.id,
    team_id: 'team-1',
    session_season: 'Spring',
    session_year: 2026,
    created_by: index % 2 === 0 ? 'owner-1' : 'member-1',
    title: `Demo operations report - ${session.session_day} Paul Palleschi Full Pool`,
    report_data: reportData,
    created_at: `2026-04-2${index}T15:00:00Z`,
    updated_at: `2026-04-2${index}T16:00:00Z`,
  }))
}

function installApiRows(overrides: Partial<TableRows> = {}) {
  const tableRows: TableRows = {
    sessions,
    session_notes: createNotes(),
    session_reports: createReports(),
    ...overrides,
  }

  mocks.fetchTeamSessions.mockResolvedValue({ sessions: tableRows.sessions })
  mocks.fetchTeamTermSessionNotes.mockResolvedValue({ notes: tableRows.session_notes })
  mocks.fetchTeamTermSessionReports.mockResolvedValue({ reports: tableRows.session_reports })
  mocks.supabaseFrom.mockImplementation(() => {
    throw new Error('Full-time Staff Notes should use backend API reads')
  })
}

function renderPage() {
  customRender(<StaffNotesPage />)
}

describe('StaffNotesPage full-time scope', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.useAuth.mockReturnValue({
      accountType: 'full_time',
      isGuest: false,
      user: { id: 'owner-1' },
    })
    mocks.useCurrentSession.mockReturnValue({
      sessionId: '',
      session: null,
      access: { mode: null },
    })
    mocks.useCurrentTeam.mockReturnValue({
      currentTeam: team,
      currentTeamId: team.id,
    })
    mocks.useCurrentTerm.mockReturnValue({
      currentTerm,
    })
    mocks.useSessionInstructors.mockReturnValue(['Jamie Chen', 'Morgan Patel', 'Taylor Brooks', 'Sam Nguyen'])
    mocks.getCurrentSessionId.mockReturnValue('')
    mocks.fetchSessionNotes.mockResolvedValue({ notes: [] })
    installApiRows()
  })

  it('shows the full-time scope summary', async () => {
    renderPage()

    expect(await screen.findByText(/Viewing DeckSupervisor Demo Aquatics \| Spring 2026 \| 7 sessions \| Paul Palleschi Full Pool/i)).toBeInTheDocument()
    expect(screen.getByText(/42 notes loaded for DeckSupervisor Demo Aquatics \| Spring 2026\. General Session Notes: 7\./i)).toBeInTheDocument()
  })

  it('shows general notes for the full-time selected term', async () => {
    renderPage()

    expect(await screen.findByText(/general seeded note 1 for Splash 1/i)).toBeInTheDocument()
  })

  it('shows seeded reports on the report tab', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Report' }))

    await screen.findByText(/7 reports loaded for DeckSupervisor Demo Aquatics \| Spring 2026\./i)
    expect(screen.getAllByDisplayValue(/Demo operations report - Mo Paul Palleschi Full Pool/i)).toHaveLength(2)
    expect(screen.getByText(/7 reports loaded for DeckSupervisor Demo Aquatics \| Spring 2026\./i)).toBeInTheDocument()
  })

  it('shows todo notes to full-time users as read-only demo content', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Todo' }))

    expect(await screen.findByText(/Open seeded todo 1/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add a todo item')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Todo' })).toBeDisabled()
  })

  it('explains when the selected term has sessions but no notes', async () => {
    installApiRows({ session_notes: [] })
    renderPage()

    expect(
      await screen.findByText(/7 sessions found for Spring 2026, but no notes were returned for team\/term scope\./i),
    ).toBeInTheDocument()
  })

  it('loads notes even when the author is not a team member', async () => {
    installApiRows({
      session_notes: [
        {
          id: 'external-general-1',
          session_id: 'session-1',
          team_id: 'team-1',
          session_season: 'Spring',
          session_year: 2026,
          created_by: 'external-author-1',
          created_at: '2026-04-27T12:00:00Z',
          note_type: 'general',
          text: 'External author note still scoped by session_id',
          employee_name: null,
          done: null,
        },
      ],
    })
    renderPage()

    expect(await screen.findByText(/External author note still scoped by session_id/i)).toBeInTheDocument()
    expect(screen.getByText(/1 notes loaded for DeckSupervisor Demo Aquatics \| Spring 2026\. General Session Notes: 1\./i)).toBeInTheDocument()
  })

  it('uses the backend API for full-time term notes', async () => {
    renderPage()

    await screen.findByText(/general seeded note 1 for Splash 1/i)

    expect(mocks.fetchTeamTermSessionNotes).toHaveBeenCalledWith('team-1', 'spring', 2026)
    expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('session_notes')
  })

  it('uses the backend API for full-time term reports', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Report' }))
    await screen.findByText(/7 reports loaded for DeckSupervisor Demo Aquatics \| Spring 2026\./i)

    expect(mocks.fetchTeamTermSessionReports).toHaveBeenCalledWith('team-1', 'spring', 2026)
    expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('session_reports')
  })

  it('shows notes even when the note session id is not in the scoped session map', async () => {
    installApiRows({
      session_notes: [
        {
          id: 'unmapped-session-note',
          session_id: 'day-session-not-in-map',
          team_id: 'team-1',
          session_season: 'Spring',
          session_year: 2026,
          created_by: 'owner-1',
          created_at: '2026-04-27T12:00:00Z',
          note_type: 'general',
          text: 'Note from a day session that is not in the local map',
          employee_name: null,
          done: null,
        },
      ],
    })
    renderPage()

    expect(await screen.findByText(/Note from a day session that is not in the local map/i)).toBeInTheDocument()
    expect(screen.getByText(/Session: Spring 2026 \| DeckSupervisor Demo Aquatics/i)).toBeInTheDocument()
  })

  it('distinguishes notes returned by team term from an empty active tab', async () => {
    installApiRows({
      session_notes: createNotes().filter(row => row.note_type === 'recognition'),
    })
    renderPage()

    expect(await screen.findByText(/7 notes loaded for DeckSupervisor Demo Aquatics \| Spring 2026\. General Session Notes: 0\./i)).toBeInTheDocument()
    expect(
      screen.getByText(/7 notes loaded for Spring 2026, but no General Session Notes were found\./i),
    ).toBeInTheDocument()
  })
})
