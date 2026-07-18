import { isValidElement, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  FileText,
  GraduationCap,
  Landmark,
  Layers3,
  Mail,
  MapPin,
  Percent,
  Phone,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { OperationManagerHeader } from '../components/OperationManagerHeader'
import { FACULTY_RECORD_SYNC_EVENT, loadFacultyRecords } from '../data/facultyRecords'
import { saveStudentRecords } from '../data/studentRecords'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords } from '../data/courseRecords'
import { listCourses } from '../services/courseService'
import { listFacultyRecords, normalizeFacultyList } from '../services/facultyService'
import { createStudent, deleteStudent, listStudents, updateStudent } from '../services/studentService'
import { normalizeCourseList } from '../services/courseService'
import { savePendingLoginEmail } from '../lib/session'

const statusOptions = ['Student', 'Employee', 'Other']
const recordStatusOptions = ['Active', 'Inactive']
const paymentModeOptions = ['Installment', 'Full Payment']
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
    status: 'Active',
    paymentMode: 'Installment',
    actualFees: '',
    registrationFees: '',
    discount: '',
    afterDiscount: '',
    installment1: '',
    installment2: '',
    installment3: '',
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

function getSecondDueDate(student) {
  return student?.secondDueDate || addOneMonth(student?.admissionDate)
}

function getThirdDueDate(student) {
  if (!hasThirdInstallment(student)) return ''
  return student?.thirdDueDate || addOneMonth(getSecondDueDate(student))
}

function isInstallmentSettled(entity = null) {
  const firstPaid = String(entity?.firstInstallmentStatus || 'Pending') === 'Paid'
  const secondPaid = String(entity?.secondInstallmentStatus || 'Pending') === 'Paid'
  const thirdPaid = hasThirdInstallment(entity) ? String(entity?.thirdInstallmentStatus || 'Pending') === 'Paid' : true

  return firstPaid && secondPaid && thirdPaid
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

  if (!firstPaid) return 1
  if (!secondPaid) return 2
  if (hasThirdInstallment(student, course) && !thirdPaid) return 3
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
  const normalizedFacultyName = String(form.facultyName || '').trim().toLowerCase()
  const normalizedCourseId = String(form.courseId || '').trim()

  return (
    facultyOptions.find(
      (faculty) =>
        String(faculty?.courseId || '').trim() === normalizedCourseId &&
        String(faculty?.facultyName || '').trim().toLowerCase() === normalizedFacultyName,
    ) ||
    facultyOptions.find((faculty) => String(faculty?.facultyName || '').trim().toLowerCase() === normalizedFacultyName) ||
    null
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
      facultyName: '',
      batch: '',
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
    facultyName: '',
    batch: '',
    actualFees,
    registrationFees: String(course.registrationFees ?? ''),
    discount,
    afterDiscount,
    installment1: String(course.installment1 ?? ''),
    installment2: String(course.installment2 ?? ''),
    installment3: String(course.installment3 ?? ''),
  }
}

function getCourseInstallmentValues(course = null) {
  return {
    installment1: String(course?.installment1 ?? ''),
    installment2: String(course?.installment2 ?? ''),
    installment3: String(course?.installment3 ?? ''),
  }
}

