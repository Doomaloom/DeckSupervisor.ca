export type Course = {
    code: string
    level: string
    runningTime: number
    startTime: string
    endTime: string
    startMinutes: number
    endMinutes: number
    studentCount: number
}

export type DragState = {
    code: string
    columnIndex: number
}
