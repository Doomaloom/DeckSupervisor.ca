import React from 'react'
import type { RosterGroup } from '../types'
import LevelSelect from './LevelSelect'
import StudentRow from './StudentRow'

type RosterCardProps = {
    roster: RosterGroup
    isCustom?: boolean
    onPrint: (roster: RosterGroup) => void
    onRosterLevelChange: (code: string, level: string) => void
    onCustomRosterLevelChange?: (id: string, level: string) => void
    onStudentLevelChange: (studentId: string, level: string) => void
    allowStudentLevelEdits: boolean
    onToggleStudentLevelEdits: () => void
}

function RosterCard({
    roster,
    isCustom = false,
    onPrint,
    onRosterLevelChange,
    onCustomRosterLevelChange,
    onStudentLevelChange,
    allowStudentLevelEdits,
    onToggleStudentLevelEdits,
}: RosterCardProps) {
    const containerClass = isCustom
        ? 'rounded-2xl border-2 border-blue-200 bg-blue-100 p-6 shadow-md'
        : 'rounded-2xl border-2 border-secondary/20 bg-accent p-6 shadow-md'
    const isReadOnly = isCustom
    const customId = roster.customRosterId ?? roster.code.replace(/^custom-/, '')

    const actionButtonClass =
        'rounded-lg bg-primary px-3 py-1 text-white transition hover:-translate-y-0.5 hover:bg-secondary'
    const toggleButtonClass = `${actionButtonClass} ${allowStudentLevelEdits ? 'ring-2 ring-accent/70' : ''}`

    return (
        <div className={containerClass} id={roster.code} data-component="roster-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-secondary">
                    {roster.serviceName} : {roster.time}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className={toggleButtonClass}
                        onClick={onToggleStudentLevelEdits}
                        aria-pressed={allowStudentLevelEdits}
                    >
                        {allowStudentLevelEdits ? 'Individual Level' : 'Class Level'}
                    </button>
                    <button
                        type="button"
                        className={actionButtonClass}
                        onClick={() => onPrint(roster)}
                    >
                        Print
                    </button>
                </div>
            </div>
            <div className="mt-4 grid w-full grid-cols-1 gap-3">
                <p className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary">
                    Instructor: {roster.instructor || 'Unassigned'}
                </p>
                <LevelSelect
                    value={roster.level}
                    onChange={value => {
                        if (isCustom && customId && onCustomRosterLevelChange) {
                            onCustomRosterLevelChange(customId, value)
                            return
                        }
                        onRosterLevelChange(roster.code, value)
                    }}
                />
            </div>
            {roster.students.filter(student => !student.waitlist).map(student => (
                <StudentRow
                    key={student.id}
                    student={student}
                    onLevelChange={onStudentLevelChange}
                    disabled={isReadOnly || !allowStudentLevelEdits}
                />
            ))}
        </div>
    )
}

export default RosterCard
