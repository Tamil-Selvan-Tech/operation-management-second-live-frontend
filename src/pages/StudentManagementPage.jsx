import { isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  Landmark,
  Layers3,
  Mail,
  MapPin,
  LoaderCircle,
  Percent,
  Phone,
  UserRound,
  FileDown,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { OperationManagerHeader } from '../components/OperationManagerHeader'
import { OperationManagerWorkspaceHeader } from '../components/OperationManagerWorkspaceHeader'
import { SearchBar } from '../components/SearchBar'
import { PaginationBar } from '../components/PaginationBar'
import { roleDashboards } from '../data/authData'
import { FACULTY_RECORD_SYNC_EVENT, loadFacultyRecords } from '../data/facultyRecords'
import { saveStudentRecords } from '../data/studentRecords'
import { COURSE_RECORD_SYNC_EVENT } from '../data/courseRecords'
import { listCourses } from '../services/courseService'
import { listFacultyRecords, normalizeFacultyList } from '../services/facultyService'
import { downloadBatchAttendanceReport, downloadStudentAttendanceReport } from '../services/reportService'
import { createStudent, deleteStudent, listStudents, updateStudent } from '../services/studentService'
import { savePendingLoginEmail } from '../lib/session'
import { enrichStudentsWithFacultyReferences, getFacultyBatchEntryById, getFacultyCourseName, getMatchingStudents } from '../lib/facultyFlow'
import { FACULTY_BATCH_ATTENDANCE_SYNC_EVENT, resolveStudentBatchAttendanceStatus } from '../lib/facultyAttendanceStore'
import { loadStudentSnapshot, mergeStudentsWithSnapshot, saveStudentSnapshot } from '../lib/studentSnapshot'
import { useMobileMenu } from '../layouts/mobileMenuContext'

const statusOptions = ['Student', 'Employee', 'Other']
const recordStatusOptions = ['Active', 'Inactive']
const paymentModeOptions = ['Installment', 'Full Payment']
const sourceOptions = ['Justdial', 'Sulekha', 'Website', 'Poster', 'Others']
const MAX_INSTALLMENT_FIELDS = 12
const studentWizardSteps = [
  {
    key: 'basic',
    title: 'Basic Information',
    subtitle: 'Personal & Contact Details',
    description: 'Please provide the basic details of the student.',
  },
  {
    key: 'education',
    title: 'Education Details',
    subtitle: 'Academic Information',
    description: 'Choose the course and academic background.',
  },
  {
    key: 'admission',
    title: 'Admission Details',
    subtitle: 'Admission & Other Info',
    description: 'Complete the fee and admission setup before submitting.',
  },
]

function getPassedOutYearOptions() {
  const currentYear = new Date().getFullYear()
  const years = []

  for (let year = currentYear + 1; year >= 1950; year -= 1) {
    years.push(String(year))
  }

  return years
}

function getTodayValue() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createEmptyForm() {
  return {
    facultyId: '',
    batchId: '',
    courseId: '',
    studentName: '',
    mobileNumber: '',
    emailAddress: '',
    courseInterested: '',
    facultyName: '',
    batch: '',
    qualification: '',
    passedOutYear: '',
    currentStatus: '',
    designation: '',
    location: '',
    source: '',
    status: 'Active',
    paymentMode: 'Installment',
    actualFees: '',
    registrationFees: '',
    discount: '',
    afterDiscount: '',
    installment1: '',
    installment2: '',
    installment3: '',
    installment4: '',
    firstInstallmentAmount: '',
    firstInstallmentDate: '',
    firstInstallmentStatus: 'Pending',
    firstInstallmentPaidAt: '',
    secondInstallmentAmount: '',
    secondDueDate: '',
    secondInstallmentStatus: 'Pending',
    secondInstallmentPaidAt: '',
    thirdInstallmentAmount: '',
    thirdDueDate: '',
    thirdInstallmentStatus: 'Pending',
    thirdInstallmentPaidAt: '',
    remarks: '',
    parentSpouseNumber: '',
    admissionDate: getTodayValue(),
  }
}

function formatCurrency(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function addOneMonth(value, months = 1) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''

  const dueDate = new Date(date)
  dueDate.setMonth(dueDate.getMonth() + months)

  return dueDate.toISOString().slice(0, 10)
}

function apiErrorMessage(error, fallback) {
  return error?.body?.message || error?.message || fallback
}

function diffInDays(a, b) {
  const start = new Date(`${a}T00:00:00`)
  const end = new Date(`${b}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const ms = 24 * 60 * 60 * 1000
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / ms))
}

function hasThirdInstallment(student = null, course = null) {
  return Boolean(
    student?.installment3 ||
      student?.thirdInstallmentAmount ||
      student?.thirdDueDate ||
      String(course?.installmentCount ?? student?.course?.installmentCount ?? '') === '3' ||
      String(course?.installment3 ?? student?.course?.installment3 ?? '') !== '',
  )
}

function hasFourthInstallment(student = null, course = null) {
  const courseInstallmentCount = Array.isArray(course?.installments) ? course.installments.length : 0

  return Boolean(
    student?.installment4 ||
      student?.fourthInstallmentAmount ||
      student?.fourthDueDate ||
      courseInstallmentCount >= 4 ||
      String(course?.installment4 ?? student?.course?.installment4 ?? '') !== '',
  )
}

function getSecondDueDate(student) {
  return student?.secondDueDate || addOneMonth(student?.admissionDate)
}

function getThirdDueDate(student) {
  if (!hasThirdInstallment(student)) return ''
  return student?.thirdDueDate || addOneMonth(getSecondDueDate(student))
}

function getFourthDueDate(student, course = null) {
  if (!hasFourthInstallment(student, course)) return ''
  return student?.fourthDueDate || addOneMonth(getThirdDueDate(student) || addOneMonth(getSecondDueDate(student)))
}

function isInstallmentSettled(entity = null) {
  const firstPaid = String(entity?.firstInstallmentStatus || 'Pending') === 'Paid'
  const secondPaid = String(entity?.secondInstallmentStatus || 'Pending') === 'Paid'
  const thirdPaid = hasThirdInstallment(entity) ? String(entity?.thirdInstallmentStatus || 'Pending') === 'Paid' : true
  const fourthPaid = hasFourthInstallment(entity) ? String(entity?.fourthInstallmentStatus || 'Pending') === 'Paid' : true

  return firstPaid && secondPaid && thirdPaid && fourthPaid
}

function isFullPaymentMode(entity = null) {
  return String(entity?.paymentMode || 'Installment').trim() === 'Full Payment'
}

function isFullPaymentRecord(entity = null) {
  return isFullPaymentMode(entity) || isInstallmentSettled(entity)
}

function getPaymentModeLabel(entity = null) {
  return isFullPaymentRecord(entity) ? 'Full Payment' : 'Installment'
}

function getVisibleInstallmentStage(student, course = null) {
  if (isFullPaymentRecord(student)) return 0
  const firstPaid = String(student?.firstInstallmentStatus || 'Pending') === 'Paid'
  const secondPaid = String(student?.secondInstallmentStatus || 'Pending') === 'Paid'
  const thirdPaid = hasThirdInstallment(student, course) ? String(student?.thirdInstallmentStatus || 'Pending') === 'Paid' : true
  const fourthPaid = hasFourthInstallment(student, course) ? String(student?.fourthInstallmentStatus || 'Pending') === 'Paid' : true

  if (!firstPaid) return 1
  if (!secondPaid) return 2
  if (hasThirdInstallment(student, course) && !thirdPaid) return 3
  if (hasFourthInstallment(student, course) && !fourthPaid) return 4
  return 0
}

function findCourseForStudent(student, courseOptions) {
  return (
    courseOptions.find((course) => course.id === student.courseId) ||
    courseOptions.find((course) => course.name === student.courseInterested) ||
    student.course ||
    null
  )
}

function findCourseForForm(courseOptions, form) {
  return (
    courseOptions.find((course) => course.id === form.courseId) ||
    courseOptions.find((course) => course.name === form.courseInterested) ||
    null
  )
}

function findFacultyForForm(facultyOptions, form) {
  const normalizedFacultyId = String(form.facultyId || '').trim().toLowerCase()
  const normalizedFacultyName = String(form.facultyName || '').trim().toLowerCase()
  const normalizedCourseId = String(form.courseId || '').trim()

  return (
    facultyOptions.find((faculty) => String(faculty?.id || '').trim().toLowerCase() === normalizedFacultyId) ||
    facultyOptions.find(
      (faculty) =>
        facultyMatchesCourse(faculty, normalizedCourseId) &&
        String(faculty?.facultyName || '').trim().toLowerCase() === normalizedFacultyName,
    ) ||
    facultyOptions.find((faculty) => String(faculty?.facultyName || '').trim().toLowerCase() === normalizedFacultyName) ||
    null
  )
}

function facultyMatchesCourse(faculty, courseId = '') {
  const normalizedCourseId = String(courseId || '').trim()
  if (!normalizedCourseId) return false

  const facultyCourseIds = Array.isArray(faculty?.courseIds)
    ? faculty.courseIds.map((id) => String(id || '').trim()).filter(Boolean)
    : []

  return (
    facultyCourseIds.includes(normalizedCourseId) ||
    String(faculty?.courseId || '').trim() === normalizedCourseId ||
    (Array.isArray(faculty?.batchEntries)
      ? faculty.batchEntries.some((entry) => String(entry?.courseId || '').trim() === normalizedCourseId)
      : false)
  )
}

function getBatchTimingLabel(entry = {}) {
  const batchName = String(entry.batchName || '').trim()
  const batchTiming = String(entry.batchTiming || '').trim()

  if (!batchName) return ''
  return batchTiming ? `${batchName} - ${batchTiming}` : batchName
}

function StudentBatchDisplay({ student, facultyOptions = [] }) {
  const batchName = String(student?.batchName || student?.batch || '').trim()
  if (!batchName) return <span className="student-detail-text">-</span>

  const normalizedCourseId = String(student?.courseId || '').trim()
  const normalizedFacultyName = String(student?.facultyName || '').trim().toLowerCase()
  const faculty =
    facultyOptions.find(
      (item) =>
        String(item?.courseId || '').trim() === normalizedCourseId &&
        String(item?.facultyName || '').trim().toLowerCase() === normalizedFacultyName,
    ) ||
    facultyOptions.find((item) => String(item?.facultyName || '').trim().toLowerCase() === normalizedFacultyName) ||
    null

  const matchedBatch = Array.isArray(faculty?.batchEntries)
    ? faculty.batchEntries.find((entry) => String(entry?.batchName || '').trim() === batchName)
    : null

  const batchTiming = String(matchedBatch?.batchTiming || '').trim()

  return (
    <span className="student-batch-display" style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
      <span>{batchName}</span>
      {batchTiming ? <small>{batchTiming}</small> : null}
    </span>
  )
}

function mapCourseToForm(current, course) {
  const nextForm = { ...current }
  for (let index = 1; index <= MAX_INSTALLMENT_FIELDS; index += 1) {
    nextForm[`installment${index}`] = ''
  }

  if (!course) {
    return {
      ...nextForm,
      facultyId: '',
      batchId: '',
      courseId: '',
      courseInterested: '',
      actualFees: '',
      registrationFees: '',
      discount: '',
      afterDiscount: '',
      facultyName: '',
      batch: '',
    }
  }

  const courseInstallments = getCourseInstallmentValues(course)
  const actualFees = String(course.actualFees ?? '')
  const discount = String(course.discount ?? '')
  const afterDiscount =
    String(course.afterDiscount ?? '') ||
    (actualFees !== '' && discount !== '' ? String(Math.max(Number(actualFees) - Number(discount), 0)) : '')

  courseInstallments.forEach((value, index) => {
    nextForm[`installment${index + 1}`] = value
  })

  return {
    ...nextForm,
    facultyId: '',
    batchId: '',
    courseId: course.id,
    courseInterested: course.name,
    facultyName: '',
    batch: '',
    actualFees,
    registrationFees: String(course.registrationFees ?? ''),
    discount,
    afterDiscount,
  }
}

function getCourseInstallmentValues(course = null) {
  const storedInstallments = Array.isArray(course?.installments) ? course.installments : []

  if (storedInstallments.length) {
    return storedInstallments.map((value) => String(value ?? '').trim()).filter((value) => value !== '')
  }

  const explicitCount = normalizeInstallmentCount(course?.installmentCount)
  const fallbackCount = explicitCount > 0 ? Math.min(explicitCount, MAX_INSTALLMENT_FIELDS) : MAX_INSTALLMENT_FIELDS

  return Array.from({ length: fallbackCount }, (_, index) => String(course?.[`installment${index + 1}`] ?? '').trim()).filter((value) => value !== '')
}

function normalizeInstallmentCount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 1) return 0
  return Math.floor(amount)
}

function getCourseInstallmentCount(course = null) {
  const explicitCount = normalizeInstallmentCount(course?.installmentCount)
  if (explicitCount > 0) return explicitCount
  return getCourseInstallmentValues(course).length
}

function getInstallmentFieldNames(count = MAX_INSTALLMENT_FIELDS) {
  return Array.from({ length: Math.min(Math.max(Number(count) || 0, 0), MAX_INSTALLMENT_FIELDS) }, (_, index) => `installment${index + 1}`)
}

function applyInstallmentValues(target = {}, values = []) {
  const nextTarget = { ...target }
  getInstallmentFieldNames().forEach((fieldName) => {
    nextTarget[fieldName] = ''
  })
  values.forEach((value, index) => {
    nextTarget[`installment${index + 1}`] = value
  })
  return nextTarget
}

function getRequiredInstallmentCount(course = null) {
  return getCourseInstallmentCount(course)
}

function validateForm(form, course = null) {
  const errors = {}
  const currentYear = new Date().getFullYear()
  const isFullPayment = isFullPaymentMode(form)
  const requiredInstallmentCount = isFullPayment ? 0 : getRequiredInstallmentCount(course)

  if (!form.studentName.trim()) errors.studentName = 'Student name is required.'

  if (!/^\d{10}$/.test(form.mobileNumber.trim())) {
    errors.mobileNumber = 'Enter a valid 10-digit mobile number.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAddress.trim())) {
    errors.emailAddress = 'Enter a valid email address.'
  }

  if (!form.qualification.trim()) errors.qualification = 'Qualification is required.'

  const passedOutYear = Number(form.passedOutYear)
  if (!/^\d{4}$/.test(String(form.passedOutYear).trim()) || passedOutYear < 1950 || passedOutYear > currentYear + 1) {
    errors.passedOutYear = 'Enter a valid passed out year.'
  }

  if (!form.currentStatus) errors.currentStatus = 'Please select the current status.'

  if (form.currentStatus === 'Employee' && !form.designation.trim()) {
    errors.designation = 'Designation is required for employees.'
  }

  if (!form.location.trim()) errors.location = 'Location is required.'
  if (!form.source) errors.source = 'Please select a source.'

  if (!form.courseId) errors.courseInterested = 'Please select a course.'
  if (!form.facultyName.trim()) errors.facultyName = 'Faculty name is required.'
  if (!form.batch.trim()) errors.batch = 'Batch is required.'
  if (!form.actualFees && form.courseId) errors.actualFees = 'Course fee details are missing.'
  if (!form.registrationFees && form.courseId) errors.registrationFees = 'Registration fee is missing.'
  if (!form.discount && form.courseId) errors.discount = 'Discount is missing.'
  if (!form.afterDiscount && form.courseId) errors.afterDiscount = 'After discount value is missing.'
  for (let index = 1; index <= requiredInstallmentCount; index += 1) {
    if (!form[`installment${index}`] && form.courseId) {
      errors[`installment${index}`] = `Installment ${index} is missing.`
    }
  }
  if (form.remarks.trim() && form.remarks.trim().length < 5) {
    errors.remarks = 'Add a short remark with at least 5 characters.'
  }

  if (!/^\d{10}$/.test(form.parentSpouseNumber.trim())) {
    errors.parentSpouseNumber = 'Enter a valid 10-digit contact number.'
  }

  if (!form.admissionDate) errors.admissionDate = 'Admission date is required.'

  return errors
}

function validateStep(form, stepIndex, course = null) {
  const errors = validateForm(form, course)
  const installmentFields = isFullPaymentMode(form)
    ? []
    : getInstallmentFieldNames(getRequiredInstallmentCount(course))
  const stepFields = {
    0: ['studentName', 'mobileNumber', 'emailAddress', 'parentSpouseNumber', 'location'],
    1: [
      'courseInterested',
      'facultyName',
      'batch',
      'qualification',
      'passedOutYear',
      'currentStatus',
      ...(String(form.currentStatus || '') === 'Employee' ? ['designation'] : []),
      'source',
    ],
    2: [
      'actualFees',
      'registrationFees',
      'discount',
      'afterDiscount',
      ...installmentFields,
      'admissionDate',
    ],
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => stepFields[stepIndex]?.includes(field)),
  )
}

function getStepIndexForField(fieldName) {
  const stepFields = {
    0: ['studentName', 'mobileNumber', 'emailAddress', 'parentSpouseNumber', 'location'],
    1: ['courseInterested', 'facultyName', 'batch', 'qualification', 'passedOutYear', 'currentStatus', 'designation', 'source'],
    2: [
      'actualFees',
      'registrationFees',
      'discount',
      'afterDiscount',
      ...Array.from({ length: MAX_INSTALLMENT_FIELDS }, (_, index) => `installment${index + 1}`),
      'admissionDate',
      'remarks',
      'paymentMode',
    ],
  }

  return Number(
    Object.entries(stepFields).find(([, fields]) => fields.includes(fieldName))?.[0] ?? 2,
  )
}

function findDuplicateStudent(form, students, editingStudentId = '') {
  const emailAddress = String(form.emailAddress || '').trim().toLowerCase()

  return students.find((student) => {
    if (!student || student.id === editingStudentId) return false

    const existingEmail = String(student.emailAddress || '').trim().toLowerCase()

    return Boolean(emailAddress && existingEmail === emailAddress)
  })
}

function Field({ label, required = false, hint, error, className = '', icon, multiline = false, children }) {
  return (
    <label
      className={`course-field student-field ${icon ? 'student-field-has-icon' : ''} ${multiline ? 'student-field-multiline' : ''} ${className}`.trim()}
    >
      <span>
        {label}
        {required ? <b>*</b> : null}
      </span>
      <div className="student-field-control">
        {icon ? <span className="student-field-icon">{icon}</span> : null}
        {children}
      </div>
      {hint ? <small>{hint}</small> : null}
      {error ? <small className="student-field-error">{error}</small> : null}
    </label>
  )
}

function PaymentStatusBadge({ student }) {
  if (isFullPaymentRecord(student)) {
    return <span className="student-badge employee">Completed</span>
  }

  const dueDate = hasThirdInstallment(student) ? getThirdDueDate(student) || getSecondDueDate(student) : getSecondDueDate(student)
  const firstPaid = String(student.firstInstallmentStatus || 'Pending') === 'Paid'
  const secondPaid = String(student.secondInstallmentStatus || 'Pending') === 'Paid'
  const thirdPaid = hasThirdInstallment(student) ? String(student.thirdInstallmentStatus || 'Pending') === 'Paid' : true
  const latestPending = hasThirdInstallment(student) ? student.thirdInstallmentStatus : student.secondInstallmentStatus
  const isOverdue = latestPending !== 'Paid' && diffInDays(dueDate, getTodayValue()) > 0
  const status = firstPaid && secondPaid && thirdPaid ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'
  const className =
    status === 'Completed' ? 'student-badge employee' : status === 'Overdue' ? 'student-badge other' : 'student-badge student'

  return <span className={className}>{status}</span>
}

function getAttendanceStatusMeta(student = {}) {
  const attendance = resolveStudentBatchAttendanceStatus(student)

  if (!attendance) {
    return {
      label: 'Unmarked',
      toneClass: 'is-unmarked',
    }
  }

  if (attendance.status === 'Present') {
    return {
      label: 'Present',
      toneClass: 'is-present',
    }
  }

  return {
    label: 'Absent',
    toneClass: 'is-absent',
  }
}

function AttendanceStatusBadge({ student }) {
  const attendanceMeta = getAttendanceStatusMeta(student)

  return <span className={`status-pill ${attendanceMeta.toneClass}`.trim()}>{attendanceMeta.label}</span>
}

function SectionIcon({ kind }) {
  if (kind === 'basic') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M5.5 18c1.2-3.3 4-5 6.5-5s5.3 1.7 6.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'education') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 4 3.8 8.2 12 12.3l8.2-4.1L12 4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M6 10.4v3.8c0 1.5 2.7 3 6 3s6-1.5 6-3v-3.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'admission') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4.8" y="5" width="14.4" height="14" rx="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 9h8M8 12h8M8 15h4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  return null
}

function getDrawerValue(value, fallback = '-') {
  if (value === 0) return '0'
  const text = String(value ?? '').trim()
  return text || fallback
}

function DrawerValue({ value, tone = '' }) {
  if (isValidElement(value)) {
    return value
  }

  const text = getDrawerValue(value)
  const isEmailValue = text.includes('@')
  const valueClassName = isEmailValue ? 'student-inline-email' : ''

  if (tone) {
    return <span className={`student-detail-pill ${tone} ${valueClassName}`.trim()}>{text}</span>
  }

  return <span className={`student-detail-text ${valueClassName}`.trim()}>{text}</span>
}

function DrawerTableRow({ leftLabel, leftValue, rightLabel, rightValue, leftTone = '', rightTone = '' }) {
  return (
    <tr>
      <th>{leftLabel}</th>
      <td>
        <DrawerValue value={leftValue} tone={leftTone} />
      </td>
      <th>{rightLabel}</th>
      <td>
        <DrawerValue value={rightValue} tone={rightTone} />
      </td>
    </tr>
  )
}

function DrawerFormControl({
  value,
  onChange,
  type = 'text',
  options = [],
  as = 'input',
  placeholder = '',
  readOnly = false,
  disabled = false,
}) {
  if (as === 'select') {
    return (
      <select className="student-drawer-inline-control" value={value} onChange={onChange} disabled={disabled}>
        <option value="">{placeholder || 'Select option'}</option>
        {options.map((option) => (
          <option key={typeof option === 'object' ? option.value : option} value={typeof option === 'object' ? option.value : option}>
            {typeof option === 'object' ? option.label : option}
          </option>
        ))}
      </select>
    )
  }

  if (as === 'textarea') {
    return (
      <textarea
        className="student-drawer-inline-control student-drawer-inline-textarea"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    )
  }

  return (
    <input
      className="student-drawer-inline-control"
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
    />
  )
}

function FieldIcon({ kind }) {
  const iconProps = { size: 18, strokeWidth: 2.2, 'aria-hidden': true, focusable: false }

  if (kind === 'user') return <UserRound {...iconProps} />
  if (kind === 'phone') return <Phone {...iconProps} />
  if (kind === 'mail') return <Mail {...iconProps} />
  if (kind === 'pin') return <MapPin {...iconProps} />
  if (kind === 'course') return <BookOpen {...iconProps} />
  if (kind === 'faculty') return <GraduationCap {...iconProps} />
  if (kind === 'batch') return <Layers3 {...iconProps} />
  if (kind === 'year') return <CalendarDays {...iconProps} />
  if (kind === 'status') return <BadgeCheck {...iconProps} />
  if (kind === 'note') return <FileText {...iconProps} />
  if (kind === 'currency') return <CircleDollarSign {...iconProps} />
  if (kind === 'percent') return <Percent {...iconProps} />
  if (kind === 'balance') return <Landmark {...iconProps} />
  if (kind === 'installment') return <CreditCard {...iconProps} />
  if (kind === 'calendar') return <CalendarDays {...iconProps} />

  return null
}

function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4a2.1 2.1 0 0 0-3 0L3 14.5V20h1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m13.5 6.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 7l1 12.5A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="5" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="19" r="1.7" fill="currentColor" />
    </svg>
  )
}

function DangerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3 1.8 20h20.4L12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 8.5v5M12 17.2h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function getReportBatchOptions(courseId, facultyOptions = []) {
  const normalizedCourseId = String(courseId || '').trim()
  if (!normalizedCourseId) return []

  const batchOptions = []
  const seen = new Set()

  facultyOptions.forEach((faculty) => {
    if (!facultyMatchesCourse(faculty, normalizedCourseId)) return

    const batches = Array.isArray(faculty?.batchEntries) ? faculty.batchEntries : []
    batches.forEach((entry) => {
      if (String(entry?.courseId || '').trim() !== normalizedCourseId) return

      const value = String(entry?.id || entry?.batchName || '').trim()
      if (!value || seen.has(value)) return

      seen.add(value)
      batchOptions.push({
        value,
        batchName: String(entry?.batchName || '').trim(),
        label: getBatchTimingLabel(entry) || String(entry?.batchName || '').trim(),
      })
    })
  })

  return batchOptions
}

function AttendanceReportModal({
  isOpen,
  mode = 'all',
  student = null,
  form,
  errors,
  generalError = '',
  isDownloading = false,
  courseOptions = [],
  batchOptions = [],
  onChangeField,
  onClose,
  onDownload,
  onCourseChange,
}) {
  if (!isOpen) return null

  const isSingleStudent = mode === 'single'
  const studentName = String(student?.studentName || '').trim() || 'Selected student'
  const scopeLabel = isSingleStudent
    ? `${studentName}${student?.courseInterested ? ` - ${student.courseInterested}` : ''}${student?.batch ? ` - ${student.batch}` : ''}`
    : 'All students'
  const canDownload = Boolean(form.fromDate && form.toDate && form.toDate >= form.fromDate && !isDownloading)

  return (
    <div className="course-modal-backdrop student-modal-backdrop attendance-report-backdrop" role="presentation">
      <form
        className="course-modal panel-card student-modal attendance-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-report-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          if (canDownload) {
            onDownload()
          }
        }}
      >
        <button type="button" className="course-modal-close" onClick={onClose} aria-label="Close attendance report modal">
          X
        </button>

        <div className="course-modal-header student-modal-header attendance-report-header">
          <div>
            <p className="section-kicker">Attendance Report</p>
            <h3 id="attendance-report-title">Generate Attendance Report</h3>
            {!isSingleStudent ? <p>Choose a date range and optional course and batch filters before downloading.</p> : null}
          </div>
          <div className="attendance-report-summary">
            {!isSingleStudent ? (
              <div className="attendance-report-summary-chip">
                <CalendarRange size={16} />
                <span>{scopeLabel}</span>
              </div>
            ) : null}
            {!isSingleStudent ? (
              <div className="attendance-report-summary-chip is-muted">
                <Download size={16} />
                <span>All students export</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="attendance-report-card">
          {!isSingleStudent ? (
            <div className="attendance-report-student-card">
              <span>Report Scope</span>
              <strong>All Students</strong>
              <small>Use the filters below to narrow the exported rows.</small>
            </div>
          ) : null}

          <div className="course-form-grid student-form-grid student-form-grid-tight attendance-report-grid">
              <Field
              label="From Date"
              required
              icon={<FieldIcon kind="calendar" />}
              error={errors.fromDate}
            >
              <input
                type="date"
                value={form.fromDate}
                onChange={(event) => onChangeField('fromDate', event.target.value)}
              />
            </Field>

              <Field
              label="To Date"
              required
              icon={<FieldIcon kind="calendar" />}
              error={errors.toDate}
            >
              <input
                type="date"
                value={form.toDate}
                onChange={(event) => onChangeField('toDate', event.target.value)}
                min={form.fromDate || undefined}
              />
            </Field>

            {!isSingleStudent ? (
              <>
                <Field label="Course" icon={<FieldIcon kind="course" />}>
                  <select
                    value={form.courseId}
                    onChange={(event) => onCourseChange(event.target.value)}
                    disabled={!courseOptions.length}
                  >
                    <option value="">{courseOptions.length ? 'Select Course' : 'No courses available'}</option>
                    {courseOptions.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Batch" icon={<FieldIcon kind="batch" />}>
                  <select
                    value={form.batchId}
                    onChange={(event) => onChangeField('batchId', event.target.value)}
                    disabled={!form.courseId}
                  >
                    <option value="">{form.courseId ? 'Select Batch' : 'Select Course first'}</option>
                    {form.courseId ? <option value="all">All Batches</option> : null}
                    {batchOptions.map((batch) => (
                      <option key={batch.value} value={batch.value}>
                        {batch.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : null}
          </div>

          {generalError ? (
            <div className="attendance-report-error" role="alert">
              {generalError}
            </div>
          ) : null}
        </div>

        <div className="course-form-actions attendance-report-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canDownload}>
            {isDownloading ? (
              <>
                <LoaderCircle className="attendance-report-spinner" />
                Generating Attendance Report...
              </>
            ) : (
              <>
                <Download />
                Download Excel
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function useFacultyBatchAttendanceRefreshToken() {
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncAttendance = () => {
      setRefreshToken((current) => current + 1)
    }

    window.addEventListener(FACULTY_BATCH_ATTENDANCE_SYNC_EVENT, syncAttendance)
    window.addEventListener('storage', syncAttendance)

    return () => {
      window.removeEventListener(FACULTY_BATCH_ATTENDANCE_SYNC_EVENT, syncAttendance)
      window.removeEventListener('storage', syncAttendance)
    }
  }, [])

  return refreshToken
}

export function StudentManagementPage() {
  const { role } = useAuth()
  const openMenu = useMobileMenu()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [students, setStudents] = useState(() => loadStudentSnapshot())
  const [courseOptions, setCourseOptions] = useState([])
  const [facultyOptions, setFacultyOptions] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStudentsLoading, setIsStudentsLoading] = useState(true)
  const [isCoursesLoading, setIsCoursesLoading] = useState(true)
  const [isFacultyLoading, setIsFacultyLoading] = useState(true)
  const [form, setForm] = useState(createEmptyForm)
  const [submitted, setSubmitted] = useState(false)
  const [fieldFocus, setFieldFocus] = useState({})
  const [editingStudentId, setEditingStudentId] = useState('')
  const [manualSelectedStudentId, setManualSelectedStudentId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [installmentConfirmTarget, setInstallmentConfirmTarget] = useState(null)
  const [openActionMenuId, setOpenActionMenuId] = useState('')
  const actionMenuCloseTimerRef = useRef(null)
  const [isDrawerEditing, setIsDrawerEditing] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [serverFieldErrors, setServerFieldErrors] = useState({})
  const [actionError, setActionError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSavingStudent, setIsSavingStudent] = useState(false)
  const [attendanceReportModal, setAttendanceReportModal] = useState(null)
  const [attendanceReportForm, setAttendanceReportForm] = useState({
    fromDate: '',
    toDate: '',
    courseId: '',
    batchId: '',
  })
  const [attendanceReportTouched, setAttendanceReportTouched] = useState({})
  const [attendanceReportSubmitting, setAttendanceReportSubmitting] = useState(false)
  const [attendanceReportError, setAttendanceReportError] = useState('')
  const attendanceRefreshToken = useFacultyBatchAttendanceRefreshToken()
  const studentsPerPage = 5
  const passedOutYearOptions = useMemo(() => getPassedOutYearOptions(), [])
  const isBusinessOwner = role === 'business-owner'
  const headerTitle = isBusinessOwner ? 'Business Owner Dashboard' : 'Operation Manager Dashboard'
  const headerEyebrow = isBusinessOwner ? 'Business Owner' : 'Operation Manager'
  const headerSummary = isBusinessOwner
    ? "Welcome back! Here's what's happening with your business today."
    : roleDashboards['operation-manager'].summary
  const headerInitials = isBusinessOwner ? 'BW' : 'OM'
  const headerProfileTitle = isBusinessOwner ? 'Business Head' : 'Operation Manager'
  const headerEmail = isBusinessOwner ? 'business.owner@cispro.com' : 'operation.manager@cispro.com'

  const selectedCourse = useMemo(() => findCourseForForm(courseOptions, form), [courseOptions, form])
  const visibleInstallmentCount = getCourseInstallmentCount(selectedCourse)
  const selectedCourseFacultyOptions = useMemo(() => {
    const normalizedCourseId = String(form.courseId || '').trim()
    if (!normalizedCourseId) return []

    return facultyOptions.filter((faculty) => facultyMatchesCourse(faculty, normalizedCourseId))
  }, [facultyOptions, form.courseId])
  const selectedFaculty = useMemo(() => {
    if (String(form.courseId || '').trim()) {
      return findFacultyForForm(selectedCourseFacultyOptions, form)
    }

    return findFacultyForForm(facultyOptions, form)
  }, [facultyOptions, form, selectedCourseFacultyOptions])
  const selectedFormBatchEntry = useMemo(() => {
    const normalizedBatchId = String(form.batchId || '').trim().toLowerCase()
    const normalizedCourseId = String(form.courseId || '').trim()
    const normalizedBatchName = String(form.batch || '').trim().toLowerCase()
    const batchEntries = Array.isArray(selectedFaculty?.batchEntries) ? selectedFaculty.batchEntries : []

    return (
      batchEntries.find((entry) => String(entry?.id || '').trim().toLowerCase() === normalizedBatchId) ||
      batchEntries.find(
        (entry) =>
          String(entry?.courseId || '').trim() === normalizedCourseId &&
          String(entry?.batchName || '').trim().toLowerCase() === normalizedBatchName,
      ) ||
      null
    )
  }, [form.batch, form.batchId, form.courseId, selectedFaculty])
  const facultySelectOptions = useMemo(() => {
    const nextOptions = selectedCourseFacultyOptions.map((faculty) => ({
      value: faculty.facultyName,
      label: faculty.facultyName,
    }))

    const currentValue = String(form.facultyName || '').trim()
    if (currentValue && !nextOptions.some((option) => option.value === currentValue)) {
      nextOptions.unshift({
        value: currentValue,
        label: currentValue,
      })
    }

    return nextOptions
  }, [form.facultyName, selectedCourseFacultyOptions])
  const batchSelectOptions = useMemo(() => {
    const normalizedCourseId = String(form.courseId || '').trim()
    const batches = Array.isArray(selectedFaculty?.batchEntries) ? selectedFaculty.batchEntries : []
    const nextOptions = batches
      .filter((entry) => {
        if (!normalizedCourseId) return true
        return String(entry?.courseId || '').trim() === normalizedCourseId
      })
      .map((entry) => {
        const value = String(entry?.batchName || '').trim()
        if (!value) return null

        return {
          value,
          label: getBatchTimingLabel(entry) || value,
        }
      })
      .filter(Boolean)

    const currentValue = String(form.batch || '').trim()
    if (currentValue && !nextOptions.some((option) => option.value === currentValue)) {
      nextOptions.unshift({
        value: currentValue,
        label: currentValue,
      })
    }

    return nextOptions
  }, [form.batch, form.courseId, selectedFaculty])
  const errors = useMemo(() => {
    const nextErrors = validateForm(form, selectedCourse)
    const duplicateStudent = findDuplicateStudent(form, students, editingStudentId)

    if (duplicateStudent) {
      nextErrors.emailAddress = 'Email already exists.'
    }

    if (form.courseId && !selectedCourseFacultyOptions.length) {
      nextErrors.facultyName = 'No faculty mapped to the selected course.'
    }

    if (form.facultyName && form.courseId && !batchSelectOptions.length) {
      nextErrors.batch = 'No batches available for the selected faculty and course.'
    }

    return nextErrors
  }, [batchSelectOptions, editingStudentId, form, selectedCourse, selectedCourseFacultyOptions, students])
  const backfilledStudents = useMemo(
    () => enrichStudentsWithFacultyReferences(students, facultyOptions, courseOptions),
    [courseOptions, facultyOptions, students],
  )
  const studentsWithAttendance = useMemo(
    () => {
      void attendanceRefreshToken

      return backfilledStudents.map((student) => ({
        ...student,
        attendanceStatusMeta: getAttendanceStatusMeta(student),
      }))
    },
    [attendanceRefreshToken, backfilledStudents],
  )

  useEffect(() => {
    if (backfilledStudents === students) return
    saveStudentSnapshot(backfilledStudents)
  }, [backfilledStudents, students])

  const courseFilterId = String(searchParams.get('courseId') || '').trim()
  const facultyFilterId = String(searchParams.get('facultyId') || '').trim()
  const batchFilterId = String(searchParams.get('batchId') || '').trim()
  const selectedStudentQueryId = String(searchParams.get('studentId') || '').trim()
  const selectedStudentId = selectedStudentQueryId || manualSelectedStudentId
  const selectedStudent = useMemo(
    () => studentsWithAttendance.find((student) => student.id === selectedStudentId) || null,
    [selectedStudentId, studentsWithAttendance],
  )
  const selectedStudentAttendanceMeta = useMemo(
    () => (selectedStudent ? getAttendanceStatusMeta(selectedStudent) : { label: 'Unmarked', toneClass: 'is-unmarked' }),
    [selectedStudent],
  )
  const selectedStudentCourse = useMemo(
    () => (selectedStudent ? findCourseForStudent(selectedStudent, courseOptions) : null),
    [courseOptions, selectedStudent],
  )
  const selectedFacultyFilter = useMemo(
    () => facultyOptions.find((faculty) => String(faculty?.id || '').trim() === facultyFilterId) || null,
    [facultyFilterId, facultyOptions],
  )
  const selectedCourseFilter = useMemo(
    () => courseOptions.find((course) => String(course?.id || '').trim() === courseFilterId) || null,
    [courseFilterId, courseOptions],
  )
  const selectedBatchFilter = useMemo(
    () => (selectedFacultyFilter ? getFacultyBatchEntryById(selectedFacultyFilter, batchFilterId) : null),
    [batchFilterId, selectedFacultyFilter],
  )
  const reportBatchOptions = useMemo(
    () => getReportBatchOptions(attendanceReportForm.courseId, facultyOptions),
    [attendanceReportForm.courseId, facultyOptions],
  )
  const attendanceReportSelectedBatchId = String(attendanceReportForm.batchId || '').trim()
  const attendanceReportUsesAllBatches =
    !attendanceReportSelectedBatchId || attendanceReportSelectedBatchId === 'all'
  const attendanceReportStudent =
    attendanceReportModal?.mode === 'single'
      ? studentsWithAttendance.find((student) => student.id === attendanceReportModal.studentId) || selectedStudent || null
      : null
  const attendanceReportTargetStudents =
    attendanceReportModal?.mode === 'single'
      ? attendanceReportStudent
        ? [attendanceReportStudent]
        : []
      : getMatchingStudents(studentsWithAttendance, {
          courseId: attendanceReportForm.courseId,
          courseName:
            courseOptions.find((course) => String(course?.id || '').trim() === String(attendanceReportForm.courseId || '').trim())
              ?.name || '',
          batchId: attendanceReportUsesAllBatches ? '' : attendanceReportSelectedBatchId,
          batchName: attendanceReportUsesAllBatches
            ? 'All Batches'
            : reportBatchOptions.find((batch) => String(batch.value || '').trim() === attendanceReportSelectedBatchId)?.batchName || '',
        })
  const attendanceReportValidationErrors = useMemo(() => {
    const nextErrors = {}

    if (attendanceReportTouched.fromDate && !attendanceReportForm.fromDate) {
      nextErrors.fromDate = 'From Date is required.'
    }

    if (attendanceReportTouched.toDate && !attendanceReportForm.toDate) {
      nextErrors.toDate = 'To Date is required.'
    }

    if (attendanceReportForm.fromDate && attendanceReportForm.toDate && attendanceReportForm.toDate < attendanceReportForm.fromDate) {
      nextErrors.toDate = 'To Date cannot be before From Date.'
    }

    return nextErrors
  }, [attendanceReportForm.fromDate, attendanceReportForm.toDate, attendanceReportTouched.fromDate, attendanceReportTouched.toDate])

  const isDrawerOpen = Boolean(selectedStudentId)
  const filteredStudents = useMemo(() => {
    const baseMatches =
      !courseFilterId && !facultyFilterId && !batchFilterId
        ? studentsWithAttendance
        : getMatchingStudents(studentsWithAttendance, {
            facultyId: facultyFilterId,
            facultyName: selectedFacultyFilter?.facultyName || '',
            courseId: courseFilterId,
            courseName: selectedCourseFilter?.name || getFacultyCourseName(courseFilterId, courseOptions) || '',
            batchId: batchFilterId,
            batchName: selectedBatchFilter?.batchName || '',
          })

    const normalizedSearch = searchQuery.trim().toLowerCase()
    if (!normalizedSearch) return baseMatches

    return baseMatches.filter((student) => {
      const studentName = String(student?.studentName || '').toLowerCase()
      const courseName = String(student?.courseInterested || student?.courseName || '').toLowerCase()
      const facultyName = String(student?.facultyName || '').toLowerCase()
      const batchName = String(student?.batchName || student?.batch || '').toLowerCase()

      return (
        studentName.includes(normalizedSearch) ||
        courseName.includes(normalizedSearch) ||
        facultyName.includes(normalizedSearch) ||
        batchName.includes(normalizedSearch)
      )
    })
  }, [
    batchFilterId,
    courseFilterId,
    courseOptions,
    facultyFilterId,
    searchQuery,
    selectedBatchFilter,
    selectedCourseFilter,
    selectedFacultyFilter,
    studentsWithAttendance,
  ])
  const buildStudentManagementUrl = useCallback(
    (studentId = '') => {
      const params = new URLSearchParams()

      if (studentId) params.set('studentId', String(studentId).trim())
      if (courseFilterId) params.set('courseId', courseFilterId)
      if (facultyFilterId) params.set('facultyId', facultyFilterId)
      if (batchFilterId) params.set('batchId', batchFilterId)

      const query = params.toString()
      return query ? `/student-management?${query}` : '/student-management'
    },
    [batchFilterId, courseFilterId, facultyFilterId],
  )
  const totalStudents = filteredStudents.length
  const latestStudent = filteredStudents[0]
  const totalPages = Math.max(1, Math.ceil(totalStudents / studentsPerPage))
  const currentPageSafe = Math.min(currentPage, totalPages)
  const paginatedStudents = useMemo(() => {
    const start = (currentPageSafe - 1) * studentsPerPage
    return filteredStudents.slice(start, start + studentsPerPage)
  }, [currentPageSafe, filteredStudents])
  const loadStudents = async ({ silent = false } = {}) => {
    setIsStudentsLoading(true)

    try {
      const result = await listStudents({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
      const nextStudents = mergeStudentsWithSnapshot(result.data)
      saveStudentSnapshot(nextStudents)
      setStudents(nextStudents.length ? nextStudents : loadStudentSnapshot())
      if (!silent) {
        setActionError('')
      }
    } catch (error) {
      if (!silent) {
        setStudents(loadStudentSnapshot())
        setActionError(apiErrorMessage(error, 'Failed to load students from the backend.'))
      }
    } finally {
      setIsStudentsLoading(false)
    }
  }

  const loadCourseOptions = async () => {
    setIsCoursesLoading(true)

    try {
      const result = await listCourses({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
      const normalizedCourses = Array.from(
        new Map(
          (result.data || [])
            .map((course) => {
              const id = String(course?.id || '').trim()
              const name = String(course?.name || '').trim()
              if (!id || !name) return null

              return [
                id,
                {
                  id,
                  name,
                  actualFees: course?.actualFees ?? '',
                  registrationFees: course?.registrationFees ?? '',
                  discount: course?.discount ?? '',
                  afterDiscount: course?.afterDiscount ?? '',
                  installmentCount: course?.installmentCount ?? '',
                  installments: getCourseInstallmentValues(course),
                },
              ]
            })
            .filter(Boolean),
        ).values(),
      )

      setCourseOptions(normalizedCourses)
      setActionError('')
    } catch (error) {
      setCourseOptions([])
      setActionError(apiErrorMessage(error, 'Failed to load courses from the backend.'))
    } finally {
      setIsCoursesLoading(false)
    }
  }

  const loadFacultyOptions = async () => {
    setIsFacultyLoading(true)

    try {
      const result = await listFacultyRecords({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
      const normalizedFaculty = Array.from(
        new Map(
          (result.data || [])
            .map((faculty) => {
              const id = String(faculty?.id || '').trim()
              const facultyName = String(faculty?.facultyName || '').trim()
              const courseId = String(faculty?.courseId || '').trim()
              if (!id || !facultyName || !courseId) return null

              return [
                id,
                {
                  ...faculty,
                  id,
                  facultyName,
                  courseId,
                  batchEntries: Array.isArray(faculty?.batchEntries)
                    ? faculty.batchEntries
                        .map((entry) => ({
                          id: String(entry?.id || '').trim(),
                          courseId: String(entry?.courseId || faculty?.courseId || '').trim(),
                          batchName: String(entry?.batchName || '').trim(),
                          batchTiming: String(entry?.batchTiming || '').trim(),
                        }))
                        .filter((entry) => entry.batchName)
                    : [],
                },
              ]
            })
            .filter(Boolean),
        ).values(),
      )

      setFacultyOptions(normalizedFaculty)
      setActionError('')
    } catch (error) {
      const localFaculty = Array.from(
        new Map(
          normalizeFacultyList(loadFacultyRecords())
            .map((faculty) => {
              const id = String(faculty?.id || '').trim()
              const facultyName = String(faculty?.facultyName || '').trim()
              const courseId = String(faculty?.courseId || '').trim()
              if (!id || !facultyName || !courseId) return null

              return [
                id,
                {
                  ...faculty,
                  id,
                  facultyName,
                  courseId,
                  batchEntries: Array.isArray(faculty?.batchEntries)
                    ? faculty.batchEntries
                        .map((entry) => ({
                          id: String(entry?.id || '').trim(),
                          courseId: String(entry?.courseId || faculty?.courseId || '').trim(),
                          batchName: String(entry?.batchName || '').trim(),
                          batchTiming: String(entry?.batchTiming || '').trim(),
                        }))
                        .filter((entry) => entry.batchName)
                    : [],
                },
              ]
            })
            .filter(Boolean),
        ).values(),
      )

      setFacultyOptions(localFaculty)
      setActionError(apiErrorMessage(error, 'Failed to load faculty records from the backend.'))
    } finally {
      setIsFacultyLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void Promise.all([loadStudents(), loadCourseOptions(), loadFacultyOptions()])
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  const openModal = () => {
    setActionError('')
    setServerFieldErrors({})
    setForm(createEmptyForm())
    setFieldFocus({})
    setSubmitted(false)
    setEditingStudentId('')
    setOpenActionMenuId('')
    setIsDrawerEditing(false)
    setCurrentStep(0)
    setIsModalOpen(true)
  }

  const prepareStudentForm = (student) => ({
    ...applyInstallmentValues(createEmptyForm(), getCourseInstallmentValues(findCourseForForm(courseOptions, student))),
    facultyId: student.facultyId || '',
    batchId: student.batchId || student.batchEntryId || '',
    courseId: student.courseId || '',
    studentName: student.studentName || '',
    mobileNumber: student.mobileNumber || '',
    emailAddress: student.emailAddress || '',
    courseInterested: student.courseInterested || '',
    facultyName: student.facultyName || '',
    batch: student.batch || '',
    qualification: student.qualification || '',
    passedOutYear: student.passedOutYear || '',
    currentStatus: student.currentStatus || '',
    designation: student.designation || '',
    location: student.location || '',
    source: student.source || '',
    status: student.status || 'Active',
    paymentMode: isFullPaymentRecord(student) ? 'Full Payment' : 'Installment',
    actualFees: student.actualFees || '',
    registrationFees: student.registrationFees || '',
    discount: student.discount || '',
    afterDiscount: student.afterDiscount || '',
    ...Object.fromEntries(getInstallmentFieldNames().map((fieldName) => [fieldName, student[fieldName] || ''])),
    firstInstallmentAmount: student.firstInstallmentAmount || student.installment1 || '',
    firstInstallmentDate: student.firstInstallmentDate || student.admissionDate || '',
    firstInstallmentStatus: student.firstInstallmentStatus || 'Pending',
    firstInstallmentPaidAt: student.firstInstallmentPaidAt || student.admissionDate || '',
    secondInstallmentAmount: student.secondInstallmentAmount || student.installment2 || '',
    secondDueDate: student.secondDueDate || '',
    secondInstallmentStatus: student.secondInstallmentStatus || 'Pending',
    secondInstallmentPaidAt: student.secondInstallmentPaidAt || '',
    thirdInstallmentAmount: student.thirdInstallmentAmount || student.installment3 || '',
    thirdDueDate: student.thirdDueDate || '',
    thirdInstallmentStatus: student.thirdInstallmentStatus || 'Pending',
    thirdInstallmentPaidAt: student.thirdInstallmentPaidAt || '',
    remarks: student.remarks || '',
    parentSpouseNumber: student.parentSpouseNumber || '',
    admissionDate: student.admissionDate || getTodayValue(),
  })

  const openEditModal = (student) => {
    setActionError('')
    setServerFieldErrors({})
    setForm(prepareStudentForm(student))
    setFieldFocus({})
    setSubmitted(false)
    setEditingStudentId(student.id)
    setCurrentStep(0)
    setIsModalOpen(true)
    setIsDrawerEditing(false)
    setOpenActionMenuId('')
  }

  const startDrawerEdit = (student) => {
    setActionError('')
    setServerFieldErrors({})
    setForm(prepareStudentForm(student))
    setFieldFocus({})
    setSubmitted(false)
    setEditingStudentId(student.id)
    setCurrentStep(0)
    setIsDrawerEditing(true)
    setOpenActionMenuId('')
  }

  const openDrawer = (student) => {
    setManualSelectedStudentId(student.id)
    setIsDrawerEditing(false)
    navigate(buildStudentManagementUrl(student.id))
  }

  const openDeleteModal = (student) => {
    setActionError('')
    setDeleteTarget(student)
  }

  const closeDrawer = useCallback(() => {
    setIsDrawerEditing(false)
    setManualSelectedStudentId('')
    navigate(buildStudentManagementUrl(), { replace: true })
  }, [buildStudentManagementUrl, navigate])

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const closeInstallmentConfirmModal = () => {
    setInstallmentConfirmTarget(null)
  }

  const openActionMenu = (studentId) => {
    if (actionMenuCloseTimerRef.current) {
      window.clearTimeout(actionMenuCloseTimerRef.current)
      actionMenuCloseTimerRef.current = null
    }
    setOpenActionMenuId(studentId)
  }

  const closeActionMenu = () => {
    if (actionMenuCloseTimerRef.current) {
      window.clearTimeout(actionMenuCloseTimerRef.current)
      actionMenuCloseTimerRef.current = null
    }
    setOpenActionMenuId('')
  }

  const scheduleCloseActionMenu = () => {
    if (actionMenuCloseTimerRef.current) {
      window.clearTimeout(actionMenuCloseTimerRef.current)
    }

    actionMenuCloseTimerRef.current = window.setTimeout(() => {
      setOpenActionMenuId('')
      actionMenuCloseTimerRef.current = null
    }, 140)
  }

  const closeModal = () => {
    if (isSavingStudent) return

    setIsModalOpen(false)
    setActionError('')
    setServerFieldErrors({})
    setEditingStudentId('')
    setCurrentStep(0)
  }

  const openAttendanceReportModal = (mode = 'all', student = null) => {
    setAttendanceReportModal({
      mode,
      studentId: student?.id || '',
    })
    setAttendanceReportForm({
      fromDate: '',
      toDate: '',
      courseId: mode === 'single' ? student?.courseId || '' : '',
      batchId: mode === 'single' ? student?.batchId || student?.batchEntryId || '' : '',
    })
    setAttendanceReportTouched({})
    setAttendanceReportError('')
    setAttendanceReportSubmitting(false)
  }

  const closeAttendanceReportModal = useCallback(() => {
    setAttendanceReportModal(null)
    setAttendanceReportForm({
      fromDate: '',
      toDate: '',
      courseId: '',
      batchId: '',
    })
    setAttendanceReportTouched({})
    setAttendanceReportError('')
    setAttendanceReportSubmitting(false)
  }, [])

  const updateAttendanceReportField = (field, value) => {
    setAttendanceReportForm((current) => {
      if (field === 'courseId') {
        return {
          ...current,
          courseId: value,
          batchId: '',
        }
      }

      return {
        ...current,
        [field]: value,
      }
    })

    if (field === 'fromDate' || field === 'toDate') {
      setAttendanceReportTouched((current) => ({
        ...current,
        [field]: true,
      }))
    }

    setAttendanceReportError('')
  }

  const handleAttendanceReportCourseChange = (courseId) => {
    updateAttendanceReportField('courseId', courseId)
  }

  const handleAttendanceReportDownload = async () => {
    if (attendanceReportSubmitting) return

    const validationErrors = {
      ...attendanceReportValidationErrors,
    }

    if (!attendanceReportForm.fromDate) {
      validationErrors.fromDate = 'From Date is required.'
    }

    if (!attendanceReportForm.toDate) {
      validationErrors.toDate = 'To Date is required.'
    }

    if (attendanceReportForm.fromDate && attendanceReportForm.toDate && attendanceReportForm.toDate < attendanceReportForm.fromDate) {
      validationErrors.toDate = 'To Date cannot be before From Date.'
    }

    setAttendanceReportTouched({
      fromDate: true,
      toDate: true,
    })

    if (Object.keys(validationErrors).length > 0) {
      setAttendanceReportError(validationErrors.fromDate || validationErrors.toDate || 'Please select a valid date range.')
      return
    }

    setAttendanceReportSubmitting(true)

    try {
      if (attendanceReportModal?.mode === 'single') {
        const studentId = String(attendanceReportStudent?.id || attendanceReportModal?.studentId || '').trim()

        if (!studentId) {
          throw new Error('Student attendance report download requires a valid student record.')
        }

        await downloadStudentAttendanceReport({
          studentId,
          fromDate: attendanceReportForm.fromDate,
          toDate: attendanceReportForm.toDate,
        })
      } else {
        await downloadBatchAttendanceReport({
          batchId: attendanceReportUsesAllBatches ? '' : attendanceReportSelectedBatchId,
          batchName:
            attendanceReportUsesAllBatches
              ? 'All Batches'
              : reportBatchOptions.find((batch) => String(batch.value || '').trim() === attendanceReportSelectedBatchId)?.batchName ||
                attendanceReportTargetStudents[0]?.batchName ||
                attendanceReportTargetStudents[0]?.batch ||
                '',
          courseId: String(attendanceReportForm.courseId || attendanceReportTargetStudents[0]?.courseId || '').trim(),
          fromDate: attendanceReportForm.fromDate,
          toDate: attendanceReportForm.toDate,
        })
      }

      setAttendanceReportError('')
    } catch (error) {
      setAttendanceReportError(apiErrorMessage(error, 'Unable to generate attendance report right now.'))
    } finally {
      setAttendanceReportSubmitting(false)
    }
  }

  useEffect(() => {
    if (!isDrawerOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeDrawer()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeDrawer, isDrawerOpen])

  useEffect(() => {
    if (!attendanceReportModal) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAttendanceReportModal()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [attendanceReportModal, closeAttendanceReportModal])

  useEffect(() => {
    saveStudentRecords(students)
    saveStudentSnapshot(students)
  }, [students])

  useEffect(() => {
    const syncCourseOptions = () => {
      void loadCourseOptions()
    }

    const timeoutId = window.setTimeout(() => {
      void loadCourseOptions()
    }, 0)

    window.addEventListener(COURSE_RECORD_SYNC_EVENT, syncCourseOptions)
    window.addEventListener('storage', syncCourseOptions)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener(COURSE_RECORD_SYNC_EVENT, syncCourseOptions)
      window.removeEventListener('storage', syncCourseOptions)
    }
  }, [])

  useEffect(() => {
    const syncFacultyOptions = () => {
      void loadFacultyOptions()
    }

    window.addEventListener(FACULTY_RECORD_SYNC_EVENT, syncFacultyOptions)
    window.addEventListener('storage', syncFacultyOptions)

    return () => {
      window.removeEventListener(FACULTY_RECORD_SYNC_EVENT, syncFacultyOptions)
      window.removeEventListener('storage', syncFacultyOptions)
    }
  }, [])

  const updateField = (name, value) => {
    setForm((current) => ({
      ...current,
      ...(name === 'paymentMode' && value === 'Installment'
        ? {
            paymentMode: value,
            firstInstallmentStatus: 'Pending',
            secondInstallmentStatus: 'Pending',
            thirdInstallmentStatus: 'Pending',
            fourthInstallmentStatus: 'Pending',
            firstInstallmentPaidAt: '',
            secondInstallmentPaidAt: '',
            thirdInstallmentPaidAt: '',
            fourthInstallmentPaidAt: '',
            ...(getInstallmentFieldNames().some((fieldName) => Boolean(current[fieldName]))
              ? {}
              : applyInstallmentValues({}, getCourseInstallmentValues(findCourseForForm(courseOptions, current)))),
          }
        : name === 'paymentMode' && value === 'Full Payment'
          ? {
              paymentMode: value,
              ...applyInstallmentValues(),
            }
          : {}),
      [name]: value,
    }))
    setServerFieldErrors((current) => {
      if (!current[name]) return current
      const nextErrors = { ...current }
      delete nextErrors[name]
      return nextErrors
    })
  }

  const applyCourseDetails = (courseId) => {
    const course = courseOptions.find((item) => item.id === courseId) || null
    setForm((current) => ({
      ...mapCourseToForm(current, course),
      facultyName: '',
      facultyId: '',
      batch: '',
      batchId: '',
    }))
  }

  const applyFacultyDetails = (facultyName) => {
    const faculty = selectedCourseFacultyOptions.find((item) => item.facultyName === facultyName) || null
    setForm((current) => ({
      ...current,
      facultyName,
      facultyId: faculty?.id || '',
      batch: '',
      batchId: '',
    }))
  }

  const applyBatchDetails = (batch) => {
    const matchedBatch = Array.isArray(selectedFaculty?.batchEntries)
      ? selectedFaculty.batchEntries.find(
          (entry) =>
            String(entry?.batchName || '').trim() === String(batch || '').trim() &&
            String(entry?.courseId || '').trim() === String(form.courseId || '').trim(),
        )
      : null
    setForm((current) => ({
      ...current,
      batch,
      batchId: matchedBatch?.id || '',
    }))
  }

  const markTouched = (name) => {
    setFieldFocus((current) => ({
      ...current,
      [name]: true,
    }))
  }

  const shouldShowError = (name) => submitted || fieldFocus[name]

  const goToNextStep = () => {
    const stepErrors = validateStep(form, currentStep, selectedCourse)
    if (Object.keys(stepErrors).length > 0) {
      setSubmitted(true)
      return
    }

    setSubmitted(false)
    setCurrentStep((value) => Math.min(value + 1, studentWizardSteps.length - 1))
  }

  const goToPreviousStep = () => {
    setSubmitted(false)
    setCurrentStep((value) => Math.max(value - 1, 0))
  }

  const handleSubmit = async () => {
    if (isSavingStudent) return

    setIsSavingStudent(true)
    setSubmitted(true)
    setActionError('')
    setServerFieldErrors({})

    if (String(form.courseId || '').trim() && !selectedCourse) {
      setCurrentStep(1)
      setFieldFocus((current) => ({
        ...current,
        courseInterested: true,
      }))
      setActionError('Selected course is no longer available. Please choose a valid course.')
      setIsSavingStudent(false)
      return
    }

    const nextErrors = validateForm(form, selectedCourse)
    const duplicateStudent = findDuplicateStudent(form, backfilledStudents, editingStudentId)
    if (Object.keys(nextErrors).length > 0) {
      const firstErrorField = Object.keys(nextErrors)[0]
      setCurrentStep(getStepIndexForField(firstErrorField))
      setFieldFocus((current) => ({
        ...current,
        [firstErrorField]: true,
      }))
      setActionError(Object.values(nextErrors)[0] || 'Please complete the required fields before submitting.')
      setIsSavingStudent(false)
      return
    }

    if (duplicateStudent) {
      setCurrentStep(getStepIndexForField('emailAddress'))
      setFieldFocus((current) => ({
        ...current,
        emailAddress: true,
      }))
      setActionError(
        'Email already exists.',
      )
      setIsSavingStudent(false)
      return
    }

    const course = selectedCourse
    const existingStudent = editingStudentId ? backfilledStudents.find((student) => student.id === editingStudentId) : null
    const isFullPayment = isFullPaymentMode(form)
    const installmentCount = isFullPayment ? 0 : getCourseInstallmentCount(course)
    const payload = {
      ...form,
      courseId: form.courseId || course?.id || '',
      courseInterested: form.courseInterested || course?.name || '',
      facultyName: form.facultyName || '',
      facultyId: form.facultyId || selectedFaculty?.id || existingStudent?.facultyId || '',
      batchName: form.batch || '',
      batchId: form.batchId || selectedFormBatchEntry?.id || existingStudent?.batchId || '',
      status: form.status || existingStudent?.status || 'Active',
    }

    const paidAtDate = form.admissionDate || existingStudent?.admissionDate || getTodayValue()
    const paidAmount = String(form.afterDiscount || form.actualFees || existingStudent?.afterDiscount || existingStudent?.actualFees || '')

    payload.paymentMode = isFullPayment ? 'Full Payment' : 'Installment'
    payload.totalAmount = String(form.actualFees || existingStudent?.actualFees || form.afterDiscount || existingStudent?.afterDiscount || '')
    payload.firstInstallmentStatus = isFullPayment ? 'Paid' : existingStudent?.firstInstallmentStatus || 'Pending'
    payload.firstInstallmentPaidAt = isFullPayment ? paidAtDate : existingStudent?.firstInstallmentPaidAt || ''
    payload.secondInstallmentStatus = isFullPayment ? 'Paid' : existingStudent?.secondInstallmentStatus || 'Pending'
    payload.secondInstallmentPaidAt = isFullPayment ? paidAtDate : existingStudent?.secondInstallmentPaidAt || ''
    payload.thirdInstallmentStatus = isFullPayment ? 'Paid' : existingStudent?.thirdInstallmentStatus || 'Pending'
    payload.thirdInstallmentPaidAt = isFullPayment ? paidAtDate : existingStudent?.thirdInstallmentPaidAt || ''
    payload.firstInstallmentAmount = isFullPayment ? paidAmount : form.installment1 || existingStudent?.firstInstallmentAmount || ''
    payload.secondInstallmentAmount = isFullPayment ? '0' : form.installment2 || existingStudent?.secondInstallmentAmount || ''
    payload.thirdInstallmentAmount = isFullPayment ? '0' : form.installment3 || existingStudent?.thirdInstallmentAmount || ''
    payload.firstInstallmentDate = isFullPayment ? paidAtDate : form.firstInstallmentDate || existingStudent?.firstInstallmentDate || ''
    payload.secondDueDate = isFullPayment ? '' : form.secondDueDate || existingStudent?.secondDueDate || ''
    payload.thirdDueDate = isFullPayment ? '' : form.thirdDueDate || existingStudent?.thirdDueDate || ''
    for (let index = 1; index <= Math.min(installmentCount || 0, MAX_INSTALLMENT_FIELDS); index += 1) {
      const fieldName = `installment${index}`
      payload[fieldName] = isFullPayment ? '0' : form[fieldName] || existingStudent?.[fieldName] || ''
    }

    try {
      let savedStudent = null
      if (editingStudentId) {
        savedStudent = await updateStudent(editingStudentId, payload)
      } else {
        savedStudent = await createStudent(payload)
      }

      savePendingLoginEmail(savedStudent?.emailAddress || payload.emailAddress)

      setStudents((currentStudents) => {
        const nextStudents = currentStudents.filter((student) => student.id !== savedStudent.id)
        return [savedStudent, ...nextStudents]
      })

      setCurrentPage(1)
      if (isDrawerEditing) {
        setIsDrawerEditing(false)
        setEditingStudentId('')
      } else {
        setIsModalOpen(false)
        setForm(createEmptyForm())
        setFieldFocus({})
        setSubmitted(false)
        setEditingStudentId('')
      }
      setOpenActionMenuId('')

      void loadStudents({ silent: true })
    } catch (error) {
      const errorMessage = apiErrorMessage(error, 'Unable to save student details.')
      const normalizedErrorMessage = String(errorMessage || '').toLowerCase()

      if (normalizedErrorMessage.includes('mobile number already exists') || normalizedErrorMessage.includes('mobile already exists')) {
        setServerFieldErrors({ mobileNumber: 'Mobile number already exists.' })
        setFieldFocus((current) => ({ ...current, mobileNumber: true }))
        setCurrentStep(0)
        setActionError('')
        return
      }

      setActionError(errorMessage)
    } finally {
      setIsSavingStudent(false)
    }
  }

  const handleFormSubmit = (event) => {
    event.preventDefault()
  }

  const closeSubmissionPopup = () => {
    setActionError('')
  }

  const handlePrimaryAction = () => {
    if (isSavingStudent) return

    if (currentStep < studentWizardSteps.length - 1) {
      goToNextStep()
      return
    }

    void handleSubmit()
  }

  const handleDelete = async (studentId) => {
    setActionError('')
    try {
      await deleteStudent(studentId)
      await loadStudents()
      setCurrentPage(1)
      setOpenActionMenuId('')
      if (selectedStudentId === studentId) {
        closeDrawer()
      }
    } catch (error) {
      setActionError(apiErrorMessage(error, 'Unable to delete student.'))
    }
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    void handleDelete(deleteTarget.id)
    closeDeleteModal()
  }

  const requestInstallmentToggle = (studentId, installmentField, paidAtField) => {
    const currentStudent = students.find((student) => student.id === studentId)
    if (!currentStudent) return

    if (installmentField === 'secondInstallmentStatus' && currentStudent.firstInstallmentStatus !== 'Paid') {
      return
    }

    if (installmentField === 'thirdInstallmentStatus' && currentStudent.secondInstallmentStatus !== 'Paid') {
      return
    }

    const nextStatus = currentStudent[installmentField] === 'Paid' ? 'Pending' : 'Paid'
    setInstallmentConfirmTarget({
      studentId,
      installmentField,
      paidAtField,
      nextStatus,
      studentName: currentStudent.studentName || 'this student',
      installmentLabel:
        installmentField === 'firstInstallmentStatus'
          ? '1st Installment'
          : installmentField === 'secondInstallmentStatus'
            ? '2nd Installment'
            : '3rd Installment',
      amount:
        installmentField === 'firstInstallmentStatus'
          ? currentStudent.firstInstallmentAmount
          : installmentField === 'secondInstallmentStatus'
            ? currentStudent.secondInstallmentAmount
            : currentStudent.thirdInstallmentAmount || currentStudent.installment3,
    })
  }

  const confirmInstallmentToggle = () => {
    if (!installmentConfirmTarget) return
    void toggleInstallmentStatus(
      installmentConfirmTarget.studentId,
      installmentConfirmTarget.installmentField,
      installmentConfirmTarget.paidAtField,
    )
    closeInstallmentConfirmModal()
  }

  const toggleInstallmentStatus = async (studentId, installmentField, paidAtField) => {
    const currentStudent = students.find((student) => student.id === studentId)
    if (!currentStudent) return

    if (installmentField === 'secondInstallmentStatus' && currentStudent.firstInstallmentStatus !== 'Paid') {
      return
    }

    if (installmentField === 'thirdInstallmentStatus' && currentStudent.secondInstallmentStatus !== 'Paid') {
      return
    }

    setActionError('')
    const nextStatus = currentStudent[installmentField] === 'Paid' ? 'Pending' : 'Paid'
    const nextPaidAt = nextStatus === 'Paid' ? getTodayValue() : ''
    const previousStudents = students
    const updatePayload = {
      studentCode: currentStudent.studentCode || '',
      studentName: currentStudent.studentName || '',
      mobileNumber: currentStudent.mobileNumber || '',
      emailAddress: currentStudent.emailAddress || '',
      parentSpouseNumber: currentStudent.parentSpouseNumber || '',
      location: currentStudent.location || '',
      facultyId: currentStudent.facultyId || '',
      facultyName: currentStudent.facultyName || '',
      courseId: currentStudent.courseId || '',
      courseInterested: currentStudent.courseInterested || '',
      batchId: currentStudent.batchId || '',
      batchName: currentStudent.batchName || currentStudent.batch || '',
      qualification: currentStudent.qualification || '',
      passedOutYear: currentStudent.passedOutYear || '',
      currentStatus: currentStudent.currentStatus || '',
      designation: currentStudent.designation || '',
      source: currentStudent.source || '',
      status: currentStudent.status || 'Active',
      paymentMode: currentStudent.paymentMode || 'Installment',
      actualFees: currentStudent.actualFees || '',
      registrationFees: currentStudent.registrationFees || '',
      discount: currentStudent.discount || '',
      afterDiscount: currentStudent.afterDiscount || '',
      installment1: currentStudent.installment1 || '',
      installment2: currentStudent.installment2 || '',
      installment3: currentStudent.installment3 || '',
      installment4: currentStudent.installment4 || '',
      totalAmount: currentStudent.totalAmount || '',
      admissionDate: currentStudent.admissionDate || '',
      firstInstallmentAmount: currentStudent.firstInstallmentAmount || '',
      firstInstallmentDate: currentStudent.firstInstallmentDate || '',
      firstInstallmentStatus: currentStudent.firstInstallmentStatus || 'Pending',
      firstInstallmentPaidAt: currentStudent.firstInstallmentPaidAt || '',
      secondInstallmentAmount: currentStudent.secondInstallmentAmount || '',
      secondDueDate: currentStudent.secondDueDate || '',
      secondInstallmentStatus: currentStudent.secondInstallmentStatus || 'Pending',
      secondInstallmentPaidAt: currentStudent.secondInstallmentPaidAt || '',
      thirdInstallmentAmount: currentStudent.thirdInstallmentAmount || '',
      thirdDueDate: currentStudent.thirdDueDate || '',
      thirdInstallmentStatus: currentStudent.thirdInstallmentStatus || 'Pending',
      thirdInstallmentPaidAt: currentStudent.thirdInstallmentPaidAt || '',
      remarks: currentStudent.remarks || '',
      [installmentField]: nextStatus,
      [paidAtField]: nextStatus === 'Paid' ? nextPaidAt : '',
    }

    setStudents((currentStudents) =>
      currentStudents.map((student) =>
        student.id === studentId
          ? {
              ...student,
              [installmentField]: nextStatus,
              [paidAtField]: nextPaidAt,
            }
          : student,
      ),
    )

    try {
      await updateStudent(studentId, updatePayload)
      setOpenActionMenuId('')
    } catch (error) {
      setStudents(previousStudents)
      setActionError(apiErrorMessage(error, 'Unable to update installment status.'))
    }
  }

  return (
    <section className="student-management-page">
      {isBusinessOwner ? (
        <OperationManagerHeader
          eyebrow={headerEyebrow}
          title={headerTitle}
          summary={headerSummary}
          initials={headerInitials}
          profileTitle={headerProfileTitle}
          email={headerEmail}
          onOpenMenu={openMenu}
        />
      ) : (
        <div className="operation-manager-dashboard">
          <OperationManagerWorkspaceHeader
            eyebrow={headerEyebrow}
            title={headerTitle}
            summary={headerSummary}
            initials={headerInitials}
            profileTitle={headerProfileTitle}
            email={headerEmail}
            onOpenMenu={openMenu}
          />
        </div>
      )}

      <article className="student-management-hero">
        <div className="student-management-heading">
          <div className="student-management-heading-icon" aria-hidden="true">
            <UserRound size={26} />
          </div>
          <h1>Student Management</h1>
          
        </div>

        <div className="student-management-actions">
          <SearchBar
            className="student-management-search"
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value)
              setCurrentPage(1)
            }}
            placeholder="Search student or course"
            ariaLabel="Search students"
          />
          <Button type="button" className="student-add-button" onClick={openModal}>
            + Add Student
          </Button>
          <div className="student-management-stat">
            <span>Total Students</span>
            <strong>{totalStudents}</strong>
          </div>
        </div>
      </article>

      <article className="student-list-card">
        <div className="student-list-header">
          <div>
            <h3>Student List</h3>
            <p>Newly added records appear here immediately.</p>
          </div>
          <div className="student-list-header-actions">
            <Button type="button" variant="ghost" className="student-report-button" onClick={() => openAttendanceReportModal('all')}>
              <FileDown />
              <span>Generate Attendance Report</span>
            </Button>
            {latestStudent ? (
              <div className="student-latest-chip">
                Latest: <strong>{latestStudent.studentName}</strong>
              </div>
            ) : null}
          </div>
        </div>

        {actionError ? (
          <div className="student-empty-state" role="alert" aria-live="polite">
            <strong>Action failed</strong>
            <p>{actionError}</p>
          </div>
        ) : null}

        {isStudentsLoading ? (
          <div className="student-empty-state">
            <strong>Loading students...</strong>
            <p>Connecting to the backend student records.</p>
          </div>
        ) : filteredStudents.length ? (
          <div className="student-table-wrap">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Total Amount</th>
                  <th>Admission Date</th>
                  <th>Current Installment</th>
                  <th>Installment Due Date</th>
                  <th>Status</th>
                  <th>Attendance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student, index) => {
                  const studentCourse = findCourseForStudent(student, courseOptions)
                  const studentHasThirdInstallment = hasThirdInstallment(student, studentCourse)
                  const visibleInstallmentStage = getVisibleInstallmentStage(student, studentCourse)
                  const shouldOpenUp = index >= Math.max(paginatedStudents.length - 2, 0)
                  const actionMenuDirection = shouldOpenUp ? 'up' : 'down'
                  const currentInstallmentAmount =
                    visibleInstallmentStage === 1
                      ? student.firstInstallmentAmount
                      : visibleInstallmentStage === 2
                        ? student.secondInstallmentAmount
                        : visibleInstallmentStage === 3
                          ? student.thirdInstallmentAmount || student.installment3 || studentCourse?.installment3
                          : ''
                  const currentInstallmentLabel =
                    visibleInstallmentStage === 1
                      ? '1st Installment'
                      : visibleInstallmentStage === 2
                        ? '2nd Installment'
                        : visibleInstallmentStage === 3
                          ? '3rd Installment'
                          : ''
                  const firstPaid = String(student.firstInstallmentStatus || 'Pending') === 'Paid'
                  const secondPaid = String(student.secondInstallmentStatus || 'Pending') === 'Paid'
                  const thirdPaid = studentHasThirdInstallment ? String(student.thirdInstallmentStatus || 'Pending') === 'Paid' : true
                  const secondDueDate = getSecondDueDate(student)
                  const thirdDueDate = getThirdDueDate(student)
                  const currentInstallmentDueDate =
                    isFullPaymentRecord(student)
                      ? ''
                      : visibleInstallmentStage === 2
                      ? secondDueDate
                      : visibleInstallmentStage === 3
                        ? thirdDueDate || addOneMonth(secondDueDate)
                        : ''
                  const currentInstallmentOverdueDays =
                    isFullPaymentRecord(student)
                      ? 0
                      : visibleInstallmentStage === 2
                      ? (secondPaid ? 0 : diffInDays(secondDueDate, getTodayValue()))
                      : visibleInstallmentStage === 3
                        ? (thirdPaid ? 0 : diffInDays(thirdDueDate || addOneMonth(secondDueDate), getTodayValue()))
                        : 0

                  return (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.studentName}</strong>
                        <small className="student-inline-email">{student.emailAddress}</small>
                      </td>
                      <td>{student.courseInterested}</td>
                      <td>{formatCurrency(student.totalAmount || student.actualFees || student.afterDiscount)}</td>
                      <td>{formatDate(student.admissionDate)}</td>
                      <td>
                        {isFullPaymentRecord(student) ? (
                          '-'
                        ) : visibleInstallmentStage === 1 ? (
                          <label className="installment-check">
                            <input
                              type="checkbox"
                              checked={firstPaid}
                              onChange={() => requestInstallmentToggle(student.id, 'firstInstallmentStatus', 'firstInstallmentPaidAt')}
                            />
                            <span className="installment-copy">
                              <strong>{formatCurrency(currentInstallmentAmount)}</strong>
                              <small>{currentInstallmentLabel}</small>
                            </span>
                          </label>
                        ) : visibleInstallmentStage === 2 ? (
                          <label className="installment-check">
                            <input
                              type="checkbox"
                              checked={secondPaid}
                              onChange={() => requestInstallmentToggle(student.id, 'secondInstallmentStatus', 'secondInstallmentPaidAt')}
                            />
                            <span className="installment-copy">
                              <strong>{formatCurrency(currentInstallmentAmount)}</strong>
                              <small>{currentInstallmentLabel}</small>
                            </span>
                          </label>
                        ) : visibleInstallmentStage === 3 ? (
                          <label className="installment-check">
                            <input
                              type="checkbox"
                              checked={thirdPaid}
                              onChange={() => requestInstallmentToggle(student.id, 'thirdInstallmentStatus', 'thirdInstallmentPaidAt')}
                            />
                            <span className="installment-copy">
                              <strong>{formatCurrency(currentInstallmentAmount)}</strong>
                              <small>{currentInstallmentLabel}</small>
                            </span>
                          </label>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="student-date-single-line">
                        {isFullPaymentRecord(student) ? (
                          '-'
                        ) : visibleInstallmentStage === 1 ? (
                          '-'
                        ) : currentInstallmentDueDate ? (
                          <>
                            <strong>{formatDate(currentInstallmentDueDate)}</strong>
                            <small>
                              {currentInstallmentOverdueDays > 0
                                ? `${currentInstallmentOverdueDays} day${currentInstallmentOverdueDays === 1 ? '' : 's'} overdue`
                                : 'On schedule'}
                            </small>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <PaymentStatusBadge student={student} />
                      </td>
                      <td>
                        <AttendanceStatusBadge student={student} />
                      </td>
                      <td>
                        <div
                          className={`student-action-menu ${openActionMenuId === student.id ? 'is-open' : ''} ${actionMenuDirection === 'up' ? 'is-up' : 'is-down'}`.trim()}
                          onMouseEnter={() => openActionMenu(student.id, actionMenuDirection)}
                          onMouseLeave={scheduleCloseActionMenu}
                        >
                          <button
                            type="button"
                            className="student-row-button student-row-button-more"
                            onMouseEnter={() => openActionMenu(student.id, actionMenuDirection)}
                            onClick={() => {
                              if (openActionMenuId === student.id) {
                                closeActionMenu()
                                return
                              }

                              openActionMenu(student.id, actionMenuDirection)
                            }}
                            aria-label="Open student actions"
                            aria-haspopup="menu"
                            aria-expanded={openActionMenuId === student.id}
                          >
                            <MoreIcon />
                          </button>
                          <div className="student-action-menu-panel" role="menu" aria-label="Student actions">
                            <button
                              type="button"
                              className="student-action-menu-item"
                              role="menuitem"
                              onClick={() => {
                                closeActionMenu()
                                openDrawer(student)
                              }}
                            >
                              <ViewIcon />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              className="student-action-menu-item"
                              role="menuitem"
                              onClick={() => {
                                closeActionMenu()
                                openEditModal(student)
                              }}
                            >
                              <EditIcon />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="student-action-menu-item is-danger"
                              role="menuitem"
                              onClick={() => {
                                closeActionMenu()
                                openDeleteModal(student)
                              }}
                            >
                              <DeleteIcon />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="student-empty-state">
            <strong>No students added yet</strong>
            <p>Use the Add Student button to create the first record.</p>
          </div>
        )}

        {filteredStudents.length > studentsPerPage ? (
          <PaginationBar
            className="app-pagination"
            currentPage={currentPageSafe}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            label="Student pagination"
          />
        ) : null}

        {filteredStudents.length > studentsPerPage ? (
          <div className="course-pagination student-pagination">
            <button
              type="button"
              className="pagination-link"
              onClick={() => setCurrentPage((page) => Math.max(Math.min(page, totalPages) - 1, 1))}
              disabled={currentPageSafe <= 1}
            >
              <span aria-hidden="true">←</span>
              Prev
            </button>

            <div className="pagination-pages" aria-label="Student list pages">
              <button type="button" className="pagination-page active" aria-current="page">
                {currentPageSafe}
              </button>
            </div>

            <button
              type="button"
              className="pagination-link"
              onClick={() => setCurrentPage((page) => Math.min(Math.min(page, totalPages) + 1, totalPages))}
              disabled={currentPageSafe >= totalPages}
            >
              Next
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}
      </article>

      {isModalOpen ? (
        <div className="course-modal-backdrop student-modal-backdrop" role="presentation">
          <form className="course-modal panel-card student-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onSubmit={handleFormSubmit}>
            <button type="button" className="course-modal-close" onClick={closeModal} aria-label="Close student form">
              X
            </button>

            <div className="course-modal-header student-modal-header">
              <div>
                <h3>{editingStudentId ? 'Edit Student' : 'Add New Student'}</h3>
                <p>Fill in the student details to create a new record.</p>
              </div>
            </div>

            {actionError ? (
              <div className="student-submit-popup" role="presentation" onClick={closeSubmissionPopup}>
                <div
                  className="student-submit-popup-card"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="student-submit-popup-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="student-submit-popup-close"
                    onClick={closeSubmissionPopup}
                    aria-label="Close submission popup"
                  >
                    X
                  </button>
                  <div className="student-submit-popup-icon" aria-hidden="true">
                    <DangerIcon />
                  </div>
                  <div className="student-submit-popup-copy">
                    <p className="section-kicker">Submission blocked</p>
                    <h4 id="student-submit-popup-title">Cannot save student</h4>
                    <p>{actionError}</p>
                  </div>
                  <div className="student-submit-popup-actions">
                    <button type="button" className="button button-solid" onClick={closeSubmissionPopup}>
                      OK
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="student-stepper">
              {studentWizardSteps.map((step, index) => (
                <div key={step.key} className={`student-stepper-item ${currentStep === index ? 'active' : ''} ${currentStep > index ? 'done' : ''}`.trim()}>
                  <span>{index + 1}</span>
                  <div className="student-stepper-copy">
                    <strong>{step.title}</strong>
                    <small>{step.subtitle}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="student-step-panel">
              {currentStep === 0 ? (
                <div className="student-step-section">
                  <div className="student-step-section-head">
                    <div className="student-step-icon">
                      <SectionIcon kind="basic" />
                    </div>
                    <div>
                      <p>Basic Information</p>
                      <h4>Please provide the basic details of the student.</h4>
                    </div>
                  </div>
                <div className="course-form-grid student-form-grid student-form-grid-tight">
                  <Field label="Enter Student Name" required icon={<FieldIcon kind="user" />} error={shouldShowError('studentName') ? errors.studentName : ''}>
                    <input
                      type="text"
                      value={form.studentName}
                      onChange={(event) => updateField('studentName', event.target.value)}
                      onBlur={() => markTouched('studentName')}
                      placeholder="Enter student name"
                    />
                  </Field>

                  <Field
                    label="Enter Mobile Number"
                    required
                    icon={<FieldIcon kind="phone" />}
                    error={shouldShowError('mobileNumber') ? serverFieldErrors.mobileNumber || errors.mobileNumber : ''}
                  >
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]*"
                      value={form.mobileNumber}
                      onChange={(event) => updateField('mobileNumber', event.target.value.replace(/\D/g, '').slice(0, 10))}
                      onBlur={() => markTouched('mobileNumber')}
                      placeholder="10-digit mobile number"
                    />
                  </Field>

                  <Field label="Enter Email Address" required icon={<FieldIcon kind="mail" />} error={shouldShowError('emailAddress') ? errors.emailAddress : ''}>
                    <input
                      type="email"
                      value={form.emailAddress}
                      onChange={(event) => updateField('emailAddress', event.target.value.replace(/\s+/g, '').toLowerCase())}
                      onBlur={() => markTouched('emailAddress')}
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="name@example.com"
                    />
                  </Field>

                  <Field label="Enter Parent / Spouse Number" required icon={<FieldIcon kind="phone" />} error={shouldShowError('parentSpouseNumber') ? errors.parentSpouseNumber : ''}>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]*"
                      value={form.parentSpouseNumber}
                      onChange={(event) => updateField('parentSpouseNumber', event.target.value.replace(/\D/g, '').slice(0, 10))}
                      onBlur={() => markTouched('parentSpouseNumber')}
                      placeholder="10-digit contact number"
                    />
                  </Field>

                  <Field label="Enter Location" required icon={<FieldIcon kind="pin" />} error={shouldShowError('location') ? errors.location : ''}>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(event) => updateField('location', event.target.value)}
                      onBlur={() => markTouched('location')}
                      placeholder="Current city or location"
                    />
                  </Field>
                </div>
                </div>
              ) : null}

              {currentStep === 1 ? (
                <div className="student-step-section">
                  <div className="student-step-section-head">
                    <div className="student-step-icon">
                      <SectionIcon kind="education" />
                    </div>
                    <div>
                      <p>Education Details</p>
                      <h4>Choose the course and academic background.</h4>
                    </div>
                  </div>
                <div className="course-form-grid student-form-grid student-form-grid-tight">
                  <Field label="Select Course Interested" required icon={<FieldIcon kind="course" />} error={shouldShowError('courseInterested') ? errors.courseInterested : ''}>
                    <select
                      value={form.courseId}
                      onChange={(event) => applyCourseDetails(event.target.value)}
                      onBlur={() => markTouched('courseInterested')}
                      disabled={isCoursesLoading}
                    >
                      <option value="">{isCoursesLoading ? 'Loading courses...' : 'Select course'}</option>
                      {courseOptions.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                      {!isCoursesLoading && !courseOptions.length ? <option value="" disabled>No courses available</option> : null}
                    </select>
                  </Field>

                  <Field label="Select Faculty Name" required icon={<FieldIcon kind="faculty" />} error={shouldShowError('facultyName') ? errors.facultyName : ''}>
                    <select
                      value={form.facultyName}
                      onChange={(event) => applyFacultyDetails(event.target.value)}
                      onBlur={() => markTouched('facultyName')}
                      disabled={isFacultyLoading || !form.courseId || !facultySelectOptions.length}
                    >
                      <option value="">
                        {isFacultyLoading
                          ? 'Loading faculty...'
                          : form.courseId
                            ? 'Select faculty'
                            : 'Select a course first'}
                      </option>
                      {facultySelectOptions.map((faculty) => (
                        <option key={`${faculty.value}-${faculty.label}`} value={faculty.value}>
                          {faculty.label}
                        </option>
                      ))}
                      {!isFacultyLoading && form.courseId && !facultySelectOptions.length ? (
                        <option value="" disabled>
                          No faculty mapped for this course
                        </option>
                      ) : null}
                    </select>
                  </Field>

                  <Field label="Select Batch" required icon={<FieldIcon kind="batch" />} error={shouldShowError('batch') ? errors.batch : ''}>
                    <select
                      value={form.batch}
                      onChange={(event) => applyBatchDetails(event.target.value)}
                      onBlur={() => markTouched('batch')}
                      disabled={isFacultyLoading || !form.facultyName || !batchSelectOptions.length}
                    >
                      <option value="">
                        {isFacultyLoading
                          ? 'Loading batches...'
                          : form.facultyName
                            ? 'Select batch'
                            : 'Select faculty first'}
                      </option>
                      {batchSelectOptions.map((batch) => (
                        <option key={`${batch.value}-${batch.label}`} value={batch.value}>
                          {batch.label}
                        </option>
                      ))}
                      {!isFacultyLoading && form.facultyName && form.courseId && !batchSelectOptions.length ? (
                        <option value="" disabled>
                          No batches available for this faculty and course
                        </option>
                      ) : null}
                    </select>
                  </Field>

                  <Field label="Enter Qualification" required icon={<FieldIcon kind="user" />} error={shouldShowError('qualification') ? errors.qualification : ''}>
                    <input
                      type="text"
                      value={form.qualification}
                      onChange={(event) => updateField('qualification', event.target.value)}
                      onBlur={() => markTouched('qualification')}
                      placeholder="Highest qualification"
                    />
                  </Field>

                  <Field label="Select Passed Out Year" required icon={<FieldIcon kind="year" />} error={shouldShowError('passedOutYear') ? errors.passedOutYear : ''}>
                    <select
                      value={form.passedOutYear}
                      onChange={(event) => updateField('passedOutYear', event.target.value)}
                      onBlur={() => markTouched('passedOutYear')}
                    >
                      <option value="">Select year</option>
                      {passedOutYearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Select Current Status" required icon={<FieldIcon kind="status" />} error={shouldShowError('currentStatus') ? errors.currentStatus : ''}>
                    <select
                      value={form.currentStatus}
                      onChange={(event) => updateField('currentStatus', event.target.value)}
                      onBlur={() => markTouched('currentStatus')}
                    >
                      <option value="">Select status</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Enter Designation"
                    icon={<FieldIcon kind="user" />}
                    hint="Required when the current status is Employee."
                    error={shouldShowError('designation') ? errors.designation : ''}
                  >
                    <input
                      type="text"
                      value={form.designation}
                      onChange={(event) => updateField('designation', event.target.value)}
                      onBlur={() => markTouched('designation')}
                      placeholder="Job title or designation"
                    />
                  </Field>

                  <Field
                    label="Select Source"
                    required
                    icon={<FieldIcon kind="note" />}
                    error={shouldShowError('source') ? errors.source : ''}
                  >
                    <select value={form.source} onChange={(event) => updateField('source', event.target.value)} onBlur={() => markTouched('source')}>
                      <option value="">Select source</option>
                      {sourceOptions.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="student-step-section">
                  <div className="student-step-section-head">
                    <div className="student-step-icon">
                      <SectionIcon kind="admission" />
                    </div>
                    <div>
                      <p>Admission Details</p>
                      <h4>Complete the fee and admission setup before submitting.</h4>
                    </div>
                  </div>
                <div className="course-form-grid student-form-grid student-form-grid-tight">
                  <Field label="Actual Fees (Auto Filled)" required icon={<FieldIcon kind="currency" />} error={shouldShowError('actualFees') ? errors.actualFees : ''}>
                    <input type="text" value={form.actualFees} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Registration Fees (Auto Filled)" required icon={<FieldIcon kind="balance" />} error={shouldShowError('registrationFees') ? errors.registrationFees : ''}>
                    <input type="text" value={form.registrationFees} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Discount (Auto Filled)" required icon={<FieldIcon kind="percent" />} error={shouldShowError('discount') ? errors.discount : ''}>
                    <input type="text" value={form.discount} readOnly placeholder="Auto filled from course" />
                  </Field>

                <Field label="After Discount (Auto Calculated)" required icon={<FieldIcon kind="currency" />} error={shouldShowError('afterDiscount') ? errors.afterDiscount : ''}>
                    <input type="text" value={form.afterDiscount} readOnly placeholder="Auto calculated" />
                  </Field>

                  <Field label="Payment Mode" required icon={<FieldIcon kind="note" />}>
                    <select
                      value={form.paymentMode}
                      onChange={(event) => updateField('paymentMode', event.target.value)}
                    >
                      {paymentModeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {!isFullPaymentMode(form) ? (
                    <>
                      {Array.from({ length: visibleInstallmentCount }, (_, index) => {
                        const installmentIndex = index + 1
                        const fieldName = `installment${installmentIndex}`
                        const fieldValue = form[fieldName] || ''

                        return (
                          <Field
                            key={fieldName}
                            label={`Installment ${installmentIndex} (Auto Filled)`}
                            required={installmentIndex <= visibleInstallmentCount}
                            icon={<FieldIcon kind="installment" />}
                            error={shouldShowError(fieldName) ? errors[fieldName] : ''}
                          >
                            <input type="text" value={fieldValue} readOnly placeholder="Auto filled from course" />
                          </Field>
                        )
                      })}
                    </>
                  ) : (
                    <Field label="Paid Amount" required icon={<FieldIcon kind="currency" />}>
                      <input type="text" value={form.afterDiscount} readOnly placeholder="Full payment amount" />
                    </Field>
                  )}

                  <Field label="Select Admission Date" required icon={<FieldIcon kind="calendar" />} error={shouldShowError('admissionDate') ? errors.admissionDate : ''}>
                    <input
                      type="date"
                      value={form.admissionDate}
                      onChange={(event) => updateField('admissionDate', event.target.value)}
                      onBlur={() => markTouched('admissionDate')}
                      placeholder="Select admission date"
                    />
                  </Field>

                  <Field
                    label="Enter Remarks"
                    icon={<FieldIcon kind="note" />}
                    multiline
                    hint="Optional notes can help the counselor follow up later."
                    error={shouldShowError('remarks') ? errors.remarks : ''}
                    className="student-field--full"
                  >
                    <textarea
                      value={form.remarks}
                      onChange={(event) => updateField('remarks', event.target.value)}
                      onBlur={() => markTouched('remarks')}
                      placeholder="Additional notes or counselor remarks"
                    />
                  </Field>
                </div>
                </div>
              ) : null}
            </div>

            <div className="course-validation-note student-validation-note">
              {currentStep === 2
                ? 'All required details should be entered accurately.'
                : 'Complete this section to move to the next step.'}
            </div>

            <div className="course-form-actions">
              <Button type="button" variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              {currentStep > 0 ? (
                <Button type="button" variant="ghost" onClick={goToPreviousStep}>
                  Back
                </Button>
              ) : null}
              {currentStep < studentWizardSteps.length - 1 ? (
                <Button type="button" onClick={handlePrimaryAction} disabled={isSavingStudent}>
                  Next
                </Button>
              ) : (
                <Button type="button" onClick={handlePrimaryAction} disabled={isSavingStudent}>
                  {isSavingStudent ? 'Saving...' : editingStudentId ? 'Update Student' : 'Submit'}
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : null}

      <AttendanceReportModal
        isOpen={Boolean(attendanceReportModal)}
        mode={attendanceReportModal?.mode || 'all'}
        student={attendanceReportStudent}
        form={attendanceReportForm}
        errors={attendanceReportValidationErrors}
        generalError={attendanceReportError}
        isDownloading={attendanceReportSubmitting}
        courseOptions={courseOptions}
        batchOptions={reportBatchOptions}
        onChangeField={updateAttendanceReportField}
        onClose={closeAttendanceReportModal}
        onDownload={handleAttendanceReportDownload}
        onCourseChange={handleAttendanceReportCourseChange}
      />

      {isDrawerOpen && selectedStudent ? (
        <div className="student-drawer-backdrop" role="presentation">
          <aside className="student-drawer student-drawer-table-view" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="student-drawer-table-header">
              <h3>Student Details</h3>
              <div className="student-drawer-table-actions">
                <div
                  className={`student-drawer-attendance-pill ${selectedStudentAttendanceMeta.toneClass}`.trim()}
                  aria-label={`Attendance ${selectedStudentAttendanceMeta.label}`}
                >
                  <span className="student-drawer-attendance-pill-dot" aria-hidden="true" />
                  <span>{selectedStudentAttendanceMeta.label}</span>
                </div>
                <button
                  type="button"
                  className="student-drawer-edit-button student-drawer-report-button"
                  onClick={() => openAttendanceReportModal('single', selectedStudent)}
                >
                  <FileDown />
                  <span>Generate Report</span>
                </button>
                {isDrawerEditing ? (
                  <>
                    <button type="button" className="student-drawer-edit-button" onClick={handleSubmit} disabled={isSavingStudent}>
                      {isSavingStudent ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="student-drawer-edit-button student-drawer-edit-button-ghost"
                      onClick={() => {
                        setForm(prepareStudentForm(selectedStudent))
                        setEditingStudentId(selectedStudent.id)
                        setIsDrawerEditing(false)
                        setActionError('')
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="student-drawer-edit-button"
                    onClick={() => startDrawerEdit(selectedStudent)}
                  >
                    Edit
                  </button>
                )}
                <button type="button" className="student-drawer-close student-drawer-close-floating" onClick={closeDrawer} aria-label="Close student details">
                  X
                </button>
              </div>
            </div>

            <div className="student-drawer-table-shell">
              <table className="student-details-table">
                <colgroup>
                  <col className="student-details-col-label" />
                  <col className="student-details-col-value" />
                  <col className="student-details-col-label" />
                  <col className="student-details-col-value" />
                </colgroup>
                <tbody>
                  {isDrawerEditing ? (
                    <>
                      <tr>
                        <th>Student Name</th>
                        <td><DrawerFormControl value={form.studentName} onChange={(event) => updateField('studentName', event.target.value)} /></td>
                        <th>Status</th>
                        <td>
                          <DrawerFormControl
                            as="select"
                            value={form.status}
                            onChange={(event) => updateField('status', event.target.value)}
                            options={recordStatusOptions}
                            placeholder="Select status"
                          />
                        </td>
                      </tr>
                      <tr>
                        <th>Email Address</th>
                        <td><DrawerFormControl value={form.emailAddress} onChange={(event) => updateField('emailAddress', event.target.value)} /></td>
                        <th>Mobile Number</th>
                        <td><DrawerFormControl value={form.mobileNumber} onChange={(event) => updateField('mobileNumber', event.target.value.replace(/\D/g, '').slice(0, 10))} /></td>
                      </tr>
                      <tr>
                        <th>Parent / Spouse Number</th>
                        <td><DrawerFormControl value={form.parentSpouseNumber} onChange={(event) => updateField('parentSpouseNumber', event.target.value.replace(/\D/g, '').slice(0, 10))} /></td>
                        <th>Location</th>
                        <td><DrawerFormControl value={form.location} onChange={(event) => updateField('location', event.target.value)} /></td>
                      </tr>
                      <tr>
                        <th>Course Interested</th>
                        <td>
                          <DrawerFormControl
                            as="select"
                            value={form.courseId}
                            onChange={(event) => applyCourseDetails(event.target.value)}
                            options={courseOptions.map((course) => ({ value: course.id, label: course.name }))}
                            placeholder={isCoursesLoading ? 'Loading courses...' : 'Select course'}
                            disabled={isCoursesLoading}
                          />
                        </td>
                        <th>Faculty Name</th>
                        <td>
                          <DrawerFormControl
                            as="select"
                            value={form.facultyName}
                            onChange={(event) => applyFacultyDetails(event.target.value)}
                            options={facultySelectOptions}
                            placeholder={
                              isFacultyLoading
                                ? 'Loading faculty...'
                                : form.courseId
                                  ? 'Select faculty'
                                  : 'Select a course first'
                            }
                            disabled={isFacultyLoading || !form.courseId || !facultySelectOptions.length}
                          />
                        </td>
                      </tr>
                      <tr>
                        <th>Batch</th>
                        <td>
                          <DrawerFormControl
                            as="select"
                            value={form.batch}
                            onChange={(event) => applyBatchDetails(event.target.value)}
                            options={batchSelectOptions}
                            placeholder={
                              isFacultyLoading
                                ? 'Loading batches...'
                                : form.facultyName
                                  ? 'Select batch'
                                  : 'Select faculty first'
                            }
                            disabled={isFacultyLoading || !form.facultyName || !batchSelectOptions.length}
                          />
                        </td>
                        <th>Qualification</th>
                        <td><DrawerFormControl value={form.qualification} onChange={(event) => updateField('qualification', event.target.value)} /></td>
                      </tr>
                      <tr>
                        <th>Passed Out Year</th>
                        <td>
                          <DrawerFormControl
                            as="select"
                            value={form.passedOutYear}
                            onChange={(event) => updateField('passedOutYear', event.target.value)}
                            options={passedOutYearOptions}
                            placeholder="Select year"
                          />
                        </td>
                        <th>Current Status</th>
                        <td>
                          <DrawerFormControl
                            as="select"
                            value={form.currentStatus}
                            onChange={(event) => updateField('currentStatus', event.target.value)}
                            options={statusOptions}
                            placeholder="Select status"
                          />
                        </td>
                      </tr>
                      <tr>
                        <th>Designation</th>
                        <td><DrawerFormControl value={form.designation} onChange={(event) => updateField('designation', event.target.value)} /></td>
                        <th>Admission Date</th>
                        <td><DrawerFormControl type="date" value={form.admissionDate} onChange={(event) => updateField('admissionDate', event.target.value)} /></td>
                      </tr>
                      <tr>
                        <th>Total Course Fee</th>
                        <td><DrawerFormControl value={form.actualFees} onChange={(event) => updateField('actualFees', event.target.value.replace(/\D/g, ''))} /></td>
                        <th>Discount</th>
                        <td><DrawerFormControl value={form.discount} onChange={(event) => updateField('discount', event.target.value.replace(/\D/g, ''))} /></td>
                      </tr>
                      <tr>
                        <th>Final Fee</th>
                        <td><DrawerFormControl value={form.afterDiscount} onChange={(event) => updateField('afterDiscount', event.target.value.replace(/\D/g, ''))} /></td>
                        <th>Payment Mode</th>
                        <td>
                          <DrawerFormControl
                            as="select"
                            value={form.paymentMode}
                            onChange={(event) => updateField('paymentMode', event.target.value)}
                            options={paymentModeOptions}
                            placeholder="Select payment mode"
                          />
                        </td>
                      </tr>
                      {!isFullPaymentMode(form) ? (
                        <>
                          <tr>
                            <th>1st Installment Amount</th>
                            <td><DrawerFormControl value={form.firstInstallmentAmount || form.installment1} onChange={(event) => updateField('installment1', event.target.value.replace(/\D/g, ''))} /></td>
                            <th>1st Installment Date</th>
                            <td><DrawerFormControl type="date" value={form.firstInstallmentDate} onChange={(event) => updateField('firstInstallmentDate', event.target.value)} /></td>
                          </tr>
                          <tr>
                            <th>1st Installment Status</th>
                            <td>
                              <DrawerFormControl
                                as="select"
                                value={form.firstInstallmentStatus}
                                onChange={(event) => updateField('firstInstallmentStatus', event.target.value)}
                                options={['Pending', 'Paid']}
                                placeholder="Select status"
                              />
                            </td>
                            <th>2nd Installment Amount</th>
                            <td><DrawerFormControl value={form.secondInstallmentAmount || form.installment2} onChange={(event) => updateField('installment2', event.target.value.replace(/\D/g, ''))} /></td>
                          </tr>
                          <tr>
                            <th>2nd Due Date</th>
                            <td><DrawerFormControl type="date" value={form.secondDueDate} onChange={(event) => updateField('secondDueDate', event.target.value)} /></td>
                            <th>2nd Installment Status</th>
                            <td>
                              <DrawerFormControl
                                as="select"
                                value={form.secondInstallmentStatus}
                                onChange={(event) => updateField('secondInstallmentStatus', event.target.value)}
                                options={['Pending', 'Paid']}
                                placeholder="Select status"
                              />
                            </td>
                          </tr>
                          {hasThirdInstallment(selectedStudent, selectedStudentCourse) ? (
                            <>
                              <tr>
                                <th>3rd Installment Amount</th>
                                <td><DrawerFormControl value={form.thirdInstallmentAmount || form.installment3} onChange={(event) => updateField('installment3', event.target.value.replace(/\D/g, ''))} /></td>
                                <th>3rd Due Date</th>
                                <td><DrawerFormControl type="date" value={form.thirdDueDate} onChange={(event) => updateField('thirdDueDate', event.target.value)} /></td>
                              </tr>
                              <tr>
                                <th>3rd Installment Status</th>
                                <td>
                                  <DrawerFormControl
                                    as="select"
                                    value={form.thirdInstallmentStatus}
                                    onChange={(event) => updateField('thirdInstallmentStatus', event.target.value)}
                                    options={['Pending', 'Paid']}
                                    placeholder="Select status"
                                  />
                                </td>
                                <th>Overdue Days</th>
                                <td>
                                  <DrawerValue
                                    value={
                                      (form.thirdInstallmentStatus || 'Pending') === 'Paid'
                                        ? '0 Days'
                                        : `${diffInDays(getThirdDueDate({ ...selectedStudent, ...form }) || addOneMonth(getSecondDueDate({ ...selectedStudent, ...form })), getTodayValue())} Days`
                                    }
                                  />
                                </td>
                              </tr>
                            </>
                          ) : null}
                          <tr>
                            <th>Overdue Days</th>
                            <td>
                              <DrawerValue
                                value={
                                  (form.secondInstallmentStatus || 'Pending') === 'Paid'
                                    ? '0 Days'
                                    : `${diffInDays(getSecondDueDate({ ...selectedStudent, ...form }), getTodayValue())} Days`
                                }
                              />
                            </td>
                            <th>How did you know about our Institute?</th>
                            <td><DrawerFormControl value={form.source} onChange={(event) => updateField('source', event.target.value)} /></td>
                          </tr>
                          <tr>
                            <th>Remarks</th>
                            <td colSpan={3}><DrawerFormControl as="textarea" value={form.remarks} onChange={(event) => updateField('remarks', event.target.value)} /></td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr>
                            <th>Paid Amount</th>
                            <td><DrawerValue value={formatCurrency(form.afterDiscount || form.actualFees)} /></td>
                            <th>Payment Status</th>
                            <td><DrawerValue value="Paid" tone="success" /></td>
                          </tr>
                          <tr>
                            <th>Payment Type</th>
                            <td><DrawerValue value="Full Payment" /></td>
                            <th>Admission Date</th>
                            <td><DrawerFormControl type="date" value={form.admissionDate} onChange={(event) => updateField('admissionDate', event.target.value)} /></td>
                          </tr>
                          <tr>
                            <th>How did you know about our Institute?</th>
                            <td><DrawerFormControl value={form.source} onChange={(event) => updateField('source', event.target.value)} /></td>
                            <th>Remarks</th>
                            <td><DrawerFormControl as="textarea" value={form.remarks} onChange={(event) => updateField('remarks', event.target.value)} /></td>
                          </tr>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <DrawerTableRow
                        leftLabel="Student Name"
                        leftValue={selectedStudent.studentName}
                        rightLabel="Status"
                        rightValue={selectedStudent.status || 'Inactive'}
                        rightTone={String(selectedStudent.status || 'Inactive') === 'Active' ? 'success' : 'warning'}
                      />
                      <DrawerTableRow
                        leftLabel="Email Address"
                        leftValue={selectedStudent.emailAddress}
                        rightLabel="Mobile Number"
                        rightValue={selectedStudent.mobileNumber}
                      />
                      <DrawerTableRow
                        leftLabel="Parent / Spouse Number"
                        leftValue={selectedStudent.parentSpouseNumber}
                        rightLabel="Location"
                        rightValue={selectedStudent.location}
                      />
                      <DrawerTableRow
                        leftLabel="Course Interested"
                        leftValue={selectedStudent.courseInterested}
                        rightLabel="Faculty Name"
                        rightValue={selectedStudent.facultyName}
                      />
                      <DrawerTableRow
                        leftLabel="Batch"
                        leftValue={<StudentBatchDisplay student={selectedStudent} facultyOptions={facultyOptions} />}
                        rightLabel="Qualification"
                        rightValue={selectedStudent.qualification}
                      />
                      <DrawerTableRow
                        leftLabel="Passed Out Year"
                        leftValue={selectedStudent.passedOutYear}
                        rightLabel="Current Status"
                        rightValue={selectedStudent.currentStatus}
                      />
                      <DrawerTableRow
                        leftLabel="Designation"
                        leftValue={selectedStudent.designation || '-'}
                        rightLabel="Admission Date"
                        rightValue={formatDate(selectedStudent.admissionDate)}
                      />
                      <DrawerTableRow
                        leftLabel="Total Course Fee"
                        leftValue={formatCurrency(selectedStudent.actualFees || selectedStudent.totalAmount || selectedStudent.afterDiscount)}
                        rightLabel="Discount"
                        rightValue={formatCurrency(selectedStudent.discount)}
                      />
                      <DrawerTableRow
                        leftLabel="Final Fee"
                        leftValue={formatCurrency(selectedStudent.afterDiscount)}
                        rightLabel="Payment Mode"
                        rightValue={getPaymentModeLabel(selectedStudent)}
                      />
                      {isFullPaymentRecord(selectedStudent) ? (
                        <>
                          <DrawerTableRow
                            leftLabel="Payment Status"
                            leftValue="Paid"
                            leftTone="success"
                            rightLabel="Remarks"
                            rightValue={getDrawerValue(selectedStudent.remarks, 'No remarks added')}
                          />
                        </>
                      ) : (
                        <>
                          <DrawerTableRow
                            leftLabel="1st Installment Amount"
                            leftValue={formatCurrency(selectedStudent.firstInstallmentAmount || selectedStudent.installment1)}
                            rightLabel="1st Installment Date"
                            rightValue={formatDate(selectedStudent.firstInstallmentDate || selectedStudent.admissionDate)}
                          />
                          <DrawerTableRow
                            leftLabel="1st Installment Status"
                            leftValue={selectedStudent.firstInstallmentStatus || 'Pending'}
                            leftTone={String(selectedStudent.firstInstallmentStatus || 'Pending') === 'Paid' ? 'success' : 'warning'}
                            rightLabel="2nd Installment Amount"
                            rightValue={formatCurrency(selectedStudent.secondInstallmentAmount || selectedStudent.installment2)}
                          />
                          <DrawerTableRow
                            leftLabel="2nd Due Date"
                            leftValue={formatDate(getSecondDueDate(selectedStudent))}
                            rightLabel="2nd Installment Status"
                            rightValue={selectedStudent.secondInstallmentStatus || 'Pending'}
                            rightTone={String(selectedStudent.secondInstallmentStatus || 'Pending') === 'Paid' ? 'success' : 'warning'}
                          />
                          <DrawerTableRow
                            leftLabel="Overdue Days"
                            leftValue={
                              hasThirdInstallment(selectedStudent, selectedStudentCourse)
                                ? (selectedStudent.thirdInstallmentStatus || 'Pending') === 'Paid'
                                  ? '0 Days'
                                  : `${diffInDays(getThirdDueDate(selectedStudent) || addOneMonth(getSecondDueDate(selectedStudent)), getTodayValue())} Days`
                                : (selectedStudent.secondInstallmentStatus || 'Pending') === 'Paid'
                                ? '0 Days'
                                : `${diffInDays(getSecondDueDate(selectedStudent), getTodayValue())} Days`
                            }
                            rightLabel="How did you know about our Institute?"
                            rightValue={selectedStudent.source}
                          />
                          {hasThirdInstallment(selectedStudent, selectedStudentCourse) ? (
                            <>
                              <DrawerTableRow
                                leftLabel="3rd Installment Amount"
                                leftValue={formatCurrency(selectedStudent.thirdInstallmentAmount || selectedStudent.installment3 || selectedStudentCourse?.installment3)}
                                rightLabel="3rd Due Date"
                                rightValue={formatDate(getThirdDueDate(selectedStudent) || addOneMonth(getSecondDueDate(selectedStudent)))}
                              />
                              <DrawerTableRow
                                leftLabel="3rd Installment Status"
                                leftValue={selectedStudent.thirdInstallmentStatus || 'Pending'}
                                leftTone={String(selectedStudent.thirdInstallmentStatus || 'Pending') === 'Paid' ? 'success' : 'warning'}
                                rightLabel={hasFourthInstallment(selectedStudent, selectedStudentCourse) ? '4th Installment Amount' : 'Remarks'}
                                rightValue={
                                  hasFourthInstallment(selectedStudent, selectedStudentCourse)
                                    ? formatCurrency(
                                        selectedStudent.fourthInstallmentAmount ||
                                          selectedStudent.installment4 ||
                                          selectedStudentCourse?.installment4,
                                      )
                                    : selectedStudent.remarks || '-'
                                }
                              />
                              {hasFourthInstallment(selectedStudent, selectedStudentCourse) ? (
                                <>
                                  <DrawerTableRow
                                    leftLabel="4th Due Date"
                                    leftValue={formatDate(getFourthDueDate(selectedStudent, selectedStudentCourse))}
                                    rightLabel="4th Installment Status"
                                    rightValue={selectedStudent.fourthInstallmentStatus || 'Pending'}
                                    rightTone={String(selectedStudent.fourthInstallmentStatus || 'Pending') === 'Paid' ? 'success' : 'warning'}
                                  />
                                  <DrawerTableRow
                                    leftLabel="Remarks"
                                    leftValue={selectedStudent.remarks || '-'}
                                    rightLabel="Admission Date"
                                    rightValue={formatDate(selectedStudent.admissionDate)}
                                  />
                                </>
                              ) : null}
                            </>
                          ) : (
                            <DrawerTableRow
                              leftLabel="Remarks"
                              leftValue={selectedStudent.remarks || '-'}
                              rightLabel="Admission Date"
                              rightValue={formatDate(selectedStudent.admissionDate)}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </aside>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="course-modal-backdrop" role="presentation" onClick={closeDeleteModal}>
          <div
            className="course-modal panel-card course-delete-modal student-delete-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="course-delete-icon" aria-hidden="true">
              <DangerIcon />
            </div>
            <div className="course-modal-header">
              <div>
                <h3>Delete student</h3>
              </div>
            </div>

            <p className="course-delete-text">
              Are you sure you want to delete <strong>{deleteTarget.studentName}</strong>? This action cannot be undone.
            </p>

            <div className="course-form-actions">
              <button type="button" className="button button-ghost" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button type="button" className="button button-solid course-delete-confirm" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {installmentConfirmTarget ? (
        <div className="course-modal-backdrop student-installment-confirm-backdrop" role="presentation" onClick={closeInstallmentConfirmModal}>
          <div
            className="course-modal panel-card course-delete-modal student-delete-modal student-installment-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-installment-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="course-delete-icon student-installment-confirm-icon" aria-hidden="true">
              <DangerIcon />
            </div>
            <div className="course-modal-header">
              <div>
                <h3 id="student-installment-confirm-title">Confirm installment payment</h3>
              </div>
            </div>

            <p className="course-delete-text">
              {installmentConfirmTarget.nextStatus === 'Paid' ? (
                <>
                  Mark <strong>{installmentConfirmTarget.studentName}</strong>'s{' '}
                  <strong>{installmentConfirmTarget.installmentLabel}</strong> as paid?
                  {installmentConfirmTarget.amount ? (
                    <>
                      {' '}
                      Amount: <strong>{formatCurrency(installmentConfirmTarget.amount)}</strong>.
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  Remove paid status for <strong>{installmentConfirmTarget.studentName}</strong>'s{' '}
                  <strong>{installmentConfirmTarget.installmentLabel}</strong>?
                </>
              )}
            </p>

            <div className="course-form-actions">
              <button type="button" className="button button-ghost" onClick={closeInstallmentConfirmModal}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-solid course-installment-confirm"
                onClick={confirmInstallmentToggle}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}


