import { useEffect, useRef, useState } from 'react'
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import type { PlannerCallScriptKey, PlannerDataset, PlannerShareSession } from '../../../types/app'
import {
  DEFAULT_PLANNER_CALL_SCRIPTS,
  normalizePlannerCallScripts,
  PLANNER_CALL_SCRIPT_KEYS,
  PLANNER_CALL_SCRIPT_LABELS,
  PLANNER_CALL_SCRIPT_TOKENS,
} from '../../../lib/sessionPlanner'

type PlannerHeaderProps = {
  dataset: PlannerDataset | null
  callScripts: Record<PlannerCallScriptKey, string> | undefined
  error: string
  isPopout: boolean
  isSharedMode: boolean
  isShareHost: boolean
  isSharingBusy: boolean
  shareCode: string
  shareDisplayName: string
  shareLocationOverrides: Record<string, string>
  shareNotice: string
  sharePhoneNumber: string
  shareCcEmail: string
  shareSession: PlannerShareSession | null
  statusMessage: string
  showPlannedChangesButton: boolean
  onHandleAddUpload: (file: File | null) => void | Promise<void>
  onHandleAddEmptyClassesUpload: (file: File | null) => void | Promise<void>
  onHandleUpload: (file: File | null) => void | Promise<void>
  onJoinSharedPlanner: () => void | Promise<void>
  onLeaveSharedPlannerSession: () => void | Promise<void>
  onLoadState: (file: File | null) => void | Promise<void>
  onOpenPopout: () => void
  onOpenPlannedChanges: () => void
  onSaveState: () => void
  onSetShareDisplayName: (value: string) => void
  onSetShareLocationOverride: (facility: string, value: string) => void
  onSetSharePhoneNumber: (value: string) => void
  onSetShareCcEmail: (value: string) => void
  onSetCallScripts: (value: Record<PlannerCallScriptKey, string>) => void | Promise<void>
  onSaveSharedDetails: () => void | Promise<void>
  onStartSharing: () => void | Promise<void>
  onStopSharing: () => void | Promise<void>
}

type CallScriptLibraryModalProps = {
  callScripts: Record<PlannerCallScriptKey, string>
  isBusy: boolean
  onClose: () => void
  onSave: (value: Record<PlannerCallScriptKey, string>) => void | Promise<void>
}

