import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, customRender, screen } from '../../test/render'
import Layout from './Layout'

const mocks = vi.hoisted(() => ({
  useDay: vi.fn(),
  useAuth: vi.fn(),
  useCsvImportFlow: vi.fn(),
  useCurrentSession: vi.fn(),
  useCurrentTeam: vi.fn(),
  useCurrentTerm: vi.fn(),
  useTutorials: vi.fn(),
}))

vi.mock('../../app/DayContext', () => ({
  useDay: mocks.useDay,
}))

vi.mock('../../app/AuthContext', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../app/CsvImportFlowContext', () => ({
  useCsvImportFlow: mocks.useCsvImportFlow,
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

vi.mock('../../features/tutorials/TutorialContext', () => ({
  useTutorials: mocks.useTutorials,
}))

describe('Layout navigation', () => {
  beforeEach(() => {
    mocks.useDay.mockReturnValue({ selectedDay: '' })
    mocks.useAuth.mockReturnValue({
      accountType: 'full_time',
      completeProfile: vi.fn(),
      isGuest: false,
      needsProfile: false,
      profile: { first_name: 'Test', last_name: 'User', email: 'test@example.com' },
      signOut: vi.fn(),
      user: { id: 'user-1', email: 'test@example.com' },
    })
    mocks.useCsvImportFlow.mockReturnValue({ requestCsvFile: vi.fn() })
    mocks.useCurrentSession.mockReturnValue({
      access: { mode: 'owner' },
      loading: false,
      session: null,
    })
    mocks.useCurrentTeam.mockReturnValue({
      currentTeam: { id: 'team-1', name: 'Aquatics Team' },
      currentTeamId: 'team-1',
      loading: false,
    })
    mocks.useCurrentTerm.mockReturnValue({
      currentTerm: { label: 'Spring 2026' },
    })
    mocks.useTutorials.mockReturnValue({
      togglePageHelpForPath: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the full-time requests nav item on the rosters route', () => {
    customRender(
      <MemoryRouter initialEntries={['/rosters']}>
        <Layout>
          <div>Current Page</div>
        </Layout>
      </MemoryRouter>,
    )

    const requestsLink = screen.getByRole('link', { name: 'Requests' })
    expect(requestsLink).toBeInTheDocument()
    expect(requestsLink).toHaveAttribute('href', '/rosters')
    expect(screen.queryByRole('link', { name: 'Rosters' })).not.toBeInTheDocument()
  })
})
