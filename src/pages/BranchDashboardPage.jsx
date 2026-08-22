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
  Wallet,
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
  UserRound,
  Search,
  UserPlus, Pencil, Trash2,
  Building2,
   X,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { request, setImpersonateBranchId } from '../services/apiClient'
import { getCurrentBranchProfile } from '../services/branchService'
import { listBranchFaculty } from '../services/branchFacultyService'
import {
  clearBranchCourseListCache,
  assignFacultyToBranchCourse,
  createBranchCourse,
  deleteBranchCourse,
  listBranchCourses,
  updateBranchCourse,
} from '../services/branchCourseService'
import {
  mergeBranchCoursesWithSnapshot,
  subscribeBranchCourseSnapshot,
} from '../lib/branchCourseSnapshot'
import {
  acceptCourseEditRequest,
  listCourseEditRequests,
} from '../services/courseEditRequestService'
import {
  loadBranchStudents,
  refreshBranchStudents,
  saveBranchStudent,
  deleteBranchStudent as removeBranchStudent,
  getNextStudentId,
} from '../lib/branchStudentStore'
import { BranchFacultyPage } from './BranchFacultyPage'
import {
  groupByDate,
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

const CURRENT_YEAR = new Date().getFullYear()
const PASSED_OUT_YEARS = Array.from({ length: 31 }, (_, i) => String(CURRENT_YEAR - i))

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
    admissionDate: '',
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
  }
}

function validateStudentForm(form, students = []) {
  const errors = {}
  if (!form.studentIdSuffix.trim()) errors.studentIdSuffix = 'Student ID is required.'
  else if (!/^\d+$/.test(form.studentIdSuffix.trim())) errors.studentIdSuffix = 'Only numbers are allowed.'
  if (!form.studentName.trim()) errors.studentName = 'Student Name is required.'
  else if (!/^[A-Za-z][A-Za-z ]*$/.test(form.studentName.trim())) errors.studentName = 'Only letters and spaces allowed.'
  if (!form.emailAddress.trim()) errors.emailAddress = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAddress.trim())) errors.emailAddress = 'Enter a valid email.'
  if (!form.mobileNumber.trim()) errors.mobileNumber = 'Mobile Number is required.'
  else if (!/^\d{10}$/.test(form.mobileNumber.trim())) errors.mobileNumber = 'Must be exactly 10 digits.'
  if (!form.parentSpouseNumber.trim()) errors.parentSpouseNumber = 'Parent/Spouse Number is required.'
  else if (!/^\d{10}$/.test(form.parentSpouseNumber.trim())) errors.parentSpouseNumber = 'Must be exactly 10 digits.'
  if (!form.country) errors.country = 'Country is required.'
  if (!form.state) errors.state = 'State is required.'
  if (!form.city) errors.city = 'City is required.'
  if (!form.address.trim()) errors.address = 'Address is required.'
  if (!form.qualification.trim()) errors.qualification = 'Qualification is required.'
  if (!form.passedOutYear) errors.passedOutYear = 'Passed Out Year is required.'
  if (form.passedOutYear === 'Custom' && !form.passedOutYearCustom.trim()) errors.passedOutYearCustom = 'Please specify the year.'
  if (!form.currentStatus) errors.currentStatus = 'Current Status is required.'
  if (form.currentStatus === 'Employee' && !form.designation.trim()) errors.designation = 'Designation is required for employees.'
  if (!form.source) errors.source = 'This field is required.'
  if (form.source === 'Others' && !form.sourceOther.trim()) errors.sourceOther = 'Please specify.'
  if (!form.admissionDate) errors.admissionDate = 'Admission Date is required.'

  const currentRecordId = String(form.recordId || form.originalStudentId || '').trim()
  const normalizedEmail = String(form.emailAddress || '').trim().toLowerCase()
  const normalizedMobile = String(form.mobileNumber || '').trim()

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

const batchCards = [
  { title: 'Batch A-11', timing: 'Mon - Fri | 9:00 AM', status: 'Active' },
  { title: 'Batch B-02', timing: 'Tue - Thu | 2:00 PM', status: 'Active' },
  { title: 'Batch C-01', timing: 'Weekend | 11:30 AM', status: 'Review' },
]

const paymentRows = [
  ['Ananya S', '₹12,000', 'Due in 2 days'],
  ['Rahul P', '₹8,500', 'Pending'],
  ['Meena K', '₹15,000', 'Collected'],
  ['Arun V', '₹6,000', 'Pending'],
]

