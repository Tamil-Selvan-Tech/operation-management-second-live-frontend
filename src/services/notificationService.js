import { request } from './apiClient'

function normalizeNotificationMessage(message) {
  return String(message || '').replace(/\bINR\b/gi, '₹')
}

function normalizeFollowUpReminderTime(item) {
  const message = normalizeNotificationMessage(item?.message)
  const scheduledTime = String(item?.requestDescription || '').match(/^LEAD_FOLLOW_UP_REMINDER:[^:]+:\d{4}-\d{2}-\d{2}:(\d{2}):(\d{2})$/i)
  if (!scheduledTime) return { ...item, message }
  const hour = Number(scheduledTime[1])
  const displayTime = `${String(hour % 12 || 12).padStart(2, '0')}:${scheduledTime[2]} ${hour >= 12 ? 'pm' : 'am'}`
  return { ...item, message: message.replace(/\bat\s+\d{1,2}:\d{2}\s*(?:am|pm)\b/i, `at ${displayTime}`) }
}

export function isNotificationAvailable(item, now = new Date()) {
  if (String(item?.kind || '').toUpperCase() !== 'LEAD_FOLLOW_UP_OVERDUE') return true
  const scheduledDate = String(item?.requestDescription || '').match(/^LEAD_FOLLOW_UP_OVERDUE:[^:]+:(\d{4})-(\d{2})-(\d{2})(?::([^:]+))?$/i)
  if (!scheduledDate) return true
  const [, year, month, day, encodedTimezone] = scheduledDate
  const timezone = encodedTimezone ? decodeURIComponent(encodedTimezone) : 'Asia/Kolkata'
  const nextDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 1))
  const target = Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate(), 9)
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(target)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
  const localAtTarget = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour === 24 ? 0 : parts.hour, parts.minute, parts.second)
  const availableAt = target - (localAtTarget - target)
  return now.getTime() >= availableAt
}

export function filterNotificationsForDisplay(items, now = new Date()) {
  // Daily and overdue are separate reminders with different purposes. Keep both
  // visible when they coexist; overdue remains scheduled for the next morning.
  return (items || []).filter((item) => isNotificationAvailable(item, now))
}

// Support both flat and paginated notification responses used by the API.
export function unwrapNotifications(response) {
  const candidates = [
    response?.data?.data,
    response?.data?.notifications,
    response?.data,
    response?.notifications,
    response,
  ]
  const data = candidates.find(Array.isArray) || []
  const envelope = response?.data && !Array.isArray(response.data) ? response.data : response
  return {
    data: data.map(normalizeFollowUpReminderTime),
    meta: envelope?.meta || response?.meta || {},
  }
}

export async function getNotifications({ limit = 100, page = 1 } = {}) {
  return request(`/notifications?limit=${limit}&page=${page}`, { method: 'GET' })
}

export async function createNotification(payload = {}) {
  return request('/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
