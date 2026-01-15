import React, { useState } from 'react'
import { useDay } from '../../app/DayContext'
import CustomRostersPanel from './components/CustomRostersPanel'
import RosterFiltersBar from './components/RosterFiltersBar'
import RosterList from './components/RosterList'
import RostersTabs from './components/RostersTabs'
import { useRosterData } from './hooks/useRosterData'
import { useRosterEdits } from './hooks/useRosterEdits'
import { useRosterFilters } from './hooks/useRosterFilters'
import { useRosterPrint } from './hooks/useRosterPrint'
import { getEmptyMessage } from './utils'

function RostersPage() {
    const { selectedDay } = useDay()
    const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default')
    const { students, setStudents, rosters, instructorOptions, levelOptions } = useRosterData(selectedDay ?? '')
    const {
        instructorFilter,
        setInstructorFilter,
        levelFilter,
        setLevelFilter,
        searchQuery,
        setSearchQuery,
        filteredRosters,
    } = useRosterFilters(rosters)
    const {
        handleRosterInstructorChange,
        handleRosterLevelChange,
        handleStudentInstructorChange,
        handleStudentLevelChange,
    } = useRosterEdits({
        selectedDay: selectedDay ?? '',
        students,
        setStudents,
    })
    const { handlePrintRoster } = useRosterPrint()
    const emptyMessage = getEmptyMessage(students.length)

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <RostersTabs activeTab={activeTab} onChange={setActiveTab} />
            <div className="flex flex-col gap-6">
                {activeTab === 'custom' ? (
                    <CustomRostersPanel />
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
                            onStudentInstructorChange={handleStudentInstructorChange}
                            onStudentLevelChange={handleStudentLevelChange}
                        />
                    </>
                )}
            </div>
        </div>
    )
}

export default RostersPage
