import { request } from './apiClient'

export const listHrAccounts = () => request('/hr/accounts')
export const createHrAccount = (payload) => request('/hr/accounts', { method: 'POST', body: JSON.stringify(payload) })
export const updateHrAccount = (id, payload) => request(`/hr/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteHrAccount = (id) => request('/hr/accounts/' + id, { method: 'DELETE' })
export const resendHrInvitation = (id) => request(`/hr/accounts/${id}/resend-invitation`, { method: 'POST' })
export const getHrDashboard = (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))
  return request(`/hr/dashboard${query.size ? `?${query}` : ''}`)
}
