import React from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, customRender, screen } from '../../test/render'
import DashboardPage from './DashboardPage'

const mocks = vi.hoisted(() => ({
  useNavigate: vi.fn(),
  useAuth: vi.fn(),
  useCsvImportFlow: vi.fn(),
  useCurrentTeam: vi.fn(),
  useCurrentTerm: vi.fn(),
  useCurrentSessionScopeSync: vi.fn(),
  useDashboardScope: vi.fn(),
  useNewSessionForm: vi.fn(),
  useSessionSelectionData: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: mocks.useNavigate,
}))

vi.mock('../../app/AuthContext', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../app/CsvImportFlowContext', () => ({
  useCsvImportFlow: mocks.useCsvImportFlow,
}))

vi.mock('../../app/useCurrentTeam', () => ({
  useCurrentTeam: mocks.useCurrentTeam,
}))

vi.mock('../../app/useCurrentTerm', () => ({
  useCurrentTerm: mocks.useCurrentTerm,
  formatTermLabel: (season: string, year: number) =>
    `${season.slice(0, 1).toUpperCase()}${season.slice(1).toLowerCase()} ${year}`,
}))

vi.mock('../session-management/hooks/useCurrentSessionScopeSync', () => ({
  useCurrentSessionScopeSync: mocks.useCurrentSessionScopeSync,
}))

vi.mock('../session-management/hooks/useDashboardScope', () => ({
  useDashboardScope: mocks.useDashboardScope,
}))

vi.mock('../session-management/hooks/useNewSessionForm', () => ({
  useNewSessionForm: mocks.useNewSessionForm,
}))

vi.mock('../session-management/hooks/useSessionSelectionData', () => ({
  useSessionSelectionData: mocks.useSessionSelectionData,
}))

