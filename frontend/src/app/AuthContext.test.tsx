import React from 'react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, customRender, screen, waitFor } from '../test/render'
import { AuthProvider, useAuth } from './AuthContext'

const authMocks = vi.hoisted(() => ({
  bootstrapAuthSession: vi.fn(),
  onAuthSessionChanged: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUpWithPassword: vi.fn(),
  fetchAccountData: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('../lib/authClient', () => ({
  bootstrapAuthSession: authMocks.bootstrapAuthSession,
  onAuthSessionChanged: authMocks.onAuthSessionChanged,
  signInWithPassword: authMocks.signInWithPassword,
  signOut: authMocks.signOut,
  signUpWithPassword: authMocks.signUpWithPassword,
}))

vi.mock('../lib/serverApi', () => ({
  fetchAccountData: authMocks.fetchAccountData,
  updateProfile: authMocks.updateProfile,
}))

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function AuthStateProbe() {
  const { loading, needsProfile } = useAuth()

  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="needs-profile">{needsProfile ? 'yes' : 'no'}</span>
    </div>
  )
}

describe('AuthContext', () => {
  let authListener: ((session: any) => void) | null = null

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    authListener = null
    authMocks.bootstrapAuthSession.mockReset()
    authMocks.onAuthSessionChanged.mockReset()
    authMocks.signInWithPassword.mockReset()
    authMocks.signOut.mockReset()
    authMocks.signUpWithPassword.mockReset()
    authMocks.fetchAccountData.mockReset()
    authMocks.updateProfile.mockReset()

    authMocks.onAuthSessionChanged.mockImplementation(listener => {
      authListener = listener
      return () => {
        authListener = null
      }
    })
  })

  it('does not report needsProfile while a configured user profile is still loading on bootstrap', async () => {
    const profileDeferred = createDeferred<{ profile: { first_name: string; last_name: string; account_type: 'part_time'; id: string; email: string } }>()

    authMocks.bootstrapAuthSession.mockResolvedValue({
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 9999999999,
      user: { id: 'user-1', email: 'configured@example.com' },
    })
    authMocks.fetchAccountData.mockReturnValue(profileDeferred.promise)

    customRender(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    await waitFor(() => expect(authMocks.fetchAccountData).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('needs-profile')).toHaveTextContent('no')

    profileDeferred.resolve({
      profile: {
        id: 'user-1',
        email: 'configured@example.com',
        first_name: 'Configured',
        last_name: 'User',
        account_type: 'part_time',
      },
    })

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    expect(screen.getByTestId('needs-profile')).toHaveTextContent('no')
  })

  it('does not flash needsProfile during an auth session change before the profile finishes loading', async () => {
    authMocks.bootstrapAuthSession.mockResolvedValue(null)
    authMocks.fetchAccountData.mockResolvedValue({
      profile: {
        id: 'user-2',
        email: 'configured@example.com',
        first_name: 'Configured',
        last_name: 'User',
        account_type: 'part_time',
      },
    })

    customRender(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    expect(screen.getByTestId('needs-profile')).toHaveTextContent('no')

    const profileDeferred = createDeferred<{ profile: { first_name: string; last_name: string; account_type: 'part_time'; id: string; email: string } }>()
    authMocks.fetchAccountData.mockReturnValueOnce(profileDeferred.promise)

    await act(async () => {
      authListener?.({
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 9999999999,
        user: { id: 'user-2', email: 'configured@example.com' },
      })
    })

    expect(screen.getByTestId('needs-profile')).toHaveTextContent('no')

    profileDeferred.resolve({
      profile: {
        id: 'user-2',
        email: 'configured@example.com',
        first_name: 'Configured',
        last_name: 'User',
        account_type: 'part_time',
      },
    })

    await waitFor(() => expect(screen.getByTestId('needs-profile')).toHaveTextContent('no'))
  })

  it('reports needsProfile after profile loading resolves for an incomplete account', async () => {
    authMocks.bootstrapAuthSession.mockResolvedValue({
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 9999999999,
      user: { id: 'user-3', email: 'incomplete@example.com' },
    })
    authMocks.fetchAccountData.mockResolvedValue({
      profile: {
        id: 'user-3',
        email: 'incomplete@example.com',
        first_name: '',
        last_name: 'User',
        account_type: 'part_time',
      },
    })

    customRender(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    expect(screen.getByTestId('needs-profile')).toHaveTextContent('yes')
  })
})
