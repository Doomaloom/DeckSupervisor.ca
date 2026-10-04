import { useEffect, useState } from 'react'
import { showAppNotice } from '../../../lib/appNotice'
import type { Course, DragState } from '../types'
import { getLockedInstructorForColumn, createRequestAwareLayout, type StoredCourseLayout } from '../utils/layout'
import { canPlaceCourses, canReplaceByStart, canSwapSingleCourses, findContiguousSwapIndices } from '../utils/drag'

function sortCoursesByStart(courses: Course[]) {
    return [...courses].sort((left, right) => left.startTime.localeCompare(right.startTime))
}

function clearSelectionAndDrag(course: Course, columnIndex: number) {
    return {
        codes: [course.code],
        columnIndex,
    }
}

function findSwapCandidatesForBlock(sourceColumn: Course[], targetColumn: Course[], movingCourses: Course[]) {
    if (movingCourses.length === 0) {
        return []
    }

    const overlapping = sortCoursesByStart(
        targetColumn.filter(entry => movingCourses.some(course => course.startMinutes < entry.endMinutes && entry.startMinutes < course.endMinutes)),
    )
    if (overlapping.length === 0) {
        return []
    }

    if (overlapping.some(course => course.isLockedToInstructor)) {
        return []
    }

    const remainingTargetCourses = targetColumn.filter(
        course => !overlapping.some(entry => entry.code === course.code),
    )
    if (!canPlaceCourses(remainingTargetCourses, movingCourses)) {
        return []
    }

    if (!canPlaceCourses(sourceColumn, overlapping)) {
        return []
    }

    return overlapping
}

type UseSchematicBoardArgs = {
    courses: Course[]
    storedLayout?: StoredCourseLayout | null
    allowStoredEmptyColumns?: boolean
    instructorRoster?: { id: string; name: string }[]
}

