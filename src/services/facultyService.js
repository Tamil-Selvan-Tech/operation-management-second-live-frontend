import { request } from './apiClient'

const FACULTY_PAGE_LIMIT = 100
const BATCH_NAME_STORAGE_SEPARATOR = '::course::'
const FACULTY_LIST_CACHE_TTL_MS = Number(import.meta.env.VITE_LIST_CACHE_TTL_MS || 60000)
const FACULTY_PROFILE_CACHE_TTL_MS = Number(import.meta.env.VITE_LIST_CACHE_TTL_MS || 60000)
const facultyListCache = new Map()
const facultyListInflight = new Map()
const facultyProfileCache = new Map()
const facultyProfileInflight = new Map()

function makeCacheKey(query = {}) {
  return JSON.stringify(query || {})
}

function getCachedResult(cache, key, ttlMs = FACULTY_LIST_CACHE_TTL_MS) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > ttlMs) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function setCachedResult(cache, key, value) {
  cache.set(key, {
    timestamp: Date.now(),
    value,
  })
}

function clearFacultyListCache() {
  facultyListCache.clear()
  facultyListInflight.clear()
}

function clearFacultyProfileCache() {
  facultyProfileCache.clear()
  facultyProfileInflight.clear()
}

export function peekFacultyList(query = {}) {
  const cacheKey = makeCacheKey(query)
  return getCachedResult(facultyListCache, cacheKey)
}

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

function getBatchSequenceNoFromName(batchName = '') {
  const normalizedBatchName = String(batchName || '').trim()
  if (!normalizedBatchName) return 0

  const match = normalizedBatchName.match(/\bbatch\s*(\d+)\b/i)
  if (!match) return 0

  const sequenceNo = Number(match[1])
  return Number.isFinite(sequenceNo) && sequenceNo > 0 ? sequenceNo : 0
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

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

function getFacultyRecordMergeKey(record = {}) {
  return String(record.facultyEmail || record.id || '').trim().toLowerCase()
}

function getMergedEntryKey(entry = {}) {
  return String(entry.id || `${entry.batchName || ''}-${entry.batchTiming || ''}-${entry.courseId || ''}`).trim().toLowerCase()
}

function mergeFacultyRecordVariants(baseRecord = {}, nextRecord = {}) {
  const mergedCourseIds = Array.from(
    new Set([
      ...(Array.isArray(baseRecord.courseIds) ? baseRecord.courseIds : []),
      ...(Array.isArray(nextRecord.courseIds) ? nextRecord.courseIds : []),
      baseRecord.courseId || '',
      nextRecord.courseId || '',
    ].map((courseId) => String(courseId || '').trim()).filter(Boolean)),
  )

  const mergedBatchEntries = Array.from(
    new Map([
      ...(Array.isArray(baseRecord.batchEntries) ? baseRecord.batchEntries : []),
      ...(Array.isArray(nextRecord.batchEntries) ? nextRecord.batchEntries : []),
    ].map((entry) => [getMergedEntryKey(entry), entry]))
  ).map(([, entry]) => entry)

  const mergedCourseAssignments = Array.from(
    new Map([
      ...(Array.isArray(baseRecord.courseAssignments) ? baseRecord.courseAssignments : []),
      ...(Array.isArray(nextRecord.courseAssignments) ? nextRecord.courseAssignments : []),
    ].map((entry) => [getMergedEntryKey(entry), entry]))
  ).map(([, entry]) => entry)

  const mergedUpdatedAt = [baseRecord.updatedAt, nextRecord.updatedAt].find((value) => String(value || '').trim()) || ''
  const mergedCreatedAt = [baseRecord.createdAt, nextRecord.createdAt].find((value) => String(value || '').trim()) || ''

  return {
    ...baseRecord,
    ...nextRecord,
    courseIds: mergedCourseIds,
    courseId: mergedCourseIds[0] || nextRecord.courseId || baseRecord.courseId || '',
    batchEntries: mergedBatchEntries,
    courseAssignments: mergedCourseAssignments,
    batchCount: Math.max(
      Number(baseRecord.batchCount || 0) || 0,
      Number(nextRecord.batchCount || 0) || 0,
      mergedBatchEntries.length,
    ),
    updatedAt: mergedUpdatedAt,
    createdAt: mergedCreatedAt,
  }
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
    sequenceNo: Number(entry.sequenceNo || getBatchSequenceNoFromName(entry.batchName || '') || 1) || 1,
  }))
  const sourceCourseAssignments = Array.isArray(record.courseAssignments) && record.courseAssignments.length
    ? record.courseAssignments
    : Array.isArray(fallback.courseAssignments) && fallback.courseAssignments.length
      ? fallback.courseAssignments
      : []
  const courseAssignments = sourceCourseAssignments.map((entry) => ({
    ...entry,
    id: entry.id || '',
    facultyId: entry.facultyId || '',
    courseId: String(entry.courseId || '').trim(),
    courseName: entry.courseName || '',
  }))
  const courseIdsFromPayload = Array.isArray(record.courseIds)
    ? record.courseIds.map((courseId) => String(courseId || '').trim()).filter(Boolean)
    : Array.isArray(fallback.courseIds)
      ? fallback.courseIds.map((courseId) => String(courseId || '').trim()).filter(Boolean)
    : []
  const batchCourseIds = getUniqueCourseIdsFromBatchEntries(batchEntries)
  const assignmentCourseIds = getUniqueCourseIdsFromBatchEntries(courseAssignments)
  const courseIds = Array.from(new Set([
    ...courseIdsFromPayload,
    ...batchCourseIds,
    ...assignmentCourseIds,
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
    courseAssignments,
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
  if (!Array.isArray(records)) return []

  const normalizedRecords = records.map(normalizeFacultyRecord).filter(Boolean)
  const mergedByKey = new Map()

  normalizedRecords.forEach((record) => {
    const mergeKey = getFacultyRecordMergeKey(record)
    if (!mergeKey) {
      const fallbackKey = String(record.id || '').trim().toLowerCase()
      mergedByKey.set(fallbackKey || `${mergedByKey.size}-${Date.now()}`, record)
      return
    }

    const existingRecord = mergedByKey.get(mergeKey)
    mergedByKey.set(mergeKey, existingRecord ? mergeFacultyRecordVariants(existingRecord, record) : record)
  })

  return Array.from(mergedByKey.values())
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
          courseId: String(entry?.courseId ?? '').trim(),
          courseName: String(entry?.courseName ?? '').trim(),
          sequenceNo: Number(entry?.sequenceNo || getBatchSequenceNoFromName(entry?.batchName || '') || 1) || 1,
        }))
      : [],
  }
}

