export const STUDENT_STORAGE_KEY = 'cispro.student-management.records'

export function loadStudentRecords() {
  try {
    if (typeof window === 'undefined') return []
    const parsed = JSON.parse(window.localStorage.getItem(STUDENT_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStudentRecords(records) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(Array.isArray(records) ? records : []))
    window.dispatchEvent(new CustomEvent('cispro:students-changed'))
  } catch {
    // ignore storage errors
  }
}
