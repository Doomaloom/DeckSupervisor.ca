import type { PlannerCallRecordUpdate, PlannerCallStatus, PlannerClass, PlannerParticipant, PlannerParticipantCallRecord } from '../../../types/app'
import { dayNames } from '../utils/plannerPresentation'

type PlannerCallModalProps = {
    activeCallParticipant: PlannerParticipant | null
    activeCallRecord: PlannerParticipantCallRecord | null
    alternatives: PlannerClass[]
    callScriptMode: 'live' | 'voicemail'
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
    const moveDestination = plannedMoveLabel || 'a new class time'

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
                        {callScriptMode === 'live' ? (
                            <div className="space-y-4 text-base leading-8 text-secondary">
                                <p>Hello, am I speaking with the parent or guardian of {activeCallParticipant.name}?</p>
                                <p>
                                    Hi, this is {callerName} calling from {callerLocationName} about {activeCallParticipant.name}
                                    {"'"}s swimming lessons.
                                </p>
                                {isPlannedMove ? (
                                    <>
                                        <p>
                                            I{"'"}m calling to let you know that {selectedClass.serviceName}, currently scheduled for{' '}
                                            {dayNames[selectedClass.dayOfWeek] ?? selectedClass.dayOfWeek}/{selectedClass.eventTime}, is planned to move to {moveDestination}.
                                        </p>
                                        <p>
                                            We wanted to let you know about the updated class arrangement and confirm whether that move works for your child.
                                        </p>
                                        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-base font-semibold text-primary">
                                            [Confirm the new time or destination class.]
                                        </div>
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                            <p className="font-semibold text-emerald-900">If They Accept The Move</p>
                                            <p className="mt-2 text-emerald-900">
                                                Perfect, we{"'"}ll update the registration and you{"'"}ll receive an email confirmation of the change.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                                            <p className="font-semibold text-amber-900">If The Move Does Not Work</p>
                                            <p className="mt-2 text-amber-900">
                                                If that option does not work, staff at the centre can help with the next steps for the registration.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p>
                                            I{"'"}m calling to let you know that unfortunately {selectedClass.serviceName}, scheduled for{' '}
                                            {dayNames[selectedClass.dayOfWeek] ?? selectedClass.dayOfWeek}/{selectedClass.eventTime}, has
                                            been cancelled due to low registration or staffing changes.
                                        </p>
                                        <p>
                                            We do have some alternative class options available at our centre that may work for your child.
                                            If you{"'"}d like, I can go over those options with you now.
                                        </p>
                                        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-base font-semibold text-primary">
                                            [Share alternatives.]
                                        </div>
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                            <p className="font-semibold text-emerald-900">If They Accept An Alternative</p>
                                            <p className="mt-2 text-emerald-900">
                                                I{"'"}m glad we found a suitable alternative, you{"'"}ll receive an email confirmation of the changes.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                                            <p className="font-semibold text-amber-900">If No Alternative Works</p>
                                            <p className="mt-2 text-amber-900">
                                                If none of those options work, we will refund the class and the amount will be added back to your account as account credit.
                                            </p>
                                        </div>
                                    </>
                                )}
                                <p>Do you have any questions?</p>
                            </div>
                        ) : (
                            <p className="whitespace-pre-line text-base leading-8 text-secondary">
                                {isPlannedMove
                                  ? `Hello, this is ${callerName} calling from ${callerLocationName} regarding ${activeCallParticipant.name}'s swimming lessons.

I'm calling to let you know that ${selectedClass.serviceName}, currently scheduled for ${dayNames[selectedClass.dayOfWeek] ?? selectedClass.dayOfWeek}/${selectedClass.eventTime}, is planned to move to ${moveDestination}.

Please give us a call back at ${callerPhoneNumber} at your earliest convenience so we can confirm whether that updated class works for your child.

Again, this is ${callerName} from ${callerLocationName}, and our number is ${callerPhoneNumber}. Thank you.`
                                  : `Hello, this is ${callerName} calling from ${callerLocationName} regarding ${activeCallParticipant.name}'s swimming lessons.

I'm calling to let you know that unfortunately ${selectedClass.serviceName}, scheduled for ${dayNames[selectedClass.dayOfWeek] ?? selectedClass.dayOfWeek}/${selectedClass.eventTime}, has been cancelled.

We may have alternative class options available at our centre. Please give us a call back at ${callerPhoneNumber} at your earliest convenience so we can review the available options with you.

Again, this is ${callerName} from ${callerLocationName}, and our number is ${callerPhoneNumber}. Thank you.`}
                            </p>
                        )}
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
                                {isPlannedMove ? (
                                    <p><span className="font-semibold">Planned move:</span> {moveDestination}</p>
                                ) : null}
                                <p><span className="font-semibold">Phone:</span> {activeCallParticipant.phone || 'No phone on file'}</p>
                                <p><span className="font-semibold">Email:</span> {activeCallParticipant.email || 'No email on file'}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                {isPlannedMove ? 'Planned Move' : 'Alternative Options'}
                            </p>
                            {isPlannedMove ? (
                                <div className="mt-3 rounded-2xl border border-secondary/20 bg-accent px-4 py-3 text-sm text-secondary">
                                    {moveDestination || 'No planned move destination selected.'}
                                </div>
                            ) : (
                                <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                                    {alternatives.length === 0 ? (
                                        <p className="text-sm text-secondary/70">No exact alternatives available.</p>
                                    ) : (
                                        alternatives.map(option => {
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
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                Accommodation
                            </p>
                            <div className="mt-3 flex gap-2">
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
                                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${!activeCallRecord.acceptedAlternativeClassKey && activeCallRecord.offeredAlternativeClassKey ? 'bg-rose-100 text-rose-900' : 'border border-secondary/20 bg-accent text-secondary'}`}
                                    onClick={() => void onSetCallRecord(activeCallParticipant.id, {
                                        offeredAlternativeClassKey: isPlannedMove
                                            ? selectedClass.plannedMoveTargetClassKey
                                            : activeCallRecord.offeredAlternativeClassKey,
                                        acceptedAlternativeClassKey: '',
                                        status: (isPlannedMove
                                          ? selectedClass.plannedMoveTargetClassKey
                                          : activeCallRecord.offeredAlternativeClassKey)
                                          ? 'declined_alternatives'
                                          : 'reached',
                                    })}
                                >
                                    {isPlannedMove ? 'Move Not Accepted' : 'Not Accepted'}
                                </button>
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
