import { useEffect, useMemo, useState } from 'react'
import { clearSession, loadSession, saveSession } from '../lib/session'
import { AuthContext } from './authContext'
import {
  clearAuthTokens,
  setAuthTokens,
  setSessionExpiredHandler,
} from '../services/apiClient'
import { signInWithFallback, signOutSession } from '../services/authService'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession())
  const isReady = true

  useEffect(() => {
    if (session) {
      setAuthTokens(session.token, session.refreshToken || null)
    } else {
      clearAuthTokens()
    }
  }, [session])

  useEffect(() => {
    if (session) {
      saveSession(session)
      setAuthTokens(session.token, session.refreshToken || null)
    } else {
      clearSession()
      clearAuthTokens()
    }
  }, [session])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setSession(null)
    })
  }, [])

  const value = useMemo(() => {
    const signIn = async (credentials) => {
      const { session: nextSession, redirectTo } = await signInWithFallback(credentials)
      setAuthTokens(nextSession.token, nextSession.refreshToken || null)
      setSession(nextSession)
      return redirectTo
    }

    const signOut = async () => {
      // Clear local access immediately so a slow logout request cannot keep the user on the dashboard.
      setSession(null)
      try {
        await signOutSession()
      } catch {
        // Local logout is already complete; a failed server cleanup must not block navigation.
      }
    }

    return {
      session,
      setSession,
      signIn,
      signOut,
      isAuthenticated: Boolean(session?.token),
      role: session?.user?.role ?? null,
      user: session?.user ?? null,
      isReady,
    }
  }, [session, isReady])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
