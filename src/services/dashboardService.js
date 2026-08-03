import { request } from './apiClient'

const DASHBOARD_CACHE_TTL_MS = Number(import.meta.env.VITE_DASHBOARD_CACHE_TTL_MS || 30000)
const dashboardCache = new Map()
const dashboardInflight = new Map()

function getCachedValue(key) {
  const entry = dashboardCache.get(key)
  if (!entry) return null

  if (Date.now() - entry.timestamp > DASHBOARD_CACHE_TTL_MS) {
    dashboardCache.delete(key)
    return null
  }

  return entry.value
}

function setCachedValue(key, value) {
  dashboardCache.set(key, {
    timestamp: Date.now(),
    value,
  })
}

async function getCachedDashboardValue(key, path) {
  const cached = getCachedValue(key)
  if (cached) {
    return cached
  }

  if (dashboardInflight.has(key)) {
    return dashboardInflight.get(key)
  }

  const pending = request(path).then((response) => {
    const value = response?.data ?? response ?? null
    setCachedValue(key, value)
    return value
  })

  dashboardInflight.set(key, pending)

  try {
    return await pending
  } finally {
    dashboardInflight.delete(key)
  }
}

export async function getRevenueSummary() {
  return getCachedDashboardValue('revenue-summary', '/dashboard/revenue-summary')
}

export async function getRevenueInsights() {
  return getCachedDashboardValue('revenue-insights', '/dashboard/revenue-insights')
}

export async function getFacultyMyBatchesSummary() {
  return getCachedDashboardValue('faculty-my-batches-summary', '/dashboard/faculty/my-batches-summary')
}
