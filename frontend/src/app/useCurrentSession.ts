import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabaseClient'
import { getCurrentSessionId, loadSessions, onCurrentSessionChanged } from '../lib/sessionStorage'
import { getTorontoDate } from '../lib/torontoDate'
import { onStorageScopeChanged } from '../lib/storageScope'

export type SessionRecord = {
  id: string
  team_id: string
  created_by: string
  session_day: string
  session_season: string | null
  start_date: string | null
  end_date: string | null
  location: string
  instructors: { name: string }[]
}

export type SessionAccess = {
  mode: 'guest' | 'owner' | 'shared' | 'none'
  allowRosterEdits: boolean
  shareDate?: string
}

export function useCurrentSession() {
  const { isGuest, user } = useAuth()
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [access, setAccess] = useState<SessionAccess>({ mode: 'guest', allowRosterEdits: false })
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState(() => getCurrentSessionId())

  useEffect(() => {
    const unsubscribe = onCurrentSessionChanged(id => setSessionId(id))
    const scopeUnsubscribe = onStorageScopeChanged(() => setSessionId(getCurrentSessionId()))
    return () => {
      unsubscribe()
      scopeUnsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      if (!sessionId) {
        if (active) {
          setSession(null)
          setAccess({ mode: isGuest ? 'guest' : 'none', allowRosterEdits: false })
          setLoading(false)
        }
        return
      }

      if (isGuest || !user) {
        const localSessions = loadSessions()
        const local = localSessions.find(item => item.id === sessionId)
        if (active) {
          setSession(
            local
              ? {
                  id: local.id,
                  team_id: '',
                  created_by: '',
                  session_day: local.sessionDay,
                  session_season: local.sessionSeason ?? null,
                  start_date: local.startDate ?? null,
                  end_date: local.endDate ?? null,
                  location: '',
                  instructors: local.instructors ?? [],
                }
              : null,
          )
          setAccess({ mode: 'guest', allowRosterEdits: false })
          setLoading(false)
        }
        return
      }

      const { data: sessionRow, error } = await supabase
        .from('sessions')
        .select(
          'id,team_id,created_by,session_day,session_season,start_date,end_date,location,instructors',
        )
        .eq('id', sessionId)
        .maybeSingle()

      if (!active) {
        return
      }

      if (error || !sessionRow) {
        setSession(null)
        setAccess({ mode: 'none', allowRosterEdits: false })
        setLoading(false)
        return
      }

      const sessionRecord = sessionRow as SessionRecord
      setSession(sessionRecord)

      if (sessionRecord.created_by === user.id) {
        setAccess({ mode: 'owner', allowRosterEdits: true })
        setLoading(false)
        return
      }

      const today = getTorontoDate()
      const { data: shareRow } = await supabase
        .from('session_shares')
        .select('allow_roster_edits,share_date')
        .eq('session_id', sessionId)
        .eq('shared_with', user.id)
        .eq('share_date', today)
        .maybeSingle()

      if (!active) {
        return
      }

      if (shareRow) {
        setAccess({
          mode: 'shared',
          allowRosterEdits: shareRow.allow_roster_edits ?? false,
          shareDate: shareRow.share_date,
        })
      } else {
        setAccess({ mode: 'none', allowRosterEdits: false })
      }
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [isGuest, sessionId, user])

  return {
    sessionId,
    session,
    access,
    loading,
  }
}
