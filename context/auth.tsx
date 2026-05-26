import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  session: Session | null
  user: User | null
  displayName: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateDisplayName: (name: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | null>(null)

function getDisplayName(user: User | null): string | null {
  if (!user) return null
  return user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? 'Email ou mot de passe incorrect.' : null }
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    return { error: error ? 'Inscription impossible. Vérifiez votre email et votre mot de passe.' : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const updateDisplayName = async (name: string) => {
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: name } })
    if (!error && data.user) setSession(s => s ? { ...s, user: data.user } : s)
    return { error: error?.message ?? null }
  }

  const user = session?.user ?? null

  return (
    <AuthContext.Provider value={{
      session,
      user,
      displayName: getDisplayName(user),
      loading,
      signIn,
      signUp,
      signOut,
      updateDisplayName,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
