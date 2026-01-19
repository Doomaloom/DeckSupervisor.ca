import { useEffect, useState } from 'react'

const SESSIONS_STORAGE_KEY = 'decksupervisor.sessions'
const CURRENT_SESSION_KEY = 'decksupervisor.currentSessionId'

type SessionEntry = {
  id: string
  instructors: { name: string }[]
}

export function useSessionInstructors(active: boolean) {
  const [names, setNames] = useState<string[]>([])

  useEffect(() => {
    if (!active) {
      return
    }
    if (typeof window === 'undefined') {
      setNames([])
      return
    }
    const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY) ?? ''
    const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
    if (!currentSessionId || !stored) {
      setNames([])
      return
    }
    try {
      const sessions = JSON.parse(stored) as SessionEntry[]
      const session = sessions.find(item => item.id === currentSessionId)
      const next =
        session?.instructors
          .map(instructor => instructor.name.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })) ?? []
      setNames(next)
    } catch (error) {
      console.error('Failed to parse stored sessions', error)
      setNames([])
    }
  }, [active])

  return names
}
