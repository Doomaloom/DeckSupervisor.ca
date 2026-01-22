import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDay } from '../../app/DayContext'
import { extractStartTime } from '../../lib/time'
import { prefetchInstructorPacket } from '../../lib/instructorPdfCache'
import CustomRostersPanel from './components/CustomRostersPanel'
import RosterFiltersBar from './components/RosterFiltersBar'
import RosterList from './components/RosterList'
import RostersTabs from './components/RostersTabs'
import { useCustomRosters } from './hooks/useCustomRosters'
import { useRosterData } from './hooks/useRosterData'
import { useRosterEdits } from './hooks/useRosterEdits'
import { useRosterFilters } from './hooks/useRosterFilters'
import { useRosterPrint } from './hooks/useRosterPrint'
import { buildCustomRosterGroups, getEmptyMessage } from './utils'
import type { RosterListItem } from './types'

function RostersPage() {
    const { selectedDay } = useDay()
    const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default')
    const [studentLevelEditMap, setStudentLevelEditMap] = useState<Record<string, boolean>>({})
    const { students, setStudents, rosters, instructorOptions } = useRosterData(selectedDay ?? '')
    const { customRosters, saveCustomRosters, updateCustomRosterInstructor, updateCustomRosterLevel } =
        useCustomRosters(selectedDay ?? '')
    const customRosterGroups = useMemo(() => {
        const rosterByCode = new Map(rosters.map(roster => [roster.code, roster]))
        const studentsById = new Map(students.map(student => [student.id, student]))
        return buildCustomRosterGroups(customRosters, rosterByCode, studentsById)
    }, [customRosters, rosters, students])
    const rosterItems = useMemo<RosterListItem[]>(
        () => [
            ...rosters.map(roster => ({ roster, isCustom: false })),
            ...customRosterGroups.map(roster => ({ roster, isCustom: true })),
        ],
        [rosters, customRosterGroups],
    )
    const sortedRosterItems = useMemo(() => {
        return [...rosterItems].sort((a, b) => {
            const timeA = extractStartTime(a.roster.time)
            const timeB = extractStartTime(b.roster.time)
            if (timeA !== timeB) {
                return timeA.localeCompare(timeB)
            }
            return a.roster.serviceName.localeCompare(b.roster.serviceName, 'en', { sensitivity: 'base' })
        })
    }, [rosterItems])
    const levelOptions = useMemo(() => {
        const levels = new Set<string>()
        rosterItems.forEach(item => {
            if (item.roster.level) {
                levels.add(item.roster.level)
            }
        })
        return Array.from(levels).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    }, [rosterItems])
    const {
        instructorFilter,
        setInstructorFilter,
        levelFilter,
        setLevelFilter,
        searchQuery,
        setSearchQuery,
        filteredRosters,
    } = useRosterFilters(sortedRosterItems)
    const {
        handleRosterInstructorChange,
        handleRosterLevelChange,
        handleStudentLevelChange,
    } = useRosterEdits({
        selectedDay: selectedDay ?? '',
        students,
        setStudents,
    })
    const { handlePrintRoster } = useRosterPrint()
    const emptyMessage = getEmptyMessage(students.length)
    const handleToggleStudentLevelEdits = (code: string) => {
        setStudentLevelEditMap(current => ({
            ...current,
            [code]: !current[code],
        }))
    }
    const selectedDayRef = useRef(selectedDay)

    useEffect(() => {
        selectedDayRef.current = selectedDay
    }, [selectedDay])

    useEffect(() => {
        return () => {
            const day = selectedDayRef.current
            if (day) {
                void prefetchInstructorPacket(day)
            }
        }
    }, [])

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <RostersTabs activeTab={activeTab} onChange={setActiveTab} />
            <div className="flex flex-col gap-6">
                {activeTab === 'custom' ? (
                    <CustomRostersPanel
                        rosters={rosters}
                        instructorOptions={instructorOptions}
                        customRosters={customRosters}
                        onSave={saveCustomRosters}
                    />
                ) : (
                    <>
                        <RosterFiltersBar
                            instructorOptions={instructorOptions}
                            levelOptions={levelOptions}
                            instructorFilter={instructorFilter}
                            levelFilter={levelFilter}
                            searchQuery={searchQuery}
                            onInstructorFilterChange={setInstructorFilter}
                            onLevelFilterChange={setLevelFilter}
                            onSearchChange={setSearchQuery}
                        />
                        <RosterList
                            rosters={filteredRosters}
                            emptyMessage={emptyMessage}
                            instructorOptions={instructorOptions}
                            onPrintRoster={handlePrintRoster}
                            onRosterInstructorChange={handleRosterInstructorChange}
                            onRosterLevelChange={handleRosterLevelChange}
                            onCustomRosterInstructorChange={updateCustomRosterInstructor}
                            onCustomRosterLevelChange={updateCustomRosterLevel}
                            onStudentLevelChange={handleStudentLevelChange}
                            studentLevelEditMap={studentLevelEditMap}
                            onToggleStudentLevelEdits={handleToggleStudentLevelEdits}
                        />
                    </>
                )}
            </div>
        </div>
    )
}

export default RostersPage
