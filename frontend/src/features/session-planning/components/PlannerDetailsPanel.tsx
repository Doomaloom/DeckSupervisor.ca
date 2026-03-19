import { useState } from 'react'
import type {
  PlannerCallRecordUpdate,
  PlannerCallStatus,
  PlannerClass,
  PlannerClassStatus,
  PlannerDataset,
  PlannerParticipant,
} from '../../../types/app'
import { plannerCallStatusOptions } from '../../../lib/sessionPlanner'
import { dayNames, statusClasses } from '../utils/plannerPresentation'

type PlannerDetailsPanelProps = {
  alternatives: PlannerClass[]
  bookedParticipants: PlannerParticipant[]
  dataset: PlannerDataset | null
  isInfoPanelOpen: boolean
  selectedClass: PlannerClass | null
  setCallRecord: (participantId: string, update: PlannerCallRecordUpdate) => void | Promise<void>
  setClassStatus: (classKey: string, status: PlannerClassStatus) => void | Promise<void>
  setIsInfoPanelOpen: (value: boolean) => void
  startCall: (participantId: string) => void
}

function formatAlternativeLabel(option: PlannerClass) {
  return `${dayNames[option.dayOfWeek] ?? option.dayOfWeek} • ${option.eventTime} • ${option.facility}`
}

