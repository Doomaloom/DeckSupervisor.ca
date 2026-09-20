import type React from 'react'
import { cn } from '../classNames'

export type ModalShellProps = {
  title: string
  description?: React.ReactNode
  notice?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  panelClassName?: string
  closeLabel?: string
}

export function ModalShell({
  title,
  description,
  notice,
  onClose,
  children,
  panelClassName,
  closeLabel,
}: ModalShellProps) {
  const accessibleCloseLabel = closeLabel ?? `Close ${title.toLowerCase()}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn(
          'relative w-full max-w-4xl rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-xl',
          panelClassName,
        )}
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/30 bg-bg text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-secondary"
          aria-label={accessibleCloseLabel}
          onClick={onClose}
        >
          X
        </button>
        <h3 className="text-2xl font-semibold">{title}</h3>
        {description ? <p className="mt-2 text-secondary/80">{description}</p> : null}
        {notice ? <div className="mt-6">{notice}</div> : null}
        {children}
      </div>
    </div>
  )
}
