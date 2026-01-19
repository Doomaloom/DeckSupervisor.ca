import React from 'react'
import PrintModalShell from './PrintModalShell'

type Day1Options = {
  singlePrint: boolean
  namePages: boolean
  schematicCovers: boolean
  extraMasterlistCopy: boolean
}

type Day1OptionsModalProps = {
  open: boolean
  options: Day1Options
  onClose: () => void
  onToggle: (key: keyof Day1Options) => void
}

const day1Items: { key: keyof Day1Options; label: string }[] = [
  { key: 'singlePrint', label: 'Single Print' },
  { key: 'namePages', label: 'Name Pages' },
  { key: 'schematicCovers', label: 'Schematic Covers' },
  { key: 'extraMasterlistCopy', label: 'Extra Masterlist Copy' },
]

function Day1OptionsModal({ open, options, onClose, onToggle }: Day1OptionsModalProps) {
  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Day 1 Print Options"
      description="Choose which items to include when generating the Day 1 print packet."
      onClose={onClose}
    >
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {day1Items.map(option => (
          <label
            key={option.key}
            className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary"
          >
            <input
              type="checkbox"
              checked={options[option.key]}
              onChange={() => onToggle(option.key)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
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

export default Day1OptionsModal
