import { useEffect, useMemo, useState } from 'react'
import { fetchMySessions, fetchSharedSessionsToday } from '../../../lib/serverApi'
import { loadSessions } from '../../../lib/sessionStorage'
import { getTorontoDate } from '../../../lib/torontoDate'
import type { DbSessionEntry, LocalSessionEntry, SharedSessionEntry } from '../types'
import {
  sortDbSessionsByStartDateDesc,
  sortLocalSessionsByStartDateDesc,
} from '../utils/sessionIdentity'

type UseSessionSelectionDataParams = {
  isGuest: boolean
  user: { id: string } | null
  scopeVersion: number
  activePanel: 'options' | 'new-session' | 'select-session'
}

export function useSessionSelectionData({
  isGuest,
  user,
  scopeVersion,
  activePanel,
}: UseSessionSelectionDataParams) {
  const [dbSessions, setDbSessions] = useState<DbSessionEntry[]>([])
  const [sharedSessions, setSharedSessions] = useState<SharedSessionEntry[]>([])

  const sessions = useMemo(() => {
    if (isGuest) {
      return sortLocalSessionsByStartDateDesc(loadSessions())
    }
    return sortDbSessionsByStartDateDesc(dbSessions)
  }, [activePanel, dbSessions, isGuest, scopeVersion])

  useEffect(() => {
    if (isGuest || !user) {
      return
    }
    const loadSessionsFromDb = async () => {
      const data = await fetchMySessions()
      setDbSessions((data.sessions ?? []) as DbSessionEntry[])
    }
    void loadSessionsFromDb()
  }, [isGuest, scopeVersion, user])

  useEffect(() => {
    if (isGuest || !user) {
      return
    }
    const loadShared = async () => {
      const today = getTorontoDate()
      const data = await fetchSharedSessionsToday()
      setSharedSessions(
        (data.sharedSessions ?? []).filter(
          (item: SharedSessionEntry) => item.share_date === today,
        ) as SharedSessionEntry[],
      )
    }
    void loadShared()
  }, [isGuest, user])

  return {
    sessions,
    sharedSessions,
  }
}
