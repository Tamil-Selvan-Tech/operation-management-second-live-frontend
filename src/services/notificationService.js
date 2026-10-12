import { request } from './apiClient'

function normalizeNotificationMessage(message) {
  return String(message || '').replace(/\bINR\b/gi, '₹')
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
    data: data.map((item) => ({ ...item, message: normalizeNotificationMessage(item?.message) })),
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
