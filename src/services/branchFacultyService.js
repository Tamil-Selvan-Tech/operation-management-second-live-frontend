import { request } from './apiClient'

export async function listBranchFaculty(params = {}) {
  const searchParams = new URLSearchParams()
  
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.search) searchParams.set('search', params.search)
  if (params.status && params.status !== 'All') searchParams.set('status', params.status)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  
  return request(`/branch-faculty?${searchParams.toString()}`, {
    method: 'GET',
  })
}

export async function createBranchFaculty(payload) {
  return request('/branch-faculty', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateBranchFaculty(id, payload) {
  return request(`/branch-faculty/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteBranchFaculty(id) {
  return request(`/branch-faculty/${id}`, {
    method: 'DELETE',
  })
}
