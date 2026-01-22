import React from 'react'
import PrintModalShell from './PrintModalShell'

type InstructorOptionsModalProps = {
  open: boolean
  instructorNames: string[]
  cachedInstructors: Record<string, boolean>
  busyInstructors: Record<string, boolean>
  isRefreshing: boolean
  isPrintingAll: boolean
  onClose: () => void
  onRefresh: () => void
  onPrintAll: () => void
  onPrintInstructor: (name: string) => void
}

function InstructorOptionsModal({
  open,
  instructorNames,
  cachedInstructors,
  busyInstructors,
  isRefreshing,
  isPrintingAll,
  onClose,
  onRefresh,
  onPrintAll,
  onPrintInstructor,
}: InstructorOptionsModalProps) {
  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Instructor Sheets Options"
      description="Print instructor packets as they are ready."
      onClose={onClose}
    >
      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
          Instructors
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-2xl bg-secondary px-3 py-1 text-xs font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onPrintAll}
            disabled={isPrintingAll || instructorNames.length === 0}
          >
            {isPrintingAll ? 'Preparing...' : 'Print all as one'}
          </button>
          <button
            type="button"
            className="rounded-2xl border border-secondary/40 px-3 py-1 text-xs font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh PDFs'}
          </button>
        </div>
      </div>
      <div className="mt-4">
        {instructorNames.length === 0 ? (
          <p className="mt-3 text-sm text-secondary/80">
            No instructors found. Add instructors in Manage Sessions.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {instructorNames.map(name => {
              const isReady = cachedInstructors[name] ?? false
              const isBusy = busyInstructors[name] ?? false
              return (
                <div
                  key={name}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-secondary">{name}</span>
                    <span className="text-xs text-secondary/70">
                      {isReady ? 'Ready to print' : 'Not cached yet'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rounded-2xl bg-secondary px-4 py-2 text-xs font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onPrintInstructor(name)}
                    disabled={isBusy}
                  >
                    {isBusy ? 'Preparing...' : 'Print'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="mt-8 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="rounded-2xl border border-secondary/40 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </PrintModalShell>
  )
}

export default InstructorOptionsModal
