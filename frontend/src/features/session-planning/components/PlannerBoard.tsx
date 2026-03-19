import React from 'react'
import type { PlannerClass } from '../../../types/app'
import TimeRail from '../../schematic/components/TimeRail'
import { dayNames, getPlannerBoardStatusClasses, capacityClasses, type PlannerBoardCourse } from '../utils/plannerPresentation'
import {
  canPlacePlannerCourses,
  canReplacePlannerByStart,
  canSwapSinglePlannerCourses,
  findPlannerContiguousSwapIndices,
} from '../utils/plannerDrag'

type PlannerBoardProps = {
  availableDays: string[]
  availableLocations: string[]
  boardColumns: PlannerBoardCourse[][]
  scheduleHeightRem: number
  scheduleStartMinutes: number
  selectedClassKey: string
  selectedDay: string
  selectedLocation: string
  setClassLanes: (laneIndexes: Record<string, number>) => void | Promise<void>
  setIsInfoPanelOpen: (value: boolean) => void
  setSelectedClassKey: (value: string) => void
  setSelectedDay: (value: string) => void
  setSelectedLocation: (value: string) => void
  timeLabels: string[]
  visibleClasses: PlannerClass[]
  columnMinWidthPx: number
  headerHeightRem: number
  slotHeightRem: number
  slotMinutes: number
}

