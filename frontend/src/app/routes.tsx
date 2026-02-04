import { Routes, Route } from 'react-router-dom'
import DashboardPage from '../features/dashboard/DashboardPage'
import ManageSessionsPage from '../features/sessions/ManageSessionsPage'
import PrintPage from '../features/print/PrintPage'
import RostersPage from '../features/rosters/RostersPage'
import SchematicPage from '../features/schematic/SchematicPage'
import StaffNotesPage from '../features/staff-notes/StaffNotesPage'
import FullTimerToolsPage from '../features/full-timer-tools/FullTimerToolsPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/manage-sessions" element={<ManageSessionsPage />} />
      <Route path="/print" element={<PrintPage />} />
      <Route path="/rosters" element={<RostersPage />} />
      <Route path="/schematic" element={<SchematicPage />} />
      <Route path="/staff-notes" element={<StaffNotesPage />} />
      <Route path="/full-timer-tools" element={<FullTimerToolsPage />} />
    </Routes>
  )
}

export default AppRoutes
