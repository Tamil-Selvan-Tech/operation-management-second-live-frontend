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

const initialFaculty = [
  {
    id: 'FC-001',
    name: 'Arun Kumar',
    email: 'arun@gmail.com',
    phone: '9876543210',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Chennai',
    address: 'No. 12, Main Street, Chennai',
    tempPassword: 'password123',
    status: 'Active',
  },
  {
    id: 'FC-002',
    name: 'Priya Raj',
    email: 'priya.raj@cispro.com',
    phone: '9876543211',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Madurai',
    address: 'No. 45, Bypass Road, Madurai',
    tempPassword: 'password123',
    status: 'Active',
  },
  {
    id: 'FC-003',
    name: 'Karthik Raja',
    email: 'karthik.raja@cispro.com',
    phone: '9876543212',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Coimbatore',
    address: 'No. 78, Cross Cut Road, Coimbatore',
    tempPassword: 'password123',
    status: 'Inactive',
  },
]

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
