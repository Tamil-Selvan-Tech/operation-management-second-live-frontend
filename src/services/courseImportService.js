import { request, requestBlob } from './apiClient'

export const COURSE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024
export function validateCourseFile(file) {
  if (!file || !/\.xlsx$/i.test(file.name)) return 'Choose an .xlsx workbook.'
  if (!file.size) return 'The selected workbook is empty.'
  if (file.size > COURSE_UPLOAD_MAX_BYTES) return 'The workbook must be 8 MB or smaller.'
  if (file.type && !['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream', 'application/zip', 'application/x-zip-compressed'].includes(file.type)) return 'Choose a valid Excel .xlsx workbook.'
  return ''
}
function form(file, previewHash, edits) {
  const body = new FormData()
  body.append('file', file)
  if (previewHash) body.append('previewHash', previewHash)
  if (edits && Object.keys(edits).length) body.append('edits', JSON.stringify(edits))
  return body
}
async function download(path, options, fallback) {
  let result
  try { result = await requestBlob(path, options) }
  catch (error) { throw new Error(error.body?.message || error.message || 'Unable to download the file.', { cause: error }) }
  if (!result?.blob) throw new Error('Unable to download the file. Please try again.')
  const url = URL.createObjectURL(result.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = result.fileName || fallback
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const downloadCourseTemplate = () => download('/branch-courses/import/template', {}, 'course-upload-template.xlsx')
export const downloadCourseErrors = (file, edits) => download('/branch-courses/import/error-report', { method: 'POST', body: form(file, undefined, edits) }, 'course-import-errors.xlsx')
export async function previewCourseWorkbook(file, edits) {
  const result = await request('/branch-courses/import/preview', { method: 'POST', body: form(file, undefined, edits) })
  return result.data
}
export async function importCourseWorkbook(file, previewHash, edits) {
  const result = await request('/branch-courses/import/import', { method: 'POST', body: form(file, previewHash, edits), timeoutMs: 120000 })
  return result.data
}
