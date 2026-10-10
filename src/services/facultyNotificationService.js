import { request } from './apiClient'
import { unwrapNotifications } from './notificationService'

export async function getFacultyNotifications() {
  try {
    const response = await request('/notifications?limit=100&page=1')
    const { data, meta } = unwrapNotifications(response)
    return { data, meta }
  } catch {
    // The API currently rejects legacy notification kinds with a Prisma enum
    // validation error. Keep the faculty dashboard usable until the backend
    // enum/filter is corrected.
    return { data: [], meta: { total: 0, unread: 0, page: 1, limit: 100 } }
  }
}

export async function markFacultyNotificationsAsRead(
  notificationIds = [],
) {
  return request(
    '/notifications/mark-read',
    {
      method: 'PATCH',
      body: JSON.stringify({
        notificationIds,
      }),
    },
  )
}
