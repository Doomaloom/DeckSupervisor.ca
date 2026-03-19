import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import type { PlannerDataset, PlannerShareSession } from '../../../types/app'

type PlannerHeaderProps = {
  dataset: PlannerDataset | null
  error: string
  isPopout: boolean
  isSharedMode: boolean
  isShareHost: boolean
  isSharingBusy: boolean
  shareCode: string
  shareDisplayName: string
  shareLocationName: string
  shareNotice: string
  sharePhoneNumber: string
  shareSession: PlannerShareSession | null
  onHandleAddUpload: (file: File | null) => void | Promise<void>
  onHandleUpload: (file: File | null) => void | Promise<void>
  onJoinSharedPlanner: () => void | Promise<void>
  onLeaveSharedPlannerSession: () => void | Promise<void>
  onOpenPopout: () => void
  onSetShareDisplayName: (value: string) => void
  onSetShareLocationName: (value: string) => void
  onSetSharePhoneNumber: (value: string) => void
  onSaveSharedDetails: () => void | Promise<void>
  onStartSharing: () => void | Promise<void>
  onStopSharing: () => void | Promise<void>
}

function PlannerHeader({
  dataset,
  error,
  isPopout,
  isSharedMode,
  isShareHost,
  isSharingBusy,
  shareCode,
  shareDisplayName,
  shareLocationName,
  shareNotice,
  sharePhoneNumber,
  shareSession,
  onHandleAddUpload,
  onHandleUpload,
  onJoinSharedPlanner,
  onLeaveSharedPlannerSession,
  onOpenPopout,
  onSetShareDisplayName,
  onSetShareLocationName,
  onSetSharePhoneNumber,
  onSaveSharedDetails,
  onStartSharing,
  onStopSharing,
}: PlannerHeaderProps) {
  return (
    <div id="planner-header" data-component="planner-header" className="rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Session Planning
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Session Planning / Reorganization</h2>
        </div>
        {!isPopout ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-secondary/30 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
            onClick={onOpenPopout}
          >
            <ArrowsPointingOutIcon className="h-4 w-4" />
            Pop Out Planner
          </button>
        ) : null}
      </div>
      <p className="mt-2 max-w-3xl text-secondary/80">
        Upload a participant CSV to review classes by day and location, flag cancellations,
        track calls, and offer exact-level alternatives.
      </p>
      {!shareCode ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <label className="relative flex h-12 items-center justify-center rounded-2xl border-2 border-dashed border-secondary bg-bg px-5 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-primary">
              <span>{dataset ? 'Replace Planner CSV' : 'Upload Planner CSV'}</span>
              <input
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                type="file"
                accept=".csv"
                onChange={event => {
                  void onHandleUpload(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />
            </label>
            {dataset ? (
              <label className="relative flex h-12 items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-5 text-sm font-semibold text-primary transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10">
                <span>Add CSV</span>
                <input
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  type="file"
                  accept=".csv"
                  onChange={event => {
                    void onHandleAddUpload(event.target.files?.[0] ?? null)
                    event.target.value = ''
                  }}
                />
              </label>
            ) : null}
            {dataset ? (
              <p className="text-sm text-secondary/70">
                Loaded: <span className="font-semibold text-secondary">{dataset.sourceFileName}</span>
              </p>
            ) : null}
          </div>
          {dataset ? (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-secondary/20 bg-bg p-4">
              <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
                Shared session name
                <input
                  className="rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
                  value={shareDisplayName}
                  onChange={event => onSetShareDisplayName(event.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
                Location name (optional)
                <input
                  className="rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
                  value={shareLocationName}
                  onChange={event => onSetShareLocationName(event.target.value)}
                  placeholder="Recreation centre name"
                />
              </label>
              <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
                Callback phone (optional)
                <input
                  className="rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
                  value={sharePhoneNumber}
                  onChange={event => onSetSharePhoneNumber(event.target.value)}
                  placeholder="905-555-1234"
                />
              </label>
              <button
                type="button"
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void onStartSharing()}
                disabled={isSharingBusy}
              >
                {isSharingBusy ? 'Starting...' : 'Start Sharing'}
              </button>
            </div>
          ) : null}
        </>
      ) : !isSharedMode ? (
        <div className="mt-5 rounded-2xl border border-secondary/20 bg-bg p-5">
          <h3 className="text-lg font-semibold text-secondary">Join Shared Planner</h3>
          <p className="mt-2 text-sm text-secondary/70">
            Enter a display name to join share code <span className="font-semibold text-secondary">{shareCode}</span>.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
              Display name
              <input
                className="rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
                value={shareDisplayName}
                onChange={event => onSetShareDisplayName(event.target.value)}
                placeholder="Your name"
              />
            </label>
            <button
              type="button"
              className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onJoinSharedPlanner()}
              disabled={isSharingBusy}
            >
              {isSharingBusy ? 'Joining...' : 'Join Shared Planner'}
            </button>
          </div>
        </div>
      ) : shareSession ? (
        <div className="mt-5 rounded-2xl border border-secondary/20 bg-bg p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                Shared Session
              </p>
              <p className="mt-2 text-lg font-semibold text-secondary">
                Code {shareSession.code} • v{shareSession.version}
              </p>
              <p className="mt-1 text-sm text-secondary/70">
                Expires {new Date(shareSession.expiresAt).toLocaleString()}
              </p>
              {shareNotice ? <p className="mt-2 text-sm text-secondary/80">{shareNotice}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-2xl border border-secondary/30 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent"
                onClick={() => void navigator.clipboard.writeText(shareSession.shareUrl)}
              >
                Copy Share Link
              </button>
              {isShareHost ? (
                <button
                  type="button"
                  className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900 transition hover:-translate-y-0.5"
                  onClick={() => void onStopSharing()}
                  disabled={isSharingBusy}
                >
                  Stop Sharing
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-2xl border border-secondary/30 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent"
                  onClick={() => void onLeaveSharedPlannerSession()}
                  disabled={isSharingBusy}
                >
                  Leave Shared Planner
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {shareSession.participants.map(participant => (
              <span
                key={participant.id}
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${participant.isHost ? 'border-primary bg-primary/10 text-primary' : 'border-secondary/20 bg-accent text-secondary'}`}
              >
                {participant.displayName}
                {participant.isHost ? ' • Host' : ''}
              </span>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-secondary/20 bg-accent p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary/70">
              Shared Call Details
            </p>
            {isShareHost ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
                  Location name
                  <input
                    className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                    value={shareLocationName}
                    onChange={event => onSetShareLocationName(event.target.value)}
                    placeholder="Recreation centre name"
                  />
                </label>
                <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
                  Callback phone
                  <input
                    className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                    value={sharePhoneNumber}
                    onChange={event => onSetSharePhoneNumber(event.target.value)}
                    placeholder="905-555-1234"
                  />
                </label>
                <button
                  type="button"
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void onSaveSharedDetails()}
                  disabled={isSharingBusy}
                >
                  {isSharingBusy ? 'Saving...' : 'Update Shared Info'}
                </button>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-secondary/20 bg-bg px-3 py-3 text-sm text-secondary">
                  <span className="font-semibold">Location name:</span>{' '}
                  {shareSession.locationName || 'Not provided'}
                </div>
                <div className="rounded-xl border border-secondary/20 bg-bg px-3 py-3 text-sm text-secondary">
                  <span className="font-semibold">Callback phone:</span>{' '}
                  {shareSession.callbackPhoneNumber || 'Not provided'}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  )
}

export default PlannerHeader
