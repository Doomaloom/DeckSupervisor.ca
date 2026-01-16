import React from 'react'
import type { RosterGroup } from '../types'
import InstructorSelect from './InstructorSelect'
import LevelSelect from './LevelSelect'
import StudentRow from './StudentRow'

type RosterCardProps = {
    roster: RosterGroup
    instructorOptions: string[]
    isCustom?: boolean
    onPrint: (roster: RosterGroup) => void
    onRosterInstructorChange: (code: string, instructor: string) => void
    onRosterLevelChange: (code: string, level: string) => void
    onCustomRosterInstructorChange?: (id: string, instructor: string) => void
    onCustomRosterLevelChange?: (id: string, level: string) => void
    onStudentLevelChange: (studentId: string, level: string) => void
    allowStudentLevelEdits: boolean
    onToggleStudentLevelEdits: () => void
}

function RosterCard({
    roster,
    instructorOptions,
    isCustom = false,
    onPrint,
    onRosterInstructorChange,
    onRosterLevelChange,
    onCustomRosterInstructorChange,
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
        <div className={containerClass} id={roster.code}>
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
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
                <InstructorSelect
                    value={roster.instructor}
                    options={instructorOptions}
                    optionKeyPrefix={roster.code}
                    placeholder={roster.instructor ? roster.instructor : 'Select Instructor'}
                    onChange={value => {
                        if (isCustom && customId && onCustomRosterInstructorChange) {
                            onCustomRosterInstructorChange(customId, value)
                            return
                        }
                        onRosterInstructorChange(roster.code, value)
                    }}
                />
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
            {roster.students.map(student => (
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
