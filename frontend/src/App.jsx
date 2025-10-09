import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MasterList from './pages/MasterList'
import Rosters from './pages/Rosters'
import Schematic from './pages/Schematic'
import './index.css'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/masterlist" element={<MasterList />} />
          <Route path="/rosters" element={<Rosters />} />
          <Route path="/schematic" element={<Schematic />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App