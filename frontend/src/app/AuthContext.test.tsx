import React from 'react'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customRender, screen, waitFor } from '../test/render'
import { AuthProvider, useAuth } from './AuthContext'

const bootstrapAuthSession = vi.fn()
const onAuthSessionChanged = vi.fn()
const signInWithPassword = vi.fn()
const signOut = vi.fn()
const signUpWithPassword = vi.fn()
const fetchAccountData = vi.fn()
const updateProfile = vi.fn()

vi.mock('../lib/authClient', () => ({
  bootstrapAuthSession,
  onAuthSessionChanged,
  signInWithPassword,
  signOut,
  signUpWithPassword,
}))

vi.mock('../lib/serverApi', () => ({
  fetchAccountData,
  updateProfile,
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

  beforeEach(() => {
    authListener = null
    bootstrapAuthSession.mockReset()
    onAuthSessionChanged.mockReset()
    signInWithPassword.mockReset()
    signOut.mockReset()
    signUpWithPassword.mockReset()
    fetchAccountData.mockReset()
    updateProfile.mockReset()

    onAuthSessionChanged.mockImplementation(listener => {
      authListener = listener
      return () => {
        authListener = null
      }
    })
  })

  it('does not report needsProfile while a configured user profile is still loading on bootstrap', async () => {
    const profileDeferred = createDeferred<{ profile: { first_name: string; last_name: string; account_type: 'part_time'; id: string; email: string } }>()

    bootstrapAuthSession.mockResolvedValue({
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 9999999999,
      user: { id: 'user-1', email: 'configured@example.com' },
    })
    fetchAccountData.mockReturnValue(profileDeferred.promise)

    customRender(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    await waitFor(() => expect(fetchAccountData).toHaveBeenCalledTimes(1))
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
    bootstrapAuthSession.mockResolvedValue(null)
    fetchAccountData.mockResolvedValue({
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
    fetchAccountData.mockReturnValueOnce(profileDeferred.promise)

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
    bootstrapAuthSession.mockResolvedValue({
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 9999999999,
      user: { id: 'user-3', email: 'incomplete@example.com' },
    })
    fetchAccountData.mockResolvedValue({
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
