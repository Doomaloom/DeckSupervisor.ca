import { Routes, Route } from 'react-router-dom'
import DashboardPage from '../features/dashboard/DashboardPage'
import ManageSessionsPage from '../features/sessions/ManageSessionsPage'
import MasterListPage from '../features/masterlist/MasterListPage'
import PrintPage from '../features/print/PrintPage'
import RostersPage from '../features/rosters/RostersPage'
import SchematicPage from '../features/schematic/SchematicPage'
import StaffNotesPage from '../features/staff-notes/StaffNotesPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/manage-sessions" element={<ManageSessionsPage />} />
      <Route path="/masterlist" element={<MasterListPage />} />
      <Route path="/print" element={<PrintPage />} />
      <Route path="/rosters" element={<RostersPage />} />
      <Route path="/schematic" element={<SchematicPage />} />
      <Route path="/staff-notes" element={<StaffNotesPage />} />
    </Routes>
  )
}

export default AppRoutes
