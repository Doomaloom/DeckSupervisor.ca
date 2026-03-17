import { getStoredItem, setStoredItem } from './browserStorage'

const SCOPE_KEY = 'cob:storageScope'
const SCOPE_EVENT = 'cob:storage-scope-changed'
const DEFAULT_SCOPE = 'guest'

let cachedScope: string | null = null

export function getStorageScope(): string {
  if (cachedScope) {
    return cachedScope
  }
  if (typeof window === 'undefined') {
    cachedScope = DEFAULT_SCOPE
    return cachedScope
  }
  const stored = getStoredItem(SCOPE_KEY)
  cachedScope = stored || DEFAULT_SCOPE
  return cachedScope
}

export function setStorageScope(scope: string) {
  cachedScope = scope || DEFAULT_SCOPE
  if (typeof window === 'undefined') {
    return
  }
  setStoredItem(SCOPE_KEY, cachedScope)
  window.dispatchEvent(new CustomEvent(SCOPE_EVENT, { detail: { scope: cachedScope } }))
}

export function getScopedKey(key: string): string {
  return `cob:${getStorageScope()}:${key}`
}

export function onStorageScopeChanged(handler: (scope: string) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ scope?: string }>
    handler(custom.detail?.scope ?? DEFAULT_SCOPE)
  }
  window.addEventListener(SCOPE_EVENT, listener)
  return () => window.removeEventListener(SCOPE_EVENT, listener)
}
