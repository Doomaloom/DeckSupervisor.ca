import type { CurrentTerm } from '../../../app/useCurrentTerm'
import type { TeamRecord } from '../../../app/useCurrentTeam'
import type { SessionTermOption } from '../types'

type FullTimeScopePanelProps = {
  currentTeamId: string
  currentTerm: CurrentTerm | null
  teams: TeamRecord[]
  teamsLoading: boolean
  teamTermSessionsLoading: boolean
  selectedFullTimeYear: number | null
  fullTimeSessionTerms: SessionTermOption[]
  fullTimeTermYears: number[]
  fullTimeTermsForSelectedYear: SessionTermOption[]
  seasonOptions: string[]
  onSelectTeam: (teamId: string) => void
  onSelectYear: (year: string) => void
  onSelectSeason: (season: string) => void
  onRequestCsvFile: () => void
}

function FullTimeScopePanel({
  currentTeamId,
  currentTerm,
  teams,
  teamsLoading,
  teamTermSessionsLoading,
  selectedFullTimeYear,
  fullTimeSessionTerms,
  fullTimeTermYears,
  fullTimeTermsForSelectedYear,
  seasonOptions,
  onSelectTeam,
  onSelectYear,
  onSelectSeason,
  onRequestCsvFile,
}: FullTimeScopePanelProps) {
  return (
    <div className="w-full max-w-3xl rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
        Full-Time Scope
      </p>
      <h2 className="mt-2 text-xl font-semibold">Select Team + Session Term</h2>
      <p className="mt-2 text-sm text-secondary/80">
        Choose the team and session term for your full-time view. Terms are season and year only.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
          Select Team
          <select
            className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={currentTeamId}
            onChange={event => onSelectTeam(event.target.value)}
            disabled={teamsLoading}
          >
            <option value="">Select a team</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
          Select Year
          <select
            className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={selectedFullTimeYear ? String(selectedFullTimeYear) : ''}
            onChange={event => onSelectYear(event.target.value)}
            disabled={!currentTeamId || teamTermSessionsLoading}
          >
            <option value="">Select a year</option>
            {fullTimeTermYears.map(year => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
          Select Season
          <select
            className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={currentTerm?.season ?? ''}
            onChange={event => onSelectSeason(event.target.value)}
            disabled={!currentTeamId || teamTermSessionsLoading || !selectedFullTimeYear}
          >
            <option value="">Select a season</option>
            {seasonOptions.map(season => {
              const normalizedSeason = season.toLowerCase()
              const hasSeason = fullTimeTermsForSelectedYear.some(
                term => term.season === normalizedSeason,
              )
              return (
                <option key={season} value={normalizedSeason} disabled={!hasSeason}>
                  {season}
                </option>
              )
            })}
          </select>
        </label>
      </div>
      {!currentTeamId ? (
        <p className="mt-3 text-sm text-secondary/70">Select a team to load session terms.</p>
      ) : teamTermSessionsLoading ? (
        <p className="mt-3 text-sm text-secondary/70">Loading session terms...</p>
      ) : fullTimeSessionTerms.length === 0 ? (
        <p className="mt-3 text-sm text-secondary/70">No session terms found for this team yet.</p>
      ) : currentTerm ? (
        <p className="mt-3 text-sm font-semibold text-secondary">Current term: {currentTerm.label}</p>
      ) : null}
      <div className="mt-6">
        <button
          type="button"
          className="w-full rounded-2xl bg-secondary px-5 py-3 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-primary"
          onClick={onRequestCsvFile}
          disabled={!currentTeamId || !currentTerm}
        >
          Upload CSV and Choose Session
        </button>
      </div>
    </div>
  )
}

export default FullTimeScopePanel
