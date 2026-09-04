import { request } from '../services/apiClient'

export const FACULTY_TODAY_WORK_SYNC_EVENT = 'cispro:faculty-today-work-changed'
export const FACULTY_TODAY_WORK_SYNC_KEY = 'cispro:faculty-today-work-sync'
const FACULTY_TODAY_WORK_CACHE_KEY = 'cispro:faculty-today-work-cache'

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeId(value = '') {
  return String(value || '').trim()
}

function normalizeIdList(values = []) {
  return Array.isArray(values)
    ? Array.from(new Set(values.map((value) => normalizeId(value)).filter(Boolean)))
    : []
}

function dispatchChange() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(FACULTY_TODAY_WORK_SYNC_KEY, String(Date.now()))
    } catch {
      // ignore storage write failures
    }

    window.dispatchEvent(new CustomEvent(FACULTY_TODAY_WORK_SYNC_EVENT))
  }
}

function extractEntries(response) {
  if (Array.isArray(response)) {
    return response
  }

  if (Array.isArray(response?.data)) {
    return response.data
  }

  if (Array.isArray(response?.entries)) {
    return response.entries
  }

  return []
}

function extractEntry(response) {
  if (!response) return null

  if (response?.data && !Array.isArray(response.data)) {
    return response.data
  }

  if (response?.entry && !Array.isArray(response.entry)) {
    return response.entry
  }

  return response
}

function getTodayWorkEntryKey(entry = {}) {
  const id = normalizeId(entry?.id || entry?._id || entry?.entryId)
  if (id) return `id:${id.toLowerCase()}`

  const studentIds = normalizeIdList(entry?.selectedStudentIds || entry?.studentIds)
    .map((value) => value.toLowerCase())
    .sort()
  const submoduleIds = normalizeIdList(entry?.selectedSubmoduleIds || entry?.submoduleIds)
    .map((value) => value.toLowerCase())
    .sort()

  return [
    `date:${normalizeId(entry?.workDate).toLowerCase()}`,
    `faculty:${normalizeId(entry?.facultyId || entry?.facultyProfileId || entry?.facultyUserId).toLowerCase()}`,
    `course:${normalizeId(entry?.courseId).toLowerCase()}`,
    `batch:${normalizeId(entry?.batchId || entry?.batchEntryId).toLowerCase()}`,
    `group:${normalizeId(entry?.batchGroupId).toLowerCase()}`,
    `name:${normalizeText(entry?.batchName)}`,
    `time:${normalizeText(entry?.batchTiming || entry?.batchTime)}`,
    `module:${normalizeId(entry?.moduleId).toLowerCase()}`,
    `all:${entry?.applyToAllStudents ? '1' : '0'}`,
    `students:${studentIds.join(',')}`,
    `submodules:${submoduleIds.join(',')}`,
  ].join('|')
}

function normalizeTodayWorkEntry(entry = {}, fallback = {}) {
  const source = {
    ...(entry || {}),
    ...(fallback || {}),
  }

  const selectedStudentIds = normalizeIdList(
    Array.isArray(source.selectedStudentIds)
      ? source.selectedStudentIds
      : Array.isArray(source.studentIds)
        ? source.studentIds
        : [],
  )

  const selectedSubmoduleIds = normalizeIdList(
    Array.isArray(source.selectedSubmoduleIds)
      ? source.selectedSubmoduleIds
      : Array.isArray(source.submoduleIds)
        ? source.submoduleIds
        : [],
  )

  return {
    ...source,
    id: normalizeId(source.id || source._id || source.entryId),
    _id: normalizeId(source._id || source.id || source.entryId),
    entryId: normalizeId(source.entryId || source.id || source._id),
    facultyId: normalizeId(source.facultyId || source.facultyProfileId || source.facultyUserId),
    facultyProfileId: normalizeId(source.facultyProfileId || source.facultyId),
    branchId: normalizeId(source.branchId),
    courseId: normalizeId(source.courseId),
    courseName: String(source.courseName || '').trim(),
    batchId: normalizeId(source.batchId || source.batchEntryId),
    batchEntryId: normalizeId(source.batchEntryId || source.batchId),
    batchGroupId: normalizeId(source.batchGroupId),
    batchName: String(source.batchName || '').trim(),
    batchTiming: String(source.batchTiming || source.batchTime || '').trim(),
    moduleId: normalizeId(source.moduleId),
    moduleName: String(source.moduleName || '').trim(),
    applyToAllStudents: Boolean(source.applyToAllStudents),
    selectedStudentIds,
    studentIds: selectedStudentIds,
    studentCount: Number(source.studentCount || selectedStudentIds.length || 0) || 0,
    selectedSubmoduleIds,
    submoduleIds: selectedSubmoduleIds,
    submodules: Array.isArray(source.submodules) ? source.submodules : [],
    workDate: String(source.workDate || '').trim(),
    createdAt: source.createdAt || '',
    updatedAt: source.updatedAt || '',
  }
}

