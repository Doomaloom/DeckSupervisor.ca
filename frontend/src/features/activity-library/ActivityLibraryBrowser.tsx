import { useId, useState } from 'react'
import { ActionButton, EmptyState, TextInput } from '../../general-components'
import { activityCategories, filterActivities, librarySkills, type ActivityCategory, type LibraryActivity } from './activityLibrary'

type Props = {
  onUse?: (activity: LibraryActivity) => void
  selectedSkill?: { id: string; compactName: string }
}

export default function ActivityLibraryBrowser({ onUse, selectedSkill }: Props) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ActivityCategory | 'All'>('All')
  const [applicableOnly, setApplicableOnly] = useState(false)
  const results = filterActivities(query, category, applicableOnly ? selectedSkill?.id : undefined)

  return <div className="min-w-0 space-y-5">
    <label htmlFor={searchId} className="block space-y-2 text-sm font-semibold">
      <span>Search activities</span>
      <TextInput id={searchId} type="search" className="w-full" placeholder="Search names, instructions, or equipment" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    <div role="group" aria-label="Activity categories" className="flex flex-wrap gap-2">
      {(['All', ...activityCategories] as const).map(value => <ActionButton key={value} variant={category === value ? 'primary' : 'outline'} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</ActionButton>)}
    </div>
    {onUse && <div className="space-y-1">
      <label className="flex items-start gap-2 text-sm font-semibold">
        <input className="mt-1 h-4 w-4 shrink-0" type="checkbox" checked={applicableOnly} disabled={!selectedSkill} onChange={event => setApplicableOnly(event.target.checked)} />
        <span>{selectedSkill ? `Only activities for ${selectedSkill.compactName}` : 'Only activities for the selected skill'}</span>
      </label>
      {!selectedSkill && <p className="text-sm text-secondary/80">Choose a curriculum skill in the lesson row to filter by skill.</p>}
    </div>}
    <p role="status" className="text-sm text-secondary/80">{results.length} {results.length === 1 ? 'activity' : 'activities'}</p>
    {!results.length && <EmptyState><p>No activities match these filters.</p><ActionButton className="mt-3" variant="outline" onClick={() => { setQuery(''); setCategory('All'); setApplicableOnly(false) }}>Clear filters</ActionButton></EmptyState>}
    {activityCategories.map(group => {
      const entries = results.filter(activity => activity.category === group)
      return entries.length > 0 && <section key={group} aria-label={group} className="space-y-3">
        <h3 className="text-xl font-semibold">{group} <span className="text-sm font-normal text-secondary/70">({entries.length})</span></h3>
        {entries.map(activity => <details key={activity.id} className="rounded-2xl border border-secondary/20 bg-accent open:shadow-sm">
          <summary className="cursor-pointer rounded-2xl p-4 font-semibold focus-visible:outline-2 focus-visible:outline-primary">{activity.title}</summary>
          <div className="space-y-4 px-4 pb-4">
            {activity.suitability && <p className="text-sm"><strong>Suitable for:</strong> {activity.suitability}</p>}
            {activity.equipment && <p className="text-sm"><strong>Equipment:</strong> {activity.equipment}</p>}
            <p className="whitespace-pre-wrap break-words leading-relaxed">{activity.instructions}</p>
            {!!activity.skillIds.length && <details className="text-sm">
              <summary className="cursor-pointer font-semibold">Applicable skills</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">{librarySkills.filter(skill => activity.skillIds.includes(skill.id)).map(skill => <li key={skill.id}>{skill.level}: {skill.compactName}</li>)}</ul>
            </details>}
            <p className="text-xs text-secondary/70">Source: Lifesaving Society, Teaching Swim for Life · Activity library.pdf, {activity.sourcePages.length === 1 ? 'scan page' : 'scan pages'} {activity.sourcePages.join(', ')}</p>
            {onUse && <ActionButton variant="primary" onClick={() => onUse(activity)} aria-label={`Use ${activity.title}`}>Use activity</ActionButton>}
          </div>
        </details>)}
      </section>
    })}
  </div>
}
