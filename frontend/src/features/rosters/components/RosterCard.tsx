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
    onStudentInstructorChange: (studentId: string, instructor: string) => void
    onStudentLevelChange: (studentId: string, level: string) => void
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
    onStudentInstructorChange,
    onStudentLevelChange,
}: RosterCardProps) {
    const containerClass = isCustom
        ? 'rounded-2xl border-2 border-blue-200 bg-blue-100 p-6 shadow-md'
        : 'rounded-2xl border-2 border-secondary/20 bg-accent p-6 shadow-md'
    const isReadOnly = isCustom
    const customId = roster.customRosterId ?? roster.code.replace(/^custom-/, '')

    return (
        <div className={containerClass} id={roster.code}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-secondary">
                    {roster.serviceName} : {roster.time}
                </h2>
                <button
                    type="button"
                    className="rounded-lg bg-primary px-3 py-1 text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                    onClick={() => onPrint(roster)}
                >
                    Print
                </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
                <div className="hidden md:block" />
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
                    instructorOptions={instructorOptions}
                    onInstructorChange={onStudentInstructorChange}
                    onLevelChange={onStudentLevelChange}
                    disabled={isReadOnly}
                />
            ))}
        </div>
    )
}

export default RosterCard
