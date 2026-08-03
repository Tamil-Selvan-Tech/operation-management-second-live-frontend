import { normalizeFacultyRecord } from '../services/facultyService'

const FACULTY_SNAPSHOT_KEY = 'cispro.faculty-management.snapshot'

function getStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function loadFacultySnapshot() {
  try {
    const storage = getStorage()
    if (!storage) return null

    const raw = storage.getItem(FACULTY_SNAPSHOT_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    return normalizeFacultyRecord(parsed)
  } catch {
    return null
  }
}

export function saveFacultySnapshot(record) {
  try {
    const storage = getStorage()
    if (!storage) return

    if (!record) {
      storage.removeItem(FACULTY_SNAPSHOT_KEY)
      return
    }

    storage.setItem(FACULTY_SNAPSHOT_KEY, JSON.stringify(record))
  } catch {
    // Ignore storage failures so the dashboard still works.
  }
}

export function clearFacultySnapshot() {
  try {
    const storage = getStorage()
    if (!storage) return
    storage.removeItem(FACULTY_SNAPSHOT_KEY)
  } catch {
    // Ignore storage failures so the dashboard still works.
  }
}

function normalizeKey(record = {}) {
  return {
    id: String(record?.id || record?._id || record?.facultyId || '').trim().toLowerCase(),
    email: String(record?.facultyEmail || '').trim().toLowerCase(),
    name: String(record?.facultyName || '').trim().toLowerCase(),
  }
}

function isSameFaculty(left = {}, right = {}) {
  const leftKey = normalizeKey(left)
  const rightKey = normalizeKey(right)

  return Boolean(
    (leftKey.id && leftKey.id === rightKey.id) ||
      (leftKey.email && leftKey.email === rightKey.email) ||
      (leftKey.name && leftKey.name === rightKey.name),
  )
}

function pickPreferredArray(primary = [], fallback = []) {
  return Array.isArray(primary) && primary.length ? primary : Array.isArray(fallback) ? fallback : []
}

export function mergeFacultyWithSnapshot(record) {
  const snapshot = loadFacultySnapshot()
  if (!snapshot || !record || !isSameFaculty(record, snapshot)) {
    return record
  }

  return normalizeFacultyRecord({
    ...snapshot,
    ...record,
    courseId: record.courseId || snapshot.courseId || '',
    courseIds: pickPreferredArray(snapshot.courseIds, record.courseIds),
    courseAssignments:
      pickPreferredArray(snapshot.courseAssignments, record.courseAssignments),
    batchEntries:
      pickPreferredArray(snapshot.batchEntries, record.batchEntries),
    batchCount: Number(record.batchCount || snapshot.batchCount || 0) || 0,
  })
}
