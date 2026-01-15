import { DEFAULT_CAPACITY, classCapacities } from '../constants'
import type { Course } from '../types'

const normalizedCapacities = Object.fromEntries(
    Object.entries(classCapacities).map(([key, value]) => [key.replace(/\s+/g, '').toLowerCase(), value]),
)

export function isExceptionClass(level: string) {
    const normalized = level.toLowerCase()
    return normalized.includes('private') || normalized.includes('inclusion')
}

export function getCapacity(course: Course) {
    const normalized = course.level.replace(/\s+/g, '').toLowerCase()
    const partialMatch = Object.entries(normalizedCapacities)
        .filter(([key]) => key.includes('private') || key.includes('inclusion'))
        .reduce<{ key: string; value: number } | null>((best, [key, value]) => {
            if (!normalized.includes(key)) {
                return best
            }
            if (!best || key.length > best.key.length) {
                return { key, value }
            }
            return best
        }, null)
    if (partialMatch) {
        return partialMatch.value
    }
    if (normalized.includes('adult') || normalized.includes('teen')) {
        const match = normalized.match(/(\d+)/)
        if (match) {
            const number = match[1]
            if (normalized.includes('adult')) {
                const adultKey = `splashadult${number}`
                return normalizedCapacities[adultKey] ?? DEFAULT_CAPACITY
            }
            const teenKey = `splashteen${number}`
            return normalizedCapacities[teenKey] ?? DEFAULT_CAPACITY
        }
    }
    return normalizedCapacities[normalized] ?? DEFAULT_CAPACITY
}

export function getCapacityClass(course: Course, capacity: number) {
    if (course.studentCount === 1 && !isExceptionClass(course.level)) {
        return 'border-rose-200 bg-rose-100 text-rose-700'
    }
    if (course.studentCount < Math.floor(capacity / 2)) {
        return 'border-amber-200 bg-amber-100 text-amber-700'
    }
    return 'border-emerald-200 bg-emerald-100 text-emerald-700'
}
