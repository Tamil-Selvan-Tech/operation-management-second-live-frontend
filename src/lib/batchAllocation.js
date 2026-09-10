const VALID_WEEK_DAYS = {
  WEEKDAY: new Set([1, 2, 3, 4, 5]),
  WEEKEND: new Set([0, 6]),
}

export function calculateBatchCourseEndDate(startDate, weekType, mode, durationHours) {
  if (!startDate || !VALID_WEEK_DAYS[weekType] || !['OFFLINE', 'ONLINE'].includes(mode)) return ''
  const duration = Number(durationHours)
  if (!Number.isFinite(duration) || duration <= 0) return ''
  const dailyHours = mode === 'ONLINE' ? 1 : weekType === 'WEEKEND' ? 3 : 2
  const requiredDays = Math.max(1, Math.ceil(duration / dailyHours))
  const date = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  let counted = 0
  while (counted < requiredDays) {
    if (VALID_WEEK_DAYS[weekType].has(date.getDay())) counted += 1
    if (counted < requiredDays) date.setDate(date.getDate() + 1)
  }
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
