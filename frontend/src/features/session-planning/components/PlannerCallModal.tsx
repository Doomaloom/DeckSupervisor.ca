import type { PlannerCallRecordUpdate, PlannerCallScriptKey, PlannerCallStatus, PlannerClass, PlannerParticipant, PlannerParticipantCallRecord } from '../../../types/app'
import { getPlannerCallScriptKey, normalizePlannerCallScripts, renderPlannerCallScript, type PlannerAlternativeGroups } from '../../../lib/sessionPlanner'
import { dayNames } from '../utils/plannerPresentation'

type PlannerCallModalProps = {
    activeCallParticipant: PlannerParticipant | null
    activeCallRecord: PlannerParticipantCallRecord | null
    alternatives: PlannerAlternativeGroups
    callScriptMode: 'live' | 'voicemail'
    callScripts: Record<PlannerCallScriptKey, string> | undefined
    callerLocationName: string
    callerName: string
    callerPhoneNumber: string
    plannedMoveLabel: string
    onClose: () => void
    onFinishCall: () => void | Promise<void>
    onSetCallRecord: (participantId: string, update: PlannerCallRecordUpdate) => void | Promise<void>
    onSetCallScriptMode: (mode: 'live' | 'voicemail') => void
    selectedClass: PlannerClass | null
}

