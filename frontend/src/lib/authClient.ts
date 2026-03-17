export type AuthUser = {
  id: string
  email: string
}

export type BrowserSession = {
  token_type: string
  expires_in: number
  expires_at: number
  user: AuthUser
}

type AuthResponse = {
  session?: BrowserSession | null
  user?: AuthUser | null
  message?: string
}

type AuthListener = (session: BrowserSession | null) => void

let currentSession: BrowserSession | null = null
let refreshInFlight: Promise<BrowserSession | null> | null = null
const listeners = new Set<AuthListener>()

function notify() {
  for (const listener of listeners) {
    listener(currentSession)
  }
}

function setSession(session: BrowserSession | null) {
  currentSession = session
  notify()
}

async function requestAuth(path: string, init?: RequestInit): Promise<AuthResponse> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Authentication request failed')
  }

  if (response.status === 204) {
    return {}
  }

  return (await response.json()) as AuthResponse
}

async function refreshFromCookie(): Promise<BrowserSession | null> {
  try {
    const data = await requestAuth('/api/auth/session', { method: 'GET' })
    const next = data.session ?? null
    setSession(next)
    return next
  } catch (error) {
    setSession(null)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return null
    }
    throw error
  }
}

export function getCurrentSession() {
  return currentSession
}

export function onAuthSessionChanged(listener: AuthListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function bootstrapAuthSession() {
  return refreshSession()
}

export async function refreshSession(): Promise<BrowserSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshFromCookie().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

export async function signInWithPassword(email: string, password: string) {
  const data = await requestAuth('/api/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const next = data.session ?? null
  setSession(next)
  return next
}

export async function signUpWithPassword(email: string, password: string) {
  const data = await requestAuth('/api/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const next = data.session ?? null
  if (next) {
    setSession(next)
  }
  return data
}

export async function signOut() {
  try {
    await requestAuth('/api/auth/sign-out', { method: 'POST' })
  } finally {
    setSession(null)
  }
}
