import React from 'react'
import type { InstructorEntry } from '../../../types/app'

type InstructorListEditorProps = {
  instructors: InstructorEntry[]
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdate: (index: number, field: keyof InstructorEntry, value: string) => void
}

function InstructorListEditor({ instructors, onAdd, onRemove, onUpdate }: InstructorListEditorProps) {
  return (
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
                onUpdate(index, 'name', event.target.value)
              }
            />
            <input
              className="w-full rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
              type="text"
              placeholder="Classes (comma separated)"
              value={instructor.codes}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onUpdate(index, 'codes', event.target.value)
              }
            />
            <button
              type="button"
              className="rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-4 rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
        onClick={onAdd}
      >
        Add Instructor
      </button>
    </div>
  )
}

export default InstructorListEditor
