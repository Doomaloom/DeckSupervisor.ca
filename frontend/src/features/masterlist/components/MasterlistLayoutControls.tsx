import type {
  MasterlistAlphabeticalNameBasis,
  MasterlistLayout,
} from '../../../types/app'

type MasterlistLayoutControlsProps = {
  layout: MasterlistLayout
  alphabeticalNameBasis: MasterlistAlphabeticalNameBasis
  onChangeLayout: (layout: MasterlistLayout) => void
  onChangeAlphabeticalNameBasis: (basis: MasterlistAlphabeticalNameBasis) => void
  compact?: boolean
}

function MasterlistLayoutControls({
  layout,
  alphabeticalNameBasis,
  onChangeLayout,
  onChangeAlphabeticalNameBasis,
  compact = false,
}: MasterlistLayoutControlsProps) {
  const spacing = compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
  const labelClass = `flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg font-semibold text-secondary ${spacing}`
  const selectClass = 'rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary'

  return (
    <>
      <label className={labelClass}>
        Layout
        <select
          aria-label="Masterlist layout"
          className={selectClass}
          value={layout}
          onChange={event => onChangeLayout(event.target.value === 'alphabetical' ? 'alphabetical' : 'class-time')}
        >
          <option value="class-time">Class &amp; Time</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </label>

      {layout === 'alphabetical' ? (
        <label className={labelClass}>
          Alphabetize By
          <select
            aria-label="Alphabetize by"
            className={selectClass}
            value={alphabeticalNameBasis}
            onChange={event => onChangeAlphabeticalNameBasis(
              event.target.value === 'first-name' ? 'first-name' : 'last-name',
            )}
          >
            <option value="first-name">First Name</option>
            <option value="last-name">Last Name</option>
          </select>
        </label>
      ) : null}
    </>
  )
}

export default MasterlistLayoutControls
