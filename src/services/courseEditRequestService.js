import { request } from './apiClient'

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeModules(modules = []) {
  return Array.isArray(modules)
    ? modules.map((module, moduleIndex) => ({
        id: normalizeText(module?.id) || `module-${moduleIndex + 1}`,
        name: normalizeText(module?.name || module?.title || module?.moduleName),
        description: normalizeText(module?.description),
        sequenceNo: module?.sequenceNo ?? moduleIndex + 1,
        status: normalizeText(module?.status) || 'ACTIVE',
        submodules: Array.isArray(module?.submodules)
          ? module.submodules.map((submodule, subIndex) => ({
              id: normalizeText(submodule?.id) || `submodule-${moduleIndex + 1}-${subIndex + 1}`,
              name: normalizeText(submodule?.name || submodule?.title || submodule?.submoduleName),
              description: normalizeText(submodule?.description),
              sequenceNo: submodule?.sequenceNo ?? subIndex + 1,
              status: normalizeText(submodule?.status) || 'ACTIVE',
            }))
          : [],
      }))
    : []
}

function normalizeRequest(requestRecord = {}) {
  const source = requestRecord?.request || requestRecord || {}

  return {
    id: normalizeText(source.id),
    branchCourseId: normalizeText(source.branchCourseId),
    branchId: normalizeText(source.branchId),
    courseName: normalizeText(source.courseName),
    courseCode: normalizeText(source.courseCode),
    facultyUserId: normalizeText(source.facultyUserId),
    facultyId: normalizeText(source.facultyId),
    facultyName: normalizeText(source.facultyName),
    facultyEmail: normalizeText(source.facultyEmail).toLowerCase(),
    title: normalizeText(source.title),
    reason: normalizeText(source.reason),
    description: normalizeText(source.description),
    status: normalizeText(source.status).toLowerCase(),
    requestStatus: normalizeText(source.status).toLowerCase(),
    responseNote: normalizeText(source.responseNote),
    requestedAt: source.requestedAt || source.createdAt || null,
    reviewedAt: source.reviewedAt || null,
    acceptedAt: source.acceptedAt || null,
    rejectedAt: source.rejectedAt || null,
    editingStartedAt: source.editingStartedAt || null,
    completedAt: source.completedAt || null,
    moduleCount: Number(source.moduleCount || 0),
    subModuleCount: Number(source.subModuleCount || 0),
  }
}

function normalizeResponse(response) {
  const data = unwrapData(response)
  if (!data) return null
  return Array.isArray(data) ? data.map(normalizeRequest) : normalizeRequest(data)
}

export async function listCourseEditRequests(query = {}) {
  const params = new URLSearchParams()
  Object.entries(query || {}).forEach(([key, value]) => {
    const text = normalizeText(value)
    if (text) {
      params.set(key, text)
    }
  })

  const response = await request(`/course-edit-requests?${params.toString()}`)
  const data = Array.isArray(response?.data) ? response.data : []
  return {
    data: data.map(normalizeRequest),
    meta: response?.meta || null,
  }
}

export async function getCourseEditRequest(requestId) {
  const response = await request(`/course-edit-requests/${encodeURIComponent(normalizeText(requestId))}`)
  return normalizeResponse(response)
}

export async function createCourseEditRequest(payload = {}) {
  const response = await request('/course-edit-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return normalizeResponse(response)
}

export async function acceptCourseEditRequest(requestId, payload = {}) {
  const response = await request(`/course-edit-requests/${encodeURIComponent(normalizeText(requestId))}/accept`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return normalizeResponse(response)
}

export async function rejectCourseEditRequest(requestId, payload = {}) {
  const response = await request(`/course-edit-requests/${encodeURIComponent(normalizeText(requestId))}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return normalizeResponse(response)
}

export async function saveCourseEditRequestModules(requestId, payload = {}) {
  const response = await request(`/course-edit-requests/${encodeURIComponent(normalizeText(requestId))}/modules`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return normalizeResponse(response)
}
