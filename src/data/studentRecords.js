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
