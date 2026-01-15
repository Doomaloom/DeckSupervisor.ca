import React from 'react'
import type { Student } from '../../../types/app'
import InstructorSelect from './InstructorSelect'
import LevelSelect from './LevelSelect'

type StudentRowProps = {
    student: Student
    instructorOptions: string[]
    onInstructorChange: (studentId: string, instructor: string) => void
    onLevelChange: (studentId: string, level: string) => void
}

function StudentRow({ student, instructorOptions, onInstructorChange, onLevelChange }: StudentRowProps) {
    return (
        <div className="mt-3 grid grid-cols-1 items-center gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
            <p className="text-secondary">{student.name.replaceAll('"', '')}</p>
            <InstructorSelect
                value={student.instructor}
                options={instructorOptions}
                optionKeyPrefix={student.id}
                placeholder={student.instructor || 'Select Instructor'}
                onChange={value => onInstructorChange(student.id, value)}
            />
            <LevelSelect value={student.level} onChange={value => onLevelChange(student.id, value)} />
        </div>
    )
}

export default StudentRow
