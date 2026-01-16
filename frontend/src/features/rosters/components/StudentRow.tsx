import React from 'react'
import type { Student } from '../../../types/app'
import LevelSelect from './LevelSelect'

type StudentRowProps = {
    student: Student
    onLevelChange: (studentId: string, level: string) => void
    disabled?: boolean
}

function StudentRow({ student, onLevelChange, disabled = false }: StudentRowProps) {
    return (
        <div className="mt-3 grid grid-cols-1 items-center gap-3 md:grid-cols-[1.2fr_1fr]">
            <p className="text-secondary">{student.name.replaceAll('"', '')}</p>
            <LevelSelect value={student.level} onChange={value => onLevelChange(student.id, value)} disabled={disabled} />
        </div>
    )
}

export default StudentRow
