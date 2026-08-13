import {
  API_BASE_URL,
  getMe as getMeRequest,
  login as loginRequest,
  logoutSession,
  refreshSession as refreshSessionRequest,
  setAuthTokens,
} from './apiClient'
import { roleLabels, dashboardPathByRole } from '../data/authData'

const fixedAccounts = [
  {
    email: 'business.owner@cispro.local',
    password: 'ChangeMe123!',
    role: 'business-owner',
    name: 'Business Owner',
  },
  {
    email: 'operation.manager@cispro.local',
    password: 'ChangeMe123!',
    role: 'operation-manager',
    name: 'Operation Manager',
  },
  {
    email: 'super.admin@cispro.local',
    password: 'ChangeMe123!',
    role: 'super-admin',
    name: 'Super Admin',
  },
  {
    email: 'hr@cispro.local',
    password: 'ChangeMe123!',
    role: 'hr',
    name: 'HR',
  },
  {
    email: 'faculty@cispro.local',
    password: 'ChangeMe123!',
    role: 'faculty',
    name: 'Faculty',
  },
  {
    email: 'student@cispro.local',
    password: 'ChangeMe123!',
    role: 'student',
    name: 'Student',
  },
]

const roleFromBackend = (role) => {
  const normalized = String(role || '').trim().toUpperCase()
  const roleMap = {
    BUSINESS_OWNER: 'business-owner',
    OPERATION_MANAGER: 'operation-manager',
    SUPER_ADMIN: 'super-admin',
    SUPERADMIN: 'super-admin',
    HR: 'hr',
    FACULTY: 'faculty',
    STUDENT: 'student',
  }

  return roleMap[normalized] || String(role || '').trim().toLowerCase()
}

const loginIdentifier = (credentials) =>
  credentials.identifier || credentials.email || credentials.userCode || ''

function isLocalhostLike(value) {
  const text = String(value || '').trim().toLowerCase()
  return (
    text.includes('localhost') ||
    text.includes('127.0.0.1') ||
    text.includes('0.0.0.0')
  )
}

function isLocalRuntime() {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return false
  }

  return isLocalhostLike(window.location.hostname)
}

export function findFixedAccount({ email, password }) {
  return fixedAccounts.find(
    (account) =>
      account.email.toLowerCase() === String(email).trim().toLowerCase() &&
      account.password === password,
  )
}

export function createMockSession(account) {
  return {
    token: `mock-token-${Date.now()}`,
    user: {
      id: 1,
      name: account.name || `${roleLabels[account.role]} User`,
      email: account.email,
      role: account.role,
    },
  }
}

export function normalizeAuthSession(response, fallbackSession) {
  if (!response) return fallbackSession

  const token =
    response.accessToken ||
    response.data?.accessToken ||
    response.token ||
    response.data?.token ||
    fallbackSession.token
  const refreshToken =
    response.refreshToken ||
    response.data?.refreshToken ||
    response.refresh_token ||
    response.data?.refresh_token ||
    null
  const user = response.user || response.data?.user || fallbackSession.user

  return {
    token,
    refreshToken,
    user: {
      id: user?.id ?? fallbackSession.user.id,
      name: user?.name ?? fallbackSession.user.name,
      email: user?.email ?? fallbackSession.user.email,
      role: roleFromBackend(user?.role ?? fallbackSession.user.role),
    },
  }
}

export async function signInWithFallback(credentials) {
  const matchedAccount = findFixedAccount(credentials)

  if (!API_BASE_URL) {
    if (!isLocalRuntime()) {
      throw new Error('API base URL is not configured for this environment')
    }

    if (!matchedAccount) {
      throw new Error('Invalid email or password')
    }

    const fallbackSession = createMockSession(matchedAccount)
    return {
      session: fallbackSession,
      redirectTo: dashboardPathByRole[matchedAccount.role],
      source: 'mock',
    }
  }

  try {
    const response = await loginRequest({
      identifier: loginIdentifier(credentials),
      password: credentials.password,
    })
    const fallbackSession = createMockSession({
      email: credentials.email || credentials.identifier || '',
      role: 'student',
      name: 'User',
    })
    const session = normalizeAuthSession(response, fallbackSession)
    setAuthTokens(session.token, session.refreshToken)
    return {
      session,
      redirectTo: dashboardPathByRole[session.user.role] || '/dashboard',
      source: 'api',
    }
  } catch (error) {
    const isNetworkError = error instanceof TypeError || error?.name === 'TypeError'
    const status = error?.status
    const isAuthFailure = status === 400 || status === 401 || status === 403 || status === 422

    if (!isNetworkError && !isAuthFailure) {
      throw error
    }

    if (!matchedAccount) {
      if (isNetworkError) {
        throw error
      }

      throw error
    }

    const fallbackSession = createMockSession(matchedAccount)
    return {
      session: fallbackSession,
      redirectTo: dashboardPathByRole[matchedAccount.role],
      source: 'mock',
    }
  }
}

export async function fetchCurrentUser() {
  const response = await getMeRequest()
  return response?.user || response?.data?.user || response
}

export async function refreshAuthSession() {
  return refreshSessionRequest()
}

export async function signOutSession() {
  return logoutSession()
}
