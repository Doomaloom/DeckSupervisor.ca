import React from 'react'
import type { RosterListItem } from '../types'
import RosterCard from './RosterCard'

type RosterListProps = {
    rosters: RosterListItem[]
    emptyMessage: string
    onPrintRoster: (roster: RosterListItem['roster']) => void
    onRosterLevelChange: (code: string, level: string) => void
    onCustomRosterLevelChange: (id: string, level: string) => void
    onStudentLevelChange: (studentId: string, level: string) => void
    studentLevelEditMap: Record<string, boolean>
    onToggleStudentLevelEdits: (code: string) => void
}

function RosterList({
    rosters,
    emptyMessage,
    onPrintRoster,
    onRosterLevelChange,
    onCustomRosterLevelChange,
    onStudentLevelChange,
    studentLevelEditMap,
    onToggleStudentLevelEdits,
}: RosterListProps) {
    return (
        <div id="roster-list" data-component="roster-list" className="flex flex-col gap-4">
            <div data-component="roster-list-content" className="flex flex-col gap-6">
                {rosters.length === 0 && <p className="text-secondary">{emptyMessage}</p>}
                {rosters.map(item => (
                    <RosterCard
                        key={item.roster.code}
                        roster={item.roster}
                        isCustom={item.isCustom}
                        onPrint={onPrintRoster}
                        onRosterLevelChange={onRosterLevelChange}
                        onCustomRosterLevelChange={onCustomRosterLevelChange}
                        onStudentLevelChange={onStudentLevelChange}
                        allowStudentLevelEdits={Boolean(studentLevelEditMap[item.roster.code])}
                        onToggleStudentLevelEdits={() => onToggleStudentLevelEdits(item.roster.code)}
                    />
                ))}
            </div>
        </div>
    )
}

export default RosterList
