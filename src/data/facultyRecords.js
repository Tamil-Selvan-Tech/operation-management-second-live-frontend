import { loadFacultySnapshot, saveFacultySnapshot } from '../lib/facultySnapshot'

export const FACULTY_STORAGE_KEY = 'cispro.faculty-management.records'
export const FACULTY_RECORD_SYNC_EVENT = 'cispro:faculty-changed'

function clearLegacyFacultyRecords() {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(FACULTY_STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
}

export function loadFacultyRecords() {
  clearLegacyFacultyRecords()
  return loadFacultySnapshot()
}

export function saveFacultyRecords(records) {
  clearLegacyFacultyRecords()
  saveFacultySnapshot(records)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FACULTY_RECORD_SYNC_EVENT))
  }
}
