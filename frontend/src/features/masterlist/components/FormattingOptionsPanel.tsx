import React from 'react'
import type { FormatOptions } from '../../../types/app'
import { courseHeaderStyleOptions, formatOptionItems, timeHeaderStyleOptions } from '../constants'
import { optionClass } from '../utils'

type FormattingOptionsPanelProps = {
  formatOptions: FormatOptions
  onToggle: (option: keyof FormatOptions) => void
}

function FormattingOptionsPanel({ formatOptions, onToggle }: FormattingOptionsPanelProps) {
  return (
    <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
      <h2 className="mb-4 text-center text-xl font-semibold">Formatting Options</h2>
      <div className="flex flex-col gap-2">
        {formatOptionItems.map(option => (
          <button
            key={option.key}
            type="button"
            className={optionClass(formatOptions[option.key])}
            onClick={() => onToggle(option.key)}
          >
            {option.label}
          </button>
        ))}

        <fieldset className="mt-2 flex flex-col gap-2 rounded-2xl border-2 border-secondary p-4">
          <legend className="px-2 font-semibold">Time Header Style</legend>
          {timeHeaderStyleOptions.map(option => (
            <button
              key={option.key}
              type="button"
              className={optionClass(formatOptions[option.key])}
              onClick={() => onToggle(option.key)}
            >
              {option.label}
            </button>
          ))}
        </fieldset>

        <fieldset className="mt-2 flex flex-col gap-2 rounded-2xl border-2 border-secondary p-4">
          <legend className="px-2 font-semibold">Course Header Style</legend>
          {courseHeaderStyleOptions.map(option => (
            <button
              key={option.key}
              type="button"
              className={optionClass(formatOptions[option.key])}
              onClick={() => onToggle(option.key)}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      </div>
    </div>
  )
}

export default FormattingOptionsPanel
