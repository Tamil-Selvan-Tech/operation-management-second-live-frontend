import { request } from './apiClient'

function unwrap(response) {
  return response?.data ?? response ?? {}
}

export async function listCompletedStudentCourses(query = {}) {
  const params = new URLSearchParams()
  params.set('lifecycle', String(query.lifecycle || 'COMPLETED'))
  params.set('page', String(query.page || 1))
  params.set('limit', String(query.limit || 20))
  if (query.search) params.set('search', query.search)
  if (query.studentId) params.set('studentId', query.studentId)
  if (query.courseId) params.set('courseId', query.courseId)
  if (query.includeDetails) params.set('includeDetails', 'true')
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.sortOrder) params.set('sortOrder', query.sortOrder)

  const response = await request(`/branch-students/lifecycle?${params.toString()}`)
  const payload = unwrap(response)
  return {
    data: Array.isArray(payload) ? payload : payload.data || payload.records || payload.items || [],
    meta: response?.meta || payload.meta || null,
  }
}

export async function deleteCompletedStudent(studentId) {
  const normalizedId = String(studentId || '').trim()
  if (!normalizedId) throw new Error('Student identifier is required for delete')
  const response = await request(`/branch-students/${encodeURIComponent(normalizedId)}`, { method: 'DELETE' })
  return unwrap(response)
}
