import type { SessionRecord } from '../../../app/useCurrentSession'
import type { CurrentTerm } from '../../../app/useCurrentTerm'
import { getExtractedClassesForSession } from '../../../lib/extractedClassesStorage'
import {
  getCustomRosterDayKey,
  getCustomRostersForDay,
  getScheduleForDay,
  getStudentsForDay,
} from '../../../lib/storage'
import { getStorageScope } from '../../../lib/storageScope'
import type { CustomRoster, FormatOptions, ExtractedClass } from '../../../types/app'
import { getCapacity } from '../../schematic/utils/capacity'
import { buildCourses } from '../../schematic/utils/courses'
import { createRequestAwareLayout, type StoredCourseLayout } from '../../schematic/utils/layout'
import { buildCustomRosterGroups, buildRosterGroups } from '../../rosters/utils'
import { getTorontoDate } from '../../../lib/torontoDate'
import { isMiniSessionDay } from '../../../shared/session/sessionDays'
import { formatMiniSessionTitle, formatSessionDisplayName } from '../../../shared/session/sessionLabels'

const MS_PER_DAY = 1000 * 60 * 60 * 24

type HighlightOptions = {
  highlightInstructor: boolean
  selectedInstructor: string
}

type MasterlistStudentPayload = {
  name: string
  phone: string
  age?: string
  instructor: string
  level: string
}

type MasterlistRosterPayload = {
  courseCode: string
  serviceName: string
  day: string
  time: string
  location: string
  schedule: string
  instructor: string
  students: MasterlistStudentPayload[]
}

export type SchematicPdfPayload = {
  orientation: 'portrait' | 'landscape'
  title: string
  dateRange: string
  weeksLabel: string
  deckSupervisorName?: string
  highlightInstructor: boolean
  selectedInstructor: string
  instructors: string[]
  columns: Array<
    Array<{
      code: string
      level: string
      startMinutes: number
      durationMinutes: number
      studentCount: number
      capacity: number
    }>
  >
  rotateCounterClockwise90?: boolean
}

export type MasterlistPdfPayload = {
  rosters: MasterlistRosterPayload[]
  options: FormatOptions
  sessionName: string
  generatedDate: string
  sessionWeek: number
  sessionProgressLabel?: string
}

export type SchematicPrefetchPayload = {
  requestKey: string
  payload: SchematicPdfPayload
}

type SchematicPrintContext = {
  title: string
  dateRange: string
  weeksLabel: string
  instructors: string[]
  columns: ReturnType<typeof createRequestAwareLayout>['columns']
}

function buildExtractedStudentCountByCode(sessionId: string, day: string) {
  const counts = new Map<string, number>()
  if (!sessionId || !day) {
    return counts
  }

  getExtractedClassesForSession(sessionId).forEach((classEntry: ExtractedClass) => {
    if (classEntry.dayOfWeek && classEntry.dayOfWeek !== day) {
      return
    }
    const code = classEntry.courseCode?.trim().toLowerCase()
    if (!code || counts.has(code)) {
      return
    }
    counts.set(code, Math.max(classEntry.studentCount, 0))
  })

  return counts
}

function applyExtractedStudentCounts(sessionId: string, day: string) {
  const students = getStudentsForDay(day)
  const extractedCounts = buildExtractedStudentCountByCode(sessionId, day)
  if (students.length === 0) {
    return []
  }

  const courses = buildCourses(students)
  if (extractedCounts.size === 0) {
    return courses
  }

  return courses.map(course => {
    const extractedCount = extractedCounts.get(course.code.trim().toLowerCase())
    if (extractedCount === undefined) {
      return course
    }
    return {
      ...course,
      studentCount: extractedCount,
    }
  })
}

export const formatGeneratedDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

export const getSessionWeek = (startDate: string, now = new Date()) => {
  if (!startDate) {
    return null
  }
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) {
    return null
  }
  const diffDays = Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY)
  const week = Math.floor(diffDays / 7) + 1
  return week < 1 ? 1 : week
}

export const formatMonthDay = (value: string) => {
  if (!value) {
    return ''
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const parsed = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function buildSessionTitle(
  session: SessionRecord | null,
  selectedDay: string | null,
  term?: CurrentTerm | null,
) {
  const miniSessionTitle = formatMiniSessionTitle(
    selectedDay || session?.session_day,
    session?.session_year,
    session?.start_date,
  )
  if (miniSessionTitle) {
    return miniSessionTitle
  }
  return formatSessionDisplayName({
    sessionDay: session?.session_day,
    dayOverride: selectedDay,
    includeDay: false,
    sessionSeason: session?.session_season,
    sessionYear: session?.session_year,
    startDate: session?.start_date,
    termSeason: term?.season,
    termYear: term?.year,
    includeTimeRange: false,
    fallback: 'Session',
  })
}

export function buildDateRangeLabel(session: SessionRecord | null) {
  if (session?.start_date && session?.end_date) {
    return `${formatMonthDay(session.start_date)} - ${formatMonthDay(session.end_date)}`
  }
  if (session?.start_date) {
    return formatMonthDay(session.start_date)
  }
  return 'Date range unavailable'
}

export function buildWeeksLabel(session: SessionRecord | null) {
  if (!session?.start_date || !session?.end_date) {
    return ''
  }
  const start = new Date(session.start_date)
  const end = new Date(session.end_date)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ''
  }
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  if (endDate < startDate) {
    return ''
  }
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1
  const weeks = Math.floor((days + 6) / 7)
  return `# of weeks ${weeks} classes`
}

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }
  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function observedCanadaDay(year: number) {
  const canadaDay = new Date(Date.UTC(year, 6, 1))
  const weekday = canadaDay.getUTCDay()
  if (weekday === 6) {
    return new Date(Date.UTC(year, 6, 3))
  }
  if (weekday === 0) {
    return new Date(Date.UTC(year, 6, 2))
  }
  return canadaDay
}

