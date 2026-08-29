import { request } from './apiClient'
import { FACULTY_RECORD_SYNC_EVENT } from '../data/facultyRecords'

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
  const response = await request('/branch-faculty', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FACULTY_RECORD_SYNC_EVENT))
  }

  return response
}

export async function updateBranchFaculty(id, payload) {
  const response = await request(`/branch-faculty/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FACULTY_RECORD_SYNC_EVENT))
  }

  return response
}

export async function deleteBranchFaculty(id) {
  const response = await request(`/branch-faculty/${id}`, {
    method: 'DELETE',
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FACULTY_RECORD_SYNC_EVENT))
  }

  return response
}
