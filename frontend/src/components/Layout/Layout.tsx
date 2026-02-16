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
} from '@heroicons/react/24/outline'
import { useDay } from '../../app/DayContext'
import { useAuth } from '../../app/AuthContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import { processCsvAndStore } from '../../lib/api'
import { resolveCustomRosters } from '../../lib/customRostersApi'
import { getSessionTermLabel, syncReportCardsForDay } from '../../lib/reportCardSync'
import { onStorageScopeChanged } from '../../lib/storageScope'
import {
    getCustomRosterDayKey,
    getCustomRostersForDay,
    getInstructorsForDay,
    getStudentsForDay,
    setCustomRostersForDay,
} from '../../lib/storage'
import type { InstructorEntry } from '../../types/app'

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
    const { accountType, completeProfile, isGuest, needsProfile, profile, session, signOut, user } = useAuth()
    const { access, session: currentSession } = useCurrentSession()
    const { currentTeam, loading: teamLoading } = useCurrentTeam()
    const { currentTerm } = useCurrentTerm()
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [scopeVersion, setScopeVersion] = useState(0)
    const [profileFirstName, setProfileFirstName] = useState('')
    const [profileLastName, setProfileLastName] = useState('')
    const [profileError, setProfileError] = useState('')

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
        document.title = pageTitle === 'COB Aquatics' ? pageTitle : `${pageTitle} | COB Aquatics`
    }, [pageTitle])

    useEffect(() => {
        return onStorageScopeChanged(() => {
            setScopeVersion(version => version + 1)
        })
    }, [])

    useEffect(() => {
        const accessToken = session?.access_token
        const sessionId = currentSession?.id
        if (!selectedDay || !accessToken || !user || !sessionId) {
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
                const resolved = await resolveCustomRosters(selectedDay, sessionId, students, accessToken)
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
    }, [currentSession?.id, selectedDay, session?.access_token, user, scopeVersion])

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
                                        const instructorConfig = getInstructorsForDay(selectedDay)
                                        const uploadInstructors: InstructorEntry[] = []
                                        if (instructorConfig) {
                                            const count = Math.max(
                                                instructorConfig.names.length,
                                                instructorConfig.codes.length,
                                            )
                                            for (let index = 0; index < count; index += 1) {
                                                const name = (instructorConfig.names[index] ?? '').trim()
                                                const codes = (instructorConfig.codes[index] ?? '').trim()
                                                if (!name || !codes) {
                                                    continue
                                                }
                                                uploadInstructors.push({ name, codes })
                                            }
                                        }
                                        await processCsvAndStore(uploaded, selectedDay, uploadInstructors)

                                        const canSyncReportCards =
                                            accountType !== 'full_time' &&
                                            !isGuest &&
                                            Boolean(user?.id) &&
                                            access.mode === 'owner' &&
                                            Boolean(currentSession)

                                        if (!canSyncReportCards || !currentSession || !user?.id) {
                                            alert('Roster uploaded. You can view it in Rosters or Schematic.')
                                            return
                                        }

                                        const sessionLabel = getSessionTermLabel(
                                            currentSession.session_season,
                                            currentSession.session_year,
                                            currentSession.start_date,
                                        )

                                        if (!sessionLabel) {
                                            alert(
                                                'Roster uploaded. Report card totals were not synced because this session term is incomplete.',
                                            )
                                            return
                                        }

                                        const dayStudents = getStudentsForDay(selectedDay)
                                        const syncResult = await syncReportCardsForDay({
                                            day: selectedDay,
                                            students: dayStudents,
                                            sessionLabel,
                                            teamId: currentSession.team_id ?? null,
                                            userId: user.id,
                                        })

                                        if (syncResult.status === 'blocked_unassigned') {
                                            alert(
                                                'Roster uploaded. Report card totals were not synced because some students are missing instructor assignments. Assign instructors in Schematic and save, then return to Report Cards.',
                                            )
                                            return
                                        }

                                        alert('Roster uploaded and report card totals synced for the selected day.')
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
                    <div className="flex flex-col gap-2 sticky bottom-0 mt-auto">
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
        case '/report-cards': return 'Report Cards'
        case '/staff-notes': return 'Notes'
        case '/full-timer-tools': return 'Full Timer Tools'
        default: return 'COB Aquatics'
    }
}

export default Layout
