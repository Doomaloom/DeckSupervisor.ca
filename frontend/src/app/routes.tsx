import { Routes, Route } from 'react-router-dom'
import DashboardPage from '../features/dashboard/DashboardPage'
import ManageSessionsPage from '../features/sessions/ManageSessionsPage'
import PrintPage from '../features/print/PrintPage'
import RostersPage from '../features/rosters/RostersPage'
import SchematicPage from '../features/schematic/SchematicPage'
import ReportCardsPage from '../features/report-cards/ReportCardsPage'
import StaffNotesPage from '../features/staff-notes/StaffNotesPage'
import FullTimerToolsPage from '../features/full-timer-tools/FullTimerToolsPage'
import RequestsPage from '../features/requests/RequestsPage'
import SignInPage from '../features/auth/SignInPage'
import AccountPage from '../features/account/AccountPage'
import TeamPage from '../features/teams/TeamPage'
import SessionPlanningPage from '../features/session-planning/SessionPlanningPage'
import { useAuth } from './AuthContext'

function RequireFullTime({ children }: { children: JSX.Element }) {
  const { accountType, isGuest } = useAuth()
  if (isGuest) {
    return <SignInPage />
  }
  if (accountType !== 'full_time') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h2 className="text-xl font-semibold">Full-time access only</h2>
          <p className="mt-2 text-sm text-secondary/70">
            This page is only available to full-time accounts. If you need access, contact an
            administrator.
          </p>
        </div>
      </div>
    )
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/team" element={<TeamPage />} />
      <Route path="/" element={<DashboardPage />} />
      <Route path="/manage-sessions" element={<ManageSessionsPage />} />
      <Route path="/print" element={<PrintPage />} />
      <Route path="/rosters" element={<RostersPage />} />
      <Route path="/schematic" element={<SchematicPage />} />
      <Route path="/report-cards" element={<ReportCardsPage />} />
      <Route path="/staff-notes" element={<StaffNotesPage />} />
      <Route path="/session-planning" element={<SessionPlanningPage />} />
      <Route
        path="/requests"
        element={
          <RequireFullTime>
            <RequestsPage />
          </RequireFullTime>
        }
      />
      <Route
        path="/full-timer-tools"
        element={
          <RequireFullTime>
            <FullTimerToolsPage />
          </RequireFullTime>
        }
      />
    </Routes>
  )
}

export default AppRoutes
