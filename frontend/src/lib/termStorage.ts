import { getScopedKey } from './storageScope'

const currentTermKey = () => getScopedKey('currentTermKey')
const CURRENT_TERM_EVENT = 'cob:current-term-changed'

export function getCurrentTermKey(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.localStorage.getItem(currentTermKey()) ?? ''
}

export function setCurrentTermKey(key: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(currentTermKey(), key)
  window.dispatchEvent(new CustomEvent(CURRENT_TERM_EVENT, { detail: { key } }))
}

export function clearCurrentTermKey() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(currentTermKey())
  window.dispatchEvent(new CustomEvent(CURRENT_TERM_EVENT, { detail: { key: '' } }))
}

export function onCurrentTermChanged(handler: (key: string) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ key?: string }>
    handler(custom.detail?.key ?? '')
  }
  window.addEventListener(CURRENT_TERM_EVENT, listener)
  return () => window.removeEventListener(CURRENT_TERM_EVENT, listener)
}
