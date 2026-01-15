import React from 'react'
import { optionClass } from '../utils'

type RememberOptionsRowProps = {
  rememberInstructors: boolean
  rememberFormatting: boolean
  onToggleInstructors: () => void
  onToggleFormatting: () => void
}

function RememberOptionsRow({
  rememberInstructors,
  rememberFormatting,
  onToggleInstructors,
  onToggleFormatting,
}: RememberOptionsRowProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <button
        type="button"
        className={optionClass(rememberInstructors)}
        onClick={onToggleInstructors}
      >
        Remember Instructors and Classes
      </button>
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
