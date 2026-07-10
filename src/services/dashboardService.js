import { request } from './apiClient'

export async function getRevenueSummary() {
  const response = await request('/dashboard/revenue-summary')
  return response?.data ?? response ?? null
}
