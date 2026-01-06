import React, { createContext, useContext, useMemo, useState } from 'react'
import { getSelectedDay, setSelectedDay as setSelectedDayStorage } from '../lib/storage'

type DayContextValue = {
  selectedDay: string
  setSelectedDay: (day: string) => void
}

const DayContext = createContext<DayContextValue | undefined>(undefined)

export function DayProvider({ children }: { children: React.ReactNode }) {
  const [selectedDay, setSelectedDayState] = useState(getSelectedDay())

  const setSelectedDay = (day: string) => {
    setSelectedDayState(day)
    setSelectedDayStorage(day)
  }

  const value = useMemo(
    () => ({
      selectedDay,
      setSelectedDay,
    }),
    [selectedDay]
  )

  return <DayContext.Provider value={value}>{children}</DayContext.Provider>
}

export function useDay() {
  const context = useContext(DayContext)
  if (!context) {
    throw new Error('useDay must be used within DayProvider')
  }
  return context
}
