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

export function getCourseWeeklyOffDay(student = {}) {
  const value = [
    student?.weeklyOffDay,
    student?.facultyWeeklyOffDay,
    student?.batchWeeklyOffDay,
    student?.batch?.weeklyOffDay,
    student?.faculty?.weeklyOffDay,
    student?.course?.weeklyOffDay,
    student?.scheduleSummary?.weeklyOffDay,
    student?.scheduleSummary?.facultyWeeklyOffDay,
    student?.scheduleSummary?.batch?.weeklyOffDay,
  ].find((item) => String(item || '').trim())
  const normalized = String(value || '').trim().toLowerCase()
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days.find((day) => normalized === day || normalized.startsWith(day.slice(0, 3))) || ''
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
    entries.set(key, [...(entries.get(key) || []), event])
  })

  return entries
}

function getCalendarEventType(event = {}) {
  return String(event?.eventType || event?.assignmentType || event?.sessionType || event?.code || event?.type || event?.status || '')
    .trim()
    .toUpperCase()
    .replace(/[- ]/g, '_')
}

function isReplacementCalendarEvent(event = {}) {
  const type = getCalendarEventType(event)
  return Boolean(event?.isReplacement) || type.includes('REPLAC') || type === 'REASSIGNED' || type === 'COMBINED'
}

function isKickoffCalendarEvent(event = {}) {
  const type = getCalendarEventType(event)
  return type.includes('KICKOFF') || type.includes('KICK_OFF')
}

function pickCalendarEvent(events = []) {
  return [...events].sort((left, right) => {
    const priority = (event) => isReplacementCalendarEvent(event) ? 3 : isKickoffCalendarEvent(event) ? 2 : 1
    return priority(right) - priority(left)
  })[0] || null
}

