import { request } from './apiClient'
import { requestBlob } from './apiClient'

const unwrap = (response) => response?.data ?? response ?? []

export const listAcademicTests = () => request('/academic-tests').then(unwrap)
export const getAcademicTest = (id) => request(`/academic-tests/${encodeURIComponent(id)}`).then(unwrap)
export const createAcademicTest = (payload) => request('/academic-tests', { method: 'POST', body: JSON.stringify(payload) }).then(unwrap)
export const updateAcademicTest = (id, payload) => request(`/academic-tests/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }).then(unwrap)
export const deleteAcademicTest = (id) => request(`/academic-tests/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(unwrap)

export const getAcademicTestPreparation = (academicTestItemId, branchBatchId) =>
  request(`/academic-test-preparation/items/${encodeURIComponent(academicTestItemId)}?branchBatchId=${encodeURIComponent(branchBatchId)}`).then(unwrap)

export const saveQuestionPaper = (payload) =>
  request('/academic-test-preparation/question-papers', { method: 'POST', body: JSON.stringify(payload) }).then(unwrap)

export const updateQuestionPaper = (id, payload) =>
  request(`/academic-test-preparation/question-papers/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }).then(unwrap)

export const deleteQuestionPaper = (id) =>
  request(`/academic-test-preparation/question-papers/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(unwrap)

export const saveAcademicTestProject = (payload) =>
  request('/academic-test-preparation/projects', { method: 'POST', body: JSON.stringify(payload) }).then(unwrap)

export const updateAcademicTestProject = (id, payload) =>
  request(`/academic-test-preparation/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }).then(unwrap)

export const downloadQuestionPaperPdf = (id) =>
  requestBlob(`/academic-test-preparation/question-papers/${encodeURIComponent(id)}/pdf`)
