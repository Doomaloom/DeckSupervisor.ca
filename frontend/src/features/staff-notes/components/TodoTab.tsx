import type { TodoItem } from '../types'

type TodoTabProps = {
  isSessionReady: boolean
  isEditable: boolean
  todoText: string
  setTodoText: (value: string) => void
  onAddTodo: () => void
  isAddTodoDisabled: boolean
  todos: TodoItem[]
  listEmptyLabel: string
  onToggleTodo: (id: string) => void
  onDeleteTodo: (id: string) => void
}

function TodoTab({
  isSessionReady,
  isEditable,
  todoText,
  setTodoText,
  onAddTodo,
  isAddTodoDisabled,
  todos,
  listEmptyLabel,
  onToggleTodo,
  onDeleteTodo,
}: TodoTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
          type="text"
          value={todoText}
          onChange={event => setTodoText(event.target.value)}
          placeholder="Add a todo item"
          disabled={!isSessionReady || !isEditable}
        />
        <button
          type="button"
          className="rounded-2xl bg-secondary px-5 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onAddTodo}
          disabled={isAddTodoDisabled}
        >
          Add Todo
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {todos.length === 0 ? (
          <p className="text-sm text-secondary/70">{listEmptyLabel}</p>
        ) : (
          todos.map(item => (
            <div
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-secondary/20 bg-bg p-4"
            >
              <label className="flex flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => onToggleTodo(item.id)}
                  disabled={!isSessionReady || !isEditable}
                />
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      item.done ? 'text-secondary/50 line-through' : 'text-secondary'
                    }`}
                  >
                    {item.text}
                  </p>
                  <p className="mt-1 text-xs text-secondary/60">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              </label>
              {isEditable ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-secondary/70 transition hover:text-secondary"
                  onClick={() => onDeleteTodo(item.id)}
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

export default TodoTab
