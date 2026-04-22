import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import ShareWizard from './components/ShareWizard'
import ScheduledSharesList from './components/ScheduledSharesList'
import { useShareSessionsPage } from './hooks/useShareSessionsPage'

function ShareSessionsPage() {
  const { accountType, isGuest, user } = useAuth()
  const sharePage = useShareSessionsPage({
    enabled: !isGuest && Boolean(user) && accountType !== 'full_time',
    userId: user?.id ?? '',
  })

  if (isGuest || !user) {
    return (
      <div id="share-sessions-page" data-component="share-sessions-page" className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h2 className="text-2xl font-semibold">Share Sessions</h2>
          <p className="mt-2 text-sm text-secondary/70">
            Sign in to schedule session coverage for teammates.
          </p>
          <Link
            to="/sign-in"
            className="mt-4 inline-flex rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-primary"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  if (accountType === 'full_time') {
    return (
      <div id="share-sessions-page" data-component="share-sessions-page" className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h2 className="text-2xl font-semibold">Share Sessions</h2>
          <p className="mt-2 text-sm text-secondary/70">
            This workflow is only available to part-time staff sharing their own active sessions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="share-sessions-page" data-component="share-sessions-page" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <h2 className="text-2xl font-semibold">Share Sessions</h2>
        <p className="mt-2 text-sm text-secondary/70">
          Schedule session coverage, review the exact dates being shared, and revoke active shares.
        </p>
        {sharePage.message ? (
          <p className={`mt-3 text-sm font-semibold ${sharePage.messageTone === 'error' ? 'text-danger' : 'text-primary'}`}>
            {sharePage.message}
          </p>
        ) : null}
      </div>

      {sharePage.loading ? (
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <p className="text-sm text-secondary/70">Loading shareable sessions…</p>
        </div>
      ) : (
        <>
          <section>
            <h3 className="mb-3 text-lg font-semibold text-secondary">New Share</h3>
            <ShareWizard
              allowRosterEdits={sharePage.allowRosterEdits}
              canConfirmShare={sharePage.canConfirmShare}
              canContinue={sharePage.canContinue}
              conflictingDates={sharePage.conflictingDates}
              currentStep={sharePage.currentStep}
              dateMode={sharePage.dateMode}
              filteredRecipients={sharePage.recipientResults}
              formatSessionLabel={sharePage.formatSessionLabel}
              handleCreateShare={sharePage.handleCreateShare}
              handleNextStep={sharePage.handleNextStep}
              handlePreviousStep={sharePage.handlePreviousStep}
              handleSelectRecipient={sharePage.handleSelectRecipient}
              handleSelectSession={sharePage.handleSelectSession}
              isSubmitting={sharePage.isSubmitting}
              recipientSearch={sharePage.recipientSearch}
              rangeEndDate={sharePage.rangeEndDate}
              rangeStartDate={sharePage.rangeStartDate}
              resolvedShareDates={sharePage.resolvedShareDates}
              selectedRecipient={sharePage.selectedRecipient}
              selectedSession={sharePage.selectedSession}
              selectedSessionId={sharePage.selectedSessionId}
              sessions={sharePage.sessions}
              setAllowRosterEdits={sharePage.setAllowRosterEdits}
              setCurrentStep={sharePage.setCurrentStep}
              setDateMode={sharePage.setDateMode}
              setRecipientSearch={sharePage.setRecipientSearch}
              setRangeEndDate={sharePage.setRangeEndDate}
              setRangeStartDate={sharePage.setRangeStartDate}
              setSingleDate={sharePage.setSingleDate}
              singleDate={sharePage.singleDate}
              stepMessage={sharePage.stepMessage}
              recipientSearchLoading={sharePage.recipientSearchLoading}
            />
          </section>

          <section>
            <ScheduledSharesList
              formatSessionLabel={sharePage.formatSessionLabel}
              shares={sharePage.ownedShares}
              handleRevokeShare={sharePage.handleRevokeShare}
              revokingShareId={sharePage.revokingShareId}
            />
          </section>
        </>
      )}
    </div>
  )
}

export default ShareSessionsPage
