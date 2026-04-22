import type { DbSessionEntry } from '../../session-management/types'
import type { ShareDateMode } from '../shareDates'
import type { ShareRecipient } from '../types'

type ShareWizardProps = {
  allowRosterEdits: boolean
  canConfirmShare: boolean
  canContinue: boolean
  conflictingDates: string[]
  currentStep: number
  dateMode: ShareDateMode
  filteredRecipients: ShareRecipient[]
  formatSessionLabel: (session: DbSessionEntry) => string
  handleCreateShare: () => void
  handleNextStep: () => void
  handlePreviousStep: () => void
  handleSelectRecipient: (recipient: ShareRecipient) => void
  handleSelectSession: (sessionId: string) => void
  isSubmitting: boolean
  recipientSearch: string
  rangeEndDate: string
  rangeStartDate: string
  resolvedShareDates: { dates: string[]; validationMessage: string }
  selectedRecipient: ShareRecipient | null
  selectedSession: DbSessionEntry | null
  selectedSessionId: string
  sessions: DbSessionEntry[]
  setAllowRosterEdits: (value: boolean) => void
  setCurrentStep: (value: number) => void
  setDateMode: (value: ShareDateMode) => void
  setRecipientSearch: (value: string) => void
  setRangeEndDate: (value: string) => void
  setRangeStartDate: (value: string) => void
  setSingleDate: (value: string) => void
  singleDate: string
  stepMessage: string
  recipientSearchLoading: boolean
}

const stepLabels = ['Select Session', 'Select Teammate', 'Select Dates', 'Review']

function getRecipientLabel(recipient: ShareRecipient) {
  const firstName = recipient.first_name?.trim() ?? ''
  const lastName = recipient.last_name?.trim() ?? ''
  const name = `${firstName} ${lastName}`.trim()
  return name || recipient.email || 'App user'
}

function formatDisplayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ShareWizard({
  allowRosterEdits,
  canConfirmShare,
  canContinue,
  conflictingDates,
  currentStep,
  dateMode,
  filteredRecipients,
  formatSessionLabel,
  handleCreateShare,
  handleNextStep,
  handlePreviousStep,
  handleSelectRecipient,
  handleSelectSession,
  isSubmitting,
  recipientSearch,
  rangeEndDate,
  rangeStartDate,
  resolvedShareDates,
  selectedRecipient,
  selectedSession,
  selectedSessionId,
  sessions,
  setAllowRosterEdits,
  setCurrentStep,
  setDateMode,
  setRecipientSearch,
  setRangeEndDate,
  setRangeStartDate,
  setSingleDate,
  singleDate,
  stepMessage,
  recipientSearchLoading,
}: ShareWizardProps) {
  return (
    <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
      <div className="flex flex-wrap gap-2">
        {stepLabels.map((label, index) => {
          const stepNumber = index + 1
          const isCurrent = currentStep === stepNumber
          const isComplete = currentStep > stepNumber
          return (
            <button
              key={label}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isCurrent
                  ? 'bg-secondary text-accent'
                  : isComplete
                    ? 'border border-secondary/30 bg-bg text-secondary'
                    : 'border border-secondary/20 bg-white/60 text-secondary/70'
              }`}
              onClick={() => setCurrentStep(stepNumber)}
            >
              {stepNumber}. {label}
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        {currentStep === 1 ? (
          <>
            <h3 className="text-lg font-semibold">Select Session</h3>
            <p className="mt-2 text-sm text-secondary/70">
              Choose one of your sessions that is currently inside its active start/end schedule.
            </p>
            {sessions.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary/70">
                No shareable sessions found. Only sessions currently active today appear here.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {sessions.map(session => (
                  <button
                    key={session.id}
                    type="button"
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedSessionId === session.id
                        ? 'border-secondary bg-secondary text-accent'
                        : 'border-secondary/20 bg-bg hover:-translate-y-0.5 hover:border-secondary'
                    }`}
                    onClick={() => handleSelectSession(session.id)}
                  >
                    <p className="font-semibold">{formatSessionLabel(session)}</p>
                    <p className="mt-1 text-xs opacity-80">{session.location ?? 'No location set'}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}

        {currentStep === 2 ? (
          <>
            <h3 className="text-lg font-semibold">Select User</h3>
            <p className="mt-2 text-sm text-secondary/70">
              Search for another user already on the app.
            </p>
            <input
              className="mt-4 w-full rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
              value={recipientSearch}
              onChange={event => setRecipientSearch(event.target.value)}
              placeholder="Search by name or email"
            />
            {recipientSearch.trim().length < 2 ? (
              <p className="mt-4 rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary/70">
                Enter at least 2 characters to search users.
              </p>
            ) : recipientSearchLoading ? (
              <p className="mt-4 text-sm text-secondary/70">Searching users…</p>
            ) : filteredRecipients.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary/70">
                No matching users found.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {filteredRecipients.map(recipient => (
                  <button
                    key={recipient.id}
                    type="button"
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedRecipient?.id === recipient.id
                        ? 'border-secondary bg-secondary text-accent'
                        : 'border-secondary/20 bg-bg hover:-translate-y-0.5 hover:border-secondary'
                    }`}
                    onClick={() => handleSelectRecipient(recipient)}
                  >
                    <p className="font-semibold">{getRecipientLabel(recipient)}</p>
                    <p className="mt-1 text-xs opacity-80">{recipient.email || 'No email on file'}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}

        {currentStep === 3 ? (
          <>
            <h3 className="text-lg font-semibold">Select Dates</h3>
            <p className="mt-2 text-sm text-secondary/70">
              Choose one date or a range. Ranges only create shares on the session&apos;s weekday.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  dateMode === 'single'
                    ? 'bg-secondary text-accent'
                    : 'border border-secondary/20 bg-bg text-secondary'
                }`}
                onClick={() => setDateMode('single')}
              >
                Single Date
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  dateMode === 'range'
                    ? 'bg-secondary text-accent'
                    : 'border border-secondary/20 bg-bg text-secondary'
                }`}
                onClick={() => setDateMode('range')}
              >
                Date Range
              </button>
            </div>

            {dateMode === 'single' ? (
              <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
                Share Date
                <input
                  className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  type="date"
                  value={singleDate}
                  onChange={event => setSingleDate(event.target.value)}
                />
              </label>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-semibold">
                  Start Date
                  <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                    type="date"
                    value={rangeStartDate}
                    onChange={event => setRangeStartDate(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold">
                  End Date
                  <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                    type="date"
                    value={rangeEndDate}
                    onChange={event => setRangeEndDate(event.target.value)}
                  />
                </label>
              </div>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={allowRosterEdits}
                onChange={event => setAllowRosterEdits(event.target.checked)}
              />
              Allow roster edits during the shared coverage date(s)
            </label>

            <div className="mt-4 rounded-2xl border border-secondary/20 bg-bg p-4">
              <p className="text-sm font-semibold">Share Preview</p>
              {resolvedShareDates.dates.length === 0 ? (
                <p className="mt-2 text-sm text-secondary/70">No dates selected yet.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {resolvedShareDates.dates.map(date => (
                    <span
                      key={date}
                      className="rounded-full border border-secondary/20 bg-accent px-3 py-1 text-xs font-semibold text-secondary"
                    >
                      {formatDisplayDate(date)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}

        {currentStep === 4 ? (
          <>
            <h3 className="text-lg font-semibold">Review and Confirm</h3>
            <div className="mt-4 rounded-2xl border border-secondary/20 bg-bg p-5">
              <dl className="grid gap-4 md:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-secondary/60">Session</dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {selectedSession ? formatSessionLabel(selectedSession) : 'Not selected'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-secondary/60">Shared With</dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {selectedRecipient ? getRecipientLabel(selectedRecipient) : 'Not selected'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-secondary/60">Share Mode</dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {dateMode === 'single' ? 'Single Date' : 'Date Range'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-secondary/60">Roster Edits</dt>
                  <dd className="mt-1 text-sm font-semibold">{allowRosterEdits ? 'Allowed' : 'View only'}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary/60">Exact Share Dates</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {resolvedShareDates.dates.map(date => (
                    <span
                      key={date}
                      className="rounded-full border border-secondary/20 bg-accent px-3 py-1 text-xs font-semibold text-secondary"
                    >
                      {formatDisplayDate(date)}
                    </span>
                  ))}
                </div>
              </div>

              {conflictingDates.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
                  These dates are already shared for this user: {conflictingDates.join(', ')}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {stepMessage ? (
        <p className={`mt-4 text-sm font-semibold ${currentStep === 4 && conflictingDates.length > 0 ? 'text-danger' : 'text-secondary'}`}>
          {stepMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-2xl border border-secondary/20 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handlePreviousStep}
          disabled={currentStep === 1 || isSubmitting}
        >
          Back
        </button>
        {currentStep < 4 ? (
          <button
            type="button"
            className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleNextStep}
            disabled={!canContinue}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleCreateShare}
            disabled={!canConfirmShare}
          >
            {isSubmitting ? 'Confirming…' : 'Confirm Sharing'}
          </button>
        )}
      </div>
    </div>
  )
}
