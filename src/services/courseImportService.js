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
export async function queueCourseImportWorkbook(file, previewHash, edits) {
  const result = await request('/branch-courses/import/jobs', { method: 'POST', body: form(file, previewHash, edits), timeoutMs: 300000 })
  return result.data
}
export async function getCourseImportJob(jobId) {
  const result = await request('/branch-courses/import/jobs/' + encodeURIComponent(jobId))
  return result.data
}
export async function watchCourseImportJob(jobId, onProgress) {
  let transientErrors = 0
  while (true) {
    try {
      const job = await getCourseImportJob(jobId)
      transientErrors = 0
      onProgress?.(job)
      if (["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(String(job.status || "").toUpperCase())) return job
    } catch (error) {
      if (error?.status && error.status < 500) throw error
      transientErrors += 1
      if (transientErrors > 8) throw error
    }
    await new Promise((resolve) => window.setTimeout(resolve, 10000))
  }
}
export async function listCourseImportJobs() {
  const result = await request('/branch-courses/import/jobs')
  return result.data
}
export async function retryCourseImportJob(jobId) {
  const result = await request('/branch-courses/import/jobs/' + encodeURIComponent(jobId) + '/retry', { method: 'POST' })
  return result.data
}
export const downloadCourseImportErrors = (jobId) => download('/branch-courses/import/jobs/' + encodeURIComponent(jobId) + '/errors', {}, 'course-import-errors.xlsx')