import { loadStudentSnapshot, saveStudentSnapshot } from '../lib/studentSnapshot'

export const STUDENT_STORAGE_KEY = 'cispro.student-management.records'

function clearLegacyStudentRecords() {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(STUDENT_STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
}

export function loadStudentRecords() {
  clearLegacyStudentRecords()
  return loadStudentSnapshot()
}

export function saveStudentRecords(records) {
  clearLegacyStudentRecords()
  saveStudentSnapshot(records)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cispro:students-changed'))
  }
}
