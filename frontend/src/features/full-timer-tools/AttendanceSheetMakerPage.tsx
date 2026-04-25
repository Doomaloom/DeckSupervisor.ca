import { Link } from 'react-router-dom'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import AttendanceSheetMaker from './components/AttendanceSheetMaker'

function AttendanceSheetMakerPage() {
  const { currentTeam, currentTeamId } = useCurrentTeam()
  const { currentTerm } = useCurrentTerm()

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Full Timer Tools
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-secondary">Attendance Sheet Maker</h2>
          <p className="mt-2 text-sm text-secondary/70">
            Create editable attendance sheets from built-in templates and preview the final PDF.
          </p>
        </div>
        <Link
          className="rounded-2xl border border-secondary/40 bg-accent px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
          to="/full-timer-tools"
        >
          Back to Tools
        </Link>
      </div>

      {currentTeamId ? (
        <AttendanceSheetMaker
          teamId={currentTeamId}
          teamName={currentTeam?.name ?? ''}
          selectedTermLabel={currentTerm?.label}
        />
      ) : (
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h3 className="text-lg font-semibold">Select a team first</h3>
          <p className="mt-2 text-sm text-secondary/70">
            Choose a team on the Full Timer Tools page before creating attendance sheets.
          </p>
          <Link
            className="mt-4 inline-flex rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
            to="/full-timer-tools"
          >
            Choose Team
          </Link>
        </div>
      )}
    </div>
  )
}

export default AttendanceSheetMakerPage
