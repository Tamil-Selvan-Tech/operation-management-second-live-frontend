const ATTENDANCE_STORAGE_PREFIX = 'cispro.faculty.attendance'
export const FACULTY_ATTENDANCE_SYNC_EVENT = 'cispro:faculty-attendance-changed'

export function getAttendanceDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeStorageSlug(value = '') {
  return (
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'faculty'
  )
}

export function buildFacultyAttendanceStorageKey(identifier = '') {
  return `${ATTENDANCE_STORAGE_PREFIX}.${normalizeStorageSlug(identifier)}`
}

export function getFacultyAttendanceStorageKey(facultyId = '', facultyName = '', profileInitials = '') {
  return buildFacultyAttendanceStorageKey(facultyId || facultyName || profileInitials)
}

export function loadFacultyAttendanceState(facultyId = '', facultyName = '', profileInitials = '') {
  if (typeof window === 'undefined') return null

  const storageKey = getFacultyAttendanceStorageKey(facultyId, facultyName, profileInitials)

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || parsed.dateKey !== getAttendanceDateKey()) return null

    return parsed
  } catch {
    return null
  }
}

export function saveFacultyAttendanceState(facultyId = '', facultyName = '', profileInitials = '', payload = {}) {
  if (typeof window === 'undefined') return

  const storageKey = getFacultyAttendanceStorageKey(facultyId, facultyName, profileInitials)

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
    window.dispatchEvent(new CustomEvent(FACULTY_ATTENDANCE_SYNC_EVENT))
  } catch {
    // Ignore storage failures and keep the UI functional.
  }
}

export function clearFacultyAttendanceState(facultyId = '', facultyName = '', profileInitials = '') {
  if (typeof window === 'undefined') return

  const storageKey = getFacultyAttendanceStorageKey(facultyId, facultyName, profileInitials)

  try {
    window.localStorage.removeItem(storageKey)
    window.dispatchEvent(new CustomEvent(FACULTY_ATTENDANCE_SYNC_EVENT))
  } catch {
    // Ignore storage failures and keep the UI functional.
  }
}

export function formatAttendanceTimeLabel(value) {
  const date = value instanceof Date ? value : typeof value === 'number' ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''

  return date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function parseTimeSegment(timeText = '') {
  const normalized = String(timeText || '').trim()
  if (!normalized) return null

  const match = normalized.match(/(\d{1,2})(?::|\.)(\d{2})\s*(AM|PM)?/i)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = String(match[3] || '').toUpperCase()

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 12 || minutes < 0 || minutes > 59) return null

  if (meridiem === 'AM') {
    if (hours === 12) hours = 0
  } else if (meridiem === 'PM') {
    if (hours !== 12) hours += 12
  }

  return { hours, minutes }
}

export function parseBatchStartTime(batchTiming = '') {
  const normalized = String(batchTiming || '').trim()
  if (!normalized) return null

  const [startSegment] = normalized.split('-').map((part) => String(part || '').trim())
  return parseTimeSegment(startSegment)
}

