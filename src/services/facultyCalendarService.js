import { request } from './apiClient'

const facultyCalendarInflight = new Map()

async function requestFacultyCalendarData(key, path) {
  if (facultyCalendarInflight.has(key)) return facultyCalendarInflight.get(key)
  const pending = request(path)
  facultyCalendarInflight.set(key, pending)
  try { return await pending } finally { facultyCalendarInflight.delete(key) }
}

function unwrap(response) {
  return response?.data ?? response ?? {}
}

export async function getFacultyCalendar({ startDate, endDate } = {}) {
  const params = new URLSearchParams()
  if (startDate) params.set('from', startDate)
  if (endDate) params.set('to', endDate)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  const path = `/institute-leaves/faculty-calendar${suffix}`
  const response = await requestFacultyCalendarData(path, path)
  return unwrap(response)
}

export async function getFacultyLeaveRequests() {
  const response = await requestFacultyCalendarData('faculty-leave-requests-me', '/faculty-leave-requests/me')
  const data = unwrap(response)
  return Array.isArray(data) ? data : data?.requests || []
}

export async function getFacultyTemporaryBatches() {
  const response = await requestFacultyCalendarData('faculty-temporary-batches', '/faculty-leave-requests/me/temporary-batches')
  return response?.data?.batches || response?.batches || []
}

export async function getTemporaryBatchStudents(sessionId) {
  const response = await request(`/faculty-leave-requests/me/temporary-batches/${encodeURIComponent(sessionId)}/students`)
  return response?.data || response || { session: null, students: [] }
}
