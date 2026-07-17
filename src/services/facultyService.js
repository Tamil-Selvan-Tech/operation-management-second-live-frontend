import { request } from './apiClient'

const FACULTY_PAGE_LIMIT = 100
const BATCH_NAME_STORAGE_SEPARATOR = '::course::'

function getUniqueCourseIdsFromBatchEntries(batchEntries = []) {
  const seen = new Set()
  const courseIds = []

  if (!Array.isArray(batchEntries)) return courseIds

  batchEntries.forEach((entry) => {
    const courseId = String(entry?.courseId || '').trim()
    if (!courseId || seen.has(courseId)) return
    seen.add(courseId)
    courseIds.push(courseId)
  })

  return courseIds
}

function getStoredBatchCourseLabel(batchName = '') {
  const normalizedBatchName = String(batchName || '').trim()
  if (!normalizedBatchName || !normalizedBatchName.includes(BATCH_NAME_STORAGE_SEPARATOR)) return ''

  const parts = normalizedBatchName.split(BATCH_NAME_STORAGE_SEPARATOR).map((part) => String(part || '').trim()).filter(Boolean)
  return parts[parts.length - 1] || ''
}

function stripStoredBatchName(batchName = '', courseLabel = '') {
  let normalizedBatchName = String(batchName || '').trim()
  if (!normalizedBatchName) return normalizedBatchName

  const separatorIndex = normalizedBatchName.indexOf(BATCH_NAME_STORAGE_SEPARATOR)
  if (separatorIndex === -1) return normalizedBatchName

  normalizedBatchName = normalizedBatchName.slice(0, separatorIndex).trim()

  const normalizedCourseLabel = String(courseLabel || '').trim()
  if (!normalizedBatchName || !normalizedCourseLabel) return normalizedBatchName

  const storedSuffix = `${BATCH_NAME_STORAGE_SEPARATOR}${normalizedCourseLabel}`
  while (normalizedBatchName.endsWith(storedSuffix)) {
    normalizedBatchName = normalizedBatchName.slice(0, -storedSuffix.length).trim()
  }

  return normalizedBatchName
}

function storeBatchName(batchName = '', courseId = '', courseName = '') {
  const normalizedBatchName = stripStoredBatchName(batchName, courseName || courseId)
  const normalizedCourseLabel = String(courseName || courseId || '').trim()
  if (!normalizedBatchName || !normalizedCourseLabel) return normalizedBatchName

  return `${normalizedBatchName}${BATCH_NAME_STORAGE_SEPARATOR}${normalizedCourseLabel}`
}

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

export function normalizeFacultyRecord(record, fallback = {}) {
  if (!record) return null

  const sourceBatchEntries = Array.isArray(record.batchEntries) && record.batchEntries.length
    ? record.batchEntries
    : Array.isArray(fallback.batchEntries) && fallback.batchEntries.length
      ? fallback.batchEntries
      : []
  const batchEntries = sourceBatchEntries.map((entry) => ({
    ...entry,
    id: entry.id || '',
    batchName: stripStoredBatchName(entry.batchName || '', entry.courseName || entry.courseId || ''),
    batchTiming: entry.batchTiming || '',
    courseId: entry.courseId || '',
    courseName: entry.courseName || getStoredBatchCourseLabel(entry.batchName || '') || '',
    sequenceNo: entry.sequenceNo ?? 1,
  }))
  const courseIdsFromPayload = Array.isArray(record.courseIds)
    ? record.courseIds.map((courseId) => String(courseId || '').trim()).filter(Boolean)
    : Array.isArray(fallback.courseIds)
      ? fallback.courseIds.map((courseId) => String(courseId || '').trim()).filter(Boolean)
    : []
  const batchCourseIds = getUniqueCourseIdsFromBatchEntries(batchEntries)
  const courseIds = Array.from(new Set([
    ...courseIdsFromPayload,
    ...batchCourseIds,
    record.courseId ? String(record.courseId).trim() : '',
    fallback.courseId ? String(fallback.courseId).trim() : '',
  ].filter(Boolean)))

  return {
    ...fallback,
    ...record,
    id: record.id || '',
    facultyName: record.facultyName || '',
    facultyEmail: record.facultyEmail || '',
    facultyPhone: record.facultyPhone || '',
    courseId: courseIds[0] || record.courseId || '',
    courseIds,
    courseName: record.courseName || record.course?.name || '',
    course: record.course || null,
    status: record.status || 'Inactive',
    batchEntries,
    batchCount: Number(record.batchCount ?? batchEntries.length) || batchEntries.length,
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || '',
    createdOn: record.createdOn || record.createdAt || '',
    updatedOn: record.updatedOn || record.updatedAt || '',
  }
}