function PlannerBoard({
  availableDays,
  availableLocations,
  boardColumns,
  scheduleHeightRem,
  scheduleStartMinutes,
  selectedClassKey,
  selectedDay,
  selectedLocation,
  setClassLanes,
  setIsInfoPanelOpen,
  setSelectedClassKey,
  setSelectedDay,
  setSelectedLocation,
  timeLabels,
  visibleClasses,
  columnMinWidthPx,
  headerHeightRem,
  slotHeightRem,
  slotMinutes,
}: PlannerBoardProps) {
  const [dragged, setDragged] = React.useState<{ classKey: string; columnIndex: number } | null>(null)

  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    course: PlannerBoardCourse,
    columnIndex: number,
  ) => {
    setDragged({ classKey: course.classKey, columnIndex })
    const target = event.currentTarget
    const rect = target.getBoundingClientRect()
    event.dataTransfer.setDragImage(target, event.clientX - rect.left, event.clientY - rect.top)
  }

  const handleColumnDrop = async (columnIndex: number) => {
    if (!dragged) {
      return
    }
    const sourceColumn = boardColumns[dragged.columnIndex] ?? []
    const sourceCourse = sourceColumn.find(course => course.classKey === dragged.classKey)
    if (!sourceCourse) {
      setDragged(null)
      return
    }
    if (dragged.columnIndex === columnIndex) {
      setDragged(null)
      return
    }

    const targetColumn = boardColumns[columnIndex] ?? []
    const swapIndices = findPlannerContiguousSwapIndices(targetColumn, sourceCourse)
    if (swapIndices.length > 0) {
      const swapCourses = swapIndices.map(index => targetColumn[index]).filter(Boolean)
      if (canPlacePlannerCourses(sourceColumn.filter(course => course.classKey !== sourceCourse.classKey), swapCourses)) {
        await setClassLanes({
          [sourceCourse.classKey]: columnIndex,
          ...Object.fromEntries(swapCourses.map(course => [course.classKey, dragged.columnIndex])),
        })
      }
      setDragged(null)
      return
    }

    if (!targetColumn.some(target => target.startMinutes < sourceCourse.endMinutes && sourceCourse.startMinutes < target.endMinutes)) {
      await setClassLanes({ [sourceCourse.classKey]: columnIndex })
    }
    setDragged(null)
  }

  const handleCourseDrop = async (targetCourse: PlannerBoardCourse, targetColumnIndex: number) => {
    if (!dragged) {
      return
    }
    if (dragged.columnIndex === targetColumnIndex && dragged.classKey === targetCourse.classKey) {
      setDragged(null)
      return
    }

    const sourceColumn = boardColumns[dragged.columnIndex] ?? []
    const sourceCourse = sourceColumn.find(course => course.classKey === dragged.classKey)
    const targetColumn = boardColumns[targetColumnIndex] ?? []
    const targetIndex = targetColumn.findIndex(course => course.classKey === targetCourse.classKey)
    if (!sourceCourse || targetIndex === -1) {
      setDragged(null)
      return
    }

    const swapIndices = findPlannerContiguousSwapIndices(targetColumn, sourceCourse)
    if (swapIndices.length > 0) {
      const swapCourses = swapIndices.map(index => targetColumn[index]).filter(Boolean)
      if (canPlacePlannerCourses(sourceColumn.filter(course => course.classKey !== sourceCourse.classKey), swapCourses)) {
        await setClassLanes({
          [sourceCourse.classKey]: targetColumnIndex,
          ...Object.fromEntries(swapCourses.map(course => [course.classKey, dragged.columnIndex])),
        })
      }
      setDragged(null)
      return
    }

    if (canReplacePlannerByStart(targetColumn, sourceCourse, targetIndex)) {
      const destinationCourse = targetColumn[targetIndex]
      if (destinationCourse && canPlacePlannerCourses(sourceColumn.filter(course => course.classKey !== sourceCourse.classKey), [destinationCourse])) {
        await setClassLanes({
          [sourceCourse.classKey]: targetColumnIndex,
          [destinationCourse.classKey]: dragged.columnIndex,
        })
      }
      setDragged(null)
      return
    }

    const destinationCourse = targetColumn[targetIndex]
    if (destinationCourse && canSwapSinglePlannerCourses(sourceColumn, targetColumn, sourceCourse, destinationCourse)) {
      await setClassLanes({
        [sourceCourse.classKey]: targetColumnIndex,
        [destinationCourse.classKey]: dragged.columnIndex,
      })
    }
    setDragged(null)
  }

  return (
    <div id="planner-board" data-component="planner-board" className="flex min-h-[70vh] flex-col gap-4 rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
      <div className="flex flex-wrap gap-2">
        {availableDays.map(day => (
          <button
            key={day}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedDay === day ? 'bg-secondary text-accent' : 'bg-bg text-secondary hover:bg-secondary/10'}`}
            onClick={() => setSelectedDay(day)}
          >
            {dayNames[day] ?? day}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {availableLocations.map(location => (
          <button
            key={location}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedLocation === location ? 'bg-primary text-accent' : 'bg-bg text-secondary hover:bg-primary/10'}`}
            onClick={() => setSelectedLocation(location)}
          >
            {location}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto pr-1">
        {visibleClasses.length === 0 ? (
          <div className="rounded-2xl border border-secondary/20 bg-bg p-5 text-sm text-secondary/70">
            No classes found for this day and location.
          </div>
        ) : (
          <div className="flex min-w-[760px] items-start justify-center gap-4">
            <TimeRail
              className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary"
              headerHeightRem={headerHeightRem}
              slotHeightRem={slotHeightRem}
              labels={timeLabels}
              keyPrefix="planner-left"
            />

            <div className="flex-1">
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-primary px-4 py-2 text-center font-semibold text-accent">
                  {dayNames[selectedDay] ?? selectedDay} • {selectedLocation}
                </div>
                <div className="flex">
                  {boardColumns.map((column, columnIndex) => (
                    <div
                      key={`planner-column-${columnIndex}`}
                      className="flex flex-1 flex-col"
                      style={{ minWidth: `${columnMinWidthPx}px` }}
                      onDragOver={event => event.preventDefault()}
                      onDrop={() => void handleColumnDrop(columnIndex)}
                    >
                      <div className={`border border-black bg-accent p-2 ${columnIndex === 0 ? 'border-black' : 'border-black border-l-0'}`}>
                        <div className="w-full rounded-none border border-black bg-white px-2 py-1 text-center text-sm font-semibold text-black">
                          Class Lane {columnIndex + 1}
                        </div>
                      </div>
                      <div
                        className={`relative border border-black border-t-0 bg-bg ${columnIndex === 0 ? 'border-black' : 'border-black border-l-0'}`}
                        style={{ height: `${scheduleHeightRem}rem` }}
                      >
                        {column.map(course => {
                          const startOffset = (course.startMinutes - scheduleStartMinutes) / slotMinutes
                          const courseHeight = course.runningTime / slotMinutes
                          const plannerClass = visibleClasses.find(item => item.classKey === course.classKey)
                          const isSelected = selectedClassKey === course.classKey
                          const statusLabel =
                            course.planningStatus === 'pending_cancellation'
                              ? 'Pending Cancellation'
                              : course.planningStatus === 'cancelled'
                                ? 'Cancelled'
                                : ''
                          return (
                            <button
                              key={course.classKey}
                              type="button"
                              draggable
                              className={`absolute left-0 right-0 flex flex-col overflow-hidden border text-left text-xs transition hover:z-10 hover:-translate-y-0.5 ${getPlannerBoardStatusClasses(course.planningStatus, isSelected)} ${plannerClass ? capacityClasses(plannerClass) : 'bg-white'}`}
                              onClick={() => {
                                setSelectedClassKey(course.classKey)
                                setIsInfoPanelOpen(true)
                              }}
                              onDragStart={event => handleDragStart(event, course, columnIndex)}
                              onDragOver={event => event.preventDefault()}
                              onDrop={() => void handleCourseDrop(course, columnIndex)}
                              style={{
                                top: `${startOffset * slotHeightRem}rem`,
                                height: `${courseHeight * slotHeightRem}rem`,
                              }}
                            >
                              <div className="flex flex-1 flex-col gap-1 px-2 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-2 font-semibold">{course.serviceName}</p>
                                  <span className="rounded-full border border-black/20 bg-white/70 px-1.5 py-0.5 text-[0.6rem] font-semibold">
                                    {course.eventId}
                                  </span>
                                </div>
                                {statusLabel ? (
                                  <span className="w-fit rounded-full border border-current/20 bg-white/65 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em]">
                                    {statusLabel}
                                  </span>
                                ) : null}
                                <p className="text-[0.7rem]">{course.eventTime}</p>
                              </div>
                              <div className="border-t border-black bg-white/70 px-2 py-0.5 text-center text-[0.7rem] font-semibold">
                                {course.bookedCount} / {course.maximumCapacity} • W {course.waitlistCount}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <TimeRail
              className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary"
              headerHeightRem={headerHeightRem}
              slotHeightRem={slotHeightRem}
              labels={timeLabels}
              keyPrefix="planner-right"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default PlannerBoard
