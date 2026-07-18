function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function uniqueById(entries = [], selector) {
  const seen = new Set()
  const nextEntries = []

  entries.forEach((entry) => {
    const key = normalizeText(selector(entry))
    if (!key || seen.has(key)) return
    seen.add(key)
    nextEntries.push(entry)
  })

  return nextEntries
}

export function getFacultyCourseIds(record = {}) {
  const ids = [
    ...(Array.isArray(record.courseIds) ? record.courseIds : []),
    record.courseId || '',
    ...(Array.isArray(record.batchEntries) ? record.batchEntries.map((entry) => entry?.courseId || '') : []),
  ]
    .map((courseId) => String(courseId || '').trim())
    .filter(Boolean)

  return Array.from(new Set(ids))
}

export function getFacultyCourseName(courseId, courseOptions = []) {
  const normalizedCourseId = String(courseId || '').trim()
  if (!normalizedCourseId) return ''

  return courseOptions.find((course) => String(course?.id || '').trim() === normalizedCourseId)?.name || ''
}

export function getFacultyCourses(record = {}, courseOptions = []) {
  const courseIds = getFacultyCourseIds(record)
  const fallbackCourseName = String(record.courseName || '').trim()

  return courseIds.map((courseId, index) => ({
    courseId,
    courseName: getFacultyCourseName(courseId, courseOptions) || (index === 0 ? fallbackCourseName : '') || courseId,
    batchCount: getFacultyBatchEntriesForCourse(record, courseId).length,
  }))
}

export function getFacultyBatchEntriesForCourse(record = {}, courseId = '') {
  const normalizedCourseId = String(courseId || '').trim()
  const batchEntries = Array.isArray(record.batchEntries) ? record.batchEntries : []
  if (!normalizedCourseId) return batchEntries.slice()

  const matchingEntries = batchEntries.filter((entry) => String(entry?.courseId || '').trim() === normalizedCourseId)
  if (matchingEntries.length) return matchingEntries

  const fallbackCourseIds = getFacultyCourseIds(record)
  if (fallbackCourseIds.length === 1 && fallbackCourseIds[0] === normalizedCourseId) {
    return batchEntries.slice()
  }

  return []
}

export function getFacultyBatchEntryById(record = {}, batchEntryId = '') {
  const normalizedBatchEntryId = String(batchEntryId || '').trim()
  if (!normalizedBatchEntryId) return null

  return (Array.isArray(record.batchEntries) ? record.batchEntries : []).find((entry) => String(entry?.id || '').trim() === normalizedBatchEntryId) || null
}

export function getFacultyTotals(record = {}) {
  const courseCount = getFacultyCourseIds(record).length
  const batchCount = Array.isArray(record.batchEntries) ? record.batchEntries.length : Number(record.batchCount || 0) || 0

  return {
    courseCount,
    batchCount,
  }
}

export function getMatchingStudents(students = [], { facultyName = '', courseId = '', courseName = '', batchName = '' } = {}) {
  const normalizedFacultyName = normalizeText(facultyName)
  const normalizedCourseId = String(courseId || '').trim()
  const normalizedCourseName = normalizeText(courseName)
  const normalizedBatchName = normalizeText(batchName)

  return (Array.isArray(students) ? students : []).filter((student) => {
    if (normalizedFacultyName && normalizeText(student?.facultyName || '') !== normalizedFacultyName) {
      return false
    }

    const studentCourseId = String(student?.courseId || '').trim()
    const studentCourseName = normalizeText(student?.courseInterested || student?.course?.name || '')

    if (normalizedCourseId) {
      if (studentCourseId && studentCourseId !== normalizedCourseId) return false
      if (!studentCourseId && normalizedCourseName && studentCourseName !== normalizedCourseName) return false
    } else if (normalizedCourseName && studentCourseName !== normalizedCourseName) {
      return false
    }

    if (normalizedBatchName && normalizeText(student?.batchName || student?.batch || '') !== normalizedBatchName) {
      return false
    }

    return true
  })
}

export function buildFacultyDetailsPath(facultyId) {
  return `/faculty-management/${encodeURIComponent(String(facultyId || '').trim())}`
}

export function buildFacultyCourseCatalogPath() {
  return '/faculty-management/courses'
}

export function buildFacultyCourseListPath(courseId) {
  return `/faculty-management/course/${encodeURIComponent(String(courseId || '').trim())}`
}

export function buildFacultyCoursePath(facultyId, courseId) {
  return `/faculty-management/course/${encodeURIComponent(String(courseId || '').trim())}/faculty/${encodeURIComponent(String(facultyId || '').trim())}/batches`
}

export function buildFacultyBatchPath(facultyId, courseId, batchEntryId) {
  return `${buildFacultyCoursePath(facultyId, courseId)}/${encodeURIComponent(String(batchEntryId || '').trim())}`
}

export function buildStudentManagementPath({ studentId = '', courseId = '', facultyId = '', batchId = '' } = {}) {
  const params = new URLSearchParams()

  if (studentId) params.set('studentId', String(studentId).trim())
  if (courseId) params.set('courseId', String(courseId).trim())
  if (facultyId) params.set('facultyId', String(facultyId).trim())
  if (batchId) params.set('batchId', String(batchId).trim())

  const query = params.toString()
  return query ? `/student-management?${query}` : '/student-management'
}

export function sortByNameThenTiming(entries = []) {
  return uniqueById(entries, (entry) => entry?.id || `${entry?.batchName || ''}-${entry?.batchTiming || ''}`).slice().sort((left, right) => {
    const leftName = String(left?.batchName || '').trim().toLowerCase()
    const rightName = String(right?.batchName || '').trim().toLowerCase()

    if (leftName !== rightName) return leftName.localeCompare(rightName)

    return String(left?.batchTiming || '').trim().localeCompare(String(right?.batchTiming || '').trim())
  })
}
