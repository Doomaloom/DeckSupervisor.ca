import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { fetchCurrentTeams } from '../lib/serverApi'
import {
  clearCurrentTeamId,
  getCurrentTeamId,
  onCurrentTeamChanged,
  setCurrentTeamId as setCurrentTeamIdStorage,
} from '../lib/teamStorage'
import { onStorageScopeChanged } from '../lib/storageScope'

export type TeamRecord = {
  id: string
  name: string
  available_locations: string[]
}

type TeamMembershipRow = {
  team_id: string
}

export function useCurrentTeam() {
  const { isGuest, user } = useAuth()
  const [currentTeamId, setCurrentTeamIdState] = useState(() => getCurrentTeamId())
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onCurrentTeamChanged(id => setCurrentTeamIdState(id))
    const scopeUnsubscribe = onStorageScopeChanged(() => setCurrentTeamIdState(getCurrentTeamId()))
    return () => {
      unsubscribe()
      scopeUnsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (isGuest || !user) {
        if (!active) {
          return
        }
        setTeams([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await fetchCurrentTeams()
        if (!active) {
          return
        }
        const nextTeams = (data.teams ?? []) as TeamRecord[]
        setTeams(nextTeams)
        const hasCurrent = nextTeams.some(team => team.id === currentTeamId)
        if (!hasCurrent) {
          const fallback = nextTeams[0]?.id ?? ''
          if (fallback) {
            setCurrentTeamIdStorage(fallback)
            setCurrentTeamIdState(fallback)
          } else {
            clearCurrentTeamId()
            setCurrentTeamIdState('')
          }
        }
        setLoading(false)
        return
      } catch (error) {
        console.error('Failed to load teams', error)
      }
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [currentTeamId, isGuest, user])

  const currentTeam = useMemo(
    () => teams.find(team => team.id === currentTeamId) ?? null,
    [currentTeamId, teams],
  )

  const setCurrentTeamId = useCallback((id: string) => {
    if (id) {
      setCurrentTeamIdStorage(id)
    } else {
      clearCurrentTeamId()
    }
    setCurrentTeamIdState(id)
  }, [])

  return {
    teams,
    currentTeamId,
    currentTeam,
    loading,
    setCurrentTeamId,
  }
}
