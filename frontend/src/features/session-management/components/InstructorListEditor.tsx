import type { InstructorEntry } from '../types'

type InstructorListEditorProps = {
  instructors: InstructorEntry[]
  onAddInstructor: () => void
  onUpdateInstructor: (index: number, value: string) => void
  onRemoveInstructor?: (index: number) => void
  currentSessionId?: string
}

function InstructorListEditor({
  instructors,
  onAddInstructor,
  onUpdateInstructor,
  onRemoveInstructor,
  currentSessionId = 'new-session',
}: InstructorListEditorProps) {
  const showRemove = typeof onRemoveInstructor === 'function'

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-secondary">
        {showRemove ? 'Instructors' : 'Instructors on Shift'}
      </p>
      {instructors.map((instructor, index) =>
        showRemove ? (
          <div key={`edit-${currentSessionId}-${index}`} className="flex gap-3">
            <input
              className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
              type="text"
              placeholder="Instructor name"
              value={instructor.name}
              onChange={event => onUpdateInstructor(index, event.target.value)}
            />
            <button
              type="button"
              className="rounded-2xl bg-secondary px-3 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
              onClick={() => onRemoveInstructor(index)}
            >
              Remove
            </button>
          </div>
        ) : (
          <input
            key={`instructor-${index}`}
            className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
            type="text"
            placeholder="Instructor name"
            value={instructor.name}
            onChange={event => onUpdateInstructor(index, event.target.value)}
          />
        ),
      )}
      <button
        type="button"
        className={`rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary ${
          showRemove ? 'w-fit' : 'mt-1'
        }`}
        onClick={onAddInstructor}
      >
        Add Instructor
      </button>
    </div>
  )
}

export default InstructorListEditor
