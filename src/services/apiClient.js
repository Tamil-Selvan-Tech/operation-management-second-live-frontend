export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

let accessToken = null
let refreshToken = null
let sessionExpiredHandler = null

export function setAuthTokens(nextAccessToken, nextRefreshToken = null) {
  accessToken = nextAccessToken || null
  refreshToken = nextRefreshToken || null
}

export function clearAuthTokens() {
  accessToken = null
  refreshToken = null
}

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler
}

async function request(path, options = {}, retryCount = 0) {
  const { skipAuth, headers: optionHeaders, body, ...fetchOptions } = options
  const headers = new Headers(optionHeaders || {})

  if (skipAuth !== true && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    body,
    headers,
  })

  if (response.status === 401 && retryCount === 0 && refreshToken) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return request(path, options, retryCount + 1)
    }
  }

  if (response.status === 401) {
    sessionExpiredHandler?.()
  }

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`)
    error.status = response.status
    error.body = await safeParseJson(response)
    throw error
  }

  return safeParseJson(response)
}

async function safeParseJson(response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function login(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getMe() {
  return request('/auth/me', {
    method: 'GET',
  })
}

export async function refreshAccessToken() {
  if (!refreshToken) return null

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${refreshToken}`,
    },
  })

  if (!response.ok) {
    sessionExpiredHandler?.()
    return null
  }

  const data = await safeParseJson(response)
  if (data?.accessToken) {
    setAuthTokens(data.accessToken, data.refreshToken || refreshToken)
  }

  return data
}

export async function refreshSession() {
  return refreshAccessToken()
}

export async function logoutSession() {
  try {
    if (!refreshToken) return

    await request('/auth/logout', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ refreshToken }),
    })
  } finally {
    clearAuthTokens()
  }
}

export { request }
