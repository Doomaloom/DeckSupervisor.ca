import type { Student } from '../../types/app'

export type RosterGroup = {
    code: string
    serviceName: string
    level: string
    time: string
    instructor: string
    location: string
    schedule: string
    students: Student[]
}
