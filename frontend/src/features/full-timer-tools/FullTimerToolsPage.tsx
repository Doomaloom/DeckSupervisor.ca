import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { createTermKey, formatTermLabel, useCurrentTerm } from '../../app/useCurrentTerm'
import { getYearFromDate } from '../../shared/session/sessionLabels'
import { fetchTeamSessions } from '../../lib/serverApi'

type TeamSessionRow = {
  id: string
  session_season: string | null
  session_year: number | null
  start_date: string | null
}

type SessionTermOption = {
  key: string
  season: string
  year: number
  label: string
  sessionCount: number
}

const seasonRank: Record<string, number> = {
  winter: 0,
  spring: 1,
  summer: 2,
  fall: 3,
}

const seasonOptions = ['Winter', 'Spring', 'Summer', 'Fall']

function toTitleCase(value: string) {
  if (!value) {
    return ''
  }
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase()
}

function FullTimerToolsPage() {
  const { teams, currentTeam, currentTeamId, loading: teamsLoading, setCurrentTeamId } = useCurrentTeam()
  const { currentTermKey, setCurrentTermKey, clearCurrentTerm } = useCurrentTerm()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastFilename, setLastFilename] = useState<string | null>(null)
  const [teamSessions, setTeamSessions] = useState<TeamSessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  useEffect(() => {
    if (!currentTeamId) {
      setTeamSessions([])
      return
    }
    let active = true
    const load = async () => {
      setSessionsLoading(true)
      try {
        const response = await fetchTeamSessions(currentTeamId, 'id,session_season,session_year,start_date')
        if (!active) {
          return
        }
        setTeamSessions((response.sessions ?? []) as TeamSessionRow[])
      } catch (error) {
        console.error('Failed to load team sessions', error)
        setTeamSessions([])
      }
      setSessionsLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [currentTeamId])

  const sessionTerms = useMemo(() => {
    const grouped = new Map<string, SessionTermOption>()
    teamSessions.forEach(session => {
      const season = session.session_season?.trim() ?? ''
      const year = session.session_year ?? getYearFromDate(session.start_date)
      if (!season || !year) {
        return
      }
      const normalizedSeason = season.toLowerCase()
      const key = createTermKey(normalizedSeason, year)
      if (!key) {
        return
      }
      const existing = grouped.get(key)
      if (existing) {
        grouped.set(key, { ...existing, sessionCount: existing.sessionCount + 1 })
        return
      }
      grouped.set(key, {
        key,
        season: normalizedSeason,
        year,
        label: formatTermLabel(season, year) || `${toTitleCase(season)} ${year}`,
        sessionCount: 1,
      })
    })
    return Array.from(grouped.values()).sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year
      }
      const rankA = seasonRank[a.season] ?? 99
      const rankB = seasonRank[b.season] ?? 99
      if (rankA !== rankB) {
        return rankA - rankB
      }
      return a.label.localeCompare(b.label)
    })
  }, [teamSessions])

  const sessionTermYears = useMemo(() => {
    const years = new Set<number>()
    sessionTerms.forEach(term => years.add(term.year))
    return Array.from(years).sort((a, b) => b - a)
  }, [sessionTerms])

  useEffect(() => {
    if (!currentTeamId || sessionTerms.length === 0) {
      clearCurrentTerm()
      return
    }
    const hasSelected = sessionTerms.some(term => term.key === currentTermKey)
    if (!hasSelected) {
      setCurrentTermKey(sessionTerms[0].key)
    }
  }, [clearCurrentTerm, currentTeamId, currentTermKey, sessionTerms, setCurrentTermKey])

  const selectedTerm = useMemo(
    () => sessionTerms.find(term => term.key === currentTermKey) ?? null,
    [currentTermKey, sessionTerms],
  )

  const selectedTermYear = selectedTerm?.year ?? null

  const sessionTermsForSelectedYear = useMemo(() => {
    if (!selectedTermYear) {
      return []
    }
    return sessionTerms.filter(term => term.year === selectedTermYear)
  }, [selectedTermYear, sessionTerms])

  const handleSelectTermYear = (yearInput: string) => {
    if (!yearInput) {
      clearCurrentTerm()
      return
    }
    const parsedYear = Number.parseInt(yearInput, 10)
    if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
      return
    }
    const nextTerm = sessionTerms.find(term => term.year === parsedYear)
    if (!nextTerm) {
      clearCurrentTerm()
      return
    }
    setCurrentTermKey(nextTerm.key)
  }

  const handleSelectTermSeason = (season: string) => {
    if (!season) {
      clearCurrentTerm()
      return
    }
    if (!selectedTermYear) {
      return
    }
    const nextKey = createTermKey(season, selectedTermYear)
    if (!nextKey || !sessionTerms.some(term => term.key === nextKey)) {
      return
    }
    setCurrentTermKey(nextKey)
  }

  const handleGenerate = async () => {
    if (!selectedFile) {
      alert('Please upload the schematic maker CSV file.')
      return
    }

    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('csv_file', selectedFile)

      const response = await fetch('/api/schematic-maker', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to generate schematic maker workbook.')
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition') ?? ''
      const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition)
      const filename = match?.[1] ?? 'schematic-maker-output.zip'

      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
      setLastFilename(filename)
    } catch (error) {
      console.error(error)
      alert('Unable to generate the schematic maker output. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div id="full-timer-tools-page" data-component="full-timer-tools-page" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-secondary/15" />
        <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-secondary/10" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Full Timer Tools
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Full Timer Tools</h2>
          <p className="mt-2 max-w-2xl text-secondary">
            Your toolbox for running sessions. The schematic maker is ready; more tools are coming next.
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Full Timer View Scope
          </p>
          <h3 className="mt-2 text-lg font-semibold">Team + Session</h3>
          <p className="mt-2 text-secondary">
            Pick the team and term you want to view. Session terms are grouped by season and year,
            not weekday.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
              Team
              <select
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                value={currentTeamId}
                onChange={event => {
                  setCurrentTeamId(event.target.value)
                  clearCurrentTerm()
                }}
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
              Session Year
              <select
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                value={selectedTermYear ? String(selectedTermYear) : ''}
                onChange={event => handleSelectTermYear(event.target.value)}
                disabled={!currentTeamId || sessionsLoading || sessionTermYears.length === 0}
              >
                <option value="">Select a year</option>
                {sessionTermYears.map(year => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
              Session Season
              <select
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                value={selectedTerm?.season ?? ''}
                onChange={event => handleSelectTermSeason(event.target.value)}
                disabled={!currentTeamId || sessionsLoading || sessionTermsForSelectedYear.length === 0}
              >
                <option value="">Select a season</option>
                {seasonOptions.map(season => {
                  const normalizedSeason = season.toLowerCase()
                  const hasSeason = sessionTermsForSelectedYear.some(
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
            <p className="mt-3 text-sm text-secondary/70">
              Select a team to load session terms.
            </p>
          ) : sessionsLoading ? (
            <p className="mt-3 text-sm text-secondary/70">Loading session terms...</p>
          ) : sessionTerms.length === 0 ? (
            <p className="mt-3 text-sm text-secondary/70">
              No term data found for this team. Make sure sessions have season + year.
            </p>
          ) : selectedTerm ? (
            <p className="mt-3 text-sm font-semibold text-secondary">
              Current scope: {currentTeam?.name} - {selectedTerm.label} ({selectedTerm.sessionCount}{' '}
              day sessions)
            </p>
          ) : null}
        </div>

        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Tool 1
          </p>
          <h3 className="mt-2 text-lg font-semibold">Schematic Maker</h3>
          <p className="mt-2 text-secondary">
            Upload the schematic maker CSV file to generate location-based schedule workbooks.
          </p>
        </div>

        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-secondary">Upload CSV</p>
              <p className="mt-1 text-sm text-secondary/80">
                Required columns: GroupName, ID, MainFacility, Day, Starts, Ends, Max, Min,
                RegTotal, PercentFilled.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="relative inline-flex items-center gap-2 rounded-2xl border border-secondary/40 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent">
                <span>{selectedFile ? selectedFile.name : 'Choose CSV File'}</span>
                <input
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  type="file"
                  accept=".csv"
                  onChange={event => {
                    const file = event.target.files?.[0] ?? null
                    setSelectedFile(file)
                    setLastFilename(null)
                  }}
                />
              </label>

              <button
                type="button"
                className="rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate Workbook'}
              </button>
            </div>

            {lastFilename && (
              <p className="text-sm text-secondary">
                Downloaded: <span className="font-semibold">{lastFilename}</span>
              </p>
            )}
          </div>
        </div>

        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Tool 2
          </p>
          <h3 className="mt-2 text-lg font-semibold">Attendance Sheet Maker</h3>
          <p className="mt-2 text-sm text-secondary/80">
            Create editable attendance sheets from built-in templates.
          </p>
          <Link
            className={`mt-4 inline-flex rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              currentTeamId
                ? 'bg-secondary text-accent hover:-translate-y-0.5 hover:bg-primary'
                : 'pointer-events-none bg-secondary/30 text-secondary/60'
            }`}
            aria-disabled={!currentTeamId}
            to="/full-timer-tools/attendance-sheets"
          >
            Open Attendance Sheet Maker
          </Link>
          {!currentTeamId ? (
            <p className="mt-3 text-sm text-secondary/70">
              Select a team first so new sheets are tied to the right team.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default FullTimerToolsPage
