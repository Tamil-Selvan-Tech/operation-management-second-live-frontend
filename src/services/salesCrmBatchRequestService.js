import { request } from './apiClient'

export async function listSalesAdminBatchRequests() {
  const response = await request('/sales-admins/admissions/batch-requests')
  return Array.isArray(response?.data) ? response.data : []
}

export async function createSalesAdminBatchRequest(leadId) {
  return request(`/sales-admins/admissions/leads/${encodeURIComponent(leadId)}/batch-requests`, { method: 'POST' })
}

export async function listBranchSalesCrmBatchRequests() {
  const response = await request('/branch-batch-requests')
  return Array.isArray(response?.data) ? response.data : []
}

export async function updateBranchSalesCrmBatchRequest(requestId, payload) {
  return request(`/branch-batch-requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
