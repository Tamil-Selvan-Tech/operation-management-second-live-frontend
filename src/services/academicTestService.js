import { request } from './apiClient'

const unwrap = (response) => response?.data ?? response ?? []

export const listAcademicTests = () => request('/academic-tests').then(unwrap)
export const getAcademicTest = (id) => request(`/academic-tests/${encodeURIComponent(id)}`).then(unwrap)
export const createAcademicTest = (payload) => request('/academic-tests', { method: 'POST', body: JSON.stringify(payload) }).then(unwrap)
export const updateAcademicTest = (id, payload) => request(`/academic-tests/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }).then(unwrap)
export const deleteAcademicTest = (id) => request(`/academic-tests/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(unwrap)
