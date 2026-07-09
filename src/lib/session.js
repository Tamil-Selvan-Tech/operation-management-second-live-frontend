import { STORAGE_KEY } from '../data/authData'

const getStorage = () => window.sessionStorage

export const loadSession = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    const session = JSON.parse(getStorage().getItem(STORAGE_KEY) || 'null')
    if (!session?.token || !session?.user?.role) return null
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
