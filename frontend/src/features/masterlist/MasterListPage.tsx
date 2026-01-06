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

  return (
    <div className="masterlist">
      <form onSubmit={handleSubmit}>
        <div className="drop-zone" onDrop={handleDrop} onDragOver={handleDragOver}>
          <p>Drag & Drop your .csv file here or click to select</p>
          <input
            type="file"
            name="csv_file"
            accept=".csv"
            style={{ opacity: 0 }}
            required
            onChange={event => handleFileChange(event.target.files?.[0] ?? null)}
          />
        </div>
        <div id="file-status">{fileStatus}</div>

        <div className="main-container">
          <div className="panel-left">
            <h2>Instructors and Classes</h2>
            <div className="instructor-fields">
              {instructors.map((instructor, index) => (
                <div key={`${instructor.name}-${index}`} className="instructor-entry">
                  <input
                    type="text"
                    placeholder="Instructor Name"
                    value={instructor.name}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateInstructor(index, 'name', event.target.value)
                    }
                  />
                  <input
                    type="text"
                    placeholder="Classes (comma separated)"
                    value={instructor.codes}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateInstructor(index, 'codes', event.target.value)
                    }
                  />
                  <button type="button" className="remove-btn" onClick={() => removeInstructor(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="add-btn" onClick={addInstructor}>
              Add Instructor
            </button>
          </div>

          <div className="panel-right">
            <h2>Formatting Options</h2>
            <div className="option-group">
              <button
                type="button"
                className={`option-check ${formatOptionsState.time_headers ? 'selected' : ''}`}
                onClick={() => toggleOption('time_headers')}
              >
                Time Headers
              </button>
              <button
                type="button"
                className={`option-check ${formatOptionsState.instructor_headers ? 'selected' : ''}`}
                onClick={() => toggleOption('instructor_headers')}
              >
                Instructor Headers
              </button>
              <button
                type="button"
                className={`option-check ${formatOptionsState.course_headers ? 'selected' : ''}`}
                onClick={() => toggleOption('course_headers')}
              >
                Course Headers
              </button>
              <button
                type="button"
                className={`option-check ${formatOptionsState.borders ? 'selected' : ''}`}
                onClick={() => toggleOption('borders')}
              >
                Borders
              </button>

              <fieldset>
                <legend>Time Header Style</legend>
                <button
                  type="button"
                  className={`option-check ${formatOptionsState.center_time ? 'selected' : ''}`}
                  onClick={() => toggleOption('center_time')}
                >
                  Center
                </button>
                <button
                  type="button"
                  className={`option-check ${formatOptionsState.bold_time ? 'selected' : ''}`}
                  onClick={() => toggleOption('bold_time')}
                >
                  Bold
                </button>
              </fieldset>

              <fieldset>
                <legend>Course Header Style</legend>
                <button
                  type="button"
                  className={`option-check ${formatOptionsState.center_course ? 'selected' : ''}`}
                  onClick={() => toggleOption('center_course')}
                >
                  Center
                </button>
                <button
                  type="button"
                  className={`option-check ${formatOptionsState.bold_course ? 'selected' : ''}`}
                  onClick={() => toggleOption('bold_course')}
                >
                  Bold
                </button>
              </fieldset>
            </div>
          </div>
        </div>

        <div className="remember-panel">
          <button
            type="button"
            className={`option-check ${rememberInstructors ? 'selected' : ''}`}
            onClick={() => setRememberInstructors(value => !value)}
          >
            Remember Instructors and Classes
          </button>
          <button
            type="button"
            className={`option-check ${rememberFormatting ? 'selected' : ''}`}
            onClick={() => setRememberFormatting(value => !value)}
          >
            Remember Formatting Options
          </button>
        </div>

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Processing...' : 'Create Master List'}
        </button>
      </form>
    </div>
  )
}

export default MasterListPage