function PlannerDetailsPanel({
  alternatives,
  bookedParticipants,
  dataset,
  isInfoPanelOpen,
  selectedClass,
  setCallRecord,
  setClassStatus,
  setIsInfoPanelOpen,
  startCall,
}: PlannerDetailsPanelProps) {
  const [openAlternativeParticipantId, setOpenAlternativeParticipantId] = useState('')

  if (!isInfoPanelOpen) {
    return null
  }

  return (
    <div id="planner-details-panel" data-component="planner-details-panel" className="flex min-h-[70vh] flex-col gap-4 rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
      {!selectedClass || !dataset ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                Class Details
              </p>
              <h3 className="mt-2 text-xl font-semibold">No class selected</h3>
            </div>
            <button
              type="button"
              className="rounded-full border border-secondary/30 px-3 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
              onClick={() => setIsInfoPanelOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="rounded-2xl border border-secondary/20 bg-bg p-5 text-sm text-secondary/70">
            Select a class on the board to manage its cancellation workflow.
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                {dayNames[selectedClass.dayOfWeek] ?? selectedClass.dayOfWeek} • {selectedClass.facility}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold">{selectedClass.serviceName}</h3>
                {selectedClass.planningStatus !== 'active' ? (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusClasses(selectedClass.planningStatus)}`}
                  >
                    {selectedClass.planningStatus === 'pending_cancellation'
                      ? 'Pending Cancellation'
                      : 'Cancelled'}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-secondary/70">{selectedClass.eventTime}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-secondary/30 px-3 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
                onClick={() => setIsInfoPanelOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-full bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
                onClick={() => void setClassStatus(selectedClass.classKey, 'pending_cancellation')}
              >
                Pending Cancellation
              </button>
              <button
                type="button"
                className="rounded-full bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900 transition hover:-translate-y-0.5"
                onClick={() => void setClassStatus(selectedClass.classKey, 'cancelled')}
              >
                Cancelled
              </button>
              <button
                type="button"
                className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:-translate-y-0.5"
                onClick={() => void setClassStatus(selectedClass.classKey, 'active')}
              >
                Active
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-secondary/70">Capacity</p>
              <p className="mt-2 text-lg font-semibold">
                {selectedClass.bookedCount} / {selectedClass.maximumCapacity}
              </p>
              <p className="text-sm text-secondary/70">Minimum capacity {selectedClass.minimumCapacity}</p>
            </div>
            <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-secondary/70">Waitlist</p>
              <p className="mt-2 text-lg font-semibold">{selectedClass.waitlistCount}</p>
              <p className="text-sm text-secondary/70">Booked count trusts the CSV Booked field.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary/70">
              Alternative Classes
            </h4>
            <div className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
              {alternatives.length === 0 ? (
                <p className="text-sm text-secondary/70">No exact ServiceName alternatives found.</p>
              ) : (
                alternatives.map(option => (
                  <div key={option.classKey} className="rounded-2xl border border-secondary/20 bg-accent p-3">
                    <p className="font-semibold">
                      {dayNames[option.dayOfWeek] ?? option.dayOfWeek} • {option.eventTime}
                    </p>
                    <p className="text-sm text-secondary/70">
                      {option.facility} • {option.bookedCount}/{option.maximumCapacity} booked • waitlist {option.waitlistCount}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedClass.planningStatus === 'active' ? (
            <div className="rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary/70">
              Mark this class as pending cancellation or cancelled to start the call workflow.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-secondary/20 bg-bg p-4">
              <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary/70">
                Cancellation Call Workflow
              </h4>
              <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                {bookedParticipants.map(participant => {
                  const callRecord = dataset.callRecords[participant.id]
                  return (
                    <div key={participant.id} className="rounded-2xl border border-secondary/20 bg-accent p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{participant.name}</p>
                          <p className="text-sm text-secondary/70">
                            {participant.phone || 'No phone'} {participant.email ? `• ${participant.email}` : ''}
                          </p>
                        </div>
                        <select
                          className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                          value={callRecord?.status ?? 'not_started'}
                          onChange={event =>
                            void setCallRecord(participant.id, { status: event.target.value as PlannerCallStatus })
                          }
                        >
                          {plannerCallStatusOptions.map(option => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mt-3 grid gap-3">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                          Alternative Option
                          <div className="relative">
                            <button
                              type="button"
                              className="flex w-full items-start justify-between gap-2 rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-left text-sm text-secondary"
                              onClick={() =>
                                setOpenAlternativeParticipantId(current =>
                                  current === participant.id ? '' : participant.id,
                                )
                              }
                            >
                              <span className="min-w-0 break-words">
                                {callRecord?.offeredAlternativeClassKey
                                  ? formatAlternativeLabel(
                                      alternatives.find(
                                        option => option.classKey === callRecord.offeredAlternativeClassKey,
                                      ) ?? {
                                        classKey: '',
                                        eventId: '',
                                        sessionKey: '',
                                        serviceName: '',
                                        dayOfWeek: '',
                                        eventTime: '',
                                        facility: '',
                                        sessionSeason: '',
                                        sessionYear: 0,
                                        minimumCapacity: 0,
                                        maximumCapacity: 0,
                                        bookedCount: 0,
                                        waitlistCount: 0,
                                        participantIds: [],
                                        waitingParticipantIds: [],
                                        planningStatus: 'active',
                                      },
                                    )
                                  : 'No alternative selected'}
                              </span>
                              <span className="shrink-0 text-secondary/60">
                                {openAlternativeParticipantId === participant.id ? '▲' : '▼'}
                              </span>
                            </button>
                            {openAlternativeParticipantId === participant.id ? (
                              <div className="absolute z-10 mt-2 w-full rounded-2xl border border-secondary/20 bg-accent p-2 shadow-lg">
                                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                                  <button
                                    type="button"
                                    className="rounded-xl border border-secondary/20 bg-bg px-3 py-2 text-left text-sm text-secondary transition hover:bg-secondary/5"
                                    onClick={() => {
                                      void setCallRecord(participant.id, {
                                        offeredAlternativeClassKey: '',
                                        acceptedAlternativeClassKey: '',
                                      })
                                      setOpenAlternativeParticipantId('')
                                    }}
                                  >
                                    No alternative selected
                                  </button>
                                  {alternatives.map(option => (
                                    <button
                                      key={option.classKey}
                                      type="button"
                                      className="rounded-xl border border-secondary/20 bg-bg px-3 py-2 text-left text-sm text-secondary transition hover:bg-secondary/5"
                                      onClick={() => {
                                        void setCallRecord(participant.id, {
                                          offeredAlternativeClassKey: option.classKey,
                                          acceptedAlternativeClassKey:
                                            option.classKey === callRecord?.acceptedAlternativeClassKey
                                              ? option.classKey
                                              : '',
                                        })
                                        setOpenAlternativeParticipantId('')
                                      }}
                                    >
                                      <span className="break-words">{formatAlternativeLabel(option)}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </label>
                      </div>

                      <label className="mt-3 flex flex-col gap-2 text-sm font-semibold text-secondary">
                        Notes
                        <textarea
                          className="min-h-20 rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                          value={callRecord?.notes ?? ''}
                          onChange={event => void setCallRecord(participant.id, { notes: event.target.value })}
                        />
                      </label>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                          onClick={() => startCall(participant.id)}
                        >
                          Call Parent / Guardian
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PlannerDetailsPanel
