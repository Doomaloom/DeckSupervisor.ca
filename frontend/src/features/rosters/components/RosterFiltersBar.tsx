import React from 'react'
import { inputClass, rowWidthClass, selectClass } from '../constants'

type RosterFiltersBarProps = {
    instructorOptions: string[]
    levelOptions: string[]
    instructorFilter: string
    levelFilter: string
    searchQuery: string
    onInstructorFilterChange: (value: string) => void
    onLevelFilterChange: (value: string) => void
    onSearchChange: (value: string) => void
}

function RosterFiltersBar({
    instructorOptions,
    levelOptions,
    instructorFilter,
    levelFilter,
    searchQuery,
    onInstructorFilterChange,
    onLevelFilterChange,
    onSearchChange,
}: RosterFiltersBarProps) {
    return (
        <div className={`grid gap-3 md:grid-cols-3 ${rowWidthClass}`}>
            <select
                className={selectClass}
                value={instructorFilter}
                onChange={event => onInstructorFilterChange(event.target.value)}
            >
                <option value="">Filter Classes by Instructor</option>
                {instructorOptions.map(instructor => (
                    <option key={instructor} value={instructor}>
                        {instructor}
                    </option>
                ))}
            </select>
            <select
                className={selectClass}
                value={levelFilter}
                onChange={event => onLevelFilterChange(event.target.value)}
            >
                <option value="">Filter Classes by Level</option>
                {levelOptions.map(level => (
                    <option key={level} value={level}>
                        {level}
                    </option>
                ))}
            </select>
            <input
                className={inputClass}
                type="text"
                placeholder="Search student or course code"
                value={searchQuery}
                onChange={event => onSearchChange(event.target.value)}
            />
        </div>
    )
}

export default RosterFiltersBar
