import { request, requestBlob } from './apiClient'

const data = (response) => response?.data ?? response ?? []

export const listFacultyExamCourses = () => request('/exams/faculty/courses').then(data)
export const listFacultyExamBatches = (courseId) => request(`/exams/faculty/courses/${courseId}/batches`).then(data)
export const listFacultyExamModules = (courseId) => request(`/exams/faculty/courses/${courseId}/modules`).then(data)
export const listFacultyTests = () => request('/exams/faculty/tests').then(data)
export const createFacultyTest = (payload) => request('/exams/faculty/tests', { method: 'POST', body: JSON.stringify(payload) }).then(data)
export const updateFacultyTest = (testId, payload) => request(`/exams/faculty/tests/${testId}`, { method: 'PUT', body: JSON.stringify(payload) }).then(data)
export const getFacultyTest = (testId) => request(`/exams/faculty/tests/${testId}`).then(data)
export const downloadFacultyQuestionPaper = (testId) => requestBlob(`/exams/faculty/tests/${testId}/pdf`)
export const listTestSubmissions = (testId, scheduleId) => request(`/exams/faculty/tests/${testId}/schedules/${scheduleId}/submissions`).then(data)
export const getTestSubmission = (testId, scheduleId, attemptId) => request(`/exams/faculty/tests/${testId}/schedules/${scheduleId}/submissions/${attemptId}`).then(data)
export const getFacultyExamReports = (filters = {}) => { const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)); return request(`/exams/faculty/exam-reports${params.toString() ? `?${params}` : ''}`).then(data) }
export const getFacultyStudentExamReport = (moduleId, batchId) => request(`/exams/faculty/exam-reports/${moduleId}/${batchId}`).then(data)

export const listStudentTests = () => request('/exams/student/tests').then(data)
export const getStudentTest = (scheduleId) => request(`/exams/student/tests/${scheduleId}`).then(data)
export const startStudentTest = (scheduleId) => request(`/exams/student/tests/${scheduleId}/start`, { method: 'POST' }).then(data)
export const submitStudentTest = (scheduleId, answers) => request(`/exams/student/tests/${scheduleId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }).then(data)
export const getStudentTestResult = (scheduleId) => request(`/exams/student/tests/${scheduleId}/result`).then(data)
