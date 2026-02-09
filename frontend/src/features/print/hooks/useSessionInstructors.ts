import { useEffect, useState } from 'react'
import { useCurrentSession } from '../../../app/useCurrentSession'

export function useSessionInstructors(active: boolean) {
  const [names, setNames] = useState<string[]>([])
  const { session } = useCurrentSession()

  useEffect(() => {
    if (!active) {
      return
    }
    const next =
      session?.instructors
        .map(instructor => instructor.name.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })) ?? []
    setNames(next)
  }, [active, session])

  return names
}