describe('DashboardPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mocks.useNavigate.mockReset()
    mocks.useAuth.mockReset()
    mocks.useCsvImportFlow.mockReset()
    mocks.useCurrentTeam.mockReset()
    mocks.useCurrentTerm.mockReset()
    mocks.useCurrentSessionScopeSync.mockReset()
    mocks.useDashboardScope.mockReset()
    mocks.useNewSessionForm.mockReset()
    mocks.useSessionSelectionData.mockReset()

    mocks.useNavigate.mockReturnValue(vi.fn())
    mocks.useCsvImportFlow.mockReturnValue({ requestCsvFile: vi.fn() })
    mocks.useCurrentTeam.mockReturnValue({
      teams: [],
      currentTeamId: '',
      setCurrentTeamId: vi.fn(),
      loading: false,
    })
    mocks.useCurrentTerm.mockReturnValue({
      currentTerm: null,
      currentTermKey: '',
      setCurrentTermKey: vi.fn(),
      clearCurrentTerm: vi.fn(),
    })
    mocks.useCurrentSessionScopeSync.mockReturnValue({
      currentSessionId: '',
      scopeVersion: 0,
      refreshScope: vi.fn(),
      resetCurrentSessionScope: vi.fn(),
      selectSessionAndSyncDay: vi.fn(),
    })
    mocks.useDashboardScope.mockReturnValue({
      seasonOptions: ['Winter', 'Spring', 'Summer', 'Fall'],
      teamTermSessionsLoading: false,
      selectedFullTimeYear: null,
      fullTimeSessionTerms: [],
      fullTimeTermYears: [2026, 2025],
      fullTimeTermsForSelectedYear: [],
      handleSelectFullTimeTeam: vi.fn(),
      handleSelectFullTimeYear: vi.fn(),
      handleSelectFullTimeSeason: vi.fn(),
    })
    mocks.useNewSessionForm.mockReturnValue({} as any)
    mocks.useSessionSelectionData.mockReturnValue({
      sessions: [],
      sharedSessions: [],
    })
  })

  it('selecting a guest session syncs current session scope and navigates to manage sessions', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const selectSessionAndSyncDay = vi.fn()

    mocks.useNavigate.mockReturnValue(navigate)
    mocks.useAuth.mockReturnValue({
      accountType: 'part_time',
      isGuest: true,
      user: null,
    })
    mocks.useCurrentSessionScopeSync.mockReturnValue({
      currentSessionId: '',
      scopeVersion: 0,
      refreshScope: vi.fn(),
      resetCurrentSessionScope: vi.fn(),
      selectSessionAndSyncDay,
    })
    mocks.useSessionSelectionData.mockReturnValue({
      sessions: [
        {
          id: 'local-1',
          sessionDay: 'Monday',
          sessionSeason: 'Winter',
          sessionYear: 2026,
          startDate: '2026-01-05',
          endDate: '2026-02-16',
          location: 'Main Pool',
          sourceLocations: ['Main Pool'],
          instructors: [{ name: 'Alex' }],
        },
      ],
      sharedSessions: [],
    })

    customRender(<DashboardPage />)

    await user.click(screen.getByRole('button', { name: 'Select Existing Session' }))
    await user.click(screen.getByRole('button', { name: /Monday Winter 2026/i }))

    expect(selectSessionAndSyncDay).toHaveBeenCalledWith('local-1', 'Monday')
    expect(navigate).toHaveBeenCalledWith('/manage-sessions')
    expect(screen.queryByRole('button', { name: 'Share Sessions' })).not.toBeInTheDocument()
  })

  it('renders the share sessions button for signed-in part-time users and navigates to the share page', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()

    mocks.useNavigate.mockReturnValue(navigate)
    mocks.useAuth.mockReturnValue({
      accountType: 'part_time',
      isGuest: false,
      user: { id: 'user-1' },
    })

    customRender(<DashboardPage />)

    await user.click(screen.getByRole('button', { name: 'Share Sessions' }))

    expect(navigate).toHaveBeenCalledWith('/share-sessions')
  })

  it('renders the full-time scope panel and forwards upload requests', async () => {
    const user = userEvent.setup()
    const requestCsvFile = vi.fn()

    mocks.useAuth.mockReturnValue({
      accountType: 'full_time',
      isGuest: false,
      user: { id: 'user-1' },
    })
    mocks.useCsvImportFlow.mockReturnValue({ requestCsvFile })
    mocks.useCurrentTeam.mockReturnValue({
      teams: [{ id: 'team-1', name: 'Sharks', available_locations: [] }],
      currentTeamId: 'team-1',
      setCurrentTeamId: vi.fn(),
      loading: false,
    })
    mocks.useCurrentTerm.mockReturnValue({
      currentTerm: { key: 'winter-2026', season: 'winter', year: 2026, label: 'Winter 2026' },
      currentTermKey: 'winter-2026',
      setCurrentTermKey: vi.fn(),
      clearCurrentTerm: vi.fn(),
    })
    mocks.useDashboardScope.mockReturnValue({
      seasonOptions: ['Winter', 'Spring', 'Summer', 'Fall'],
      teamTermSessionsLoading: false,
      selectedFullTimeYear: 2026,
      fullTimeSessionTerms: [
        { key: 'winter-2026', season: 'winter', year: 2026, label: 'Winter 2026', sessionCount: 2 },
      ],
      fullTimeTermYears: [2026, 2025],
      fullTimeTermsForSelectedYear: [
        { key: 'winter-2026', season: 'winter', year: 2026, label: 'Winter 2026', sessionCount: 2 },
      ],
      handleSelectFullTimeTeam: vi.fn(),
      handleSelectFullTimeYear: vi.fn(),
      handleSelectFullTimeSeason: vi.fn(),
    })

    customRender(<DashboardPage />)

    expect(screen.getByText('Current term: Winter 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share Sessions' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Upload CSV and Choose Session' }))
    expect(requestCsvFile).toHaveBeenCalledTimes(1)
  })
})
