import {
  API_BASE_URL,
  getMe as getMeRequest,
  login as loginRequest,
  logoutSession,
  refreshSession as refreshSessionRequest,
  setAuthTokens,
} from './apiClient'
import { roleLabels, dashboardPathByRole } from '../data/authData'
import { findBranchByCredentials, markBranchWelcomeMailSent, recordBranchLogin } from '../lib/branchAuth'
import { clearCourseListCache } from './courseService'

const fixedAccounts = [
  {
    email: 'business.owner@cispro.com',
    password: 'ChangeMe123!',
    role: 'business-owner',
    name: 'Business Owner',
  },
  {
    email: 'operation.manager@cispro.com',
    password: 'ChangeMe123!',
    role: 'operation-manager',
    name: 'Operation Manager',
  },
  {
    email: 'superadmin.manager@cispro.com',
    password: 'superAdmin@cispro123',
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
    BRANCH_ADMIN: 'branch-admin',
    BRANCHADMIN: 'branch-admin',
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
      mustResetPassword: Boolean(account.mustResetPassword),
    },
  }
}

function buildBranchSessionFromCredentials(credentials) {
  const email = String(credentials?.email || credentials?.identifier || '').trim().toLowerCase()
  const password = String(credentials?.password || '').trim()

  if (!email || !password) return null

  const matchedBranch = findBranchByCredentials(email, password)
  if (!matchedBranch) return null

  if (String(matchedBranch.resendMailStatus || '').trim().toLowerCase() !== 'active') {
    markBranchWelcomeMailSent(email)
  }

  recordBranchLogin(matchedBranch)

  return {
    token: `mock-token-${Date.now()}`,
    user: {
      id: matchedBranch.id || 1,
      name: matchedBranch.branchAdminName || matchedBranch.branchName || 'Branch Admin',
      email: matchedBranch.branchEmail,
      role: 'branch-admin',
      mustResetPassword: true,
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
  const mustResetPassword =
    response.mustResetPassword ??
    response.data?.mustResetPassword ??
    response.user?.mustResetPassword ??
    response.data?.user?.mustResetPassword ??
    fallbackSession.user.mustResetPassword

  return {
    token,
    refreshToken,
    user: {
      id: user?.id ?? fallbackSession.user.id,
      name: user?.name ?? user?.fullName ?? fallbackSession.user.name,
      email: user?.email ?? fallbackSession.user.email,
      role: roleFromBackend(user?.role ?? fallbackSession.user.role),
      mustResetPassword: Boolean(user?.mustResetPassword ?? mustResetPassword),
    },
  }
}

export async function signInWithFallback(credentials) {
  const matchedAccount = findFixedAccount(credentials)

  if (!API_BASE_URL) {
    if (!isLocalRuntime()) {
      throw new Error('API base URL is not configured for this environment')
    }

    const branchSession = buildBranchSessionFromCredentials(credentials)
    if (branchSession) {
      return {
        session: branchSession,
        redirectTo: '/branch-dashboard',
        source: 'mock-branch',
      }
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
  clearCourseListCache()
  return {
    session,
    redirectTo: dashboardPathByRole[session.user.role] || '/dashboard',
    source: 'api',
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
  clearCourseListCache()
  return logoutSession()
}
