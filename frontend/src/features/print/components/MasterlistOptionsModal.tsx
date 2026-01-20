import React from 'react'
import PrintModalShell from './PrintModalShell'

type MasterlistExtras = {
  schematicCoverPage: boolean
}

type MasterlistOptionsModalProps = {
  open: boolean
  extras: MasterlistExtras
  onClose: () => void
  onToggle: (key: keyof MasterlistExtras) => void
  onPrint: () => void
}

function MasterlistOptionsModal({
  open,
  extras,
  onClose,
  onToggle,
  onPrint,
}: MasterlistOptionsModalProps) {
  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Masterlist Options"
      description="Choose whether to add a schematic coverpage to the masterlist."
      onClose={onClose}
    >
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
          <input
            type="checkbox"
            checked={extras.schematicCoverPage}
            onChange={() => onToggle('schematicCoverPage')}
          />
          Schematic Coverpage
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

export default MasterlistOptionsModal
