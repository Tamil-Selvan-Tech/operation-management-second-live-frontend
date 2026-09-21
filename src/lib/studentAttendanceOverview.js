import { addCalendarDays, buildStudentCourseCalendar, parseCalendarDate, toCalendarDateKey } from './studentCalendar'

const NON_ATTENDANCE_STATUSES = new Set([
  'no class',
  'faculty weekly off',
  'week off',
  'holiday',
  'general holiday',
  'leave',
  'institute leave',
])

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase().replace(/[_-]/g, ' ')
  if (status === 'present') return 'Present'
  if (status === 'absent') return 'Absent'
  return ''
}

function getDate(value) {
  return parseCalendarDate(value)
}

function getRange(item, fallbackStart, fallbackEnd) {
  const start = getDate(item?.startDate || item?.weekStart || item?.monthStart || item?.from) || fallbackStart
  const end = getDate(item?.endDate || item?.weekEnd || item?.monthEnd || item?.to) || fallbackEnd
  if (start && end && start <= end) return { start, end }
  return null
}

function extractStatuses(value, result = new Map()) {
  if (!value || typeof value !== 'object') return result
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const date = toCalendarDateKey(entry?.date || entry?.dateKey || entry?.attendanceDate || entry?.day)
      const status = normalizeStatus(entry?.status || entry?.attendanceStatus || entry?.result)
      if (date && status) result.set(date, status)
      extractStatuses(entry, result)
    })
    return result
  }
  Object.entries(value).forEach(([key, entry]) => {
    const date = toCalendarDateKey(key)
    const status = normalizeStatus(entry)
    if (date && status) result.set(date, status)
    if (entry && typeof entry === 'object') extractStatuses(entry, result)
  })
  return result
}

function dateRangeDays(start, end) {
  const days = []
  for (let cursor = new Date(start); cursor <= end; cursor = addCalendarDays(cursor, 1)) days.push(toCalendarDateKey(cursor))
  return days
}

function isScheduledAttendanceDay(day) {
  if (!day?.isCourseDay) return false
  const status = String(day.status || '').trim().toLowerCase().replace(/[_-]/g, ' ')
  return !NON_ATTENDANCE_STATUSES.has(status) && !day.isHoliday
}

function calculateItem(item, calendar, statuses) {
  const range = getRange(item, calendar?.startDate, calendar?.endDate)
  if (!range) return item

  const calendarDays = new Map((calendar?.months || []).flatMap((month) => month.days || []).map((day) => [day.dateKey, day]))
  const scheduledDates = dateRangeDays(range.start, range.end).filter((date) => isScheduledAttendanceDay(calendarDays.get(date)))
  const scheduledDays = scheduledDates.length
  if (!scheduledDays) return { ...item, presentPercentage: 0, absentPercentage: 0, presentPercent: 0, absentPercent: 0 }

  const presentDays = scheduledDates.filter((date) => statuses.get(date) === 'Present').length
  const absentDays = scheduledDates.filter((date) => statuses.get(date) === 'Absent').length
  const presentPercentage = Math.round((presentDays / scheduledDays) * 100)
  const absentPercentage = Math.round((absentDays / scheduledDays) * 100)
  return { ...item, scheduledDays, totalScheduledDays: scheduledDays, presentDays, absentDays, presentPercentage, absentPercentage, presentPercent: presentPercentage, absentPercent: absentPercentage }
}

export function normalizeStudentAttendanceOverview(overview, student) {
  if (!overview || !student) return overview
  const calendar = buildStudentCourseCalendar(student)
  if (!calendar?.isReady) return overview
  const statuses = extractStatuses(student?.attendanceByDate)
  extractStatuses(student?.calendarAttendance, statuses)
  extractStatuses(student?.dailyAttendance, statuses)
  extractStatuses(student?.calendarEvents, statuses)
  extractStatuses(overview?.attendance, statuses)
  extractStatuses(overview?.attendanceRecords, statuses)
  extractStatuses(overview?.records, statuses)
  extractStatuses(overview?.weekly, statuses)
  extractStatuses(overview?.monthly, statuses)

  const normalizePeriod = (period) => Array.isArray(overview?.[period])
    ? overview[period].map((item) => calculateItem(item, calendar, statuses))
    : overview?.[period]

  const normalized = { ...overview, weekly: normalizePeriod('weekly'), monthly: normalizePeriod('monthly') }
  const overall = overview?.overall
  if (overall && calendar.startDate && calendar.endDate) {
    normalized.overall = calculateItem({ ...overall, startDate: calendar.startDate, endDate: calendar.endDate }, calendar, statuses)
  }
  return normalized
}
