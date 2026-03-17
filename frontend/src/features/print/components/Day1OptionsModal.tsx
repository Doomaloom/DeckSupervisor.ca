import React from 'react'
import type { FormatOptions } from '../../../types/app'
import {
  courseHeaderStyleOptions,
  formatOptionItems,
  timeHeaderStyleOptions,
} from '../../masterlist/constants'
import PrintModalShell from './PrintModalShell'

type Day1Options = {
  schematicCoverPage: boolean
  highlightInstructorName: boolean
  customMasterlistFormat: boolean
}

type Day1OptionsModalProps = {
  open: boolean
  options: Day1Options
  formatOptions: FormatOptions
  onClose: () => void
  onToggle: (key: keyof Day1Options) => void
  onToggleFormat: (key: keyof FormatOptions) => void
  onPrint: () => void
}

function Day1OptionsModal({
  open,
  options,
  formatOptions,
  onClose,
  onToggle,
  onToggleFormat,
  onPrint,
}: Day1OptionsModalProps) {
  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Day 1 Print Options"
      description="Choose the cover and masterlist settings for the Day 1 print set."
      onClose={onClose}
    >
      <div className="mt-6 flex flex-col gap-4">
        <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
          <input
            type="checkbox"
            checked={options.schematicCoverPage}
            onChange={() => onToggle('schematicCoverPage')}
          />
          Schematic Cover Page
        </label>

        {options.schematicCoverPage ? (
          <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
            <input
              type="checkbox"
              checked={options.highlightInstructorName}
              onChange={() => onToggle('highlightInstructorName')}
            />
            Highlight Instructor Name
          </label>
        ) : null}

        <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
          <input
            type="checkbox"
            checked={options.customMasterlistFormat}
            onChange={() => onToggle('customMasterlistFormat')}
          />
          Custom Masterlist Format
        </label>
      </div>

      {options.customMasterlistFormat ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <fieldset className="flex flex-col gap-2 rounded-2xl border-2 border-secondary p-3">
            <legend className="px-2 text-xs font-semibold">Format Options</legend>
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
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
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

export default Day1OptionsModal