export function useSchematicBoard({
    courses,
    storedLayout = null,
    allowStoredEmptyColumns = true,
    instructorRoster,
}: UseSchematicBoardArgs) {
    const [columns, setColumns] = useState<Course[][]>([])
    const [assignmentIds, setAssignmentIds] = useState<string[]>([])
    const [instructors, setInstructors] = useState<string[]>([])
    const [instructorIds, setInstructorIds] = useState<(string | null)[]>([])
    const [lockedInstructors, setLockedInstructors] = useState<string[]>([])
    const [dragged, setDragged] = useState<DragState | null>(null)
    const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([])
    const [extraEmptyColumns, setExtraEmptyColumns] = useState(0)
    const storedLayoutKey = `${(storedLayout?.codes ?? []).join('\u0001')}::${(storedLayout?.instructors ?? []).join('\u0001')}::${(storedLayout?.instructorIds ?? []).join('\u0001')}`

    useEffect(() => {
        setExtraEmptyColumns(0)
    }, [allowStoredEmptyColumns, storedLayoutKey])

    useEffect(() => {
        const storedInstructorByCode = new Map((storedLayout?.codes ?? []).flatMap((codes, index) =>
            codes.split(',').filter(Boolean).map(code => [code, storedLayout?.instructorIds?.[index]] as const)))
        const effectiveCourses = instructorRoster ? courses.map(course => {
            const storedId = storedInstructorByCode.get(course.code)
            if (storedId !== undefined) {
                const row = instructorRoster.find(entry => entry.id === storedId)
                return row && course.isLockedToInstructor
                    ? { ...course, assignedInstructor: row.name }
                    : { ...course, assignedInstructor: '', isLockedToInstructor: false }
            }
            const matches = instructorRoster.filter(row => row.name && row.name === course.assignedInstructor)
            return matches.length !== 1 ? { ...course, assignedInstructor: '', isLockedToInstructor: false } : course
        }) : courses
        const layout = createRequestAwareLayout(effectiveCourses, storedLayout)
        for (let index = 0; index < extraEmptyColumns; index += 1) {
            layout.columns.push([])
            layout.instructors.push('')
            layout.lockedInstructors.push('')
        }
        setAssignmentIds(layout.columns.map((_, index) => storedLayout?.assignmentIds?.[index] ?? crypto.randomUUID()))
        setColumns(layout.columns)
        const ids = layout.columns.map((_, index) => {
            if (storedLayout?.instructorIds && index < storedLayout.instructorIds.length) return storedLayout.instructorIds[index]
            const matches = instructorRoster?.filter(row => row.name && row.name === layout.instructors[index]) ?? []
            return matches.length === 1 ? matches[0].id : null
        })
        setInstructorIds(ids)
        setInstructors(instructorRoster ? ids.map(id => instructorRoster.find(row => row.id === id)?.name ?? '') : layout.instructors)
        setLockedInstructors(layout.lockedInstructors)
    }, [courses, extraEmptyColumns, storedLayout, storedLayoutKey, instructorRoster])

    useEffect(() => {
        setSelectedCourseCodes(current => current.filter(code => courses.some(course => course.code === code)))
        setDragged(current => {
            if (!current) {
                return null
            }
            const nextCodes = current.codes.filter(code => courses.some(course => course.code === code))
            if (nextCodes.length === 0) {
                return null
            }
            return { ...current, codes: nextCodes }
        })
    }, [courses])

    const toggleCourseSelection = (course: Course, columnIndex: number) => {
        if (course.isLockedToInstructor) {
            setSelectedCourseCodes([course.code])
            return
        }
        setSelectedCourseCodes(current => {
            if (current.includes(course.code)) {
                return current.filter(code => code !== course.code)
            }
            const selectionIsFromSameColumn =
                current.length > 0 &&
                current.every(code => (columns[columnIndex] ?? []).some(entry => entry.code === code))
            if (!selectionIsFromSameColumn) {
                return [course.code]
            }
            return [...current, course.code]
        })
    }

    const handleDragStart = (event: React.DragEvent<HTMLDivElement>, course: Course, columnIndex: number) => {
        if (course.isLockedToInstructor) {
            event.preventDefault()
            return
        }
        const selectedInSameColumn =
            selectedCourseCodes.length > 0 &&
            selectedCourseCodes.includes(course.code) &&
            selectedCourseCodes.every(code => (columns[columnIndex] ?? []).some(entry => entry.code === code))
                ? selectedCourseCodes
                : null
        const nextDragged = selectedInSameColumn
            ? { codes: selectedInSameColumn, columnIndex }
            : clearSelectionAndDrag(course, columnIndex)

        setSelectedCourseCodes(selectedInSameColumn ?? [])
        setDragged(nextDragged)
        const target = event.currentTarget
        const rect = target.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top
        event.dataTransfer.setDragImage(target, offsetX, offsetY)
    }

    const handleDrop = (columnIndex: number) => {
        if (!dragged) {
            return
        }
        setColumns(current => {
            const next = current.map(column => [...column])
            const sourceColumn = next[dragged.columnIndex]
            const movingCourses = sortCoursesByStart(sourceColumn.filter(course => dragged.codes.includes(course.code)))
            if (movingCourses.length !== dragged.codes.length || movingCourses.some(course => course.isLockedToInstructor)) {
                return current
            }
            next[dragged.columnIndex] = sourceColumn.filter(course => !dragged.codes.includes(course.code))
            const targetColumn = next[columnIndex]
            if (dragged.columnIndex === columnIndex) {
                next[columnIndex] = sortCoursesByStart([...targetColumn, ...movingCourses])
                return next
            }
            if (!canPlaceCourses(targetColumn, movingCourses)) {
                const swapCourses = findSwapCandidatesForBlock(next[dragged.columnIndex], targetColumn, movingCourses)
                if (swapCourses.length === 0) {
                    return current
                }
                next[columnIndex] = sortCoursesByStart(
                    targetColumn.filter(course => !swapCourses.some(entry => entry.code === course.code)).concat(movingCourses),
                )
                next[dragged.columnIndex] = sortCoursesByStart([...next[dragged.columnIndex], ...swapCourses])
                return next
            }
            next[columnIndex] = sortCoursesByStart([...targetColumn, ...movingCourses])
            return next
        })
        setDragged(null)
        setSelectedCourseCodes([])
    }

    const handleDropOnCourse = (targetCourse: Course, targetColumnIndex: number) => {
        if (!dragged) {
            return
        }
        if (dragged.columnIndex === targetColumnIndex && dragged.codes.includes(targetCourse.code)) {
            setDragged(null)
            return
        }
        if (dragged.codes.length > 1) {
            handleDrop(targetColumnIndex)
            return
        }

        setColumns(current => {
            const next = current.map(column => [...column])
            const sourceColumn = next[dragged.columnIndex]
            const sourceIndex = sourceColumn.findIndex(course => course.code === dragged.codes[0])
            const targetColumn = next[targetColumnIndex]
            const targetIndex = targetColumn.findIndex(course => course.code === targetCourse.code)
            if (sourceIndex === -1 || targetIndex === -1) {
                return current
            }

            const [sourceCourse] = sourceColumn.splice(sourceIndex, 1)
            if (sourceCourse.isLockedToInstructor || targetCourse.isLockedToInstructor) {
                sourceColumn.splice(sourceIndex, 0, sourceCourse)
                return current
            }

            const swapIndices = findContiguousSwapIndices(targetColumn, sourceCourse)
            if (swapIndices.length > 0) {
                const swapCourses = swapIndices.map(index => targetColumn[index])
                if (!canPlaceCourses(sourceColumn, swapCourses)) {
                    sourceColumn.splice(sourceIndex, 0, sourceCourse)
                    return current
                }
                const removed = swapIndices
                    .slice()
                    .sort((left, right) => right - left)
                    .map(index => targetColumn.splice(index, 1)[0])
                sourceColumn.push(...removed)
                targetColumn.push(sourceCourse)
                next[dragged.columnIndex] = sortCoursesByStart(sourceColumn)
                next[targetColumnIndex] = sortCoursesByStart(targetColumn)
                return next
            }

            if (canReplaceByStart(targetColumn, sourceCourse, targetIndex)) {
                const destinationCourse = targetColumn[targetIndex]
                if (!destinationCourse || !canPlaceCourses(sourceColumn, [destinationCourse])) {
                    sourceColumn.splice(sourceIndex, 0, sourceCourse)
                    return current
                }
                targetColumn.splice(targetIndex, 1)
                sourceColumn.push(destinationCourse)
                targetColumn.push(sourceCourse)
                next[dragged.columnIndex] = sortCoursesByStart(sourceColumn)
                next[targetColumnIndex] = sortCoursesByStart(targetColumn)
                return next
            }

            const destinationCourse = targetColumn[targetIndex]
            if (!destinationCourse || !canSwapSingleCourses(sourceColumn, targetColumn, sourceCourse, destinationCourse)) {
                sourceColumn.splice(sourceIndex, 0, sourceCourse)
                return current
            }
            targetColumn.splice(targetIndex, 1)
            sourceColumn.push(destinationCourse)
            targetColumn.push(sourceCourse)
            next[dragged.columnIndex] = sortCoursesByStart(sourceColumn)
            next[targetColumnIndex] = sortCoursesByStart(targetColumn)
            return next
        })
        setDragged(null)
        setSelectedCourseCodes([])
    }

    const addTemporaryColumn = () => {
        setAssignmentIds(current => [...current, crypto.randomUUID()])
        setColumns(current => [...current, []])
        setInstructors(current => [...current, ''])
        setInstructorIds(current => [...current, null])
        setLockedInstructors(current => [...current, ''])
        setExtraEmptyColumns(current => current + 1)
    }

    const removeEmptyColumns = () => {
        const keepIndices = columns
            .map((column, index) => ({ column, index }))
            .filter(({ column }) => column.length > 0)
            .map(({ index }) => index)
        setAssignmentIds(keepIndices.map(index => assignmentIds[index]))
        setColumns(keepIndices.map(index => columns[index]))
        setInstructors(keepIndices.map(index => instructors[index] ?? ''))
        setInstructorIds(keepIndices.map(index => instructorIds[index] ?? null))
        setLockedInstructors(keepIndices.map(index => lockedInstructors[index] ?? ''))
        setExtraEmptyColumns(0)
    }

    const setInstructorAt = (index: number, value: string) => {
        const name = instructorRoster ? instructorRoster.find(row => row.id === value)?.name ?? '' : value
        const lockedInstructor = getLockedInstructorForColumn(columns[index] ?? [])
        if (lockedInstructor && name !== lockedInstructor) {
            showAppNotice(`This column is locked to ${lockedInstructor} because it contains a requested class.`, 'info')
            return
        }
        setInstructors(current => {
            const next = [...current]
            next[index] = lockedInstructor || name
            return next
        })
        setInstructorIds(current => current.map((id, i) => i === index ? value || null : id))
    }

    return {
        assignmentIds,
        instructorIds,
        columns,
        instructors,
        lockedInstructors,
        selectedCourseCodes,
        toggleCourseSelection,
        handleDragStart,
        handleDrop,
        handleDropOnCourse,
        addTemporaryColumn,
        removeEmptyColumns,
        setInstructorAt,
    }
}
