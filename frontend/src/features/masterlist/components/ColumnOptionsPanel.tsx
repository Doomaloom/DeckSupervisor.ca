import React from 'react'
import type { ColumnOptionItem } from '../constants'
import { optionClass } from '../utils'

type ColumnOptionsPanelProps = {
  options: ColumnOptionItem[]
  selections: Record<string, boolean>
  onToggle: (key: string) => void
}

function ColumnOptionsPanel({ options, selections, onToggle }: ColumnOptionsPanelProps) {
  return (
    <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
      <h2 className="mb-4 text-center text-xl font-semibold">Columns to Include</h2>
      <div className="flex flex-col gap-2">
        {options.map(option => (
          <button
            key={option.key}
            type="button"
            className={optionClass(Boolean(selections[option.key]))}
            onClick={() => onToggle(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ColumnOptionsPanel