export function normalizeFacultyList(records) {
  return Array.isArray(records) ? records.map(normalizeFacultyRecord).filter(Boolean) : []
}

function buildFacultySearchParams(query = {}) {
  const params = new URLSearchParams()
  const page = Number.isInteger(Number(query.page)) && Number(query.page) > 0 ? Number(query.page) : 1
  const limit =
    Number.isInteger(Number(query.limit)) && Number(query.limit) > 0
      ? Math.min(Number(query.limit), 100)
      : FACULTY_PAGE_LIMIT

  params.set('page', String(page))
  params.set('limit', String(limit))

  const search = String(query.search ?? '').trim()
  if (search) params.set('search', search)

  const status = String(query.status ?? '').trim()
  if (status) params.set('status', status)

  const courseId = String(query.courseId ?? '').trim()
  if (courseId) params.set('courseId', courseId)

  const sortBy = String(query.sortBy ?? '').trim()
  if (sortBy) params.set('sortBy', sortBy)

  const sortOrder = String(query.sortOrder ?? '').trim()
  if (sortOrder) params.set('sortOrder', sortOrder)

  return params
}

function buildFacultyPayload(payload = {}) {
  const courseIds = Array.isArray(payload.courseIds)
    ? payload.courseIds.map((courseId) => String(courseId ?? '').trim()).filter(Boolean)
    : String(payload.courseId ?? '').trim()
      ? [String(payload.courseId).trim()]
      : []

  return {
    facultyName: String(payload.facultyName ?? '').trim(),
    facultyEmail: String(payload.facultyEmail ?? '').trim(),
    facultyPhone: String(payload.facultyPhone ?? '').trim(),
    courseId: courseIds[0] || String(payload.courseId ?? '').trim(),
    courseIds,
    status: String(payload.status ?? 'Active').trim().toUpperCase(),
    batchEntries: Array.isArray(payload.batchEntries)
      ? payload.batchEntries.map((entry) => ({
          batchName: storeBatchName(String(entry?.batchName ?? '').trim(), entry?.courseId ?? '', entry?.courseName ?? ''),
          batchTiming: String(entry?.batchTiming ?? '').trim(),
          courseId: String(entry?.courseId ?? '').trim(),
          courseName: String(entry?.courseName ?? '').trim(),
        }))
      : [],
  }
}

export async function listFacultyRecords(query = {}) {
  const params = buildFacultySearchParams(query)
  const response = await request(`/faculty-management?${params.toString()}`)

  return {
    data: normalizeFacultyList(unwrapData(response)),
    meta: response?.meta ?? response?.data?.meta ?? null,
  }
}

export async function getCurrentFacultyProfile() {
  const response = await request('/faculty-management/me')
  return normalizeFacultyRecord(unwrapData(response))
}

export async function createFacultyRecord(payload) {
  const nextPayload = buildFacultyPayload(payload)
  const response = await request('/faculty-management', {
    method: 'POST',
    body: JSON.stringify(nextPayload),
  })

  return normalizeFacultyRecord(unwrapData(response), nextPayload)
}

export async function updateFacultyRecord(facultyId, payload) {
  const nextPayload = buildFacultyPayload(payload)
  const response = await request(`/faculty-management/${facultyId}`, {
    method: 'PATCH',
    body: JSON.stringify(nextPayload),
  })

  return normalizeFacultyRecord(unwrapData(response), nextPayload)
}

export async function deleteFacultyRecord(facultyId) {
  const response = await request(`/faculty-management/${facultyId}`, {
    method: 'DELETE',
  })

  return normalizeFacultyRecord(unwrapData(response))
}
