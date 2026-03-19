import type { NoteItem } from '../types'

type NoteTabProps = {
  isSessionReady: boolean
  isEditable: boolean
  isFullTime: boolean
  showEmployee: boolean
  instructorNames: string[]
  employeeName: string
  setEmployeeName: (value: string) => void
  noteText: string
  setNoteText: (value: string) => void
  onAddNote: () => void
  isAddNoteDisabled: boolean
  notes: NoteItem[]
  listEmptyLabel: string
  onDeleteNote: (id: string) => void
}

function NoteTab({
  isSessionReady,
  isEditable,
  isFullTime,
  showEmployee,
  instructorNames,
  employeeName,
  setEmployeeName,
  noteText,
  setNoteText,
  onAddNote,
  isAddNoteDisabled,
  notes,
  listEmptyLabel,
  onDeleteNote,
}: NoteTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {isEditable ? (
        <div className="flex flex-col gap-3">
          {showEmployee ? (
            <select
              className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
              value={employeeName}
              onChange={event => setEmployeeName(event.target.value)}
              disabled={!isSessionReady}
            >
              {instructorNames.length === 0 ? (
                <option value="">No instructors found</option>
              ) : (
                <option value="">Select employee (optional)</option>
              )}
              {instructorNames.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : null}
          <textarea
            className="min-h-[120px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={noteText}
            onChange={event => setNoteText(event.target.value)}
            placeholder="Write a note"
            disabled={!isSessionReady}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-2xl bg-secondary px-5 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onAddNote}
              disabled={isAddNoteDisabled}
            >
              Add Note
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold text-secondary/70">
          {isFullTime
            ? 'Full-time view is read-only. You are viewing notes written by team members for the selected term.'
            : 'This tab is read-only for your current access level.'}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {notes.length === 0 ? (
          <p className="text-sm text-secondary/70">{listEmptyLabel}</p>
        ) : (
          notes.map(item => (
            <div
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-secondary/20 bg-bg p-4"
            >
              <div className="flex-1">
                <p className="text-xs font-semibold text-secondary/60">{new Date(item.createdAt).toLocaleString()}</p>
                {item.authorName ? (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-secondary/70">
                    Author: {item.authorName}
                  </p>
                ) : null}
                {item.sessionContext ? (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-secondary/70">
                    Session: {item.sessionContext}
                  </p>
                ) : null}
                {item.employeeName ? (
                  <p className="mt-1 text-sm font-semibold text-secondary">{item.employeeName}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{item.text}</p>
              </div>
              {isEditable ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-secondary/70 transition hover:text-secondary"
                  onClick={() => onDeleteNote(item.id)}
                  disabled={!isSessionReady}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default NoteTab
