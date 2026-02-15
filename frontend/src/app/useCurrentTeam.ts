import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabaseClient'
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
      const [{ data: memberRows }, { data: ownedRows }] = await Promise.all([
        supabase.from('team_members').select('team_id').eq('user_id', user.id),
        supabase.from('teams').select('id,name,available_locations').eq('owner_id', user.id),
      ])

      if (!active) {
        return
      }

      const memberIds = new Set((memberRows ?? []).map(row => (row as TeamMembershipRow).team_id))
      const ownedTeams = (ownedRows ?? []) as TeamRecord[]
      const ownedIds = new Set(ownedTeams.map(team => team.id))
      const allIds = Array.from(new Set([...Array.from(memberIds), ...Array.from(ownedIds)]))

      let memberTeams: TeamRecord[] = []
      if (allIds.length > 0) {
        const { data } = await supabase
          .from('teams')
          .select('id,name,available_locations')
          .in('id', allIds)
        if (!active) {
          return
        }
        memberTeams = (data ?? []) as TeamRecord[]
      }

      const merged = new Map<string, TeamRecord>()
      ;[...ownedTeams, ...memberTeams].forEach(team => merged.set(team.id, team))
      const nextTeams = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))

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
