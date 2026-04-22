import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, customRender, screen, waitFor } from '../../test/render'
import ShareSessionsPage from './ShareSessionsPage'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  fetchMySessions: vi.fn(),
  fetchOwnedSessionShares: vi.fn(),
  searchSessionShareRecipients: vi.fn(),
  createSessionShares: vi.fn(),
  revokeSessionShare: vi.fn(),
  getTorontoDate: vi.fn(),
}))

vi.mock('../../app/AuthContext', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../lib/serverApi', () => ({
  fetchMySessions: mocks.fetchMySessions,
  fetchOwnedSessionShares: mocks.fetchOwnedSessionShares,
  searchSessionShareRecipients: mocks.searchSessionShareRecipients,
  createSessionShares: mocks.createSessionShares,
  revokeSessionShare: mocks.revokeSessionShare,
}))

vi.mock('../../lib/torontoDate', () => ({
  getTorontoDate: mocks.getTorontoDate,
}))

const shareableSession = {
  id: 'session-1',
  team_id: 'team-1',
  created_by: 'user-1',
  session_day: 'Monday',
  session_season: 'Spring',
  session_year: 2026,
  start_date: '2026-04-06',
  end_date: '2026-05-11',
  location: 'Main Pool',
  source_locations: ['Main Pool'],
  session_start_time24: '16:00',
  session_end_time24: '19:00',
  instructors: [{ name: 'Alex' }],
}

const nonShareableSession = {
  ...shareableSession,
  id: 'session-2',
  start_date: '2026-05-01',
  end_date: '2026-06-01',
}

const activeNonTeamSession = {
  ...shareableSession,
  id: 'session-3',
  team_id: null,
  session_day: 'Wednesday',
}

function renderPage() {
  return customRender(
    <MemoryRouter>
      <ShareSessionsPage />
    </MemoryRouter>,
  )
}

describe('ShareSessionsPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mocks.useAuth.mockReset()
    mocks.fetchMySessions.mockReset()
    mocks.fetchOwnedSessionShares.mockReset()
    mocks.searchSessionShareRecipients.mockReset()
    mocks.createSessionShares.mockReset()
    mocks.revokeSessionShare.mockReset()
    mocks.getTorontoDate.mockReset()

    mocks.useAuth.mockReturnValue({
      accountType: 'part_time',
      isGuest: false,
      user: { id: 'user-1' },
    })
    mocks.getTorontoDate.mockReturnValue('2026-04-21')
    mocks.fetchMySessions.mockResolvedValue({
      sessions: [shareableSession, nonShareableSession, activeNonTeamSession],
    })
    mocks.fetchOwnedSessionShares.mockResolvedValue({ shares: [] })
    mocks.searchSessionShareRecipients.mockResolvedValue({
      results: [
        { id: 'user-1', first_name: 'Pat', last_name: 'Self', email: 'pat@example.com' },
        { id: 'user-2', first_name: 'Jamie', last_name: 'Lane', email: 'jamie@example.com' },
      ],
    })
    mocks.createSessionShares.mockResolvedValue(undefined)
    mocks.revokeSessionShare.mockResolvedValue(undefined)
  })

  it('shows only currently active sessions and searches users across the app', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('button', { name: /Monday Spring 2026/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Wednesday Spring 2026/i })).toBeInTheDocument()
    expect(screen.queryByText(/session-2/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Monday Spring 2026/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByPlaceholderText('Search by name or email')
    await user.type(screen.getByPlaceholderText('Search by name or email'), 'jamie')

    expect(screen.getByRole('button', { name: /Jamie Lane/i })).toBeInTheDocument()
    expect(mocks.searchSessionShareRecipients).toHaveBeenCalled()
  })

  it('creates one share row per valid range date and refreshes the scheduled list', async () => {
    const user = userEvent.setup()
    mocks.fetchOwnedSessionShares
      .mockResolvedValueOnce({ shares: [] })
      .mockResolvedValueOnce({
        shares: [
          {
            id: 'share-1',
            session: shareableSession,
            shared_with_profile: {
              id: 'user-2',
              first_name: 'Jamie',
              last_name: 'Lane',
              email: 'jamie@example.com',
            },
            share_date: '2026-04-27',
            allow_roster_edits: true,
            created_at: '2026-04-21T10:00:00Z',
          },
          {
            id: 'share-2',
            session: shareableSession,
            shared_with_profile: {
              id: 'user-2',
              first_name: 'Jamie',
              last_name: 'Lane',
              email: 'jamie@example.com',
            },
            share_date: '2026-05-04',
            allow_roster_edits: true,
            created_at: '2026-04-21T10:00:00Z',
          },
        ],
      })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Monday Spring 2026/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(screen.getByPlaceholderText('Search by name or email'), 'jamie')
    await user.click(await screen.findByRole('button', { name: /Jamie Lane/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Date Range' }))
    await user.clear(screen.getByLabelText('Start Date'))
    await user.type(screen.getByLabelText('Start Date'), '2026-04-20')
    await user.clear(screen.getByLabelText('End Date'))
    await user.type(screen.getByLabelText('End Date'), '2026-05-05')
    await user.click(screen.getByRole('checkbox', { name: /Allow roster edits/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText(/Apr 27, 2026/i)).toBeInTheDocument()
    expect(screen.getByText(/May 4, 2026/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm Sharing' }))

    await waitFor(() => {
      expect(mocks.createSessionShares).toHaveBeenCalledWith({
        session_id: 'session-1',
        shared_with: 'user-2',
        share_dates: ['2026-04-27', '2026-05-04'],
        allow_roster_edits: true,
      })
    })
    expect(await screen.findByText(/Session shares scheduled\./i)).toBeInTheDocument()
    expect(await screen.findByText(/Mon, Apr 27, 2026/i)).toBeInTheDocument()
    expect(await screen.findByText(/Mon, May 4, 2026/i)).toBeInTheDocument()
  })

  it('blocks conflicting dates and revokes an individual share row', async () => {
    const user = userEvent.setup()
    const existingShare = {
      id: 'share-1',
      session: shareableSession,
      shared_with_profile: {
        id: 'user-2',
        first_name: 'Jamie',
        last_name: 'Lane',
        email: 'jamie@example.com',
      },
      share_date: '2026-04-27',
      allow_roster_edits: false,
      created_at: '2026-04-21T10:00:00Z',
    }

    mocks.fetchOwnedSessionShares
      .mockResolvedValueOnce({ shares: [existingShare] })
      .mockResolvedValueOnce({ shares: [] })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Monday Spring 2026/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(screen.getByPlaceholderText('Search by name or email'), 'jamie')
    await user.click(await screen.findByRole('button', { name: /Jamie Lane/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.clear(screen.getByLabelText('Share Date'))
    await user.type(screen.getByLabelText('Share Date'), '2026-04-27')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText(/already shared: 2026-04-27/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm Sharing' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(mocks.revokeSessionShare).toHaveBeenCalledWith('share-1')
    })
    await waitFor(() => {
      expect(screen.getByText(/No scheduled session shares yet\./i)).toBeInTheDocument()
    })
  })
})
