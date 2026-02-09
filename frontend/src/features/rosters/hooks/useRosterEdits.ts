import { setStudentsForDay, updateStudentForDay } from '../../../lib/storage'
import { upsertRosterLevelEdit, upsertRosterStudentLevelEdit } from '../../../lib/rosterEditsApi'
import type { Student } from '../../../types/app'

type UseRosterEditsParams = {
    selectedDay: string
    students: Student[]
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>
    sessionId?: string
    canEdit?: boolean
}

export function useRosterEdits({ selectedDay, students, setStudents, sessionId, canEdit }: UseRosterEditsParams) {
    const handleRosterInstructorChange = (code: string, instructor: string) => {
        if (canEdit === false) {
            return
        }
        const updated = students.map(student =>
            student.code === code ? { ...student, instructor } : student,
        )
        setStudents(updated)
        setStudentsForDay(selectedDay, updated)
    }

    const handleRosterLevelChange = (code: string, level: string) => {
        if (canEdit === false) {
            return
        }
        const updated = students.map(student =>
            student.code === code ? { ...student, level } : student,
        )
        setStudents(updated)
        setStudentsForDay(selectedDay, updated)
        if (sessionId) {
            void upsertRosterLevelEdit(sessionId, code, level)
        }
    }

    const handleStudentInstructorChange = (studentId: string, instructor: string) => {
        if (canEdit === false) {
            return
        }
        const updated = students.map(student =>
            student.id === studentId ? { ...student, instructor } : student,
        )
        setStudents(updated)
        updateStudentForDay(selectedDay, studentId, { instructor })
    }

    const handleStudentLevelChange = (studentId: string, level: string) => {
        if (canEdit === false) {
            return
        }
        const updated = students.map(student =>
            student.id === studentId ? { ...student, level } : student,
        )
        setStudents(updated)
        updateStudentForDay(selectedDay, studentId, { level })
        if (sessionId) {
            const student = students.find(item => item.id === studentId)
            if (student) {
                void upsertRosterStudentLevelEdit(sessionId, student.code, student.name, level)
            }
        }
    }

    return {
        handleRosterInstructorChange,
        handleRosterLevelChange,
        handleStudentInstructorChange,
        handleStudentLevelChange,
    }
}
