import { createBrowserRouter, RouterProvider, useLocation } from 'react-router-dom'
import InstructorLayout from '../features/instructor/InstructorLayout'
import Layout from '../components/Layout/Layout'
import { CsvImportFlowProvider } from './CsvImportFlowContext'
import AppRoutes from './routes'
import '../styles/index.css'

function Workspace() {
 const location=useLocation()
 if(location.pathname.startsWith('/instructor')) return <InstructorLayout><AppRoutes /></InstructorLayout>
 return <CsvImportFlowProvider><Layout><AppRoutes /></Layout></CsvImportFlowProvider>
}

const router=createBrowserRouter([{path:'*',element:<Workspace />}])
function App() { return <RouterProvider router={router} /> }
export default App
