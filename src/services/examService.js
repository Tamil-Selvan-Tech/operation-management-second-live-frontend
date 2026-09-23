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
export const listFacultyAssessmentReports = () => request('/exams/faculty/assessment-reports').then(data)
export const getFacultyAssessmentStudentReport = (courseId, batchId, moduleId) => request(`/exams/faculty/assessment-reports/${courseId}/${batchId}/${moduleId}`).then(data)

export const listStudentTests = () => request('/exams/student/tests').then(data)
export const getStudentTest = (scheduleId) => request(`/exams/student/tests/${scheduleId}`).then(data)
export const startStudentTest = (scheduleId) => request(`/exams/student/tests/${scheduleId}/start`, { method: 'POST' }).then(data)
export const submitStudentTest = (scheduleId, answers) => request(`/exams/student/tests/${scheduleId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }).then(data)
export const getStudentTestResult = (scheduleId) => request(`/exams/student/tests/${scheduleId}/result`).then(data)

export const listFacultyAssessments = () => request('/exams/faculty/assessments').then(data)
export const getFacultyAssessment = (id) => request(`/exams/faculty/assessments/${id}`).then(data)
export const createFacultyAssessment = (payload) => request('/exams/faculty/assessments', { method: 'POST', body: JSON.stringify(payload) }).then(data)
export const updateFacultyAssessment = (id, payload) => request(`/exams/faculty/assessments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }).then(data)
export const listAssessmentStudents = (id) => request(`/exams/faculty/assessments/${id}/students`).then(data)
export const evaluateAssessmentSubmission = (assessmentId, studentId, payload) => request(`/exams/faculty/assessments/${assessmentId}/submissions/${studentId}`, { method: 'PATCH', body: JSON.stringify(payload) }).then(data)
export const listStudentAssessments = () => request('/exams/student/assessments').then(data)
export const getStudentAssessment = (id) => request(`/exams/student/assessments/${id}`).then(data)
export const submitStudentAssessment = (id, response) => request(`/exams/student/assessments/${id}/submit`, { method: 'POST', body: JSON.stringify({ response }) }).then(data)
export const getStudentAssessmentSubmission = (id) => request(`/exams/student/assessments/${id}/submission`).then(data)
