import { useMemo, useState } from 'react'
import type { RosterGroup } from '../types'
import { filterRosters } from '../utils'

export function useRosterFilters(rosters: RosterGroup[]) {
    const [instructorFilter, setInstructorFilter] = useState('')
    const [levelFilter, setLevelFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    const filteredRosters = useMemo(
        () => filterRosters(rosters, instructorFilter, levelFilter, searchQuery),
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
