import { BrowserRouter as Router } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { CsvImportFlowProvider } from './CsvImportFlowContext'
import AppRoutes from './routes'
import '../styles/index.css'

function App() {
  return (
    <Router>
      <CsvImportFlowProvider>
        <Layout>
          <AppRoutes />
        </Layout>
      </CsvImportFlowProvider>
    </Router>
  )
}

export default App
