import type { PlannerCallStatus } from '../../../types/app'
import type { PlannerClass, PlannerDataset, PlannerParticipant, PlannerParticipantCallRecord } from '../../../types/app'
import { getPlannerMoveTargetLabel } from '../../../lib/sessionPlanner'
import { dayNames } from '../utils/plannerPresentation'

type PlannedChangeRow = {
  participant: PlannerParticipant
  callRecord: PlannerParticipantCallRecord
}

type PlannedChangeGroup = {
  plannerClass: PlannerClass
  rows: PlannedChangeRow[]
}

type PlannerPlannedChangesModalProps = {
  dataset: PlannerDataset
  groups: PlannedChangeGroup[]
  onClose: () => void
  onMarkComplete: (participantId: string) => void | Promise<void>
}

const statusLabels: Record<PlannerCallStatus, string> = {
  not_started: 'Not started',
  called: 'Called',
  voicemail: 'Voicemail',
  reached: 'Reached',
  declined_alternatives: 'Declined alternatives',
  accepted_alternative: 'Accepted alternative',
}

function PlannerPlannedChangesModal({
  dataset,
  groups,
  onClose,
  onMarkComplete,
}: PlannerPlannedChangesModalProps) {
  const getAlternativeLabel = (classKey: string) => {
    const plannerClass = dataset.classes.find(item => item.classKey === classKey)
    if (!plannerClass) {
      return classKey
    }
    return `${plannerClass.serviceName} • ${dayNames[plannerClass.dayOfWeek] ?? plannerClass.dayOfWeek} • ${plannerClass.eventTime} • ${plannerClass.facility}`
  }

  if (groups.length === 0) {
    return null
  }

  return (
    <div
      id="planner-planned-changes-modal"
      data-component="planner-planned-changes-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        data-component="planner-planned-changes-modal-panel"
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-card border-2 border-secondary/20 bg-accent p-7 text-secondary shadow-lg"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
              Planned Changes
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Planned Changes Summary</h3>
            <p className="mt-1 text-sm text-secondary/70">
              Showing every student whose call workflow is no longer not started.
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

        <div className="mt-6 flex flex-col gap-5">
          {groups.map(group => (
            <section
              key={group.plannerClass.classKey}
              className="rounded-2xl border border-secondary/20 bg-bg p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold">{group.plannerClass.serviceName}</h4>
                  <p className="mt-1 text-sm text-secondary/70">
                    Code {group.plannerClass.eventId} •{' '}
                    {dayNames[group.plannerClass.dayOfWeek] ?? group.plannerClass.dayOfWeek} •{' '}
                    {group.plannerClass.eventTime} • {group.plannerClass.facility}
                  </p>
                  {group.plannerClass.planningStatus === 'planned_move' ? (
                    <p className="mt-1 text-sm text-sky-900">
                      Planned move: {getPlannerMoveTargetLabel(dataset, group.plannerClass) || 'Not set'}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full border border-secondary/20 bg-accent px-3 py-1 text-sm font-semibold">
                  {group.rows.length} planned
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {group.rows.map(({ participant, callRecord }) => (
                  <div
                    key={participant.id}
                    className="rounded-2xl border border-secondary/20 bg-accent p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{participant.name}</p>
                        <p className="text-sm text-secondary/70">
                          {participant.phone || 'No phone'} {participant.email ? `• ${participant.email}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-secondary/20 bg-bg px-3 py-1 text-sm font-semibold">
                          {statusLabels[callRecord.status]}
                        </span>
                        {callRecord.completedAt ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">
                            Complete
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                            onClick={() => void onMarkComplete(participant.id)}
                          >
                            Mark Complete
                          </button>
                        )}
                      </div>
                    </div>

                    {(callRecord.offeredAlternativeClassKey || callRecord.acceptedAlternativeClassKey || callRecord.notes) ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-secondary/20 bg-bg px-3 py-3 text-sm text-secondary">
                          <span className="font-semibold">Alternative option:</span>{' '}
                          {callRecord.acceptedAlternativeClassKey
                            ? getAlternativeLabel(callRecord.acceptedAlternativeClassKey)
                            : callRecord.offeredAlternativeClassKey
                              ? getAlternativeLabel(callRecord.offeredAlternativeClassKey)
                              : 'None'}
                        </div>
                        <div className="rounded-xl border border-secondary/20 bg-bg px-3 py-3 text-sm text-secondary">
                          <span className="font-semibold">Notes:</span> {callRecord.notes || 'None'}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PlannerPlannedChangesModal
