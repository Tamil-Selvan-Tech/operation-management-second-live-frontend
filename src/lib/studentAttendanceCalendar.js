const STORAGE_KEY = 'cispro.student.attendance-calendar'

function normalizeStudentId(value = '') {
  return String(value || '').trim().toLowerCase()
}

function readState() {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeState(state) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent('cispro:student-calendar-attendance-changed'))
  } catch {
    // Keep the dashboard usable if browser storage is unavailable.
  }
}

export function saveStudentCalendarAttendance(dateKey, records = []) {
  const date = String(dateKey || '').trim()
  if (!date) return

  const state = readState()
  const next = { ...state }
  records.forEach((record) => {
    const studentId = normalizeStudentId(record?.studentId || record?.id)
    const status = String(record?.status || record?.attendanceStatus || '').trim().toUpperCase()
    if (!studentId || !['PRESENT', 'ABSENT'].includes(status)) return
    next[studentId] = { ...(next[studentId] || {}), [date]: status === 'PRESENT' ? 'Present' : 'Absent' }
  })
  writeState(next)
}

export function getStudentCalendarAttendance(student = {}) {
  const keys = [student?.studentId, student?.id, student?._id, student?.studentCode]
    .map(normalizeStudentId)
    .filter(Boolean)
  const state = readState()
  return keys.map((key) => state[key]).find((value) => value && typeof value === 'object') || {}
}
