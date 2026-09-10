import { request } from './apiClient'
import { unwrapNotifications } from './notificationService'

export async function getFacultyNotifications() {
  const response = await request('/notifications?limit=100&page=1')
  const { data, meta } = unwrapNotifications(response)
  return { data, meta }
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
