'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { User, UserStats } from '@/types'

interface UseUserReturn {
  user: User | null
  supabaseUser: SupabaseUser | null
  stats: UserStats | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()

  const fetchUser = async () => {
    // Skip if supabase client is not available
    if (!supabase) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!authUser) {
        setUser(null)
        setSupabaseUser(null)
        setStats(null)
        return
      }

      setSupabaseUser(authUser)

      // Get profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError) throw profileError
      setUser(profile)

      // Get stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_user_stats', { user_uuid: authUser.id })
        .single()

      if (!statsError && statsData) {
        setStats(statsData as UserStats)
      } else {
        // Fallback stats from profile
        setStats({
          total_generations: profile?.total_generations || 0,
          generations_today: 0,
          current_xp: profile?.xp || 0,
          current_level: profile?.level || 1,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<User>): Promise<{ error: Error | null }> => {
    if (!supabase || !supabaseUser) {
      return { error: new Error('Not authenticated') }
    }

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', supabaseUser.id)

      if (updateError) throw updateError

      // Refresh user data
      await fetchUser()
      return { error: null }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Update failed')
      return { error }
    }
  }

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setSupabaseUser(null)
    setStats(null)
    window.location.href = '/login'
  }

  useEffect(() => {
    // Skip if supabase client is not available
    if (!supabase) {
      setLoading(false)
      return
    }

    fetchUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUser()
      } else {
        setUser(null)
        setSupabaseUser(null)
        setStats(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    user,
    supabaseUser,
    stats,
    loading,
    error,
    refetch: fetchUser,
    updateProfile,
    signOut,
  }
}
