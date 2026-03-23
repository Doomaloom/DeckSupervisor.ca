import { getStoredItem, setStoredItem } from '../../lib/browserStorage'
import type { FullTimeInstructorAssignments, FullTimeRequestEntry } from './types'
import { normalizeInstructorAssignments, normalizeRequestEntries } from './fullTimePlanning'

function getStorageScopeKey(teamId: string, termKey: string) {
    return `${teamId}:${termKey || 'no-term'}`
}

export function getFullTimeInstructorAssignmentsStorageKey(teamId: string, termKey: string) {
    return `cob:full-time-instructor-assignments:${getStorageScopeKey(teamId, termKey)}`
}

export function getFullTimeRequestListStorageKey(teamId: string, termKey: string) {
    return `cob:full-time-request-list:${getStorageScopeKey(teamId, termKey)}`
}

export function loadFullTimeInstructorAssignments(teamId: string, termKey: string): FullTimeInstructorAssignments {
    try {
        const stored = getStoredItem(getFullTimeInstructorAssignmentsStorageKey(teamId, termKey))
        return stored ? normalizeInstructorAssignments(JSON.parse(stored)) : {}
    } catch (error) {
        console.error('Failed to load full-time instructor assignments', error)
        return {}
    }
}

export function saveFullTimeInstructorAssignments(
    teamId: string,
    termKey: string,
    assignments: FullTimeInstructorAssignments,
) {
    setStoredItem(
        getFullTimeInstructorAssignmentsStorageKey(teamId, termKey),
        JSON.stringify(assignments),
    )
}

export function loadFullTimeRequestEntries(teamId: string, termKey: string): FullTimeRequestEntry[] {
    try {
        const stored = getStoredItem(getFullTimeRequestListStorageKey(teamId, termKey))
        return stored ? normalizeRequestEntries(JSON.parse(stored)) : []
    } catch (error) {
        console.error('Failed to load full-time request list', error)
        return []
    }
}

export function saveFullTimeRequestEntries(
    teamId: string,
    termKey: string,
    entries: FullTimeRequestEntry[],
) {
    setStoredItem(
        getFullTimeRequestListStorageKey(teamId, termKey),
        JSON.stringify(entries),
    )
}
