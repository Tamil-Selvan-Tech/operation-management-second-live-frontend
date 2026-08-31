import { request } from './apiClient'

const STUDENT_PAGE_LIMIT = 100
const STUDENT_LIST_CACHE_TTL_MS = Number(import.meta.env.VITE_LIST_CACHE_TTL_MS || 60000)
const STUDENT_PROFILE_CACHE_TTL_MS = Number(import.meta.env.VITE_LIST_CACHE_TTL_MS || 60000)
const studentListCache = new Map()
const studentListInflight = new Map()
const studentProfileCache = new Map()
const studentProfileInflight = new Map()

function makeCacheKey(query = {}) {
  return JSON.stringify(query || {})
}

function getCachedResult(cache, key, ttlMs = STUDENT_LIST_CACHE_TTL_MS) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > ttlMs) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function setCachedResult(cache, key, value) {
  cache.set(key, {
    timestamp: Date.now(),
    value,
  })
}

function clearStudentListCache() {
  studentListCache.clear()
  studentListInflight.clear()
}

function clearStudentProfileCache() {
  studentProfileCache.clear()
  studentProfileInflight.clear()
}

export function peekStudentList(query = {}) {
  const cacheKey = makeCacheKey(query)
  return getCachedResult(studentListCache, cacheKey)
}

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

function extractStudentListPayload(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.docs)) return payload.docs
  if (Array.isArray(payload?.records)) return payload.records

  if (payload?.data && typeof payload.data === 'object') {
    return extractStudentListPayload(payload.data)
  }

  return []
}

function buildStudentMutationPayload(payload = {}) {
  const nextPayload = { ...payload }
  const courseId = String(nextPayload.courseId || nextPayload.course?.connect?.id || '').trim()
  const branchId = String(nextPayload.branchId || '').trim()

  if (courseId) {
    nextPayload.courseId = courseId
  } else {
    delete nextPayload.courseId
  }

  if (branchId) {
    nextPayload.branchId = branchId
  } else {
    delete nextPayload.branchId
  }

  delete nextPayload.course
  return nextPayload
}

export function normalizeStudent(student) {
  if (!student) return null

  return {
    ...student,
    id: student.id || student._id || student.studentId || '',
    studentCode: student.studentCode || '',
    studentName: student.studentName || '',
    mobileNumber: student.mobileNumber || '',
    emailAddress: student.emailAddress || '',
    parentSpouseNumber: student.parentSpouseNumber || '',
    location: student.location || '',
    facultyId: student.facultyId || '',
    courseId: student.courseId || student.course?.id || '',
    courseInterested: student.courseInterested || student.course?.name || '',
    facultyName: student.facultyName || '',
    batchGroupId: student.batchGroupId || student.batch?.batchGroupId || '',
    batchId: student.batchId || student.batchEntryId || '',
    batch: student.batchName || student.batch || '',
    batchName: student.batchName || student.batch || '',
    qualification: student.qualification || '',
    passedOutYear: student.passedOutYear ?? '',
    currentStatus: student.currentStatus || '',
    designation: student.designation || '',
    source: student.source || '',
    paymentMode: student.paymentMode || 'Installment',
    actualFees: student.actualFees ?? '',
    registrationFees: student.registrationFees ?? '',
    discount: student.discount ?? '',
    afterDiscount: student.afterDiscount ?? '',
    installment1: student.installment1 ?? '',
    installment2: student.installment2 ?? '',
    installment3: student.installment3 ?? '',
    installment4: student.installment4 ?? '',
    totalAmount: student.totalAmount ?? '',
    admissionDate: student.admissionDate || '',
    firstInstallmentAmount: student.firstInstallmentAmount ?? '',
    firstInstallmentDate: student.firstInstallmentDate || '',
    firstInstallmentStatus: student.firstInstallmentStatus || 'Pending',
    firstInstallmentPaidAt: student.firstInstallmentPaidAt || '',
    secondInstallmentAmount: student.secondInstallmentAmount ?? '',
    secondDueDate: student.secondDueDate || '',
    secondInstallmentStatus: student.secondInstallmentStatus || 'Pending',
    secondInstallmentPaidAt: student.secondInstallmentPaidAt || '',
    thirdInstallmentAmount: student.thirdInstallmentAmount ?? student.installment3 ?? '',
    thirdDueDate: student.thirdDueDate || '',
    thirdInstallmentStatus: student.thirdInstallmentStatus || 'Pending',
    thirdInstallmentPaidAt: student.thirdInstallmentPaidAt || '',
    remarks: student.remarks || '',
    status: student.status || 'Inactive',
    createdBy: student.createdBy || '',
    updatedBy: student.updatedBy || '',
    createdAt: student.createdAt || '',
    updatedAt: student.updatedAt || '',
    addedAt: student.createdAt || student.addedAt || '',
    counselorName: student.counselorName || student.createdBy || '',
    course: student.course || null,
  }
}

