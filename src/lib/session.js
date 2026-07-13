import { STORAGE_KEY } from '../data/authData'
import { API_BASE_URL } from '../services/apiClient'

const getStorage = () => window.sessionStorage

const isLikelyJwt = (value) =>
  typeof value === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)

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
