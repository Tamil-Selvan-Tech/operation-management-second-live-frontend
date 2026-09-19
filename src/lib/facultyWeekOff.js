const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_KEYS = DAY_NAMES.map((day) => day.toUpperCase())

export function dateKey(date) {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function parseDateKey(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : null
}

export function startOfWeek(value) {
  const date = value instanceof Date ? new Date(value) : parseDateKey(value)
  if (!date) return null
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  date.setHours(0, 0, 0, 0)
  return date
}

export function dayIndex(day) {
  const normalized = String(day || '').trim().toUpperCase()
  const index = DAY_KEYS.indexOf(normalized)
  return index === -1 ? null : index
}

export function dateForDay(weekStart, day) {
  const date = startOfWeek(weekStart)
  const target = dayIndex(day)
  if (!date || target == null) return ''
  date.setDate(date.getDate() + ((target + 6) % 7))
  return dateKey(date)
}

export function getMondayToFridayWeek(value) {
  const start = startOfWeek(value)
  if (!start) return { weekStartDate: '', weekEndDate: '' }
  const weekStartDate = dateKey(start)
  start.setDate(start.getDate() + 4)
  return { weekStartDate, weekEndDate: dateKey(start) }
}

export function getEffectiveWeeklyOffForDate({ date, defaultWeekOffDay, approvedOverride } = {}) {
  const key = dateKey(date)
  if (approvedOverride && key === String(approvedOverride.requestedWeekOffDate || '').slice(0, 10)) {
    return { day: approvedOverride.requestedWeekOffDay, date: key, temporary: true }
  }
  const defaultDate = dateForDay(key, defaultWeekOffDay)
  return { day: defaultWeekOffDay, date: defaultDate, temporary: false }
}

export { DAY_NAMES }
