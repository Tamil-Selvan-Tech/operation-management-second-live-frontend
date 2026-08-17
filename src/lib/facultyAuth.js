const FACULTY_REGISTRY_KEY = 'cispro.faculty-registry'
const FACULTY_SESSION_KEY = 'cispro.faculty-session'

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const readJSON = (key) => {
  if (!isBrowser()) return null
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

const writeJSON = (key, value) => {
  if (!isBrowser()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}



export function loadFacultyRegistry() {
  const stored = readJSON(FACULTY_REGISTRY_KEY)
  if (Array.isArray(stored) && stored.length) {
    return stored
  }
  return initialFaculty
}

export function saveFacultyRegistry(facultyList = []) {
  writeJSON(FACULTY_REGISTRY_KEY, facultyList)
}

export function findFacultyByCredentials(email, tempPassword) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPassword = String(tempPassword || '').trim()
  return loadFacultyRegistry().find(
    (f) =>
      f.email.toLowerCase() === normalizedEmail &&
      f.tempPassword &&
      f.tempPassword === normalizedPassword
  ) || null
}

export function buildFacultySessionFromCredentials(credentials) {
  const email = String(credentials?.email || credentials?.identifier || '').trim().toLowerCase()
  const password = String(credentials?.password || '').trim()

  if (!email || !password) return null

  const matchedFaculty = findFacultyByCredentials(email, password)
  if (!matchedFaculty) return null

  return {
    token: `mock-token-fac-${Date.now()}`,
    user: {
      id: matchedFaculty.id || 1,
      name: matchedFaculty.name || 'Faculty Member',
      email: matchedFaculty.email,
      role: 'faculty',
      mustResetPassword: true,
    },
  }
}
