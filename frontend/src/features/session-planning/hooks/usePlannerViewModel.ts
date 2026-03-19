import { useEffect, useMemo, useState } from 'react'
import type { PlannerDataset, PlannerParticipant } from '../../../types/app'
import { getPlannerAlternativeClasses } from '../../../lib/sessionPlanner'
import { COLUMN_MIN_WIDTH_PX, HEADER_HEIGHT_REM, SLOT_MINUTES } from '../../schematic/constants'
import { buildTimeLabels, timeToMinutes } from '../../schematic/utils/time'
import {
  buildPlannerBoardColumns,
  buildPlannerBoardCourses,
  dayOrder,
  PLANNER_SLOT_HEIGHT_REM,
} from '../utils/plannerPresentation'

type PlannerSelectionState = {
  selectedDay: string
  selectedLocation: string
  selectedClassKey: string
  setSelectedDay: (value: string) => void
  setSelectedLocation: (value: string) => void
  setSelectedClassKey: (value: string) => void
}

export function usePlannerViewModel(
  dataset: PlannerDataset | null,
  activeCallParticipantId: string,
  selectionState?: PlannerSelectionState,
) {
  const [localSelectedDay, setLocalSelectedDay] = useState('')
  const [localSelectedLocation, setLocalSelectedLocation] = useState('')
  const [localSelectedClassKey, setLocalSelectedClassKey] = useState('')

  const selectedDay = selectionState?.selectedDay ?? localSelectedDay
  const selectedLocation = selectionState?.selectedLocation ?? localSelectedLocation
  const selectedClassKey = selectionState?.selectedClassKey ?? localSelectedClassKey
  const setSelectedDay = selectionState?.setSelectedDay ?? setLocalSelectedDay
  const setSelectedLocation = selectionState?.setSelectedLocation ?? setLocalSelectedLocation
  const setSelectedClassKey = selectionState?.setSelectedClassKey ?? setLocalSelectedClassKey

  const availableDays = useMemo(() => {
    if (!dataset) {
      return []
    }
    return Array.from(new Set(dataset.sessions.map(session => session.dayOfWeek))).sort((left, right) => {
      const leftIndex = dayOrder.indexOf(left as (typeof dayOrder)[number])
      const rightIndex = dayOrder.indexOf(right as (typeof dayOrder)[number])
      if (leftIndex === -1 && rightIndex === -1) {
        return left.localeCompare(right)
      }
      if (leftIndex === -1) {
        return 1
      }
      if (rightIndex === -1) {
        return -1
      }
      return leftIndex - rightIndex
    })
  }, [dataset])

  useEffect(() => {
    if (!availableDays.length) {
      setSelectedDay('')
      return
    }
    if (!selectedDay || !availableDays.includes(selectedDay)) {
      setSelectedDay(availableDays[0])
    }
  }, [availableDays, selectedDay])

  const availableLocations = useMemo(() => {
    if (!dataset || !selectedDay) {
      return []
    }
    return Array.from(
      new Set(
        dataset.sessions
          .filter(session => session.dayOfWeek === selectedDay)
          .map(session => session.facility),
      ),
    ).sort((left, right) => left.localeCompare(right))
  }, [dataset, selectedDay])

  useEffect(() => {
    if (!availableLocations.length) {
      setSelectedLocation('')
      return
    }
    if (!selectedLocation || !availableLocations.includes(selectedLocation)) {
      setSelectedLocation(availableLocations[0])
    }
  }, [availableLocations, selectedLocation])

  const visibleClasses = useMemo(() => {
    if (!dataset || !selectedDay || !selectedLocation) {
      return []
    }
    return dataset.classes.filter(
      plannerClass => plannerClass.dayOfWeek === selectedDay && plannerClass.facility === selectedLocation,
    )
  }, [dataset, selectedDay, selectedLocation])

  useEffect(() => {
    if (!visibleClasses.length) {
      setSelectedClassKey('')
      return
    }
    if (!selectedClassKey || !visibleClasses.some(plannerClass => plannerClass.classKey === selectedClassKey)) {
      setSelectedClassKey(visibleClasses[0].classKey)
    }
  }, [selectedClassKey, visibleClasses])

  const selectedClass = useMemo(
    () => dataset?.classes.find(plannerClass => plannerClass.classKey === selectedClassKey) ?? null,
    [dataset, selectedClassKey],
  )

  const bookedParticipants = useMemo(() => {
    if (!dataset || !selectedClass) {
      return []
    }
    const byId = new Map(dataset.participants.map(participant => [participant.id, participant]))
    return selectedClass.participantIds
      .map(participantId => byId.get(participantId))
      .filter((participant): participant is PlannerParticipant => Boolean(participant))
  }, [dataset, selectedClass])

  const waitingParticipants = useMemo(() => {
    if (!dataset || !selectedClass) {
      return []
    }
    const byId = new Map(dataset.participants.map(participant => [participant.id, participant]))
    return selectedClass.waitingParticipantIds
      .map(participantId => byId.get(participantId))
      .filter((participant): participant is PlannerParticipant => Boolean(participant))
  }, [dataset, selectedClass])

  const alternatives = useMemo(() => {
    if (!dataset || !selectedClass) {
      return []
    }
    return getPlannerAlternativeClasses(dataset, selectedClass)
  }, [dataset, selectedClass])

  const activeCallParticipant = useMemo(() => {
    if (!activeCallParticipantId) {
      return null
    }
    return bookedParticipants.find(participant => participant.id === activeCallParticipantId) ?? null
  }, [activeCallParticipantId, bookedParticipants])

  const activeCallRecord = useMemo(() => {
    if (!dataset || !activeCallParticipantId) {
      return null
    }
    return dataset.callRecords[activeCallParticipantId] ?? null
  }, [activeCallParticipantId, dataset])

  const boardCourses = useMemo(() => buildPlannerBoardCourses(visibleClasses), [visibleClasses])
  const boardColumns = useMemo(() => buildPlannerBoardColumns(boardCourses), [boardCourses])

  const scheduleBounds = useMemo(() => {
    if (boardCourses.length === 0) {
      return null
    }
    const earliest = Math.min(...boardCourses.map(course => course.startMinutes))
    const latest = Math.max(...boardCourses.map(course => course.endMinutes))
    const startHour = Math.floor(earliest / 60)
    const endHour = Math.ceil(latest / 60)
    const start = `${String(startHour).padStart(2, '0')}:00`
    const end = `${String(endHour).padStart(2, '0')}:00`
    return { start, end }
  }, [boardCourses])

  const timeLabels = useMemo(() => {
    if (!scheduleBounds) {
      return []
    }
    return buildTimeLabels(scheduleBounds.start, scheduleBounds.end)
  }, [scheduleBounds])

  const scheduleStartMinutes = useMemo(() => {
    if (!scheduleBounds) {
      return 0
    }
    return timeToMinutes(scheduleBounds.start)
  }, [scheduleBounds])

  const scheduleHeightRem = useMemo(() => timeLabels.length * PLANNER_SLOT_HEIGHT_REM, [timeLabels])

  return {
    activeCallParticipant,
    activeCallRecord,
    alternatives,
    availableDays,
    availableLocations,
    boardColumns,
    bookedParticipants,
    scheduleHeightRem,
    scheduleStartMinutes,
    selectedClass,
    selectedClassKey,
    selectedDay,
    selectedLocation,
    setSelectedClassKey,
    setSelectedDay,
    setSelectedLocation,
    timeLabels,
    visibleClasses,
    waitingParticipants,
  }
}

export const plannerBoardLayout = {
  columnMinWidthPx: COLUMN_MIN_WIDTH_PX,
  headerHeightRem: HEADER_HEIGHT_REM,
  slotHeightRem: PLANNER_SLOT_HEIGHT_REM,
  slotMinutes: SLOT_MINUTES,
}
