import type { CsvSessionCandidate } from '../types/app'
import { formatSessionDisplayName } from '../shared/session/sessionLabels'

type CsvSessionImportModalProps = {
  open: boolean
  loading: boolean
  processing: boolean
  error: string
  fileName: string
  candidates: CsvSessionCandidate[]
  onClose: () => void
  onSelectCandidate: (candidate: CsvSessionCandidate) => void
}

function getCandidateLabel(candidate: CsvSessionCandidate) {
  const sessionLabel = formatSessionDisplayName({
    sessionDay: candidate.dayOfWeek,
    sessionSeason: candidate.sessionSeason,
    sessionYear: candidate.sessionYear,
    startDate: candidate.startDate,
    sessionStartTime24: candidate.sessionStartTime24,
    sessionEndTime24: candidate.sessionEndTime24,
    fallback: '',
  })
  const location = candidate.location.trim()
  return [sessionLabel, location].filter(Boolean).join(' | ')
}

function CsvSessionImportModal({
  open,
  loading,
  processing,
  error,
  fileName,
  candidates,
  onClose,
  onSelectCandidate,
}: CsvSessionImportModalProps) {
  if (!open) {
    return null
  }

  return (
    <div id="csv-session-import-modal" data-component="csv-session-import-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div data-component="csv-session-import-modal-panel" className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-secondary/20 bg-accent p-6 text-secondary shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
              CSV Session Import
            </p>
            <h2 className="mt-2 text-xl font-semibold">Choose a session from the uploaded CSV</h2>
            {fileName ? (
              <p className="mt-2 text-sm text-secondary/80">{fileName}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-full border border-secondary/20 px-3 py-1 text-sm font-semibold transition hover:bg-bg"
            onClick={onClose}
            disabled={loading || processing}
          >
            Close
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm font-semibold text-secondary/80">Inspecting CSV sessions...</p>
        ) : null}

        {!loading && error ? (
          <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </div>
        ) : null}

        {!loading && candidates.length > 0 ? (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-4">
            {candidates.map(candidate => (
              <button
                key={candidate.sessionKey}
                type="button"
                className="flex flex-col gap-2 rounded-card border border-secondary/20 bg-bg px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-secondary"
                onClick={() => onSelectCandidate(candidate)}
                disabled={processing}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">{getCandidateLabel(candidate)}</h3>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary/70">
                    {candidate.matchedSession ? 'Load Existing Session' : 'Create New Session'}
                  </span>
                </div>
                <p className="text-sm text-secondary/80">
                  {candidate.classCount} classes • {candidate.studentCount} students
                </p>
                {candidate.rawLocations.length > 1 ? (
                  <p className="text-sm text-secondary/70">
                    Includes: {candidate.rawLocations.join(', ')}
                  </p>
                ) : null}
                {candidate.matchedSession ? (
                  <p className="text-sm font-semibold text-secondary">
                    Existing: {candidate.matchedSession.label}
                  </p>
                ) : (
                  <p className="text-sm text-secondary/70">
                    No existing session matched. Selecting this will create one from the CSV.
                  </p>
                )}
              </button>
            ))}
            </div>
          </div>
        ) : null}

        {processing ? (
          <p className="mt-6 text-sm font-semibold text-secondary/80">Importing selected session...</p>
        ) : null}
      </div>
    </div>
  )
}

export default CsvSessionImportModal
