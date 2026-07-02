import { STORAGE_KEY } from '../data/authData'

export const loadSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!session?.token || !session?.user?.role) return null
    return session
  } catch {
    return null
  }
}

export const saveSession = (session) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY)
}
