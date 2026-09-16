import { request } from './apiClient'

function unwrap(response) { return response?.data ?? response ?? {} }

export async function listBranchHolidays({ from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await request(`/branch-holidays${query}`)
  return unwrap(response)?.holidays || []
}

export async function createBranchHoliday(payload) {
  return unwrap(await request('/branch-holidays', { method: 'POST', body: JSON.stringify(payload) }))
}

export async function updateBranchHoliday(id, payload) {
  return unwrap(await request(`/branch-holidays/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }))
}

export async function deleteBranchHoliday(id) {
  return unwrap(await request(`/branch-holidays/${encodeURIComponent(id)}`, { method: 'DELETE' }))
}
