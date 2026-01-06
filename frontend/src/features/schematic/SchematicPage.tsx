import React, { useEffect, useMemo, useState } from 'react'
import { useDay } from '../../app/DayContext'
import { processCsvAndStore } from '../../lib/api'
import { extractEndTime, extractStartTime, getRunningMinutes } from '../../lib/time'
import { getScheduleForDay, getStudentsForDay, onStudentsUpdated, setScheduleForDay } from '../../lib/storage'
import type { Student } from '../../types/app'

type Course = {
  code: string
  level: string
  runningTime: number
  startTime: string
  endTime: string
}

type DragState = {
  code: string
  columnIndex: number
}

function buildCourses(students: Student[]): Course[] {
  const map = new Map<string, Course>()
  students.forEach(student => {
    if (map.has(student.code)) {
      return
    }
    const startTime = extractStartTime(student.time)
    const endTime = extractEndTime(student.time)
    map.set(student.code, {
      code: student.code,
      level: student.level || student.service_name,
      runningTime: getRunningMinutes(student.time),
      startTime,
      endTime,
    })
  })

  return Array.from(map.values()).sort((a, b) => {
    if (a.startTime === b.startTime) {
      return a.endTime.localeCompare(b.endTime)
    }
    return a.startTime.localeCompare(b.startTime)
  })
}

function buildColumns(courses: Course[]): Course[][] {
  const columns: Course[][] = []
  courses.forEach(course => {
    let added = false
    for (const column of columns) {
      const lastCourse = column[column.length - 1]
      if (lastCourse.endTime <= course.startTime) {
        column.push(course)
        added = true
        break
      }
    }
    if (!added) {
      columns.push([course])
    }
  })
  return columns
}

function buildTimeLabels(start: string, end: string): string[] {
  if (!start || !end) {
    return []
  }
  const labels: string[] = []
  const startDate = new Date(`1970-01-01T${start}:00`)
  const endDate = new Date(`1970-01-01T${end}:00`)
  const startMinutes = startDate.getMinutes()
  if (startMinutes % 15 !== 0) {
    startDate.setMinutes(startMinutes - (startMinutes % 15), 0, 0)
  }
  let current = startDate
  while (current <= endDate) {
    labels.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }))
    current = new Date(current.getTime() + 15 * 60000)
  }
  return labels
}

function SchematicPage() {
  const { selectedDay } = useDay()
  const [columns, setColumns] = useState<Course[][]>([])
  const [instructors, setInstructors] = useState<string[]>([])
  const [dragged, setDragged] = useState<DragState | null>(null)
  const [fileStatus, setFileStatus] = useState('No file selected.')
  const [students, setStudents] = useState<Student[]>([])

  useEffect(() => {
    setStudents(getStudentsForDay(selectedDay))
  }, [selectedDay])

  useEffect(() => {
    return onStudentsUpdated(day => {
      if (day === selectedDay) {
        setStudents(getStudentsForDay(selectedDay))
      }
    })
  }, [selectedDay])
  const courses = useMemo(() => buildCourses(students), [students])
  const timeLabels = useMemo(() => {
    const earliest = courses[0]?.startTime ?? ''
    const latest = courses.reduce((latestEnd, course) => {
      return course.endTime > latestEnd ? course.endTime : latestEnd
    }, '00:00')
    return buildTimeLabels(earliest, latest)
  }, [courses])

  useEffect(() => {
    const initialColumns = buildColumns(courses)
    const stored = getScheduleForDay(selectedDay)

    if (stored && stored.codes.length > 0) {
      const courseMap = new Map(courses.map(course => [course.code, course]))
      const nextColumns = stored.codes
        .map(codes => codes.split(',').map(code => courseMap.get(code)).filter(Boolean) as Course[])
        .filter(column => column.length > 0)
      setColumns(nextColumns.length ? nextColumns : initialColumns)
      setInstructors(stored.instructors ?? [])
    } else {
      setColumns(initialColumns)
      setInstructors(initialColumns.map(() => ''))
    }
  }, [courses, selectedDay])

  const handleDragStart = (course: Course, columnIndex: number) => {
    setDragged({ code: course.code, columnIndex })
  }

  const handleDrop = (columnIndex: number) => {
    if (!dragged) {
      return
    }
    setColumns(current => {
      const next = current.map(column => [...column])
      const sourceColumn = next[dragged.columnIndex]
      const courseIndex = sourceColumn.findIndex(course => course.code === dragged.code)
      if (courseIndex === -1) {
        return current
      }
      const [course] = sourceColumn.splice(courseIndex, 1)
      next[columnIndex].push(course)
      next[columnIndex].sort((a, b) => a.startTime.localeCompare(b.startTime))
      return next.filter(column => column.length > 0)
    })
    setDragged(null)
  }

  const handleFileChange = async (nextFile: File | null) => {
    if (!nextFile) {
      setFileStatus('No file selected.')
      return
    }
    if (!selectedDay) {
      alert('Please select a day before uploading.')
      return
    }
    setFileStatus(`File Uploaded: ${nextFile.name}`)
    await processCsvAndStore(nextFile, selectedDay)
    setStudents(getStudentsForDay(selectedDay))
  }

  const handleSaveSchedule = () => {
    if (!selectedDay) {
      alert('Please select a day first.')
      return
    }
    const codes = columns.map(column => column.map(course => course.code).join(','))
    setScheduleForDay(selectedDay, {
      instructors,
      codes,
    })
    alert('Schedule saved successfully!')
  }

  return (
    <div className="schematic">
      <div
        className="drop-zone"
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault()
          handleFileChange(event.dataTransfer.files?.[0] ?? null)
        }}
      >
        <p>Drag & Drop your .csv file here or click to select</p>
        <input
          type="file"
          name="csv_file"
          accept=".csv"
          style={{ opacity: 0 }}
          onChange={event => handleFileChange(event.target.files?.[0] ?? null)}
        />
      </div>
      <div id="file-status">{fileStatus}</div>

      <div className="schematic-container">
        <div className="time-sidebar" id="time-sidebar-left">
          {timeLabels.map(label => (
            <div className="time-label" key={`left-${label}`}>
              {label}
            </div>
          ))}
        </div>

        <div className="main-content" id="main-content">
          {columns.length === 0 && <p>No schedule data loaded. Upload a CSV file to generate the schedule.</p>}
          {columns.map((column, columnIndex) => (
            <div
              className="column"
              key={`column-${columnIndex}`}
              onDragOver={event => event.preventDefault()}
              onDrop={() => handleDrop(columnIndex)}
            >
              <div className="instructor-header">
                <input
                  className="instructor-input"
                  type="text"
                  value={instructors[columnIndex] ?? ''}
                  onChange={event => {
                    const value = event.target.value
                    setInstructors(current => {
                      const next = [...current]
                      next[columnIndex] = value
                      return next
                    })
                  }}
                />
              </div>
              {column.map(course => (
                <div
                  key={course.code}
                  className="code-entry"
                  draggable
                  onDragStart={() => handleDragStart(course, columnIndex)}
                  style={{ height: `${course.runningTime / 5}rem` }}
                >
                  <p>{course.code}</p>
                  <p>{course.level}</p>
                  <p>{course.runningTime} min</p>
                  <p>
                    {course.startTime} - {course.endTime}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="time-sidebar" id="time-sidebar-right">
          {timeLabels.map(label => (
            <div className="time-label" key={`right-${label}`}>
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="schematic-actions">
        <button className="btn" onClick={handleSaveSchedule}>
          Save Schedule
        </button>
      </div>
    </div>
  )
}

export default SchematicPage
