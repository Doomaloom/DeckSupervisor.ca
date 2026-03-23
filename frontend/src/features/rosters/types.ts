import type { Student } from '../../types/app'

export type RosterGroup = {
    code: string
    customRosterId?: string
    serviceName: string
    level: string
    time: string
    instructor: string
    location: string
    schedule: string
    students: Student[]
}

export type RosterListItem = {
    roster: RosterGroup
    isCustom?: boolean
}

export type FullTimeInstructorPeriod = 'allDay' | 'am' | 'pm'

export type FullTimeInstructorDayAssignments = {
    allDay: string[]
    am: string[]
    pm: string[]
}

export type FullTimeInstructorAssignments = Record<string, FullTimeInstructorDayAssignments>

export type FullTimeRequestReason =
    | ''
    | 'conflicting_request'
    | 'staff_schedule'
    | 'student_not_registered'

export type FullTimeRequestMatchSource = '' | 'phone' | 'name'

export type FullTimeRequestEntry = {
    id: string
    firstName: string
    lastName: string
    phone: string
    instructor: string
    accommodated: boolean
    reason: FullTimeRequestReason
    matchedDay: string
    matchedCode: string
    matchedServiceName: string
    matchedTime: string
    matchedBy: FullTimeRequestMatchSource
    matchedRequestCount: number
    requiresManualReview: boolean
    manualReviewNote: string
}
