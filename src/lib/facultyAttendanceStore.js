const ATTENDANCE_STORAGE_PREFIX = 'cispro.faculty.attendance'
export const FACULTY_ATTENDANCE_SYNC_EVENT = 'cispro:faculty-attendance-changed'

const BATCH_ATTENDANCE_STORAGE_PREFIX = 'cispro.faculty.batch-attendance'
export const FACULTY_BATCH_ATTENDANCE_SYNC_EVENT = 'cispro:faculty-batch-attendance-changed'

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

export function listFacultyAttendanceStates() {
  if (typeof window === 'undefined') return []

  try {
    const todayKey = getAttendanceDateKey()
    const states = []
    const storage = window.localStorage
    const length = Number(storage?.length || 0) || 0

    for (let index = 0; index < length; index += 1) {
      const storageKey = storage.key(index)
      if (!storageKey || !storageKey.startsWith(`${ATTENDANCE_STORAGE_PREFIX}.`)) continue

      try {
        const raw = storage.getItem(storageKey)
        if (!raw) continue

        const parsed = JSON.parse(raw)
        if (!parsed || parsed.dateKey !== todayKey) continue

        states.push(parsed)
      } catch {
        // Skip malformed records.
      }
    }

    return states
  } catch {
    return []
  }
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

function normalizeAttendanceTimestamp(value) {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function normalizeAttendanceSession(session = {}) {
  const loginTimestamp = normalizeAttendanceTimestamp(session?.loginTimestamp)
  if (loginTimestamp === null) return null

  const logoutTimestamp = normalizeAttendanceTimestamp(session?.logoutTimestamp)

  return {
    ...session,
    loginTimestamp,
    logoutTimestamp: logoutTimestamp !== null && logoutTimestamp >= loginTimestamp ? logoutTimestamp : null,
  }
}

export function normalizeAttendanceSessions(attendanceRecord = {}) {
  const sessions = Array.isArray(attendanceRecord?.sessions)
    ? attendanceRecord.sessions.map(normalizeAttendanceSession).filter(Boolean)
    : []

  if (sessions.length) {
    return sessions
  }

  const legacySession = normalizeAttendanceSession({
    loginTimestamp: attendanceRecord?.loginTimestamp,
    logoutTimestamp: attendanceRecord?.logoutTimestamp,
    logoutType: attendanceRecord?.logoutType,
    logoutReason: attendanceRecord?.logoutReason,
    workReport: attendanceRecord?.workReport,
    workCompleted: attendanceRecord?.workCompleted,
  })

  return legacySession ? [legacySession] : []
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

function getAttendanceDateTime(dateKey = getAttendanceDateKey(), timeSegment = null) {
  if (!timeSegment) return null

  const [year, month, day] = String(dateKey || getAttendanceDateKey())
    .split('-')
    .map((part) => Number(part))

  if (![year, month, day].every((value) => Number.isFinite(value))) return null

  const date = new Date(year, month - 1, day, timeSegment.hours, timeSegment.minutes, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseBatchStartTime(batchTiming = '') {
  const normalized = String(batchTiming || '').trim()
  if (!normalized) return null

  const [startSegment] = normalized.split('-').map((part) => String(part || '').trim())
  return parseTimeSegment(startSegment)
}

export function getBatchStartDateTime(batchTiming = '', dateKey = getAttendanceDateKey()) {
  return getAttendanceDateTime(dateKey, parseBatchStartTime(batchTiming))
}

export function parseBatchEndTime(batchTiming = '') {
  const normalized = String(batchTiming || '').trim()
  if (!normalized) return null

  const [, endSegment] = normalized.split('-').map((part) => String(part || '').trim())
  return parseTimeSegment(endSegment)
}

export function getBatchEndDateTime(batchTiming = '', dateKey = getAttendanceDateKey()) {
  return getAttendanceDateTime(dateKey, parseBatchEndTime(batchTiming))
}

export function resolveBatchAttendanceWindow(batchTiming = '', now = new Date()) {
  const dateKey = getAttendanceDateKey(now)
  const startDateTime = getBatchStartDateTime(batchTiming, dateKey)
  const endDateTime = getBatchEndDateTime(batchTiming, dateKey)
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime()

  if (!startDateTime || !endDateTime) {
    return {
      dateKey,
      startDateTime: startDateTime || null,
      endDateTime: endDateTime || null,
      isEditable: false,
      reason: 'Batch timing could not be resolved.',
    }
  }

  const startTime = startDateTime.getTime()
  const endTime = endDateTime.getTime()
  const isEditable = Number.isFinite(nowTime) && nowTime >= startTime && nowTime <= endTime

  return {
    dateKey,
    startDateTime,
    endDateTime,
    isEditable,
    reason: isEditable
      ? 'Attendance is open for this batch right now.'
      : nowTime < startTime
        ? 'Attendance will open when this batch starts.'
        : 'Attendance is closed for today.',
  }
}

function normalizeBatchAttendanceSlug(value = '') {
  return (
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'batch'
  )
}

export function getFacultyBatchAttendanceStorageKey(
  facultyId = '',
  facultyName = '',
  profileInitials = '',
  batchId = '',
  batchName = '',
  batchTiming = '',
) {
  const facultySlug = normalizeStorageSlug(facultyId || facultyName || profileInitials)
  const batchSlug = normalizeBatchAttendanceSlug(batchId || batchName || batchTiming)
  return `${BATCH_ATTENDANCE_STORAGE_PREFIX}.${facultySlug}.${batchSlug}`
}

export function loadFacultyBatchAttendanceState(
  facultyId = '',
  facultyName = '',
  profileInitials = '',
  batchId = '',
  batchName = '',
  batchTiming = '',
) {
  if (typeof window === 'undefined') return null

  const storageKey = getFacultyBatchAttendanceStorageKey(facultyId, facultyName, profileInitials, batchId, batchName, batchTiming)

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

export function saveFacultyBatchAttendanceState(
  facultyId = '',
  facultyName = '',
  profileInitials = '',
  batchId = '',
  batchName = '',
  batchTiming = '',
  payload = {},
) {
  if (typeof window === 'undefined') return

  const storageKey = getFacultyBatchAttendanceStorageKey(facultyId, facultyName, profileInitials, batchId, batchName, batchTiming)

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
    window.dispatchEvent(new CustomEvent(FACULTY_BATCH_ATTENDANCE_SYNC_EVENT))
  } catch {
    // Ignore storage failures and keep the UI functional.
  }
}

export function clearFacultyBatchAttendanceState(
  facultyId = '',
  facultyName = '',
  profileInitials = '',
  batchId = '',
  batchName = '',
  batchTiming = '',
) {
  if (typeof window === 'undefined') return

  const storageKey = getFacultyBatchAttendanceStorageKey(facultyId, facultyName, profileInitials, batchId, batchName, batchTiming)

  try {
    window.localStorage.removeItem(storageKey)
    window.dispatchEvent(new CustomEvent(FACULTY_BATCH_ATTENDANCE_SYNC_EVENT))
  } catch {
    // Ignore storage failures and keep the UI functional.
  }
}

export function listFacultyBatchAttendanceStates() {
  if (typeof window === 'undefined') return []

  try {
    const todayKey = getAttendanceDateKey()
    const states = []
    const storage = window.localStorage
    const length = Number(storage?.length || 0) || 0

    for (let index = 0; index < length; index += 1) {
      const storageKey = storage.key(index)
      if (!storageKey || !storageKey.startsWith(`${BATCH_ATTENDANCE_STORAGE_PREFIX}.`)) continue

      try {
        const raw = storage.getItem(storageKey)
        if (!raw) continue

        const parsed = JSON.parse(raw)
        if (!parsed || parsed.dateKey !== todayKey) continue

        states.push(parsed)
      } catch {
        // Skip malformed records.
      }
    }

    return states
  } catch {
    return []
  }
}

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

function getBatchAttendanceRecordKeys(student = {}) {
  const keys = new Set()
  const studentId = String(student?.id || '').trim()
  const studentName = String(student?.studentName || '').trim()
  const studentEmail = String(student?.emailAddress || '').trim()
  const studentMobile = String(student?.mobileNumber || '').trim()

  ;[studentId, studentName, studentEmail, studentMobile].forEach((value) => {
    const normalizedValue = String(value || '').trim().toLowerCase()
    if (normalizedValue) keys.add(normalizedValue)
  })

  return Array.from(keys)
}

function getBatchAttendanceRecordStatus(state = {}, student = {}) {
  const records = state?.records && typeof state.records === 'object' ? state.records : {}
  const recordKeys = getBatchAttendanceRecordKeys(student)

  for (const key of recordKeys) {
    const status = normalizeText(records[key] || records[String(key).trim()] || '')
    if (status === 'present') return 'Present'
    if (status === 'absent') return 'Absent'
  }

  return ''
}

function isSavedBatchAttendanceRelevantToStudent(state = {}, student = {}) {
  const facultyName = normalizeText(state?.facultyName || '')
  const studentFacultyName = normalizeText(student?.facultyName || '')
  const facultyId = String(state?.facultyId || '').trim().toLowerCase()
  const studentFacultyId = String(student?.facultyId || '').trim().toLowerCase()
  const batchName = normalizeText(state?.batchName || '')
  const batchTiming = normalizeText(state?.batchTiming || '')
  const batchId = String(state?.batchId || '').trim().toLowerCase()
  const studentBatchName = normalizeText(student?.batchName || student?.batch || '')
  const studentBatchToken = normalizeBatchToken(student?.batchName || student?.batch || '')
  const studentBatchTiming = normalizeText(student?.batchTiming || student?.batchTime || '')
  const studentBatchId = String(student?.batchId || '').trim().toLowerCase()
  const studentCourseId = String(student?.courseId || '').trim().toLowerCase()
  const studentCourseName = normalizeText(student?.courseInterested || student?.courseName || student?.course?.name || '')
  const stateCourseId = String(state?.courseId || '').trim().toLowerCase()
  const stateCourseName = normalizeText(state?.courseName || '')

  return Boolean(
    (facultyId && studentFacultyId && facultyId === studentFacultyId) ||
      (facultyName && studentFacultyName && facultyName === studentFacultyName) ||
      (batchId && studentBatchId && batchId === studentBatchId) ||
      (batchName && studentBatchName && batchName === studentBatchName) ||
      (batchName && studentBatchToken && batchName === studentBatchToken) ||
      (batchTiming && studentBatchTiming && batchTiming === studentBatchTiming) ||
      (stateCourseId && studentCourseId && stateCourseId === studentCourseId) ||
      (stateCourseName && studentCourseName && stateCourseName === studentCourseName),
  )
}

export function resolveStudentBatchAttendanceStatus(student = {}, facultyRecords = [], now = new Date()) {
  void facultyRecords
  void now

  const attendanceRecord = listFacultyBatchAttendanceStates().find((state) => isSavedBatchAttendanceRelevantToStudent(state, student)) || null
  if (!attendanceRecord) {
    return null
  }

  const status = getBatchAttendanceRecordStatus(attendanceRecord, student)
  const facultyName = attendanceRecord?.facultyName || student?.facultyName || '-'
  const batchName = attendanceRecord?.batchName || student?.batchName || student?.batch || '-'
  const batchTiming = String(attendanceRecord?.batchTiming || student?.batchTiming || student?.batchTime || '').trim()

  if (!status) {
    return {
      status: 'Absent',
      reason: 'Attendance was saved for this batch, but your record was not marked.',
      facultyName,
      batchName,
      batchTiming,
      dateKey: attendanceRecord?.dateKey || getAttendanceDateKey(),
      updatedAt: attendanceRecord?.updatedAt || null,
      records: attendanceRecord?.records || {},
    }
  }

  return {
    status,
    reason: `You were marked ${status.toLowerCase()} for today.`,
    facultyName,
    batchName,
    batchTiming,
    dateKey: attendanceRecord?.dateKey || getAttendanceDateKey(),
    updatedAt: attendanceRecord?.updatedAt || null,
    records: attendanceRecord?.records || {},
  }
}

function findFacultyRecordForStudent(student = {}, facultyRecords = []) {
  const records = Array.isArray(facultyRecords) ? facultyRecords : []
  if (!records.length) return null

  const studentFacultyId = String(student?.facultyId || '').trim().toLowerCase()
  const studentFacultyName = normalizeText(student?.facultyName || '')
  const studentCourseId = String(student?.courseId || '').trim().toLowerCase()
  const studentCourseName = normalizeText(student?.courseInterested || student?.courseName || student?.course?.name || '')
  const studentBatchName = normalizeText(student?.batchName || student?.batch || '')
  const studentBatchToken = normalizeBatchToken(student?.batchName || student?.batch || '')

  return (
    records.find((record) => {
      const recordId = String(record?.id || record?._id || record?.facultyId || '').trim().toLowerCase()
      const recordName = normalizeText(record?.facultyName || '')
      const recordCourseId = String(record?.courseId || '').trim().toLowerCase()
      const recordCourseIds = Array.isArray(record?.courseIds) ? record.courseIds.map((courseId) => String(courseId || '').trim().toLowerCase()) : []
      const batchEntries = Array.isArray(record?.batchEntries) ? record.batchEntries : []

      const batchMatch = batchEntries.some((entry) => {
        const entryBatchName = normalizeText(entry?.batchName || entry?.batch || '')
        const entryBatchToken = normalizeBatchToken(entry?.batchName || entry?.batch || '')
        const entryCourseId = String(entry?.courseId || '').trim().toLowerCase()
        const entryCourseName = normalizeText(entry?.courseName || '')

        return (
          (studentBatchName && entryBatchName && entryBatchName === studentBatchName) ||
          (studentBatchToken && entryBatchToken && entryBatchToken === studentBatchToken) ||
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

function getSessionEndDateTime(session = {}, dateKey = getAttendanceDateKey()) {
  if (session?.logoutTimestamp) {
    const logoutDateTime = new Date(Number(session.logoutTimestamp))
    if (!Number.isNaN(logoutDateTime.getTime())) {
      return logoutDateTime
    }
  }

  const [year, month, day] = String(dateKey || getAttendanceDateKey())
    .split('-')
    .map((part) => Number(part))

  if (![year, month, day].every((value) => Number.isFinite(value))) return null

  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999)
  return Number.isNaN(endOfDay.getTime()) ? null : endOfDay
}

function isBatchCoveredBySession(batchStartDateTime = null, batchEndDateTime = null, session = {}, dateKey = getAttendanceDateKey()) {
  if (!batchStartDateTime || !batchEndDateTime) return false

  const loginDateTime = new Date(Number(session?.loginTimestamp))
  if (Number.isNaN(loginDateTime.getTime())) return false

  const sessionEndDateTime = getSessionEndDateTime(session, dateKey)
  if (!sessionEndDateTime) return false

  const batchStartTime = batchStartDateTime.getTime()
  const batchEndTime = batchEndDateTime.getTime()
  const sessionStartTime = loginDateTime.getTime()
  const sessionEndTime = sessionEndDateTime.getTime()

  return sessionStartTime < batchEndTime && sessionEndTime > batchStartTime
}

function isSessionActiveNow(session = {}, now = new Date()) {
  const loginDateTime = new Date(Number(session?.loginTimestamp))
  if (Number.isNaN(loginDateTime.getTime())) return false

  const logoutTimestamp = normalizeAttendanceTimestamp(session?.logoutTimestamp)
  if (logoutTimestamp === null) {
    return loginDateTime.getTime() <= now.getTime()
  }

  const logoutDateTime = new Date(logoutTimestamp)
  if (Number.isNaN(logoutDateTime.getTime())) return false

  return loginDateTime.getTime() <= now.getTime() && now.getTime() < logoutDateTime.getTime()
}

function isAttendanceRecordRelevantToStudent(attendanceRecord = {}, student = {}) {
  const facultyName = normalizeText(attendanceRecord?.facultyName || '')
  const studentFacultyName = normalizeText(student?.facultyName || '')
  const studentBatchName = normalizeText(student?.batchName || student?.batch || '')
  const studentBatchToken = normalizeBatchToken(student?.batchName || student?.batch || '')

  if (studentFacultyName && facultyName && facultyName === studentFacultyName) {
    return true
  }

  const sessions = normalizeAttendanceSessions(attendanceRecord)
  if (sessions.length) {
    const studentCourseId = String(student?.courseId || '').trim().toLowerCase()
    const studentCourseName = normalizeText(student?.courseInterested || student?.courseName || student?.course?.name || '')
    const batchEntries = Array.isArray(attendanceRecord?.batchEntries) ? attendanceRecord.batchEntries : []

    return batchEntries.some((entry) => {
      const entryBatchName = normalizeText(entry?.batchName || entry?.batch || '')
      const entryBatchToken = normalizeBatchToken(entry?.batchName || entry?.batch || '')
      const entryCourseId = String(entry?.courseId || '').trim().toLowerCase()
      const entryCourseName = normalizeText(entry?.courseName || '')

      return (
        (studentBatchName && entryBatchName && entryBatchName === studentBatchName) ||
        (studentBatchToken && entryBatchToken && entryBatchToken === studentBatchToken) ||
        (studentCourseId && entryCourseId && entryCourseId === studentCourseId) ||
        (studentCourseName && entryCourseName && entryCourseName === studentCourseName)
      )
    })
  }

  return false
}

function getActiveSessionFromAttendanceRecord(attendanceRecord = {}, now = new Date()) {
  const sessions = normalizeAttendanceSessions(attendanceRecord)
  return sessions.find((session) => isSessionActiveNow(session, now)) || null
}

export function resolveFacultyBatchAttendanceStatus(facultyRecord = {}, batch = {}, dateKey = getAttendanceDateKey()) {
  const attendanceRecord = findFacultyAttendanceRecord(
    facultyRecord?.id || facultyRecord?.facultyId || '',
    facultyRecord?.facultyName || '',
    facultyRecord?.profileInitials || '',
  )
  const batchTiming = String(batch?.batchTiming || batch?.timing || '').trim()
  const batchStartDateTime = getBatchStartDateTime(batchTiming, dateKey)
  const batchEndDateTime = getBatchEndDateTime(batchTiming, dateKey)
  const sessions = normalizeAttendanceSessions(attendanceRecord)
  const facultyName = facultyRecord?.facultyName || '-'
  const batchName = batch?.batchName || batch?.label || '-'

  if (!attendanceRecord || !sessions.length) {
    return {
      status: 'Absent',
      reason: 'No faculty login recorded for today.',
      facultyName,
      batchName,
      batchTiming,
      loginDateTime: null,
      batchStartDateTime,
      sessions,
    }
  }

  if (!batchStartDateTime) {
    return {
      status: 'Absent',
      reason: 'Batch timing could not be resolved.',
      facultyName,
      batchName,
      batchTiming,
      loginDateTime: null,
      batchStartDateTime: null,
      sessions,
    }
  }

  const matchedSession = sessions.find((session) => isBatchCoveredBySession(batchStartDateTime, batchEndDateTime, session, dateKey)) || null
  const loginDateTime = matchedSession ? new Date(Number(matchedSession.loginTimestamp)) : null

  return {
    status: matchedSession ? 'Present' : 'Absent',
    reason: matchedSession
      ? `Faculty was logged in at ${formatAttendanceTimeLabel(loginDateTime)} for this batch.`
      : 'Faculty was not logged in at batch start.',
    facultyName,
    batchName,
    batchTiming,
    loginDateTime,
    batchStartDateTime,
    sessions,
  }
}

export function resolveCurrentFacultyAttendanceStatus(student = {}, facultyRecords = [], now = new Date()) {
  const facultyRecord = findFacultyRecordForStudent(student, facultyRecords)
  const directAttendanceRecord = findFacultyAttendanceRecord(
    facultyRecord?.id || facultyRecord?.facultyId || '',
    facultyRecord?.facultyName || '',
    facultyRecord?.profileInitials || '',
  )

  const attendanceRecord =
    directAttendanceRecord ||
    listFacultyAttendanceStates().find((record) => isAttendanceRecordRelevantToStudent(record, student)) ||
    null

  const batchEntries = Array.isArray(facultyRecord?.batchEntries) ? facultyRecord.batchEntries : []
  const studentBatchName = normalizeText(student?.batchName || student?.batch || '')
  const studentBatchToken = normalizeBatchToken(student?.batchName || student?.batch || '')
  const studentCourseId = String(student?.courseId || '').trim().toLowerCase()
  const studentCourseName = normalizeText(student?.courseInterested || student?.courseName || student?.course?.name || '')

  const matchedBatch =
    batchEntries.find((entry) => {
      const entryBatchName = normalizeText(entry?.batchName || entry?.batch || '')
      const entryBatchToken = normalizeBatchToken(entry?.batchName || entry?.batch || '')
      const entryCourseId = String(entry?.courseId || '').trim().toLowerCase()
      const entryCourseName = normalizeText(entry?.courseName || '')

      return (
        (studentBatchName && entryBatchName && entryBatchName === studentBatchName) ||
        (studentBatchToken && entryBatchToken && entryBatchToken === studentBatchToken) ||
        (studentCourseId && entryCourseId && entryCourseId === studentCourseId) ||
        (studentCourseName && entryCourseName && entryCourseName === studentCourseName)
      )
    }) || null

  const sessions = normalizeAttendanceSessions(attendanceRecord)
  const activeSession = getActiveSessionFromAttendanceRecord(attendanceRecord, now)

  return {
    status: activeSession ? 'Present' : 'Absent',
    reason: activeSession ? 'Faculty is currently logged in.' : 'Faculty is not logged in right now.',
    facultyName: facultyRecord?.facultyName || student?.facultyName || '-',
    batchName: matchedBatch?.batchName || student?.batchName || student?.batch || '-',
    batchTiming: String(matchedBatch?.batchTiming || '').trim(),
    loginDateTime: activeSession?.loginTimestamp ? new Date(Number(activeSession.loginTimestamp)) : null,
    batchStartDateTime: null,
    sessions,
  }
}

export function resolveAnyCurrentFacultyAttendanceStatus(facultyName = '', now = new Date()) {
  const normalizedFacultyName = normalizeText(facultyName)
  const attendanceRecord =
    listFacultyAttendanceStates().find((record) => {
      const recordFacultyName = normalizeText(record?.facultyName || '')
      return normalizedFacultyName ? recordFacultyName === normalizedFacultyName : Boolean(getActiveSessionFromAttendanceRecord(record, now))
    }) ||
    listFacultyAttendanceStates().find((record) => getActiveSessionFromAttendanceRecord(record, now)) ||
    null

  if (!attendanceRecord) {
    return {
      status: 'Absent',
      reason: 'No faculty login recorded for today.',
      facultyName: facultyName || '-',
      batchName: '-',
      batchTiming: '',
      loginDateTime: null,
      batchStartDateTime: null,
      sessions: [],
    }
  }

  const activeSession = getActiveSessionFromAttendanceRecord(attendanceRecord, now)
  return {
    status: activeSession ? 'Present' : 'Absent',
    reason: activeSession ? 'Faculty is currently logged in.' : 'Faculty is not logged in right now.',
    facultyName: attendanceRecord?.facultyName || facultyName || '-',
    batchName: '-',
    batchTiming: '',
    loginDateTime: activeSession?.loginTimestamp ? new Date(Number(activeSession.loginTimestamp)) : null,
    batchStartDateTime: null,
    sessions: normalizeAttendanceSessions(attendanceRecord),
  }
}

export function resolveStudentAttendanceStatus(student = {}, facultyRecords = []) {
  const batchAttendance = resolveStudentBatchAttendanceStatus(student, facultyRecords)
  if (batchAttendance) {
    return batchAttendance
  }

  const currentAttendance = resolveCurrentFacultyAttendanceStatus(student, facultyRecords)
  if (currentAttendance?.status === 'Present') {
    return currentAttendance
  }

  const fallbackAttendance = resolveAnyCurrentFacultyAttendanceStatus(student?.facultyName || currentAttendance?.facultyName || '')
  if (fallbackAttendance?.status === 'Present') {
    return {
      ...fallbackAttendance,
      batchName: currentAttendance?.batchName || fallbackAttendance.batchName || student?.batchName || student?.batch || '-',
      batchTiming: currentAttendance?.batchTiming || fallbackAttendance.batchTiming || student?.batchTiming || student?.batchTime || '',
    }
  }

  return currentAttendance
}
