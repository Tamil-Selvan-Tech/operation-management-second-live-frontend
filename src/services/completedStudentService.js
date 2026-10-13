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
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.sortOrder) params.set('sortOrder', query.sortOrder)

  const response = await request(`/branch-students/lifecycle?${params.toString()}`)
  const payload = unwrap(response)
  return {
    data: Array.isArray(payload) ? payload : payload.data || payload.records || payload.items || [],
    meta: response?.meta || payload.meta || null,
  }
}
