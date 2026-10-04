import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AccountProfile } from '../../lib/serverApi'

type Props = {
  label: string
  disabled?: boolean
  compact?: boolean
  search: (query: string) => Promise<AccountProfile[]>
  renderAction: (profile: AccountProfile) => ReactNode
}

export default function AccountSearch({ label, disabled = false, compact = false, search, renderAction }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AccountProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const pending = useRef(false)
  useEffect(() => () => { generation.current += 1 }, [])

  async function handleSearch() {
    if (pending.current || disabled || !query.trim()) return
    pending.current = true
    const request = ++generation.current
    setLoading(true)
    setError('')
    setResults([])
    setSearched(false)
    try {
      const profiles = await search(query.trim())
      if (request === generation.current) {
        setResults(profiles)
        setSearched(true)
      }
    } catch (error) {
      if (request === generation.current) setError(error instanceof Error ? error.message : 'Search failed')
    } finally {
      if (request === generation.current) {
        pending.current = false
        setLoading(false)
      }
    }
  }

  return <div className={compact ? '' : 'mt-3'}>
    <div className="flex flex-wrap gap-2">
      <label className="flex min-w-0 flex-1 basis-48 flex-col gap-2 text-sm font-semibold">
        {label}
        <input
          className="w-full min-w-0 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
          value={query}
          onChange={event => { setQuery(event.target.value); setResults([]); setSearched(false); setError('') }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void handleSearch() } }}
          disabled={disabled || loading}
          placeholder="Search first name, last name or email"
        />
      </label>
      <button type="button" className="self-end rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent disabled:opacity-60"
        onClick={() => void handleSearch()} disabled={disabled || loading || !query.trim()}>
        {loading ? 'Searching...' : 'Search'}
      </button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    <div className="mt-4 flex flex-col gap-3" aria-live="polite">
      {!error && !loading && results.length === 0 && (searched || !compact) && <p className="text-sm text-secondary/70">{searched ? 'No accounts found.' : 'No results yet.'}</p>}
      {results.map(profile => <div key={profile.id} className="rounded-2xl border border-secondary/20 bg-bg p-3">
        <p className="font-semibold">{profile.first_name} {profile.last_name}</p>
        <p className="text-xs text-secondary/70">{profile.email}</p>
        {renderAction(profile)}
      </div>)}
    </div>
  </div>
}