function formatSessionTime(value) {
  if (value === null || value === undefined || value === '') return ''
  const raw = String(value).trim()
  const numeric = Number(raw)
  if (/^\d+$/.test(raw) && Number.isFinite(numeric)) {
    const minutes = numeric >= 0 && numeric <= 1439 ? numeric : null
    if (minutes !== null) {
      const hour = Math.floor(minutes / 60)
      const minute = minutes % 60
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`
    }
  }
  const match = raw.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return raw
  let hour = Number(match[1])
  const minute = match[2]
  const period = match[3]?.toUpperCase()
  if (!period) {
    const inferredPeriod = hour >= 12 ? 'PM' : 'AM'
    hour %= 12
    return `${String(hour || 12).padStart(2, '0')}:${minute} ${inferredPeriod}`
  }
  return `${String(hour).padStart(2, '0')}:${minute} ${period}`
}

function formatSessionRange(start, end) {
  const startValue = formatSessionTime(start)
  const endValue = formatSessionTime(end)
  return startValue && endValue ? `${startValue} - ${endValue}` : startValue || endValue
}

function buildCalendarMonthDays(monthDate, rangeStart, rangeEnd, schedule, holidayMap, attendanceMap, serverEventMap, weeklyOffIndex = -1) {
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
    const serverEvents = serverEventMap.get(dateKey) || []
    const serverEvent = pickCalendarEvent(serverEvents)
    const dayOfWeek = cursor.getDay()
    const localCourseDay = isWithinRange
      ? (schedule === 'Weekend' ? WEEKEND_DAYS.has(dayOfWeek) : WEEKDAY_DAYS.has(dayOfWeek)) && dayOfWeek !== weeklyOffIndex
      : false
    const isCalendarClassEvent = serverEvent && (
      isReplacementCalendarEvent(serverEvent)
      || isKickoffCalendarEvent(serverEvent)
      || ['CLASS', 'SCHEDULED', 'COMPLETED', 'PRESENT', 'REASSIGNED', 'COMBINED', 'RESCHEDULED', 'RESCHEDULED_ORIGINAL'].includes(getCalendarEventType(serverEvent))
    )
    const isCourseDay = isCalendarClassEvent ? true : serverEvent ? Boolean(serverEvent.isCourseDay) : localCourseDay
    const isStartDate = dateKey === toCalendarDateKey(rangeStart)
    const isEndDate = dateKey === toCalendarDateKey(rangeEnd)

    let status = 'No Class'
    let tone = 'no-class'

    if (!isWithinRange) {
      status = 'No Class'
      tone = 'no-class'
    } else if (attendance === 'Present' || attendance === 'Absent') {
      // Attendance is persisted per student and date. It must remain the
      // displayed status even when a generic calendar event exists for the
      // same date.
      status = attendance
      tone = attendance.toLowerCase()
    } else if (serverEvent?.status || isReplacementCalendarEvent(serverEvent) || isKickoffCalendarEvent(serverEvent)) {
      status = serverEvent.status || (isReplacementCalendarEvent(serverEvent) ? 'Replacement' : 'Kickoff')
      tone = getStatusToneKey(status)
    } else if (weeklyOffIndex >= 0 && dayOfWeek === weeklyOffIndex) {
      status = 'Faculty Weekly Off'
      tone = 'holiday'
    } else if (holiday) {
      status = holiday.type === 'Leave' ? 'Leave' : 'General Holiday'
      tone = 'holiday'
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
        classTime: serverEvent.classTime || serverEvent.time || serverEvent.schedule || formatSessionRange(serverEvent.startTime, serverEvent.endTime),
        originalClassTime: serverEvent.originalClassTime || serverEvent.classTime || serverEvent.time || '',
        extendedTime: serverEvent.extendedTime || serverEvent.extension || '',
        actualEndTime: serverEvent.actualEndTime || serverEvent.endTime || '',
        totalClassDuration: serverEvent.totalClassDuration || serverEvent.duration || serverEvent.classHours || '',
        submodule: serverEvent.submodule || serverEvent.submoduleName || serverEvent.moduleName || serverEvent.topicName || '',
        attendance: serverEvent.attendanceStatus || serverEvent.attendance || attendance,
        course: serverEvent.courseName || '',
        batch: serverEvent.batchName || '',
        faculty: serverEvent.facultyName || serverEvent.replacementFacultyName || serverEvent.combinedFacultyName || '',
        originalFaculty: serverEvent.originalFacultyName || '',
        assignmentType: serverEvent.assignmentType === 'COMBINED' || getCalendarEventType(serverEvent) === 'COMBINED'
          ? 'Combined Class'
          : serverEvent.assignmentType === 'REPLACEMENT' || isReplacementCalendarEvent(serverEvent)
            ? 'Replacement/Reassignment'
            : serverEvent.assignmentType === 'RESCHEDULED' || getCalendarEventType(serverEvent) === 'RESCHEDULED'
              ? 'Rescheduled'
              : isKickoffCalendarEvent(serverEvent) ? 'Faculty Kickoff' : '',
        originalDate: serverEvent.originalDate || '',
        originalTime: serverEvent.originalStartTime && serverEvent.originalEndTime ? formatSessionRange(serverEvent.originalStartTime, serverEvent.originalEndTime) : '',
        rescheduledDate: serverEvent.rescheduledDate || '',
        rescheduledTime: serverEvent.rescheduledStartTime && serverEvent.rescheduledEndTime ? formatSessionRange(serverEvent.rescheduledStartTime, serverEvent.rescheduledEndTime) : '',
      } : null,
      status,
      tone,
      markers: [
        isStartDate ? 'Course Start Date' : '',
        isEndDate ? 'Course End Date' : '',
        isReplacementCalendarEvent(serverEvent) ? 'Replacement Class' : '',
        isKickoffCalendarEvent(serverEvent) ? 'Faculty Kickoff' : '',
        serverEvent?.code === 'REASSIGNED' ? 'Reassigned Class' : '',
        serverEvent?.code === 'RESCHEDULED' ? 'Rescheduled' : '',
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
  if (normalized === 'class' || normalized === 'scheduled' || normalized === 'reassigned' || normalized === 'replaced' || normalized === 'replacement' || normalized === 'combined' || normalized === 'rescheduled' || normalized.includes('kickoff') || normalized.includes('kick-off')) return 'course-day'
  if (normalized === 'institute leave' || normalized === 'institute_leave') return 'holiday'
  if (normalized === 'absent') return 'absent'
  if (normalized === 'leave' || normalized === 'holiday' || normalized === 'government holiday' || normalized === 'faculty weekly off') return 'holiday'
  if (normalized === 'course day') return 'course-day'
  return 'no-class'
}

export function buildStudentCourseCalendar(student = {}) {
  const startDate = getCourseStartDate(student)
  const durationMonths = getCourseDurationMonths(student)
  const schedule = getCourseSchedule(student)
  const weeklyOffDay = getCourseWeeklyOffDay(student)
  const weeklyOffIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weeklyOffDay)
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
    facultyWeeklyOffDays: 0,
  }

  for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor = addCalendarMonths(cursor, 1)) {
    const monthDays = buildCalendarMonthDays(cursor, startDate, endDate, schedule, holidayMap, attendanceMap, serverEventMap, weeklyOffIndex)
    monthDays.forEach((day) => {
      if (day.isPlaceholder || !day.isWithinRange) return

      if (day.isCourseDay) summary.courseDays += 1
      if (day.status === 'No Class') summary.noClassDays += 1
      if (String(day.status || '').toLowerCase().replace(/_/g, ' ') === 'faculty weekly off') summary.facultyWeeklyOffDays += 1
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
    weeklyOffDay,
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
