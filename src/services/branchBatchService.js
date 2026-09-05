import { request } from './apiClient'

function normalizeText(value = '') {
  return String(value ?? '').trim()
}

function normalizeStatus(value = '') {
  const text = normalizeText(value)
  if (!text) return 'Active'
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

function normalizeBatchRow(row = {}) {
  return {
    id: normalizeText(row.id || row.batchId),
    batchId: normalizeText(row.batchId),
    batchName: normalizeText(row.batchName),
    startTime: normalizeText(row.startTime),
    startPeriod: normalizeText(row.startPeriod || 'AM').toUpperCase() || 'AM',
    endTime: normalizeText(row.endTime),
    endPeriod: normalizeText(row.endPeriod || 'AM').toUpperCase() || 'AM',
    batchTiming: normalizeText(row.batchTiming),
    totalSeats: Number(row.totalSeats || 0),
    status: normalizeStatus(row.status || 'Active'),
    sequenceNo: Number(row.sequenceNo || 0),
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  }
}

function normalizeBranchBatchGroup(group = {}) {
  const sourceBatches = Array.isArray(group.batches || group.rows)
    ? (group.batches || group.rows)
    : group.batchId || group.batchName
      ? [group]
      : []
  const batches = sourceBatches.map(normalizeBatchRow)

  return {
    id: normalizeText(group.id || group.batchId),
    batchId: normalizeText(group.batchId || batches[0]?.batchId),
    branchId: normalizeText(group.branchId),
    branchCourseId: normalizeText(group.branchCourseId),
    branchFacultyId: normalizeText(group.branchFacultyId),
    courseId: normalizeText(group.courseId || group.branchCourseId),
    courseName: normalizeText(group.courseName),
    courseCode: normalizeText(group.courseCode),
    facultyId: normalizeText(group.facultyId || group.branchFacultyId),
    facultyName: normalizeText(group.facultyName),
    facultyEmail: normalizeText(group.facultyEmail),
    batchCount: Number(group.batchCount || batches.length || 0),
    status: normalizeStatus(group.status || batches[0]?.status || 'Active'),
    batches,
    createdAt: group.createdAt || '',
    updatedAt: group.updatedAt || '',
  }
}

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

function buildQueryString(query = {}) {
  const params = new URLSearchParams()

  Object.entries(query || {}).forEach(([key, value]) => {
    const text = normalizeText(value)
    if (text) params.set(key, text)
  })

  return params.toString()
}

export async function listBranchBatches(query = {}) {
  const search = buildQueryString(query)
  const response = await request(`/branch-batches${search ? `?${search}` : ''}`, {
    method: 'GET',
  })

  const payload = unwrapData(response)
  const groups = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []

  return {
    data: groups.map(normalizeBranchBatchGroup),
    meta: payload?.meta || null,
  }
}

export async function getBranchBatch(batchGroupId) {
  const response = await request(`/branch-batches/${encodeURIComponent(String(batchGroupId || ''))}`, {
    method: 'GET',
  })

  const payload = unwrapData(response)
  return normalizeBranchBatchGroup(payload?.data || payload)
}

export async function createBranchBatch(payload = {}) {
  const response = await request('/branch-batches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const normalized = unwrapData(response)
  return normalizeBranchBatchGroup(normalized?.data || normalized)
}

export async function updateBranchBatch(batchGroupId, payload = {}) {
  const response = await request(`/branch-batches/${encodeURIComponent(String(batchGroupId || ''))}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  const normalized = unwrapData(response)
  return normalizeBranchBatchGroup(normalized?.data || normalized)
}

export async function deleteBranchBatch(batchGroupId) {
  const response = await request(`/branch-batches/${encodeURIComponent(String(batchGroupId || ''))}`, {
    method: 'DELETE',
  })

  const normalized = unwrapData(response)
  return normalizeBranchBatchGroup(normalized?.data || normalized)
}
