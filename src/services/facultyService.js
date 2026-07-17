import { request } from './apiClient'

const FACULTY_PAGE_LIMIT = 100

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

export function normalizeFacultyRecord(record) {
  if (!record) return null

  const batchEntries = Array.isArray(record.batchEntries)
    ? record.batchEntries.map((entry) => ({
        ...entry,
        id: entry.id || '',
        batchName: entry.batchName || '',
        batchTiming: entry.batchTiming || '',
        sequenceNo: entry.sequenceNo ?? 1,
      }))
    : []
  const courseIds = Array.isArray(record.courseIds)
    ? record.courseIds.map((courseId) => String(courseId || '').trim()).filter(Boolean)
    : record.courseId
      ? [String(record.courseId).trim()].filter(Boolean)
      : []

  return {
    ...record,
    id: record.id || '',
    facultyName: record.facultyName || '',
    facultyEmail: record.facultyEmail || '',
    facultyPhone: record.facultyPhone || '',
    courseId: record.courseId || '',
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
          batchName: String(entry?.batchName ?? '').trim(),
          batchTiming: String(entry?.batchTiming ?? '').trim(),
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

export async function createFacultyRecord(payload) {
  const response = await request('/faculty-management', {
    method: 'POST',
    body: JSON.stringify(buildFacultyPayload(payload)),
  })

  return normalizeFacultyRecord(unwrapData(response))
}

export async function updateFacultyRecord(facultyId, payload) {
  const response = await request(`/faculty-management/${facultyId}`, {
    method: 'PATCH',
    body: JSON.stringify(buildFacultyPayload(payload)),
  })

  return normalizeFacultyRecord(unwrapData(response))
}

export async function deleteFacultyRecord(facultyId) {
  const response = await request(`/faculty-management/${facultyId}`, {
    method: 'DELETE',
  })

  return normalizeFacultyRecord(unwrapData(response))
}
