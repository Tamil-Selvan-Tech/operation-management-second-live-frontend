import { request } from './apiClient'

const COURSE_PAGE_LIMIT = 5
const courseListCache = new Map()
const courseListInflight = new Map()

function makeCacheKey(query = {}) {
  return JSON.stringify(query || {})
}

function getCachedResult(cache, key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > Number(import.meta.env.VITE_LIST_CACHE_TTL_MS || 60000)) {
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

export function clearBranchCourseListCache() {
  courseListCache.clear()
  courseListInflight.clear()
}

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function getBranchCourseSubmodelSource(model = {}) {
  return model?.submodels || model?.subModels || model?.submodules || model?.subModules || []
}

function deriveAfterDiscount(course) {
  const actualFees = Number(course?.actualFees)
  const registrationFees = Number(course?.registrationFees)
  const discount = Number(course?.discount)

  if (Number.isFinite(actualFees) && Number.isFinite(registrationFees) && Number.isFinite(discount)) {
    return String(Math.max(actualFees + registrationFees - discount, 0))
  }

  return ''
}

function normalizeBranchCourseSubmodels(submodels) {
  if (!Array.isArray(submodels) || !submodels.length) return []
  return submodels.map((submodel, index) => ({
    ...submodel,
    id: submodel?.id || `submodel-${index + 1}`,
    name: normalizeText(submodel?.name || submodel?.title || submodel?.submodelName),
    percentage: submodel?.percentage ?? '',
  }))
}

function normalizeBranchCourseModels(models) {
  if (!Array.isArray(models) || !models.length) return []
  return models.map((model, index) => ({
    ...model,
    id: model?.id || `model-${index + 1}`,
    name: normalizeText(model?.name || model?.title || model?.modelName),
    percentage: model?.percentage ?? '',
    submodels: normalizeBranchCourseSubmodels(getBranchCourseSubmodelSource(model)),
  }))
}

function normalizeBranchInstallmentTemplate(template) {
  if (!template) return null

  const installments = Array.isArray(template.installments)
    ? template.installments
    : Array.isArray(template.installmentAmounts)
      ? template.installmentAmounts
      : []

  return {
    ...template,
    id: template.id || '',
    branchId: template.branchId || '',
    branchCourseId: template.branchCourseId || '',
    templateName: normalizeText(template.templateName || template.planName),
    installmentCount: Number(template.installmentCount || installments.length || 0),
    installments: installments.map((value) => normalizeText(value)),
    dueRule: normalizeText(template.dueRule),
    allowCustomization: Boolean(template.allowCustomization ?? true),
    status: template.status || 'Active',
    createdAt: template.createdAt || '',
    updatedAt: template.updatedAt || '',
  }
}

export function normalizeBranchCourse(course) {
  if (!course) return null

  return {
    ...course,
    id: course.id || '',
    courseCode: normalizeText(course.courseCode),
    name: normalizeText(course.name || course.courseName),
    description: normalizeText(course.description),
    mode: normalizeText(course.mode),
    duration: course.duration ?? '',
    hours: course.hours ?? '',
    actualFees: course.actualFees ?? '',
    registrationFees: course.registrationFees ?? '',
    discount: course.discount ?? '',
    afterDiscount: course.afterDiscount ?? deriveAfterDiscount(course),
    status: course.status || 'Inactive',
    batches: Number(course.batches || 0),
    students: Number(course.students || 0),
    models: normalizeBranchCourseModels(course.models || course.courseModels || course.modules || []),
    installmentTemplate: normalizeBranchInstallmentTemplate(
      course.installmentTemplate || course.branchInstallmentTemplate || null,
    ),
    createdAt: course.createdAt || '',
    updatedAt: course.updatedAt || '',
  }
}

export function normalizeBranchCourseList(courses) {
  return Array.isArray(courses) ? courses.map(normalizeBranchCourse).filter(Boolean) : []
}

function buildSearchParams(query = {}) {
  const params = new URLSearchParams()
  const page = Number.isInteger(Number(query.page)) && Number(query.page) > 0 ? Number(query.page) : 1
  const limit =
    Number.isInteger(Number(query.limit)) && Number(query.limit) > 0
      ? Math.min(Number(query.limit), 100)
      : COURSE_PAGE_LIMIT

  params.set('page', String(page))
  params.set('limit', String(limit))

  const search = String(query.search ?? '').trim()
  if (search) params.set('search', search)

  const status = String(query.status ?? '').trim()
  if (status) params.set('status', status)

  const sortBy = String(query.sortBy ?? '').trim()
  if (sortBy) params.set('sortBy', sortBy)

  const sortOrder = String(query.sortOrder ?? '').trim()
  if (sortOrder) params.set('sortOrder', sortOrder)

  return params
}

export async function listBranchCourses(query = {}) {
  const params = buildSearchParams(query)
  const cacheKey = makeCacheKey(query)
  const cached = getCachedResult(courseListCache, cacheKey)
  if (cached) {
    return cached
  }

  if (courseListInflight.has(cacheKey)) {
    return courseListInflight.get(cacheKey)
  }

  try {
    const pending = request(`/branch-courses?${params.toString()}`).then((response) => {
      const result = {
        data: normalizeBranchCourseList(unwrapData(response)),
        meta: response?.meta ?? response?.data?.meta ?? null,
      }

      setCachedResult(courseListCache, cacheKey, result)
      return result
    })

    courseListInflight.set(cacheKey, pending)
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
    courseListInflight.delete(cacheKey)
  }
}

export async function createBranchCourse(payload) {
  const response = await request('/branch-courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  clearBranchCourseListCache()
  return normalizeBranchCourse(unwrapData(response))
}

export async function updateBranchCourse(courseId, payload) {
  const response = await request(`/branch-courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  clearBranchCourseListCache()
  return normalizeBranchCourse(unwrapData(response))
}

export async function deleteBranchCourse(courseId) {
  const response = await request(`/branch-courses/${courseId}`, {
    method: 'DELETE',
  })

  clearBranchCourseListCache()
  return normalizeBranchCourse(unwrapData(response))
}

export async function assignFacultyToBranchCourse(
  courseId,
  facultyIds = [],
) {
  const response = await request(
    `/branch-courses/${courseId}/assign-faculty`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        facultyIds,
      }),
    },
  )

  clearBranchCourseListCache()

  return normalizeBranchCourse(
    unwrapData(response),
  )
}
