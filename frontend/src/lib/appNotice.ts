export type AppNoticeTone = 'info' | 'success' | 'error'

export type AppNotice = {
  id: number
  message: string
  tone: AppNoticeTone
}

const APP_NOTICE_EVENT = 'decksupervisor:app-notice'
let nextNoticeId = 1

export function showAppNotice(message: string, tone: AppNoticeTone = 'info'): void {
  const trimmed = message.trim()
  if (!trimmed || typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AppNotice>(APP_NOTICE_EVENT, {
    detail: { id: nextNoticeId++, message: trimmed, tone },
  }))
}

export function onAppNotice(listener: (notice: AppNotice) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handleNotice = (event: Event) => listener((event as CustomEvent<AppNotice>).detail)
  window.addEventListener(APP_NOTICE_EVENT, handleNotice)
  return () => window.removeEventListener(APP_NOTICE_EVENT, handleNotice)
}
