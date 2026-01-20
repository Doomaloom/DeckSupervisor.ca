import React from 'react'
import PrintModalShell from './PrintModalShell'

type InstructorExtras = {
  singlePrint: boolean
  schematicCoverPage: boolean
}

type InstructorOptionsModalProps = {
  open: boolean
  instructorNames: string[]
  selections: Record<string, boolean>
  extras: InstructorExtras
  onClose: () => void
  onToggleInstructor: (name: string) => void
  onToggleExtra: (key: keyof InstructorExtras) => void
  onPrint: () => void
}

function InstructorOptionsModal({
  open,
  instructorNames,
  selections,
  extras,
  onClose,
  onToggleInstructor,
  onToggleExtra,
  onPrint,
}: InstructorOptionsModalProps) {
  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Instructor Sheets Options"
      description="Choose what to include in the instructor packets."
      onClose={onClose}
    >
      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
          Instructors
        </p>
        {instructorNames.length === 0 ? (
          <p className="mt-3 text-sm text-secondary/80">
            No instructors found. Add instructors in Manage Sessions.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {instructorNames.map(name => (
              <label
                key={name}
                className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary"
              >
                <input
                  type="checkbox"
                  checked={selections[name] ?? false}
                  onChange={() => onToggleInstructor(name)}
                />
                {name}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">Extras</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
            <input
              type="checkbox"
              checked={extras.singlePrint}
              onChange={() => onToggleExtra('singlePrint')}
            />
            Single Print
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
            <input
              type="checkbox"
              checked={extras.schematicCoverPage}
              onChange={() => onToggleExtra('schematicCoverPage')}
            />
            Schematic Coverpage
          </label>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="rounded-2xl border border-secondary/40 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
          onClick={onClose}
        >
          Close
        </button>
        <button
          type="button"
          className="rounded-2xl bg-secondary px-5 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
          onClick={onPrint}
        >
          Print
        </button>
      </div>
    </PrintModalShell>
  )
}

export default InstructorOptionsModal
