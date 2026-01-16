import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    ClipboardDocumentListIcon,
    CalendarDaysIcon,
    DocumentTextIcon,
    HomeIcon,
    AdjustmentsHorizontalIcon,
    UsersIcon,
} from '@heroicons/react/24/outline'
import { useDay } from '../../app/DayContext'
import { processCsvAndStore } from '../../lib/api'

type LayoutProps = {
    children: React.ReactNode
}

type SessionEntry = {
    id: string
    sessionDay: string
    sessionSeason: string
    startDate: string
}

const SESSIONS_STORAGE_KEY = 'decksupervisor.sessions'
const CURRENT_SESSION_KEY = 'decksupervisor.currentSessionId'

const dayNames: Record<string, string> = {
    Mo: 'Monday',
    Tu: 'Tuesday',
    We: 'Wednesday',
    Th: 'Thursday',
    Fr: 'Friday',
    Sa: 'Saturday',
    Su: 'Sunday',
}

function getSessionName(session: SessionEntry) {
    const dayLabel = session.sessionDay ? dayNames[session.sessionDay] ?? session.sessionDay : ''
    const season = session.sessionSeason?.trim()
    const year = session.startDate ? new Date(session.startDate).getFullYear() : NaN
    const yearLabel = Number.isFinite(year) && year > 0 ? String(year) : ''
    const parts = [dayLabel, season, yearLabel].filter(Boolean)
    return parts.length ? parts.join(' ') : 'Session'
}

function getCurrentSessionName() {
    if (typeof window === 'undefined') {
        return ''
    }
    const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY) ?? ''
    if (!currentSessionId) {
        return ''
    }
    const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
    if (!stored) {
        return ''
    }
    try {
        const sessions = JSON.parse(stored) as SessionEntry[]
        const session = sessions.find(item => item.id === currentSessionId)
        return session ? getSessionName(session) : ''
    } catch (error) {
        console.error('Failed to parse stored sessions', error)
        return ''
    }
}

function Layout({ children }: LayoutProps) {
    const location = useLocation()
    const { selectedDay } = useDay()
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    const isCurrentPage = (path: string) => location.pathname === path
    const pageTitle = getPageTitle(location.pathname)
    const currentSessionName = useMemo(() => getCurrentSessionName(), [location.pathname])

    useEffect(() => {
        document.title = pageTitle === 'COB Aquatics' ? pageTitle : `${pageTitle} | COB Aquatics`
    }, [pageTitle])

    const navBaseClasses =
        'flex items-center justify-start rounded-[10px] bg-white/10 px-3 py-2 text-accent transition hover:-translate-y-0.5'
    const navCollapsedClasses = isSidebarCollapsed ? 'justify-center px-0 py-2 text-[0.85rem]' : ''
    const navCurrentClasses = 'bg-accent text-secondary'
    const navHoverClasses = 'hover:bg-hover hover:text-secondary'

    return (
        <div className="flex h-screen overflow-hidden">
            <aside
                className={`flex h-screen shrink-0 flex-col gap-6 overflow-y-auto bg-primary p-6 text-accent transition-[width] duration-300 ${
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
                        <h3 className="text-[0.95rem] font-semibold">Current Session</h3>
                        <div className="w-full rounded-2xl border border-secondary/30 bg-accent px-4 py-2 text-sm text-secondary">
                            {currentSessionName || 'No session selected'}
                        </div>
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
                    {[
                        {
                            to: '/',
                            label: 'Home',
                            icon: <HomeIcon className="h-5 w-5" />,
                        },
                        {
                            to: '/manage-sessions',
                            label: 'Manage Sessions',
                            icon: <AdjustmentsHorizontalIcon className="h-5 w-5" />,
                        },
                        {
                            to: '/schematic',
                            label: 'Schematic',
                            icon: <CalendarDaysIcon className="h-5 w-5" />,
                        },
                        {
                            to: '/masterlist',
                            label: 'Master List',
                            icon: <ClipboardDocumentListIcon className="h-5 w-5" />,
                        },
                        {
                            to: '/rosters',
                            label: 'Rosters',
                            icon: <UsersIcon className="h-5 w-5" />,
                        },
                        {
                            to: '/staff-notes',
                            label: 'Staff Notes',
                            icon: <DocumentTextIcon className="h-5 w-5" />,
                        },
                    ].map(item => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`${navBaseClasses} ${navCollapsedClasses} ${
                                isCurrentPage(item.to) ? navCurrentClasses : navHoverClasses
                            }`}
                            aria-label={item.label}
                        >
                            {isSidebarCollapsed ? (
                                <>
                                    {item.icon}
                                    <span className="sr-only">{item.label}</span>
                                </>
                            ) : (
                                <span className="flex items-center gap-2">
                                    {item.icon}
                                    {item.label}
                                </span>
                            )}
                        </Link>
                    ))}
                </nav>
            </aside>

            <main className="flex min-h-0 flex-1 overflow-y-auto p-8">
                {children}
            </main>
        </div>
    )
}

function getPageTitle(pathname: string) {
    switch (pathname) {
        case '/': return 'Home'
        case '/manage-sessions': return 'Manage Sessions'
        case '/masterlist': return 'Master List Maker'
        case '/rosters': return 'Class Rosters'
        case '/schematic': return 'Class Schedule'
        case '/staff-notes': return 'Staff Notes'
        default: return 'COB Aquatics'
    }
}

export default Layout
