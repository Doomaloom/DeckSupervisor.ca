import { useEffect, useRef, useState } from 'react'
import { Notice, EmptyState, ActionButton } from '../../../general-components'
import AccountSearch from '../../../shared/accounts/AccountSearch'
import { fetchInstructorAssignments, linkInstructorAssignment, searchLinkableProfiles, type AccountProfile, type InstructorAssignment } from '../../../lib/serverApi'

function AccountLinkRow({ sessionId, row, onSaved }: { sessionId: string; row: InstructorAssignment; onSaved: () => void }) {
  const [selected, setSelected] = useState<AccountProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const active = useRef(false)
  const pending = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  async function save(accountId: string | null) {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await linkInstructorAssignment(sessionId, row.id, accountId)
      if (active.current) { setSelected(null); setMessage(accountId ? 'Account linked.' : 'Account unlinked.'); onSaved() }
    } catch (error) {
      if (active.current) setError(error instanceof Error ? error.message : 'Unable to save account link')
    } finally {
      if (active.current) { pending.current = false; setSaving(false) }
    }
  }

  const name = row.name || 'Unnamed instructor'
  return <div className="my-4 rounded-2xl border border-secondary/20 bg-bg p-4" role="group" aria-label={`Account link for ${name}`}>
    <h3 className="font-semibold">{name}</h3>
    <p className="mt-2 text-sm">Linked account: {row.account ? `${row.account.first_name} ${row.account.last_name} (${row.account.email})` : row.account_id ? 'Account details unavailable' : 'Unlinked'}</p>
    <AccountSearch label={`Search account for ${name}`} disabled={saving}
      search={async query => (await searchLinkableProfiles(sessionId, query)).results}
      renderAction={profile => <ActionButton variant="outline" disabled={saving || profile.id === row.account_id}
        onClick={() => { setSelected(profile); setMessage(''); setError('') }}>
        {profile.id === row.account_id ? 'Currently linked' : selected?.id === profile.id ? 'Selected' : 'Select account'}
      </ActionButton>} />
    {selected && <p className="my-3 text-sm">Selected: {selected.first_name} {selected.last_name} ({selected.email})</p>}
    <div className="mt-3 flex flex-wrap gap-3">
      <ActionButton disabled={saving || !selected} onClick={() => selected && void save(selected.id)}>{saving ? 'Saving...' : 'Save link'}</ActionButton>
      <ActionButton variant="outline" disabled={saving || !row.account_id} onClick={() => void save(null)}>Unlink</ActionButton>
    </div>
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </div>
}

function SessionAccountLinks({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<InstructorAssignment[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchInstructorAssignments(sessionId).then(response => { if (active) setRows(response.assignments) })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Unable to load account links') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sessionId, version])

  return <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md" aria-label="Instructor account links">
    <h2 className="text-xl font-semibold">Instructor account links</h2>
    <p className="my-3 text-sm text-secondary/70">Save the schematic first, then search for a part-time staff account to link to each saved column. Unlinking preserves lesson plans. Links save separately from session changes.</p>
    <ActionButton disabled={loading} onClick={() => setVersion(version => version + 1)}>Refresh saved columns</ActionButton>
    {loading && <p role="status" className="my-3 text-sm">Loading saved columns...</p>}
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    {rows.map(row => <AccountLinkRow key={row.id} sessionId={sessionId} row={row} onSaved={() => setVersion(version => version + 1)} />)}
    {!rows.length && !loading && !error && <EmptyState>No saved columns. Save this schematic and refresh.</EmptyState>}
  </section>
}

export default function AccountLinks({ sessionId }: { sessionId: string }) {
  return <SessionAccountLinks key={sessionId} sessionId={sessionId} />
}
