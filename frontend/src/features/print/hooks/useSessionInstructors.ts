import { useEffect, useState } from 'react'

import { getCurrentSessionId, loadSessions } from '../../../lib/sessionStorage'
import { onStorageScopeChanged } from '../../../lib/storageScope'

type SessionEntry = {
  id: string
  instructors: { name: string }[]
}

export function useSessionInstructors(active: boolean) {
  const [names, setNames] = useState<string[]>([])
  const [scopeVersion, setScopeVersion] = useState(0)

  useEffect(() => {
    return onStorageScopeChanged(() => {
      setScopeVersion(version => version + 1)
    })
  }, [])

  useEffect(() => {
    if (!active) {
      return
    }
    const currentSessionId = getCurrentSessionId()
    if (!currentSessionId) {
      setNames([])
      return
    }
    const sessions = loadSessions() as SessionEntry[]
    const session = sessions.find(item => item.id === currentSessionId)
    const next =
      session?.instructors
        .map(instructor => instructor.name.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })) ?? []
    setNames(next)
  }, [active, scopeVersion])

  return names
}
