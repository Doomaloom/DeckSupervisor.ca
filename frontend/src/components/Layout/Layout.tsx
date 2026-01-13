import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDay } from '../../app/DayContext'
import { processCsvAndStore } from '../../lib/api'

type LayoutProps = {
    children: React.ReactNode
}

function Layout({ children }: LayoutProps) {
    const location = useLocation()
    const { selectedDay, setSelectedDay } = useDay()
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    const isCurrentPage = (path: string) => location.pathname === path
    const pageTitle = getPageTitle(location.pathname)

    useEffect(() => {
        document.title = pageTitle === 'COB Aquatics' ? pageTitle : `${pageTitle} | COB Aquatics`
    }, [pageTitle])

    return (
        <div className="app-layout">
            <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-brand">
                    <span className="logoandcollapse">
                        <Link to="/">
                            <h1>DeckSupervisor.ca</h1>
                        </Link>
                        <button
                            type="button"
                            className="sidebar-toggle"
                            onClick={() => setIsSidebarCollapsed(value => !value)}
                            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {isSidebarCollapsed ? '›' : '‹'}
                        </button>
                    </span>
                    <p className="page-title">{pageTitle}</p>
                </div>

                <div className={`sidebar-section ${isSidebarCollapsed ? 'hidden' : ''}`}>
                    <h3>Session Selector</h3>
                    <button className="btn" type="button">Current Session</button>
                </div>

                <div className={`sidebar-section ${isSidebarCollapsed ? 'hidden' : ''}`}>
                    <label className="drop-zone-header">
                        <span>Upload Roster</span>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={async (event: React.ChangeEvent<HTMLInputElement>) => {
                                const uploaded = event.target.files?.[0]
                                if (!uploaded) {
                                    return
                                }
                                if (!selectedDay) {
                                    alert('Please select a day before uploading.')
                                    return
                                }
                                try {
                                    await processCsvAndStore(uploaded, selectedDay)
                                    alert('Roster uploaded. You can view it in Rosters or Schematic.')
                                } catch (error) {
                                    console.error(error)
                                    alert('Failed to process the CSV file.')
                                } finally {
                                    event.target.value = ''
                                }
                            }}
                        />
                    </label>
                </div>

                <nav className="sidebar-links">
                    <Link to="/schematic" className={isCurrentPage('/schematic') ? 'current' : 'notcurrent'}>
                        Schematic
                    </Link>
                    <Link to="/masterlist" className={isCurrentPage('/masterlist') ? 'current' : 'notcurrent'}>
                        Master List
                    </Link>
                    <Link to="/rosters" className={isCurrentPage('/rosters') ? 'current' : 'notcurrent'}>
                        Rosters
                    </Link>
                    <Link to="/staff-notes" className={isCurrentPage('/staff-notes') ? 'current' : 'notcurrent'}>
                        Staff Notes
                    </Link>
                </nav>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    )
}

function getPageTitle(pathname: string) {
    switch (pathname) {
        case '/': return 'Home'
        case '/masterlist': return 'Master List Maker'
        case '/rosters': return 'Class Rosters'
        case '/schematic': return 'Class Schedule'
        case '/staff-notes': return 'Staff Notes'
        default: return 'COB Aquatics'
    }
}

export default Layout
