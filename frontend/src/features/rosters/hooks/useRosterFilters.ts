import { useMemo, useState } from 'react'
import type { RosterListItem } from '../types'
import { filterRosterItems } from '../utils'

export function useRosterFilters(rosters: RosterListItem[]) {
    const [instructorFilter, setInstructorFilter] = useState('')
    const [levelFilter, setLevelFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    const filteredRosters = useMemo(
        () => filterRosterItems(rosters, instructorFilter, levelFilter, searchQuery),
        [rosters, instructorFilter, levelFilter, searchQuery],
    )

    return {
        instructorFilter,
        setInstructorFilter,
        levelFilter,
        setLevelFilter,
        searchQuery,
        setSearchQuery,
        filteredRosters,
    }
}
