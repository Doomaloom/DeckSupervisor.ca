import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
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
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isGuest: boolean
  accountType: Profile['account_type'] | null
  needsProfile: boolean
  refreshProfile: () => Promise<void>
  completeProfile: (firstName: string, lastName: string, location?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (activeUser: User | null) => {
    if (!activeUser) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,first_name,last_name,location,account_type')
      .eq('id', activeUser.id)
      .maybeSingle()
    if (error) {
      console.error('Failed to load profile', error)
      setProfile(null)
      return
    }
    if (data) {
      setProfile(data)
      return
    }

    const { error: insertError } = await supabase.from('profiles').insert({
      id: activeUser.id,
      email: activeUser.email ?? '',
    })
    if (insertError) {
      console.error('Failed to create profile', insertError)
      setProfile(null)
      return
    }
    const { data: createdProfile } = await supabase
      .from('profiles')
      .select('id,email,first_name,last_name,location,account_type')
      .eq('id', activeUser.id)
      .maybeSingle()
    setProfile(createdProfile ?? null)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return
      }
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setStorageScope(data.session?.user?.id ?? 'guest')
      void loadProfile(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setStorageScope(nextSession?.user?.id ?? 'guest')
      void loadProfile(nextSession?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

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
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
      if (error) {
        console.error('Failed to save profile', error)
        return
      }
      await loadProfile(user)
    },
    [loadProfile, user]
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
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
      refreshProfile,
      completeProfile,
      signOut,
    }),
    [completeProfile, loading, profile, refreshProfile, session, signOut, user]
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