function validateForm(form, course = null) {
  const errors = {}
  const currentYear = new Date().getFullYear()
  const isFullPayment = isFullPaymentMode(form)
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
  if (!isFullPayment && !form.installment1 && form.courseId) errors.installment1 = 'Installment 1 is missing.'
  if (!isFullPayment && !form.installment2 && form.courseId) errors.installment2 = 'Installment 2 is missing.'
  if (!isFullPayment && requiresThirdInstallment && !form.installment3) errors.installment3 = 'Installment 3 is missing.'
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
    2: [
      'actualFees',
      'registrationFees',
      'discount',
      'afterDiscount',
      ...(isFullPaymentMode(form) ? [] : ['installment1', 'installment2', 'installment3']),
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
    2: ['actualFees', 'registrationFees', 'discount', 'afterDiscount', 'installment1', 'installment2', 'installment3', 'admissionDate', 'remarks', 'paymentMode'],
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

  if (tone) {
    return <span className={`student-detail-pill ${tone}`.trim()}>{text}</span>
  }

  return <span className="student-detail-text">{text}</span>
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

export function StudentManagementPage() {
  const { role } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [courseOptions, setCourseOptions] = useState([])
  const [facultyOptions, setFacultyOptions] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isStudentsLoading, setIsStudentsLoading] = useState(true)
  const [isCoursesLoading, setIsCoursesLoading] = useState(true)
  const [isFacultyLoading, setIsFacultyLoading] = useState(true)
  const [form, setForm] = useState(createEmptyForm)
  const [submitted, setSubmitted] = useState(false)
  const [fieldFocus, setFieldFocus] = useState({})
  const [editingStudentId, setEditingStudentId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [openActionMenuId, setOpenActionMenuId] = useState('')
  const [isDrawerEditing, setIsDrawerEditing] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [serverFieldErrors, setServerFieldErrors] = useState({})
  const [actionError, setActionError] = useState('')
  const [isSavingStudent, setIsSavingStudent] = useState(false)
  const studentsPerPage = 5
  const passedOutYearOptions = useMemo(() => getPassedOutYearOptions(), [])
  const isBusinessOwner = role === 'business-owner'
  const headerTitle = isBusinessOwner ? 'Business Owner Dashboard' : 'Operation Manager Dashboard'
  const headerEyebrow = isBusinessOwner ? 'Business Owner' : 'Operation Manager'
  const headerSummary = 'Operations oversight, approvals, and team health.'
  const headerInitials = isBusinessOwner ? 'BW' : 'OM'
  const headerProfileTitle = isBusinessOwner ? 'Business Head' : 'Operation Manager'
  const headerEmail = isBusinessOwner ? 'business.owner@cispro.com' : 'operation.manager@cispro.com'

  const selectedCourse = useMemo(() => findCourseForForm(courseOptions, form), [courseOptions, form])
  const selectedCourseFacultyOptions = useMemo(() => {
    const normalizedCourseId = String(form.courseId || '').trim()
    if (!normalizedCourseId) return []

    return facultyOptions.filter(
      (faculty) => String(faculty?.courseId || '').trim() === normalizedCourseId,
    )
  }, [facultyOptions, form.courseId])
  const selectedFaculty = useMemo(() => {
    if (String(form.courseId || '').trim()) {
      return findFacultyForForm(selectedCourseFacultyOptions, form)
    }

    return findFacultyForForm(facultyOptions, form)
  }, [facultyOptions, form, selectedCourseFacultyOptions])
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
    const batches = Array.isArray(selectedFaculty?.batchEntries) ? selectedFaculty.batchEntries : []
    const nextOptions = batches
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
  }, [form.batch, selectedFaculty])
  const errors = useMemo(() => {
    const nextErrors = validateForm(form, selectedCourse)
    const duplicateStudent = findDuplicateStudent(form, students, editingStudentId)

    if (duplicateStudent) {
      nextErrors.emailAddress = 'Email already exists.'
    }

    if (form.courseId && !selectedCourseFacultyOptions.length) {
      nextErrors.facultyName = 'No faculty mapped to the selected course.'
    }

    if (form.facultyName && !batchSelectOptions.length) {
      nextErrors.batch = 'No batches available for the selected faculty.'
    }

    return nextErrors
  }, [batchSelectOptions, editingStudentId, form, selectedCourse, selectedCourseFacultyOptions, students])
  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [selectedStudentId, students],
  )
  const selectedStudentCourse = useMemo(
    () => (selectedStudent ? findCourseForStudent(selectedStudent, courseOptions) : null),
    [courseOptions, selectedStudent],
  )
  const selectedStudentQueryId = useMemo(() => new URLSearchParams(location.search).get('studentId') || '', [location.search])
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
    status: student.status || 'Active',
    paymentMode: isFullPaymentRecord(student) ? 'Full Payment' : 'Installment',
    actualFees: student.actualFees || '',
    registrationFees: student.registrationFees || '',
    discount: student.discount || '',
    afterDiscount: student.afterDiscount || '',
    installment1: student.installment1 || '',
    installment2: student.installment2 || '',
    installment3: student.installment3 || '',
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
    setSelectedStudentId(student.id)
    setIsDrawerOpen(true)
    setIsDrawerEditing(false)
    navigate(`/student-management?studentId=${encodeURIComponent(student.id)}`)
  }

  const openDeleteModal = (student) => {
    setActionError('')
    setDeleteTarget(student)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setIsDrawerEditing(false)
    setSelectedStudentId('')
    navigate('/student-management', { replace: true })
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const openActionMenu = (studentId) => {
    setOpenActionMenuId(studentId)
  }

  const closeActionMenu = () => {
    setOpenActionMenuId('')
  }

  const closeModal = () => {
    if (isSavingStudent) return

    setIsModalOpen(false)
    setActionError('')
    setServerFieldErrors({})
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
    if (!selectedStudentQueryId) {
      setIsDrawerOpen(false)
      setIsDrawerEditing(false)
      setSelectedStudentId('')
      return
    }

    setSelectedStudentId(selectedStudentQueryId)
    setIsDrawerOpen(true)
    setIsDrawerEditing(false)
  }, [selectedStudentQueryId])

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
            firstInstallmentPaidAt: '',
            secondInstallmentPaidAt: '',
            thirdInstallmentPaidAt: '',
            ...(current.installment1 || current.installment2 || current.installment3
              ? {}
              : getCourseInstallmentValues(findCourseForForm(courseOptions, current))),
          }
        : name === 'paymentMode' && value === 'Full Payment'
          ? {
              paymentMode: value,
              installment1: '',
              installment2: '',
              installment3: '',
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
      batch: '',
    }))
  }

  const applyFacultyDetails = (facultyName) => {
    setForm((current) => ({
      ...current,
      facultyName,
      batch: '',
    }))
  }

  const applyBatchDetails = (batch) => {
    setForm((current) => ({
      ...current,
      batch,
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
      status: form.status || existingStudent?.status || 'Active',
    }

    const isFullPayment = isFullPaymentMode(form)
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

    try {
      let savedStudent = null
      if (editingStudentId) {
        savedStudent = await updateStudent(editingStudentId, payload)
      } else {
        savedStudent = await createStudent(payload)
      }

      savePendingLoginEmail(savedStudent?.emailAddress || payload.emailAddress)
      await loadStudents()
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
      await updateStudent(studentId, {
        [installmentField]: nextStatus,
        [paidAtField]: nextPaidAt,
      })
      setOpenActionMenuId('')
    } catch (error) {
      setStudents(previousStudents)
      setActionError(apiErrorMessage(error, 'Unable to update installment status.'))
    }
  }

  return (
    <section className="student-management-page">
      <OperationManagerHeader
        className="operation-manager-header-plain"
        eyebrow={headerEyebrow}
        title={headerTitle}
        summary={headerSummary}
        initials={headerInitials}
        profileTitle={headerProfileTitle}
        email={headerEmail}
      />

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

      <article className="student-list-card">
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
                  <th>Course</th>
                  <th>Total Amount</th>
                  <th>Admission Date</th>
                  <th>Current Installment</th>
                  <th>Installment Due Date</th>
                  <th>Status</th>
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
                        <small>{student.emailAddress}</small>
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
                              onChange={() => toggleInstallmentStatus(student.id, 'firstInstallmentStatus', 'firstInstallmentPaidAt')}
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
                              onChange={() => toggleInstallmentStatus(student.id, 'secondInstallmentStatus', 'secondInstallmentPaidAt')}
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
                              onChange={() => toggleInstallmentStatus(student.id, 'thirdInstallmentStatus', 'thirdInstallmentPaidAt')}
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
                        <div
                          className={`student-action-menu ${openActionMenuId === student.id ? 'is-open' : ''} ${actionMenuDirection === 'up' ? 'is-up' : 'is-down'}`.trim()}
                          onMouseEnter={() => openActionMenu(student.id, actionMenuDirection)}
                          onMouseLeave={closeActionMenu}
                        >
                          <button
                            type="button"
                            className="student-row-button student-row-button-more"
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
                      {!isFacultyLoading && form.facultyName && !batchSelectOptions.length ? (
                        <option value="" disabled>
                          No batches available for this faculty
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
                      <Field label="Installment 1 (Auto Filled)" required icon={<FieldIcon kind="installment" />} error={shouldShowError('installment1') ? errors.installment1 : ''}>
                        <input type="text" value={form.installment1} readOnly placeholder="Auto filled from course" />
                      </Field>

                      <Field label="Installment 2 (Auto Filled)" required icon={<FieldIcon kind="installment" />} error={shouldShowError('installment2') ? errors.installment2 : ''}>
                        <input type="text" value={form.installment2} readOnly placeholder="Auto filled from course" />
                      </Field>

                      <Field label="Installment 3 (Auto Filled)" icon={<FieldIcon kind="installment" />} error={shouldShowError('installment3') ? errors.installment3 : ''}>
                        <input type="text" value={form.installment3} readOnly placeholder="Auto filled from course" />
                      </Field>
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

      {isDrawerOpen && selectedStudent ? (
        <div className="student-drawer-backdrop" role="presentation">
          <aside className="student-drawer student-drawer-table-view" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="student-drawer-table-header">
              <h3>Student Details</h3>
              <div className="student-drawer-table-actions">
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
                            rightLabel="How did you know about our Institute?"
                            rightValue={selectedStudent.source}
                          />
                          <DrawerTableRow
                            leftLabel="Remarks"
                            leftValue={getDrawerValue(selectedStudent.remarks, 'No remarks added')}
                            rightLabel="Payment Type"
                            rightValue="Full Payment"
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
                                rightLabel="Remarks"
                                rightValue={selectedStudent.remarks || '-'}
                              />
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
    </section>
  )
}


