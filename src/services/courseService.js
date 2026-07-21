import { request } from './apiClient'

const COURSE_PAGE_LIMIT = 5
const COURSE_LIST_CACHE_TTL_MS = Number(import.meta.env.VITE_LIST_CACHE_TTL_MS || 15000)
const courseListCache = new Map()
const courseListInflight = new Map()

function makeCacheKey(query = {}) {
  return JSON.stringify(query || {})
}

function getCachedResult(cache, key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > COURSE_LIST_CACHE_TTL_MS) {
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

function clearCourseListCache() {
  courseListCache.clear()
  courseListInflight.clear()
}

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

function normalizeText(value) {
  return String(value ?? '').trim()
}

function looksLikeHoursValue(value) {
  return /\bhour(s)?\b/i.test(normalizeText(value))
}

function looksLikeNumericValue(value) {
  const normalized = normalizeText(value).replace(/,/g, '')
  return normalized !== '' && /^-?\d+(\.\d+)?$/.test(normalized)
}

function normalizeFeePair(course) {
  const actualFees = course?.actualFees ?? ''
  const registrationFees = course?.registrationFees ?? ''

  // Some course records arrive with the hour string and fee amount swapped.
  // Normalize that shape so the UI and downstream student flows stay consistent.
  if (looksLikeHoursValue(actualFees) && looksLikeNumericValue(registrationFees)) {
    return {
      actualFees: registrationFees,
      registrationFees: actualFees,
    }
  }

  return {
    actualFees,
    registrationFees,
  }
}

export function normalizeCourse(course) {
  if (!course) return null

  const { actualFees, registrationFees } = normalizeFeePair(course)
  const afterDiscount = course.afterDiscount ?? deriveAfterDiscount(course)
  const installments = Array.isArray(course.installments)
    ? course.installments.map((value) => String(value ?? '').trim()).filter((value) => value !== '')
    : []

  return {
    ...course,
    id: course.id || '',
    name: course.name || '',
    description: course.description || '',
    feeReference: course.feeReference || '',
    mode: course.mode || '',
    duration: course.duration ?? '',
    hours: course.hours ?? '',
    actualFees,
    registrationFees,
    discount: course.discount ?? '',
    afterDiscount,
    installmentCount: String(course.installmentCount ?? 2),
    installment1: course.installment1 ?? '',
    installment2: course.installment2 ?? '',
    installment3: course.installment3 ?? '',
    installments,
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
  const cacheKey = makeCacheKey(query)
  const cached = getCachedResult(courseListCache, cacheKey)
  if (cached) {
    return cached
  }

  if (courseListInflight.has(cacheKey)) {
    return courseListInflight.get(cacheKey)
  }

  try {
    const pending = request(`/master-setup/courses?${params.toString()}`).then((response) => {
      const result = {
      data: normalizeCourseList(unwrapData(response)),
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

export async function createCourse(payload) {
  const response = await request('/master-setup/courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  clearCourseListCache()
  return normalizeCourse(unwrapData(response))
}

export async function updateCourse(courseId, payload) {
  const response = await request(`/master-setup/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  clearCourseListCache()
  return normalizeCourse(unwrapData(response))
}

export async function deleteCourse(courseId) {
  const response = await request(`/master-setup/courses/${courseId}`, {
    method: 'DELETE',
  })

  clearCourseListCache()
  return normalizeCourse(unwrapData(response))
}
