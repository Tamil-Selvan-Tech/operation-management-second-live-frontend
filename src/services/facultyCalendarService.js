import { request } from './apiClient'

function unwrap(response) {
  return response?.data ?? response ?? {}
}

export async function getFacultyCalendar({ startDate, endDate } = {}) {
  const params = new URLSearchParams()
  if (startDate) params.set('from', startDate)
  if (endDate) params.set('to', endDate)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  const response = await request(`/institute-leaves/faculty-calendar${suffix}`)
  return unwrap(response)
}

export async function getFacultyLeaveRequests() {
  const response = await request('/faculty-leave-requests/me')
  const data = unwrap(response)
  return Array.isArray(data) ? data : data?.requests || []
}

export async function getFacultyTemporaryBatches() {
  const response = await request('/faculty-leave-requests/me/temporary-batches')
  return response?.data?.batches || response?.batches || []
}

export async function getTemporaryBatchStudents(sessionId) {
  const response = await request(`/faculty-leave-requests/me/temporary-batches/${encodeURIComponent(sessionId)}/students`)
  return response?.data || response || { session: null, students: [] }
}
