type SchematicScaleControlProps = {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  onReset: () => void
  compact?: boolean
}

function SchematicScaleControl({
  value,
  min,
  max,
  step,
  onChange,
  onReset,
  compact = false,
}: SchematicScaleControlProps) {
  const handleChange = (nextValue: string) => {
    const parsed = Number(nextValue)
    if (Number.isFinite(parsed)) {
      onChange(parsed)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary">
      <div className="flex items-center justify-between gap-3">
        <span>Scale</span>
        <span className="text-secondary/70">{value}%</span>
      </div>
      <div
        className={`grid gap-2 ${
          compact
            ? 'grid-cols-[minmax(0,1fr)_4.5rem_auto]'
            : 'sm:grid-cols-[minmax(0,1fr)_5rem_auto]'
        }`}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={event => handleChange(event.target.value)}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          className="rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary"
          value={value}
          onChange={event => handleChange(event.target.value)}
        />
        <button
          type="button"
          className="rounded-2xl border border-secondary/40 px-3 py-2 text-xs font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export default SchematicScaleControl
