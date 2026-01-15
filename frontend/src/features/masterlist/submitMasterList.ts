import { processCsvAndStore } from '../../lib/api'
import { setFormatOptions, setInstructorsForDay } from '../../lib/storage'
import type { FormatOptions, InstructorEntry } from '../../types/app'

type SubmitMasterListParams = {
  file: File
  selectedDay: string
  instructors: InstructorEntry[]
  formatOptions: FormatOptions
  rememberInstructors: boolean
  rememberFormatting: boolean
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function submitMasterList({
  file,
  selectedDay,
  instructors,
  formatOptions,
  rememberInstructors,
  rememberFormatting,
}: SubmitMasterListParams) {
  await processCsvAndStore(file, selectedDay, instructors)

  if (rememberInstructors) {
    setInstructorsForDay(selectedDay, {
      names: instructors.map(instructor => instructor.name),
      codes: instructors.map(instructor => instructor.codes),
    })
  }

  if (rememberFormatting) {
    setFormatOptions(formatOptions)
  }

  const formData = new FormData()
  formData.append('csv_file', file)
  instructors.forEach(instructor => {
    formData.append('instructor_names[]', instructor.name)
    formData.append('instructor_codes[]', instructor.codes)
  })
  Object.entries(formatOptions).forEach(([key, value]) => {
    if (value) {
      formData.append(key, 'on')
    }
  })

  const response = await fetch('/api/masterlist', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to generate master list')
  }

  const blob = await response.blob()
  downloadBlob(blob, 'masterlist.xlsx')
}
