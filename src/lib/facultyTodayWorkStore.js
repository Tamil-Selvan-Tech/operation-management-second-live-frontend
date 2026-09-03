import { request } from '../services/apiClient'

export const FACULTY_TODAY_WORK_SYNC_EVENT = 'cispro:faculty-today-work-changed'
export const FACULTY_TODAY_WORK_SYNC_KEY = 'cispro:faculty-today-work-sync'

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
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

export async function listFacultyTodayWorkEntries() {
  const response = await request('/faculty-today-work')
  return extractEntries(response)
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

function normalizeId(value) {
  return String(value || '').trim()
}

export async function saveFacultyTodayWorkEntry(entry = {}) {
  const payload = {
    ...entry,
    facultyId: normalizeId(entry.facultyId || entry.facultyProfileId),
    facultyProfileId: normalizeId(entry.facultyProfileId || entry.facultyId),
    branchId: normalizeId(entry.branchId),
    courseId: normalizeId(entry.courseId),
    courseName: String(entry.courseName || '').trim(),
    batchId: normalizeId(entry.batchId || entry.batchEntryId),
    batchGroupId: normalizeId(entry.batchGroupId),
    batchName: String(entry.batchName || '').trim(),
    batchTiming: String(entry.batchTiming || entry.batchTime || '').trim(),
    moduleId: normalizeId(entry.moduleId),
    moduleName: String(entry.moduleName || '').trim(),
    applyToAllStudents: Boolean(entry.applyToAllStudents),
    selectedStudentIds: Array.isArray(entry.selectedStudentIds)
      ? entry.selectedStudentIds.map((value) => normalizeId(value)).filter(Boolean)
      : Array.isArray(entry.studentIds)
        ? entry.studentIds.map((value) => normalizeId(value)).filter(Boolean)
        : [],
    studentIds: Array.isArray(entry.studentIds)
      ? entry.studentIds.map((value) => normalizeId(value)).filter(Boolean)
      : Array.isArray(entry.selectedStudentIds)
        ? entry.selectedStudentIds.map((value) => normalizeId(value)).filter(Boolean)
        : [],
    studentCount: Number(entry.studentCount || 0) || 0,
    selectedSubmoduleIds: Array.isArray(entry.selectedSubmoduleIds)
      ? entry.selectedSubmoduleIds.map((value) => normalizeId(value)).filter(Boolean)
      : Array.isArray(entry.submoduleIds)
        ? entry.submoduleIds.map((value) => normalizeId(value)).filter(Boolean)
        : [],
    submoduleIds: Array.isArray(entry.submoduleIds)
      ? entry.submoduleIds.map((value) => normalizeId(value)).filter(Boolean)
      : Array.isArray(entry.selectedSubmoduleIds)
        ? entry.selectedSubmoduleIds.map((value) => normalizeId(value)).filter(Boolean)
        : [],
    submodules: Array.isArray(entry.submodules) ? entry.submodules : [],
    workDate: String(entry.workDate || '').trim(),
  }

  const response = await request('/faculty-today-work', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  dispatchChange()

  return response?.data || response?.entry || response || null
}

export function clearFacultyTodayWorkEntries() {
  dispatchChange()
}
