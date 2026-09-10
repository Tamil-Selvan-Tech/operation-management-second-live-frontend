const STORAGE_KEY = 'cispro.student.calendar-summary'

function keysFor(student = {}) {
  const identifiers = [
    student?.studentId,
    student?.id,
    student?._id,
    student?.studentCode,
    student?.emailAddress,
    student?.email,
    student?.mobileNumber,
    student?.phoneNumber,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  const name = String(student?.studentName || student?.name || '').trim().toLowerCase()
  return [...new Set([...identifiers, ...(name ? [`name:${name}`] : [])])]
}

function readState() {
  if (typeof window === 'undefined') return {}
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

export function saveStudentCalendarSummary(student, summary = {}) {
  const keys = keysFor(student)
  if (!keys.length || !summary || typeof summary !== 'object') return
  try {
    const next = { ...readState() }
    keys.forEach((key) => { next[key] = summary })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('cispro:student-calendar-summary-changed'))
  } catch {
    // Keep the dashboard usable when browser storage is unavailable.
  }
}

export function getStudentCalendarSummary(student = {}) {
  const state = readState()
  return keysFor(student).map((key) => state[key]).find(Boolean) || null
}
