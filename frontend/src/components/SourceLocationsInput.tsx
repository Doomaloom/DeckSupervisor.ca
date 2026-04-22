import { useState } from 'react'
import { normalizeSessionLocations } from '../shared/session/sourceLocations'

type SourceLocationsInputProps = {
  label?: string
  values: string[]
  options?: string[]
  helperText?: string
  onChange: (values: string[]) => void
}

function SourceLocationsInput({
  label = 'Included Raw Locations',
  values,
  options = [],
  helperText,
  onChange,
}: SourceLocationsInputProps) {
  const [selectedOption, setSelectedOption] = useState('')

  const availableOptions = options.filter(option => !values.includes(option))

  const addDraft = () => {
    const next = normalizeSessionLocations([...values, selectedOption])
    if (next.length === values.length) {
      return
    }
    onChange(next)
    setSelectedOption('')
  }

  const removeValue = (value: string) => {
    onChange(values.filter(entry => entry !== value))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-semibold text-secondary">{label}</span>
      <div className="flex gap-2">
        <select
          className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
          value={selectedOption}
          onChange={event => setSelectedOption(event.target.value)}
        >
          <option value="">
            {availableOptions.length > 0 ? 'Select raw CSV location' : 'No more raw CSV locations available'}
          </option>
          {availableOptions.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-primary"
          onClick={addDraft}
          disabled={!selectedOption}
        >
          Add
        </button>
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map(value => (
            <button
              key={value}
              type="button"
              className="rounded-full border border-secondary/20 bg-bg px-3 py-1 text-sm font-semibold text-secondary transition hover:border-secondary"
              onClick={() => removeValue(value)}
            >
              {value} ×
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-secondary/70">Add one or more raw CSV locations for this session.</p>
      )}
      {helperText ? <p className="text-xs font-medium text-secondary/70">{helperText}</p> : null}
    </div>
  )
}

export default SourceLocationsInput
