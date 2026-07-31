function isLocalhostLike(value) {
  const text = String(value || '').trim().toLowerCase()
  return (
    text.includes('localhost') ||
    text.includes('127.0.0.1') ||
    text.includes('0.0.0.0')
  )
}

function buildRuntimeApiBaseUrl() {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return ''
  }

  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:4000/api/v1`
}

const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim()
const runtimeApiBaseUrl = buildRuntimeApiBaseUrl()
const isLocalRuntime = typeof window !== 'undefined' && isLocalhostLike(window.location?.hostname)
const productionApiBaseUrl = 'https://cispro-operation-management-backend-m07q.onrender.com/api/v1'
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000)

export const API_BASE_URL =
  configuredApiBaseUrl || (isLocalRuntime ? runtimeApiBaseUrl : productionApiBaseUrl)

let accessToken = null
let refreshToken = null
let sessionExpiredHandler = null

function parseFileNameFromContentDisposition(headerValue = '') {
  const value = String(headerValue || '').trim()
  if (!value) return ''

  const utfMatch = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim().replace(/^"(.*)"$/, '$1'))
    } catch {
      return utfMatch[1].trim().replace(/^"(.*)"$/, '$1')
    }
  }

  const basicMatch = value.match(/filename\s*=\s*("?)([^";]+)\1/i)
  return basicMatch?.[2]?.trim() || ''
}

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
  const controller = new AbortController()
  let didTimeout = false
  const timeoutId = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  if (skipAuth !== true && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-cache')
  }

  if (!headers.has('Pragma')) {
    headers.set('Pragma', 'no-cache')
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      credentials: fetchOptions.credentials || 'include',
      cache: fetchOptions.cache || 'no-store',
      body,
      headers,
      signal: fetchOptions.signal || controller.signal,
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

    if (response.status === 304) {
      return null
    }

    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`)
      error.status = response.status
      error.body = await safeParseJson(response)
      throw error
    }

    return safeParseJson(response)
  } catch (error) {
    if (didTimeout || error?.name === 'AbortError') {
      const timeoutError = new Error('Request timed out. Please try again.')
      timeoutError.status = 408
      throw timeoutError
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
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
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  }
  const controller = new AbortController()
  let didTimeout = false
  const timeoutId = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  if (refreshToken) {
    headers.Authorization = `Bearer ${refreshToken}`
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers,
      signal: controller.signal,
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
  } catch (error) {
    if (didTimeout || error?.name === 'AbortError') {
      const timeoutError = new Error('Request timed out. Please try again.')
      timeoutError.status = 408
      throw timeoutError
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function refreshSession() {
  return refreshAccessToken()
}

export async function logoutSession() {
  try {
    await request('/auth/logout', {
      method: 'POST',
      skipAuth: true,
      credentials: 'include',
      body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
    })
  } finally {
    clearAuthTokens()
  }
}

export async function requestPasswordReset(identifier) {
  return request('/auth/forgot-password', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email: identifier }),
  })
}

export async function resetPassword({ token, password }) {
  return request('/auth/reset-password', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ token, password }),
  })
}

export async function requestBlob(path, options = {}, retryCount = 0) {
  const { skipAuth, headers: optionHeaders, body, ...fetchOptions } = options
  const headers = new Headers(optionHeaders || {})
  const controller = new AbortController()
  let didTimeout = false
  const timeoutId = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  if (skipAuth !== true && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-cache')
  }

  if (!headers.has('Pragma')) {
    headers.set('Pragma', 'no-cache')
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      credentials: fetchOptions.credentials || 'include',
      cache: fetchOptions.cache || 'no-store',
      body,
      headers,
      signal: fetchOptions.signal || controller.signal,
    })

    if (response.status === 401 && retryCount === 0 && refreshToken) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        return requestBlob(path, options, retryCount + 1)
      }
    }

    if (response.status === 401) {
      sessionExpiredHandler?.()
    }

    if (response.status === 304) {
      return null
    }

    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`)
      error.status = response.status
      error.body = await safeParseJson(response)
      throw error
    }

    const blob = await response.blob()

    return {
      blob,
      contentType: response.headers.get('content-type') || blob.type || '',
      fileName: parseFileNameFromContentDisposition(response.headers.get('content-disposition')),
    }
  } catch (error) {
    if (didTimeout || error?.name === 'AbortError') {
      const timeoutError = new Error('Request timed out. Please try again.')
      timeoutError.status = 408
      throw timeoutError
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export { request }
