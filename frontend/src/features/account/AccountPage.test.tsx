import React from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customRender, screen, waitFor } from '../../test/render'
import AccountPage from './AccountPage'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  acceptTeamInvite: vi.fn(),
  declineTeamInvite: vi.fn(),
  fetchAccountData: vi.fn(),
  leaveTeam: vi.fn(),
  clearCurrentTeamId: vi.fn(),
  getCurrentTeamId: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('../../app/AuthContext', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../lib/serverApi', () => ({
  acceptTeamInvite: mocks.acceptTeamInvite,
  declineTeamInvite: mocks.declineTeamInvite,
  fetchAccountData: mocks.fetchAccountData,
  leaveTeam: mocks.leaveTeam,
}))

vi.mock('../../lib/teamStorage', () => ({
  clearCurrentTeamId: mocks.clearCurrentTeamId,
  getCurrentTeamId: mocks.getCurrentTeamId,
}))

describe('AccountPage', () => {
  beforeEach(() => {
    mocks.useAuth.mockReset()
    mocks.acceptTeamInvite.mockReset()
    mocks.declineTeamInvite.mockReset()
    mocks.fetchAccountData.mockReset()
    mocks.leaveTeam.mockReset()
    mocks.clearCurrentTeamId.mockReset()
    mocks.getCurrentTeamId.mockReset()

    mocks.useAuth.mockReturnValue({
      accountType: 'part_time',
      completeProfile: vi.fn(),
      isGuest: false,
      profile: {
        email: 'member@example.com',
        first_name: 'Mina',
        last_name: 'Member',
      },
      user: {
        id: 'user-1',
        email: 'member@example.com',
      },
    })

    mocks.fetchAccountData.mockResolvedValue({
      invites: [],
      memberships: [
        {
          team_id: 'team-1',
          role: 'member',
          teams: { name: 'Sharks' },
        },
      ],
    })
    mocks.getCurrentTeamId.mockReturnValue('team-1')
  })

  it('lets a signed-in member leave a team from My Teams', async () => {
    const user = userEvent.setup()
    mocks.leaveTeam.mockResolvedValue(undefined)

    customRender(<AccountPage />)

    expect(await screen.findByText('Sharks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Leave Team' }))

    await waitFor(() => expect(mocks.leaveTeam).toHaveBeenCalledWith('team-1'))
    expect(mocks.clearCurrentTeamId).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Left Sharks.')).toBeInTheDocument()
    expect(screen.queryByText('Sharks')).not.toBeInTheDocument()
  })
})
