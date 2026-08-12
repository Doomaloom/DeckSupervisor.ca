import { useEffect, useState } from 'react'
import { onAppNotice, type AppNotice } from '../lib/appNotice'

const toneClasses: Record<AppNotice['tone'], string> = {
  info: 'border-secondary/30 bg-accent text-secondary',
  success: 'border-primary/30 bg-primary/10 text-secondary',
  error: 'border-danger/40 bg-danger/10 text-danger',
}

export default function AppNoticeBanner() {
  const [notice, setNotice] = useState<AppNotice | null>(null)

  useEffect(() => onAppNotice(setNotice), [])

  if (!notice) return null

  return (
    <div
      className={`mb-4 flex w-full shrink-0 items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${toneClasses[notice.tone]}`}
      role={notice.tone === 'error' ? 'alert' : 'status'}
      data-component="app-notice"
    >
      <span>{notice.message}</span>
      <button
        type="button"
        className="shrink-0 text-current/70 transition hover:text-current"
        aria-label="Dismiss message"
        onClick={() => setNotice(null)}
      >
        ×
      </button>
    </div>
  )
}
