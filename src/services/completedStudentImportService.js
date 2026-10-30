import { request, requestBlob } from './apiClient'

const COMPLETED_IMPORT_TIMEOUT_MS = 120000

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
  return request('/reports/completed-student-import/preview', { method: 'POST', body, timeoutMs: COMPLETED_IMPORT_TIMEOUT_MS })
}

const COMPLETED_IMPORT_CHUNK_SIZE = 5

export async function importCompletedStudents(rows, options = {}) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('No rows were selected for import.')
  const chunks = []
  for (let index = 0; index < rows.length; index += COMPLETED_IMPORT_CHUNK_SIZE) chunks.push(rows.slice(index, index + COMPLETED_IMPORT_CHUNK_SIZE))
  const aggregate = { importedRows: 0, validRows: 0, invalidRows: 0, warningRows: 0, rows: [], imported: [] }
  for (let index = 0; index < chunks.length; index += 1) {
    const response = await request('/reports/completed-student-import/import', { method: 'POST', body: JSON.stringify({ rows: chunks[index], allowMissingContact: options.allowMissingContact === true }), timeoutMs: COMPLETED_IMPORT_TIMEOUT_MS })
    const result = response?.data || response || {}
    if (!Number(result.importedRows) && result.message) throw new Error(result.message)
    aggregate.importedRows += Number(result.importedRows || 0)
    aggregate.validRows += Number(result.validRows || 0)
    aggregate.invalidRows += Number(result.invalidRows || 0)
    aggregate.warningRows += Number(result.warningRows || 0)
    if (Array.isArray(result.rows)) aggregate.rows.push(...result.rows)
    if (Array.isArray(result.imported)) aggregate.imported.push(...result.imported)
    options.onChunkComplete?.(index + 1, chunks.length, result)
  }
  return { data: aggregate }
}

export async function revalidateCompletedStudentImport(rows, options = {}) {
  return request('/reports/completed-student-import/import', { method: 'POST', body: JSON.stringify({ rows, dryRun: true, allowMissingContact: options.allowMissingContact === true }), timeoutMs: COMPLETED_IMPORT_TIMEOUT_MS })
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
