import { request } from './apiClient'

export async function getSalesAdminCalendarSummary(year, month) {
  const response = await request(`/sales-admin/calendar/summary?year=${year}&month=${month}`)
  return response?.data || response || {}
}
