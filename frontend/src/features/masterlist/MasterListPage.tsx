import React, { useState } from 'react'
import { useDay } from '../../app/DayContext'
import FormattingOptionsPanel from './components/FormattingOptionsPanel'
import InstructorListEditor from './components/InstructorListEditor'
import RememberOptionsRow from './components/RememberOptionsRow'
import SubmitButton from './components/SubmitButton'
import UploadDropzone from './components/UploadDropzone'
import { useMasterListFormatting } from './hooks/useMasterListFormatting'
import { useMasterListInstructors } from './hooks/useMasterListInstructors'
import { useMasterListUpload } from './hooks/useMasterListUpload'
import { submitMasterList } from './submitMasterList'

function MasterListPage() {
  const { selectedDay } = useDay()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { file, fileStatus, handleFileChange, handleDrop, handleDragOver } = useMasterListUpload()
  const { instructors, rememberInstructors, setRememberInstructors, addInstructor, removeInstructor, updateInstructor } =
    useMasterListInstructors(selectedDay ?? '')
  const { formatOptionsState, rememberFormatting, setRememberFormatting, toggleOption } =
    useMasterListFormatting()

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
      await submitMasterList({
        file,
        selectedDay,
        instructors,
        formatOptions: formatOptionsState,
        rememberInstructors,
        rememberFormatting,
      })
    } catch (error) {
      console.error(error)
      alert('Something went wrong while processing the file.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <UploadDropzone
          fileStatus={fileStatus}
          onFileChange={handleFileChange}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <InstructorListEditor
            instructors={instructors}
            onAdd={addInstructor}
            onRemove={removeInstructor}
            onUpdate={updateInstructor}
          />
          <FormattingOptionsPanel formatOptions={formatOptionsState} onToggle={toggleOption} />
        </div>

        <RememberOptionsRow
          rememberInstructors={rememberInstructors}
          rememberFormatting={rememberFormatting}
          onToggleInstructors={() => setRememberInstructors(value => !value)}
          onToggleFormatting={() => setRememberFormatting(value => !value)}
        />

        <SubmitButton isSubmitting={isSubmitting} />
      </form>
    </div>
  )
}

export default MasterListPage
