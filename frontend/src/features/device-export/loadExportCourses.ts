import { getLoadedRosterSession } from '../../lib/loadedRosterSession'
import type { SessionRecord } from '../../app/useCurrentSession'
import { getStudentsByDay, getInstructorsForDay } from '../../lib/storage'
import { getExtractedClassesForSession } from '../../lib/extractedClassesStorage'
import { getCsvImportDatasetForSession } from '../../lib/csvImportDatasetStorage'
import { deriveCsvDataForSession } from '../../lib/csvImportReconcile'
import { fetchRosterEdits, fetchSchematic } from '../../lib/serverApi'
import { applyPersistedLevelEdits, hashStudentNames } from '../../lib/rosterEditsApi'
import { buildCourses } from './exportPackage'

export async function loadExportCourses(session: SessionRecord, isGuest: boolean) {
  let metadata = getExtractedClassesForSession(session.id)
  if (!metadata.length) {
    const dataset = getCsvImportDatasetForSession(session.id)
    if (dataset) metadata = deriveCsvDataForSession({ sessionDay: session.session_day, sessionSeason: session.session_season, sessionYear: session.session_year, sourceLocations: session.source_locations, sessionStartTime24: session.session_start_time24, sessionEndTime24: session.session_end_time24 }, dataset).classes
  }
  const byDay = getStudentsByDay()
  for (const day of Object.keys(byDay)) {
    const source = getLoadedRosterSession(day)
    if (day === session.session_day && source && source !== session.id) throw new Error('The loaded roster belongs to another session. Load the selected session’s CSV before exporting.')
  }
  let students = Object.entries(byDay).filter(([day]) => !getLoadedRosterSession(day) || getLoadedRosterSession(day) === session.id).flatMap(([, rows]) => rows)
  const local = getInstructorsForDay(session.session_day)
  let names = local?.names ?? []
  let codes = local?.codes ?? []
  if (!isGuest) {
    // Await the current saved assignments and edits before enabling download.
    // A failed refresh is surfaced; exporting an old snapshot is not a fallback.
    const [schematic, edits] = await Promise.all([fetchSchematic(session.id), fetchRosterEdits(session.id)])
    names = schematic.schematic?.data?.instructors ?? names
    codes = schematic.schematic?.data?.codes ?? codes
    const hashes = await hashStudentNames(students.map(student => student.name))
    students = applyPersistedLevelEdits(students, edits.rosterEdits ?? [], edits.studentEdits ?? [], hashes)
  }
  const assignments = new Map<string, string>()
  codes.forEach((group, i) => group.split(',').map(code => code.trim()).filter(Boolean).forEach(code => {
    const name = (names[i] ?? '').trim()
    if (assignments.has(code) && assignments.get(code) !== name) throw new Error(`Class ${code} is assigned to more than one instructor in Schematic.`)
    assignments.set(code, name)
  }))
  students = students.map(student => assignments.has(student.code) ? { ...student, instructor: assignments.get(student.code)! } : student)
  return buildCourses(session, metadata, students).map(course => assignments.has(course.code) ? { ...course, instructor: assignments.get(course.code)! } : course)
}