export function normalizeStudentList(students) {
  return Array.isArray(students) ? students.map(normalizeStudent).filter(Boolean) : []
}

function buildStudentSearchParams(query = {}) {
  const params = new URLSearchParams()
  const page = Number.isInteger(Number(query.page)) && Number(query.page) > 0 ? Number(query.page) : 1
  const limit =
    Number.isInteger(Number(query.limit)) && Number(query.limit) > 0
      ? Math.min(Number(query.limit), 100)
      : STUDENT_PAGE_LIMIT

  params.set('page', String(page))
  params.set('limit', String(limit))

  const search = String(query.search ?? '').trim()
  if (search) params.set('search', search)

  const status = String(query.status ?? '').trim()
  if (status) params.set('status', status)

  const branchId = String(query.branchId ?? '').trim()
  if (branchId) params.set('branchId', branchId)

  const courseId = String(query.courseId ?? '').trim()
  if (courseId) params.set('courseId', courseId)

  const currentStatus = String(query.currentStatus ?? '').trim()
  if (currentStatus) params.set('currentStatus', currentStatus)

  const sortBy = String(query.sortBy ?? '').trim()
  if (sortBy) params.set('sortBy', sortBy)

  const sortOrder = String(query.sortOrder ?? '').trim()
  if (sortOrder) params.set('sortOrder', sortOrder)

  return params
}

export async function listStudents(query = {}) {
  const params = buildStudentSearchParams(query)
  const cacheKey = makeCacheKey(query)
  const cached = getCachedResult(studentListCache, cacheKey)
  if (cached) {
    return cached
  }

  if (studentListInflight.has(cacheKey)) {
    return studentListInflight.get(cacheKey)
  }

  try {
    const pending = request(`/students?${params.toString()}`).then((response) => {
      const payload = unwrapData(response)
      const result = {
        data: normalizeStudentList(extractStudentListPayload(payload)),
        meta: response?.meta ?? payload?.meta ?? payload?.pagination ?? payload?.pageInfo ?? null,
      }

      setCachedResult(studentListCache, cacheKey, result)
      return result
    })

    studentListInflight.set(cacheKey, pending)
    return await pending
  } catch (error) {
    if (error?.status === 401) {
      return {
        data: [],
        meta: null,
      }
    }

    throw error
  } finally {
    studentListInflight.delete(cacheKey)
  }
}

export async function getCurrentStudentProfile() {
  const cacheKey = 'current-student'
  const cached = getCachedResult(studentProfileCache, cacheKey, STUDENT_PROFILE_CACHE_TTL_MS)
  if (cached) {
    return cached
  }

  if (studentProfileInflight.has(cacheKey)) {
    return studentProfileInflight.get(cacheKey)
  }

  const pending = request('/students/me').then((response) => {
    const result = normalizeStudent(unwrapData(response))
    setCachedResult(studentProfileCache, cacheKey, result)
    return result
  })

  studentProfileInflight.set(cacheKey, pending)

  try {
    return await pending
  } finally {
    studentProfileInflight.delete(cacheKey)
  }
}

export async function createStudent(payload) {
  const response = await request('/students', {
    method: 'POST',
    body: JSON.stringify(buildStudentMutationPayload(payload)),
  })

  clearStudentListCache()
  clearStudentProfileCache()
  return normalizeStudent(unwrapData(response))
}

export async function updateStudent(studentId, payload) {
  const response = await request(`/students/${studentId}`, {
    method: 'PATCH',
    body: JSON.stringify(buildStudentMutationPayload(payload)),
  })

  clearStudentListCache()
  clearStudentProfileCache()
  return normalizeStudent(unwrapData(response))
}

export async function deleteStudent(studentId) {
  const response = await request(`/students/${studentId}`, {
    method: 'DELETE',
  })

  clearStudentListCache()
  clearStudentProfileCache()
  return normalizeStudent(unwrapData(response))
}
