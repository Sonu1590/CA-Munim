import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false,
      })
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
        })
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const emailAlreadyExists = async (email: string) => {
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (firm) return true
    if (firmError) {
      console.warn('Error checking existing firm email before signup:', firmError)
      return false
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (staff) return true
    if (staffError) {
      console.warn('Error checking existing staff email before signup:', staffError)
      return false
    }

    return false
  }

  const signUp = async (email: string, password: string) => {
    const duplicate = await emailAlreadyExists(email)
    if (duplicate) {
      return {
        data: null,
        error: { message: 'An account with this email already exists. Please sign in instead.' },
      }
    }

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) return { data, error }

    // If signup successful and we have user data, create firm and staff records
    if (data.user) {
      try {
        // Create firm record with placeholder data
        const { error: firmError } = await supabase
          .from('firms')
          .insert({
            id: data.user.id, // Use auth user ID as firm ID
            name: 'My CA Firm', // Placeholder name
            email: email,
            onboarding_complete: false,
            created_at: new Date().toISOString(),
          })

        if (firmError) {
          console.error('Failed to create firm record:', firmError)
          // Don't fail signup if firm creation fails, but log it
        }

        // Create staff record for the user
        const { error: staffError } = await supabase
          .from('staff')
          .insert({
            firm_id: data.user.id,
            name: email.split('@')[0], // Use email prefix as name placeholder
            email: email,
            auth_user_id: data.user.id,
            role: 'admin',
            active: true,
            created_at: new Date().toISOString(),
          })

        if (staffError) {
          console.error('Failed to create staff record:', staffError)
          // Don't fail signup if staff creation fails, but log it
        }

      } catch (err) {
        console.error('Error creating initial records:', err)
        // Don't fail the signup
      }
    }

    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
  }

  return {
    ...authState,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    isAuthenticated: !!authState.user,
  }
}