function firstMondayOfAugust(year: number) {
  const augustFirst = new Date(Date.UTC(year, 7, 1))
  const weekday = augustFirst.getUTCDay()
  const offset = weekday === 0 ? 1 : weekday === 1 ? 0 : 8 - weekday
  return new Date(Date.UTC(year, 7, 1 + offset))
}

function isMiniSessionHoliday(value: Date) {
  const year = value.getUTCFullYear()
  const iso = formatDateOnly(value)
  return iso === formatDateOnly(observedCanadaDay(year)) || iso === formatDateOnly(firstMondayOfAugust(year))
}

export function getMiniSessionLessonDay(
  startDate: string,
  now = new Date(),
  endDate?: string | null,
) {
  const start = parseDateOnly(startDate)
  const current = parseDateOnly(getTorontoDate(now))
  const end = endDate ? parseDateOnly(endDate) : null
  if (!start || !current) {
    return null
  }

  let effectiveEnd = current
  if (end && end.getTime() < effectiveEnd.getTime()) {
    effectiveEnd = end
  }
  if (effectiveEnd.getTime() < start.getTime()) {
    return 1
  }

  let lessonDay = 0
  for (let cursor = new Date(start); cursor.getTime() <= effectiveEnd.getTime(); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const weekday = cursor.getUTCDay()
    if (weekday === 0 || weekday === 6) {
      continue
    }
    if (isMiniSessionHoliday(cursor)) {
      continue
    }
    lessonDay += 1
  }

  return lessonDay > 0 ? lessonDay : 1
}

export function buildMasterlistProgressLabel(
  session: SessionRecord | null,
  selectedDay: string | null,
  now = new Date(),
) {
  const day = selectedDay || session?.session_day || ''
  if (!isMiniSessionDay(day)) {
    return ''
  }
  if (!session?.start_date) {
    return ''
  }
  const lessonDay = getMiniSessionLessonDay(session.start_date, now, session.end_date)
  if (!lessonDay) {
    return ''
  }
  return `Lesson Day ${lessonDay}`
}

export function buildRosterGroupsForPrint(
  day: string,
  sessionId?: string,
  customRostersOverride?: CustomRoster[],
) {
  const students = getStudentsForDay(day)
  const rosterGroups = buildRosterGroups(students)
  if (!day) {
    return rosterGroups
  }

  const customDayKey = getCustomRosterDayKey(day, sessionId, getStorageScope() === 'guest')
  const customRosters = customRostersOverride ?? getCustomRostersForDay(customDayKey)
  if (customRosters.length === 0) {
    return rosterGroups
  }

  const rosterByCode = new Map(rosterGroups.map(roster => [roster.code, roster]))
  const studentsById = new Map(students.map(student => [student.id, student]))
  const customGroups = buildCustomRosterGroups(customRosters, rosterByCode, studentsById)
  return [...rosterGroups, ...customGroups]
}

function buildMasterlistRosterPayloads(day: string, sessionId?: string, customRostersOverride?: CustomRoster[]) {
  const rosterGroups = buildRosterGroupsForPrint(day, sessionId, customRostersOverride)
  if (rosterGroups.length === 0) {
    return []
  }

  return rosterGroups.flatMap<MasterlistRosterPayload>(roster => {
    const mappedStudents = roster.students.map(student => ({
      name: student.name,
      phone: student.phone,
      age: student.age,
      instructor: student.instructor,
      level: student.level,
      code: student.code,
    }))

    if (!roster.code.startsWith('custom-')) {
      return [
        {
          courseCode: roster.code,
          serviceName: roster.serviceName,
          day,
          time: roster.time,
          location: roster.location,
          schedule: roster.schedule,
          instructor: roster.instructor,
          students: mappedStudents.map(({ code: _code, ...student }) => student),
        },
      ]
    }

    const studentsByOriginalCode = new Map<string, MasterlistStudentPayload[]>()
    mappedStudents.forEach(student => {
      const originalCode = student.code?.trim()
      if (!originalCode) {
        return
      }
      const bucket = studentsByOriginalCode.get(originalCode)
      const studentPayload = {
        name: student.name,
        phone: student.phone,
        age: student.age,
        instructor: student.instructor,
        level: student.level,
      }
      if (bucket) {
        bucket.push(studentPayload)
      } else {
        studentsByOriginalCode.set(originalCode, [studentPayload])
      }
    })

    return Array.from(studentsByOriginalCode.entries()).map(([code, students]) => ({
      courseCode: code,
      serviceName: roster.serviceName,
      day,
      time: roster.time,
      location: roster.location,
      schedule: roster.schedule,
      instructor: roster.instructor,
      students,
    }))
  })
}

