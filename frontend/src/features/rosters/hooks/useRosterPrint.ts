import type { RosterGroup } from '../types'
import { sanitizeLevel } from '../utils'

export function useRosterPrint() {
    const handlePrintRoster = async (roster: RosterGroup) => {
        const level = sanitizeLevel(roster.level)
        const levelUrl = `/swimming attendance/${level}.html`
        const fallbackUrl = `/swimming attendance/SplashFitness.html`

        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        document.body.appendChild(iframe)

        try {
            const res = await fetch(levelUrl, { method: 'HEAD' })
            iframe.src = res.ok ? levelUrl : fallbackUrl
        } catch (error) {
            iframe.src = fallbackUrl
        }

        iframe.onload = () => {
            const doc = iframe.contentDocument || iframe.contentWindow?.document
            if (!doc) {
                document.body.removeChild(iframe)
                return
            }

            const startDate = roster.schedule?.split(' ')[1] ?? ''
            doc.getElementById('instructor')!.textContent = roster.instructor
            doc.getElementById('start_time')!.textContent = `${startDate} ${roster.time}`.trim()
            doc.getElementById('session')!.textContent = 'Summer 2025'
            doc.getElementById('location')!.textContent = roster.location
            doc.getElementById('barcode')!.textContent = roster.code

            const templateRow = doc.getElementById('student-rows')
            const totalColumns = templateRow?.children.length ?? 1
            const emptyCells = Math.max(totalColumns - 1, 0)

            roster.students.forEach((student, index) => {
                const row = doc.createElement('tr')
                row.innerHTML = `
          <td><strong style="font-family: Arial;">${index + 1}. ${student.name}</strong>
            <font size="2"><br><span style="text-decoration: underline;">A</span>bsent/<span style="text-decoration: underline;">P</span>resent<br>
            <span style="color: rgb(191, 191, 191);">[Day 1] [Day 2] [Day 3] [Day 4] [Day 5] [Day 6] [Day 7] [Day 8] [Day 9] [Day 10] [Day 11] [Day 12] [Day 13] [Day 14]</span></font>
          </td>
          ${'<td>&nbsp;</td>'.repeat(emptyCells)}
        `
                doc.getElementById('attendance-rows')?.appendChild(row)
            })

            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
            setTimeout(() => document.body.removeChild(iframe), 1000)
        }
    }

    const handlePrintAll = (rosters: RosterGroup[]) => {
        rosters.forEach(roster => handlePrintRoster(roster))
    }

    return {
        handlePrintRoster,
        handlePrintAll,
    }
}
