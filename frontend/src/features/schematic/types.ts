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
    requestInstructor?: string
    requestHighlightOnly?: boolean
    isRequested?: boolean
    isLockedToInstructor?: boolean
}

export type DragState = {
    codes: string[]
    columnIndex: number
}
