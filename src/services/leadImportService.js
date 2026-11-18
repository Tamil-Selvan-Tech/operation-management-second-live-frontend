import { request, requestBlob } from './apiClient'

const POLL_INTERVAL_MS = 1200
const IMPORT_TIMEOUT_MS = 300000

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const bodyFor = ({ branchId, assignedToId } = {}) => ({
  ...(branchId ? { branchId } : {}),
  ...(assignedToId ? { assignedToId } : {}),
})

export function getLeadImportTargets(branchId = '') {
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''
  return request(`/leads/import/targets${query}`)
}

export function previewLeadImport(file, options = {}) {
  const body = new FormData()
  body.append('file', file)
  body.append('branchId', options.branchId || '')
  body.append('assignedToId', options.assignedToId || '')
  return request('/leads/import/preview', { method: 'POST', body, timeoutMs: IMPORT_TIMEOUT_MS })
}

export function revalidateLeadImport(rows, options = {}) {
  return request('/leads/import/revalidate', { method: 'POST', body: JSON.stringify({ ...bodyFor(options), rows }), timeoutMs: IMPORT_TIMEOUT_MS })
}

export function createLeadImportJob(rows, options = {}) {
  return request('/leads/import/jobs', { method: 'POST', body: JSON.stringify({ ...bodyFor(options), rows, fileName: options.fileName || null }), timeoutMs: IMPORT_TIMEOUT_MS })
}

export function getLeadImportJob(jobId) {
  return request(`/leads/import/jobs/${encodeURIComponent(jobId)}`)
}

export function listActiveLeadImports() {
  return request('/leads/import/jobs/active')
}

export async function importLeadRows(rows, options = {}) {
  const createdResponse = await createLeadImportJob(rows, options)
  const created = createdResponse?.data || createdResponse || {}
  const jobId = created?.job?.id
  if (!jobId) throw new Error('Lead import job could not be created. Please try again.')
  let errors = 0
  while (true) {
    try {
      const response = await getLeadImportJob(jobId)
      const status = response?.data || response || {}
      errors = 0
      options.onProgress?.(status)
      if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(String(status.status || '').toUpperCase())) {
        if (status.status === 'FAILED') throw new Error(status.errorMessage || 'Lead import failed.')
        return { data: status }
      }
    } catch (error) {
      if (error?.status && error.status < 500) throw error
      errors += 1
      if (errors > 8) throw error
    }
    await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

export function listPendingLeadImports(options = {}) {
  const params = new URLSearchParams()
  if (options.branchId) params.set('branchId', options.branchId)
  if (options.salesAdminId) params.set('salesAdminId', options.salesAdminId)
  if (options.page) params.set('page', String(options.page))
  if (options.limit) params.set('limit', String(options.limit))
  return request(`/leads/import/pending${params.toString() ? `?${params}` : ''}`)
}

export function getPendingLeadNextId(rowId) {
  return request(`/leads/import/pending/${encodeURIComponent(rowId)}/next-id`)
}

export function promotePendingLead(rowId, payload = {}) {
  return request(`/leads/import/pending/${encodeURIComponent(rowId)}/promote`, { method: 'POST', body: JSON.stringify(payload) })
}

export async function downloadLeadImportTemplate() {
  const response = await requestBlob('/leads/import/template', { method: 'GET' })
  if (!response?.blob) throw new Error('Unable to download the lead template right now.')
  downloadBlob(response.blob, response.fileName || 'lead-upload-template.xlsx')
  return response
}
