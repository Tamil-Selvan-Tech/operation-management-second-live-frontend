import { normalizeStudentList } from '../services/studentService'

const STUDENT_SNAPSHOT_KEY = 'cispro.student-management.snapshot'

function getSessionStorage() {
  if (typeof window === 'undefined') return null
  return window.sessionStorage
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function getStudentIdentityKey(student = {}) {
  const primaryKey =
    String(student?.id || '').trim().toLowerCase() ||
    String(student?.emailAddress || '').trim().toLowerCase() ||
    String(student?.mobileNumber || '').trim().toLowerCase() ||
    String(student?.studentCode || '').trim().toLowerCase()

  if (primaryKey) return primaryKey

  return [
    student?.studentName,
    student?.courseId,
    student?.facultyId,
    student?.batchId || student?.batchEntryId,
    student?.admissionDate,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')
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
    const localStorageRef = getLocalStorage()
    const sessionStorageRef = getSessionStorage()
    const storages = [localStorageRef, sessionStorageRef].filter(Boolean)

    for (const storage of storages) {
      const raw = storage.getItem(STUDENT_SNAPSHOT_KEY)
      if (!raw) continue

      const parsed = dedupeStudents(normalizeStudentList(JSON.parse(raw)))
      if (parsed.length) {
        if (storage === sessionStorageRef && localStorageRef) {
          localStorageRef.setItem(STUDENT_SNAPSHOT_KEY, JSON.stringify(parsed))
        }
        return parsed
      }
    }

    return []
  } catch {
    return []
  }
}

export function saveStudentSnapshot(records) {
  try {
    const normalized = dedupeStudents(normalizeStudentList(records))
    if (!normalized.length) {
      return
    }

    const payload = JSON.stringify(normalized)
    const storages = [getLocalStorage(), getSessionStorage()].filter(Boolean)

    storages.forEach((storage) => {
      storage.setItem(STUDENT_SNAPSHOT_KEY, payload)
    })
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
