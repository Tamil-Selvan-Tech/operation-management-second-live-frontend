import { request } from './apiClient'

export async function getRevenueSummary() {
  const response = await request('/dashboard/revenue-summary')
  return response?.data ?? response ?? null
}

export async function getFacultyMyBatchesSummary() {
  const response = await request('/dashboard/faculty/my-batches-summary')
  return response?.data ?? response ?? null
}
