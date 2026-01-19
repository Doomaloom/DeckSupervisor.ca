import type { RosterGroup } from '../types'
import { sanitizeLevel } from '../utils'

const SESSIONS_STORAGE_KEY = 'decksupervisor.sessions'
const CURRENT_SESSION_KEY = 'decksupervisor.currentSessionId'

type SessionEntry = {
    id: string
    sessionDay: string
    sessionSeason: string
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
    const year = session.startDate ? new Date(session.startDate).getFullYear() : NaN
    const yearLabel = Number.isFinite(year) && year > 0 ? String(year) : ''
    const parts = [dayLabel, season, yearLabel].filter(Boolean)
    return parts.length ? parts.join(' ') : ''
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

export function useRosterPrint() {
    const handlePrintRoster = async (roster: RosterGroup) => {
        const template = sanitizeLevel(roster.level)
        const sessionName = getCurrentSessionName() || 'Summer 2025'

        try {
            const response = await fetch('/api/attendance-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    template,
                    session: sessionName,
                    roster: {
                        code: roster.code,
                        level: roster.level,
                        serviceName: roster.serviceName,
                        time: roster.time,
                        instructor: roster.instructor,
                        location: roster.location,
                        schedule: roster.schedule,
                        students: roster.students.map(student => ({
                            name: student.name,
                        })),
                    },
                }),
            })

            if (!response.ok) {
                const message = await response.text()
                throw new Error(message || 'Failed to generate attendance PDF')
            }

            const pdfBlob = await response.blob()
            const blobUrl = window.URL.createObjectURL(pdfBlob)
            const iframe = document.createElement('iframe')
            iframe.style.display = 'none'
            iframe.src = blobUrl
            document.body.appendChild(iframe)

            iframe.onload = () => {
                iframe.contentWindow?.focus()
                iframe.contentWindow?.print()
                setTimeout(() => {
                    window.URL.revokeObjectURL(blobUrl)
                    document.body.removeChild(iframe)
                }, 1000)
            }
        } catch (error) {
            console.error(error)
            alert('Unable to generate attendance PDF. Please try again.')
        }
    }

    return {
        handlePrintRoster,
    }
}
