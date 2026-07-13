import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { listCourses } from '../services/courseService'
import { createStudent, deleteStudent, listStudents, updateStudent } from '../services/studentService'

const statusOptions = ['Student', 'Employee', 'Other']
const sourceOptions = ['Justdial', 'Sulekha', 'Website', 'Poster', 'Others']
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
    actualFees: '',
    registrationFees: '',
    discount: '',
    afterDiscount: '',
    installment1: '',
    installment2: '',
    installment3: '',
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

function getStudentInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'ST'

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)
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

function getSecondDueDate(student) {
  return student?.secondDueDate || addOneMonth(student?.admissionDate)
}

function getThirdDueDate(student) {
  if (!hasThirdInstallment(student)) return ''
  return student?.thirdDueDate || addOneMonth(getSecondDueDate(student))
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

function mapCourseToForm(current, course) {
  if (!course) {
    return {
      ...current,
      courseId: '',
      courseInterested: '',
      actualFees: '',
      registrationFees: '',
      discount: '',
      afterDiscount: '',
      installment1: '',
      installment2: '',
      installment3: '',
      facultyName: current.facultyName || '',
      batch: current.batch || '',
    }
  }

  const actualFees = String(course.actualFees ?? '')
  const discount = String(course.discount ?? '')
  const afterDiscount =
    String(course.afterDiscount ?? '') ||
    (actualFees !== '' && discount !== '' ? String(Math.max(Number(actualFees) - Number(discount), 0)) : '')

  return {
    ...current,
    courseId: course.id,
    courseInterested: course.name,
    facultyName: current.facultyName,
    batch: current.batch,
    actualFees,
    registrationFees: String(course.registrationFees ?? ''),
    discount,
    afterDiscount,
    installment1: String(course.installment1 ?? ''),
    installment2: String(course.installment2 ?? ''),
    installment3: String(course.installment3 ?? ''),
  }
}

function validateForm(form, course = null) {
  const errors = {}
  const currentYear = new Date().getFullYear()
  const requiresThirdInstallment = hasThirdInstallment(form, course)

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
  if (!form.installment1 && form.courseId) errors.installment1 = 'Installment 1 is missing.'
  if (!form.installment2 && form.courseId) errors.installment2 = 'Installment 2 is missing.'
  if (requiresThirdInstallment && !form.installment3) errors.installment3 = 'Installment 3 is missing.'
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
    2: ['actualFees', 'registrationFees', 'discount', 'afterDiscount', 'installment1', 'installment2', 'installment3', 'admissionDate'],
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => stepFields[stepIndex]?.includes(field)),
  )
}

function getStepIndexForField(fieldName) {
  const stepFields = {
    0: ['studentName', 'mobileNumber', 'emailAddress', 'parentSpouseNumber', 'location'],
    1: ['courseInterested', 'facultyName', 'batch', 'qualification', 'passedOutYear', 'currentStatus', 'designation', 'source'],
    2: ['actualFees', 'registrationFees', 'discount', 'afterDiscount', 'installment1', 'installment2', 'installment3', 'admissionDate', 'remarks'],
  }

  return Number(
    Object.entries(stepFields).find(([_, fields]) => fields.includes(fieldName))?.[0] ?? 2,
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

function DetailItem({ label, value, fullWidth = false, icon = null }) {
  return (
    <div className={`student-detail-item ${fullWidth ? 'student-detail-item-full' : ''}`.trim()}>
      <div className="student-detail-item-head">
        {icon ? <span className="student-detail-item-icon">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <strong>{value || '-'}</strong>
    </div>
  )
}

function FieldIcon({ kind }) {
  if (kind === 'user') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5.5 18c1.2-3.3 4-5 6.5-5s5.3 1.7 6.5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'phone') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M6.2 4.8l2.1-.8c.8-.3 1.7 0 2.1.7l1.1 2c.4.7.3 1.6-.3 2.1l-1.2 1.1c1 1.9 2.6 3.6 4.5 4.5l1.1-1.2c.5-.6 1.4-.7 2.1-.3l2 1.1c.7.4 1 1.3.7 2.1l-.8 2.1c-.3.8-1.1 1.4-2 1.4C10.2 19.7 4.3 13.8 4.8 6.8c.1-.9.6-1.7 1.4-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (kind === 'mail') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4.5" y="6" width="15" height="12" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6 8l6 4.6L18 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (kind === 'pin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 20s5-4.8 5-9a5 5 0 1 0-10 0c0 4.2 5 9 5 9Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="11" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }

  if (kind === 'course') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4.8 7.5 12 4l7.2 3.5L12 11 4.8 7.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M6.5 9.5V14c0 1.7 2.5 3.2 5.5 3.2s5.5-1.5 5.5-3.2V9.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'faculty') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3 3.8 7.2 12 11.5l8.2-4.3L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M6.2 12.4v3.5c0 1.4 2.6 2.8 5.8 2.8s5.8-1.4 5.8-2.8v-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'batch') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="6" width="14" height="12" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 6V4.5M16 6V4.5M7 10h10M7 13h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'year') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 3.8v2.2M17 3.8v2.2M5.5 8h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="4.5" y="6" width="15" height="13.5" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }

  if (kind === 'status') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 12a7 7 0 1 0 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 5v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (kind === 'note') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="4.5" width="14" height="15" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'currency') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 4.5v15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15.5 7.2c0-1.5-1.6-2.7-3.5-2.7S8.5 6 8.5 7.4s1.2 2.1 3.5 2.7c2.4.6 3.5 1.2 3.5 2.8S13.9 16 12 16s-3.5-1.1-3.5-2.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (kind === 'percent') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 17 17 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="8" cy="8" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16" cy="16" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }

  if (kind === 'balance') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7.5 8.5h9M8.5 12h7M9.2 15.5h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'installment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4.8" y="5" width="14.4" height="14" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 9h8M8 12h8M8 15h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4.5" y="5.5" width="15" height="14" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 9h15M8 4v3M16 4v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  return null
}

