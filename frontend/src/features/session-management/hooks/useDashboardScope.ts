import { useEffect, useMemo, useState } from 'react'
import type { CurrentTerm } from '../../../app/useCurrentTerm'
import { createTermKey } from '../../../app/useCurrentTerm'
import { fetchTeamSessions } from '../../../lib/serverApi'
import { getTorontoDate } from '../../../lib/torontoDate'
import type { TeamRecord } from '../../../app/useCurrentTeam'
import { SESSION_SEASON_OPTIONS, type TeamTermSessionRow } from '../types'
import {
  buildFullTimeSessionTerms,
  buildFullTimeTermYears,
  filterTermsForYear,
  findDefaultTermForYear,
} from '../utils/sessionCollections'

type UseDashboardScopeParams = {
  accountType: string
  currentTeamId: string
  teams: TeamRecord[]
  currentTerm: CurrentTerm | null
  currentTermKey: string
  setCurrentTeamId: (teamId: string) => void
  setCurrentTermKey: (termKey: string) => void
  clearCurrentTerm: () => void
  resetCurrentSessionScope: () => void
}

export function useDashboardScope({
  accountType,
  currentTeamId,
  teams,
  currentTerm,
  currentTermKey,
  setCurrentTeamId,
  setCurrentTermKey,
  clearCurrentTerm,
  resetCurrentSessionScope,
}: UseDashboardScopeParams) {
  const [teamTermSessions, setTeamTermSessions] = useState<TeamTermSessionRow[]>([])
  const [teamTermSessionsLoading, setTeamTermSessionsLoading] = useState(false)
  const [selectedFullTimeYear, setSelectedFullTimeYear] = useState<number | null>(null)

  const fullTimeSessionTerms = useMemo(
    () => buildFullTimeSessionTerms(teamTermSessions),
    [teamTermSessions],
  )

  const fullTimeTermYears = useMemo(() => buildFullTimeTermYears(getTorontoDate()), [])

  const fullTimeTermsForSelectedYear = useMemo(
    () => filterTermsForYear(fullTimeSessionTerms, selectedFullTimeYear),
    [fullTimeSessionTerms, selectedFullTimeYear],
  )

  const handleSelectFullTimeTeam = (teamId: string) => {
    setCurrentTeamId(teamId)
    setSelectedFullTimeYear(null)
    setTeamTermSessions([])
    clearCurrentTerm()
    resetCurrentSessionScope()
  }

  const handleSelectFullTimeYear = (yearInput: string) => {
    if (!yearInput) {
      setSelectedFullTimeYear(null)
      clearCurrentTerm()
      resetCurrentSessionScope()
      return
    }
    const parsedYear = Number.parseInt(yearInput, 10)
    if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
      return
    }
    setSelectedFullTimeYear(parsedYear)
    const nextTerm = findDefaultTermForYear(fullTimeSessionTerms, parsedYear)
    if (!nextTerm) {
      clearCurrentTerm()
      resetCurrentSessionScope()
      return
    }
    setCurrentTermKey(nextTerm.key)
    resetCurrentSessionScope()
  }

  const handleSelectFullTimeSeason = (season: string) => {
    if (!season) {
      clearCurrentTerm()
      resetCurrentSessionScope()
      return
    }
    const year = selectedFullTimeYear
    if (!year) {
      return
    }
    const nextKey = createTermKey(season, year)
    if (!nextKey || !fullTimeSessionTerms.some(term => term.key === nextKey)) {
      return
    }
    setCurrentTermKey(nextKey)
    resetCurrentSessionScope()
  }

  useEffect(() => {
    if (accountType !== 'full_time' || !currentTeamId) {
      setTeamTermSessions([])
      setTeamTermSessionsLoading(false)
      return
    }
    let active = true
    const loadTeamSessions = async () => {
      setTeamTermSessionsLoading(true)
      try {
        const response = await fetchTeamSessions(
          currentTeamId,
          'id,session_season,session_year,start_date',
        )
        if (!active) {
          return
        }
        setTeamTermSessions((response.sessions ?? []) as TeamTermSessionRow[])
      } catch (error) {
        console.error('Failed to load team terms', error)
        setTeamTermSessions([])
      }
      setTeamTermSessionsLoading(false)
    }
    void loadTeamSessions()
    return () => {
      active = false
    }
  }, [accountType, currentTeamId])

  useEffect(() => {
    if (accountType !== 'full_time') {
      return
    }
    if (currentTerm?.year) {
      setSelectedFullTimeYear(currentTerm.year)
      return
    }
    if (!currentTeamId || fullTimeSessionTerms.length === 0) {
      setSelectedFullTimeYear(null)
      clearCurrentTerm()
      return
    }
    const hasCurrentTerm = fullTimeSessionTerms.some(term => term.key === currentTermKey)
    if (!hasCurrentTerm) {
      setCurrentTermKey(fullTimeSessionTerms[0].key)
    }
  }, [
    accountType,
    clearCurrentTerm,
    currentTeamId,
    currentTerm?.year,
    currentTermKey,
    fullTimeSessionTerms,
    setCurrentTermKey,
  ])

  return {
    seasonOptions: SESSION_SEASON_OPTIONS,
    teamTermSessionsLoading,
    selectedFullTimeYear,
    fullTimeSessionTerms,
    fullTimeTermYears,
    fullTimeTermsForSelectedYear,
    handleSelectFullTimeTeam,
    handleSelectFullTimeYear,
    handleSelectFullTimeSeason,
    teams,
  }
}
