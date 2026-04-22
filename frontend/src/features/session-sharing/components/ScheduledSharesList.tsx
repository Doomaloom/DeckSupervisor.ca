import type { DbSessionEntry } from '../../session-management/types'
import type { OwnedSessionShareEntry } from '../types'

type ScheduledSharesListProps = {
  formatSessionLabel: (session: DbSessionEntry) => string
  handleRevokeShare: (shareId: string) => void
  revokingShareId: string
  shares: OwnedSessionShareEntry[]
}

function formatDisplayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getRecipientLabel(share: OwnedSessionShareEntry) {
  const firstName = share.shared_with_profile?.first_name?.trim() ?? ''
  const lastName = share.shared_with_profile?.last_name?.trim() ?? ''
  const name = `${firstName} ${lastName}`.trim()
  return name || share.shared_with_profile?.email || 'Unknown user'
}

export default function ScheduledSharesList({
  formatSessionLabel,
  handleRevokeShare,
  revokingShareId,
  shares,
}: ScheduledSharesListProps) {
  return (
    <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
      <h3 className="text-lg font-semibold">Scheduled Shares</h3>
      <p className="mt-2 text-sm text-secondary/70">
        Active and future session shares you can still revoke.
      </p>

      {shares.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary/70">
          No scheduled session shares yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {shares.map(share => (
            <div key={share.id} className="rounded-2xl border border-secondary/20 bg-bg p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {share.session ? formatSessionLabel(share.session) : 'Shared session'}
                  </p>
                  <p className="mt-1 text-sm text-secondary/70">{getRecipientLabel(share)}</p>
                </div>
                <button
                  type="button"
                  className="rounded-2xl border border-danger/60 px-4 py-2 text-sm font-semibold text-danger transition hover:-translate-y-0.5 hover:bg-danger hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleRevokeShare(share.id)}
                  disabled={revokingShareId === share.id}
                >
                  {revokingShareId === share.id ? 'Revoking…' : 'Revoke'}
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary/60">Share Date</p>
                  <p className="mt-1 text-sm font-semibold">{formatDisplayDate(share.share_date)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary/60">Roster Access</p>
                  <p className="mt-1 text-sm font-semibold">
                    {share.allow_roster_edits ? 'Roster edits allowed' : 'View only'}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-secondary/60">
                Created {new Date(share.created_at).toLocaleString('en-CA')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
