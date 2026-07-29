function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeBatchToken(value = '') {
  const normalized = normalizeText(value).replace(/\s+/g, ' ')
  if (!normalized) return ''

  const batchTokenMatch = normalized.match(/\bbatch\s*\d+\b/)
  if (batchTokenMatch) {
    return batchTokenMatch[0].replace(/\s+/g, ' ')
  }

  return normalized
    .split(' - ')[0]
    .replace(/\s+/g, ' ')
    .trim()
}

function getStudentIdentityKey(student = {}) {
  return (
    String(student?.id || '').trim().toLowerCase() ||
    String(student?.emailAddress || '').trim().toLowerCase() ||
    String(student?.mobileNumber || '').trim().toLowerCase() ||
    String(student?.studentCode || '').trim().toLowerCase()
  )
}

function dedupeStudents(students = []) {
  const seen = new Set()
  const nextStudents = []

  students.forEach((student) => {
    const key = getStudentIdentityKey(student)
    if (!key || seen.has(key)) return
    seen.add(key)
    nextStudents.push(student)
  })

  return nextStudents
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

export function getFacultyCourseIds(record = {}, courseOptions = []) {
  const optionLookup = new Map(
    (Array.isArray(courseOptions) ? courseOptions : []).map((course) => [
      normalizeText(course?.name || ''),
      String(course?.id || '').trim(),
    ]),
  )

  const ids = [
    ...(Array.isArray(record.courseIds) ? record.courseIds : []),
    record.courseId || '',
    ...(Array.isArray(record.batchEntries)
      ? record.batchEntries.flatMap((entry) => {
          const directCourseId = String(entry?.courseId || '').trim()
          if (directCourseId) return [directCourseId]

          const courseName = normalizeText(entry?.courseName || '')
          const resolvedCourseId = courseName ? optionLookup.get(courseName) || '' : ''
          return resolvedCourseId ? [resolvedCourseId] : []
        })
      : []),
    ...(Array.isArray(record.courseAssignments)
      ? record.courseAssignments.map((assignment) => String(assignment?.courseId || '').trim())
      : []),
  ]
    .map((courseId) => String(courseId || '').trim())
    .filter(Boolean)

  return Array.from(new Set(ids))
}

export function getFacultyCourseName(courseId, courseOptions = []) {
  const normalizedCourseId = String(courseId || '').trim()
  if (!normalizedCourseId) return ''

  const matchedCourse = courseOptions.find((course) => String(course?.id || '').trim() === normalizedCourseId)
  return String(matchedCourse?.name || matchedCourse?.courseName || matchedCourse?.title || '').trim()
}

export function getFacultyCourses(record = {}, courseOptions = []) {
  const courseIds = getFacultyCourseIds(record, courseOptions)
  const fallbackCourseName = String(record.courseName || '').trim()
  const courseNameLookup = new Map()

  ;(Array.isArray(record.batchEntries) ? record.batchEntries : []).forEach((entry) => {
    const courseId = String(entry?.courseId || '').trim()
    const courseName = String(entry?.courseName || '').trim()
    if (courseId && courseName && !courseNameLookup.has(courseId)) {
      courseNameLookup.set(courseId, courseName)
    }
  })

  ;(Array.isArray(record.courseAssignments) ? record.courseAssignments : []).forEach((assignment) => {
    const courseId = String(assignment?.courseId || '').trim()
    const courseName = String(assignment?.courseName || '').trim()
    if (courseId && courseName && !courseNameLookup.has(courseId)) {
      courseNameLookup.set(courseId, courseName)
    }
  })

  return courseIds.map((courseId, index) => ({
    courseId,
    courseName:
      getFacultyCourseName(courseId, courseOptions) ||
      courseNameLookup.get(courseId) ||
      (index === 0 ? fallbackCourseName : '') ||
      courseId,
    batchCount: getFacultyBatchEntriesForCourse(record, courseId, courseOptions).length,
  }))
}

export function getFacultyBatchEntriesForCourse(record = {}, courseId = '', courseOptions = []) {
  const normalizedCourseId = String(courseId || '').trim()
  const batchEntries = Array.isArray(record.batchEntries) ? record.batchEntries : []
  if (!normalizedCourseId) return batchEntries.slice()

  const matchingEntries = batchEntries.filter((entry) => {
    const entryCourseId = String(entry?.courseId || '').trim()
    if (entryCourseId) return entryCourseId === normalizedCourseId

    const entryCourseName = normalizeText(entry?.courseName || '')
    if (!entryCourseName || !Array.isArray(courseOptions) || !courseOptions.length) return false

    const resolvedCourse = courseOptions.find((course) => normalizeText(course?.name || '') === entryCourseName)
    return String(resolvedCourse?.id || '').trim() === normalizedCourseId
  })
  if (matchingEntries.length) return matchingEntries

  const fallbackCourseIds = getFacultyCourseIds(record, courseOptions)
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

export function getFacultyTotals(record = {}, courseOptions = []) {
  const courseCount = getFacultyCourseIds(record, courseOptions).length
  const batchCount = Array.isArray(record.batchEntries) ? record.batchEntries.length : Number(record.batchCount || 0) || 0

  return {
    courseCount,
    batchCount,
  }
}

function getFacultyRecordBackfillScore(student = {}, record = {}, courseOptions = []) {
  const studentFacultyId = String(student?.facultyId || '').trim()
  const studentFacultyName = normalizeText(student?.facultyName || '')
  const studentCourseId = String(student?.courseId || '').trim()
  const studentCourseName = normalizeText(student?.courseInterested || student?.courseName || student?.course?.name || '')
  const studentBatchId = String(student?.batchId || student?.batchEntryId || '').trim()
  const studentBatchName = normalizeText(student?.batchName || student?.batch || '')
  const studentBatchToken = normalizeBatchToken(student?.batchName || student?.batch || '')

  const recordId = String(record?.id || record?._id || record?.facultyId || '').trim()
  const recordName = normalizeText(record?.facultyName || '')
  const recordCourseIds = getFacultyCourseIds(record, courseOptions)
  const recordCourses = getFacultyCourses(record, courseOptions)

  let score = 0
  if (studentFacultyId && recordId && studentFacultyId === recordId) score += 12
  if (studentFacultyName && recordName && studentFacultyName === recordName) score += 8
  if (studentCourseId && recordCourseIds.includes(studentCourseId)) score += 5
  if (studentCourseName && recordCourses.some((course) => normalizeText(course?.courseName || '') === studentCourseName)) score += 3

  let matchedBatchEntry = null
  let batchScore = 0
  const batchEntries = Array.isArray(record?.batchEntries) ? record.batchEntries : []

  batchEntries.forEach((entry) => {
    const entryId = String(entry?.id || '').trim()
    const entryCourseId = String(entry?.courseId || '').trim()
    const entryCourseName = normalizeText(entry?.courseName || '')
    const entryBatchName = normalizeText(entry?.batchName || entry?.batch || '')
    const entryBatchToken = normalizeBatchToken(entry?.batchName || entry?.batch || '')
    let candidateScore = 0

    if (studentBatchId && entryId && studentBatchId === entryId) candidateScore += 12
    if (studentBatchName && entryBatchName && studentBatchName === entryBatchName) candidateScore += 8
    else if (studentBatchToken && entryBatchToken && studentBatchToken === entryBatchToken) candidateScore += 7
    if (studentCourseId && entryCourseId && studentCourseId === entryCourseId) candidateScore += 4
    if (studentCourseName && entryCourseName && studentCourseName === entryCourseName) candidateScore += 2
    if (candidateScore > batchScore) {
      batchScore = candidateScore
      matchedBatchEntry = entry
    }
  })

  return {
    score: score + batchScore,
    matchedBatchEntry,
  }
}

export function enrichStudentsWithFacultyReferences(students = [], facultyRecords = [], courseOptions = []) {
  const studentList = Array.isArray(students) ? students : []
  const records = Array.isArray(facultyRecords) ? facultyRecords : []

  if (!studentList.length || !records.length) {
    return studentList
  }

  let didChange = false

  const nextStudents = studentList.map((student) => {
    if (!student) return student

    const hasFacultyId = Boolean(String(student?.facultyId || '').trim())
    const hasBatchId = Boolean(String(student?.batchId || student?.batchEntryId || '').trim())
    const hasFacultyName = Boolean(String(student?.facultyName || '').trim())
    const hasBatchName = Boolean(String(student?.batchName || student?.batch || '').trim())
    const hasCourseId = Boolean(String(student?.courseId || '').trim())
    const hasCourseName = Boolean(String(student?.courseInterested || student?.courseName || student?.course?.name || '').trim())

    if (hasFacultyId && hasBatchId && hasFacultyName && hasBatchName) {
      return student
    }

    let bestMatch = null

    records.forEach((record) => {
      const result = getFacultyRecordBackfillScore(student, record, courseOptions)
      if (!result || result.score <= 0) return

      if (!bestMatch || result.score > bestMatch.score) {
        bestMatch = {
          score: result.score,
          record,
          matchedBatchEntry: result.matchedBatchEntry,
        }
      }
    })

    if (!bestMatch) return student

    const nextStudent = { ...student }
    const nextFacultyId = String(bestMatch.record?.id || bestMatch.record?._id || bestMatch.record?.facultyId || '').trim()
    const nextFacultyName = String(bestMatch.record?.facultyName || '').trim()
    const nextBatchId = String(bestMatch.matchedBatchEntry?.id || '').trim()
    const nextBatchName = String(bestMatch.matchedBatchEntry?.batchName || bestMatch.matchedBatchEntry?.batch || '').trim()
    const nextCourseId = String(bestMatch.matchedBatchEntry?.courseId || bestMatch.record?.courseId || '').trim()
    const nextCourseName = String(bestMatch.matchedBatchEntry?.courseName || bestMatch.record?.courseName || '').trim()

    if (!hasFacultyId && nextFacultyId) {
      nextStudent.facultyId = nextFacultyId
      didChange = true
    }

    if (!hasFacultyName && nextFacultyName) {
      nextStudent.facultyName = nextFacultyName
      didChange = true
    }

    if (!hasBatchId && nextBatchId) {
      nextStudent.batchId = nextBatchId
      nextStudent.batchEntryId = nextBatchId
      didChange = true
    }

    if (!hasBatchName && nextBatchName) {
      nextStudent.batchName = nextBatchName
      nextStudent.batch = nextBatchName
      didChange = true
    }

    if (!hasCourseId && nextCourseId) {
      nextStudent.courseId = nextCourseId
      didChange = true
    }

    if (!hasCourseName && nextCourseName) {
      nextStudent.courseInterested = nextCourseName
      didChange = true
    }

    return nextStudent
  })

  return didChange ? nextStudents : studentList
}

export function getMatchingStudents(
  students = [],
  { facultyName = '', facultyId = '', courseId = '', courseName = '', batchName = '', batchId = '' } = {},
) {
  const normalizedFacultyId = String(facultyId || '').trim()
  const normalizedBatchId = String(batchId || '').trim()
  const normalizedFacultyName = normalizeText(facultyName)
  const normalizedCourseId = String(courseId || '').trim()
  const normalizedCourseName = normalizeText(courseName)
  const normalizedBatchName = normalizeText(batchName)
  const normalizedBatchToken = normalizeBatchToken(batchName)

  return (Array.isArray(students) ? students : []).filter((student) => {
    const studentCourseId = String(student?.courseId || '').trim()
    const studentCourseName = normalizeText(student?.courseInterested || student?.courseName || student?.course?.name || '')
    const studentFacultyId = String(student?.facultyId || '').trim()
    const studentFacultyName = normalizeText(student?.facultyName || '')
    const studentBatchId = String(student?.batchId || student?.batchEntryId || '').trim()
    const studentBatchName = normalizeText(student?.batchName || student?.batch || '')
    const studentBatchToken = normalizeBatchToken(student?.batchName || student?.batch || '')

    if (normalizedFacultyId && studentFacultyId && studentFacultyId !== normalizedFacultyId) {
      return false
    }

    if (normalizedBatchName) {
      const batchMatches =
        studentBatchName === normalizedBatchName ||
        studentBatchToken === normalizedBatchToken ||
        studentBatchToken === normalizedBatchName ||
        studentBatchName === normalizedBatchToken

      if (!batchMatches) {
        return false
      }
    }

    if (normalizedBatchId && studentBatchId && studentBatchId !== normalizedBatchId) {
      return false
    }

    if (normalizedFacultyName && studentFacultyName && studentFacultyName !== normalizedFacultyName) {
      return false
    }

    if (
      normalizedFacultyName &&
      !studentFacultyName &&
      !normalizedCourseId &&
      !normalizedCourseName &&
      !normalizedBatchName &&
      !normalizedBatchId
    ) {
      return false
    }

    if (normalizedCourseId && studentCourseId && studentCourseId !== normalizedCourseId) {
      return false
    }

    if (normalizedCourseName && studentCourseName && studentCourseName !== normalizedCourseName) {
      return false
    }

    return true
  })
}

export function getFacultyBatchStudentRecords(
  students = [],
  { facultyName = '', facultyId = '', courseId = '', courseName = '', batchName = '', batchId = '' } = {},
) {
  const exactMatches = getMatchingStudents(students, {
    facultyName,
    facultyId,
    courseId,
    courseName,
    batchName,
    batchId,
  })

  if (exactMatches.length) {
    return dedupeStudents(exactMatches)
  }

  return dedupeStudents(getMatchingStudents(students, {
    facultyId,
    courseId,
    courseName,
    batchName,
    batchId,
  }))
}

export function getUniqueStudentCountForFacultyScope(
  students = [],
  { facultyName = '', facultyId = '', courseId = '', courseName = '', batchNames = [], batchIds = [] } = {},
) {
  const normalizedBatchNames = Array.isArray(batchNames)
    ? batchNames.map((value) => String(value || '').trim()).filter(Boolean)
    : []
  const normalizedBatchIds = Array.isArray(batchIds)
    ? batchIds.map((value) => String(value || '').trim()).filter(Boolean)
    : []

  const studentRecords = normalizedBatchNames.length || normalizedBatchIds.length
    ? normalizedBatchNames.flatMap((batchName) =>
        getFacultyBatchStudentRecords(students, {
          facultyName,
          facultyId,
          courseId,
          courseName,
          batchName,
        }),
      )
      .concat(
        normalizedBatchIds.flatMap((batchId) =>
          getFacultyBatchStudentRecords(students, {
            facultyName,
            facultyId,
            courseId,
            courseName,
            batchId,
          }),
        ),
      )
    : getFacultyBatchStudentRecords(students, {
      facultyName,
      facultyId,
      courseId,
      courseName,
    })

  return dedupeStudents(studentRecords).length
}

export function getUniqueStudentCountForFacultyRecords(
  students = [],
  { facultyName = '', facultyId = '', batchEntries = [] } = {},
) {
  const normalizedBatchEntries = Array.isArray(batchEntries) ? batchEntries : []

  if (!normalizedBatchEntries.length) {
    return 0
  }

  const studentRecords = normalizedBatchEntries.flatMap((entry) =>
    getFacultyBatchStudentRecords(students, {
      facultyName,
      facultyId,
      courseId: entry?.courseId || '',
      courseName: entry?.courseName || '',
      batchName: entry?.batchName || '',
      batchId: entry?.id || '',
    }),
  )

  return dedupeStudents(studentRecords).length
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
