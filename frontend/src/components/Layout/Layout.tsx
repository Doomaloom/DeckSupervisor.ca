import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    CalendarDaysIcon,
    ClipboardDocumentListIcon,
    DocumentTextIcon,
    HomeIcon,
    AdjustmentsHorizontalIcon,
    UsersIcon,
    PrinterIcon,
    ClockIcon,
    UserCircleIcon,
    UserGroupIcon,
    UserPlusIcon,
    ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'
import { useDay } from '../../app/DayContext'
import { useAuth } from '../../app/AuthContext'
import { useCsvImportFlow } from '../../app/CsvImportFlowContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import { resolveCustomRosters } from '../../lib/customRostersApi'
import { onStorageScopeChanged } from '../../lib/storageScope'
import {
    getCustomRosterDayKey,
    getCustomRostersForDay,
    getStudentsForDay,
    setCustomRostersForDay,
} from '../../lib/storage'

type LayoutProps = {
    children: React.ReactNode
}

type SessionEntry = {
    id: string
    sessionDay: string
    sessionSeason: string
    sessionYear?: number | null
    startDate: string
}

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
    const startYear = session.startDate ? new Date(session.startDate).getFullYear() : NaN
    const year = session.sessionYear ?? (Number.isFinite(startYear) && startYear > 0 ? startYear : null)
    const yearLabel = year ? String(year) : ''
    const parts = [dayLabel, season, yearLabel].filter(Boolean)
    return parts.length ? parts.join(' ') : 'Session'
}

