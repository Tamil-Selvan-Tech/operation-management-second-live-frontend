import { addNotification, updateNotification } from './notificationStore'

const COURSE_EDIT_REQUEST_STORAGE_KEY = 'cispro.course-edit-requests'
const COURSE_EDIT_REQUEST_EVENT = 'cispro:course-edit-requests-changed'

function isBrowser() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readJSON(key) {
  if (!isBrowser()) return null

  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

function writeJSON(key, value) {
  if (!isBrowser()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function emitChange() {
  if (!isBrowser()) return
  window.dispatchEvent(new Event(COURSE_EDIT_REQUEST_EVENT))
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeRequest(request = {}) {
  const createdAt = normalizeText(request.createdAt) || new Date().toISOString()
  const updatedAt = normalizeText(request.updatedAt) || createdAt

  return {
    id: normalizeText(request.id) || createId(),
    courseId: normalizeText(request.courseId),
    courseCode: normalizeText(request.courseCode),
    courseName: normalizeText(request.courseName),
    facultyId: normalizeText(request.facultyId),
    facultyName: normalizeText(request.facultyName),
    facultyEmail: normalizeText(request.facultyEmail).toLowerCase(),
    requestTitle: normalizeText(request.requestTitle || request.title),
    requestReason: normalizeText(request.requestReason || request.reason),
    requestDescription: normalizeText(request.requestDescription || request.description),
    message: normalizeText(request.message),
    status: normalizeText(request.status) || 'pending',
    requestStatus: normalizeText(request.requestStatus) || normalizeText(request.status) || 'pending',
    createdAt,
    updatedAt,
    acceptedAt: normalizeText(request.acceptedAt),
    rejectedAt: normalizeText(request.rejectedAt),
    editedAt: normalizeText(request.editedAt),
    changeSummary: normalizeText(request.changeSummary),
    branchAdminName: normalizeText(request.branchAdminName),
    branchAdminEmail: normalizeText(request.branchAdminEmail).toLowerCase(),
    sourceNotificationId: normalizeText(request.sourceNotificationId),
  }
}

export function loadCourseEditRequests() {
  const stored = readJSON(COURSE_EDIT_REQUEST_STORAGE_KEY)
  if (!Array.isArray(stored)) return []

  return stored.map(normalizeRequest)
}

export function saveCourseEditRequests(requests = []) {
  const normalized = (Array.isArray(requests) ? requests : []).map(normalizeRequest)
  if (!isBrowser()) return normalized

  if (!normalized.length) {
    window.localStorage.removeItem(COURSE_EDIT_REQUEST_STORAGE_KEY)
    emitChange()
    return []
  }

  writeJSON(COURSE_EDIT_REQUEST_STORAGE_KEY, normalized)
  emitChange()
  return normalized
}

export function subscribeCourseEditRequests(listener) {
  if (!isBrowser()) return () => {}

  const handleStorage = (event) => {
    if (event.key === COURSE_EDIT_REQUEST_STORAGE_KEY) {
      listener()
    }
  }

  const handleCustomEvent = () => {
    listener()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(COURSE_EDIT_REQUEST_EVENT, handleCustomEvent)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(COURSE_EDIT_REQUEST_EVENT, handleCustomEvent)
  }
}

function notifyBranchCourseEditRequest(request) {
  return addNotification({
    kind: 'branch-course-edit-request',
    tone: 'blue',
    title: `${request.courseName || 'Course'} edit request`,
    message: `${request.facultyName || 'Faculty'} requested changes for ${request.courseName || 'the course'}.`,
    actionLabel: 'Accept request',
    targetSection: 'courses',
    courseId: request.courseId,
    courseCode: request.courseCode,
    courseName: request.courseName,
    facultyId: request.facultyId,
    facultyName: request.facultyName,
    facultyEmail: request.facultyEmail,
    requestId: request.id,
    requestStatus: 'pending',
    requestTitle: request.requestTitle,
    requestReason: request.requestReason,
    requestDescription: request.requestDescription,
    requestedChanges: request.message,
  })
}

function notifyBranchCourseEditAccepted(request) {
  return addNotification({
    kind: 'branch-course-edit-accepted',
    tone: 'green',
    title: `${request.courseName || 'Course'} edit approved`,
    message: `Open Edit is now available for ${request.courseName || 'the course'}.`,
    actionLabel: 'Open Edit',
    targetSection: 'courses',
    courseId: request.courseId,
    courseCode: request.courseCode,
    courseName: request.courseName,
    facultyId: request.facultyId,
    facultyName: request.facultyName,
    facultyEmail: request.facultyEmail,
    requestId: request.id,
    requestStatus: 'accepted',
    requestTitle: request.requestTitle,
    requestReason: request.requestReason,
    requestDescription: request.requestDescription,
  })
}

function notifyBranchCourseEditUpdated(request) {
  return addNotification({
    kind: 'branch-course-edit-updated',
    tone: 'amber',
    title: `${request.courseName || 'Course'} updated`,
    message: `${request.facultyName || 'Faculty'} saved module and submodule changes for ${request.courseName || 'the course'}.`,
    actionLabel: 'Updated',
    targetSection: 'courses',
    courseId: request.courseId,
    courseCode: request.courseCode,
    courseName: request.courseName,
    facultyId: request.facultyId,
    facultyName: request.facultyName,
    facultyEmail: request.facultyEmail,
    requestId: request.id,
    requestStatus: 'accepted',
    changeSummary: request.changeSummary,
    requestTitle: request.requestTitle,
    requestReason: request.requestReason,
    requestDescription: request.requestDescription,
  })
}

export function addCourseEditRequest(payload = {}) {
  const nextRequest = normalizeRequest({
    ...payload,
    status: 'pending',
    requestStatus: 'pending',
  })

  const branchNotification = notifyBranchCourseEditRequest(nextRequest)
  const nextRequests = [
    normalizeRequest({
      ...nextRequest,
      sourceNotificationId: branchNotification?.id || nextRequest.sourceNotificationId,
    }),
    ...loadCourseEditRequests().filter((request) => request.id !== nextRequest.id),
  ]
  saveCourseEditRequests(nextRequests)
  return nextRequests[0]
}

export function getLatestCourseEditRequest(courseId = '', facultyId = '', facultyEmail = '') {
  const normalizedCourseId = normalizeText(courseId)
  const normalizedFacultyId = normalizeText(facultyId)
  const normalizedFacultyEmail = normalizeText(facultyEmail).toLowerCase()

  const matchingRequests = loadCourseEditRequests()
    .filter((request) => {
      if (normalizedCourseId && normalizeText(request.courseId) !== normalizedCourseId) return false
      if (normalizedFacultyId && normalizeText(request.facultyId) === normalizedFacultyId) return true
      if (normalizedFacultyEmail && normalizeText(request.facultyEmail).toLowerCase() === normalizedFacultyEmail) return true
      return !normalizedFacultyId && !normalizedFacultyEmail
    })
    .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())

  return matchingRequests[0] || null
}

export function acceptCourseEditRequest(requestId = '', updates = {}) {
  const normalizedId = normalizeText(requestId)
  if (!normalizedId) return null

  let acceptedRequest = null
  const nextRequests = loadCourseEditRequests().map((request) => {
    if (request.id !== normalizedId) return request

    acceptedRequest = normalizeRequest({
      ...request,
      ...updates,
      status: 'accepted',
      requestStatus: 'accepted',
      updatedAt: new Date().toISOString(),
      acceptedAt: request.acceptedAt || new Date().toISOString(),
    })

    return acceptedRequest
  })

  if (!acceptedRequest) return null

  saveCourseEditRequests(nextRequests)
  updateNotification(acceptedRequest.sourceNotificationId || acceptedRequest.id, {
    requestStatus: 'accepted',
    actionLabel: 'Accepted',
    tone: 'green',
    title: `${acceptedRequest.courseName || 'Course'} edit approved`,
    message: `${acceptedRequest.facultyName || 'Faculty'} can now open the editor for ${acceptedRequest.courseName || 'the course'}.`,
  })
  notifyBranchCourseEditAccepted(acceptedRequest)
  return acceptedRequest
}

export function recordCourseEditChange(requestId = '', changeSummary = '') {
  const normalizedId = normalizeText(requestId)
  if (!normalizedId) return null

  const updatedAt = new Date().toISOString()
  let updatedRequest = null

  const nextRequests = loadCourseEditRequests().map((request) => {
    if (request.id !== normalizedId) return request

    updatedRequest = normalizeRequest({
      ...request,
      status: 'completed',
      requestStatus: 'completed',
      updatedAt,
      editedAt: updatedAt,
      changeSummary: normalizeText(changeSummary),
    })

    return updatedRequest
  })

  if (!updatedRequest) return null

  saveCourseEditRequests(nextRequests)
  updateNotification(updatedRequest.sourceNotificationId || updatedRequest.id, {
    requestStatus: 'completed',
    actionLabel: 'Edit Request',
    tone: 'amber',
    title: `${updatedRequest.courseName || 'Course'} updated`,
    message: `${updatedRequest.facultyName || 'Faculty'} saved module and submodule changes for ${updatedRequest.courseName || 'the course'}.`,
  })
  notifyBranchCourseEditUpdated(updatedRequest)
  return updatedRequest
}
