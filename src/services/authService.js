import {
  API_BASE_URL,
  getMe as getMeRequest,
  login as loginRequest,
  logoutSession,
  refreshSession as refreshSessionRequest,
} from './apiClient'
import { roleLabels, dashboardPathByRole } from '../data/authData'

const fixedAccounts = [
  {
    email: 'business.owner@cispro.local',
    password: 'Owner@123',
    role: 'business-owner',
    name: 'Business Owner',
  },
  {
    email: 'operations.manager@cispro.local',
    password: 'OpsMgr@123',
    role: 'operation-manager',
    name: 'Operation Manager',
  },
  {
    email: 'hr@cispro.local',
    password: 'HR@123',
    role: 'hr',
    name: 'HR',
  },
  {
    email: 'faculty@cispro.local',
    password: 'Faculty@123',
    role: 'faculty',
    name: 'Faculty',
  },
  {
    email: 'student@cispro.local',
    password: 'Student@123',
    role: 'student',
    name: 'Student',
  },
]

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

  const token = response.accessToken || response.token || fallbackSession.token
  const refreshToken = response.refreshToken || response.refresh_token || null
  const user = response.user || response.data?.user || fallbackSession.user

  return {
    token,
    refreshToken,
    user: {
      id: user?.id ?? fallbackSession.user.id,
      name: user?.name ?? fallbackSession.user.name,
      email: user?.email ?? fallbackSession.user.email,
      role: user?.role ?? fallbackSession.user.role,
    },
  }
}

export async function signInWithFallback(credentials) {
  const matchedAccount = findFixedAccount(credentials)

  if (!matchedAccount) {
    throw new Error('Invalid email or password')
  }

  const fallbackSession = createMockSession(matchedAccount)

  if (!API_BASE_URL) {
    return {
      session: fallbackSession,
      redirectTo: dashboardPathByRole[matchedAccount.role],
      source: 'mock',
    }
  }

  try {
    const response = await loginRequest(credentials)
    const session = normalizeAuthSession(response, fallbackSession)
    return {
      session,
      redirectTo: dashboardPathByRole[session.user.role] || dashboardPathByRole[credentials.role],
      source: 'api',
    }
  } catch (error) {
    const isNetworkError = error instanceof TypeError || error?.name === 'TypeError'
    if (!isNetworkError) {
      throw error
    }

    return {
      session: fallbackSession,
      redirectTo: dashboardPathByRole[credentials.role],
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