function Layout({ children }: LayoutProps) {
    const location = useLocation()
    const { selectedDay } = useDay()
    const { accountType, completeProfile, isGuest, needsProfile, profile, signOut, user } = useAuth()
    const { requestCsvFile } = useCsvImportFlow()
    const { access, session: currentSession } = useCurrentSession()
    const { currentTeam, currentTeamId, loading: teamLoading } = useCurrentTeam()
    const { currentTerm } = useCurrentTerm()
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [scopeVersion, setScopeVersion] = useState(0)
    const [profileFirstName, setProfileFirstName] = useState('')
    const [profileLastName, setProfileLastName] = useState('')
    const [profileError, setProfileError] = useState('')
    const isPlannerPopout = location.pathname === '/session-planning' && new URLSearchParams(location.search).get('popout') === '1'

    const isCurrentPage = (path: string) => location.pathname === path
    const pageTitle = getPageTitle(location.pathname)
    const currentSessionName = useMemo(() => {
        if (accountType === 'full_time') {
            return currentTerm?.label ?? ''
        }
        if (!currentSession) {
            return ''
        }
        const sessionDay = currentSession.session_day || ''
        const sessionSeason = currentSession.session_season ?? ''
        const startDate = currentSession.start_date ?? ''
        const sessionYear = currentSession.session_year ?? null
        return getSessionName({
            id: currentSession.id,
            sessionDay,
            sessionSeason,
            sessionYear,
            startDate,
        })
    }, [accountType, currentSession, currentTerm, scopeVersion])

    useEffect(() => {
        if (!needsProfile) {
            return
        }
        setProfileFirstName(profile?.first_name ?? '')
        setProfileLastName(profile?.last_name ?? '')
    }, [needsProfile, profile])

    useEffect(() => {
        document.title = pageTitle === 'DeckSupervisor.ca' ? pageTitle : `${pageTitle} | DeckSupervisor.ca`
    }, [pageTitle])

    useEffect(() => {
        return onStorageScopeChanged(() => {
            setScopeVersion(version => version + 1)
        })
    }, [])

    useEffect(() => {
        const sessionId = currentSession?.id
        if (!selectedDay || !user || !sessionId) {
            return
        }
        const students = getStudentsForDay(selectedDay)
        if (students.length === 0) {
            return
        }
        const localKey = getCustomRosterDayKey(selectedDay, sessionId, false)
        let active = true
        const sync = async () => {
            try {
                const resolved = await resolveCustomRosters(selectedDay, sessionId, students)
                if (!active) {
                    return
                }
                if (resolved.length > 0 || getCustomRostersForDay(localKey).length > 0) {
                    setCustomRostersForDay(localKey, resolved)
                }
            } catch (error) {
                console.error('Failed to sync custom rosters', error)
            }
        }
        void sync()
        return () => {
            active = false
        }
    }, [currentSession?.id, selectedDay, user, scopeVersion])

    const navBaseClasses =
        'flex items-center justify-start rounded-[10px] bg-white/10 px-3 py-2 text-accent transition hover:-translate-y-0.5'
    const navCollapsedClasses = isSidebarCollapsed ? 'justify-center px-0 py-2 text-[0.85rem]' : ''
    const navCurrentClasses = 'bg-accent text-secondary'
    const navHoverClasses = 'hover:bg-hover hover:text-secondary'
    const displayName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : profile?.email ?? user?.email ?? 'Guest'
    const accountLabel = accountType === 'full_time' ? 'Full-time' : user ? 'Part-time' : 'Guest'
    const standardNavItems = [
        {
            to: '/',
            label: 'Home',
            icon: <HomeIcon className="h-5 w-5" />,
        },
        {
            to: '/manage-sessions',
            label: 'Manage Session',
            icon: <AdjustmentsHorizontalIcon className="h-5 w-5" />,
        },
        {
            to: '/schematic',
            label: 'Schematic',
            icon: <CalendarDaysIcon className="h-5 w-5" />,
        },
        {
            to: '/rosters',
            label: 'Rosters',
            icon: <UsersIcon className="h-5 w-5" />,
        },
        {
            to: '/print',
            label: 'Print',
            icon: <PrinterIcon className="h-5 w-5" />,
        },
        {
            to: '/session-planning',
            label: 'Session Planning',
            icon: <ArrowsRightLeftIcon className="h-5 w-5" />,
        },
        {
            to: '/report-cards',
            label: 'Report Cards',
            icon: <ClipboardDocumentListIcon className="h-5 w-5" />,
        },
        {
            to: '/staff-notes',
            label: 'Notes',
            icon: <DocumentTextIcon className="h-5 w-5" />,
        },
        {
            to: '/account',
            label: 'Account',
            icon: <UserCircleIcon className="h-5 w-5" />,
        },
    ]

    const fullTimeNavItems = [
        {
            to: '/',
            label: 'Home',
            icon: <HomeIcon className="h-5 w-5" />,
        },
        {
            to: '/requests',
            label: 'Requests',
            icon: <UserPlusIcon className="h-5 w-5" />,
        },
        {
            to: '/schematic',
            label: 'Schematic',
            icon: <CalendarDaysIcon className="h-5 w-5" />,
        },
        {
            to: '/session-planning',
            label: 'Session Planning',
            icon: <ArrowsRightLeftIcon className="h-5 w-5" />,
        },
        {
            to: '/report-cards',
            label: 'Report Cards',
            icon: <ClipboardDocumentListIcon className="h-5 w-5" />,
        },
        {
            to: '/staff-notes',
            label: 'Notes',
            icon: <DocumentTextIcon className="h-5 w-5" />,
        },
        {
            to: '/full-timer-tools',
            label: 'Full Timer Tools',
            icon: <ClockIcon className="h-5 w-5" />,
        },
        {
            to: '/team',
            label: 'Team',
            icon: <UserGroupIcon className="h-5 w-5" />,
        },
        {
            to: '/account',
            label: 'Account',
            icon: <UserCircleIcon className="h-5 w-5" />,
        },
    ]

    const navItems = accountType === 'full_time' ? fullTimeNavItems : standardNavItems

    if (isPlannerPopout) {
        return (
            <div className="flex h-screen overflow-hidden bg-bg">
                <main className="flex min-h-0 flex-1 overflow-y-auto p-6">
                    {children}
                </main>

                {needsProfile ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-md rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-lg">
                            <h2 className="text-lg font-semibold">Complete your profile</h2>
                            <p className="mt-2 text-sm text-secondary/70">
                                Add your first and last name so full-time users can invite you to teams.
                            </p>
                            <div className="mt-4 flex flex-col gap-3">
                                <input
                                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                    placeholder="First name"
                                    value={profileFirstName}
                                    onChange={event => setProfileFirstName(event.target.value)}
                                />
                                <input
                                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                    placeholder="Last name"
                                    value={profileLastName}
                                    onChange={event => setProfileLastName(event.target.value)}
                                />
                                {profileError ? (
                                    <p className="text-sm font-semibold text-danger">{profileError}</p>
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                                        onClick={async () => {
                                            const trimmedFirst = profileFirstName.trim()
                                            const trimmedLast = profileLastName.trim()
                                            if (!trimmedFirst || !trimmedLast) {
                                                setProfileError('Please enter your first and last name.')
                                                return
                                            }
                                            setProfileError('')
                                            await completeProfile(trimmedFirst, trimmedLast)
                                        }}
                                    >
                                        Save Profile
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-2xl border border-secondary/40 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
                                        onClick={() => void signOut()}
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <div className="flex h-screen overflow-hidden">
            <aside
                className={`flex h-screen shrink-0 flex-col gap-6 overflow-y-auto bg-primary px-6 pt-6 pb-6 text-accent transition-[width] duration-300 ${isSidebarCollapsed ? 'w-[84px]' : 'w-72'
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
                        <h3 className="text-[0.95rem] font-semibold">
                            {accountType === 'full_time' ? 'Current Session Term' : 'Current Session'}
                        </h3>
                        <div className="w-full rounded-2xl border border-secondary/30 bg-accent px-4 py-2 text-sm text-secondary">
                            {currentSessionName || (accountType === 'full_time' ? 'No term selected' : 'No session selected')}
                        </div>
                    </div>
                )}

                {!isSidebarCollapsed && accountType === 'full_time' && (
                    <div className="flex flex-col gap-2">
                        <h3 className="text-[0.95rem] font-semibold">Current Team</h3>
                        <div className="w-full rounded-2xl border border-secondary/30 bg-accent px-4 py-2 text-sm text-secondary">
                            {currentTeam?.name || (teamLoading ? 'Loading teams...' : 'No team selected')}
                        </div>
                    </div>
                )}


                {!isSidebarCollapsed && (
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            className="flex h-12 items-center justify-center rounded-[10px] border border-dashed border-white/50 bg-white/10 px-2 text-center text-sm font-medium text-accent transition hover:-translate-y-0.5 hover:bg-hover"
                            onClick={() => requestCsvFile()}
                        >
                            Upload Roster
                        </button>
                    </div>
                )}

                <nav className="flex flex-col gap-3">
                    {navItems.map(item => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`${navBaseClasses} ${navCollapsedClasses} ${isCurrentPage(item.to) ? navCurrentClasses : navHoverClasses
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


                {!isSidebarCollapsed && (
                    <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-primary px-3 py-3 ">
                        <h3 className="text-[0.95rem] font-semibold">Account</h3>
                        <div className="rounded-2xl border border-secondary/30 bg-accent px-4 py-2 text-sm text-secondary">
                            <p className="font-semibold">{displayName}</p>
                            <p className="text-xs uppercase tracking-wide text-secondary/70">{accountLabel}</p>
                        </div>
                        {isGuest ? (
                            <Link
                                to="/sign-in"
                                className="rounded-2xl bg-secondary px-3 py-2 text-center text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                            >
                                Sign In
                            </Link>
                        ) : (
                            <button
                                type="button"
                                className="rounded-2xl border border-secondary/40 px-3 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent"
                                onClick={() => void signOut()}
                            >
                                Sign Out
                            </button>
                        )}
                    </div>
                )}

            </aside>

            <main className="flex min-h-0 flex-1 overflow-y-auto p-8">
                {children}
            </main>

            {needsProfile ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-lg">
                        <h2 className="text-lg font-semibold">Complete your profile</h2>
                        <p className="mt-2 text-sm text-secondary/70">
                            Add your first and last name so full-time users can invite you to teams.
                        </p>
                        <div className="mt-4 flex flex-col gap-3">
                            <input
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                placeholder="First name"
                                value={profileFirstName}
                                onChange={event => setProfileFirstName(event.target.value)}
                            />
                            <input
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                placeholder="Last name"
                                value={profileLastName}
                                onChange={event => setProfileLastName(event.target.value)}
                            />
                            {profileError ? (
                                <p className="text-sm font-semibold text-danger">{profileError}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <button
                                    type="button"
                                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                                    onClick={async () => {
                                        const trimmedFirst = profileFirstName.trim()
                                        const trimmedLast = profileLastName.trim()
                                        if (!trimmedFirst || !trimmedLast) {
                                            setProfileError('Please enter your first and last name.')
                                            return
                                        }
                                        setProfileError('')
                                        await completeProfile(trimmedFirst, trimmedLast)
                                    }}
                                >
                                    Save Profile
                                </button>
                                <button
                                    type="button"
                                    className="rounded-2xl border border-secondary/40 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
                                    onClick={() => void signOut()}
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function getPageTitle(pathname: string) {
    switch (pathname) {
        case '/': return 'Home'
        case '/requests': return 'Requests'
        case '/manage-sessions': return 'Manage Sessions'
        case '/rosters': return 'Class Rosters'
        case '/schematic': return 'Class Schedule'
        case '/print': return 'Print'
        case '/session-planning': return 'Session Planning'
        case '/report-cards': return 'Report Cards'
        case '/staff-notes': return 'Notes'
        case '/full-timer-tools': return 'Full Timer Tools'
        default: return 'DeckSupervisor.ca'
    }
}

export default Layout
