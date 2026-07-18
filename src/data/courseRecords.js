export const COURSE_STORAGE_KEY = 'cispro.course-management.records'
export const COURSE_RECORD_SYNC_EVENT = 'cispro:courses-changed'

function clearLegacyCourseRecords() {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(COURSE_STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
}

export function loadCourseRecords() {
  clearLegacyCourseRecords()
  return []
}

export function saveCourseRecords(records) {
  clearLegacyCourseRecords()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COURSE_RECORD_SYNC_EVENT))
  }
}
