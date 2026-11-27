import { request } from './apiClient'

function unwrap(response) {
  return response?.data ?? response ?? null
}

export async function getSalesAdminWorkClockStatus() {
  return unwrap(await request('/sales-admin/work-clock/status'))
}

export async function getSalesAdminLeaveRestrictions() {
  return unwrap(await request('/sales-admin/leave-requests/active-restrictions'))
}

export async function loginSalesAdminWorkClock() {
  return unwrap(await request('/sales-admin/work-clock/login', { method: 'POST' }))
}

export async function logoutSalesAdminWorkClock() {
  return unwrap(await request('/sales-admin/work-clock/logout', { method: 'POST' }))
}

export async function logoutSalesAdminWebsite() {
  return unwrap(await request('/sales-admin/work-clock/website-logout', { method: 'POST' }))
}
