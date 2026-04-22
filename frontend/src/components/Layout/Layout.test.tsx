import React from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, customRender, screen } from '../../test/render'
import Layout from './Layout'
import { TutorialProvider } from '../../features/tutorials/TutorialContext'

const mocks = vi.hoisted(() => ({
  useDay: vi.fn(),
  useAuth: vi.fn(),
  useCsvImportFlow: vi.fn(),
  useCurrentSession: vi.fn(),
  useCurrentTeam: vi.fn(),
  useCurrentTerm: vi.fn(),
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

describe('Layout tutorials', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    window.innerWidth = 1280
    mocks.useDay.mockReturnValue({
      selectedDay: '',
    })
    mocks.useAuth.mockReturnValue({
      accountType: 'part_time',
      completeProfile: vi.fn(),
      isGuest: false,
      needsProfile: false,
      profile: { first_name: 'Test', last_name: 'User', email: 'test@example.com' },
      signOut: vi.fn(),
      user: { id: 'user-1', email: 'test@example.com' },
    })
    mocks.useCsvImportFlow.mockReturnValue({
      requestCsvFile: vi.fn(),
    })
    mocks.useCurrentSession.mockReturnValue({
      access: { mode: 'owner' },
      loading: false,
      session: null,
    })
    mocks.useCurrentTeam.mockReturnValue({
      currentTeam: null,
      currentTeamId: '',
      loading: false,
    })
    mocks.useCurrentTerm.mockReturnValue({
      currentTerm: null,
    })
  })

  function renderLayout(initialPath = '/') {
    return customRender(
      <MemoryRouter initialEntries={[initialPath]}>
        <TutorialProvider>
          <Layout>
            <div>
              <div data-help-anchor="manage-session-summary" style={{ width: 200, height: 100 }} />
              <div data-help-anchor="manage-session-fields" style={{ width: 200, height: 100 }} />
              <div data-help-anchor="manage-session-location-mapping" style={{ width: 200, height: 100 }} />
              <div data-help-anchor="manage-session-instructors" style={{ width: 200, height: 100 }} />
              <div data-help-anchor="manage-session-actions" style={{ width: 200, height: 100 }} />
              <div data-help-anchor="schematic-board" style={{ width: 400, height: 300 }} />
              <div data-help-anchor="schematic-single-move" style={{ width: 120, height: 120 }} />
              <div data-help-anchor="schematic-multi-move" style={{ width: 120, height: 120 }} />
              <div data-help-anchor="schematic-add-column" style={{ width: 120, height: 40 }} />
              <div data-help-anchor="schematic-remove-empty-columns" style={{ width: 120, height: 40 }} />
              <div data-help-anchor="schematic-save-schedule" style={{ width: 120, height: 40 }} />
              <div data-help-anchor="roster-filters" style={{ width: 300, height: 80 }} />
              <div data-help-anchor="roster-card-overview" style={{ width: 300, height: 180 }} />
              <div data-help-anchor="roster-level-mode" style={{ width: 120, height: 40 }} />
              <div data-help-anchor="roster-print-button" style={{ width: 120, height: 40 }} />
              <div data-help-anchor="print-page-header" style={{ width: 320, height: 120 }} />
              <div data-help-anchor="print-options-grid" style={{ width: 320, height: 240 }} />
              <div data-help-anchor="print-day1" style={{ width: 140, height: 100 }} />
              <div data-help-anchor="print-instructors" style={{ width: 140, height: 100 }} />
              <div data-help-anchor="print-masterlist" style={{ width: 140, height: 100 }} />
              <div data-help-anchor="print-schematic" style={{ width: 140, height: 100 }} />
            </div>
          </Layout>
        </TutorialProvider>
      </MemoryRouter>,
    )
  }

  it('opens overlay pins for supported pages instead of a modal', async () => {
    const user = userEvent.setup()
    renderLayout('/rosters')

    await user.click(screen.getByRole('button', { name: 'Help' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Rosters Quick Tips')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Tip 1: Filters and Search' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Tip 4: Roster Print Button' })).toBeInTheDocument()
  })

  it('shows a brief unsupported message on routes without page overlays', async () => {
    const user = userEvent.setup()
    renderLayout('/session-planning')

    await user.click(screen.getByRole('button', { name: 'Help' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Quick tips are not available on this page yet. Use Help / Tutorials on Home for the full prep walkthrough.',
    )
  })

  it('closes the overlay on a second help click', async () => {
    const user = userEvent.setup()
    renderLayout('/schematic')

    await user.click(screen.getByRole('button', { name: 'Help' }))
    expect(await screen.findByText('Schematic Quick Tips')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Help' }))

    expect(screen.queryByText('Schematic Quick Tips')).not.toBeInTheDocument()
  })

  it('closes the page overlay on escape', async () => {
    const user = userEvent.setup()
    renderLayout('/print')

    await user.click(screen.getByRole('button', { name: 'Help' }))
    expect(await screen.findByText('Print Quick Tips')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByText('Print Quick Tips')).not.toBeInTheDocument()
  })

  it('updates the help content when a pin is selected', async () => {
    const user = userEvent.setup()
    renderLayout('/schematic')

    await user.click(screen.getByRole('button', { name: 'Help' }))
    await user.click(await screen.findByRole('button', { name: 'Tip 3: Multi-Move' }))

    expect(screen.getAllByText('Multi-Move').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/same-column selection/i).length).toBeGreaterThan(0)
  })

  it('renders the mobile bottom sheet on small screens', async () => {
    const user = userEvent.setup()
    window.innerWidth = 480
    window.dispatchEvent(new Event('resize'))
    renderLayout('/manage-sessions')

    await user.click(screen.getByRole('button', { name: 'Help' }))

    expect(document.querySelector('[data-component="page-help-bottom-sheet"]')).not.toBeNull()
  })
})
