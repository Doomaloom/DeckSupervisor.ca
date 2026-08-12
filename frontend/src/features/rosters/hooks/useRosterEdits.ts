import { setStudentsForDay, updateStudentForDay } from '../../../lib/storage'
import { upsertRosterLevelEdit, upsertRosterStudentLevelEdit } from '../../../lib/rosterEditsApi'
import type { Student } from '../../../types/app'
import { showAppNotice } from '../../../lib/appNotice'

type UseRosterEditsParams = {
    selectedDay: string
    students: Student[]
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>
    sessionId?: string
    currentUserId?: string
    canEdit?: boolean
    onInstructorPdfDirty?: (instructors: string[]) => void
}

export function useRosterEdits({
    selectedDay,
    students,
    setStudents,
    sessionId,
    currentUserId,
    canEdit,
    onInstructorPdfDirty,
}: UseRosterEditsParams) {
    const notifyDirtyInstructors = (instructors: string[]) => {
        const names = Array.from(new Set(instructors.map(name => name.trim()).filter(Boolean)))
        if (names.length === 0) {
            return
        }
        onInstructorPdfDirty?.(names)
    }

    const saveRosterLevelEdit = async (code: string, level: string) => {
        if (!sessionId || !currentUserId) {
            return
        }
        try {
            await upsertRosterLevelEdit(sessionId, currentUserId, code, level)
        } catch (error) {
            console.error('Failed to save roster level edit', error)
            showAppNotice(`Failed to save roster level edit: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
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
        try {
            await result
        } catch (error) {
            console.error('Failed to save roster student level edit', error)
            showAppNotice(`Failed to save student level edit: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
        }
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
        notifyDirtyInstructors(
            updated
                .filter(student => student.code === code)
                .map(student => student.instructor),
        )
        void saveRosterLevelEdit(code, level)
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
        if (student?.instructor) {
            notifyDirtyInstructors([student.instructor])
        }
        if (student) {
            void saveStudentLevelEdit(student, level)
        }
    }

    return {
        handleRosterLevelChange,
        handleStudentLevelChange,
    }
}
