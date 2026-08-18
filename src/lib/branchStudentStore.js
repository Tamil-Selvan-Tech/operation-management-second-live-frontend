/**
 * Branch Student Store
 * localStorage-based store for branch student records.
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

  if (existingIndex >= 0) {
    all[existingIndex] = { ...all[existingIndex], ...student }
  } else {
    all.unshift(student)
  }

  writeAll(all)
  dispatchChange()
  return student
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
