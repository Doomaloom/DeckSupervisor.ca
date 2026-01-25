import { useState } from 'react'
import { getFormatOptions, setMasterlistDraftOptions } from '../../../lib/storage'
import type { FormatOptions } from '../../../types/app'

export function useMasterListFormatting() {
  const [formatOptionsState, setFormatOptionsState] = useState<FormatOptions>(() => getFormatOptions())
  const [rememberFormatting, setRememberFormatting] = useState(false)

  const toggleOption = (option: keyof FormatOptions) => {
    setFormatOptionsState(prev => {
      const next = {
        ...prev,
        [option]: !prev[option],
      }
      setMasterlistDraftOptions(next)
      return next
    })
  }

  return {
    formatOptionsState,
    rememberFormatting,
    setRememberFormatting,
    toggleOption,
  }
}
