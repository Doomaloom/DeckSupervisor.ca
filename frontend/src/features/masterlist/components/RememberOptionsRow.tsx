import React from 'react'
import { optionClass } from '../utils'

type RememberOptionsRowProps = {
  rememberFormatting: boolean
  onToggleFormatting: () => void
  rememberInstructors?: boolean
  onToggleInstructors?: () => void
}

function RememberOptionsRow({
  rememberInstructors,
  rememberFormatting,
  onToggleInstructors,
  onToggleFormatting,
}: RememberOptionsRowProps) {
  const showInstructors = typeof rememberInstructors === 'boolean' && typeof onToggleInstructors === 'function'
  const gridClass = showInstructors ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4'

  return (
    <div className={gridClass}>
      {showInstructors ? (
        <button
          type="button"
          className={optionClass(rememberInstructors)}
          onClick={onToggleInstructors}
        >
          Remember Instructors and Classes
        </button>
      ) : null}
      <button
        type="button"
        className={optionClass(rememberFormatting)}
        onClick={onToggleFormatting}
      >
        Remember Formatting Options
      </button>
    </div>
  )
}

export default RememberOptionsRow
