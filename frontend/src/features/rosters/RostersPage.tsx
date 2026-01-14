import React, { useEffect, useMemo, useState } from 'react'
import { useDay } from '../../app/DayContext'
import {
    clearDayData,
    getInstructorsForDay,
    getStudentsForDay,
    onStudentsUpdated,
    setStudentsForDay,
    updateStudentForDay,
} from '../../lib/storage'
import { extractStartTime } from '../../lib/time'
import type { Student } from '../../types/app'

type RosterGroup = {
    code: string
    serviceName: string
    level: string
    time: string
    instructor: string
    location: string
    schedule: string
    students: Student[]
}

function sanitizeLevel(level: string): string {
    if (!level) {
        return 'SplashFitness'
    }
    let sanitized = level.trim().replace(/\s+|\//g, '')
    if (sanitized.includes('Teen') && !sanitized.includes('TeenAdult')) {
        const parts = level.split(/[\s/]+/)
        sanitized = `TeenAdult${parts[2] ?? ''}`.trim()
    }
    if (sanitized.includes('Splash7')) return 'Splash7'
    if (sanitized.includes('Splash8')) return 'Splash8'
    if (sanitized.includes('Splash9')) return 'Splash9'
    return sanitized
}

function buildRosterGroups(students: Student[]): RosterGroup[] {
    const classesMap = new Map<string, RosterGroup>()

    students.forEach(student => {
        const existing = classesMap.get(student.code)
        if (!existing) {
            classesMap.set(student.code, {
                code: student.code,
                serviceName: student.service_name,
                level: student.level || student.service_name,
                time: student.time,
                instructor: student.instructor ?? '',
                location: student.location,
                schedule: student.schedule,
                students: [student],
            })
        } else {
            if (!existing.instructor && student.instructor) {
                existing.instructor = student.instructor
            }
            existing.students.push(student)
        }
    })

    const sorted = Array.from(classesMap.values())
    sorted.forEach(group => {
        group.students.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    })

    sorted.sort((a, b) => {
        const timeA = extractStartTime(a.time)
        const timeB = extractStartTime(b.time)
        return timeA.localeCompare(timeB)
    })

    return sorted
}

function RostersPage() {
    const { selectedDay } = useDay()
    const [multiSelect, setMultiSelect] = useState(false)
    const [instructorFilter, setInstructorFilter] = useState('')
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

    const rosters = useMemo(() => buildRosterGroups(students), [students])
    const instructorConfig = getInstructorsForDay(selectedDay)
    const instructorOptions = instructorConfig?.names?.filter(Boolean) ?? []

    const handleRosterInstructorChange = (code: string, instructor: string) => {
        const updated = students.map(student =>
            student.code === code ? { ...student, instructor } : student
        )
        setStudents(updated)
        setStudentsForDay(selectedDay, updated)
    }

    const handleRosterLevelChange = (code: string, level: string) => {
        const updated = students.map(student =>
            student.code === code ? { ...student, level } : student
        )
        setStudents(updated)
        setStudentsForDay(selectedDay, updated)
    }

    const handleStudentInstructorChange = (studentId: string, instructor: string) => {
        const updated = students.map(student =>
            student.id === studentId ? { ...student, instructor } : student
        )
        setStudents(updated)
        updateStudentForDay(selectedDay, studentId, { instructor })
    }

    const handleStudentLevelChange = (studentId: string, level: string) => {
        const updated = students.map(student =>
            student.id === studentId ? { ...student, level } : student
        )
        setStudents(updated)
        updateStudentForDay(selectedDay, studentId, { level })
    }

    const handlePrintRoster = async (roster: RosterGroup) => {
        const level = sanitizeLevel(roster.level)
        const levelUrl = `/swimming attendance/${level}.html`
        const fallbackUrl = `/swimming attendance/SplashFitness.html`

        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        document.body.appendChild(iframe)

        try {
            const res = await fetch(levelUrl, { method: 'HEAD' })
            iframe.src = res.ok ? levelUrl : fallbackUrl
        } catch (error) {
            iframe.src = fallbackUrl
        }

        iframe.onload = () => {
            const doc = iframe.contentDocument || iframe.contentWindow?.document
            if (!doc) {
                document.body.removeChild(iframe)
                return
            }

            const startDate = roster.schedule?.split(' ')[1] ?? ''
            doc.getElementById('instructor')!.textContent = roster.instructor
            doc.getElementById('start_time')!.textContent = `${startDate} ${roster.time}`.trim()
            doc.getElementById('session')!.textContent = 'Summer 2025'
            doc.getElementById('location')!.textContent = roster.location
            doc.getElementById('barcode')!.textContent = roster.code

            const templateRow = doc.getElementById('student-rows')
            const totalColumns = templateRow?.children.length ?? 1
            const emptyCells = Math.max(totalColumns - 1, 0)

            roster.students.forEach((student, index) => {
                const row = doc.createElement('tr')
                row.innerHTML = `
          <td><strong style="font-family: Arial;">${index + 1}. ${student.name}</strong>
            <font size="2"><br><span style="text-decoration: underline;">A</span>bsent/<span style="text-decoration: underline;">P</span>resent<br>
            <span style="color: rgb(191, 191, 191);">[Day 1] [Day 2] [Day 3] [Day 4] [Day 5] [Day 6] [Day 7] [Day 8] [Day 9] [Day 10] [Day 11] [Day 12] [Day 13] [Day 14]</span></font>
          </td>
          ${'<td>&nbsp;</td>'.repeat(emptyCells)}
        `
                doc.getElementById('attendance-rows')?.appendChild(row)
            })

            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
            setTimeout(() => document.body.removeChild(iframe), 1000)
        }
    }

    const handlePrintAll = () => {
        rosters.forEach(roster => handlePrintRoster(roster))
    }

    const handleClearAll = () => {
        if (!selectedDay) {
            return
        }
        if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            return
        }
        clearDayData(selectedDay)
        setStudents([])
    }

    const filteredRosters = rosters.filter(roster => {
        if (!instructorFilter) {
            return true
        }
        return roster.instructor === instructorFilter
    })

    const actionButtonClass =
        'rounded-2xl bg-primary px-4 py-2 text-white transition hover:-translate-y-0.5 hover:bg-secondary'
    const selectClass = 'w-full rounded-lg border-2 border-secondary bg-accent px-3 py-2 text-primary'
    const toggleClass = (active: boolean) =>
        [
            'rounded-2xl px-4 py-2 text-base font-semibold transition',
            active
                ? 'border-2 border-dashed border-secondary bg-accent text-secondary'
                : 'bg-secondary text-accent',
            'hover:-translate-y-0.5 hover:bg-accent hover:text-secondary',
        ].join(' ')
    const rowWidthClass = 'w-full max-w-[900px] mx-auto'

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex flex-col gap-6">
                <div className={`flex flex-col gap-3 md:flex-row ${rowWidthClass}`}>
                    <button type="button" className={actionButtonClass} onClick={handlePrintAll}>
                        Print All
                    </button>
                    <button type="button" className={actionButtonClass} onClick={handleClearAll}>
                        Clear All
                    </button>
                    <button
                        type="button"
                        className={toggleClass(multiSelect)}
                        onClick={() => setMultiSelect(value => !value)}
                    >
                        Multi-Select
                    </button>
                </div>

                <div className={`grid gap-3 md:grid-cols-3 ${rowWidthClass}`}>
                    <select
                        className={selectClass}
                        value={instructorFilter}
                        onChange={event => setInstructorFilter(event.target.value)}
                    >
                        <option value="">Filter Classes by Instructor</option>
                        {instructorOptions.map(instructor => (
                            <option key={instructor} value={instructor}>
                                {instructor}
                            </option>
                        ))}
                    </select>
                    <select className={selectClass} disabled>
                        <option value="">Change All Selected Levels</option>
                    </select>
                    <select className={selectClass} disabled>
                        <option value="">Change All Selected Instructors</option>
                    </select>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-6">
                        {filteredRosters.length === 0 && (
                            <p className="text-secondary">
                                No rosters loaded. Upload a CSV file to see rosters.
                            </p>
                        )}
                        {filteredRosters.map(roster => (
                            <div
                                className="rounded-2xl border-2 border-secondary/20 bg-accent p-6 shadow-md"
                                id={roster.code}
                                key={roster.code}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h2 className="text-lg font-semibold text-secondary">
                                        {roster.serviceName} : {roster.time}
                                    </h2>
                                    <button
                                        type="button"
                                        className="rounded-lg bg-primary px-3 py-1 text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                                        onClick={() => handlePrintRoster(roster)}
                                    >
                                        Print
                                    </button>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
                                    <div className="hidden md:block" />
                                    <select
                                        className={selectClass}
                                        value={roster.instructor}
                                        onChange={event => handleRosterInstructorChange(roster.code, event.target.value)}
                                    >
                                        <option value="">{roster.instructor ? roster.instructor : 'Select Instructor'}</option>
                                        {instructorOptions.map(instructor => (
                                            <option key={`${roster.code}-${instructor}`} value={instructor}>
                                                {instructor}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        className={selectClass}
                                        value={roster.level}
                                        onChange={event => handleRosterLevelChange(roster.code, event.target.value)}
                                    >
                                        <option value={roster.level}>{roster.level}</option>
                                        <optgroup label="Little Splash">
                                            <option value="LittleSplash1">Little Splash 1</option>
                                            <option value="LittleSplash2">Little Splash 2</option>
                                            <option value="LittleSplash3">Little Splash 3</option>
                                            <option value="LittleSplash4">Little Splash 4</option>
                                            <option value="LittleSplash5">Little Splash 5</option>
                                        </optgroup>
                                        <optgroup label="Parent and Tot">
                                            <option value="ParentandTot1">Parent and Tot 1</option>
                                            <option value="ParentandTot2">Parent and Tot 2</option>
                                            <option value="ParentandTot3">Parent and Tot 3</option>
                                        </optgroup>
                                        <optgroup label="Splash">
                                            <option value="Splash1">Splash 1</option>
                                            <option value="Splash2A">Splash 2A</option>
                                            <option value="Splash2B">Splash 2B</option>
                                            <option value="Splash3">Splash 3</option>
                                            <option value="Splash4">Splash 4</option>
                                            <option value="Splash5">Splash 5</option>
                                            <option value="Splash6">Splash 6</option>
                                            <option value="Splash7">Splash 7</option>
                                            <option value="Splash8">Splash 8</option>
                                            <option value="Splash9">Splash 9</option>
                                            <option value="SplashFitness">Splash Fitness</option>
                                        </optgroup>
                                        <optgroup label="Teen/Adult">
                                            <option value="TeenAdult1">Teen/Adult 1</option>
                                            <option value="TeenAdult2">Teen/Adult 2</option>
                                            <option value="TeenAdult3">Teen/Adult 3</option>
                                        </optgroup>
                                    </select>
                                </div>
                                {roster.students.map(student => (
                                    <div
                                        className="mt-3 grid grid-cols-1 items-center gap-3 md:grid-cols-[1.2fr_1fr_1fr]"
                                        key={student.id}
                                    >
                                        <p className="text-secondary">{student.name.replaceAll('"', '')}</p>
                                        <select
                                            className={selectClass}
                                            value={student.instructor}
                                            onChange={event => handleStudentInstructorChange(student.id, event.target.value)}
                                        >
                                            <option value="">{student.instructor || 'Select Instructor'}</option>
                                            {instructorOptions.map(instructor => (
                                                <option key={`${student.id}-${instructor}`} value={instructor}>
                                                    {instructor}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            className={selectClass}
                                            value={student.level}
                                            onChange={event => handleStudentLevelChange(student.id, event.target.value)}
                                        >
                                            <option value={student.level}>{student.level}</option>
                                            <optgroup label="Little Splash">
                                                <option value="LittleSplash1">Little Splash 1</option>
                                                <option value="LittleSplash2">Little Splash 2</option>
                                                <option value="LittleSplash3">Little Splash 3</option>
                                                <option value="LittleSplash4">Little Splash 4</option>
                                                <option value="LittleSplash5">Little Splash 5</option>
                                            </optgroup>
                                            <optgroup label="Parent and Tot">
                                                <option value="ParentandTot1">Parent and Tot 1</option>
                                                <option value="ParentandTot2">Parent and Tot 2</option>
                                                <option value="ParentandTot3">Parent and Tot 3</option>
                                            </optgroup>
                                            <optgroup label="Splash">
                                                <option value="Splash1">Splash 1</option>
                                                <option value="Splash2A">Splash 2A</option>
                                                <option value="Splash2B">Splash 2B</option>
                                                <option value="Splash3">Splash 3</option>
                                                <option value="Splash4">Splash 4</option>
                                                <option value="Splash5">Splash 5</option>
                                                <option value="Splash6">Splash 6</option>
                                                <option value="Splash7">Splash 7</option>
                                                <option value="Splash8">Splash 8</option>
                                                <option value="Splash9">Splash 9</option>
                                                <option value="SplashFitness">Splash Fitness</option>
                                            </optgroup>
                                            <optgroup label="Teen/Adult">
                                                <option value="TeenAdult1">Teen/Adult 1</option>
                                                <option value="TeenAdult2">Teen/Adult 2</option>
                                                <option value="TeenAdult3">Teen/Adult 3</option>
                                        </optgroup>
                                    </select>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
    )
}

export default RostersPage