export async function listFacultyRecords(query = {}) {
  const params = buildFacultySearchParams(query)
  const cacheKey = makeCacheKey(query)
  const cached = getCachedResult(facultyListCache, cacheKey)
  if (cached) {
    return cached
  }

  if (facultyListInflight.has(cacheKey)) {
    return facultyListInflight.get(cacheKey)
  }

  const pending = request(`/faculty-management?${params.toString()}`).then((response) => {
    const result = {
      data: normalizeFacultyList(unwrapData(response)),
      meta: response?.meta ?? response?.data?.meta ?? null,
    }

    setCachedResult(facultyListCache, cacheKey, result)
    return result
  })

  facultyListInflight.set(cacheKey, pending)

  try {
    return await pending
  } finally {
    facultyListInflight.delete(cacheKey)
  }
}

export async function getCurrentFacultyProfile() {
  const cacheKey = 'current-faculty'
  const cached = getCachedResult(facultyProfileCache, cacheKey, FACULTY_PROFILE_CACHE_TTL_MS)
  if (cached) {
    return cached
  }

  if (facultyProfileInflight.has(cacheKey)) {
    return facultyProfileInflight.get(cacheKey)
  }

  const pending = request('/faculty-management/me').then((response) => {
    const result = normalizeFacultyRecord(unwrapData(response))
    setCachedResult(facultyProfileCache, cacheKey, result)
    return result
  })

  facultyProfileInflight.set(cacheKey, pending)

  try {
    return await pending
  } finally {
    facultyProfileInflight.delete(cacheKey)
  }
}

export async function createFacultyRecord(payload) {
  const nextPayload = buildFacultyPayload(payload)
  const response = await request('/faculty-management', {
    method: 'POST',
    body: JSON.stringify(nextPayload),
  })

  clearFacultyListCache()
  clearFacultyProfileCache()
  return normalizeFacultyRecord(unwrapData(response), nextPayload)
}

export async function updateFacultyRecord(facultyId, payload) {
  const nextPayload = buildFacultyPayload(payload)
  const response = await request(`/faculty-management/${facultyId}`, {
    method: 'PATCH',
    body: JSON.stringify(nextPayload),
  })

  clearFacultyListCache()
  clearFacultyProfileCache()
  return normalizeFacultyRecord(unwrapData(response), nextPayload)
}

export async function deleteFacultyRecord(facultyId) {
  const response = await request(`/faculty-management/${facultyId}`, {
    method: 'DELETE',
  })

  clearFacultyListCache()
  clearFacultyProfileCache()
  return normalizeFacultyRecord(unwrapData(response))
}
