import React, { useEffect, useState } from 'react'
import { useDay } from '../../app/DayContext'
import { processCsvAndStore } from '../../lib/api'
import { getFormatOptions, getInstructorsForDay, setFormatOptions, setInstructorsForDay } from '../../lib/storage'
import type { FormatOptions, InstructorEntry } from '../../types/app'

const emptyInstructor: InstructorEntry = { name: '', codes: '' }

function MasterListPage() {
  const { selectedDay } = useDay()
  const [file, setFile] = useState<File | null>(null)
  const [fileStatus, setFileStatus] = useState('No file selected.')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [instructors, setInstructors] = useState<InstructorEntry[]>([emptyInstructor])
  const [formatOptionsState, setFormatOptionsState] = useState<FormatOptions>(getFormatOptions())
  const [rememberInstructors, setRememberInstructors] = useState(false)
  const [rememberFormatting, setRememberFormatting] = useState(false)

  useEffect(() => {
    setFormatOptionsState(getFormatOptions())
  }, [])

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

  const toggleOption = (option: keyof FormatOptions) => {
    setFormatOptionsState(prev => ({
      ...prev,
      [option]: !prev[option],
    }))
  }

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile)
    setFileStatus(nextFile ? `File Uploaded: ${nextFile.name}` : 'No file selected.')
  }

  const handleDrop: React.DragEventHandler<HTMLDivElement> = event => {
    event.preventDefault()
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) {
      handleFileChange(dropped)
    }
  }

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = event => {
    event.preventDefault()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDay) {
      alert('Please select a day before uploading.')
      return
    }
    if (!file) {
      alert('Please upload a CSV file.')
      return
    }

    setIsSubmitting(true)
    try {
      await processCsvAndStore(file, selectedDay, instructors)

      if (rememberInstructors) {
        setInstructorsForDay(selectedDay, {
          names: instructors.map(instructor => instructor.name),
          codes: instructors.map(instructor => instructor.codes),
        })
      }

      if (rememberFormatting) {
        setFormatOptions(formatOptionsState)
      }

      const formData = new FormData()
      formData.append('csv_file', file)
      instructors.forEach(instructor => {
        formData.append('instructor_names[]', instructor.name)
        formData.append('instructor_codes[]', instructor.codes)
      })
      Object.entries(formatOptionsState).forEach(([key, value]) => {
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
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'masterlist.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      alert('Something went wrong while processing the file.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const optionClass = (active: boolean) =>
    [
      'rounded-2xl px-3 py-2 text-base font-semibold transition',
      active
        ? 'border-2 border-dashed border-secondary bg-accent text-secondary'
        : 'bg-secondary text-accent',
      'hover:-translate-y-0.5 hover:bg-accent hover:text-secondary',
    ].join(' ')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div
          className="relative cursor-pointer rounded-card border-2 border-dashed border-secondary bg-accent p-4 text-center text-secondary transition hover:bg-bg"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <p className="text-lg">Drag & Drop your .csv file here or click to select</p>
          <input
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type="file"
            name="csv_file"
            accept=".csv"
            required
            onChange={event => handleFileChange(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className="text-base text-secondary">{fileStatus}</div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
            <h2 className="mb-4 text-center text-xl font-semibold">Instructors and Classes</h2>
            <div className="flex flex-col gap-4">
              {instructors.map((instructor, index) => (
                <div
                  key={`${instructor.name}-${index}`}
                  className="flex flex-col gap-3 md:flex-row md:items-center"
                >
                  <input
                    className="w-full rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="text"
                    placeholder="Instructor Name"
                    value={instructor.name}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateInstructor(index, 'name', event.target.value)
                    }
                  />
                  <input
                    className="w-full rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="text"
                    placeholder="Classes (comma separated)"
                    value={instructor.codes}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateInstructor(index, 'codes', event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                    onClick={() => removeInstructor(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
              onClick={addInstructor}
            >
              Add Instructor
            </button>
          </div>

          <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
            <h2 className="mb-4 text-center text-xl font-semibold">Formatting Options</h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={optionClass(formatOptionsState.time_headers)}
                onClick={() => toggleOption('time_headers')}
              >
                Time Headers
              </button>
              <button
                type="button"
                className={optionClass(formatOptionsState.instructor_headers)}
                onClick={() => toggleOption('instructor_headers')}
              >
                Instructor Headers
              </button>
              <button
                type="button"
                className={optionClass(formatOptionsState.course_headers)}
                onClick={() => toggleOption('course_headers')}
              >
                Course Headers
              </button>
              <button
                type="button"
                className={optionClass(formatOptionsState.borders)}
                onClick={() => toggleOption('borders')}
              >
                Borders
              </button>

              <fieldset className="mt-2 flex flex-col gap-2 rounded-2xl border-2 border-secondary p-4">
                <legend className="px-2 font-semibold">Time Header Style</legend>
                <button
                  type="button"
                  className={optionClass(formatOptionsState.center_time)}
                  onClick={() => toggleOption('center_time')}
                >
                  Center
                </button>
                <button
                  type="button"
                  className={optionClass(formatOptionsState.bold_time)}
                  onClick={() => toggleOption('bold_time')}
                >
                  Bold
                </button>
              </fieldset>

              <fieldset className="mt-2 flex flex-col gap-2 rounded-2xl border-2 border-secondary p-4">
                <legend className="px-2 font-semibold">Course Header Style</legend>
                <button
                  type="button"
                  className={optionClass(formatOptionsState.center_course)}
                  onClick={() => toggleOption('center_course')}
                >
                  Center
                </button>
                <button
                  type="button"
                  className={optionClass(formatOptionsState.bold_course)}
                  onClick={() => toggleOption('bold_course')}
                >
                  Bold
                </button>
              </fieldset>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            className={optionClass(rememberInstructors)}
            onClick={() => setRememberInstructors(value => !value)}
          >
            Remember Instructors and Classes
          </button>
          <button
            type="button"
            className={optionClass(rememberFormatting)}
            onClick={() => setRememberFormatting(value => !value)}
          >
            Remember Formatting Options
          </button>
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-secondary px-4 py-3 text-2xl font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-primary disabled:opacity-70"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Processing...' : 'Create Master List'}
        </button>
      </form>
    </div>
  )
}

export default MasterListPage
