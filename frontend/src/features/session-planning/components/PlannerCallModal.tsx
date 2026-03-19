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
    onClose,
    onFinishCall,
    onSetCallRecord,
    onSetCallScriptMode,
    selectedClass,
}: PlannerCallModalProps) {
    if (!activeCallParticipant || !activeCallRecord || !selectedClass) {
        return null
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-card border-2 border-secondary/20 bg-accent p-7 text-secondary shadow-lg">
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
                                <p>Do you have any questions?</p>
                            </div>
                        ) : (
                            <p className="whitespace-pre-line text-base leading-8 text-secondary">
                                {`Hello, this is ${callerName} calling from ${callerLocationName} regarding ${activeCallParticipant.name}'s swimming lessons.

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
                                <p><span className="font-semibold">Phone:</span> {activeCallParticipant.phone || 'No phone on file'}</p>
                                <p><span className="font-semibold">Email:</span> {activeCallParticipant.email || 'No email on file'}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                Alternative Options
                            </p>
                            <div className="mt-3 flex flex-col gap-2">
                                {alternatives.length === 0 ? (
                                    <p className="text-sm text-secondary/70">No exact alternatives available.</p>
                                ) : (
                                    alternatives.map(option => {
                                        const isSelected = activeCallRecord.offeredAlternativeClassKey === option.classKey
                                        return (
                                            <button
                                                key={option.classKey}
                                                type="button"
                                                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-secondary/20 bg-accent text-secondary hover:bg-secondary/5'}`}
                                                onClick={() => void onSetCallRecord(activeCallParticipant.id, {
                                                    offeredAlternativeClassKey: isSelected ? '' : option.classKey,
                                                    acceptedAlternativeClassKey: isSelected ? '' : activeCallRecord.acceptedAlternativeClassKey,
                                                })}
                                            >
                                                <p className="font-semibold">
                                                    {dayNames[option.dayOfWeek] ?? option.dayOfWeek} • {option.eventTime}
                                                </p>
                                                <p className="mt-1 text-xs text-current/80">
                                                    {option.facility} • {option.bookedCount}/{option.maximumCapacity} booked
                                                </p>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                Accommodation
                            </p>
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${activeCallRecord.acceptedAlternativeClassKey ? 'bg-emerald-100 text-emerald-900' : 'border border-secondary/20 bg-accent text-secondary'}`}
                                    onClick={() => {
                                        const acceptedKey = activeCallRecord.offeredAlternativeClassKey
                                        if (!acceptedKey) {
                                            return
                                        }
                                        void onSetCallRecord(activeCallParticipant.id, {
                                            acceptedAlternativeClassKey: acceptedKey,
                                            status: 'accepted_alternative' as PlannerCallStatus,
                                        })
                                    }}
                                    disabled={!activeCallRecord.offeredAlternativeClassKey}
                                >
                                    Accepted
                                </button>
                                <button
                                    type="button"
                                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${!activeCallRecord.acceptedAlternativeClassKey && activeCallRecord.offeredAlternativeClassKey ? 'bg-rose-100 text-rose-900' : 'border border-secondary/20 bg-accent text-secondary'}`}
                                    onClick={() => void onSetCallRecord(activeCallParticipant.id, {
                                        acceptedAlternativeClassKey: '',
                                        status: activeCallRecord.offeredAlternativeClassKey ? 'declined_alternatives' : 'reached',
                                    })}
                                >
                                    Not Accepted
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
