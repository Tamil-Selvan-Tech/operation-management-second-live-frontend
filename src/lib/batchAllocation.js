const VALID_WEEK_DAYS = {
  WEEKDAY: new Set([1, 2, 3, 4, 5]),
  WEEKEND: new Set([0, 6]),
}

function timeMinutes(value, period = '') {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  let hour = Number(match[1]); const minute = Number(match[2]); const meridiem = String(period || '').toUpperCase()
  if (minute > 59) return null
  if (meridiem === 'AM' && hour === 12) hour = 0
  if (meridiem === 'PM' && hour < 12) hour += 12
  return hour * 60 + minute
}

function leaveAffectsDate(leave, batch) {
  if (!leave?.leaveStartTime || !leave?.leaveEndTime) return true
  const leaveStart = timeMinutes(leave.leaveStartTime)
  const leaveEnd = timeMinutes(leave.leaveEndTime)
  const batchStart = timeMinutes(batch?.startTime, batch?.startPeriod)
  const batchEnd = timeMinutes(batch?.endTime, batch?.endPeriod)
  return leaveStart !== null && leaveEnd !== null && batchStart !== null && batchEnd !== null && batchStart < leaveEnd && batchEnd > leaveStart
}

export function calculateBatchCourseEndDate(startDate, weekType, mode, durationHours, batch = null, leaves = []) {
  if (!startDate || !VALID_WEEK_DAYS[weekType] || !['OFFLINE', 'ONLINE'].includes(mode)) return ''
  const duration = Number(durationHours)
  if (!Number.isFinite(duration) || duration <= 0) return ''
  const dailyHours = mode === 'ONLINE' ? 1 : weekType === 'WEEKEND' ? 3 : 2
  const requiredDays = Math.max(1, Math.ceil(duration / dailyHours))
  const date = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  let counted = 0
  while (counted < requiredDays) {
    const isoDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
    const cancelled = leaves.some((leave) => leave?.status === 'ACTIVE' && leave.leaveDate === isoDate && leaveAffectsDate(leave, batch))
    if (VALID_WEEK_DAYS[weekType].has(date.getDay()) && !cancelled) counted += 1
    if (counted < requiredDays) date.setDate(date.getDate() + 1)
  }
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
