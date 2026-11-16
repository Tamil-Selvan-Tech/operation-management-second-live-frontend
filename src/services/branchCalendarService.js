import { request } from './apiClient'

export async function getBranchCalendar({ from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const response = await request(`/branch-calendar?${params.toString()}`)
  return response?.data ?? response ?? {}
}
