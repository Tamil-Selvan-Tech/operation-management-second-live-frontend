import { getGovernmentHolidaysForRange } from '../data/governmentHolidays'

const WEEKDAY_DAYS = new Set([1, 2, 3, 4, 5])
const WEEKEND_DAYS = new Set([0, 6])

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
})

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  weekday: 'long',
})

export function parseCalendarDate(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }

  const normalized = String(value).trim().slice(0, 10)
  if (!normalized) return null

  const date = new Date(`${normalized}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toCalendarDateKey(value) {
  const date = parseCalendarDate(value)
  if (!date) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addCalendarDays(date, days = 0) {
  const next = new Date(date)
  next.setDate(next.getDate() + Number(days || 0))
  return next
}

export function addCalendarMonths(date, months = 0) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + Number(months || 0))
  return next
}

export function startOfCalendarMonth(date) {
  const next = new Date(date)
  next.setDate(1)
  next.setHours(0, 0, 0, 0)
  return next
}

export function endOfCalendarMonth(date) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1, 0)
  next.setHours(23, 59, 59, 999)
  return next
}

function getFirstNumber(value) {
  const match = String(value || '').match(/(\d+(\.\d+)?)/)
  return match ? Number(match[1]) : null
}

function getPositiveNumber(...values) {
  for (const value of values) {
    const directNumber = Number(value)
    if (Number.isFinite(directNumber) && directNumber > 0) return directNumber

    const parsedNumber = getFirstNumber(value)
    if (Number.isFinite(parsedNumber) && parsedNumber > 0) return parsedNumber
  }

  return 0
}

export function getCourseTotalHours(student = {}) {
  return getPositiveNumber(
    student?.totalHours,
    student?.courseHours,
    student?.hours,
    student?.course?.totalHours,
    student?.course?.hours,
  )
}

export function getCourseHoursPerDay(student = {}) {
  return getPositiveNumber(student?.hoursPerDay)
}

export function getCourseDurationMonths(student = {}) {
  const possibleValues = [
    student?.courseMasterDuration,
    student?.course?.duration,
    student?.course?.durationMonths,
    student?.course?.courseDuration,
    student?.courseDurationMonths,
    student?.courseDuration,
    student?.duration,
    student?.courseDetails?.duration,
    student?.courseDetails?.courseDuration,
  ]

  for (const value of possibleValues) {
    if (value === null || value === undefined || value === '') continue

    const directNumber = Number(value)
    if (Number.isFinite(directNumber) && directNumber > 0) {
      return Math.max(1, Math.min(60, Math.round(directNumber)))
    }

    const parsedNumber = getFirstNumber(value)
    if (Number.isFinite(parsedNumber) && parsedNumber > 0) {
      return Math.max(1, Math.min(60, Math.round(parsedNumber)))
    }
  }

  return 0
}

export function getCourseSchedule(student = {}) {
  const possibleValues = [
    student?.courseSchedule,
    student?.classSchedule,
    student?.schedule,
    student?.course?.schedule,
    student?.course?.courseSchedule,
    student?.courseDetails?.schedule,
    student?.courseDetails?.courseSchedule,
  ]

  const value = possibleValues.find((item) => String(item || '').trim()) || ''
  const normalized = String(value).trim().toLowerCase()

  if (normalized.includes('weekend')) return 'Weekend'
  if (normalized.includes('week')) return 'Weekday'
  return 'Weekday'
}

export function getCourseStartDate(student = {}) {
  return (
    parseCalendarDate(student?.courseStartDate) ||
    parseCalendarDate(student?.courseStart) ||
    parseCalendarDate(student?.startDate) ||
    parseCalendarDate(student?.admissionDate) ||
    parseCalendarDate(student?.courseDetails?.courseStartDate) ||
    parseCalendarDate(student?.courseDetails?.startDate)
  )
}

export function getCourseEndDate(student = {}, startDate = null, durationMonths = null) {
  const savedEndDate = parseCalendarDate(student?.courseEndDate)
  if (savedEndDate) return savedEndDate

  const safeStart = startDate || getCourseStartDate(student)
  if (!safeStart) return null

  const safeMonths = Number.isFinite(durationMonths) && durationMonths > 0
    ? durationMonths
    : getCourseDurationMonths(student)

  const endExclusive = addCalendarMonths(safeStart, safeMonths)
  return addCalendarDays(endExclusive, -1)
}

export function formatCalendarDate(value) {
  const date = parseCalendarDate(value)
  return date ? DATE_FORMATTER.format(date) : '-'
}

export function formatCalendarMonth(value) {
  const date = parseCalendarDate(value)
  return date ? MONTH_FORMATTER.format(date) : '-'
}

export function formatCalendarLongDate(value) {
  const date = parseCalendarDate(value)
  return date ? LONG_DATE_FORMATTER.format(date) : '-'
}

function buildAttendanceMap(student = {}) {
  const sources = [
    student?.attendanceByDate,
    student?.calendarAttendance,
    student?.dailyAttendance,
    student?.calendarEvents,
  ]

  const entries = new Map()
  const normalizeStatus = (value) => {
    const status = String(value || '').trim().toLowerCase()
    if (status === 'present') return 'Present'
    if (status === 'absent') return 'Absent'
    return ''
  }

  sources.forEach((source) => {
    if (!source) return

    if (Array.isArray(source)) {
      source.forEach((item) => {
        const key = toCalendarDateKey(item?.date || item?.attendanceDate || item?.day)
        const status = normalizeStatus(item?.status || item?.attendanceStatus)
        if (key && status) entries.set(key, status)
      })
      return
    }

    if (typeof source === 'object') {
      Object.entries(source).forEach(([key, value]) => {
        const normalizedKey = toCalendarDateKey(key)
        const status = normalizeStatus(value)
        if (normalizedKey && status) entries.set(normalizedKey, status)
      })
    }
  })

  return entries
}

function buildServerEventMap(student = {}) {
  const events = Array.isArray(student?.calendarEvents) ? student.calendarEvents : []
  const entries = new Map()

  events.forEach((event) => {
    const key = toCalendarDateKey(event?.date || event?.attendanceDate || event?.day)
    if (!key) return
    entries.set(key, event)
  })

  return entries
}

function buildCalendarMonthDays(monthDate, rangeStart, rangeEnd, schedule, holidayMap, attendanceMap, serverEventMap) {
  const firstDate = startOfCalendarMonth(monthDate)
  const lastDate = endOfCalendarMonth(monthDate)
  const cells = []
  const leadingBlankDays = firstDate.getDay()

  for (let index = 0; index < leadingBlankDays; index += 1) {
    cells.push({ isPlaceholder: true, key: `blank-${index}` })
  }

  for (let cursor = new Date(firstDate); cursor <= lastDate; cursor = addCalendarDays(cursor, 1)) {
    const dateKey = toCalendarDateKey(cursor)
    const isWithinRange = cursor >= rangeStart && cursor <= rangeEnd
    const holiday = holidayMap.get(dateKey) || null
    const attendance = attendanceMap.get(dateKey) || ''
    const serverEvent = serverEventMap.get(dateKey) || null
    const dayOfWeek = cursor.getDay()
    const localCourseDay = isWithinRange
      ? (schedule === 'Weekend' ? WEEKEND_DAYS.has(dayOfWeek) : WEEKDAY_DAYS.has(dayOfWeek))
      : false
    const isCourseDay = serverEvent ? Boolean(serverEvent.isCourseDay) : localCourseDay
    const isStartDate = dateKey === toCalendarDateKey(rangeStart)
    const isEndDate = dateKey === toCalendarDateKey(rangeEnd)

    let status = 'No Class'
    let tone = 'no-class'

    if (!isWithinRange) {
      status = 'No Class'
      tone = 'no-class'
    } else if (serverEvent?.status) {
      status = serverEvent.status
      tone = getStatusToneKey(status)
    } else if (holiday) {
      status = holiday.type === 'Leave' ? 'Leave' : 'General Holiday'
      tone = 'holiday'
    } else if (attendance === 'Present' || attendance === 'Absent') {
      status = attendance
      tone = attendance.toLowerCase()
    } else if (isCourseDay) {
      status = 'Course Day'
      tone = 'course-day'
    }

    cells.push({
      key: dateKey,
      dateKey,
      date: new Date(cursor),
      dayNumber: cursor.getDate(),
      weekday: cursor.toLocaleDateString('en-GB', { weekday: 'short' }),
      isWithinRange,
      isCourseDay,
      isStartDate,
      isEndDate,
      holidayName: serverEvent?.reason || holiday?.name || '',
      attendanceStatus: attendance,
      classHours: Number(serverEvent?.classHours || 0),
      details: serverEvent ? {
        classTime: serverEvent.classTime || serverEvent.time || serverEvent.schedule || '',
        originalClassTime: serverEvent.originalClassTime || serverEvent.classTime || serverEvent.time || '',
        extendedTime: serverEvent.extendedTime || serverEvent.extension || '',
        actualEndTime: serverEvent.actualEndTime || serverEvent.endTime || '',
        totalClassDuration: serverEvent.totalClassDuration || serverEvent.duration || serverEvent.classHours || '',
        submodule: serverEvent.submodule || serverEvent.submoduleName || '',
        attendance: serverEvent.attendanceStatus || serverEvent.attendance || attendance,
        course: serverEvent.courseName || '',
        batch: serverEvent.batchName || '',
        faculty: serverEvent.facultyName || '',
      } : null,
      status,
      tone,
      markers: [
        isStartDate ? 'Course Start Date' : '',
        isEndDate ? 'Course End Date' : '',
        serverEvent?.isReplacement ? 'Replacement Class' : '',
      ].filter(Boolean),
      isHoliday: Boolean(holiday),
    })
  }

  return cells
}

function getStatusToneKey(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'present') return 'present'
  if (normalized === 'completed') return 'present'
  if (normalized === 'class' || normalized === 'scheduled') return 'course-day'
  if (normalized === 'institute leave' || normalized === 'institute_leave') return 'holiday'
  if (normalized === 'absent') return 'absent'
  if (normalized === 'leave' || normalized === 'holiday' || normalized === 'government holiday') return 'holiday'
  if (normalized === 'course day') return 'course-day'
  return 'no-class'
}

export function buildStudentCourseCalendar(student = {}) {
  const startDate = getCourseStartDate(student)
  const durationMonths = getCourseDurationMonths(student)
  const schedule = getCourseSchedule(student)
  const totalHours = getCourseTotalHours(student)
  const hoursPerDay = getCourseHoursPerDay(student)
  const requiredTeachingDays = getPositiveNumber(student?.requiredTeachingDays, student?.totalWorkingDays)
  const actualTeachingDays = getPositiveNumber(student?.actualTeachingDays, student?.calculatedWorkingDays)
  const calendarDurationDays = getPositiveNumber(student?.calendarDurationDays)

  if (!startDate) {
    return {
      isReady: false,
      courseName: String(student?.courseName || student?.courseInterested || student?.course?.name || '').trim(),
      startDate: null,
      endDate: null,
      durationMonths,
      schedule,
      totalHours,
      hoursPerDay,
      requiredTeachingDays,
      actualTeachingDays,
      calendarDurationDays,
      monthIndex: 0,
      months: [],
      summary: {
        courseDays: 0,
        noClassDays: 0,
        holidays: 0,
        attendanceDays: 0,
        presentDays: 0,
        absentDays: 0,
      },
      holidays: [],
    }
  }

  const endDate = getCourseEndDate(student, startDate, durationMonths)
  if (!endDate) {
    return {
      isReady: false,
      courseName: String(student?.courseName || student?.courseInterested || student?.course?.name || '').trim(),
      startDate,
      endDate: null,
      durationMonths,
      schedule,
      totalHours,
      hoursPerDay,
      requiredTeachingDays,
      actualTeachingDays,
      calendarDurationDays,
      monthIndex: 0,
      months: [],
      summary: {
        courseDays: 0,
        noClassDays: 0,
        holidays: 0,
        attendanceDays: 0,
        presentDays: 0,
        absentDays: 0,
      },
      holidays: [],
    }
  }

  const rangeStart = startOfCalendarMonth(startDate)
  const rangeEnd = startOfCalendarMonth(endDate)
  const holidays = student?.scheduleSummary ? [] : getGovernmentHolidaysForRange(startDate, endDate, student?.governmentHolidays || student?.holidayList || [])
  const holidayMap = new Map(holidays.map((item) => [item.date, item]))
  ;(Array.isArray(student?.calendarEvents) ? student.calendarEvents : []).forEach((event) => {
    const eventDate = toCalendarDateKey(event?.date)
    const eventStatus = String(event?.status || '').trim().toLowerCase()
    if (!eventDate || !['government holiday', 'leave', 'institute leave'].includes(eventStatus)) return
    holidayMap.set(eventDate, {
      date: eventDate,
      name: event.reason || (eventStatus === 'leave' ? 'Branch leave' : 'Government holiday'),
      type: eventStatus === 'leave' ? 'Leave' : 'Holiday',
    })
  })
  const attendanceMap = buildAttendanceMap(student)
  const serverEventMap = buildServerEventMap(student)
  const months = []
  const summary = {
    courseDays: 0,
    noClassDays: 0,
    holidays: 0,
    attendanceDays: 0,
    presentDays: 0,
    absentDays: 0,
  }

  for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor = addCalendarMonths(cursor, 1)) {
    const monthDays = buildCalendarMonthDays(cursor, startDate, endDate, schedule, holidayMap, attendanceMap, serverEventMap)
    monthDays.forEach((day) => {
      if (day.isPlaceholder || !day.isWithinRange) return

      if (day.isCourseDay) summary.courseDays += 1
      if (day.status === 'No Class') summary.noClassDays += 1
      // Count every holiday in the course range. Scheduled holidays are also
      // removed from the Course Day total by the status precedence above.
      const attendanceStatus = day.attendanceStatus || (day.status === 'Completed' ? 'Present' : day.status)
      if (attendanceStatus === 'Present' || attendanceStatus === 'Absent') {
        summary.attendanceDays += 1
        summary[`${attendanceStatus.toLowerCase()}Days`] += 1
      }
    })

    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_FORMATTER.format(cursor),
      date: new Date(cursor),
      days: monthDays,
    })
  }

  summary.holidays = holidayMap.size

  return {
    isReady: true,
    courseName: String(student?.courseName || student?.courseInterested || student?.course?.name || '').trim(),
    startDate,
    endDate,
    durationMonths,
    schedule,
    courseMode: student?.courseMode || student?.course?.mode || '',
    totalHours,
    hoursPerDay,
    requiredTeachingDays,
    actualTeachingDays,
    calendarDurationDays,
    monthIndex: 0,
    months,
    summary,
    holidays,
  }
}
