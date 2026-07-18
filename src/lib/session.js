import { STORAGE_KEY } from '../data/authData'
import { API_BASE_URL } from '../services/apiClient'

const getStorage = () => window.sessionStorage
const PENDING_LOGIN_EMAIL_KEY = 'cispro.pending-login-email'

const isLikelyJwt = (value) =>
  typeof value === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

export const loadSession = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    const session = JSON.parse(getStorage().getItem(STORAGE_KEY) || 'null')
    if (!session?.token || !session?.user?.role) return null

    if (API_BASE_URL && !isLikelyJwt(session.token)) {
      getStorage().removeItem(STORAGE_KEY)
      return null
    }

    return session
  } catch {
    return null
  }
}

export const saveSession = (session) => {
  getStorage().setItem(STORAGE_KEY, JSON.stringify(session))
}

export const clearSession = () => {
  window.localStorage.removeItem(STORAGE_KEY)
  getStorage().removeItem(STORAGE_KEY)
}

export const loadPendingLoginEmail = () => {
  try {
    const email = String(getStorage().getItem(PENDING_LOGIN_EMAIL_KEY) || '').trim().toLowerCase()
    return isValidEmail(email) ? email : ''
  } catch {
    return ''
  }
}

export const savePendingLoginEmail = (email) => {
  const nextEmail = String(email || '').trim().toLowerCase()

  try {
    if (!isValidEmail(nextEmail)) {
      getStorage().removeItem(PENDING_LOGIN_EMAIL_KEY)
      return
    }

    getStorage().setItem(PENDING_LOGIN_EMAIL_KEY, nextEmail)
  } catch {
    // Ignore storage failures so auth flow can continue.
  }
}

export const clearPendingLoginEmail = () => {
  try {
    getStorage().removeItem(PENDING_LOGIN_EMAIL_KEY)
  } catch {
    // Ignore storage failures so auth flow can continue.
  }
}
