import React from 'react'

type PrintModalShellProps = {
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
}

function PrintModalShell({ title, description, onClose, children }: PrintModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/30 bg-bg text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-secondary"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
        >
          X
        </button>
        <h3 className="text-2xl font-semibold">{title}</h3>
        {description ? <p className="mt-2 text-secondary/80">{description}</p> : null}
        {children}
      </div>
    </div>
  )
}

export default PrintModalShell
