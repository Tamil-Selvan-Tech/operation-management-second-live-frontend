import { request } from './apiClient'

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

function buildFallbackBatchAttendanceResponse(payload = {}) {
  const students = Array.isArray(payload?.students)
    ? payload.students.map((student) => {
        const status = String(student?.status || '').trim().toUpperCase()
        const attendanceStatus = status === 'PRESENT' ? 'Present' : status === 'ABSENT' ? 'Absent' : 'Unmarked'

        return {
          ...student,
          studentId: String(student?.studentId || '').trim(),
          attendanceStatus,
          attendanceStatusLabel: attendanceStatus,
        }
      })
    : []

  const batchName = String(payload?.batchName || '').trim()
  const courseId = String(payload?.courseId || '').trim()

  return {
    date: String(payload?.date || '').trim(),
    facultyId: String(payload?.facultyId || '').trim(),
    courseId,
    batchName,
    submissionMode: String(payload?.submissionMode || '').trim(),
    submittedAt: String(payload?.submittedAt || '').trim(),
    students,
    batches: [
      {
        courseId,
        batchName,
        students,
      },
    ],
  }
}

function buildFallbackFacultySessionResponse(payload = {}, includeLogout = false) {
  const loginAt = String(payload?.loginAt || new Date().toISOString()).trim()
  const logoutAt = includeLogout ? String(payload?.logoutAt || new Date().toISOString()).trim() : ''

  return {
    date: String(payload?.date || '').trim(),
    facultyId: String(payload?.facultyId || '').trim(),
    facultySession: {
      sessions: [
        {
          loginAt,
          logoutAt: logoutAt || null,
          logoutType: String(payload?.logoutType || 'normal').trim().toLowerCase() || 'normal',
          logoutReason: String(payload?.logoutReason || '').trim(),
          workReport: String(payload?.workReport || '').trim(),
          workCompleted: String(payload?.workCompleted || '').trim(),
        },
      ],
    },
  }
}

function buildAttendanceQuery(options = {}) {
  const params = new URLSearchParams()
  const date = String(options?.date || '').trim()
  const facultyId = String(options?.facultyId || '').trim()
  const studentId = String(options?.studentId || '').trim()
  const from = String(options?.from || options?.startDate || '').trim()
  const to = String(options?.to || options?.endDate || '').trim()
  const batchId = String(options?.batchId || '').trim()
  const courseId = String(options?.courseId || '').trim()

  if (date) {
    params.set('date', date)
  }

  if (facultyId) {
    params.set('facultyId', facultyId)
  }

  if (studentId) {
    params.set('studentId', studentId)
  }

  if (from) {
    params.set('from', from)
  }

  if (to) {
    params.set('to', to)
  }

  if (batchId) {
    params.set('batchId', batchId)
  }

  if (courseId) {
    params.set('courseId', courseId)
  }

  return params
}

export async function getCurrentFacultyAttendanceOverview(dateOrOptions = '') {
  const options =
    typeof dateOrOptions === 'object' && dateOrOptions !== null
      ? dateOrOptions
      : { date: dateOrOptions }
  const params = buildAttendanceQuery(options)
  const response = await request(`/attendance/faculty/overview${params.toString() ? `?${params.toString()}` : ''}`, {
  })
  return unwrapData(response)
}

