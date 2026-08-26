const FACULTY_TODAY_WORK_KEY = 'cispro.faculty-today-work'
export const FACULTY_TODAY_WORK_SYNC_EVENT = 'cispro:faculty-today-work-changed'

function isBrowser() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readAll() {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(FACULTY_TODAY_WORK_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(records) {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(FACULTY_TODAY_WORK_KEY, JSON.stringify(records))
  } catch {
    // ignore storage errors
  }
}

function dispatchChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FACULTY_TODAY_WORK_SYNC_EVENT))
  }
}

function normalizeId(value) {
  return String(value || '').trim()
}

export function listFacultyTodayWorkEntries() {
  return readAll()
}

export function saveFacultyTodayWorkEntry(entry = {}) {
  const nextEntry = {
    ...entry,
    id: normalizeId(entry.id) || `today-work-${Date.now()}`,
    facultyId: normalizeId(entry.facultyId),
    facultyName: String(entry.facultyName || '').trim(),
    facultyEmail: String(entry.facultyEmail || '').trim(),
    courseId: normalizeId(entry.courseId),
    courseName: String(entry.courseName || '').trim(),
    moduleId: normalizeId(entry.moduleId),
    moduleName: String(entry.moduleName || '').trim(),
    createdAt: String(entry.createdAt || new Date().toISOString()).trim(),
  }

  const records = readAll()
  const nextRecords = [
    nextEntry,
    ...records.filter((record) => String(record?.id || '').trim() !== nextEntry.id),
  ]

  writeAll(nextRecords)
  dispatchChange()

  return nextEntry
}

export function clearFacultyTodayWorkEntries() {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(FACULTY_TODAY_WORK_KEY)
    dispatchChange()
  } catch {
    // ignore storage errors
  }
}

