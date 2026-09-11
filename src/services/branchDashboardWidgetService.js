import { request } from './apiClient'

export async function getBranchDashboardWidgets() {
  const response = await request('/dashboard/branch/widgets')
  return response?.data ?? response ?? []
}

export async function saveBranchDashboardWidgets(widgets) {
  const response = await request('/dashboard/branch/widgets', { method: 'PUT', body: JSON.stringify({ widgets }) })
  return response?.data ?? response ?? []
}

export async function resetBranchDashboardWidgets() {
  const response = await request('/dashboard/branch/widgets/reset', { method: 'POST' })
  return response?.data ?? response ?? []
}
