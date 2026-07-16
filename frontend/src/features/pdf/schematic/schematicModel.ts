import type { SchematicPdfCourse, SchematicPdfRequest } from '../types'

export type SchematicCell = {
  kind: 'empty' | 'block'
  text: string
  color?: string
  border: 'top' | 'middle' | 'bottom' | ''
}

const maxDuration = (course: SchematicPdfCourse) => (course.durationMinutes ?? 0) > 0
  ? course.durationMinutes as number
  : 30

export function findSchematicTimeBounds(columns: SchematicPdfCourse[][]) {
  const courses = columns.flat()
  if (!courses.length) return null
  const start = Math.min(...courses.map(course => course.startMinutes ?? 0))
  const end = Math.max(...courses.map(course => (course.startMinutes ?? 0) + maxDuration(course)))
  return { start, end }
}

export function schematicRowHeight(duration: number) {
  if (duration <= 0) return 0
  return Math.max(1, Math.ceil((duration * 4) / 30))
}

export function schematicCapacityColor(course: SchematicPdfCourse) {
  const capacity = course.capacity ?? 0
  if (capacity <= 0) return '#00B050'
  const percent = ((course.studentCount ?? 0) * 100) / capacity
  if (percent < 50) return '#FF0000'
  if (percent < 70) return '#FFC000'
  return '#00B050'
}

export function sanitizeSchematicLevel(level = '') {
  const normalized = level.trim().toLowerCase()
  if (normalized.includes('private lesson')) return 'Private'
  if (normalized.includes('inclusion')) return 'Inclusion'
  const splash = normalized.match(/\bsplash\s*(10|[7-9])\b/i)
  if (splash) return `Splash ${splash[1]}`
  const adult = normalized.match(/\bsplash\s*adult\s*(1|2|3)\b/i)
  if (adult) return `Splash Adult ${adult[1]}`
  return level
}

function capacityRow(course: SchematicPdfCourse, start: number, height: number) {
  switch (maxDuration(course)) {
    case 30: return start + 3
    case 45: return start + 4
    case 60: return start + 5
    default: return start + height - 1
  }
}

export function buildSchematicMatrix(request: SchematicPdfRequest) {
  const columns = request.columns ?? []
  const columnCount = Math.max(columns.length, request.instructors?.length ?? 0, 1)
  const bounds = findSchematicTimeBounds(columns)
  if (!bounds) return null
  const blocks = Math.ceil((bounds.end - bounds.start) / 30)
  const totalRows = blocks * 4
  const matrix: SchematicCell[][] = Array.from({ length: totalRows }, () =>
    Array.from({ length: columnCount }, () => ({ kind: 'empty', text: '', border: '' }) as SchematicCell),
  )

  columns.forEach((column, columnIndex) => {
    column.forEach(course => {
      const startRow = Math.floor((((course.startMinutes ?? 0) - bounds.start) * 4) / 30)
      let height = schematicRowHeight(maxDuration(course))
      height = Math.min(height, totalRows - startRow)
      if (startRow < 0 || height <= 0) return
      const nameRow = startRow + 1
      const codeRow = startRow + 2
      const capRow = capacityRow(course, startRow, height)
      for (let offset = 0; offset < height; offset += 1) {
        const row = startRow + offset
        let text = ''
        let color: string | undefined
        if (row === nameRow) text = sanitizeSchematicLevel(course.level)
        if (row === codeRow) text = course.code ?? ''
        if (row === capRow) {
          text = `${course.studentCount ?? 0} of ${course.capacity ?? 0}`
          color = schematicCapacityColor(course)
        }
        matrix[row][columnIndex] = {
          kind: 'block',
          text,
          color,
          border: offset === 0 ? 'top' : offset === height - 1 ? 'bottom' : 'middle',
        }
      }
    })
  })
  return { matrix, columnCount, totalRows, baseMinutes: bounds.start, totalBlocks: blocks }
}

export function formatSchematicTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${hour24 % 12 || 12}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`
}

export function clampSchematicScale(value: number | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return 100
  return Math.min(120, Math.max(60, Math.round((value ?? 100) / 5) * 5))
}

export function computeSchematicScale(orientation: 'portrait' | 'landscape', totalRows: number) {
  const paperHeight = orientation === 'landscape' ? 8.5 : 11
  const contentHeight = (30 + 3.75 + 30 + 30 + 18 + 18 + totalRows * 15) / 72
  return Math.min(1, ((paperHeight - 0.5) / contentHeight) * 0.85)
}

export function effectiveSchematicScale(
  orientation: 'portrait' | 'landscape',
  totalRows: number,
  userPercent?: number,
) {
  return computeSchematicScale(orientation, totalRows) * clampSchematicScale(userPercent) / 100
}
