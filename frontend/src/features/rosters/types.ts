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