function CallScriptLibraryModal({ callScripts, isBusy, onClose, onSave }: CallScriptLibraryModalProps) {
  const [activeKey, setActiveKey] = useState<PlannerCallScriptKey>('cancellation_live')
  const [drafts, setDrafts] = useState(callScripts)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const activeValue = drafts[activeKey] ?? ''

  useEffect(() => {
    setDrafts(callScripts)
  }, [callScripts])

  const insertToken = (token: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setDrafts(current => ({
        ...current,
        [activeKey]: `${current[activeKey] ?? ''}${current[activeKey] ? ' ' : ''}${token}`,
      }))
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const next = `${activeValue.slice(0, start)}${token}${activeValue.slice(end)}`
    setDrafts(current => ({
      ...current,
      [activeKey]: next,
    }))
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-card border-2 border-secondary/20 bg-accent p-7 text-secondary shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
              Call Scripts
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Script Library</h3>
          </div>
          <button
            type="button"
            className="rounded-full border border-secondary/30 px-3 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {PLANNER_CALL_SCRIPT_KEYS.map(scriptKey => (
              <button
                key={scriptKey}
                type="button"
                className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${activeKey === scriptKey ? 'bg-primary text-accent' : 'border border-secondary/20 bg-bg text-secondary hover:bg-primary/10'}`}
                onClick={() => setActiveKey(scriptKey)}
              >
                {PLANNER_CALL_SCRIPT_LABELS[scriptKey]}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
            <p className="text-sm font-semibold text-secondary">
              {PLANNER_CALL_SCRIPT_LABELS[activeKey]}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PLANNER_CALL_SCRIPT_TOKENS.map(token => (
                <button
                  key={token}
                  type="button"
                  className="rounded-full border border-secondary/20 bg-accent px-3 py-1 text-xs font-semibold text-secondary transition hover:bg-primary/10"
                  onClick={() => insertToken(token)}
                >
                  {token}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="mt-3 min-h-72 w-full rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
              value={activeValue}
              onChange={event =>
                setDrafts(current => ({
                  ...current,
                  [activeKey]: event.target.value,
                }))
              }
              placeholder={DEFAULT_PLANNER_CALL_SCRIPTS[activeKey]}
            />
            <p className="mt-2 text-xs text-secondary/70">
              Leave blank to use the built-in default for this script.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded-2xl border border-secondary/30 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void onSave(normalizePlannerCallScripts(drafts))}
            disabled={isBusy}
          >
            {isBusy ? 'Saving...' : 'Save Scripts'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlannerHeader({
  dataset,
  callScripts,
  error,
  isPopout,
  isSharedMode,
  isShareHost,
  isSharingBusy,
  shareCode,
  shareDisplayName,
  shareLocationOverrides,
  shareNotice,
  sharePhoneNumber,
  shareCcEmail,
  shareSession,
  statusMessage,
  showPlannedChangesButton,
  onHandleAddUpload,
  onHandleAddEmptyClassesUpload,
  onHandleUpload,
  onJoinSharedPlanner,
  onLeaveSharedPlannerSession,
  onLoadState,
  onOpenPopout,
  onOpenPlannedChanges,
  onSaveState,
  onSetShareDisplayName,
  onSetShareLocationOverride,
  onSetSharePhoneNumber,
  onSetShareCcEmail,
  onSetCallScripts,
  onSaveSharedDetails,
  onStartSharing,
  onStopSharing,
}: PlannerHeaderProps) {
  const [isScriptLibraryOpen, setIsScriptLibraryOpen] = useState(false)
  const normalizedCallScripts = normalizePlannerCallScripts(callScripts)
  const facilities = dataset
    ? Array.from(new Set(dataset.sessions.map(session => session.facility))).sort((left, right) =>
        left.localeCompare(right),
      )
    : []

  return (
    <div id="planner-header" data-component="planner-header" className="rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Session Planning
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Session Planning / Reorganization</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-secondary/30 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onSaveState}
            disabled={!dataset}
          >
            Save State
          </button>
          <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-secondary/30 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10">
            <span>Load State</span>
            <input
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              type="file"
              accept=".txt,.json"
              onChange={event => {
                void onLoadState(event.target.files?.[0] ?? null)
                event.target.value = ''
              }}
            />
          </label>
          {showPlannedChangesButton ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-secondary/30 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
              onClick={onOpenPlannedChanges}
            >
              Planned Changes
            </button>
          ) : null}
          {dataset ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-secondary/30 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
              onClick={() => setIsScriptLibraryOpen(true)}
            >
              Call Scripts
            </button>
          ) : null}
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
      </div>
      <p className="mt-2 max-w-3xl text-secondary/80">
        Upload a participant CSV to review classes by day and location, flag cancellations,
        track calls, offer exact-level alternatives, and optionally add empty classes from a
        schematic CSV.
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
            <label className="relative flex h-12 items-center justify-center rounded-2xl border-2 border-dashed border-secondary/40 bg-secondary/5 px-5 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-secondary hover:bg-secondary/10">
              <span>Add Empty Classes CSV</span>
              <input
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                type="file"
                accept=".csv"
                onChange={event => {
                  void onHandleAddEmptyClassesUpload(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />
            </label>
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
              {facilities.length > 0 ? (
                <div className="flex min-w-[280px] flex-[1.4] flex-col gap-2">
                  <p className="text-sm font-semibold text-secondary">Location overrides (optional)</p>
                  <div className="grid gap-2">
                    {facilities.map(facility => (
                      <label
                        key={facility}
                        className="grid gap-2 text-sm font-semibold text-secondary md:grid-cols-[minmax(0,180px)_minmax(0,1fr)] md:items-center"
                      >
                        <span className="break-words">{facility}</span>
                        <input
                          className="rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
                          value={shareLocationOverrides[facility] ?? ''}
                          onChange={event => onSetShareLocationOverride(facility, event.target.value)}
                          placeholder="Recreation centre name"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
                Callback phone (optional)
                <input
                  className="rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
                  value={sharePhoneNumber}
                  onChange={event => onSetSharePhoneNumber(event.target.value)}
                  placeholder="905-555-1234"
                />
              </label>
              <label className="flex min-w-[240px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
                CC email (optional)
                <input
                  className="rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
                  value={shareCcEmail}
                  onChange={event => onSetShareCcEmail(event.target.value)}
                  placeholder="staff@centre.ca"
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
                <div className="flex min-w-[280px] flex-[1.4] flex-col gap-2">
                  <p className="text-sm font-semibold text-secondary">Location overrides</p>
                  <div className="grid gap-2">
                    {facilities.map(facility => (
                      <label
                        key={facility}
                        className="grid gap-2 text-sm font-semibold text-secondary md:grid-cols-[minmax(0,180px)_minmax(0,1fr)] md:items-center"
                      >
                        <span className="break-words">{facility}</span>
                        <input
                          className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                          value={shareLocationOverrides[facility] ?? ''}
                          onChange={event => onSetShareLocationOverride(facility, event.target.value)}
                          placeholder="Recreation centre name"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
                  Callback phone
                  <input
                    className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                    value={sharePhoneNumber}
                    onChange={event => onSetSharePhoneNumber(event.target.value)}
                    placeholder="905-555-1234"
                  />
                </label>
                <label className="flex min-w-[240px] flex-1 flex-col gap-2 text-sm font-semibold text-secondary">
                  CC email
                  <input
                    className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                    value={shareCcEmail}
                    onChange={event => onSetShareCcEmail(event.target.value)}
                    placeholder="staff@centre.ca"
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
                  <span className="font-semibold">Location overrides:</span>{' '}
                  {Object.keys(shareSession.locationOverrides ?? {}).length > 0
                    ? Object.entries(shareSession.locationOverrides)
                        .map(([facility, name]) => `${facility}: ${name}`)
                        .join(' | ')
                    : 'Not provided'}
                </div>
                <div className="rounded-xl border border-secondary/20 bg-bg px-3 py-3 text-sm text-secondary">
                  <span className="font-semibold">Callback phone:</span>{' '}
                  {shareSession.callbackPhoneNumber || 'Not provided'}
                </div>
                <div className="rounded-xl border border-secondary/20 bg-bg px-3 py-3 text-sm text-secondary">
                  <span className="font-semibold">CC email:</span>{' '}
                  {shareSession.ccEmail || 'Not provided'}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {isScriptLibraryOpen ? (
        <CallScriptLibraryModal
          callScripts={normalizedCallScripts}
          isBusy={isSharingBusy}
          onClose={() => setIsScriptLibraryOpen(false)}
          onSave={async nextScripts => {
            await onSetCallScripts(nextScripts)
            setIsScriptLibraryOpen(false)
          }}
        />
      ) : null}
      {statusMessage ? <p className="mt-4 text-sm font-semibold text-primary">{statusMessage}</p> : null}
      {error ? <p className="mt-4 text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  )
}

export default PlannerHeader
