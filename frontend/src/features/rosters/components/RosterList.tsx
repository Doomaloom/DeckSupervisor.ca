import React from 'react'
import type { RosterListItem } from '../types'
import RosterCard from './RosterCard'

type RosterListProps = {
    rosters: RosterListItem[]
    emptyMessage: string
    instructorOptions: string[]
    onPrintRoster: (roster: RosterListItem['roster']) => void
    onRosterInstructorChange: (code: string, instructor: string) => void
    onRosterLevelChange: (code: string, level: string) => void
    onCustomRosterInstructorChange: (id: string, instructor: string) => void
    onCustomRosterLevelChange: (id: string, level: string) => void
    onStudentInstructorChange: (studentId: string, instructor: string) => void
    onStudentLevelChange: (studentId: string, level: string) => void
}

function RosterList({
    rosters,
    emptyMessage,
    instructorOptions,
    onPrintRoster,
    onRosterInstructorChange,
    onRosterLevelChange,
    onCustomRosterInstructorChange,
    onCustomRosterLevelChange,
    onStudentInstructorChange,
    onStudentLevelChange,
}: RosterListProps) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-6">
                {rosters.length === 0 && <p className="text-secondary">{emptyMessage}</p>}
                {rosters.map(item => (
                    <RosterCard
                        key={item.roster.code}
                        roster={item.roster}
                        instructorOptions={instructorOptions}
                        isCustom={item.isCustom}
                        onPrint={onPrintRoster}
                        onRosterInstructorChange={onRosterInstructorChange}
                        onRosterLevelChange={onRosterLevelChange}
                        onCustomRosterInstructorChange={onCustomRosterInstructorChange}
                        onCustomRosterLevelChange={onCustomRosterLevelChange}
                        onStudentInstructorChange={onStudentInstructorChange}
                        onStudentLevelChange={onStudentLevelChange}
                    />
                ))}
            </div>
        </div>
    )
}

export default RosterList
