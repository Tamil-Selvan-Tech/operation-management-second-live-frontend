import { request, requestBlob } from './apiClient'

const unwrap = (response) => response?.data ?? response

export async function getFacultySkillOptions(params = {}) {
  const query = new URLSearchParams(params).toString()
  return unwrap(await request(`/faculty-skills/options${query ? `?${query}` : ''}`, { method: 'GET' }))
}

export async function listFacultySkillAssignments(params = {}) {
  const query = new URLSearchParams(params).toString()
  return await request(`/faculty-skills${query ? `?${query}` : ''}`, { method: 'GET' })
}

export async function createFacultySkillAssignment(payload) {
  return unwrap(await request('/faculty-skills', { method: 'POST', body: JSON.stringify(payload) }))
}

export async function updateFacultySkillAssignment(id, payload) {
  return unwrap(await request(`/faculty-skills/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }))
}

export async function cancelFacultySkillAssignment(id) {
  return unwrap(await request(`/faculty-skills/${id}/cancel`, { method: 'PATCH' }))
}

export async function getFacultySkillAssignment(id, params = {}) {
  const query = new URLSearchParams(params).toString()
  return unwrap(await request(`/faculty-skills/${id}${query ? `?${query}` : ''}`, { method: 'GET' }))
}

export async function saveFacultySkillTopic(assignmentId, topicId, payload) {
  return unwrap(await request(`/faculty-skills/${assignmentId}/topics/${topicId}`, { method: 'PATCH', body: JSON.stringify(payload) }))
}

export async function downloadFacultySkillReport(id, params = {}) {
  const query = new URLSearchParams(params).toString()
  return requestBlob(`/faculty-skills/${id}/export${query ? `?${query}` : ''}`, { method: 'GET' })
}
