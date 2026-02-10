import { setStudentsForDay, updateStudentForDay } from '../../../lib/storage'
import { upsertRosterLevelEdit, upsertRosterStudentLevelEdit } from '../../../lib/rosterEditsApi'
import type { Student } from '../../../types/app'

type UseRosterEditsParams = {
    selectedDay: string
    students: Student[]
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>
    sessionId?: string
    currentUserId?: string
    canEdit?: boolean
}

export function useRosterEdits({
    selectedDay,
    students,
    setStudents,
    sessionId,
    currentUserId,
    canEdit,
}: UseRosterEditsParams) {
    const saveRosterLevelEdit = async (code: string, level: string) => {
        if (!sessionId || !currentUserId) {
            return
        }
        const { error } = await upsertRosterLevelEdit(sessionId, currentUserId, code, level)
        if (error) {
            console.error('Failed to save roster level edit', error)
            alert(`Failed to save roster level edit: ${error.message}`)
        }
    }

    const saveStudentLevelEdit = async (student: Student, level: string) => {
        if (!sessionId || !currentUserId) {
            return
        }
        const result = await upsertRosterStudentLevelEdit(
            sessionId,
            currentUserId,
            student.code,
            student.name,
            level,
        )
        if (!result) {
            return
        }
        if (result.error) {
            console.error('Failed to save roster student level edit', result.error)
            alert(`Failed to save student level edit: ${result.error.message}`)
        }
    }

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
        void saveRosterLevelEdit(code, level)
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
        const student = students.find(item => item.id === studentId)
        if (student) {
            void saveStudentLevelEdit(student, level)
        }
    }

    return {
        handleRosterInstructorChange,
        handleRosterLevelChange,
        handleStudentInstructorChange,
        handleStudentLevelChange,
    }
}
