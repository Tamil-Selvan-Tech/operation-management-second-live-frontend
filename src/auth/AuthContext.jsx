import { useEffect, useMemo, useState } from 'react'
import { clearSession, loadSession, saveSession } from '../lib/session'
import { AuthContext } from './authContext'
import {
  clearAuthTokens,
  refreshSession,
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

  useEffect(() => {
    if (!session?.refreshToken || typeof window === 'undefined') {
      return undefined
    }

    let isRefreshing = false
    const refresh = async () => {
      if (isRefreshing || document.visibilityState === 'hidden') return

      isRefreshing = true
      try {
        // Refresh before the 15-minute access token expires. A failed transient
        // request is intentionally ignored and retried on the next interval.
        await refreshSession()
      } catch {
        // The API client only expires the session for an invalid refresh token.
      } finally {
        isRefreshing = false
      }
    }

    const intervalId = window.setInterval(refresh, 10 * 60 * 1000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [session?.refreshToken])

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