function readLocalCache() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(FACULTY_TODAY_WORK_CACHE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((entry) => normalizeTodayWorkEntry(entry)).filter(Boolean) : []
  } catch {
    return []
  }
}

function writeLocalCache(entries = []) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(FACULTY_TODAY_WORK_CACHE_KEY, JSON.stringify(entries))
  } catch {
    // ignore storage write failures
  }
}

function upsertLocalCacheEntry(entry = {}) {
  const normalizedEntry = normalizeTodayWorkEntry(entry)
  if (!normalizedEntry) return

  const entryKey = getTodayWorkEntryKey(normalizedEntry)
  const nextEntries = readLocalCache().filter((current) => getTodayWorkEntryKey(current) !== entryKey)
  nextEntries.push(normalizedEntry)
  writeLocalCache(nextEntries)
}

export async function listFacultyTodayWorkEntries() {
  const response = await request('/faculty-today-work')
  const remoteEntries = extractEntries(response).map((entry) => normalizeTodayWorkEntry(entry))
  const cachedEntries = readLocalCache()

  const mergedEntries = new Map()

  ;[...remoteEntries, ...cachedEntries].forEach((entry) => {
    const normalizedEntry = normalizeTodayWorkEntry(entry)
    const key = getTodayWorkEntryKey(normalizedEntry)
    if (!key) return

    const existing = mergedEntries.get(key) || {}
    mergedEntries.set(key, {
      ...existing,
      ...normalizedEntry,
      batchId: normalizedEntry.batchId || existing.batchId || '',
      batchEntryId: normalizedEntry.batchEntryId || existing.batchEntryId || '',
      batchGroupId: normalizedEntry.batchGroupId || existing.batchGroupId || '',
      batchName: normalizedEntry.batchName || existing.batchName || '',
      batchTiming: normalizedEntry.batchTiming || existing.batchTiming || '',
      selectedStudentIds: normalizedEntry.selectedStudentIds.length
        ? normalizedEntry.selectedStudentIds
        : existing.selectedStudentIds || [],
      studentIds: normalizedEntry.studentIds.length
        ? normalizedEntry.studentIds
        : existing.studentIds || [],
      selectedSubmoduleIds: normalizedEntry.selectedSubmoduleIds.length
        ? normalizedEntry.selectedSubmoduleIds
        : existing.selectedSubmoduleIds || [],
      submoduleIds: normalizedEntry.submoduleIds.length
        ? normalizedEntry.submoduleIds
        : existing.submoduleIds || [],
      submodules: normalizedEntry.submodules.length ? normalizedEntry.submodules : existing.submodules || [],
    })
  })

  return Array.from(mergedEntries.values())
}

export function getFacultyTodayWorkEntriesByFaculty(
  { facultyId = '', facultyName = '', facultyEmail = '' } = {},
  entries = [],
) {
  const normalizedFacultyId = normalizeText(facultyId)
  const normalizedFacultyName = normalizeText(facultyName)
  const normalizedFacultyEmail = normalizeText(facultyEmail)

  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const entryFacultyId = normalizeText(entry?.facultyId || entry?.facultyProfileId || entry?.facultyUserId)
    const entryFacultyName = normalizeText(entry?.facultyName)
    const entryFacultyEmail = normalizeText(entry?.facultyEmail)

    return (
      (normalizedFacultyId && entryFacultyId && entryFacultyId === normalizedFacultyId) ||
      (normalizedFacultyEmail && entryFacultyEmail && entryFacultyEmail === normalizedFacultyEmail) ||
      (normalizedFacultyName && entryFacultyName && entryFacultyName === normalizedFacultyName)
    )
  })
}

export async function saveFacultyTodayWorkEntry(entry = {}) {
  const payload = normalizeTodayWorkEntry(entry)

  const response = await request('/faculty-today-work', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const savedEntry = normalizeTodayWorkEntry(extractEntry(response), payload)
  upsertLocalCacheEntry(savedEntry)
  dispatchChange()

  return savedEntry
}

export function clearFacultyTodayWorkEntries() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(FACULTY_TODAY_WORK_CACHE_KEY)
    } catch {
      // ignore storage write failures
    }
  }

  dispatchChange()
}