function SectionIcon({ kind }) {
  if (kind === 'basic') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M5.5 18c1.2-3.3 4-5 6.5-5s5.3 1.7 6.5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'education') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 4 3.8 8.2 12 12.3l8.2-4.1L12 4Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M6 10.4v3.8c0 1.5 2.7 3 6 3s6-1.5 6-3v-3.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'admission') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="4.8" width="14" height="15" rx="2.4" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  }

  return null
}

function DetailIcon({ kind }) {
  if (kind === 'user') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M5.5 18c1.2-3.3 4-5 6.5-5s5.3 1.7 6.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'phone') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M6.2 4.8l2.1-.8c.8-.3 1.7 0 2.1.7l1.1 2c.4.7.3 1.6-.3 2.1l-1.2 1.1c1 1.9 2.6 3.6 4.5 4.5l1.1-1.2c.5-.6 1.4-.7 2.1-.3l2 1.1c.7.4 1 1.3.7 2.1l-.8 2.1c-.3.8-1.1 1.4-2 1.4C10.2 19.7 4.3 13.8 4.8 6.8c.1-.9.6-1.7 1.4-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (kind === 'mail') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4.5" y="6" width="15" height="12" rx="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M6 8l6 4.6L18 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (kind === 'pin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 20s5-4.8 5-9a5 5 0 1 0-10 0c0 4.2 5 9 5 9Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="11" r="1.8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }

  if (kind === 'course') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 4 3.8 8.2 12 12.3l8.2-4.1L12 4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M6 10.4v3.8c0 1.5 2.7 3 6 3s6-1.5 6-3v-3.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'faculty') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3 3.8 7.2 12 11.5l8.2-4.3L12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M6.2 12.4v3.5c0 1.4 2.6 2.8 5.8 2.8s5.8-1.4 5.8-2.8v-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'batch') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="6" width="14" height="12" rx="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 6V4.5M16 6V4.5M7 10h10M7 13h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'year') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 3.8v2.2M17 3.8v2.2M5.5 8h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="4.5" y="6" width="15" height="13.5" rx="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }

  if (kind === 'status') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 12a7 7 0 1 0 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 5v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (kind === 'source') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4.8 7.5H19.2M4.8 12H19.2M4.8 16.5h8.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4.5" y="5.5" width="15" height="14" rx="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4.5 9h15M8 4v3M16 4v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'fees') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 4.5v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M15.5 7.2c0-1.5-1.6-2.7-3.5-2.7S8.5 6 8.5 7.4s1.2 2.1 3.5 2.7c2.4.6 3.5 1.2 3.5 2.8S13.9 16 12 16s-3.5-1.1-3.5-2.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (kind === 'discount') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 17 17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="8" cy="8" r="1.7" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="16" r="1.7" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }

  if (kind === 'installment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4.8" y="5" width="14.4" height="14" rx="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 9h8M8 12h8M8 15h4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'note') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="4.5" width="14" height="15" rx="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

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

export function StudentManagementPage() {
  const [students, setStudents] = useState([])
  const [courseOptions, setCourseOptions] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isStudentsLoading, setIsStudentsLoading] = useState(true)
  const [isCoursesLoading, setIsCoursesLoading] = useState(true)
  const [form, setForm] = useState(createEmptyForm)
  const [submitted, setSubmitted] = useState(false)
  const [fieldFocus, setFieldFocus] = useState({})
  const [editingStudentId, setEditingStudentId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [actionError, setActionError] = useState('')
  const studentsPerPage = 5
  const passedOutYearOptions = useMemo(() => getPassedOutYearOptions(), [])

  const selectedCourse = useMemo(() => findCourseForForm(courseOptions, form), [courseOptions, form])
  const errors = useMemo(() => {
    const nextErrors = validateForm(form, selectedCourse)
    const duplicateStudent = findDuplicateStudent(form, students, editingStudentId)

    if (duplicateStudent) {
      nextErrors.emailAddress = 'Email already exists.'
    }

    return nextErrors
  }, [editingStudentId, form, selectedCourse, students])
  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [selectedStudentId, students],
  )
  const selectedStudentCourse = useMemo(
    () => (selectedStudent ? findCourseForStudent(selectedStudent, courseOptions) : null),
    [courseOptions, selectedStudent],
  )
  const totalStudents = students.length
  const latestStudent = students[0]
  const totalPages = Math.max(1, Math.ceil(totalStudents / studentsPerPage))
  const currentPageSafe = Math.min(currentPage, totalPages)
  const paginatedStudents = useMemo(() => {
    const start = (currentPageSafe - 1) * studentsPerPage
    return students.slice(start, start + studentsPerPage)
  }, [currentPageSafe, students])
  const loadStudents = async () => {
    setIsStudentsLoading(true)

    try {
      const result = await listStudents({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
      setStudents(result.data || [])
      setActionError('')
    } catch (error) {
      setStudents([])
      setActionError(apiErrorMessage(error, 'Failed to load students from the backend.'))
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
                  installment1: course?.installment1 ?? '',
                  installment2: course?.installment2 ?? '',
                  installment3: course?.installment3 ?? '',
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

  useEffect(() => {
    void Promise.all([loadStudents(), loadCourseOptions()])
  }, [])

  const openModal = () => {
    setActionError('')
    setForm(createEmptyForm())
    setFieldFocus({})
    setSubmitted(false)
    setEditingStudentId('')
    setCurrentStep(0)
    setIsModalOpen(true)
  }

  const openEditModal = (student) => {
    setActionError('')
    setForm({
      ...createEmptyForm(),
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
      actualFees: student.actualFees || '',
      registrationFees: student.registrationFees || '',
      discount: student.discount || '',
      afterDiscount: student.afterDiscount || '',
      installment1: student.installment1 || '',
      installment2: student.installment2 || '',
      installment3: student.installment3 || '',
      remarks: student.remarks || '',
      parentSpouseNumber: student.parentSpouseNumber || '',
      admissionDate: student.admissionDate || getTodayValue(),
      firstInstallmentPaidAt: student.firstInstallmentPaidAt || student.admissionDate || '',
      secondInstallmentPaidAt: student.secondInstallmentPaidAt || '',
    })
    setFieldFocus({})
    setSubmitted(false)
    setEditingStudentId(student.id)
    setCurrentStep(0)
    setIsModalOpen(true)
  }

  const openDrawer = (student) => {
    setSelectedStudentId(student.id)
    setIsDrawerOpen(true)
  }

  const openDeleteModal = (student) => {
    setActionError('')
    setDeleteTarget(student)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingStudentId('')
    setCurrentStep(0)
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
  }, [isDrawerOpen])

  useEffect(() => {
    saveStudentRecords(students)
  }, [students])

  useEffect(() => {
    const loadCourseOptions = () => {
      setIsCoursesLoading(true)
      const uniqueCourseOptions = Array.from(
        new Map(
          normalizeCourseList(loadCourseRecords())
            .filter((course) => String(course?.status || '').trim() === 'Active')
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
                  installment1: course?.installment1 ?? '',
                  installment2: course?.installment2 ?? '',
                  installment3: course?.installment3 ?? '',
                },
              ]
            })
            .filter(Boolean),
        ).values(),
      )

      setCourseOptions(uniqueCourseOptions)
      setIsCoursesLoading(false)
    }

    loadCourseOptions()

    const syncCourseOptions = () => {
      loadCourseOptions()
    }

    window.addEventListener(COURSE_RECORD_SYNC_EVENT, syncCourseOptions)
    window.addEventListener('storage', syncCourseOptions)

    return () => {
      window.removeEventListener(COURSE_RECORD_SYNC_EVENT, syncCourseOptions)
      window.removeEventListener('storage', syncCourseOptions)
    }
  }, [])

  const updateField = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const applyCourseDetails = (courseId) => {
    const course = courseOptions.find((item) => item.id === courseId) || null
    setForm((current) => ({
      ...mapCourseToForm(current, course),
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
    setSubmitted(true)
    setActionError('')

    const nextErrors = validateForm(form, selectedCourse)
    const duplicateStudent = findDuplicateStudent(form, students, editingStudentId)
    if (Object.keys(nextErrors).length > 0) {
      const firstErrorField = Object.keys(nextErrors)[0]
      setCurrentStep(getStepIndexForField(firstErrorField))
      setFieldFocus((current) => ({
        ...current,
        [firstErrorField]: true,
      }))
      setActionError(Object.values(nextErrors)[0] || 'Please complete the required fields before submitting.')
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
      return
    }

    const course = selectedCourse
    const existingStudent = editingStudentId ? students.find((student) => student.id === editingStudentId) : null
    const payload = {
      ...form,
      courseId: form.courseId || course?.id || '',
      courseInterested: form.courseInterested || course?.name || '',
      facultyName: form.facultyName || '',
      batchName: form.batch || '',
      firstInstallmentStatus: existingStudent?.firstInstallmentStatus || 'Paid',
      secondInstallmentStatus: existingStudent?.secondInstallmentStatus || 'Pending',
    }

    try {
      if (editingStudentId) {
        await updateStudent(editingStudentId, payload)
      } else {
        await createStudent(payload)
      }

      await loadStudents()
      setCurrentPage(1)
      setIsModalOpen(false)
      setForm(createEmptyForm())
      setFieldFocus({})
      setSubmitted(false)
      setEditingStudentId('')
    } catch (error) {
      setActionError(apiErrorMessage(error, 'Unable to save student details.'))
    }
  }

  const handleFormSubmit = (event) => {
    event.preventDefault()
  }

  const closeSubmissionPopup = () => {
    setActionError('')
  }

  const handlePrimaryAction = () => {
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
    try {
      await updateStudent(studentId, {
        [installmentField]: nextStatus,
        [paidAtField]: nextPaidAt,
      })
      await loadStudents()
    } catch (error) {
      setActionError(apiErrorMessage(error, 'Unable to update installment status.'))
    }
  }

  return (
    <section className="student-management-page">
      <article className="student-management-hero">
        <div>
          <p className="eyebrow">Student Management</p>
          
          <p>Capture admissions details with a quick popup form and keep new leads organized in one place.</p>
        </div>

        <div className="student-management-actions">
          <div className="student-management-stat">
            <span>Total Students</span>
            <strong>{totalStudents}</strong>
          </div>
          <Button type="button" className="student-add-button" onClick={openModal}>
            + Add Student
          </Button>
        </div>
      </article>

      <article className="panel-card student-list-card">
        <div className="student-list-header">
          <div>
            <h3>Student List</h3>
            <p>Newly added records appear here immediately.</p>
          </div>
          {latestStudent ? (
            <div className="student-latest-chip">
              Latest: <strong>{latestStudent.studentName}</strong>
            </div>
          ) : null}
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
        ) : students.length ? (
          <div className="student-table-wrap">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Phone</th>
                  <th>Course</th>
                  <th>Total Amount</th>
                  <th>Admission Date</th>
                  <th>1st Installment</th>
                  <th>2nd Installment</th>
                  <th>2nd Due Date</th>
                  <th>3rd Installment</th>
                  <th>3rd Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => {
                  const studentCourse = findCourseForStudent(student, courseOptions)
                  const studentHasThirdInstallment = hasThirdInstallment(student, studentCourse)
                  const secondDueDate = getSecondDueDate(student)
                  const thirdDueDate = getThirdDueDate(student)
                  const secondOverdueDays = String(student.secondInstallmentStatus || 'Pending') === 'Paid'
                    ? 0
                    : diffInDays(secondDueDate, getTodayValue())
                  const thirdOverdueDays = studentHasThirdInstallment && String(student.thirdInstallmentStatus || 'Pending') !== 'Paid'
                    ? diffInDays(thirdDueDate || addOneMonth(secondDueDate), getTodayValue())
                    : 0

                  return (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.studentName}</strong>
                        <small>{student.emailAddress}</small>
                      </td>
                      <td>{student.mobileNumber}</td>
                      <td>{student.courseInterested}</td>
                      <td>{formatCurrency(student.totalAmount || student.afterDiscount)}</td>
                      <td>{formatDate(student.admissionDate)}</td>
                      <td>
  <label className="installment-check">
    <input
      type="checkbox"
      checked={student.firstInstallmentStatus === 'Paid'}
      onChange={() => toggleInstallmentStatus(student.id, 'firstInstallmentStatus', 'firstInstallmentPaidAt')}
    />
    <strong>{formatCurrency(student.firstInstallmentAmount)}</strong>
    {student.firstInstallmentStatus === 'Paid' ? null : <small>{student.firstInstallmentStatus}</small>}
  </label>
</td>
  <td>
  <label className="installment-check">
    <input
      type="checkbox"
      checked={student.secondInstallmentStatus === 'Paid'}
      disabled={student.firstInstallmentStatus !== 'Paid'}
      onChange={() => toggleInstallmentStatus(student.id, 'secondInstallmentStatus', 'secondInstallmentPaidAt')}
    />
    <strong>{formatCurrency(student.secondInstallmentAmount)}</strong>
    {student.secondInstallmentStatus === 'Paid' ? null : <small>{student.secondInstallmentStatus}</small>}
  </label>
</td>
                      <td className="student-date-single-line">
                        <strong>{formatDate(secondDueDate)}</strong>
                        <small>{secondOverdueDays > 0 ? `${secondOverdueDays} day${secondOverdueDays === 1 ? '' : 's'} overdue` : 'On schedule'}</small>
                      </td>
                      <td>
                        {studentHasThirdInstallment ? (
                          <label className="installment-check">
                            <input
                              type="checkbox"
                              checked={student.thirdInstallmentStatus === 'Paid'}
                              disabled={student.secondInstallmentStatus !== 'Paid'}
                              onChange={() => toggleInstallmentStatus(student.id, 'thirdInstallmentStatus', 'thirdInstallmentPaidAt')}
                            />
                            <strong>{formatCurrency(student.thirdInstallmentAmount || student.installment3 || studentCourse?.installment3)}</strong>
                            {student.thirdInstallmentStatus === 'Paid' ? null : <small>{student.thirdInstallmentStatus}</small>}
                          </label>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="student-date-single-line">
                        {studentHasThirdInstallment ? (
                          <>
                            <strong>{formatDate(thirdDueDate || addOneMonth(secondDueDate))}</strong>
                            <small>
                              {thirdOverdueDays > 0 ? `${thirdOverdueDays} day${thirdOverdueDays === 1 ? '' : 's'} overdue` : 'On schedule'}
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
                        <div className="student-action-group">
                          <button
                            type="button"
                            className="student-row-button student-row-button-view"
                            onClick={() => openDrawer(student)}
                            aria-label="View student"
                            title="View"
                          >
                            <ViewIcon />
                          </button>
                          <button
                            type="button"
                            className="student-row-button student-row-button-edit"
                            onClick={() => openEditModal(student)}
                            aria-label="Edit student"
                            title="Edit"
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="student-row-button student-row-button-delete"
                            onClick={() => openDeleteModal(student)}
                            aria-label="Delete student"
                            title="Delete"
                          >
                            <DeleteIcon />
                          </button>
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

        {students.length > studentsPerPage ? (
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
                  <Field label="Student Name" required icon={<FieldIcon kind="user" />} error={shouldShowError('studentName') ? errors.studentName : ''}>
                    <input
                      type="text"
                      value={form.studentName}
                      onChange={(event) => updateField('studentName', event.target.value)}
                      onBlur={() => markTouched('studentName')}
                      placeholder="Enter student name"
                    />
                  </Field>

                  <Field label="Mobile Number" required icon={<FieldIcon kind="phone" />} error={shouldShowError('mobileNumber') ? errors.mobileNumber : ''}>
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

                  <Field label="Email Address" required icon={<FieldIcon kind="mail" />} error={shouldShowError('emailAddress') ? errors.emailAddress : ''}>
                    <input
                      type="email"
                      value={form.emailAddress}
                      onChange={(event) => updateField('emailAddress', event.target.value.replace(/\s+/g, '').toLowerCase())}
                      onBlur={() => markTouched('emailAddress')}
                      placeholder="name@example.com"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </Field>

                  <Field label="Parent / Spouse Number" required icon={<FieldIcon kind="phone" />} error={shouldShowError('parentSpouseNumber') ? errors.parentSpouseNumber : ''}>
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

                  <Field label="Location" required icon={<FieldIcon kind="pin" />} error={shouldShowError('location') ? errors.location : ''}>
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
                  <Field label="Course Interested" required icon={<FieldIcon kind="course" />} error={shouldShowError('courseInterested') ? errors.courseInterested : ''}>
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

                  <Field label="Faculty Name" required icon={<FieldIcon kind="faculty" />} error={shouldShowError('facultyName') ? errors.facultyName : ''}>
                    <input
                      type="text"
                      value={form.facultyName}
                      onChange={(event) => updateField('facultyName', event.target.value)}
                      onBlur={() => markTouched('facultyName')}
                      placeholder="Enter faculty name"
                    />
                  </Field>

                  <Field label="Batch" required icon={<FieldIcon kind="batch" />} error={shouldShowError('batch') ? errors.batch : ''}>
                    <input
                      type="text"
                      value={form.batch}
                      onChange={(event) => updateField('batch', event.target.value)}
                      onBlur={() => markTouched('batch')}
                      placeholder="Enter batch"
                    />
                  </Field>

                  <Field label="Qualification" required icon={<FieldIcon kind="user" />} error={shouldShowError('qualification') ? errors.qualification : ''}>
                    <input
                      type="text"
                      value={form.qualification}
                      onChange={(event) => updateField('qualification', event.target.value)}
                      onBlur={() => markTouched('qualification')}
                      placeholder="Highest qualification"
                    />
                  </Field>

                  <Field label="Passed Out Year" required icon={<FieldIcon kind="year" />} error={shouldShowError('passedOutYear') ? errors.passedOutYear : ''}>
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

                  <Field label="Current Status" required icon={<FieldIcon kind="status" />} error={shouldShowError('currentStatus') ? errors.currentStatus : ''}>
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
                    label="Designation"
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
                    label="How did you know about our Institute?"
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
                  <Field label="Actual Fees" required icon={<FieldIcon kind="currency" />} error={shouldShowError('actualFees') ? errors.actualFees : ''}>
                    <input type="text" value={form.actualFees} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Registration Fees" required icon={<FieldIcon kind="balance" />} error={shouldShowError('registrationFees') ? errors.registrationFees : ''}>
                    <input type="text" value={form.registrationFees} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Discount" required icon={<FieldIcon kind="percent" />} error={shouldShowError('discount') ? errors.discount : ''}>
                    <input type="text" value={form.discount} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="After Discount" required icon={<FieldIcon kind="currency" />} error={shouldShowError('afterDiscount') ? errors.afterDiscount : ''}>
                    <input type="text" value={form.afterDiscount} readOnly placeholder="Auto calculated" />
                  </Field>

                  <Field label="Installment 1" required icon={<FieldIcon kind="installment" />} error={shouldShowError('installment1') ? errors.installment1 : ''}>
                    <input type="text" value={form.installment1} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Installment 2" required icon={<FieldIcon kind="installment" />} error={shouldShowError('installment2') ? errors.installment2 : ''}>
                    <input type="text" value={form.installment2} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Installment 3" icon={<FieldIcon kind="installment" />} error={shouldShowError('installment3') ? errors.installment3 : ''}>
                    <input type="text" value={form.installment3} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Admission Date" required icon={<FieldIcon kind="calendar" />} error={shouldShowError('admissionDate') ? errors.admissionDate : ''}>
                    <input
                      type="date"
                      value={form.admissionDate}
                      onChange={(event) => updateField('admissionDate', event.target.value)}
                      onBlur={() => markTouched('admissionDate')}
                    />
                  </Field>

                  <Field
                    label="Remarks"
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
                <Button type="button" onClick={handlePrimaryAction}>
                  Next
                </Button>
              ) : (
                <Button type="button" onClick={handlePrimaryAction}>
                  {editingStudentId ? 'Update Student' : 'Submit'}
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {isDrawerOpen && selectedStudent ? (
        <div className="student-drawer-backdrop" role="presentation" onClick={closeDrawer}>
          <aside className="student-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="student-drawer-header student-drawer-header-top">
              <div className="student-drawer-title-block">
                <div className="student-drawer-avatar">{getStudentInitials(selectedStudent.studentName)}</div>
                <div className="student-drawer-main">
                  <div className="student-drawer-name-row">
                    <h3>{selectedStudent.studentName}</h3>
                    <span className="student-drawer-status-pill">Active</span>
                  </div>
                  <div className="student-drawer-summary-grid">
                    <div>
                      <span>Course</span>
                      <strong>{selectedStudent.courseInterested}</strong>
                    </div>
                    <div>
                      <span>Batch</span>
                      <strong>{selectedStudent.batch}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="student-drawer-actions">
                <button type="button" className="student-drawer-action-button student-drawer-action-button-ghost" aria-label="More options">
                  <span className="student-drawer-action-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                    </svg>
                  </span>
                </button>
                <button type="button" className="student-drawer-close" onClick={closeDrawer} aria-label="Close student details">
                  X
                </button>
              </div>
            </div>

            <div className="student-drawer-section student-drawer-section-card">
              <div className="student-drawer-section-head">
                <span className="student-drawer-section-icon">
                  <SectionIcon kind="basic" />
                </span>
                <div>
                  <h4>Basic Information</h4>
                  <p>Personal & Contact Details</p>
                </div>
              </div>
              <div className="student-detail-grid">
                <DetailItem label="Student Name" value={selectedStudent.studentName} icon={<DetailIcon kind="user" />} />
                <DetailItem label="Mobile Number" value={selectedStudent.mobileNumber} icon={<DetailIcon kind="phone" />} />
                <DetailItem label="Email Address" value={selectedStudent.emailAddress} icon={<DetailIcon kind="mail" />} />
                <DetailItem label="Parent / Spouse Number" value={selectedStudent.parentSpouseNumber} icon={<DetailIcon kind="phone" />} />
                <DetailItem label="Location" value={selectedStudent.location} icon={<DetailIcon kind="pin" />} />
              </div>
            </div>

            <div className="student-drawer-section student-drawer-section-card">
              <div className="student-drawer-section-head">
                <span className="student-drawer-section-icon">
                  <SectionIcon kind="education" />
                </span>
                <div>
                  <h4>Education Details</h4>
                  <p>Academic Information</p>
                </div>
              </div>
              <div className="student-detail-grid">
                <DetailItem label="Course Interested" value={selectedStudent.courseInterested} icon={<DetailIcon kind="course" />} />
                <DetailItem label="Faculty Name" value={selectedStudent.facultyName} icon={<DetailIcon kind="faculty" />} />
                <DetailItem label="Batch" value={selectedStudent.batch} icon={<DetailIcon kind="batch" />} />
                <DetailItem label="Qualification" value={selectedStudent.qualification} icon={<DetailIcon kind="user" />} />
                <DetailItem label="Passed Out Year" value={selectedStudent.passedOutYear} icon={<DetailIcon kind="calendar" />} />
                <DetailItem label="Current Status" value={selectedStudent.currentStatus} icon={<DetailIcon kind="status" />} />
                <DetailItem label="Designation" value={selectedStudent.designation || '-'} icon={<DetailIcon kind="note" />} />
              </div>
            </div>

            <div className="student-drawer-section student-drawer-section-card">
              <div className="student-drawer-section-head">
                <span className="student-drawer-section-icon">
                  <SectionIcon kind="admission" />
                </span>
                <div>
                  <h4>Admission Details</h4>
                  <p>Admission & Other Info</p>
                </div>
              </div>
              <div className="student-detail-grid">
                <DetailItem label="Admission Date" value={formatDate(selectedStudent.admissionDate)} icon={<DetailIcon kind="calendar" />} />
                <DetailItem label="Total Course Fee" value={formatCurrency(selectedStudent.totalAmount || selectedStudent.afterDiscount)} icon={<DetailIcon kind="fees" />} />
                <DetailItem label="Discount" value={formatCurrency(selectedStudent.discount)} icon={<DetailIcon kind="discount" />} />
                <DetailItem label="Final Fee" value={formatCurrency(selectedStudent.afterDiscount)} icon={<DetailIcon kind="fees" />} />
              </div>
            </div>

            <div className="student-drawer-section student-drawer-section-card">
              <div className="student-drawer-section-head">
                <span className="student-drawer-section-icon">
                  <SectionIcon kind="admission" />
                </span>
                <div>
                  <h4>Installment Details</h4>
                  <p>Payment Progress</p>
                </div>
              </div>
              <div className="student-installment-grid">
                <DetailItem label="1st Installment Amount" value={formatCurrency(selectedStudent.firstInstallmentAmount || selectedStudent.installment1)} icon={<DetailIcon kind="installment" />} />
                <DetailItem label="1st Installment Date" value={formatDate(selectedStudent.firstInstallmentDate || selectedStudent.admissionDate)} icon={<DetailIcon kind="calendar" />} />
                <DetailItem label="1st Installment Status" value={selectedStudent.firstInstallmentStatus || 'Pending'} icon={<DetailIcon kind="status" />} />
                <DetailItem label="2nd Installment Amount" value={formatCurrency(selectedStudent.secondInstallmentAmount || selectedStudent.installment2)} icon={<DetailIcon kind="installment" />} />
                <DetailItem label="2nd Due Date" value={formatDate(getSecondDueDate(selectedStudent))} icon={<DetailIcon kind="calendar" />} />
                <DetailItem
                  label="2nd Installment Status"
                  value={selectedStudent.secondInstallmentStatus || 'Pending'}
                  icon={<DetailIcon kind="status" />}
                />
                {hasThirdInstallment(selectedStudent, selectedStudentCourse) ? (
                  <>
                    <DetailItem
                      label="3rd Installment Amount"
                      value={formatCurrency(selectedStudent.thirdInstallmentAmount || selectedStudent.installment3 || selectedStudentCourse?.installment3)}
                      icon={<DetailIcon kind="installment" />}
                    />
                    <DetailItem label="3rd Due Date" value={formatDate(getThirdDueDate(selectedStudent) || addOneMonth(getSecondDueDate(selectedStudent)))} icon={<DetailIcon kind="calendar" />} />
                    <DetailItem
                      label="3rd Installment Status"
                      value={selectedStudent.thirdInstallmentStatus || 'Pending'}
                      icon={<DetailIcon kind="status" />}
                    />
                  </>
                ) : null}
                <DetailItem
                  label="Overdue Days"
                  value={
                    hasThirdInstallment(selectedStudent, selectedStudentCourse)
                      ? (selectedStudent.thirdInstallmentStatus || 'Pending') === 'Paid'
                        ? 'No overdue'
                        : `${diffInDays(getThirdDueDate(selectedStudent) || addOneMonth(getSecondDueDate(selectedStudent)), getTodayValue())} Days`
                      : (selectedStudent.secondInstallmentStatus || 'Pending') === 'Paid'
                      ? 'No overdue'
                      : `${diffInDays(getSecondDueDate(selectedStudent), getTodayValue())} Days`
                  }
                  icon={<DetailIcon kind="calendar" />}
                />
              </div>
            </div>

            <div className="student-drawer-section student-drawer-section-card">
              <div className="student-drawer-section-head">
                <span className="student-drawer-section-icon">
                  <SectionIcon kind="basic" />
                </span>
                <div>
                  <h4>Lead Information</h4>
                  <p>How did you know about our Institute?</p>
                </div>
              </div>
              <div className="student-detail-grid">
                <DetailItem label="How did you know about our Institute?" value={selectedStudent.source} icon={<DetailIcon kind="source" />} />
                <DetailItem label="Remarks" value={selectedStudent.remarks || '-'} icon={<DetailIcon kind="note" />} fullWidth />
              </div>
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
    </section>
  )
}


