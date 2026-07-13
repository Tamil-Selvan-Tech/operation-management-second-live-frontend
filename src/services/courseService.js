import { request } from './apiClient'

const COURSE_PAGE_LIMIT = 5

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

function deriveAfterDiscount(course) {
  const actualFees = Number(course?.actualFees)
  const discount = Number(course?.discount)

  if (Number.isFinite(actualFees) && Number.isFinite(discount)) {
    return String(Math.max(actualFees - discount, 0))
  }

  return ''
}

export function normalizeCourse(course) {
  if (!course) return null

  const afterDiscount = course.afterDiscount ?? deriveAfterDiscount(course)

  return {
    ...course,
    id: course.id || '',
    name: course.name || '',
    description: course.description || '',
    feeReference: course.feeReference || '',
    mode: course.mode || '',
    duration: course.duration ?? '',
    hours: course.hours ?? '',
    actualFees: course.actualFees ?? '',
    registrationFees: course.registrationFees ?? '',
    discount: course.discount ?? '',
    afterDiscount,
    installmentCount: String(course.installmentCount ?? 2),
    installment1: course.installment1 ?? '',
    installment2: course.installment2 ?? '',
    installment3: course.installment3 ?? '',
    status: course.status || 'Inactive',
  }
}

export function normalizeCourseList(courses) {
  return Array.isArray(courses) ? courses.map(normalizeCourse).filter(Boolean) : []
}

function buildCourseSearchParams(query = {}) {
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

  const mode = String(query.mode ?? '').trim()
  if (mode) params.set('mode', mode)

  const sortBy = String(query.sortBy ?? '').trim()
  if (sortBy) params.set('sortBy', sortBy)

  const sortOrder = String(query.sortOrder ?? '').trim()
  if (sortOrder) params.set('sortOrder', sortOrder)

  return params
}

export async function listCourses(query = {}) {
  const params = buildCourseSearchParams(query)
  const response = await request(`/master-setup/courses?${params.toString()}`)
  return {
    data: normalizeCourseList(unwrapData(response)),
    meta: response?.meta ?? response?.data?.meta ?? null,
  }
}

export async function createCourse(payload) {
  const response = await request('/master-setup/courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return normalizeCourse(unwrapData(response))
}

export async function updateCourse(courseId, payload) {
  const response = await request(`/master-setup/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return normalizeCourse(unwrapData(response))
}

export async function deleteCourse(courseId) {
  const response = await request(`/master-setup/courses/${courseId}`, {
    method: 'DELETE',
  })

  return normalizeCourse(unwrapData(response))
}
