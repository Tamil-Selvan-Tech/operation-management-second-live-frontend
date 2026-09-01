import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { getCountries, getStatesOfCountry, getCitiesOfState } from '@countrystatecity/countries-browser'
import {
  Bell,
  BookOpen,
  ArrowLeft,
  CircleUserRound,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Layers3,
  LogOut,
  MoreVertical,
  RefreshCcw,
  Shield,
  Users,
  
  CheckCircle2,
  Eye,
  Code2,
  CircleDot,
  CalendarDays,
  Monitor,
  Clock3,
  IndianRupee,
  FileText,
  Tag,
  BadgeInfo,
  BadgePercent,
  PieChart,
  UserRound,
  Search,
  UserPlus, Pencil, Trash2,
  Building2,
  Check,
  X,
  Wallet,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { request, setImpersonateBranchId } from '../services/apiClient'
import { getCurrentBranchProfile } from '../services/branchService'
import { listBranchFaculty } from '../services/branchFacultyService'
import { getBranchStudentLedger } from '../services/branchLedgerService'
import {
  clearBranchCourseListCache,
  assignFacultyToBranchCourse,
  createBranchCourse,
  deleteBranchCourse,
  listBranchCourses,
  updateBranchCourse,
} from '../services/branchCourseService'
import { listBranchBatches } from '../services/branchBatchService'
import {
  listBranchInstallmentTemplates,
  subscribeBranchInstallmentTemplateChanges,
} from '../services/branchInstallmentTemplateService'
import {
  mergeBranchCoursesWithSnapshot,
  saveBranchCourseSnapshot,
  subscribeBranchCourseSnapshot,
} from '../lib/branchCourseSnapshot'
import { FACULTY_RECORD_SYNC_EVENT } from '../data/facultyRecords'
import {
  acceptCourseEditRequest,
  listCourseEditRequests,
} from '../services/courseEditRequestService'
import {
  loadBranchStudents,
  refreshBranchStudents,
  saveBranchStudent,
  deleteBranchStudent as removeBranchStudent,
  BRANCH_STUDENTS_KEY,
  getNextStudentId,
} from '../lib/branchStudentStore'
import {
  FACULTY_TODAY_WORK_SYNC_EVENT,
  FACULTY_TODAY_WORK_SYNC_KEY,
  listFacultyTodayWorkEntries,
} from '../lib/facultyTodayWorkStore'
import {
  buildFacultyTodayWorkProgressSummary,
  isFacultyWorkEntryForStudent,
  normalizeWorkStudentId,
} from '../lib/facultyProgress'
import { BranchFacultyPage } from './BranchFacultyPage'
import { BranchBatchManagementSection } from './BranchBatchManagementSection'
import { BranchInstallmentTemplatesPage } from './BranchInstallmentTemplatesPage'
import RecordPayment from '../components/payments/RecordPayment'
import '../components/payments/RecordPayment.css'
import {
  groupByDate,
  doesBranchNotificationBelongToBranch,
  normalizeBranchNotification,
} from '../data/branchNotificationsData'
import {
  loadNotifications,
  mergeNotificationsWithStoredState,
  markNotificationsAsDropdownViewed,
  markNotificationsAsRead,
  saveNotifications,
  subscribeNotifications,
} from '../lib/notificationStore'
import { loadBranchPaymentHistoryEntries } from '../lib/branchPaymentHistoryStore'
import { enrichStudentsWithFacultyReferences, getMatchingStudents } from '../lib/facultyFlow'
import {
  buildProgressComparisonNotification,
  syncProgressComparisonNotifications,
} from '../lib/progressComparisonNotification'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/BranchDashboardPage.css'

const BRANCH_STUDENTS_PER_PAGE = 5
const STUDENT_ID_PREFIX = 'STU-'
const STUDENT_FORM_STEP_ONE_FIELDS = [
  'studentIdSuffix',
  'studentName',
  'emailAddress',
  'linkedInUrl',
  'mobileNumber',
  'parentSpouseNumber',
  'country',
  'state',
  'city',
  'address',
  'qualification',
  'passedOutYear',
  'passedOutYearCustom',
]
const STUDENT_FORM_STEP_TWO_FIELDS = [
  'currentStatus',
  'designation',
  'source',
  'sourceOther',
  'remarks',
  'admissionDate',
]
const STUDENT_FORM_STEP_THREE_FIELDS = [
  'courseId',
  'batchId',
  'batchTiming',
  'courseAmount',
  'paymentPlanId',
]
const STUDENT_FORM_STEP_FIELDS = {
  1: STUDENT_FORM_STEP_ONE_FIELDS,
  2: STUDENT_FORM_STEP_TWO_FIELDS,
  3: STUDENT_FORM_STEP_THREE_FIELDS,
}

const CURRENT_YEAR = new Date().getFullYear()
const PASSED_OUT_YEARS = Array.from({ length: 31 }, (_, i) => String(CURRENT_YEAR - i))

function getTodayValue() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalDateValue(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysToDateString(value, days = 0) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''

  const next = new Date(date)
  next.setDate(next.getDate() + Number(days || 0))

  const year = next.getFullYear()
  const month = String(next.getMonth() + 1).padStart(2, '0')
  const day = String(next.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildInstallmentDueDates(count = 0, startDate = getTodayValue(), intervalDays = 30) {
  const safeCount = Math.max(0, Number(count) || 0)
  if (!safeCount) return []

  return Array.from({ length: safeCount }, (_, index) => addDaysToDateString(startDate, index * intervalDays))
}

function formatStudentBatchTiming(batch = {}) {
  const directTiming = String(batch?.batchTiming || '').trim()
  if (directTiming) return directTiming

  const startTime = String(batch?.startTime || '').trim()
  const endTime = String(batch?.endTime || '').trim()
  const startPeriod = String(batch?.startPeriod || '').trim().toUpperCase()
  const endPeriod = String(batch?.endPeriod || '').trim().toUpperCase()

  const buildClock = (time, period) => {
    if (!time) return ''
    const text = String(time).trim()
    if (/AM|PM/i.test(text)) return text
    return period ? `${text} ${period}` : text
  }

  const formattedStart = buildClock(startTime, startPeriod)
  const formattedEnd = buildClock(endTime, endPeriod)

  if (formattedStart && formattedEnd) return `${formattedStart} - ${formattedEnd}`
  if (formattedStart) return formattedStart
  if (formattedEnd) return formattedEnd
  return ''
}

function formatStudentBatchLabel(batch = {}) {
  const name = String(batch?.batchName || batch?.batchId || '').trim()
  const id = String(batch?.batchId || '').trim()
  const timing = String(batch?.batchTiming || '').trim()

  if (name && timing) return `${name} • ${timing}`
  if (name && id) return `${name} • ${id}`
  return name || id || timing || 'Batch'
}

function resolveStudentBatchDisplay(student = {}, batchGroups = []) {
  const batchId = String(student?.batchId || student?.batchEntryId || '').trim()
  const batchName = String(student?.batchName || student?.batch || '').trim()
  const batchTiming = String(student?.batchTiming || student?.batchTime || '').trim()
  const courseId = String(student?.courseId || student?.course?.id || '').trim()
  const normalizedBatchTiming = batchTiming.toLowerCase()

  const groups = Array.isArray(batchGroups) ? batchGroups : []
  let matchedBatch = null

  for (const group of groups) {
    const groupCourseId = String(group?.courseId || group?.branchCourseId || '').trim()
    if (courseId && groupCourseId && groupCourseId !== courseId) continue

    matchedBatch = (Array.isArray(group?.batches) ? group.batches : []).find((batch) => {
      const candidateBatchId = String(batch?.batchId || batch?.id || '').trim()
      const candidateBatchName = String(batch?.batchName || '').trim()
      const candidateBatchTiming = String(formatStudentBatchTiming(batch) || batch?.batchTiming || '').trim()
      return (
        (batchId && candidateBatchId && candidateBatchId === batchId) ||
        (batchName && candidateBatchName && candidateBatchName === batchName) ||
        (normalizedBatchTiming && candidateBatchTiming && candidateBatchTiming.toLowerCase() === normalizedBatchTiming)
      )
    }) || null

    if (matchedBatch) {
      break
    }
  }

  const resolvedBatchTiming = batchTiming || (matchedBatch ? formatStudentBatchTiming(matchedBatch) : '')

  return {
    batchId: batchId || String(matchedBatch?.batchId || matchedBatch?.id || '').trim(),
    batchName: batchName || String(matchedBatch?.batchName || matchedBatch?.batchId || '').trim() || batchId,
    batchTiming: resolvedBatchTiming,
  }
}

function normalizeSeatKey(value = '') {
  return String(value || '').trim().toLowerCase()
}

function getStudentSeatKeys(student = {}) {
  return [...new Set([
    student?.id,
    student?._id,
    student?.recordId,
    student?._recordId,
    student?.studentId,
    student?.originalStudentId,
    student?._originalStudentId,
  ]
    .map(normalizeSeatKey)
    .filter(Boolean))]
}

function getBatchStudentIdentityKey(student = {}) {
  const fallbackKey = [
    student?.courseId,
    student?.batchGroupId,
    student?.batchId,
    student?.batchEntryId,
    student?.batchName,
    student?.facultyId,
    student?.admissionDate,
    student?.studentName,
    student?.mobileNumber,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')

  return (
    normalizeSeatKey(
      student?.studentId ||
      student?.id ||
      student?._id ||
      student?.recordId ||
      student?._recordId ||
      student?.originalStudentId ||
      student?._originalStudentId ||
      fallbackKey,
    ) || fallbackKey
  )
}

function getBatchSeatSummary(batch = {}, students = [], excludedStudentKeys = []) {
  const matchingStudents = getMatchingStudents(students, {
    facultyId: batch?.facultyId || '',
    facultyName: batch?.facultyName || '',
    courseId: batch?.courseId || '',
    courseName: batch?.courseName || '',
    batchId: batch?.batchId || '',
    batchName: batch?.batchName || '',
    batchTiming: batch?.batchTiming || '',
  })

  const excludedKeys = new Set((Array.isArray(excludedStudentKeys) ? excludedStudentKeys : [])
    .map(normalizeSeatKey)
    .filter(Boolean))

  const uniqueStudents = new Set()

  matchingStudents.forEach((student) => {
    const studentKey = getBatchStudentIdentityKey(student)
    if (!studentKey || excludedKeys.has(studentKey)) return
    uniqueStudents.add(studentKey)
  })

  const totalSeats = Math.max(Number(batch?.totalSeats || 0) || 0, 0)
  const usedSeats = uniqueStudents.size
  const availableSeats = Math.max(totalSeats - usedSeats, 0)

  return {
    totalSeats,
    usedSeats,
    availableSeats,
    isFull: availableSeats <= 0,
  }
}

function createInitialStudentForm(branchId) {
  const nextStudentId = getNextStudentId(branchId)
  return {
    studentId: nextStudentId,
    studentIdSuffix: nextStudentId.replace(/^STU-/i, ''),
    originalStudentId: '',
    recordId: '',
    studentName: '',
    emailAddress: '',
    linkedInUrl: '',
    mobileNumber: '',
    parentSpouseNumber: '',
    countryCode: 'IN',
    country: 'India',
    stateCode: 'TN',
    state: 'Tamil Nadu',
    city: '',
    address: '',
    qualification: '',
    passedOutYear: '',
    passedOutYearCustom: '',
    currentStatus: '',
    designation: '',
    source: '',
    sourceOther: '',
    remarks: '',
    admissionDate: getTodayValue(),
    courseId: '',
    courseName: '',
    batchGroupId: '',
    batchId: '',
    batchName: '',
    batchTiming: '',
    facultyId: '',
    facultyName: '',
    facultyEmail: '',
    facultyPhone: '',
    courseAmount: '',
    paymentPlanId: '',
    paymentPlan: '',
    paymentMode: '',
    installmentSchedule: [],
  }
}

function buildStudentFormFromRecord(student = {}) {
  return {
    studentId: student.studentId || '',
    studentIdSuffix: String(student.studentId || '').replace(/^STU-/i, ''),
    originalStudentId: String(student.studentId || '').trim(),
    recordId: String(student.id || student._id || student.recordId || '').trim(),
    studentName: student.studentName || '',
    emailAddress: student.emailAddress || '',
    linkedInUrl: student.linkedInUrl || '',
    mobileNumber: student.mobileNumber || '',
    parentSpouseNumber: student.parentSpouseNumber || '',
    countryCode: student.countryCode || '',
    country: student.country || '',
    stateCode: student.stateCode || '',
    state: student.state || '',
    city: student.city || '',
    address: student.address || '',
    qualification: student.qualification || '',
    passedOutYear: student.passedOutYear || '',
    passedOutYearCustom: student.passedOutYearCustom || '',
    currentStatus: student.currentStatus || '',
    designation: student.designation || '',
    source: student.source || '',
    sourceOther: student.sourceOther || '',
    remarks: student.remarks || '',
    admissionDate: student.admissionDate || '',
    courseId: student.courseId || student.course?.id || '',
    courseName: student.courseName || student.courseInterested || student.course?.name || '',
    batchGroupId: student.batchGroupId || student.batch?.batchGroupId || '',
    batchId: student.batchId || student.batch?.batchId || student.batchEntryId || '',
    batchName: student.batchName || student.batch?.batchName || student.batch || '',
    batchTiming: student.batchTiming || student.batch?.batchTiming || '',
    facultyId: student.facultyId || student.course?.facultyId || '',
    facultyName: student.facultyName || student.course?.facultyName || '',
    facultyEmail: student.facultyEmail || student.course?.facultyEmail || '',
    facultyPhone: student.facultyPhone || student.course?.facultyPhone || '',
    courseAmount: String(student.courseAmount || student.totalAmount || student.afterDiscount || '').trim(),
    paymentMode: student.paymentMode || 'Installment',
    paymentPlanId: student.paymentPlanId || student.paymentPlan || '',
    paymentPlan: student.paymentPlan || '',
    installmentSchedule: Array.isArray(student.installmentSchedule)
      ? student.installmentSchedule
      : [],
  }
}

function validateStudentForm(form, students = []) {
  const errors = {}
  const safeTrim = (value) => String(value ?? '').trim()
  const studentIdSuffixError = getStudentIdSuffixError(form, students)
  if (studentIdSuffixError) errors.studentIdSuffix = studentIdSuffixError
  if (!safeTrim(form.studentName)) errors.studentName = 'Student Name is required.'
  else if (!/^[A-Za-z][A-Za-z ]*$/.test(safeTrim(form.studentName))) errors.studentName = 'Only letters and spaces allowed.'
  if (!safeTrim(form.emailAddress)) errors.emailAddress = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeTrim(form.emailAddress))) errors.emailAddress = 'Enter a valid email.'
  if (!safeTrim(form.mobileNumber)) errors.mobileNumber = 'Mobile Number is required.'
  else if (!/^\d{10}$/.test(safeTrim(form.mobileNumber))) errors.mobileNumber = 'Must be exactly 10 digits.'
  if (!safeTrim(form.parentSpouseNumber)) errors.parentSpouseNumber = 'Parent/Spouse Number is required.'
  else if (!/^\d{10}$/.test(safeTrim(form.parentSpouseNumber))) errors.parentSpouseNumber = 'Must be exactly 10 digits.'
  if (!form.country) errors.country = 'Country is required.'
  if (!form.state) errors.state = 'State is required.'
  if (!form.city) errors.city = 'City is required.'
  if (!safeTrim(form.address)) errors.address = 'Address is required.'
  if (!safeTrim(form.qualification)) errors.qualification = 'Qualification is required.'
  if (!form.passedOutYear) errors.passedOutYear = 'Passed Out Year is required.'
  if (form.passedOutYear === 'Custom' && !safeTrim(form.passedOutYearCustom)) errors.passedOutYearCustom = 'Please specify the year.'
  if (!form.currentStatus) errors.currentStatus = 'Current Status is required.'
  if (form.currentStatus === 'Employee' && !safeTrim(form.designation)) errors.designation = 'Designation is required for employees.'
  if (!form.source) errors.source = 'This field is required.'
  if (form.source === 'Others' && !safeTrim(form.sourceOther)) errors.sourceOther = 'Please specify.'
  if (!form.admissionDate) errors.admissionDate = 'Admission Date is required.'
  if (!form.courseId) errors.courseId = 'Course is required.'
  if (!safeTrim(form.batchId)) errors.batchId = 'Batch is required.'
  if (!safeTrim(form.batchTiming)) errors.batchTiming = 'Batch timing is required.'
  if (!safeTrim(form.courseAmount)) errors.courseAmount = 'Course amount is required.'
  if (!safeTrim(form.paymentPlanId)) errors.paymentPlanId = 'This field is required.'

  const currentRecordId = String(form.recordId || form.originalStudentId || '').trim()
  const resolvedStudentId = String(
    form.studentId || (String(form.studentIdSuffix || '').trim() ? `${STUDENT_ID_PREFIX}${String(form.studentIdSuffix || '').trim()}` : ''),
  ).trim().toLowerCase()
  const normalizedEmail = String(form.emailAddress || '').trim().toLowerCase()
  const normalizedMobile = String(form.mobileNumber || '').trim()

  if (resolvedStudentId) {
    const duplicateStudentId = students.find((student) => {
      const studentRecordId = String(student?.id || student?._id || student?.recordId || student?.studentId || '').trim()
      const studentId = String(student?.studentId || '').trim().toLowerCase()
      return studentId && studentId === resolvedStudentId && studentRecordId !== currentRecordId
    })

    if (duplicateStudentId) {
      errors.studentIdSuffix = 'Student ID already exists.'
    }
  }

  if (normalizedEmail) {
    const duplicateEmail = students.find((student) => {
      const studentRecordId = String(student?.id || student?._id || student?.recordId || student?.studentId || '').trim()
      const studentEmail = String(student?.emailAddress || '').trim().toLowerCase()
      return studentEmail && studentEmail === normalizedEmail && studentRecordId !== currentRecordId
    })

    if (duplicateEmail) {
      errors.emailAddress = 'Email already exists'
    }
  }

  if (normalizedMobile) {
    const duplicateMobile = students.find((student) => {
      const studentRecordId = String(student?.id || student?._id || student?.recordId || student?.studentId || '').trim()
      const studentMobile = String(student?.mobileNumber || '').trim()
      return studentMobile && studentMobile === normalizedMobile && studentRecordId !== currentRecordId
    })

    if (duplicateMobile) {
      errors.mobileNumber = 'Mobile number already exists'
    }
  }

  return errors
}

function getStudentIdSuffixError(form, students = []) {
  const suffix = String(form.studentIdSuffix || '').trim()
  if (!suffix) return 'Student ID is required.'
  if (!/^\d+$/.test(suffix)) return 'Only numbers are allowed.'

  const currentRecordId = String(form.recordId || form.originalStudentId || '').trim()
  const resolvedStudentId = buildStudentIdFromSuffix(suffix).trim().toLowerCase()

  if (!resolvedStudentId) return ''

  const duplicateStudentId = students.find((student) => {
    const studentRecordId = String(student?.id || student?._id || student?.recordId || student?.studentId || '').trim()
    const studentId = String(student?.studentId || '').trim().toLowerCase()
    return studentId && studentId === resolvedStudentId && studentRecordId !== currentRecordId
  })

  return duplicateStudentId ? 'Student ID already exists.' : ''
}
function computeBranchStudentPaymentSummary(stu = {}) {
  const totalFee = Number(
    stu.finalFee ?? stu.courseAmount ?? stu.totalAmount ?? stu.afterDiscount ?? 0
  )
  const installments = Array.isArray(stu.installmentSchedule) ? stu.installmentSchedule : []
  const paymentPlanInstallments = Array.isArray(stu.paymentPlan?.installments)
    ? stu.paymentPlan.installments
    : []
  const scheduleInstallments = installments.length ? installments : paymentPlanInstallments
  const paidAmount = scheduleInstallments.length
    ? scheduleInstallments.reduce(
        (sum, inst) => sum + Number(inst.paidAmount ?? inst.amountPaid ?? 0),
        0,
      )
    : Number(stu.paidAmount ?? stu.totalPaid ?? stu.amountPaid ?? 0)

  const nextInstallment = scheduleInstallments.find((installment) => {
    const amount = Number(installment.amount ?? installment.installmentAmount ?? 0)
    const paid = Number(installment.paidAmount ?? installment.amountPaid ?? 0)
    return paid < amount
  })

  const nextInstallmentAmount = nextInstallment
    ? Math.max(
        Number(nextInstallment.amount ?? nextInstallment.installmentAmount ?? 0) -
          Number(nextInstallment.paidAmount ?? nextInstallment.amountPaid ?? 0),
        0,
      )
    : 0

  const nextInstallmentLabel = nextInstallment
    ? `Installment ${nextInstallment.installmentNumber || nextInstallment.number || ''}`.trim()
    : ''

  const nextDueDate = nextInstallment?.dueDate ?? nextInstallment?.date ?? null

  const allInstallmentsPaid =
    scheduleInstallments.length > 0 &&
    scheduleInstallments.every((inst) => {
      const amount = Number(inst.amount ?? inst.installmentAmount ?? 0)
      const paid = Number(inst.paidAmount ?? inst.amountPaid ?? 0)
      return paid >= amount
    })

  const hasPartialInstallment =
    scheduleInstallments.length > 0 &&
    scheduleInstallments.some((inst) => {
      const amount = Number(inst.amount ?? inst.installmentAmount ?? 0)
      const paid = Number(inst.paidAmount ?? inst.amountPaid ?? 0)
      return paid > 0 && paid < amount
    })

  const completionTolerance = scheduleInstallments.length > 0 ? 2 : 0
  const isEffectivelyCompleted =
    totalFee > 0 &&
    (
      allInstallmentsPaid ||
      paidAmount >= Math.max(totalFee - completionTolerance, 0)
    )

  const displayPaidAmount = isEffectivelyCompleted ? totalFee : paidAmount
  const displayPendingAmount = isEffectivelyCompleted ? 0 : Math.max(totalFee - paidAmount, 0)

  let paymentStatus = 'Pending'
  if (isEffectivelyCompleted) {
    paymentStatus = 'Completed'
  } else if (hasPartialInstallment) {
    paymentStatus = 'Partially Paid'
  } else if (nextDueDate) {
    const today = new Date()
    const dueDate = new Date(nextDueDate)
    if (!Number.isNaN(dueDate.getTime()) && dueDate < today) {
      paymentStatus = 'Overdue'
    }
  } else if (paidAmount > 0) {
    paymentStatus = 'Upcoming'
  } else {
    paymentStatus = 'Upcoming'
  }

  return {
    totalFee,
    paidAmount: displayPaidAmount,
    pendingAmount: displayPendingAmount,
    nextInstallment,
    nextInstallmentAmount,
    nextInstallmentLabel,
    nextDueDate,
    paymentStatus,
  }
}

function getBranchStudentInstallmentProgress(stu = {}) {
  const installments = Array.isArray(stu.installmentSchedule)
    ? stu.installmentSchedule
    : Array.isArray(stu.paymentPlan?.installments)
      ? stu.paymentPlan.installments
      : []
  const statusFields = [
    stu.firstInstallmentStatus,
    stu.secondInstallmentStatus,
    stu.thirdInstallmentStatus,
    stu.fourthInstallmentStatus,
  ].filter((value) => String(value || '').trim() !== '')

  const explicitCounts = [
    stu.installmentCount,
    stu.totalInstallments,
    stu.paymentPlanInstallmentCount,
    stu.paymentPlan?.installmentCount,
    stu.paymentPlan?.count,
    Array.isArray(stu.paymentPlan?.installments) ? stu.paymentPlan.installments.length : 0,
  ]
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value) && value > 0)

  const totalInstallments = Math.max(
    installments.length,
    statusFields.length,
    ...explicitCounts,
  )

  const clampPercentage = (value) => {
    if (!Number.isFinite(value)) return 0
    return Math.min(100, Math.max(0, value))
  }

  const paidInstallments = installments.length
    ? installments.reduce((count, inst) => {
        const amount = Number(inst.amount ?? inst.installmentAmount ?? 0)
        const paid = Number(inst.paidAmount ?? inst.amountPaid ?? 0)
        const status = String(inst.status ?? inst.paymentStatus ?? '').trim().toLowerCase()

        if (status === 'paid' || (amount > 0 && paid >= amount) || (!amount && paid > 0)) {
          return count + 1
        }

        return count
      }, 0)
    : [
        stu.firstInstallmentStatus,
        stu.secondInstallmentStatus,
        stu.thirdInstallmentStatus,
        stu.fourthInstallmentStatus,
      ].reduce((count, status) => {
        return String(status || '').trim().toLowerCase() === 'paid' ? count + 1 : count
      }, 0)

  const totalWeight = totalInstallments > 0 ? 100 / totalInstallments : 0

  const installmentBasedProgress = installments.length
    ? installments.reduce((sum, inst) => {
        const amount = Number(inst.amount ?? inst.installmentAmount ?? 0)
        const paid = Number(inst.paidAmount ?? inst.amountPaid ?? 0)
        const status = String(inst.status ?? inst.paymentStatus ?? '').trim().toLowerCase()

        let installmentRatio = 0

        if (amount > 0) {
          installmentRatio = Math.min(1, Math.max(0, paid / amount))
        } else if (status === 'paid' || paid > 0) {
          installmentRatio = 1
        }

        return sum + (installmentRatio * totalWeight)
      }, 0)
    : 0

  const statusBasedProgress = !installments.length && totalInstallments > 0
    ? (paidInstallments / totalInstallments) * 100
    : 0

  const fallbackAmountPaid = Number(stu.paidAmount ?? stu.totalPaid ?? stu.amountPaid ?? 0)
  const fallbackTotalAmount = Number(stu.finalFee ?? stu.courseAmount ?? stu.totalAmount ?? stu.afterDiscount ?? 0)
  const amountBasedProgress = !installments.length && fallbackTotalAmount > 0
    ? (fallbackAmountPaid / fallbackTotalAmount) * 100
    : 0

  const paidInstallmentPercentage = clampPercentage(
    installments.length
      ? installmentBasedProgress
      : Math.max(statusBasedProgress, amountBasedProgress),
  )

  return {
    paidInstallments,
    totalInstallments,
    paidInstallmentPercentage,
  }
}

function formatBranchRupees(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function formatBranchPercentage(value) {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '')
}

function normalizeBranchStudentLookupKey(student = {}) {
  return String(student?.id || student?.studentId || '').trim().toLowerCase()
}

function getBranchStudentLookupKeys(student = {}) {
  return Array.from(
    new Set(
      [
        student?.id,
        student?.studentId,
        student?.recordId,
        student?._recordId,
        student?.originalStudentId,
        student?._originalStudentId,
      ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

function resolveBranchStudentCourse(student = {}, courses = []) {
  const studentCourseId = String(student?.courseId || student?.course?.id || '').trim()
  const studentCourseCode = String(student?.courseCode || student?.course?.courseCode || '').trim().toLowerCase()
  const studentCourseName = String(
    student?.courseName ||
    student?.courseInterested ||
    student?.course?.name ||
    '',
  ).trim().toLowerCase()
  const studentFacultyId = String(student?.facultyId || student?.course?.facultyId || '').trim().toLowerCase()
  const studentFacultyName = String(student?.facultyName || student?.course?.facultyName || '').trim().toLowerCase()

  const matchesFaculty = (course = {}) => {
    const assignedFaculty = Array.isArray(course?.assignedFaculty) ? course.assignedFaculty : []
    if (!assignedFaculty.length) return false

    return assignedFaculty.some((faculty) => {
      const facultyId = String(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || '').trim().toLowerCase()
      const facultyName = String(faculty?.name || faculty?.facultyName || '').trim().toLowerCase()
      return (
        (studentFacultyId && facultyId && facultyId === studentFacultyId) ||
        (studentFacultyName && facultyName && facultyName === studentFacultyName)
      )
    })
  }

  if (studentCourseId) {
    const matchedCourse = Array.isArray(courses)
      ? courses.find((course) => String(course?.id || '').trim() === studentCourseId)
      : null

    if (matchedCourse) {
      return matchedCourse
    }
  }

  if (studentCourseCode) {
    const matchedCourseByCode = Array.isArray(courses)
      ? courses.find((course) => String(course?.courseCode || '').trim().toLowerCase() === studentCourseCode)
      : null

    if (matchedCourseByCode) {
      return matchedCourseByCode
    }
  }

  if (studentCourseName) {
    const matchedCourseByName = Array.isArray(courses)
      ? courses.find((course) => {
          const courseName = String(course?.name || course?.courseName || course?.title || '').trim().toLowerCase()
          return courseName && courseName === studentCourseName
        })
      : null

    if (matchedCourseByName) {
      return matchedCourseByName
    }
  }

  const matchedCourseByFaculty = Array.isArray(courses)
    ? courses.find((course) => matchesFaculty(course))
    : null

  if (matchedCourseByFaculty) {
    return matchedCourseByFaculty
  }

  if (student && typeof student.course === 'object') {
    return student.course
  }

  return null
}

function formatBranchPaymentDate(date) {
  if (!date) return '-'
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return '-'
  return parsedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function resolveBranchPaymentMode(record = {}) {
  const candidates = [
    record.paymentMode,
    record.mode,
    record.paymentMethod,
    record.method,
    record.transactionMode,
    record.modeOfPayment,
    record.actualPaymentMode,
  ]

  const firstNonEmpty = candidates.find((value) => String(value || '').trim())
  const mode = String(firstNonEmpty || '').trim()

  if (!mode) return '-'
  if (/^installment(s)?$/i.test(mode)) return '-'

  return mode
}

function formatBranchPaymentMode(record = {}) {
  const resolvedMode = resolveBranchPaymentMode(record)
  if (resolvedMode !== '-') {
    return resolvedMode
  }

  const fallbackMode = String(record.paymentMode || record.mode || '').trim()
  if (/^installment(s)?$/i.test(fallbackMode)) {
    return 'Installment'
  }

  return fallbackMode || '-'
}

function getBranchPaymentModePriority(record = {}) {
  const rawMode = String(record.paymentMode || record.mode || '').trim()
  if (!rawMode) return 0
  if (/^installment(s)?$/i.test(rawMode)) return 1
  return 2
}

function getBranchPaymentHistoryDisplayText(...values) {
  const text = values
    .map((value) => String(value || '').trim())
    .find((value) => value && value !== '-' && value !== 'â€”' && value !== 'â€“')

  return text || ''
}

function getBranchPaymentHistoryInstallmentNumber(record = {}) {
  const label = getBranchPaymentHistoryDisplayText(record.payAgainst, record.description)
  const match = String(label || '').match(/installment\s*(\d+)/i)
  return match ? Number(match[1]) : null
}

function getBranchPaymentHistoryDateKey(record = {}) {
  const rawDate = getBranchLedgerEntryDateRaw(record, '')
  if (!rawDate) return ''

  const parsedDate = new Date(rawDate)
  if (Number.isNaN(parsedDate.getTime())) {
    return normalizeBranchLedgerEntryLabel(rawDate)
  }

  return parsedDate.toISOString().slice(0, 10)
}

function getBranchPaymentHistoryCanonicalKey(record = {}) {
  const studentId = String(record.studentId || '').trim().toLowerCase()
  const installmentNumber = getBranchPaymentHistoryInstallmentNumber(record)
  const label = installmentNumber
    ? `installment-${installmentNumber}`
    : normalizeBranchLedgerEntryLabel(getBranchPaymentHistoryDisplayText(record.payAgainst, record.description, record.referenceType))
  const amount = Math.max(getFirstFiniteNumber(record.amount), 0)

  return [
    studentId,
    label,
    getBranchPaymentHistoryDateKey(record),
    amount,
  ].join('|')
}

function getFirstFiniteNumber(...values) {
  for (const value of values) {
    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) {
      return numericValue
    }
  }

  return 0
}

function getBranchStudentCourseFeeAmount(student = {}) {
  return Math.max(
    getFirstFiniteNumber(
      student.finalFee,
      student.courseAmount,
      student.totalAmount,
      student.afterDiscount,
    ),
    0,
  )
}

function getBranchStudentOpeningBalanceAmount(student = {}) {
  return Math.max(
    getFirstFiniteNumber(
      student.openingBalance,
      student.broughtForward,
      student.balanceBroughtForward,
      student.carryForwardBalance,
      student.carryForwardDue,
      student.previousDue,
      student.pendingCarryForward,
      student.outstandingBalance,
    ),
    0,
  )
}

function getBranchLedgerEntryDateRaw(entry = {}, fallbackDate = getTodayValue()) {
  const candidate = String(
    entry.dateRaw ||
    entry.paymentDateRaw ||
    entry.paymentDate ||
    entry.createdAt ||
    entry.date ||
    fallbackDate ||
    '',
  ).trim()

  return candidate || fallbackDate || ''
}

function getBranchLedgerEntrySortPriority(entry = {}) {
  if (String(entry.entryType || '').trim().toUpperCase() === 'OPENING_BALANCE') {
    return 0
  }

  if (Number(entry.debit || 0) > 0 && Number(entry.credit || 0) <= 0) {
    return 1
  }

  if (Number(entry.credit || 0) > 0 && Number(entry.debit || 0) <= 0) {
    return 2
  }

  return 3
}

function normalizeBranchLedgerEntryLabel(value = '') {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''

  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .trim()
}

function getBranchLedgerDisplayText(...values) {
  const text = values
    .map((value) => String(value || '').trim())
    .find((value) => value && value !== '-' && value !== '—' && value !== '–')

  return text || ''
}

function getBranchLedgerDateKey(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''

  const parsedDate = new Date(text)
  if (Number.isNaN(parsedDate.getTime())) {
    return normalizeBranchLedgerEntryLabel(text)
  }

  return parsedDate.toISOString().slice(0, 10)
}

function getBranchLedgerInstallmentNumber(value = '') {
  const match = String(value || '').match(/installment\s*(\d+)/i)
  return match ? Number(match[1]) : null
}

function getBranchLedgerPaymentKey(record = {}) {
  const amount = Math.max(getFirstFiniteNumber(record.amount), 0)
  const dateKey = getBranchLedgerDateKey(getBranchLedgerEntryDateRaw(record, ''))
  const receiptNumber = String(record.receiptNumber || '').trim().toLowerCase()
  const payAgainst = normalizeBranchLedgerEntryLabel(
    getBranchLedgerDisplayText(record.payAgainst, record.description),
  )
  const installmentNo = getBranchLedgerInstallmentNumber(payAgainst)

  const primaryLabel = installmentNo ? `installment-${installmentNo}` : payAgainst
  return [
    String(record.studentId || record.studentRecordId || record.branchStudentId || '').trim().toLowerCase(),
    primaryLabel,
    dateKey,
    amount,
    installmentNo ? '' : receiptNumber,
  ].join('|')
}

function buildBranchStudentLedgerFallback(student = {}, paymentHistoryRecords = []) {
  const studentId = String(student.studentId || student.id || '').trim()
  const studentName = String(student.studentName || '-').trim()
  const courseName = String(
    student.courseName ||
    student.courseInterested ||
    student.course?.name ||
    '-',
  ).trim()
  const baseDate =
    student.admissionDate ||
    student.createdAt ||
    student.updatedAt ||
    getTodayValue()

  const entries = []
  let sequence = 0

  const pushEntry = (entry = {}) => {
    const debit = Math.max(Number(entry.debit || 0), 0)
    const credit = Math.max(Number(entry.credit || 0), 0)

      entries.push({
        id: String(
          entry.id ||
          `${studentId || 'ledger'}-${entry.referenceType || 'entry'}-${entry.dateRaw || baseDate}-${sequence}`,
        ).trim(),
      studentRecordId: String(entry.studentRecordId || student.id || student.recordId || '').trim(),
      branchId: String(entry.branchId || student.branchId || '').trim(),
      studentId,
      studentName,
      course: courseName,
      description: String(entry.description || '').trim(),
      entryType: String(entry.entryType || (credit > 0 ? 'CREDIT' : 'DEBIT')).trim().toUpperCase(),
      debit,
      credit,
      amount: Number(entry.amount ?? debit ?? credit ?? 0),
      runningBalance: 0,
      studentBalanceAfter: 0,
      paymentMode: String(entry.paymentMode || '').trim(),
      receiptNumber: String(entry.receiptNumber || '').trim(),
      payAgainst: String(entry.payAgainst || '').trim(),
      transactionReference: String(entry.transactionReference || '').trim(),
      notes: String(entry.notes || '').trim(),
      referenceType: String(entry.referenceType || '').trim(),
      referenceId: String(entry.referenceId || '').trim(),
      dateRaw: getBranchLedgerEntryDateRaw(entry, baseDate),
      date: String(entry.date || '').trim(),
      status: String(entry.status || '').trim(),
      entryNo: sequence + 1,
      sequence,
    })

    sequence += 1
  }

  const openingBalance = getBranchStudentOpeningBalanceAmount(student)
  if (openingBalance > 0) {
    pushEntry({
      description: 'Opening Balance',
      debit: openingBalance,
      entryType: 'OPENING_BALANCE',
      referenceType: 'opening-balance',
      dateRaw: baseDate,
      date: baseDate,
    })
  }

  const courseFee = getBranchStudentCourseFeeAmount(student)
  if (courseFee > 0) {
    pushEntry({
      description: 'Course Fee',
      debit: courseFee,
      entryType: 'DEBIT',
      referenceType: 'course-fee',
      dateRaw: baseDate,
      date: baseDate,
    })
  }

  const chargeFields = [
    ['registrationFee', 'Registration Fee'],
    ['registrationFees', 'Registration Fee'],
    ['materialFee', 'Material Fee'],
    ['extraFee', 'Extra Fee'],
    ['lateFee', 'Late Fee'],
    ['admissionFee', 'Admission Fee'],
  ]

  chargeFields.forEach(([field, label]) => {
    const amount = Math.max(getFirstFiniteNumber(student[field]), 0)
    if (amount <= 0) return

    pushEntry({
      description: label,
      debit: amount,
      entryType: 'DEBIT',
      referenceType: field,
      dateRaw: baseDate,
      date: baseDate,
    })
  })

  const knownPaymentKeys = new Set(
    getBranchStudentLookupKeys(student).filter(Boolean),
  )

  const paymentRecordsByKey = new Map()

  paymentHistoryRecords
    .filter((record = {}) => {
      const recordKeys = [
        record.studentId,
        record.studentRecordId,
        record.branchStudentId,
      ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)

      return recordKeys.some((recordKey) => knownPaymentKeys.has(recordKey))
    })
    .forEach((record = {}) => {
      const amount = Math.max(getFirstFiniteNumber(record.amount), 0)
      if (amount <= 0) return

      const key = getBranchLedgerPaymentKey(record)
      const candidate = {
        id: String(record.id || record.receiptNumber || '').trim(),
        description: getBranchLedgerDisplayText(record.payAgainst, record.description) || 'Payment',
        credit: amount,
        entryType: 'CREDIT',
        referenceType: 'payment',
        referenceId: String(record.id || record.receiptNumber || '').trim(),
        paymentMode: String(record.paymentMode || record.mode || '').trim(),
        receiptNumber: String(record.receiptNumber || '').trim(),
        payAgainst: String(record.payAgainst || '').trim(),
        transactionReference: String(record.transactionReference || '').trim(),
        notes: String(record.notes || '').trim(),
        dateRaw: getBranchLedgerEntryDateRaw(record, baseDate),
        date: String(record.date || '').trim(),
      }

      const existing = paymentRecordsByKey.get(key)
      if (!existing || getBranchPaymentModePriority(candidate) >= getBranchPaymentModePriority(existing)) {
        paymentRecordsByKey.set(key, candidate)
      }
    })

  paymentRecordsByKey.forEach((record) => {
    pushEntry(record)
  })

  entries.sort((left, right) => {
    const leftTime = new Date(left.dateRaw || baseDate).getTime()
    const rightTime = new Date(right.dateRaw || baseDate).getTime()

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    const priorityDelta = getBranchLedgerEntrySortPriority(left) - getBranchLedgerEntrySortPriority(right)
    if (priorityDelta !== 0) {
      return priorityDelta
    }

    return left.sequence - right.sequence
  })

  let runningBalance = 0
  let totalDebit = 0
  let totalCredit = 0

  const normalizedEntries = entries.map((entry, index) => {
    totalDebit += Number(entry.debit || 0)
    totalCredit += Number(entry.credit || 0)
    runningBalance += Number(entry.debit || 0) - Number(entry.credit || 0)

    return {
      ...entry,
      entryNo: index + 1,
      runningBalance,
      studentBalanceAfter: runningBalance,
    }
  })

  return {
    entries: normalizedEntries,
    summary: {
      totalDebit,
      totalCredit,
      outstandingBalance: runningBalance,
      entryCount: normalizedEntries.length,
      paymentCount: normalizedEntries.filter((entry) => Number(entry.credit || 0) > 0).length,
      studentCount: studentId ? 1 : 0,
    },
  }
}

function formatStudentDate(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  const date = new Date(`${text}T00:00:00`)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatExternalUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  return `https://${text}`
}

function normalizeLookupText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function findCountryMatch(countries = [], student = {}) {
  const countryCode = normalizeLookupText(student.countryCode)
  const countryName = normalizeLookupText(student.country)

  return countries.find((country) =>
    normalizeLookupText(country.iso2) === countryCode ||
    normalizeLookupText(country.name) === countryName ||
    (countryCode === 'in' && normalizeLookupText(country.name) === 'india')
  ) || null
}

function findStateMatch(states = [], student = {}) {
  const stateCode = normalizeLookupText(student.stateCode)
  const stateName = normalizeLookupText(student.state)

  return states.find((state) =>
    normalizeLookupText(state.iso2) === stateCode ||
    normalizeLookupText(state.name) === stateName ||
    (stateCode === 'tn' && normalizeLookupText(state.name) === 'tamil nadu')
  ) || null
}

function findCityMatch(cities = [], student = {}) {
  const cityName = normalizeLookupText(student.city)
  return cities.find((city) => normalizeLookupText(city.name) === cityName) || null
}

async function resolveStudentLocationForm(student = {}) {
  const resolved = { ...student }

  try {
    const countries = await getCountries()
    const matchedCountry = findCountryMatch(countries, resolved) || countries.find((country) => normalizeLookupText(country.iso2) === 'in') || null
    if (matchedCountry) {
      resolved.countryCode = matchedCountry.iso2 || resolved.countryCode || ''
      resolved.country = matchedCountry.name || resolved.country || ''
    }

    if (resolved.countryCode) {
      const states = await getStatesOfCountry(resolved.countryCode)
      const matchedState = findStateMatch(states, resolved) || states.find((state) => normalizeLookupText(state.iso2) === 'tn') || null
      if (matchedState) {
        resolved.stateCode = matchedState.iso2 || resolved.stateCode || ''
        resolved.state = matchedState.name || resolved.state || ''
      }

      if (resolved.stateCode) {
        const cities = await getCitiesOfState(resolved.countryCode, resolved.stateCode)
        const matchedCity = findCityMatch(cities, resolved)
        if (matchedCity) {
          resolved.city = matchedCity.name || resolved.city || ''
        }
      }
    }
  } catch {
    // Fall back to whatever was already in the form.
  }

  return resolved
}

function normalizeBranchStudentCourseAmount(course = {}) {
  const afterDiscount = String(course?.afterDiscount || '').trim()
  if (afterDiscount) return afterDiscount

  const actualFees = Number(course?.actualFees || 0)
  const registrationFees = Number(course?.registrationFees || 0)
  const discount = Number(course?.discount || 0)

  if ([actualFees, registrationFees, discount].some((value) => Number.isNaN(value))) {
    return ''
  }

  return String(Math.max(actualFees + registrationFees - discount, 0))
}

function normalizeBranchStudentCourseFacultyOptions(course = {}) {
  return Array.isArray(course?.assignedFaculty)
    ? course.assignedFaculty
      .map((faculty) => {
        const id = String(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || '').trim()
        const name = String(faculty?.name || faculty?.facultyName || '').trim()

        if (!id && !name) return null

        return {
          id: id || name,
          name: name || id,
        }
      })
      .filter(Boolean)
    : []
}

function getBranchDashboardSectionFromPath(pathname = '', search = '') {
  if (pathname.endsWith('/notifications')) return 'notifications'

  const params = new URLSearchParams(search)
  const section = String(params.get('section') || '').trim().toLowerCase()

  if (section === 'notifications') return 'notifications'
  if (section === 'students') return 'students'
  if (section === 'courses') return 'courses'
  if (section === 'installments') return 'installments'
  if (section === 'faculty') return 'faculty'
  if (section === 'batches') return 'batches'
  if (section === 'payments') return 'payments'
  if (section === 'profile') return 'profile'

  return ''
}

function BranchDashboardSection({ title, description, actions, children }) {
  return (
    <section className="branch-dashboard-section">
      <div className="branch-dashboard-section-heading">
        <div className="branch-dashboard-section-heading-copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {actions ? <div className="branch-dashboard-section-heading-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

function BranchNotificationGroup({ label, items, onView, onAcceptRequest, showDetails = false }) {
  return (
    <section className="notifications-group">
      <p className="notifications-group-label">{label}</p>
      <div className="notifications-group-list">
        {items.map((item) => {
          const Icon = item.icon
          const isCourseEditRequest =
            item.kind === 'branch-course-edit-request' || item.kind === 'course-edit-request'
          const isAcceptedRequest =
            isCourseEditRequest &&
            String(item.requestStatus || '').trim().toLowerCase() === 'accepted'
          const isProgressNotification = String(item.kind || '').includes('progress-status')

          return (
            <article
              key={`${label}-${item.id || item.title}-${item.time}`}
              className={showDetails ? '' : `notifications-item ${item.unread ? 'is-unread' : ''}`.trim()}
              role="button"
              tabIndex={0}
              onClick={() => onView?.(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onView?.(item)
                }
              }}
              style={
                showDetails
                  ? {
                      display: 'block',
                      width: '100%',
                      padding: '18px 20px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '18px',
                      background: item.unread ? '#f5fbf7' : '#ffffff',
                      boxShadow: '0 1px 0 rgba(15, 23, 42, 0.03)',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }
                  : undefined
              }
            >
              {showDetails ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      minWidth: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: '0 0 auto',
                        background:
                          item.tone === 'green'
                            ? '#e8f9ee'
                            : item.tone === 'amber'
                              ? '#fff7e6'
                              : item.tone === 'red'
                                ? '#fff1f2'
                                : '#eef4ff',
                        color:
                          item.tone === 'green'
                            ? '#16a34a'
                            : item.tone === 'amber'
                              ? '#d97706'
                              : item.tone === 'red'
                                ? '#e11d48'
                                : '#2563eb',
                      }}
                    >
                      <Icon size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                    </span>

                    <div style={{ minWidth: 0, flex: '1 1 auto', display: 'grid', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.02rem', lineHeight: 1.25, fontWeight: 800 }}>
                            {item.title}
                          </h3>
                          <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '0.95rem', lineHeight: 1.45 }}>
                            {item.message}
                          </p>
                        </div>
                        <small style={{ flex: '0 0 auto', whiteSpace: 'nowrap', color: '#94a3b8', fontWeight: 700 }}>
                          {item.time}
                        </small>
                      </div>

                      {isProgressNotification ? (
                        <div
                          style={{
                            display: 'grid',
                            gap: '6px',
                            padding: '12px 14px',
                            borderRadius: '14px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#0f172a',
                            fontSize: '0.92rem',
                            lineHeight: 1.45,
                          }}
                        >
                          <p style={{ margin: 0 }}><strong>Student ID:</strong> {item.studentId || '-'}</p>
                          <p style={{ margin: 0 }}><strong>Student Name:</strong> {item.studentName || '-'}</p>
                          <p style={{ margin: 0 }}><strong>Course Progress:</strong> {item.courseProgress ? `${item.courseProgress}%` : '-'}</p>
                          <p style={{ margin: 0 }}><strong>Paid Progress:</strong> {item.paidProgress ? `${item.paidProgress}%` : '-'}</p>
                          <p style={{ margin: 0 }}><strong>Status:</strong> {item.statusLabel || '-'}</p>
                          <p style={{ margin: 0 }}><strong>Summary:</strong> {item.summary || item.message}</p>
                        </div>
                      ) : null}

                      {isCourseEditRequest ? (
                        <div
                          style={{
                            display: 'grid',
                            gap: '6px',
                            padding: '12px 14px',
                            borderRadius: '14px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#0f172a',
                            fontSize: '0.92rem',
                            lineHeight: 1.45,
                          }}
                        >
                          {item.requestTitle ? <p style={{ margin: 0 }}><strong>Title:</strong> {item.requestTitle}</p> : null}
                          {item.requestReason ? <p style={{ margin: 0 }}><strong>Reason:</strong> {item.requestReason}</p> : null}
                          {item.requestDescription ? <p style={{ margin: 0 }}><strong>Description:</strong> {item.requestDescription}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginTop: '14px',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '30px',
                        padding: '0 12px',
                        borderRadius: '999px',
                        background:
                          item.tone === 'green'
                            ? '#dcfce7'
                            : item.tone === 'amber'
                              ? '#fef3c7'
                              : item.tone === 'red'
                                ? '#fee2e2'
                                : '#dbeafe',
                        color:
                          item.tone === 'green'
                            ? '#15803d'
                            : item.tone === 'amber'
                              ? '#b45309'
                              : item.tone === 'red'
                                ? '#b91c1c'
                                : '#1d4ed8',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.statusLabel || item.categoryLabel || item.actionLabel || 'View'}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isCourseEditRequest ? (
                        isAcceptedRequest ? (
                          <span className="notifications-item-view-button is-accepted" aria-disabled="true">
                            Accepted
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="notifications-item-view-button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onAcceptRequest?.(item)
                            }}
                          >
                            Accept
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          className="notifications-item-view-button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onView?.(item)
                          }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <span className={`notifications-item-icon tone-${item.tone}`} aria-hidden="true">
                    <Icon size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                  </span>

                  <div className="notifications-item-copy">
                    <div className="notifications-item-title-row">
                      <h3>{item.title}</h3>
                      <small>{item.time}</small>
                    </div>
                    <p>{item.message}</p>
                  </div>

                  <div className="notifications-item-meta">
                    <span className={`notifications-item-chip tone-${item.tone}`}>
                      {isAcceptedRequest ? 'Accepted' : item.categoryLabel || item.actionLabel || 'View'}
                    </span>
                    {isCourseEditRequest ? (
                      isAcceptedRequest ? (
                        <span className="notifications-item-view-button is-accepted" aria-disabled="true">
                          Accepted
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="notifications-item-view-button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onAcceptRequest?.(item)
                          }}
                        >
                          Accept
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        className="notifications-item-view-button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onView?.(item)
                        }}
                      >
                        View
                      </button>
                    )}
                  </div>
                </>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Field({ label, hint, error, children, required = false }) {
  return (
    <label className="course-field">
      <div className="course-field-label">
        {label}
        {required ? <b>*</b> : null}
      </div>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <small className="course-field-error">{error}</small> : null}
    </label>
  )
}

function CourseFieldInfoTooltip({ label, description }) {
  const [isPinnedOpen, setIsPinnedOpen] = useState(false)
  const triggerRef = useRef(null)
  const isOpen = isPinnedOpen

  useEffect(() => {
    if (!isPinnedOpen) return undefined

    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return
      setIsPinnedOpen(false)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsPinnedOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPinnedOpen])

  return (
    <span
      ref={triggerRef}
      className={`course-field-info-trigger-wrap ${isOpen ? 'is-open' : ''}`}
    >
      <button
        type="button"
        className="course-field-info-trigger"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={() => setIsPinnedOpen((current) => !current)}
      >
        <BadgeInfo size={16} strokeWidth={2.3} aria-hidden="true" focusable="false" />
      </button>
      <span className="course-field-info-tooltip" role="tooltip">
        <span>{description}</span>
      </span>
    </span>
  )
}

const BRANCH_COURSES_PER_PAGE = 5

function AvatarBadge() {
  return (
    <span className="super-admin-avatar" aria-hidden="true">
      <span className="super-admin-avatar-mark">
        <Shield size={18} strokeWidth={2.2} />
      </span>
    </span>
  )
}

function SidebarUserAvatar() {
  return (
    <span className="super-admin-sidebar-user-avatar" aria-hidden="true">
      <CircleUserRound size={34} strokeWidth={1.9} />
      <span className="super-admin-sidebar-user-status" />
    </span>
  )
}

function buildFallbackBranchProfile(user, session) {
  return {
    branchName: 'Branch Dashboard',
    branchAdminName: user?.name || 'Branch Admin',
    branchEmail: String(user?.email || session?.user?.email || '').trim().toLowerCase() || 'branch@example.com',
    branchAddress: 'Assigned location',
    mustResetPassword: Boolean(user?.mustResetPassword || session?.user?.mustResetPassword),
  }
}

const formatBranchCourseAmount = formatBranchCourseMoney
const COURSE_CODE_PREFIX = 'CIS-'
const COURSE_DRAFT_STORAGE_PREFIX = 'branch-course-draft:'
const COURSE_BASIC_FIELDS = [
  'courseCode',
  'name',
  'mode',
  'duration',
  'hours',
  'actualFees',
  'registrationFees',
  'discount',
  'status',
]

function createCourseNodeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function createBranchCourseSubmodel(submodelIndex = 1, name = '') {
  return {
    id: createCourseNodeId('submodel'),
    name: String(name || '').trim(),
  }
}

function createBranchCourseModel(modelIndex = 1, name = '', submodels = []) {
  return {
    id: createCourseNodeId('model'),
    name: String(name || '').trim(),
    submodels: Array.isArray(submodels) ? submodels : [],
  }
}

function createBranchInstallmentAmounts(count = 3, value = '') {
  const safeCount = Math.max(1, Number(count) || 1)
  return Array.from({ length: safeCount }, () => String(value || '').trim())
}

function buildBalancedBranchInstallmentAmounts(totalFee = 0, count = 3) {
  const safeCount = Math.max(1, Number(count) || 1)
  const safeTotal = Math.max(0, Number(totalFee) || 0)
  if (safeCount === 1) {
    return [String(safeTotal)]
  }

  const averageAmount = safeTotal / safeCount
  let roundedInstallmentAmount = Math.round(averageAmount / 1000) * 1000
  while (roundedInstallmentAmount > 0 && roundedInstallmentAmount * (safeCount - 1) > safeTotal) {
    roundedInstallmentAmount -= 1000
  }
  const previousInstallmentsTotal = roundedInstallmentAmount * (safeCount - 1)
  const finalInstallmentAmount = Math.max(safeTotal - previousInstallmentsTotal, 0)

  return [
    ...Array.from({ length: safeCount - 1 }, () => String(roundedInstallmentAmount)),
    String(finalInstallmentAmount),
  ]
}

function normalizeBranchInstallmentTemplate(template = {}, fallback = {}) {
  const safeTemplate = template && typeof template === 'object' ? template : {}
  const safeFallback = fallback && typeof fallback === 'object' ? fallback : {}
  const rawInstallments = Array.isArray(safeTemplate.installments)
    ? safeTemplate.installments
    : Array.isArray(safeTemplate.installmentAmounts)
      ? safeTemplate.installmentAmounts
      : Array.isArray(safeFallback.installments)
        ? safeFallback.installments
        : []
  const installmentCount = Math.max(
    1,
    Number(safeTemplate.installmentCount || safeFallback.installmentCount || rawInstallments.length || 3) || 3,
  )

  const installments = rawInstallments.length
    ? rawInstallments.map((value) => String(value ?? '').trim())
    : createBranchInstallmentAmounts(installmentCount)

  while (installments.length < installmentCount) {
    installments.push('')
  }

  return {
    templateName: String(safeTemplate.templateName || safeTemplate.planName || safeFallback.templateName || 'Standard Installment Plan').trim(),
    installmentCount: String(installmentCount),
    installments: installments.slice(0, installmentCount),
    dueRule: String(safeTemplate.dueRule || safeFallback.dueRule || 'Admission').trim(),
    allowCustomization:
      typeof safeTemplate.allowCustomization === 'boolean'
        ? safeTemplate.allowCustomization
        : typeof safeFallback.allowCustomization === 'boolean'
          ? safeFallback.allowCustomization
          : true,
    status: String(safeTemplate.status || safeFallback.status || 'Active').trim(),
  }
}

function normalizeBranchInstallmentAmountList(amounts = [], count = 3) {
  const safeCount = Math.max(1, Number(count) || 1)
  const nextAmounts = Array.isArray(amounts)
    ? amounts.map((value) => String(value ?? '').trim())
    : []

  while (nextAmounts.length < safeCount) {
    nextAmounts.push('')
  }

  return nextAmounts.slice(0, safeCount)
}

function getBranchInstallmentAmountTotal(amounts = []) {
  return (Array.isArray(amounts) ? amounts : [])
    .map((value) => Number(String(value || '').trim()))
    .filter((value) => Number.isFinite(value))
    .reduce((total, value) => total + value, 0)
}

const BRANCH_PAYMENT_PLAN_CUSTOM_VALUE = '__custom__'

function normalizeBranchCoursePaymentPlanSelection(selection = {}, fallback = {}) {
  const safeSelection = selection && typeof selection === 'object' ? selection : {}
  const safeFallback = fallback && typeof fallback === 'object' ? fallback : {}
  const type = String(safeSelection.type || safeSelection.planType || safeFallback.type || 'template').trim().toLowerCase()
  const templateId = String(safeSelection.templateId || safeSelection.id || safeFallback.templateId || '').trim()
  const rawInstallmentCount = String(safeSelection.installmentCount ?? safeSelection.count ?? safeFallback.installmentCount ?? safeFallback.count ?? '').trim()
  const installmentCount = Math.max(
    1,
    Number(rawInstallmentCount || 1) || 1,
  )
  const installments = normalizeBranchInstallmentAmountList(
    Array.isArray(safeSelection.installments)
      ? safeSelection.installments
      : Array.isArray(safeFallback.installments)
        ? safeFallback.installments
        : [],
    installmentCount,
  )

  return {
    id: String(safeSelection.id || templateId || (type === 'custom' ? BRANCH_PAYMENT_PLAN_CUSTOM_VALUE : createCourseNodeId('payment-plan'))).trim(),
    type: type === 'custom' ? 'custom' : 'template',
    templateId: type === 'custom' ? BRANCH_PAYMENT_PLAN_CUSTOM_VALUE : templateId,
    templateName: String(safeSelection.templateName || safeSelection.planName || safeFallback.templateName || (type === 'custom' ? 'Custom' : 'Payment Plan')).trim(),
    installmentCount: type === 'custom' && !rawInstallmentCount ? '' : String(installmentCount),
    installments,
    dueRule: String(safeSelection.dueRule || safeFallback.dueRule || 'Admission').trim(),
    allowCustomization:
      typeof safeSelection.allowCustomization === 'boolean'
        ? safeSelection.allowCustomization
        : typeof safeFallback.allowCustomization === 'boolean'
          ? safeFallback.allowCustomization
          : true,
    status: String(safeSelection.status || safeFallback.status || 'Active').trim(),
  }
}

function normalizeBranchCoursePaymentPlanSelections(plans = [], fallbackPlans = []) {
  const primaryPlans = Array.isArray(plans) ? plans : []
  const fallback = Array.isArray(fallbackPlans) ? fallbackPlans : []
  const sourcePlans = primaryPlans.length ? primaryPlans : fallback

  return sourcePlans.map((plan, index) =>
    normalizeBranchCoursePaymentPlanSelection(plan, {
      id: plan?.id || `payment-plan-${index + 1}`,
      templateId: plan?.templateId || plan?.id || '',
      templateName: plan?.templateName || plan?.planName || '',
      installmentCount: plan?.installmentCount ?? plan?.count ?? '',
      installments: Array.isArray(plan?.installments) ? plan.installments : [],
      type: String(plan?.type || plan?.planType || '').trim().toLowerCase() === 'custom' ? 'custom' : 'template',
      dueRule: plan?.dueRule || 'Admission',
      allowCustomization: plan?.allowCustomization,
      status: plan?.status || 'Active',
    }),
  )
}

function buildBranchCoursePaymentPlanInstallments(totalFee = 0, count = 1) {
  return buildBalancedBranchInstallmentAmounts(totalFee, count)
}

function getBranchCoursePaymentPlanInstallmentCount(plan = {}) {
  if (String(plan?.type || '').trim().toLowerCase() === 'custom' && !String(plan?.installmentCount || '').trim()) {
    return 0
  }
  return Math.max(1, Number(plan?.installmentCount || 0) || 1)
}

function buildBranchCoursePaymentPlanPayloadSelections(plans = [], finalFee = 0) {
  const normalizedPlans = normalizeBranchCoursePaymentPlanSelections(plans)

  return normalizedPlans.map((plan, index) => {
    const installmentCount = getBranchCoursePaymentPlanInstallmentCount(plan)
    const installments = buildBranchCoursePaymentPlanInstallments(finalFee, installmentCount)

    return {
      id: plan.id || `payment-plan-${index + 1}`,
      type: plan.type,
      templateId: plan.templateId,
      templateName: plan.templateName,
      installmentCount: String(installmentCount),
      installments,
      dueRule: plan.dueRule,
      allowCustomization: plan.allowCustomization,
      status: plan.status,
    }
  })
}

function buildBranchCourseInstallmentTemplateFromPaymentPlan(plan = {}, finalFee = 0) {
  const installmentCount = getBranchCoursePaymentPlanInstallmentCount(plan)
  return {
    templateName: String(plan.templateName || (plan.type === 'custom' ? 'Custom' : 'Payment Plan')).trim(),
    installmentCount: String(installmentCount),
    installments: buildBranchCoursePaymentPlanInstallments(finalFee, installmentCount),
    dueRule: String(plan.dueRule || 'Admission').trim(),
    allowCustomization: Boolean(plan.allowCustomization ?? true),
    status: String(plan.status || 'Active').trim(),
  }
}

function buildBranchCoursePaymentPlanSelectionsFromRecord(course = {}, fallbackTemplates = []) {
  const paymentPlans = Array.isArray(course.paymentPlans)
    ? course.paymentPlans
    : Array.isArray(course.paymentPlanSelections)
      ? course.paymentPlanSelections
      : Array.isArray(course.installmentPlans)
        ? course.installmentPlans
        : []

  if (paymentPlans.length) {
    return normalizeBranchCoursePaymentPlanSelections(paymentPlans)
  }

  const installmentTemplate = course.installmentTemplate || course.branchInstallmentTemplate || null
  if (installmentTemplate) {
    const normalizedTemplate = normalizeBranchInstallmentTemplate(installmentTemplate)
    const rawTemplateId = String(installmentTemplate?.id || installmentTemplate?.templateId || installmentTemplate?.branchInstallmentTemplateId || '').trim()
    const matchedTemplate = Array.isArray(fallbackTemplates)
      ? fallbackTemplates.find((template) => String(template.id || '').trim() === rawTemplateId)
      : null

    return [
      normalizeBranchCoursePaymentPlanSelection({
        id: matchedTemplate?.id || rawTemplateId || BRANCH_PAYMENT_PLAN_CUSTOM_VALUE,
        type: String(normalizedTemplate.templateName || '').trim().toLowerCase() === 'custom' ? 'custom' : 'template',
        templateId: rawTemplateId || matchedTemplate?.id || '',
        templateName: normalizedTemplate.templateName || matchedTemplate?.templateName || 'Payment Plan',
        installmentCount: normalizedTemplate.installmentCount || 1,
        installments: normalizedTemplate.installments || [],
        dueRule: normalizedTemplate.dueRule || 'Admission',
        allowCustomization: normalizedTemplate.allowCustomization,
        status: normalizedTemplate.status || 'Active',
      }),
    ]
  }

  return []
}

function distributeBranchCoursePercentages(totalItems = 0) {
  const count = Math.max(0, Number(totalItems) || 0)
  if (!count) return []
  if (count === 1) return [100]

  const precision = 2
  const scale = 10 ** precision
  const base = Math.floor((100 / count) * scale) / scale
  const percentages = []
  let remaining = 100

  for (let index = 0; index < count; index += 1) {
    if (index === count - 1) {
      percentages.push(Number(remaining.toFixed(precision)))
    } else {
      percentages.push(Number(base.toFixed(precision)))
      remaining -= base
    }
  }

  return percentages
}

function normalizeBranchCourseSubmodels(submodels = [], modelIndex = 0) {
  const items = Array.isArray(submodels) ? submodels : []

  return items.map((submodel, submodelIndex) => ({
    id: String(submodel?.id || createCourseNodeId(`submodel-${modelIndex + 1}`)),
    name: String(submodel?.name || submodel?.title || ''),
  }))
}

function getBranchCourseSubmodelSource(model = {}) {
  return model?.submodels || model?.subModels || model?.submodules || model?.subModules || []
}

function normalizeBranchCourseModels(models = []) {
  const items = Array.isArray(models) ? models : []

  return items.map((model, modelIndex) => ({
    id: String(model?.id || createCourseNodeId(`model-${modelIndex + 1}`)),
    name: String(model?.name || model?.title || ''),
    submodels: normalizeBranchCourseSubmodels(getBranchCourseSubmodelSource(model), modelIndex),
  }))
}

function buildBranchCourseModelPayload(models = []) {
  const normalizedModels = normalizeBranchCourseModels(models)
  const modelPercentages = distributeBranchCoursePercentages(normalizedModels.length)

  return normalizedModels.map((model, modelIndex) => {
    const submodels = Array.isArray(model.submodels) ? model.submodels : []
    const submodelPercentages = distributeBranchCoursePercentages(submodels.length)

    return {
      id: model.id,
      name: String(model.name || '').trim(),
      percentage: modelPercentages[modelIndex] ?? 0,
      submodels: submodels.map((submodel, submodelIndex) => ({
        id: submodel.id,
        name: String(submodel.name || '').trim(),
        percentage: submodelPercentages[submodelIndex] ?? 0,
      })),
    }
  })
}

function getBranchCourseFinalFeeValue(form = {}) {
  const actualFees = Number(form.actualFees || 0)
  const registrationFees = Number(form.registrationFees || 0)
  const discount = Number(form.discount || 0)

  if ([actualFees, registrationFees, discount].some((value) => Number.isNaN(value))) {
    return 0
  }

  return Math.max(actualFees + registrationFees - discount, 0)
}

function buildBranchCourseHierarchySummary(models = []) {
  const normalizedModels = normalizeBranchCourseModels(models)
  return normalizedModels.map((model, modelIndex) => {
    const submodels = Array.isArray(model.submodels) ? model.submodels : []
    const modelPercentages = distributeBranchCoursePercentages(normalizedModels.length)
    const submodelPercentages = distributeBranchCoursePercentages(submodels.length)

    return {
      ...model,
      percentage: modelPercentages[modelIndex] ?? 0,
      submodels: submodels.map((submodel, submodelIndex) => ({
        ...submodel,
        percentage: submodelPercentages[submodelIndex] ?? 0,
      })),
    }
  })
}

function getBranchCourseModuleWeightageSummary(models = []) {
  const totalModules = Array.isArray(models) ? models.length : 0

  return {
    totalWeightage: 100,
    moduleCount: totalModules,
    distributionLabel: totalModules
      ? `${totalModules} Module${totalModules === 1 ? '' : 's'} • Equal Distribution`
      : 'No modules added yet',
  }
}

function mergeBranchCourseModelHierarchies(primaryModels = [], fallbackModels = []) {
  const normalizedPrimaryModels = normalizeBranchCourseModels(primaryModels)
  const normalizedFallbackModels = normalizeBranchCourseModels(fallbackModels)

  if (!normalizedPrimaryModels.length) return normalizedFallbackModels
  if (!normalizedFallbackModels.length) return normalizedPrimaryModels

  return normalizedPrimaryModels.map((model, index) => {
    const fallbackModel = normalizedFallbackModels[index] || {}
    const primarySubmodels = Array.isArray(model.submodels) ? model.submodels : []
    const fallbackSubmodels = Array.isArray(fallbackModel.submodels) ? fallbackModel.submodels : []

    return {
      ...fallbackModel,
      ...model,
      submodels: primarySubmodels.length ? primarySubmodels : fallbackSubmodels,
    }
  })
}

function createBranchCourseErrors(form) {
  const basic = {}
  const hierarchy = {
    models: [],
  }

  const normalizedCourseCode = normalizeBranchCourseCode(form.courseCode)
  if (normalizedCourseCode.length <= COURSE_CODE_PREFIX.length) basic.courseCode = 'Course Code is required.'
  if (!String(form.name || '').trim()) basic.name = 'Course Name is required.'
  if (!String(form.mode || '').trim()) basic.mode = 'Mode is required.'
  if (!String(form.duration || '').trim()) basic.duration = 'Duration (Months) is required.'
  if (String(form.duration || '').trim() && Number(form.duration) <= 0) basic.duration = 'Duration must be greater than zero.'
  if (!String(form.hours || '').trim()) basic.hours = 'Hours is required.'
  if (String(form.hours || '').trim() && Number(form.hours) <= 0) basic.hours = 'Hours must be greater than zero.'
  if (!String(form.actualFees || '').trim()) basic.actualFees = 'Standard Course Fee is required.'
  if (!String(form.registrationFees || '').trim()) basic.registrationFees = 'Registration Fee is required.'
  if (!String(form.status || '').trim()) basic.status = 'Status is required.'
  if (String(form.discount || '').trim() && Number(form.discount) < 0) basic.discount = 'Discount must be zero or greater.'

  const normalizedModels = normalizeBranchCourseModels(form.models)
  if (!normalizedModels.length) {
    hierarchy.modelsError = 'At least one model is required.'
  }

  hierarchy.models = normalizedModels.map((model) => {
    const modelErrors = {}
    if (!String(model.name || '').trim()) {
      modelErrors.name = 'Module name is required.'
    }

    const submodels = Array.isArray(model.submodels) ? model.submodels : []
    if (!submodels.length) {
      modelErrors.submodelsError = 'At least one submodel is required.'
    }

    modelErrors.submodels = submodels.map((submodel) => {
      const submodelErrors = {}
      if (!String(submodel.name || '').trim()) {
        submodelErrors.name = 'Submodel name is required.'
      }
      return submodelErrors
    })

    return modelErrors
  })

  return { basic, hierarchy }
}

function getBranchCourseDuplicateErrors(form, existingCourses = [], editingCourseId = null) {
  const normalizedCourseCode = normalizeBranchCourseCode(form.courseCode).trim().toLowerCase()
  const normalizedEditingCourseId = String(editingCourseId || '').trim().toLowerCase()

  if (!normalizedCourseCode || normalizedCourseCode.length <= COURSE_CODE_PREFIX.length) {
    return {}
  }

  const duplicateCourseCode = (Array.isArray(existingCourses) ? existingCourses : []).find((course) => {
    const courseId = String(course?.id || '').trim().toLowerCase()
    const courseCode = String(course?.courseCode || '').trim().toLowerCase()

    return courseId !== normalizedEditingCourseId && courseCode === normalizedCourseCode
  })

  return duplicateCourseCode ? { courseCode: 'Course code already exists.' } : {}
}

function formatBranchAdminDisplayName(value) {
  const text = String(value || '').trim()
  if (!text) return 'Branch Admin'

  return text.replace(/^KKJ\s*[-–—:]?\s*/i, '').trim() || 'Branch Admin'
}

function formatBranchCourseMoney(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  return `₹${text}`
}

function formatBranchCourseAmountInWords(value) {
  const normalized = String(value ?? '').replace(/,/g, '').trim()
  if (!normalized) return '-'

  const number = Number(normalized)
  if (!Number.isFinite(number)) return '-'
  if (number === 0) return 'Zero'

  const ones = [
    'Zero',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ]

  const convertBelowThousand = (num) => {
    let result = ''

    if (num >= 100) {
      result += `${ones[Math.floor(num / 100)]} Hundred `
      num %= 100
    }

    if (num >= 20) {
      result += `${tens[Math.floor(num / 10)]} `
      num %= 10
    }

    if (num > 0) {
      result += `${ones[num]} `
    }

    return result.trim()
  }

  let result = ''
  let remaining = Math.floor(number)

  const crore = Math.floor(remaining / 10000000)
  remaining %= 10000000

  const lakh = Math.floor(remaining / 100000)
  remaining %= 100000

  const thousand = Math.floor(remaining / 1000)
  remaining %= 1000

  if (crore > 0) {
    result += `${convertBelowThousand(crore)} Crore `
  }

  if (lakh > 0) {
    result += `${convertBelowThousand(lakh)} Lakh `
  }

  if (thousand > 0) {
    result += `${convertBelowThousand(thousand)} Thousand `
  }

  if (remaining > 0) {
    result += convertBelowThousand(remaining)
  }

  return result.trim()
}

function formatBranchCoursePercentage(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const rounded = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
  return `${rounded}%`
}

function formatBranchCourseDate(value) {
  const date = new Date(String(value || '').trim())
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatBranchCourseFinalFee(course) {
  const actualFees = Number(course?.actualFees || 0)
  const registrationFees = Number(course?.registrationFees || 0)
  const discount = Number(course?.discount || 0)

  if ([actualFees, registrationFees, discount].some((value) => Number.isNaN(value))) {
    return '-'
  }

  return formatBranchCourseAmount(Math.max(actualFees + registrationFees - discount, 0))
}

function normalizeBranchCourseRecord(course = {}, index = 0) {
  const installmentTemplate = normalizeBranchInstallmentTemplate(course.installmentTemplate, {
    templateName: 'Standard Installment Plan',
    installmentCount: 3,
    installments: createBranchInstallmentAmounts(3, ''),
    dueRule: 'Admission',
    allowCustomization: true,
    status: 'Active',
  })
  const assignedFaculty = Array.isArray(course.assignedFaculty)
    ? course.assignedFaculty
        .map((faculty) => {
          const id = String(
            faculty?.id ||
            faculty?.facultyId ||
            faculty?.facultyUserId ||
            faculty?.userId ||
            '',
          ).trim()
          const name = String(faculty?.name || faculty?.facultyName || faculty?.fullName || '').trim()

          if (!id && !name) return null

          return {
            ...faculty,
            id: id || name,
            facultyId: faculty?.facultyId || id || '',
            facultyUserId: faculty?.facultyUserId || faculty?.userId || id || '',
            name: name || id,
            email: String(faculty?.email || faculty?.facultyEmail || '').trim(),
            phone: String(faculty?.phone || faculty?.facultyPhone || '').trim(),
            status: faculty?.status || faculty?.recordStatus || 'ACTIVE',
          }
        })
        .filter(Boolean)
    : []

  return {
    ...course,
    id: String(
      course.id ||
      course.branchCourseId ||
      course.dbId ||
      course.courseId ||
      course.courseCode ||
      course.name ||
      `branch-course-${index + 1}`,
    ),
    courseCode: String(course.courseCode || '').trim(),
    name: String(course.name || '').trim(),
    mode: String(course.mode || '').trim(),
    duration: String(course.duration ?? '').trim(),
    hours: String(course.hours ?? '').trim(),
    actualFees: String(course.actualFees ?? '').trim(),
    registrationFees: String(course.registrationFees ?? '').trim(),
    discount: String(course.discount ?? '').trim(),
    status: String(course.status || 'Active').trim(),
    batches: Number(course.batches || 0),
    students: Number(course.students || 0),
    models: normalizeBranchCourseModels(course.models || course.courseModels || course.modules || []),
    assignedFaculty,
    paymentPlans: buildBranchCoursePaymentPlanSelectionsFromRecord(course),
    installmentTemplate,
    createdAt: String(course.createdAt || new Date().toISOString()),
  }
}

function resolveBranchCourseEditableId(course = {}, availableCourses = []) {
  const directId = String(course?.id || course?.branchCourseId || course?.dbId || course?.courseId || '').trim()
  if (directId) return directId

  const courseCode = String(course?.courseCode || '').trim().toLowerCase()
  const courseName = String(course?.name || course?.courseName || '').trim().toLowerCase()

  const matchedCourse = Array.isArray(availableCourses)
    ? availableCourses.find((item) => {
      const itemCode = String(item?.courseCode || '').trim().toLowerCase()
      const itemName = String(item?.name || item?.courseName || '').trim().toLowerCase()
      return (courseCode && itemCode === courseCode) || (courseName && itemName === courseName)
    })
    : null

  return String(matchedCourse?.id || '').trim()
}

function buildBranchCoursePayload(form) {
  const models = buildBranchCourseModelPayload(form.models)
  const finalFee = getBranchCourseFinalFeeValue(form)
  const paymentPlans = buildBranchCoursePaymentPlanPayloadSelections(form.paymentPlans, finalFee)
  const primaryPaymentPlan = paymentPlans[0] || null

  return {
    courseCode: normalizeBranchCourseCode(form.courseCode),
    name: String(form.name || '').trim(),
    mode: form.mode,
    duration: form.duration,
    hours: form.hours,
    actualFees: form.actualFees,
    registrationFees: form.registrationFees,
    discount: form.discount || '0',
    status: form.status,
    models,
    courseModels: models,
    modules: models,
    paymentPlans,
    paymentPlanSelections: paymentPlans,
    installmentTemplate: primaryPaymentPlan ? buildBranchCourseInstallmentTemplateFromPaymentPlan(primaryPaymentPlan, finalFee) : null,
  }
}
function createInitialBranchCourseForm() {
  return {
    courseCode: COURSE_CODE_PREFIX,
    name: '',
    mode: '',
    duration: '',
    hours: '',
    actualFees: '0',
    registrationFees: '',
    discount: '',
    status: 'Active',
    models: [],
    paymentPlans: [],
  }
}

function normalizeBranchCourseCode(value = '') {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  const suffix = normalized.startsWith('CIS') ? normalized.slice(3) : normalized
  return `${COURSE_CODE_PREFIX}${suffix}`
}

function buildBranchCourseFormFromRecord(course = {}) {
  const installmentTemplate = normalizeBranchInstallmentTemplate(course.installmentTemplate, {
    templateName: 'Standard Installment Plan',
    installmentCount: 3,
    installments: createBranchInstallmentAmounts(3, ''),
    dueRule: 'Admission',
    allowCustomization: true,
    status: 'Active',
  })

  return {
    courseCode: String(course.courseCode || COURSE_CODE_PREFIX).trim() || COURSE_CODE_PREFIX,
    name: String(course.name || '').trim(),
    mode: String(course.mode || '').trim(),
    duration: String(course.duration ?? '').trim(),
    hours: String(course.hours ?? '').trim(),
    actualFees: String(course.actualFees ?? '').trim(),
    registrationFees: String(course.registrationFees ?? '').trim(),
    discount: String(course.discount ?? '').trim(),
    status: String(course.status || 'Active').trim() || 'Active',
    installmentTemplate,
    assignedFaculty: Array.isArray(course.assignedFaculty)
      ? course.assignedFaculty.map((faculty) => ({
          ...faculty,
          id: String(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || faculty?.userId || '').trim(),
          name: String(faculty?.name || faculty?.facultyName || faculty?.fullName || '').trim(),
        })).filter((faculty) => faculty.id || faculty.name)
      : [],
    models: normalizeBranchCourseModels(course.models || course.courseModels || course.modules || []),
    paymentPlans: buildBranchCoursePaymentPlanSelectionsFromRecord(course),
  }
}

function apiErrorMessage(error, fallback) {
  return error?.body?.message || error?.body?.error || error?.message || fallback
}

function normalizeStudentIdSuffix(value = '') {
  return String(value || '').replace(/\D/g, '')
}

function buildStudentIdFromSuffix(suffix = '') {
  const normalizedSuffix = normalizeStudentIdSuffix(suffix)
  if (!normalizedSuffix) return ''
  return `${STUDENT_ID_PREFIX}${normalizedSuffix.padStart(Math.max(3, normalizedSuffix.length), '0')}`
}

function getBranchCourseDraftStorageKey(identifier = '') {
  const text = String(identifier || '').trim()
  return `${COURSE_DRAFT_STORAGE_PREFIX}${text || 'new'}`
}

function readBranchCourseDraft(identifier = '') {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(getBranchCourseDraftStorageKey(identifier))
    if (!raw) return null
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}

function writeBranchCourseDraft(identifier = '', draft = null) {
  if (typeof window === 'undefined') return

  const storageKey = getBranchCourseDraftStorageKey(identifier)
  try {
    if (!draft) {
      window.localStorage.removeItem(storageKey)
      return
    }

    window.localStorage.setItem(storageKey, JSON.stringify(draft))
  } catch (error) {
    // Ignore draft persistence failures and continue with in-memory state.
  }
}

export function BranchDashboardPage({ embeddedMode = false, branchData = null, initialSection = 'dashboard' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, role, signOut, user, session } = useAuth()
  const activeSection = getBranchDashboardSectionFromPath(location.pathname, location.search) || initialSection
  const goToBranchSection = useCallback(
    (section = 'dashboard', options = {}) => {
      const nextSection = String(section || '').trim().toLowerCase() || 'dashboard'
      const replace = Boolean(options?.replace)
      const isDashboard = nextSection === 'dashboard'
      const isNotifications = nextSection === 'notifications'

      if (embeddedMode) {
        navigate(
          {
            pathname: location.pathname,
            search: isDashboard ? '' : `?section=${encodeURIComponent(nextSection)}`,
          },
          { replace },
        )
        return
      }

      if (isNotifications) {
        navigate('/branch-dashboard/notifications', { replace })
        return
      }

      if (isDashboard) {
        navigate('/branch-dashboard', { replace })
        return
      }

      navigate(`/branch-dashboard?section=${encodeURIComponent(nextSection)}`, { replace })
    },
    [embeddedMode, location.pathname, navigate],
  )
  const [branchProfile, setBranchProfile] = useState(null)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isPaymentPlanRequiredOpen, setIsPaymentPlanRequiredOpen] = useState(false)
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false)
  const [isAddCourseSaving, setIsAddCourseSaving] = useState(false)
  const [isCourseDeleting, setIsCourseDeleting] = useState(false)
  const isAddCourseSubmitLockedRef = useRef(false)
  const courseSaveIntentRef = useRef(false)
  const [addCourseError, setAddCourseError] = useState('')
  const [courseActionError, setCourseActionError] = useState('')
  const [courseSaveSuccess, setCourseSaveSuccess] = useState(null)
  const [addCourseForm, setAddCourseForm] = useState(() => createInitialBranchCourseForm())
  const [addCourseTouched, setAddCourseTouched] = useState({})
  const [addCourseStep, setAddCourseStep] = useState(1)
  const [selectedSavedModelIndex, setSelectedSavedModelIndex] = useState(0)
  const [selectedSavedSubmodelIndex, setSelectedSavedSubmodelIndex] = useState(0)
  const [savedCourseHierarchy, setSavedCourseHierarchy] = useState([])
  const [branchCourseCards, setBranchCourseCards] = useState([])
  const [branchBatchGroups, setBranchBatchGroups] = useState([])
  const [courseSearchTerm, setCourseSearchTerm] = useState('')
  const [branchCoursePage, setBranchCoursePage] = useState(1)
  const [editingCourseId, setEditingCourseId] = useState('')
  const [openCourseActionMenuId, setOpenCourseActionMenuId] = useState('')
  const [courseActionMenuPosition, setCourseActionMenuPosition] = useState({ top: 0, left: 0 })
  const [courseDeleteTarget, setCourseDeleteTarget] = useState(null)
  const [courseModuleDeleteTarget, setCourseModuleDeleteTarget] = useState(null)
  const [courseSubmoduleDeleteTarget, setCourseSubmoduleDeleteTarget] = useState(null)
  const [viewCourse, setViewCourse] = useState(null)
  const [viewCourseTab, setViewCourseTab] = useState('basic')
  const [expandedViewCourseModuleIds, setExpandedViewCourseModuleIds] = useState([])
  const [viewCoursePaymentPlanOpenId, setViewCoursePaymentPlanOpenId] = useState('')
  const [courseDraftKey, setCourseDraftKey] = useState('')
  const [courseEditorStage, setCourseEditorStage] = useState('module')
  const [isSubmoduleDraftOpen, setIsSubmoduleDraftOpen] = useState(false)
  const [expandedSavedCourseModuleIds, setExpandedSavedCourseModuleIds] = useState([])
  const [submoduleDraftRestoreIndex, setSubmoduleDraftRestoreIndex] = useState(0)
  const [submoduleDraftRestoreLength, setSubmoduleDraftRestoreLength] = useState(null)
  const activeSubmoduleInputRef = useRef(null)
  const [branchInstallmentTemplates, setBranchInstallmentTemplates] = useState([])
  const [isBranchInstallmentTemplatesLoading, setIsBranchInstallmentTemplatesLoading] = useState(false)
  const [branchInstallmentTemplatesError, setBranchInstallmentTemplatesError] = useState('')
  const [isPaymentPlanDropdownOpen, setIsPaymentPlanDropdownOpen] = useState(false)
  const [addCourseSavedPaymentPlans, setAddCourseSavedPaymentPlans] = useState([])
  const [addCourseSavedPaymentPlanId, setAddCourseSavedPaymentPlanId] = useState('')
  const [addCoursePaymentPlanSaveAttempted, setAddCoursePaymentPlanSaveAttempted] = useState(false)
  const paymentPlanDropdownRef = useRef(null)

  const [isAssignFacultyOpen, setIsAssignFacultyOpen] = useState(false)
  const [assignFacultyCourse, setAssignFacultyCourse] = useState(null)
  const [selectedFacultyIds, setSelectedFacultyIds] = useState([])
  const [facultyList, setFacultyList] = useState([])
  const [branchFacultyRecords, setBranchFacultyRecords] = useState([])
  const [assignFacultyPage, setAssignFacultyPage] = useState(1)
  const [assignFacultySuccess, setAssignFacultySuccess] = useState(null)
  const [isAssignFacultySaving, setIsAssignFacultySaving] = useState(false)

  // ── Student state ──
  const [branchStudents, setBranchStudents] = useState([])
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [studentPage, setStudentPage] = useState(1)
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false)
  const [studentFormMode, setStudentFormMode] = useState('add') // 'add' | 'view' | 'edit'
  const [studentFormStep, setStudentFormStep] = useState(1)
  const [studentForm, setStudentForm] = useState(() => createInitialStudentForm(''))
  const [studentInstallmentDueDates, setStudentInstallmentDueDates] = useState([])
  const [studentFormTouched, setStudentFormTouched] = useState({})
  const [studentDeleteTarget, setStudentDeleteTarget] = useState(null)
  const [recordPaymentStudent, setRecordPaymentStudent] = useState(null)
  const [pendingRecordPaymentStudent, setPendingRecordPaymentStudent] = useState(null)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [paymentHistoryFilter, setPaymentHistoryFilter] = useState('all');
  const [paymentHistoryDate, setPaymentHistoryDate] = useState("");
  const [paymentModeFilter, setPaymentModeFilter] = useState('all');
  const [paymentHistoryActionMenuId, setPaymentHistoryActionMenuId] = useState('');
  const [paymentHistoryActionMenuPosition, setPaymentHistoryActionMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedPaymentHistory, setSelectedPaymentHistory] = useState(null);
  const [paymentHistorySearch, setPaymentHistorySearch] = useState('');
  const [ledgerStudent, setLedgerStudent] = useState(null)
  const [ledgerView, setLedgerView] = useState({ entries: [], summary: null, source: 'local' })
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerError, setLedgerError] = useState('')
  const [studentActionMenuId, setStudentActionMenuId] = useState('')
  const [studentActionMenuPosition, setStudentActionMenuPosition] = useState({ top: 0, left: 0 })
  const studentActionMenuRef = useRef(null)
  const studentActionMenuCloseTimerRef = useRef(null)
  const studentActionMenuHoverCountRef = useRef(0)
  const paymentHistoryActionMenuRef = useRef(null)
  const paymentHistoryActionCloseTimerRef = useRef(null)
const [paymentSearchTerm, setPaymentSearchTerm] = useState('')
const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
const [paymentPage, setPaymentPage] = useState(1)
const BRANCH_PAYMENTS_PER_PAGE = 10
const [paymentHistoryPage, setPaymentHistoryPage] = useState(1)
const BRANCH_PAYMENT_HISTORY_PER_PAGE = 5
  const [viewStudentDrawer, setViewStudentDrawer] = useState(null)
  const [studentDetailsTab, setStudentDetailsTab] = useState('basic')
  const [studentSuccessPopup, setStudentSuccessPopup] = useState(null)
  const [studentFormError, setStudentFormError] = useState('')
  const [isStudentSaving, setIsStudentSaving] = useState(false)
  const [isStudentDeleting, setIsStudentDeleting] = useState(false)
  const [stuCountryOptions, setStuCountryOptions] = useState([])
  const [stuStateOptions, setStuStateOptions] = useState([])
  const [stuCityOptions, setStuCityOptions] = useState([])
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false)
  const [branchNotificationRecords, setBranchNotificationRecords] = useState(() => loadNotifications())
  const [facultyTodayWorkEntries, setFacultyTodayWorkEntries] = useState([])
  const branchCourseProgressBackfillSignatureRef = useRef('')

  useEffect(() => {
  if (viewStudentDrawer) {
    setStudentDetailsTab('basic')
  }
}, [viewStudentDrawer])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      const clickedInsideActions = e.target.closest('.branch-student-actions-cell')
      const clickedInsideMenu = studentActionMenuRef.current?.contains(e.target)

      if (!clickedInsideActions && !clickedInsideMenu) {
        if (studentActionMenuCloseTimerRef.current) {
          clearTimeout(studentActionMenuCloseTimerRef.current)
        }
        setStudentActionMenuId('')
        setStudentActionMenuPosition({ top: 0, left: 0 })
      }
    }

    const closeOnScrollOrResize = () => {
      if (studentActionMenuCloseTimerRef.current) {
        clearTimeout(studentActionMenuCloseTimerRef.current)
      }
      setStudentActionMenuId('')
      setStudentActionMenuPosition({ top: 0, left: 0 })
    }

    document.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('scroll', closeOnScrollOrResize, true)
    window.addEventListener('resize', closeOnScrollOrResize)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('scroll', closeOnScrollOrResize, true)
      window.removeEventListener('resize', closeOnScrollOrResize)
    }
  }, [])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      const clickedInsideActions = e.target.closest('.payment-history-actions-cell')
      const clickedInsideMenu = paymentHistoryActionMenuRef.current?.contains(e.target)

      if (!clickedInsideActions && !clickedInsideMenu) {
        if (paymentHistoryActionCloseTimerRef.current) {
          clearTimeout(paymentHistoryActionCloseTimerRef.current)
        }
        setPaymentHistoryActionMenuId('')
        setPaymentHistoryActionMenuPosition({ top: 0, left: 0 })
      }
    }

    const closeOnScrollOrResize = () => {
      if (paymentHistoryActionCloseTimerRef.current) {
        clearTimeout(paymentHistoryActionCloseTimerRef.current)
      }
      setPaymentHistoryActionMenuId('')
      setPaymentHistoryActionMenuPosition({ top: 0, left: 0 })
    }

    document.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('scroll', closeOnScrollOrResize, true)
    window.addEventListener('resize', closeOnScrollOrResize)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('scroll', closeOnScrollOrResize, true)
      window.removeEventListener('resize', closeOnScrollOrResize)
    }
  }, [])

  const openPaymentHistoryActionMenu = useCallback((record = {}, target = null) => {
    const rect = target?.getBoundingClientRect?.()
    const menuWidth = 150
    const menuHeight = 92
    const gap = 6
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0

    let left = rect ? rect.left : 0
    let top = rect ? rect.bottom + gap : 0

    if (viewportWidth && left + menuWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - menuWidth - 12)
    }

    if (viewportHeight && top + menuHeight > viewportHeight - 12 && rect) {
      top = Math.max(12, rect.top - menuHeight - gap)
    }

    setPaymentHistoryActionMenuId(record.id || '')
    setPaymentHistoryActionMenuPosition({
      top: Math.max(12, top),
      left: Math.max(12, left),
    })
  }, [])
  const profileMenuRef = useRef(null)
  const notificationMenuRef = useRef(null)
  const courseActionCloseTimer = useRef(null)

  const loadBranchCourses = useCallback(async (fallbackCourses = null) => {
    const result = await listBranchCourses({
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

    const activeBranchId = branchProfile?.id || branchProfile?.branchId || ''
    const nextCourses = mergeBranchCoursesWithSnapshot(Array.isArray(result?.data) ? result.data : [], activeBranchId)
    const sourceCourses = Array.isArray(fallbackCourses) ? fallbackCourses : null
    setBranchCourseCards((currentCourses) => {
      const currentCoursesById = new Map(
        (sourceCourses || currentCourses).map((course) => [String(course.id || '').trim(), course]),
      )

      return nextCourses.map((course, index) => {
        const courseId = String(course.id || '').trim()
        const currentCourse = currentCoursesById.get(courseId)
        const mergedCourse = {
          ...currentCourse,
          ...course,
        }

        const incomingModels = normalizeBranchCourseModels(course.models || course.courseModels || course.modules || [])
        const currentModels = normalizeBranchCourseModels(currentCourse?.models || currentCourse?.courseModels || currentCourse?.modules || [])
        const mergedModels = mergeBranchCourseModelHierarchies(
          incomingModels.length ? incomingModels : currentModels,
          currentModels,
        )

        return normalizeBranchCourseRecord(
          {
            ...mergedCourse,
            models: mergedModels,
            courseModels: mergedModels,
            modules: mergedModels,
          },
          index,
        )
      })
    })
    return result
  }, [branchProfile?.branchId, branchProfile?.id])

  const loadBranchBatches = useCallback(async (branchScopeId = '') => {
    const scopeId = String(branchScopeId || branchProfile?.id || branchProfile?.branchId || branchData?.id || branchData?.branchId || '').trim()
    const result = await listBranchBatches({
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ...(scopeId ? { branchId: scopeId } : {}),
    })

    setBranchBatchGroups(Array.isArray(result?.data) ? result.data : [])
    return result
  }, [branchData?.branchId, branchData?.id, branchProfile?.branchId, branchProfile?.id])

  const loadFacultyList = useCallback(async () => {
    try {
      const res = await listBranchFaculty()
      if (res?.data) {
        setBranchFacultyRecords(Array.isArray(res.data) ? res.data : [])
        const mapped = res.data.map((f) => ({
          id: f.facultyId || f.id,
          name: f.name,
          email: f.email,
          phone: f.phone,
          status: f.status,
        }))
        setFacultyList(mapped)
      }
    } catch (error) {
      console.error('Failed to fetch faculty list:', error)
    }
  }, [])

const branchInstallmentTemplatesRequestRef = useRef(null)
 const loadBranchInstallmentPlanOptions = useCallback(async () => {
  // Prevent duplicate requests
  if (branchInstallmentTemplatesRequestRef.current) {
    return branchInstallmentTemplatesRequestRef.current
  }

  const requestPromise = (async () => {
    setIsBranchInstallmentTemplatesLoading(true)
    setBranchInstallmentTemplatesError('')

    try {
      const collectedTemplates = []
      let page = 1
      let totalPages = 1

      do {
        const result = await listBranchInstallmentTemplates({
          page,
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })

        collectedTemplates.push(
          ...(Array.isArray(result?.data) ? result.data : [])
        )

        totalPages = Math.max(
          1,
          Number(result?.meta?.totalPages || 1)
        )

        page += 1
      } while (page <= totalPages)

      setBranchInstallmentTemplates(collectedTemplates)

      return collectedTemplates
    } catch (error) {
      console.error('Failed to fetch installment templates:', error)

      setBranchInstallmentTemplates([])
      setBranchInstallmentTemplatesError(
        apiErrorMessage(
          error,
          'Unable to load payment plans right now.'
        )
      )

      return []
    } finally {
      setIsBranchInstallmentTemplatesLoading(false)
      branchInstallmentTemplatesRequestRef.current = null
    }
  })()

  branchInstallmentTemplatesRequestRef.current = requestPromise

  return requestPromise
}, [])

  const loadBranchNotifications = useCallback(async () => {
    try {
      const response = await request('/notifications?limit=100&page=1', {
        method: 'GET',
      })

      const responseData = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.notifications)
          ? response.notifications
          : Array.isArray(response)
            ? response
            : []

      const storedNotifications = loadNotifications()
      const storedById = new Map(
        storedNotifications.map((notification) => [String(notification.id || '').trim(), notification]),
      )
      const storedAcceptedByRequestId = new Map(
        storedNotifications
          .filter((notification) => String(notification.requestStatus || '').trim().toLowerCase() === 'accepted')
          .map((notification) => [String(notification.requestId || '').trim(), notification]),
      )
      const mergedNotifications = mergeNotificationsWithStoredState(responseData).map((notification) => {
        const storedNotification = storedById.get(String(notification.id || '').trim())
        const storedAcceptedNotification = storedAcceptedByRequestId.get(String(notification.requestId || '').trim())
        const storedNotificationStatus = String(storedNotification?.requestStatus || '').trim().toLowerCase()
        const storedAcceptedStatus = String(storedAcceptedNotification?.requestStatus || '').trim().toLowerCase()

        if (storedNotificationStatus === 'accepted') {
          return { ...notification, ...storedNotification }
        }

        if (storedAcceptedStatus === 'accepted') {
          return { ...notification, ...storedAcceptedNotification }
        }

        return notification
      })
      const mergedIds = new Set(mergedNotifications.map((notification) => String(notification.id || '').trim()))
      const preservedNotifications = storedNotifications.filter((notification) => !mergedIds.has(String(notification.id || '').trim()))
      const nextNotifications = [...mergedNotifications, ...preservedNotifications]

      setBranchNotificationRecords(nextNotifications)
      saveNotifications(nextNotifications, { emit: false })
    } catch (error) {
      console.error('Failed to load branch notifications:', error)
      const fallbackNotifications = mergeNotificationsWithStoredState(loadNotifications())
      setBranchNotificationRecords(fallbackNotifications)
    }
  }, [])

  const loadFacultyTodayWorkEntries = useCallback(async () => {
    try {
      const entries = await listFacultyTodayWorkEntries()
      setFacultyTodayWorkEntries(Array.isArray(entries) ? entries : [])
      return Array.isArray(entries) ? entries : []
    } catch (error) {
      console.error('Failed to load faculty today work entries:', error)
      setFacultyTodayWorkEntries([])
      return []
    }
  }, [])

  useEffect(() => {
    if (!embeddedMode && (!isAuthenticated || role !== 'branch-admin')) {
      navigate('/login', { replace: true })
      return
    }

    let isMounted = true

    if (embeddedMode && branchData) {
      setBranchProfile(branchData)
      Promise.allSettled([loadBranchCourses(), loadFacultyList()]).then(([coursesResult]) => {
        if (!isMounted) return
        if (coursesResult.status === 'fulfilled' || coursesResult.value?.data) {
          setBranchCourseCards(
            mergeBranchCoursesWithSnapshot(
              Array.isArray(coursesResult?.value?.data) ? coursesResult.value.data : [],
              branchData?.id || branchData?.branchId || '',
            ),
          )
        } else {
          setBranchCourseCards([])
        }
      })
      return
    }

    Promise.allSettled([getCurrentBranchProfile(), loadBranchCourses(), loadFacultyList()]).then(([branchResult, coursesResult]) => {
      if (!isMounted) return

      if (branchResult.status === 'fulfilled') {
        setBranchProfile(branchResult.value)
      } else {
        setBranchProfile(buildFallbackBranchProfile(user, session))
      }

      if (coursesResult.status === 'fulfilled') {
        setBranchCourseCards(
          mergeBranchCoursesWithSnapshot(
            Array.isArray(coursesResult.value?.data) ? coursesResult.value.data : [],
            branchResult.status === 'fulfilled'
              ? (branchResult.value?.id || branchResult.value?.branchId || '')
              : (branchProfile?.id || branchProfile?.branchId || ''),
          ),
        )
      } else {
        setBranchCourseCards([])
      }
    })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, loadBranchCourses, loadFacultyList, navigate, role, session, user])

  useEffect(() => {
    const scopeId = branchProfile?.id || branchProfile?.branchId || branchData?.id || branchData?.branchId || ''
    if (!scopeId) return undefined

    void loadBranchBatches(scopeId)
    return undefined
  }, [branchData?.branchId, branchData?.id, branchProfile?.branchId, branchProfile?.id, loadBranchBatches])

  useEffect(() => {
    const handleBranchBatchGroupsChanged = () => {
      const scopeId = branchProfile?.id || branchProfile?.branchId || branchData?.id || branchData?.branchId || ''
      void loadBranchBatches(scopeId)
    }

    window.addEventListener('cispro:branch-batch-groups-changed', handleBranchBatchGroupsChanged)

    return () => {
      window.removeEventListener('cispro:branch-batch-groups-changed', handleBranchBatchGroupsChanged)
    }
  }, [branchData?.branchId, branchData?.id, branchProfile?.branchId, branchProfile?.id, loadBranchBatches])

  useEffect(() => {
    const nextBranchId = branchProfile?.id || branchProfile?.branchId || branchData?.id || branchData?.branchId || null

    if (embeddedMode) {
      setImpersonateBranchId(nextBranchId)
      return () => {
        setImpersonateBranchId(null)
      }
    }

    if (role !== 'branch-admin') {
      setImpersonateBranchId(null)
      return undefined
    }

    setImpersonateBranchId(nextBranchId)

    return () => {
      setImpersonateBranchId(null)
    }
  }, [branchData, branchProfile, embeddedMode, role])

  useEffect(() => {
    if (!isProfileMenuOpen) return undefined

    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (profileMenuRef.current?.contains(target)) return
      setIsProfileMenuOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isProfileMenuOpen])

  useEffect(() => {
    if (!isNotificationMenuOpen) return undefined

    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (notificationMenuRef.current?.contains(target)) return
      setIsNotificationMenuOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsNotificationMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isNotificationMenuOpen])

  // Body scroll lock for notification dropdown
  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const { body, documentElement } = document
    const mainArea = document.querySelector('.main-area')
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior
    const previousBodyPosition = body.style.position
    const previousBodyTop = body.style.top
    const previousBodyLeft = body.style.left
    const previousBodyRight = body.style.right
    const previousBodyWidth = body.style.width
    const previousHtmlOverflow = documentElement.style.overflow
    const previousHtmlOverscrollBehavior = documentElement.style.overscrollBehavior
    const previousMainAreaOverflow = mainArea?.style.overflow || ''
    const previousMainAreaOverscrollBehavior = mainArea?.style.overscrollBehavior || ''

    body.classList.toggle('branch-notification-menu-open', isNotificationMenuOpen)

    if (isNotificationMenuOpen) {
      body.style.overflow = 'hidden'
      body.style.overscrollBehavior = 'none'
      body.style.position = 'fixed'
      body.style.top = `-${scrollY}px`
      body.style.left = '0'
      body.style.right = '0'
      body.style.width = '100%'
      documentElement.style.overflow = 'hidden'
      documentElement.style.overscrollBehavior = 'none'
      if (mainArea) {
        mainArea.style.overflow = 'hidden'
        mainArea.style.overscrollBehavior = 'none'
      }
    }

    return () => {
      body.classList.remove('branch-notification-menu-open')
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscrollBehavior
      body.style.position = previousBodyPosition
      body.style.top = previousBodyTop
      body.style.left = previousBodyLeft
      body.style.right = previousBodyRight
      body.style.width = previousBodyWidth
      documentElement.style.overflow = previousHtmlOverflow
      documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior
      if (mainArea) {
        mainArea.style.overflow = previousMainAreaOverflow
        mainArea.style.overscrollBehavior = previousMainAreaOverscrollBehavior
      }

      if (isNotificationMenuOpen) {
        window.scrollTo(scrollX, scrollY)
      }
    }
  }, [isNotificationMenuOpen])

  useEffect(() => {
    const unsubscribe = subscribeNotifications(() => {
      void loadBranchNotifications()
    })

    return unsubscribe
  }, [loadBranchNotifications])

  useEffect(() => {
    const unsubscribe = subscribeBranchCourseSnapshot(() => {
      clearBranchCourseListCache()
      void loadBranchCourses()
    })

    return unsubscribe
  }, [loadBranchCourses])

  useEffect(() => {
    const syncFacultyList = () => {
      void loadFacultyList()
    }

    window.addEventListener(FACULTY_RECORD_SYNC_EVENT, syncFacultyList)

    return () => {
      window.removeEventListener(FACULTY_RECORD_SYNC_EVENT, syncFacultyList)
    }
  }, [loadFacultyList])

  useEffect(() => {
    const unsubscribe = subscribeBranchInstallmentTemplateChanges(() => {
      void loadBranchInstallmentPlanOptions()
    })

    return unsubscribe
  }, [loadBranchInstallmentPlanOptions])

  useEffect(() => {
    void loadBranchNotifications()

    const handleFocus = () => {
      void loadBranchNotifications()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadBranchNotifications()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadBranchNotifications])

  useEffect(() => {
    if (!openCourseActionMenuId) return undefined

    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      // Check if click is on the action menu or action button
      if (target.closest('.branch-course-actions-menu')) return
      if (target.closest('.branch-course-actions-button')) return

      setOpenCourseActionMenuId('')
      setCourseActionMenuPosition({ top: 0, left: 0 })
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenCourseActionMenuId('')
        setCourseActionMenuPosition({ top: 0, left: 0 })
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [openCourseActionMenuId])

  const openLogoutConfirm = () => {
    setIsProfileMenuOpen(false)
    setIsLogoutConfirmOpen(true)
  }

  const closeLogoutConfirm = () => {
    setIsLogoutConfirmOpen(false)
  }


  const openAssignFacultyModal = (course) => {
    setAssignFacultyCourse(course)
    setSelectedFacultyIds(
      Array.isArray(course?.assignedFaculty)
        ? course.assignedFaculty.map((faculty) => String(faculty.id))
        : []
    )

    setOpenCourseActionMenuId('')
    setCourseActionMenuPosition({ top: 0, left: 0 })
    setAssignFacultyPage(1)
    setIsAssignFacultyOpen(true)
    loadFacultyList()
  }

  const closeAssignFacultyModal = () => {
    setIsAssignFacultyOpen(false)
    setAssignFacultyCourse(null)
    setSelectedFacultyIds([])
    setAssignFacultyPage(1)
  }

  const toggleFacultySelection = (facultyId) => {
    setSelectedFacultyIds((current) =>
      current.includes(facultyId)
        ? current.filter((id) => id !== facultyId)
        : [...current, facultyId]
    )
  }

  const handleAssignFaculty = async () => {
    if (!assignFacultyCourse) return

    try {
      setIsAssignFacultySaving(true)
      setCourseActionError('')

      const updatedCourse = await assignFacultyToBranchCourse(
        assignFacultyCourse.id,
        selectedFacultyIds,
      )

      const assignedFaculty = Array.isArray(updatedCourse?.assignedFaculty)
        ? updatedCourse.assignedFaculty
        : facultyList.filter((faculty) => selectedFacultyIds.includes(faculty.id))

      const normalizedAssignedFaculty = assignedFaculty
        .map((faculty) => {
          const id = String(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || '').trim()
          const name = String(faculty?.name || faculty?.facultyName || '').trim()

          if (!id && !name) return null

          return {
            id: id || name,
            name: name || id,
          }
        })
        .filter(Boolean)

      const nextCourseCards = branchCourseCards.map((course) =>
        String(course.id || '').trim() === String(assignFacultyCourse.id || '').trim()
          ? {
              ...course,
              ...updatedCourse,
              assignedFaculty: normalizedAssignedFaculty,
            }
          : course,
      )

      setBranchCourseCards(nextCourseCards)
      saveBranchCourseSnapshot(nextCourseCards)

      await Promise.all([
        loadBranchCourses(),
        loadFacultyList(),
      ])

      setAssignFacultySuccess({
        courseName: updatedCourse?.name || assignFacultyCourse?.name || 'Course',
        facultyNames: normalizedAssignedFaculty.map((f) => f.name).filter(Boolean),
      })

      closeAssignFacultyModal()
    } catch (error) {
      setCourseActionError(apiErrorMessage(error, 'Unable to assign faculty right now.'))
    } finally {
      setIsAssignFacultySaving(false)
    }
  }


  const openCourseActionMenu = (button) => {
    if (courseActionCloseTimer.current) {
      clearTimeout(courseActionCloseTimer.current)
    }

    const rect = button.getBoundingClientRect()
    const menuWidth = 140
    const menuHeight = 110
    const gap = 8

    let left = rect.right - menuWidth
    let top = rect.bottom + gap

    if (left < 8) {
      left = 8
    }

    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8
    }

    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - gap
    }

    if (top < 8) {
      top = 8
    }

    setCourseActionMenuPosition({ top, left })
  }

  const openStudentActionMenu = (button) => {
    if (studentActionMenuCloseTimerRef.current) {
      clearTimeout(studentActionMenuCloseTimerRef.current)
      studentActionMenuCloseTimerRef.current = null
    }

    const rect = button.getBoundingClientRect()
    const menuWidth = 170
    const menuHeight = 180
    const gap = 8

    let left = rect.right - menuWidth
    let top = rect.bottom + gap

    if (left < 8) {
      left = 8
    }

    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8
    }

    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - gap
    }

    if (top < 8) {
      top = 8
    }

    setStudentActionMenuPosition({ top, left })
  }

  const enterStudentActionMenuArea = () => {
    studentActionMenuHoverCountRef.current += 1
    if (studentActionMenuCloseTimerRef.current) {
      clearTimeout(studentActionMenuCloseTimerRef.current)
      studentActionMenuCloseTimerRef.current = null
    }
  }

  const leaveStudentActionMenuArea = () => {
    studentActionMenuHoverCountRef.current = Math.max(0, studentActionMenuHoverCountRef.current - 1)

    if (studentActionMenuHoverCountRef.current > 0) {
      return
    }

    if (studentActionMenuCloseTimerRef.current) {
      clearTimeout(studentActionMenuCloseTimerRef.current)
    }

    studentActionMenuCloseTimerRef.current = window.setTimeout(() => {
      if (studentActionMenuHoverCountRef.current > 0) return
      setStudentActionMenuId('')
      setStudentActionMenuPosition({ top: 0, left: 0 })
      studentActionMenuCloseTimerRef.current = null
    }, 360)
  }

  const openStudentViewDrawer = (student) => {
    if (studentActionMenuCloseTimerRef.current) {
      clearTimeout(studentActionMenuCloseTimerRef.current)
    }

    studentActionMenuHoverCountRef.current = 0
    setStudentActionMenuId('')
    setStudentActionMenuPosition({ top: 0, left: 0 })
    setViewStudentDrawer({
      ...student,
      ...resolveStudentBatchDisplay(student, branchBatchGroups),
    })
  }

  const openRecordPaymentConfirmation = (student) => {
    if (studentActionMenuCloseTimerRef.current) {
      clearTimeout(studentActionMenuCloseTimerRef.current)
    }

    studentActionMenuHoverCountRef.current = 0
    const paymentSummary = computeBranchStudentPaymentSummary(student)
    setStudentActionMenuId('')
    setStudentActionMenuPosition({ top: 0, left: 0 })
    setPendingRecordPaymentStudent({ ...student, paymentSummary })
  }

  const resetPaymentsView = () => {
    setRecordPaymentStudent(null)
    setShowPaymentHistory(false)
  }

  const confirmRecordPayment = () => {
    if (!pendingRecordPaymentStudent) return
    const student = pendingRecordPaymentStudent
    setPendingRecordPaymentStudent(null)
    setShowPaymentHistory(false)
    setRecordPaymentStudent(student)
    goToBranchSection('payments')
  }

  const handleConfirmLogout = async () => {
    closeLogoutConfirm()
    setIsProfileMenuOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  const branchTitle = branchProfile?.branchName || 'Branch Dashboard'
  const branchAdmin = branchProfile?.branchAdminName || user?.name || 'Branch Admin'
  const branchAdminDisplay = formatBranchAdminDisplayName(branchAdmin)
  const branchEmail = branchProfile?.branchEmail || user?.email || 'branch@example.com'
  const branchScope = useMemo(
    () => ({
      id: String(branchProfile?.id || branchProfile?.branchId || '').trim(),
      branchId: String(branchProfile?.branchId || branchProfile?.id || '').trim(),
      branchEmail: String(branchProfile?.branchEmail || '').trim().toLowerCase(),
    }),
    [branchProfile?.branchEmail, branchProfile?.branchId, branchProfile?.id],
  )
  const branchLocation = branchProfile?.branchAddress || 'Assigned location'
  const mustResetPassword = Boolean(
    session?.user?.mustResetPassword ??
    user?.mustResetPassword ??
    branchProfile?.mustResetPassword,
  )
  const normalizedBranchNotifications = useMemo(
    () =>
      branchNotificationRecords
        .map(normalizeBranchNotification)
        .filter(
          (notification) =>
            String(notification.kind || '').startsWith('branch-') ||
            String(notification.kind || '').startsWith('faculty-') ||
            String(notification.kind || '').startsWith('course-edit-'),
        )
        .filter((notification) => doesBranchNotificationBelongToBranch(notification, branchScope))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [branchNotificationRecords, branchScope],
  )
  const branchNotificationSections = useMemo(
    () => groupByDate(normalizedBranchNotifications),
    [normalizedBranchNotifications],
  )
  const branchNotificationItems = normalizedBranchNotifications
  const branchUnreadNotificationCount = useMemo(
    () => normalizedBranchNotifications.filter((item) => item.unread && !item.dropdownViewed).length,
    [normalizedBranchNotifications],
  )
  const branchPageUnreadNotificationCount = useMemo(
    () => normalizedBranchNotifications.filter((item) => item.unread).length,
    [normalizedBranchNotifications],
  )
  const branchNotificationPreviewItems = useMemo(
    () => {
      const visibleItems = normalizedBranchNotifications.filter((item) => !item.dropdownViewed)
      const progressItems = visibleItems.filter((item) => String(item.kind || '').includes('progress-status'))
      const otherItems = visibleItems.filter((item) => !String(item.kind || '').includes('progress-status'))

      return [...progressItems, ...otherItems].slice(0, 2)
    },
    [normalizedBranchNotifications],
  )
  const branchNotificationTotalCount = branchNotificationItems.length
  const totalBranchStudents = branchStudents.length
  const overviewStats = useMemo(
    () => [
      { label: 'Total Students', value: String(totalBranchStudents), note: 'Active learners this month' },
      {
        label: 'Total Courses',
        value: String(branchCourseCards.length),
        note: 'Published course catalog',
      },
    ],
    [branchCourseCards.length, totalBranchStudents],
  )

  const openResetPassword = () => {
    setIsProfileMenuOpen(false)
    navigate('/reset-password?branchReset=1')
  }

  const openForgotPassword = () => {
    setIsProfileMenuOpen(false)
    const suffix = branchEmail ? `?email=${encodeURIComponent(branchEmail)}` : ''
    navigate(`/forgot-password${suffix}`)
  }

  const openProfile = () => {
    setIsProfileMenuOpen(false)
    goToBranchSection('profile')
  }

  const openBranchNotifications = async () => {
    await loadBranchNotifications()
    markNotificationsAsDropdownViewed()
    setIsNotificationMenuOpen(false)
    goToBranchSection('notifications')
  }

  const openBranchNotificationTarget = async (notification) => {
    if (notification?.id) {
      markNotificationsAsDropdownViewed([notification.id])
      markNotificationsAsRead([notification.id])
      setBranchNotificationRecords((current) =>
        current.map((item) =>
          String(item.id) === String(notification.id)
            ? { ...item, read: true, dropdownViewed: true }
            : item,
        ),
      )

      void request('/notifications/mark-read', {
        method: 'PATCH',
        body: JSON.stringify({ notificationIds: [notification.id] }),
      }).catch((error) => {
        console.error('Failed to sync branch notification read state:', error)
      })
    }
    setIsNotificationMenuOpen(false)
    goToBranchSection('notifications')
  }

  const resolveCourseEditRequestId = async (notification) => {
    const directRequestId = String(notification?.requestId || '').trim()
    if (directRequestId) return directRequestId

    const courseId = String(notification?.courseId || '').trim()
    const courseCode = String(notification?.courseCode || '').trim().toLowerCase()
    const courseName = String(notification?.courseName || '').trim().toLowerCase()
    const facultyId = String(notification?.facultyId || '').trim()
    const facultyEmail = String(notification?.facultyEmail || '').trim().toLowerCase()
    const facultyName = String(notification?.facultyName || '').trim().toLowerCase()

    const response = await listCourseEditRequests({ page: 1, limit: 100 })
    const requests = Array.isArray(response?.data) ? response.data : []

    const matches = requests.filter((requestItem) => {
      const requestCourseId = String(requestItem?.branchCourseId || requestItem?.courseId || '').trim()
      const requestCourseCode = String(requestItem?.courseCode || '').trim().toLowerCase()
      const requestCourseName = String(requestItem?.courseName || '').trim().toLowerCase()
      const requestFacultyId = String(requestItem?.facultyId || requestItem?.facultyUserId || '').trim()
      const requestFacultyEmail = String(requestItem?.facultyEmail || '').trim().toLowerCase()
      const requestFacultyName = String(requestItem?.facultyName || '').trim().toLowerCase()

      const courseChecks = [
        courseId && requestCourseId ? requestCourseId === courseId : null,
        courseCode && requestCourseCode ? requestCourseCode === courseCode : null,
        courseName && requestCourseName ? requestCourseName === courseName : null,
      ].filter((value) => value !== null)

      const facultyChecks = [
        facultyId && requestFacultyId ? requestFacultyId === facultyId : null,
        facultyEmail && requestFacultyEmail ? requestFacultyEmail === facultyEmail : null,
        facultyName && requestFacultyName ? requestFacultyName === facultyName : null,
      ].filter((value) => value !== null)

      const hasCourseCriteria = courseChecks.length > 0
      const hasFacultyCriteria = facultyChecks.length > 0
      const courseMatches = !hasCourseCriteria || courseChecks.some(Boolean)
      const facultyMatches = !hasFacultyCriteria || facultyChecks.some(Boolean)

      return courseMatches && facultyMatches
    })

    const sortedMatches = matches.sort(
      (left, right) => new Date(right.updatedAt || right.requestedAt || right.createdAt || 0).getTime() -
        new Date(left.updatedAt || left.requestedAt || left.createdAt || 0).getTime(),
    )

    return String(sortedMatches[0]?.id || '').trim()
  }

  const acceptBranchCourseEditNotification = async (notification) => {
    let requestId = ''

    try {
      requestId = await resolveCourseEditRequestId(notification)
      if (!requestId) {
        setCourseActionError('Unable to find the edit request to accept.')
        return
      }

      const acceptedRequest = await acceptCourseEditRequest(requestId, {
        responseNote: 'Accepted by branch admin',
      })

      if (acceptedRequest?.id) {
        setBranchNotificationRecords((current) =>
          current.map((item) =>
            String(item.requestId || item.id || '').trim() === requestId
              ? {
                ...item,
                requestStatus: 'accepted',
                tone: 'green',
                actionLabel: 'Accepted',
                categoryLabel: 'Accepted',
                unread: true,
              }
              : item,
          ),
        )
        await loadBranchNotifications()
      }

      await openBranchNotificationTarget({
        ...notification,
        requestStatus: 'accepted',
      })
    } catch (error) {
      console.error('Failed to accept course edit request:', error)
    }
  }

  const markAllBranchNotificationsAsRead = async () => {
    const unreadIds = branchNotificationItems
      .filter((item) => item.unread)
      .map((item) => item.id)

    markNotificationsAsRead(unreadIds.length ? unreadIds : null)
    setBranchNotificationRecords((current) =>
      current.map((item) => ({
        ...item,
        read: true,
        dropdownViewed: true,
      })),
    )
    setIsNotificationMenuOpen(false)

    try {
      await request('/notifications/mark-read', {
        method: 'PATCH',
        body: JSON.stringify({ notificationIds: unreadIds }),
      })
    } catch (error) {
      console.error('Failed to sync branch notification mark-all state:', error)
    }
  }

  const filteredBranchCourseCards = useMemo(() => {
    const q = courseSearchTerm.trim().toLowerCase()
    if (!q) return branchCourseCards
    return branchCourseCards.filter((c) =>
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.courseCode || '').toLowerCase().includes(q)
    )
  }, [branchCourseCards, courseSearchTerm])

  const totalBranchCoursePages = Math.max(1, Math.ceil(filteredBranchCourseCards.length / BRANCH_COURSES_PER_PAGE))
  const safeBranchCoursePage = Math.min(branchCoursePage, totalBranchCoursePages)
  const visibleBranchCourses = useMemo(() => {
    const start = (safeBranchCoursePage - 1) * BRANCH_COURSES_PER_PAGE
    return filteredBranchCourseCards.slice(start, start + BRANCH_COURSES_PER_PAGE)
  }, [filteredBranchCourseCards, safeBranchCoursePage])
  const editingCourseRecord = useMemo(
    () => branchCourseCards.find((course) => String(course.id || '').trim() === String(editingCourseId || '').trim()) || null,
    [branchCourseCards, editingCourseId],
  )
  const addCourseHierarchy = useMemo(
    () => buildBranchCourseHierarchySummary(addCourseForm.models),
    [addCourseForm.models],
  )
  const activeCourseModelIndex = Math.min(selectedSavedModelIndex, Math.max(addCourseHierarchy.length - 1, 0))
  const activeCourseModel = addCourseHierarchy[activeCourseModelIndex] || null
  const activeCourseModelSubmodelCount = activeCourseModel?.submodels?.length || 0

  useEffect(() => {
    if (!addCourseHierarchy.length) {
      if (selectedSavedModelIndex !== 0) {
        setSelectedSavedModelIndex(0)
      }
      return
    }

    if (selectedSavedModelIndex >= addCourseHierarchy.length) {
      setSelectedSavedModelIndex(addCourseHierarchy.length - 1)
    }
  }, [addCourseHierarchy.length, selectedSavedModelIndex])

  useEffect(() => {
    if (!activeCourseModelSubmodelCount) {
      if (selectedSavedSubmodelIndex !== 0) {
        setSelectedSavedSubmodelIndex(0)
      }
      return undefined
    }

    if (selectedSavedSubmodelIndex > activeCourseModelSubmodelCount) {
      setSelectedSavedSubmodelIndex(activeCourseModelSubmodelCount)
    }
  }, [activeCourseModelSubmodelCount, selectedSavedSubmodelIndex])

  const addCourseFinalFee = useMemo(() => {
    const actualFees = Number(addCourseForm.actualFees || 0)
    const registrationFees = Number(addCourseForm.registrationFees || 0)
    const discount = Number(addCourseForm.discount || 0)

    if (Number.isNaN(actualFees) || Number.isNaN(registrationFees) || Number.isNaN(discount)) return ''
    return String(Math.max(actualFees + registrationFees - discount, 0))
  }, [addCourseForm.actualFees, addCourseForm.discount, addCourseForm.registrationFees])

  const addCourseValidationErrors = useMemo(() => createBranchCourseErrors(addCourseForm), [addCourseForm])
  const addCourseDuplicateErrors = useMemo(
    () => getBranchCourseDuplicateErrors(addCourseForm, branchCourseCards, editingCourseId),
    [addCourseForm.courseCode, branchCourseCards, editingCourseId],
  )
  const addCourseVisibleBasicErrors = useMemo(
    () => ({
      ...addCourseValidationErrors.basic,
      ...addCourseDuplicateErrors,
    }),
    [addCourseDuplicateErrors, addCourseValidationErrors.basic],
  )
  const addCoursePaymentPlanSelections = useMemo(
    () => normalizeBranchCoursePaymentPlanSelections(addCourseForm.paymentPlans),
    [addCourseForm.paymentPlans],
  )
  const addCoursePaymentPlanLookup = useMemo(
    () => new Map(branchInstallmentTemplates.map((template) => [String(template.id || '').trim(), template])),
    [branchInstallmentTemplates],
  )
  const addCoursePaymentPlanOptions = useMemo(
    () =>
      branchInstallmentTemplates.filter((template) => String(template?.status || '').trim().toUpperCase() === 'ACTIVE'),
    [branchInstallmentTemplates],
  )
  const addCoursePaymentPlanSelectedIds = useMemo(
    () =>
      addCoursePaymentPlanSelections.map((plan) => (
        plan.type === 'custom'
          ? BRANCH_PAYMENT_PLAN_CUSTOM_VALUE
          : String(plan.templateId || plan.id || '').trim()
      )).filter(Boolean),
    [addCoursePaymentPlanSelections],
  )
  const addCoursePaymentPlanDisplayPlans = useMemo(
    () =>
      addCoursePaymentPlanSelections.map((plan) => {
        const matchedTemplate = plan.type === 'template'
          ? addCoursePaymentPlanLookup.get(String(plan.templateId || '').trim())
          : null
        const rawInstallmentCount = String(plan.installmentCount || '').trim()
        const installmentCount = plan.type === 'custom' && !rawInstallmentCount
          ? 0
          : getBranchCoursePaymentPlanInstallmentCount(plan)
        const installments = buildBranchCoursePaymentPlanInstallments(addCourseFinalFee, installmentCount)

        return {
          ...plan,
          templateName: matchedTemplate?.templateName || plan.templateName,
          dueRule: matchedTemplate?.dueRule || plan.dueRule,
          status: matchedTemplate?.status || plan.status,
          installmentCount: plan.type === 'custom' && !rawInstallmentCount ? '' : installmentCount,
          installments: installmentCount > 0 ? installments : [],
          installmentCountLabel: rawInstallmentCount,
        }
      }),
    [addCourseFinalFee, addCoursePaymentPlanLookup, addCoursePaymentPlanSelections],
  )
  const addCourseSavedPaymentPlanDisplayPlans = useMemo(
    () =>
      addCourseSavedPaymentPlans.map((plan) => {
        const matchedTemplate = plan.type === 'template'
          ? addCoursePaymentPlanLookup.get(String(plan.templateId || '').trim())
          : null
        const rawInstallmentCount = String(plan.installmentCount || '').trim()
        const installmentCount = plan.type === 'custom' && !rawInstallmentCount
          ? 0
          : getBranchCoursePaymentPlanInstallmentCount(plan)
        const installments = buildBranchCoursePaymentPlanInstallments(addCourseFinalFee, installmentCount)

        return {
          ...plan,
          templateName: matchedTemplate?.templateName || plan.templateName,
          dueRule: matchedTemplate?.dueRule || plan.dueRule,
          status: matchedTemplate?.status || plan.status,
          installmentCount: plan.type === 'custom' && !rawInstallmentCount ? '' : installmentCount,
          installments: installmentCount > 0 ? installments : [],
          installmentCountLabel: rawInstallmentCount,
        }
      }),
    [addCourseFinalFee, addCoursePaymentPlanLookup, addCourseSavedPaymentPlans],
  )
  const addCourseDraftCustomPaymentPlan = useMemo(
    () => normalizeBranchCoursePaymentPlanSelections(addCourseForm.paymentPlans).find((plan) => plan.type === 'custom') || null,
    [addCourseForm.paymentPlans],
  )
  const addCoursePaymentPlanValidationError = useMemo(() => {
    if (!addCoursePaymentPlanDisplayPlans.length) {
      return 'Please select at least one payment plan.'
    }

    return ''
  }, [addCoursePaymentPlanDisplayPlans])
  const addCoursePaymentPlanVisibleError = addCoursePaymentPlanSaveAttempted ? addCoursePaymentPlanValidationError : ''
  const savedCourseRows = useMemo(
    () => buildBranchCourseHierarchySummary(savedCourseHierarchy.filter(Boolean)),
    [savedCourseHierarchy],
  )

  const shouldShowBasicAddCourseError = (field) =>
    Boolean(addCourseTouched[field] && addCourseVisibleBasicErrors[field])

  const shouldShowModelNameError = (modelIndex) =>
    Boolean(
      addCourseTouched[`model-${modelIndex}-name`] &&
      addCourseValidationErrors.hierarchy.models?.[modelIndex]?.name,
    )

  const shouldShowSubmodelError = (modelIndex, submodelIndex) =>
    Boolean(
      addCourseTouched[`model-${modelIndex}-submodel-${submodelIndex}-name`] &&
      addCourseValidationErrors.hierarchy.models?.[modelIndex]?.submodels?.[submodelIndex]?.name,
    )

  const shouldShowModelSubmodelsError = (modelIndex) =>
    Boolean(
      addCourseTouched[`model-${modelIndex}-submodels`] &&
      addCourseValidationErrors.hierarchy.models?.[modelIndex]?.submodelsError,
    )

  const markAddCourseTouched = (key) => {
    setAddCourseTouched((current) => ({
      ...current,
      [key]: true,
    }))
  }

  const updateAddCourseField = (field, value) => {
    setAddCourseError('')
    setAddCourseForm((current) => ({
      ...current,
      [field]: field === 'courseCode' ? normalizeBranchCourseCode(value) : value,
    }))
  }

  const updateAddCourseNumericField = (field, value) => {
    const numericValue = String(value || '').replace(/[^\d]/g, '')
    const normalizedValue =
      numericValue.length > 1 ? numericValue.replace(/^0+(?=\d)/, '') : numericValue
    updateAddCourseField(field, normalizedValue)
  }

  const updateAddCoursePaymentPlanSelections = (selectedValues = []) => {
    setAddCourseError('')
    setAddCourseForm((current) => {
      const normalizedSelectedIds = Array.isArray(selectedValues)
        ? selectedValues.map((value) => String(value || '').trim()).filter(Boolean)
        : []
      const currentPlans = normalizeBranchCoursePaymentPlanSelections(current.paymentPlans)
      const currentTemplatePlans = new Map(
        currentPlans
          .filter((plan) => plan.type === 'template')
          .map((plan) => [String(plan.templateId || plan.id || '').trim(), plan]),
      )
      const currentCustomPlan = currentPlans.find((plan) => plan.type === 'custom') || null
      const nextPlans = []

      normalizedSelectedIds.forEach((selectedId) => {
        if (selectedId === BRANCH_PAYMENT_PLAN_CUSTOM_VALUE) {
          nextPlans.push(
            currentCustomPlan || normalizeBranchCoursePaymentPlanSelection({
              id: BRANCH_PAYMENT_PLAN_CUSTOM_VALUE,
              type: 'custom',
              templateId: BRANCH_PAYMENT_PLAN_CUSTOM_VALUE,
              templateName: 'Custom',
              installmentCount: '',
              installments: [],
              dueRule: 'Custom',
              allowCustomization: true,
              status: 'Active',
            }),
          )
          return
        }

        const template = addCoursePaymentPlanLookup.get(selectedId)
        if (!template) return

        const templateId = String(template.id || '').trim()
        const existingPlan = currentTemplatePlans.get(templateId)
        const defaultCount = Math.max(1, Number(template.installmentCount) || 1)

        nextPlans.push(
          existingPlan || normalizeBranchCoursePaymentPlanSelection({
            id: templateId,
            type: 'template',
            templateId,
            templateName: template.templateName,
            installmentCount: String(defaultCount),
            installments: createBranchInstallmentAmounts(defaultCount, ''),
            dueRule: template.dueRule,
            allowCustomization: template.allowCustomization,
            status: template.status,
          }),
        )
      })

      return {
        ...current,
        paymentPlans: nextPlans,
      }
    })
  }

  const updateAddCourseCustomPaymentPlanInstallmentCount = (value) => {
    setAddCourseError('')
    setAddCourseForm((current) => {
      const safeCountValue = String(value || '').replace(/[^\d]/g, '')
      const currentPlans = normalizeBranchCoursePaymentPlanSelections(current.paymentPlans)
      let customPlanFound = false

      const nextPlans = currentPlans.map((plan) => {
        if (plan.type !== 'custom') return plan
        customPlanFound = true
        return {
          ...plan,
          installmentCount: safeCountValue ? String(Math.max(1, Number(safeCountValue) || 1)) : '',
        }
      })

      if (!customPlanFound) {
        nextPlans.push(
          normalizeBranchCoursePaymentPlanSelection({
            id: BRANCH_PAYMENT_PLAN_CUSTOM_VALUE,
            type: 'custom',
            templateId: BRANCH_PAYMENT_PLAN_CUSTOM_VALUE,
            templateName: 'Custom',
            installmentCount: safeCountValue ? String(Math.max(1, Number(safeCountValue) || 1)) : '',
            installments: [],
            dueRule: 'Custom',
            allowCustomization: true,
            status: 'Active',
          }),
        )
      }

      return {
        ...current,
        paymentPlans: nextPlans,
      }
    })
  }

  const saveAddCoursePaymentPlans = () => {
    const nextSavedPlans = normalizeBranchCoursePaymentPlanSelections(addCourseForm.paymentPlans)
    setAddCourseSavedPaymentPlans(nextSavedPlans)
    setAddCourseSavedPaymentPlanId('')
    setIsPaymentPlanDropdownOpen(false)
    setAddCoursePaymentPlanSaveAttempted(false)
    setAddCourseTouched((current) => ({
      ...current,
      paymentPlans: true,
    }))
  }

  const clearAddCoursePaymentPlans = () => {
    setAddCourseError('')
    setAddCourseTouched((current) => ({
      ...current,
      paymentPlans: true,
    }))
    setAddCourseForm((current) => ({
      ...current,
      paymentPlans: [],
    }))
    setAddCourseSavedPaymentPlans([])
    setAddCourseSavedPaymentPlanId('')
    setAddCoursePaymentPlanSaveAttempted(false)
  }

  const updateAddCourseModelField = (modelIndex, field, value) => {
    setAddCourseError('')
    setAddCourseForm((current) => {
      const models = normalizeBranchCourseModels(current.models)
      return {
        ...current,
        models: models.map((model, index) =>
          index === modelIndex
            ? {
              ...model,
              [field]: value,
            }
            : model,
        ),
      }
    })
  }

  const updateAddCourseSubmodelField = (modelIndex, submodelIndex, value) => {
    setAddCourseError('')
    setAddCourseForm((current) => {
      const models = normalizeBranchCourseModels(current.models)
      return {
        ...current,
        models: models.map((model, index) =>
          index === modelIndex
            ? {
              ...model,
              submodels: normalizeBranchCourseSubmodels(model.submodels, modelIndex).map((submodel, itemIndex) =>
                itemIndex === submodelIndex
                  ? {
                    ...submodel,
                    name: value,
                  }
                  : submodel,
              ),
            }
            : model,
        ),
      }
    })
  }

  const ensureAddCourseModelDraft = () => {
    setAddCourseForm((current) => {
      const models = normalizeBranchCourseModels(current.models)
      if (models.length) return current

      return {
        ...current,
        models: [createBranchCourseModel(1, '', [])],
      }
    })
    setSelectedSavedModelIndex(0)
  }

  const snapshotCourseModelForSave = (modelIndex) => {
    const model = addCourseHierarchy[modelIndex]
    if (!model) return null

    return {
      ...model,
      submodels: (model.submodels || []).map((submodel) => ({
        ...submodel,
      })),
    }
  }

  const addAddCourseModel = () => {
    setAddCourseError('')
    const savedModels = normalizeBranchCourseModels(savedCourseHierarchy)
    const nextModelIndex = savedModels.length
    setAddCourseForm((current) => ({
      ...current,
      models: [
        ...savedModels,
        createBranchCourseModel(nextModelIndex + 1, '', []),
      ],
    }))
    setSelectedSavedModelIndex(nextModelIndex)
    setSelectedSavedSubmodelIndex(0)
    setCourseEditorStage('module')
    setIsSubmoduleDraftOpen(false)
    setSubmoduleDraftRestoreLength(null)
    setAddCourseTouched({})
  }

  const markCurrentCourseModelTouched = (modelIndex) => {
    const safeModel = addCourseHierarchy[Math.max(0, Math.min(modelIndex, addCourseHierarchy.length - 1))] || null
    if (!safeModel) return

    const nextTouched = { ...addCourseTouched }
    nextTouched[`model-${modelIndex}-name`] = true
    nextTouched[`model-${modelIndex}-submodels`] = true
      ; (safeModel.submodels || []).forEach((_, submodelIndex) => {
        nextTouched[`model-${modelIndex}-submodel-${submodelIndex}-name`] = true
      })
    setAddCourseTouched(nextTouched)
  }

  const markCurrentCourseSubmodelTouched = (modelIndex, submodelIndex) => {
    setAddCourseTouched((current) => ({
      ...current,
      [`model-${modelIndex}-submodel-${submodelIndex}-name`]: true,
      [`model-${modelIndex}-submodels`]: true,
    }))
  }

  const getCurrentCourseModelError = (modelIndex) => {
    const modelErrors = addCourseValidationErrors.hierarchy.models?.[modelIndex] || {}
    const submodelError = (modelErrors.submodels || []).find((submodelErrors) => submodelErrors?.name)?.name
    return modelErrors.name || modelErrors.submodelsError || submodelError || ''
  }

  const getCurrentCourseModuleNameError = (modelIndex) =>
    addCourseValidationErrors.hierarchy.models?.[modelIndex]?.name || ''

  const getCurrentCourseSubmodelError = (modelIndex, submodelIndex) =>
    addCourseValidationErrors.hierarchy.models?.[modelIndex]?.submodels?.[submodelIndex]?.name || ''

  const handleCourseModelSave = (modelIndex) => {
    markCurrentCourseModelTouched(modelIndex)

    const error = getCurrentCourseModelError(modelIndex)
    if (error) {
      setAddCourseError(error)
      return false
    }

    const snapshot = snapshotCourseModelForSave(modelIndex)
    if (snapshot) {
      setSavedCourseHierarchy((current) => {
        const next = [...current]
        next[modelIndex] = snapshot
        return next
      })
    }

    setAddCourseError('')
    return true
  }

  const handleCourseModelSaveAndNext = (modelIndex) => {
    markCurrentCourseModelTouched(modelIndex)

    const moduleError = getCurrentCourseModuleNameError(modelIndex)
    if (moduleError) {
      setAddCourseError(moduleError)
      return
    }

    const existingSubmodelCount = Array.isArray(addCourseHierarchy[modelIndex]?.submodels)
      ? addCourseHierarchy[modelIndex].submodels.length
      : 0

    setSelectedSavedSubmodelIndex(existingSubmodelCount)
    setCourseEditorStage('submodule')
    if (existingSubmodelCount === 0) {
      openCourseSubmodelDraft(modelIndex, 0)
      return
    }
    setIsSubmoduleDraftOpen(false)
  }

  const handleCourseEditorCancel = () => {
    const savedModuleCount = Array.isArray(savedCourseHierarchy) ? savedCourseHierarchy.length : 0
    setAddCourseError('')
    setAddCourseForm((current) => ({
      ...current,
      models: normalizeBranchCourseModels(savedCourseHierarchy),
    }))
    setCourseEditorStage('closed')
    setIsSubmoduleDraftOpen(false)
    setSelectedSavedModelIndex(Math.max(0, savedModuleCount - 1))
    setSelectedSavedSubmodelIndex(0)
    setSubmoduleDraftRestoreLength(null)
    setAddCourseTouched({})
  }

  const openCourseSubmodelDraft = (modelIndex, draftIndexOverride = null) => {
    const model = addCourseHierarchy[modelIndex]
    if (!model) return

    const submodels = Array.isArray(model.submodels) ? model.submodels : []
    const draftIndex = Math.max(Number.isInteger(draftIndexOverride) ? draftIndexOverride : selectedSavedSubmodelIndex, 0)
    const shouldAppendDraft = draftIndex >= submodels.length
    setSubmoduleDraftRestoreIndex(selectedSavedSubmodelIndex)
    setSubmoduleDraftRestoreLength(shouldAppendDraft ? submodels.length : null)
    setAddCourseError('')
    setAddCourseForm((current) => {
      const models = normalizeBranchCourseModels(current.models)
      const nextModels = models.map((item, index) => {
        if (index !== modelIndex) return item

        const nextSubmodels = normalizeBranchCourseSubmodels(item.submodels, modelIndex)
        const needsAppend = draftIndex >= nextSubmodels.length

        return {
          ...item,
          submodels: needsAppend
            ? [...nextSubmodels, createBranchCourseSubmodel(nextSubmodels.length + 1, '')]
            : nextSubmodels,
        }
      })

      return {
        ...current,
        models: nextModels,
      }
    })
    setCourseEditorStage('submodule')
    setIsSubmoduleDraftOpen(true)
    setSelectedSavedSubmodelIndex(draftIndex)
  }

  const handleCourseSubmodelSave = (modelIndex) => {
    const model = addCourseHierarchy[modelIndex]
    if (!model) return false

    const submodels = Array.isArray(model.submodels) ? model.submodels : []
    const currentSubmodelIndex = Math.min(selectedSavedSubmodelIndex, Math.max(submodels.length - 1, 0))
    markCurrentCourseSubmodelTouched(modelIndex, currentSubmodelIndex)

    const currentError = getCurrentCourseSubmodelError(modelIndex, currentSubmodelIndex)
    if (currentError) {
      setAddCourseError(currentError)
      return false
    }

    setAddCourseError('')
    setSelectedSavedSubmodelIndex((current) => current + 1)
    setIsSubmoduleDraftOpen(false)
    setSubmoduleDraftRestoreIndex((current) => current)
    setSubmoduleDraftRestoreLength(null)
    return true
  }

  const handleCourseSubmodelCancel = (modelIndex) => {
    setAddCourseError('')
    setAddCourseForm((current) => {
      if (!Number.isInteger(submoduleDraftRestoreLength)) return current

      const models = normalizeBranchCourseModels(current.models)
      return {
        ...current,
        models: models.map((model, index) => {
          if (index !== modelIndex) return model

          const nextSubmodels = normalizeBranchCourseSubmodels(model.submodels, modelIndex)
          if (nextSubmodels.length <= submoduleDraftRestoreLength) return model

          return {
            ...model,
            submodels: nextSubmodels.slice(0, submoduleDraftRestoreLength),
          }
        }),
      }
    })
    setAddCourseTouched((current) => {
      const nextTouched = { ...current }
      delete nextTouched[`model-${modelIndex}-submodel-${selectedSavedSubmodelIndex}-name`]
      return nextTouched
    })
    setIsSubmoduleDraftOpen(false)
    setSelectedSavedSubmodelIndex(submoduleDraftRestoreIndex)
    setSubmoduleDraftRestoreLength(null)
  }

  const handleCourseSubmodelEdit = (modelIndex, submodelIndex) => {
    openCourseSubmodelDraft(modelIndex, submodelIndex)
  }

  const handleCourseSubmodelDelete = (modelIndex, submodelIndex) => {
    const model = savedCourseRows[modelIndex]
    const submodel = normalizeBranchCourseSubmodels(model?.submodels, modelIndex)[submodelIndex]

    setCourseSubmoduleDeleteTarget({
      modelIndex,
      submodelIndex,
      label: submodel?.name || `Submodule ${submodelIndex + 1}`,
    })
  }

  const closeCourseSubmoduleDeleteConfirm = () => {
    setCourseSubmoduleDeleteTarget(null)
  }

  const handleCourseSubmoduleDeleteConfirm = () => {
    if (!courseSubmoduleDeleteTarget) return

    const { modelIndex, submodelIndex } = courseSubmoduleDeleteTarget
    removeAddCourseSubmodel(modelIndex, submodelIndex)
    setAddCourseError('')
    setIsSubmoduleDraftOpen(false)
    setSelectedSavedSubmodelIndex((current) => {
      if (submodelIndex < current) return current - 1
      if (submodelIndex === current) return Math.max(0, current - 1)
      return current
    })
    setCourseSubmoduleDeleteTarget(null)
  }

  const handleCourseModuleFinalSave = (modelIndex) => {
    markCurrentCourseModelTouched(modelIndex)

    if (isSubmoduleDraftOpen) {
      const savedCurrentSubmodel = handleCourseSubmodelSave(modelIndex)
      if (!savedCurrentSubmodel) return false
    }

    const moduleError = getCurrentCourseModelError(modelIndex)
    if (moduleError) {
      setAddCourseError(moduleError)
      return false
    }

    const snapshot = snapshotCourseModelForSave(modelIndex)
    if (snapshot) {
      setSavedCourseHierarchy((current) => {
        const next = [...current]
        next[modelIndex] = snapshot
        return next
      })
    }

    setAddCourseError('')
    setCourseEditorStage('closed')
    setIsSubmoduleDraftOpen(false)
    setSelectedSavedSubmodelIndex(0)
    setSubmoduleDraftRestoreLength(null)
    return true
  }

  const removeAddCourseSubmodel = (modelIndex, submodelIndex) => {
    setAddCourseError('')
    setAddCourseForm((current) => {
      const models = normalizeBranchCourseModels(current.models)
      return {
        ...current,
        models: models.map((model, index) => {
          if (index !== modelIndex) return model

          const nextSubmodels = normalizeBranchCourseSubmodels(model.submodels, modelIndex).filter((_, itemIndex) => itemIndex !== submodelIndex)
          return {
            ...model,
            submodels: nextSubmodels,
          }
        }),
      }
    })
  }

  const selectCourseModel = (modelIndex) => {
    const safeIndex = Math.max(0, Number(modelIndex) || 0)
    setSelectedSavedModelIndex(safeIndex)
    setSelectedSavedSubmodelIndex(0)
    setAddCourseStep(2)
    setCourseEditorStage('module')
    setIsSubmoduleDraftOpen(false)
    setSubmoduleDraftRestoreLength(null)
    setAddCourseError('')
  }

  const removeSavedCourseModel = (modelIndex) => {
    const removedModelId = savedCourseRows[modelIndex]?.id
    setAddCourseForm((current) => {
      const nextModels = Array.isArray(current.models) ? current.models.filter((_, index) => index !== modelIndex) : []
      return {
        ...current,
        models: nextModels,
      }
    })

    setSavedCourseHierarchy((current) => current.filter((_, index) => index !== modelIndex))

    setSelectedSavedModelIndex((current) => {
      if (current === modelIndex) return Math.max(0, modelIndex - 1)
      if (current > modelIndex) return current - 1
      return current
    })

    if (removedModelId) {
      setExpandedSavedCourseModuleIds((current) => current.filter((id) => id !== removedModelId))
    }
  }

  const openCourseModuleDeleteConfirm = (modelIndex) => {
    const model = savedCourseRows[modelIndex]
    if (!model) return

    setCourseModuleDeleteTarget({
      modelIndex,
      label: model.name || `Module ${modelIndex + 1}`,
    })
  }

  const closeCourseModuleDeleteConfirm = () => {
    setCourseModuleDeleteTarget(null)
  }

  const handleCourseModuleDeleteConfirm = () => {
    if (!courseModuleDeleteTarget) return

    removeSavedCourseModel(courseModuleDeleteTarget.modelIndex)
    setCourseModuleDeleteTarget(null)
  }

  const resetAddCourseForm = (record = editingCourseRecord, draftKey = courseDraftKey) => {
    isAddCourseSubmitLockedRef.current = false
    const nextForm = record
      ? buildBranchCourseFormFromRecord(record)
      : createInitialBranchCourseForm()
    const nextHierarchy = record
      ? buildBranchCourseHierarchySummary(record.models || record.courseModels || record.modules || [])
      : []

    setAddCourseForm(nextForm)
    setAddCourseSavedPaymentPlans(normalizeBranchCoursePaymentPlanSelections(nextForm.paymentPlans))
    setAddCourseSavedPaymentPlanId('')
    setAddCoursePaymentPlanSaveAttempted(false)
    setAddCourseTouched({})
    setAddCourseError('')
    setAddCourseStep(1)
    setCourseEditorStage('module')
    setSelectedSavedModelIndex(0)
    setSelectedSavedSubmodelIndex(0)
    setSavedCourseHierarchy(nextHierarchy)
    setSubmoduleDraftRestoreLength(null)
    writeBranchCourseDraft(draftKey, null)
  }

  const openAddCourseModal = async () => {
    const availableTemplates = branchInstallmentTemplates.length
      ? branchInstallmentTemplates
      : await loadBranchInstallmentPlanOptions()

    if (!availableTemplates.length) {
      setIsPaymentPlanRequiredOpen(true)
      return
    }

    isAddCourseSubmitLockedRef.current = false
    const nextDraftKey = 'new'
    setCourseDraftKey(nextDraftKey)
    resetAddCourseForm(null, nextDraftKey)
    setEditingCourseId('')
    setCourseSaveSuccess(null)
    setCourseModuleDeleteTarget(null)
    setCourseSubmoduleDeleteTarget(null)
    setIsAddCourseOpen(true)
    goToBranchSection('courses')
  }

  const closePaymentPlanRequiredModal = () => {
    setIsPaymentPlanRequiredOpen(false)
  }

  const goToCreatePaymentPlan = () => {
    setIsPaymentPlanRequiredOpen(false)
    navigate('/branch-dashboard?section=installments')
  }

  const openViewCourseDrawer = (course) => {
    setViewCourse(normalizeBranchCourseRecord(course))
    setViewCourseTab('basic')
    setExpandedViewCourseModuleIds([])
    setViewCoursePaymentPlanOpenId('')
    setOpenCourseActionMenuId('')
    setCourseActionMenuPosition({ top: 0, left: 0 })
  }

  const closeViewCourseDrawer = () => {
    setViewCourse(null)
    setViewCourseTab('basic')
    setExpandedViewCourseModuleIds([])
    setViewCoursePaymentPlanOpenId('')
  }
  const openEditCourseModal = (course) => {
    isAddCourseSubmitLockedRef.current = false
    const nextEditingCourseId = resolveBranchCourseEditableId(course, branchCourseCards)
    const savedDraft = readBranchCourseDraft(nextEditingCourseId)
    const nextForm = savedDraft?.form || buildBranchCourseFormFromRecord(course)
    const nextSavedPaymentPlans = normalizeBranchCoursePaymentPlanSelections(nextForm.paymentPlans)
    setCourseDraftKey(nextEditingCourseId || 'new')
    setEditingCourseId(nextEditingCourseId)
    setAddCourseForm(nextForm)
    setAddCourseSavedPaymentPlans(nextSavedPaymentPlans)
    setAddCourseSavedPaymentPlanId('')
    setAddCoursePaymentPlanSaveAttempted(false)
    setAddCourseTouched(savedDraft?.touched || {})
    setAddCourseError('')
    setAddCourseStep(1)
    setCourseEditorStage('module')
    setIsSubmoduleDraftOpen(false)
    setSelectedSavedModelIndex(savedDraft?.selectedSavedModelIndex ?? 0)
    setSelectedSavedSubmodelIndex(savedDraft?.selectedSavedSubmodelIndex ?? 0)
    setSubmoduleDraftRestoreLength(Number.isInteger(savedDraft?.submoduleDraftRestoreLength) ? savedDraft.submoduleDraftRestoreLength : null)
    setSavedCourseHierarchy(
      Array.isArray(savedDraft?.savedCourseHierarchy) && savedDraft.savedCourseHierarchy.length
        ? savedDraft.savedCourseHierarchy
        : buildBranchCourseHierarchySummary(course?.models || course?.courseModels || course?.modules || []),
    )
    setOpenCourseActionMenuId('')
    setCourseActionMenuPosition({ top: 0, left: 0 })
    setCourseModuleDeleteTarget(null)
    setCourseSubmoduleDeleteTarget(null)
    setIsAddCourseOpen(true)
    goToBranchSection('courses')
  }

  const closeAddCourseModal = () => {
    isAddCourseSubmitLockedRef.current = false
    setIsAddCourseOpen(false)
    setCourseModuleDeleteTarget(null)
    setCourseSubmoduleDeleteTarget(null)
    setAddCourseStep(1)
    setAddCourseSavedPaymentPlans([])
    setAddCourseSavedPaymentPlanId('')
    setAddCoursePaymentPlanSaveAttempted(false)
    setCourseEditorStage('module')
    setSelectedSavedSubmodelIndex(0)
    setSubmoduleDraftRestoreLength(null)
    setOpenCourseActionMenuId('')
    setCourseActionMenuPosition({ top: 0, left: 0 })
  }

  const closeCourseSaveSuccess = () => {
    setCourseSaveSuccess(null)
  }

  useEffect(() => {
    if (!isAddCourseOpen || !courseDraftKey) return undefined

    writeBranchCourseDraft(courseDraftKey, {
      form: addCourseForm,
      touched: addCourseTouched,
      step: addCourseStep,
      courseEditorStage,
      isSubmoduleDraftOpen,
      selectedSavedModelIndex,
      selectedSavedSubmodelIndex,
      submoduleDraftRestoreLength,
      savedCourseHierarchy,
    })

    return undefined
  }, [
    addCourseForm,
    addCourseStep,
    addCourseTouched,
    courseDraftKey,
    isAddCourseOpen,
    courseEditorStage,
    isSubmoduleDraftOpen,
    savedCourseHierarchy,
    selectedSavedModelIndex,
    selectedSavedSubmodelIndex,
  ])

  useEffect(() => {
    if (!isAddCourseOpen || courseEditorStage !== 'submodule' || !isSubmoduleDraftOpen) return undefined

    const frameId = window.requestAnimationFrame(() => {
      activeSubmoduleInputRef.current?.focus()
      activeSubmoduleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [courseEditorStage, isAddCourseOpen, isSubmoduleDraftOpen, selectedSavedModelIndex, selectedSavedSubmodelIndex])

  useEffect(() => {
    if (!isAddCourseOpen) return undefined

    void loadBranchInstallmentPlanOptions()
    return undefined
  }, [isAddCourseOpen, loadBranchInstallmentPlanOptions])

  useEffect(() => {
    if (!isAddCourseOpen || addCourseStep !== 3) return undefined

    if (!branchInstallmentTemplates.length && !isBranchInstallmentTemplatesLoading) {
      void loadBranchInstallmentPlanOptions()
    }

    return undefined
  }, [addCourseStep, branchInstallmentTemplates.length, isAddCourseOpen, isBranchInstallmentTemplatesLoading, loadBranchInstallmentPlanOptions])

  const viewCourseInstallmentTemplate = useMemo(
    () => normalizeBranchInstallmentTemplate(viewCourse?.installmentTemplate || viewCourse?.branchInstallmentTemplate || null),
    [viewCourse],
  )
  const viewCourseModels = useMemo(
    () => buildBranchCourseHierarchySummary(viewCourse?.models || viewCourse?.courseModels || viewCourse?.modules || []),
    [viewCourse],
  )
  const viewCoursePaymentPlans = useMemo(
    () => buildBranchCoursePaymentPlanSelectionsFromRecord(viewCourse || {}),
    [viewCourse],
  )
  const viewCourseFinalFeeValue = useMemo(
    () => getBranchCourseFinalFeeValue(viewCourse || {}),
    [viewCourse],
  )

  const toggleViewCourseModule = (moduleId) => {
    setExpandedViewCourseModuleIds((current) => (
      current.includes(moduleId)
        ? current.filter((id) => id !== moduleId)
        : [...current, moduleId]
    ))
  }

  const toggleSavedCourseModule = (moduleId) => {
    setExpandedSavedCourseModuleIds((current) => (
      current.includes(moduleId)
        ? current.filter((id) => id !== moduleId)
        : [...current, moduleId]
    ))
  }

  const openDeleteCourseConfirm = (course) => {
    setCourseDeleteTarget(course)
    setCourseActionError('')
    setOpenCourseActionMenuId('')
    setCourseActionMenuPosition({ top: 0, left: 0 })
  }

  const closeDeleteCourseConfirm = () => {
    setCourseDeleteTarget(null)
    setCourseActionError('')
  }

  const handleDeleteCourseConfirm = async () => {
    if (!courseDeleteTarget) return

    try {
      setIsCourseDeleting(true)
      const targetCourseId = resolveBranchCourseEditableId(courseDeleteTarget, branchCourseCards)
      await deleteBranchCourse(targetCourseId)
      const nextCards = branchCourseCards.filter((course) => String(course.id || '').trim() !== String(targetCourseId || '').trim())
      setBranchCourseCards(nextCards)
      const nextTotalPages = Math.max(1, Math.ceil(nextCards.length / BRANCH_COURSES_PER_PAGE))
      setBranchCoursePage((current) => Math.min(current, nextTotalPages))
      setCourseDeleteTarget(null)
    } catch (error) {
      setCourseActionError(apiErrorMessage(error, 'Unable to delete course right now.'))
    } finally {
      setIsCourseDeleting(false)
    }
  }

  const handleAddCourseSubmit = async (event) => {
    event?.preventDefault()
    if (!courseSaveIntentRef.current) return
    courseSaveIntentRef.current = false
    if (isAddCourseSubmitLockedRef.current) return
    isAddCourseSubmitLockedRef.current = true
    const committedPaymentPlans = normalizeBranchCoursePaymentPlanSelections(addCourseForm.paymentPlans)
    const nextTouched = { ...addCourseTouched }
    COURSE_BASIC_FIELDS.forEach((field) => {
      nextTouched[field] = true
    })
    normalizeBranchCourseModels(addCourseForm.models).forEach((model, modelIndex) => {
      nextTouched[`model-${modelIndex}-name`] = true
      nextTouched[`model-${modelIndex}-submodels`] = true
        ; (model.submodels || []).forEach((submodel, submodelIndex) => {
          nextTouched[`model-${modelIndex}-submodel-${submodelIndex}-name`] = true
        })
    })
    nextTouched.paymentPlans = true
    setAddCourseTouched(nextTouched)

    if (Object.keys(addCourseVisibleBasicErrors).length > 0 || addCourseValidationErrors.hierarchy.modelsError) {
      setAddCourseStep(1)
      setAddCourseError(Object.values(addCourseVisibleBasicErrors)[0] || addCourseValidationErrors.hierarchy.modelsError || 'Please fill all required fields before saving.')
      isAddCourseSubmitLockedRef.current = false
      return
    }

    if (addCourseValidationErrors.hierarchy.models.some((modelErrors) => modelErrors.name || modelErrors.submodelsError || modelErrors.submodels.some((submodelErrors) => submodelErrors.name))) {
      setAddCourseStep(2)
      setAddCourseError(
        addCourseValidationErrors.hierarchy.models.find((modelErrors) => modelErrors.name)?.name ||
        addCourseValidationErrors.hierarchy.models.find((modelErrors) => modelErrors.submodelsError)?.submodelsError ||
        addCourseValidationErrors.hierarchy.models.find((modelErrors) => modelErrors.submodels.some((submodelErrors) => submodelErrors.name))?.submodels?.find((submodelErrors) => submodelErrors.name)?.name ||
        'Please fill all required fields before saving.',
      )
      isAddCourseSubmitLockedRef.current = false
      return
    }

    if (!committedPaymentPlans.length || addCoursePaymentPlanValidationError) {
      setAddCourseStep(3)
      setAddCourseError(addCoursePaymentPlanValidationError || 'Please select at least one payment plan.')
      isAddCourseSubmitLockedRef.current = false
      return
    }

    const hasInvalidCustomPaymentPlan = committedPaymentPlans.some(
      (plan) => plan.type === 'custom' && !String(plan.installmentCount || '').trim(),
    )

    if (hasInvalidCustomPaymentPlan) {
      setAddCourseStep(3)
      setAddCourseError('Custom payment plan requires a valid installment count.')
      isAddCourseSubmitLockedRef.current = false
      return
    }

    saveAddCoursePaymentPlans()
    setIsAddCourseSaving(true)
    try {
      const normalizedCourseCode = normalizeBranchCourseCode(addCourseForm.courseCode)
      const editingTargetId = resolveBranchCourseEditableId(
        branchCourseCards.find((course) => String(course.id || '').trim() === String(editingCourseId || '').trim()) || {
          id: editingCourseId,
          courseCode: addCourseForm.courseCode,
          name: addCourseForm.name,
        },
        branchCourseCards,
      )
      const duplicateCourse = branchCourseCards.find(
        (course) =>
          String(course.id || '').trim() !== editingTargetId &&
          String(course.name || '').trim().toLowerCase() === String(addCourseForm.name || '').trim().toLowerCase(),
      )
      const duplicateCourseCode = branchCourseCards.find(
        (course) =>
          String(course.id || '').trim() !== editingTargetId &&
          String(course.courseCode || '').trim().toLowerCase() ===
          String(normalizedCourseCode).trim().toLowerCase(),
      )

      if (duplicateCourseCode) {
        setAddCourseError('Course code already exists.')
        isAddCourseSubmitLockedRef.current = false
        return
      }

      if (duplicateCourse) {
        setAddCourseError('Course already exists.')
        isAddCourseSubmitLockedRef.current = false
        return
      }

      const payload = buildBranchCoursePayload(addCourseForm)
      const savedCourse = editingTargetId
        ? await updateBranchCourse(editingTargetId, payload)
        : await createBranchCourse(payload)

      const nextModels = normalizeBranchCourseModels(
        savedCourse?.models || savedCourse?.courseModels || savedCourse?.modules || payload.models || [],
      )
      const normalizedCourse = {
        ...savedCourse,
        batches: Number(savedCourse?.batchCount ?? savedCourse?.batches ?? 0),
        students: Number(savedCourse?.studentCount ?? savedCourse?.students ?? 0),
        models: nextModels,
        courseModels: nextModels,
        modules: nextModels,
      }

      const nextCards = editingTargetId
        ? branchCourseCards.map((course) => (String(course.id || '').trim() === editingTargetId ? normalizedCourse : course))
        : [normalizedCourse, ...branchCourseCards]

      setBranchCourseCards(nextCards)
      await loadBranchCourses(nextCards)
      setBranchCoursePage(1)
      setCourseSaveSuccess({
        title: editingTargetId ? 'Course updated' : 'Course created',
        message: editingTargetId
          ? 'The course details have been updated successfully.'
          : 'The course has been saved successfully.',
      })
      setIsAddCourseOpen(false)
      setAddCourseForm(createInitialBranchCourseForm())
      setAddCourseTouched({})
      setEditingCourseId('')
      setAddCourseStep(1)
    } catch (error) {
      setAddCourseError(apiErrorMessage(error, 'Unable to save course right now.'))
    } finally {
      setIsAddCourseSaving(false)
      isAddCourseSubmitLockedRef.current = false
    }
  }

  const triggerAddCourseSubmit = () => {
    courseSaveIntentRef.current = true
    void handleAddCourseSubmit()
  }

  const handleCourseBasicNext = () => {
    const nextTouched = { ...addCourseTouched }
    COURSE_BASIC_FIELDS.forEach((field) => {
      nextTouched[field] = true
    })
    setAddCourseTouched(nextTouched)

    if (Object.keys(addCourseValidationErrors.basic).length > 0) {
      setAddCourseError(Object.values(addCourseValidationErrors.basic)[0] || 'Please complete the basic course details.')
      setAddCourseStep(1)
      return
    }

    setAddCourseError('')
    setAddCourseStep(2)
    setCourseEditorStage('closed')
    setIsSubmoduleDraftOpen(false)
    setSelectedSavedModelIndex(0)
    setSelectedSavedSubmodelIndex(0)
  }

  const handleCourseModulesNext = () => {
    const nextTouched = { ...addCourseTouched }
    normalizeBranchCourseModels(addCourseForm.models).forEach((model, modelIndex) => {
      nextTouched[`model-${modelIndex}-name`] = true
      nextTouched[`model-${modelIndex}-submodels`] = true
        ; (model.submodels || []).forEach((_, submodelIndex) => {
          nextTouched[`model-${modelIndex}-submodel-${submodelIndex}-name`] = true
        })
    })
    setAddCourseTouched(nextTouched)

    if (isSubmoduleDraftOpen) {
      setAddCourseError('Please save or cancel the current submodule before continuing.')
      setAddCourseStep(2)
      return
    }

    const validationErrors = createBranchCourseErrors(addCourseForm)
    const hasHierarchyErrors = Boolean(
      validationErrors.hierarchy.modelsError ||
      validationErrors.hierarchy.models.some(
        (modelErrors) =>
          modelErrors.name ||
          modelErrors.submodelsError ||
          modelErrors.submodels.some((submodelErrors) => submodelErrors.name),
      ),
    )

    if (hasHierarchyErrors) {
      setAddCourseError(
        validationErrors.hierarchy.models.find((modelErrors) => modelErrors.name)?.name ||
        validationErrors.hierarchy.models.find((modelErrors) => modelErrors.submodelsError)?.submodelsError ||
        validationErrors.hierarchy.models.find((modelErrors) => modelErrors.submodels.some((submodelErrors) => submodelErrors.name))?.submodels?.find((submodelErrors) => submodelErrors.name)?.name ||
        validationErrors.hierarchy.modelsError ||
        'Please complete the module tree before continuing.',
      )
      setAddCourseStep(2)
      return
    }

    setAddCourseError('')
    setAddCoursePaymentPlanSaveAttempted(false)
    setAddCourseStep(3)
    setCourseEditorStage('closed')
    setIsSubmoduleDraftOpen(false)
    setSelectedSavedModelIndex(0)
    setSelectedSavedSubmodelIndex(0)
  }

  useEffect(() => {
    if (!isAddCourseOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAddCourseOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isAddCourseOpen])

  useEffect(() => {
    if (!isPaymentPlanDropdownOpen) return undefined

    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (paymentPlanDropdownRef.current?.contains(target)) return
      setIsPaymentPlanDropdownOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsPaymentPlanDropdownOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isPaymentPlanDropdownOpen])

  useEffect(() => {
    if (!viewCourse) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeViewCourseDrawer()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [viewCourse])

  // ── Student helpers ──
  const branchId = branchProfile?.id || branchProfile?.branchId || ''
  const branchCode = branchProfile?.branchId || branchProfile?.branchCode || ''
  const branchStudentScope = useMemo(() => ({
    id: branchId,
    branchId,
    branchCode,
  }), [branchId, branchCode])
  const storedPaymentHistoryRecords = useMemo(() => {
    const scopedRecords = loadBranchPaymentHistoryEntries(branchStudentScope)
    if (scopedRecords.length > 0) {
      return scopedRecords
    }

    const allRecords = loadBranchPaymentHistoryEntries('')
    const branchStudentIds = new Set(
      branchStudents
        .map((student) => String(student.studentId || '').trim())
        .filter(Boolean),
    )

    return allRecords.filter((record) => branchStudentIds.has(String(record.studentId || '').trim()))
  }, [branchStudentScope, branchStudents])

  const reloadBranchStudents = useCallback(async () => {
    if (!branchStudentScope.id && !branchStudentScope.branchCode) return []

    try {
      const freshRecords = await refreshBranchStudents(branchStudentScope)
      setBranchStudents(freshRecords)
      return freshRecords
    } catch (error) {
      console.error('Failed to refresh branch students from backend:', error)
      setBranchStudents([])
      return []
    }
  }, [branchStudentScope])

  useEffect(() => {
    void loadFacultyTodayWorkEntries()

    const handleTodayWorkChanged = () => {
      void loadFacultyTodayWorkEntries()
    }

    const handleStorageChanged = (event) => {
      if (event?.key === FACULTY_TODAY_WORK_SYNC_KEY || event?.key === BRANCH_STUDENTS_KEY) {
        void loadFacultyTodayWorkEntries()
        void reloadBranchStudents()
      }
    }

    window.addEventListener(FACULTY_TODAY_WORK_SYNC_EVENT, handleTodayWorkChanged)
    window.addEventListener('storage', handleStorageChanged)

    return () => {
      window.removeEventListener(FACULTY_TODAY_WORK_SYNC_EVENT, handleTodayWorkChanged)
      window.removeEventListener('storage', handleStorageChanged)
    }
  }, [loadFacultyTodayWorkEntries, reloadBranchStudents])

const studentCourseOptions = useMemo(() => {
  return branchCourseCards
    .map((course) => {
      const id = String(course?.id || '').trim()
      const name = String(course?.name || '').trim()
      if (!id || !name) return null

      return {
        id,
        name,
        amount: normalizeBranchStudentCourseAmount(course),
        assignedFaculty: normalizeBranchStudentCourseFacultyOptions(course),

        // Course-ku already configured payment plans
        paymentPlans: normalizeBranchCoursePaymentPlanSelections(
          course?.paymentPlans ||
          course?.paymentPlanSelections ||
          course?.installmentPlans ||
          []
        ),
      }
    })
    .filter(Boolean)
}, [branchCourseCards])

  const selectedStudentCourse = useMemo(
    () => studentCourseOptions.find((course) => String(course.id || '').trim() === String(studentForm.courseId || '').trim()) || null,
    [studentCourseOptions, studentForm.courseId],
  )

  const selectedStudentCourseAmount = useMemo(
    () => String(selectedStudentCourse?.amount || studentForm.courseAmount || '').trim(),
    [selectedStudentCourse, studentForm.courseAmount],
  )
  const currentStudentSeatKeys = useMemo(() => (
    studentFormMode === 'edit'
      ? getStudentSeatKeys(studentForm)
      : []
  ), [studentForm, studentFormMode])
  const selectedStudentCourseBatchOptions = useMemo(() => {
    const courseId = String(studentForm.courseId || '').trim()
    if (!courseId) return []

    return branchBatchGroups
      .filter((group) => String(group?.courseId || group?.branchCourseId || '').trim() === courseId)
      .flatMap((group) => {
        const batches = Array.isArray(group?.batches) ? group.batches : []
        return batches
          .map((batch) => {
            const batchId = String(batch?.batchId || batch?.id || '').trim()
            const batchName = String(batch?.batchName || '').trim()
            if (!batchId && !batchName) return null

            const batchTiming = formatStudentBatchTiming(batch)
            const seatSummary = getBatchSeatSummary({
              batchId,
              batchName,
              batchTiming,
              totalSeats: batch?.totalSeats || 0,
              courseId: String(group?.courseId || group?.branchCourseId || '').trim(),
              courseName: String(group?.courseName || '').trim(),
              facultyId: String(group?.facultyId || group?.branchFacultyId || '').trim(),
              facultyName: String(group?.facultyName || '').trim(),
            }, branchStudents, currentStudentSeatKeys)
            const baseLabel = batchName || batchId || 'Batch'
            const seatLabel = seatSummary.totalSeats
              ? `${seatSummary.availableSeats} of ${seatSummary.totalSeats} seats left`
              : 'No seats configured'
            return {
              value: batchId || batchName,
              batchId: batchId || batchName,
              batchName: batchName || batchId,
              batchTiming,
              batchGroupId: String(group?.batchGroupId || group?.id || '').trim(),
              courseId: String(group?.courseId || group?.branchCourseId || '').trim(),
              courseName: String(group?.courseName || '').trim(),
              facultyId: String(group?.facultyId || group?.branchFacultyId || '').trim(),
              facultyName: String(group?.facultyName || '').trim(),
              facultyEmail: String(group?.facultyEmail || '').trim(),
              facultyPhone: String(group?.facultyPhone || '').trim(),
              totalSeats: seatSummary.totalSeats,
              usedSeats: seatSummary.usedSeats,
              availableSeats: seatSummary.availableSeats,
              isFull: seatSummary.isFull,
              isSelectable: seatSummary.availableSeats > 0,
              label: `${baseLabel} - ${batchTiming || 'No timing'} (${seatLabel})`,
            }
          })
          .filter(Boolean)
      })
      .sort((left, right) => String(left.batchId || left.batchName || '').localeCompare(String(right.batchId || right.batchName || '')))
  }, [branchBatchGroups, branchStudents, currentStudentSeatKeys, studentForm.courseId, studentFormMode])

  const selectedStudentBatchOption = useMemo(
    () => selectedStudentCourseBatchOptions.find((batch) => {
      const currentBatchId = String(studentForm.batchId || '').trim().toLowerCase()
      const currentBatchName = String(studentForm.batchName || '').trim().toLowerCase()
      const currentBatchTiming = String(studentForm.batchTiming || '').trim().toLowerCase()
      return (
        String(batch.batchId || '').trim().toLowerCase() === currentBatchId ||
        String(batch.batchName || '').trim().toLowerCase() === currentBatchName ||
        String(batch.batchTiming || '').trim().toLowerCase() === currentBatchTiming
      )
    }) || null,
    [selectedStudentCourseBatchOptions, studentForm.batchId, studentForm.batchName, studentForm.batchTiming],
  )
  const hasSelectableStudentBatchOption = useMemo(
    () => selectedStudentCourseBatchOptions.some((batch) => batch.isSelectable),
    [selectedStudentCourseBatchOptions],
  )

  const selectedStudentCoursePaymentPlans = useMemo(
    () =>
      Array.isArray(selectedStudentCourse?.paymentPlans)
        ? selectedStudentCourse.paymentPlans
        : [],
    [selectedStudentCourse],
  )

  const selectedStudentPaymentPlan = useMemo(
    () =>
      selectedStudentCoursePaymentPlans.find(
        (plan) =>
          String(plan.id || '').trim() ===
          String(studentForm.paymentPlanId || '').trim(),
      ) || null,
    [selectedStudentCoursePaymentPlans, studentForm.paymentPlanId],
  )

  const studentInstallmentCount = useMemo(() => {
    if (!selectedStudentPaymentPlan) return 0

    const count = Number(
      selectedStudentPaymentPlan.installmentCount ||
      selectedStudentPaymentPlan.installments?.length ||
      0,
    )

    return Number.isFinite(count) && count > 0 ? count : 0
  }, [selectedStudentPaymentPlan])

  const studentInstallmentAmounts = useMemo(() => {
    const total = Number(
      String(selectedStudentCourseAmount || '').replace(/,/g, ''),
    )

    if (!total || !studentInstallmentCount) return []

    return buildBranchCoursePaymentPlanInstallments(total, studentInstallmentCount).map((amount) => Number(amount))
  }, [selectedStudentCourseAmount, studentInstallmentCount])

  useEffect(() => {
    if (!studentInstallmentCount) {
      setStudentInstallmentDueDates([])
      return
    }

    setStudentInstallmentDueDates(buildInstallmentDueDates(studentInstallmentCount))
  }, [studentInstallmentCount])

  const handleStudentCourseChange = (courseId) => {
    const nextCourseId = String(courseId || '').trim()

    if (!nextCourseId) {
      setStudentForm((current) => ({
        ...current,
        courseId: '',
        courseName: '',
        batchGroupId: '',
        batchId: '',
        batchName: '',
        batchTiming: '',
        facultyId: '',
        facultyName: '',
        facultyEmail: '',
        facultyPhone: '',
        courseAmount: '',
        paymentPlans: [],
        paymentPlan: '',
        paymentPlanId: '',
      }))
      return
    }

    const nextCourse = studentCourseOptions.find((course) => String(course.id || '').trim() === nextCourseId) || null
    const nextPaymentPlans = Array.isArray(nextCourse?.paymentPlans) ? nextCourse.paymentPlans : []

    setStudentForm((current) => {
      return {
        ...current,
        courseId: nextCourse?.id || nextCourseId,
        courseName: nextCourse?.name || '',
        courseAmount: nextCourse?.amount || '',
        batchGroupId: '',
        batchId: '',
        batchName: '',
        batchTiming: '',
        facultyId: '',
        facultyName: '',
        facultyEmail: '',
        facultyPhone: '',
        paymentPlans: nextPaymentPlans,
        paymentPlan: '',
        paymentPlanId: '',
      }
    })
  }

  const handleStudentBatchChange = (batchId) => {
    const nextBatchId = String(batchId || '').trim()
    const nextBatch = selectedStudentCourseBatchOptions.find((batch) => String(batch.batchId || '').trim() === nextBatchId) || null

    setStudentForm((current) => ({
      ...current,
      batchGroupId: nextBatch?.batchGroupId || '',
      batchId: nextBatch?.batchId || '',
      batchName: nextBatch?.batchName || '',
      batchTiming: nextBatch?.batchTiming || '',
      facultyId: nextBatch?.facultyId || '',
      facultyName: nextBatch?.facultyName || '',
      facultyEmail: nextBatch?.facultyEmail || '',
      facultyPhone: nextBatch?.facultyPhone || '',
    }))
  }

  useEffect(() => {
    void reloadBranchStudents()
  }, [reloadBranchStudents])

  useEffect(() => {
    const handleBranchStudentsChanged = () => {
      void reloadBranchStudents()
    }

    window.addEventListener('cispro:branch-students-changed', handleBranchStudentsChanged)
    window.addEventListener('cispro:students-changed', handleBranchStudentsChanged)

    return () => {
      window.removeEventListener('cispro:branch-students-changed', handleBranchStudentsChanged)
      window.removeEventListener('cispro:students-changed', handleBranchStudentsChanged)
    }
  }, [reloadBranchStudents])

  // Load country options for student form
  useEffect(() => {
    let cancelled = false
    getCountries().then((items) => {
      if (cancelled) return
      const sorted = Array.isArray(items)
        ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
        : []
      setStuCountryOptions(sorted)
    }).catch(() => { if (!cancelled) setStuCountryOptions([]) })
    return () => { cancelled = true }
  }, [])

  // Load state options when country changes
  useEffect(() => {
    if (!studentForm.countryCode) { setStuStateOptions([]); setStuCityOptions([]); return }
    let cancelled = false
    getStatesOfCountry(studentForm.countryCode).then((items) => {
      if (cancelled) return
      const sorted = Array.isArray(items)
        ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
        : []
      setStuStateOptions(sorted)
    }).catch(() => { if (!cancelled) setStuStateOptions([]) })
    return () => { cancelled = true }
  }, [studentForm.countryCode])

  // Load city options when state changes
  useEffect(() => {
    if (!studentForm.countryCode || !studentForm.stateCode) { setStuCityOptions([]); return }
    let cancelled = false
    getCitiesOfState(studentForm.countryCode, studentForm.stateCode).then((items) => {
      if (cancelled) return
      const sorted = Array.isArray(items)
        ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
        : []
      setStuCityOptions(sorted)
    }).catch(() => { if (!cancelled) setStuCityOptions([]) })
    return () => { cancelled = true }
  }, [studentForm.countryCode, studentForm.stateCode])

  // Body scroll lock for student form
  useEffect(() => {
    if (!isStudentFormOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setIsStudentFormOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      setIsStudentSaving(false)
    }
  }, [isStudentFormOpen])

  const branchPaymentRows = useMemo(
  () => branchStudents.map((stu) => ({
    student: stu,
    summary: computeBranchStudentPaymentSummary(stu),
  })),
  [branchStudents],
)

  const allPaymentHistoryRecords = useMemo(() => {
    const records = new Map()

    const addRecord = (record = {}) => {
      const id = String(
        record.id ||
        record.receiptNumber ||
        `${record.studentId || 'payment'}-${record.dateRaw || record.date || ''}-${record.amount || 0}-${record.mode || 'mode'}`,
      ).trim()
      const normalizedRecord = {
        ...record,
        id,
        studentId: String(record.studentId || '-').trim(),
        studentName: String(record.studentName || '-').trim(),
        course: String(record.course || '-').trim(),
        amount: Number(record.amount || 0),
        mode: formatBranchPaymentMode(record),
        paymentMode: formatBranchPaymentMode(record),
        dateRaw: getBranchLedgerEntryDateRaw(record, ''),
        date: formatBranchPaymentDate(
          record.dateRaw || record.paymentDateRaw || record.paymentDate || record.createdAt || record.date || '',
        ),
        receiptNumber: String(record.receiptNumber || '').trim(),
        payAgainst: getBranchPaymentHistoryDisplayText(
          record.payAgainst,
          record.description,
          record.referenceType,
        ) || '-',
      }

      const key = getBranchPaymentHistoryCanonicalKey(normalizedRecord)

      const existingRecord = records.get(key)
      if (
        !existingRecord ||
        getBranchPaymentModePriority(normalizedRecord) >= getBranchPaymentModePriority(existingRecord)
      ) {
        records.set(key, normalizedRecord)
      }
    }

    storedPaymentHistoryRecords.forEach((entry) => {
      addRecord({
        ...entry,
        studentId: entry.studentId,
        studentName: entry.studentName,
        course: entry.course,
        amount: entry.amount,
        payAgainst: entry.payAgainst,
      })
    })

    branchStudents.forEach((stu) => {
      const installments = Array.isArray(stu.installmentSchedule) ? stu.installmentSchedule : []

      installments.forEach((inst, index) => {
        const paidAmount = Number(inst.paidAmount ?? inst.amountPaid ?? 0)
        if (paidAmount <= 0) return

        const paymentDateRaw =
          inst.paymentDate ?? inst.paidDate ?? inst.datePaid ?? inst.paidOn ??
          inst.updatedAt ?? inst.paidAt ?? null

        addRecord({
          id: `${stu.studentId || stu.id || 'stu'}-${index}`,
          studentId: stu.studentId || '-',
          studentName: stu.studentName || '-',
          course: stu.courseName || stu.courseInterested || stu.course?.name || '-',
          amount: paidAmount,
          paymentMode:
            inst.paymentMode ||
            inst.mode ||
            inst.paymentMethod ||
            inst.method ||
            inst.transactionMode ||
            inst.modeOfPayment ||
            stu.paymentMode ||
            'Installment',
          mode:
            inst.paymentMode ||
            inst.mode ||
            inst.paymentMethod ||
            inst.method ||
            inst.transactionMode ||
            inst.modeOfPayment ||
            stu.paymentMode ||
            'Installment',
          dateRaw: paymentDateRaw,
          receiptNumber: inst.receiptNumber || inst.receiptNo || inst.receipt || '',
          installmentNumber: inst.installmentNumber || inst.number || index + 1,
          payAgainst: inst.payAgainst || `Installment ${inst.installmentNumber || inst.number || index + 1}`,
        })
      })
    })

    return Array.from(records.values()).sort((a, b) => new Date(b.dateRaw || 0) - new Date(a.dateRaw || 0))
  }, [branchStudents, storedPaymentHistoryRecords])

  const paymentModeFilterOptions = useMemo(() => {
    const presetModes = ['Cash', 'UPI', 'Card', 'Bank', 'Cheque', 'Installment']
    const uniqueModes = new Set(presetModes)

    allPaymentHistoryRecords.forEach((record) => {
      const mode = formatBranchPaymentMode(record)
      if (mode && mode !== '-') {
        uniqueModes.add(mode)
      }
    })

    return ['all', ...Array.from(uniqueModes)]
  }, [allPaymentHistoryRecords])

  const filteredPaymentHistoryRecords = useMemo(() => {
    const q = paymentHistorySearch.trim().toLowerCase()
    const todayStr = getTodayValue()
    const now = new Date()

    return allPaymentHistoryRecords.filter((record) => {
      const matchesSearch =
        !q ||
        String(record.studentId).toLowerCase().includes(q) ||
        String(record.studentName).toLowerCase().includes(q) ||
        String(record.course).toLowerCase().includes(q)

      const matchesDate =
        !paymentHistoryDate ||
        (record.dateRaw && new Date(record.dateRaw).toISOString().slice(0, 10) === paymentHistoryDate)

      const modeValue = formatBranchPaymentMode(record).toLowerCase()
      const matchesMode =
        paymentModeFilter === 'all' ||
        modeValue === paymentModeFilter.toLowerCase()

      let matchesQuickFilter = true
      if (paymentHistoryFilter === 'today') {
        matchesQuickFilter = Boolean(record.dateRaw) &&
          new Date(record.dateRaw).toISOString().slice(0, 10) === todayStr
      } else if (paymentHistoryFilter === 'week') {
        if (!record.dateRaw) {
          matchesQuickFilter = false
        } else {
          const diffDays = (now - new Date(record.dateRaw)) / (1000 * 60 * 60 * 24)
          matchesQuickFilter = diffDays >= 0 && diffDays <= 7
        }
      }

      return matchesSearch && matchesDate && matchesMode && matchesQuickFilter
    })
  }, [allPaymentHistoryRecords, paymentHistorySearch, paymentHistoryDate, paymentHistoryFilter, paymentModeFilter])

const branchPaymentStats = useMemo(() => branchPaymentRows.reduce(
  (acc, row) => {
    acc.totalCollected += row.summary.paidAmount
    acc.totalPending += row.summary.pendingAmount
    if (row.summary.paymentStatus === 'Overdue') acc.overdueCount += 1
    if (
      row.summary.paymentStatus === 'Completed' ||
      row.summary.paymentStatus === 'Paid'
    ) {
      acc.paidCount += 1
    }
    return acc
  },
  { totalCollected: 0, totalPending: 0, overdueCount: 0, paidCount: 0 },
), [branchPaymentRows])

const todaysPaymentAmount = useMemo(() => {
  const todayStr = getTodayValue()

  return allPaymentHistoryRecords.reduce((total, record) => {
    if (getLocalDateValue(record.dateRaw) !== todayStr) {
      return total
    }

    return total + Number(record.amount || 0)
  }, 0)
}, [allPaymentHistoryRecords])

const filteredBranchPaymentRows = useMemo(() => {
  const q = paymentSearchTerm.trim().toLowerCase()
  const todayStr = getTodayValue()

  return branchPaymentRows.filter(({ student, summary }) => {
    const matchesSearch =
      !q ||
      String(student.studentId || '').toLowerCase().includes(q) ||
      String(student.studentName || '').toLowerCase().includes(q) ||
      String(student.courseName || '').toLowerCase().includes(q)

    const matchesStatus =
      paymentStatusFilter === 'all' ||
      summary.paymentStatus.toLowerCase().replace(/\s+/g, '-') === paymentStatusFilter ||
      (paymentStatusFilter === 'paid' && summary.paymentStatus === 'Completed')

    const installments = Array.isArray(student.installmentSchedule) ? student.installmentSchedule : []

    const paidToday = installments.some((inst) => {
      const paidAmount = Number(inst.paidAmount ?? inst.amountPaid ?? 0)
      if (paidAmount <= 0) return false

      const paymentDateRaw =
        inst.paymentDate ?? inst.paidDate ?? inst.datePaid ?? inst.paidOn ??
        inst.updatedAt ?? inst.paidAt ?? null

      if (!paymentDateRaw) return false

      const paymentDateStr = new Date(paymentDateRaw).toISOString().slice(0, 10)
      return paymentDateStr === todayStr
    })

    return matchesSearch && matchesStatus && paidToday
  })
}, [branchPaymentRows, paymentSearchTerm, paymentStatusFilter])
const totalPaymentPages = Math.max(1, Math.ceil(filteredBranchPaymentRows.length / BRANCH_PAYMENTS_PER_PAGE))
const safePaymentPage = Math.min(paymentPage, totalPaymentPages)
const visibleBranchPaymentRows = useMemo(() => {
  const start = (safePaymentPage - 1) * BRANCH_PAYMENTS_PER_PAGE
  return filteredBranchPaymentRows.slice(start, start + BRANCH_PAYMENTS_PER_PAGE)
}, [filteredBranchPaymentRows, safePaymentPage])

const totalPaymentHistoryPages = Math.max(1, Math.ceil(filteredPaymentHistoryRecords.length / BRANCH_PAYMENT_HISTORY_PER_PAGE))
const safePaymentHistoryPage = Math.min(paymentHistoryPage, totalPaymentHistoryPages)
  const visiblePaymentHistoryRecords = useMemo(() => {
    const start = (safePaymentHistoryPage - 1) * BRANCH_PAYMENT_HISTORY_PER_PAGE
    return filteredPaymentHistoryRecords.slice(start, start + BRANCH_PAYMENT_HISTORY_PER_PAGE)
  }, [filteredPaymentHistoryRecords, safePaymentHistoryPage])

  const activePaymentHistoryActionRecord = useMemo(
    () =>
      allPaymentHistoryRecords.find((record) => record.id === paymentHistoryActionMenuId) ||
      visiblePaymentHistoryRecords.find((record) => record.id === paymentHistoryActionMenuId) ||
      null,
    [allPaymentHistoryRecords, paymentHistoryActionMenuId, visiblePaymentHistoryRecords],
  )

const branchStudentsForDisplay = useMemo(
  () =>
    enrichStudentsWithFacultyReferences(
      branchStudents,
      branchFacultyRecords.length ? branchFacultyRecords : facultyList,
      branchCourseCards,
    ),
  [branchCourseCards, branchFacultyRecords, branchStudents, facultyList],
)

const branchTodayWorkEntriesByStudent = useMemo(() => {
  const sortedEntries = [...facultyTodayWorkEntries].sort(
    (left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime(),
  )

  const mapping = new Map()

  branchStudentsForDisplay.forEach((student) => {
    const studentKey = normalizeWorkStudentId(student?.id || student?.studentId || '')
    if (!studentKey) return

    const matchedEntry = sortedEntries.find((entry) => isFacultyWorkEntryForStudent(entry, student))
    if (matchedEntry) {
      mapping.set(studentKey, matchedEntry)
    }
  })

  return mapping
}, [branchStudentsForDisplay, facultyTodayWorkEntries])

  const resolveBranchLedgerStudent = useCallback((studentLike = {}) => {
    const lookupKeys = getBranchStudentLookupKeys(studentLike)
    const studentName = String(studentLike.studentName || studentLike.name || '-').trim()
    const studentId = String(studentLike.studentId || studentLike.id || '').trim()

    const matchedStudent = branchStudents.find((candidate) => {
      const candidateKeys = getBranchStudentLookupKeys(candidate)
      return lookupKeys.some((key) => candidateKeys.includes(key))
    })

    if (matchedStudent) {
      return matchedStudent
    }

    return {
      ...studentLike,
      studentId,
      studentName,
      courseName: String(
        studentLike.courseName ||
        studentLike.courseInterested ||
        studentLike.course?.name ||
        '',
      ).trim(),
    }
  }, [branchStudents])

  const openBranchLedger = useCallback(async (studentLike = {}) => {
    const student = resolveBranchLedgerStudent(studentLike)
    setLedgerStudent(student)
    setLedgerLoading(true)
    setLedgerError('')
    setLedgerView({ entries: [], summary: null, source: 'backend' })

    try {
      setLedgerView({
        ...(student.studentId ? await getBranchStudentLedger(student.studentId) : { entries: [], summary: null }),
        source: 'backend',
      })
    } catch (error) {
      console.error('Failed to load branch student ledger:', error)
      setLedgerError('Unable to load ledger from backend. Please try again.')
      setLedgerView({ entries: [], summary: null, source: 'backend' })
    } finally {
      setLedgerLoading(false)
    }
  }, [resolveBranchLedgerStudent])

  const handleOpenBranchLedger = useCallback((event, studentLike = {}) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    void openBranchLedger(studentLike)
  }, [openBranchLedger])

  const closeBranchLedger = useCallback(() => {
    setLedgerStudent(null)
    setLedgerView({ entries: [], summary: null, source: 'backend' })
    setLedgerLoading(false)
    setLedgerError('')
  }, [])

useEffect(() => {
  setPaymentHistoryPage(1)
}, [paymentHistorySearch, paymentHistoryDate, paymentHistoryFilter])

  const filteredBranchStudents = useMemo(() => {
    const q = studentSearchTerm.trim().toLowerCase()
    if (!q) return branchStudentsForDisplay
    return branchStudentsForDisplay.filter((s) =>
      String(s.studentId || '').toLowerCase().includes(q) ||
      String(s.studentName || '').toLowerCase().includes(q)
    )
  }, [branchStudentsForDisplay, studentSearchTerm])

  const totalStudentPages = Math.max(1, Math.ceil(filteredBranchStudents.length / BRANCH_STUDENTS_PER_PAGE))
  const safeStudentPage = Math.min(studentPage, totalStudentPages)
  const visibleBranchStudents = useMemo(() => {
    const start = (safeStudentPage - 1) * BRANCH_STUDENTS_PER_PAGE
    return filteredBranchStudents.slice(start, start + BRANCH_STUDENTS_PER_PAGE)
  }, [filteredBranchStudents, safeStudentPage])

  const branchStudentCourseProgressByKey = useMemo(() => {
    const progressByStudentKey = new Map()

    branchStudentsForDisplay.forEach((student) => {
      const studentKeys = getBranchStudentLookupKeys(student)
      if (!studentKeys.length) return

      const storedProgress = Number(
        student?.courseProgress ??
        student?.courseCompletionPercentage ??
        student?.progress ??
        NaN,
      )
      if (Number.isFinite(storedProgress)) {
        studentKeys.forEach((key) => {
          progressByStudentKey.set(key, Math.min(100, Math.max(0, storedProgress)))
        })
        return
      }

      const course = resolveBranchStudentCourse(student, branchCourseCards)
      const matchedEntry = branchTodayWorkEntriesByStudent.get(studentKeys[0]) || null
      const resolvedCourse = course || (matchedEntry
        ? branchCourseCards.find((item) => String(item?.id || '').trim() === String(matchedEntry?.courseId || '').trim()) || null
        : null)
      const progressSummary = resolvedCourse
        ? buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, resolvedCourse, student)
        : null
      const courseProgress = Number(progressSummary?.courseProgress)

      const normalizedProgress = Number.isFinite(courseProgress)
        ? Math.min(100, Math.max(0, courseProgress))
        : null

      studentKeys.forEach((key) => {
        progressByStudentKey.set(key, normalizedProgress)
      })
    })

    return progressByStudentKey
  }, [branchCourseCards, branchStudentsForDisplay, branchTodayWorkEntriesByStudent, facultyTodayWorkEntries])

  const branchStudentProgressByNotificationKey = useMemo(() => {
    const progressByStudentKey = new Map()

    branchNotificationRecords.forEach((notification) => {
      const kind = String(notification?.kind || '').trim().toLowerCase()
      if (!kind.endsWith('progress-status')) return

      const studentKey = normalizeBranchStudentLookupKey({
        studentId: notification?.studentId,
      })
      const courseProgress = Number(notification?.courseProgress)

      if (!studentKey || !Number.isFinite(courseProgress)) return

      progressByStudentKey.set(studentKey, Math.min(100, Math.max(0, courseProgress)))
    })

    return progressByStudentKey
  }, [branchNotificationRecords])

  useEffect(() => {
    if (!branchStudentsForDisplay.length || !branchCourseCards.length || !facultyTodayWorkEntries.length) {
      return undefined
    }

    const updates = branchStudentsForDisplay
      .map((student) => {
        const studentKey = normalizeBranchStudentLookupKey(student)
        if (!studentKey) return null

        const course = resolveBranchStudentCourse(student, branchCourseCards)
        const matchedEntry = branchTodayWorkEntriesByStudent.get(studentKey) || null
        const resolvedCourse = course || (matchedEntry
          ? branchCourseCards.find((item) => String(item?.id || '').trim() === String(matchedEntry?.courseId || '').trim()) || null
          : null)
        if (!resolvedCourse) return null

        const progressSummary = buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, resolvedCourse, student)
        const computedProgress = Number(progressSummary?.courseProgress)
        if (!Number.isFinite(computedProgress)) return null

        const normalizedProgress = Math.min(100, Math.max(0, computedProgress))
        const storedProgress = Number(student?.courseProgress)
        const needsUpdate =
          !Number.isFinite(storedProgress) ||
          Math.abs(storedProgress - normalizedProgress) > 0.01

        if (!needsUpdate) return null

        return {
          ...student,
          courseProgress: normalizedProgress,
        }
      })
      .filter(Boolean)

    if (!updates.length) {
      return undefined
    }

    const signature = updates
      .map((student) => `${String(student.studentId || student.id || '').trim()}:${String(student.courseProgress ?? '').trim()}`)
      .sort()
      .join('|')

    if (!signature || branchCourseProgressBackfillSignatureRef.current === signature) {
      return undefined
    }

    branchCourseProgressBackfillSignatureRef.current = signature

    let cancelled = false

    const runBackfill = async () => {
      try {
        await Promise.allSettled(updates.map((student) => saveBranchStudent(student)))
        if (cancelled) return
        void reloadBranchStudents()
      } catch (error) {
        console.error('Failed to backfill branch course progress:', error)
        branchCourseProgressBackfillSignatureRef.current = ''
      }
    }

    void runBackfill()

    return () => {
      cancelled = true
    }
  }, [branchCourseCards, branchStudentsForDisplay, branchTodayWorkEntriesByStudent, facultyTodayWorkEntries, reloadBranchStudents])

  const branchProgressComparisonNotifications = useMemo(() => {
    return branchStudentsForDisplay
      .map((stu) => {
        const studentIdLabel = String(stu.studentId || stu.id || '-').trim()
        const studentName = String(stu.studentName || '-').trim()
        const installmentProgress = getBranchStudentInstallmentProgress(stu)
        const studentKey = normalizeBranchStudentLookupKey(stu)
        const courseProgressPercentage =
          branchStudentProgressByNotificationKey.get(studentKey) ??
          branchStudentCourseProgressByKey.get(studentKey) ??
          null
        const paidProgress = Number.isFinite(Number(installmentProgress.paidInstallmentPercentage))
          ? Number(installmentProgress.paidInstallmentPercentage)
          : null

        if (courseProgressPercentage === null || paidProgress === null) {
          return null
        }

        return buildProgressComparisonNotification({
          studentName,
          studentId: studentIdLabel,
          courseProgress: courseProgressPercentage,
          paidProgress,
          recipientLabel: 'Branch Admin Dashboard',
          audience: 'branch',
          branchId: branchScope.id || branchScope.branchId,
          targetBranchId: branchScope.id || branchScope.branchId,
          targetBranchEmail: branchScope.branchEmail,
          targetBranchName: branchTitle,
        })
      })
      .filter(Boolean)
  }, [
    branchScope.branchEmail,
    branchScope.branchId,
    branchScope.id,
    branchStudentCourseProgressByKey,
    branchStudentProgressByNotificationKey,
    branchStudentsForDisplay,
    branchTitle,
  ])

  useEffect(() => {
    if (!branchProgressComparisonNotifications.length) {
      syncProgressComparisonNotifications([], 'branch')
      return
    }

    syncProgressComparisonNotifications(
      branchProgressComparisonNotifications.map((notification) => ({
        studentName: notification.studentName,
        studentId: notification.studentId,
        courseProgress: notification.courseProgress,
        paidProgress: notification.paidProgress,
        recipientLabel: notification.recipientLabel,
        branchId: notification.branchId,
        targetBranchId: notification.targetBranchId,
        targetBranchEmail: notification.targetBranchEmail,
        targetBranchName: notification.targetBranchName,
      })),
      'branch',
    )
  }, [branchProgressComparisonNotifications])

  const studentFormValidationErrors = useMemo(
    () => {
      const nextErrors = validateStudentForm(studentForm, branchStudents)

      if (
        studentForm.courseId &&
        selectedStudentCourseBatchOptions.length &&
        !hasSelectableStudentBatchOption
      ) {
        nextErrors.batchId = 'No seats available for this course.'
      }

      if (
        studentForm.courseId &&
        studentForm.batchId &&
        selectedStudentBatchOption &&
        selectedStudentBatchOption.isFull &&
        !(studentFormMode === 'edit' && currentStudentSeatKeys.length)
      ) {
        nextErrors.batchId = 'No seats available for this batch.'
      }

      return nextErrors
    },
    [
      branchStudents,
      currentStudentSeatKeys.length,
      hasSelectableStudentBatchOption,
      selectedStudentBatchOption,
      selectedStudentCourseBatchOptions.length,
      studentForm,
      studentForm.courseId,
      studentForm.batchId,
      studentFormMode,
    ],
  )
  const studentFormStepStatus = useMemo(() => ({
    1: STUDENT_FORM_STEP_ONE_FIELDS.every((field) => !studentFormValidationErrors[field]),
    2: STUDENT_FORM_STEP_TWO_FIELDS.every((field) => !studentFormValidationErrors[field]),
    3: STUDENT_FORM_STEP_THREE_FIELDS.every((field) => !studentFormValidationErrors[field]),
  }), [studentFormValidationErrors])
  const studentFormMaxUnlockedStep = studentFormMode === 'view'
    ? 3
    : studentFormStepStatus[1]
      ? (studentFormStepStatus[2] ? 3 : 2)
      : 1
  const shouldShowStudentError = (field) => Boolean(studentFormTouched[field] && studentFormValidationErrors[field])
  const studentActiveStepFields =
    studentFormStep === 1
      ? STUDENT_FORM_STEP_ONE_FIELDS
      : studentFormStep === 2
        ? STUDENT_FORM_STEP_TWO_FIELDS
        : STUDENT_FORM_STEP_THREE_FIELDS
  const studentActiveStepErrorField =
    studentActiveStepFields.find((field) => studentFormTouched[field] && studentFormValidationErrors[field]) || ''
  const studentActiveStepError = studentActiveStepErrorField ? studentFormValidationErrors[studentActiveStepErrorField] : ''

  const updateStudentField = (field, value) => {
    setStudentForm((c) => ({
      ...c,
      [field]: field === 'studentIdSuffix' ? normalizeStudentIdSuffix(value) : value,
    }))
  }

  const handleStudentIdSuffixChange = (value) => {
    updateStudentField('studentIdSuffix', value)
    setStudentFormTouched((current) => ({
      ...current,
      studentIdSuffix: true,
    }))
  }

  const handleStudentIdSuffixBlur = () => {
    setStudentFormTouched((current) => ({
      ...current,
      studentIdSuffix: true,
    }))
  }

  const touchStudentFields = (fields = []) => {
    setStudentFormTouched((current) => {
      const next = { ...current }
      fields.forEach((field) => {
        next[field] = true
      })
      return next
    })
  }

  const handleStudentStepJump = (targetStep) => {
    const safeTargetStep = Math.min(3, Math.max(1, Number(targetStep) || 1))

    if (studentFormMode === 'view') {
      setStudentFormStep(safeTargetStep)
      return
    }

    if (safeTargetStep <= studentFormMaxUnlockedStep) {
      setStudentFormStep(safeTargetStep)
      return
    }

    const blockedStep = Math.max(1, Math.min(studentFormMaxUnlockedStep, safeTargetStep))
    const blockedFields = STUDENT_FORM_STEP_FIELDS[blockedStep] || []
    touchStudentFields(blockedFields)
    setStudentFormStep(blockedStep)
  }

  const handleStudentStepNext = () => {
    if (studentFormMode === 'view') {
      setStudentFormStep((current) => Math.min(3, current + 1))
      return
    }

    const currentStepFields = STUDENT_FORM_STEP_FIELDS[Math.min(2, studentFormStep)] || []
    touchStudentFields(currentStepFields)

    const hasStepErrors = currentStepFields.some((field) => studentFormValidationErrors[field])
    if (hasStepErrors) return

    setStudentFormStep((current) => Math.min(3, current + 1))
  }

  const handleStudentStepBack = () => {
    setStudentFormStep((current) => Math.max(1, current - 1))
  }

  const openAddStudentForm = async () => {
    setStudentFormMode('add')
    setStudentFormError('')
    setIsStudentSaving(false)
    setStudentFormStep(1)
    const nextStudentForm = await resolveStudentLocationForm(createInitialStudentForm(branchStudentScope))
    setStudentForm(nextStudentForm)
    setStudentFormTouched({})
    setIsStudentFormOpen(true)
  }

  const openViewStudentForm = async (stu) => {
    setStudentFormMode('view')
    setStudentFormError('')
    setIsStudentSaving(false)
    setStudentFormStep(1)
    const nextStudentForm = await resolveStudentLocationForm({
      ...buildStudentFormFromRecord(stu),
      ...resolveStudentBatchDisplay(stu, branchBatchGroups),
    })
    setStudentForm(nextStudentForm)
    setStudentFormTouched({})
    setIsStudentFormOpen(true)
  }

  const openEditStudentForm = async (stu) => {
    setStudentFormMode('edit')
    setStudentFormError('')
    setIsStudentSaving(false)
    setStudentFormStep(1)
    const nextStudentForm = await resolveStudentLocationForm({
      ...buildStudentFormFromRecord(stu),
      ...resolveStudentBatchDisplay(stu, branchBatchGroups),
    })
    setStudentForm(nextStudentForm)
    setStudentFormTouched({})
    setIsStudentFormOpen(true)
  }

  const handleStudentFormSubmit = async (e) => {
    e?.preventDefault()
    if (studentFormMode === 'view') return
    if (studentFormStep !== 3) return
    if (isStudentSaving) return
    setStudentFormError('')

    // Touch all fields
    const allTouched = {}
    Object.keys(studentFormValidationErrors).forEach((k) => { allTouched[k] = true })
    STUDENT_FORM_STEP_ONE_FIELDS.forEach((field) => {
      allTouched[field] = true
    })
    STUDENT_FORM_STEP_TWO_FIELDS.forEach((field) => {
      allTouched[field] = true
    })
    STUDENT_FORM_STEP_THREE_FIELDS.forEach((field) => {
      allTouched[field] = true
    })
    if (studentForm.currentStatus === 'Employee') allTouched.designation = true
    if (studentForm.passedOutYear === 'Custom') allTouched.passedOutYearCustom = true
    if (studentForm.source === 'Others') allTouched.sourceOther = true
    setStudentFormTouched(allTouched)

    if (Object.keys(studentFormValidationErrors).length > 0) return

    const originalStudentId = String(studentForm.originalStudentId || studentForm.studentId || '').trim()
    const resolvedStudentId = buildStudentIdFromSuffix(studentForm.studentIdSuffix)
    const selectedCourse = studentCourseOptions.find((course) => String(course.id || '').trim() === String(studentForm.courseId || '').trim()) || null
    const selectedBatch = selectedStudentBatchOption
    const resolvedCourseAmount = String(selectedCourse?.amount || studentForm.courseAmount || '').trim()

    if (selectedBatch && selectedBatch.isFull && !(studentFormMode === 'edit' && currentStudentSeatKeys.length)) {
      setStudentFormError('No seats available for the selected batch.')
      return
    }

    const duplicateStudent = branchStudents.find((student) => {
      const currentStudentId = String(student.studentId || '').trim()
      return currentStudentId === resolvedStudentId && currentStudentId !== originalStudentId
    })

    if (duplicateStudent) {
      setStudentFormError('Student ID already exists in this branch.')
      return
    }

    const record = {
      ...studentForm,
      studentId: resolvedStudentId,
      _originalStudentId: originalStudentId,
      _recordId: String(studentForm.recordId || '').trim(),
      branchId,
      branchCode,
      passedOutYear: studentForm.passedOutYear === 'Custom' ? studentForm.passedOutYearCustom : studentForm.passedOutYear,
      source: studentForm.source === 'Others' ? studentForm.sourceOther : studentForm.source,
      courseId: selectedCourse?.id || String(studentForm.courseId || '').trim(),
      courseName: selectedCourse?.name || String(studentForm.courseName || '').trim(),
      batchGroupId: selectedBatch?.batchGroupId || String(studentForm.batchGroupId || '').trim(),
      batchId: selectedBatch?.batchId || String(studentForm.batchId || '').trim(),
      batchName: selectedBatch?.batchName || String(studentForm.batchName || '').trim(),
      batchTiming: selectedBatch?.batchTiming || String(studentForm.batchTiming || '').trim(),
      facultyId: selectedBatch?.facultyId || String(studentForm.facultyId || '').trim(),
      facultyName: selectedBatch?.facultyName || String(studentForm.facultyName || '').trim(),
      facultyEmail: selectedBatch?.facultyEmail || String(studentForm.facultyEmail || '').trim(),
      facultyPhone: selectedBatch?.facultyPhone || String(studentForm.facultyPhone || '').trim(),
      courseAmount: resolvedCourseAmount,
      totalAmount: resolvedCourseAmount,
      actualFees: String(selectedCourse?.actualFees ?? '').trim(),
      registrationFees: String(selectedCourse?.registrationFees ?? '').trim(),
      discount: String(selectedCourse?.discount ?? '').trim(),
      afterDiscount: resolvedCourseAmount,
      paymentMode: studentForm.paymentMode || 'Installment',
      installmentSchedule: studentInstallmentAmounts.map((amount, index) => ({
        installmentNumber: index + 1,
        amount,
        dueDate: studentInstallmentDueDates[index] || '',
      })),
    }

    delete record.studentIdSuffix
    delete record.originalStudentId
    delete record.recordId

    setIsStudentSaving(true)
    console.log("PAYLOAD BEING SENT TO BACKEND:", record)
    try {
      await saveBranchStudent(record)
      void reloadBranchStudents()
      setIsStudentFormOpen(false)

      if (studentFormMode === 'add') {
        setStudentSuccessPopup({ title: 'Student Added', message: 'Student added successfully.' })
      } else {
        setStudentSuccessPopup({ title: 'Student Updated', message: 'Student updated successfully.' })
      }
    } catch (error) {
      console.error('Failed to save branch student:', error)
      const backendMessage = apiErrorMessage(error, 'Unable to save student. Please try again.')
      const conflictMessage = error?.status === 409
        ? backendMessage
        : null
      setStudentFormError(conflictMessage || backendMessage)
    } finally {
      setIsStudentSaving(false)
    }
  }

  const handleStudentDeleteConfirm = async () => {
    if (!studentDeleteTarget) return
    try {
      setIsStudentDeleting(true)
      await removeBranchStudent(studentDeleteTarget, branchStudentScope)
      const deletedStudentId = String(studentDeleteTarget.studentId || '').trim()
      const deletedRecordId = String(
        studentDeleteTarget.id ||
        studentDeleteTarget._id ||
        studentDeleteTarget.recordId ||
        studentDeleteTarget._recordId ||
        ''
      ).trim()

      setBranchStudents((current) =>
        current.filter((student) => {
          const currentStudentId = String(student.studentId || '').trim()
          const currentRecordId = String(student.id || student._id || student.recordId || student._recordId || '').trim()

          if (deletedStudentId && currentStudentId === deletedStudentId) return false
          if (deletedStudentId && currentRecordId === deletedStudentId) return false
          if (deletedRecordId && currentStudentId === deletedRecordId) return false
          if (deletedRecordId && currentRecordId === deletedRecordId) return false
          return true
        }),
      )

      const nextStudents = loadBranchStudents(branchStudentScope)
      setBranchStudents(nextStudents)
      setStudentDeleteTarget(null)
      setStudentSuccessPopup({ title: 'Student Deleted', message: 'Student deleted successfully.' })
      // Adjust page if needed
      const nextCount = nextStudents.length
      const nextPages = Math.max(1, Math.ceil(nextCount / BRANCH_STUDENTS_PER_PAGE))
      setStudentPage((c) => Math.min(c, nextPages))
    } catch (error) {
      console.error('Failed to delete branch student:', error)
      setStudentDeleteTarget(null)
      setStudentSuccessPopup({
        title: 'Delete Failed',
        message: 'Unable to delete student. Please try again.',
      })
    } finally {
      setIsStudentDeleting(false)
    }
  }

  const renderSidebar = () => (
    <aside className="super-admin-sidebar" aria-label="Branch navigation">
      <div className="super-admin-sidebar-brand">
        <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="CISPRO logo" />
      </div>

      <nav className="super-admin-sidebar-nav">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'courses', label: 'Courses', icon: BookOpen },
          { id: 'installments', label: 'Installments', icon: Wallet },
          { id: 'faculty', label: 'Faculty', icon: UserRound },
          { id: 'students', label: 'Students', icon: Users },
          { id: 'batches', label: 'Batches', icon: Layers3 },
          { id: 'payments', label: 'Payments', icon: Wallet },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'profile', label: 'Profile', icon: CircleUserRound },
        ].map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={`super-admin-sidebar-item ${isActive ? 'is-active' : ''}`.trim()}
              onClick={() => {
                if (item.id === 'notifications') {
                  goToBranchSection('notifications')
                  return
                }

                goToBranchSection(item.id)
              }}
            >
              <span className="super-admin-sidebar-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={2.15} />
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="super-admin-sidebar-footer">
        <div className="super-admin-sidebar-profile-card">
          <SidebarUserAvatar />

          <div className="super-admin-sidebar-profile-copy">
            <strong>{branchTitle}</strong>
          </div>

          <button
            type="button"
            className="super-admin-sidebar-logout-button"
            onClick={openLogoutConfirm}
            aria-label="Logout"
          >
            <LogOut size={22} strokeWidth={2.15} />
          </button>
        </div>
      </div>
    </aside>
  )

  const renderTopbar = () => (
    <header className="super-admin-topbar">
      <div className="branch-dashboard-topbar-title">
        <h1>Branch Dashboard</h1>
      </div>
      <div className="super-admin-topbar-right">
        {!embeddedMode ? (
          <div ref={notificationMenuRef} className="notification-menu branch-dashboard-notification-menu">
            <button
              type="button"
              className="icon-chip notification-chip branch-dashboard-notification-button"
              aria-label="Notifications"
              aria-haspopup="menu"
              aria-expanded={isNotificationMenuOpen}
              onClick={() => setIsNotificationMenuOpen((current) => !current)}
            >
              <Bell size={20} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              <b>{branchUnreadNotificationCount}</b>
            </button>

            {isNotificationMenuOpen ? (
              <div className="notification-dropdown" role="menu" aria-label="Notifications">
                <div className="notification-dropdown-head">
                  <strong>Notifications</strong>
                  <div className="notification-dropdown-head-actions">
                    <button type="button" className="notification-mark-read" onClick={markAllBranchNotificationsAsRead}>
                      Mark all as read
                    </button>
                    <button
                      type="button"
                      className="notification-dropdown-close"
                      aria-label="Close notifications"
                      onClick={() => setIsNotificationMenuOpen(false)}
                    >
                      <X size={16} strokeWidth={2.4} aria-hidden="true" focusable="false" />
                    </button>
                  </div>
                </div>

                <div className="notification-dropdown-list">
                  {branchNotificationPreviewItems.length ? (
                    branchNotificationPreviewItems.map((item) => {
                      const Icon = item.icon
                      const isCourseEditRequest =
                        (item.kind === 'branch-course-edit-request' || item.kind === 'course-edit-request') &&
                        item.requestStatus !== 'accepted'

                      return (
                        <div
                          key={item.id}
                          className={`notification-dropdown-item ${item.unread ? 'is-highlighted' : 'is-muted'} ${isCourseEditRequest ? 'is-course-request' : ''
                            }`.trim()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                          role="button"
                          tabIndex={0}
                          onClick={() => openBranchNotificationTarget(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openBranchNotificationTarget(item)
                            }
                          }}
                        >
                          <span className={`notification-badge ${item.tone}`} aria-hidden="true">
                            <Icon size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                          </span>
              <div className="notification-copy">
                <p>{item.title}</p>
                <span>{item.message}</span>
                <small>{item.time}</small>
              </div>

                          <div
                            className="notification-dropdown-item-actions"
                            onMouseDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            {isCourseEditRequest ? (
                              <button
                                type="button"
                                className="notification-dropdown-accept"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()

                                  console.log('ACCEPT CLICKED')

                                  void acceptBranchCourseEditNotification(item)
                                }}
                              >
                                Accept
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="notification-dropdown-view"
                              onMouseDown={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClickCapture={(event) => event.stopPropagation()}
                              onClick={() => openBranchNotificationTarget(item)}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="notification-dropdown-item is-muted" role="presentation">
                      <span className="notification-badge blue" aria-hidden="true">
                        <Bell size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                      </span>
                      <div className="notification-copy">
                        <p>No notifications yet</p>
                        <small>Waiting for activity</small>
                      </div>
                    </div>
                  )}
                </div>

                <button className="notification-dropdown-footer" type="button" onClick={openBranchNotifications}>
                  View all notifications
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!embeddedMode && (
          <div ref={profileMenuRef} className="branch-dashboard-profile-menu-wrap">
            <button
              type="button"
              className="super-admin-profile branch-dashboard-profile-trigger"
              onClick={() => setIsProfileMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
            >
              <AvatarBadge />
              <div className="super-admin-profile-copy">
                <strong>{branchAdminDisplay}</strong>
              </div>
              <ChevronDown size={16} strokeWidth={2.2} className="branch-dashboard-profile-caret" aria-hidden="true" />
            </button>

            {isProfileMenuOpen ? (
              <div className="branch-dashboard-profile-menu" role="menu" aria-label="Branch profile menu">
                <button type="button" role="menuitem" className="branch-dashboard-profile-menu-item" onClick={openProfile}>
                  <CircleUserRound size={16} strokeWidth={2.1} />
                  <span>Profile</span>
                </button>

                {mustResetPassword ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="branch-dashboard-profile-menu-item"
                    onClick={openResetPassword}
                  >
                    <RefreshCcw size={16} strokeWidth={2.1} />
                    <span>Reset Password</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className="branch-dashboard-profile-menu-item"
                    onClick={openForgotPassword}
                  >
                    <RefreshCcw size={16} strokeWidth={2.1} />
                    <span>Forgot Password</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  className="branch-dashboard-profile-menu-item is-danger"
                  onClick={openLogoutConfirm}
                >
                  <LogOut size={16} strokeWidth={2.1} />
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  )

  return (
    <section className="super-admin-page">
      <div className="super-admin-shell">
        {renderSidebar()}

        <div className="super-admin-main">
          {renderTopbar()}

          <main className="super-admin-content">
            <div className="branch-dashboard-content">
              {activeSection === 'dashboard' ? (
                <>
                  <div className="branch-dashboard-overview-intro">
                    <h1>Dashboard</h1>
                    <p>Welcome back! Here&apos;s an overview of your operations and today&apos;s activities.</p>
                  </div>

                  {!embeddedMode && mustResetPassword ? (
                    <section className="branch-dashboard-password-alert" aria-live="polite">
                      <div className="branch-dashboard-password-alert-copy">
                        <strong>Temporary password still active</strong>
                        <p>
                          You have not reset your temporary password yet. Please reset it now to secure your branch dashboard account.
                        </p>
                      </div>
                      <Button type="button" onClick={openResetPassword}>
                        Reset Password
                      </Button>
                    </section>
                  ) : null}
                

                  <div className="branch-dashboard-stats" data-layout="overview-payments-summary" style={{ marginBottom: '20px' }}>
                    {overviewStats.map((stat) => (
                      <article key={stat.label} className="branch-dashboard-stat-card">
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                        <small>{stat.note}</small>
                      </article>
                    ))}
                  </div>

                </>
              ) : null}

              {activeSection === 'notifications' ? (
                <section className="notifications-page branch-notifications-page">
                  <header className="notifications-page-header">
                    <div className="notifications-page-copy">
                      <p className="eyebrow">Notifications</p>
                      <h2>Notifications</h2>
                      <p>
                        You have <strong>{branchNotificationTotalCount}</strong> notifications to go through
                        {branchPageUnreadNotificationCount ? (
                          <span> and {branchPageUnreadNotificationCount} unread items</span>
                        ) : null}{' '}
                        for {branchTitle}.
                      </p>
                    </div>

                    <div className="notifications-page-actions">
                      <button
                        type="button"
                        className="notifications-back-button"
                        onClick={() => goToBranchSection('dashboard')}
                      >
                        <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                        Back to dashboard
                      </button>

                      <button type="button" className="notifications-mark-read" onClick={markAllBranchNotificationsAsRead}>
                        <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                        Mark all as read
                      </button>
                    </div>
                  </header>

                  <div className="notifications-feed">
                    {branchNotificationSections.length ? (
                      branchNotificationSections.map((section) => (
                        <BranchNotificationGroup
                          key={section.label}
                          label={section.label}
                          items={section.items}
                          onView={openBranchNotificationTarget}
                          onAcceptRequest={acceptBranchCourseEditNotification}
                          showDetails
                        />
                      ))
                    ) : (
                      <div className="notifications-empty-state">
                        <span className="notifications-empty-state-icon" aria-hidden="true">
                          <Bell size={22} strokeWidth={2.2} />
                        </span>
                        <div>
                          <h3>No notifications yet</h3>
                          <p>Branch login and faculty activity updates will appear here automatically.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {activeSection === 'students' ? (
                <BranchDashboardSection
                  title="Students"
                  description="Manage student registrations for this branch."
                  actions={(
                    <>
                      <button
                        type="button"
                        className="button button-solid"
                        onClick={openAddStudentForm}
                      >
                        + Add Student
                      </button>
                      <div className="branch-dashboard-section-summary">
                        <span>Total students:</span>
                        <strong>{totalBranchStudents}</strong>
                      </div>
                    </>
                  )}
                >
                  <div className="faculty-search-filter-bar" style={{ marginBottom: '16px' }}>
                    <div
                      className="faculty-search-wrapper"
                      style={{
                        display: 'flex',
                        gap: '8px',
                        width: '370px',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search Student"
                        value={studentSearchTerm}
                        onChange={(e) => {
                          setStudentSearchTerm(e.target.value);
                          setStudentPage(1);
                        }}
                        className="faculty-search-input"
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      />

                      <button
                        type="button"
                        className="button button-solid"
                        style={{
                          height: '46px',
                          padding: '0 20px',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        Search
                      </button>
                    </div>
                  </div>

<div className="branch-course-table-shell branch-students-table-shell">
  <table className="branch-course-table">
    <thead>
      <tr>
        <th>Student ID</th>
        <th>Student Name</th>
        <th>Course</th>
        <th>Total Fee</th>
        <th>Paid</th>
        <th>Course Progress</th>
        <th>Next Installment</th>
        <th>Due Date</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>

    <tbody>
      {visibleBranchStudents.length ? (
        visibleBranchStudents.map((stu) => {

          // -----------------------------
          // Installments (correct field: installmentSchedule)
          // -----------------------------
          const installments = Array.isArray(stu.installmentSchedule)
            ? stu.installmentSchedule
            : []

          const totalFee = Number(
            stu.finalFee ?? stu.courseAmount ?? stu.totalAmount ?? stu.afterDiscount ?? 0
          )

          const paidAmount = installments.length
            ? installments.reduce(
                (sum, inst) => sum + Number(inst.paidAmount ?? inst.amountPaid ?? 0),
                0,
              )
            : Number(stu.paidAmount ?? stu.totalPaid ?? stu.amountPaid ?? 0)

          const installmentProgress = getBranchStudentInstallmentProgress(stu)

          const nextInstallment = installments.find((installment) => {
            const installmentAmount = Number(installment.amount ?? installment.installmentAmount ?? 0)
            const installmentPaid = Number(installment.paidAmount ?? installment.amountPaid ?? 0)
            return installmentPaid < installmentAmount
          })

          const nextInstallmentAmount = nextInstallment
            ? Math.max(
                Number(nextInstallment.amount ?? nextInstallment.installmentAmount ?? 0) -
                  Number(nextInstallment.paidAmount ?? nextInstallment.amountPaid ?? 0),
                0,
              )
            : 0

          const nextDueDate = nextInstallment?.dueDate ?? nextInstallment?.date ?? null

// -----------------------------
// Payment Status
// Completed / Partial / Overdue / Upcoming
// -----------------------------
let paymentStatus

const allInstallmentsPaid =
  installments.length > 0 &&
  installments.every((inst) => {
    const amount = Number(
      inst.amount ??
      inst.installmentAmount ??
      0
    )

    const paid = Number(
      inst.paidAmount ??
      inst.amountPaid ??
      0
    )

    return paid >= amount
  })

// Check if any installment is partially paid
const hasPartialInstallment =
  installments.length > 0 &&
  installments.some((inst) => {
    const amount = Number(
      inst.amount ??
      inst.installmentAmount ??
      0
    )

    const paid = Number(
      inst.paidAmount ??
      inst.amountPaid ??
      0
    )

    return paid > 0 && paid < amount
  })

// Get today's date
const today = new Date()
today.setHours(0, 0, 0, 0)

// Get next due date
const dueDate = nextDueDate
  ? new Date(nextDueDate)
  : null

if (dueDate) {
  dueDate.setHours(0, 0, 0, 0)
}

// -------------------------------------------------
// 1. COMPLETED
// -------------------------------------------------
if (
  allInstallmentsPaid ||
  (totalFee > 0 && paidAmount >= totalFee)
) {
  paymentStatus = 'Completed'
}

// -------------------------------------------------
// 2. OVERDUE
// Pending amount + due date passed
// -------------------------------------------------
else if (
  nextDueDate &&
  dueDate &&
  !Number.isNaN(dueDate.getTime()) &&
  dueDate < today
) {
  paymentStatus = 'Overdue'
}

// -------------------------------------------------
// 3. PARTIAL
// Some amount paid, but full installment not paid
// -------------------------------------------------
else if (hasPartialInstallment) {
  paymentStatus = 'Partial'
}

// -------------------------------------------------
// 4. UPCOMING
// Pending payment + due date is today/future
// -------------------------------------------------
else {
  paymentStatus = 'Upcoming'
}

          const formatFee = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`

          const formatDueDate = (date) => {
            if (!date) return '-'
            const parsedDate = new Date(date)
            if (Number.isNaN(parsedDate.getTime())) return '-'
            return parsedDate.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          }

          return (
            <tr
              key={stu.studentId}
              className="branch-student-row"
              role="button"
              tabIndex={0}
              aria-label={`View details for ${stu.studentName || stu.studentId || 'student'}`}
              onClick={() => openStudentViewDrawer(stu)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openStudentViewDrawer(stu)
                }
              }}
            >
              <td><strong>{stu.studentId || '-'}</strong></td>
              <td><strong className="branch-course-name">{stu.studentName || '-'}</strong></td>
              <td>
                <span className="branch-student-course">
                  {stu.courseName || stu.courseInterested || stu.course?.name || '-'}
                </span>
              </td>
              <td><strong>{formatFee(totalFee)}</strong></td>
              <td>
                <div className="branch-student-paid-cell">
                  <span className="branch-student-paid-amount">{formatFee(paidAmount)}</span>
                  <div className="branch-student-paid-progress">
                    <div className="branch-student-paid-progress-bar" aria-hidden="true">
                      <span
                        className="branch-student-paid-progress-fill"
                        style={{ width: `${installmentProgress.paidInstallmentPercentage}%` }}
                      />
                    </div>
                    <span className="branch-student-paid-progress-label">
                      {formatBranchPercentage(installmentProgress.paidInstallmentPercentage)}% Paid
                    </span>
                  </div>
                </div>
              </td>
              <td>
                {(() => {
                  const studentKeys = getBranchStudentLookupKeys(stu)
                  const resolvedCourse = resolveBranchStudentCourse(stu, branchCourseCards)
                  const matchedEntry = branchTodayWorkEntriesByStudent.get(studentKeys[0]) || null
                  const effectiveCourse = resolvedCourse || (matchedEntry
                    ? branchCourseCards.find((item) => String(item?.id || '').trim() === String(matchedEntry?.courseId || '').trim()) || null
                    : null)
                  const directCourseProgressSummary = effectiveCourse
                    ? buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, effectiveCourse, stu)
                    : null
                  const directCourseProgress = Number(directCourseProgressSummary?.courseProgress)
                  const storedCourseProgress = Number(
                    stu?.courseProgress ??
                    stu?.courseCompletionPercentage ??
                    stu?.progress ??
                    NaN,
                  )
                  const fallbackCourseProgress = studentKeys
                    .map((key) =>
                      branchStudentCourseProgressByKey.get(key) ??
                      branchStudentProgressByNotificationKey.get(key),
                    )
                    .find((value) => Number.isFinite(value))
                  const studentCourseProgress =
                    Number.isFinite(storedCourseProgress)
                      ? Math.min(100, Math.max(0, storedCourseProgress))
                      : Number.isFinite(directCourseProgress)
                        ? Math.min(100, Math.max(0, directCourseProgress))
                        : (Number.isFinite(fallbackCourseProgress) ? Math.min(100, Math.max(0, fallbackCourseProgress)) : null)
                  const hasCourseProgress = Number.isFinite(studentCourseProgress)

                  return hasCourseProgress ? (
                    <div className="branch-student-paid-cell">
                      <span className="branch-student-course-progress-amount">
                        {formatBranchPercentage(studentCourseProgress)}%
                      </span>
                      <div className="branch-student-paid-progress">
                        <div className="branch-student-course-progress-bar" aria-hidden="true">
                          <span
                            className="branch-student-course-progress-fill"
                            style={{ width: `${studentCourseProgress}%` }}
                          />
                        </div>
                        <span className="branch-student-paid-progress-label">
                          {formatBranchPercentage(studentCourseProgress)}% Complete
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="faculty-today-work-empty-label">-</span>
                  )
                })()}
              </td>
              <td>
                {nextInstallment ? (
                  <div className="branch-next-installment">
                    <strong>{formatFee(nextInstallmentAmount)}</strong>
                    <span>
                      Installment {nextInstallment.installmentNumber || nextInstallment.number || ''}
                    </span>
                  </div>
                ) : (
                  <span className="branch-no-installment">-</span>
                )}
              </td>
              <td>
                <span className="branch-student-due-date">
                  {formatDueDate(nextDueDate)}
                </span>
              </td>
              <td>
                <span
                  className={`branch-student-payment-status ${paymentStatus
                    .toLowerCase()
                    .replace(/\s+/g, '-')}`}
                >
                  {paymentStatus}
                </span>
              </td>

              {/* Action */}
              <td style={{ textAlign: 'center' }}>
                <div
                  className={`branch-student-actions-cell ${studentActionMenuId === stu.studentId ? 'menu-open' : ''}`}
                >
                  <button
                    type="button"
                    className="branch-student-more-btn"
                    aria-label="Student actions"
                    aria-haspopup="menu"
                    aria-expanded={studentActionMenuId === stu.studentId}
                    onMouseEnter={(e) => {
                      enterStudentActionMenuArea()
                      openStudentActionMenu(e.currentTarget)
                      setStudentActionMenuId(stu.studentId)
                    }}
                    onMouseLeave={() => {
                      leaveStudentActionMenuArea()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (studentActionMenuId === stu.studentId) {
                        if (studentActionMenuCloseTimerRef.current) {
                          clearTimeout(studentActionMenuCloseTimerRef.current)
                        }
                        setStudentActionMenuId('')
                        setStudentActionMenuPosition({ top: 0, left: 0 })
                      } else {
                        if (studentActionMenuCloseTimerRef.current) {
                          clearTimeout(studentActionMenuCloseTimerRef.current)
                        }
                        setStudentActionMenuId(stu.studentId)
                        openStudentActionMenu(e.currentTarget)
                      }
                    }}
                  >
                    <span className="branch-student-more-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </button>

                </div>
                {studentActionMenuId === stu.studentId && studentActionMenuPosition && typeof document !== 'undefined'
                  ? createPortal(
                    <div
                      ref={studentActionMenuRef}
                      className="branch-student-actions-menu"
                      role="menu"
                      aria-label="Student actions"
                      style={{
                        position: 'fixed',
                        top: `${studentActionMenuPosition.top}px`,
                        left: `${studentActionMenuPosition.left}px`,
                        zIndex: 999999,
                      display: 'block',
                      }}
                      onMouseEnter={() => {
                        enterStudentActionMenuArea()
                      }}
                      onMouseLeave={() => {
                        leaveStudentActionMenuArea()
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setStudentActionMenuId('')
                          setStudentActionMenuPosition({ top: 0, left: 0 })
                          openStudentViewDrawer(stu)
                        }}
                      >
                        <Eye size={15} />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setStudentActionMenuId('')
                          setStudentActionMenuPosition({ top: 0, left: 0 })
                          openEditStudentForm({ ...stu })
                        }}
                      >
                        <Pencil size={15} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setStudentActionMenuId('')
                          setStudentActionMenuPosition({ top: 0, left: 0 })
                          openRecordPaymentConfirmation(stu)
                        }}
                      >
                        <Wallet size={15} />
                        <span>Record Payment</span>
                      </button>

                      <button
                        type="button"
                        className="is-danger"
                        role="menuitem"
                        onClick={() => {
                          setStudentActionMenuId('')
                          setStudentActionMenuPosition({ top: 0, left: 0 })
                          setStudentDeleteTarget({ ...stu })
                        }}
                      >
                        <Trash2 size={15} />
                        <span>Delete</span>
                      </button>
                    </div>,
                    document.body,
                  )
                  : null}
              </td>
            </tr>
          )
        })
      ) : (
        <tr>
          <td colSpan="10" className="branch-course-empty-state">
            No students yet. Use + Add Student to add the first one.
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>
                  {filteredBranchStudents.length > BRANCH_STUDENTS_PER_PAGE ? (
                    <div className="branch-course-pagination">
                      <button
                        type="button"
                        className="branch-course-pagination-button"
                        onClick={() => setStudentPage((c) => Math.max(1, c - 1))}
                        disabled={safeStudentPage === 1}
                      >
                        Prev
                      </button>
                      <div className="branch-course-pagination-pages" role="navigation" aria-label="Student pagination">
                        {Array.from({ length: totalStudentPages }, (_, i) => i + 1).map((pg) => (
                          <button
                            key={pg}
                            type="button"
                            className={`branch-course-pagination-page ${pg === safeStudentPage ? 'is-active' : ''}`.trim()}
                            onClick={() => setStudentPage(pg)}
                            aria-current={pg === safeStudentPage ? 'page' : undefined}
                          >
                            {pg}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="branch-course-pagination-button"
                        onClick={() => setStudentPage((c) => Math.min(totalStudentPages, c + 1))}
                        disabled={safeStudentPage === totalStudentPages}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'courses' ? (
                <BranchDashboardSection
                  title="Courses"
                  description="Add a course and the saved data will appear in the table below with every field from the form."
                  actions={(
                    <>
                      <button
                        type="button"
                        className="button button-solid"
                        onClick={openAddCourseModal}
                      >
                        + Add Course
                      </button>

                      <div className="branch-dashboard-section-summary">
                        <span>Saved courses:</span>
                        <strong>{filteredBranchCourseCards.length}</strong>
                      </div>
                    </>
                  )}
                >
                  <div className="faculty-search-filter-bar" style={{ marginBottom: '16px' }}>
                    <div
                      className="faculty-search-wrapper"
                      style={{
                        display: 'flex',
                        gap: '8px',
                        width: '370px',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search Courses"
                        value={courseSearchTerm}
                        onChange={(e) => setCourseSearchTerm(e.target.value)}
                        className="faculty-search-input"
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      />

                      <button
                        type="button"
                        className="button button-solid"
                        style={{
                          height: '46px',
                          padding: '0 20px',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        Search
                      </button>
                    </div>
                  </div>
                  <div className="branch-course-table-shell branch-courses-table-shell">
                    <table className="branch-course-table">
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Course Code</th>
                          <th>Course Name</th>
                          {/* <th>Mode</th>
                          <th>Duration</th>
                          <th>Hours</th> */}
                          {/* <th>Standard Fee</th>
                          <th>Registration Fee</th>
                          <th>Discount</th> */}
                          <th>Final Fee</th>

                          <th>Faculty</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleBranchCourses.length ? (
                          visibleBranchCourses.map((course, index) => {
                            const normalizedStatus = String(course.status || 'Active').toLowerCase()
                            const absoluteIndex = (safeBranchCoursePage - 1) * BRANCH_COURSES_PER_PAGE + index + 1

                            return (
                              <tr
                                key={course.id}
                                onClick={() => openViewCourseDrawer(course)}
                                className="branch-course-clickable-row"
                              >
                                <td>{absoluteIndex}</td>
                                <td>
                                  <div className="branch-course-code-cell">
                                    <strong>{course.courseCode || '-'}</strong>
                                  </div>
                                </td>
                                <td>
                                  <strong className="branch-course-name">{course.name || '-'}</strong>
                                </td>
                                {/* <td>{course.mode || '-'}</td>
                                <td>{course.duration ? `${course.duration} month${course.duration === '1' ? '' : 's'}` : '-'}</td>
                                <td>{course.hours ? `${course.hours} hour${course.hours === '1' ? '' : 's'}` : '-'}</td> */}
                                {/* <td>{formatBranchCourseAmount(course.actualFees)}</td>
                                <td>{formatBranchCourseAmount(course.registrationFees)}</td>
                                <td>{formatBranchCourseAmount(course.discount || '0')}</td> */}
                                <td>{formatBranchCourseFinalFee(course)}</td>

                                <td>
                                  <span className="branch-course-faculty-cell">
                                    {Array.isArray(course.assignedFaculty) && course.assignedFaculty.length > 0 ? (
                                      <span className="branch-course-faculty-summary">
                                        <span className="branch-course-faculty-primary">
                                          {course.assignedFaculty[0]?.name}
                                        </span>

                                        {course.assignedFaculty.length > 1 ? (
                                          <span className="branch-course-faculty-more-wrap">
                                            <button
                                              type="button"
                                              className="branch-course-faculty-more"
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              +{course.assignedFaculty.length - 1}
                                            </button>

                                            <span className="branch-course-faculty-tooltip">
                                              {course.assignedFaculty.slice(1).map((faculty) => (
                                                <span key={faculty.id} className="branch-course-faculty-tooltip-item">
                                                  {faculty.name}
                                                </span>
                                              ))}
                                            </span>
                                          </span>
                                        ) : null}
                                      </span>
                                    ) : (
                                      'Not Assigned'
                                    )}
                                  </span>
                                </td>
                                <td>
                                  <span className={`branch-course-status-pill ${normalizedStatus}`.trim()}>
                                    {course.status || 'Active'}
                                  </span>
                                </td>
                                <td onClick={(event) => event.stopPropagation()}>
                                  <div className="branch-course-actions-wrap">
                                    <button
                                      type="button"
                                      className="branch-course-actions-button"
                                      aria-label={`Course actions for ${course.name || course.courseCode || 'course'}`}
                                      aria-haspopup="menu"
                                      aria-expanded={openCourseActionMenuId === course.id}
                                      onMouseEnter={(e) => {
                                        if (courseActionCloseTimer.current) {
                                          clearTimeout(courseActionCloseTimer.current)
                                        }
                                        setOpenCourseActionMenuId(course.id)
                                        openCourseActionMenu(e.currentTarget)
                                      }}
                                      onMouseLeave={() => {
                                        courseActionCloseTimer.current = setTimeout(() => {
                                          setOpenCourseActionMenuId('')
                                          setCourseActionMenuPosition({ top: 0, left: 0 })
                                        }, 200)
                                      }}
                                      onClick={(e) => {
                                        if (openCourseActionMenuId === course.id) {
                                          setOpenCourseActionMenuId('')
                                          setCourseActionMenuPosition({ top: 0, left: 0 })
                                        } else {
                                          setOpenCourseActionMenuId(course.id)
                                          openCourseActionMenu(e.currentTarget)
                                        }
                                      }}
                                    >
                                      <MoreVertical size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                                    </button>

                                    {openCourseActionMenuId === course.id && courseActionMenuPosition && typeof document !== 'undefined'
                                      ? createPortal(
                                        <div
                                          className="branch-course-actions-menu"
                                          role="menu"
                                          aria-label="Course actions"
                                          style={{
                                            position: 'fixed',
                                            top: `${courseActionMenuPosition.top}px`,
                                            left: `${courseActionMenuPosition.left}px`,
                                            zIndex: 999999,
                                          }}
                                          onMouseEnter={() => {
                                            if (courseActionCloseTimer.current) {
                                              clearTimeout(courseActionCloseTimer.current)
                                            }
                                          }}
                                          onMouseLeave={() => {
                                            courseActionCloseTimer.current = setTimeout(() => {
                                              setOpenCourseActionMenuId('')
                                              setCourseActionMenuPosition({ top: 0, left: 0 })
                                            }, 200)
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            className="branch-course-actions-menu-item"
                                            onClick={() => {
                                              openViewCourseDrawer(course);
                                              setOpenCourseActionMenuId('');
                                              setCourseActionMenuPosition({ top: 0, left: 0 });
                                            }}
                                            role="menuitem"
                                          >
                                            <Eye size={16} />
                                            <span>View</span>
                                          </button>

                                          <button
                                            type="button"
                                            className="branch-course-actions-menu-item"
                                            onClick={() => {
                                              openAssignFacultyModal(course);
                                              setOpenCourseActionMenuId('');
                                              setCourseActionMenuPosition({ top: 0, left: 0 });
                                            }}
                                            role="menuitem"
                                          >
                                            <UserPlus size={16} />
                                            <span>Assign</span>
                                          </button>

                                          <button
                                            type="button"
                                            className="branch-course-actions-menu-item"
                                            onClick={() => {
                                              openEditCourseModal(course);
                                              setOpenCourseActionMenuId('');
                                              setCourseActionMenuPosition({ top: 0, left: 0 });
                                            }}
                                            role="menuitem"
                                          >
                                            <Pencil size={16} />
                                            <span>Edit</span>
                                          </button>

                                          <button
                                            type="button"
                                            className="branch-course-actions-menu-item is-danger"
                                            onClick={() => {
                                              openDeleteCourseConfirm(course);
                                              setOpenCourseActionMenuId('');
                                              setCourseActionMenuPosition({ top: 0, left: 0 });
                                            }}
                                            role="menuitem"
                                          >
                                            <Trash2 size={16} />
                                            <span>Delete</span>
                                          </button>
                                        </div>,
                                        document.body
                                      )
                                      : null}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan="7" className="branch-course-empty-state">
                              No courses saved yet. Use Add Course to create the first one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {branchCourseCards.length > BRANCH_COURSES_PER_PAGE ? (
                    <div className="branch-course-pagination">
                      <button
                        type="button"
                        className="branch-course-pagination-button"
                        onClick={() => setBranchCoursePage((current) => Math.max(1, current - 1))}
                        disabled={safeBranchCoursePage === 1}
                      >
                        Prev
                      </button>

                      <div className="branch-course-pagination-pages" role="navigation" aria-label="Course pagination">
                        {Array.from({ length: totalBranchCoursePages }, (_, index) => index + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            className={`branch-course-pagination-page ${page === safeBranchCoursePage ? 'is-active' : ''}`.trim()}
                            onClick={() => setBranchCoursePage(page)}
                            aria-current={page === safeBranchCoursePage ? 'page' : undefined}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="branch-course-pagination-button"
                        onClick={() => setBranchCoursePage((current) => Math.min(totalBranchCoursePages, current + 1))}
                        disabled={safeBranchCoursePage === totalBranchCoursePages}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </BranchDashboardSection>
              ) : null}

{activeSection === 'installments' ? (
  <BranchInstallmentTemplatesPage />
) : null}

{activeSection === 'batches' ? (
  <BranchBatchManagementSection
    branchId={branchProfile?.id || branchProfile?.branchId || branchData?.id || branchData?.branchId || ''}
    branchCourses={branchCourseCards}
    branchFacultyRecords={branchFacultyRecords}
    facultyList={facultyList}
    branchStudents={branchStudents}
  />
) : null}

{activeSection === 'payments' ? (

  recordPaymentStudent ? (

    // =====================================================
    // RECORD PAYMENT
    // =====================================================

    <BranchDashboardSection
      title="Record Payment"
      description={
        recordPaymentStudent?.studentName
          ? `Recording payment for ${recordPaymentStudent.studentName}.`
          : 'Enter the student ID to load payment details.'
      }
      actions={(
        <button
          type="button"
          className="button button-ghost"
          onClick={resetPaymentsView}
        >
          <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
          Back to Payments
        </button>
      )}
    >
      <RecordPayment
        student={recordPaymentStudent}
        students={branchStudents}
        branchProfile={branchProfile}
        onClose={() => {
          resetPaymentsView();
          void reloadBranchStudents();
        }}
      />
    </BranchDashboardSection>

  ) : showPaymentHistory ? (

    // =====================================================
    // FULL PAYMENT HISTORY
    // =====================================================

    <BranchDashboardSection
      title="Payment History"
      description="View and manage all student payment transactions."
      actions={(
        <button
          type="button"
          className="button button-ghost"
          style={{
            marginRight: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
          onClick={() => setShowPaymentHistory(false)}
        >
          <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
          Back to Payments
        </button>
      )}
    >

      <div className="payment-history-page">

        {/* =====================================================
            SEARCH + FILTERS
        ===================================================== */}

        <div
          className="faculty-search-filter-bar"
          style={{
            marginBottom: '18px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >

          {/* SEARCH */}
          <div
            className="faculty-search-wrapper"
            style={{
              display: 'flex',
              gap: '8px',
              width: '320px',
            }}
          >
            <input
              type="text"
              placeholder="Search student, ID or course"
              value={paymentHistorySearch}
              onChange={(e) =>
                setPaymentHistorySearch(e.target.value)
              }
              className="faculty-search-input"
              style={{
                flex: 1,
                minWidth: 0,
              }}
            />
          </div>

          {/* DATE */}
          <input
            type="date"
            value={paymentHistoryDate}
            onChange={(e) =>
              setPaymentHistoryDate(e.target.value)
            }
            style={{
              height: '46px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
            }}
          />

          <select
            value={paymentModeFilter}
            onChange={(e) => {
              setPaymentModeFilter(e.target.value)
              setPaymentHistoryPage(1)
            }}
            style={{
              height: '46px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              minWidth: '180px',
              backgroundColor: '#fff',
            }}
          >
            {paymentModeFilterOptions.map((mode) => (
              <option key={mode} value={mode}>
                {mode === 'all' ? 'All Payment Modes' : mode}
              </option>
            ))}
          </select>

        </div>

        {activePaymentHistoryActionRecord && paymentHistoryActionMenuId && typeof document !== 'undefined'
          ? createPortal(
            <div
              ref={paymentHistoryActionMenuRef}
              className="payment-history-actions-menu"
              role="menu"
              aria-label="Payment actions"
              style={{
                position: 'fixed',
                top: `${paymentHistoryActionMenuPosition.top}px`,
                left: `${paymentHistoryActionMenuPosition.left}px`,
                zIndex: 999999,
                display: 'block',
              }}
              onMouseEnter={() => {
                if (paymentHistoryActionCloseTimerRef.current) {
                  clearTimeout(paymentHistoryActionCloseTimerRef.current)
                }
              }}
              onMouseLeave={() => {
                paymentHistoryActionCloseTimerRef.current = setTimeout(() => {
                  setPaymentHistoryActionMenuId('')
                  setPaymentHistoryActionMenuPosition({ top: 0, left: 0 })
                }, 180)
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="payment-history-actions-menu-item"
                role="menuitem"
                onClick={() => {
                  setPaymentHistoryActionMenuId('')
                  setPaymentHistoryActionMenuPosition({ top: 0, left: 0 })
                  setSelectedPaymentHistory(activePaymentHistoryActionRecord)
                }}
              >
                View
              </button>
              <button
                type="button"
                className="payment-history-actions-menu-item"
                role="menuitem"
                onClick={(event) => {
                  setPaymentHistoryActionMenuId('')
                  setPaymentHistoryActionMenuPosition({ top: 0, left: 0 })
                  handleOpenBranchLedger(event, activePaymentHistoryActionRecord)
                }}
              >
                Ledger
              </button>
            </div>,
            document.body,
          )
          : null}


        {/* =====================================================
            QUICK FILTERS
        ===================================================== */}

        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '24px',
          }}
        >

          {[
            ['all', 'All'],
            ['today', 'Today'],
            ['week', 'This Week'],
          ].map(([value, label]) => (

            <button
              key={value}
              type="button"
              className={
                paymentHistoryFilter === value
                  ? 'button button-solid'
                  : 'button button-ghost'
              }
              onClick={() =>
                setPaymentHistoryFilter(value)
              }
            >
              {label}
            </button>

          ))}

        </div>


        {/* =====================================================
            PAYMENT HISTORY TABLE
        ===================================================== */}

        <div className="branch-course-table-shell">

          <table className="branch-course-table">

            <thead>
              <tr>
                <th>Student ID</th>
                <th>Student</th>
                <th>Course</th>
                <th>Amount</th>
                <th>Payment Mode</th>
                <th>Payment Date</th>
                {/* <th>Receipt</th> */}
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {visiblePaymentHistoryRecords.length ? (
                visiblePaymentHistoryRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.studentId}</strong>
                    </td>
                    <td>
                      <strong className="branch-course-name">
                        {record.studentName}
                      </strong>
                    </td>
                    <td>{record.course}</td>
                    <td>
                      <strong>
                        {formatBranchRupees(record.amount)}
                      </strong>
                    </td>
                    <td>{formatBranchPaymentMode(record)}</td>
                    <td>{record.date}</td>

                    <td>
                      <div
                        className={`payment-history-actions-cell ${paymentHistoryActionMenuId === record.id ? 'menu-open' : ''}`.trim()}
                      >
                        <button
                          type="button"
                          className="payment-history-more-btn"
                          onMouseEnter={(event) => {
                            if (paymentHistoryActionCloseTimerRef.current) {
                              clearTimeout(paymentHistoryActionCloseTimerRef.current)
                            }
                            if (paymentHistoryActionMenuId !== record.id) {
                              openPaymentHistoryActionMenu(record, event.currentTarget)
                            }
                          }}
                          onMouseLeave={() => {
                            paymentHistoryActionCloseTimerRef.current = setTimeout(() => {
                              setPaymentHistoryActionMenuId('')
                              setPaymentHistoryActionMenuPosition({ top: 0, left: 0 })
                            }, 180)
                          }}
                          onClick={(event) =>
                            {
                              if (paymentHistoryActionMenuId === record.id) {
                                if (paymentHistoryActionCloseTimerRef.current) {
                                  clearTimeout(paymentHistoryActionCloseTimerRef.current)
                                }
                                setPaymentHistoryActionMenuId('')
                                setPaymentHistoryActionMenuPosition({ top: 0, left: 0 })
                                return
                              }

                              openPaymentHistoryActionMenu(record, event.currentTarget)
                            }
                          }
                          aria-label="Open payment actions"
                          aria-haspopup="menu"
                          aria-expanded={paymentHistoryActionMenuId === record.id}
                        >
                          <span className="payment-history-more-dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="branch-course-empty-state"
                  >
                    No payment history found.
                  </td>
                </tr>
              )}
            </tbody>

          </table>

        </div>

        {totalPaymentHistoryPages > 1 && (
          <div
            className="branch-course-pagination"
            style={{ marginTop: '18px' }}
          >
            <button
              type="button"
              className="button button-ghost branch-course-pagination-button"
              onClick={() =>
                setPaymentHistoryPage((page) =>
                  Math.max(1, page - 1)
                )
              }
              disabled={safePaymentHistoryPage === 1}
            >
              Previous
            </button>

            <div className="branch-course-pagination-pages">
              {Array.from(
                { length: totalPaymentHistoryPages },
                (_, index) => index + 1
              ).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`branch-course-pagination-page ${
                    page === safePaymentHistoryPage ? 'active' : ''
                  }`}
                  onClick={() => setPaymentHistoryPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="button button-ghost branch-course-pagination-button"
              onClick={() =>
                setPaymentHistoryPage((page) =>
                  Math.min(totalPaymentHistoryPages, page + 1)
                )
              }
              disabled={
                safePaymentHistoryPage === totalPaymentHistoryPages
              }
            >
              Next
            </button>
          </div>
        )}


        {/* =====================================================
            PAYMENT DETAILS POPUP
        ===================================================== */}

        {selectedPaymentHistory && (

          <div className="payment-popup-overlay">

            <div
              className="payment-confirmation-popup"
              style={{
                maxWidth: '520px',
              }}
            >

              <button
                type="button"
                className="receipt-popup-close"
                onClick={() =>
                  setSelectedPaymentHistory(null)
                }
              >
                ×
              </button>

              <h3>
                Payment Details
              </h3>

              <div className="confirmation-details">

                <div className="confirmation-detail-row">
                  <span>Student ID</span>
                  <strong>
                    {selectedPaymentHistory.studentId}
                  </strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Student</span>
                  <strong>
                    {selectedPaymentHistory.studentName}
                  </strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Course</span>
                  <strong>
                    {selectedPaymentHistory.course}
                  </strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Amount</span>
                  <strong className="confirmation-amount">
                    {formatBranchRupees(
                      selectedPaymentHistory.amount
                    )}
                  </strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Payment Mode</span>
                  <strong>
                    {formatBranchPaymentMode(selectedPaymentHistory)}
                  </strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Payment Date</span>
                  <strong>
                    {selectedPaymentHistory.date}
                  </strong>
                </div>

              </div>

              <div
                className="payment-popup-actions"
                style={{
                  marginTop: '20px',
                }}
              >
                <button
                  type="button"
                  className="popup-cancel-btn"
                  onClick={() =>
                    setSelectedPaymentHistory(null)
                  }
                >
                  Close
                </button>
              </div>

            </div>

          </div>

        )}

        {ledgerStudent ? (typeof document !== 'undefined' ? createPortal((
          <div className="payment-popup-overlay">
            <div
              className="payment-confirmation-popup branch-ledger-popup"
              style={{
                maxWidth: '980px',
                width: 'min(980px, 96vw)',
              }}
            >
              <button
                type="button"
                className="receipt-popup-close"
                onClick={closeBranchLedger}
              >
                ×
              </button>

              <div className="branch-ledger-popup-header">
                <div>
                  <h3>Student Ledger</h3>
                  <p className="branch-ledger-popup-subtitle">
                    {ledgerStudent.studentName || '-'} · {ledgerStudent.studentId || '-'} · {
                      ledgerStudent.courseName ||
                      ledgerStudent.courseInterested ||
                      ledgerStudent.course?.name ||
                      '-'
                    }
                  </p>
                </div>

              </div>

              <div className="branch-ledger-summary-grid">
                <article className="branch-ledger-summary-card">
                  <span>Total Debit</span>
                  <strong>{formatBranchRupees(ledgerView.summary?.totalDebit ?? 0)}</strong>
                </article>
                <article className="branch-ledger-summary-card">
                  <span>Total Credit</span>
                  <strong>{formatBranchRupees(ledgerView.summary?.totalCredit ?? 0)}</strong>
                </article>
                <article className="branch-ledger-summary-card branch-ledger-summary-card-emphasis">
                  <span>Outstanding Balance</span>
                  <strong>{formatBranchRupees(ledgerView.summary?.outstandingBalance ?? 0)}</strong>
                </article>
                <article className="branch-ledger-summary-card">
                  <span>Entries</span>
                  <strong>{ledgerView.summary?.entryCount ?? ledgerView.entries.length ?? 0}</strong>
                </article>
              </div>

              {ledgerLoading ? (
                <div className="branch-ledger-loading">
                  Loading ledger...
                </div>
              ) : null}

              {ledgerError ? (
                <div className="branch-ledger-note">
                  {ledgerError}
                </div>
              ) : null}

              <div className="branch-ledger-table-shell">
                <table className="branch-ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerView.entries.length ? (
                      ledgerView.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{formatBranchPaymentDate(entry.dateRaw || entry.paymentDateRaw || entry.createdAt || entry.date)}</td>
                          <td>
                            <strong className="branch-course-name">
                              {entry.description || entry.payAgainst || entry.referenceType || '-'}
                            </strong>
                            {entry.paymentMode ? (
                              <div className="branch-ledger-note">
                                {entry.paymentMode}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <strong>
                              {Number(entry.debit || 0) > 0 ? formatBranchRupees(entry.debit) : '-'}
                            </strong>
                          </td>
                          <td>
                            <strong>
                              {Number(entry.credit || 0) > 0 ? formatBranchRupees(entry.credit) : '-'}
                            </strong>
                          </td>
                          <td>
                            <strong>
                              {formatBranchRupees(entry.runningBalance ?? entry.studentBalanceAfter ?? 0)}
                            </strong>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="branch-course-empty-state">
                          No ledger entries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="payment-popup-actions" style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="popup-cancel-btn"
                  onClick={closeBranchLedger}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ), document.body) : null) : null}

        {false && (
          <div className="payment-popup-overlay">
            <div
              className="payment-confirmation-popup"
              style={{
                maxWidth: '520px',
              }}
            >
              <button
                type="button"
                className="receipt-popup-close"
                onClick={() => setPendingRecordPaymentStudent(null)}
              >
                Ã—
              </button>

              <h3>Record Payment?</h3>

              <div className="confirmation-details">
                <div className="confirmation-detail-row">
                  <span>Student ID</span>
                  <strong>{pendingRecordPaymentStudent.studentId || '-'}</strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Student</span>
                  <strong>{pendingRecordPaymentStudent.studentName || '-'}</strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Course</span>
                  <strong>{pendingRecordPaymentStudent.courseName || pendingRecordPaymentStudent.courseInterested || pendingRecordPaymentStudent.course?.name || '-'}</strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Action</span>
                  <strong>Open Payments tab</strong>
                </div>
              </div>

              <div
                className="payment-popup-actions"
                style={{
                  marginTop: '20px',
                }}
              >
                <button
                  type="button"
                  className="popup-cancel-btn"
                  onClick={() => setPendingRecordPaymentStudent(null)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="button button-solid"
                  onClick={confirmRecordPayment}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </BranchDashboardSection>

  ) : (

    // =====================================================
    // MAIN PAYMENTS PAGE
    // =====================================================

    <BranchDashboardSection
      title="Payments"
      description="Track collections and pending dues across all students."
      actions={(
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >

          {/* TOTAL STUDENTS */}
          <div className="branch-dashboard-section-summary">
            <span>Total students:</span>
            <strong>
              {filteredBranchPaymentRows.length}
            </strong>
          </div>


          {/* RECORD PAYMENT */}
          <button
            type="button"
            className="button button-solid"
            onClick={() => {
              setShowPaymentHistory(false);
              setRecordPaymentStudent({});
            }}
          >
            Record Payment
          </button>


          {/* VIEW HISTORY */}
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setRecordPaymentStudent(null);
              setPaymentHistoryPage(1);
              setShowPaymentHistory(true);
            }}
          >
            View History
          </button>

        </div>
      )}
    >

      {/* =====================================================
          4 SUMMARY CARDS
      ===================================================== */}

      <div
        className="branch-dashboard-stats"
        data-layout="payments-summary"
        style={{
          marginBottom: '20px',
        }}
      >

        {/* PENDING PAYMENTS */}
        <article className="branch-dashboard-stat-card">

          <span>
            Pending Payments
          </span>

          <strong>
            {formatBranchCourseAmount(branchPaymentStats.totalPending ?? 0)}
          </strong>

          <small>
            Total pending amount
          </small>

        </article>

        {/* TODAY'S PAYMENTS */}
        <article className="branch-dashboard-stat-card">

          <span>
            Today's Payments
          </span>

          <strong>
            {formatBranchCourseAmount(todaysPaymentAmount ?? 0)}
          </strong>

          <small>
            Amount collected today
          </small>

        </article>

        {/* FULLY PAID */}
        <article className="branch-dashboard-stat-card">

          <span>
            Fully Paid
          </span>

          <strong>
            {branchPaymentStats.paidCount}
          </strong>

          <small>
            Students cleared in full
          </small>

        </article>

      </div>


      {/* =====================================================
          STUDENT PAYMENT SUMMARY FILTER
      ===================================================== */}

      <div
        className="faculty-search-filter-bar"
        style={{
          marginBottom: '16px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >

        <div
          className="faculty-search-wrapper"
          style={{
            display: 'flex',
            gap: '8px',
            width: '370px',
          }}
        >

          <input
            type="text"
            placeholder="Search by student, ID or course"
            value={paymentSearchTerm}
            onChange={(e) => {
              setPaymentSearchTerm(e.target.value);
              setPaymentPage(1);
            }}
            className="faculty-search-input"
            style={{
              flex: 1,
              minWidth: 0,
            }}
          />

        </div>


        <select
          value={paymentStatusFilter}
          onChange={(e) => {
            setPaymentStatusFilter(e.target.value);
            setPaymentPage(1);
          }}
          style={{
            height: '46px',
            padding: '0 12px',
            borderRadius: '8px',
          }}
        >

          <option value="all">
            All Statuses
          </option>

          <option value="completed">
            Completed
          </option>

          <option value="partially-paid">
            Partially Paid
          </option>

          <option value="pending">
            Pending
          </option>

        </select>

      </div>


      {/* =====================================================
          STUDENT PAYMENT SUMMARY TABLE
      ===================================================== */}

      <div className="branch-course-table-shell">

        <table className="branch-course-table">

          <thead>

            <tr>
              <th>Student ID</th>
              <th>Student Name</th>
              <th>Course</th>
              <th>Total Fee</th>
              <th>Paid</th>
              <th>Pending</th>
              <th>Next Installment</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>

          </thead>


          <tbody>

            {visibleBranchPaymentRows.length ? (

              visibleBranchPaymentRows.map(
                ({ student, summary }) => (

                  <tr key={student.studentId}>

                    <td>
                      <strong>
                        {student.studentId || '-'}
                      </strong>
                    </td>


                    <td>
                      <strong className="branch-course-name">
                        {student.studentName || '-'}
                      </strong>
                    </td>


                    <td>
                      <span className="branch-student-course">
                        {
                          student.courseName ||
                          student.courseInterested ||
                          student.course?.name ||
                          '-'
                        }
                      </span>
                    </td>


                    <td>
                      <strong>
                        {formatBranchRupees(
                          summary.totalFee
                        )}
                      </strong>
                    </td>


                    <td>
                      <span className="branch-student-paid">
                        {formatBranchRupees(
                          summary.paidAmount
                        )}
                      </span>
                    </td>


                    <td>
                      {formatBranchRupees(
                        summary.pendingAmount
                      )}
                    </td>


                    <td>

                      {summary.nextInstallment ? (

                        <div className="branch-next-installment">

                          <strong>
                            {formatBranchRupees(
                              summary.nextInstallmentAmount
                            )}
                          </strong>

                          <span>
                            Installment {
                              summary.nextInstallment
                                .installmentNumber ||
                              summary.nextInstallment.number ||
                              ''
                            }
                          </span>

                        </div>

                      ) : (

                        <span className="branch-no-installment">
                          -
                        </span>

                      )}

                    </td>


                    <td>

                      <span className="branch-student-due-date">
                        {formatBranchPaymentDate(
                          summary.nextDueDate
                        )}
                      </span>

                    </td>


                    <td>

                      <span
                        className={`branch-student-payment-status ${
                          summary.paymentStatus
                            .toLowerCase()
                            .replace(/\s+/g, '-')
                        }`}
                      >
                        {summary.paymentStatus}
                      </span>

                    </td>

                  </tr>

                )

              )

            ) : (

              <tr>

                <td
                  colSpan="9"
                  className="branch-course-empty-state"
                >
                  No payment records found.
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>


      {/* =====================================================
          PAGINATION
      ===================================================== */}

      {filteredBranchPaymentRows.length >
        BRANCH_PAYMENTS_PER_PAGE ? (

        <div className="branch-course-pagination">

          <button
            type="button"
            className="branch-course-pagination-button"
            onClick={() =>
              setPaymentPage((c) =>
                Math.max(1, c - 1)
              )
            }
            disabled={
              safePaymentPage === 1
            }
          >
            Prev
          </button>


          <div
            className="branch-course-pagination-pages"
            role="navigation"
            aria-label="Payment pagination"
          >

            {Array.from(
              {
                length: totalPaymentPages,
              },
              (_, i) => i + 1
            ).map((pg) => (

              <button
                key={pg}
                type="button"
                className={`branch-course-pagination-page ${
                  pg === safePaymentPage
                    ? 'is-active'
                    : ''
                }`.trim()}
                onClick={() =>
                  setPaymentPage(pg)
                }
                aria-current={
                  pg === safePaymentPage
                    ? 'page'
                    : undefined
                }
              >
                {pg}
              </button>

            ))}

          </div>


          <button
            type="button"
            className="branch-course-pagination-button"
            onClick={() =>
              setPaymentPage((c) =>
                Math.min(
                  totalPaymentPages,
                  c + 1
                )
              )
            }
            disabled={
              safePaymentPage === totalPaymentPages
            }
          >
            Next
          </button>

        </div>

      ) : null}

    </BranchDashboardSection>

  )

) : null}
              
              {activeSection === 'profile' ? (
                <BranchDashboardSection title="Profile" description="Branch profile and login details.">
                  <div className="branch-dashboard-profile-grid">
                    <article className="branch-dashboard-profile-panel">
                      <span>Branch Name</span>
                      <strong>{branchTitle}</strong>
                    </article>
                    <article className="branch-dashboard-profile-panel">
                      <span>Branch Admin</span>
                      <strong>{branchAdminDisplay}</strong>
                    </article>
                    <article className="branch-dashboard-profile-panel">
                      <span>Email</span>
                      <strong>{branchEmail}</strong>
                    </article>
                    <article className="branch-dashboard-profile-panel">
                      <span>Location</span>
                      <strong>{branchLocation}</strong>
                    </article>
                  </div>
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'faculty' ? (
                <BranchFacultyPage />
              ) : null}
            </div>
          </main>
        </div>

        {pendingRecordPaymentStudent ? (
          <div className="payment-popup-overlay">
            <div
              className="payment-confirmation-popup"
              style={{
                maxWidth: '520px',
              }}
            >
              <button
                type="button"
                className="receipt-popup-close"
                onClick={() => setPendingRecordPaymentStudent(null)}
                aria-label="Close record payment confirmation"
              >
                x
              </button>

              <h3>Confirm Payment</h3>

              <p className="payment-confirmation-copy">
                Are you sure you want to confirm this payment for this student?
              </p>

              {/* <div className="confirmation-details">
                <div className="confirmation-detail-row">
                  <span>Student ID</span>
                  <strong>{pendingRecordPaymentStudent.studentId || '-'}</strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Student</span>
                  <strong>{pendingRecordPaymentStudent.studentName || '-'}</strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Amount</span>
                  <strong>
                    {formatBranchRupees(
                      pendingRecordPaymentStudent.paymentSummary?.nextInstallmentAmount ||
                        pendingRecordPaymentStudent.paymentSummary?.pendingAmount ||
                        0,
                    )}
                  </strong>
                </div>

                <div className="confirmation-detail-row">
                  <span>Payment</span>
                  <strong>
                    {pendingRecordPaymentStudent.paymentSummary?.nextInstallmentLabel ||
                      'Installment'}
                  </strong>
                </div>
              </div> */}

              <div
                className="payment-popup-actions"
                style={{
                  marginTop: '20px',
                }}
              >
                <button
                  type="button"
                  className="popup-cancel-btn"
                  onClick={() => setPendingRecordPaymentStudent(null)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="button button-solid"
                  onClick={confirmRecordPayment}
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {typeof document !== 'undefined' && isPaymentPlanRequiredOpen
          ? createPortal(
            <div className="payment-popup-overlay" role="presentation">
              <div
                className="payment-confirmation-popup branch-payment-plan-required-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="payment-plan-required-title"
                aria-describedby="payment-plan-required-description"
              >
                <button
                  type="button"
                  className="receipt-popup-close"
                  onClick={closePaymentPlanRequiredModal}
                  aria-label="Close payment plan required dialog"
                >
                  x
                </button>

                <h3 id="payment-plan-required-title">Payment Plan Required</h3>
                <p id="payment-plan-required-description" className="payment-confirmation-copy">
                  No installment payment plan has been created yet.
                  <br />
                  Please create an installment payment plan before adding a course.
                </p>

                <div className="payment-popup-actions" style={{ marginTop: '22px' }}>
                  <button
                    type="button"
                    className="popup-cancel-btn"
                    onClick={closePaymentPlanRequiredModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="button button-solid"
                    onClick={goToCreatePaymentPlan}
                  >
                    Create Payment Plan
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
          : null}

        {isAddCourseOpen ? (
          <div className="course-modal-backdrop" role="presentation">
            <form
              className="course-modal panel-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-add-course-title"
              onClick={(event) => event.stopPropagation()}
              onSubmit={handleAddCourseSubmit}
            >
              <div className="course-modal-header">
                <div>
                  <p className="section-kicker">Course Entry</p>
                  <h3 id="branch-add-course-title">{editingCourseId ? 'Edit Course' : 'Add Course'}</h3>
                </div>
                <span className="detail-badge">Required fields marked *</span>
              </div>

              <div className="course-stepper" aria-label="Course creation steps">
                <button
                  type="button"
                  className={`course-stepper-item ${addCourseStep === 1 ? 'is-active' : ''}`.trim()}
                  onClick={() => setAddCourseStep(1)}
                >
                  <span className="course-stepper-icon" aria-hidden="true">
                    <FileText size={20} strokeWidth={2.3} />
                  </span>
                  <strong>Basic Details</strong>
                </button>
                <button
                  type="button"
                  className={`course-stepper-item ${addCourseStep === 2 ? 'is-active' : ''}`.trim()}
                  onClick={() => setAddCourseStep(2)}
                  disabled={Object.keys(addCourseValidationErrors.basic).length > 0}
                >
                  <span className="course-stepper-icon" aria-hidden="true">
                    <Layers3 size={20} strokeWidth={2.3} />
                  </span>
                  <strong>Modules & Submodules</strong>
                </button>
                <button
                  type="button"
                  className={`course-stepper-item ${addCourseStep === 3 ? 'is-active' : ''}`.trim()}
                  onClick={() => {
                    setAddCourseStep(3)
                    setCourseEditorStage('closed')
                    setIsSubmoduleDraftOpen(false)
                    setSelectedSavedModelIndex(0)
                    setSelectedSavedSubmodelIndex(0)
                  }}
                  disabled={Boolean(Object.keys(addCourseValidationErrors.basic).length > 0 || addCourseValidationErrors.hierarchy.modelsError)}
                >
                  <span className="course-stepper-icon" aria-hidden="true">
                    <Wallet size={20} strokeWidth={2.3} />
                  </span>
                  <strong>Payment Plan</strong>
                </button>
              </div>

              <div className="course-step-caption">
                {addCourseStep === 1
                  ? 'Fill the course basics first. Then move to module setup.'
                  : addCourseStep === 2
                    ? 'Add modules and submodules. Continue when the hierarchy is complete.'
                    : 'Choose one or more payment plans. The installment amounts are split automatically from the final fee.'}
              </div>

              {addCourseStep === 1 ? (
                <div className="course-form-grid">
                  <Field
                    label="Course Code"
                    required
                    hint="Recommended unique identifier for reports and integrations"
                    error={shouldShowBasicAddCourseError('courseCode') ? addCourseVisibleBasicErrors.courseCode : ''}
                  >
                    <input
                      type="text"
                      placeholder="CIS-001"
                      value={addCourseForm.courseCode || COURSE_CODE_PREFIX}
                      onChange={(event) => updateAddCourseField('courseCode', event.target.value)}
                      onBlur={() => markAddCourseTouched('courseCode')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('courseCode'))}
                    />
                  </Field>

                  <Field
                    label="Course Name"
                    required
                    hint="Required field"
                    error={shouldShowBasicAddCourseError('name') ? addCourseValidationErrors.basic.name : ''}
                  >
                    <input
                      type="text"
                      placeholder="Enter Course Name"
                      value={addCourseForm.name}
                      onChange={(event) => updateAddCourseField('name', event.target.value)}
                      onBlur={() => markAddCourseTouched('name')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('name'))}
                    />
                  </Field>

                  <Field
                    label="Mode"
                    required
                    hint="Online / Offline / Hybrid"
                    error={shouldShowBasicAddCourseError('mode') ? addCourseValidationErrors.basic.mode : ''}
                  >
                    <select
                      value={addCourseForm.mode}
                      onChange={(event) => updateAddCourseField('mode', event.target.value)}
                      onBlur={() => markAddCourseTouched('mode')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('mode'))}
                    >
                      <option value="" disabled>
                        Select Mode
                      </option>
                      <option>Online</option>
                      <option>Offline</option>
                      <option>Hybrid</option>
                    </select>
                  </Field>

                  <Field
                    label="Duration (Months)"
                    required
                    hint="Numbers only"
                    error={shouldShowBasicAddCourseError('duration') ? addCourseValidationErrors.basic.duration : ''}
                  >
                    <div className="course-input-with-suffix">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={addCourseForm.duration}
                        onChange={(event) => updateAddCourseNumericField('duration', event.target.value)}
                        onBlur={() => markAddCourseTouched('duration')}
                        aria-invalid={Boolean(shouldShowBasicAddCourseError('duration'))}
                      />
                      <span>{Number(addCourseForm.duration) === 1 ? 'month' : 'months'}</span>
                    </div>
                  </Field>

                  <Field
                    label="Hours"
                    required
                    hint="Numbers only"
                    error={shouldShowBasicAddCourseError('hours') ? addCourseValidationErrors.basic.hours : ''}
                  >
                    <div className="course-input-with-suffix">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={addCourseForm.hours}
                        onChange={(event) => updateAddCourseNumericField('hours', event.target.value)}
                        onBlur={() => markAddCourseTouched('hours')}
                        aria-invalid={Boolean(shouldShowBasicAddCourseError('hours'))}
                      />
                      <span>{Number(addCourseForm.hours) === 1 ? 'hour' : 'hours'}</span>
                    </div>
                  </Field>

                  <div className="course-field course-field-with-info">
                    <div className="course-field-label">
                      <span>Standard Course Fee</span>
                      <CourseFieldInfoTooltip
                        label="Standard Course Fee"
                        description="The original course fee before discount or special pricing."
                      />
                      <b>*</b>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.actualFees}
                      onChange={(event) => updateAddCourseNumericField('actualFees', event.target.value)}
                      onBlur={() => markAddCourseTouched('actualFees')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('actualFees'))}
                    />
                    <small>Amount: {formatBranchCourseAmountInWords(addCourseForm.actualFees || 0)}</small>
                    {shouldShowBasicAddCourseError('actualFees') ? (
                      <small className="course-field-error">{addCourseValidationErrors.basic.actualFees}</small>
                    ) : null}
                  </div>

                  <Field
                    label="Registration Fee"
                    required
                    hint="Registration fee amount"
                    error={shouldShowBasicAddCourseError('registrationFees') ? addCourseValidationErrors.basic.registrationFees : ''}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.registrationFees}
                      onChange={(event) => updateAddCourseNumericField('registrationFees', event.target.value)}
                      onBlur={() => markAddCourseTouched('registrationFees')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('registrationFees'))}
                    />
                  </Field>

                  <Field
                    label="Default Discount"
                    hint="Optional"
                    error={shouldShowBasicAddCourseError('discount') ? addCourseValidationErrors.basic.discount : ''}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.discount}
                      onChange={(event) => updateAddCourseNumericField('discount', event.target.value)}
                      onBlur={() => markAddCourseTouched('discount')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('discount'))}
                    />
                  </Field>

                  <Field label="Final Fee" hint="Auto calculated from fee + registration - discount">
                    <input type="text" value={addCourseFinalFee} readOnly />
                  </Field>

                  <Field
                    label="Status"
                    required
                    hint="Active or Inactive"
                    error={shouldShowBasicAddCourseError('status') ? addCourseValidationErrors.basic.status : ''}
                  >
                    <select
                      value={addCourseForm.status}
                      onChange={(event) => updateAddCourseField('status', event.target.value)}
                      onBlur={() => markAddCourseTouched('status')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('status'))}
                    >
                      <option value="Active">Active</option>
                      <option>Inactive</option>
                    </select>
                  </Field>
                </div>
              ) : addCourseStep === 2 ? (
                <div className="course-model-editor">
                  <div className="course-model-editor-header">
                    <p className="section-kicker">Modules & Submodules</p>
                  </div>

                  <div className="course-model-stage">
                    {courseEditorStage !== 'closed' && activeCourseModel ? (() => {
                      const modelIndex = activeCourseModelIndex
                      const model = activeCourseModel
                      const submodels = Array.isArray(model.submodels) ? model.submodels : []
                      const savedSubmodels = submodels.slice(0, Math.max(selectedSavedSubmodelIndex, 0))
                      const activeSubmodelIndex = Math.min(selectedSavedSubmodelIndex, Math.max(submodels.length - 1, 0))
                      const activeSubmodel = submodels[activeSubmodelIndex] || null
                      const showModuleCancel = modelIndex > 0
                      const showSubmodelCancel = activeSubmodelIndex > 0 || savedSubmodels.length > 0

                      return (
                        <section key={model.id} className="course-model-editor-card is-active is-lead" aria-expanded="true">
                          <div className="course-model-editor-card-header">
                            <div className="course-model-editor-card-heading">
                              <div className="course-model-editor-card-title-row">
                                <div className="course-model-editor-card-badge">{modelIndex + 1}</div>
                                <strong>Module {modelIndex + 1}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="course-model-editor-card-body">
                            {courseEditorStage === 'module' ? (
                              <Field
                                label="Module Name"
                                required
                                error={shouldShowModelNameError(modelIndex) ? addCourseValidationErrors.hierarchy.models?.[modelIndex]?.name : ''}
                              >
                                <input
                                  type="text"
                                  placeholder="Enter module name"
                                  value={model.name || ''}
                                  onChange={(event) => updateAddCourseModelField(modelIndex, 'name', event.target.value)}
                                  onBlur={() => markAddCourseTouched(`model-${modelIndex}-name`)}
                                  aria-invalid={Boolean(shouldShowModelNameError(modelIndex))}
                                />
                              </Field>
                            ) : (
                              <div className="course-module-summary-block">
                                <span className="course-module-summary-label">Module Name</span>
                                <strong>{model.name || `Module ${modelIndex + 1}`}</strong>
                              </div>
                            )}

                            {courseEditorStage === 'submodule' ? (
                              <div className="course-model-editor-submodels">
                                <div className="course-submodel-list-header">
                                  <strong>Sub Modules</strong>
                                  <span>{savedSubmodels.length} saved</span>
                                </div>

                                {savedSubmodels.length ? (
                                  <div className="course-submodule-checklist">
                                    {savedSubmodels.map((submodel, subIndex) => (
                                      <div key={submodel.id} className="course-submodule-checklist-item">
                                        <button
                                          type="button"
                                          className="course-submodule-checklist-item-body"
                                          onClick={() => handleCourseSubmodelEdit(modelIndex, subIndex)}
                                          aria-label={`Edit submodule ${subIndex + 1}`}
                                        >
                                          <span className="course-submodule-checkmark">✓</span>
                                          <div>
                                            <strong>{submodel.name || `Submodule ${subIndex + 1}`}</strong>
                                          </div>
                                        </button>
                                        <div className="course-submodule-checklist-actions">
                                          <button
                                            type="button"
                                            className="course-submodule-checklist-action course-submodule-checklist-edit"
                                            onClick={() => handleCourseSubmodelEdit(modelIndex, subIndex)}
                                            aria-label={`Edit submodule ${subIndex + 1}`}
                                          >
                                            <Pencil size={15} strokeWidth={2.2} />
                                          </button>
                                          <button
                                            type="button"
                                            className="course-submodule-checklist-action course-submodule-checklist-delete"
                                            onClick={() => handleCourseSubmodelDelete(modelIndex, subIndex)}
                                            aria-label={`Delete submodule ${subIndex + 1}`}
                                          >
                                            <Trash2 size={15} strokeWidth={2.2} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {isSubmoduleDraftOpen && activeSubmodel ? (
                                  <div className="course-submodel-row is-active">
                                    <Field
                                      label={`Submodule ${activeSubmodelIndex + 1}`}
                                      required
                                      error={shouldShowSubmodelError(modelIndex, activeSubmodelIndex) ? addCourseValidationErrors.hierarchy.models?.[modelIndex]?.submodels?.[activeSubmodelIndex]?.name : ''}
                                    >
                                      <input
                                        type="text"
                                        placeholder="Enter submodule name"
                                        value={activeSubmodel.name || ''}
                                        ref={activeSubmoduleInputRef}
                                        onChange={(event) => updateAddCourseSubmodelField(modelIndex, activeSubmodelIndex, event.target.value)}
                                        onBlur={() => markAddCourseTouched(`model-${modelIndex}-submodel-${activeSubmodelIndex}-name`)}
                                        aria-invalid={Boolean(shouldShowSubmodelError(modelIndex, activeSubmodelIndex))}
                                      />
                                    </Field>

                                    <div className="course-submodel-footer-actions">
                                      <div className="course-submodel-meta">
                                        <button
                                          type="button"
                                          className="course-inline-action"
                                          onClick={() => handleCourseSubmodelSave(modelIndex)}
                                        >
                                          Save
                                        </button>
                                        {showSubmodelCancel ? (
                                          <button
                                            type="button"
                                            className="course-inline-action course-inline-cancel"
                                            onClick={() => handleCourseSubmodelCancel(modelIndex)}
                                          >
                                            Cancel
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}

                                {shouldShowModelSubmodelsError(modelIndex) ? (
                                  <div className="course-validation-note course-validation-error course-model-inline-error">
                                    <span>{addCourseValidationErrors.hierarchy.models?.[modelIndex]?.submodelsError}</span>
                                  </div>
                                ) : null}
                                {isSubmoduleDraftOpen ? null : (
                                  <button
                                    type="button"
                                    className="button button-ghost course-add-submodel-button"
                                    onClick={() => openCourseSubmodelDraft(modelIndex)}
                                  >
                                    + Add Sub Model
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>

                          <div className="course-model-editor-card-footer">
                            {courseEditorStage === 'module' ? (
                              <>
                                {showModuleCancel ? (
                                  <button
                                    type="button"
                                    className="button button-ghost course-model-editor-card-cancel"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleCourseEditorCancel()
                                    }}
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="button button-solid course-model-editor-card-save-next"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleCourseModelSaveAndNext(modelIndex)
                                  }}
                                >
                                  Continue
                                </button>
                              </>
                            ) : !isSubmoduleDraftOpen ? (
                              <button
                                type="button"
                                className="button button-solid course-model-editor-card-save-next"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleCourseModuleFinalSave(modelIndex)
                                }}
                              >
                                Save Module
                              </button>
                            ) : null}
                          </div>
                        </section>
                      )
                    })() : null}
                  </div>

                  {courseEditorStage === 'closed' ? (
                    <div className="course-added-modules">
                      {(() => {
                        const moduleWeightageSummary = getBranchCourseModuleWeightageSummary(savedCourseRows)

                        return (
                          <div className="course-module-weightage-card">
                            <div className="course-module-weightage-card-copy">
                              <div className="course-module-weightage-card-icon" aria-hidden="true">
                                <PieChart size={28} strokeWidth={2.2} />
                              </div>
                              <div>
                                <strong>Course Module Weightage</strong>
                                <p>The total weightage of all modules in this course is 100%.</p>
                                <span>Module percentages are automatically distributed equally.</span>
                              </div>
                            </div>

                            <div className="course-module-weightage-card-summary">
                              <span>Total Module Weightage</span>
                              <strong>{formatBranchCoursePercentage(moduleWeightageSummary.totalWeightage)}</strong>
                              <p>{moduleWeightageSummary.distributionLabel}</p>
                            </div>
                          </div>
                        )
                      })()}

                      <div className="course-added-modules-header">
                        <div>
                          <h5>Modules</h5>
                          <span>{savedCourseRows.length} saved</span>
                        </div>
                        <button
                          type="button"
                          className="course-added-module-add-tile course-added-module-add-tile-inline"
                          onClick={addAddCourseModel}
                        >
                          + Add Module
                        </button>
                      </div>

                      {savedCourseRows.length ? (
                        <div className="course-added-modules-table">
                          <div className="course-added-modules-table-header">
                            <span>MODULE</span>
                            <span>MODULE %</span>
                            <span>SUBMODULES</span>
                            <span>ACTIONS</span>
                          </div>

                          <div className="course-added-modules-table-body">
                            {savedCourseRows.map((model, modelIndex) => {
                              const submodels = Array.isArray(model.submodels) ? model.submodels : []
                              const isExpanded = expandedSavedCourseModuleIds.includes(model.id)

                              return (
                                <article
                                  key={model.id}
                                  className={`course-added-modules-row ${modelIndex === selectedSavedModelIndex ? 'is-active' : ''}`}
                                >
                                  <div className="course-added-modules-row-main">
                                    <div className="course-added-modules-row-module">
                                      <span>Module {modelIndex + 1}</span>
                                      <strong>{model.name || `Module ${modelIndex + 1}`}</strong>
                                    </div>

                                    <div className="course-added-modules-row-percentage">
                                      <span className="course-table-percentage">{formatBranchCoursePercentage(model.percentage)}</span>
                                    </div>

                                    <div className="course-added-modules-row-submodules">
                                      <span className="course-table-percentage">{submodels.length} Submodules</span>
                                    </div>

                                    <div className="course-added-modules-row-actions">
                                      <button
                                        type="button"
                                        className="course-added-module-card-toggle"
                                        onClick={() => toggleSavedCourseModule(model.id)}
                                        aria-expanded={isExpanded}
                                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} module ${modelIndex + 1}`}
                                      >
                                        <ChevronDown
                                          size={18}
                                          strokeWidth={2.4}
                                          className={isExpanded ? 'is-open' : ''}
                                          aria-hidden="true"
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        className="course-added-module-card-edit"
                                        onClick={() => selectCourseModel(modelIndex)}
                                        aria-label={`Edit module ${modelIndex + 1}`}
                                      >
                                        <Pencil size={16} strokeWidth={2.2} />
                                      </button>
                                      <button
                                        type="button"
                                        className="course-added-module-card-delete"
                                        onClick={() => openCourseModuleDeleteConfirm(modelIndex)}
                                        disabled={savedCourseRows.length === 1}
                                        aria-label={`Delete module ${modelIndex + 1}`}
                                      >
                                        <Trash2 size={16} strokeWidth={2.2} />
                                      </button>
                                    </div>
                                  </div>

                                  {isExpanded ? (
                                    <div className="course-added-modules-row-details">
                                      <span>Sub Modules</span>
                                      <ul className="course-added-module-card-list">
                                        {submodels.length ? submodels.map((submodel, submodelIndex) => (
                                          <li key={submodel.id}>
                                            <span className="course-added-module-card-list-index">{String(submodelIndex + 1).padStart(2, '0')}</span>
                                            <strong>{submodel.name || `Submodule ${submodelIndex + 1}`}</strong>
                                          </li>
                                        )) : (
                                          <li>No submodules yet</li>
                                        )}
                                      </ul>
                                    </div>
                                  ) : null}
                                </article>
                              )
                            })}

                            <article className="course-added-modules-row course-added-modules-row-total" aria-label="Module total">
                              <div className="course-added-modules-row-main course-added-modules-row-main--total">
                                <div className="course-added-modules-row-total-label">
                                  <strong>Module Total</strong>
                                </div>

                                <div className="course-added-modules-row-total-percentage">
                                  <span className="course-table-percentage course-table-percentage--total">
                                    {formatBranchCoursePercentage(100)}
                                  </span>
                                </div>

                                <div className="course-added-modules-row-total-submodules" />
                                <div className="course-added-modules-row-total-actions" />
                              </div>
                            </article>
                          </div>
                        </div>
                      ) : (
                        <div className="course-added-modules-empty">
                          <p>No modules added yet. Click "Add Module" to create your first module.</p>
                        </div>
                      )}

                    </div>
                  ) : null}
                </div>
              ) : addCourseStep === 3 ? (
                <div className="course-payment-plan-editor">
                  <div className="course-payment-plan-summary-grid">
                    <Field label="Final Fee" hint="Read only">
                      <input
                        type="text"
                        value={addCourseFinalFee ? formatBranchCourseAmount(addCourseFinalFee) : '-'}
                        readOnly
                      />
                    </Field>

                    <Field
                      label="Installment Plans"
                      hint="Choose one or more templates"
                      error={addCoursePaymentPlanVisibleError}
                    >
                      <div
                        ref={paymentPlanDropdownRef}
                        className={`course-payment-plan-dropdown ${isPaymentPlanDropdownOpen ? 'is-open' : ''}`.trim()}
                        aria-invalid={Boolean(addCoursePaymentPlanVisibleError)}
                      >
                        <button
                          type="button"
                          className={`course-payment-plan-dropdown-trigger ${addCoursePaymentPlanSelectedIds.length ? 'has-value' : ''}`.trim()}
                          onClick={() => setIsPaymentPlanDropdownOpen((current) => !current)}
                          aria-expanded={isPaymentPlanDropdownOpen}
                          aria-label="Select Installment Plans"
                        >
                          <span className="course-payment-plan-dropdown-trigger-copy">
                            <strong>
                              {addCoursePaymentPlanSelectedIds.length
                                ? `${addCoursePaymentPlanSelectedIds.length} selected`
                                : 'Select Payment Plan'}
                            </strong>
                            <small>
                              {addCoursePaymentPlanSelectedIds.length
                                ? 'Plans selected'
                                : 'Choose one or more plans'}
                            </small>
                          </span>
                          <ChevronDown size={18} strokeWidth={2.2} className={isPaymentPlanDropdownOpen ? 'is-open' : ''} aria-hidden="true" />
                        </button>

                        {isPaymentPlanDropdownOpen ? (
                          <div className="course-payment-plan-dropdown-panel" role="group" aria-label="Payment plan options">
                            <div
                              className="course-payment-plan-checklist"
                              role="group"
                              aria-label="Select payment plan"
                              aria-invalid={Boolean(addCoursePaymentPlanVisibleError)}
                            >
                              {isBranchInstallmentTemplatesLoading ? (
                                <div className="course-payment-plan-checklist-empty">No payment plans found</div>
                              ) : null}

                              {!isBranchInstallmentTemplatesLoading && !addCoursePaymentPlanOptions.length ? (
                                <div className="course-payment-plan-checklist-empty">No payment plans found</div>
                              ) : null}

                              {addCoursePaymentPlanOptions.map((template) => {
                                const templateId = String(template.id || '').trim()
                                const checked = addCoursePaymentPlanSelectedIds.includes(templateId)

                                return (
                                  <label
                                    key={templateId}
                                    className={`course-payment-plan-checklist-item ${checked ? 'is-checked' : ''}`.trim()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(event) => {
                                        markAddCourseTouched('paymentPlans')
                                        const nextSelected = new Set(addCoursePaymentPlanSelectedIds)
                                        if (event.target.checked) {
                                          nextSelected.add(templateId)
                                        } else {
                                          nextSelected.delete(templateId)
                                        }
                                        updateAddCoursePaymentPlanSelections(Array.from(nextSelected))
                                      }}
                                    />
                                    <span className="course-payment-plan-checkmark" aria-hidden="true">
                                      {checked ? <Check size={12} strokeWidth={3} /> : null}
                                    </span>
                                    <span className="course-payment-plan-checklist-copy">
                                      <strong>{template.templateName || `${template.installmentCount || 1} Installments`}</strong>
                                    </span>
                                  </label>
                                )
                              })}

                            </div>

                            <div className="course-payment-plan-dropdown-footer">
                              <span>{addCoursePaymentPlanSelectedIds.length} selected</span>
                              <div className="course-payment-plan-footer-actions">
                                <button
                                  type="button"
                                  className="course-payment-plan-save-button"
                                  onClick={saveAddCoursePaymentPlans}
                                  disabled={!addCoursePaymentPlanSelectedIds.length}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="course-payment-plan-clear-button"
                                  onClick={() => {
                                    clearAddCoursePaymentPlans()
                                    setIsPaymentPlanDropdownOpen(true)
                                  }}
                                  disabled={!addCoursePaymentPlanSelectedIds.length}
                                >
                                  Clear All
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                      </div>
                    </Field>

                    {branchInstallmentTemplatesError ? (
                      <div className="course-validation-note">
                        <span>{branchInstallmentTemplatesError}</span>
                      </div>
                    ) : null}
                  </div>

                  {addCourseSavedPaymentPlanDisplayPlans.length ? (
                    <div className="course-payment-plan-saved-section">
                      <div className="course-payment-plan-saved-header">
                        <span>Selected Plans ({addCourseSavedPaymentPlanDisplayPlans.length})</span>
                      </div>

                      <div className="course-payment-plan-saved-list">
                        {addCourseSavedPaymentPlanDisplayPlans.map((plan, planIndex) => {
                          const planId = String(plan.id || `${plan.type}-${planIndex}`).trim()
                          const isOpen = addCourseSavedPaymentPlanId === planId
                          const effectiveInstallments = Array.isArray(plan.installments) ? plan.installments : []
                          const installmentLabel = plan.installmentCountLabel
                            ? `${plan.installmentCountLabel} ${Number(plan.installmentCountLabel) === 1 ? 'Installment' : 'Installments'}`
                            : 'Set count'

                          return (
                            <article key={planId} className={`course-payment-plan-saved-card ${isOpen ? 'is-open' : ''}`.trim()}>
                              <button
                                type="button"
                                className="course-payment-plan-saved-card-trigger"
                                onClick={() => {
                                  setAddCourseSavedPaymentPlanId((current) => (current === planId ? '' : planId))
                                }}
                              >
                                <span className="course-payment-plan-saved-card-copy">
                                  <strong>{plan.templateName || 'Payment Plan'}</strong>
                                  <small>Installment plan</small>
                                </span>
                                <span className="course-payment-plan-saved-card-arrow" aria-hidden="true">
                                  <ChevronRight size={18} strokeWidth={2.2} />
                                </span>
                              </button>

                              {isOpen ? (
                                <div className="course-payment-plan-saved-card-body">
                                  <div className="course-payment-plan-meta">
                                    <span>{plan.dueRule || 'Admission'}</span>
                                  </div>

                                  <div className="course-payment-plan-count-inline">
                                    {installmentLabel}
                                  </div>

                                  {effectiveInstallments.length ? (
                                    <div className="course-payment-plan-table-shell">
                                      <table className="course-payment-plan-table">
                                        <thead>
                                          <tr>
                                            <th>Installment</th>
                                            <th>Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {effectiveInstallments.map((amount, installmentIndex) => (
                                            <tr key={`${plan.id}-${installmentIndex}`}>
                                              <td>Installment {installmentIndex + 1}</td>
                                              <td>{formatBranchCourseAmount(amount)}</td>
                                            </tr>
                                          ))}
                                          <tr className="course-payment-plan-total-row">
                                            <td><strong>Total</strong></td>
                                            <td><strong>{formatBranchCourseAmount(String(getBranchInstallmentAmountTotal(effectiveInstallments)))}</strong></td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="course-payment-plan-checklist-empty">
                                      No installment rows found for this plan.
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="course-added-modules-empty">
                      <p>Click Save to show selected payment plans. After that, click a plan to view its installment table.</p>
                    </div>
                  )}
                </div>
              ) : null}

              {addCourseError ? (
                <div className="course-validation-note course-validation-error">
                  <span>{addCourseError}</span>
                </div>
              ) : null}

              <div className="course-form-actions">
                <button type="button" className="button button-ghost" onClick={resetAddCourseForm} disabled={isAddCourseSaving}>
                  Reset
                </button>
                {addCourseStep === 1 ? (
                  <button type="button" className="button button-solid" onClick={handleCourseBasicNext} disabled={isAddCourseSaving}>
                    Next
                  </button>
                ) : addCourseStep === 2 ? (
                  <div className="course-form-actions-group">
                    <button type="button" className="button button-ghost" onClick={() => setAddCourseStep(1)} disabled={isAddCourseSaving}>
                      Back
                    </button>
                    <button type="button" className="button button-solid" onClick={handleCourseModulesNext} disabled={isAddCourseSaving}>
                      Next
                    </button>
                  </div>
                ) : (
                  <div className="course-form-actions-group">
                    <button type="button" className="button button-ghost" onClick={() => setAddCourseStep(2)} disabled={isAddCourseSaving}>
                      Back
                    </button>
                    <button type="button" className="button button-solid" onClick={triggerAddCourseSubmit} disabled={isAddCourseSaving}>
                      {editingCourseId ? 'Update Course' : 'Save Course'}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="course-modal-close"
                onClick={closeAddCourseModal}
                aria-label="Close course form"
                disabled={isAddCourseSaving}
              >
                <X size={22} strokeWidth={2} />
              </button>
            </form>
          </div>
        ) : null}





        {/* STEP 5 — ASSIGN FACULTY MODAL */}
        {isAssignFacultyOpen ? (() => {
          const FACULTY_PER_PAGE = 3
          const totalFacultyPages = Math.max(1, Math.ceil(facultyList.length / FACULTY_PER_PAGE))
          const safeAssignPage = Math.min(assignFacultyPage, totalFacultyPages)
          const facultyStart = (safeAssignPage - 1) * FACULTY_PER_PAGE
          const visibleFaculty = facultyList.slice(facultyStart, facultyStart + FACULTY_PER_PAGE)

          return (
            <div
              className="branch-modal-backdrop"
              role="presentation"

            >
              <div
                className="assign-faculty-modal-v2"
                role="dialog"
                aria-modal="true"
                aria-labelledby="assign-faculty-title"
                onClick={(event) => event.stopPropagation()}
              >
                {/* Close button */}
                <button
                  type="button"
                  className="assign-faculty-v2-close"
                  aria-label="Close assign faculty modal"
                  onClick={closeAssignFacultyModal}
                >
                  <X size={22} strokeWidth={2} />
                </button>

                {/* Header */}
                <div className="assign-faculty-v2-header">
                  <span className="assign-faculty-v2-kicker">ASSIGN FACULTY</span>
                  <h2 id="assign-faculty-title">
                    {assignFacultyCourse?.name || 'Course'}
                  </h2>
                  <div className="assign-faculty-v2-course-meta">
                    <span className="assign-faculty-v2-meta-pill">
                      <Code2 size={13} strokeWidth={2.4} />
                      {assignFacultyCourse?.courseCode || '-'}
                    </span>
                    <span className="assign-faculty-v2-meta-pill">
                      <BookOpen size={13} strokeWidth={2.4} />
                      {assignFacultyCourse?.name || '-'}
                    </span>
                  </div>
                </div>

                {/* Faculty cards — vertical list */}
                <div className="assign-faculty-v2-body">
                  <div className="assign-faculty-v2-label">
                    Select Faculty
                    <span className="assign-faculty-v2-count">
                      {selectedFacultyIds.length} selected
                    </span>
                  </div>

                  {facultyList.length > 0 ? (
                    <div className="assign-faculty-v2-cards">
                      {visibleFaculty.map((faculty) => {
                        const isChecked = selectedFacultyIds.includes(faculty.id)
                        return (
                          <label
                            key={faculty.id}
                            className={`assign-faculty-v2-card ${isChecked ? 'is-selected' : ''}`.trim()}
                          >
                            <input
                              type="checkbox"
                              className="assign-faculty-v2-checkbox"
                              checked={isChecked}
                              onChange={() => toggleFacultySelection(faculty.id)}
                            />
                            <span className="assign-faculty-v2-check-icon">
                              {isChecked ? <CheckCircle2 size={20} strokeWidth={2.4} /> : <CircleDot size={20} strokeWidth={1.8} />}
                            </span>
                            <div className="assign-faculty-v2-card-info">
                              <strong>{faculty.name}</strong>
                              <small>{faculty.id}</small>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="assign-faculty-v2-empty">
                      No faculty found. Add faculty in the Faculty tab first.
                    </div>
                  )}

                  {/* Pagination */}
                  {totalFacultyPages > 1 ? (
                    <div className="assign-faculty-v2-pagination">
                      <button
                        type="button"
                        className="assign-faculty-v2-page-btn"
                        disabled={safeAssignPage === 1}
                        onClick={() => setAssignFacultyPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={16} strokeWidth={2.5} />
                        Prev
                      </button>

                      <div className="assign-faculty-v2-page-dots">
                        {Array.from({ length: totalFacultyPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            className={`assign-faculty-v2-dot ${page === safeAssignPage ? 'is-active' : ''}`.trim()}
                            onClick={() => setAssignFacultyPage(page)}
                            aria-label={`Page ${page}`}
                            aria-current={page === safeAssignPage ? 'page' : undefined}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="assign-faculty-v2-page-btn"
                        disabled={safeAssignPage === totalFacultyPages}
                        onClick={() => setAssignFacultyPage((p) => Math.min(totalFacultyPages, p + 1))}
                      >
                        Next
                        <ChevronRight size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Footer */}
                <div className="assign-faculty-v2-footer">
                  <button
                    type="button"
                    className="assign-faculty-v2-cancel"
                    onClick={closeAssignFacultyModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="assign-faculty-v2-submit"
                    onClick={handleAssignFaculty}
                    disabled={isAssignFacultySaving}
                  >
                    {isAssignFacultySaving ? 'Assigning...' : `Assign Faculty (${selectedFacultyIds.length})`}
                  </button>
                </div>
              </div>
            </div>
          )
        })() : null}


        {/* ASSIGN FACULTY SUCCESS POPUP */}
        {assignFacultySuccess ? (
          <div
            className="branch-modal-backdrop"
            role="presentation"
          >
            <div
              className="assign-faculty-success-popup"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="assign-faculty-success-icon">
                <CheckCircle2 size={40} strokeWidth={2} />
              </div>

              <h3>Faculty Assigned!</h3>

              <p className="assign-faculty-success-course">
                {assignFacultySuccess.courseName}
              </p>

              <p className="assign-faculty-success-detail">
                {assignFacultySuccess.facultyNames.length > 0
                  ? <>Assigned to: <strong>{assignFacultySuccess.facultyNames.join(', ')}</strong></>
                  : 'All faculty removed from this course.'}
              </p>

              <button
                type="button"
                className="assign-faculty-success-btn"
                onClick={() => setAssignFacultySuccess(null)}
              >
                OK
              </button>
            </div>
          </div>
        ) : null}

        {viewCourse ? (
          <div
            className="branch-course-drawer-backdrop"
            role="presentation"
          >
            <aside
              className="branch-course-view-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-course-view-title"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header */}
              <div className="branch-course-view-drawer-header">
                <div className="branch-course-header-content">
                  <p className="section-kicker">COURSE DETAILS</p>
                  <h2 id="branch-course-view-title">{viewCourse.name || 'Course'}</h2>
                  <span className="branch-course-view-code">{viewCourse.courseCode || '-'}</span>
                </div>

                <div className="branch-course-view-header-actions">
                  <div className="branch-course-view-header-actions-row">
                    <strong
                      className={`branch-course-status-pill ${String(viewCourse.status || 'Active').toLowerCase()}`}
                    >
                      {viewCourse.status || 'Active'}
                    </strong>

                    <button
                      type="button"
                      className="branch-course-view-close"
                      onClick={closeViewCourseDrawer}
                      aria-label="Close course details"
                    >
                      <X size={22} strokeWidth={2} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="branch-course-view-edit"
                    onClick={() => {
                      closeViewCourseDrawer()
                      openEditCourseModal(viewCourse)
                    }}
                  >
                    Edit Course
                  </button>
                </div>
              </div>

              <div className="branch-course-view-body">
                <div className="branch-course-view-tabs" role="tablist" aria-label="Course details tabs">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewCourseTab === 'basic'}
                    className={`branch-course-view-tab ${viewCourseTab === 'basic' ? 'is-active' : ''}`}
                    onClick={() => setViewCourseTab('basic')}
                  >
                    Basic Details
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewCourseTab === 'modules'}
                    className={`branch-course-view-tab ${viewCourseTab === 'modules' ? 'is-active' : ''}`}
                    onClick={() => setViewCourseTab('modules')}
                  >
                    Modules &amp; Submodules
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewCourseTab === 'paymentPlans'}
                    className={`branch-course-view-tab ${viewCourseTab === 'paymentPlans' ? 'is-active' : ''}`}
                    onClick={() => setViewCourseTab('paymentPlans')}
                  >
                    Payment Plan
                  </button>
                </div>

                <div className="branch-course-view-content">
                  {viewCourseTab === 'basic' ? (
                    <div className="branch-course-view-table" role="table" aria-label="Course details">
                      <div className="branch-course-view-table-header" role="row">
                        <div className="branch-course-view-table-head" role="columnheader">DETAILS</div>
                        <div className="branch-course-view-table-head" role="columnheader">INFORMATION</div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <Monitor size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Mode</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourse.mode || '-'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <CalendarDays size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Duration</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>
                            {viewCourse.duration
                              ? `${viewCourse.duration} month${viewCourse.duration === '1' ? '' : 's'}`
                              : '-'}
                          </strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <Clock3 size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Hours</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>
                            {viewCourse.hours
                              ? `${viewCourse.hours} hour${viewCourse.hours === '1' ? '' : 's'}`
                              : '-'}
                          </strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <IndianRupee size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Standard Course Fee</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseAmount(viewCourse.actualFees)}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <IndianRupee size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Registration Fee</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseAmount(viewCourse.registrationFees)}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <BadgePercent size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Discount</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseAmount(viewCourse.discount || '0')}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row is-highlight" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <IndianRupee size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Final Fee</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseFinalFee(viewCourse)}</strong>
                        </div>
                      </div>

                      {/* <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <Tag size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Installment Template</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourseInstallmentTemplate.templateName || '-'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <BadgeInfo size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Installment Count</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourseInstallmentTemplate.installmentCount || '-'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <Shield size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Due Rule</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourseInstallmentTemplate.dueRule || '-'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <BadgePercent size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Customizable</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourseInstallmentTemplate.allowCustomization ? 'Yes' : 'No'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <RefreshCcw size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Installments</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong className="branch-course-view-installment-list">
                            {(Array.isArray(viewCourseInstallmentTemplate.installments) && viewCourseInstallmentTemplate.installments.length)
                              ? viewCourseInstallmentTemplate.installments.map((amount, index) => (
                                <span key={`${viewCourse.id || 'course'}-installment-${index}`}>
                                  {index + 1}. {formatBranchCourseAmount(amount)}
                                </span>
                              ))
                              : '-'}
                          </strong>
                        </div>
                      </div> */}

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <CalendarDays size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Created At</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseDate(viewCourse.createdAt)}</strong>
                        </div>
                      </div>
                    </div>
                  ) : viewCourseTab === 'paymentPlans' ? (
                    <section className="branch-course-view-payment-plan-section" aria-label="Payment plans">
                      <div className="branch-course-view-payment-plan-summary">
                        <span>Final Fee</span>
                        <strong>{formatBranchCourseAmount(viewCourseFinalFeeValue)}</strong>
                      </div>

                      {viewCoursePaymentPlans.length ? (
                        <div className="course-payment-plan-saved-list branch-course-view-payment-plan-list">
                          {viewCoursePaymentPlans.map((plan, planIndex) => {
                            const planId = String(plan.id || `${plan.type}-${planIndex}`).trim()
                            const isOpen = viewCoursePaymentPlanOpenId === planId
                            const rawInstallmentCount = String(plan.installmentCount || '').trim()
                            const installmentCount = Number(rawInstallmentCount || plan.installments?.length || 0) || 0
                            const installments = Array.isArray(plan.installments) && plan.installments.length
                              ? plan.installments
                              : installmentCount > 0
                                ? buildBranchCoursePaymentPlanInstallments(viewCourseFinalFeeValue, installmentCount)
                                : []

                            return (
                              <article key={planId} className={`course-payment-plan-saved-card ${isOpen ? 'is-open' : ''}`.trim()}>
                                <button
                                  type="button"
                                  className="course-payment-plan-saved-card-trigger"
                                  onClick={() => {
                                    setViewCoursePaymentPlanOpenId((current) => (current === planId ? '' : planId))
                                  }}
                                >
                                  <span className="course-payment-plan-saved-card-copy">
                                    <strong>{plan.templateName || 'Payment Plan'}</strong>
                                    <small>{plan.type === 'custom' ? 'Manual installment count' : 'Installment plan'}</small>
                                  </span>
                                  <span className="course-payment-plan-saved-card-arrow" aria-hidden="true">
                                    <ChevronRight size={18} strokeWidth={2.2} />
                                  </span>
                                </button>

                                {isOpen ? (
                                  <div className="course-payment-plan-saved-card-body">
                                    <div className="course-payment-plan-meta">
                                      <span>{plan.dueRule || 'Admission'}</span>
                                      <small>{plan.type === 'custom' ? 'Custom' : 'Template'}</small>
                                    </div>

                                    <div className="course-payment-plan-count-inline">
                                      {rawInstallmentCount
                                        ? `${rawInstallmentCount} ${Number(rawInstallmentCount) === 1 ? 'Installment' : 'Installments'}`
                                        : 'Set count'}
                                    </div>

                                    {installments.length ? (
                                      <div className="course-payment-plan-table-shell">
                                        <table className="course-payment-plan-table">
                                          <thead>
                                            <tr>
                                              <th>Installment</th>
                                              <th>Amount</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {installments.map((amount, installmentIndex) => (
                                              <tr key={`${planId}-${installmentIndex}`}>
                                                <td>Installment {installmentIndex + 1}</td>
                                                <td>{formatBranchCourseAmount(amount)}</td>
                                              </tr>
                                            ))}
                                            <tr className="course-payment-plan-total-row">
                                              <td><strong>Total</strong></td>
                                              <td><strong>{formatBranchCourseAmount(String(getBranchInstallmentAmountTotal(installments)))}</strong></td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <div className="course-payment-plan-checklist-empty">
                                        No installment data available for this plan.
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </article>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="course-added-modules-empty">
                          <p>No payment plans were saved for this course.</p>
                        </div>
                      )}
                    </section>
                  ) : (
                    <section className="branch-course-view-hierarchy" aria-label="Modules and submodules">
                      {viewCourseModels.length ? (
                        <div className="course-module-weightage-card branch-course-view-weightage-card">
                          <div className="course-module-weightage-card-copy">
                            <div className="course-module-weightage-card-icon" aria-hidden="true">
                              <PieChart size={28} strokeWidth={2.2} />
                            </div>
                            <div>
                              <strong>Module Weightage Summary</strong>
                              <p>Total module weightage for this course is 100%.</p>
                              <span>Module weightage is automatically distributed equally based on the total number of modules.</span>
                            </div>
                          </div>

                          <div className="course-module-weightage-card-summary branch-course-view-weightage-summary">
                            <span>Total Modules</span>
                            <strong>{viewCourseModels.length}</strong>
                            <p>Equal Distribution</p>
                          </div>
                        </div>
                      ) : null}

                      <div className="branch-course-view-hierarchy-header">
                        <div>
                          <p>Added Modules</p>
                          <strong>{viewCourseModels.length} Total Modules</strong>
                        </div>
                        <span>Click the arrow to expand a module</span>
                      </div>

                      {viewCourseModels.length ? (
                        <div className="branch-course-view-models">
                          <div className="branch-course-view-model-table-header" role="row" aria-hidden="true">
                            <span>Module</span>
                            <span>Module Name</span>
                            <span>Percentage</span>
                            <span>Actions</span>
                          </div>
                          {viewCourseModels.map((model, modelIndex) => {
                            const isExpanded = expandedViewCourseModuleIds.includes(model.id)

                            return (
                              <article key={model.id} className="branch-course-view-model-card">
                                <div className="branch-course-view-model-row" role="row">
                                  <div className="branch-course-view-model-cell branch-course-view-model-cell-module" role="cell">
                                    <span>Module {modelIndex + 1}</span>
                                  </div>

                                  <div className="branch-course-view-model-cell branch-course-view-model-cell-name" role="cell">
                                    <strong>{model.name || `Module ${modelIndex + 1}`}</strong>
                                  </div>

                                  <div className="branch-course-view-model-cell branch-course-view-model-cell-percentage" role="cell">
                                    <b>{formatBranchCoursePercentage(model.percentage)}</b>
                                  </div>

                                  <div className="branch-course-view-model-cell branch-course-view-model-cell-actions" role="cell">
                                    <button
                                      type="button"
                                      className="branch-course-view-module-toggle"
                                      onClick={() => toggleViewCourseModule(model.id)}
                                      aria-expanded={isExpanded}
                                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${model.name || `Module ${modelIndex + 1}`}`}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown size={18} strokeWidth={2.4} aria-hidden="true" />
                                      ) : (
                                        <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {isExpanded ? (
                                  <div className="branch-course-view-submodels">
                                    {model.submodels.length ? (
                                      model.submodels.map((submodel, submodelIndex) => (
                                        <div key={submodel.id} className="branch-course-view-submodel">
                                          <div>
                                            <span>Submodel {submodelIndex + 1}</span>
                                            <strong>{submodel.name || `Submodel ${submodelIndex + 1}`}</strong>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="branch-course-view-submodel is-empty">
                                        <div>
                                          <span>Submodules</span>
                                          <strong>No submodules added</strong>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </article>
                            )
                          })}

                          <article className="branch-course-view-model-card branch-course-view-model-card--total" aria-label="Module total">
                            <div className="branch-course-view-model-row branch-course-view-model-row--total" role="row">
                              <div className="branch-course-view-model-cell branch-course-view-model-cell-total-label" role="cell">
                                <strong>Module Total</strong>
                              </div>

                              <div className="branch-course-view-model-cell branch-course-view-model-cell-total-percentage" role="cell">
                                <strong className="branch-course-view-total-percentage">100%</strong>
                              </div>
                            </div>
                          </article>
                        </div>
                      ) : (
                        <div className="branch-course-view-empty-state">
                          No modules added for this course.
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </div>

              {/* 12. Bottom Buttons */}
              <div className="branch-course-view-footer">

                {/* <button
          type="button"
          className="button button-ghost"
          onClick={closeViewCourseDrawer}
        >
          Close
        </button> */}

              </div>
            </aside>
          </div>
        ) : null}
        {courseSaveSuccess ? (
          <div className="branch-modal-backdrop" role="presentation" onClick={closeCourseSaveSuccess}>
            <div
              className="branch-success-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-course-success-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close success popup"
                onClick={closeCourseSaveSuccess}
              >
                <X size={22} strokeWidth={2} />
              </button>

              <div className="branch-success-hero" aria-hidden="true">
                <span className="branch-success-hero-ring" />
                <span className="branch-success-hero-icon">
                  <CheckCircle2 size={30} strokeWidth={2.1} />
                </span>
              </div>

              <div className="branch-success-copy">
                <p className="branch-success-kicker">Success</p>
                <h2 id="branch-course-success-title">{courseSaveSuccess.title}</h2>
                <p>{courseSaveSuccess.message}</p>
              </div>

              <div className="branch-success-actions">
                <button type="button" className="branch-success-secondary" onClick={closeCourseSaveSuccess}>
                  Close
                </button>
                <button type="button" className="branch-success-primary" onClick={closeCourseSaveSuccess}>
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {courseDeleteTarget ? (
          <div className="branch-modal-backdrop" role="presentation">
            <div
              className="branch-success-modal super-admin-logout-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-delete-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close delete confirmation"
                onClick={isCourseDeleting ? undefined : closeDeleteCourseConfirm}
                disabled={isCourseDeleting}
              >
                <X size={22} strokeWidth={2} />
              </button>



              <h2 id="branch-delete-title">Delete this course?</h2>
              <p className="branch-delete-copy">
                {courseDeleteTarget.name || courseDeleteTarget.courseCode || 'This course'} will be removed from the table.
              </p>

              {courseActionError ? <p className="branch-delete-copy" style={{ color: '#dc2626' }}>{courseActionError}</p> : null}

              <div className="branch-modal-actions">
                <button
                  type="button"
                  className="branch-modal-cancel"
                  onClick={closeDeleteCourseConfirm}
                  disabled={isCourseDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="branch-modal-submit is-danger"
                  onClick={handleDeleteCourseConfirm}
                  disabled={isCourseDeleting}
                >
                  {isCourseDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── STUDENT VIEW DRAWER ── */}
        {courseModuleDeleteTarget ? (
          <div className="branch-modal-backdrop" role="presentation">
            <div
              className="course-module-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="course-module-delete-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close delete confirmation"
                onClick={closeCourseModuleDeleteConfirm}
              >
                <X size={22} strokeWidth={2} />
              </button>

              <p className="course-module-delete-kicker">Delete module</p>
              <h2 id="course-module-delete-title">Are you sure you want to delete this module?</h2>
              <p className="branch-delete-copy">
                {courseModuleDeleteTarget.label} will be removed along with its submodules.
              </p>

              <div className="branch-modal-actions">
                <button
                  type="button"
                  className="branch-modal-cancel"
                  onClick={closeCourseModuleDeleteConfirm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="branch-modal-submit is-danger"
                  onClick={handleCourseModuleDeleteConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {courseSubmoduleDeleteTarget ? (
          <div className="branch-modal-backdrop" role="presentation">
            <div
              className="course-module-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="course-submodule-delete-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close delete confirmation"
                onClick={closeCourseSubmoduleDeleteConfirm}
              >
                <X size={22} strokeWidth={2} />
              </button>

              <p className="course-module-delete-kicker">Delete submodule</p>
              <h2 id="course-submodule-delete-title">Are you sure you want to delete this submodule?</h2>
              <p className="branch-delete-copy">
                {courseSubmoduleDeleteTarget.label} will be removed from this module.
              </p>

              <div className="branch-modal-actions">
                <button
                  type="button"
                  className="branch-modal-cancel"
                  onClick={closeCourseSubmoduleDeleteConfirm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="branch-modal-submit is-danger"
                  onClick={handleCourseSubmoduleDeleteConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {viewStudentDrawer ? (
          <div
            className="student-drawer-backdrop"
          >
            <aside
              className="student-view-drawer"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header */}
              <div className="student-view-drawer-header">
                <div>
                  <p className="student-drawer-kicker" style={{ color: '#2563eb' }}>
                    STUDENT DETAILS
                  </p>

                  <h2>
                    {viewStudentDrawer.studentName || 'Student'}
                  </h2>

                  <span className="student-drawer-id">
                    {viewStudentDrawer.studentId || '-'}
                  </span>
                </div>

                <button
                  type="button"
                  className="student-drawer-close"
                  onClick={() => setViewStudentDrawer(null)}
                  aria-label="Close student details"
                >
                  <X size={22} strokeWidth={2} />
                </button>
              </div>

              {/* Body */}
              <div className="student-view-drawer-body">

                {/* Basic Information */}
                <div className="student-detail-section">
                  <h3>Basic Information</h3>

                  <div className="student-detail-grid">

                    <div className="student-detail-item">
                      <span>Student ID</span>
                      <strong>
                        {viewStudentDrawer.studentId || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Student Name</span>
                      <strong>
                        {viewStudentDrawer.studentName || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Email Address</span>
                      <strong>
                        {viewStudentDrawer.emailAddress || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>LinkedIn URL</span>
                      <strong>
                        {viewStudentDrawer.linkedInUrl ? (
                          <a
                            href={formatExternalUrl(viewStudentDrawer.linkedInUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {viewStudentDrawer.linkedInUrl}
                          </a>
                        ) : '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Mobile Number</span>
                      <strong>
                        {viewStudentDrawer.mobileNumber || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Qualification</span>
                      <strong>
                        {viewStudentDrawer.qualification || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Current Status</span>
                      <strong>
                        {viewStudentDrawer.currentStatus || '-'}
                      </strong>
                    </div>

                  </div>
                </div>

                {/* Contact Information */}
                <div className="student-detail-section">
                  <h3>Contact Information</h3>

                  <div className="student-detail-grid">

                    <div className="student-detail-item">
                      <span>Parent / Spouse Number</span>
                      <strong>
                        {viewStudentDrawer.parentSpouseNumber || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Country</span>
                      <strong>
                        {viewStudentDrawer.country || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>State</span>
                      <strong>
                        {viewStudentDrawer.state || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>City</span>
                      <strong>
                        {viewStudentDrawer.city || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item student-detail-full">
                      <span>Address</span>
                      <strong>
                        {viewStudentDrawer.address || '-'}
                      </strong>
                    </div>

                  </div>
                </div>

                {/* Education */}
                <div className="student-detail-section">
                  <h3>Education Details</h3>

                  <div className="student-detail-grid">

                    <div className="student-detail-item">
                      <span>Qualification</span>
                      <strong>
                        {viewStudentDrawer.qualification || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Passed Out Year</span>
                      <strong>
                        {viewStudentDrawer.passedOutYear || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Designation</span>
                      <strong>
                        {viewStudentDrawer.designation || '-'}
                      </strong>
                    </div>

                  </div>
                </div>

                {/* Admission Details */}
                <div className="student-detail-section">
                  <h3>Admission Details</h3>

                  <div className="student-detail-grid">

                    <div className="student-detail-item">
                      <span>Admission Date</span>
                      <strong>
                        {formatStudentDate(
                          viewStudentDrawer.admissionDate
                        )}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Source</span>
                      <strong>
                        {viewStudentDrawer.source || '-'}
                      </strong>
                    </div>
                    {/* 
                    <div className="student-detail-item student-detail-full">
                      <span>Other Source</span>
                      <strong>
                        {viewStudentDrawer.sourceOther || '-'}
                      </strong>
                    </div> */}

                    <div className="student-detail-item student-detail-full">
                      <span>Remarks</span>
                      <strong>
                        {viewStudentDrawer.remarks || '-'}
                      </strong>
                    </div>

                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="student-view-drawer-footer">
                <button
                  type="button"
                  className="button button-solid"
                  onClick={() => {
                    const student = viewStudentDrawer

                    setViewStudentDrawer(null)
                    openEditStudentForm(student)
                  }}
                >
                  Edit Student
                </button>
              </div>

            </aside>
          </div>
        ) : null}

        {/* ── STUDENT VIEW DRAWER ── */}
        {viewStudentDrawer ? (
          <div
            className="student-drawer-overlay"
          >
            <aside
              className="student-view-drawer"
              onClick={(event) => event.stopPropagation()}
            >

              {/* Drawer Header */}
              <div className="student-drawer-header">

                <div className="student-drawer-title-area">
                  <p className="student-drawer-label">
                    STUDENT DETAILS
                  </p>

                  <h2>
                    {viewStudentDrawer.studentName || '-'}
                  </h2>

                  <span className="student-drawer-id">
                    {viewStudentDrawer.studentId || '-'}
                  </span>
                </div>

                <div className="student-drawer-header-actions">

                  <span
                    className={`student-drawer-status ${(viewStudentDrawer.currentStatus || '')
                      .toLowerCase()
                      .replace(/\s+/g, '-')
                      }`}
                  >
                    <span className="student-status-dot"></span>
                    {viewStudentDrawer.currentStatus || 'Student'}
                  </span>

                  <button
                    type="button"
                    className="student-drawer-edit-btn"
                    onClick={() => {
                      const student = viewStudentDrawer
                      setViewStudentDrawer(null)
                      openEditStudentForm(student)
                    }}
                  >
                    Edit Student
                  </button>

                  <button
                    type="button"
                    className="student-drawer-close"
                    onClick={() => setViewStudentDrawer(null)}
                    aria-label="Close student details"
                  >
                    <X size={22} strokeWidth={2} />
                  </button>

                </div>
              </div>

<div className="student-details-tabs">

  {/* Basic Details */}
  <button
    type="button"
    className={`student-details-tab ${
      studentDetailsTab === 'basic' ? 'active' : ''
    }`}
    onClick={() => setStudentDetailsTab('basic')}
  >
    Basic Details
  </button>

  {/* Education Details */}
  <button
    type="button"
    className={`student-details-tab ${
      studentDetailsTab === 'education' ? 'active' : ''
    }`}
    onClick={() => setStudentDetailsTab('education')}
  >
    Education Details
  </button>

  {/* Course & Payment Details */}
  <button
    type="button"
    className={`student-details-tab ${
      studentDetailsTab === 'payment' ? 'active' : ''
    }`}
    onClick={() => setStudentDetailsTab('payment')}
  >
    Course & Payment Details
  </button>

</div>

              {/* Details Table */}
              <div className="student-drawer-content">

                <div className="student-details-table">

                  <div className="student-details-table-head">
                    <div>DETAILS</div>
                    <div>INFORMATION</div>
                  </div>
                  
{studentDetailsTab === 'basic' ? (
  <>
    {/* Student ID
    <div className="student-details-row">
      <div className="student-details-label">Student ID</div>
      <div className="student-details-value">
        {viewStudentDrawer.studentId || '-'}
      </div>
    </div> */}

    {/* Student Name */}
    {/* <div className="student-details-row">
      <div className="student-details-label">Student Name</div>
      <div className="student-details-value">
        {viewStudentDrawer.studentName || '-'}
      </div>
    </div> */}

    {/* Email */}
    <div className="student-details-row">
      <div className="student-details-label">Email Address</div>
      <div className="student-details-value">
        {viewStudentDrawer.emailAddress || '-'}
      </div>
    </div>

    {/* Phone */}
    <div className="student-details-row">
      <div className="student-details-label">Phone Number</div>
      <div className="student-details-value">
        {viewStudentDrawer.mobileNumber || '-'}
      </div>
    </div>

    {/* Parent / Spouse */}
    <div className="student-details-row">
      <div className="student-details-label">
        Parent / Spouse Number
      </div>
      <div className="student-details-value">
        {viewStudentDrawer.parentSpouseNumber || '-'}
      </div>
    </div>

    {/* Country */}
    <div className="student-details-row">
      <div className="student-details-label">Country</div>
      <div className="student-details-value">
        {viewStudentDrawer.country || '-'}
      </div>
    </div>

    {/* State */}
    <div className="student-details-row">
      <div className="student-details-label">State</div>
      <div className="student-details-value">
        {viewStudentDrawer.state || '-'}
      </div>
    </div>

    {/* City */}
    <div className="student-details-row">
      <div className="student-details-label">City</div>
      <div className="student-details-value">
        {viewStudentDrawer.city || '-'}
      </div>
    </div>

    {/* Address */}
    <div className="student-details-row">
      <div className="student-details-label">Address</div>
      <div className="student-details-value">
        {viewStudentDrawer.address || '-'}
      </div>
    </div>
  </>
) : studentDetailsTab === 'education' ? (
  <>
    {/* Qualification */}
    <div className="student-details-row">
      <div className="student-details-label">Qualification</div>
      <div className="student-details-value">
        {viewStudentDrawer.qualification || '-'}
      </div>
    </div>

    {/* Passed Out Year */}
    <div className="student-details-row">
      <div className="student-details-label">Passed Out Year</div>
      <div className="student-details-value">
        {viewStudentDrawer.passedOutYear || '-'}
      </div>
    </div>

    {/* Designation */}
    <div className="student-details-row">
      <div className="student-details-label">Designation</div>
      <div className="student-details-value">
        {viewStudentDrawer.designation || '-'}
      </div>
    </div>

    {/* LinkedIn */}
    <div className="student-details-row">
      <div className="student-details-label">LinkedIn URL</div>
      <div className="student-details-value">
        {viewStudentDrawer.linkedInUrl ? (
          <a
            href={formatExternalUrl(viewStudentDrawer.linkedInUrl)}
            target="_blank"
            rel="noreferrer"
          >
            {viewStudentDrawer.linkedInUrl}
          </a>
        ) : (
          '-'
        )}
      </div>
    </div>

    {/* Admission Date */}
    <div className="student-details-row">
      <div className="student-details-label">Admission Date</div>
      <div className="student-details-value">
        {viewStudentDrawer.admissionDate
          ? formatStudentDate(viewStudentDrawer.admissionDate)
          : '-'}
      </div>
    </div>

    {/* Source */}
    <div className="student-details-row">
      <div className="student-details-label">Source</div>
      <div className="student-details-value">
        {viewStudentDrawer.source || '-'}
      </div>
    </div>

    {/* Remarks */}
    <div className="student-details-row">
      <div className="student-details-label">Remarks</div>
      <div className="student-details-value">
        {viewStudentDrawer.remarks || '-'}
      </div>
    </div>
  </>
) : (
  <>
    {/* Batch */}
    <div className="student-details-row">
      <div className="student-details-label">Batch</div>
      <div className="student-details-value">
        {viewStudentDrawer.batchName || viewStudentDrawer.batchId || '-'}
      </div>
    </div>

    {/* Batch Timing */}
    <div className="student-details-row">
      <div className="student-details-label">Batch Timing</div>
      <div className="student-details-value">
        {viewStudentDrawer.batchTiming || '-'}
      </div>
    </div>

    {/* Course */}
    <div className="student-details-row">
      <div className="student-details-label">Course</div>
      <div className="student-details-value">
        {viewStudentDrawer.courseName || '-'}
      </div>
    </div>

    {/* Faculty */}
    <div className="student-details-row">
      <div className="student-details-label">Faculty</div>
      <div className="student-details-value">
        {viewStudentDrawer.facultyName || '-'}
      </div>
    </div>

    {/* Course Amount */}
    <div className="student-details-row">
      <div className="student-details-label">Course Amount</div>
      <div className="student-details-value">
        {viewStudentDrawer.courseAmount
          ? `₹${viewStudentDrawer.courseAmount}`
          : '-'}
      </div>
    </div>

    {/* Payment Plan */}
    <div className="student-details-row">
      <div className="student-details-label">Payment Plan</div>
      <div className="student-details-value">
        {viewStudentDrawer.paymentPlan || '-'}
      </div>
    </div>

  {/* Installment Schedule */}
{Array.isArray(viewStudentDrawer.installmentSchedule) &&
  viewStudentDrawer.installmentSchedule.length > 0 && (
    <div className="student-installment-schedule">
      
      {/* Heading */}
      <div className="student-installment-schedule-title">
        Installment Schedule
      </div>

      {/* Full Width Table */}
      <div className="student-payment-table-wrapper">
        <table className="student-payment-installment-table">
          <thead>
            <tr>
              <th>Installment</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {viewStudentDrawer.installmentSchedule.map((inst, index) => (
              <tr key={`view-inst-${index}`}>
                <td>
                  Installment {inst.installmentNumber}
                </td>

                <td>
                  {formatBranchRupees(inst.amount || 0)}
                </td>

                <td>
                  {inst.dueDate
                    ? new Date(inst.dueDate).toLocaleDateString('en-GB')
                    : '-'}
                </td>

                <td>
                  <span
                    className={`status-badge status-${String(
                      inst.status || 'pending'
                    ).toLowerCase()}`}
                  >
                    {inst.status || 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )}
  </>
)}
                </div>

              </div>
            </aside>
          </div>
        ) : null}
      


        {/* ── STUDENT FORM MODAL ── */}
        {isStudentFormOpen ? (
          <div className="course-modal-backdrop" role="presentation">
            <form
              className="course-modal panel-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-student-form-title"
              onClick={(event) => event.stopPropagation()}
              onSubmit={handleStudentFormSubmit}
              style={{
                maxWidth: 900,
                width: '92%',
                maxHeight: '92vh',
                overflowY: 'auto'
              }}
            >
              <div className="course-modal-header">
                <div>
                  <p className="section-kicker">Student Entry</p>
                  <h3 id="branch-student-form-title">
                    {studentFormMode === 'add' ? 'Add Student' : studentFormMode === 'edit' ? 'Edit Student' : 'View Student'}
                  </h3>
                </div>
                <span className="detail-badge">
                  {studentFormMode === 'view' ? 'Read-only' : 'Required fields marked *'}
                </span>
              </div>

              <div className={`student-stepper ${studentFormMode === 'view' ? 'is-view-mode' : ''}`.trim()}>
                {[
                  { step: 1, title: 'Personal & Education' },
                  { step: 2, title: 'Admission Details & Review' },
                  { step: 3, title: 'Course & Payment Plan' },
                ].map((item) => {
                  const isActive = studentFormStep === item.step
                  const isDone = studentFormStep > item.step
                  const content = (
                    <>
                      <span>{String(item.step).padStart(2, '0')}</span>
                      <div className="student-stepper-copy">
                        <strong>{item.title}</strong>
                      </div>
                    </>
                  )

                  return (
                    <button
                      key={item.step}
                      type="button"
                      className={`student-stepper-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${studentFormMode !== 'view' && item.step > studentFormMaxUnlockedStep ? 'is-locked' : ''}`.trim()}
                      aria-current={isActive ? 'step' : undefined}
                      aria-disabled={studentFormMode !== 'view' && item.step > studentFormMaxUnlockedStep}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleStudentStepJump(item.step)
                      }}
                    >
                      {content}
                    </button>
                  )
                })}
              </div>

              {studentFormMode !== 'view' && studentActiveStepError ? (
                <div className="course-validation-note course-validation-error" style={{ marginBottom: 12 }}>
                  <span>{studentActiveStepError}</span>
                </div>
              ) : null}

             <div className="student-step-panel">

  {/* =====================================================
      STEP 1 — PERSONAL & EDUCATION
  ====================================================== */}
  {studentFormStep === 1 && (
    <div className="student-step-section">
      <div className="course-form-grid student-form-grid-tight">

        <Field
          label="Student ID"
          required
          error={
            shouldShowStudentError('studentIdSuffix')
              ? studentFormValidationErrors.studentIdSuffix
              : ''
          }
        >
          <div className="student-id-input-group">
            <span className="student-id-prefix" aria-hidden="true">
              {STUDENT_ID_PREFIX}
            </span>

            <input
              type="text"
              inputMode="numeric"
              placeholder="001"
              value={studentForm.studentIdSuffix || ''}
              onChange={(e) =>
                handleStudentIdSuffixChange(e.target.value)
              }
              onBlur={handleStudentIdSuffixBlur}
              disabled={studentFormMode === 'view'}
            />
          </div>
        </Field>

        <Field
          label="Student Name"
          required
          error={
            shouldShowStudentError('studentName')
              ? studentFormValidationErrors.studentName
              : ''
          }
        >
          <input
            type="text"
            placeholder="Enter student name"
            value={studentForm.studentName}
            onChange={(e) =>
              updateStudentField(
                'studentName',
                e.target.value.replace(/[^A-Za-z ]/g, '')
              )
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                studentName: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Email Address"
          required
          error={
            shouldShowStudentError('emailAddress')
              ? studentFormValidationErrors.emailAddress
              : ''
          }
        >
          <input
            type="email"
            placeholder="Enter email address"
            value={studentForm.emailAddress}
            onChange={(e) =>
              updateStudentField('emailAddress', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                emailAddress: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Mobile Number"
          required
          error={
            shouldShowStudentError('mobileNumber')
              ? studentFormValidationErrors.mobileNumber
              : ''
          }
        >
          <input
            type="text"
            inputMode="numeric"
            placeholder="10 digit mobile number"
            value={studentForm.mobileNumber}
            onChange={(e) =>
              updateStudentField(
                'mobileNumber',
                e.target.value.replace(/\D/g, '').slice(0, 10)
              )
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                mobileNumber: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Parent / Spouse Number"
          required
          error={
            shouldShowStudentError('parentSpouseNumber')
              ? studentFormValidationErrors.parentSpouseNumber
              : ''
          }
        >
          <input
            type="text"
            inputMode="numeric"
            placeholder="10 digit number"
            value={studentForm.parentSpouseNumber}
            onChange={(e) =>
              updateStudentField(
                'parentSpouseNumber',
                e.target.value.replace(/\D/g, '').slice(0, 10)
              )
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                parentSpouseNumber: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Country"
          required
          error={
            shouldShowStudentError('country')
              ? studentFormValidationErrors.country
              : ''
          }
        >
          <select
            value={studentForm.countryCode}
            onChange={(e) => {
              const code = e.target.value;
              const name =
                stuCountryOptions.find((c) => c.iso2 === code)?.name || '';

              setStudentForm((c) => ({
                ...c,
                countryCode: code,
                country: name,
                stateCode: '',
                state: '',
                city: '',
              }));
            }}
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                country: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          >
            <option value="" disabled>
              Select Country
            </option>

            {stuCountryOptions.map((c) => (
              <option key={c.iso2} value={c.iso2}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="State"
          required
          error={
            shouldShowStudentError('state')
              ? studentFormValidationErrors.state
              : ''
          }
        >
          <select
            value={studentForm.stateCode}
            onChange={(e) => {
              const code = e.target.value;
              const name =
                stuStateOptions.find((s) => s.iso2 === code)?.name || '';

              setStudentForm((c) => ({
                ...c,
                stateCode: code,
                state: name,
                city: '',
              }));
            }}
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                state: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              !studentForm.countryCode
            }
          >
            <option value="" disabled>
              Select State
            </option>

            {stuStateOptions.map((s) => (
              <option key={s.iso2} value={s.iso2}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="City"
          required
          error={
            shouldShowStudentError('city')
              ? studentFormValidationErrors.city
              : ''
          }
        >
          <select
            value={studentForm.city}
            onChange={(e) =>
              updateStudentField('city', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                city: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              !studentForm.stateCode
            }
          >
            <option value="" disabled>
              Select City
            </option>

            {stuCityOptions.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Address"
          required
          error={
            shouldShowStudentError('address')
              ? studentFormValidationErrors.address
              : ''
          }
        >
          <input
            type="text"
            placeholder="Enter full address"
            value={studentForm.address}
            onChange={(e) =>
              updateStudentField('address', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                address: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Qualification"
          required
          error={
            shouldShowStudentError('qualification')
              ? studentFormValidationErrors.qualification
              : ''
          }
        >
          <input
            type="text"
            placeholder="Enter qualification"
            value={studentForm.qualification}
            onChange={(e) =>
              updateStudentField('qualification', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                qualification: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Passed Out Year"
          required
          error={
            shouldShowStudentError('passedOutYear')
              ? studentFormValidationErrors.passedOutYear
              : ''
          }
        >
          <select
            value={studentForm.passedOutYear}
            onChange={(e) =>
              updateStudentField('passedOutYear', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                passedOutYear: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          >
            <option value="" disabled>
              Select Year
            </option>

            {PASSED_OUT_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}

            <option value="Custom">Custom</option>
          </select>
        </Field>

        {studentForm.passedOutYear === 'Custom' && (
          <Field
            label="Specify Year"
            required
            error={
              shouldShowStudentError('passedOutYearCustom')
                ? studentFormValidationErrors.passedOutYearCustom
                : ''
            }
          >
            <input
              type="text"
              placeholder="Enter year"
              value={studentForm.passedOutYearCustom}
              onChange={(e) =>
                updateStudentField(
                  'passedOutYearCustom',
                  e.target.value
                )
              }
              onBlur={() =>
                setStudentFormTouched((c) => ({
                  ...c,
                  passedOutYearCustom: true,
                }))
              }
              disabled={studentFormMode === 'view'}
            />
          </Field>
        )}

      </div>
    </div>
  )}


  {/* =====================================================
      STEP 2 — ADMISSION DETAILS & REVIEW
  ====================================================== */}
  {studentFormStep === 2 && (
    <div className="student-step-section">
      <div className="course-form-grid student-form-grid-tight">

        <Field label="LinkedIn URL">
          <input
            type="text"
            inputMode="url"
            placeholder="https://www.linkedin.com/in/your-profile"
            value={studentForm.linkedInUrl}
            onChange={(e) =>
              updateStudentField('linkedInUrl', e.target.value)
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Current Status"
          required
          error={
            shouldShowStudentError('currentStatus')
              ? studentFormValidationErrors.currentStatus
              : ''
          }
        >
          <select
            value={studentForm.currentStatus}
            onChange={(e) => {
              const val = e.target.value;

              setStudentForm((c) => ({
                ...c,
                currentStatus: val,
                designation:
                  val !== 'Employee' ? '' : c.designation,
              }));
            }}
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                currentStatus: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          >
            <option value="" disabled>
              Select Status
            </option>
            <option value="Student">Student</option>
            <option value="Employee">Employee</option>
            <option value="Other">Other</option>
          </select>
        </Field>

        <Field
          label="Designation"
          required={studentForm.currentStatus === 'Employee'}
          error={
            shouldShowStudentError('designation')
              ? studentFormValidationErrors.designation
              : ''
          }
        >
          <input
            type="text"
            placeholder={
              studentForm.currentStatus === 'Employee'
                ? 'Enter designation'
                : 'Select Employee first'
            }
            value={studentForm.designation}
            onChange={(e) =>
              updateStudentField('designation', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                designation: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              studentForm.currentStatus !== 'Employee'
            }
          />
        </Field>

        <Field
          label="How did you know about our Institute?"
          required
          error={
            shouldShowStudentError('source')
              ? studentFormValidationErrors.source
              : ''
          }
        >
          <select
            value={studentForm.source}
            onChange={(e) =>
              updateStudentField('source', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                source: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          >
            <option value="" disabled>
              Select Source
            </option>
            <option value="Sulekha">Sulekha</option>
            <option value="Justdial">Justdial</option>
            <option value="Website">Website</option>
            <option value="Poster">Poster</option>
            <option value="Others">Others</option>
          </select>
        </Field>

        {studentForm.source === 'Others' && (
          <Field
            label="Please Specify"
            required
            error={
              shouldShowStudentError('sourceOther')
                ? studentFormValidationErrors.sourceOther
                : ''
            }
          >
            <input
              type="text"
              placeholder="How did you hear about us?"
              value={studentForm.sourceOther}
              onChange={(e) =>
                updateStudentField('sourceOther', e.target.value)
              }
              onBlur={() =>
                setStudentFormTouched((c) => ({
                  ...c,
                  sourceOther: true,
                }))
              }
              disabled={studentFormMode === 'view'}
            />
          </Field>
        )}

        <Field label="Remarks">
          <input
            type="text"
            placeholder="Optional remarks"
            value={studentForm.remarks}
            onChange={(e) =>
              updateStudentField('remarks', e.target.value)
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Admission Date"
          required
          error={
            shouldShowStudentError('admissionDate')
              ? studentFormValidationErrors.admissionDate
              : ''
          }
        >
          <input
            type="date"
            value={studentForm.admissionDate}
            onChange={(e) =>
              updateStudentField('admissionDate', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                admissionDate: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

      </div>
    </div>
  )}


  {/* =====================================================
      STEP 3 — COURSE & PAYMENT PLAN
  ====================================================== */}
  {studentFormStep === 3 && (
    <div className="student-step-section">

     

      <div className="course-form-grid student-form-grid-tight">

        <Field
          label="Select Course"
          required
          error={
            shouldShowStudentError('courseId')
              ? studentFormValidationErrors.courseId
              : ''
          }
        >
          <select
            value={studentForm.courseId}
            onChange={(e) =>
              handleStudentCourseChange(e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                courseId: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              !studentCourseOptions.length
            }
          >
            <option value="">Select Course</option>

            {studentCourseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}

            {!studentCourseOptions.length && (
              <option value="" disabled>
                No courses available
              </option>
            )}
          </select>
        </Field>

        <Field
          label="Select Batch"
          required
          error={
            shouldShowStudentError('batchId')
              ? studentFormValidationErrors.batchId
              : ''
          }
        >
          <select
            value={selectedStudentBatchOption?.batchId || selectedStudentBatchOption?.batchName || studentForm.batchId || studentForm.batchName || ''}
            onChange={(e) =>
              handleStudentBatchChange(e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                batchId: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              !studentForm.courseId ||
              !hasSelectableStudentBatchOption
            }
          >
            <option value="">
              {studentForm.courseId
                ? (hasSelectableStudentBatchOption ? 'Select Batch' : 'No seats available')
                : 'Select Course first'}
            </option>

            {selectedStudentCourseBatchOptions.map((batch) => (
              <option
                key={`${batch.batchId}-${batch.batchName}`}
                value={batch.batchId}
                disabled={!batch.isSelectable}
              >
                {batch.label}
              </option>
            ))}

            {studentForm.courseId &&
              !selectedStudentCourseBatchOptions.length && (
                <option value="" disabled>
                  No batches available for this course
                </option>
              )}
          </select>
          {selectedStudentBatchOption ? (
            <small className={`student-batch-seat-note ${selectedStudentBatchOption.isFull ? 'is-full' : ''}`.trim()}>
              {selectedStudentBatchOption.isFull
                ? 'No seats available for this batch.'
                : `${selectedStudentBatchOption.availableSeats} seat${selectedStudentBatchOption.availableSeats === 1 ? '' : 's'} left out of ${selectedStudentBatchOption.totalSeats}`}
            </small>
          ) : null}
        </Field>

        <Field
          label="Batch Timing"
          required
          error={
            shouldShowStudentError('batchTiming')
              ? studentFormValidationErrors.batchTiming
              : ''
          }
        >
          <input
            type="text"
            value={selectedStudentBatchOption?.batchTiming || studentForm.batchTiming || ''}
            readOnly
            placeholder={
              studentForm.courseId
                ? 'Select batch to auto-fill timing'
                : 'Select course first'
            }
          />
        </Field>

        <Field
          label="Total Course Amount"
          required
          error={
            shouldShowStudentError('courseAmount')
              ? studentFormValidationErrors.courseAmount
              : ''
          }
        >
          <input
            type="text"
            value={selectedStudentCourseAmount}
            readOnly
            placeholder={
              studentForm.courseId
                ? 'Auto-filled from selected course'
                : 'Select course first'
            }
          />
        </Field>

       <Field
         label="Payment Plan"
         required
         error={
           shouldShowStudentError('paymentPlanId')
             ? studentFormValidationErrors.paymentPlanId
             : ''
         }
       >
  <select
    value={studentForm.paymentPlanId || ''}
    onChange={(e) => {
      const planId = e.target.value

      const selectedPlan =
        selectedStudentCoursePaymentPlans.find(
          (plan) => String(plan.id) === String(planId)
        ) || null

      setStudentForm((current) => ({
        ...current,
        paymentPlanId: planId,
        paymentPlan: selectedPlan?.templateName || '',
      }))
    }}
    disabled={
      studentFormMode === 'view' ||
      !studentForm.courseId ||
      !selectedStudentCoursePaymentPlans.length
    }
  >
    <option value="">Select Payment Plan</option>

    {selectedStudentCoursePaymentPlans.map((plan) => (
      <option key={plan.id} value={plan.id}>
        {plan.templateName}
      </option>
    ))}

    {studentForm.courseId &&
      !selectedStudentCoursePaymentPlans.length && (
        <option value="" disabled>
          No payment plans configured for this course
        </option>
      )}
  </select>
</Field>

      </div>

      {studentInstallmentAmounts.length > 0 && (
  <div className="student-payment-installment-section">
    <div className="student-payment-installment-header">
      <div>
        <h4>Payment Schedule</h4>
        <span>
          {selectedStudentPaymentPlan?.templateName || 'Selected Payment Plan'}
        </span>
      </div>

      <div className="student-payment-installment-total">
        <span>Total Course Amount</span>
        <strong>
          ₹{Number(
            String(selectedStudentCourseAmount || '').replace(/,/g, '')
          ).toLocaleString('en-IN')}
        </strong>
      </div>
    </div>

    <div className="student-payment-installment-table-wrapper">
      <table className="student-payment-installment-table">
        <thead>
          <tr>
            <th>Installment</th>
            <th>Amount</th>
            <th>Due Date</th>
          </tr>
        </thead>

        <tbody>
         {studentInstallmentAmounts.map((amount, index) => (
  <tr key={`student-installment-${index}`}>
    <td>Installment {index + 1}</td>

    <td>
      {formatBranchRupees(amount)}
    </td>

    <td>
      <input
        type="date"
        value={studentInstallmentDueDates[index] || ''}
        onChange={(e) => {
          const value = e.target.value

          setStudentInstallmentDueDates((current) => {
            const next = [...current]
            next[index] = value
            return next
          })
        }}
        disabled={studentFormMode === 'view'}
        className="student-installment-due-date-input"
      />
    </td>
  </tr>
))}

          <tr className="student-payment-installment-total-row">
            <td>
              <strong>Total</strong>
            </td>
            <td>
              <strong>{formatBranchRupees(studentInstallmentAmounts.reduce((sum, amount) => sum + amount, 0))}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
)}

    </div>
  )}

</div>

              {studentFormError ? (
                <div className="course-validation-note course-validation-error" style={{ color: '#dc2626' }}>
                  <span style={{ color: '#dc2626' }}>{studentFormError}</span>
                </div>
              ) : null}

              <div className="course-form-actions">
                {studentFormMode === 'view' ? (
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      setIsStudentFormOpen(false)
                      setStudentFormStep(1)
                    }}
                  >
                    Close
                  </button>
                ) : studentFormStep === 1 ? (
                  <>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => {
                        setIsStudentFormOpen(false)
                        setStudentFormStep(1)
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="button button-solid"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleStudentStepNext()
                      }}
                    >
                      Next
                    </button>
                  </>
                ) : studentFormStep === 2 ? (
                  <>
                    <button type="button" className="button button-ghost" onClick={handleStudentStepBack}>
                      Back
                    </button>
                    <button
                      type="button"
                      className="button button-solid"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleStudentStepNext()
                      }}
                    >
                      Next
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="button button-ghost" onClick={handleStudentStepBack}>
                      Back
                    </button>
                    <button type="submit" className="button button-solid" disabled={isStudentSaving}>
                      {isStudentSaving ? 'Saving...' : (studentFormMode === 'add' ? 'Submit' : 'Save Changes')}
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                className="course-modal-close"
                onClick={() => {
                  setIsStudentFormOpen(false)
                  setStudentFormStep(1)
                }}
                aria-label="Close student form"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </form>
          </div>
        ) : null}


        {/* ── STUDENT DELETE CONFIRM ── */}
        {studentDeleteTarget ? (
          <div className="branch-modal-backdrop" role="presentation">
            <div
              className="branch-success-modal super-admin-logout-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="student-delete-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close delete confirmation"
                onClick={() => setStudentDeleteTarget(null)}
                disabled={isStudentDeleting}
              >
                <X size={22} strokeWidth={2} />
              </button>

              <h2 id="student-delete-title">Delete Student?</h2>

              <p className="branch-delete-copy">
                Are you sure you want to delete this student?
              </p>

              <div className="branch-modal-actions">
                <button
                  type="button"
                  className="branch-modal-cancel"
                  onClick={() => setStudentDeleteTarget(null)}
                  disabled={isStudentDeleting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="branch-modal-submit is-danger"
                  onClick={handleStudentDeleteConfirm}
                  disabled={isStudentDeleting}
                >
                  {isStudentDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── LOGOUT CONFIRM ── */}
        {isLogoutConfirmOpen ? (
          <div
            className="branch-modal-backdrop"
            role="presentation"
          >
            <div
              className="branch-success-modal super-admin-logout-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-confirm-title"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close logout confirmation"
                onClick={closeLogoutConfirm}
              >
                <X size={22} strokeWidth={2} />
              </button>

              {/* Logout Message */}
              <h2 id="logout-confirm-title">
                Are you sure you want to logout?
              </h2>

              {/* Actions */}
              <div className="branch-modal-actions">
                <button
                  type="button"
                  className="branch-modal-cancel"
                  onClick={closeLogoutConfirm}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="branch-modal-submit is-danger"
                  onClick={handleConfirmLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        ) : null}


        {/* ── STUDENT SUCCESS POPUP ── */}
        {studentSuccessPopup ? (
          <div className="branch-modal-backdrop" role="presentation">
            <div
              className="branch-success-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="student-success-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close success popup"
                onClick={() => setStudentSuccessPopup(null)}
              >
                <X size={22} strokeWidth={2} />
              </button>

              <div className="branch-success-hero" aria-hidden="true">
                <span className="branch-success-hero-ring" />
                <span className="branch-success-hero-icon">
                  <CheckCircle2 size={30} strokeWidth={2.1} />
                </span>
              </div>

              <div className="branch-success-copy">
                <p className="branch-success-kicker">Success</p>

                <h2 id="student-success-title">
                  {studentSuccessPopup.title}
                </h2>

                <p>{studentSuccessPopup.message}</p>
              </div>

              <div className="branch-success-actions">
                <button
                  type="button"
                  className="branch-success-primary"
                  onClick={() => setStudentSuccessPopup(null)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
