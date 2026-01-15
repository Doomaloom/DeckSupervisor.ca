import { useEffect, useState } from 'react'
import { getInstructorsForDay } from '../../../lib/storage'
import type { InstructorEntry } from '../../../types/app'
import { emptyInstructor } from '../constants'

export function useMasterListInstructors(selectedDay: string) {
  const [instructors, setInstructors] = useState<InstructorEntry[]>([emptyInstructor])
  const [rememberInstructors, setRememberInstructors] = useState(false)

  useEffect(() => {
    if (!selectedDay) {
      setInstructors([emptyInstructor])
      return
    }
    const stored = getInstructorsForDay(selectedDay)
    if (stored) {
      const next = stored.names.map((name, index) => ({
        name,
        codes: stored.codes[index] ?? '',
      }))
      setInstructors(next.length ? next : [emptyInstructor])
    } else {
      setInstructors([emptyInstructor])
    }
  }, [selectedDay])

  const addInstructor = () => {
    setInstructors(current => [...current, { name: '', codes: '' }])
  }

  const removeInstructor = (index: number) => {
    setInstructors(current => {
      if (current.length === 1) {
        return [emptyInstructor]
      }
      return current.filter((_, i) => i !== index)
    })
  }

  const updateInstructor = (index: number, field: keyof InstructorEntry, value: string) => {
    setInstructors(current => {
      const updated = [...current]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  return {
    instructors,
    rememberInstructors,
    setRememberInstructors,
    addInstructor,
    removeInstructor,
    updateInstructor,
  }
}
