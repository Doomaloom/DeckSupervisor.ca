import { getScopedKey } from './storageScope'

const currentTeamKey = () => getScopedKey('currentTeamId')
const CURRENT_TEAM_EVENT = 'cob:current-team-changed'

export function getCurrentTeamId(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.localStorage.getItem(currentTeamKey()) ?? ''
}

export function setCurrentTeamId(id: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(currentTeamKey(), id)
  window.dispatchEvent(new CustomEvent(CURRENT_TEAM_EVENT, { detail: { id } }))
}

export function clearCurrentTeamId() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(currentTeamKey())
  window.dispatchEvent(new CustomEvent(CURRENT_TEAM_EVENT, { detail: { id: '' } }))
}

export function onCurrentTeamChanged(handler: (id: string) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ id?: string }>
    handler(custom.detail?.id ?? '')
  }
  window.addEventListener(CURRENT_TEAM_EVENT, listener)
  return () => window.removeEventListener(CURRENT_TEAM_EVENT, listener)
}