function getBranchDashboardSectionFromPath(pathname = '', search = '') {
  if (pathname.endsWith('/notifications')) return 'notifications'

  const params = new URLSearchParams(search)
  const section = String(params.get('section') || '').trim().toLowerCase()

  if (section === 'notifications') return 'notifications'
  if (section === 'students') return 'students'
  if (section === 'courses') return 'courses'
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

function BranchNotificationGroup({ label, items, onView, onAcceptRequest }) {
  return (
    <section className="notifications-group">
      <p className="notifications-group-label">{label}</p>
      <div className="notifications-group-list">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <article
              key={`${label}-${item.id || item.title}-${item.time}`}
              className={`notifications-item ${item.unread ? 'is-unread' : ''}`.trim()}
            >
              <span className={`notifications-item-icon tone-${item.tone}`} aria-hidden="true">
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              </span>

              <div className="notifications-item-copy">
                <div className="notifications-item-title-row">
                  <h3>{item.title}</h3>
                  <small>{item.time}</small>
                </div>
                <p>{item.message}</p>
                {item.kind === 'branch-course-edit-request' || item.kind === 'course-edit-request' ? (
                  <div className="notification-copy">
                    {item.requestTitle ? <small><strong>Title:</strong> {item.requestTitle}</small> : null}
                    {item.requestReason ? <small><strong>Reason:</strong> {item.requestReason}</small> : null}
                    {item.requestDescription ? <small><strong>Description:</strong> {item.requestDescription}</small> : null}
                  </div>
                ) : null}
              </div>

              <div className="notifications-item-meta">
                <span className={`notifications-item-chip tone-${item.tone}`}>
                  {item.categoryLabel || item.actionLabel || 'View'}
                </span>
                {item.kind === 'branch-course-edit-request' || item.kind === 'course-edit-request' ? (
                  <button
                    type="button"
                    className="notifications-item-view-button"
                    onClick={() => onAcceptRequest?.(item)}
                  >
                    Accept
                  </button>
                ) : (
                  <button
                    type="button"
                    className="notifications-item-view-button"
                    onClick={() => onView?.(item)}
                  >
                    View
                  </button>
                )}
              </div>
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
      <span>
        {label}
        {required ? <b>*</b> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <small className="course-field-error">{error}</small> : null}
    </label>
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
    name: String(submodel?.name || submodel?.title || '').trim(),
  }))
}

function getBranchCourseSubmodelSource(model = {}) {
  return model?.submodels || model?.subModels || model?.submodules || model?.subModules || []
}