export async function markFacultyStudentAttendance(payload = {}) {
  try {
    const response = await request('/attendance/faculty/mark', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    return unwrapData(response)
  } catch (error) {
    const errorMessage = String(error?.body?.message || error?.message || '').toLowerCase()
    if (errorMessage.includes('upsert')) {
      return buildFallbackBatchAttendanceResponse(payload)
    }

    throw error
  }
}

export async function recordFacultyAttendanceLogin(payload = {}) {
  try {
    const response = await request('/attendance/faculty/session/login', {
      method: 'POST',
      body: JSON.stringify({
        date: String(payload?.date || '').trim(),
        facultyId: String(payload?.facultyId || '').trim(),
        facultyName: String(payload?.facultyName || '').trim(),
        profileInitials: String(payload?.profileInitials || '').trim(),
        loginAt: String(payload?.loginAt || '').trim(),
        loginTimestamp: Number(payload?.loginTimestamp || Date.now()) || Date.now(),
        role: 'faculty',
        source: 'faculty-dashboard',
      }),
    })

    return unwrapData(response)
  } catch (error) {
    const status = Number(error?.status || 0) || 0
    if (!status) {
      return buildFallbackFacultySessionResponse(payload, false)
    }

    throw error
  }
}

export async function recordFacultyAttendanceLogout(payload = {}) {
  try {
    const response = await request('/attendance/faculty/session/logout', {
      method: 'POST',
      body: JSON.stringify({
        date: String(payload?.date || '').trim(),
        facultyId: String(payload?.facultyId || '').trim(),
        facultyName: String(payload?.facultyName || '').trim(),
        profileInitials: String(payload?.profileInitials || '').trim(),
        loginAt: String(payload?.loginAt || '').trim(),
        loginTimestamp: Number(payload?.loginTimestamp || 0) || undefined,
        logoutType: String(payload?.logoutType || 'normal').trim() || 'normal',
        logoutReason: String(payload?.logoutReason || '').trim(),
        workReport: String(payload?.workReport || '').trim(),
        workCompleted: String(payload?.workCompleted || '').trim(),
        logoutAt: String(payload?.logoutAt || '').trim(),
        logoutTimestamp: Number(payload?.logoutTimestamp || Date.now()) || Date.now(),
        role: 'faculty',
        source: 'faculty-dashboard',
      }),
    })

    return unwrapData(response)
  } catch (error) {
    const status = Number(error?.status || 0) || 0
    if (!status) {
      return buildFallbackFacultySessionResponse(payload, true)
    }

    throw error
  }
}

export async function getCurrentStudentAttendanceOverview(date = '') {
  const params = new URLSearchParams()
  if (String(date || '').trim()) {
    params.set('date', String(date).trim())
  }

  const response = await request(`/attendance/student/me${params.toString() ? `?${params.toString()}` : ''}`)
  return unwrapData(response)
}

function extractAttendanceListPayload(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.records)) return payload.records
  if (Array.isArray(payload?.attendance)) return payload.attendance
  if (Array.isArray(payload?.attendanceRecords)) return payload.attendanceRecords
  if (Array.isArray(payload?.days)) return payload.days
  if (payload?.data && typeof payload.data === 'object') {
    return extractAttendanceListPayload(payload.data)
  }
  if (payload?.history && typeof payload.history === 'object') {
    return extractAttendanceListPayload(payload.history)
  }

  return []
}

function normalizeStudentAttendanceEntry(entry = {}) {
  const dateKey =
    String(entry?.dateKey || entry?.date || entry?.attendanceDate || entry?.day || '').trim() ||
    ''

  if (!dateKey) return null

  const rawStatus = String(
    entry?.status ||
      entry?.attendanceStatus ||
      entry?.attendanceStatusLabel ||
      entry?.result ||
      '',
  ).trim().toLowerCase()

  const status =
    rawStatus === 'present'
      ? 'Present'
      : rawStatus === 'absent'
        ? 'Absent'
        : rawStatus === 'unmarked'
          ? 'Unmarked'
          : ''

  return {
    dateKey,
    status,
    updatedAt: Number(entry?.updatedAt || entry?.timestamp || entry?.createdAt || 0) || 0,
  }
}

async function tryGetStudentAttendanceHistory(path, query = {}) {
  const params = buildAttendanceQuery(query)
  const response = await request(`${path}${params.toString() ? `?${params.toString()}` : ''}`)
  return extractAttendanceListPayload(unwrapData(response)).map(normalizeStudentAttendanceEntry).filter(Boolean)
}

export async function getCurrentStudentAttendanceHistory(query = {}) {
  const attempts = [
    '/attendance/student/me/history',
    '/attendance/student/history',
    '/attendance/student/me/records',
    '/attendance/student/me',
  ]

  for (const path of attempts) {
    try {
      const entries = await tryGetStudentAttendanceHistory(path, query)
      if (entries.length) {
        return entries
      }
    } catch (error) {
      const status = Number(error?.status || 0) || 0
      if (status && status !== 404 && status !== 405) {
        throw error
      }
    }
  }

  return []
}
