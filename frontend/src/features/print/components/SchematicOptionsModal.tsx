import React from 'react'
import PrintModalShell from './PrintModalShell'

type SchematicOptions = {
  highlightInstructor: boolean
  selectedInstructor: string
}

type SchematicOptionsModalProps = {
  open: boolean
  options: SchematicOptions
  instructorNames: string[]
  onClose: () => void
  onToggleHighlight: () => void
  onSelectInstructor: (value: string) => void
  onPrint: () => void
}

function SchematicOptionsModal({
  open,
  options,
  instructorNames,
  onClose,
  onToggleHighlight,
  onSelectInstructor,
  onPrint,
}: SchematicOptionsModalProps) {
  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Schematic Options"
      description="Highlight a specific instructor or generate one for each."
      onClose={onClose}
    >
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
          <input
            type="checkbox"
            checked={options.highlightInstructor}
            onChange={onToggleHighlight}
          />
          Highlight Instructor Name
        </label>
        <label className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
          Instructor
          <select
            className="rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary disabled:cursor-not-allowed disabled:opacity-60"
            value={options.selectedInstructor}
            disabled={!options.highlightInstructor}
            onChange={event => onSelectInstructor(event.target.value)}
          >
            {!options.highlightInstructor ? (
              <option value="none">None</option>
            ) : (
              <>
                <option value="one-each">One Each</option>
                {instructorNames.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </>
            )}
          </select>
        </label>
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

export default SchematicOptionsModal
