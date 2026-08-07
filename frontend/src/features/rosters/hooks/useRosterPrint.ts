import { useState } from 'react'
import { openAttendancePrintWindow } from '../../attendance-print/openAttendancePrintWindow'
import { buildAttendancePrintItems } from '../utils'
import { useCurrentSession } from '../../../app/useCurrentSession'
import { formatSessionDisplayName } from '../../../shared/session/sessionLabels'
import type { RosterGroup } from '../types'

export function useRosterPrint() {
    const { session: currentSession } = useCurrentSession()
    const [blockedPrintJob, setBlockedPrintJob] = useState<{
        jobLabel: string
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
        const printWindow = openAttendancePrintWindow('Attendance Roster')
        if (!printWindow) {
            setBlockedPrintJob({ jobLabel: `Attendance - ${roster.serviceName || roster.code || 'Roster'}`, roster })
            return
        }

        try {
            const { printAttendanceHtml } = await import('../../attendance-print/printAttendanceHtml')
            const jobLabel = `Attendance - ${roster.serviceName || roster.code || 'Roster'}`
            const result = await printAttendanceHtml({
                session: sessionName,
                rosters,
                title: jobLabel,
            }, printWindow)
            if (result.status === 'failed') throw result.error
        } catch (error) {
            console.error(error)
            alert('Unable to prepare attendance sheets. Please try again.')
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