export function getBatchStartDateTime(batchTiming = '', dateKey = getAttendanceDateKey()) {
  const parsed = parseBatchStartTime(batchTiming)
  if (!parsed) return null

  const [year, month, day] = String(dateKey || getAttendanceDateKey())
    .split('-')
    .map((part) => Number(part))

  if (![year, month, day].every((value) => Number.isFinite(value))) return null

  const date = new Date(year, month - 1, day, parsed.hours, parsed.minutes, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function findFacultyRecordForStudent(student = {}, facultyRecords = []) {
  const records = Array.isArray(facultyRecords) ? facultyRecords : []
  if (!records.length) return null

  const studentFacultyId = String(student?.facultyId || '').trim().toLowerCase()
  const studentFacultyName = normalizeText(student?.facultyName || '')
  const studentCourseId = String(student?.courseId || '').trim().toLowerCase()
  const studentCourseName = normalizeText(student?.courseInterested || student?.courseName || student?.course?.name || '')
  const studentBatchName = normalizeText(student?.batchName || student?.batch || '')

  return (
    records.find((record) => {
      const recordId = String(record?.id || record?._id || record?.facultyId || '').trim().toLowerCase()
      const recordName = normalizeText(record?.facultyName || '')
      const recordCourseId = String(record?.courseId || '').trim().toLowerCase()
      const recordCourseIds = Array.isArray(record?.courseIds) ? record.courseIds.map((courseId) => String(courseId || '').trim().toLowerCase()) : []
      const batchEntries = Array.isArray(record?.batchEntries) ? record.batchEntries : []

      const batchMatch = batchEntries.some((entry) => {
        const entryBatchName = normalizeText(entry?.batchName || entry?.batch || '')
        const entryCourseId = String(entry?.courseId || '').trim().toLowerCase()
        const entryCourseName = normalizeText(entry?.courseName || '')

        return (
          (studentBatchName && entryBatchName && entryBatchName === studentBatchName) ||
          (studentCourseId && entryCourseId && entryCourseId === studentCourseId) ||
          (studentCourseName && entryCourseName && entryCourseName === studentCourseName)
        )
      })

      return (
        (studentFacultyId && recordId && studentFacultyId === recordId) ||
        (studentFacultyName && recordName && studentFacultyName === recordName) ||
        (studentCourseId && (recordCourseId === studentCourseId || recordCourseIds.includes(studentCourseId))) ||
        batchMatch
      )
    }) || null
  )
}

function findFacultyAttendanceRecord(facultyId = '', facultyName = '', profileInitials = '') {
  if (typeof window === 'undefined') return null

  const candidates = [facultyId, facultyName, profileInitials].map((value) => String(value || '').trim()).filter(Boolean)
  const todayKey = getAttendanceDateKey()

  for (const candidate of candidates) {
    const storageKey = getFacultyAttendanceStorageKey(candidate)
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (parsed?.dateKey === todayKey) {
        return parsed
      }
    } catch {
      // continue
    }
  }

  return null
}

export function resolveStudentAttendanceStatus(student = {}, facultyRecords = []) {
  const facultyRecord = findFacultyRecordForStudent(student, facultyRecords)
  const attendanceRecord = findFacultyAttendanceRecord(facultyRecord?.id || facultyRecord?.facultyId || '', facultyRecord?.facultyName || '', facultyRecord?.profileInitials || '')

  const batchEntries = Array.isArray(facultyRecord?.batchEntries) ? facultyRecord.batchEntries : []
  const studentBatchName = normalizeText(student?.batchName || student?.batch || '')
  const studentCourseId = String(student?.courseId || '').trim().toLowerCase()
  const studentCourseName = normalizeText(student?.courseInterested || student?.courseName || student?.course?.name || '')

  const matchedBatch =
    batchEntries.find((entry) => {
      const entryBatchName = normalizeText(entry?.batchName || entry?.batch || '')
      const entryCourseId = String(entry?.courseId || '').trim().toLowerCase()
      const entryCourseName = normalizeText(entry?.courseName || '')

      return (
        (studentBatchName && entryBatchName && entryBatchName === studentBatchName) ||
        (studentCourseId && entryCourseId && entryCourseId === studentCourseId) ||
        (studentCourseName && entryCourseName && entryCourseName === studentCourseName)
      )
    }) || null

  const batchTiming = String(matchedBatch?.batchTiming || '').trim()
  const batchStartDateTime = getBatchStartDateTime(batchTiming, getAttendanceDateKey())
  const loginTimestamp = attendanceRecord?.loginTimestamp ? Number(attendanceRecord.loginTimestamp) : null
  const loginDateTime = Number.isFinite(loginTimestamp) ? new Date(loginTimestamp) : null

  if (!attendanceRecord || !loginDateTime || Number.isNaN(loginDateTime.getTime())) {
    return {
      status: 'Absent',
      reason: 'No faculty login recorded for today.',
      facultyName: facultyRecord?.facultyName || student?.facultyName || '-',
      batchName: matchedBatch?.batchName || student?.batchName || student?.batch || '-',
      batchTiming,
      loginDateTime: null,
      batchStartDateTime,
    }
  }

  const sameDate = attendanceRecord.dateKey === getAttendanceDateKey()
  const isPresent = sameDate && (!batchStartDateTime || loginDateTime.getTime() <= batchStartDateTime.getTime())

  return {
    status: isPresent ? 'Present' : 'Absent',
    reason: isPresent
      ? 'Faculty logged in on time for this batch.'
      : batchStartDateTime
        ? `Faculty logged in at ${formatAttendanceTimeLabel(loginDateTime)}, after batch start ${formatAttendanceTimeLabel(batchStartDateTime)}.`
        : 'Batch timing could not be resolved.',
    facultyName: facultyRecord?.facultyName || student?.facultyName || '-',
    batchName: matchedBatch?.batchName || student?.batchName || student?.batch || '-',
    batchTiming,
    loginDateTime,
    batchStartDateTime,
  }
}
