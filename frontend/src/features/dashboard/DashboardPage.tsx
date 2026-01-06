import { Link } from 'react-router-dom'

function Dashboard() {
  return (
    <div className="dashboard">
      <div className="container">
        <div className="pages-grid">
          <div className="page-card">
            <Link to="/schematic">Schematic</Link>
          </div>
          <div className="page-card">
            <Link to="/masterlist">Master List</Link>
          </div>
          <div className="page-card">
            <Link to="/rosters">Rosters</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
