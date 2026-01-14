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

    const navBaseClasses =
        'rounded-[10px] bg-white/10 px-3 py-2 text-accent transition hover:-translate-y-0.5'
    const navCollapsedClasses = isSidebarCollapsed ? 'text-center px-0 py-2 text-[0.85rem]' : ''
    const navCurrentClasses = 'bg-accent text-secondary'
    const navHoverClasses = 'hover:bg-hover hover:text-secondary'

    return (
        <div className="flex min-h-screen">
            <aside
                className={`flex flex-col gap-6 bg-primary p-6 text-accent transition-[width] duration-300 ${
                    isSidebarCollapsed ? 'w-[84px]' : 'w-72'
                }`}
            >
                <div className="flex flex-col gap-1.5">
                    <span className="flex items-center justify-between gap-3">
                        <Link to="/" className="text-accent no-underline">
                            {!isSidebarCollapsed && (
                                <h1 className="text-[1.2rem] font-semibold leading-tight">DeckSupervisor.ca</h1>
                            )}
                        </Link>
                        <button
                            type="button"
                            className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-accent"
                            onClick={() => setIsSidebarCollapsed(value => !value)}
                            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {isSidebarCollapsed ? '›' : '‹'}
                        </button>
                    </span>
                    {!isSidebarCollapsed && <p className="text-[0.95rem] opacity-80">{pageTitle}</p>}
                </div>

                {!isSidebarCollapsed && (
                    <div className="flex flex-col gap-2">
                        <h3 className="text-[0.95rem] font-semibold">Session Selector</h3>
                        <button
                            className="w-full rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                            type="button"
                        >
                            Current Session
                        </button>
                    </div>
                )}

                {!isSidebarCollapsed && (
                    <div className="flex flex-col gap-2">
                        <h3 className="text-[0.95rem] font-semibold">Day</h3>
                        <select
                            className="w-full rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary"
                            value={selectedDay}
                            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedDay(event.target.value)}
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
                    </div>
                )}

                {!isSidebarCollapsed && (
                    <div className="flex flex-col gap-2">
                        <label className="relative flex h-12 items-center justify-center rounded-[10px] border border-dashed border-white/50 bg-white/10 px-2 text-center text-sm font-medium text-accent transition hover:-translate-y-0.5 hover:bg-hover">
                            <span>Upload Roster</span>
                            <input
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
                )}

                <nav className="flex flex-col gap-3">
                    <Link
                        to="/"
                        className={`${navBaseClasses} ${navCollapsedClasses} ${
                            isCurrentPage('/') ? navCurrentClasses : navHoverClasses
                        }`}
                    >
                        Home
                    </Link>
                    <Link
                        to="/schematic"
                        className={`${navBaseClasses} ${navCollapsedClasses} ${
                            isCurrentPage('/schematic') ? navCurrentClasses : navHoverClasses
                        }`}
                    >
                        Schematic
                    </Link>
                    <Link
                        to="/masterlist"
                        className={`${navBaseClasses} ${navCollapsedClasses} ${
                            isCurrentPage('/masterlist') ? navCurrentClasses : navHoverClasses
                        }`}
                    >
                        Master List
                    </Link>
                    <Link
                        to="/rosters"
                        className={`${navBaseClasses} ${navCollapsedClasses} ${
                            isCurrentPage('/rosters') ? navCurrentClasses : navHoverClasses
                        }`}
                    >
                        Rosters
                    </Link>
                    <Link
                        to="/staff-notes"
                        className={`${navBaseClasses} ${navCollapsedClasses} ${
                            isCurrentPage('/staff-notes') ? navCurrentClasses : navHoverClasses
                        }`}
                    >
                        Staff Notes
                    </Link>
                </nav>
            </aside>

            <main className="flex-1 p-8">
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
