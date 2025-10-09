import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

function Layout({ children }) {
  const location = useLocation()
  const [selectedDay, setSelectedDay] = useState('')

  const isCurrentPage = (path) => location.pathname === path

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="logo">
            <Link to="/">
              <h1>COB <br /> AQUATICS</h1>
            </Link>
          </div>
          <div className="welcome-message">
            <h2>{getPageTitle(location.pathname)}</h2>
            <p>Welcome, <span>Guest</span></p>
          </div>
          <div className="sign-in-out">
            <button className="btn">Sign Out</button>
          </div>
        </div>
        <div className="header-bottom">
          <select 
            className="select-btns" 
            value={selectedDay} 
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            <option value="">Select Day</option>
            <option value="Mo">Monday</option>
            <option value="Tu">Tuesday</option>
            <option value="We">Wednesday</option>
            <option value="Th">Thursday</option>
            <option value="Fr">Friday</option>
            <option value="Sa">Saturday</option>
            <option value="Su">Sunday</option>
            <option value="Mo,Tu,We,Th,Fr">Mini Session</option>
          </select>
          
          <div className="drop-zone-header">
            <p>Upload Roster</p>
            <input type="file" accept=".csv" style={{ opacity: 0 }} />
          </div>
          
          <div className="service_button">
            <Link to="/schematic" className={isCurrentPage('/schematic') ? 'current' : 'notcurrent'}>
              Schematic
            </Link>
          </div>
          <div className="service_button">
            <Link to="/masterlist" className={isCurrentPage('/masterlist') ? 'current' : 'notcurrent'}>
              Master List
            </Link>
          </div>
          <div className="service_button">
            <Link to="/rosters" className={isCurrentPage('/rosters') ? 'current' : 'notcurrent'}>
              Rosters
            </Link>
          </div>
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

function getPageTitle(pathname) {
  switch(pathname) {
    case '/': return 'Home'
    case '/masterlist': return 'Master List Maker'
    case '/rosters': return 'Class Rosters'
    case '/schematic': return 'Class Schedule'
    default: return 'COB Aquatics'
  }
}

export default Layout