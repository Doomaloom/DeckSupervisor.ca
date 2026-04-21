import { getSessionListDisplayMeta } from '../utils/sessionCollections'
import type { SessionListItem } from '../types'

type SessionListCardProps = {
  item: SessionListItem
  isCurrent?: boolean
  onClick: () => void
}

function SessionListCard({ item, isCurrent = false, onClick }: SessionListCardProps) {
  const meta = getSessionListDisplayMeta(item)
  const textClassName = 'min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]'

  return (
    <button
      type="button"
      className={`flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-card border-2 bg-accent p-5 text-left text-secondary shadow-md transition hover:-translate-y-0.5 ${
        isCurrent ? 'border-secondary' : 'border-secondary/20'
      }`}
      onClick={onClick}
    >
      <h3 className={`min-w-0 text-lg font-semibold ${textClassName}`}>{meta.title}</h3>
      <p className={textClassName}>
        {meta.startDate} - {meta.endDate}
      </p>
      <p className={textClassName}>{meta.instructorCount} instructors</p>
      {meta.rosterFileName ? <p className={textClassName}>Roster: {meta.rosterFileName}</p> : null}
      {meta.location ? (
        <p className={`text-sm text-secondary/70 ${textClassName}`}>{meta.location}</p>
      ) : item.kind !== 'local' ? (
        <p className={`text-sm text-secondary/70 ${textClassName}`}>No location set</p>
      ) : null}
      {meta.sourceLocations.length > 1 ? (
        <p className={`text-sm text-secondary/70 ${textClassName}`}>
          Includes: {meta.sourceLocations.join(', ')}
        </p>
      ) : null}
      {meta.shareDate ? (
        <p className={`text-sm text-secondary/70 ${textClassName}`}>Shared for {meta.shareDate}</p>
      ) : null}
      {isCurrent ? <p className={textClassName}>Current session</p> : null}
    </button>
  )
}

export default SessionListCard
