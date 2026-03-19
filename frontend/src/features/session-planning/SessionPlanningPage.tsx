import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type {
  PlannerCallRecordUpdate,
  PlannerCallStatus,
  PlannerClassStatus,
  PlannerDataset,
} from '../../types/app'
import {
  loadPlannerDataset,
  mergePlannerDatasets,
  parseSessionPlannerCsv,
  savePlannerDataset,
  updatePlannerCallRecord,
  updatePlannerClassStatus,
} from '../../lib/sessionPlanner'
import { updatePlannerShareCallRecord, updatePlannerShareClassStatus } from '../../lib/serverApi'
import PlannerBoard from './components/PlannerBoard'
import PlannerCallModal from './components/PlannerCallModal'
import PlannerDetailsPanel from './components/PlannerDetailsPanel'
import PlannerHeader from './components/PlannerHeader'
import { usePlannerShareSession } from './hooks/usePlannerShareSession'
import { plannerBoardLayout, usePlannerViewModel } from './hooks/usePlannerViewModel'

function SessionPlanningPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [dataset, setDataset] = useState<PlannerDataset | null>(null)
  const [error, setError] = useState('')
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(true)
  const [activeCallParticipantId, setActiveCallParticipantId] = useState('')
  const [callScriptMode, setCallScriptMode] = useState<'live' | 'voicemail'>('live')

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
    shareLocationName,
    shareNotice,
    shareParticipantId,
    sharePhoneNumber,
    shareSession,
    saveSharedDetails,
    startSharing,
    stopSharing,
    syncQueryParams,
    setShareDisplayName,
    setShareLocationName,
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
    selectedClassKey,
    selectedDay,
    selectedLocation,
    setSelectedClassKey,
    setSelectedDay,
    setSelectedLocation,
    timeLabels,
    visibleClasses,
  } = usePlannerViewModel(dataset, activeCallParticipantId)

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
      setIsInfoPanelOpen(true)
      if (shareCode) {
        syncQueryParams('')
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to merge planner CSV.')
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
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update class status.')
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

    let nextStatus: PlannerCallStatus = 'reached'
    if (activeCallRecord.acceptedAlternativeClassKey) {
      nextStatus = 'accepted_alternative'
    } else if (activeCallRecord.offeredAlternativeClassKey) {
      nextStatus = 'declined_alternatives'
    }

    await setCallRecord(activeCallParticipant.id, { status: nextStatus })
    closeCallModal()
  }

  const openPopout = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('popout', '1')
    window.open(url.toString(), '_blank', 'popup=yes,width=1600,height=980')
  }

  const callerName = shareDisplayName.trim() || 'Deck Supervisor'
  const callerLocationName = shareLocationName.trim() || selectedClass?.facility || 'the recreation centre'
  const callerPhoneNumber = sharePhoneNumber.trim() || 'our main office number'
  const shouldShowPlanner = Boolean(dataset && (!shareCode || isSharedMode))

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
        shareLocationName={shareLocationName}
        shareNotice={shareNotice}
        sharePhoneNumber={sharePhoneNumber}
        shareSession={shareSession}
        onHandleAddUpload={handleAddUpload}
        onHandleUpload={handleUpload}
        onJoinSharedPlanner={joinSharedPlanner}
        onLeaveSharedPlannerSession={leaveSharedPlannerSession}
        onOpenPopout={openPopout}
        onSetShareDisplayName={setShareDisplayName}
        onSetShareLocationName={setShareLocationName}
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
            setClassStatus={setClassStatus}
            setIsInfoPanelOpen={setIsInfoPanelOpen}
            startCall={startCall}
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
        onClose={closeCallModal}
        onFinishCall={finishCall}
        onSetCallRecord={setCallRecord}
        onSetCallScriptMode={setCallScriptMode}
        selectedClass={selectedClass}
      />
    </div>
  )
}

export default SessionPlanningPage
