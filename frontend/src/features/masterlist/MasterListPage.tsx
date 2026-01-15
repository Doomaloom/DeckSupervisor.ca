import React, { useState } from 'react'
import { useDay } from '../../app/DayContext'
import FormattingOptionsPanel from './components/FormattingOptionsPanel'
import RememberOptionsRow from './components/RememberOptionsRow'
import SubmitButton from './components/SubmitButton'
import { useMasterListFormatting } from './hooks/useMasterListFormatting'
import { submitMasterList } from './submitMasterList'
import ColumnOptionsPanel from './components/ColumnOptionsPanel'
import { columnOptionItems } from './constants'

function MasterListPage() {
  const { selectedDay } = useDay()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [columnSelections, setColumnSelections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columnOptionItems.map(option => [option.key, true])),
  )
  const { formatOptionsState, rememberFormatting, setRememberFormatting, toggleOption } =
    useMasterListFormatting()
  const toggleColumnSelection = (key: string) => {
    setColumnSelections(current => ({
      ...current,
      [key]: !current[key],
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDay) {
      alert('Please select a day before creating a master list.')
      return
    }

    setIsSubmitting(true)
    try {
      await submitMasterList({
        selectedDay,
        formatOptions: formatOptionsState,
        rememberFormatting,
      })
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Something went wrong while generating the master list.'
      alert(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          <FormattingOptionsPanel formatOptions={formatOptionsState} onToggle={toggleOption} />
          <ColumnOptionsPanel
            options={columnOptionItems}
            selections={columnSelections}
            onToggle={toggleColumnSelection}
          />
        </div>

        <RememberOptionsRow
          rememberFormatting={rememberFormatting}
          onToggleFormatting={() => setRememberFormatting(value => !value)}
        />

        <SubmitButton isSubmitting={isSubmitting} />
      </form>
    </div>
  )
}

export default MasterListPage
