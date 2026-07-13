export const COURSE_STORAGE_KEY = 'cispro.course-management.records'
export const COURSE_RECORD_SYNC_EVENT = 'cispro:courses-changed'

export function loadCourseRecords() {
  try {
    if (typeof window === 'undefined') return []
    const parsed = JSON.parse(window.localStorage.getItem(COURSE_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCourseRecords(records) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(Array.isArray(records) ? records : []))
  } catch {
    // ignore storage errors
  }
}
