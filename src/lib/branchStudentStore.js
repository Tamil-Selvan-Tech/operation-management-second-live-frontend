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

function normalizeBranchScope(branchScope) {
  const values = []

  if (!branchScope) {
    return values
  }

  if (Array.isArray(branchScope)) {
    branchScope.forEach((value) => {
      values.push(...normalizeBranchScope(value))
    })
    return [...new Set(values)]
  }

  if (typeof branchScope === 'object') {
    values.push(branchScope.id, branchScope.branchId, branchScope.branchCode)
  } else {
    values.push(branchScope)
  }

  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function getRecordBranchKeys(record = {}) {
  return normalizeBranchScope([
    record.branchId,
    record.branchCode,
    record.branchKey,
  ])
}

function recordMatchesBranchScope(record, branchScope) {
  const scopeKeys = normalizeBranchScope(branchScope)
  if (scopeKeys.length === 0) return true

  const recordKeys = getRecordBranchKeys(record)
  return scopeKeys.some((scopeKey) => recordKeys.includes(scopeKey))
}

function normalizeStoredStudentRecord(record = {}) {
  return {
    ...record,
    branchId: String(record.branchId || '').trim(),
    branchCode: String(record.branchCode || record.branchKey || '').trim(),
    studentId: String(record.studentId || '').trim(),
    _fromBackend: Boolean(record._fromBackend),
    _isExistingRecord: Boolean(record._isExistingRecord),
  }
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

async function findBranchStudentByStudentId(studentId, branchId = '') {
  const search = String(studentId || '').trim()
  if (!search) return null

  const branchScope = String(branchId || '').trim()
  const query = new URLSearchParams({
    page: '1',
    limit: '100',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    search,
  })

  if (branchScope) {
    query.set('branchId', branchScope)
  }

  const response = await request(`/branch-students?${query.toString()}`, {
    method: 'GET',
  })
  const payload = response?.data ?? response
  const records = extractBranchStudentListPayload(payload)

  return records.find((record) => String(record.studentId || '').trim() === search) || null
}

async function syncBranchStudentToBackend(student) {
  const studentId = String(student.studentId || '').trim()
  if (!studentId) return

  const payload = { ...student }
  delete payload.id
  delete payload._fromBackend
  delete payload._isExistingRecord
  delete payload._originalStudentId
  delete payload.originalStudentId
  delete payload.studentIdSuffix
  delete payload._recordId
  delete payload.recordId

  if (student._isExistingRecord) {
    const pathStudentKey = String(
      student._recordId
      || student.recordId
      || student.id
      || student._id
      || student._originalStudentId
      || student.originalStudentId
      || studentId,
    ).trim()

    if (!pathStudentKey) {
      throw new Error('Student record identifier is required for update')
    }

    try {
      const response = await request(`/branch-students/${encodeURIComponent(pathStudentKey)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      return response?.data ?? response
    } catch (error) {
      if (error?.status === 403) {
        return null
      }

      if (error?.status === 404) {
        const backendMatch = await findBranchStudentByStudentId(studentId, payload.branchId || payload.branchCode || '')
        if (backendMatch?.id && String(backendMatch.id).trim() !== pathStudentKey) {
          const retryResponse = await request(`/branch-students/${encodeURIComponent(String(backendMatch.id).trim())}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })

          return retryResponse?.data ?? retryResponse
        }

        const createResponse = await request('/branch-students', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        return createResponse?.data ?? createResponse
      }

      throw error
    }
  }

  try {
    const response = await request('/branch-students', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    return response?.data ?? response
  } catch (error) {
    if (error?.status === 403) {
      return null
    }

    throw error
  }
}

function resolveStudentDeleteCandidates(studentOrId) {
  const candidates = []

  if (studentOrId && typeof studentOrId === 'object') {
    candidates.push(
      studentOrId.id,
      studentOrId._id,
      studentOrId.recordId,
      studentOrId._recordId,
      studentOrId.studentId,
      studentOrId.originalStudentId,
      studentOrId._originalStudentId,
    )
  } else {
    candidates.push(studentOrId)
  }

  return [...new Set(candidates.map((value) => String(value || '').trim()).filter(Boolean))]
}

function removeStudentFromLocalCache(studentOrId, deletedStudentId = '') {
  const all = readAll()
  const candidates = resolveStudentDeleteCandidates(studentOrId)
  const normalizedDeletedStudentId = String(deletedStudentId || '').trim()
  const next = all.filter((record) => {
    const recordCandidates = [
      record.id,
      record._id,
      record.recordId,
      record._recordId,
      record.studentId,
      record.originalStudentId,
      record._originalStudentId,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean)

    if (candidates.some((candidate) => recordCandidates.includes(candidate))) {
      return false
    }

    if (normalizedDeletedStudentId && String(record.studentId || '').trim() === normalizedDeletedStudentId) {
      return false
    }

    return true
  })

  writeAll(next)
  dispatchChange()
}

export async function refreshBranchStudents(branchId) {
  const branchScopeKeys = normalizeBranchScope(branchId)
  if (branchScopeKeys.length === 0) return []

  let records

  try {
    const response = await request(`/branch-students?page=1&limit=100&sortBy=createdAt&sortOrder=desc&branchId=${encodeURIComponent(branchScopeKeys[0])}`, {
      method: 'GET',
    })
    const payload = response?.data ?? response
    records = extractBranchStudentListPayload(payload).map((record) => normalizeStoredStudentRecord({
      ...record,
      _fromBackend: true,
      _isExistingRecord: true,
    }))
  } catch (error) {
    if (error?.status !== 403) {
      throw error
    }

    records = loadBranchStudents(branchScopeKeys)
  }

  const all = readAll()
  const remaining = all.filter((record) => !recordMatchesBranchScope(record, branchScopeKeys))
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
  const branchStudents = normalizeBranchScope(branchId).length > 0
    ? all.filter((s) => recordMatchesBranchScope(s, branchId))
    : all

  let highest = 0
  branchStudents.forEach((s) => {
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
  const normalizedScope = normalizeBranchScope(branchId)
  if (normalizedScope.length === 0) return all.map(normalizeStoredStudentRecord)
  return all
    .filter((s) => recordMatchesBranchScope(s, normalizedScope))
    .map(normalizeStoredStudentRecord)
}

/**
 * Save (add or update) a student record.
 */
export async function saveBranchStudent(student) {
  const all = readAll()
  const studentId = String(student.studentId || '').trim()
  const originalStudentId = String(student._originalStudentId || student.originalStudentId || studentId).trim()
  const recordId = String(student._recordId || student.recordId || student.id || '').trim()
  const existingIndex = all.findIndex(
    (s) => String(s.studentId || '').trim() === originalStudentId
  )
  const existingStudent = existingIndex >= 0 ? all[existingIndex] : null
  const nextStudent = existingStudent
    ? {
        ...existingStudent,
        ...student,
        id: recordId || existingStudent.id || existingStudent._id || existingStudent.recordId || '',
        _recordId: recordId || existingStudent.id || existingStudent._id || existingStudent.recordId || '',
        _isExistingRecord: true,
      }
    : { ...student, _isExistingRecord: false }

  const backendRecord = await syncBranchStudentToBackend(nextStudent)
  const resolvedRecordId = String(
    recordId
    || backendRecord?.id
    || backendRecord?._id
    || backendRecord?.recordId
    || nextStudent._recordId
    || nextStudent.id
    || nextStudent._id
    || nextStudent.recordId
    || ''
  ).trim()
  const resolvedStudentId = String(
    student.studentId
    || backendRecord?.studentId
    || nextStudent.studentId
    || ''
  ).trim()
  const savedRecord = normalizeStoredStudentRecord({
    ...(backendRecord || nextStudent),
    id: resolvedRecordId,
    _id: resolvedRecordId,
    recordId: resolvedRecordId,
    _recordId: resolvedRecordId,
    studentId: resolvedStudentId,
    branchCode: nextStudent.branchCode || nextStudent.branchId || '',
    _fromBackend: true,
    _isExistingRecord: true,
  })
  const updatedAll = readAll()
  const cleaned = updatedAll.filter((record) => String(record.studentId || '').trim() !== originalStudentId)
  writeAll([savedRecord, ...cleaned])
  dispatchChange()
  return savedRecord
}

/**
 * Delete a student record by studentId.
 */
export async function deleteBranchStudent(studentOrId, branchScopeInput = '') {
  const candidates = resolveStudentDeleteCandidates(studentOrId)
  const studentKey = candidates[0] || ''
  const studentId = studentOrId && typeof studentOrId === 'object'
    ? String(studentOrId.studentId || studentOrId.originalStudentId || studentOrId._originalStudentId || '').trim()
    : String(studentKey || '').trim()

  if (!studentKey && !studentId) {
    throw new Error('Student identifier is required for delete')
  }

  let lastError = null
  const requestCandidates = [...candidates]

  if (studentId && !requestCandidates.includes(studentId)) {
    requestCandidates.push(studentId)
  }

  if (studentOrId && typeof studentOrId === 'object') {
    const branchScope = String(
      branchScopeInput ||
      studentOrId.branchId ||
      studentOrId.branchCode ||
      '',
    ).trim()
    if (studentId && branchScope) {
      try {
        const backendMatch = await findBranchStudentByStudentId(studentId, branchScope)
        const backendMatchId = String(backendMatch?.id || '').trim()
        if (backendMatchId && !requestCandidates.includes(backendMatchId)) {
          requestCandidates.push(backendMatchId)
        }
      } catch {
        // Ignore lookup errors and fall back to the explicit candidates.
      }
    }
  }

  for (const candidate of requestCandidates) {
    const deletePaths = [
      `/branch-students/${encodeURIComponent(candidate)}`,
      `/students/${encodeURIComponent(candidate)}`,
    ]

    for (const path of deletePaths) {
      try {
        await request(path, {
          method: 'DELETE',
        })
        removeStudentFromLocalCache(studentOrId, studentId)
        return
      } catch (error) {
        lastError = error
        if (error?.status === 403 || error?.status === 404) {
          continue
        }
      }
    }
  }

  if (lastError?.status === 403 || lastError?.status === 404) {
    removeStudentFromLocalCache(studentOrId, studentId)
    return
  }

  if (lastError) {
    throw lastError
  }
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
    const bid = String(s.branchId || s.branchCode || '').trim()
    if (!bid) return
    counts[bid] = (counts[bid] || 0) + 1
  })
  return counts
}
