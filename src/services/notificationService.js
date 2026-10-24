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