function PlannerCallModal({
    activeCallParticipant,
    activeCallRecord,
    alternatives,
    callScriptMode,
    callScripts,
    callerLocationName,
    callerName,
    callerPhoneNumber,
    plannedMoveLabel,
    onClose,
    onFinishCall,
    onSetCallRecord,
    onSetCallScriptMode,
    selectedClass,
}: PlannerCallModalProps) {
    if (!activeCallParticipant || !activeCallRecord || !selectedClass) {
        return null
    }

    const isPlannedMove = selectedClass.planningStatus === 'planned_move'
    const isPoolClosure = selectedClass.planningStatus === 'pending_closure_calls'
    const moveDestination = plannedMoveLabel || 'a new class time'
    const allAlternatives = [...alternatives.availableAlternatives, ...alternatives.fullAlternatives]
    const renderedScript = renderPlannerCallScript({
        callScripts: normalizePlannerCallScripts(callScripts),
        scriptKey: getPlannerCallScriptKey(selectedClass, callScriptMode),
        participant: activeCallParticipant,
        plannerClass: selectedClass,
        callerName,
        locationName: callerLocationName,
        callbackPhoneNumber: callerPhoneNumber,
        moveDestination,
    })

  return (
    <div id="planner-call-modal" data-component="planner-call-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div data-component="planner-call-modal-panel" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-card border-2 border-secondary/20 bg-accent p-7 text-secondary shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                            Call Script
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold">{activeCallParticipant.name}</h3>
                        <p className="mt-1 text-sm text-secondary/70">
                            {activeCallParticipant.phone || 'No phone'} {activeCallParticipant.email ? `• ${activeCallParticipant.email}` : ''}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="rounded-full border border-secondary/30 px-3 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
                    <div className="rounded-2xl border border-secondary/20 bg-bg p-5">
                        <div className="mb-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${callScriptMode === 'live' ? 'bg-primary text-accent' : 'border border-secondary/20 bg-accent text-secondary'}`}
                                onClick={() => onSetCallScriptMode('live')}
                            >
                                Live Script
                            </button>
                            <button
                                type="button"
                                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${callScriptMode === 'voicemail' ? 'bg-primary text-accent' : 'border border-secondary/20 bg-accent text-secondary'}`}
                                onClick={() => onSetCallScriptMode('voicemail')}
                            >
                                Voicemail Script
                            </button>
                        </div>
                        <p className="whitespace-pre-line text-base leading-8 text-secondary">
                            {renderedScript}
                        </p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                Student Info
                            </p>
                            <div className="mt-3 space-y-2 text-sm text-secondary">
                                <p><span className="font-semibold">Program:</span> {selectedClass.serviceName}</p>
                                <p><span className="font-semibold">Current class:</span> {selectedClass.eventTime}</p>
                                <p><span className="font-semibold">Recreation centre:</span> {selectedClass.facility}</p>
                                {isPoolClosure ? (
                                    <p><span className="font-semibold">Workflow:</span> Pool closure calls</p>
                                ) : null}
                                {isPlannedMove ? (
                                    <p><span className="font-semibold">Planned move:</span> {moveDestination}</p>
                                ) : null}
                                <p><span className="font-semibold">Phone:</span> {activeCallParticipant.phone || 'No phone on file'}</p>
                                <p><span className="font-semibold">Email:</span> {activeCallParticipant.email || 'No email on file'}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                {isPoolClosure ? 'Pool Closure' : isPlannedMove ? 'Planned Move' : 'Alternative Options'}
                            </p>
                            {isPoolClosure ? (
                                <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
                                    Use the shared pool closure script for this participant.
                                </div>
                            ) : isPlannedMove ? (
                                <div className="mt-3 rounded-2xl border border-secondary/20 bg-accent px-4 py-3 text-sm text-secondary">
                                    {moveDestination || 'No planned move destination selected.'}
                                </div>
                            ) : (
                                <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                                    {allAlternatives.length === 0 ? (
                                        <p className="text-sm text-secondary/70">No exact alternatives available.</p>
                                    ) : (
                                        <>
                                            {alternatives.availableAlternatives.length > 0 ? (
                                                <div className="flex flex-col gap-2">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary/60">Available Alternatives</p>
                                                    {alternatives.availableAlternatives.map(option => {
                                                        const isSelected = activeCallRecord.offeredAlternativeClassKey === option.classKey
                                                        const isAccepted = activeCallRecord.acceptedAlternativeClassKey === option.classKey
                                                        return (
                                                            <button
                                                                key={option.classKey}
                                                                type="button"
                                                                className={`min-w-0 rounded-2xl border px-4 py-3 text-left text-sm transition ${isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-secondary/20 bg-accent text-secondary hover:bg-secondary/5'}`}
                                                                onClick={() => void onSetCallRecord(activeCallParticipant.id, {
                                                                    offeredAlternativeClassKey: isSelected ? '' : option.classKey,
                                                                    acceptedAlternativeClassKey: isSelected ? '' : isAccepted ? option.classKey : '',
                                                                })}
                                                            >
                                                                <div className="flex min-w-0 items-start justify-between gap-2">
                                                                    <p className="min-w-0 break-words font-semibold">
                                                                        {dayNames[option.dayOfWeek] ?? option.dayOfWeek} • {option.eventTime}
                                                                    </p>
                                                                    {isAccepted ? (
                                                                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-emerald-900">
                                                                            Accepted
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <p className="mt-1 break-words text-xs text-current/80">
                                                                    {option.facility} • {option.bookedCount}/{option.maximumCapacity} booked
                                                                </p>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            ) : null}
                                            {alternatives.fullAlternatives.length > 0 ? (
                                                <div className="flex flex-col gap-2">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary/60">Full Alternatives</p>
                                                    {alternatives.fullAlternatives.map(option => {
                                                        const isSelected = activeCallRecord.offeredAlternativeClassKey === option.classKey
                                                        const isAccepted = activeCallRecord.acceptedAlternativeClassKey === option.classKey
                                                        return (
                                                            <button
                                                                key={option.classKey}
                                                                type="button"
                                                                className={`min-w-0 rounded-2xl border px-4 py-3 text-left text-sm transition ${isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-secondary/20 bg-accent text-secondary hover:bg-secondary/5'}`}
                                                                onClick={() => void onSetCallRecord(activeCallParticipant.id, {
                                                                    offeredAlternativeClassKey: isSelected ? '' : option.classKey,
                                                                    acceptedAlternativeClassKey: isSelected ? '' : isAccepted ? option.classKey : '',
                                                                })}
                                                            >
                                                                <div className="flex min-w-0 items-start justify-between gap-2">
                                                                    <p className="min-w-0 break-words font-semibold">
                                                                        {dayNames[option.dayOfWeek] ?? option.dayOfWeek} • {option.eventTime}
                                                                    </p>
                                                                    {isAccepted ? (
                                                                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-emerald-900">
                                                                            Accepted
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <p className="mt-1 break-words text-xs text-current/80">
                                                                    {option.facility} • {option.bookedCount}/{option.maximumCapacity} booked
                                                                </p>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                Accommodation
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${activeCallRecord.status === 'voicemail' ? 'bg-amber-100 text-amber-900' : 'border border-secondary/20 bg-accent text-secondary'}`}
                                    onClick={() => void onSetCallRecord(activeCallParticipant.id, {
                                        status: 'voicemail',
                                        offeredAlternativeClassKey: '',
                                        acceptedAlternativeClassKey: '',
                                    })}
                                >
                                    Voicemail
                                </button>
                                {isPoolClosure ? (
                                    <button
                                        type="button"
                                        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${activeCallRecord.status === 'reached' ? 'bg-emerald-100 text-emerald-900' : 'border border-secondary/20 bg-accent text-secondary'}`}
                                        onClick={() => void onSetCallRecord(activeCallParticipant.id, {
                                            status: 'reached',
                                            offeredAlternativeClassKey: '',
                                            acceptedAlternativeClassKey: '',
                                        })}
                                    >
                                        Reached
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${activeCallRecord.acceptedAlternativeClassKey ? 'bg-emerald-100 text-emerald-900' : 'border border-secondary/20 bg-accent text-secondary'}`}
                                            onClick={() => {
                                                const acceptedKey = isPlannedMove
                                                    ? selectedClass.plannedMoveTargetClassKey
                                                    : activeCallRecord.offeredAlternativeClassKey
                                                if (!isPlannedMove && !acceptedKey) {
                                                    return
                                                }
                                                void onSetCallRecord(activeCallParticipant.id, {
                                                    offeredAlternativeClassKey: acceptedKey,
                                                    acceptedAlternativeClassKey: acceptedKey,
                                                    status: 'accepted_alternative' as PlannerCallStatus,
                                                })
                                            }}
                                            disabled={!isPlannedMove && !activeCallRecord.offeredAlternativeClassKey}
                                        >
                                            {isPlannedMove ? 'Accepted Move' : 'Accepted'}
                                        </button>
                                        <button
                                            type="button"
                                            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${activeCallRecord.status === 'declined_alternatives' ? 'bg-rose-100 text-rose-900' : 'border border-secondary/20 bg-accent text-secondary'}`}
                                            onClick={() => void onSetCallRecord(activeCallParticipant.id, {
                                                offeredAlternativeClassKey: isPlannedMove
                                                    ? selectedClass.plannedMoveTargetClassKey
                                                    : activeCallRecord.offeredAlternativeClassKey,
                                                acceptedAlternativeClassKey: '',
                                                status: 'declined_alternatives',
                                            })}
                                        >
                                            {isPlannedMove ? 'Move Not Accepted' : 'Not Accepted'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        className="rounded-2xl border border-secondary/30 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                        onClick={() => void onFinishCall()}
                    >
                        Finish Call
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PlannerCallModal
