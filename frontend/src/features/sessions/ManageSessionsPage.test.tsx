import React from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customRender, screen } from '../../test/render'
import ManageSessionsPage from './ManageSessionsPage'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCurrentSessionScopeSync: vi.fn(),
  useManageSessionForm: vi.fn(),
}))

vi.mock('../../app/AuthContext', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../session-management/hooks/useCurrentSessionScopeSync', () => ({
  useCurrentSessionScopeSync: mocks.useCurrentSessionScopeSync,
}))

vi.mock('../session-management/hooks/useManageSessionForm', () => ({
  useManageSessionForm: mocks.useManageSessionForm,
}))

describe('ManageSessionsPage', () => {
  beforeEach(() => {
    mocks.useAuth.mockReset()
    mocks.useCurrentSessionScopeSync.mockReset()
    mocks.useManageSessionForm.mockReset()

    mocks.useAuth.mockReturnValue({ isGuest: false })
    mocks.useCurrentSessionScopeSync.mockReturnValue({
      currentSessionId: 'db-1',
      scopeVersion: 0,
      refreshScope: vi.fn(),
      resetCurrentSessionScope: vi.fn(),
      selectSessionAndSyncDay: vi.fn(),
    })
  })

  it('renders the shared-session read-only notice for non-owners', () => {
    mocks.useManageSessionForm.mockReturnValue({
      currentSession: {
        id: 'db-1',
        team_id: 'team-1',
        created_by: 'user-1',
        session_day: 'Monday',
        session_season: 'Winter',
        session_year: 2026,
        start_date: '2026-01-05',
        end_date: '2026-02-16',
        location: 'Main Pool',
        source_locations: ['Main Pool'],
        session_start_time24: '09:00',
        session_end_time24: '11:00',
        instructors: [{ name: 'Alex' }],
      },
      access: { mode: 'shared' },
      teamName: 'Sharks',
    })

    customRender(<ManageSessionsPage />)

    expect(screen.getByText('You are viewing a shared session. Editing is disabled.')).toBeInTheDocument()
  })

  it('wires save and delete actions when the current session is editable', async () => {
    const user = userEvent.setup()
    const handleUpdateSession = vi.fn(event => event.preventDefault())
    const handleDeleteSession = vi.fn()

    mocks.useManageSessionForm.mockReturnValue({
      seasonOptions: ['Winter', 'Spring', 'Summer', 'Fall'],
      currentSession: {
        id: 'db-1',
        team_id: 'team-1',
        created_by: 'user-1',
        session_day: 'Monday',
        session_season: 'Winter',
        session_year: 2026,
        start_date: '2026-01-05',
        end_date: '2026-02-16',
        location: 'Main Pool',
        source_locations: ['Main Pool'],
        session_start_time24: '09:00',
        session_end_time24: '11:00',
        instructors: [{ name: 'Alex' }],
      },
      access: { mode: 'owner' },
      teamName: 'Sharks',
      teams: [],
      teamsLoading: false,
      availableLocations: [],
      editSessionDay: 'Monday',
      editSessionSeason: 'Winter',
      editSessionYear: '2026',
      editTeamId: 'team-1',
      editStartDate: '2026-01-05',
      editEndDate: '2026-02-16',
      editSessionStartTime24: '09:00',
      editSessionEndTime24: '11:00',
      editLocation: 'Main Pool',
      editSourceLocations: ['Main Pool'],
      editInstructors: [{ name: 'Alex' }],
      editRosterFile: null,
      editRosterFileName: 'roster.csv',
      editMessage: '',
      editMessageTone: 'success',
      isSaving: false,
      overlapWarning: '',
      setEditSessionDay: vi.fn(),
      setEditSessionSeason: vi.fn(),
      setEditSessionYear: vi.fn(),
      setEditTeamId: vi.fn(),
      setEditStartDate: vi.fn(),
      setEditEndDate: vi.fn(),
      setEditSessionStartTime24: vi.fn(),
      setEditSessionEndTime24: vi.fn(),
      setEditLocation: vi.fn(),
      setEditSourceLocations: vi.fn(),
      setEditRosterFile: vi.fn(),
      addEditInstructor: vi.fn(),
      removeEditInstructor: vi.fn(),
      updateEditInstructor: vi.fn(),
      handleUpdateSession,
      handleDeleteSession,
    })

    customRender(<ManageSessionsPage />)

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await user.click(screen.getByRole('button', { name: 'Delete Session' }))

    expect(handleUpdateSession).toHaveBeenCalledTimes(1)
    expect(handleDeleteSession).toHaveBeenCalledTimes(1)
  })
})
