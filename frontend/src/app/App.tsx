import { BrowserRouter as Router } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { TutorialProvider } from '../features/tutorials/TutorialContext'
import { CsvImportFlowProvider } from './CsvImportFlowContext'
import AppRoutes from './routes'
import '../styles/index.css'

function App() {
  return (
    <Router>
      <CsvImportFlowProvider>
        <TutorialProvider>
          <Layout>
            <AppRoutes />
          </Layout>
        </TutorialProvider>
      </CsvImportFlowProvider>
    </Router>
  )
}

export default App
