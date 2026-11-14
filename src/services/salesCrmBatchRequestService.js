import { request } from './apiClient'

export async function listSalesAdminBatchRequests(salesAdminId = '') {
  const suffix = salesAdminId ? '?salesAdminId=' + encodeURIComponent(salesAdminId) : ''
  const response = await request('/sales-admins/admissions/batch-requests' + suffix)
  return Array.isArray(response?.data) ? response.data : []
}

export async function createSalesAdminBatchRequest(leadId, salesAdminId = '') {
  const suffix = salesAdminId ? '?salesAdminId=' + encodeURIComponent(salesAdminId) : ''
  return request('/sales-admins/admissions/leads/' + encodeURIComponent(leadId) + '/batch-requests' + suffix, { method: 'POST' })
}

export async function resendSalesAdminBatchRequest(requestId, salesAdminId = '') {
  const suffix = salesAdminId ? '?salesAdminId=' + encodeURIComponent(salesAdminId) : ''
  return request('/sales-admins/admissions/batch-requests/' + encodeURIComponent(requestId) + '/resend' + suffix, { method: 'POST' })
}

export async function listBranchSalesCrmBatchRequests() {
  const response = await request('/branch-batch-requests')
  return Array.isArray(response?.data) ? response.data : []
}

export async function updateBranchSalesCrmBatchRequest(requestId, payload) {
  return request('/branch-batch-requests/' + encodeURIComponent(requestId), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}