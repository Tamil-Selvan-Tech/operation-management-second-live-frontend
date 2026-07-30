import { request } from './apiClient'

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

function buildAttendanceQuery(options = {}) {
  const params = new URLSearchParams()
  const date = String(options?.date || '').trim()
  const facultyId = String(options?.facultyId || '').trim()

  if (date) {
    params.set('date', date)
  }

  if (facultyId) {
    params.set('facultyId', facultyId)
  }

  return params
}

export async function getCurrentFacultyAttendanceOverview(dateOrOptions = '') {
  const options =
    typeof dateOrOptions === 'object' && dateOrOptions !== null
      ? dateOrOptions
      : { date: dateOrOptions }
  const params = buildAttendanceQuery(options)
  const response = await request(`/attendance/faculty/overview${params.toString() ? `?${params.toString()}` : ''}`)
  return unwrapData(response)
}

export async function markFacultyStudentAttendance(payload = {}) {
  const response = await request('/attendance/faculty/mark', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return unwrapData(response)
}

export async function recordFacultyAttendanceLogin(payload = {}) {
  const response = await request('/attendance/faculty/session/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return unwrapData(response)
}

export async function recordFacultyAttendanceLogout(payload = {}) {
  const response = await request('/attendance/faculty/session/logout', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return unwrapData(response)
}

export async function getCurrentStudentAttendanceOverview(date = '') {
  const params = new URLSearchParams()
  if (String(date || '').trim()) {
    params.set('date', String(date).trim())
  }

  const response = await request(`/attendance/student/me${params.toString() ? `?${params.toString()}` : ''}`)
  return unwrapData(response)
}
