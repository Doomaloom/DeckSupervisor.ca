import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type {
  PlannerCallRecordUpdate,
  PlannerCallStatus,
  PlannerClassStatus,
  PlannerDataset,
} from '../../types/app'
import {
  applyPlannerSaveState,
  buildPlannerSaveState,
  getPlannerMoveTargetLabel,
  loadPlannerDataset,
  mergePlannerDatasets,
  parseEmptyClassesPlannerCsv,
  parseSessionPlannerCsv,
  parsePlannerSaveState,
  plannerSaveStateToSharePayload,
  plannerSaveStateToText,
  savePlannerDataset,
  updatePlannerCallRecord,
  updatePlannerClassLanes,
  updatePlannerClassMove,
  updatePlannerClassStatus,
} from '../../lib/sessionPlanner'
import {
  applyPlannerShareSaveState,
  updatePlannerShareCallRecord,
  updatePlannerShareClassLanes,
  updatePlannerShareClassMove,
  updatePlannerShareClassStatus,
} from '../../lib/serverApi'
import PlannerBoard from './components/PlannerBoard'
import PlannerCallModal from './components/PlannerCallModal'
import PlannerDetailsPanel from './components/PlannerDetailsPanel'
import PlannerHeader from './components/PlannerHeader'
import PlannerPlannedChangesModal from './components/PlannerPlannedChangesModal'
import { usePlannerShareSession } from './hooks/usePlannerShareSession'
import { plannerBoardLayout, usePlannerViewModel } from './hooks/usePlannerViewModel'

function SessionPlanningPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [dataset, setDataset] = useState<PlannerDataset | null>(null)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(true)
  const [activeCallParticipantId, setActiveCallParticipantId] = useState('')
  const [callScriptMode, setCallScriptMode] = useState<'live' | 'voicemail'>('live')
  const [isPlannedChangesOpen, setIsPlannedChangesOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedClassKey, setSelectedClassKey] = useState('')

  const {
    applySharedSession,
    isPopout,
    isSharedMode,
    isShareHost,
    isSharingBusy,
    joinSharedPlanner,
    leaveSharedPlannerSession,
    shareCode,
    shareDisplayName,
    shareLocationOverrides,
    shareNotice,
    shareParticipantId,
    sharePhoneNumber,
    shareSession,
    saveSharedDetails,
    startSharing,
    stopSharing,
    syncQueryParams,
    setShareDisplayName,
    setShareLocationOverrides,
    setSharePhoneNumber,
  } = usePlannerShareSession({
    location,
    navigate,
    dataset,
    setDataset,
    setError,
    loadLocalDataset: loadPlannerDataset,
  })

  useEffect(() => {
    if (shareCode) {
      return
    }
    setDataset(loadPlannerDataset())
  }, [shareCode])

  const {
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
    timeLabels,
    visibleClasses,
    waitingParticipants,
  } = usePlannerViewModel(dataset, activeCallParticipantId, {
    selectedDay,
    selectedLocation,
    selectedClassKey,
    setSelectedDay,
    setSelectedLocation,
    setSelectedClassKey,
  })

  const persistLocalDataset = (nextDataset: PlannerDataset) => {
    setDataset(nextDataset)
    savePlannerDataset(nextDataset)
  }

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return
    }
    try {
      const parsedDataset = parseSessionPlannerCsv(await file.text(), file.name)
      persistLocalDataset(parsedDataset)
      setError('')
      setStatusMessage('')
      setIsInfoPanelOpen(true)
      setActiveCallParticipantId('')
      if (shareCode) {
        syncQueryParams('')
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to parse planner CSV.')
    }
  }

  const handleAddUpload = async (file: File | null) => {
    if (!file) {
      return
    }
    try {
      const parsedDataset = parseSessionPlannerCsv(await file.text(), file.name)
      const nextDataset = dataset ? mergePlannerDatasets(dataset, parsedDataset) : parsedDataset
      persistLocalDataset(nextDataset)
      setError('')
      setStatusMessage('')
      setIsInfoPanelOpen(true)
      if (shareCode) {
        syncQueryParams('')
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to merge planner CSV.')
    }
  }

  const handleAddEmptyClassesUpload = async (file: File | null) => {
    if (!file) {
      return
    }
    try {
      const parsedDataset = parseEmptyClassesPlannerCsv(await file.text(), file.name)
      const nextDataset = dataset ? mergePlannerDatasets(dataset, parsedDataset) : parsedDataset
      persistLocalDataset(nextDataset)
      setError('')
      setStatusMessage('Empty classes added from the schematic CSV.')
      setIsInfoPanelOpen(true)
      if (shareCode) {
        syncQueryParams('')
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'Failed to import empty classes CSV.',
      )
    }
  }

  const setClassStatus = async (classKey: string, status: PlannerClassStatus) => {
    if (!dataset) {
      return
    }
    try {
      if (shareCode && shareParticipantId) {
        const response = await updatePlannerShareClassStatus(shareCode, {
          participantId: shareParticipantId,
          classKey,
          status,
        })
        applySharedSession(response.session)
      } else {
        persistLocalDataset(updatePlannerClassStatus(dataset, classKey, status))
      }
      setError('')
      setStatusMessage('')
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update class status.')
    }
  }

  const setClassLanes = async (laneIndexes: Record<string, number>) => {
    if (!dataset) {
      return
    }
    try {
      if (shareCode && shareParticipantId) {
        const response = await updatePlannerShareClassLanes(shareCode, {
          participantId: shareParticipantId,
          classLaneIndexes: laneIndexes,
        })
        applySharedSession(response.session)
      } else {
        persistLocalDataset(updatePlannerClassLanes(dataset, laneIndexes))
      }
      setError('')
      setStatusMessage('')
    } catch (laneError) {
      setError(laneError instanceof Error ? laneError.message : 'Failed to update planner columns.')
    }
  }

  const setClassMove = async (
    classKey: string,
    update: {
      plannedMoveType?: 'new_time' | 'target_class' | ''
      plannedMoveTime?: string
      plannedMoveTargetClassKey?: string
    },
  ) => {
    if (!dataset) {
      return
    }
    try {
      if (shareCode && shareParticipantId) {
        const response = await updatePlannerShareClassMove(shareCode, {
          participantId: shareParticipantId,
          classKey,
          plannedMoveType: update.plannedMoveType ?? '',
          plannedMoveTime: update.plannedMoveTime ?? '',
          plannedMoveTargetClassKey: update.plannedMoveTargetClassKey ?? '',
        })
        applySharedSession(response.session)
      } else {
        persistLocalDataset(updatePlannerClassMove(dataset, classKey, update))
      }
      setError('')
      setStatusMessage('')
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Failed to update planned move.')
    }
  }

  const setCallRecord = async (participantId: string, update: PlannerCallRecordUpdate) => {
    if (!dataset) {
      return
    }
    try {
      if (shareCode && shareParticipantId) {
        const response = await updatePlannerShareCallRecord(shareCode, {
          participantId: shareParticipantId,
          participantRecordId: participantId,
          update,
        })
        applySharedSession(response.session)
      } else {
        persistLocalDataset(updatePlannerCallRecord(dataset, participantId, update))
      }
      setError('')
      setStatusMessage('')
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : 'Failed to update call record.')
    }
  }

  const startCall = async (participantId: string) => {
    setCallScriptMode('live')
    setActiveCallParticipantId(participantId)
    await setCallRecord(participantId, { status: 'called' })
  }

  const closeCallModal = () => {
    setActiveCallParticipantId('')
    setCallScriptMode('live')
  }

  const finishCall = async () => {
    if (!activeCallParticipant || !activeCallRecord) {
      return
    }

    let nextStatus: PlannerCallStatus = activeCallRecord.status
    if (activeCallRecord.status === 'voicemail') {
      nextStatus = 'voicemail'
    } else if (activeCallRecord.acceptedAlternativeClassKey) {
      nextStatus = 'accepted_alternative'
    } else if (activeCallRecord.offeredAlternativeClassKey) {
      nextStatus = 'declined_alternatives'
    } else if (nextStatus === 'called' || nextStatus === 'not_started') {
      nextStatus = 'reached'
    }

    await setCallRecord(activeCallParticipant.id, { status: nextStatus })
    closeCallModal()
  }

  const openPopout = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('popout', '1')
    window.open(url.toString(), '_blank', 'popup=yes,width=1600,height=980')
  }

  const downloadPlannerState = () => {
    if (!dataset) {
      setError('Load the planner CSVs before saving planner state.')
      return
    }

    const state = buildPlannerSaveState({
      dataset,
      shareDisplayName,
      locationOverrides: shareLocationOverrides,
      callbackPhoneNumber: sharePhoneNumber,
      selectedDay,
      selectedLocation,
      selectedClassKey,
    })
    const blob = new Blob([plannerSaveStateToText(state)], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    const timestamp = state.exportedAt.replace(/[:.]/g, '-')
    link.href = URL.createObjectURL(blob)
    link.download = `session-planner-state-${timestamp}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
    setError('')
    setStatusMessage('Planner state downloaded. Re-add the matching CSVs before loading it later.')
  }

  const loadPlannerState = async (file: File | null) => {
    if (!file) {
      return
    }
    if (!dataset) {
      setError('Load the planner CSVs before importing a planner state file.')
      return
    }

    try {
      const importedState = parsePlannerSaveState(await file.text())
      const localRestoreResult = applyPlannerSaveState(dataset, importedState)
      setShareDisplayName(importedState.shareDisplayName)
      setSelectedDay(importedState.selection.selectedDay)
      setSelectedLocation(importedState.selection.selectedLocation)
      setSelectedClassKey(importedState.selection.selectedClassKey)

      if (shareCode && shareParticipantId) {
        const response = await applyPlannerShareSaveState(shareCode, {
          participantId: shareParticipantId,
          ...plannerSaveStateToSharePayload(importedState),
        })
        applySharedSession(response.session)
      } else {
        persistLocalDataset(localRestoreResult.dataset)
      }

      if (!shareCode || isShareHost) {
        setShareLocationOverrides(importedState.locationOverrides)
        setSharePhoneNumber(importedState.callbackPhoneNumber)
      }

      const summary =
        shareCode && shareParticipantId
          ? `Planner state loaded. Shared planner metadata was applied to the live session${isShareHost ? '.' : ', except host-only call details.'}`
          : `Planner state loaded. Restored ${localRestoreResult.matchedClasses} class updates and ${localRestoreResult.matchedCallRecords} call records. Skipped ${localRestoreResult.skippedClasses + localRestoreResult.skippedCallRecords} unmatched items.`

      setError('')
      setStatusMessage(summary)
      setIsInfoPanelOpen(true)
    } catch (loadError) {
      setStatusMessage('')
      setError(loadError instanceof Error ? loadError.message : 'Failed to load planner state.')
    }
  }

  const callerName = shareDisplayName.trim() || 'Deck Supervisor'
  const callerLocationName =
    (selectedClass?.facility ? shareLocationOverrides[selectedClass.facility]?.trim() : '') ||
    selectedClass?.facility ||
    'the recreation centre'
  const callerPhoneNumber = sharePhoneNumber.trim() || 'our main office number'
  const plannedMoveLabel =
    dataset && selectedClass ? getPlannerMoveTargetLabel(dataset, selectedClass) : ''
  const shouldShowPlanner = Boolean(dataset && (!shareCode || isSharedMode))
  const plannedChangeGroups = useMemo(() => {
    if (!dataset) {
      return []
    }

    return dataset.classes
      .map(plannerClass => {
        const rows = plannerClass.participantIds
          .map(participantId => {
            const participant = dataset.participants.find(entry => entry.id === participantId)
            const callRecord = dataset.callRecords[participantId]
            if (!participant || !callRecord || callRecord.status === 'not_started') {
              return null
            }
            return { participant, callRecord }
          })
          .filter(
            (
              row,
            ): row is {
              participant: (typeof dataset.participants)[number]
              callRecord: (typeof dataset.callRecords)[string]
            } => Boolean(row),
          )
          .sort((left, right) => {
            if (left.callRecord.completedAt && !right.callRecord.completedAt) {
              return 1
            }
            if (!left.callRecord.completedAt && right.callRecord.completedAt) {
              return -1
            }
            return left.participant.name.localeCompare(right.participant.name)
          })

        return rows.length > 0 ? { plannerClass, rows } : null
      })
      .filter((group): group is NonNullable<typeof group> => Boolean(group))
      .sort((left, right) => {
        if (left.plannerClass.dayOfWeek !== right.plannerClass.dayOfWeek) {
          return left.plannerClass.dayOfWeek.localeCompare(right.plannerClass.dayOfWeek)
        }
        if (left.plannerClass.eventTime !== right.plannerClass.eventTime) {
          return left.plannerClass.eventTime.localeCompare(right.plannerClass.eventTime)
        }
        return left.plannerClass.serviceName.localeCompare(right.plannerClass.serviceName)
      })
  }, [dataset])

  const togglePlannedChangeComplete = async (participantId: string, isComplete: boolean) => {
    await setCallRecord(participantId, { completedAt: isComplete ? new Date().toISOString() : '' })
  }

  const togglePlannedChangeEmailSent = async (participantId: string, isSent: boolean) => {
    await setCallRecord(participantId, { emailSentAt: isSent ? new Date().toISOString() : '' })
  }

  return (
    <div id="session-planning-page" data-component="session-planning-page" className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <PlannerHeader
        dataset={dataset}
        error={error}
        isPopout={isPopout}
        isSharedMode={isSharedMode}
        isShareHost={isShareHost}
        isSharingBusy={isSharingBusy}
        shareCode={shareCode}
        shareDisplayName={shareDisplayName}
        shareLocationOverrides={shareLocationOverrides}
        shareNotice={shareNotice}
        sharePhoneNumber={sharePhoneNumber}
        shareSession={shareSession}
        statusMessage={statusMessage}
        showPlannedChangesButton={plannedChangeGroups.length > 0}
          onHandleAddUpload={handleAddUpload}
          onHandleAddEmptyClassesUpload={handleAddEmptyClassesUpload}
          onHandleUpload={handleUpload}
        onJoinSharedPlanner={joinSharedPlanner}
        onLeaveSharedPlannerSession={leaveSharedPlannerSession}
        onLoadState={loadPlannerState}
        onOpenPopout={openPopout}
        onOpenPlannedChanges={() => setIsPlannedChangesOpen(true)}
        onSaveState={downloadPlannerState}
        onSetShareDisplayName={setShareDisplayName}
        onSetShareLocationOverride={(facility, value) =>
          setShareLocationOverrides(current => ({
            ...current,
            [facility]: value,
          }))
        }
        onSetSharePhoneNumber={setSharePhoneNumber}
        onSaveSharedDetails={saveSharedDetails}
        onStartSharing={startSharing}
        onStopSharing={stopSharing}
      />

      {!shouldShowPlanner ? (
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
          <p className="text-base text-secondary/80">
            {shareCode
              ? 'Join the shared planner to start collaborating.'
              : 'Upload a participant CSV to start planning.'}
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-6 ${isInfoPanelOpen ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]' : ''}`}
        >
          <PlannerBoard
            availableDays={availableDays}
            availableLocations={availableLocations}
            boardColumns={boardColumns}
            scheduleHeightRem={scheduleHeightRem}
            scheduleStartMinutes={scheduleStartMinutes}
            selectedClassKey={selectedClassKey}
            selectedDay={selectedDay}
            selectedLocation={selectedLocation}
            setClassLanes={setClassLanes}
            setIsInfoPanelOpen={setIsInfoPanelOpen}
            setSelectedClassKey={setSelectedClassKey}
            setSelectedDay={setSelectedDay}
            setSelectedLocation={setSelectedLocation}
            timeLabels={timeLabels}
            visibleClasses={visibleClasses}
            {...plannerBoardLayout}
          />

          <PlannerDetailsPanel
            alternatives={alternatives}
            bookedParticipants={bookedParticipants}
            dataset={dataset}
            isInfoPanelOpen={isInfoPanelOpen}
            selectedClass={selectedClass}
            setCallRecord={setCallRecord}
            setClassMove={setClassMove}
            setClassStatus={setClassStatus}
            setIsInfoPanelOpen={setIsInfoPanelOpen}
            startCall={startCall}
            waitingParticipants={waitingParticipants}
          />
        </div>
      )}

      <PlannerCallModal
        activeCallParticipant={activeCallParticipant}
        activeCallRecord={activeCallRecord}
        alternatives={alternatives}
        callScriptMode={callScriptMode}
        callerLocationName={callerLocationName}
        callerName={callerName}
        callerPhoneNumber={callerPhoneNumber}
        plannedMoveLabel={plannedMoveLabel}
        onClose={closeCallModal}
        onFinishCall={finishCall}
        onSetCallRecord={setCallRecord}
        onSetCallScriptMode={setCallScriptMode}
        selectedClass={selectedClass}
      />

      {isPlannedChangesOpen && dataset ? (
        <PlannerPlannedChangesModal
          dataset={dataset}
          groups={plannedChangeGroups}
          onClose={() => setIsPlannedChangesOpen(false)}
          onToggleComplete={togglePlannedChangeComplete}
          onToggleEmailSent={togglePlannedChangeEmailSent}
        />
      ) : null}
    </div>
  )
}

export default SessionPlanningPage
