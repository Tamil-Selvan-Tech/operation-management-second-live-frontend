import { request, requestBlob } from './apiClient'

export function submitSalesCrmReport(payload) {
  return request('/sales-crm-report-submissions', { method: 'POST', body: JSON.stringify(payload) })
}

export function listSalesCrmReportSubmissions(salesAdminId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.fromDate) params.set('fromDate', filters.fromDate)
  if (filters.toDate) params.set('toDate', filters.toDate)
  if (filters.branchId) params.set('branchId', filters.branchId)
  if (filters.reportType) params.set('reportType', filters.reportType)
  if (filters.status) params.set('status', filters.status)
  return request(`/sales-crm-report-submissions/admin/${encodeURIComponent(salesAdminId)}${params.toString() ? `?${params}` : ''}`)
}

export function getSalesCrmReportSubmission(reportId) {
  return request(`/sales-crm-report-submissions/${encodeURIComponent(reportId)}`)
}

export function downloadSalesCrmReportSubmission(reportId) {
  return requestBlob(`/sales-crm-report-submissions/${encodeURIComponent(reportId)}/download`)
}
