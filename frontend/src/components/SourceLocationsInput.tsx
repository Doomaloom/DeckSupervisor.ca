import { useState } from 'react'
import { normalizeSessionLocations } from '../shared/session/sourceLocations'

type SourceLocationsInputProps = {
  label?: string
  values: string[]
  suggestions?: string[]
  inputId?: string
  helperText?: string
  onChange: (values: string[]) => void
}

function SourceLocationsInput({
  label = 'Included Raw Locations',
  values,
  suggestions = [],
  inputId,
  helperText,
  onChange,
}: SourceLocationsInputProps) {
  const [draft, setDraft] = useState('')

  const addDraft = () => {
    const next = normalizeSessionLocations([...values, draft])
    if (next.length === values.length) {
      return
    }
    onChange(next)
    setDraft('')
  }

  const removeValue = (value: string) => {
    onChange(values.filter(entry => entry !== value))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-semibold text-secondary">{label}</span>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
          type="text"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addDraft()
            }
          }}
          list={suggestions.length > 0 && inputId ? inputId : undefined}
          placeholder="Add raw CSV location"
        />
        <button
          type="button"
          className="rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-primary"
          onClick={addDraft}
        >
          Add
        </button>
      </div>
      {suggestions.length > 0 && inputId ? (
        <datalist id={inputId}>
          {suggestions.map(option => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
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
