import React from 'react'
import type { FormatOptions } from '../../../types/app'
import {
  courseHeaderStyleOptions,
  formatOptionItems,
  timeHeaderStyleOptions,
} from '../../masterlist/constants'
import PrintModalShell from './PrintModalShell'

type MasterlistExtras = {
  schematicCoverPage: boolean
}

type MasterlistOptionsModalProps = {
  open: boolean
  extras: MasterlistExtras
  coverOrientation: 'portrait' | 'landscape'
  formatOptions: FormatOptions
  onToggleFormat: (key: keyof FormatOptions) => void
  onClose: () => void
  onToggle: (key: keyof MasterlistExtras) => void
  onSelectCoverOrientation: (value: 'portrait' | 'landscape') => void
  onPrint: () => void
}

function MasterlistOptionsModal({
  open,
  extras,
  coverOrientation,
  formatOptions,
  onToggleFormat,
  onClose,
  onToggle,
  onSelectCoverOrientation,
  onPrint,
}: MasterlistOptionsModalProps) {
  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Masterlist Options"
      description="Choose formatting options and add a schematic coverpage to the masterlist."
      onClose={onClose}
    >
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <fieldset className="flex flex-col gap-2 rounded-2xl border-2 border-secondary p-3">
          <legend className="px-2 text-xs font-semibold">Format Options</legend>
          <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary">
            <input
              type="checkbox"
              checked={extras.schematicCoverPage}
              onChange={() => onToggle('schematicCoverPage')}
            />
            Schematic Coverpage
          </label>
          {extras.schematicCoverPage && (
            <label className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary">
              Cover Orientation
              <select
                className="rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary"
                value={coverOrientation}
                onChange={event =>
                  onSelectCoverOrientation(
                    event.target.value === 'landscape' ? 'landscape' : 'portrait',
                  )
                }
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          )}
          {formatOptionItems.map(option => (
            <label
              key={option.key}
              className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary"
            >
              <input
                type="checkbox"
                checked={formatOptions[option.key]}
                onChange={() => onToggleFormat(option.key)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2 rounded-2xl border-2 border-secondary p-3">
            <legend className="px-2 text-xs font-semibold">Time Header Style</legend>
            {timeHeaderStyleOptions.map(option => (
              <label
                key={option.key}
                className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary"
              >
                <input
                  type="checkbox"
                  checked={formatOptions[option.key]}
                  onChange={() => onToggleFormat(option.key)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2 rounded-2xl border-2 border-secondary p-3">
            <legend className="px-2 text-xs font-semibold">Course Header Style</legend>
            {courseHeaderStyleOptions.map(option => (
              <label
                key={option.key}
                className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary"
              >
                <input
                  type="checkbox"
                  checked={formatOptions[option.key]}
                  onChange={() => onToggleFormat(option.key)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
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

export default MasterlistOptionsModal
