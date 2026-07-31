import { requestBlob } from './apiClient'

function buildQueryString(query = {}) {
  const params = new URLSearchParams()

  Object.entries(query || {}).forEach(([key, value]) => {
    const normalizedValue = String(value ?? '').trim()
    if (!normalizedValue) return
    params.set(key, normalizedValue)
  })

  return params.toString()
}

function triggerBrowserDownload(blob, fileName = 'report.xlsx') {
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(downloadUrl)
}

async function downloadReport(path, query, fallbackFileName) {
  const queryString = buildQueryString(query)
  const response = await requestBlob(queryString ? `${path}?${queryString}` : path, {
    method: 'GET',
  })

  if (!response?.blob) {
    throw new Error('Unable to download report right now.')
  }

  triggerBrowserDownload(response.blob, response.fileName || fallbackFileName)
  return response
}

export async function downloadStudentAttendanceReport(query = {}) {
  return downloadReport('/reports/student-attendance', query, 'student-attendance-report.xlsx')
}

export async function downloadBatchAttendanceReport(query = {}) {
  return downloadReport('/reports/batch-attendance', query, 'batch-attendance-report.xlsx')
}

export async function downloadFacultyAttendanceReport(query = {}) {
  return downloadReport('/reports/faculty-attendance', query, 'faculty-attendance-report.xlsx')
}

export async function downloadAllFacultyAttendanceReport(query = {}) {
  return downloadReport('/reports/all-faculty-attendance', query, 'all-faculty-attendance-report.xlsx')
}
