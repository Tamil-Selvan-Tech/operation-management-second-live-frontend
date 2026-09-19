import { request } from './apiClient'

function unwrap(response) {
  return response?.data ?? response ?? {}
}

function rows(response) {
  const data = unwrap(response)
  return Array.isArray(data) ? data : data?.requests || data?.weekOffRequests || []
}

export async function createWeekOffRequest(payload) {
  return unwrap(await request('/faculty-week-off-requests', { method: 'POST', body: JSON.stringify(payload) }))
}

export async function getMyWeekOffRequests() {
  return rows(await request('/faculty-week-off-requests/me'))
}

export async function getBranchWeekOffRequests() {
  return rows(await request('/faculty-week-off-requests/branch'))
}

export async function getWeekOffRequestById(id) {
  return unwrap(await request(`/faculty-week-off-requests/${encodeURIComponent(id)}`))
}

export async function approveWeekOffRequest(id) {
  return unwrap(await request(`/faculty-week-off-requests/${encodeURIComponent(id)}/approve`, { method: 'PATCH' }))
}

export async function rejectWeekOffRequest(id, rejectionReason) {
  return unwrap(await request(`/faculty-week-off-requests/${encodeURIComponent(id)}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ rejectionReason }),
  }))
}