export function buildMasterlistRequestBody(args: {
  day: string
  sessionId?: string
  session: SessionRecord | null
  term?: CurrentTerm | null
  options: FormatOptions
  customRostersOverride?: CustomRoster[]
}): MasterlistPdfPayload | null {
  const rosters = buildMasterlistRosterPayloads(args.day, args.sessionId, args.customRostersOverride)
  if (rosters.length === 0) {
    return null
  }

  return {
    rosters,
    options: args.options,
    sessionName: buildSessionTitle(args.session, args.day, args.term),
    generatedDate: formatGeneratedDate(new Date()),
    sessionWeek: getSessionWeek(args.session?.start_date ?? '') ?? 1,
    sessionProgressLabel: buildMasterlistProgressLabel(args.session, args.day),
  }
}

export function buildSchematicPrintContext(args: {
  day: string
  sessionId: string
  session: SessionRecord | null
  term?: CurrentTerm | null
  storedLayout?: StoredCourseLayout | null
}): SchematicPrintContext | null {
  const courses = applyExtractedStudentCounts(args.sessionId, args.day)
  if (courses.length === 0) {
    return null
  }

  const layout = createRequestAwareLayout(courses, args.storedLayout ?? getScheduleForDay(args.day))
  return {
    title: buildSessionTitle(args.session, args.day, args.term),
    dateRange: buildDateRangeLabel(args.session),
    weeksLabel: buildWeeksLabel(args.session),
    instructors: layout.instructors,
    columns: layout.columns,
  }
}

export function buildSchematicPayload(
  context: SchematicPrintContext,
  orientation: 'portrait' | 'landscape',
  highlightOptions: HighlightOptions = {
    highlightInstructor: false,
    selectedInstructor: 'none',
  },
  instructorsOverride?: string[],
): SchematicPdfPayload {
  return {
    orientation,
    title: context.title,
    dateRange: context.dateRange,
    weeksLabel: context.weeksLabel,
    highlightInstructor: highlightOptions.highlightInstructor,
    selectedInstructor: highlightOptions.selectedInstructor,
    instructors: instructorsOverride ?? context.instructors,
    columns: context.columns.map(column =>
      column.map(course => ({
        code: course.code,
        level: course.level,
        startMinutes: course.startMinutes,
        durationMinutes: course.runningTime || course.endMinutes - course.startMinutes,
        studentCount: course.studentCount,
        capacity: getCapacity(course),
      })),
    ),
  }
}

export function buildBaseSchematicPayload(args: {
  day: string
  sessionId: string
  session: SessionRecord | null
  term?: CurrentTerm | null
  storedLayout?: StoredCourseLayout | null
}) {
  const context = buildSchematicPrintContext(args)
  if (!context) {
    return null
  }

  return buildSchematicPayload(context, 'portrait', {
    highlightInstructor: false,
    selectedInstructor: 'none',
  })
}

function getPrintableSchematicInstructorNames(
  day: string,
  sessionId: string,
  customRostersOverride?: CustomRoster[],
) {
  return Array.from(
    new Set(
      buildRosterGroupsForPrint(day, sessionId, customRostersOverride)
        .map(roster => roster.instructor.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))
}

export function buildSchematicPrefetchPayloads(args: {
  day: string
  sessionId: string
  session: SessionRecord | null
  term?: CurrentTerm | null
  storedLayout?: StoredCourseLayout | null
  customRostersOverride?: CustomRoster[]
}): SchematicPrefetchPayload[] {
  const context = buildSchematicPrintContext(args)
  if (!context) {
    return []
  }

  const instructorNames = getPrintableSchematicInstructorNames(
    args.day,
    args.sessionId,
    args.customRostersOverride,
  )
  const payloads: SchematicPrefetchPayload[] = []
  const orientations: Array<'portrait' | 'landscape'> = ['portrait', 'landscape']

  orientations.forEach(orientation => {
    const basePayload = buildSchematicPayload(context, orientation, {
      highlightInstructor: false,
      selectedInstructor: 'none',
    })
    payloads.push({
      requestKey: JSON.stringify(basePayload),
      payload: basePayload,
    })

    instructorNames.forEach(name => {
      const highlightedPayload = buildSchematicPayload(context, orientation, {
        highlightInstructor: true,
        selectedInstructor: name,
      })
      payloads.push({
        requestKey: JSON.stringify(highlightedPayload),
        payload: highlightedPayload,
      })
    })
  })

  return payloads
}
