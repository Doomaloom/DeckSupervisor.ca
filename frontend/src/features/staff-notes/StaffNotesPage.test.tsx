import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StaffNotesPage from './StaffNotesPage'

const mocks = vi.hoisted(() => ({
  fetchSessionNotes: vi.fn(), fetchSessionReports: vi.fn(), createSessionNote: vi.fn(),
  updateSessionNote: vi.fn(), deleteSessionNote: vi.fn(), createSessionReport: vi.fn(),
  updateSessionReport: vi.fn(), deleteSessionReport: vi.fn(), notice: vi.fn(),
  session: { sessionId: 'session-a', session: { session_day: 'Mo', location: 'Pool', session_season: 'Fall', session_year: 2026, start_date: '2026-09-14' }, access: { mode: 'owner' } },
  instructors: ['QA Instructor'],
}))
vi.mock('../../app/AuthContext', () => ({ useAuth: () => ({ accountType: 'part_time', isGuest: false, user: { id: 'owner' } }) }))
vi.mock('../../app/useCurrentSession', () => ({ useCurrentSession: () => mocks.session }))
vi.mock('../../app/useCurrentTeam', () => ({ useCurrentTeam: () => ({ currentTeamId: null }) }))
vi.mock('../../app/useCurrentTerm', () => ({ useCurrentTerm: () => ({ currentTerm: null }) }))
vi.mock('../print/hooks/useSessionInstructors', () => ({ useSessionInstructors: () => mocks.instructors }))
vi.mock('../../lib/serverApi', () => mocks)
vi.mock('../../lib/appNotice', () => ({ showAppNotice: mocks.notice }))

const note = { id: 'note-a', session_id: 'session-a', created_by: 'owner', created_at: '2026-09-19T12:00:00Z', note_type: 'general', text: 'Keep this note', done: false, employee_name: null }
const report = { id: 'report-a', session_id: 'session-a', created_by: 'owner', created_at: '2026-09-19T12:00:00Z', updated_at: '2026-09-19T12:00:00Z', title: 'Original report', report_data: {}, author: { first_name: 'QA', last_name: 'Owner', email: '' } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.access.mode = 'owner'
  mocks.fetchSessionNotes.mockResolvedValue({ notes: [note] })
  mocks.fetchSessionReports.mockResolvedValue({ reports: [report] })
})

describe('authenticated staff workflow', () => {
  it('keeps a note visible when deletion is denied', async () => {
    mocks.deleteSessionNote.mockRejectedValue(new Error('Permission denied'))
    render(<StaffNotesPage />)
    await screen.findByText(note.text)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mocks.notice).toHaveBeenCalledWith(expect.stringContaining('Permission denied'), 'error'))
    expect(screen.getByText(note.text)).toBeInTheDocument()
  })

  it('keeps a todo unchecked when its update is denied', async () => {
    mocks.fetchSessionNotes.mockResolvedValue({ notes: [{ ...note, note_type: 'todo' }] })
    mocks.updateSessionNote.mockRejectedValue(new Error('Permission denied'))
    render(<StaffNotesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }))
    const checkbox = await screen.findByRole('checkbox')
    fireEvent.click(checkbox)
    await waitFor(() => expect(mocks.notice).toHaveBeenCalledWith(expect.stringContaining('Permission denied'), 'error'))
    expect(checkbox).not.toBeChecked()
  })

  it('hides mutations for another authors note under coverage', async () => {
    mocks.session.access.mode = 'shared'
    mocks.fetchSessionNotes.mockResolvedValue({ notes: [{ ...note, created_by: 'another-user' }] })
    render(<StaffNotesPage />)
    await screen.findByText(note.text)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('loads reports through the API and retains a draft after failed autosave', async () => {
    mocks.updateSessionReport.mockRejectedValue(new Error('Session access expired'))
    render(<StaffNotesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Report' }))
    const title = await screen.findByRole('textbox', { name: 'Report Title' })
    expect(mocks.fetchSessionReports).toHaveBeenCalledWith({ sessionId: 'session-a' })
    fireEvent.change(title, { target: { value: 'Unsaved draft' } })
    await screen.findByText('Autosave failed: Session access expired', {}, { timeout: 2500 })
    expect(title).toHaveValue('Unsaved draft')
    expect(mocks.updateSessionReport).toHaveBeenCalledWith('report-a', expect.objectContaining({ title: 'Unsaved draft' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create New Report' })) })
    expect(mocks.createSessionReport).not.toHaveBeenCalled()
    expect(title).toHaveValue('Unsaved draft')
  })
})
