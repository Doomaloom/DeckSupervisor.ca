import { useState } from 'react'
import { openPdfPrintDialog, openPrintWindow } from '../../../lib/browserPrint'
import { buildAttendancePrintItems } from '../utils'
import { useCurrentSession } from '../../../app/useCurrentSession'
import { formatSessionDisplayName } from '../../../shared/session/sessionLabels'
import type { RosterGroup } from '../types'

function toFileToken(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function buildRosterFilename(roster: RosterGroup) {
    const parts = [roster.code, roster.serviceName, roster.time].filter(Boolean).map(toFileToken).filter(Boolean)
    return `${parts.join('-') || 'attendance-roster'}.pdf`
}

export function useRosterPrint() {
    const { session: currentSession } = useCurrentSession()
    const [blockedPrintJob, setBlockedPrintJob] = useState<{
        jobLabel: string
        filename: string
        pdfBlob: Blob
        roster: RosterGroup
    } | null>(null)

    const handlePrintRoster = async (roster: RosterGroup) => {
        setBlockedPrintJob(null)
        const rosters = buildAttendancePrintItems(roster)
        const sessionName = formatSessionDisplayName({
            sessionDay: currentSession?.session_day,
            includeDay: false,
            sessionSeason: currentSession?.session_season ?? null,
            sessionYear: currentSession?.session_year ?? null,
            startDate: currentSession?.start_date ?? null,
            sessionStartTime24: currentSession?.session_start_time24 ?? null,
            sessionEndTime24: currentSession?.session_end_time24 ?? null,
            fallback: 'Session',
        })
        const printWindow = openPrintWindow('Attendance Roster')

        try {
            const response = await fetch('/api/attendance-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session: sessionName,
                    rosters,
                    title: `Attendance - ${roster.serviceName || roster.code || 'Roster'}`,
                }),
            })

            if (!response.ok) {
                const message = await response.text()
                throw new Error(message || 'Failed to generate attendance PDF')
            }

            const pdfBlob = await response.blob()
            const jobLabel = `Attendance - ${roster.serviceName || roster.code || 'Roster'}`
            const filename = buildRosterFilename(roster)
            if (printWindow) {
                const opened = openPdfPrintDialog(pdfBlob, printWindow, {
                    title: jobLabel,
                    filename,
                })
                if (opened) {
                    return
                }
            }

            setBlockedPrintJob({
                jobLabel,
                filename,
                pdfBlob,
                roster,
            })
        } catch (error) {
            console.error(error)
            alert('Unable to generate attendance PDF. Please try again.')
            printWindow?.close()
        }
    }

    return {
        blockedPrintJob,
        clearBlockedPrintJob: () => setBlockedPrintJob(null),
        handlePrintRoster,
        retryBlockedPrint: () => {
            if (!blockedPrintJob) {
                return
            }
            void handlePrintRoster(blockedPrintJob.roster)
        },
    }
}
