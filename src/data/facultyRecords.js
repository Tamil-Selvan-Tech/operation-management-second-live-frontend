export const FACULTY_STORAGE_KEY = 'cispro.faculty-management.records'
export const FACULTY_RECORD_SYNC_EVENT = 'cispro:faculty-changed'

export function loadFacultyRecords() {
  try {
    if (typeof window === 'undefined') return []
    const parsed = JSON.parse(window.localStorage.getItem(FACULTY_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFacultyRecords(records) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(FACULTY_STORAGE_KEY, JSON.stringify(Array.isArray(records) ? records : []))
    window.dispatchEvent(new CustomEvent(FACULTY_RECORD_SYNC_EVENT))
  } catch {
    // ignore storage errors
  }
}
