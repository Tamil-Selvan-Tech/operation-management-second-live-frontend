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
  {
    id: 'FC-004',
    name: 'Meera Nair',
    email: 'meera.nair@cispro.com',
    phone: '9876543213',
    country: 'India',
    state: 'Kerala',
    city: 'Kochi',
    address: 'Lane 3, Marine Drive, Kochi',
    tempPassword: 'password123',
    status: 'Active',
  },
  {
    id: 'FC-005',
    name: 'Vignesh Iyer',
    email: 'vignesh.iyer@cispro.com',
    phone: '9876543214',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Trichy',
    address: '12, Gandhi Road, Trichy',
    tempPassword: 'password123',
    status: 'Active',
  },
  {
    id: 'FC-006',
    name: 'Sanjana Bose',
    email: 'sanjana.bose@cispro.com',
    phone: '9876543215',
    country: 'India',
    state: 'West Bengal',
    city: 'Kolkata',
    address: 'Dhakuria, Kolkata',
    tempPassword: 'password123',
    status: 'Inactive',
  },
  {
    id: 'FC-007',
    name: 'Rohit Sharma',
    email: 'rohit.sharma@cispro.com',
    phone: '9876543216',
    country: 'India',
    state: 'Delhi',
    city: 'New Delhi',
    address: 'Rohini Sector 6, Delhi',
    tempPassword: 'password123',
    status: 'Active',
  },
  {
    id: 'FC-008',
    name: 'Nisha Kulkarni',
    email: 'nisha.kulkarni@cispro.com',
    phone: '9876543217',
    country: 'India',
    state: 'Maharashtra',
    city: 'Pune',
    address: 'Baner Road, Pune',
    tempPassword: 'password123',
    status: 'Active',
  },
  {
    id: 'FC-009',
    name: 'Farhan Ali',
    email: 'farhan.ali@cispro.com',
    phone: '9876543218',
    country: 'India',
    state: 'Karnataka',
    city: 'Bengaluru',
    address: 'Koramangala, Bengaluru',
    tempPassword: 'password123',
    status: 'Active',
  },
  {
    id: 'FC-010',
    name: 'Anjali Menon',
    email: 'anjali.menon@cispro.com',
    phone: '9876543219',
    country: 'India',
    state: 'Kerala',
    city: 'Thiruvananthapuram',
    address: 'Kowdiar, Trivandrum',
    tempPassword: 'password123',
    status: 'Inactive',
  },
  {
    id: 'FC-011',
    name: 'Harish Gopal',
    email: 'harish.gopal@cispro.com',
    phone: '9876543220',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Salem',
    address: '5th cross, Salem',
    tempPassword: 'password123',
    status: 'Active',
  },
  {
    id: 'FC-012',
    name: 'Divya Suresh',
    email: 'divya.suresh@cispro.com',
    phone: '9876543221',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Vellore',
    address: 'Anna Nagar, Vellore',
    tempPassword: 'password123',
    status: 'Active',
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
