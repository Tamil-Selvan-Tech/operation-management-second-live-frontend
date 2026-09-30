import { request } from './apiClient'
import { requestBlob } from './apiClient'

const unwrap = (response) => response?.data ?? response ?? []

export const listAcademicTests = () => request('/academic-tests').then(unwrap)
export const getAcademicTest = (id) => request(`/academic-tests/${encodeURIComponent(id)}`).then(unwrap)
export const createAcademicTest = (payload) => request('/academic-tests', { method: 'POST', body: JSON.stringify(payload) }).then(unwrap)
export const updateAcademicTest = (id, payload) => request(`/academic-tests/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }).then(unwrap)
export const deleteAcademicTest = (id) => request(`/academic-tests/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(unwrap)
export const getAcademicTestCreateOptions = () => request('/academic-tests/create-options').then(unwrap)
export const createScheduledAcademicTest = (payload) => request('/academic-tests/scheduled', { method: 'POST', body: JSON.stringify(payload) }).then(unwrap)
export const listFacultyScheduledAcademicTests = () => request('/academic-tests/faculty/scheduled').then(unwrap)
export const getFacultyAcademicTestResults = (id) => request(`/academic-tests/faculty/scheduled/${encodeURIComponent(id)}/results`).then(unwrap)
export const getFacultyAssessment = (scheduleId, studentId) => request(`/academic-tests/faculty/scheduled/${encodeURIComponent(scheduleId)}/assessment/${encodeURIComponent(studentId)}`).then(unwrap)
export const evaluateFacultyAssessment = (scheduleId, studentId, answers) => request(`/academic-tests/faculty/scheduled/${encodeURIComponent(scheduleId)}/assessment/${encodeURIComponent(studentId)}/evaluate`, { method: 'POST', body: JSON.stringify({ answers }) }).then(unwrap)
export const scheduleFacultyAcademicTestRetest = (id, payload) => request(`/academic-tests/faculty/scheduled/${encodeURIComponent(id)}/retest`, { method: 'POST', body: JSON.stringify(payload) }).then(unwrap)
export const updateFacultyScheduledAcademicTest = (id, payload) => request(`/academic-tests/faculty/scheduled/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }).then(unwrap)
export const cancelFacultyScheduledAcademicTest = (id) => request(`/academic-tests/faculty/scheduled/${encodeURIComponent(id)}/cancel`, { method: 'POST' }).then(unwrap)
export const listStudentAcademicTests = () => request('/academic-tests/student/scheduled').then(unwrap)
export const getStudentAcademicTest = (id) => request(`/academic-tests/student/scheduled/${encodeURIComponent(id)}`).then(unwrap)
export const startStudentAcademicTest = (id) => request(`/academic-tests/student/scheduled/${encodeURIComponent(id)}/start`, { method: 'POST' }).then(unwrap)
export const submitStudentAcademicTest = (id, answers) => request(`/academic-tests/student/scheduled/${encodeURIComponent(id)}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }).then(unwrap)
export const submitStudentAcademicProject = (id, file, link = '') => { const body = new FormData(); body.append('projectFile', file); if (link.trim()) body.append('link', link.trim()); return request(`/academic-tests/student/scheduled/${encodeURIComponent(id)}/submit-project`, { method: 'POST', body }).then(unwrap) }
export const getFacultyProjectFile = (scheduleId, studentId) => requestBlob(`/academic-tests/faculty/scheduled/${encodeURIComponent(scheduleId)}/project-submissions/${encodeURIComponent(studentId)}/file`)
export const getFacultyProjectPreview = (scheduleId, studentId) => request(`/academic-tests/faculty/scheduled/${encodeURIComponent(scheduleId)}/project-submissions/${encodeURIComponent(studentId)}/preview`)
export const gradeFacultyProject = (scheduleId, studentId, marks) => request(`/academic-tests/faculty/scheduled/${encodeURIComponent(scheduleId)}/project-submissions/${encodeURIComponent(studentId)}`, { method: 'PUT', body: JSON.stringify({ marks }) }).then(unwrap)
export const getStudentAcademicTestResult = (id) => request(`/academic-tests/student/scheduled/${encodeURIComponent(id)}/result`).then(unwrap)
export const listAcademicReportBatches = () => request('/academic-tests/reports/batches').then(unwrap)
export const getAcademicBatchReport = (batchId) => request(`/academic-tests/reports/batches/${encodeURIComponent(batchId)}/students`).then(unwrap)
export const getMyAcademicReport = () => request('/academic-tests/reports/my-report').then(unwrap)
export const listFacultyAcademicReportTests = (batchId) => request(`/academic-tests/reports/faculty/batches/${encodeURIComponent(batchId)}/completed-tests`).then(unwrap)
export const sendAcademicTestReport = (payload) => request('/academic-tests/reports/send', { method: 'POST', body: JSON.stringify(payload) }).then(unwrap)
export const listBranchAcademicTestReports = () => request('/academic-tests/reports/branch-admin').then(unwrap)
export const getBranchAcademicTestReport = (reportId) => request(`/academic-tests/reports/branch-admin/${encodeURIComponent(reportId)}/students`).then(unwrap)

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
