
import { loadStudentRecords } from '../data/studentRecords'
import { request } from './apiClient'

const STUDENT_PAGE_LIMIT = 100

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

export function normalizeStudent(student) {
  if (!student) return null

  return {
    ...student,
    id: student.id || '',
    studentCode: student.studentCode || '',
    studentName: student.studentName || '',
    mobileNumber: student.mobileNumber || '',
    emailAddress: student.emailAddress || '',
    parentSpouseNumber: student.parentSpouseNumber || '',
    location: student.location || '',
    courseId: student.courseId || '',
    courseInterested: student.courseInterested || student.course?.name || '',
    facultyName: student.facultyName || '',
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
  try {
    const response = await request(`/students?${params.toString()}`)

    return {
      data: normalizeStudentList(unwrapData(response)),
      meta: response?.meta ?? response?.data?.meta ?? null,
    }
  } catch (error) {
    if (error?.status === 401) {
      return {
        data: normalizeStudentList(loadStudentRecords()),
        meta: null,
      }
    }

    throw error
  }
}

export async function createStudent(payload) {
  const response = await request('/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return normalizeStudent(unwrapData(response))
}

export async function updateStudent(studentId, payload) {
  const response = await request(`/students/${studentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return normalizeStudent(unwrapData(response))
}

export async function deleteStudent(studentId) {
  const response = await request(`/students/${studentId}`, {
    method: 'DELETE',
  })

  return normalizeStudent(unwrapData(response))
}