function normalizeBranchCourseModels(models = []) {
  const items = Array.isArray(models) ? models : []

  return items.map((model, modelIndex) => ({
    id: String(model?.id || createCourseNodeId(`model-${modelIndex + 1}`)),
    name: String(model?.name || model?.title || '').trim(),
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
  return {
    ...course,
    id: String(course.id || course.courseCode || course.name || `branch-course-${index + 1}`),
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
    createdAt: String(course.createdAt || new Date().toISOString()),
  }
}

function buildBranchCoursePayload(form) {
  const models = buildBranchCourseModelPayload(form.models)
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
  }
}
function createInitialBranchCourseForm() {
  return {
    courseCode: COURSE_CODE_PREFIX,
    name: '',
    mode: '',
    duration: '',
    hours: '',
    actualFees: '',
    registrationFees: '',
    discount: '',
    status: 'Active',
    models: [],
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
    models: normalizeBranchCourseModels(course.models || course.courseModels || course.modules || []),
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
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false)
  const [isAddCourseSaving, setIsAddCourseSaving] = useState(false)
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
  const [courseDraftKey, setCourseDraftKey] = useState('')
  const [courseEditorStage, setCourseEditorStage] = useState('module')
  const [isSubmoduleDraftOpen, setIsSubmoduleDraftOpen] = useState(false)
  const [expandedSavedCourseModuleIds, setExpandedSavedCourseModuleIds] = useState([])
  const [submoduleDraftRestoreIndex, setSubmoduleDraftRestoreIndex] = useState(0)
  const [submoduleDraftRestoreLength, setSubmoduleDraftRestoreLength] = useState(null)
  const activeSubmoduleInputRef = useRef(null)

  const [isAssignFacultyOpen, setIsAssignFacultyOpen] = useState(false)
  const [assignFacultyCourse, setAssignFacultyCourse] = useState(null)
  const [selectedFacultyIds, setSelectedFacultyIds] = useState([])
  const [facultyList, setFacultyList] = useState([])
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
  const [studentFormTouched, setStudentFormTouched] = useState({})
  const [studentDeleteTarget, setStudentDeleteTarget] = useState(null)
  const [studentActionMenuId, setStudentActionMenuId] = useState('')
  const [studentActionMenuPinned, setStudentActionMenuPinned] = useState(false)
  const [viewStudentDrawer, setViewStudentDrawer] = useState(null)
  const [studentSuccessPopup, setStudentSuccessPopup] = useState(null)
  const [studentFormError, setStudentFormError] = useState('')
  const [isStudentSaving, setIsStudentSaving] = useState(false)
  const [isStudentDeleting, setIsStudentDeleting] = useState(false)
  const [stuCountryOptions, setStuCountryOptions] = useState([])
  const [stuStateOptions, setStuStateOptions] = useState([])
  const [stuCityOptions, setStuCityOptions] = useState([])
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false)
  const [branchNotificationRecords, setBranchNotificationRecords] = useState(() => loadNotifications())


  useEffect(() => {
  const handleOutsideClick = (e) => {
    const clickedInsideActions = e.target.closest(
      '.branch-student-actions-cell'
    )

    if (!clickedInsideActions) {
      setStudentActionMenuId('')
      setStudentActionMenuPinned(false)
    }
  }

  document.addEventListener('mousedown', handleOutsideClick)

  return () => {
    document.removeEventListener('mousedown', handleOutsideClick)
  }
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

    const nextCourses = mergeBranchCoursesWithSnapshot(Array.isArray(result?.data) ? result.data : [])
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
  }, [])

  const loadFacultyList = useCallback(async () => {
    try {
      const res = await listBranchFaculty()
      if (res?.data) {
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
      const mergedNotifications = mergeNotificationsWithStoredState(responseData).map((notification) => {
        const storedNotification = storedById.get(String(notification.id || '').trim())
        return storedNotification ? { ...notification, ...storedNotification } : notification
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
            mergeBranchCoursesWithSnapshot(Array.isArray(coursesResult?.value?.data) ? coursesResult.value.data : []),
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
          mergeBranchCoursesWithSnapshot(Array.isArray(coursesResult.value?.data) ? coursesResult.value.data : []),
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

      await Promise.all([
        loadBranchCourses(),
        loadFacultyList(),
      ])

      const assignedFaculty = Array.isArray(updatedCourse?.assignedFaculty)
        ? updatedCourse.assignedFaculty
        : facultyList.filter((faculty) => selectedFacultyIds.includes(faculty.id))

      setAssignFacultySuccess({
        courseName: updatedCourse?.name || assignFacultyCourse?.name || 'Course',
        facultyNames: assignedFaculty.map((f) => f.name).filter(Boolean),
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
            String(notification.kind || '').startsWith('course-edit-') ||
            String(notification.kind || '') === 'faculty-login',
        ),
    [branchNotificationRecords],
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
    () => normalizedBranchNotifications.filter((item) => !item.dropdownViewed).slice(0, 2),
    [normalizedBranchNotifications],
  )
  const branchNotificationTotalCount = branchNotificationItems.length
  const overviewStats = useMemo(
    () => [
      { label: 'Total Students', value: '246', note: 'Active learners this month' },
      {
        label: 'Total Courses',
        value: String(branchCourseCards.length),
        note: 'Published course catalog',
      },
      { label: 'Active Batches', value: '11', note: 'Running live batches' },
      { label: 'Pending Payments', value: '14', note: 'Needs follow-up today' },
    ],
    [branchCourseCards.length],
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

      try {
        await request('/notifications/mark-read', {
          method: 'PATCH',
          body: JSON.stringify({ notificationIds: [notification.id] }),
        })
      } catch (error) {
        console.error('Failed to sync branch notification read state:', error)
      }
    }
    setIsNotificationMenuOpen(false)
    const targetSection = String(notification?.targetSection || 'batches').trim() || 'batches'
    goToBranchSection(targetSection)
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
  const savedCourseRows = useMemo(
    () => buildBranchCourseHierarchySummary(savedCourseHierarchy.filter(Boolean)),
    [savedCourseHierarchy],
  )

  const shouldShowBasicAddCourseError = (field) => Boolean(addCourseTouched[field] && addCourseValidationErrors.basic[field])

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
    updateAddCourseField(field, value.replace(/[^\d]/g, ''))
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
    ;(safeModel.submodels || []).forEach((_, submodelIndex) => {
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
      if (!savedCurrentSubmodel) return
    }

    const moduleError = getCurrentCourseModelError(modelIndex)
    if (moduleError) {
      setAddCourseError(moduleError)
      return
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
    const nextForm = record
      ? buildBranchCourseFormFromRecord(record)
      : createInitialBranchCourseForm()
    const nextHierarchy = record
      ? buildBranchCourseHierarchySummary(record.models || record.courseModels || record.modules || [])
      : []

    setAddCourseForm(nextForm)
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

  const openAddCourseModal = () => {
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

  const openViewCourseDrawer = (course) => {
    setViewCourse(normalizeBranchCourseRecord(course))
    setViewCourseTab('basic')
    setExpandedViewCourseModuleIds([])
    setOpenCourseActionMenuId('')
    setCourseActionMenuPosition({ top: 0, left: 0 })
  }

  const closeViewCourseDrawer = () => {
    setViewCourse(null)
    setViewCourseTab('basic')
    setExpandedViewCourseModuleIds([])
  }
  const openEditCourseModal = (course) => {
    const nextEditingCourseId = String(course?.id || '').trim()
    const savedDraft = readBranchCourseDraft(nextEditingCourseId)
    setCourseDraftKey(nextEditingCourseId || 'new')
    setEditingCourseId(nextEditingCourseId)
    setAddCourseForm(savedDraft?.form || buildBranchCourseFormFromRecord(course))
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
    setIsAddCourseOpen(false)
    setCourseModuleDeleteTarget(null)
    setCourseSubmoduleDeleteTarget(null)
    setAddCourseStep(1)
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

  const viewCourseModels = useMemo(
    () => buildBranchCourseHierarchySummary(viewCourse?.models || viewCourse?.courseModels || viewCourse?.modules || []),
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

  const handleDeleteCourseConfirm = () => {
    if (!courseDeleteTarget) return

    setIsAddCourseSaving(true)
    deleteBranchCourse(courseDeleteTarget.id)
      .then(() => {
        const nextCards = branchCourseCards.filter((course) => String(course.id || '').trim() !== String(courseDeleteTarget.id || '').trim())
        setBranchCourseCards(nextCards)
        const nextTotalPages = Math.max(1, Math.ceil(nextCards.length / BRANCH_COURSES_PER_PAGE))
        setBranchCoursePage((current) => Math.min(current, nextTotalPages))
        setCourseDeleteTarget(null)
      })
      .catch((error) => {
        setCourseActionError(apiErrorMessage(error, 'Unable to delete course right now.'))
      })
      .finally(() => {
        setIsAddCourseSaving(false)
      })
  }

  const handleAddCourseSubmit = async (event) => {
    event?.preventDefault()
    const nextTouched = { ...addCourseTouched }
    COURSE_BASIC_FIELDS.forEach((field) => {
      nextTouched[field] = true
    })
    normalizeBranchCourseModels(addCourseForm.models).forEach((model, modelIndex) => {
      nextTouched[`model-${modelIndex}-name`] = true
      nextTouched[`model-${modelIndex}-submodels`] = true
      ;(model.submodels || []).forEach((submodel, submodelIndex) => {
        nextTouched[`model-${modelIndex}-submodel-${submodelIndex}-name`] = true
      })
    })
    setAddCourseTouched(nextTouched)

    if (Object.keys(addCourseValidationErrors.basic).length > 0 || addCourseValidationErrors.hierarchy.modelsError) {
      setAddCourseStep(1)
      setAddCourseError(Object.values(addCourseValidationErrors.basic)[0] || addCourseValidationErrors.hierarchy.modelsError || 'Please fill all required fields before saving.')
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
      return
    }

    setIsAddCourseSaving(true)
    try {
      const normalizedCourseCode = normalizeBranchCourseCode(addCourseForm.courseCode)
      const editingTargetId = String(editingCourseId || '').trim()
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
        return
      }

      if (duplicateCourse) {
        setAddCourseError('Course already exists.')
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
    }
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
    void reloadBranchStudents()
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

  const filteredBranchStudents = useMemo(() => {
    const q = studentSearchTerm.trim().toLowerCase()
    if (!q) return branchStudents
    return branchStudents.filter((s) =>
      String(s.studentId || '').toLowerCase().includes(q) ||
      String(s.studentName || '').toLowerCase().includes(q)
    )
  }, [branchStudents, studentSearchTerm])

  const totalStudentPages = Math.max(1, Math.ceil(filteredBranchStudents.length / BRANCH_STUDENTS_PER_PAGE))
  const safeStudentPage = Math.min(studentPage, totalStudentPages)
  const visibleBranchStudents = useMemo(() => {
    const start = (safeStudentPage - 1) * BRANCH_STUDENTS_PER_PAGE
    return filteredBranchStudents.slice(start, start + BRANCH_STUDENTS_PER_PAGE)
  }, [filteredBranchStudents, safeStudentPage])

  const studentFormValidationErrors = useMemo(
    () => validateStudentForm(studentForm, branchStudents),
    [branchStudents, studentForm],
  )
  const shouldShowStudentError = (field) => Boolean(studentFormTouched[field] && studentFormValidationErrors[field])
  const studentActiveStepFields = studentFormStep === 1 ? STUDENT_FORM_STEP_ONE_FIELDS : STUDENT_FORM_STEP_TWO_FIELDS
  const studentActiveStepErrorField = studentActiveStepFields.find((field) => studentFormValidationErrors[field]) || ''
  const studentActiveStepError = studentActiveStepErrorField ? studentFormValidationErrors[studentActiveStepErrorField] : ''

  const updateStudentField = (field, value) => {
    setStudentForm((c) => ({
      ...c,
      [field]: field === 'studentIdSuffix' ? normalizeStudentIdSuffix(value) : value,
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

  const handleStudentStepNext = () => {
    if (studentFormMode === 'view') {
      setStudentFormStep(2)
      return
    }

    touchStudentFields(STUDENT_FORM_STEP_ONE_FIELDS)

    const hasStepOneErrors = STUDENT_FORM_STEP_ONE_FIELDS.some((field) => studentFormValidationErrors[field])
    if (hasStepOneErrors) return

    setStudentFormStep(2)
  }

  const handleStudentStepBack = () => {
    setStudentFormStep(1)
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
    const nextStudentForm = await resolveStudentLocationForm(buildStudentFormFromRecord(stu))
    setStudentForm(nextStudentForm)
    setStudentFormTouched({})
    setIsStudentFormOpen(true)
  }

  const openEditStudentForm = async (stu) => {
    setStudentFormMode('edit')
    setStudentFormError('')
    setIsStudentSaving(false)
    setStudentFormStep(1)
    const nextStudentForm = await resolveStudentLocationForm(buildStudentFormFromRecord(stu))
    setStudentForm(nextStudentForm)
    setStudentFormTouched({})
    setIsStudentFormOpen(true)
  }

  const handleStudentFormSubmit = async (e) => {
    e?.preventDefault()
    if (studentFormMode === 'view') return
    if (studentFormStep !== 2) return
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
    if (studentForm.currentStatus === 'Employee') allTouched.designation = true
    if (studentForm.passedOutYear === 'Custom') allTouched.passedOutYearCustom = true
    if (studentForm.source === 'Others') allTouched.sourceOther = true
    setStudentFormTouched(allTouched)

    if (Object.keys(studentFormValidationErrors).length > 0) return

    const originalStudentId = String(studentForm.originalStudentId || studentForm.studentId || '').trim()
    const resolvedStudentId = buildStudentIdFromSuffix(studentForm.studentIdSuffix)
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
    }

    delete record.studentIdSuffix
    delete record.originalStudentId
    delete record.recordId

    setIsStudentSaving(true)
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
      const conflictMessage = error?.status === 409
        ? (error?.body?.message || 'Student email or mobile number already exists in this branch.')
        : null
      setStudentFormError(conflictMessage || 'Unable to save student. Please try again.')
    } finally {
      setIsStudentSaving(false)
    }
  }

  const handleStudentDeleteConfirm = async () => {
    if (!studentDeleteTarget) return
    try {
      setIsStudentDeleting(true)
      await removeBranchStudent(studentDeleteTarget.id || studentDeleteTarget.studentId)
      void reloadBranchStudents()
      setStudentDeleteTarget(null)
      setStudentSuccessPopup({ title: 'Student Deleted', message: 'Student deleted successfully.' })
      // Adjust page if needed
      const nextCount = branchStudents.length - 1
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
                          className={`notification-dropdown-item ${item.unread ? 'is-highlighted' : 'is-muted'} ${
                            isCourseEditRequest ? 'is-course-request' : ''
                          }`.trim()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
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
                                onMouseDown={(event) => event.stopPropagation()}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClickCapture={(event) => event.stopPropagation()}
                                onClick={() => acceptBranchCourseEditNotification(item)}
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

                  <div className="branch-dashboard-stats">
                    {overviewStats.map((stat) => (
                      <article key={stat.label} className="branch-dashboard-stat-card">
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                        <small>{stat.note}</small>
                      </article>
                    ))}
                  </div>

                  <BranchDashboardSection title="Today" description="A quick snapshot of branch activity.">
                    <div className="branch-dashboard-activity-grid">
                      <article className="branch-dashboard-panel">
                        <strong>Attendance</strong>
                        <p>224 students checked in before 10:00 AM.</p>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong>Revenue</strong>
                        <p>₹1.84L collected in the last 7 days.</p>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong>Follow-ups</strong>
                        <p>14 pending payment reminders scheduled for today.</p>
                      </article>
                    </div>
                  </BranchDashboardSection>
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
                        <strong>{filteredBranchStudents.length}</strong>
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
                  <div className="branch-course-table-shell">
                    <table className="branch-course-table">
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Student Name</th>
                          {/* <th>Email</th> */}
                          <th>Mobile Number</th>
                          {/* <th>Qualification</th>
                          <th>Current Status</th> */}
                          <th>Admission Date</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleBranchStudents.length ? (
                          visibleBranchStudents.map((stu, index) => {
                            return (
                            <tr key={stu.studentId}>
                              <td><strong>{stu.studentId || '-'}</strong></td>
                              <td><strong className="branch-course-name">{stu.studentName}</strong></td>
                              {/* <td>{stu.emailAddress || '-'}</td> */}
                              <td>{stu.mobileNumber || '-'}</td>
                              {/* <td>{stu.qualification || '-'}</td> */}
                              {/* <td>
                                <span className={`branch-course-status-pill ${(stu.currentStatus || '').toLowerCase()}`}>
                                  {stu.currentStatus || '-'}
                                </span>
                              </td> */}
                              <td>{formatStudentDate(stu.admissionDate)}</td>

                              <td style={{ textAlign: 'center' }}>
                                <div
  className={`branch-student-actions-cell ${
    studentActionMenuId === stu.studentId ? 'menu-open' : ''
  }`}
  onMouseEnter={() => {
    if (!studentActionMenuPinned) {
      setStudentActionMenuId(stu.studentId)
    }
  }}
  onMouseLeave={() => {
    if (!studentActionMenuPinned) {
      setStudentActionMenuId('')
    }
  }}
>
                               <button 
  type="button" 
  className="branch-student-more-btn" 
  aria-label="Student actions" 
  onClick={(e) => {
  e.stopPropagation()

  if (studentActionMenuId === stu.studentId) {
    setStudentActionMenuId('')
    setStudentActionMenuPinned(false)
  } else {
    setStudentActionMenuId(stu.studentId)
    setStudentActionMenuPinned(true)
  }
}}
>
  <MoreVertical size={18} /> 
</button>

                                  {studentActionMenuId === stu.studentId ? (
                                    <div className="branch-student-actions-menu">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStudentActionMenuId('')
                                          setViewStudentDrawer({ ...stu })
                                        }}
                                      >
                                        <Eye size={15} />
                                        <span>View</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStudentActionMenuId('')
                                          openEditStudentForm({ ...stu })
                                        }}
                                      >
                                        <Pencil size={15} />
                                        <span>Edit</span>
                                      </button>

                                      <button
                                        type="button"
                                        className="is-danger"
                                        onClick={() => {
                                          setStudentActionMenuId('')
                                          setStudentDeleteTarget({ ...stu })
                                        }}
                                      >
                                        <Trash2 size={15} />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          )
                          })
                        ) : (
                          <tr>
                            <td colSpan="8" className="branch-course-empty-state">
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
                  <div className="branch-course-table-shell">
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
                            <td colSpan="12" className="branch-course-empty-state">
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

              {activeSection === 'batches' ? (
                <BranchDashboardSection title="Batches" description="Current batch schedule overview.">
                  <div className="branch-dashboard-card-grid">
                    {batchCards.map((batch) => (
                      <article key={batch.title} className="branch-dashboard-info-card">
                        <strong>{batch.title}</strong>
                        <span>{batch.timing}</span>
                        <small>{batch.status}</small>
                      </article>
                    ))}
                  </div>
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'payments' ? (
                <BranchDashboardSection title="Payments" description="Pending and collected payment snapshot.">
                  <div className="branch-dashboard-table-shell">
                    <table className="branch-dashboard-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Amount</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentRows.map(([name, amount, note]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{amount}</td>
                            <td>{note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BranchDashboardSection>
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
                  onClick={() => {
                    const basicErrors = createBranchCourseErrors(addCourseForm).basic
                    if (Object.keys(basicErrors).length === 0) {
                      setAddCourseStep(2)
                      setCourseEditorStage('closed')
                      setIsSubmoduleDraftOpen(false)
                      setSelectedSavedModelIndex(0)
                      setSelectedSavedSubmodelIndex(0)
                      setAddCourseError('')
                    }
                  }}
                  disabled={Object.keys(addCourseValidationErrors.basic).length > 0}
                >
                  <span className="course-stepper-icon" aria-hidden="true">
                    <Layers3 size={20} strokeWidth={2.3} />
                  </span>
                  <strong>Modules & Submodules</strong>
                </button>
              </div>

              <div className="course-step-caption">
                {addCourseStep === 1
                  ? 'Fill the course basics first. Then move to module setup.'
                  : 'Add modules and submodules. Percentages are calculated automatically.'}
              </div>

              {addCourseStep === 1 ? (
                <div className="course-form-grid">
                  <Field
                    label="Course Code"
                    required
                    hint="Recommended unique identifier for reports and integrations"
                    error={shouldShowBasicAddCourseError('courseCode') ? addCourseValidationErrors.basic.courseCode : ''}
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

                  <Field
                    label="Standard Course Fee"
                    required
                    hint="Default/base fee before adjustments"
                    error={shouldShowBasicAddCourseError('actualFees') ? addCourseValidationErrors.basic.actualFees : ''}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.actualFees}
                      onChange={(event) => updateAddCourseNumericField('actualFees', event.target.value)}
                      onBlur={() => markAddCourseTouched('actualFees')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('actualFees'))}
                    />
                  </Field>

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
              ) : (
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
                                            <span className="course-added-module-card-list-index">{submodelIndex + 1}</span>
                                            <strong>{submodel.name || `Submodule ${submodelIndex + 1}`}</strong>
                                            <span>{formatBranchCoursePercentage(submodel.percentage)}</span>
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
              )}

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
                ) : (
                  <div className="course-form-actions-group">
                    <button type="button" className="button button-ghost" onClick={() => setAddCourseStep(1)} disabled={isAddCourseSaving}>
                      Back
                    </button>
                    <button type="submit" className="button button-solid" disabled={isAddCourseSaving}>
                      {isAddCourseSaving ? 'Saving...' : editingCourseId ? 'Update Course' : 'Save Course'}
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
                  ) : (
                    <section className="branch-course-view-hierarchy" aria-label="Modules and submodules">
                      <div className="branch-course-view-hierarchy-header">
                        <div>
                          <p>Added Modules</p>
                          <strong>{viewCourseModels.length} Total</strong>
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
                                          <strong>{formatBranchCoursePercentage(submodel.percentage)}</strong>
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
                onClick={closeDeleteCourseConfirm}
              >
                <X size={22} strokeWidth={2} />
              </button>



              <h2 id="branch-delete-title">Delete this course?</h2>
              <p className="branch-delete-copy">
                {courseDeleteTarget.name || courseDeleteTarget.courseCode || 'This course'} will be removed from the table.
              </p>

              {courseActionError ? <p className="branch-delete-copy" style={{ color: '#dc2626' }}>{courseActionError}</p> : null}

              <div className="branch-modal-actions">
                <button type="button" className="branch-modal-cancel" onClick={closeDeleteCourseConfirm}>
                  Cancel
                </button>
                <button type="button" className="branch-modal-submit is-danger" onClick={handleDeleteCourseConfirm}>
                  Delete
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



              {/* Details Table */}
              <div className="student-drawer-content">

                <div className="student-details-table">

                  <div className="student-details-table-head">
                    <div>DETAILS</div>
                    <div>INFORMATION</div>
                  </div>

                  {/* Student ID */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Student ID
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.studentId || '-'}
                    </div>
                  </div>

                  {/* Student Name */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Student Name
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.studentName || '-'}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Email Address
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.emailAddress || '-'}
                    </div>
                  </div>

                  <div className="student-details-row">
                    <div className="student-details-label">
                      LinkedIn URL
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.linkedInUrl ? (
                        <a
                          href={formatExternalUrl(viewStudentDrawer.linkedInUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {viewStudentDrawer.linkedInUrl}
                        </a>
                      ) : '-'}
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Phone Number
                    </div>
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

                  {/* Qualification */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Qualification
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.qualification || '-'}
                    </div>
                  </div>

                  {/* Passed Out Year */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Passed Out Year
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.passedOutYear || '-'}
                    </div>
                  </div>

                  {/* Designation */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Designation
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.designation || '-'}
                    </div>
                  </div>

                  {/* Country */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Country
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.country || '-'}
                    </div>
                  </div>

                  {/* State */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      State
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.state || '-'}
                    </div>
                  </div>

                  {/* City */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      City
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.city || '-'}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="student-details-row student-details-row-address">
                    <div className="student-details-label">
                      Address
                    </div>
                    <div
                      className="student-details-value is-address"
                      title={viewStudentDrawer.address || '-'}
                    >
                      {(viewStudentDrawer.address || '-').replace(/,\s*/g, ', ')}
                    </div>
                  </div>

                  {/* Admission Date */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Admission Date
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.admissionDate
                        ? formatStudentDate(viewStudentDrawer.admissionDate)
                        : '-'}
                    </div>
                  </div>

                  {/* Source */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Source
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.source || '-'}
                    </div>
                  </div>

                  {/* Other Source
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Other Source
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.sourceOther || '-'}
                    </div>
                  </div> */}

                  {/* Remarks */}
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Remarks
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.remarks || '-'}
                    </div>
                  </div>

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

              <div className={`student-stepper is-two-step ${studentFormMode === 'view' ? 'is-view-mode' : ''}`.trim()}>
                {[
                  { step: 1, title: 'Personal & Education' },
                  { step: 2, title: 'Admission Details & Review' },
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
                      className={`student-stepper-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`.trim()}
                      aria-current={isActive ? 'step' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setStudentFormStep(item.step)
                      }}
                    >
                      {content}
                    </button>
                  )
                })}
              </div>

              <div className="student-step-panel">
                {studentFormStep === 1 ? (
                  <div className="student-step-section">
                    <div className="course-form-grid student-form-grid-tight">
                <Field
                  label="Student ID"
                  required
                  error={shouldShowStudentError('studentIdSuffix') ? studentFormValidationErrors.studentIdSuffix : ''}
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
                      onChange={(e) => updateStudentField('studentIdSuffix', e.target.value)}
                      onBlur={() => setStudentFormTouched((c) => ({ ...c, studentIdSuffix: true }))}
                      disabled={studentFormMode === 'view'}
                    />
                  </div>
                </Field>

                <Field label="Student Name" required error={shouldShowStudentError('studentName') ? studentFormValidationErrors.studentName : ''}>
                  <input
                    type="text"
                    placeholder="Enter student name"
                    value={studentForm.studentName}
                    onChange={(e) => updateStudentField('studentName', e.target.value.replace(/[^A-Za-z ]/g, ''))}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, studentName: true }))}
                    disabled={studentFormMode === 'view'}
                  />
                </Field>

                <Field label="Email Address" required error={shouldShowStudentError('emailAddress') ? studentFormValidationErrors.emailAddress : ''}>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={studentForm.emailAddress}
                    onChange={(e) => updateStudentField('emailAddress', e.target.value)}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, emailAddress: true }))}
                    disabled={studentFormMode === 'view'}
                  />
                </Field>

                <Field label="Mobile Number" required error={shouldShowStudentError('mobileNumber') ? studentFormValidationErrors.mobileNumber : ''}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="10 digit mobile number"
                    value={studentForm.mobileNumber}
                    onChange={(e) => updateStudentField('mobileNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, mobileNumber: true }))}
                    disabled={studentFormMode === 'view'}
                  />
                </Field>

                <Field label="Parent / Spouse Number" required error={shouldShowStudentError('parentSpouseNumber') ? studentFormValidationErrors.parentSpouseNumber : ''}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="10 digit number"
                    value={studentForm.parentSpouseNumber}
                    onChange={(e) => updateStudentField('parentSpouseNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, parentSpouseNumber: true }))}
                    disabled={studentFormMode === 'view'}
                  />
                </Field>

                <Field label="Country" required error={shouldShowStudentError('country') ? studentFormValidationErrors.country : ''}>
                  <select
                    value={studentForm.countryCode}
                    onChange={(e) => {
                      const code = e.target.value
                      const name = stuCountryOptions.find((c) => c.iso2 === code)?.name || ''
                      setStudentForm((c) => ({ ...c, countryCode: code, country: name, stateCode: '', state: '', city: '' }))
                    }}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, country: true }))}
                    disabled={studentFormMode === 'view'}
                  >
                    <option value="" disabled>Select Country</option>
                    {stuCountryOptions.map((c) => (
                      <option key={c.iso2} value={c.iso2}>{c.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="State" required error={shouldShowStudentError('state') ? studentFormValidationErrors.state : ''}>
                  <select
                    value={studentForm.stateCode}
                    onChange={(e) => {
                      const code = e.target.value
                      const name = stuStateOptions.find((s) => s.iso2 === code)?.name || ''
                      setStudentForm((c) => ({ ...c, stateCode: code, state: name, city: '' }))
                    }}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, state: true }))}
                    disabled={studentFormMode === 'view' || !studentForm.countryCode}
                  >
                    <option value="" disabled>Select State</option>
                    {stuStateOptions.map((s) => (
                      <option key={s.iso2} value={s.iso2}>{s.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="City" required error={shouldShowStudentError('city') ? studentFormValidationErrors.city : ''}>
                  <select
                    value={studentForm.city}
                    onChange={(e) => updateStudentField('city', e.target.value)}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, city: true }))}
                    disabled={studentFormMode === 'view' || !studentForm.stateCode}
                  >
                    <option value="" disabled>Select City</option>
                    {stuCityOptions.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Address" required error={shouldShowStudentError('address') ? studentFormValidationErrors.address : ''}>
                  <input
                    type="text"
                    placeholder="Enter full address"
                    value={studentForm.address}
                    onChange={(e) => updateStudentField('address', e.target.value)}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, address: true }))}
                    disabled={studentFormMode === 'view'}
                  />
                </Field>

                <Field label="Qualification" required error={shouldShowStudentError('qualification') ? studentFormValidationErrors.qualification : ''}>
                  <input
                    type="text"
                    placeholder="Enter qualification"
                    value={studentForm.qualification}
                    onChange={(e) => updateStudentField('qualification', e.target.value)}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, qualification: true }))}
                    disabled={studentFormMode === 'view'}
                  />
                </Field>

                <Field label="Passed Out Year" required error={shouldShowStudentError('passedOutYear') ? studentFormValidationErrors.passedOutYear : ''}>
                  <select
                    value={studentForm.passedOutYear}
                    onChange={(e) => updateStudentField('passedOutYear', e.target.value)}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, passedOutYear: true }))}
                    disabled={studentFormMode === 'view'}
                  >
                    <option value="" disabled>Select Year</option>
                    {PASSED_OUT_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    <option value="Custom">Custom</option>
                  </select>
                </Field>

                {studentForm.passedOutYear === 'Custom' ? (
                  <Field label="Specify Year" required error={shouldShowStudentError('passedOutYearCustom') ? studentFormValidationErrors.passedOutYearCustom : ''}>
                    <input
                      type="text"
                      placeholder="Enter year"
                      value={studentForm.passedOutYearCustom}
                      onChange={(e) => updateStudentField('passedOutYearCustom', e.target.value)}
                      onBlur={() => setStudentFormTouched((c) => ({ ...c, passedOutYearCustom: true }))}
                      disabled={studentFormMode === 'view'}
                    />
                  </Field>
                ) : null}

                    </div>
                  </div>
                ) : (
                  <div className="student-step-section">
                    <div className="course-form-grid student-form-grid-tight">

                <Field label="LinkedIn URL">
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="https://www.linkedin.com/in/your-profile"
                    value={studentForm.linkedInUrl}
                    onChange={(e) => updateStudentField('linkedInUrl', e.target.value)}
                    disabled={studentFormMode === 'view'}
                  />
                </Field>

                <Field label="Current Status" required error={shouldShowStudentError('currentStatus') ? studentFormValidationErrors.currentStatus : ''}>
                  <select
                    value={studentForm.currentStatus}
                    onChange={(e) => {
                      const val = e.target.value
                      setStudentForm((c) => ({ ...c, currentStatus: val, designation: val !== 'Employee' ? '' : c.designation }))
                    }}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, currentStatus: true }))}
                    disabled={studentFormMode === 'view'}
                  >
                    <option value="" disabled>Select Status</option>
                    <option value="Student">Student</option>
                    <option value="Employee">Employee</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>

                <Field
                  label="Designation"
                  required={studentForm.currentStatus === 'Employee'}
                  error={shouldShowStudentError('designation') ? studentFormValidationErrors.designation : ''}
                >
                  <input
                    type="text"
                    placeholder={studentForm.currentStatus === 'Employee' ? 'Enter designation' : 'Select Employee first'}
                    value={studentForm.designation}
                    onChange={(e) => updateStudentField('designation', e.target.value)}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, designation: true }))}
                    disabled={studentFormMode === 'view' || studentForm.currentStatus !== 'Employee'}
                  />
                </Field>

                <Field label="How did you know about our Institute?" required error={shouldShowStudentError('source') ? studentFormValidationErrors.source : ''}>
                  <select
                    value={studentForm.source}
                    onChange={(e) => updateStudentField('source', e.target.value)}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, source: true }))}
                    disabled={studentFormMode === 'view'}
                  >
                    <option value="" disabled>Select Source</option>
                    <option value="Sulekha">Sulekha</option>
                    <option value="Justdial">Justdial</option>
                    <option value="Website">Website</option>
                    <option value="Poster">Poster</option>
                    <option value="Others">Others</option>
                  </select>
                </Field>

                {studentForm.source === 'Others' ? (
                  <Field label="Please Specify" required error={shouldShowStudentError('sourceOther') ? studentFormValidationErrors.sourceOther : ''}>
                    <input
                      type="text"
                      placeholder="How did you hear about us?"
                      value={studentForm.sourceOther}
                      onChange={(e) => updateStudentField('sourceOther', e.target.value)}
                      onBlur={() => setStudentFormTouched((c) => ({ ...c, sourceOther: true }))}
                      disabled={studentFormMode === 'view'}
                    />
                  </Field>
                ) : null}

                <Field label="Remarks">
                  <input
                    type="text"
                    placeholder="Optional remarks"
                    value={studentForm.remarks}
                    onChange={(e) => updateStudentField('remarks', e.target.value)}
                    disabled={studentFormMode === 'view'}
                  />
                </Field>

                <Field label="Admission Date" required error={shouldShowStudentError('admissionDate') ? studentFormValidationErrors.admissionDate : ''}>
                  <input
                    type="date"
                    value={studentForm.admissionDate}
                    onChange={(e) => updateStudentField('admissionDate', e.target.value)}
                    onBlur={() => setStudentFormTouched((c) => ({ ...c, admissionDate: true }))}
                    disabled={studentFormMode === 'view'}
                  />
                </Field>
                    </div>

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
