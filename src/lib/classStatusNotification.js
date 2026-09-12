const LEAVE_TERMS = /institute\s*leave|institution\s*leave|leave\s*(declared|cancelled|canceled)/i
const LEAVE_KINDS = /institute[-_\s]?leave|class[-_\s]?cancel|leave[-_\s]?cancel/i

function firstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && String(value).trim()) return value
  }
  return ''
}

function getNestedDetails(source) {
  return source?.metadata || source?.details || source?.payload || source?.data || source?.class || {}
}

function extractTimeRange(value) {
  const text = String(value || '').trim()
  const match = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i)
  return match ? [match[1].trim(), match[2].trim()] : ['', '']
}

function toDateKey(value) {
  const text = String(value || '').trim()
  const match = text.match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0] || ''
}

function formatTime(value) {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return text
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`
}

function formatDate(dateKey) {
  if (!dateKey) return ''
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function getDayLabel(dateKey) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  const tomorrowDate = new Date(`${today}T00:00:00`)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = new Intl.DateTimeFormat('en-CA').format(tomorrowDate)
  return dateKey === today ? 'Today' : dateKey === tomorrow ? 'Tomorrow' : ''
}

export function normalizeClassStatusNotification(notification = {}) {
  const source = notification && typeof notification === 'object' ? notification : {}
  const title = String(source.title || '')
  const message = String(source.message || '')
  const kind = String(source.kind || '')
  if (!LEAVE_TERMS.test(`${title} ${message}`) && !LEAVE_KINDS.test(kind)) return notification

  const details = getNestedDetails(source)
  const classes = Array.isArray(source.affectedClasses)
    ? source.affectedClasses
    : Array.isArray(details.affectedClasses) ? details.affectedClasses : []
  const firstClass = classes[0] || {}
  const dateKey = toDateKey(
    firstValue(source, ['leaveDate', 'classDate', 'date', 'scheduledDate', 'leave_date', 'class_date', 'scheduled_date'])
    || firstValue(details, ['leaveDate', 'classDate', 'date', 'scheduledDate', 'leave_date', 'class_date', 'scheduled_date'])
    || firstValue(firstClass, ['date', 'classDate']),
  )
  const startValue = firstValue(source, ['startTime', 'classStartTime', 'fromTime', 'leaveStartTime', 'class_start_time', 'start_time', 'from_time'])
    || firstValue(details, ['startTime', 'classStartTime', 'fromTime', 'leaveStartTime', 'class_start_time', 'start_time', 'from_time'])
    || firstValue(firstClass, ['startTime', 'classStartTime', 'fromTime'])
  const endValue = firstValue(source, ['endTime', 'classEndTime', 'toTime', 'leaveEndTime', 'class_end_time', 'end_time', 'to_time'])
    || firstValue(details, ['endTime', 'classEndTime', 'toTime', 'leaveEndTime', 'class_end_time', 'end_time', 'to_time'])
    || firstValue(firstClass, ['endTime', 'classEndTime', 'toTime'])
  const range = extractTimeRange(firstValue(source, ['classTime', 'classTiming', 'scheduleTime', 'timing']) || firstValue(details, ['classTime', 'classTiming', 'scheduleTime', 'timing']))
  const start = formatTime(startValue || range[0])
  const end = formatTime(endValue || range[1])
  const time = start && end ? `${start} to ${end}` : start || end || 'the scheduled time'
  const day = getDayLabel(dateKey)
  const dateText = day || formatDate(dateKey) || 'the scheduled date'
  const reasonFromMessage = message.match(/due to\s+(.+?)(?:\.\s|$)/i)?.[1]
  const reason = String(firstValue(source, ['reason', 'leaveReason', 'cancellationReason']) || firstValue(firstClass, ['reason', 'leaveReason']) || reasonFromMessage || 'the stated reason').trim()
  const status = String(source.status || '').toLowerCase()
  const isRestored = /reschedul|proceed|restor|cancelled\s*removed|canceled\s*removed/i.test(`${title} ${message} ${kind}`)
    || /cancel+ed|cancel+ation/i.test(`${title} ${kind}`)
    || status === 'inactive' || status === 'cancelled' || status === 'canceled'
  const classSubject = day ? `${day}'s class` : `class on ${dateText}`

  return {
    ...source,
    title: isRestored ? 'Class Rescheduled / Class Proceeding as Scheduled' : 'Class Cancelled',
    message: isRestored
      ? `${classSubject} scheduled from ${time} will proceed as scheduled. The previous cancellation has been removed, and your calendar has been updated accordingly.`
      : `${classSubject} scheduled from ${time} has been cancelled due to ${reason}. Your calendar has been updated accordingly.`,
    categoryLabel: isRestored ? 'Class Rescheduled' : 'Class Cancelled',
    tone: isRestored ? 'green' : 'red',
  }
}
