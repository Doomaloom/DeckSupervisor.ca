import React from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { customRender, screen, waitFor } from '../test/render'
import AppRoutes from './routes'

vi.mock('../features/dashboard/DashboardPage', () => ({ default: () => <div>Dashboard Route</div> }))
vi.mock('../features/sessions/ManageSessionsPage', () => ({ default: () => <div>Manage Sessions Route</div> }))
vi.mock('../features/print/PrintPage', () => ({ default: () => <div>Print Route</div> }))
vi.mock('../features/rosters/RostersPage', () => ({ default: () => <div>Rosters Route</div> }))
vi.mock('../features/schematic/SchematicPage', () => ({ default: () => <div>Schematic Route</div> }))
vi.mock('../features/report-cards/ReportCardsPage', () => ({ default: () => <div>Report Cards Route</div> }))
vi.mock('../features/staff-notes/StaffNotesPage', () => ({ default: () => <div>Staff Notes Route</div> }))
vi.mock('../features/full-timer-tools/FullTimerToolsPage', () => ({ default: () => <div>Full Timer Tools Route</div> }))
vi.mock('../features/full-timer-tools/AttendanceSheetMakerPage', () => ({
  default: () => <div>Attendance Sheet Maker Route</div>,
}))
vi.mock('../features/auth/SignInPage', () => ({ default: () => <div>Sign In Route</div> }))
vi.mock('../features/account/AccountPage', () => ({ default: () => <div>Account Route</div> }))
vi.mock('../features/teams/TeamPage', () => ({ default: () => <div>Team Route</div> }))
vi.mock('../features/session-planning/SessionPlanningPage', () => ({ default: () => <div>Session Planning Route</div> }))
vi.mock('../features/session-sharing/ShareSessionsPage', () => ({ default: () => <div>Share Sessions Route</div> }))

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    accountType: 'full_time',
    isGuest: false,
  }),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

describe('AppRoutes', () => {
  it('redirects the removed requests route to the rosters request list view', async () => {
    customRender(
      <MemoryRouter initialEntries={['/requests']}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Rosters Route')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/rosters?view=requests')
    })
  })
})
