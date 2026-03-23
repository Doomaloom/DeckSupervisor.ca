import type { RosterGroup } from '../types'
import { sanitizeLevel } from '../utils'
import { useCurrentSession } from '../../../app/useCurrentSession'
import { formatSessionDisplayName } from '../../../shared/session/sessionLabels'

function getSessionName(sessionDay: string, sessionSeason: string | null, startDate: string | null) {
    return formatSessionDisplayName({
        sessionDay,
        sessionSeason,
        startDate,
        fallback: '',
    })
}

function openPdfPrintDialog(pdfBlob: Blob, existingWindow?: Window | null) {
    const blobUrl = window.URL.createObjectURL(pdfBlob)
    const printWindow = existingWindow ?? window.open(blobUrl, '_blank')

    if (!printWindow) {
        window.URL.revokeObjectURL(blobUrl)
        alert('Pop-up blocked. Please allow pop-ups to print.')
        return
    }

    if (existingWindow) {
        printWindow.location.href = blobUrl
    }

    const cleanup = () => {
        window.URL.revokeObjectURL(blobUrl)
    }

    printWindow.addEventListener('beforeunload', cleanup, { once: true })

    const triggerPrint = () => {
        printWindow.focus()
        printWindow.print()
    }

    printWindow.onload = () => {
        setTimeout(triggerPrint, 1000)
    }

    setTimeout(triggerPrint, 3000)
}

export function useRosterPrint() {
    const { session: currentSession } = useCurrentSession()
    const handlePrintRoster = async (roster: RosterGroup) => {
        const template = sanitizeLevel(roster.level)
        const sessionName = currentSession
            ? getSessionName(
                  currentSession.session_day,
                  currentSession.session_season ?? null,
                  currentSession.start_date ?? null,
              )
            : 'Summer 2025'
        const printWindow = window.open('', '_blank')
        if (!printWindow) {
            alert('Pop-up blocked. Please allow pop-ups to print.')
            return
        }
        printWindow.document.write('<p style="font-family: sans-serif;">Preparing PDF...</p>')

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
            openPdfPrintDialog(pdfBlob, printWindow)
        } catch (error) {
            console.error(error)
            alert('Unable to generate attendance PDF. Please try again.')
            printWindow.close()
        }
    }

    return {
        handlePrintRoster,
    }
}
