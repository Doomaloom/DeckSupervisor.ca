import { extractStartTime } from '../../lib/time'
import type { CustomRoster, Student } from '../../types/app'
import type { RosterGroup, RosterListItem } from './types'

export function sanitizeLevel(level: string): string {
    if (!level) {
        return 'SplashFitness'
    }
    const normalized = level.trim()

    if (/private/i.test(normalized)) {
        return 'SplashPrivate'
    }

    if (/splash\s*fitness/i.test(normalized)) {
        return 'SplashFitness'
    }

    const teenMatch = normalized.match(/teen\s*\/?\s*adult\s*(\d+)/i)
    if (teenMatch?.[1]) {
        return `TeenAdult${teenMatch[1]}`
    }

    const littleMatch = normalized.match(/little\s*splash\s*(\d+)/i)
    if (littleMatch?.[1]) {
        return `LittleSplash${littleMatch[1]}`
    }

    const parentMatch = normalized.match(/parent\s*(?:and|&)\s*tot\s*(\d+)/i)
    if (parentMatch?.[1]) {
        return `ParentandTot${parentMatch[1]}`
    }

    const splashMatch = normalized.match(/splash\s*(\d+)([a-z])?/i)
    if (splashMatch?.[1]) {
        const suffix = splashMatch[2] ? splashMatch[2].toUpperCase() : ''
        return `Splash${splashMatch[1]}${suffix}`
    }

    let sanitized = normalized.replace(/^Swim\s*/i, '')
    sanitized = sanitized.replace(/&/g, 'and')
    sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '')

    if (sanitized.includes('Teen') || sanitized.includes('Adult')) {
        const parts = normalized.split(/[\s/]+/)
        sanitized = `TeenAdult${parts[2] ?? ''}`.trim()
    }
    if (sanitized.includes('Splash7')) return 'Splash7'
    if (sanitized.includes('Splash8')) return 'Splash8'
    if (sanitized.includes('Splash9')) return 'Splash9'
    return sanitized
}

export function buildRosterGroups(students: Student[]): RosterGroup[] {
    const classesMap = new Map<string, RosterGroup>()

    students.forEach(student => {
        const existing = classesMap.get(student.code)
        if (!existing) {
            classesMap.set(student.code, {
                code: student.code,
                serviceName: student.service_name,
                level: student.level || student.service_name,
                time: student.time,
                instructor: student.instructor ?? '',
                location: student.location,
                schedule: student.schedule,
                students: [student],
            })
        } else {
            if (!existing.instructor && student.instructor) {
                existing.instructor = student.instructor
            }
            existing.students.push(student)
        }
    })

    const sorted = Array.from(classesMap.values())
    sorted.forEach(group => {
        group.students.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    })

    sorted.sort((a, b) => {
        const timeA = extractStartTime(a.time)
        const timeB = extractStartTime(b.time)
        return timeA.localeCompare(timeB)
    })

    return sorted
}

export function buildCustomRosterGroups(
    customRosters: CustomRoster[],
    rosterByCode: Map<string, RosterGroup>,
    studentsById: Map<string, Student>,
): RosterGroup[] {
    return customRosters.map(customRoster => {
        const sourceRoster = customRoster.sourceCodes
            .map(code => rosterByCode.get(code))
            .find(Boolean)
        const students = customRoster.studentIds
            .map(id => studentsById.get(id))
            .filter(Boolean) as Student[]
        students.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
        return {
            code: `custom-${customRoster.id}`,
            customRosterId: customRoster.id,
            serviceName: customRoster.serviceName,
            level: customRoster.serviceName,
            time: sourceRoster?.time ?? '',
            instructor: customRoster.instructor ?? '',
            location: sourceRoster?.location ?? '',
            schedule: sourceRoster?.schedule ?? '',
            students,
        }
    })
}

export function filterRosterItems(
    rosters: RosterListItem[],
    instructorFilter: string,
    levelFilter: string,
    searchQuery: string,
) {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    return rosters.filter(item => {
        const roster = item.roster
        if (instructorFilter && roster.instructor !== instructorFilter) {
            return false
        }
        if (levelFilter && roster.level !== levelFilter) {
            return false
        }
        if (normalizedQuery) {
            const codeMatch = roster.code.toLowerCase().includes(normalizedQuery)
            const studentMatch = roster.students.some(student =>
                student.name.toLowerCase().includes(normalizedQuery),
            )
            if (!codeMatch && !studentMatch) {
                return false
            }
        }
        return true
    })
}

export function getEmptyMessage(studentsCount: number) {
    return studentsCount
        ? 'No rosters match the current filters.'
        : 'No rosters loaded. Upload a CSV file to see rosters.'
}

export function tabButtonClass(active: boolean) {
    return `flex-1 rounded-2xl px-4 py-2 font-semibold transition hover:-translate-y-0.5 ${active
            ? 'border-2 border-dashed border-secondary bg-accent text-secondary'
            : 'bg-secondary text-accent'
        }`
}
