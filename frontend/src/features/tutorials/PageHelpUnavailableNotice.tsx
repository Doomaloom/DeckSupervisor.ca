import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type PageHelpUnavailableNoticeProps = {
  message: string | null
  onDismiss: () => void
}

function PageHelpUnavailableNotice({
  message,
  onDismiss,
}: PageHelpUnavailableNoticeProps) {
  useEffect(() => {
    if (!message) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onDismiss()
    }, 3500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [message, onDismiss])

  if (!message) {
    return null
  }

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-component="page-help-unavailable-notice"
      className="fixed bottom-5 right-5 z-[95] flex max-w-sm items-start justify-between gap-3 rounded-2xl border border-secondary/20 bg-[#f7f4ed] px-4 py-3 text-sm text-secondary shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
    >
      <p>{message}</p>
      <button
        type="button"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-secondary/20 bg-bg text-xs font-semibold transition hover:-translate-y-0.5 hover:border-secondary"
        onClick={onDismiss}
        aria-label="Dismiss help notice"
      >
        X
      </button>
    </div>,
    document.body,
  )
}

export default PageHelpUnavailableNotice
