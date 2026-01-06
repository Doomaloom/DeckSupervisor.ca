import { Routes, Route } from 'react-router-dom'
import DashboardPage from '../features/dashboard/DashboardPage'
import MasterListPage from '../features/masterlist/MasterListPage'
import RostersPage from '../features/rosters/RostersPage'
import SchematicPage from '../features/schematic/SchematicPage'
import StaffNotesPage from '../features/staff-notes/StaffNotesPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/masterlist" element={<MasterListPage />} />
      <Route path="/rosters" element={<RostersPage />} />
      <Route path="/schematic" element={<SchematicPage />} />
      <Route path="/staff-notes" element={<StaffNotesPage />} />
    </Routes>
  )
}

export default AppRoutes
