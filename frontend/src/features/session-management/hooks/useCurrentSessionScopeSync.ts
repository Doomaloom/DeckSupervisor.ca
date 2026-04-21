import { useEffect, useState } from 'react'
import { useDay } from '../../../app/DayContext'
import {
  clearCurrentSessionId,
  getCurrentSessionId,
  onCurrentSessionChanged,
  setCurrentSessionId,
} from '../../../lib/sessionStorage'
import { onStorageScopeChanged } from '../../../lib/storageScope'

export function useCurrentSessionScopeSync() {
  const { setSelectedDay } = useDay()
  const [currentSessionId, setCurrentSessionIdState] = useState(() => getCurrentSessionId())
  const [scopeVersion, setScopeVersion] = useState(0)

  useEffect(() => {
    const unsubscribe = onCurrentSessionChanged(id => {
      setCurrentSessionIdState(id)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    return onStorageScopeChanged(() => {
      setCurrentSessionIdState(getCurrentSessionId())
      setScopeVersion(version => version + 1)
    })
  }, [])

  const refreshScope = () => {
    setCurrentSessionIdState(getCurrentSessionId())
    setScopeVersion(version => version + 1)
  }

  const resetCurrentSessionScope = () => {
    clearCurrentSessionId()
    setCurrentSessionIdState('')
    setSelectedDay('')
  }

  const selectSessionAndSyncDay = (sessionId: string, sessionDay?: string | null) => {
    setCurrentSessionId(sessionId)
    setCurrentSessionIdState(sessionId)
    setSelectedDay(sessionDay?.trim() ?? '')
  }

  return {
    currentSessionId,
    scopeVersion,
    refreshScope,
    resetCurrentSessionScope,
    selectSessionAndSyncDay,
  }
}
