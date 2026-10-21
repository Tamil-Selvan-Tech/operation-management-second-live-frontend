import { request, requestBlob } from './apiClient'

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

export async function downloadCompletedStudentTemplate() {
  const response = await requestBlob('/reports/completed-student-import/template', { method: 'GET' })
  if (!response?.blob) throw new Error('Unable to download the template right now.')
  downloadBlob(response.blob, response.fileName || 'completed-student-upload-template.xlsx')
  return response
}

export async function previewCompletedStudentImport(file) {
  const body = new FormData()
  body.append('file', file)
  return request('/reports/completed-student-import/preview', { method: 'POST', body })
}

export async function importCompletedStudents(rows, options = {}) {
  return request('/reports/completed-student-import/import', { method: 'POST', body: JSON.stringify({ rows, allowMissingContact: options.allowMissingContact === true }) })
}

export async function revalidateCompletedStudentImport(rows) {
  return request('/reports/completed-student-import/import', { method: 'POST', body: JSON.stringify({ rows, dryRun: true }) })
}

export async function downloadCompletedStudentFailedRows(rows) {
  const response = await requestBlob('/reports/completed-student-import/failed-rows', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
  if (!response?.blob) throw new Error('Unable to download the error report right now.')
  downloadBlob(response.blob, response.fileName || 'completed-student-import-errors.xlsx')
  return response
}
