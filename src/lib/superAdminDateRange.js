const BUSINESS_TIME_ZONE = 'Asia/Calcutta'

const toDateKey = (date) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fromDateKey = (value) => {
  const [year, month, day] = String(value).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const addDays = (date, days) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function getBusinessTodayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(now)
}

export function getSuperAdminDateRange(preset, customStart = '', customEnd = '', todayKey = getBusinessTodayKey()) {
  const today = fromDateKey(todayKey)
  const weekday = today.getUTCDay()
  const weekStart = addDays(today, weekday === 0 ? -6 : 1 - weekday)
  const currentYear = today.getUTCFullYear()
  const currentMonth = today.getUTCMonth()
  const monthStart = new Date(Date.UTC(currentYear, currentMonth, 1))
  const previousMonthStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1))
  const previousMonthEnd = addDays(monthStart, -1)
  const yearStart = new Date(Date.UTC(currentYear, 0, 1))
  const previousYearStart = new Date(Date.UTC(currentYear - 1, 0, 1))
  const previousYearEnd = new Date(Date.UTC(currentYear - 1, 11, 31))
  const ranges = {
    today: [today, today],
    yesterday: [addDays(today, -1), addDays(today, -1)],
    thisWeek: [weekStart, addDays(weekStart, 6)],
    previousWeek: [addDays(weekStart, -7), addDays(weekStart, -1)],
    thisMonth: [monthStart, today],
    previousMonth: [previousMonthStart, previousMonthEnd],
    thisYear: [yearStart, today],
    previousYear: [previousYearStart, previousYearEnd],
  }

  if (preset === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customStart) || !/^\d{4}-\d{2}-\d{2}$/.test(customEnd) || customStart > customEnd) return null
    return { preset, startDate: customStart, endDate: customEnd }
  }
  const range = ranges[preset]
  if (!range) return null
  return { preset, startDate: toDateKey(range[0]), endDate: toDateKey(range[1]) }
}

export function formatSuperAdminDateRange(range) {
  if (!range?.startDate || !range?.endDate) return ''
  const format = (key) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(fromDateKey(key))
  return `${format(range.startDate)} – ${format(range.endDate)}`
}

export const SUPER_ADMIN_DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'previousWeek', label: 'Previous Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'previousMonth', label: 'Previous Month' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'previousYear', label: 'Previous Year' },
  { value: 'custom', label: 'Custom Range' },
]
