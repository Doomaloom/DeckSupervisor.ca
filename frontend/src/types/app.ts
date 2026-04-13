export type FormatOptions = {
    time_headers: boolean
    instructor_headers: boolean
    course_headers: boolean
    borders: boolean
    center_time: boolean
    bold_time: boolean
    center_course: boolean
    bold_course: boolean
}

export type InstructorEntry = {
    name: string
    codes: string
}

export type InstructorConfig = {
    names: string[]
    codes: string[]
}

export type InstructorCourseAssignment = {
    name: string
    codes: string[]
}

export type InstructorCourseConfig = {
    instructors: InstructorCourseAssignment[]
}

export type Student = {
    id: string
    service_name: string
    code: string
    day: string
    time: string
    location: string
    schedule: string
    name: string
    phone: string
    instructor: string
    level: string
    waitlist: boolean
}

export type ScheduleConfig = {
    instructors: string[]
    codes: string[]
}

export type RosterStudent = {
    name: string
    phone: string
    age?: string
    instructor: string
    level: string
    waitlist?: boolean
}

export type ClassRoster = {
    sessionKey?: string
    code: string
    serviceName: string
    day: string
    time: string
    location: string
    schedule: string
    instructor: string
    studentCount?: number
    waitlistCount?: number
    students: RosterStudent[]
}

export type CustomRoster = {
    id: string
    serviceName: string
    instructor?: string
    sourceCodes: string[]
    studentIds: string[]
    createdAt: string
}

export type ExtractedClass = {
    sessionKey: string
    dayOfWeek: string
    sessionSeason: string
    sessionYear: number
    courseCode: string
    serviceName: string
    location: string
    startTime24: string
    endTime24: string
    durationMinutes: number
    studentCount: number
    waitlistCount: number
}

export type ExtractedSession = {
    sessionKey: string
    dayOfWeek: string
    sessionSeason: string
    sessionYear: number
    startDate: string
    endDate: string
    location: string
    sessionStartTime24: string
    sessionEndTime24: string
    classCount: number
    studentCount: number
    waitlistCount: number
    courseCodes: string[]
}

export type CsvMatchedSession = {
    id: string
    label: string
    ownedByUser: boolean
    session: {
        id: string
        team_id: string | null
        created_by: string
        session_day: string
        session_season: string | null
        session_year: number | null
        start_date: string | null
        end_date: string | null
        location: string | null
        source_locations: string[]
        session_start_time24: string | null
        session_end_time24: string | null
        instructors: { name: string }[]
    }
}

export type CsvSessionCandidate = {
    sessionKey: string
    sourceSessionKeys: string[]
    rawLocations: string[]
    dayOfWeek: string
    sessionSeason: string
    sessionYear: number
    startDate: string
    endDate: string
    location: string
    sessionStartTime24: string
    sessionEndTime24: string
    classCount: number
    studentCount: number
    waitlistCount: number
    courseCodes: string[]
    matchedSession: CsvMatchedSession | null
}

export type RequestAssignment = {
    id: string
    eventId: string
    term: string
    location: string
    instructor: string
    createdAt: string
    updatedAt: string
}

export type PlannerParticipantStatus = 'booked' | 'waiting'

export type PlannerClassStatus = 'active' | 'pending_cancellation' | 'cancelled' | 'planned_move'

export type PlannerClassMoveType = '' | 'new_time' | 'target_class'

export type PlannerCallStatus =
    | 'not_started'
    | 'called'
    | 'voicemail'
    | 'reached'
    | 'declined_alternatives'
    | 'accepted_alternative'

export type PlannerParticipant = {
    id: string
    classKey: string
    eventId: string
    serviceName: string
    name: string
    phone: string
    email: string
    age: string
    attendeeStatus: PlannerParticipantStatus
}

export type PlannerSession = {
    sessionKey: string
    dayOfWeek: string
    sessionSeason: string
    sessionYear: number
    facility: string
    classKeys: string[]
}

export type PlannerClass = {
    classKey: string
    eventId: string
    sessionKey: string
    serviceName: string
    dayOfWeek: string
    eventTime: string
    facility: string
    sessionSeason: string
    sessionYear: number
    minimumCapacity: number
    maximumCapacity: number
    bookedCount: number
    waitlistCount: number
    participantIds: string[]
    waitingParticipantIds: string[]
    laneIndex: number
    planningStatus: PlannerClassStatus
    plannedMoveType: PlannerClassMoveType
    plannedMoveTime: string
    plannedMoveTargetClassKey: string
    barcodeCancelledAt: string
}

export type PlannerParticipantCallRecord = {
    participantId: string
    classKey: string
    status: PlannerCallStatus
    notes: string
    offeredAlternativeClassKey: string
    acceptedAlternativeClassKey: string
    completedAt: string
    emailSentAt: string
    withdrawRefundAt: string
    refundReceiptSentAt: string
    reRegisteredAt: string
    registrationConfirmationSentAt: string
}

export type PlannerDataset = {
    sourceFileName: string
    importedAt: string
    sessions: PlannerSession[]
    classes: PlannerClass[]
    participants: PlannerParticipant[]
    callRecords: Record<string, PlannerParticipantCallRecord>
}

export type PlannerShareParticipant = {
    id: string
    displayName: string
    isHost: boolean
    isGuest: boolean
    joinedAt: string
    lastSeenAt: string
}

export type PlannerShareSession = {
    code: string
    shareUrl: string
    hostParticipantId: string
    locationOverrides: Record<string, string>
    callbackPhoneNumber: string
    ccEmail: string
    expiresAt: string
    participants: PlannerShareParticipant[]
    dataset: PlannerDataset
    version: number
}

export type PlannerShareJoinResponse = {
    participantId: string
    session: PlannerShareSession
}

export type PlannerCallRecordUpdate = {
    status?: PlannerCallStatus
    notes?: string
    offeredAlternativeClassKey?: string
    acceptedAlternativeClassKey?: string
    completedAt?: string
    emailSentAt?: string
    withdrawRefundAt?: string
    refundReceiptSentAt?: string
    reRegisteredAt?: string
    registrationConfirmationSentAt?: string
}
