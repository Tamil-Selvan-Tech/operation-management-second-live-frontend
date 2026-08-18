import { request } from '../services/apiClient'

/**
 * Branch Student Store
 * local cache + backend sync for branch student records.
 * Each student record carries a `branchId` so Super Admin can count per branch.
 */

const BRANCH_STUDENTS_KEY = 'cispro.branch-students'

function isBrowser() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readAll() {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(BRANCH_STUDENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(records) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(BRANCH_STUDENTS_KEY, JSON.stringify(records))
  } catch {
    // ignore storage errors
  }
}

function dispatchChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cispro:branch-students-changed'))
  }
}

function extractBranchStudentListPayload(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.records)) return payload.records

  if (payload?.data && typeof payload.data === 'object') {
    return extractBranchStudentListPayload(payload.data)
  }

  return []
}

async function syncBranchStudentToBackend(student) {
  const studentId = String(student.studentId || '').trim()
  if (!studentId) return

  const payload = { ...student }
  delete payload.id
  delete payload._fromBackend
  delete payload._isExistingRecord

  const method = student._isExistingRecord ? 'PATCH' : 'POST'
  const path = method === 'PATCH' ? `/branch-students/${encodeURIComponent(studentId)}` : '/branch-students'

  await request(path, {
    method,
    body: JSON.stringify(payload),
  })
}

export async function refreshBranchStudents(branchId) {
  if (!branchId) return []

  const response = await request(
    `/branch-students?page=1&limit=100&sortBy=createdAt&sortOrder=desc&branchId=${encodeURIComponent(branchId)}`,
  )
  const payload = response?.data ?? response
  const records = extractBranchStudentListPayload(payload).map((record) => ({
    ...record,
    _fromBackend: true,
    _isExistingRecord: true,
  }))

  const all = readAll()
  const remaining = all.filter((record) => String(record.branchId || '').trim() !== String(branchId).trim())
  writeAll([...records, ...remaining])
  dispatchChange()
  return records
}

/**
 * Returns the next auto-generated Student ID for a branch.
 * Format: STU-001, STU-002, ...
 */
export function getNextStudentId(branchId) {
  const all = readAll()
  const branchStudents = branchId
    ? all.filter((s) => String(s.branchId || '').trim() === String(branchId).trim())
    : all

  let highest = 0
  branchStudents.forEach((s) => {
    const match = String(s.studentId || '').match(/^STU-(\d+)$/i)
    if (match) {
      const num = Number(match[1])
      if (Number.isFinite(num) && num > highest) highest = num
    }
  })

  // Also check all records globally to avoid ID collision
  all.forEach((s) => {
    const match = String(s.studentId || '').match(/^STU-(\d+)$/i)
    if (match) {
      const num = Number(match[1])
      if (Number.isFinite(num) && num > highest) highest = num
    }
  })

  return `STU-${String(highest + 1).padStart(3, '0')}`
}

/**
 * Load all students for a specific branch.
 */
export function loadBranchStudents(branchId) {
  const all = readAll()
  if (!branchId) return all
  return all.filter((s) => String(s.branchId || '').trim() === String(branchId).trim())
}

/**
 * Save (add or update) a student record.
 */
export function saveBranchStudent(student) {
  const all = readAll()
  const studentId = String(student.studentId || '').trim()
  const existingIndex = all.findIndex(
    (s) => String(s.studentId || '').trim() === studentId
  )
  const nextStudent = existingIndex >= 0
    ? { ...all[existingIndex], ...student, _isExistingRecord: true }
    : { ...student, _isExistingRecord: false }

  if (existingIndex >= 0) {
    all[existingIndex] = nextStudent
  } else {
    all.unshift(nextStudent)
  }

  writeAll(all)
  dispatchChange()

  return syncBranchStudentToBackend(nextStudent).catch(() => {
    // local cache remains available if backend sync fails temporarily
  })
}

/**
 * Delete a student record by studentId.
 */
export function deleteBranchStudent(studentId) {
  const all = readAll()
  const next = all.filter(
    (s) => String(s.studentId || '').trim() !== String(studentId).trim()
  )
  writeAll(next)
  dispatchChange()

  return request(`/branch-students/${encodeURIComponent(String(studentId).trim())}`, {
    method: 'DELETE',
  }).catch(() => {
    // ignore sync failures; local cache has already been updated
  })
}

/**
 * Count students for a specific branch.
 */
export function countBranchStudents(branchId) {
  return loadBranchStudents(branchId).length
}

/**
 * Returns a map of branchId → student count for all branches.
 */
export function getAllBranchStudentCounts() {
  const all = readAll()
  const counts = {}
  all.forEach((s) => {
    const bid = String(s.branchId || '').trim()
    if (!bid) return
    counts[bid] = (counts[bid] || 0) + 1
  })
  return counts
}
