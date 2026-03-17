import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  bootstrapAuthSession,
  onAuthSessionChanged,
  type AuthUser,
  signInWithPassword,
  signOut as signOutFromBackend,
  signUpWithPassword,
  type BrowserSession,
} from '../lib/authClient'
import { fetchAccountData, updateProfile as updateProfileRequest } from '../lib/serverApi'
import { setStorageScope } from '../lib/storageScope'

export type Profile = {
  id: string
  email: string
  first_name: string
  last_name: string
  location?: string | null
  account_type: 'part_time' | 'full_time'
}

type AuthContextValue = {
  session: BrowserSession | null
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  isGuest: boolean
  accountType: Profile['account_type'] | null
  needsProfile: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<string>
  refreshProfile: () => Promise<void>
  completeProfile: (firstName: string, lastName: string, location?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BrowserSession | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (activeUser: AuthUser | null) => {
    if (!activeUser) {
      setProfile(null)
      return
    }
    try {
      const data = await fetchAccountData()
      setProfile(data.profile)
    } catch (error) {
      console.error('Failed to load profile', error)
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const applySession = async (nextSession: BrowserSession | null) => {
      if (!mounted) {
        return
      }
      setSession(nextSession)
      const nextUser = nextSession?.user ?? null
      setUser(nextUser)
      setStorageScope(nextUser?.id ?? 'guest')
      await loadProfile(nextUser)
      if (mounted) {
        setLoading(false)
      }
    }

    void bootstrapAuthSession()
      .then(applySession)
      .catch(error => {
        console.error('Failed to bootstrap auth session', error)
        if (mounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
          setStorageScope('guest')
          setLoading(false)
        }
      })
    const unsubscribe = onAuthSessionChanged(nextSession => {
      void applySession(nextSession)
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await signInWithPassword(email, password)
    if (!nextSession) {
      throw new Error('Failed to establish session')
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await signUpWithPassword(email, password)
    return result.message ?? ''
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(user)
  }, [loadProfile, user])

  const completeProfile = useCallback(
    async (firstName: string, lastName: string, location?: string) => {
      if (!user) {
        return
      }
      const payload: {
        id: string
        email: string
        first_name: string
        last_name: string
        location?: string | null
      } = {
        id: user.id,
        email: user.email ?? '',
        first_name: firstName,
        last_name: lastName,
      }
      if (location !== undefined) {
        payload.location = location ?? null
      }
      try {
        await updateProfileRequest(payload)
      } catch (error) {
        console.error('Failed to save profile', error)
        return
      }
      await loadProfile(user)
    },
    [loadProfile, user]
  )

  const signOut = useCallback(async () => {
    await signOutFromBackend()
    setSession(null)
    setUser(null)
    setProfile(null)
    setStorageScope('guest')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading,
      isGuest: !user,
      accountType: profile?.account_type ?? null,
      needsProfile: Boolean(user && (!profile?.first_name || !profile?.last_name)),
      signIn,
      signUp,
      refreshProfile,
      completeProfile,
      signOut,
    }),
    [completeProfile, loading, profile, refreshProfile, session, signIn, signOut, signUp, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
