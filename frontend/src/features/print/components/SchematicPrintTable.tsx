import React, { useMemo } from 'react'
import type { Course } from '../../schematic/types'
import { getCapacity, getCapacityClass } from '../../schematic/utils/capacity'

type SchematicPrintTableProps = {
  columns: Course[][]
  instructors: string[]
  title: string
  dateRange: string
  weeksLabel: string
}

type Cell = {
  course: Course
  rowSpan: number
  capacity: number
  capacityClass: string
}

const formatTimeLabel = (minutes: number) => {
  const total = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

const buildSlots = (courses: Course[], interval = 30) => {
  if (courses.length === 0) {
    return []
  }
  const starts = courses.map(course => course.startMinutes)
  const ends = courses.map(course => course.endMinutes)
  const start = Math.min(...starts)
  const end = Math.max(...ends)
  const slots: number[] = []
  for (let t = start; t < end; t += interval) {
    slots.push(t)
  }
  return slots
}

function SchematicPrintTable({
  columns,
  instructors,
  title,
  dateRange,
  weeksLabel,
}: SchematicPrintTableProps) {
  const allCourses = useMemo(() => columns.flat(), [columns])
  const slots = useMemo(() => buildSlots(allCourses, 30), [allCourses])
  const columnCount = Math.max(columns.length, instructors.length, 1)

  const grid = useMemo(() => {
    const cellMap = new Map<string, Cell>()
    const skipMap = new Set<string>()
    const baseStart = slots[0] ?? 0

    columns.forEach((column, colIndex) => {
      column.forEach(course => {
        const rowIndex = Math.round((course.startMinutes - baseStart) / 30)
        if (rowIndex < 0) {
          return
        }
        const rowSpan = Math.max(1, Math.ceil(course.runningTime / 30))
        const capacity = getCapacity(course)
        const capacityClass = getCapacityClass(course, capacity)
        cellMap.set(`${rowIndex}-${colIndex}`, {
          course,
          rowSpan,
          capacity,
          capacityClass,
        })
        for (let offset = 1; offset < rowSpan; offset += 1) {
          skipMap.add(`${rowIndex + offset}-${colIndex}`)
        }
      })
    })

    return { cellMap, skipMap }
  }, [columns, slots])

  const leftSpan = 1 + Math.ceil(columnCount / 2)
  const totalColumns = columnCount + 2
  const rightSpan = totalColumns - leftSpan

  return (
    <table className="schematic-print-table">
      <thead>
        <tr>
          <th colSpan={totalColumns} className="schematic-title">
            {title}
          </th>
        </tr>
        <tr>
          <th colSpan={totalColumns} className="schematic-subtitle">
            {dateRange}
          </th>
        </tr>
        <tr>
          <th colSpan={leftSpan} className="schematic-meta">
            Deck Supervisor:
          </th>
          <th colSpan={rightSpan} className="schematic-meta">
            Cancelled Dates:
            <div className="schematic-meta-sub">{weeksLabel}</div>
          </th>
        </tr>
        <tr>
          <th rowSpan={2} className="schematic-time-header">
            TIME
          </th>
          <th colSpan={columnCount} className="schematic-column-header">
            Instructors / Level
          </th>
          <th rowSpan={2} className="schematic-time-header">
            TIME
          </th>
        </tr>
        <tr>
          {Array.from({ length: columnCount }).map((_, index) => (
            <th key={`instructor-${index}`} className="schematic-instructor-header">
              {instructors[index] || `Instructor ${index + 1}`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {slots.map((slot, rowIndex) => (
          <tr key={`row-${slot}`}>
            <td className="schematic-time-cell">{formatTimeLabel(slot)}</td>
            {Array.from({ length: columnCount }).map((_, colIndex) => {
              const key = `${rowIndex}-${colIndex}`
              if (grid.skipMap.has(key)) {
                return null
              }
              const cell = grid.cellMap.get(key)
              if (!cell) {
                return <td key={key} className="schematic-empty-cell" />
              }
              const colorClass = cell.capacityClass.includes('rose')
                ? 'schematic-capacity-red'
                : cell.capacityClass.includes('amber')
                ? 'schematic-capacity-yellow'
                : 'schematic-capacity-green'
              return (
                <td key={key} rowSpan={cell.rowSpan} className="schematic-course-cell">
                  <div className="schematic-cell-inner">
                    <span className="schematic-corner" />
                    <div className="schematic-course-name">{cell.course.level}</div>
                    <div className="schematic-course-code">{cell.course.code}</div>
                    <div className={`schematic-capacity ${colorClass}`}>
                      {cell.course.studentCount} of {cell.capacity}
                    </div>
                  </div>
                </td>
              )
            })}
            <td className="schematic-time-cell">{formatTimeLabel(slot)}</td>
          </tr>
        ))}
        {slots.length === 0 && (
          <tr>
            <td colSpan={totalColumns} className="schematic-empty-state">
              No schedule data available.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export default SchematicPrintTable
