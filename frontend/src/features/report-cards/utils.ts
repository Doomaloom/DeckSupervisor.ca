import type { Student } from '../../types/app'
import { sanitizeLevel } from '../rosters/utils'

export type LevelCount = {
  level: string
  count: number
}

export type InstructorSummary = {
  name: string
  total: number
  levels: LevelCount[]
}

export type EmployeeReportCardRow = {
  instructor?: string | null
  number_of_report_cards?: number | null
}

type ReportCardSummary = {
  instructorSummaries: InstructorSummary[]
  lessonBlockTotals: LevelCount[]
  totalStudents: number
}

function formatCanonicalLevel(level: string) {
  const sanitized = sanitizeLevel(level)

  if (/^LittleSplash\d+$/i.test(sanitized)) {
    return sanitized.replace(/^LittleSplash(\d+)$/i, 'Little Splash $1')
  }
  if (/^ParentandTot\d+$/i.test(sanitized)) {
    return sanitized.replace(/^ParentandTot(\d+)$/i, 'Parent and Tot $1')
  }
  if (/^TeenAdult\d+$/i.test(sanitized)) {
    return sanitized.replace(/^TeenAdult(\d+)$/i, 'Teen/Adult $1')
  }
  if (/^Splash\d+[A-Z]?$/i.test(sanitized)) {
    return sanitized.replace(/^Splash(\d+)([A-Z]?)$/i, (_match: string, num: string, suffix: string) =>
      `Splash ${num}${suffix ? suffix.toUpperCase() : ''}`,
    )
  }
  if (/^SplashPrivate$/i.test(sanitized)) {
    return 'Private Lesson'
  }
  if (/^SplashFitness$/i.test(sanitized)) {
    return 'Splash Fitness'
  }

  return level.trim().replace(/\s+/g, ' ') || 'Unknown'
}

export function normalizeLevel(student: Student) {
  const value = (student.level || student.service_name || '').trim()
  return formatCanonicalLevel(value)
}

export function normalizeInstructorName(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized || 'Unassigned'
}

export function buildStudentReportCardSummary(students: Student[]): ReportCardSummary {
  const instructorMap = new Map<string, Map<string, LevelCount>>()
  const totalMap = new Map<string, LevelCount>()
  let totalStudents = 0

  students.forEach(student => {
    const instructor = normalizeInstructorName(student.instructor)
    const level = normalizeLevel(student)

    const instructorLevels = instructorMap.get(instructor) ?? new Map<string, LevelCount>()
    const instructorLevelCount = instructorLevels.get(level) ?? { level, count: 0 }
    instructorLevelCount.count += 1
    instructorLevels.set(level, instructorLevelCount)
    instructorMap.set(instructor, instructorLevels)

    const totalLevelCount = totalMap.get(level) ?? { level, count: 0 }
    totalLevelCount.count += 1
    totalMap.set(level, totalLevelCount)

    totalStudents += 1
  })

  const collator = new Intl.Collator('en', { sensitivity: 'base' })
  const instructorSummaries: InstructorSummary[] = Array.from(instructorMap.entries())
    .map(([name, levels]) => {
      const levelCounts = Array.from(levels.values()).sort((a, b) => collator.compare(a.level, b.level))
      return {
        name,
        total: levelCounts.reduce((sum, level) => sum + level.count, 0),
        levels: levelCounts,
      }
    })
    .sort((a, b) => collator.compare(a.name, b.name))

  const lessonBlockTotals = Array.from(totalMap.values()).sort((a, b) => collator.compare(a.level, b.level))

  return {
    instructorSummaries,
    lessonBlockTotals,
    totalStudents,
  }
}

export function buildEmployeeReportCardSummaries(rows: EmployeeReportCardRow[]) {
  const collator = new Intl.Collator('en', { sensitivity: 'base' })
  const totalsByEmployee = new Map<string, number>()

  rows.forEach(row => {
    const name = normalizeInstructorName(row.instructor)
    const count = Math.max(0, row.number_of_report_cards ?? 0)
    totalsByEmployee.set(name, (totalsByEmployee.get(name) ?? 0) + count)
  })

  return Array.from(totalsByEmployee.entries())
    .map(([name, total]) => ({ name, total, levels: [] as LevelCount[] }))
    .sort((a, b) => {
      if (a.total !== b.total) {
        return b.total - a.total
      }
      return collator.compare(a.name, b.name)
    })
}
