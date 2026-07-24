import { normalizeStudentList } from '../services/studentService'

const STUDENT_SNAPSHOT_KEY = 'cispro.student-management.snapshot'

function getStorage() {
  if (typeof window === 'undefined') return null
  return window.sessionStorage
}

function getStudentIdentityKey(student = {}) {
  return (
    String(student?.id || '').trim().toLowerCase() ||
    String(student?.emailAddress || '').trim().toLowerCase() ||
    String(student?.mobileNumber || '').trim().toLowerCase() ||
    String(student?.studentCode || '').trim().toLowerCase()
  )
}

function dedupeStudents(students = []) {
  const seen = new Set()
  const nextStudents = []

  students.forEach((student) => {
    const key = getStudentIdentityKey(student)
    if (!key || seen.has(key)) return
    seen.add(key)
    nextStudents.push(student)
  })

  return nextStudents
}

export function loadStudentSnapshot() {
  try {
    const storage = getStorage()
    if (!storage) return []

    const raw = storage.getItem(STUDENT_SNAPSHOT_KEY)
    if (!raw) return []

    return dedupeStudents(normalizeStudentList(JSON.parse(raw)))
  } catch {
    return []
  }
}

export function saveStudentSnapshot(records) {
  try {
    const storage = getStorage()
    if (!storage) return

    const normalized = dedupeStudents(normalizeStudentList(records))
    if (!normalized.length) {
      return
    }

    storage.setItem(STUDENT_SNAPSHOT_KEY, JSON.stringify(normalized))
  } catch {
    // Ignore storage failures so the faculty pages can still render.
  }
}

export function mergeStudentsWithSnapshot(records) {
  const normalized = dedupeStudents(normalizeStudentList(records))
  if (normalized.length) {
    saveStudentSnapshot(normalized)
    return normalized
  }

  return loadStudentSnapshot()
}
