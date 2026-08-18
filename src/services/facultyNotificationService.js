import { request } from './apiClient'

export async function getFacultyNotifications() {
  return request(
    '/notifications?limit=20&page=1',
  )
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