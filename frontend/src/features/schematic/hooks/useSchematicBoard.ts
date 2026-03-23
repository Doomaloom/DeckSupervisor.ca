import { useEffect, useState } from 'react'
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
}

export function useSchematicBoard({
    courses,
    storedLayout = null,
    allowStoredEmptyColumns = true,
}: UseSchematicBoardArgs) {
    const [columns, setColumns] = useState<Course[][]>([])
    const [instructors, setInstructors] = useState<string[]>([])
    const [lockedInstructors, setLockedInstructors] = useState<string[]>([])
    const [dragged, setDragged] = useState<DragState | null>(null)
    const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([])
    const [extraEmptyColumns, setExtraEmptyColumns] = useState(0)

    useEffect(() => {
        const emptyStoredColumns = allowStoredEmptyColumns
            ? (storedLayout?.codes ?? []).filter(code => !code.trim()).length
            : 0
        setExtraEmptyColumns(emptyStoredColumns)
    }, [allowStoredEmptyColumns, storedLayout])

    useEffect(() => {
        const layout = createRequestAwareLayout(courses, storedLayout)
        for (let index = 0; index < extraEmptyColumns; index += 1) {
            layout.columns.push([])
            layout.instructors.push('')
            layout.lockedInstructors.push('')
        }
        setColumns(layout.columns)
        setInstructors(layout.instructors)
        setLockedInstructors(layout.lockedInstructors)
    }, [courses, extraEmptyColumns, storedLayout])

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
        setColumns(current => [...current, []])
        setInstructors(current => [...current, ''])
        setLockedInstructors(current => [...current, ''])
        setExtraEmptyColumns(current => current + 1)
    }

    const removeEmptyColumns = () => {
        const keepIndices = columns
            .map((column, index) => ({ column, index }))
            .filter(({ column }) => column.length > 0)
            .map(({ index }) => index)
        setColumns(keepIndices.map(index => columns[index]))
        setInstructors(keepIndices.map(index => instructors[index] ?? ''))
        setLockedInstructors(keepIndices.map(index => lockedInstructors[index] ?? ''))
        setExtraEmptyColumns(0)
    }

    const setInstructorAt = (index: number, value: string) => {
        const lockedInstructor = getLockedInstructorForColumn(columns[index] ?? [])
        if (lockedInstructor && value !== lockedInstructor) {
            alert(`This column is locked to ${lockedInstructor} because it contains a requested class.`)
            return
        }
        setInstructors(current => {
            const next = [...current]
            next[index] = lockedInstructor || value
            return next
        })
    }

    return {
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
