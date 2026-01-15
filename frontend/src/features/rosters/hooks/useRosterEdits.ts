import { setStudentsForDay, updateStudentForDay } from '../../../lib/storage'
import type { Student } from '../../../types/app'

type UseRosterEditsParams = {
    selectedDay: string
    students: Student[]
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>
}

export function useRosterEdits({ selectedDay, students, setStudents }: UseRosterEditsParams) {
    const handleRosterInstructorChange = (code: string, instructor: string) => {
        const updated = students.map(student =>
            student.code === code ? { ...student, instructor } : student,
        )
        setStudents(updated)
        setStudentsForDay(selectedDay, updated)
    }

    const handleRosterLevelChange = (code: string, level: string) => {
        const updated = students.map(student =>
            student.code === code ? { ...student, level } : student,
        )
        setStudents(updated)
        setStudentsForDay(selectedDay, updated)
    }

    const handleStudentInstructorChange = (studentId: string, instructor: string) => {
        const updated = students.map(student =>
            student.id === studentId ? { ...student, instructor } : student,
        )
        setStudents(updated)
        updateStudentForDay(selectedDay, studentId, { instructor })
    }

    const handleStudentLevelChange = (studentId: string, level: string) => {
        const updated = students.map(student =>
            student.id === studentId ? { ...student, level } : student,
        )
        setStudents(updated)
        updateStudentForDay(selectedDay, studentId, { level })
    }

    return {
        handleRosterInstructorChange,
        handleRosterLevelChange,
        handleStudentInstructorChange,
        handleStudentLevelChange,
    }
}
