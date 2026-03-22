export type Course = {
    code: string
    level: string
    runningTime: number
    startTime: string
    endTime: string
    startMinutes: number
    endMinutes: number
    studentCount: number
    studentName?: string
    assignedInstructor?: string
    isRequested?: boolean
    isLockedToInstructor?: boolean
}

export type DragState = {
    code: string
    columnIndex: number
}
