import { useState, useMemo, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BarChart3,
  BookOpen,
  Check,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleUserRound,
  Clock3,
  Layers3,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Pencil,
  Phone,
  Search,
  Dot,
  FileText,
  GraduationCap,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Lock,
  X,
  Menu,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react'
import {
  FACULTY_ATTENDANCE_SYNC_EVENT,
  FACULTY_BATCH_ATTENDANCE_SYNC_EVENT,
  getAttendanceDateKey,
  loadFacultyBatchAttendanceState,
  loadFacultyAttendanceState,
  resolveBatchAttendanceWindow,
  resolveFacultyBatchContextForStudent,
  resolveTodayFacultyAttendanceStatus,
  normalizeAttendanceSessions,
  formatAttendanceTimeLabel,
  saveFacultyBatchAttendanceState,
} from '../lib/facultyAttendanceStore'
import { enrichStudentsWithFacultyReferences, getFacultyBatchEntriesForCourse, getFacultyBatchStudentRecords, getFacultyCourseIds, getFacultyCourses, getMatchingStudents, getUniqueStudentCountForFacultyRecords, getUniqueStudentCountForFacultyScope } from '../lib/facultyFlow'
import { getCurrentFacultyAttendanceOverview, markFacultyStudentAttendance } from '../services/attendanceService'
import { getFacultyDashboardOverview, getFacultyMyBatchesSummary } from '../services/dashboardService'
import { PaginationBar } from '../components/PaginationBar'
import { listCourses } from '../services/courseService'
import { getCurrentFacultyProfile } from '../services/facultyService'
import { getAcademicBatchReport, getBranchStudentAcademicReports } from '../services/academicTestService'
import { getBranchStudentSyllabusReports, getFacultyAssessmentStudentReport, listFacultyAssessmentReports } from '../services/examService'
import { getMyWeekOffRequests } from '../services/facultyWeekOffService'
import { dateForDay, dateKey, getEffectiveWeeklyOffForDate } from '../lib/facultyWeekOff'
import { clearBranchCourseListCache, listBranchCourses } from '../services/branchCourseService'
import {
  createCourseEditRequest,
  listCourseEditRequests,
  saveCourseEditRequestModules,
} from '../services/courseEditRequestService'
import {
  getFacultyNotifications,
  markFacultyNotificationsAsRead,
} from '../services/facultyNotificationService'
import { useMobileMenu } from '../layouts/mobileMenuContext'
import { FacultyAttendanceFlow } from '../components/FacultyAttendanceFlow'
import { BranchAttendanceInsights } from '../components/BranchAttendanceInsights'
import { StudentAttendanceReportModal } from '../components/StudentAttendanceReportModal'
import { StudentCalendarPage } from './StudentCalendarPage'
import '../styles/BranchStudentAttendance.css'
import { useAuth } from '../auth/useAuth'
import { loadFacultyRegistry } from '../lib/facultyAuth'
import { BRANCH_STUDENTS_KEY, listBranchStudentsByLifecycle } from '../lib/branchStudentStore'
import {
  loadNotifications as loadStoredNotifications,
  addNotification,
  markNotificationsAsRead,
  subscribeNotifications,
} from '../lib/notificationStore'
import {
  FACULTY_TODAY_WORK_SYNC_EVENT,
  FACULTY_TODAY_WORK_SYNC_KEY,
  getFacultyTodayWorkEntriesByFaculty,
  saveFacultyTodayWorkEntry,
  listFacultyTodayWorkEntries,
} from '../lib/facultyTodayWorkStore'
import { saveBranchCourseSnapshot } from '../lib/branchCourseSnapshot'
import { formatCourseEditChangeSummary } from '../lib/courseEditChangeSummary'
import { getStudentPaymentProgress } from '../lib/studentPaymentProgress'
import { saveStudentCalendarAttendance } from '../lib/studentAttendanceCalendar'
import { Button } from '../components/Button'
import { FacultyLeaveRequests } from '../components/FacultyLeaveRequests'
import { FacultyCalendar } from '../components/FacultyCalendar'
import { getFacultyCalendar, getFacultyTemporaryBatches, getTemporaryBatchStudents } from '../services/facultyCalendarService'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/BranchDashboardPage.css'
import '../styles/FacultyDashboardPage.css'
import { FacultySkillDevelopmentPage } from './FacultySkillDevelopmentPage'
import {
  buildProgressComparisonNotification,
  syncProgressComparisonNotifications,
} from '../lib/progressComparisonNotification'
import { getCourseStatusFromProgress, getCourseStatusLabel } from '../lib/courseStatus'
import FacultyExamsPage from './FacultyExamsPage'
import FacultyAssessmentsPage from './FacultyAssessmentsPage'
import FacultyExamCourseGate from '../components/FacultyExamCourseGate'
import FacultyExamReportsPage from './FacultyExamReportsPage'
import FacultyStudentExamReportPage from './FacultyStudentExamReportPage'
import AcademicTestPage from './AcademicTestPage'
import AcademicTestPreparationPage from './AcademicTestPreparationPage'
import AcademicTestReportPage from './AcademicTestReportPage'
import '../styles/FacultyAcademicTestMenu.css'

function getNextFacultyWeekOff(defaultWeekOffDay, requests = []) {
  const regularDay = String(defaultWeekOffDay || '').trim().toUpperCase()
  const approved = requests.filter((request) => String(request?.status || '').trim().toUpperCase() === 'APPROVED')
  const overriddenDates = new Set(approved.map((request) => {
    const weekStart = String(request?.requestedWeekStartDate || request?.weekStartDate || '').slice(0, 10)
    return String(request?.defaultWeekOffDate || dateForDay(weekStart, request?.defaultWeekOffDay || regularDay) || '').slice(0, 10)
  }).filter(Boolean))
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let offset = 0; offset < 366; offset += 1) {
    const candidate = new Date(today)
    candidate.setDate(today.getDate() + offset)
    const candidateDate = dateKey(candidate)
    const alternate = approved.find((request) => String(request?.requestedWeekOffDate || '').slice(0, 10) === candidateDate)
    if (alternate) return { date: candidateDate, day: String(alternate.requestedWeekOffDay || '').trim().toUpperCase(), temporary: true }
    if (regularDay && dayNames[candidate.getDay()] === regularDay && !overriddenDates.has(candidateDate)) {
      return { date: candidateDate, day: regularDay, temporary: false }
    }
  }
  return { date: '', day: regularDay, temporary: false }
}

function FacultyBatchWeekTypeFilter({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const options = [
    { value: 'all', label: 'All batches' },
    { value: 'weekday', label: 'Weekday' },
    { value: 'weekend', label: 'Weekend' },
  ]
  const selectedOption = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [isOpen])

  return (
    <div ref={containerRef} className={`super-admin-branch-filter branch-course-custom-filter ${isOpen ? 'is-open' : ''}`.trim()} style={{ width: '160px' }}>
      <button
        type="button"
        className="super-admin-branch-filter-trigger"
        aria-label="Filter batches by week type"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="super-admin-branch-filter-menu" role="listbox" aria-label="Filter batches by week type">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`super-admin-branch-filter-option ${option.value === value ? 'is-selected' : ''}`.trim()}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function getInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'ST'
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)
}

function formatDisplayDate(value) {
  if (!value) return '-'

  const rawValue = String(value).trim()
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? `${rawValue}T00:00:00` : rawValue)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatStudentDate(value) {
  return formatDisplayDate(value)
}

function formatStudentAddress(value) {
  const normalized = String(value || '').replace(/\s*,\s*/g, ', ')
  return normalized
    .replace(/Tamil Nadu/gi, 'Tamil\u00a0Nadu')
    .replace(/,\s*(\d+)$/, ',\n$1')
}

function formatDisplayTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function formatMinutesLabel(value = 0) {
  const count = Math.max(0, Math.floor(Number(value) || 0))
  return `${count} minute${count === 1 ? '' : 's'}`
}

function normalizeCourseKey(value = '') {
  return String(value || '').trim().toLowerCase()
}

function getFacultyFlowCourseKey(course = {}) {
  return (
    String(course?.id || course?.courseId || '').trim() ||
    normalizeCourseKey(course?.courseCode || '') ||
    normalizeCourseKey(course?.name || course?.courseName || '')
  )
}

function getFacultyFlowBatchKey(batch = {}) {
  return (
    String(batch?.batchId || batch?.batchEntryId || batch?.id || '').trim() ||
    normalizeCourseKey(batch?.code || batch?.batchCode || batch?.batchName || batch?.batch || '') ||
    normalizeCourseKey(batch?.timing || batch?.batchTiming || '')
  )
}

function isAcademicReportFullySent(report = {}) {
  const requiredIds = Array.isArray(report?.reportableTestIds) && report.reportableTestIds.length
    ? report.reportableTestIds
    : (Array.isArray(report?.tests) ? report.tests.map((test) => test?.scheduleId).filter(Boolean) : [])
  const sentIds = new Set(Array.isArray(report?.sentReport?.academicTestIds) ? report.sentReport.academicTestIds : [])
  return requiredIds.length > 0 && requiredIds.every((id) => sentIds.has(id))
}

function getAttendanceBatchTiming(batch = {}) {
  const startTime = String(batch?.startTime || batch?.fromTime || '').trim()
  const endTime = String(batch?.endTime || batch?.toTime || '').trim()
  if (startTime || endTime) {
    return {
      startTime,
      endTime,
      startPeriod: String(batch?.startPeriod || '').trim().toUpperCase(),
      endPeriod: String(batch?.endPeriod || '').trim().toUpperCase(),
    }
  }
  return String(batch?.timing || batch?.batchTiming || batch?.batchTime || '').trim()
}

function isTemporarySessionEditable(session, now = new Date()) {
  const date = String(session?.effectiveDate || session?.replacementDate || session?.sessionDate || '').trim()
  const start = String(session?.effectiveStartTime || session?.replacementStartTime || session?.originalStartTime || '').trim()
  const end = String(session?.effectiveEndTime || session?.replacementEndTime || session?.originalEndTime || '').trim()
  const parseMinutes = (value) => {
    const match = value.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return null
    return Number(match[1]) * 60 + Number(match[2])
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Calcutta' }).format(now)
  const startMinutes = parseMinutes(start)
  const endMinutes = parseMinutes(end)
  if (!date || date !== today || startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return false
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

function doesFacultyBatchBelongToCourse(batch = {}, course = {}) {
  const batchCourseId = String(batch?.courseId || '').trim()
  const batchCourseName = normalizeCourseKey(batch?.course || batch?.courseName || '')
  const batchCourseCode = normalizeCourseKey(batch?.courseCode || '')
  const courseId = String(course?.id || course?.courseId || '').trim()
  const courseName = normalizeCourseKey(course?.name || course?.courseName || '')
  const courseCode = normalizeCourseKey(course?.courseCode || '')

  if (batchCourseId && courseId) {
    return batchCourseId === courseId
  }

  if (batchCourseName && courseName) {
    return batchCourseName === courseName
  }

  if (batchCourseCode && courseCode) {
    return batchCourseCode === courseCode
  }

  return false
}

function parseCourseNumber(value) {
  const normalized = String(value ?? '').trim().replace(/[^0-9.-]/g, '')
  if (!normalized) return Number.NaN
  return Number(normalized)
}

function formatCourseAmount(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return '-'

  const numeric = parseCourseNumber(normalized)
  if (!Number.isFinite(numeric)) return normalized

  return `₹${new Intl.NumberFormat('en-IN').format(numeric)}`
}

function formatPaymentPercentage(value) {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '')
}

function formatPaidPercentage(value) {
  if (!Number.isFinite(value)) return '0'
  const clamped = Math.min(100, Math.max(0, value))
  return String(Math.ceil(clamped - 0.5))
}

function formatCourseDuration(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return '-'
  if (!/^\d+(\.\d+)?$/.test(normalized)) return normalized

  return `${normalized} month${normalized === '1' ? '' : 's'}`
}

function formatCourseHours(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return '-'
  if (!/^\d+(\.\d+)?$/.test(normalized)) return normalized

  return `${normalized} hour${normalized === '1' ? '' : 's'}`
}

function buildFacultyStudentViewRecord(student = {}, facultyRecords = []) {
  const context = resolveFacultyBatchContextForStudent(student, facultyRecords)
  const batchEntry = context?.batchEntry || {}

  const courseName = String(
    student?.courseInterested ||
    student?.courseName ||
    student?.course?.name ||
    context?.courseName ||
    batchEntry?.courseName ||
    '',
  ).trim()

  const batchName = String(
    student?.batchName ||
    student?.batch ||
    context?.batchName ||
    batchEntry?.batchName ||
    batchEntry?.batch ||
    '',
  ).trim()

  const batchTiming = String(
    student?.batchTiming ||
    student?.batchTime ||
    context?.batchTiming ||
    batchEntry?.batchTiming ||
    batchEntry?.timing ||
    '',
  ).trim()

  const courseStartDate = String(
    student?.courseStartDate ||
    batchEntry?.courseStartDate ||
    student?.admissionDate ||
    '',
  ).trim()

  const classSchedule = String(
    student?.classSchedule ||
    batchEntry?.classSchedule ||
    batchEntry?.schedule ||
    batchTiming ||
    '',
  ).trim()

  const sourceEnrollments = Array.isArray(student?.courseEnrollments) && student.courseEnrollments.length
    ? student.courseEnrollments
    : Array.isArray(student?.courses) && student.courses.length ? student.courses : []
  const courseAssignments = sourceEnrollments.length
    ? [...sourceEnrollments]
      .sort((left, right) => Number(left?.sequenceOrder || 0) - Number(right?.sequenceOrder || 0))
      .map((enrollment) => {
        const enrollmentCourseId = String(enrollment?.courseId || enrollment?.course?.id || '').trim()
        const isCurrentEnrollment = enrollmentCourseId && enrollmentCourseId === String(student?.courseId || student?.course?.id || '').trim()
        const currentFallback = isCurrentEnrollment ? {
          facultyName: student?.facultyName || context?.facultyName || batchEntry?.facultyName || '',
          batchName: student?.batchName || context?.batchName || batchEntry?.batchName || batchEntry?.batch || '',
          batchTiming: student?.batchTiming || student?.batchTime || context?.batchTiming || batchEntry?.batchTiming || batchEntry?.timing || '',
          classSchedule: student?.classSchedule || batchEntry?.classSchedule || batchEntry?.schedule || '',
          schedule: batchEntry?.schedule || '',
          timing: batchEntry?.timing || '',
        } : {}
        return {
          courseId: enrollmentCourseId,
          courseName: String(enrollment?.courseName || enrollment?.course?.name || (isCurrentEnrollment ? courseName : '') || '').trim(),
          facultyName: String(enrollment?.facultyName || currentFallback.facultyName || '').trim(),
          batchName: String(enrollment?.batchName || currentFallback.batchName || currentFallback.batch || '').trim(),
          batchTiming: String(enrollment?.batchTiming || currentFallback.batchTiming || currentFallback.timing || '').trim(),
          classSchedule: String(enrollment?.scheduleType || enrollment?.classSchedule || currentFallback.classSchedule || currentFallback.schedule || '').trim(),
          courseMode: String(enrollment?.mode || enrollment?.courseMode || '').trim(),
          startDate: String(enrollment?.startDate || enrollment?.courseStartDate || (isCurrentEnrollment ? courseStartDate : '') || '').trim(),
          endDate: String(enrollment?.endDate || enrollment?.courseEndDate || '').trim(),
        }
      })
    : [{
      courseId: String(student?.courseId || student?.course?.id || '').trim(),
      courseName,
      facultyName: String(student?.facultyName || context?.facultyName || '').trim(),
      batchName,
      batchTiming,
      classSchedule,
      courseMode: String(student?.courseMode || student?.course?.mode || '').trim(),
      startDate: courseStartDate,
      endDate: String(student?.courseEndDate || '').trim(),
    }]

  return {
    ...student,
    studentId: String(student?.studentId || student?.id || '').trim(),
    studentName: String(student?.studentName || student?.name || student?.fullName || '').trim(),
    parentName: String(student?.parentName || student?.fatherName || student?.guardianName || '').trim(),
    emailAddress: String(student?.emailAddress || student?.email || '').trim(),
    mobileNumber: String(student?.mobileNumber || student?.phoneNumber || student?.phone || student?.studentPhone || '').trim(),
    parentSpouseNumber: String(student?.parentSpouseNumber || student?.parentMobileNumber || student?.parentPhoneNumber || student?.parentNumber || '').trim(),
    address: String(student?.address || student?.location || [student?.city, student?.state, student?.country].filter(Boolean).join(', ') || '').trim(),
    qualification: String(student?.qualification || student?.highestQualification || student?.education || '').trim(),
    educationLevel: String(student?.educationLevel || '').trim(),
    educationStatus: String(student?.educationStatus || '').trim(),
    designation: String(student?.designation || student?.currentDesignation || student?.jobTitle || '').trim(),
    passedOutYear: String(student?.passedOutYear || student?.passOutYear || student?.graduationYear || '').trim(),
    currentStatus: String(student?.currentStatus || student?.employmentStatus || student?.studentStatus || '').trim(),
    city: String(student?.city || '').trim(),
    state: String(student?.state || '').trim(),
    country: String(student?.country || '').trim(),
    courseName,
    batchName,
    batchTiming,
    classSchedule,
    courseStartDate,
    facultyName: String(student?.facultyName || context?.facultyName || '').trim(),
    courseAssignments,
  }
}

function getStudentIdentityKey(student = {}) {
  const primaryKey =
    String(student?.studentId || '').trim().toLowerCase() ||
    String(student?.emailAddress || '').trim().toLowerCase() ||
    String(student?.mobileNumber || '').trim().toLowerCase() ||
    String(student?.id || '').trim().toLowerCase() ||
    String(student?.studentCode || '').trim().toLowerCase()

  if (primaryKey) {
    const courseKey = String(student?.courseId || student?.courseName || student?.courseInterested || '').trim().toLowerCase()
    const batchKey = String(student?.batchId || student?.batchEntryId || student?.batchName || student?.batch || '').trim().toLowerCase()
    return [primaryKey, courseKey, batchKey].filter(Boolean).join('|')
  }

  return [
    student?.studentName,
    student?.courseId,
    student?.facultyId,
    student?.batchId || student?.batchEntryId,
    student?.admissionDate,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')
}

function getCourseEnrollmentForStudent(student = {}, course = {}, batch = {}) {
  const courseId = String(course?.id || course?.courseId || '').trim().toLowerCase()
  const courseCode = normalizeCourseKey(course?.courseCode || course?.code || '')
  const courseName = normalizeCourseKey(course?.name || course?.courseName || '')
  const batchId = String(batch?.id || batch?.batchId || batch?.batchEntryId || '').trim().toLowerCase()
  const batchName = normalizeCourseKey(batch?.name || batch?.batchName || batch?.code || '')
  const enrollments = Array.isArray(student?.courseEnrollments)
    ? student.courseEnrollments
    : Array.isArray(student?.courses)
      ? student.courses
      : []

  // Faculty rows can already be expanded from a single enrollment (the same
  // shape used by the branch-admin student table). Nested enrollment data is
  // authoritative when present because the top-level student course can be a
  // stale primary-course snapshot for parallel-course students.
  const directCourseId = String(student?.courseId || student?.course?.id || '').trim().toLowerCase()
  const directCourseCode = normalizeCourseKey(student?.courseCode || student?.course?.courseCode || '')
  const directCourseName = normalizeCourseKey(student?.courseName || student?.courseInterested || student?.course?.name || '')
  const directBatchId = String(student?.batchId || student?.batchEntryId || '').trim().toLowerCase()
  const directBatchName = normalizeCourseKey(student?.batchName || student?.batch || '')
  const directCourseMatch = (!courseId && !courseCode && !courseName) ||
    (courseId && directCourseId === courseId) ||
    (courseCode && directCourseCode === courseCode) ||
    (courseName && directCourseName === courseName)
  const directBatchMatch = (!batchId && !batchName) ||
    (batchId && directBatchId === batchId) ||
    (batchName && directBatchName === batchName)
  const scoredEnrollments = enrollments.map((enrollment) => {
    const enrollmentId = String(enrollment?.courseId || enrollment?.course?.id || enrollment?.id || '').trim().toLowerCase()
    const enrollmentCode = normalizeCourseKey(enrollment?.courseCode || enrollment?.course?.courseCode || '')
    const enrollmentName = normalizeCourseKey(enrollment?.courseName || enrollment?.course?.name || enrollment?.name || '')
    const enrollmentBatchId = String(enrollment?.batchId || enrollment?.batchEntryId || '').trim().toLowerCase()
    const enrollmentBatchName = normalizeCourseKey(enrollment?.batchName || enrollment?.batch || '')
    const matchesCourse = (!courseId && !courseCode && !courseName) ||
      (courseId && enrollmentId === courseId) ||
      (courseCode && enrollmentCode === courseCode) ||
      (courseName && enrollmentName === courseName)
    const matchesBatch = (!batchId && !batchName) || (batchId && enrollmentBatchId === batchId) || (batchName && enrollmentBatchName === batchName)
    return {
      enrollment,
      score: (matchesCourse ? 2 : 0) + (matchesBatch ? 1 : 0),
      matchesCourse,
      matchesBatch,
    }
  }).filter((item) => {
    // When both selectors are present, never let another course in the same
    // batch win the match. This is important for parallel-course students.
    if ((courseId || courseCode || courseName) && (batchId || batchName)) {
      return item.matchesCourse && item.matchesBatch
    }
    return item.matchesCourse || item.matchesBatch
  })

  if (scoredEnrollments.length) {
    return scoredEnrollments.sort((left, right) => right.score - left.score)[0].enrollment
  }

  if (directCourseMatch && directBatchMatch && (directCourseId || directCourseCode || directCourseName)) {
    return student
  }

  return null
}

function getCourseAcademicTestProgress(student = {}, course = {}, enrollment = null) {
  const courseId = String(course?.id || course?.courseId || enrollment?.courseId || '').trim()
  const courseName = normalizeCourseKey(course?.name || course?.courseName || enrollment?.courseName || '')
  const byCourse = student?.academicTestProgressByCourse && typeof student.academicTestProgressByCourse === 'object'
    ? student.academicTestProgressByCourse
    : {}
  const matchingKey = Object.keys(byCourse).find((key) => {
    const normalizedKey = String(key || '').trim().toLowerCase()
    return (courseId && normalizedKey === courseId.toLowerCase()) || (courseName && normalizedKey === courseName)
  })

  return enrollment?.academicTestProgress || byCourse[matchingKey] || student?.academicTestProgress || null
}

function getFacultyStudentLifecycle(student = {}, course = {}, progressOverride = null) {
  const enrollment = getCourseEnrollmentForStudent(student, course)
  const scopedStudent = enrollment
    ? { ...student, ...enrollment, courseId: enrollment.courseId || student.courseId, courseName: enrollment.courseName || student.courseName }
    : student
  const storedCourseProgress = Number(
    scopedStudent?.courseProgress ??
    scopedStudent?.courseProgressPercentage ??
    scopedStudent?.progress ??
    0,
  )
  const courseProgress = Number.isFinite(Number(progressOverride))
    ? Number(progressOverride)
    : storedCourseProgress
  const paymentProgress = getStudentPaymentProgress(student, {
    courseId: scopedStudent?.courseId || course?.id || course?.courseId,
    courseName: scopedStudent?.courseName || course?.name || course?.courseName,
  })
  // Always calculate this against the scoped course installments. The
  // student API's top-level paidProgress belongs to the primary course and
  // can be stale or incorrect for a parallel/discontinued course row.
  const enrollmentPaidProgress = Number(
    enrollment?.paidProgress?.percentage ??
    enrollment?.paidProgress?.paidInstallmentPercentage ??
    NaN,
  )
  const enrollmentPaidAmount = Number(
    enrollment?.paidAmount ??
    enrollment?.amountPaid ??
    enrollment?.totalPaid ??
    NaN,
  )
  const enrollmentFee = Number(
    enrollment?.finalCourseAmount ??
    enrollment?.totalCourseAmount ??
    enrollment?.courseAmount ??
    NaN,
  )
  const storedPaidProgress = Number(
    scopedStudent?.paidProgress?.percentage ??
    scopedStudent?.paidProgress?.paidInstallmentPercentage ??
    scopedStudent?.paidProgress ??
    NaN,
  )
  const hasPaymentSource = Number(paymentProgress?.totalFee || 0) > 0 ||
    Number(paymentProgress?.totalInstallments || 0) > 0 ||
    Number(paymentProgress?.paidAmount || 0) > 0
  const paidProgress = Number.isFinite(enrollmentPaidProgress)
    ? enrollmentPaidProgress
    : Number.isFinite(enrollmentPaidAmount) && enrollmentFee > 0
      ? (enrollmentPaidAmount / enrollmentFee) * 100
      : hasPaymentSource || !Number.isFinite(storedPaidProgress)
        ? Number(paymentProgress?.paidInstallmentPercentage || 0)
        : storedPaidProgress
  const academicTestProgress = getCourseAcademicTestProgress(student, course, enrollment)
  const totalTests = Number(academicTestProgress?.totalTests ?? academicTestProgress?.total ?? 0)
  const pendingTests = Number(academicTestProgress?.pendingTests ?? academicTestProgress?.pending ?? 0)
  const academicPercentage = Number(academicTestProgress?.percentage ?? academicTestProgress?.progress ?? 0)
  const totalProjects = Number(academicTestProgress?.totalProjects ?? 0)
  const pendingProjects = Number(academicTestProgress?.pendingProjects ?? 0)
  const projectsComplete = totalProjects === 0 || pendingProjects === 0 || academicTestProgress?.projectsComplete === true
  // A missing academic-test snapshot is not proof that the academic tests are
  // complete. Course progress alone must never move a student out of Active
  // Students; the academic report must also confirm completion.
  const academicComplete = Boolean(academicTestProgress) && (
    pendingTests === 0 && projectsComplete && (
      totalTests > 0 ||
      academicPercentage >= 100 ||
      academicTestProgress.completed === true ||
      academicTestProgress.isComplete === true ||
      academicTestProgress.pendingTests === 0
    )
  )
  return {
    // Payment completion is tracked separately. A course is completed only
    // when its learning progress and academic tests are complete.
    // Completion requires both course progress and academic-test completion.
    // Do not let a persisted status/date bypass the academic-test requirement.
    isCompleted: courseProgress >= 100 && academicComplete,
    courseProgress: Math.min(100, Math.max(0, courseProgress)),
    paidProgress: Math.min(100, Math.max(0, paidProgress)),
    academicTestProgress,
    enrollment,
  }
}

function isFacultyStudentCourseComplete(student = {}, course = {}, batch = {}) {
  const enrollment = getCourseEnrollmentForStudent(student, course, batch)
  const progress = Number(
    enrollment?.courseProgress ??
    enrollment?.courseProgressPercentage ??
    student?.courseProgress ??
    student?.courseProgressPercentage ??
    student?.progress ??
    0,
  )
  const academicTestProgress = getCourseAcademicTestProgress(student, course, enrollment)
  const pendingTests = Number(academicTestProgress?.pendingTests ?? academicTestProgress?.pending ?? 0)
  const totalTests = Number(academicTestProgress?.totalTests ?? academicTestProgress?.total ?? 0)
  const academicPercentage = Number(academicTestProgress?.percentage ?? academicTestProgress?.progress ?? 0)
  const totalProjects = Number(academicTestProgress?.totalProjects ?? 0)
  const pendingProjects = Number(academicTestProgress?.pendingProjects ?? 0)
  const projectsComplete = totalProjects === 0 || pendingProjects === 0 || academicTestProgress?.projectsComplete === true
  // Missing academic-test data means the student is still active. The report
  // data is the source of truth for whether every academic requirement ended.
  const academicComplete = Boolean(academicTestProgress) && (
    pendingTests === 0 && projectsComplete && (
      totalTests > 0 ||
      academicPercentage >= 100 ||
      academicTestProgress.completed === true ||
      academicTestProgress.isComplete === true
    )
  )
  return progress >= 100 && academicComplete
}

function dedupeStudentsByIdentity(students = []) {
  const seen = new Set()

  return (Array.isArray(students) ? students : []).filter((student) => {
    const key = getStudentIdentityKey(student)
    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function dedupeStudentsWithinBatch(students = []) {
  const seen = new Set()
  return (Array.isArray(students) ? students : []).filter((student) => {
    const studentKey = String(
      student?.studentId ||
      student?.emailAddress ||
      student?.mobileNumber ||
      student?.id ||
      '',
    ).trim().toLowerCase()
    if (!studentKey || seen.has(studentKey)) return false
    seen.add(studentKey)
    return true
  })
}

function getExactFacultyStudents(students = [], facultyId = '', facultyName = '', facultyEmail = '') {
  const normalizedFacultyId = String(facultyId || '').trim().toLowerCase()
  const normalizedFacultyName = String(facultyName || '').trim().toLowerCase()
  const normalizedFacultyEmail = String(facultyEmail || '').trim().toLowerCase()

  return (Array.isArray(students) ? students : []).filter((student) => {
    const studentFacultyId = String(student?.facultyId || '').trim().toLowerCase()
    const studentFacultyName = String(student?.facultyName || '').trim().toLowerCase()
    const studentFacultyEmail = String(student?.facultyEmail || '').trim().toLowerCase()

    // A stale student row can retain a reused/public faculty id while its
    // faculty name still points to the previous faculty. Treat the id and
    // name as one assignment when both are available; otherwise those rows
    // leak into the current faculty's student list.
    const matchesFacultyId =
      normalizedFacultyId &&
      studentFacultyId &&
      studentFacultyId === normalizedFacultyId &&
      (!normalizedFacultyName || !studentFacultyName || studentFacultyName === normalizedFacultyName)

    const matchesFacultyEmail =
      normalizedFacultyEmail &&
      studentFacultyEmail &&
      studentFacultyEmail === normalizedFacultyEmail

    const matchesFacultyName =
      normalizedFacultyName &&
      studentFacultyName &&
      studentFacultyName === normalizedFacultyName

    return matchesFacultyId || matchesFacultyEmail || matchesFacultyName
  })
}

function normalizeWorkStudentId(value = '') {
  return String(value || '').trim().toLowerCase()
}

function getStudentAttendanceKeys(student = {}) {
  const nestedStudent = student?.student && typeof student.student === 'object' ? student.student : {}
  const enrollment = student?.enrollment || student?.courseEnrollment || {}

  return Array.from(new Set([
    student?.id,
    student?.studentId,
    student?.studentCode,
    student?._id,
    nestedStudent?.id,
    nestedStudent?.studentId,
    nestedStudent?.studentCode,
    enrollment?.studentId,
    enrollment?.studentCode,
    student?.emailAddress,
  ].map(normalizeWorkStudentId).filter(Boolean)))
}

function getWorkStudentIds(entry = {}) {
  const source = Array.isArray(entry.selectedStudentIds)
    ? entry.selectedStudentIds
    : Array.isArray(entry.studentIds)
      ? entry.studentIds
      : []

  return source
    .map((value) => normalizeWorkStudentId(value))
    .filter(Boolean)
}

function getWorkEntrySubmoduleIds(entry = {}) {
  const source = Array.isArray(entry.selectedSubmoduleIds)
    ? entry.selectedSubmoduleIds
    : Array.isArray(entry.submoduleIds)
      ? entry.submoduleIds
      : Array.isArray(entry.submodules)
        ? entry.submodules.map((item) => item?.id || item?.submoduleId || item?.value || '').filter(Boolean)
        : []

  return Array.from(
    new Set(
      source
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  )
}

function getTodayWorkStudentId(student = {}) {
  return String(student?.id || student?.studentId || '').trim()
}

function isAttendanceMarkedStatus(value) {
  return ['PRESENT', 'ABSENT'].includes(String(value || '').trim().toUpperCase())
}

function extractStudentAttendanceStatuses(payload = {}) {
  const source = payload?.data ?? payload
  const rows = [
    ...(Array.isArray(source) ? source : []),
    ...(Array.isArray(source?.students) ? source.students : []),
    ...(Array.isArray(source?.attendance) ? source.attendance : []),
    ...(Array.isArray(source?.attendanceRecords) ? source.attendanceRecords : []),
    ...(Array.isArray(source?.records) ? source.records : []),
    ...(Array.isArray(source?.items) ? source.items : []),
    ...(Array.isArray(source?.results) ? source.results : []),
    ...(Array.isArray(source?.batches) ? source.batches.flatMap((batch) => batch?.students || []) : []),
  ]
  const statuses = {}

  rows.forEach((row) => {
    const studentKeys = getStudentAttendanceKeys(row)
    const saveStatus = (value) => {
      const status = String(value || '').trim().toUpperCase()
      if (!studentKeys.length || !isAttendanceMarkedStatus(status)) return
      studentKeys.forEach((key) => {
        statuses[key] = status
      })
    }

    saveStatus(row?.attendanceStatus || row?.attendanceStatusLabel || row?.status)
    ;(Array.isArray(row?.records) ? row.records : []).forEach((record) => {
      saveStatus(record?.attendanceStatus || record?.attendanceStatusLabel || record?.status)
    })
  })

  return statuses
}

function getCurrentStudentAttendanceStatus(statuses = {}, student = {}) {
  const status = getStudentAttendanceStatus(statuses, student)
  return isAttendanceMarkedStatus(status) ? status : ''
}

function getStudentAttendanceStatus(statuses = {}, student = {}) {
  const savedStatus = getStudentAttendanceKeys(student).map((key) => statuses[key]).find(Boolean) || ''
  if (isAttendanceMarkedStatus(savedStatus)) return savedStatus

  const directStatus = String(
    student?.attendanceStatus
      || student?.attendanceStatusLabel
      || student?.todayAttendanceStatus
      || student?.attendance?.status
      || '',
  ).trim().toUpperCase()
  if (isAttendanceMarkedStatus(directStatus)) return directStatus

  const today = getAttendanceDateKey()
  const todayRecord = (Array.isArray(student?.records) ? student.records : []).find((record) => (
    String(record?.attendanceDate || record?.date || '').slice(0, 10) === today
  ))
  const recordStatus = String(todayRecord?.attendanceStatus || todayRecord?.status || '').trim().toUpperCase()
  return isAttendanceMarkedStatus(recordStatus) ? recordStatus : ''
}

function normalizeSubmoduleProgressStatus(value = '') {
  const status = String(value || '').trim().toLowerCase()
  return status === 'completed'
    ? 'Completed'
    : status === 'not completed' || status === 'not-completed'
      ? 'Not Completed'
      : status === 'in progress' || status === 'in-progress'
        ? 'In Progress'
        : ''
}

function getWorkEntrySubmoduleStatus(entry = {}, submoduleId = '', studentId = '') {
  const normalizedSubmoduleId = normalizeWorkStudentId(submoduleId)
  const normalizedStudentId = normalizeWorkStudentId(studentId)
  const configuredStatuses = entry?.submoduleStatuses
  if (configuredStatuses && typeof configuredStatuses === 'object') {
    const studentStatuses = configuredStatuses[studentId] || configuredStatuses[normalizedStudentId]
    const hasStudentStatusMap = Object.values(configuredStatuses).some((value) => value && typeof value === 'object')
    // A student-specific record is authoritative. Do not inherit progress from
    // another student's row or from the shared submodule status.
    if (hasStudentStatusMap && normalizedStudentId && (!studentStatuses || typeof studentStatuses !== 'object')) return ''

    const configuredStatus = typeof studentStatuses === 'object'
      ? studentStatuses[submoduleId] || studentStatuses[normalizedSubmoduleId]
      : configuredStatuses[submoduleId] || configuredStatuses[normalizedSubmoduleId]
    const normalizedStatus = normalizeSubmoduleProgressStatus(configuredStatus)
    if (hasStudentStatusMap && normalizedStudentId) return normalizedStatus
    if (normalizedStatus) return normalizedStatus
  }

  const progressRows = [
    ...(Array.isArray(entry?.submoduleProgress) ? entry.submoduleProgress : []),
    ...(Array.isArray(entry?.progressByStudent) ? entry.progressByStudent : []),
    ...(Array.isArray(entry?.studentProgress) ? entry.studentProgress : []),
  ]

  const progressMatch = progressRows.find((row) => {
    const rowSubmoduleId = normalizeWorkStudentId(row?.submoduleId || row?.id)
    const rowStudentId = normalizeWorkStudentId(row?.studentId || row?.student || '')
    // Never apply a progress row without a student id to a specific student.
    // Completion must be tracked by the exact student + submodule pair.
    return rowSubmoduleId === normalizedSubmoduleId
      && (!normalizedStudentId ? true : rowStudentId === normalizedStudentId)
  })
  const progressStatus = normalizeSubmoduleProgressStatus(progressMatch?.completionStatus)
    || normalizeSubmoduleProgressStatus(progressMatch?.status || progressMatch?.submoduleStatus || progressMatch?.progressStatus)
  if (progressStatus) return progressStatus
  if (normalizedStudentId && progressRows.length) return ''

  const submodule = (Array.isArray(entry?.submodules) ? entry.submodules : []).find((item) =>
    normalizeWorkStudentId(item?.id || item?.submoduleId) === normalizedSubmoduleId,
  )
  const rowStatus = normalizeSubmoduleProgressStatus(submodule?.status || submodule?.submoduleStatus || submodule?.progressStatus)
  if (rowStatus) return rowStatus

  // Older records stored one status for the selected work instead of a
  // student-specific map. Keep those records visible while new records use
  // the per-student status map above.
  const legacyEntryStatus = normalizeSubmoduleProgressStatus(
    entry?.submoduleStatus || entry?.subModuleStatus || entry?.progressStatus,
  )
  if (legacyEntryStatus) return legacyEntryStatus

  // A selected sub-module is not progress by itself. Only an explicit
  // Completed status may contribute to the course percentage.
  return ''
}

function getWorkEntryStudentAttendanceStatus(entry = {}, studentId = '') {
  const normalizedStudentId = normalizeWorkStudentId(studentId)
  const result = (Array.isArray(entry?.studentResults) ? entry.studentResults : []).find((item) => (
    normalizeWorkStudentId(item?.studentId || item?.id || '') === normalizedStudentId
  ))
  const status = String(result?.attendanceStatus || result?.status || '').trim().toUpperCase()
  return ['PRESENT', 'ABSENT'].includes(status) ? status : ''
}

function getPersistedTodayWorkSubmoduleStatuses(
  entries = [],
  facultyIdentity = {},
  courseId = '',
  moduleId = '',
  batch = null,
  studentsForWork = [],
  currentSubmodules = [],
) {
  const statuses = {}
  const submoduleIds = currentSubmodules.map((submodule, index) => String(
    submodule?.id || submodule?.submoduleId || `submodule-${index}`,
  ).trim()).filter(Boolean)

  studentsForWork.forEach((student) => {
    const studentId = String(student?.id || student?.studentId || '').trim()
    if (!studentId) return
    const matchingEntries = getFacultyTodayWorkEntriesForStudent(entries, {
      ...student,
      batchId: student?.batchId || batch?.batchId || batch?.id || '',
      batchName: student?.batchName || batch?.batchName || batch?.code || '',
      batchTiming: student?.batchTiming || batch?.timing || batch?.batchTiming || '',
    }, courseId)
      .filter((entry) => normalizeWorkStudentId(entry?.moduleId) === normalizeWorkStudentId(moduleId))
      .filter((entry) => {
        const entryFacultyId = normalizeWorkStudentId(entry?.facultyId || entry?.facultyProfileId || entry?.facultyUserId)
        const entryFacultyEmail = normalizeWorkStudentId(entry?.facultyEmail)
        return (
          (facultyIdentity?.facultyId && entryFacultyId === normalizeWorkStudentId(facultyIdentity.facultyId)) ||
          (facultyIdentity?.facultyEmail && entryFacultyEmail === normalizeWorkStudentId(facultyIdentity.facultyEmail))
        )
      })
      .sort((left, right) => new Date(right?.updatedAt || right?.createdAt || 0).getTime() - new Date(left?.updatedAt || left?.createdAt || 0).getTime())

    submoduleIds.forEach((submoduleId) => {
      const entryStatuses = matchingEntries
        .filter((entry) => getWorkEntrySubmoduleIds(entry).some((id) => normalizeWorkStudentId(id) === normalizeWorkStudentId(submoduleId)))
        .map((entry) => getWorkEntryStudentAttendanceStatus(entry, studentId) === 'ABSENT'
          ? 'Not Completed'
          : getWorkEntrySubmoduleStatus(entry, submoduleId, studentId))
        .filter(Boolean)
      // A later attendance update can record a missed item, but it must not
      // downgrade a sub-module that was already completed earlier.
      const status = entryStatuses.find((value) => value === 'Completed')
        || entryStatuses.find((value) => value === 'In Progress')
        || entryStatuses[0]
        || ''
      if (status) {
        statuses[studentId] = { ...(statuses[studentId] || {}), [submoduleId]: status }
      }
    })
  })

  return statuses
}

function getWorkBatchContext(source = {}) {
  return {
    batchId: normalizeWorkStudentId(source?.batchId || source?.batchEntryId),
  }
}

function doesWorkEntryMatchBatch(entry = {}, source = {}) {
  const entryBatch = getWorkBatchContext(entry)
  const sourceBatch = getWorkBatchContext(source)
  if (entryBatch.batchId && sourceBatch.batchId && entryBatch.batchId === sourceBatch.batchId) {
    return true
  }

  const entryBatchName = normalizeWorkStudentId(entry?.batchName)
  const sourceBatchName = normalizeWorkStudentId(source?.batchName)
  return Boolean(entryBatchName && sourceBatchName && entryBatchName === sourceBatchName)
}

function isFacultyWorkEntryForStudent(entry = {}, student = {}) {
  if (!entry || !student) return false

  const applyToAllStudents = Boolean(entry.applyToAllStudents)
  const entryStudentIds = getWorkStudentIds(entry)
  const studentId = normalizeWorkStudentId(student.id || student.studentId || '')
  const studentCourseId = normalizeWorkStudentId(student.courseId || student.course?.id || '')
  const entryCourseId = normalizeWorkStudentId(entry.courseId || '')
  const studentCourseName = normalizeWorkStudentId(
    student.courseName || student.courseInterested || student.course?.name || '',
  )
  const entryCourseName = normalizeWorkStudentId(entry.courseName || '')

  // Even apply-to-all entries contain the exact students visible in the
  // selected batch. Prefer those IDs to avoid crossing batches.
  const isTargetedStudent = entryStudentIds.length
    ? Boolean(studentId && entryStudentIds.includes(studentId))
    : applyToAllStudents
  if (!isTargetedStudent) return false

  if (
    entryCourseId &&
    studentCourseId &&
    entryCourseId !== studentCourseId &&
    (!entryCourseName || !studentCourseName || entryCourseName !== studentCourseName)
  ) {
    return false
  }

  return doesWorkEntryMatchBatch(entry, student)
}

function getFacultyTodayWorkEntriesForStudent(entries = [], student = {}, courseId = '') {
  const normalizedCourseId = normalizeWorkStudentId(courseId)

  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (!isFacultyWorkEntryForStudent(entry, student)) {
      return false
    }

    const entryCourseId = normalizeWorkStudentId(entry.courseId || '')
    if (normalizedCourseId && entryCourseId && entryCourseId !== normalizedCourseId) {
      return false
    }

    return true
  })
}

function isTodayFacultyWorkEntry(entry = {}) {
  return String(entry?.workDate || '').trim() === getAttendanceDateKey()
}

function getCompletedTodayWorkSubmoduleIdsForModule(
  entries = [],
  facultyIdentity = {},
  courseId = '',
  moduleId = '',
  batch = null,
  currentSubmodules = [],
) {
  const normalizedCourseId = normalizeWorkStudentId(courseId)
  const normalizedModuleId = normalizeWorkStudentId(moduleId)
  const facultyId = normalizeWorkStudentId(facultyIdentity?.facultyId || '')
  const facultyEmail = normalizeWorkStudentId(facultyIdentity?.facultyEmail || '')
  const validSubmoduleIds = new Set(
    (Array.isArray(currentSubmodules) ? currentSubmodules : [])
      .map((submodule, submoduleIndex) => normalizeWorkStudentId(
        submodule?.id || submodule?.submoduleId || `submodule-${submoduleIndex}`,
      ))
      .filter(Boolean),
  )

  const matchingEntries = (Array.isArray(entries) ? entries : []).filter((entry) => {
    const entryFacultyId = normalizeWorkStudentId(entry?.facultyId || entry?.facultyProfileId || entry?.facultyUserId || '')
    const entryFacultyEmail = normalizeWorkStudentId(entry?.facultyEmail || '')
    const entryCourseId = normalizeWorkStudentId(entry?.courseId || '')
    const entryModuleId = normalizeWorkStudentId(entry?.moduleId || '')

    const matchesFaculty =
      (facultyId && entryFacultyId && entryFacultyId === facultyId) ||
      (facultyEmail && entryFacultyEmail && entryFacultyEmail === facultyEmail)

    return matchesFaculty &&
      entryCourseId === normalizedCourseId &&
      entryModuleId === normalizedModuleId &&
      (!batch || doesWorkEntryMatchBatch(entry, batch))
  })

  return Array.from(
    new Set(
      matchingEntries
        .flatMap((entry) => getWorkEntrySubmoduleIds(entry))
        .map((submoduleId) => normalizeWorkStudentId(submoduleId))
        .filter((submoduleId) => submoduleId && validSubmoduleIds.has(submoduleId))
        .filter((submoduleId) => matchingEntries.some((entry) =>
          getWorkEntrySubmoduleStatus(entry, submoduleId) === 'Completed',
        )),
    ),
  )
}

function buildFacultyTodayWorkProgressSummary(entries = [], course = {}, student = null) {
  const modules = getCourseModels(course)
  if (!modules.length) return null

  const normalizedCourseId = normalizeWorkStudentId(course?.id || course?.courseId || '')
  const matchingEntries = student
    ? getFacultyTodayWorkEntriesForStudent(entries, student, normalizedCourseId)
    : (Array.isArray(entries) ? entries : []).filter((entry) => normalizeWorkStudentId(entry.courseId || '') === normalizedCourseId)

  if (!matchingEntries.length) return null

  const latestEntry = [...matchingEntries].sort(
    (left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime(),
  )[0] || null

  const moduleCompletionMap = new Map()
  const moduleSubmoduleIdMap = new Map()
  modules.forEach((module, moduleIndex) => {
    const moduleId = String(module?.id || `module-${moduleIndex}`).trim()
    if (!moduleId) return
    moduleCompletionMap.set(moduleId, new Set())
    moduleSubmoduleIdMap.set(
      moduleId,
      new Set(
        getCourseSubmodules(module)
          .map((submodule, submoduleIndex) => String(
            submodule?.id || submodule?.submoduleId || `submodule-${submoduleIndex}`,
          ).trim())
          .filter(Boolean),
      ),
    )
  })

  matchingEntries.forEach((entry) => {
    if (getWorkEntryStudentAttendanceStatus(entry, student?.id || student?.studentId || '') === 'ABSENT') return
    const entryModuleId = String(entry?.moduleId || '').trim()
    if (!entryModuleId) return
    const submoduleSet = moduleCompletionMap.get(entryModuleId)
    const validSubmoduleIds = moduleSubmoduleIdMap.get(entryModuleId)
    if (!submoduleSet) return

    getWorkEntrySubmoduleIds(entry).forEach((submoduleId) => {
      const normalizedSubmoduleId = String(submoduleId || '').trim()
      if (
        normalizedSubmoduleId &&
        validSubmoduleIds?.has(normalizedSubmoduleId) &&
        getWorkEntrySubmoduleStatus(entry, normalizedSubmoduleId, student?.id || student?.studentId || '') === 'Completed'
      ) {
        submoduleSet.add(normalizedSubmoduleId)
      }
    })
  })

  const moduleSummaries = modules.map((module, moduleIndex) => {
    const moduleId = String(module?.id || `module-${moduleIndex}`).trim()
    const submodules = getCourseSubmodules(module)
    const completedSubmoduleIds = Array.from(moduleCompletionMap.get(moduleId) || new Set())
    const totalSubmodules = submodules.length
    const completedCount = totalSubmodules > 0
      ? Math.min(totalSubmodules, new Set(completedSubmoduleIds).size)
      : new Set(completedSubmoduleIds).size
    const moduleProgress = totalSubmodules > 0
      ? Math.min(100, (completedCount / totalSubmodules) * 100)
      : (completedCount > 0 ? 100 : 0)

    return {
      moduleId,
      module,
      totalSubmodules,
      completedCount,
      moduleProgress,
    }
  })

  const courseProgressTotals = moduleSummaries.reduce((acc, moduleSummary) => {
    acc.completed += Number(moduleSummary.completedCount || 0)
    acc.total += Number(moduleSummary.totalSubmodules || 0)
    return acc
  }, { completed: 0, total: 0 })

  const courseProgress = courseProgressTotals.total > 0
    ? (courseProgressTotals.completed / courseProgressTotals.total) * 100
    : 0

  const currentModuleId = String(latestEntry?.moduleId || '').trim()
  const currentModuleSummary = moduleSummaries.find((item) => item.moduleId === currentModuleId) || moduleSummaries[0] || null

  return {
    entry: latestEntry,
    selectedSubmoduleIds: getWorkEntrySubmoduleIds(latestEntry || {}),
    moduleProgress: currentModuleSummary?.moduleProgress || 0,
    courseProgress: Math.min(100, courseProgress),
    moduleSummary: currentModuleSummary,
    moduleSummaries,
  }
}

function getFacultyWorkProgressForEntry(entry = {}, course = {}, selectedSubmoduleIds = [], studentId = '') {
  const modules = getCourseModels(course)
  const moduleId = String(entry.moduleId || '').trim()
  const module =
    modules.find((item, index) => String(item?.id || `module-${index}`).trim() === moduleId) ||
    modules[0] ||
    null
  const submodules = getCourseSubmodules(module)
  const totalSubmodules = submodules.length
  const completedSubmodules = Array.isArray(selectedSubmoduleIds)
    ? Array.from(new Set(selectedSubmoduleIds.map((value) => String(value || '').trim()).filter(Boolean))).filter((submoduleId) =>
      getWorkEntrySubmoduleStatus(entry, submoduleId, studentId) === 'Completed',
    ).length
    : 0
  const submoduleProgress = totalSubmodules > 0 ? Math.min(100, (completedSubmodules / totalSubmodules) * 100) : (completedSubmodules > 0 ? 100 : 0)
  const totalModules = modules.length
  const moduleWeight = totalModules > 0 ? 100 / totalModules : 0
  const moduleProgress = submoduleProgress
  const courseProgress = Math.min(100, moduleWeight * (moduleProgress / 100))

  return {
    module,
    submodules,
    totalSubmodules,
    completedSubmodules,
    submoduleProgress,
    moduleProgress,
    moduleWeight,
    courseProgress,
  }
}

function getNextPendingTodayWorkSelection(course = {}, todayWorkEntries = [], facultyIdentity = {}, batch = null, students = []) {
  const modules = getCourseModels(course)
  const normalizedCourseId = normalizeWorkStudentId(course?.id || course?.courseId || '')
  const facultyEntries = (Array.isArray(todayWorkEntries) ? todayWorkEntries : []).filter((entry) => {
    const entryFacultyId = normalizeWorkStudentId(entry?.facultyId || entry?.facultyProfileId || entry?.facultyUserId || '')
    const facultyId = normalizeWorkStudentId(facultyIdentity?.facultyId || '')
    const facultyEmail = normalizeWorkStudentId(facultyIdentity?.facultyEmail || '')
    const entryFacultyEmail = normalizeWorkStudentId(entry?.facultyEmail || '')
    const entryCourseId = normalizeWorkStudentId(entry?.courseId || '')

    const matchesFaculty =
      (facultyId && entryFacultyId && entryFacultyId === facultyId) ||
      (facultyEmail && entryFacultyEmail && entryFacultyEmail === facultyEmail)

    return matchesFaculty &&
      (!normalizedCourseId || entryCourseId === normalizedCourseId) &&
      (!batch || doesWorkEntryMatchBatch(entry, batch))
  })

  const moduleCompletionMap = new Map()
  modules.forEach((module, index) => {
    const moduleId = String(module?.id || `module-${index}`).trim()
    if (!moduleId) return
    moduleCompletionMap.set(moduleId, new Set())
  })

  if (students.length) {
    moduleCompletionMap.forEach((submoduleSet, moduleId) => {
      const module = modules.find((item, index) => String(item?.id || `module-${index}`).trim() === moduleId)
      getCourseSubmodules(module).forEach((submodule, submoduleIndex) => {
        const submoduleId = String(submodule?.id || submodule?.submoduleId || `${moduleId}-submodule-${submoduleIndex}`).trim()
        const completedForEveryStudent = students.every((student) => facultyEntries.some((entry) => (
          String(entry?.moduleId || '').trim() === moduleId
          && isFacultyWorkEntryForStudent(entry, student)
          && getWorkEntrySubmoduleIds(entry).some((id) => normalizeWorkStudentId(id) === normalizeWorkStudentId(submoduleId))
          && getWorkEntrySubmoduleStatus(entry, submoduleId, student?.id || student?.studentId || '') === 'Completed'
        )))
        if (completedForEveryStudent) submoduleSet.add(submoduleId)
      })
    })
  } else {
    facultyEntries.forEach((entry) => {
      const moduleId = String(entry?.moduleId || '').trim()
      const submoduleSet = moduleCompletionMap.get(moduleId)
      if (!submoduleSet) return

      getWorkEntrySubmoduleIds(entry).forEach((submoduleId) => {
        if (getWorkEntrySubmoduleStatus(entry, submoduleId) === 'Completed') {
          submoduleSet.add(submoduleId)
        }
      })
    })
  }

  for (const [moduleId, submoduleSet] of moduleCompletionMap.entries()) {
    const module = modules.find((item, index) => String(item?.id || `module-${index}`).trim() === moduleId) || null
    const submodules = getCourseSubmodules(module)
    const pendingSubmodule = submodules.find((submodule, index) => {
      const submoduleId = String(submodule?.id || submodule?.submoduleId || `${moduleId}-submodule-${index}`).trim()
      return submoduleId && !submoduleSet.has(submoduleId)
    })

    if (pendingSubmodule) {
      const nextSubmoduleId = String(
        pendingSubmodule?.id ||
        pendingSubmodule?.submoduleId ||
        `${moduleId}-submodule-0`,
      ).trim()

      return {
        module,
        moduleId,
        submoduleIds: nextSubmoduleId ? [nextSubmoduleId] : [],
      }
    }
  }

  const fallbackModule = modules[0] || null

  return {
    module: fallbackModule,
    moduleId: String(fallbackModule?.id || '').trim(),
    submoduleIds: [],
  }
}

function getCourseModels(course) {
  const source = course && typeof course === 'object' ? course : {}

  return Array.isArray(source.models)
    ? source.models
    : Array.isArray(source.courseModels)
      ? source.courseModels
      : Array.isArray(source.modules)
        ? source.modules
        : []
}

function getCourseModuleName(module = {}, index = 0) {
  return String(module?.name || module?.title || module?.moduleName || `Module ${index + 1}`).trim()
}

function getTodayWorkModuleLabel(module = {}, index = 0) {
  const moduleName = getCourseModuleName(module, index)
  const fallbackName = `Module ${index + 1}`

  if (!moduleName || moduleName === fallbackName) {
    return fallbackName
  }

  return `${fallbackName} - ${moduleName}`
}

function getCourseSubmodules(module = {}) {
  const source = module && typeof module === 'object' ? module : {}

  return Array.isArray(source.submodules)
    ? source.submodules
    : Array.isArray(source.submodels)
      ? source.submodels
      : Array.isArray(source.subModules)
        ? source.subModules
        : []
}

function getCourseSubmoduleName(submodule = {}, index = 0) {
  return String(
    submodule?.name ||
    submodule?.title ||
    submodule?.submoduleName ||
    `Submodule ${index + 1}`,
  ).trim()
}

function getFacultyBatchProgressStudents(batch = {}, course = {}, students = [], backfillRecords = [], options = {}) {
  const includeCompleted = options?.includeCompleted === true
  const batchId = String(batch?.batchId || batch?.id || '').trim().toLowerCase()
  const batchName = normalizeCourseKey(batch?.batchName || batch?.code || '')
  const courseId = String(course?.id || course?.courseId || '').trim().toLowerCase()
  const courseName = normalizeCourseKey(course?.name || course?.courseName || '')
  let currentCycleId = String(batch?.currentCycleId || batch?.activeCycleId || '').trim().toLowerCase()
  if (!includeCompleted && !currentCycleId) {
    const currentCycleEnrollment = (Array.isArray(students) ? students : []).map((student) => (
      getCourseEnrollmentForStudent(student, course, batch)
    )).find((enrollment) => (
      enrollment &&
      String(enrollment?.status || '').toUpperCase() === 'ACTIVE' &&
      enrollment?.batchCycleId &&
      !enrollment?.courseCompletedAt &&
      Number(enrollment?.courseProgress || 0) < 100
    ))
    currentCycleId = String(currentCycleEnrollment?.batchCycleId || '').trim().toLowerCase()
  }

  const scopedStudents = (Array.isArray(students) ? students : []).filter((student) => {
    // Lifecycle rows already include the authoritative batch-report result.
    // Do not re-check them with the older student snapshot, otherwise a
    // completed student can be added back to the active batch list.
    if (!includeCompleted && student?._facultyLifecycle === 'COMPLETED') return false
    if (!includeCompleted && !student?._facultyLifecycle && isFacultyStudentCourseComplete(student, course, batch)) return false
    const enrollment = getCourseEnrollmentForStudent(student, course, batch)
    const context = resolveFacultyBatchContextForStudent(student, backfillRecords)
    if (!includeCompleted && currentCycleId) {
      if (!enrollment || String(enrollment?.batchCycleId || '').trim().toLowerCase() !== currentCycleId
        || String(enrollment?.status || '').toUpperCase() !== 'ACTIVE') return false
    }
    // Direct assignment fields on the student are authoritative. Profile
    // context is only a legacy fallback and must not move a student to a
    // different batch or course.
    const studentCourseId = String(enrollment?.courseId || student?.courseId || context?.courseId || '').trim().toLowerCase()
    const studentCourseName = normalizeCourseKey(enrollment?.courseName || student?.courseInterested || student?.courseName || student?.course?.name || context?.courseName || '')
    const studentBatchId = String(enrollment?.batchId || enrollment?.batchEntryId || student?.batchId || student?.batchEntryId || context?.batchId || '').trim().toLowerCase()
    const studentBatchName = normalizeCourseKey(enrollment?.batchName || enrollment?.batch || student?.batchName || student?.batch || context?.batchName || '')

    // Branch-course ids and master-course ids can differ even though they
    // represent the same course. Prefer an id match when available, but keep
    // the course name as the compatibility key so assigned students are not
    // hidden when the two APIs use different course identifiers.
    const matchesCourse = !courseId && !courseName
      ? true
      : Boolean(
        (courseId && studentCourseId && studentCourseId === courseId) ||
        (courseName && studentCourseName && studentCourseName === courseName) ||
        (!studentCourseId && courseName && studentCourseName === courseName),
      )
    if (!matchesCourse) return false

    // Once a real batch ID exists, it is the only valid relationship. A
    // duplicate batch name must never make a student appear in another batch.
    // Some branch APIs expose the internal batch row id while student records
    // store the public batch code, so a matching batch name is a safe fallback.
    if (batchId) {
      return studentBatchId === batchId || Boolean(batchName && studentBatchName === batchName)
    }

    return Boolean(batchName && studentBatchName && studentBatchName === batchName)
  }).map((student) => {
    const enrollment = getCourseEnrollmentForStudent(student, course, batch)
    if (!enrollment || enrollment === student) return student

    // The parent student row can represent a different primary course. Once
    // this batch/course is selected, all table metrics must come from its
    // enrollment rather than leaking the primary course progress.
    return {
      ...student,
      ...enrollment,
      id: student?.id || enrollment?.id,
      studentId: student?.studentId || enrollment?.studentId,
      studentName: student?.studentName || enrollment?.studentName,
      emailAddress: student?.emailAddress || enrollment?.emailAddress,
      mobileNumber: student?.mobileNumber || enrollment?.mobileNumber,
      courseEnrollments: student?.courseEnrollments,
      courseId: enrollment?.courseId || course?.id || student?.courseId,
      courseName: enrollment?.courseName || enrollment?.course?.name || course?.name || student?.courseName,
      batchId: enrollment?.batchId || enrollment?.batchEntryId || batch?.batchId || batch?.id || student?.batchId,
      batchName: enrollment?.batchName || enrollment?.batch || batch?.batchName || student?.batchName,
    }
  })

  return dedupeStudentsWithinBatch(scopedStudents)
}

function isDiscontinuedStudent(student = {}) {
  return Boolean(
    student?.isDiscontinued
    || String(student?.discontinuationStatus || '').toUpperCase() === 'APPROVED'
  )
}

function normalizeFacultyBatchWeekType(batch = {}) {
  const rawValue = [
    batch?.weekType,
    batch?.weekdayType,
    batch?.scheduleType,
    batch?.classSchedule,
    batch?.batchType,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toUpperCase()

  if (rawValue.includes('WEEKEND')) return 'WEEKEND'
  if (rawValue.includes('WEEKDAY')) return 'WEEKDAY'
  return ''
}

function isAttendanceDayForBatch(batch = {}, date = new Date()) {
  const weekType = normalizeFacultyBatchWeekType(batch)
  if (!weekType) return true

  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Calcutta',
  }).format(date)
  const isWeekend = weekday === 'Sat' || weekday === 'Sun'
  return weekType === 'WEEKEND' ? isWeekend : !isWeekend
}

function getCourseFromSource(source = {}) {
  if (!source) return null

  const course = source.course || source
  const branchCourseId = String(
    course?.branchCourseId ||
    source?.branchCourseId ||
    course?.branchCourse?.id ||
    source?.branchCourse?.id ||
    '',
  ).trim()
  const courseId = String(
    course?.courseId ||
    source?.courseId ||
    course?.id ||
    '',
  ).trim()
  const courseName = String(course?.name || course?.courseName || source?.courseName || '').trim()
  const resolvedId = branchCourseId || courseId || courseName

  if (!resolvedId && !courseName) return null

  return {
    ...course,
    id: resolvedId || courseName,
    branchCourseId,
    courseId,
    courseName: courseName || courseId || 'Course',
  }
}

function getCourseFinalFee(course = {}) {
  const actualFees = parseCourseNumber(course.actualFees)
  const registrationFees = parseCourseNumber(course.registrationFees)
  const discount = parseCourseNumber(course.discount)

  if ([actualFees, registrationFees, discount].every(Number.isFinite)) {
    return formatCourseAmount(Math.max(actualFees + registrationFees - discount, 0))
  }

  return String(course.afterDiscount || course.finalFee || '').trim() || '-'
}

function formatCoursePercentage(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return '-'
  return normalized.endsWith('%') ? normalized : `${normalized}%`
}

function getEqualSplitPercentageValue(totalItems = 0) {
  const count = Math.max(1, Number(totalItems) || 1)
  return Number((100 / count).toFixed(2))
}

function getEqualSplitPercentageLabel(index = 0, totalItems = 0) {
  const count = Math.max(1, Number(totalItems) || 1)
  const safeIndex = Math.min(Math.max(0, Number(index) || 0), count - 1)
  const value = getEqualSplitPercentageValue(count)
  return safeIndex >= 0 ? `${value}%` : '-'
}

function getModulePercentage(module = {}, moduleIndex = 0, totalModules = 0) {
  const directPercentage = formatCoursePercentage(module?.percentage ?? module?.weight ?? module?.share)
  if (directPercentage !== '-') return directPercentage

  return getEqualSplitPercentageLabel(moduleIndex, totalModules)
}

function cloneFacultyEditSubmodule(submodule = {}, subIndex = 0) {
  const source = submodule && typeof submodule === 'object' ? submodule : {}

  return {
    ...source,
    id: String(source.id || `submodule-${subIndex + 1}`),
    name: String(source.name || source.title || source.submoduleName || `Submodule ${subIndex + 1}`).trim(),
    percentage: String(source.percentage ?? source.weight ?? '').trim(),
  }
}

function cloneFacultyEditModule(module = {}, moduleIndex = 0) {
  const source = module && typeof module === 'object' ? module : {}
  const submoduleSource = Array.isArray(source.submodules)
    ? source.submodules
    : Array.isArray(source.subModules)
      ? source.subModules
      : Array.isArray(source.submodels)
        ? source.submodels
        : Array.isArray(source.subModels)
          ? source.subModels
          : []

  return {
    ...source,
    id: String(source.id || `module-${moduleIndex + 1}`),
    name: String(source.name || source.title || source.moduleName || `Module ${moduleIndex + 1}`).trim(),
    percentage: String(source.percentage ?? source.weight ?? '').trim(),
    submodules: submoduleSource.map((submodule, subIndex) => cloneFacultyEditSubmodule(submodule, subIndex)),
  }
}

function cloneFacultyEditModules(course = {}) {
  return getCourseModels(course).map((module, moduleIndex) => cloneFacultyEditModule(module, moduleIndex))
}

function buildFacultyCourseUpdatePayload(course = {}, modules = []) {
  return {
    courseCode: String(course?.courseCode || '').trim(),
    name: String(course?.name || course?.courseName || '').trim(),
    description: String(course?.description || '').trim(),
    mode: String(course?.mode || '').trim(),
    duration: String(course?.duration ?? '').trim(),
    hours: String(course?.hours ?? '').trim(),
    actualFees: String(course?.actualFees ?? '').trim(),
    registrationFees: String(course?.registrationFees ?? '').trim(),
    discount: String(course?.discount ?? '').trim(),
    status: String(course?.status || 'Active').trim() || 'Active',
    models: modules,
    courseModels: modules,
    modules,
  }
}

function formatNotificationTime(createdAt) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} mins ago`
  if (diffHours < 24) return `${diffHours} hrs ago`
  if (diffDays < 7) return `${diffDays} days ago`

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatNotificationGroupLabel(createdAt) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return 'Today'

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

  if (todayKey === dateKey) return 'Today'

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`
  if (dateKey === yesterdayKey) return 'Yesterday'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function isWithinSelectedDateRange(createdAt, range) {
  if (range === 'all') return true

  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return false

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const itemStartOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((startOfToday.getTime() - itemStartOfDay.getTime()) / 86400000)

  if (range === 'today') return diffDays === 0
  if (range === 'yesterday') return diffDays === 1
  if (range === '7d') return diffDays >= 0 && diffDays < 7
  if (range === '30d') return diffDays >= 0 && diffDays < 30

  return true
}

function getFacultyNotificationIcon(notification = {}) {
  const normalizedKind = String(notification.kind || '').trim().toLowerCase()
  const normalizedTitle = String(notification.title || '').trim().toLowerCase()

  if (
    normalizedTitle.includes('payment due alert') ||
    normalizedKind.includes('payment-due') ||
    normalizedKind.includes('payment due')
  ) {
    return AlertTriangle
  }

  if (normalizedKind.includes('invite') || normalizedKind.includes('mail')) {
    return Mail
  }

  if (normalizedKind.includes('progress-status')) {
    return AlertTriangle
  }

  if (
    normalizedKind.includes('login') ||
    normalizedKind.includes('assigned') ||
    normalizedKind.includes('active') ||
    normalizedKind.includes('course-edit')
  ) {
    return CheckCircle2
  }

  return Bell
}

function normalizeFacultyNotification(notification = {}) {
  const source = notification && typeof notification === 'object' ? notification : {}
  const kind = String(source.kind || 'general').trim() || 'general'
  const createdAt =
    String(source.createdAt || source.createdOn || source.updatedAt || '').trim() ||
    new Date().toISOString()
  const isCourseEdit = kind.includes('course-edit')
  const isProgressStatus = kind.includes('progress-status')

  return {
    id: String(source.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    kind,
    tone:
      String(source.tone || (kind.includes('invite') ? 'amber' : kind.includes('login') ? 'green' : isCourseEdit ? 'amber' : 'blue'))
        .trim() || 'blue',
    title: String(source.title || 'Notification').trim(),
    message: String(source.message || '').trim(),
    actionLabel: String(source.actionLabel || '').trim() || 'View',
    categoryLabel: String(source.categoryLabel || (isProgressStatus ? String(source.statusLabel || 'Progress Status').trim() || 'Progress Status' : isCourseEdit ? 'Course Edit' : 'Faculty')).trim() || 'Faculty',
    createdAt,
    time: formatNotificationTime(createdAt),
    read: Boolean(source.read),
    summary: String(source.summary || '').trim(),
    studentId: String(source.studentId || '').trim(),
    studentName: String(source.studentName || '').trim(),
    courseProgress: String(source.courseProgress || '').trim(),
    paidProgress: String(source.paidProgress || '').trim(),
    statusKey: String(source.statusKey || '').trim(),
    statusLabel: String(source.statusLabel || '').trim(),
    recipientLabel: String(source.recipientLabel || '').trim(),
    requestReason: String(source.requestReason || '').trim(),
    facultySkillAssignmentId: String(source.facultySkillAssignmentId || '').trim(),
  }
}

function groupFacultyNotifications(notifications = []) {
  const groups = new Map()
  const safeNotifications = Array.isArray(notifications) ? notifications.filter(Boolean) : []
  const orderedNotifications = safeNotifications.sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )

  orderedNotifications.forEach((notification) => {
    const label = formatNotificationGroupLabel(notification.createdAt)
    if (!groups.has(label)) {
      groups.set(label, [])
    }

    groups.get(label).push(notification)
  })

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }))
}

function FacultyNotificationGroup({ label, items, onViewNotification }) {
  return (
    <section className="faculty-notifications-group">
      <p className="faculty-notifications-group-label">{label}</p>
      <div className="faculty-notifications-group-list">
        {items.map((notification, index) => {
          const Icon = getFacultyNotificationIcon(notification)
          const isWeekOffRejection = notification.title === 'Week-Off Request Rejected'
          const parsedReason = notification.requestReason || (isWeekOffRejection ? notification.message.match(/\s*Reason:\s*(.*)$/i)?.[1]?.trim() : '')
          const notificationMessage = parsedReason ? notification.message.replace(/\s*Reason:\s*.*$/i, '').trim() : notification.message

          return (
            <article
              key={`${notification.id || notification.kind || notification.title}-${index}`}
              className={`faculty-notification-card ${notification.read ? 'is-read' : 'is-unread'}`.trim()}
            >
              <div className="faculty-notification-copy">
                <div className="faculty-notification-title-row">
                  <span className={`faculty-notification-icon tone-${notification.tone}`} aria-hidden="true">
                    <Icon size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                  </span>
                  <h3>{notification.title}</h3>
                  <small>{notification.time}</small>
                </div>
                <p>{notificationMessage}</p>
                {isWeekOffRejection && parsedReason ? <p className="faculty-notification-reason"><strong>Reason:</strong> {parsedReason}</p> : null}
                {String(notification.kind || '').includes('progress-status') ? (
                  <div className="faculty-notification-progress-details">
                    <p><strong>Student ID:</strong> {notification.studentId || '-'}</p>
                    <p><strong>Student Name:</strong> {notification.studentName || '-'}</p>
                    <p><strong>Course Progress:</strong> {notification.courseProgress ? `${notification.courseProgress}%` : '-'}</p>
                    <p><strong>Paid Progress:</strong> {notification.paidProgress ? `${notification.paidProgress}%` : '-'}</p>
                    <p><strong>Status:</strong> {notification.statusLabel || '-'}</p>
                    <p><strong>Summary:</strong> {notification.summary || notification.message}</p>
                  </div>
                ) : null}
              </div>

              <div className="faculty-notification-meta">
                <span className={`faculty-notification-chip tone-${notification.tone}`}>
                  {notification.categoryLabel}
                </span>
                <button
                  type="button"
                  className="faculty-notification-view-btn"
                  onClick={() => onViewNotification(notification)}
                >
                  View
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
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

function FacultyDashboardSection({ title, description, actions, className = '', children }) {
  return (
    <section className={`branch-dashboard-section ${className}`.trim()}>
      <div className="branch-dashboard-section-heading">
        <div className="branch-dashboard-section-heading-copy">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="branch-dashboard-section-heading-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

function FacultyDashboardLoadingCards() {
  return <div className="faculty-dashboard-overview-grid" aria-label="Loading dashboard overview">
    {[1, 2].map((item) => <div key={item} className="faculty-dashboard-overview-card faculty-dashboard-overview-card--loading" />)}
  </div>
}

function FacultyBatchOverviewCard({ batch, batchOptions = [], selectedBatchId = 'all', onBatchChange }) {
  const [period, setPeriod] = useState('daily')
  const formatPercent = (value) => Number.isFinite(Number(value)) ? `${Number(value)}%` : '—'
  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const chartBatches = [batch]
  const getAttendanceValue = (row, metric = 'present') => {
    const status = String(row?.status || '').toUpperCase()
    if (status === 'UNMARKED' || status === 'NOT_APPLICABLE') return null

    const present = row?.presentPercentage ?? row?.percentage
    const absent = row?.absentPercentage
    const absentCount = Number(row?.absent)
    const value = metric === 'absent'
      ? (Number.isFinite(Number(absent)) && Number(absent) > 0
        ? absent
        : absentCount > 0 ? absent : null)
      : present

    return Number.isFinite(Number(value))
      ? Math.max(0, Math.min(100, Number(value)))
      : null
  }
  const getSeries = (entry) => {
    if (period === 'daily') return dayOrder.map((day) => (entry?.weekly || []).find((item) => item.day === day) || { day, status: 'UNMARKED' })
    if (period === 'weekly') return Array.isArray(entry?.weeklyByMonth) ? entry.weeklyByMonth.slice(0, 5) : []
    return Array.isArray(entry?.monthlyYear) ? entry.monthlyYear.slice(6, 12) : []
  }
  const chartRows = getSeries(chartBatches[0]).map((item, index) => ({
    label: period === 'daily' ? item.day : (item.label || `Period ${index + 1}`),
    values: chartBatches.flatMap((entry) => {
      const row = getSeries(entry)[index]
      return ['present', 'absent'].map((metric) => ({ metric, value: getAttendanceValue(row, metric), detail: getAttendanceValue(row, metric) != null ? `${row.present} present · ${row.absent} absent` : row?.status === 'PARTIAL' ? 'Attendance not fully marked' : row?.status === 'NOT_APPLICABLE' ? 'Not scheduled' : 'Attendance not marked' }))
    }),
  }))
  const hasChartData = chartRows.some((row) => row.values.some((item) => Number.isFinite(Number(item.value))))
  return <article className="faculty-dashboard-overview-card">
    <div className="faculty-dashboard-batch-heading"><div><p className="faculty-dashboard-card-kicker">{batch.courseName || (selectedBatchId === 'all' ? 'All assigned courses' : 'Course')}</p><h3>{batch.batchName || (selectedBatchId === 'all' ? 'All Batches' : batch.batchId || 'Batch')}</h3></div><div className="faculty-dashboard-batch-selector"><label htmlFor="faculty-dashboard-batch-select">Batch</label><select id="faculty-dashboard-batch-select" value={selectedBatchId} onChange={(event) => onBatchChange?.(event.target.value)}><option value="all">All Batches</option>{batchOptions.map((option) => <option key={option.id} value={option.id}>{option.batchName || option.batchId}</option>)}</select></div></div>
    <div className="faculty-dashboard-batch-meta"><span>Students <strong>{batch.studentCount}</strong></span>{batch.timing ? <span>Timing <strong>{batch.timing}</strong></span> : null}{batch.mode ? <span>Mode <strong>{batch.mode}</strong></span> : null}</div>
    <div className="faculty-dashboard-period-tabs" role="tablist" aria-label={`${batch.batchName} attendance period`}>{['daily', 'weekly', 'monthly'].map((item) => <button key={item} type="button" role="tab" aria-selected={period === item} className={period === item ? 'is-active' : ''} onClick={() => setPeriod(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
    {hasChartData ? <><div className="faculty-dashboard-chart-legend"><span><i className="faculty-dashboard-legend-present" />Present</span><span><i className="faculty-dashboard-legend-absent" />Absent</span></div><div className="faculty-dashboard-bar-chart" role="img" aria-label={`${period} present and absent attendance percentage chart for ${batch.batchName || 'all assigned batches'}`}><div className="faculty-dashboard-bar-axis"><span>100%</span><span>50%</span><span>0%</span></div><div className="faculty-dashboard-bars faculty-dashboard-bars--grouped">{chartRows.map((row) => <div key={row.label} className="faculty-dashboard-bar-group"><div className="faculty-dashboard-bar-group-columns">{row.values.map((item, index) => <div key={`${row.label}-${item.metric}`} className={`faculty-dashboard-bar-column faculty-dashboard-bar-column--${item.metric}`} title={`${item.metric === 'present' ? 'Present' : 'Absent'}: ${item.value == null ? item.detail : `${formatPercent(item.value)} · ${item.detail}`}`}><strong>{item.value == null ? '—' : formatPercent(item.value)}</strong><div className="faculty-dashboard-bar-track"><span style={{ height: `${Math.max(0, Math.min(100, Number(item.value) || 0))}%` }} /></div></div>)}</div><small>{row.label}</small></div>)}</div></div></> : <p className="faculty-dashboard-unmarked">{batch.id === 'all' ? 'Attendance not marked' : 'Attendance not marked'}</p>}
  </article>
}

function FacultyDashboardOverview({ overview, loading, error, onRetry, todayAttendance, todayAttendanceLoading, todayAttendanceError }) {
  const [selectedBatchId, setSelectedBatchId] = useState('all')
  const [selectedProgressBatchId, setSelectedProgressBatchId] = useState('all')
  const formatPercent = (value) => Number.isFinite(Number(value)) ? `${Number(value)}%` : '—'
  if (loading) return <><FacultyDashboardSection title="Attendance" description="Batch-wise attendance from recorded student attendance."><FacultyDashboardLoadingCards /></FacultyDashboardSection><FacultyDashboardSection title="Overall Progress" description="Average course progress across students in each assigned batch."><FacultyDashboardLoadingCards /></FacultyDashboardSection></>
  if (error) return <FacultyDashboardSection title="Dashboard overview"><div className="faculty-dashboard-overview-empty"><strong>Dashboard data unavailable</strong><p>{error}</p><button type="button" onClick={onRetry}>Retry</button></div></FacultyDashboardSection>
  const batches = Array.isArray(overview?.batches) ? overview.batches : []
  const selectedBatch = selectedBatchId === 'all' ? overview?.allBatches : batches.find((batch) => String(batch.id) === String(selectedBatchId))
  const selectedProgressBatch = selectedProgressBatchId === 'all' ? overview?.allBatches : batches.find((batch) => String(batch.id) === String(selectedProgressBatchId))
  const progressChartBatches = selectedProgressBatchId === 'all' ? batches : selectedProgressBatch ? [selectedProgressBatch] : []
  const progressBars = progressChartBatches.map((batch) => ({
    id: batch.id || batch.batchId,
    label: batch.batchName || batch.batchId || 'Batch',
    percentage: batch.progress?.percentage == null || batch.progress?.percentage === '' ? Number.NaN : Number(batch.progress.percentage),
  }))
  const hasProgressChart = progressBars.some((bar) => Number.isFinite(bar.percentage))
  const progressStudentsIncluded = selectedProgressBatch?.progress?.studentsIncluded ?? selectedProgressBatch?.studentCount ?? 0
  if (!batches.length) return <FacultyDashboardSection title="Attendance"><div className="faculty-dashboard-overview-empty"><strong>No batches assigned</strong><p>There are no active batches assigned to your faculty account.</p></div></FacultyDashboardSection>
  return <><FacultyDashboardSection title="Attendance" description="Select a batch to view its attendance, or keep All Batches for the combined attendance of every assigned batch."><div className="faculty-dashboard-attendance-dashboard-layout"><div className="faculty-dashboard-single-card faculty-dashboard-single-card--attendance"><FacultyBatchOverviewCard batch={selectedBatch || { studentCount: 0, weekly: [], weeklyByMonth: [], monthlyYear: [] }} batchOptions={batches} selectedBatchId={selectedBatchId} onBatchChange={setSelectedBatchId} /></div>{todayAttendanceLoading ? <aside className="attendance-insights faculty-dashboard-today-attendance-loading"><p>Loading today's attendance…</p></aside> : todayAttendanceError ? <aside className="attendance-insights faculty-dashboard-today-attendance-loading"><p>{todayAttendanceError}</p></aside> : todayAttendance ? <BranchAttendanceInsights data={todayAttendance} /> : null}</div></FacultyDashboardSection><FacultyDashboardSection title="Overall Progress" description="Progress across every active student in the selected batch."><div className="faculty-dashboard-single-card"><article className="faculty-dashboard-progress-card"><div className="faculty-dashboard-batch-heading"><div><p className="faculty-dashboard-card-kicker">{selectedProgressBatch?.courseName || (selectedProgressBatchId === 'all' ? 'All assigned courses' : 'Course')}</p><h3>{selectedProgressBatch?.batchName || (selectedProgressBatchId === 'all' ? 'All Batches' : selectedProgressBatch?.batchId || 'Batch')}</h3></div><div className="faculty-dashboard-batch-selector"><label htmlFor="faculty-dashboard-progress-select">Batch</label><select id="faculty-dashboard-progress-select" value={selectedProgressBatchId} onChange={(event) => setSelectedProgressBatchId(event.target.value)}><option value="all">All Batches</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchName || batch.batchId}</option>)}</select></div></div><div className="faculty-dashboard-batch-meta"><span>Students <strong>{selectedProgressBatch?.studentCount ?? '—'}</strong></span>{selectedProgressBatch?.batchId ? <span>Batch ID <strong>{selectedProgressBatch.batchId}</strong></span> : null}</div>{selectedProgressBatch?.studentCount === 0 ? <p className="faculty-dashboard-unmarked">No students assigned to this batch</p> : hasProgressChart ? <div className="faculty-dashboard-progress-chart-wrap"><div className="faculty-dashboard-progress-chart" role="img" aria-label={`Overall progress percentage chart for ${selectedProgressBatchId === 'all' ? 'all assigned batches' : selectedProgressBatch?.batchName || 'selected batch'}`}><div className="faculty-dashboard-progress-axis" aria-hidden="true"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="faculty-dashboard-progress-bars">{progressBars.map((bar) => { const percentage = Number.isFinite(bar.percentage) ? Math.max(0, Math.min(100, bar.percentage)) : null; return <div key={bar.id} className="faculty-dashboard-progress-bar-item" title={`${bar.label}: ${percentage == null ? 'Progress not recorded' : `${formatPercent(percentage)} overall progress`}`}><strong>{percentage == null ? '—' : formatPercent(percentage)}</strong><div className="faculty-dashboard-progress-bar-track"><span style={{ height: `${percentage || 0}%` }} /></div><small>{bar.label}</small></div> })}</div></div><p className="faculty-dashboard-progress-note">Based on {progressStudentsIncluded} student{progressStudentsIncluded === 1 ? '' : 's'}</p></div> : <p className="faculty-dashboard-unmarked">Progress not recorded</p>}</article></div></FacultyDashboardSection></>
}

const FACULTY_DASHBOARD_CLASS_STATUSES = new Set([
  'CLASS', 'SCHEDULED', 'COMPLETED', 'REASSIGNED', 'COMBINED', 'RESCHEDULED', 'RESCHEDULED_ORIGINAL',
])

function facultyDashboardDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function facultyDashboardParseDate(value) {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function facultyDashboardEventStatus(event = {}) {
  return String(event?.code || event?.type || event?.status || '').trim().toUpperCase().replace(/[- ]/g, '_')
}

function formatFacultyDashboardTime(value, period = '') {
  const raw = String(value || '').trim().toUpperCase()
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/)
  if (!match) return String(value || '').trim()

  let hour = Number(match[1])
  const minutes = match[2] || '00'
  const meridiem = match[3] || String(period || '').trim().toUpperCase()

  if (meridiem === 'AM' || meridiem === 'PM') {
    hour = hour % 12 || 12
  } else {
    const inferredMeridiem = hour >= 12 ? 'PM' : 'AM'
    return `${String(hour % 12 || 12).padStart(2, '0')}:${minutes} ${inferredMeridiem}`
  }

  return `${String(hour).padStart(2, '0')}:${minutes} ${meridiem}`
}

function facultyDashboardEventTiming(event = {}) {
  const start = String(event?.startTime || event?.fromTime || '').trim()
  const end = String(event?.endTime || event?.toTime || '').trim()
  if (start && end) {
    return `${formatFacultyDashboardTime(start, event?.startPeriod)} – ${formatFacultyDashboardTime(end, event?.endPeriod)}`
  }
  return String(event?.batchTiming || '').trim() || 'Scheduled time'
}

function facultyDashboardEventModule(event = {}) {
  const moduleValue = event?.module || event?.currentModule || event?.moduleDetails || event?.batch?.module || event?.course?.module
  const moduleName = typeof moduleValue === 'object'
    ? moduleValue?.name || moduleValue?.title || moduleValue?.moduleName || moduleValue?.moduleTitle
    : moduleValue
  const topicValue = event?.topic || event?.currentTopic || event?.lesson || event?.currentLesson || event?.submodule || event?.currentSubmodule
  const topicName = typeof topicValue === 'object'
    ? topicValue?.name || topicValue?.title || topicValue?.topicName || topicValue?.submoduleName
    : topicValue

  return String(
    event?.moduleName
    || event?.moduleTitle
    || event?.currentModuleName
    || moduleName
    || event?.topicName
    || topicName
    || event?.currentSubmoduleName
    || event?.submoduleName
    || event?.batch?.moduleName
    || event?.batch?.moduleTitle
    || event?.batch?.currentModuleName
    || event?.batch?.topicName
    || event?.batch?.currentTopic
    || event?.courseBatch?.moduleName
    || event?.session?.moduleName
    || '',
  ).trim()
}

function facultyDashboardWorkEntryHasProgress(entry = {}) {
  const statuses = [
    entry?.submoduleStatus,
    entry?.subModuleStatus,
    entry?.progressStatus,
    ...(Array.isArray(entry?.submodules) ? entry.submodules.map((item) => item?.status || item?.submoduleStatus || item?.progressStatus) : []),
    ...(Array.isArray(entry?.submoduleProgress) ? entry.submoduleProgress.map((item) => item?.status || item?.submoduleStatus || item?.progressStatus || item?.completionStatus) : []),
    ...(Array.isArray(entry?.studentResults) ? entry.studentResults.flatMap((item) => (Array.isArray(item?.submodules) ? item.submodules : []).map((submodule) => submodule?.completionStatus || submodule?.status)) : []),
  ]
  const statusMap = entry?.submoduleStatuses && typeof entry.submoduleStatuses === 'object'
    ? Object.values(entry.submoduleStatuses).flatMap((value) => (value && typeof value === 'object' ? Object.values(value) : [value]))
    : []

  return [...statuses, ...statusMap].some((value) => ['Completed', 'In Progress'].includes(normalizeSubmoduleProgressStatus(value)))
}

function facultyDashboardTodayWorkModule(event = {}, entries = []) {
  const eventBatchId = normalizeWorkStudentId(event?.batchId || event?.batchRecordId || '')
  const eventBatchName = normalizeWorkStudentId(event?.batchName || '')
  const eventCourseId = normalizeWorkStudentId(event?.courseId || '')
  const eventCourseName = normalizeWorkStudentId(event?.courseName || event?.courseCode || '')
  const eventDate = String(event?.date || '').slice(0, 10)

  const matchingEntries = (Array.isArray(entries) ? entries : [])
    .filter((entry) => {
      if (!entry?.moduleName || !facultyDashboardWorkEntryHasProgress(entry)) return false
      const entryDate = String(entry?.workDate || entry?.date || '').slice(0, 10)
      if (eventDate && entryDate && eventDate !== entryDate) return false

      const entryBatchId = normalizeWorkStudentId(entry?.batchId || entry?.batchEntryId || '')
      const entryBatchName = normalizeWorkStudentId(entry?.batchName || '')
      const entryCourseId = normalizeWorkStudentId(entry?.courseId || '')
      const entryCourseName = normalizeWorkStudentId(entry?.courseName || '')
      const batchMatches = (eventBatchId && entryBatchId && eventBatchId === entryBatchId)
        || (eventBatchName && entryBatchName && eventBatchName === entryBatchName)
      const courseMatches = !eventCourseId || !entryCourseId || eventCourseId === entryCourseId
        || (eventCourseName && entryCourseName && eventCourseName === entryCourseName)
      return batchMatches && courseMatches
    })
    .sort((left, right) => new Date(right?.updatedAt || right?.createdAt || 0).getTime() - new Date(left?.updatedAt || left?.createdAt || 0).getTime())

  return String(matchingEntries[0]?.moduleName || '').trim()
}

function facultyDashboardStatusClass(value = '') {
  const status = String(value || '').trim().toLowerCase()
  if (status.includes('complete')) return 'is-completed'
  if (status.includes('progress')) return 'is-progress'
  if (status.includes('cancel')) return 'is-cancelled'
  return 'is-scheduled'
}

function FacultyDashboardScheduleSections({ batches = [], todayWorkEntries = [], facultyProfile = null, loading: batchesLoading = false, onViewAll }) {
  const today = facultyDashboardDateKey()
  const [calendar, setCalendar] = useState(null)
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const range = useMemo(() => {
    const assignedBatches = Array.isArray(facultyProfile?.batchEntries) ? facultyProfile.batchEntries : []
    const starts = assignedBatches.map((batch) => batch?.courseStartDate || batch?.startDate).filter(Boolean).sort()
    const ends = assignedBatches.map((batch) => batch?.courseEndDate || batch?.endDate).filter(Boolean).sort()
    const fallbackEnd = new Date()
    fallbackEnd.setFullYear(fallbackEnd.getFullYear() + 1)
    return {
      start: starts[0] || today,
      end: ends.at(-1) || facultyDashboardDateKey(fallbackEnd),
    }
  }, [facultyProfile, today])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const nextCalendar = await getFacultyCalendar({ startDate: range.start, endDate: range.end })
      setCalendar(nextCalendar || { events: [] })
    } catch (requestError) {
      setCalendar(null)
      setError(requestError?.message || 'Unable to load your schedule.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const refresh = () => void load()
    window.addEventListener('cispro:faculty-dashboard-refresh', refresh)
    return () => window.removeEventListener('cispro:faculty-dashboard-refresh', refresh)
  }, [range.end, range.start])

  const events = useMemo(
    () => (Array.isArray(calendar?.events) ? calendar.events : []).filter((event) => String(event?.date || '').slice(0, 10)),
    [calendar],
  )
  const classesToday = useMemo(
    () => events.filter((event) => String(event?.date || '').slice(0, 10) === today && FACULTY_DASHBOARD_CLASS_STATUSES.has(facultyDashboardEventStatus(event))),
    [events, today],
  )
  const selectedEvents = useMemo(
    () => events.filter((event) => String(event?.date || '').slice(0, 10) === selectedDate && FACULTY_DASHBOARD_CLASS_STATUSES.has(facultyDashboardEventStatus(event))),
    [events, selectedDate],
  )
  const monthDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))]
  }, [month])
  const eventDates = useMemo(() => new Set(events.map((event) => String(event?.date || '').slice(0, 10))), [events])
  const eventTooltipsByDate = useMemo(() => {
    const grouped = new Map()
    events.forEach((event) => {
      const dateKey = String(event?.date || '').slice(0, 10)
      if (!dateKey) return
      const dateLabel = facultyDashboardParseDate(dateKey)?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) || dateKey
      const details = [
        dateLabel,
        facultyDashboardEventTiming(event),
        event.courseName || event.courseCode || 'Course',
        `Batch: ${event.batchName || event.batchId || '—'}`,
      ].join('\n')
      grouped.set(dateKey, [...(grouped.get(dateKey) || []), details])
    })
    return new Map(Array.from(grouped.entries()).map(([dateKey, values]) => [dateKey, values.join('\n\n')]))
  }, [events])
  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div className="faculty-dashboard-schedule-sections">
      <FacultyDashboardSection
        title={<span className="faculty-dashboard-section-title-with-icon"><CalendarDays size={18} aria-hidden="true" />Today’s Classes</span>}
        description="Classes scheduled for the current date."
        actions={<button type="button" className="faculty-dashboard-view-all" onClick={onViewAll}>View All <span aria-hidden="true">→</span></button>}
      >
        {loading ? <div className="faculty-dashboard-schedule-loading">Loading today’s classes…</div> : error ? <div className="faculty-dashboard-overview-empty"><strong>Today’s classes unavailable</strong><p>{error}</p></div> : classesToday.length ? <div className="faculty-dashboard-class-table"><div className="faculty-dashboard-class-table-head"><span><Clock3 size={13} aria-hidden="true" />Time</span><span><BookOpen size={13} aria-hidden="true" />Course</span><span><Users size={13} aria-hidden="true" />Batch</span><span><Layers3 size={13} aria-hidden="true" />Module</span><span><CheckCircle2 size={13} aria-hidden="true" />Status</span></div>{classesToday.map((event, index) => { const status = event.status || event.code || 'Scheduled'; const todayWorkModule = facultyDashboardTodayWorkModule(event, todayWorkEntries); return <article className={`faculty-dashboard-class-item faculty-dashboard-class-item--accent-${index % 5}`} key={event.id || `${event.batchId || event.batchName}-${index}`}><strong><Clock3 size={15} aria-hidden="true" />{facultyDashboardEventTiming(event)}</strong><span><BookOpen size={15} aria-hidden="true" />{event.courseName || event.courseCode || 'Course'}</span><span><Users size={15} aria-hidden="true" />{event.batchName || event.batchId || '—'}</span><small><Layers3 size={14} aria-hidden="true" />{todayWorkModule || '—'}</small><em className={facultyDashboardStatusClass(status)}><CheckCircle2 size={13} aria-hidden="true" />{status}</em></article> })}</div> : <div className="faculty-dashboard-schedule-empty">No classes scheduled for today</div>}
      </FacultyDashboardSection>

      <FacultyDashboardSection title="My Batches" description="All batches assigned to you, including weekday and weekend batches.">
        {batchesLoading ? <div className="faculty-dashboard-schedule-loading">Loading assigned batches…</div> : batches.length ? <div className="faculty-dashboard-assigned-batches">{batches.map((batch) => <article className="faculty-dashboard-assigned-batch" key={batch.id || batch.batchId}><div><strong>{batch.batchName || batch.batchId || 'Batch'}</strong><span>{batch.course || batch.courseName || 'Course'}</span></div><dl><div><dt>Timing</dt><dd>{batch.timing || '—'}</dd></div><div><dt>Schedule</dt><dd>{batch.weekType || '—'}</dd></div><div><dt>Students</dt><dd>{Number.isFinite(Number(batch.students)) ? batch.students : '—'}</dd></div><div><dt>Status</dt><dd>{batch.status || '—'}</dd></div></dl></article>)}</div> : <div className="faculty-dashboard-schedule-empty">No batches assigned</div>}
      </FacultyDashboardSection>

      <FacultyDashboardSection title="My Schedule" description="Your schedule from the same faculty calendar used by My Calendar.">
        {loading ? <div className="faculty-dashboard-schedule-loading">Loading schedule…</div> : error ? <div className="faculty-dashboard-overview-empty"><strong>Schedule unavailable</strong><p>{error}</p></div> : <div className="faculty-dashboard-schedule-layout"><div className="faculty-dashboard-calendar-card"><div className="faculty-dashboard-calendar-head"><button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button><strong>{monthLabel}</strong><button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button></div><div className="faculty-dashboard-calendar-weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="faculty-dashboard-calendar-grid">{monthDays.map((date, index) => { if (!date) return <span key={`empty-${index}`} />; const dateKey = facultyDashboardDateKey(date); const tooltip = eventTooltipsByDate.get(dateKey) || ''; return <button type="button" key={dateKey} className={`${dateKey === selectedDate ? 'is-selected ' : ''}${dateKey === today ? 'is-today' : ''}`} onClick={() => setSelectedDate(dateKey)} data-tooltip={tooltip}>{date.getDate()}{eventDates.has(dateKey) ? <i aria-label="Scheduled event" /> : null}</button> })}</div></div><div className="faculty-dashboard-schedule-details"><span className="faculty-dashboard-card-kicker">{facultyDashboardParseDate(selectedDate)?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>{selectedEvents.length ? <div className="faculty-dashboard-class-list">{selectedEvents.map((event, index) => <article className="faculty-dashboard-class-item" key={event.id || `${event.batchId || event.batchName}-${index}`}><strong>{facultyDashboardEventTiming(event)}</strong><span>{event.courseName || event.courseCode || 'Course'}</span><small>Batch: {event.batchName || event.batchId || '—'}{facultyDashboardEventModule(event) ? ` · Module: ${facultyDashboardEventModule(event)}` : ''}</small></article>)}</div> : <div className="faculty-dashboard-schedule-empty">No classes scheduled</div>}</div></div>}
      </FacultyDashboardSection>
    </div>
  )
}

function OtherFacultyBatchesSection({ onOpenTemporaryWork, onAssignmentVisibility }) {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentView, setStudentView] = useState(null)
  const [calendarStudent, setCalendarStudent] = useState(null)
  const [studentLoading, setStudentLoading] = useState(false)
  const [studentError, setStudentError] = useState('')

  useEffect(() => {
    let active = true
    getFacultyTemporaryBatches()
      .then(rows => { if (active) { const nextRows = Array.isArray(rows) ? rows : []; setBatches(nextRows); onAssignmentVisibility?.(nextRows.length > 0) } })
      .catch(err => { if (active) { setError(err.message || 'Unable to load temporary batches'); onAssignmentVisibility?.(false) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onAssignmentVisibility])

  async function viewStudents(item) {
    setCalendarStudent(null)
    setStudentLoading(true)
    setStudentError('')
    try {
      const result = await getTemporaryBatchStudents(item.id)
      setStudentView({ ...result, item })
    } catch (err) {
      setStudentError(err.message || 'Unable to load students')
    } finally {
      setStudentLoading(false)
    }
  }

  useEffect(() => {
    const refreshTemporaryStudents = async () => {
      const sessionId = studentView?.item?.id
      if (!sessionId) return
      try {
        const result = await getTemporaryBatchStudents(sessionId)
        setStudentView((current) => current ? { ...result, item: current.item } : current)
      } catch {
        // Keep the current view if a background refresh fails.
      }
    }

    window.addEventListener('cispro:faculty-dashboard-refresh', refreshTemporaryStudents)
    return () => window.removeEventListener('cispro:faculty-dashboard-refresh', refreshTemporaryStudents)
  }, [studentView?.item?.id])

  const activeStudentSession = studentView?.session || studentView?.item || null
  const temporarySessionEditable = isTemporarySessionEditable(activeStudentSession)

  return <FacultyDashboardSection title="Other Faculty Batches" description="Temporary leave-related batches assigned to you for the current and upcoming dates.">
    {studentLoading ? (
      <div className="faculty-my-batches-empty"><strong>Loading students...</strong></div>
    ) : studentView ? (
      calendarStudent ? (
        <StudentCalendarPage
          studentId={calendarStudent.studentId || calendarStudent.id || ''}
          student={calendarStudent}
          useFacultyCalendar
          onBack={() => setCalendarStudent(null)}
        />
      ) : <div className="faculty-my-batches-student-view">
        <button type="button" className="faculty-other-batches-back-button" onClick={() => { setCalendarStudent(null); setStudentView(null) }}>← Back to Other Faculty Batches</button>
        <h3>{studentView.session?.batchName || studentView.item?.batchName}</h3>
        <p>{studentView.session?.courseName || studentView.item?.courseName || '-'} · {formatDisplayDate(studentView.session?.replacementDate || studentView.item?.effectiveDate)} · {formatClassTimeForDashboard(studentView.session?.replacementStartTime || studentView.item?.effectiveStartTime)} - {formatClassTimeForDashboard(studentView.session?.replacementEndTime || studentView.item?.effectiveEndTime)}</p>
        <div className="faculty-student-action-buttons faculty-other-batches-session-actions">
          <button type="button" className="faculty-today-work-trigger" disabled={!temporarySessionEditable} title={temporarySessionEditable ? 'Open Attendance' : 'Attendance opens during the assigned session time'} onClick={() => onOpenTemporaryWork?.(activeStudentSession, studentView.students, 'attendance')}>
            <span>▣</span>
            <span>Attendance</span>
          </button>
          <button type="button" className="faculty-today-work-trigger faculty-today-work-trigger--progress" disabled={!temporarySessionEditable} title={temporarySessionEditable ? "Open Today's Work" : "Today's Work opens during the assigned session time"} onClick={() => onOpenTemporaryWork?.(activeStudentSession, studentView.students, 'progress')}>
            <span>▣</span>
            <span>Today's Work</span>
          </button>
        </div>
        {studentView.students?.length ? (
          <div className="branch-dashboard-table-shell">
            <table className="branch-dashboard-table">
              <thead><tr><th>S.No</th><th>Student ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Paid Progress</th><th>Course Progress</th><th>Attendance</th><th>Actions</th></tr></thead>
              <tbody>{studentView.students.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td>{student.studentId}</td><td>{student.studentName}</td><td>{student.emailAddress || '-'}</td><td>{student.mobileNumber || '-'}</td><td>{student.paidProgress ?? '-'}{student.paidProgress != null ? '%' : ''}</td><td>{student.courseProgress ?? '-'}{student.courseProgress != null ? '%' : ''}</td><td>{student.attendance || 'UNMARKED'}</td><td><div className="faculty-other-batches-student-actions"><button type="button" className="faculty-other-batches-action-button" onClick={() => setCalendarStudent(student)}>View Calendar</button></div></td></tr>)}</tbody>
            </table>
          </div>
        ) : <p>No students found for this batch.</p>}
      </div>
    ) : studentError ? (
      <div className="faculty-my-batches-empty"><strong>{studentError}</strong></div>
    ) : loading ? (
      <div className="faculty-my-batches-loading-card"><strong>Loading temporary batches...</strong></div>
    ) : error ? (
      <div className="faculty-my-batches-empty"><strong>{error}</strong></div>
    ) : batches.length ? (
      <div className="branch-dashboard-table-shell">
        <table className="branch-dashboard-table">
          <thead><tr><th>Date</th><th>Course</th><th>Batch</th><th>Original Faculty</th><th>Time</th><th>Assignment</th><th>Actions</th></tr></thead>
          <tbody>{batches.map(item => <tr key={item.id}><td>{formatDisplayDate(item.effectiveDate)}</td><td>{item.courseName || '-'}</td><td>{item.batchName || item.batchId || '-'}</td><td>{item.originalFacultyName || item.originalFacultyId || '-'}</td><td>{formatClassTimeForDashboard(item.effectiveStartTime)} - {formatClassTimeForDashboard(item.effectiveEndTime)}</td><td>{item.assignmentLabel || (item.assignmentType === 'COMBINED' ? 'Combined Class' : item.assignmentType || 'Replacement')}</td><td><button type="button" className="faculty-other-batches-action-button" onClick={() => viewStudents(item)}>View Students</button></td></tr>)}</tbody>
        </table>
      </div>
    ) : (
      <div className="faculty-my-batches-empty"><strong>No temporary batches</strong><p>No replacement or combined classes are currently assigned to you.</p></div>
    )}
  </FacultyDashboardSection>
}

function formatClassTimeForDashboard(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return value || '-'
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function FacultyDashboardPage() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const studentCalendarId = location.pathname.match(/\/dashboard\/faculty\/my-batches\/students\/([^/]+)\/calendar\/?$/)?.[1] || ''
  const isStudentCalendarRoute = Boolean(studentCalendarId)
  const isExamsRoute = location.pathname === '/dashboard/faculty/exams'
  const isAssessmentsRoute = location.pathname === '/dashboard/faculty/exams/assessments'
  const isExamReportsRoute = location.pathname.startsWith('/dashboard/faculty/exams/reports')
  const isAcademicTestRoute = location.pathname === '/dashboard/faculty/exams/academic-tests' || location.pathname.startsWith('/dashboard/faculty/exams/academic-tests/')
  const isAcademicTestReportRoute = location.pathname === '/dashboard/faculty/exams/academic-tests/report' || location.pathname.startsWith('/dashboard/faculty/exams/academic-tests/report/')
  const isAcademicTestListRoute = location.pathname.replace(/\/+$/, '') === '/dashboard/faculty/exams/academic-tests' && new URLSearchParams(location.search).get('view') === 'list'
  const isAcademicCreateRoute = isAcademicTestRoute && new URLSearchParams(location.search).get('create') === '1'
  const isStudentExamReportRoute = /^\/dashboard\/faculty\/exams\/reports\/[^/]+\/[^/]+$/.test(location.pathname)
  const facultyRouteSection = location.pathname === '/dashboard/faculty/dashboard' ? 'dashboard' : location.pathname === '/dashboard/faculty/courses' ? 'my-courses' : ['/dashboard/faculty/batches', '/dashboard/faculty/my-batches'].includes(location.pathname) ? 'my-batches' : location.pathname === '/dashboard/faculty/calendar' ? 'my-calendar' : location.pathname === '/dashboard/faculty/students' ? 'students' : location.pathname === '/dashboard/faculty/leave-requests' ? 'leave-requests' : location.pathname === '/dashboard/faculty/notifications' ? 'notifications' : location.pathname.startsWith('/dashboard/faculty/skill-development') ? 'skill-development' : location.pathname === '/dashboard/faculty/profile' ? 'profile' : isExamsRoute || isAssessmentsRoute || isExamReportsRoute || isAcademicTestRoute ? 'exams' : ''
  const userRole = String(user?.role || '').trim().toLowerCase()
  const [activeSection, setActiveSection] = useState(facultyRouteSection || 'dashboard')
  const [expandedSidebarGroups, setExpandedSidebarGroups] = useState({
    courses: false,
    students: false,
    'leave-management': false,
    exams: isExamsRoute || isAssessmentsRoute || isExamReportsRoute || isAcademicTestRoute,
    'syllabus-test': isExamsRoute || isAssessmentsRoute || isExamReportsRoute,
  })
  const [isAcademicTestMenuOpen, setIsAcademicTestMenuOpen] = useState(isAcademicTestRoute || isAcademicTestReportRoute)
  useEffect(() => { if (isAcademicTestRoute) setIsAcademicTestMenuOpen(true) }, [isAcademicTestRoute])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem('cispro.faculty-sidebar-collapsed') === 'true' } catch { return false }
  })
  const [dismissedSidebarGroup, setDismissedSidebarGroup] = useState('')
  const [hasTemporaryAssignments, setHasTemporaryAssignments] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const notificationRef = useRef(null)

  useEffect(() => {
    if (facultyRouteSection) setActiveSection(facultyRouteSection)
  }, [facultyRouteSection])

  useEffect(() => {
    let active = true
    const refreshTemporaryAssignmentVisibility = () => getFacultyTemporaryBatches()
      .then(rows => { if (active) setHasTemporaryAssignments(Array.isArray(rows) && rows.length > 0) })
      .catch(() => { if (active) setHasTemporaryAssignments(false) })
    refreshTemporaryAssignmentVisibility()
    const timer = window.setInterval(refreshTemporaryAssignmentVisibility, 60000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    let active = true
    getMyWeekOffRequests()
      .then((requests) => {
        if (active) setFacultyWeekOffRequests(Array.isArray(requests) ? requests : [])
      })
      .catch(() => {
        if (active) setFacultyWeekOffRequests([])
      })
    return () => { active = false }
  }, [])

  // Retrieve logged-in faculty details dynamically from registry or fallback to session
  const facultyDetails = useMemo(() => {
    const registry = loadFacultyRegistry()
    const email = String(user?.email || '').trim().toLowerCase()
    const matched = Array.isArray(registry) ? registry.find((f) => String(f.email || '').toLowerCase() === email) : null
    const fallbackDetails = {
      id: user?.userCode?.includes('-FC-') ? 'FC-' + user.userCode.split('-FC-')[1] : (user?.userCode || user?.id || 'FC-MOCK'),
      name: user?.name || 'Faculty Member',
      email: user?.email || 'faculty@cispro.local',
      phone: '9876543210',
      country: 'India',
      state: 'Tamil Nadu',
      city: 'Chennai',
      address: 'Assigned CISPRO Campus location',
      status: 'Active',
    }

    if (matched && typeof matched === 'object') {
      return {
        ...fallbackDetails,
        ...matched,
        name: String(matched.name || matched.fullName || matched.facultyName || fallbackDetails.name).trim() || fallbackDetails.name,
        email: String(matched.email || fallbackDetails.email).trim() || fallbackDetails.email,
        status: String(matched.status || fallbackDetails.status).trim() || fallbackDetails.status,
      }
    }

    return fallbackDetails
  }, [user])

  const facultyName = String(facultyDetails?.name || 'Faculty Member').trim() || 'Faculty Member'
  const initials = useMemo(() => {
    return String(facultyName)
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }, [facultyName])

  const [dashboardSummary, setDashboardSummary] = useState(null)
  const [dashboardOverview, setDashboardOverview] = useState(null)
  const [dashboardOverviewLoading, setDashboardOverviewLoading] = useState(true)
  const [dashboardOverviewError, setDashboardOverviewError] = useState('')
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [todayAttendanceLoading, setTodayAttendanceLoading] = useState(true)
  const [todayAttendanceError, setTodayAttendanceError] = useState('')
  const [facultyNotifications, setFacultyNotifications] =useState([])
  const [notificationOpen, setNotificationOpen] =useState(false)
  const [notificationStoreVersion, setNotificationStoreVersion] = useState(0)
  const [todayWorkEntries, setTodayWorkEntries] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [facultyProfile, setFacultyProfile] = useState(null)
  const [facultyWeekOffRequests, setFacultyWeekOffRequests] = useState([])
  const [weekOffValidationMessage, setWeekOffValidationMessage] = useState('')
  const [branchCourses, setBranchCourses] = useState([])
  const [courseCatalog, setCourseCatalog] = useState([])
  const [students, setStudents] = useState([])
  const [facultyAcademicReportProgress, setFacultyAcademicReportProgress] = useState(() => new Map())
  const [facultyAcademicBatchProgress, setFacultyAcademicBatchProgress] = useState(() => new Map())
  const [studentAttendanceStatuses, setStudentAttendanceStatuses] = useState({})
  const studentAttendanceContextRef = useRef('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedStudentsCourseId, setSelectedStudentsCourseId] = useState('')
  const [selectedStudentsBatchId, setSelectedStudentsBatchId] = useState('')
  const [studentsBatchSearch, setStudentsBatchSearch] = useState('')
  const [studentsCourseBatchPage, setStudentsCourseBatchPage] = useState(1)
  const [temporarySessionContext, setTemporarySessionContext] = useState(null)
  const [viewStudentDrawer, setViewStudentDrawer] = useState(null)
  const [expandedCourseModuleIds, setExpandedCourseModuleIds] = useState([])
  const [courseModuleLimit, setCourseModuleLimit] = useState(5)
  const [batchPage, setBatchPage] = useState(1)
  const [facultyBatchWeekTypeFilter, setFacultyBatchWeekTypeFilter] = useState('all')
  const [studentsPage, setStudentsPage] = useState(1)
  const [studentsViewMode, setStudentsViewMode] = useState('active')
  const [studentRecordsSearch, setStudentRecordsSearch] = useState('')
  const [studentRecordsPage, setStudentRecordsPage] = useState(1)
  const [academicTestModalStudent, setAcademicTestModalStudent] = useState(null)
  const [studentPerformanceDetails, setStudentPerformanceDetails] = useState(null)
  const [studentPerformanceLoading, setStudentPerformanceLoading] = useState(false)
  const [courseEditRequests, setCourseEditRequests] = useState([])
  const [isCourseRequestModalOpen, setIsCourseRequestModalOpen] = useState(false)
  const [isCourseEditModalOpen, setIsCourseEditModalOpen] = useState(false)
  const [isTodayWorkModalOpen, setIsTodayWorkModalOpen] = useState(false)
  const [courseEditView, setCourseEditView] = useState('overview')
  const [courseEditActiveModuleIndex, setCourseEditActiveModuleIndex] = useState(0)
  const [courseEditExpandedModuleIds, setCourseEditExpandedModuleIds] = useState([])
  const [courseEditInlineSubmodule, setCourseEditInlineSubmodule] = useState(null)
  const [courseEditPendingModuleId, setCourseEditPendingModuleId] = useState('')
  const [courseEditDeleteConfirm, setCourseEditDeleteConfirm] = useState(null)
  const [courseRequestForm, setCourseRequestForm] = useState({
    title: '',
    reason: '',
    description: '',
  })
  const [courseEditDraft, setCourseEditDraft] = useState(null)
  const [courseRequestError, setCourseRequestError] = useState('')
  const [isCourseRequestSuccessOpen, setIsCourseRequestSuccessOpen] = useState(false)
  const [isCourseEditSuccessOpen, setIsCourseEditSuccessOpen] = useState(false)
  const [todayWorkForm, setTodayWorkForm] = useState({
    applyToAllStudents: false,
    moduleId: '',
    submoduleIds: [],
    selectedStudentIds: [],
    progressPercentage: 0,
    attendanceByStudent: {},
    submoduleStatuses: {},
    submoduleStatusById: {},
  })
  const [todayWorkMode, setTodayWorkMode] = useState('attendance')
  const [todayWorkError, setTodayWorkError] = useState('')
  const [isTodayWorkSaving, setIsTodayWorkSaving] = useState(false)
  const [isTodayWorkConfirmOpen, setIsTodayWorkConfirmOpen] = useState(false)
  const [isTodayWorkMissedExpanded, setIsTodayWorkMissedExpanded] = useState(true)
  const [pendingTodayWorkSubmission, setPendingTodayWorkSubmission] = useState(null)
  const [attendanceSavedPrompt, setAttendanceSavedPrompt] = useState(null)
  const [attendanceWarningPopup, setAttendanceWarningPopup] = useState(null)
  const [batchCompletionPopup, setBatchCompletionPopup] = useState(null)
  const batchCompletionNoticeKeyRef = useRef('')
  const attendanceWarningLevelRef = useRef(0)
  const [todayWorkAttendanceSearch, setTodayWorkAttendanceSearch] = useState('')
  const [attendanceClock, setAttendanceClock] = useState(() => new Date())
  const [activeTemporaryAttendanceSession, setActiveTemporaryAttendanceSession] = useState(null)
  const [courseEditError, setCourseEditError] = useState('')
  const [isCourseRequestSaving, setIsCourseRequestSaving] = useState(false)
  const [isCourseEditSaving, setIsCourseEditSaving] = useState(false)
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [coursesError, setCoursesError] = useState('')

  useEffect(() => {
    if (!selectedStudentsBatchId) return undefined

    const intervalId = window.setInterval(() => setAttendanceClock(new Date()), 1000)
    return () => window.clearInterval(intervalId)
  }, [selectedStudentsBatchId, temporarySessionContext])

  useEffect(() => {
    let isMounted = true

    const loadNotifications = async () => {
      try {
        const response = await getFacultyNotifications()
        if (!isMounted) return

        setFacultyNotifications(
          Array.isArray(response?.data)
            ? response.data.filter(Boolean)
            : [],
        )
      } catch (error) {
        console.error('Failed to load faculty notifications', error)
      }
    }

    loadNotifications()
    const intervalId = window.setInterval(loadNotifications, 15000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const branchScopeId = String(dashboardSummary?.faculty?.branchId || '').trim()
    if (!branchScopeId) return undefined

    let isMounted = true
    const refreshStudentsForSummaryBranch = async () => {
      try {
        const activeRecords = await listBranchStudentsByLifecycle(branchScopeId)
        if (isMounted) {
          setStudents(activeRecords)
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to refresh faculty students from branch summary', error)
        }
      }
    }

    void refreshStudentsForSummaryBranch()
    return () => {
      isMounted = false
    }
  }, [dashboardSummary?.faculty?.branchId])

  useEffect(() => {
    let isMounted = true
    const loadTodayAttendance = async () => {
      setTodayAttendanceLoading(true)
      setTodayAttendanceError('')
      try {
        const response = await getCurrentFacultyAttendanceOverview({ date: getAttendanceDateKey() })
        if (isMounted) setTodayAttendance(response?.data ?? response ?? null)
      } catch (error) {
        if (isMounted) setTodayAttendanceError(error?.message || "Unable to load today's attendance.")
      } finally {
        if (isMounted) setTodayAttendanceLoading(false)
      }
    }
    const refresh = () => void loadTodayAttendance()
    void loadTodayAttendance()
    window.addEventListener('cispro:faculty-dashboard-refresh', refresh)
    return () => { isMounted = false; window.removeEventListener('cispro:faculty-dashboard-refresh', refresh) }
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadDashboardOverview = async () => {
      setDashboardOverviewLoading(true)
      setDashboardOverviewError('')
      try {
        const response = await getFacultyDashboardOverview()
        if (isMounted) setDashboardOverview(response?.data ?? response ?? null)
      } catch (error) {
        if (isMounted) setDashboardOverviewError(error?.message || 'Unable to load dashboard data right now.')
      } finally {
        if (isMounted) setDashboardOverviewLoading(false)
      }
    }
    const refresh = () => void loadDashboardOverview()
    void loadDashboardOverview()
    window.addEventListener('cispro:faculty-dashboard-refresh', refresh)
    return () => { isMounted = false; window.removeEventListener('cispro:faculty-dashboard-refresh', refresh) }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeNotifications(() => {
      setNotificationStoreVersion((current) => current + 1)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadFacultySummary = async () => {
      try {
        const response = await getFacultyMyBatchesSummary()
        if (!isMounted) return
        setDashboardSummary(response?.data ?? response ?? null)
      } catch (error) {
        console.error('Failed to load faculty summary', error)
      }
    }

    loadFacultySummary()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadCourseData = async () => {
      setCoursesLoading(true)
      setCoursesError('')

      try {
        const shouldLoadMasterCourses = userRole === 'operation-manager' || userRole === 'business-owner'
        const [profileResult, masterCoursesResult, branchCoursesResult] = await Promise.allSettled([
          getCurrentFacultyProfile({
            id: user?.id,
            userId: user?.userId,
            email: user?.email,
            userCode: user?.userCode,
          }),
          shouldLoadMasterCourses ? listCourses({ page: 1, limit: 100 }) : Promise.resolve({ data: [], meta: null }),
          listBranchCourses({ page: 1, limit: 100 }),
        ])

        if (!isMounted) return

        const profileData = profileResult.status === 'fulfilled' ? profileResult.value || null : null

        if (profileResult.status === 'fulfilled') {
          setFacultyProfile(profileData)
        }

        const masterCourses =
          shouldLoadMasterCourses &&
          masterCoursesResult.status === 'fulfilled' &&
          Array.isArray(masterCoursesResult.value?.data)
            ? masterCoursesResult.value.data
            : []
        const branchCourseList =
          branchCoursesResult.status === 'fulfilled' && Array.isArray(branchCoursesResult.value?.data)
            ? branchCoursesResult.value.data
            : []
        const branchScopeId = String(
          profileData?.branchId ||
          profileData?.branch?.id ||
          profileData?.branch?.branchId ||
          '',
        ).trim()
        let nextStudents = []
        try {
          if (branchScopeId) {
            const activeRecords = await listBranchStudentsByLifecycle(branchScopeId)
            nextStudents = activeRecords
          } else {
            nextStudents = []
          }
        } catch (studentError) {
          // Never restore localStorage student rows here. That cache can hold
          // a completed parallel-course enrollment and would repopulate the
          // active batch count after the API has already removed it.
          console.error('Failed to refresh faculty students', studentError)
          nextStudents = []
        }

        setBranchCourses(branchCourseList)
        setStudents(nextStudents)

        const mergedCourseMap = new Map()

        const profileCourses = [
          getCourseFromSource(profileData?.course),
          ...(Array.isArray(profileData?.courseAssignments)
            ? profileData.courseAssignments.map((entry) => getCourseFromSource(entry))
            : []),
          ...(Array.isArray(profileData?.batchEntries)
            ? profileData.batchEntries.map((entry) => getCourseFromSource(entry))
            : []),
        ].filter(Boolean)

        profileCourses.forEach((course) => {
          const courseKey = String(course?.id || course?.courseCode || course?.name || '').trim()
          if (!courseKey) return
          mergedCourseMap.set(courseKey, course)
        })

        ;[...masterCourses, ...branchCourseList].forEach((course) => {
          const courseKey = String(course?.id || course?.courseCode || course?.name || '').trim()
          if (!courseKey) return

          const existing = mergedCourseMap.get(courseKey)
          mergedCourseMap.set(courseKey, existing ? { ...existing, ...course } : course)
        })

        const nextCourseCatalog = Array.from(mergedCourseMap.values())
        setCourseCatalog(nextCourseCatalog)

        if (!nextCourseCatalog.length) {
          setCoursesError('No course details were returned for your account.')
        } else {
          setCoursesError('')
        }
      } catch (error) {
        if (!isMounted) return
        setBranchCourses([])
        setCourseCatalog([])
        setCoursesError('Unable to load course details right now.')
        console.error('Failed to load faculty course data', error)
      } finally {
        if (isMounted) {
          setCoursesLoading(false)
        }
      }
    }

    loadCourseData()
    const syncStudents = () => void loadCourseData()
    window.addEventListener('cispro:students-changed', syncStudents)
    window.addEventListener('cispro:branch-students-changed', syncStudents)

    return () => {
      isMounted = false
      window.removeEventListener('cispro:students-changed', syncStudents)
      window.removeEventListener('cispro:branch-students-changed', syncStudents)
    }
  }, [user?.email, user?.id, user?.role, user?.userCode, user?.userId, userRole])

  useEffect(() => {
    let isMounted = true

    const loadTodayWork = async () => {
      try {
        const entries = await listFacultyTodayWorkEntries()
        if (!isMounted) return
        setTodayWorkEntries(Array.isArray(entries) ? entries : [])
      } catch (error) {
        if (!isMounted) return
        console.error('Failed to load faculty today work entries', error)
        setTodayWorkEntries([])
      }
    }

    const handleStorageChanged = (event) => {
      if (event?.key === FACULTY_TODAY_WORK_SYNC_KEY || event?.key === BRANCH_STUDENTS_KEY) {
        void loadTodayWork()
      }
    }

    void loadTodayWork()
    window.addEventListener(FACULTY_TODAY_WORK_SYNC_EVENT, loadTodayWork)
    window.addEventListener('storage', handleStorageChanged)

    return () => {
      isMounted = false
      window.removeEventListener(FACULTY_TODAY_WORK_SYNC_EVENT, loadTodayWork)
      window.removeEventListener('storage', handleStorageChanged)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    // Keep the dashboard fixed while the notification panel is open.
    document.body.classList.toggle('faculty-notification-menu-open', notificationOpen)

    return () => {
      document.body.classList.remove('faculty-notification-menu-open')
    }
  }, [notificationOpen])

  useEffect(() => {
    if (!notificationOpen) return undefined

    const handlePointerDown = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [notificationOpen])

  useEffect(() => {
    let isMounted = true

    const loadRequests = async () => {
      try {
        const response = await listCourseEditRequests()
        if (!isMounted) return
        setCourseEditRequests(Array.isArray(response?.data) ? response.data : [])
      } catch (error) {
        console.error('Failed to load course edit requests', error)
      }
    }

    loadRequests()
    const intervalId = window.setInterval(loadRequests, 15000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const localProgressNotifications = useMemo(() => {
    if (notificationStoreVersion < 0) return []

    return loadStoredNotifications()
      .filter((notification) => String(notification.kind || '').trim().startsWith('faculty-progress-status'))
      .map((notification) => normalizeFacultyNotification(notification))
  }, [notificationStoreVersion])
  const normalizedNotifications = useMemo(
    () => [
      ...facultyNotifications.map((notification) => normalizeFacultyNotification(notification)),
      ...localProgressNotifications,
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [facultyNotifications, localProgressNotifications],
  )
  const unreadNotifications = useMemo(
    () => normalizedNotifications.filter((notification) => !notification.read),
    [normalizedNotifications],
  )
  const unreadNotificationCount = unreadNotifications.length
  const totalNotificationCount = normalizedNotifications.length
  const isFacultyProgressNotification = (notification = {}) =>
    String(notification.kind || '').trim().startsWith('faculty-progress-status')

  const assignedCourseIds = useMemo(() => {
    const summary = dashboardSummary || {}
    const hasCurrentBranchAssignments = Array.isArray(summary?.batchEntries)
    const sources = hasCurrentBranchAssignments
      ? [summary?.courseIds, summary?.courseId, summary?.courseAssignments, summary?.batchEntries]
      : [
          facultyProfile?.course?.id,
          facultyProfile?.courseIds,
          facultyProfile?.courseId,
          facultyProfile?.courseAssignments,
          facultyProfile?.batchEntries,
          summary?.courseIds,
          summary?.courseId,
          summary?.courseAssignments,
          summary?.batchEntries,
        ]

    const ids = []

    sources.forEach((source) => {
      if (Array.isArray(source)) {
        source.forEach((entry) => {
          const value = typeof entry === 'string' || typeof entry === 'number'
            ? String(entry).trim()
            : String(entry?.courseId ?? entry?.course?.id ?? entry?.course?.courseId ?? '').trim()
          if (value) ids.push(value)
        })
        return
      }

      const value = String(source || '').trim()
      if (value) ids.push(value)
    })

    return Array.from(new Set(ids))
  }, [dashboardSummary, facultyProfile])

  const assignedCourseNames = useMemo(() => {
    const summary = dashboardSummary || {}
    const hasCurrentBranchAssignments = Array.isArray(summary?.batchEntries)
    const sources = hasCurrentBranchAssignments
      ? [summary?.courseAssignments, summary?.batchEntries, summary?.faculty?.courseName, summary?.courseName]
      : [
          facultyProfile?.course?.name,
          facultyProfile?.courseAssignments,
          facultyProfile?.batchEntries,
          summary?.courseAssignments,
          summary?.batchEntries,
          facultyProfile?.courseName,
          summary?.faculty?.courseName,
          summary?.faculty?.course?.name,
          summary?.courseName,
        ]

    const names = []

    sources.forEach((source) => {
      if (Array.isArray(source)) {
        source.forEach((entry) => {
          const value = String(entry?.courseName ?? entry?.name ?? entry?.title ?? '').trim()
          if (value) names.push(value)
        })
        return
      }

      const value = String(source || '').trim()
      if (value) names.push(value)
    })

    return Array.from(new Set(names))
  }, [dashboardSummary, facultyProfile])

  const assignedCourses = useMemo(() => {
    if (!Array.isArray(courseCatalog) || !courseCatalog.length) return []

    const toCourseKey = (course = {}) => {
      const courseNameKey = normalizeCourseKey(course?.name || course?.courseName || '')
      if (courseNameKey) return `name:${courseNameKey}`

      const courseCodeKey = normalizeCourseKey(course?.courseCode || '')
      if (courseCodeKey && courseCodeKey !== 'course') return `code:${courseCodeKey}`

      const courseIdKey = normalizeCourseKey(course?.courseId || course?.id || '')
      return courseIdKey ? `id:${courseIdKey}` : ''
    }

    const getCourseScore = (course = {}) => {
      const nameScore = String(course?.name || course?.courseName || '').trim() ? 3 : 0
      const codeValue = String(course?.courseCode || '').trim().toLowerCase()
      const codeScore = codeValue && codeValue !== 'course' ? 2 : 0
      const idScore = String(course?.id || course?.courseId || '').trim() ? 1 : 0
      return nameScore + codeScore + idScore
    }

    const mergeBestCourse = (existingCourse, candidateCourse) => {
      if (!existingCourse) return candidateCourse
      if (!candidateCourse) return existingCourse
      return getCourseScore(candidateCourse) > getCourseScore(existingCourse)
        ? { ...existingCourse, ...candidateCourse }
        : { ...candidateCourse, ...existingCourse }
    }

    const matchedCourses = courseCatalog.filter((course) => {
      const courseId = String(course?.id || '').trim()
      const courseName = normalizeCourseKey(course?.name || course?.courseName || '')

      if (courseId && assignedCourseIds.includes(courseId)) {
        return true
      }

      return assignedCourseNames.some((name) => normalizeCourseKey(name) === courseName)
    })

    const uniqueMatchedCourses = Array.from(
      matchedCourses.reduce((map, course) => {
        const key = toCourseKey(course)
        if (!key) return map

        const existingCourse = map.get(key)
        map.set(key, mergeBestCourse(existingCourse, course))
        return map
      }, new Map()).values(),
    )

    if (uniqueMatchedCourses.length) {
      return uniqueMatchedCourses
    }

    const fallbackName = assignedCourseNames[0]
    if (!fallbackName) return []

    const fallbackCourses = courseCatalog.filter((course) => normalizeCourseKey(course?.name || course?.courseName || '') === normalizeCourseKey(fallbackName))
    return Array.from(
      fallbackCourses.reduce((map, course) => {
        const key = toCourseKey(course)
        if (!key) return map

        const existingCourse = map.get(key)
        map.set(key, mergeBestCourse(existingCourse, course))
        return map
      }, new Map()).values(),
    )
  }, [assignedCourseIds, assignedCourseNames, courseCatalog])

  const currentFacultyIdentity = useMemo(() => {
    const profile = facultyProfile || {}
    const summaryFaculty = dashboardSummary?.faculty || {}
    const branch = facultyDetails?.branch || {}
    return {
      // The branch dashboard summary is authoritative for branch faculties.
      // The legacy faculty profile can have a different internal id.
      facultyId: String(summaryFaculty.id || profile.facultyId || profile.id || profile.facultyUserId || facultyDetails?.id || '').trim(),
      facultyUserId: String(profile.userId || profile.user?.id || user?.id || '').trim(),
      facultyName: String(summaryFaculty.facultyName || profile.facultyName || profile.name || facultyDetails?.name || '').trim(),
      facultyEmail: String(summaryFaculty.facultyEmail || profile.facultyEmail || profile.email || facultyDetails?.email || '').trim(),
      branchId: String(summaryFaculty.branchId || profile.branchId || branch.id || facultyDetails?.branchId || facultyDetails?.branch?.id || '').trim(),
      branchCode: String(summaryFaculty.branchCode || profile.branchCode || branch.branchId || facultyDetails?.branchCode || facultyDetails?.branch?.branchId || '').trim(),
    }
  }, [dashboardSummary, facultyDetails, facultyProfile, user?.id])

  useEffect(() => {
    if (!academicTestModalStudent) {
      return undefined
    }

    let active = true
    const studentId = String(academicTestModalStudent.studentId || academicTestModalStudent.id || '').trim()
    const courseId = String(academicTestModalStudent.courseId || academicTestModalStudent._facultyCourse?.id || '').trim()
    const courseName = String(academicTestModalStudent.courseName || academicTestModalStudent.course?.name || '').trim()
    const batchId = String(academicTestModalStudent.batchId || academicTestModalStudent.batchEntryId || '').trim()
    const batchName = String(academicTestModalStudent.batchName || academicTestModalStudent.batch || '').trim()
    const matches = (value, expected) => !expected || String(value || '').trim().toLowerCase() === expected.toLowerCase()
    const unwrap = (response) => response?.data || response || {}
    const studentKeys = new Set([academicTestModalStudent.studentId, academicTestModalStudent.id]
      .map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))

    setStudentPerformanceLoading(true)
    setStudentPerformanceDetails({ syllabus: null, academic: null, assessments: [], error: '' })
    Promise.allSettled([
      studentId ? getBranchStudentSyllabusReports(studentId, currentFacultyIdentity.branchId) : Promise.resolve(null),
      studentId ? getBranchStudentAcademicReports(studentId, currentFacultyIdentity.branchId) : Promise.resolve(null),
      listFacultyAssessmentReports(),
    ]).then(async ([syllabusResult, academicResult, assessmentSummaryResult]) => {
      const syllabus = syllabusResult.status === 'fulfilled' ? unwrap(syllabusResult.value) : null
      const academic = academicResult.status === 'fulfilled' ? unwrap(academicResult.value) : null
      const summaries = assessmentSummaryResult.status === 'fulfilled' && Array.isArray(unwrap(assessmentSummaryResult.value))
        ? unwrap(assessmentSummaryResult.value)
        : []
      const scopedSummaries = summaries.filter((row) => {
        const rowCourse = row?.course || {}
        const rowBatch = row?.batch || {}
        const courseMatches = (courseId && [rowCourse.id, rowCourse.courseId].some((value) => matches(value, courseId))) ||
          (courseName && [rowCourse.name, rowCourse.courseName].some((value) => matches(value, courseName)))
        const batchMatches = (batchId && [rowBatch.id, rowBatch.batchId].some((value) => matches(value, batchId))) ||
          (batchName && [rowBatch.name, rowBatch.batchName].some((value) => matches(value, batchName)))
        return courseMatches && batchMatches
      })
      const assessmentReports = (await Promise.all(scopedSummaries.map(async (row) => {
        try {
          const report = unwrap(await getFacultyAssessmentStudentReport(row.course.id, row.batch.id, row.module.id))
          const student = (report.students || []).find((entry) => studentKeys.has(String(entry?.studentId || entry?.student?.studentId || '').trim().toLowerCase()))
          if (!student) return null
          return { ...row, report, student }
        } catch {
          return null
        }
      }))).filter(Boolean)
      if (active) setStudentPerformanceDetails({ syllabus, academic, assessments: assessmentReports, error: '' })
    }).catch(() => {
      if (active) setStudentPerformanceDetails({ syllabus: null, academic: null, assessments: [], error: 'Unable to load the additional report details.' })
    }).finally(() => {
      if (active) setStudentPerformanceLoading(false)
    })

    return () => { active = false }
  }, [academicTestModalStudent, currentFacultyIdentity.branchId])

  const facultyWeekOffStatus = useMemo(() => {
    const today = dateKey(new Date())
    const defaultWeekOffDay = String(
      facultyProfile?.weeklyOffDay ||
      facultyProfile?.weekOffDay ||
      facultyProfile?.defaultWeeklyOffDay ||
      dashboardSummary?.faculty?.weeklyOffDay ||
      dashboardSummary?.faculty?.weekOffDay ||
      dashboardSummary?.faculty?.defaultWeeklyOffDay ||
      facultyDetails?.weeklyOffDay ||
      facultyDetails?.weekOffDay ||
      '',
    ).trim().toUpperCase()
    const approvedOverride = facultyWeekOffRequests
      .filter((request) => String(request?.status || '').trim().toUpperCase() === 'APPROVED')
      .find((request) => String(request?.requestedWeekOffDate || '').slice(0, 10) === today)
    const effective = getEffectiveWeeklyOffForDate({
      date: new Date(),
      defaultWeekOffDay,
      approvedOverride,
    })
    const isWeekOff = Boolean(today && effective.date === today)
    return {
      isWeekOff,
      temporary: isWeekOff && Boolean(effective.temporary),
      day: effective.day || defaultWeekOffDay,
      regularDay: defaultWeekOffDay,
      date: today,
    }
  }, [dashboardSummary, facultyDetails, facultyProfile, facultyWeekOffRequests])

  const facultyNextWeekOff = useMemo(
    () => getNextFacultyWeekOff(facultyWeekOffStatus.regularDay, facultyWeekOffRequests),
    [facultyWeekOffRequests, facultyWeekOffStatus.regularDay],
  )

  const showWeekOffValidation = () => {
    if (!facultyWeekOffStatus.isWeekOff) return
    setWeekOffValidationMessage(
      facultyWeekOffStatus.temporary
        ? 'Today is your Week Off. This is an approved alternate week-off, so Attendance, Today\'s Work, and Academic Test actions are read-only today.'
        : 'Today is your Week Off. Attendance, Today\'s Work, and Academic Test actions are read-only today.',
    )
  }

  const facultyBranch = useMemo(() => facultyDetails?.branch || {}, [facultyDetails])
  const facultyBranchScope = useMemo(() => {
    const targetBranchId = String(currentFacultyIdentity.branchId || facultyBranch.id || facultyBranch.branchId || '').trim()
    const targetBranchEmail = String(facultyBranch.branchEmail || '').trim().toLowerCase()
    const targetBranchName = String(facultyBranch.branchName || '').trim()

    return {
      branchId: targetBranchId,
      targetBranchId,
      targetBranchEmail,
      targetBranchName,
    }
  }, [currentFacultyIdentity.branchId, facultyBranch])

  const facultyViewLabel = useMemo(() => {
    const name = String(currentFacultyIdentity.facultyName || facultyName || 'Faculty').trim() || 'Faculty'
    return `${name}'s Faculty View`
  }, [currentFacultyIdentity.facultyName, facultyName])

  const facultySummaryBackfillRecord = useMemo(() => {
    const batchEntries = Array.isArray(dashboardSummary?.batchEntries) ? dashboardSummary.batchEntries : []
    if (!batchEntries.length) return null

    return {
      id: String(
        dashboardSummary?.faculty?.id ||
        dashboardSummary?.faculty?.facultyId ||
        facultyProfile?.id ||
        facultyProfile?.facultyId ||
        currentFacultyIdentity.facultyId ||
        '',
      ).trim(),
      facultyId: String(
        dashboardSummary?.faculty?.id ||
        dashboardSummary?.faculty?.facultyId ||
        facultyProfile?.id ||
        facultyProfile?.facultyId ||
        currentFacultyIdentity.facultyId ||
        '',
      ).trim(),
      facultyName: String(
        dashboardSummary?.faculty?.facultyName ||
        dashboardSummary?.faculty?.name ||
        facultyProfile?.facultyName ||
        facultyProfile?.name ||
        currentFacultyIdentity.facultyName ||
        '',
      ).trim(),
      facultyEmail: String(
        dashboardSummary?.faculty?.facultyEmail ||
        dashboardSummary?.faculty?.email ||
        facultyProfile?.facultyEmail ||
        facultyProfile?.email ||
        currentFacultyIdentity.facultyEmail ||
        '',
      ).trim(),
      courseId: String(
        dashboardSummary?.faculty?.courseId ||
        facultyProfile?.courseId ||
        '',
      ).trim(),
      batchEntries,
    }
  }, [dashboardSummary, facultyProfile, currentFacultyIdentity.facultyEmail, currentFacultyIdentity.facultyId, currentFacultyIdentity.facultyName])

  const facultyBackfillRecords = useMemo(
    () =>
      [
        facultyProfile,
        dashboardSummary?.faculty,
        dashboardSummary?.profile,
        facultySummaryBackfillRecord,
      ].filter(Boolean),
    [dashboardSummary, facultyProfile, facultySummaryBackfillRecord],
  )

  const facultyEnrollmentStudents = useMemo(() => {
    // Keep one row per course/batch assignment. Parallel-course students are
    // stored as one student record with nested enrollments, so flatten them
    // before faculty/course filtering instead of losing the second course.
    const expandEnrollments = (record = {}) => {
      const enrollments = Array.isArray(record?.courseEnrollments)
        ? record.courseEnrollments
        : Array.isArray(record?.courses)
          ? record.courses
          : []
      if (!enrollments.length) return [record]

      // A multi-course student must contribute one lifecycle row per
      // enrollment. The top-level student record represents the primary
      // course and can contain stale course/batch progress, so retaining it
      // alongside the enrollment rows makes the table report the wrong
      // course completion status.
      return enrollments.map((enrollment) => ({
          ...record,
          ...enrollment,
          id: record.id,
          studentId: record.studentId,
          studentName: record.studentName,
          emailAddress: record.emailAddress,
          mobileNumber: record.mobileNumber,
          courseId: enrollment?.courseId || enrollment?.course?.id || record.courseId,
          courseName: enrollment?.courseName || enrollment?.course?.name || record.courseName,
          batchId: enrollment?.batchId || enrollment?.batchEntryId || record.batchId,
          batchEntryId: enrollment?.batchEntryId || enrollment?.batchId || record.batchEntryId,
          batchName: enrollment?.batchName || enrollment?.batch || record.batchName,
          facultyId: enrollment?.facultyId || record.facultyId,
          facultyName: enrollment?.facultyName || record.facultyName,
          courseEnrollments: record.courseEnrollments,
          installmentSchedule: record.installmentSchedule,
          paymentPlan: record.paymentPlan,
        }))
    }

    const freshRecords = Array.isArray(students) ? students : []
    return freshRecords.flatMap(expandEnrollments)
  }, [students])

  const backfilledStudents = useMemo(
    () => enrichStudentsWithFacultyReferences(facultyEnrollmentStudents, facultyBackfillRecords, courseCatalog),
    [courseCatalog, facultyBackfillRecords, facultyEnrollmentStudents],
  )

  const facultyScopedStudents = useMemo(() => {
    const facultyId = currentFacultyIdentity.facultyId
    const facultyNameValue = currentFacultyIdentity.facultyName
    const facultyEmailValue = currentFacultyIdentity.facultyEmail
    const assignedBatchRecords = [
      ...(Array.isArray(dashboardSummary?.batchEntries) ? dashboardSummary.batchEntries : []),
      ...(Array.isArray(dashboardSummary?.batchCounts) ? dashboardSummary.batchCounts : []),
      ...(Array.isArray(facultyProfile?.batchEntries) ? facultyProfile.batchEntries : []),
    ]
    const assignedBatchKeys = new Set(
      assignedBatchRecords
        .flatMap((batch) => [
          batch?.id,
          batch?.batchId,
          batch?.batchEntryId,
          batch?.batchName,
          batch?.batch,
        ])
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean),
    )
    const assignedCourseKeys = new Set([
      ...assignedCourseIds,
      ...assignedCourseNames,
    ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))

    const branchKeys = [currentFacultyIdentity.branchId, currentFacultyIdentity.branchCode]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
    const branchScopedStudents = branchKeys.length
      ? backfilledStudents.filter((student) => {
          const studentBranchKeys = [student?.branchId, student?.branchCode, student?.branchKey]
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean)

          return studentBranchKeys.some((key) => branchKeys.includes(key))
        })
      : backfilledStudents

    const exactFacultyStudents = getExactFacultyStudents(
      branchScopedStudents,
      facultyId,
      facultyNameValue,
      facultyEmailValue,
    )
    const exactStudentKeys = new Set(exactFacultyStudents.map((student) => getStudentIdentityKey(student)).filter(Boolean))
    const batchAssignedStudents = branchScopedStudents.filter((student) => {
      const studentBatchKeys = [
        student?.batchId,
        student?.batchEntryId,
        student?.batchName,
        student?.batch,
      ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
      const studentCourseKeys = [
        student?.courseId,
        student?.courseInterested,
        student?.courseName,
        student?.course?.name,
      ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
      const matchesBatch = studentBatchKeys.some((key) => assignedBatchKeys.has(key))
      const matchesCourse = !assignedCourseKeys.size || studentCourseKeys.some((key) => assignedCourseKeys.has(key))
      const key = getStudentIdentityKey(student)
      return matchesBatch && matchesCourse && key && !exactStudentKeys.has(key)
    })

    // The same enrollment can arrive from both the dashboard summary and the
    // branch-student API. Keep one row per student/course/batch assignment.
    return dedupeStudentsByIdentity([...exactFacultyStudents, ...batchAssignedStudents])
  }, [assignedCourseIds, assignedCourseNames, backfilledStudents, currentFacultyIdentity.branchCode, currentFacultyIdentity.branchId, currentFacultyIdentity.facultyEmail, currentFacultyIdentity.facultyId, currentFacultyIdentity.facultyName, dashboardSummary?.batchCounts, dashboardSummary?.batchEntries, facultyProfile?.batchEntries])

  const facultyTodayWorkEntries = useMemo(() => {
    return getFacultyTodayWorkEntriesByFaculty({
      facultyId: currentFacultyIdentity.facultyId,
      facultyName: currentFacultyIdentity.facultyName,
      facultyEmail: currentFacultyIdentity.facultyEmail,
    }, todayWorkEntries)
  }, [currentFacultyIdentity.facultyEmail, currentFacultyIdentity.facultyId, currentFacultyIdentity.facultyName, todayWorkEntries])

  const todayWorkEntriesByStudent = useMemo(() => {
    const sortedEntries = [...facultyTodayWorkEntries].sort(
      (left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime(),
    )

    const mapping = new Map()

    facultyScopedStudents.forEach((student) => {
      const studentId = String(student?.id || student?.studentId || '').trim().toLowerCase()
      if (!studentId) return

      const matchedEntry = sortedEntries.find((entry) => isFacultyWorkEntryForStudent(entry, student))
      if (matchedEntry) {
        mapping.set(studentId, matchedEntry)
      }
    })

    return mapping
  }, [facultyScopedStudents, facultyTodayWorkEntries])

  const facultyStudentLifecycleRows = useMemo(() => {
    const rowsByStudentCourse = new Map()

    facultyScopedStudents.forEach((student) => {
      const identity = String(student?.id || student?.studentId || student?.emailAddress || '').trim().toLowerCase()
      const courseKey = String(student?.courseId || student?.courseName || student?.courseInterested || '').trim().toLowerCase()
      const key = `${identity}|${courseKey}`
      const existing = rowsByStudentCourse.get(key)
      const candidateIsDiscontinued = isDiscontinuedStudent(student)

      if (existing && !candidateIsDiscontinued) return
      rowsByStudentCourse.set(key, existing && candidateIsDiscontinued ? { ...existing, ...student } : student)
    })

    return Array.from(rowsByStudentCourse.values()).map((student) => {
      const course = courseCatalog.find((item) => {
        const itemId = String(item?.id || item?.courseId || '').trim().toLowerCase()
        const itemName = normalizeCourseKey(item?.name || item?.courseName || '')
        const studentId = String(student?.courseId || '').trim().toLowerCase()
        const studentName = normalizeCourseKey(student?.courseName || student?.courseInterested || '')
        return (itemId && studentId === itemId) || (itemName && studentName === itemName)
      }) || assignedCourses.find((item) => {
        const itemId = String(item?.id || item?.courseId || '').trim().toLowerCase()
        const itemName = normalizeCourseKey(item?.name || item?.courseName || '')
        const studentId = String(student?.courseId || '').trim().toLowerCase()
        const studentName = normalizeCourseKey(student?.courseName || student?.courseInterested || '')
        return (itemId && studentId === itemId) || (itemName && studentName === itemName)
      }) || {
        id: student?.courseId,
        courseId: student?.courseId,
        name: student?.courseName || student?.courseInterested,
        courseName: student?.courseName || student?.courseInterested,
      }
      // Completion must be decided from the selected course enrollment. Use a
      // matching Today\'s Work snapshot when it has newer course-specific
      // progress than the persisted enrollment value.
      const lifecycleStudent = student
      const workCourseId = course?.id || course?.courseId || student?.courseId || ''
      const matchingWorkEntries = getFacultyTodayWorkEntriesForStudent(
        facultyTodayWorkEntries,
        student,
        workCourseId,
      )
      const workSummary = matchingWorkEntries.length
        ? buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, course, student)
        : null
      const workProgress = Number(workSummary?.courseProgress)
      const lifecycle = getFacultyStudentLifecycle(
        lifecycleStudent,
        course,
        Number.isFinite(workProgress) ? workProgress : null,
      )

      // The academic report is the source of truth for the batch-level
      // completion state. Student records can contain an older academic
      // snapshot, so use the matching batch report when it confirms that all
      // configured evaluations are complete.
      const enrollment = lifecycle.enrollment || getCourseEnrollmentForStudent(student, course)
      const batchContext = resolveFacultyBatchContextForStudent(student, facultyBackfillRecords)
      const batchProgressKeys = [
        enrollment?.batchId,
        enrollment?.batchEntryId,
        student?.batchId,
        student?.batchEntryId,
        student?.batchName,
        student?.batch,
        batchContext?.batchId,
        batchContext?.batchGroupId,
        batchContext?.batchName,
        batchContext?.batchEntry?.id,
        batchContext?.batchEntry?.batchId,
      ].map((value) => normalizeWorkStudentId(value || '')).filter(Boolean)
      const studentIdentityKeys = [student?.studentId, student?.id, student?.emailAddress]
        .map((value) => normalizeWorkStudentId(value || ''))
        .filter(Boolean)
      const uniqueBatchProgresses = Array.from(new Set(facultyAcademicBatchProgress.values()))
      const incompleteBatchProgress = uniqueBatchProgresses.find((progress) => (
        Number(progress?.total || 0) > 0 &&
        Number(progress?.completed || 0) < Number(progress.total)
      )) || null
      const singleBatchProgress = uniqueBatchProgresses.length === 1 &&
        Number(uniqueBatchProgresses[0]?.total || 0) > 0 &&
        Number(uniqueBatchProgresses[0]?.completed || 0) >= 0
        ? uniqueBatchProgresses[0]
        : null
      const batchAcademicProgress = batchProgressKeys
        .map((key) => facultyAcademicBatchProgress.get(key))
        .find(Boolean) || studentIdentityKeys
          .map((key) => facultyAcademicBatchProgress.get(key))
          .find(Boolean) || incompleteBatchProgress || singleBatchProgress
      const batchAcademicComplete = Number(batchAcademicProgress?.total || 0) > 0 &&
        Number(batchAcademicProgress?.activeStudentCount || 0) > 0 &&
        Number(batchAcademicProgress?.reportStudentCount || 0) >= Number(batchAcademicProgress?.activeStudentCount || 0) &&
        Number(batchAcademicProgress?.completed || 0) >= Number(batchAcademicProgress.total)
      const batchReportSent = batchAcademicProgress?.reportSent === true
      // A student may have completed one evaluation while another evaluation
      // is still pending for the batch. Do not remove anyone until the batch
      // report itself confirms that every configured evaluation is complete
      // for every student. Once the batch report is complete, it is the
      // source of truth for every student in that batch.
      const academicBatchCompleteForStudent = batchAcademicComplete
      const hasIncompleteAcademicBatchReport = Number(batchAcademicProgress?.total || 0) > 0 && !batchAcademicComplete
      const lifecycleMetrics = hasIncompleteAcademicBatchReport
        ? { ...lifecycle, isCompleted: false }
        : academicBatchCompleteForStudent && batchReportSent && lifecycle.courseProgress >= 100
        ? {
          ...lifecycle,
          isCompleted: true,
          academicTestProgress: {
            ...(lifecycle.academicTestProgress || {}),
            totalEvaluations: Number(batchAcademicProgress.total),
            completedEvaluations: Number(batchAcademicProgress.completed),
            pendingEvaluations: 0,
            evaluationPercentage: 100,
            academicComplete: true,
          },
        }
        : { ...lifecycle, isCompleted: false }

      return {
        ...lifecycleStudent,
        _facultyCourse: course,
        _facultyLifecycle: isDiscontinuedStudent(student)
          ? 'DISCONTINUED'
          : lifecycleMetrics.isCompleted
            ? 'COMPLETED'
            : 'ACTIVE',
        _facultyLifecycleMetrics: lifecycleMetrics,
      }
    })
  }, [assignedCourses, courseCatalog, facultyAcademicBatchProgress, facultyBackfillRecords, facultyScopedStudents, facultyTodayWorkEntries])

  const facultyLifecycleVisibleStudents = useMemo(() => {
    const mode = studentsViewMode === 'records' ? 'COMPLETED' : String(studentsViewMode || 'active').toUpperCase()
    return facultyStudentLifecycleRows.filter((student) => student._facultyLifecycle === mode)
  }, [facultyStudentLifecycleRows, studentsViewMode])

  const activeCourseId = selectedCourseId || String(assignedCourses[0]?.id || '').trim()

  const selectedCourse = useMemo(() => {
    if (!assignedCourses.length) return null
    return assignedCourses.find((course) => String(course?.id || '').trim() === activeCourseId) || assignedCourses[0] || null
  }, [activeCourseId, assignedCourses])

  const selectedCourseRequestId = useMemo(() => {
    return String(
      selectedCourse?.branchCourseId ||
      selectedCourse?.courseId ||
      selectedCourse?.id ||
      '',
    ).trim()
  }, [selectedCourse])

  const facultyProgressComparisonNotifications = useMemo(() => {
    return facultyScopedStudents
      .map((student) => {
        const studentIdLabel = String(student.studentId || student.id || '-').trim()
        const studentName = String(student.studentName || '-').trim()
        const paymentProgress = getStudentPaymentProgress(student)
        const studentKey = normalizeWorkStudentId(student.id || student.studentId || '')
        const workEntry = todayWorkEntriesByStudent.get(studentKey) || null
        const workCourse = workEntry
          ? courseCatalog.find((course) => String(course?.id || '').trim() === String(workEntry.courseId || '').trim()) || selectedCourse || null
          : null
        const workProgressSummary = workEntry
          ? buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, workCourse || {}, student)
          : null

        const storedCourseProgress = Number(
          student?.courseProgress ??
          student?.courseCompletionPercentage ??
          student?.progress ??
          NaN,
        )
        const courseProgress = Number.isFinite(Number(workProgressSummary?.courseProgress))
          ? Number(workProgressSummary.courseProgress)
          : storedCourseProgress
        const paidProgress = Number(paymentProgress.paidInstallmentPercentage)

        if (!Number.isFinite(courseProgress) || !Number.isFinite(paidProgress)) return null

        return buildProgressComparisonNotification({
          studentName,
          studentId: studentIdLabel,
          courseProgress,
          paidProgress,
          recipientLabel: 'Faculty Dashboard',
        })
      })
      .filter(Boolean)
  }, [courseCatalog, facultyScopedStudents, facultyTodayWorkEntries, selectedCourse, studentAttendanceStatuses, todayWorkEntriesByStudent])

  useEffect(() => {
    if (!facultyProgressComparisonNotifications.length) {
      syncProgressComparisonNotifications([], 'faculty')
      return
    }

    syncProgressComparisonNotifications(
      facultyProgressComparisonNotifications.map((notification) => ({
        studentName: notification.studentName,
        studentId: notification.studentId,
        courseProgress: notification.courseProgress,
        paidProgress: notification.paidProgress,
        recipientLabel: notification.recipientLabel,
      })),
      'faculty',
    )
    setNotificationStoreVersion((current) => current + 1)
  }, [facultyProgressComparisonNotifications])

  const facultyBatchRows = useMemo(() => {
    const facultyId = currentFacultyIdentity.facultyId
    const facultyNameValue = currentFacultyIdentity.facultyName
    const facultyEmailValue = currentFacultyIdentity.facultyEmail
    const summary = dashboardSummary || {}
    const getBatchStudentCount = (entry = {}) => {
      const normalizedBatchId = String(entry?.batchId || entry?.batchEntryId || entry?.id || '').trim().toLowerCase()
      const normalizedCourseId = String(entry?.courseId || '').trim().toLowerCase()
      const normalizedFacultyId = String(entry?.facultyId || facultyId || '').trim().toLowerCase()
      const reportProgress = facultyAcademicBatchProgress.get(normalizedBatchId) ||
        facultyAcademicBatchProgress.get(normalizeWorkStudentId(getFacultyFlowBatchKey(entry)))
      if (reportProgress?.reportSent === true && Number(reportProgress?.total || 0) > 0 && Number(reportProgress?.completed || 0) >= Number(reportProgress.total)) {
        return 0
      }

      const matchedStudents = facultyStudentLifecycleRows
        .filter((student) => student._facultyLifecycle === 'ACTIVE')
        .filter((student) => {
        const context = resolveFacultyBatchContextForStudent(student, facultyBackfillRecords)
        const resolvedBatch = context?.batchEntry || null
        const entryCourse = { id: entry?.courseId, name: entry?.courseName || entry?.course }
        const enrollment = getCourseEnrollmentForStudent(student, entryCourse, entry)

        const studentBatchId = String(student?.batchId || student?.batchEntryId || '').trim().toLowerCase()
        const resolvedBatchId = String(resolvedBatch?.batchId || resolvedBatch?.batchEntryId || resolvedBatch?.id || '').trim().toLowerCase()
        const studentCourseId = String(enrollment?.courseId || student?.courseId || context?.courseId || '').trim().toLowerCase()
        const studentFacultyId = String(student?.facultyId || context?.facultyId || '').trim().toLowerCase()
        const enrollmentBatchId = String(enrollment?.batchId || enrollment?.batchEntryId || '').trim().toLowerCase()

        if (normalizedBatchId) {
          return (
            ((enrollmentBatchId && enrollmentBatchId === normalizedBatchId) ||
              (studentBatchId && studentBatchId === normalizedBatchId) ||
              (resolvedBatchId && resolvedBatchId === normalizedBatchId)) &&
            (!normalizedCourseId || studentCourseId === normalizedCourseId) &&
            (!normalizedFacultyId || studentFacultyId === normalizedFacultyId)
          )
        }

        return false
      })

      return dedupeStudentsWithinBatch(matchedStudents).length
    }
    const assignedCourseOrder = new Map(
      assignedCourses.map((course, index) => [
        normalizeCourseKey(course?.name || course?.courseName || ''),
        index,
      ]),
    )
    const summaryEntries = Array.isArray(summary?.batchEntries) ? summary.batchEntries : []
    const profileEntries = Array.isArray(facultyProfile?.batchEntries) ? facultyProfile.batchEntries : []
    // Branch-assigned batches are authoritative. Do not merge stale legacy
    // faculty-profile batches back into the current branch assignment list.
    const rawEntries = summaryEntries.length ? summaryEntries : profileEntries

    // The dashboard summary can contain batches from the whole branch. A
    // faculty dashboard must only expose batches explicitly assigned to the
    // currently logged-in faculty. An entry without an assignment marker is
    // not safe to show because it may be a branch-wide batch.
    const normalizedFacultyId = String(facultyId || '').trim().toLowerCase()
    const normalizedFacultyName = String(facultyNameValue || '').trim().toLowerCase()
    const normalizedFacultyEmail = String(facultyEmailValue || '').trim().toLowerCase()
    const currentBranchKeys = [currentFacultyIdentity.branchId, currentFacultyIdentity.branchCode]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
    const assignedEntries = rawEntries.filter((entry) => {
      const entryFacultyIds = [
        entry?.facultyId,
        entry?.branchFacultyId,
        entry?.facultyUserId,
        entry?.userId,
        entry?.faculty?.id,
        entry?.faculty?.facultyId,
        entry?.faculty?.facultyUserId,
        entry?.faculty?.userId,
      ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
      const entryFacultyNames = [entry?.facultyName, entry?.branchFacultyName, entry?.faculty?.facultyName, entry?.faculty?.name]
        .map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
      const entryFacultyEmails = [entry?.facultyEmail, entry?.branchFacultyEmail, entry?.faculty?.facultyEmail, entry?.faculty?.email]
        .map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
      const entryBranchKeys = [
        entry?.branchId,
        entry?.branchCode,
        entry?.branchKey,
        entry?.branch?.id,
        entry?.branch?.branchId,
        entry?.branch?.branchCode,
      ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)

      const hasAssignmentMarker = entryFacultyIds.length || entryFacultyNames.length || entryFacultyEmails.length
      if (!hasAssignmentMarker) return false

      // The summary endpoint may include batches from multiple branches. When
      // it does, a batch must carry the current branch identity as well.
      if (currentBranchKeys.length) {
        if (!entryBranchKeys.length || !entryBranchKeys.some((key) => currentBranchKeys.includes(key))) {
          return false
        }
      }

      return (
        (normalizedFacultyId && entryFacultyIds.includes(normalizedFacultyId))
        || (normalizedFacultyName && entryFacultyNames.includes(normalizedFacultyName))
        || (normalizedFacultyEmail && entryFacultyEmails.includes(normalizedFacultyEmail))
      )
    })

    const uniqueEntries = Array.from(
      assignedEntries.reduce((map, entry) => {
        const entryId = String(entry?.id || '').trim()
        const batchCode = String(entry?.batchCode || entry?.code || '').trim().toLowerCase()
        const batchName = String(entry?.batchName || entry?.batch || '').trim().toLowerCase()
        const courseId = String(entry?.courseId || '').trim().toLowerCase()
        const courseName = String(entry?.courseName || entry?.course || '').trim().toLowerCase()
        const batchTiming = String(entry?.batchTiming || entry?.timing || '').trim().toLowerCase()
        const key =
          entryId ||
          `${courseId || courseName}-${batchCode || batchName}-${batchTiming}`.trim() ||
          `${courseName}-${batchTiming}`.trim()

        if (!map.has(key)) {
          map.set(key, entry)
          return map
        }

        const existing = map.get(key) || {}
        map.set(key, {
          ...existing,
          ...entry,
          id: existing.id || entry.id,
        })
        return map
      }, new Map()).values(),
    )

    const compareTimings = (leftValue = '', rightValue = '') =>
      String(leftValue || '').trim().localeCompare(String(rightValue || '').trim(), undefined, { numeric: true, sensitivity: 'base' })

    const matchedEntries = uniqueEntries
      .slice()
      .sort((left, right) => {
        const leftCourseName = normalizeCourseKey(left?.courseName || left?.course || '')
        const rightCourseName = normalizeCourseKey(right?.courseName || right?.course || '')
        const leftCourseOrder = assignedCourseOrder.has(leftCourseName)
          ? assignedCourseOrder.get(leftCourseName)
          : Number.MAX_SAFE_INTEGER
        const rightCourseOrder = assignedCourseOrder.has(rightCourseName)
          ? assignedCourseOrder.get(rightCourseName)
          : Number.MAX_SAFE_INTEGER

        if (leftCourseOrder !== rightCourseOrder) {
          return leftCourseOrder - rightCourseOrder
        }

        const courseNameCompare = String(left?.course || left?.courseName || '').trim().localeCompare(
          String(right?.course || right?.courseName || '').trim(),
          undefined,
          { numeric: true, sensitivity: 'base' },
        )
        if (courseNameCompare !== 0) {
          return courseNameCompare
        }

        const timingCompare = compareTimings(left?.batchTiming || left?.timing || '', right?.batchTiming || right?.timing || '')
        if (timingCompare !== 0) {
          return timingCompare
        }

        return String(left?.batchName || left?.batch || left?.id || '').trim().localeCompare(
          String(right?.batchName || right?.batch || right?.id || '').trim(),
          undefined,
          { numeric: true, sensitivity: 'base' },
        )
      })
      .map((entry) => {
        return {
          id: String(entry?.batchId || entry?.batchEntryId || entry?.id || `${entry?.courseId || 'course'}-${entry?.batchName || entry?.batch || 'batch'}`).trim(),
          courseId: String(entry?.courseId || '').trim(),
          facultyId: String(entry?.facultyId || entry?.branchFacultyId || '').trim(),
          branchId: String(entry?.branchId || '').trim(),
          batchEntryId: String(entry?.batchEntryId || entry?.id || '').trim(),
          batchCode: String(entry?.batchCode || entry?.code || '').trim(),
          course: String(entry?.courseName || entry?.course || '-').trim() || '-',
          batchId: String(entry?.batchId || entry?.batchEntryId || entry?.id || '').trim(),
          batchName: String(entry?.batchName || entry?.batch || entry?.code || entry?.id || '').trim() || '-',
          code: String(entry?.batchCode || entry?.code || entry?.id || '-').trim() || '-',
          timing: String(entry?.batchTiming || entry?.timing || '-').trim() || '-',
          startTime: String(entry?.startTime || entry?.fromTime || '').trim(),
          startPeriod: String(entry?.startPeriod || '').trim().toUpperCase(),
          endTime: String(entry?.endTime || entry?.toTime || '').trim(),
          endPeriod: String(entry?.endPeriod || '').trim().toUpperCase(),
          weekType: normalizeFacultyBatchWeekType(entry),
          students: getBatchStudentCount(entry),
          status: String(entry?.status || 'Active').trim() || 'Active',
        }
      })

    if (matchedEntries.length) {
      return matchedEntries
    }

    // Do not reconstruct rows from student records when the API returned
    // batches but none of them belongs to this faculty. That fallback would
    // make an unassigned faculty appear to have branch batches again.
    if (rawEntries.length && !assignedEntries.length) {
      return []
    }

    // Never infer a batch from student records. Students can retain legacy or
    // cross-branch batch references; only an explicit faculty batch
    // assignment is valid for this dashboard.
    return []
  }, [backfilledStudents, currentFacultyIdentity.branchCode, currentFacultyIdentity.branchId, currentFacultyIdentity.facultyEmail, currentFacultyIdentity.facultyId, currentFacultyIdentity.facultyName, facultyAcademicBatchProgress, facultyProfile?.batchEntries, dashboardSummary, facultyScopedStudents, facultyStudentLifecycleRows])

  const facultyCourseRows = useMemo(() => {
    return assignedCourses.map((course) => {
      const relatedBatches = facultyBatchRows.filter((batch) => doesFacultyBatchBelongToCourse(batch, course))
      const totalBatches = new Set(relatedBatches.map((batch) => getFacultyFlowBatchKey(batch)).filter(Boolean)).size

      return {
        ...course,
        totalBatches,
      }
    })
  }, [assignedCourses, facultyBatchRows])

  const selectedStudentsCourse = useMemo(() => {
    const normalizedCourseId = String(selectedStudentsCourseId || '').trim()
    if (!normalizedCourseId) return null

    return facultyCourseRows.find((course) => getFacultyFlowCourseKey(course) === normalizedCourseId)
      || assignedCourses.find((course) => getFacultyFlowCourseKey(course) === normalizedCourseId)
      || (temporarySessionContext?.item?.courseId === normalizedCourseId
        ? { id: normalizedCourseId, courseId: normalizedCourseId, name: temporarySessionContext.item.courseName, courseName: temporarySessionContext.item.courseName }
        : null)
  }, [assignedCourses, facultyCourseRows, selectedStudentsCourseId, temporarySessionContext])

  const selectedStudentsCourseBatches = useMemo(() => {
    if (!selectedStudentsCourse) return []

    const assignedBatches = facultyBatchRows.filter((batch) => doesFacultyBatchBelongToCourse(batch, selectedStudentsCourse))
    const inferredBatches = facultyLifecycleVisibleStudents
      .filter((student) => student?._facultyLifecycle === 'ACTIVE')
      .map((student) => {
        const enrollment = getCourseEnrollmentForStudent(student, selectedStudentsCourse)
        const context = resolveFacultyBatchContextForStudent(student, facultyBackfillRecords)
        const batch = context?.batchEntry || {}
        const courseId = enrollment?.courseId || student?.courseId || context?.courseId || ''
        const courseName = enrollment?.courseName || student?.courseName || student?.courseInterested || context?.courseName || ''
        const belongsToCourse = (selectedStudentsCourse?.id && String(courseId).trim() === String(selectedStudentsCourse.id).trim())
          || (selectedStudentsCourse?.name && normalizeCourseKey(courseName) === normalizeCourseKey(selectedStudentsCourse.name))
        if (!belongsToCourse) return null
        const batchId = enrollment?.batchId || student?.batchId || student?.batchEntryId || batch?.batchId || batch?.id || ''
        const batchName = enrollment?.batchName || student?.batchName || batch?.batchName || batch?.name || ''
        if (!batchId && !batchName) return null
        return {
          id: String(batchId || batchName).trim(),
          batchId: String(batchId).trim(),
          batchEntryId: String(batch?.id || student?.batchEntryId || '').trim(),
          batchName: String(batchName || batchId).trim(),
          courseId: String(courseId).trim(),
          courseName: String(courseName).trim(),
          batchTiming: enrollment?.batchTiming || student?.batchTiming || batch?.batchTiming || '',
          weekType: enrollment?.scheduleType || student?.classSchedule || batch?.weekType || '',
        }
      })
      .filter(Boolean)
      .reduce((rows, batch) => {
        const key = getFacultyFlowBatchKey(batch)
        if (key && !rows.some((entry) => getFacultyFlowBatchKey(entry) === key)) rows.push(batch)
        return rows
      }, [])
    const availableBatches = assignedBatches.length ? assignedBatches : inferredBatches
    const temporaryBatchId = String(temporarySessionContext?.item?.batchId || temporarySessionContext?.item?.id || '').trim()
    const selectedTemporaryBatch = temporaryBatchId && String(selectedStudentsBatchId || '').trim() === temporaryBatchId
      ? {
      ...temporarySessionContext.item,
      id: temporaryBatchId,
      batchEntryId: temporaryBatchId,
      timing: `${temporarySessionContext.item.effectiveStartTime || ''} - ${temporarySessionContext.item.effectiveEndTime || ''}`.trim(),
      batchTiming: `${temporarySessionContext.item.effectiveStartTime || ''} - ${temporarySessionContext.item.effectiveEndTime || ''}`.trim(),
      }
      : null
    if (selectedTemporaryBatch) return [selectedTemporaryBatch, ...availableBatches.filter((batch) => getFacultyFlowBatchKey(batch) !== temporaryBatchId)]
    if (availableBatches.length || !temporarySessionContext?.item) return availableBatches
    return [{
      ...temporarySessionContext.item,
      id: temporaryBatchId,
      batchEntryId: temporaryBatchId,
      timing: `${temporarySessionContext.item.effectiveStartTime || ''} - ${temporarySessionContext.item.effectiveEndTime || ''}`.trim(),
      batchTiming: `${temporarySessionContext.item.effectiveStartTime || ''} - ${temporarySessionContext.item.effectiveEndTime || ''}`.trim(),
    }]
  }, [facultyBackfillRecords, facultyBatchRows, facultyLifecycleVisibleStudents, selectedStudentsBatchId, selectedStudentsCourse, temporarySessionContext])

  useEffect(() => {
    const batchesToLoad = selectedStudentsCourseBatches.length ? selectedStudentsCourseBatches : facultyBatchRows
    if (!batchesToLoad.length) {
      // Keep the last known report progress. Once a batch becomes completed it
      // may disappear from the active-batch rows, but Completed Student Records
      // still needs that report to classify its students correctly.
      return undefined
    }

    let active = true
    const loadBatchAcademicProgress = async () => {
      const next = new Map()
      await Promise.all(batchesToLoad.map(async (batch) => {
        const candidates = [...new Set([batch?.id, batch?.batchId, batch?.batchEntryId].map((value) => String(value || '').trim()).filter(Boolean))]
        let report = null
        for (const candidate of candidates) {
          try {
            report = await getAcademicBatchReport(candidate)
            if (report) break
          } catch {
            // Try the next batch identifier shape.
          }
        }
        if (!report) return
        const reportStudentProgress = (Array.isArray(report.students) ? report.students : []).map((row) => {
          const tests = Array.isArray(row?.tests) ? row.tests : []
          const projects = Array.isArray(row?.projects)
            ? row.projects
            : (row?.project ? [row.project] : [])
          const completedTests = tests.filter((test) => {
            const statusRows = [
              test?.final,
              ...(Array.isArray(test?.attempts) ? test.attempts : []),
              ...(Array.isArray(test?.retestAttempts) ? test.retestAttempts : []),
            ]
            const projectCompleted = projects.some((project) => (
              Number(project?.testNumber) === Number(test?.testNumber) &&
              project?.marksAwarded != null
            ))
            const testCompleted = statusRows.some((item) => (
              ['SUBMITTED', 'EVALUATED'].includes(String(item?.status || '').toUpperCase())
            ))
            return testCompleted && (test?.testType !== 'TEST_AND_PROJECT' || projectCompleted)
          }).length
          const standaloneProjectCount = projects.filter((project) => (
            project?.marksAwarded != null &&
            !tests.some((test) => Number(test?.testNumber) === Number(project?.testNumber) && test?.testType === 'TEST_AND_PROJECT')
          )).length
          return {
            completed: completedTests + standaloneProjectCount,
            studentKeys: [row?.student?.studentId, row?.student?.id, row?.student?.emailAddress, row?.studentId, row?.id, row?.emailAddress]
              .map((value) => normalizeWorkStudentId(value || ''))
              .filter(Boolean),
          }
        })
        const studentCounts = reportStudentProgress.map((item) => item.completed)
        const completedStudentKeys = reportStudentProgress
          .filter((item) => item.completed > 0)
          .flatMap((item) => item.studentKeys)
        const courseForBatch = selectedStudentsCourse || { id: batch?.courseId, name: batch?.courseName || batch?.course }
        const matchingStudents = getFacultyBatchStudentRecords(facultyScopedStudents, {
          facultyName: currentFacultyIdentity.facultyName,
          facultyId: currentFacultyIdentity.facultyId,
          courseId: courseForBatch?.id || courseForBatch?.courseId || batch?.courseId,
          courseName: courseForBatch?.name || courseForBatch?.courseName || batch?.courseName || batch?.course,
          batchName: batch?.batchName || batch?.name || batch?.code,
          batchId: batch?.id || batch?.batchId || batch?.batchEntryId,
        })
        const total = matchingStudents.reduce((maximum, student) => {
          const progress = getFacultyStudentLifecycle(student, courseForBatch, batch).academicTestProgress || {}
          return Math.max(maximum, Number(progress.totalEvaluations ?? ((progress.totalTests || progress.total || 0) + (progress.totalProjects || 0))) || 0)
        }, 0)
        const completed = studentCounts.length ? Math.min(...studentCounts) : 0
        const batchProgress = {
          completed,
          total: total || Math.max(completed, report.tests?.length || 0),
          reportStudentCount: reportStudentProgress.length,
          activeStudentCount: matchingStudents.length,
          completedStudentKeys,
          reportSent: isAcademicReportFullySent(report),
        }
        const batchKey = getFacultyFlowBatchKey(batch)
        next.set(batchKey, batchProgress)
        const normalizedBatchKey = normalizeWorkStudentId(batchKey)
        if (normalizedBatchKey && normalizedBatchKey !== batchKey) next.set(normalizedBatchKey, batchProgress)
        completedStudentKeys.forEach((studentKey) => next.set(studentKey, batchProgress))
      }))
      if (active) {
        // A failed/empty report response must not preserve an old reportSent
        // value; otherwise a batch can be marked complete before every report
        // is actually sent.
        setFacultyAcademicBatchProgress(next)
      }
    }
    void loadBatchAcademicProgress()
    const refresh = () => void loadBatchAcademicProgress()
    window.addEventListener('cispro:faculty-dashboard-refresh', refresh)
    return () => {
      active = false
      window.removeEventListener('cispro:faculty-dashboard-refresh', refresh)
    }
  }, [currentFacultyIdentity.facultyId, currentFacultyIdentity.facultyName, facultyBatchRows, facultyScopedStudents, selectedStudentsCourse, selectedStudentsCourseBatches])

  const filteredStudentsCourseBatches = useMemo(() => {
    const query = studentsBatchSearch.trim().toLowerCase()
    return selectedStudentsCourseBatches.filter((batch) => {
      const batchName = String(batch.batchName || batch.name || batch.code || '').toLowerCase()
      const matchesSearch = !query || batchName.includes(query)
      return matchesSearch
    })
  }, [facultyBackfillRecords, facultyLifecycleVisibleStudents, selectedStudentsCourse, selectedStudentsCourseBatches, studentsBatchSearch])

  const filteredFacultyBatchRows = useMemo(() => {
    if (facultyBatchWeekTypeFilter === 'all') return facultyBatchRows
    return facultyBatchRows.filter((batch) => normalizeFacultyBatchWeekType(batch).toLowerCase() === facultyBatchWeekTypeFilter)
  }, [facultyBatchRows, facultyBatchWeekTypeFilter])

  const selectedStudentsBatch = useMemo(() => {
    const normalizedBatchId = String(selectedStudentsBatchId || '').trim()
    if (!normalizedBatchId) return null

    return selectedStudentsCourseBatches.find((batch) => getFacultyFlowBatchKey(batch) === normalizedBatchId) || null
  }, [selectedStudentsBatchId, selectedStudentsCourseBatches])

  const selectedStudentsBatchProgress = useMemo(() => {
    if (!selectedStudentsBatch) return null
    const batchKey = getFacultyFlowBatchKey(selectedStudentsBatch)
    return facultyAcademicBatchProgress.get(batchKey) ||
      facultyAcademicBatchProgress.get(normalizeWorkStudentId(batchKey)) ||
      null
  }, [facultyAcademicBatchProgress, selectedStudentsBatch])

  const selectedStudentsBatchCycleStatus = String(selectedStudentsBatch?.currentCycleStatus || '').toUpperCase()
  const selectedStudentsBatchHasActiveCycle = ['ACTIVE', 'PLANNED'].includes(selectedStudentsBatchCycleStatus)
  const selectedStudentsBatchCompleted = Boolean(selectedStudentsBatch) &&
    !selectedStudentsBatchHasActiveCycle &&
    selectedStudentsBatchProgress?.reportSent === true && (
    String(selectedStudentsBatch?.completionStatus || '').toUpperCase() === 'COMPLETED' ||
    selectedStudentsBatchCycleStatus === 'COMPLETED' ||
    (Number(selectedStudentsBatchProgress?.total || 0) > 0 &&
      Number(selectedStudentsBatchProgress?.completed || 0) >= Number(selectedStudentsBatchProgress.total))
  )

  useEffect(() => {
    if (!selectedStudentsBatch || !selectedStudentsBatchCompleted) {
      setBatchCompletionPopup(null)
      return
    }

    const batchKey = getFacultyFlowBatchKey(selectedStudentsBatch)
    const cycleKey = String(
      selectedStudentsBatch?.currentCycleId ||
      selectedStudentsBatch?.activeCycleId ||
      selectedStudentsBatch?.currentCycleNumber ||
      selectedStudentsBatch?.currentCycleName ||
      selectedStudentsBatch?.currentCycleStatus ||
      'completed',
    ).trim()
    const noticeKey = `${batchKey}:${cycleKey}`

    if (batchCompletionNoticeKeyRef.current === noticeKey) return

    batchCompletionNoticeKeyRef.current = noticeKey
    setBatchCompletionPopup({
      batchName: selectedStudentsBatch?.batchName || selectedStudentsBatch?.code || 'This batch',
    })
  }, [selectedStudentsBatch, selectedStudentsBatchCompleted])

  useEffect(() => {
    const batchId = String(selectedStudentsBatch?.id || selectedStudentsBatch?.batchId || '').trim()
    if (!batchId) {
      setFacultyAcademicReportProgress(new Map())
      return undefined
    }

    let active = true
    const batchCandidates = [...new Set([
      selectedStudentsBatch?.id,
      selectedStudentsBatch?.batchId,
      selectedStudentsBatch?.batchEntryId,
    ].map((value) => String(value || '').trim()).filter(Boolean))]
    const loadReport = async () => {
      let report = null
      for (const candidate of batchCandidates) {
        try {
          report = await getAcademicBatchReport(candidate)
          if (report) break
        } catch {
          // Try the next batch identifier shape used by the faculty summary.
        }
      }
      if (!report) throw new Error('Academic report unavailable')
      return report
    }
    loadReport()
      .then((report) => {
        if (!active) return
        const progressByStudent = new Map()
        ;(Array.isArray(report?.students) ? report.students : []).forEach((row) => {
          const studentKeys = [row?.student?.studentId, row?.student?.id, row?.student?.emailAddress]
            .map((value) => normalizeWorkStudentId(value || ''))
            .filter(Boolean)
          if (!studentKeys.length) return
          const tests = Array.isArray(row?.tests) ? row.tests : []
          const projects = Array.isArray(row?.projects)
            ? row.projects
            : (row?.project ? [row.project] : [])
          const completedTests = tests.filter((test) => {
            const statusRows = [
              test?.final,
              ...(Array.isArray(test?.attempts) ? test.attempts : []),
              ...(Array.isArray(test?.retestAttempts) ? test.retestAttempts : []),
            ]
            const testCompleted = statusRows.some((item) => (
              ['SUBMITTED', 'EVALUATED'].includes(String(item?.status || '').toUpperCase())
            ))
            const projectCompleted = projects.some((project) => (
              Number(project?.testNumber) === Number(test?.testNumber) &&
              project?.marksAwarded != null
            ))
            return testCompleted && (test?.testType !== 'TEST_AND_PROJECT' || projectCompleted)
          }).length
          const standaloneProjectCompleted = projects.some((project) => (
            project?.marksAwarded != null &&
            !tests.some((test) => Number(test?.testNumber) === Number(project?.testNumber) && test?.testType === 'TEST_AND_PROJECT')
          ))
          studentKeys.forEach((key) => progressByStudent.set(key, {
            completedEvaluations: completedTests + (standaloneProjectCompleted ? 1 : 0),
            reportSent: isAcademicReportFullySent(report),
          }))
        })
        setFacultyAcademicReportProgress(progressByStudent)
      })
      .catch(() => {
        if (active) setFacultyAcademicReportProgress(new Map())
      })

    return () => {
      active = false
    }
  }, [selectedStudentsBatch?.batchId, selectedStudentsBatch?.id])

  const attendanceDate = getAttendanceDateKey(attendanceClock)

  useEffect(() => {
    const batch = selectedStudentsBatch
    const batchIds = new Set([
      batch?.id,
      batch?.batchEntryId,
      batch?.batchId,
    ].map((value) => String(value || '').trim()).filter(Boolean))

    if (!batch || !batchIds.size || !attendanceDate) {
      setActiveTemporaryAttendanceSession(null)
      return undefined
    }

    let active = true
    setActiveTemporaryAttendanceSession(null)
    getFacultyCalendar({ startDate: attendanceDate, endDate: attendanceDate })
      .then((calendar) => {
        if (!active) return
        const events = Array.isArray(calendar?.events) ? calendar.events : []
        const courseIds = new Set([
          batch.courseId,
          selectedStudentsCourse?.id,
          selectedStudentsCourse?.courseId,
        ].map((value) => String(value || '').trim()).filter(Boolean))
        const candidates = events.filter((event) => {
          const eventBatchIds = [event?.batchRecordId, event?.batchId]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
          const batchMatches = eventBatchIds.some((value) => batchIds.has(value))
          const courseMatches = !courseIds.size || !event?.courseId || courseIds.has(String(event.courseId).trim())
          const temporaryCode = ['RESCHEDULED', 'RESCHEDULED_ORIGINAL', 'REASSIGNED', 'COMBINED'].includes(String(event?.code || '').toUpperCase())
          return batchMatches && courseMatches && temporaryCode && String(event?.date || '').slice(0, 10) === attendanceDate
        })
        const session = candidates.find((event) => String(event?.code || '').toUpperCase() !== 'RESCHEDULED_ORIGINAL')
          || candidates.find((event) => String(event?.code || '').toUpperCase() === 'RESCHEDULED_ORIGINAL')
        setActiveTemporaryAttendanceSession(session
          ? {
            ...session,
            isOriginalRescheduledSession: String(session.code || '').toUpperCase() === 'RESCHEDULED_ORIGINAL',
          }
          : null)
      })
      .catch(() => {
        if (active) setActiveTemporaryAttendanceSession(null)
      })

    return () => {
      active = false
    }
  }, [attendanceDate, selectedStudentsBatch, selectedStudentsCourse])

  const attendanceBatchTiming = activeTemporaryAttendanceSession && !activeTemporaryAttendanceSession.isOriginalRescheduledSession
    ? `${activeTemporaryAttendanceSession.startTime || ''} - ${activeTemporaryAttendanceSession.endTime || ''}`.trim()
    : activeTemporaryAttendanceSession?.isOriginalRescheduledSession
      ? ''
      : getAttendanceBatchTiming(selectedStudentsBatch)

  useEffect(() => {
    if (!selectedStudentsCourse || !currentFacultyIdentity.facultyId) {
      if (studentAttendanceContextRef.current) {
        studentAttendanceContextRef.current = ''
        setStudentAttendanceStatuses({})
      }
      return undefined
    }

    let active = true
    const attendanceContextKey = [
      attendanceDate,
      selectedStudentsCourse?.id || selectedStudentsCourse?.courseId || '',
      selectedStudentsBatch?.batchId || selectedStudentsBatch?.batchEntryId || selectedStudentsBatch?.id || '',
    ].join('|')
    if (studentAttendanceContextRef.current !== attendanceContextKey) {
      studentAttendanceContextRef.current = attendanceContextKey
      setStudentAttendanceStatuses({})
    }
    const loadStudentAttendance = async () => {
      try {
        const overview = await getCurrentFacultyAttendanceOverview({
          date: attendanceDate,
          facultyId: currentFacultyIdentity.facultyId,
          courseId: selectedStudentsCourse?.id || selectedStudentsCourse?.courseId || '',
          batchId: selectedStudentsBatch?.batchId || selectedStudentsBatch?.batchEntryId || selectedStudentsBatch?.id || '',
        })
        if (active) {
          const refreshedStatuses = extractStudentAttendanceStatuses(overview)
          // Keep the just-saved local status when an immediate refresh still
          // returns a stale or incomplete attendance overview.
          setStudentAttendanceStatuses((current) => ({
            ...current,
            ...refreshedStatuses,
          }))
        }
      } catch {
        // Keep the last known status visible when a refresh fails. A failed
        // refresh must not make a marked student flash back to Unmarked.
      }
    }

    const refresh = () => void loadStudentAttendance()
    void loadStudentAttendance()
    window.addEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, refresh)
    window.addEventListener('cispro:faculty-dashboard-refresh', refresh)
    return () => {
      active = false
      window.removeEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, refresh)
      window.removeEventListener('cispro:faculty-dashboard-refresh', refresh)
    }
  }, [attendanceDate, currentFacultyIdentity.facultyId, selectedStudentsBatch, selectedStudentsCourse, selectedStudentsCourse?.courseId, selectedStudentsCourse?.id])

  const selectedBatchStudents = useMemo(() => {
    if (temporarySessionContext?.students?.length && selectedStudentsBatch?.batchId === temporarySessionContext.item?.batchId) return temporarySessionContext.students
    if (!selectedStudentsBatch) return []
    const academicProgress = facultyAcademicBatchProgress.get(getFacultyFlowBatchKey(selectedStudentsBatch)) ||
      facultyAcademicBatchProgress.get(normalizeWorkStudentId(getFacultyFlowBatchKey(selectedStudentsBatch)))
    if (academicProgress?.reportSent === true && Number(academicProgress?.total || 0) > 0 && Number(academicProgress?.completed || 0) >= Number(academicProgress.total)) return []
    return getFacultyBatchProgressStudents(
      selectedStudentsBatch,
      selectedStudentsCourse,
      facultyLifecycleVisibleStudents,
      facultyBackfillRecords,
    )
  }, [
    facultyAcademicBatchProgress,
    facultyBackfillRecords,
    facultyLifecycleVisibleStudents,
    selectedStudentsBatch,
    selectedStudentsCourse,
    temporarySessionContext,
  ])

  const selectedCourseBatchProgress = useMemo(() => {
    const progressByBatch = new Map()
    if (!selectedStudentsCourse) return progressByBatch

    selectedStudentsCourseBatches.forEach((batch) => {
      const batchStudents = getFacultyBatchProgressStudents(
        batch,
        selectedStudentsCourse,
        facultyScopedStudents,
        facultyBackfillRecords,
      )
      const progressValues = batchStudents.map((student) => {
        // Resolve work against the current batch row, not only the global
        // student map. This keeps progress visible when old student records
        // do not contain a batch ID.
        const progressStudent = {
          ...student,
          batchId: batch?.batchId || batch?.id || student?.batchId || student?.batchEntryId || '',
          batchName: batch?.batchName || batch?.code || student?.batchName || student?.batch || '',
          batchTiming: batch?.timing || batch?.batchTiming || student?.batchTiming || student?.batchTime || '',
        }
        const workEntry = getFacultyTodayWorkEntriesForStudent(
          facultyTodayWorkEntries,
          progressStudent,
          selectedStudentsCourse?.id || selectedStudentsCourse?.courseId || '',
        )[0] || null
        // Today Work API is the source of truth for faculty progress. A stale
        // value on the student record must not appear as completed work when
        // no matching database entry exists for this batch and course.
        const progressSummary = workEntry
          ? buildFacultyTodayWorkProgressSummary(
              facultyTodayWorkEntries,
              selectedStudentsCourse,
              progressStudent,
            )
          : null
        const storedProgress = Number(
          getCourseEnrollmentForStudent(progressStudent, selectedStudentsCourse, batch)?.courseProgress ??
          progressStudent?.courseProgress,
        )
        if (progressSummary?.courseProgress != null) {
          return Math.max(
            Math.min(100, Math.max(0, Number(progressSummary.courseProgress))),
            Number.isFinite(storedProgress) ? Math.min(100, Math.max(0, storedProgress)) : 0,
          )
        }
        return Number.isFinite(storedProgress) ? Math.min(100, Math.max(0, storedProgress)) : null
      }).filter((value) => Number.isFinite(value))
      const batchProgress = progressValues.length
        ? Math.min(100, Math.max(0, progressValues.reduce((total, value) => total + value, 0) / progressValues.length))
        : 0

      progressByBatch.set(getFacultyFlowBatchKey(batch), Math.round(batchProgress))
    })

    return progressByBatch
  }, [
    facultyBackfillRecords,
    facultyScopedStudents,
    facultyTodayWorkEntries,
    selectedStudentsCourse,
    selectedStudentsCourseBatches,
  ])

  const facultyAllCourseBatchProgress = useMemo(() => {
    const progressByBatch = new Map()
    facultyBatchRows.forEach((batch) => {
      const course = assignedCourses.find((item) => doesFacultyBatchBelongToCourse(batch, item))
      const batchStudents = getFacultyBatchProgressStudents(batch, course, facultyScopedStudents, facultyBackfillRecords)
      const progressValues = batchStudents.map((student) => {
        const progressStudent = {
          ...student,
          batchId: batch?.batchId || batch?.id || student?.batchId || student?.batchEntryId || '',
          batchName: batch?.batchName || batch?.code || student?.batchName || student?.batch || '',
          batchTiming: batch?.timing || batch?.batchTiming || student?.batchTiming || student?.batchTime || '',
        }
        const workEntry = getFacultyTodayWorkEntriesForStudent(
          facultyTodayWorkEntries,
          progressStudent,
          course?.id || course?.courseId || '',
        )[0] || null
        if (workEntry && course) {
          const summary = buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, course, progressStudent)
          if (summary?.courseProgress != null) return Number(summary.courseProgress)
        }
        const storedProgress = Number(student?.courseProgress)
        return Number.isFinite(storedProgress) ? storedProgress : null
      }).filter((value) => Number.isFinite(value))
      if (progressValues.length) {
        progressByBatch.set(getFacultyFlowBatchKey(batch), Math.round(progressValues.reduce((total, value) => total + value, 0) / progressValues.length))
      }
    })
    selectedCourseBatchProgress.forEach((value, key) => progressByBatch.set(key, value))
    // A fully completed academic batch starts its next preparation cycle at
    // zero. Keep the historical marks/reports intact; only the next-cycle
    // preparation progress is reset.
    progressByBatch.forEach((value, key) => {
      const academicProgress = facultyAcademicBatchProgress.get(key) ||
        facultyAcademicBatchProgress.get(normalizeWorkStudentId(key))
      if (academicProgress?.reportSent === true && Number(academicProgress?.total || 0) > 0 && Number(academicProgress?.completed || 0) >= Number(academicProgress.total)) {
        progressByBatch.set(key, 0)
      }
    })
    return progressByBatch
  }, [assignedCourses, facultyAcademicBatchProgress, facultyBackfillRecords, facultyBatchRows, facultyScopedStudents, facultyTodayWorkEntries, selectedCourseBatchProgress])

  const studentsFlowVisibleStudents = selectedStudentsBatch ? selectedBatchStudents : facultyLifecycleVisibleStudents
  const studentsFlowActionableStudents = studentsFlowVisibleStudents.filter((student) => !isDiscontinuedStudent(student))
  const todayWorkPresentStudents = useMemo(
    () => studentsFlowActionableStudents.filter((student) => (
      String(
        todayWorkForm.attendanceByStudent?.[getTodayWorkStudentId(student)]
          || getCurrentStudentAttendanceStatus(studentAttendanceStatuses, student)
          || '',
      ).trim().toUpperCase() === 'PRESENT'
    )),
    [studentAttendanceStatuses, studentsFlowActionableStudents, todayWorkForm.attendanceByStudent],
  )
  const studentsFlowLevel = selectedStudentsBatch ? 3 : selectedStudentsCourse ? 2 : 1
  const todayWorkCourse = useMemo(() => {
    if (studentsFlowLevel === 3) {
      return selectedStudentsCourse || null
    }

    return selectedCourse
  }, [selectedCourse, selectedStudentsCourse, studentsFlowLevel])
  const todayWorkCourseModules = useMemo(() => getCourseModels(todayWorkCourse), [todayWorkCourse])

  useEffect(() => {
    if (
      selectedStudentsCourseId &&
      !temporarySessionContext &&
      !facultyCourseRows.some((course) => getFacultyFlowCourseKey(course) === String(selectedStudentsCourseId || '').trim())
    ) {
      setSelectedStudentsCourseId('')
      setSelectedStudentsBatchId('')
    }
  }, [facultyCourseRows, selectedStudentsCourseId, temporarySessionContext])

  useEffect(() => {
    if (
      selectedStudentsBatchId &&
      !temporarySessionContext &&
      !selectedStudentsCourseBatches.some((batch) => getFacultyFlowBatchKey(batch) === String(selectedStudentsBatchId || '').trim())
    ) {
      setSelectedStudentsBatchId('')
    }
  }, [selectedStudentsBatchId, selectedStudentsCourseBatches, temporarySessionContext])

  const studentsPerPage = 5
  const studentsTotalPages = Math.max(1, Math.ceil(studentsFlowVisibleStudents.length / studentsPerPage))
  const safeStudentsPage = Math.min(Math.max(1, studentsPage), studentsTotalPages)
  const paginatedFacultyStudents = useMemo(() => {
    const startIndex = (safeStudentsPage - 1) * studentsPerPage
    return studentsFlowVisibleStudents.slice(startIndex, startIndex + studentsPerPage)
  }, [safeStudentsPage, studentsFlowVisibleStudents])

  const studentsCourseBatchesPerPage = 5
  const studentsCourseBatchTotalPages = Math.max(1, Math.ceil(filteredStudentsCourseBatches.length / studentsCourseBatchesPerPage))
  const safeStudentsCourseBatchPage = Math.min(Math.max(1, studentsCourseBatchPage), studentsCourseBatchTotalPages)
  const paginatedStudentsCourseBatches = useMemo(() => {
    const startIndex = (safeStudentsCourseBatchPage - 1) * studentsCourseBatchesPerPage
    return filteredStudentsCourseBatches.slice(startIndex, startIndex + studentsCourseBatchesPerPage)
  }, [filteredStudentsCourseBatches, safeStudentsCourseBatchPage])

  const filteredStudentRecords = useMemo(() => {
    const query = studentRecordsSearch.trim().toLowerCase()
    const sourceStudents = facultyLifecycleVisibleStudents
    if (!query) return sourceStudents

    return sourceStudents.filter((student) => [
      student?.studentId,
      student?.studentName,
      student?.courseName,
      student?.batchName,
      student?.facultyName,
    ].some((value) => String(value || '').toLowerCase().includes(query)))
  }, [facultyLifecycleVisibleStudents, studentRecordsSearch])

  const academicColumnDefinitions = useMemo(() => {
    const columns = new Map()
    facultyLifecycleVisibleStudents.forEach((student) => {
      const progress = student?._facultyLifecycleMetrics?.academicTestProgress || student?.academicTestProgress
      ;(progress?.academicResults || []).forEach((result) => {
        const testNumber = Number(result.testNumber)
        if (!Number.isFinite(testNumber)) return
        if (result.testType === 'TEST' || result.testType === 'TEST_AND_PROJECT') {
          columns.set(`test-${testNumber}`, { key: `test-${testNumber}`, label: `Test ${testNumber}`, type: 'test', testNumber })
        }
        if (result.testType === 'PROJECT' || result.testType === 'TEST_AND_PROJECT') {
          columns.set(`project-${testNumber}`, { key: `project-${testNumber}`, label: `Test ${testNumber} (Project)`, type: 'project', testNumber })
        }
      })
    })
    return [
      ...Array.from(columns.values()).sort((left, right) => left.testNumber - right.testNumber || (left.type === 'test' ? -1 : 1)),
      { key: 'overall-test', label: 'Overall Test %', type: 'overall-test' },
      { key: 'overall-project', label: 'Overall Project %', type: 'overall-project' },
    ]
  }, [facultyLifecycleVisibleStudents])

  const studentRecordsPerPage = 5
  const studentRecordsTotalPages = Math.max(1, Math.ceil(filteredStudentRecords.length / studentRecordsPerPage))
  const safeStudentRecordsPage = Math.min(Math.max(1, studentRecordsPage), studentRecordsTotalPages)
  const paginatedStudentRecords = useMemo(() => {
    const startIndex = (safeStudentRecordsPage - 1) * studentRecordsPerPage
    return filteredStudentRecords.slice(startIndex, startIndex + studentRecordsPerPage)
  }, [filteredStudentRecords, safeStudentRecordsPage])

  useEffect(() => {
    setStudentsPage((current) => Math.min(Math.max(1, current), studentsTotalPages))
  }, [studentsTotalPages])

  useEffect(() => {
    setStudentRecordsPage((current) => Math.min(Math.max(1, current), studentRecordsTotalPages))
  }, [studentRecordsTotalPages])

  useEffect(() => {
    setStudentRecordsPage(1)
  }, [studentRecordsSearch])

  useEffect(() => {
    setStudentsPage(1)
  }, [selectedStudentsBatchId, selectedStudentsCourseId])

  useEffect(() => {
    setStudentsCourseBatchPage(1)
  }, [studentsBatchSearch, selectedStudentsCourseId])

  useEffect(() => {
    setStudentsCourseBatchPage((current) => Math.min(Math.max(1, current), studentsCourseBatchTotalPages))
  }, [studentsCourseBatchTotalPages])

  const batchesPerPage = 5
  const totalBatchPages = Math.max(1, Math.ceil(filteredFacultyBatchRows.length / batchesPerPage))
  const safeBatchPage = Math.min(Math.max(1, Number(batchPage) || 1), totalBatchPages)
  const paginatedFacultyBatchRows = useMemo(() => {
    const startIndex = (safeBatchPage - 1) * batchesPerPage
    return filteredFacultyBatchRows.slice(startIndex, startIndex + batchesPerPage)
  }, [filteredFacultyBatchRows, safeBatchPage])

  useEffect(() => {
    setBatchPage((current) => Math.min(Math.max(1, current), totalBatchPages))
  }, [totalBatchPages])

  useEffect(() => {
    setBatchPage(1)
  }, [facultyBatchWeekTypeFilter])

  const selectedCourseModules = useMemo(() => getCourseModels(selectedCourse), [selectedCourse])
  const visibleCourseModules = useMemo(
    () => selectedCourseModules.slice(0, courseModuleLimit),
    [courseModuleLimit, selectedCourseModules],
  )
  const courseEditModules = Array.isArray(courseEditDraft?.modules) ? courseEditDraft.modules : []
  const courseEditActiveModule =
    courseEditModules[courseEditActiveModuleIndex] || courseEditModules[0] || null
  const courseEditActiveModuleSubmodules = Array.isArray(courseEditActiveModule?.submodules)
    ? courseEditActiveModule.submodules
    : []
  const selectedCourseModuleKeys = useMemo(
    () =>
        visibleCourseModules.map((module, index) =>
        String(module?.id || `${selectedCourse?.id || 'course'}-module-${index}`).trim(),
      ),
    [selectedCourse?.id, visibleCourseModules],
  )
  const isAllModulesExpanded =
    selectedCourseModuleKeys.length > 0 &&
    selectedCourseModuleKeys.every((moduleId) => expandedCourseModuleIds.includes(moduleId))

  const todayWorkSelectedModule = useMemo(() => {
    if (!todayWorkCourseModules.length) return null

    const fallbackModule = todayWorkCourseModules[0]
    const normalizedModuleId = String(todayWorkForm.moduleId || fallbackModule?.id || '').trim()

    return todayWorkCourseModules.find((module, index) => {
      const moduleId = String(module?.id || `module-${index}`).trim()
      return moduleId === normalizedModuleId
    }) || fallbackModule || null
  }, [todayWorkCourseModules, todayWorkForm.moduleId])

  const todayWorkSelectedModuleSubmodules = useMemo(
    () => getCourseSubmodules(todayWorkSelectedModule),
    [todayWorkSelectedModule],
  )
  const todayWorkSelectedModuleIndex = Math.max(
    0,
    todayWorkCourseModules.findIndex((module, index) => (
      String(module?.id || `module-${index}`).trim() === String(todayWorkSelectedModule?.id || '').trim()
    )),
  )

  const todayWorkCompletedSubmoduleIds = useMemo(
    () =>
      getCompletedTodayWorkSubmoduleIdsForModule(
        facultyTodayWorkEntries,
        currentFacultyIdentity,
        todayWorkCourse?.id || '',
        todayWorkSelectedModule?.id || '',
        selectedStudentsBatch,
        todayWorkSelectedModuleSubmodules,
      ),
    [
      currentFacultyIdentity.facultyEmail,
      currentFacultyIdentity.facultyId,
      facultyTodayWorkEntries,
      selectedStudentsBatch,
      todayWorkCourse?.id,
      todayWorkSelectedModule?.id,
    ],
  )

  const todayWorkPendingSubmoduleIds = useMemo(() => {
    if (!todayWorkSelectedModuleSubmodules.length) return []

    return todayWorkSelectedModuleSubmodules
      .map((submodule, index) =>
        String(
          submodule?.id || submodule?.submoduleId || `${todayWorkSelectedModule?.id || 'module'}-submodule-${index}`,
        ).trim(),
      )
      .filter((submoduleId) => {
        if (!submoduleId) return false
        const students = studentsFlowVisibleStudents
        if (!students.length) return true
        return !students.every((student) => (
          normalizeSubmoduleProgressStatus(
            todayWorkForm.submoduleStatuses?.[String(student?.id || student?.studentId || '').trim()]?.[submoduleId],
          ) === 'Completed'
        ))
      })
  }, [studentsFlowVisibleStudents, todayWorkForm.submoduleStatuses, todayWorkSelectedModule?.id, todayWorkSelectedModuleSubmodules])

  const todayWorkSelectedStudents = useMemo(() => {
    const selectedIds = new Set(
      (Array.isArray(todayWorkForm.selectedStudentIds) ? todayWorkForm.selectedStudentIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    )

    const selectedStudents = studentsFlowVisibleStudents.filter((student) => {
      const studentKeys = [student?.id, student?.studentId]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
      return studentKeys.some((studentKey) => selectedIds.has(studentKey))
    })

    return selectedStudents
  }, [studentsFlowVisibleStudents, todayWorkForm.selectedStudentIds])

  const todayWorkSelectedModuleCompleteForSelectedStudents = useMemo(() => {
    if (!todayWorkSelectedStudents.length || !todayWorkSelectedModuleSubmodules.length) return false

    const persistedStatuses = getPersistedTodayWorkSubmoduleStatuses(
      facultyTodayWorkEntries,
      currentFacultyIdentity,
      '',
      todayWorkSelectedModule?.id || '',
      selectedStudentsBatch,
      todayWorkSelectedStudents,
      todayWorkSelectedModuleSubmodules,
    )

    return todayWorkSelectedStudents.every((student) => {
      const studentId = getTodayWorkStudentId(student)
      return todayWorkSelectedModuleSubmodules.every((submodule, submoduleIndex) => {
        const submoduleId = String(
          submodule?.id || submodule?.submoduleId || `${todayWorkSelectedModule?.id || 'module'}-submodule-${submoduleIndex}`,
        ).trim()
        const status = todayWorkForm.submoduleStatuses?.[studentId]?.[submoduleId]
          || persistedStatuses?.[studentId]?.[submoduleId]
          || ''
        return normalizeSubmoduleProgressStatus(status) === 'Completed'
      })
    })
  }, [
    currentFacultyIdentity,
    facultyTodayWorkEntries,
    selectedStudentsBatch,
    todayWorkForm.submoduleStatuses,
    todayWorkSelectedModule,
    todayWorkSelectedModuleSubmodules,
    todayWorkSelectedStudents,
  ])

  const todayWorkMissedItems = useMemo(() => {
    const visibleStudents = todayWorkSelectedStudents.length ? todayWorkSelectedStudents : studentsFlowVisibleStudents
    if (!visibleStudents.length || !todayWorkCourseModules.length) return []

    return visibleStudents.flatMap((student) => {
      const studentId = getTodayWorkStudentId(student)
      return todayWorkCourseModules.flatMap((module, moduleIndex) => {
        const moduleId = String(module?.id || `module-${moduleIndex}`).trim()
        const submodules = getCourseSubmodules(module)
        const persisted = getPersistedTodayWorkSubmoduleStatuses(
          facultyTodayWorkEntries,
          currentFacultyIdentity,
          todayWorkCourse?.id || '',
          moduleId,
          selectedStudentsBatch,
          [student],
          submodules,
        )

        return submodules.flatMap((submodule, submoduleIndex) => {
          const submoduleId = String(
            submodule?.id || submodule?.submoduleId || `${moduleId}-submodule-${submoduleIndex}`,
          ).trim()
          const status = persisted[studentId]?.[submoduleId]
            || todayWorkForm.submoduleStatuses?.[studentId]?.[submoduleId]
            || todayWorkForm.submoduleStatusById?.[submoduleId]
            || ''
          if (!status || status === 'Completed') return []
          return [{
            key: `${studentId}-${moduleId}-${submoduleId}`,
            studentId,
            studentName: String(student?.studentName || student?.name || 'Student').trim(),
            moduleId,
            submoduleId,
            moduleName: getTodayWorkModuleLabel(module, moduleIndex),
            submoduleName: getCourseSubmoduleName(submodule, submoduleIndex),
            status,
          }]
        })
      })
    })
  }, [
    currentFacultyIdentity,
    facultyTodayWorkEntries,
    selectedStudentsBatch,
    studentsFlowVisibleStudents,
    todayWorkCourse?.id,
    todayWorkCourseModules,
    todayWorkForm.submoduleStatusById,
    todayWorkForm.submoduleStatuses,
    todayWorkSelectedStudents,
  ])

  const selectTodayWorkMissedItem = (item) => {
    if (!item?.studentId || !item?.moduleId || !item?.submoduleId) return

    const selectedStudent = studentsFlowVisibleStudents.find((student) => [student?.id, student?.studentId]
      .map((value) => String(value || '').trim())
      .includes(String(item.studentId).trim()))
    if (!selectedStudent) return
    const selectedStudentId = getTodayWorkStudentId(selectedStudent)

    const module = todayWorkCourseModules.find((candidate, index) => (
      String(candidate?.id || `module-${index}`).trim() === item.moduleId
    ))
    const persisted = getPersistedTodayWorkSubmoduleStatuses(
      facultyTodayWorkEntries,
      currentFacultyIdentity,
      todayWorkCourse?.id || '',
      item.moduleId,
      selectedStudentsBatch,
      [selectedStudent],
      getCourseSubmodules(module),
    )
    const persistedStudentStatuses = persisted[selectedStudentId] || persisted[item.studentId] || {}
    const completedIds = Object.entries(persistedStudentStatuses)
      .filter(([, status]) => status === 'Completed')
      .map(([submoduleId]) => submoduleId)

    setTodayWorkForm((current) => ({
      ...current,
      moduleId: item.moduleId,
      selectedStudentIds: [selectedStudentId],
      submoduleIds: Array.from(new Set([...completedIds, item.submoduleId])),
      submoduleStatusById: {},
    }))
  }

  const toggleCourseModule = (moduleId) => {
    const normalizedModuleId = String(moduleId || '').trim()
    if (!normalizedModuleId) return

    setExpandedCourseModuleIds((current) =>
      current.includes(normalizedModuleId)
        ? current.filter((id) => id !== normalizedModuleId)
        : [...current, normalizedModuleId],
    )
  }

  const toggleAllCourseModules = () => {
    if (!selectedCourseModuleKeys.length) return

    setExpandedCourseModuleIds(
      isAllModulesExpanded ? [] : selectedCourseModuleKeys,
    )
  }

  const openTemporarySessionWork = (session, sessionStudents, mode = 'attendance') => {
    const item = {
      ...session,
      effectiveDate: session?.effectiveDate || session?.replacementDate || session?.sessionDate,
      effectiveStartTime: session?.effectiveStartTime || session?.replacementStartTime || session?.originalStartTime,
      effectiveEndTime: session?.effectiveEndTime || session?.replacementEndTime || session?.originalEndTime,
    }
    setTemporarySessionContext({ item, students: Array.isArray(sessionStudents) ? sessionStudents : [] })
    setSelectedStudentsCourseId(String(item.courseId || '').trim())
    setSelectedStudentsBatchId(String(item.batchId || '').trim())
    setStudentsPage(1)
    window.setTimeout(() => openTodayWorkModal(mode), 0)
  }

  const openTodayWorkModal = (mode = 'attendance') => {
    if (facultyWeekOffStatus.isWeekOff) {
      showWeekOffValidation()
      return
    }
    setTodayWorkMode(mode)
    const activeTodayWorkCourse = todayWorkCourse || null
    const nextSelection = getNextPendingTodayWorkSelection(
      activeTodayWorkCourse || {},
      facultyTodayWorkEntries,
      currentFacultyIdentity,
      selectedStudentsBatch,
      studentsFlowVisibleStudents,
    )
    const firstModule = nextSelection.module || todayWorkCourseModules[0] || null
    const firstModuleId = String(nextSelection.moduleId || firstModule?.id || '').trim()
    // Students must be chosen explicitly for each attendance submission.
    const selectedStudentIds = []
    const persistedStatuses = getPersistedTodayWorkSubmoduleStatuses(
      facultyTodayWorkEntries,
      currentFacultyIdentity,
      todayWorkCourse?.id || '',
      firstModuleId,
      selectedStudentsBatch,
      studentsFlowVisibleStudents,
      getCourseSubmodules(firstModule),
    )
    // Attendance for today must never overwrite a student's saved submodule history.
    // An absent student can still have earlier completed submodules.
    const persistedSubmoduleStatuses = persistedStatuses
    const persistedSubmoduleIds = Array.from(new Set(
      Object.values(persistedSubmoduleStatuses).flatMap((studentStatuses) => Object.keys(studentStatuses || {})),
    ))
    const initialSubmoduleIds = mode === 'progress'
      ? []
      : Array.from(new Set([
          ...persistedSubmoduleIds,
          ...(Array.isArray(nextSelection.submoduleIds) ? nextSelection.submoduleIds : []),
        ]))
    const statusStudentIds = studentsFlowVisibleStudents
      .map((student) => String(student?.id || student?.studentId || '').trim())
      .filter(Boolean)
    const initialSubmoduleStatuses = Object.fromEntries(statusStudentIds.map((studentId) => [
      studentId,
      Object.fromEntries(initialSubmoduleIds.map((submoduleId) => [
        submoduleId,
        persistedSubmoduleStatuses[studentId]?.[submoduleId] || '',
      ])),
    ]))
    const initialSubmoduleStatusById = mode === 'progress' ? {} : Object.fromEntries(initialSubmoduleIds.map((submoduleId) => {
      const statuses = statusStudentIds
        .map((studentId) => persistedSubmoduleStatuses[studentId]?.[submoduleId])
        .filter(Boolean)
      return [submoduleId, statuses.length && statuses.every((status) => status === statuses[0]) ? statuses[0] : '']
    }))

    setTodayWorkForm({
      applyToAllStudents: false,
      moduleId: firstModuleId,
      submoduleIds: initialSubmoduleIds,
      selectedStudentIds,
      progressPercentage: 0,
      attendanceByStudent: Object.fromEntries(statusStudentIds.map((studentId) => {
        const student = studentsFlowVisibleStudents.find((item) => getTodayWorkStudentId(item) === studentId)
        return [studentId, getCurrentStudentAttendanceStatus(studentAttendanceStatuses, student)]
      })),
      submoduleStatuses: initialSubmoduleStatuses,
      submoduleStatusById: initialSubmoduleStatusById,
    })
    setTodayWorkError('')
    setIsTodayWorkModalOpen(true)
    setAttendanceSavedPrompt(null)
    setTodayWorkAttendanceSearch('')
  }

  const closeTodayWorkModal = () => {
    setIsTodayWorkModalOpen(false)
    setTodayWorkError('')
    setIsTodayWorkSaving(false)
    setIsTodayWorkConfirmOpen(false)
    setPendingTodayWorkSubmission(null)
    setAttendanceSavedPrompt(null)
    setTodayWorkAttendanceSearch('')
  }

  const openStudentViewDrawer = (student) => {
    if (!student) return
    const studentId = String(student?.studentId || student?.studentCode || '').trim().toLowerCase()
    const studentEmail = String(student?.emailAddress || student?.email || '').trim().toLowerCase()
    const fullStudentRecord = students.find((record) => (
      (studentId && String(record?.studentId || record?.studentCode || '').trim().toLowerCase() === studentId) ||
      (studentEmail && String(record?.emailAddress || record?.email || '').trim().toLowerCase() === studentEmail)
    ))
    setViewStudentDrawer(buildFacultyStudentViewRecord({ ...student, ...(fullStudentRecord || {}) }, facultyBackfillRecords))
  }

  const closeStudentViewDrawer = () => {
    setViewStudentDrawer(null)
  }

  const updateTodayWorkModule = (moduleId) => {
    const normalizedModuleId = String(moduleId || '').trim()
    const nextModule = todayWorkCourseModules.find((module, index) => String(module?.id || `module-${index}`).trim() === normalizedModuleId) || null
    const nextSubmodules = getCourseSubmodules(nextModule)
    const completedSubmoduleIds = getCompletedTodayWorkSubmoduleIdsForModule(
      facultyTodayWorkEntries,
      currentFacultyIdentity,
      todayWorkCourse?.id || '',
      normalizedModuleId,
      selectedStudentsBatch,
      nextSubmodules,
    )
    const pendingSubmoduleIds = nextSubmodules
      .map((submodule, index) =>
        String(submodule?.id || submodule?.submoduleId || `${normalizedModuleId || 'module'}-submodule-${index}`).trim(),
      )
      .filter((submoduleId) => submoduleId && !completedSubmoduleIds.includes(submoduleId))

    setTodayWorkForm((current) => ({
      ...current,
      moduleId: normalizedModuleId,
      submoduleIds: Array.from(new Set([
        ...Object.values(getPersistedTodayWorkSubmoduleStatuses(
          facultyTodayWorkEntries,
          currentFacultyIdentity,
          todayWorkCourse?.id || '',
          normalizedModuleId,
          selectedStudentsBatch,
          studentsFlowVisibleStudents,
          nextSubmodules,
        )).flatMap((studentStatuses) => Object.keys(studentStatuses || {})),
        ...(pendingSubmoduleIds.length ? [pendingSubmoduleIds[0]] : []),
      ])),
      submoduleStatuses: Object.fromEntries(studentsFlowVisibleStudents.map((student) => {
        const studentId = getTodayWorkStudentId(student)
        const persisted = getPersistedTodayWorkSubmoduleStatuses(
          facultyTodayWorkEntries,
          currentFacultyIdentity,
          todayWorkCourse?.id || '',
          normalizedModuleId,
          selectedStudentsBatch,
          [student],
          nextSubmodules,
        )
        const selectedIds = Array.from(new Set([
          ...Object.keys(persisted[studentId] || {}),
          ...(pendingSubmoduleIds.length ? [pendingSubmoduleIds[0]] : []),
        ]))
        return [studentId, Object.fromEntries(selectedIds.map((id) => [id, persisted[studentId]?.[id] || '']))]
      })),
      submoduleStatusById: {},
    }))
  }

  const toggleTodayWorkSubmodule = (submoduleId) => {
    const normalizedSubmoduleId = String(submoduleId || '').trim()
    if (!normalizedSubmoduleId) return
    const currentIds = Array.isArray(todayWorkForm.submoduleIds) ? todayWorkForm.submoduleIds : []
    const hasSubmodule = currentIds.includes(normalizedSubmoduleId)
    const nextIds = hasSubmodule ? currentIds.filter((id) => id !== normalizedSubmoduleId) : [...currentIds, normalizedSubmoduleId]
    const lastSelectedSubmoduleId = nextIds[nextIds.length - 1] || ''
    const nextStatuses = Object.fromEntries((todayWorkForm.selectedStudentIds || []).map((studentId) => {
      const currentStatuses = todayWorkForm.submoduleStatuses?.[studentId] || {}
      return [studentId, Object.fromEntries(nextIds.map((id) => [
        id,
        id === lastSelectedSubmoduleId
          ? (hasSubmodule && id !== normalizedSubmoduleId ? currentStatuses[id] || '' : '')
          : 'Completed',
      ]))]
    }))

    setTodayWorkForm((current) => {
      return {
        ...current,
        submoduleIds: nextIds,
        submoduleStatuses: nextStatuses,
        submoduleStatusById: lastSelectedSubmoduleId
          ? { [lastSelectedSubmoduleId]: nextStatuses[current.selectedStudentIds?.[0] || '']?.[lastSelectedSubmoduleId] || '' }
          : {},
      }
    })
  }

  const setTodayWorkSubmoduleStatus = (submoduleId, status) => {
    const normalizedSubmoduleId = String(submoduleId || '').trim()
    if (!normalizedSubmoduleId) return
    const currentSelectedIds = Array.isArray(todayWorkForm.selectedStudentIds)
      ? todayWorkForm.selectedStudentIds
      : []
    const targetStudents = currentSelectedIds.length ? todayWorkSelectedStudents : []
    const targetStudentIds = targetStudents.map(getTodayWorkStudentId).filter(Boolean)
    const nextStatuses = Object.fromEntries(
      targetStudentIds.map((studentId) => [
        studentId,
        { ...(todayWorkForm.submoduleStatuses?.[studentId] || {}), [normalizedSubmoduleId]: status },
      ]),
    )

    setTodayWorkForm((current) => {
      const selectedIds = Array.isArray(current.submoduleIds) ? current.submoduleIds : []
      if (selectedIds[selectedIds.length - 1] !== normalizedSubmoduleId) return current

      return {
        ...current,
        selectedStudentIds: targetStudentIds,
        submoduleIds: selectedIds.includes(normalizedSubmoduleId)
          ? selectedIds
          : [...selectedIds, normalizedSubmoduleId],
        submoduleStatuses: nextStatuses,
        submoduleStatusById: {
          ...(current.submoduleStatusById || {}),
          [normalizedSubmoduleId]: status,
        },
      }
    })
  }

  const selectAllTodayWorkSubmodules = () => {
    setTodayWorkForm((current) => ({
      ...current,
      submoduleIds: todayWorkPendingSubmoduleIds,
      submoduleStatuses: Object.fromEntries(
        (current.selectedStudentIds || []).map((studentId) => [
          studentId,
          Object.fromEntries(todayWorkPendingSubmoduleIds.map((submoduleId, index) => [
            submoduleId,
            index === todayWorkPendingSubmoduleIds.length - 1
              ? current.submoduleStatuses?.[studentId]?.[submoduleId] || ''
              : 'Completed',
          ])),
        ]),
      ),
      submoduleStatusById: todayWorkPendingSubmoduleIds.length
        ? { [todayWorkPendingSubmoduleIds[todayWorkPendingSubmoduleIds.length - 1]]: '' }
        : {},
    }))
  }

  const clearAllTodayWorkSubmodules = () => {
    setTodayWorkForm((current) => ({
      ...current,
      submoduleIds: [],
    }))
  }

  const setTodayWorkAttendance = (studentId, status) => {
    const normalizedStudentId = String(studentId || '').trim()
    if (!normalizedStudentId) return

    const attendanceWindow = resolveBatchAttendanceWindow(
      attendanceBatchTiming,
    )
    if (!attendanceWindow.isEditable) {
      setTodayWorkError(attendanceWindow.reason || 'Attendance is closed for this batch.')
      return
    }

    setTodayWorkForm((current) => ({
      ...current,
      selectedStudentIds: current.selectedStudentIds.includes(normalizedStudentId)
        ? current.selectedStudentIds
        : [...current.selectedStudentIds, normalizedStudentId],
      attendanceByStudent: {
        ...(current.attendanceByStudent || {}),
        [normalizedStudentId]: status,
      },
    }))
  }

  const toggleTodayWorkStudent = (studentId) => {
    const normalizedStudentId = String(studentId || '').trim()
    if (!normalizedStudentId) return

    setTodayWorkForm((current) => ({
      ...current,
      selectedStudentIds: current.selectedStudentIds.includes(normalizedStudentId)
        ? current.selectedStudentIds.filter((id) => id !== normalizedStudentId)
        : [...current.selectedStudentIds, normalizedStudentId],
    }))
  }

  const toggleSelectAllTodayWorkStudents = () => {
    const presentStudentIds = todayWorkPresentStudents.map(getTodayWorkStudentId).filter(Boolean)
    if (!presentStudentIds.length) return

    setTodayWorkForm((current) => {
      const selectedIds = Array.isArray(current.selectedStudentIds) ? current.selectedStudentIds : []
      const allSelected = presentStudentIds.every((studentId) => selectedIds.includes(studentId))
      return {
        ...current,
        selectedStudentIds: allSelected
          ? selectedIds.filter((studentId) => !presentStudentIds.includes(studentId))
          : Array.from(new Set([...selectedIds, ...presentStudentIds])),
      }
    })
  }

  const markAllTodayWorkStudentsPresent = () => {
    const attendanceWindow = resolveBatchAttendanceWindow(
      attendanceBatchTiming,
    )
    if (!attendanceWindow.isEditable) return

    const selectedStudents = studentsFlowActionableStudents
    const attendanceByStudent = {}
    const selectedStudentIds = []

    selectedStudents.forEach((student) => {
      const studentId = getTodayWorkStudentId(student)
      if (studentId) {
        selectedStudentIds.push(studentId)
        attendanceByStudent[studentId] = 'PRESENT'
      }
    })

    setTodayWorkForm((current) => ({
      ...current,
      selectedStudentIds,
      attendanceByStudent,
    }))
  }

  const toggleMarkAllTodayWorkStudents = () => {
    const attendanceWindow = resolveBatchAttendanceWindow(
      attendanceBatchTiming,
    )
    if (!attendanceWindow.isEditable) return

    const allPresent = studentsFlowActionableStudents.length > 0 && studentsFlowActionableStudents.every((student) => (
      todayWorkForm.attendanceByStudent?.[getTodayWorkStudentId(student)] === 'PRESENT'
    ))

    if (allPresent) {
      const visibleStudentIds = new Set(studentsFlowActionableStudents.map(getTodayWorkStudentId))
      setTodayWorkForm((current) => ({
        ...current,
        selectedStudentIds: current.selectedStudentIds.filter((studentId) => !visibleStudentIds.has(studentId)),
        attendanceByStudent: Object.fromEntries(
          Object.entries(current.attendanceByStudent || {}).filter(([studentId]) => !visibleStudentIds.has(studentId)),
        ),
      }))
      return
    }

    markAllTodayWorkStudentsPresent()
  }

  const performAttendanceOnlySave = async () => {
    const attendanceWindow = resolveBatchAttendanceWindow(
      attendanceBatchTiming,
    )
    if (!attendanceWindow.isEditable) {
      setTodayWorkError(attendanceWindow.reason || 'Attendance is closed for this batch.')
      return
    }

    const selectedStudents = todayWorkForm.applyToAllStudents
      ? studentsFlowActionableStudents
      : todayWorkSelectedStudents.filter((student) => !isDiscontinuedStudent(student))

    if (!selectedStudents.length) {
      setTodayWorkError('Please select at least one student.')
      return
    }

    const students = selectedStudents.map((student) => ({
      studentId: getTodayWorkStudentId(student),
      studentName: String(student?.studentName || student?.name || '').trim(),
      status: String(todayWorkForm.attendanceByStudent?.[getTodayWorkStudentId(student)] || '').toUpperCase(),
    }))
    if (students.some((student) => !['PRESENT', 'ABSENT'].includes(student.status))) {
      setTodayWorkError('Please mark Present or Absent for every selected student.')
      return
    }

    const presentStudentIds = new Set(
      students
        .filter((student) => (
          student.status === 'PRESENT'
          && getStudentAttendanceStatus(
            studentAttendanceStatuses,
            selectedStudents.find((item) => getTodayWorkStudentId(item) === student.studentId),
          ) === 'ABSENT'
        ))
        .map((student) => student.studentId),
    )
    const attendanceSavedPendingItems = todayWorkMissedItems.filter((item) => presentStudentIds.has(item.studentId))

    setIsTodayWorkSaving(true)
    setTodayWorkError('')
    try {
      const response = await markFacultyStudentAttendance({
        date: getAttendanceDateKey(),
        attendanceDate: getAttendanceDateKey(),
        facultyId: String(selectedStudentsBatch?.facultyId || currentFacultyIdentity.facultyId).trim(),
        facultyUserId: currentFacultyIdentity.facultyUserId,
        userId: currentFacultyIdentity.facultyUserId,
        facultyName: currentFacultyIdentity.facultyName,
        facultyEmail: currentFacultyIdentity.facultyEmail,
        role: 'faculty',
        branchId: String(selectedStudentsBatch?.branchId || currentFacultyIdentity.branchId).trim(),
        branchCode: currentFacultyIdentity.branchCode,
        courseId: String(todayWorkCourse?.id || '').trim(),
        courseCode: String(todayWorkCourse?.courseCode || todayWorkCourse?.code || '').trim(),
        courseName: String(todayWorkCourse?.name || todayWorkCourse?.courseName || '').trim(),
        batchId: String(selectedStudentsBatch?.batchId || selectedStudentsBatch?.batchEntryId || selectedStudentsBatch?.id || '').trim(),
        batchEntryId: String(selectedStudentsBatch?.batchEntryId || selectedStudentsBatch?.batchId || selectedStudentsBatch?.id || '').trim(),
        batchCode: String(selectedStudentsBatch?.batchCode || selectedStudentsBatch?.code || '').trim(),
        batchName: String(selectedStudentsBatch?.batchName || selectedStudentsBatch?.code || '').trim(),
        submissionMode: 'faculty-dashboard-attendance',
        students,
      })
      const savedStatuses = selectedStudents.reduce((statusMap, student) => {
        const payloadStudentId = getTodayWorkStudentId(student)
        const status = String(todayWorkForm.attendanceByStudent?.[payloadStudentId] || '').trim().toUpperCase()
        if (!isAttendanceMarkedStatus(status)) return statusMap

        // Branch attendance uses an internal profile id while the faculty
        // table may be built from the public student id. Keep both aliases
        // in sync so a saved row never falls back to "Unmarked".
        getStudentAttendanceKeys(student).forEach((key) => {
          statusMap[key] = status
        })
        const normalizedPayloadStudentId = normalizeWorkStudentId(payloadStudentId)
        if (normalizedPayloadStudentId) statusMap[normalizedPayloadStudentId] = status
        return statusMap
      }, {})
      setStudentAttendanceStatuses((current) => ({
        ...current,
        ...extractStudentAttendanceStatuses(response),
        ...savedStatuses,
      }))
      saveStudentCalendarAttendance(getAttendanceDateKey(), students)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FACULTY_ATTENDANCE_SYNC_EVENT))
        window.dispatchEvent(new CustomEvent('cispro:faculty-dashboard-refresh'))
      }
      if (attendanceSavedPendingItems.length) {
        setAttendanceSavedPrompt({
          studentNames: Array.from(new Set(attendanceSavedPendingItems.map((item) => item.studentName))),
          items: attendanceSavedPendingItems,
        })
        return
      }
      closeTodayWorkModal()
    } catch (error) {
      console.error('Failed to save attendance', error)
      setTodayWorkError(error?.message || 'Unable to save attendance right now.')
    } finally {
      setIsTodayWorkSaving(false)
    }
  }

  const buildTodayWorkSubmission = () => {
    if (!todayWorkCourse?.id) {
      setTodayWorkError('Please select a course first.')
      return null
    }

    if (!todayWorkSelectedModule) {
      setTodayWorkError('No module found for this course.')
      return null
    }

    const selectedSubmoduleIds = Array.isArray(todayWorkForm.submoduleIds)
      ? todayWorkForm.submoduleIds.filter(Boolean)
      : []

    if (!selectedSubmoduleIds.length) {
      setTodayWorkError('Please select at least one sub-module.')
      return null
    }

    const selectedStudents = todayWorkForm.applyToAllStudents
      ? studentsFlowVisibleStudents
      : todayWorkSelectedStudents

    if (!selectedStudents.length) {
      setTodayWorkError('Please select at least one student.')
      return null
    }

    const unmarkedStudent = selectedStudents.find((student) => {
      return !getCurrentStudentAttendanceStatus(studentAttendanceStatuses, student)
    })

    if (unmarkedStudent) {
      setTodayWorkError('Please mark Present or Absent for every selected student.')
      return null
    }

    const lastSelectedSubmoduleId = selectedSubmoduleIds[selectedSubmoduleIds.length - 1]
    const unselectedSubmoduleStatus = selectedStudents.some((student) => {
      const studentId = getTodayWorkStudentId(student)
      return selectedSubmoduleIds.some((submoduleId) => {
        // Earlier selected submodules are completed automatically. Only the
        // last selected submodule requires a manual status choice.
        if (submoduleId !== lastSelectedSubmoduleId) return false
        const status = todayWorkForm.submoduleStatuses?.[studentId]?.[submoduleId]
          || todayWorkForm.submoduleStatusById?.[submoduleId]
          || ''
        return !['In Progress', 'Completed'].includes(normalizeSubmoduleProgressStatus(status))
      })
    })

    if (unselectedSubmoduleStatus) {
      setTodayWorkError('Please choose In Progress or Completed for every selected sub-module.')
      return null
    }

    const moduleSubmodules = getCourseSubmodules(todayWorkSelectedModule)
    const submoduleLookup = new Map(
      moduleSubmodules.map((submodule, index) => {
        const id = String(submodule?.id || submodule?.submoduleId || `${todayWorkSelectedModule?.id || 'module'}-submodule-${index}`).trim()
        return [id, submodule]
      }),
    )

    return {
      selectedSubmoduleIds,
      selectedStudents,
      submoduleLookup,
    }
  }

  const performTodayWorkSave = async (submission) => {
    const selectedSubmoduleIds = Array.isArray(submission?.selectedSubmoduleIds) ? submission.selectedSubmoduleIds : []
    const selectedStudents = Array.isArray(submission?.selectedStudents) ? submission.selectedStudents : []
    const submoduleLookup = submission?.submoduleLookup instanceof Map ? submission.submoduleLookup : new Map()

    if (!selectedSubmoduleIds.length || !selectedStudents.length) {
      setTodayWorkError('Please select at least one sub-module and student.')
      return
    }

    setIsTodayWorkSaving(true)
    setTodayWorkError('')

    try {
      const progressPercentage = Math.min(100, Math.max(0, Number(todayWorkForm.progressPercentage) || 0))
      const submoduleStatus = progressPercentage >= 100
        ? 'Completed'
        : progressPercentage > 0
          ? 'In Progress'
          : 'Not Started'
      const attendanceStudents = selectedStudents.map((student) => {
        const studentId = getTodayWorkStudentId(student)
        return {
          studentId,
          studentName: String(student?.studentName || student?.name || '').trim(),
          status: getCurrentStudentAttendanceStatus(studentAttendanceStatuses, student),
        }
      })
      const presentStudentIds = new Set(
        attendanceStudents
          .filter((student) => student.status === 'PRESENT')
          .map((student) => student.studentId),
      )
      const presentStudents = selectedStudents.filter((student) => presentStudentIds.has(getTodayWorkStudentId(student)))
      const persistedStatusesForSave = getPersistedTodayWorkSubmoduleStatuses(
        facultyTodayWorkEntries,
        currentFacultyIdentity,
        todayWorkCourse?.id || '',
        todayWorkSelectedModule?.id || '',
        selectedStudentsBatch,
        selectedStudents,
        getCourseSubmodules(todayWorkSelectedModule),
      )
      const submoduleStatuses = Object.fromEntries(selectedStudents.map((student) => {
        const studentId = getTodayWorkStudentId(student)
        const attendanceStatus = attendanceStudents.find((item) => item.studentId === studentId)?.status
        const selectedStatus = todayWorkForm.submoduleStatuses?.[studentId]?.[selectedSubmoduleIds[0]]
          || todayWorkForm.submoduleStatusById?.[selectedSubmoduleIds[0]]
        return [studentId, Object.fromEntries(selectedSubmoduleIds.map((submoduleId) => [
          submoduleId,
          (() => {
            const persistedStatus = persistedStatusesForSave?.[studentId]?.[submoduleId] || ''
            const selectedStudentStatus = todayWorkForm.submoduleStatuses?.[studentId]?.[submoduleId]
            const existingStatus = selectedStudentStatus
              || todayWorkForm.submoduleStatusById?.[submoduleId]
              || selectedStatus

            const submoduleIndex = selectedSubmoduleIds.indexOf(submoduleId)
            if (submoduleIndex < selectedSubmoduleIds.length - 1) {
              return 'Completed'
            }

            // A later absent attendance update must not undo a sub-module
            // that this student already completed in an earlier save.
            if (attendanceStatus === 'ABSENT') {
              return normalizeSubmoduleProgressStatus(persistedStatus) === 'Completed'
                ? 'Completed'
                : 'Not Completed'
            }

            return existingStatus || ''
          })(),
        ]))]
      }))
      const submoduleProgress = selectedStudents.flatMap((student) => {
        const studentId = getTodayWorkStudentId(student)
        return selectedSubmoduleIds.map((submoduleId) => ({
          studentId,
          submoduleId,
          status: submoduleStatuses[studentId]?.[submoduleId] || todayWorkForm.submoduleStatusById?.[submoduleId] || '',
          progressPercentage,
        }))
      })
      // Today's Work reads attendance already saved for today. It must not
      // create a second attendance record while saving progress.
      const progressStudents = presentStudents

      const presentSubmoduleStatuses = Object.fromEntries(progressStudents.map((student) => {
        const studentId = getTodayWorkStudentId(student)
        return [studentId, submoduleStatuses[studentId] || {}]
      }))
      const presentSubmoduleProgress = submoduleProgress.filter((entry) => progressStudents.some((student) => getTodayWorkStudentId(student) === entry.studentId))
      const studentResults = selectedStudents.map((student) => {
        const studentId = getTodayWorkStudentId(student)
        const attendanceStatus = attendanceStudents.find((item) => item.studentId === studentId)?.status || ''
        return {
          studentId,
          attendanceStatus,
          submodules: selectedSubmoduleIds.map((submoduleId) => ({
            submoduleId,
            attendanceStatus,
            completionStatus: submoduleStatuses[studentId]?.[submoduleId] || 'PENDING',
          })),
        }
      })
      const savedEntry = selectedStudents.length
        ? await saveFacultyTodayWorkEntry({
        facultyId: currentFacultyIdentity.facultyId,
        facultyProfileId: currentFacultyIdentity.facultyId,
        facultyName: currentFacultyIdentity.facultyName,
        facultyEmail: currentFacultyIdentity.facultyEmail,
        branchId: currentFacultyIdentity.branchId,
        workDate: getAttendanceDateKey(),
        courseId: String(todayWorkCourse.id || '').trim(),
        courseName: String(todayWorkCourse.name || todayWorkCourse.courseName || '').trim(),
        batchId: String(selectedStudentsBatch?.batchId || selectedStudentsBatch?.batchEntryId || '').trim(),
        batchName: String(selectedStudentsBatch?.batchName || selectedStudentsBatch?.code || '').trim(),
        batchTiming: String(selectedStudentsBatch?.timing || selectedStudentsBatch?.batchTiming || '').trim(),
        moduleId: String(todayWorkSelectedModule.id || '').trim(),
        moduleName: getCourseModuleName(todayWorkSelectedModule, 0),
        applyToAllStudents: Boolean(todayWorkForm.applyToAllStudents),
        studentIds: selectedStudents.map((student) => String(student.id || student.studentId || '').trim()).filter(Boolean),
        selectedStudentIds: selectedStudents.map((student) => String(student.id || student.studentId || '').trim()).filter(Boolean),
        studentCount: selectedStudents.length,
        submoduleIds: selectedSubmoduleIds,
        selectedSubmoduleIds,
        submodules: selectedSubmoduleIds.map((submoduleId) => {
          const submodule = submoduleLookup.get(submoduleId) || {}
          return {
            id: submoduleId,
            name: getCourseSubmoduleName(submodule, 0),
            status: presentSubmoduleStatuses[progressStudents[0] ? getTodayWorkStudentId(progressStudents[0]) : '']?.[submoduleId] || todayWorkForm.submoduleStatusById?.[submoduleId] || '',
          }
        }),
        progressPercentage,
        submoduleStatus,
        submoduleStatuses,
        submoduleProgress,
        studentResults,
      })
        : null

      const nextWorkEntries = [...facultyTodayWorkEntries, savedEntry].filter(Boolean)
      setTodayWorkEntries(nextWorkEntries)
      const progressUpdates = progressStudents
        .map((student) => {
          const progressSummary = buildFacultyTodayWorkProgressSummary(nextWorkEntries, todayWorkCourse || {}, student)
          const courseProgress = Number(progressSummary?.courseProgress)

          if (!Number.isFinite(courseProgress)) {
            return null
          }

          return {
            ...student,
            courseProgress: Math.min(100, Math.max(0, courseProgress)),
          }
        })
        .filter(Boolean)

      if (progressUpdates.length) {
        const progressByStudentKey = new Map()
        progressUpdates.forEach((student) => {
          const studentKey = String(student.id || student.studentId || '').trim()
          if (studentKey) progressByStudentKey.set(studentKey, student.courseProgress)
        })

        setStudents((currentStudents) => currentStudents.map((student) => {
          const keys = [student.id, student.studentId]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
          const matchingProgress = keys
            .map((key) => progressByStudentKey.get(key))
            .find((value) => value !== undefined)

          return matchingProgress === undefined
            ? student
            : { ...student, courseProgress: matchingProgress }
        }))
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cispro:faculty-dashboard-refresh'))
      }

      closeTodayWorkModal()
    } catch (error) {
      console.error('Failed to save today work entry', error)
      setTodayWorkError(error?.message || 'Unable to save work right now.')
    } finally {
      setIsTodayWorkSaving(false)
    }
  }

  const handleTodayWorkSubmit = (event) => {
    event.preventDefault()

    if (todayWorkMode === 'attendance') {
      void performAttendanceOnlySave()
      return
    }

    const submission = buildTodayWorkSubmission()
    if (!submission) return

    setPendingTodayWorkSubmission(submission)
    setIsTodayWorkConfirmOpen(true)
  }

  const handleConfirmTodayWorkSave = async () => {
    const submission = pendingTodayWorkSubmission || buildTodayWorkSubmission()
    if (!submission) return

    setIsTodayWorkConfirmOpen(false)
    setPendingTodayWorkSubmission(null)
    await performTodayWorkSave(submission)
  }

  const openCourseRequestModal = () => {
    setCourseRequestError('')
    setIsCourseRequestSuccessOpen(false)
    setCourseRequestForm({
      title: `${selectedCourse?.name || selectedCourse?.courseName || 'Course'} edit request`,
      reason: '',
      description: '',
    })
    setIsCourseRequestModalOpen(true)
  }

  const openCourseEditModal = () => {
    if (!canOpenCourseEditor) {
      openCourseRequestModal()
      return
    }

    setCourseEditError('')
    setCourseEditDraft({
      courseId: selectedCourseRequestId,
      courseName: String(selectedCourse?.name || selectedCourse?.courseName || 'Course').trim(),
      modules: cloneFacultyEditModules(selectedCourse),
    })
    setCourseEditView('overview')
    setCourseEditActiveModuleIndex(0)
    setCourseEditExpandedModuleIds([])
    setCourseEditInlineSubmodule(null)
    setCourseEditPendingModuleId('')
    setCourseEditDeleteConfirm(null)
    setIsCourseEditModalOpen(true)
  }

  const openCourseEditModule = (moduleIndex) => {
    setCourseEditActiveModuleIndex(moduleIndex)
    setCourseEditInlineSubmodule(null)
    setCourseEditPendingModuleId('')
    setCourseEditView('module')
  }

  const continueCourseEditModule = () => {
    setCourseEditInlineSubmodule(null)
    setCourseEditView('submodules')
  }

  const toggleCourseEditExpandedModule = (moduleId) => {
    const normalizedModuleId = String(moduleId || '').trim()
    if (!normalizedModuleId) return

    setCourseEditExpandedModuleIds((current) =>
      current.includes(normalizedModuleId)
        ? current.filter((id) => id !== normalizedModuleId)
        : [...current, normalizedModuleId],
    )
  }

  const handleCourseEditOverviewBodyClick = (event) => {
    const row = event.target.closest?.('.faculty-course-edit-overview-row')
    if (!row) return

    const interactiveChild = event.target.closest?.('button, a, input, textarea, select')
    if (interactiveChild && interactiveChild !== row) return

    const moduleId = String(row.dataset.moduleId || '').trim()
    toggleCourseEditExpandedModule(moduleId)
  }

  const startCourseEditSubmoduleEdit = (moduleIndex, submoduleIndex) => {
    const module = courseEditModules[moduleIndex]
    const submodule = Array.isArray(module?.submodules) ? module.submodules[submoduleIndex] : null

    setCourseEditInlineSubmodule({
      moduleIndex,
      submoduleIndex,
      mode: 'edit',
      value: String(submodule?.name || '').trim(),
    })
  }

  const startCourseEditAddSubmodule = (moduleIndex) => {
    const module = courseEditModules[moduleIndex]
    const nextNumber = Array.isArray(module?.submodules) ? module.submodules.length + 1 : 1

    setCourseEditInlineSubmodule({
      moduleIndex,
      submoduleIndex: null,
      mode: 'add',
      value: '',
      placeholder: `Submodule ${nextNumber}`,
    })
  }

  const saveCourseEditInlineSubmodule = () => {
    if (!courseEditInlineSubmodule) return

    const moduleIndex = Number(courseEditInlineSubmodule.moduleIndex)
  const trimmedValue = String(courseEditInlineSubmodule.value || '').trim()

if (!trimmedValue) {
  setCourseEditInlineSubmodule((current) =>
    current ? { ...current, error: 'This field is required' } : current
  )
  return
}

const nextName = trimmedValue

    if (courseEditInlineSubmodule.mode === 'edit' && Number.isInteger(courseEditInlineSubmodule.submoduleIndex)) {
      updateCourseEditSubmodule(moduleIndex, courseEditInlineSubmodule.submoduleIndex, 'name', nextName)
      setCourseEditInlineSubmodule(null)
      return
    }

    if (courseEditInlineSubmodule.mode === 'add') {
      setCourseEditDraft((current) => {
        if (!current) return current
        const nextModules = Array.isArray(current.modules) ? [...current.modules] : []
        const module = { ...(nextModules[moduleIndex] || {}) }
        const submodules = Array.isArray(module.submodules) ? [...module.submodules] : []
        submodules.push({
          id: `submodule-${Date.now()}`,
          name: nextName,
          percentage: '',
        })
        module.submodules = submodules
        nextModules[moduleIndex] = module
        return { ...current, modules: nextModules }
      })

      const nextSubmoduleNumber = (courseEditModules[moduleIndex]?.submodules?.length || 0) + 2
      setCourseEditInlineSubmodule({
        moduleIndex,
        submoduleIndex: null,
        mode: 'add',
        value: '',
        placeholder: `Submodule ${nextSubmoduleNumber}`,
      })
      return
    }
  }

  const cancelCourseEditInlineSubmodule = () => {
    setCourseEditInlineSubmodule(null)
  }

  const handleSendCourseEditRequest = async (event) => {
    event.preventDefault()

    const reason = String(courseRequestForm.reason || '').trim()
    const description = String(courseRequestForm.description || '').trim()

    if (!selectedCourseRequestId) {
      setCourseRequestError('Please select a course first.')
      return
    }

    if (!reason) {
      setCourseRequestError('Please enter a request reason.')
      return
    }

    if (!description) {
      setCourseRequestError('Please describe the module/submodule changes.')
      return
    }

    setIsCourseRequestSaving(true)
    setCourseRequestError('')

    try {
      const response = await createCourseEditRequest({
        branchCourseId: selectedCourseRequestId,
        courseId: String(selectedCourse?.courseId || selectedCourseRequestId).trim(),
        courseCode: selectedCourse.courseCode || selectedCourseRequestId,
        courseName: selectedCourse.name || selectedCourse.courseName || 'Course',
        title: String(courseRequestForm.title || '').trim(),
        reason,
        description,
        ...facultyBranchScope,
      })

      const createdRequest = response?.request || response || null
      if (createdRequest) {
        setCourseEditRequests((current) => [
          createdRequest,
          ...current.filter((request) => String(request.id || '').trim() !== String(createdRequest.id || '').trim()),
        ])
      }

      setIsCourseRequestModalOpen(false)
      setIsCourseRequestSuccessOpen(true)
    } catch (error) {
      console.error('Failed to create course edit request', error)
      setCourseRequestError('Unable to send request right now.')
    } finally {
      setIsCourseRequestSaving(false)
    }
  }

  const updateCourseEditModule = (moduleIndex, field, value) => {
    setCourseEditDraft((current) => {
      if (!current) return current
      const nextModules = Array.isArray(current.modules) ? [...current.modules] : []
      const module = { ...(nextModules[moduleIndex] || {}) }
      module[field] = value
      nextModules[moduleIndex] = module
      return { ...current, modules: nextModules }
    })
  }

  const updateCourseEditSubmodule = (moduleIndex, submoduleIndex, field, value) => {
    setCourseEditDraft((current) => {
      if (!current) return current
      const nextModules = Array.isArray(current.modules) ? [...current.modules] : []
      const module = { ...(nextModules[moduleIndex] || {}) }
      const submodules = Array.isArray(module.submodules) ? [...module.submodules] : []
      const submodule = { ...(submodules[submoduleIndex] || {}) }
      submodule[field] = value
      submodules[submoduleIndex] = submodule
      module.submodules = submodules
      nextModules[moduleIndex] = module
      return { ...current, modules: nextModules }
    })
  }

  const addCourseEditModule = () => {
    const newModuleId = `module-${Date.now()}`

    setCourseEditDraft((current) => {
      if (!current) return current
      const nextModules = Array.isArray(current.modules) ? [...current.modules] : []
      const nextIndex = nextModules.length
      nextModules.push({
        id: newModuleId,
        name: '',
        percentage: '',
        submodules: [],
      })
      setCourseEditActiveModuleIndex(nextIndex)
      setCourseEditView('module')
      setCourseEditInlineSubmodule(null)
      setCourseEditPendingModuleId(newModuleId)
      setCourseEditDeleteConfirm(null)
      return { ...current, modules: nextModules }
    })
  }

  const openCourseEditDeleteConfirm = (type, moduleIndex, submoduleIndex = null) => {
    const safeModuleIndex = Number(moduleIndex)
    const safeSubmoduleIndex = submoduleIndex === null ? null : Number(submoduleIndex)
    setCourseEditDeleteConfirm({
      type,
      moduleIndex: Number.isInteger(safeModuleIndex) ? safeModuleIndex : 0,
      submoduleIndex: Number.isInteger(safeSubmoduleIndex) ? safeSubmoduleIndex : null,
    })
  }

  const closeCourseEditDeleteConfirm = () => {
    setCourseEditDeleteConfirm(null)
  }

  const confirmCourseEditDelete = () => {
    if (!courseEditDeleteConfirm) return

    const { type, moduleIndex, submoduleIndex } = courseEditDeleteConfirm

    if (type === 'module') {
      setCourseEditDraft((current) => {
        if (!current) return current
        const nextModules = (Array.isArray(current.modules) ? current.modules : []).filter((_, index) => index !== moduleIndex)
        return { ...current, modules: nextModules }
      })

      setCourseEditActiveModuleIndex((current) => {
        if (current === moduleIndex) return Math.max(0, moduleIndex - 1)
        if (current > moduleIndex) return Math.max(0, current - 1)
        return current
      })
      setCourseEditInlineSubmodule((current) => {
        if (!current) return current
        const currentModuleIndex = Number(current.moduleIndex)
        if (currentModuleIndex === moduleIndex) return null
        if (currentModuleIndex > moduleIndex) {
          return { ...current, moduleIndex: currentModuleIndex - 1 }
        }
        return current
      })
      setCourseEditView('overview')
    }

    if (type === 'submodule') {
      setCourseEditDraft((current) => {
        if (!current) return current
        const nextModules = Array.isArray(current.modules) ? [...current.modules] : []
        const module = { ...(nextModules[moduleIndex] || {}) }
        module.submodules = (Array.isArray(module.submodules) ? module.submodules : []).filter((_, index) => index !== submoduleIndex)
        nextModules[moduleIndex] = module
        return { ...current, modules: nextModules }
      })

      setCourseEditInlineSubmodule((current) => {
        if (!current || Number(current.moduleIndex) !== moduleIndex) return current
        if (Number(current.submoduleIndex) === submoduleIndex) return null
        if (current.mode === 'edit' && Number(current.submoduleIndex) > submoduleIndex) {
          return { ...current, submoduleIndex: Number(current.submoduleIndex) - 1 }
        }
        return current
      })
    }

    setCourseEditDeleteConfirm(null)
    setCourseEditPendingModuleId('')
  }

  const removeCourseEditModule = (moduleIndex) => {
    openCourseEditDeleteConfirm('module', moduleIndex)
  }

  const cancelCourseEditModule = () => {
    setCourseEditDraft((current) => {
      if (!current) return current

      const nextModules = Array.isArray(current.modules) ? [...current.modules] : []
      const activeModule = nextModules[courseEditActiveModuleIndex]
      const activeModuleId = String(activeModule?.id || '').trim()
      const isPendingNewModule =
        Boolean(courseEditPendingModuleId) &&
        activeModuleId &&
        activeModuleId === String(courseEditPendingModuleId).trim()

      if (isPendingNewModule) {
        nextModules.splice(courseEditActiveModuleIndex, 1)
      }

      return { ...current, modules: nextModules }
    })

    setCourseEditPendingModuleId('')
    setCourseEditInlineSubmodule(null)
    setCourseEditView('overview')
    setCourseEditActiveModuleIndex(0)
  }

  const removeCourseEditSubmodule = (moduleIndex, submoduleIndex) => {
    openCourseEditDeleteConfirm('submodule', moduleIndex, submoduleIndex)
  }

  const handleSaveCourseEditChanges = async () => {
    if (!selectedCourse?.id || !courseEditDraft) return

    if (!currentCourseEditRequest?.id) {
      setCourseEditError('Please wait for the approved edit request to load.')
      return
    }

    const normalizedModules = (Array.isArray(courseEditDraft.modules) ? courseEditDraft.modules : []).map((module, moduleIndex) => ({
      ...cloneFacultyEditModule(module, moduleIndex),
      percentage: getEqualSplitPercentageValue(courseEditDraft.modules.length),
      submodules: (Array.isArray(module?.submodules) ? module.submodules : []).map((submodule, subIndex, submoduleList) => ({
        ...cloneFacultyEditSubmodule(submodule, subIndex),
        percentage: getEqualSplitPercentageValue(submoduleList.length),
      })),
    }))

    setIsCourseEditSaving(true)
    setCourseEditError('')

    try {
      const { changes, hasChanges, summary: changeSummary } = formatCourseEditChangeSummary(
        selectedCourseModules,
        normalizedModules,
        facultyDetails?.name || facultyDetails?.facultyName || 'Faculty',
        selectedCourse?.name || selectedCourse?.courseName || 'Course',
      )
      const payload = {
        branchCourseId: selectedCourse.id,
        modules: normalizedModules,
        courseModels: normalizedModules,
        models: normalizedModules,
        // The API can persist/inspect this structured diff when it owns
        // notification delivery; the client also uses it for the existing
        // notification UI fallback.
        changeSet: changes,
      }
      const response = await saveCourseEditRequestModules(currentCourseEditRequest.id, payload)
      const updatedCourseRecord = response?.course || payload
      const updatedModules = cloneFacultyEditModules(updatedCourseRecord)
      const nextUpdatedCourse = {
        ...selectedCourse,
        ...response?.course,
        models: updatedModules,
        courseModels: updatedModules,
        modules: updatedModules,
      }
      const nextCourseCatalog = courseCatalog.map((course) =>
        String(course.id || '').trim() === String(selectedCourse.id || '').trim()
          ? {
              ...course,
              ...nextUpdatedCourse,
              models: updatedModules,
              courseModels: updatedModules,
              modules: updatedModules,
            }
          : course,
      )

      setCourseCatalog(nextCourseCatalog)
      setBranchCourses((current) =>
        Array.isArray(current)
          ? current.map((course) =>
              String(course.id || '').trim() === String(selectedCourse.id || '').trim()
                ? {
                    ...course,
                    ...nextUpdatedCourse,
                    models: updatedModules,
                    courseModels: updatedModules,
                    modules: updatedModules,
                  }
                : course,
            )
          : current,
      )
      saveBranchCourseSnapshot(nextCourseCatalog)
      clearBranchCourseListCache()

      const completedRequest = {
        ...(currentCourseEditRequest || {}),
        ...(response?.request || {}),
        status: 'completed',
        requestStatus: 'completed',
        completedAt: response?.request?.completedAt || new Date().toISOString(),
        updatedAt: response?.request?.updatedAt || new Date().toISOString(),
        changeSummary,
      }

      if (completedRequest.id) {
        setCourseEditRequests((current) =>
          current.map((request) =>
            String(request.id || '').trim() === String(completedRequest.id || '').trim()
              ? completedRequest
              : request,
            ),
          )
      }

      if (hasChanges) {
        const notificationPayload = {
          kind: 'branch-course-edit-updated',
          tone: 'amber',
          title: 'Course Content Updated',
          message: changeSummary,
          actionLabel: 'Updated',
          targetSection: 'courses',
          ...facultyBranchScope,
          courseId: selectedCourse.id,
          courseCode: selectedCourse.courseCode || selectedCourse.id || '',
          courseName: selectedCourse.name || selectedCourse.courseName || 'Course',
          facultyId: facultyDetails?.id || facultyDetails?.facultyId || '',
          facultyName: facultyDetails?.name || facultyDetails?.facultyName || '',
          facultyEmail: facultyDetails?.email || facultyDetails?.facultyEmail || '',
          requestId: completedRequest.id || currentCourseEditRequest.id,
          requestStatus: 'completed',
          requestTitle: completedRequest.requestTitle || currentCourseEditRequest.requestTitle || '',
          requestReason: completedRequest.requestReason || currentCourseEditRequest.requestReason || '',
          requestDescription: completedRequest.requestDescription || currentCourseEditRequest.requestDescription || '',
          changeSummary,
          summary: changeSummary,
          changeSet: changes,
        }

      }

      setIsCourseEditModalOpen(false)
      setCourseEditDraft(null)
      setIsCourseEditSuccessOpen(true)
    } catch (error) {
      console.error('Failed to save course edit changes', error)
      setCourseEditError('Unable to save changes right now.')
    } finally {
      setIsCourseEditSaving(false)
    }
  }

  const currentCourseEditRequest = (() => {
    const courseId = selectedCourseRequestId
    const facultyId = String(facultyDetails?.id || '').trim()
    const facultyEmail = String(facultyDetails?.email || '').trim().toLowerCase()

    const matchingRequests = courseEditRequests
      .filter((request) => {
        const requestCourseId = String(request.branchCourseId || request.courseId || '').trim()
        if (courseId && requestCourseId && requestCourseId !== courseId) return false
        if (facultyId && String(request.facultyId || '').trim() === facultyId) return true
        if (facultyEmail && String(request.facultyEmail || '').trim().toLowerCase() === facultyEmail) return true
        return !facultyId && !facultyEmail
      })
      .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())

    return matchingRequests[0] || null
  })()

  const courseEditStatus = String(currentCourseEditRequest?.requestStatus || currentCourseEditRequest?.status || '').trim().toLowerCase()
  const canOpenCourseEditor = courseEditStatus === 'accepted' || courseEditStatus === 'editing'
  const isCourseEditPending = courseEditStatus === 'pending'
  const isCourseEditCompleted = courseEditStatus === 'completed' || courseEditStatus === 'rejected'

  const visibleNotifications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return normalizedNotifications.filter((notification) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'read' && notification.read) ||
        (statusFilter === 'unread' && !notification.read)

      const matchesDate = isWithinSelectedDateRange(notification.createdAt, dateFilter)

      const searchableText = [
        notification.title,
        notification.message,
        notification.kind,
        notification.actionLabel,
        notification.categoryLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !query || searchableText.includes(query)

      return matchesStatus && matchesDate && matchesSearch
    })
  }, [dateFilter, normalizedNotifications, searchTerm, statusFilter])
  const groupedNotifications = useMemo(
    () => groupFacultyNotifications(visibleNotifications),
    [visibleNotifications],
  )

  const stats = [
    { label: 'Assigned Courses', value: dashboardOverviewLoading ? '—' : String(dashboardOverview?.courseIds?.length ?? new Set(assignedCourseIds).size ?? 0), note: 'Active courses', icon: BookOpen, tone: 'blue' },
    { label: 'Total Batches', value: dashboardSummary?.totalBatches ?? '—', note: 'Across all Courses', icon: Layers3, tone: 'purple' },
    {
      label: 'Next Week Off',
      value: facultyNextWeekOff.date
        ? facultyNextWeekOff.date.split('-').reverse().join('.')
        : 'Not configured',
      note: facultyNextWeekOff.day
        ? `${facultyNextWeekOff.day.charAt(0)}${facultyNextWeekOff.day.slice(1).toLowerCase()}${facultyNextWeekOff.temporary ? ' - Alternate week-off' : ''}`
        : 'Contact Branch Admin to configure',
      icon: CalendarDays,
      tone: 'orange',
      highlightNote: true,
    },
  ]

  // Close profile dropdown menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  const handleLogoutClick = () => {
    setIsLogoutConfirmOpen(true)
    setIsProfileMenuOpen(false)
  }

  const handleConfirmLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const openResetPassword = () => {
    navigate('/reset-password')
    setIsProfileMenuOpen(false)
  }

  const openForgotPassword = () => {
    const email = String(facultyDetails.email || '').trim()
    const suffix = email ? `?email=${encodeURIComponent(email)}` : ''
    navigate(`/forgot-password${suffix}`)
  }

  const handleSidebarSectionChange = (section) => {
    const routeBySection = { dashboard: '/dashboard/faculty/dashboard', 'my-courses': '/dashboard/faculty/courses', 'my-batches': '/dashboard/faculty/batches', 'my-calendar': '/dashboard/faculty/calendar', exams: '/dashboard/faculty/exams', students: '/dashboard/faculty/students', 'leave-requests': '/dashboard/faculty/leave-requests', notifications: '/dashboard/faculty/notifications', profile: '/dashboard/faculty/profile', 'skill-development': '/dashboard/faculty/skill-development' }
    if (routeBySection[section]) {
      navigate(routeBySection[section])
      return
    }
    // The calendar is rendered from the student-calendar route. Leave that
    // route before switching sections so it cannot remain below the new view.
    if (isStudentCalendarRoute) {
      navigate('/dashboard/faculty/my-batches')
    }
    setActiveSection(section)
  }

  useEffect(() => {
    try { window.localStorage.setItem('cispro.faculty-sidebar-collapsed', String(isSidebarCollapsed)) } catch { /* ignore storage failures */ }
  }, [isSidebarCollapsed])

  const renderSidebar = () => (
    <aside className={`super-admin-sidebar ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`.trim()} aria-label="Faculty navigation">
      <div className="super-admin-sidebar-brand">
        <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="CISPRO logo" />
        <button type="button" className="super-admin-sidebar-collapse-toggle" data-tooltip={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'} aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setIsSidebarCollapsed((current) => !current)}>
          {isSidebarCollapsed ? <PanelLeftOpen size={19} strokeWidth={2.3} /> : <PanelLeftClose size={19} strokeWidth={2.3} />}
        </button>
      </div>

      <nav className="super-admin-sidebar-nav">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'courses', label: 'Course', icon: BookOpen, children: [
            { id: 'my-batches', label: 'Batches', icon: Layers3 },
            { id: 'course-progress', label: 'Course Progress', icon: BarChart3, route: 'my-courses' },
          ] },
          { id: 'students', label: 'Student Management', icon: Users },
          { id: 'skill-development', label: 'Skill Development', icon: GraduationCap },
          { id: 'exams', label: 'Exams', icon: BookOpen },
          { id: 'other-faculty-batches', label: 'Other Faculty Batches', icon: Layers3 },
          { id: 'leave-management', label: 'Leave Management', icon: CalendarDays, children: [
            { id: 'leave-requests', label: 'Leave Requests', icon: FileText },
            { id: 'my-calendar', label: 'Calendar', icon: CalendarDays },
          ] },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'profile', label: 'Profile', icon: CircleUserRound },
        ].filter((item) => item.id !== 'other-faculty-batches' || hasTemporaryAssignments).map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id || (item.id === 'exams' && (isExamsRoute || isAssessmentsRoute || isExamReportsRoute || isAcademicTestRoute))
          const studentNavigation = (
            <>
              <div className="super-admin-sidebar-parent-row">
                <button
                  type="button"
                  className={`super-admin-sidebar-item ${isActive ? 'is-active' : ''}`.trim()}
                  data-tooltip={item.label}
                  aria-expanded={Boolean(expandedSidebarGroups.students)}
                  onClick={() => {
                    setExpandedSidebarGroups((current) => ({ ...current, students: !current.students }))
                  }}
                >
                  <span className="super-admin-sidebar-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.15} />
                  </span>
                  <span>{item.label}</span>
                  <ChevronDown size={16} strokeWidth={2.2} className={expandedSidebarGroups.students ? 'is-expanded' : ''} aria-hidden="true" />
                </button>
              </div>
              {(expandedSidebarGroups.students || isSidebarCollapsed) ? (
                <div className="super-admin-sidebar-submenu">
                  <div className="super-admin-sidebar-submenu-title">Student Management</div>
                  {[
                    { id: 'active', label: 'Active Students', icon: Users },
                    { id: 'records', label: 'Course Completion Students', icon: CheckCircle2 },
                    { id: 'discontinued', label: 'Discontinued Students', icon: ShieldCheck },
                  ].map((entry) => {
                    const ChildIcon = entry.icon
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`super-admin-sidebar-subitem ${studentsViewMode === entry.id ? 'is-active' : ''}`.trim()}
                        onClick={() => {
                          setDismissedSidebarGroup('students')
                          handleSidebarSectionChange('students')
                          setStudentsViewMode(entry.id)
                          setSelectedStudentsCourseId('')
                          setSelectedStudentsBatchId('')
                          setExpandedSidebarGroups((current) => ({ ...current, students: true }))
                        }}
                      >
                        <span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><ChildIcon size={15} strokeWidth={2.1} /></span>
                        <span>{entry.label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </>
          )

          if (item.id === 'students') {
            return <div key={item.id} className="super-admin-sidebar-item-group">{studentNavigation}</div>
          }

          if (item.children) {
            const isGroupActive = item.children.some((entry) => activeSection === (entry.route || entry.id))
            const isExpanded = Boolean(expandedSidebarGroups[item.id])
            return (
              <div
                key={item.id}
                className={`super-admin-sidebar-item-group ${dismissedSidebarGroup === item.id ? 'is-flyout-dismissed' : ''}`.trim()}
                onMouseLeave={() => setDismissedSidebarGroup('')}
              >
                <button
                  type="button"
                  className={`super-admin-sidebar-item ${isGroupActive ? 'is-active' : ''}`.trim()}
                  data-tooltip={item.label}
                  aria-expanded={isExpanded}
                  onClick={() => {
                    setDismissedSidebarGroup(isSidebarCollapsed ? item.id : '')
                    if (item.id === 'courses') handleSidebarSectionChange('my-courses')
                    setExpandedSidebarGroups((current) => ({ ...current, [item.id]: !current[item.id] }))
                  }}
                >
                  <span className="super-admin-sidebar-icon" aria-hidden="true"><Icon size={18} strokeWidth={2.15} /></span>
                  <span>{item.label}</span>
                  <ChevronDown size={16} strokeWidth={2.2} className={isExpanded ? 'is-expanded' : ''} aria-hidden="true" />
                </button>
                {(isExpanded || isSidebarCollapsed) ? <div className="super-admin-sidebar-submenu">
                  <div className="super-admin-sidebar-submenu-title">{item.label}</div>
                  {item.children.map((entry) => {
                    const ChildIcon = entry.icon
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`super-admin-sidebar-subitem ${activeSection === (entry.route || entry.id) ? 'is-active' : ''}`.trim()}
                        onClick={() => { setDismissedSidebarGroup(item.id); handleSidebarSectionChange(entry.route || entry.id) }}
                      >
                        <span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><ChildIcon size={15} strokeWidth={2.1} /></span>
                        <span>{entry.label}</span>
                      </button>
                    )
                  })}
                </div> : null}
              </div>
            )
          }

          if (item.id === 'exams') {
            const isExpanded = Boolean(expandedSidebarGroups.exams)
            const isSyllabusTestExpanded = Boolean(expandedSidebarGroups['syllabus-test'])
            return <div key={item.id} className="super-admin-sidebar-item-group"><button type="button" className={`super-admin-sidebar-item ${isActive ? 'is-active' : ''}`.trim()} data-tooltip="Exams and Result" aria-expanded={isExpanded} onClick={() => setExpandedSidebarGroups((current) => ({ ...current, exams: !current.exams }))}><span className="super-admin-sidebar-icon" aria-hidden="true"><Icon size={18} strokeWidth={2.15} /></span><span>Exams and Result</span><ChevronDown size={16} strokeWidth={2.2} className={isExpanded ? 'is-expanded' : ''} aria-hidden="true" /></button>{(isExpanded || isSidebarCollapsed) ? <div className="super-admin-sidebar-submenu"><button type="button" className={`super-admin-sidebar-subitem super-admin-sidebar-nested-toggle ${isExamsRoute || isAssessmentsRoute || isExamReportsRoute ? 'is-active' : ''}`.trim()} aria-expanded={isSyllabusTestExpanded} onClick={() => setExpandedSidebarGroups((current) => ({ ...current, 'syllabus-test': !current['syllabus-test'] }))}><span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><FileText size={15} strokeWidth={2.1} /></span><span>Syllabus Test</span><ChevronDown size={14} strokeWidth={2.1} className={isSyllabusTestExpanded ? 'is-expanded' : ''} aria-hidden="true" /></button>{(isSyllabusTestExpanded || isSidebarCollapsed) ? <div className="super-admin-sidebar-nested-submenu"><button type="button" className={`super-admin-sidebar-subitem ${isExamsRoute ? 'is-active' : ''}`.trim()} onClick={() => navigate('/dashboard/faculty/exams')}><span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><CheckCircle2 size={15} strokeWidth={2.1} /></span><span>Test</span></button><button type="button" className={`super-admin-sidebar-subitem ${isAssessmentsRoute ? 'is-active' : ''}`.trim()} onClick={() => navigate('/dashboard/faculty/exams/assessments')}><span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><FileText size={15} strokeWidth={2.1} /></span><span>Assessment</span></button><button type="button" className={`super-admin-sidebar-subitem ${isExamReportsRoute ? 'is-active' : ''}`.trim()} onClick={() => navigate('/dashboard/faculty/exams/reports')}><span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><BarChart3 size={15} strokeWidth={2.1} /></span><span>Report</span></button></div> : null}<button type="button" className={`super-admin-sidebar-subitem ${isAcademicTestRoute ? 'is-active' : ''}`.trim()} aria-expanded={isAcademicTestMenuOpen} onClick={() => { if (facultyWeekOffStatus.isWeekOff) { showWeekOffValidation(); return } setIsAcademicTestMenuOpen((current) => !current); navigate('/dashboard/faculty/exams/academic-tests') }}><span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><FileText size={15} strokeWidth={2.1} /></span><span>Academic Test</span><ChevronDown size={14} strokeWidth={2.1} className={isAcademicTestMenuOpen ? 'is-expanded' : ''} aria-hidden="true" /></button>{isAcademicTestMenuOpen || isAcademicTestReportRoute ? <button type="button" className={`super-admin-sidebar-subitem ${isAcademicTestReportRoute ? 'is-active' : ''}`.trim()} onClick={() => navigate('/dashboard/faculty/exams/academic-tests/report')}><span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><BarChart3 size={15} strokeWidth={2.1} /></span><span>Report</span></button> : null}</div> : null}</div>
          }

          return (
            <button
              key={item.id}
              type="button"
              className={`super-admin-sidebar-item ${isActive ? 'is-active' : ''}`.trim()}
              data-tooltip={item.label}
              onClick={() => handleSidebarSectionChange(item.route || item.id)}
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
            <strong>{facultyName}</strong>
          </div>
          <button
            type="button"
            className="super-admin-sidebar-logout-button"
            onClick={handleLogoutClick}
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
      <div className="super-admin-topbar-left">
        <button
          type="button"
          className={`super-admin-sidebar-toggle ${isSidebarCollapsed ? 'is-desktop-expand-toggle' : ''}`.trim()}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Open navigation menu'}
          onClick={() => isSidebarCollapsed ? setIsSidebarCollapsed(false) : setIsMobileSidebarOpen(true)}
        >
          {isSidebarCollapsed ? <PanelLeftOpen size={18} strokeWidth={2.3} /> : <Menu size={20} strokeWidth={2.4} />}
        </button>
        <h2 className="super-admin-topbar-title" style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: 600 }}>Faculty Dashboard</h2>
      </div>
      <div className="super-admin-topbar-right">
        <div className="faculty-dashboard-header-attendance">
          <FacultyAttendanceFlow
            profileName={currentFacultyIdentity.facultyName || facultyName}
            facultyId={currentFacultyIdentity.facultyId}
          />
        </div>
        <div
  ref={notificationRef}
  style={{ position: 'relative' }}
>
        <button
          type="button"
          className="super-admin-notification-button"
          aria-label="Notifications"
          onClick={() => setNotificationOpen((current) => !current)}
        >
          <Bell size={22} strokeWidth={2.1} />
          <span className="super-admin-notification-badge">{unreadNotificationCount}</span>
        </button>
{notificationOpen ? (
  <div
    className="notification-dropdown"
    role="dialog"
    aria-label="Notifications"
  >
    {/* Header */}
    <div className="notification-dropdown-header">
      <h3>Notifications</h3>

      <div className="notification-header-actions">
        <button
          type="button"
          className="mark-all-read-btn"
          onClick={async () => {
            const unreadItems = unreadNotifications
            const unreadIds = unreadItems
              .filter((item) => !item.read)
              .map((item) => item.id)

            if (!unreadIds.length) return

            try {
              const localUnreadIds = unreadItems
                .filter((item) => isFacultyProgressNotification(item))
                .map((item) => item.id)
              const remoteUnreadIds = unreadItems
                .filter((item) => !isFacultyProgressNotification(item))
                .map((item) => item.id)

              if (localUnreadIds.length) {
                markNotificationsAsRead(localUnreadIds)
              }

              if (remoteUnreadIds.length) {
                await markFacultyNotificationsAsRead(remoteUnreadIds)
              }

              setFacultyNotifications((current) =>
                current.map((item) => ({
                  ...item,
                  read: remoteUnreadIds.includes(item.id) ? true : item.read,
                })),
              )
            } catch (error) {
              console.error(
                'Failed to mark all notifications as read',
                error,
              )
            }
          }}
        >
          Mark all as read
        </button>

        <button
          type="button"
          className="notification-close-btn"
          aria-label="Close notifications"
          onClick={() => setNotificationOpen(false)}
        >
          ×
        </button>
      </div>
    </div>

    {/* Notification List */}
    <div className="notification-list">
      {unreadNotifications.length > 0 ? (
        unreadNotifications.slice(0, 3).map((notification) => (
          <button
            key={notification.id}
            type="button"
            className="notification-card is-unread"
            onClick={async () => {
              setNotificationOpen(false)
              if (notification.facultySkillAssignmentId) {
                navigate('/dashboard/faculty/skill-development')
              } else if (notification.kind === 'FACULTY_REPORT_SHARED' && notification.academicTestId) {
                navigate('/dashboard/faculty/exams/academic-tests')
              } else {
                setActiveSection('notifications')
              }
              try {
                if (isFacultyProgressNotification(notification)) {
                  markNotificationsAsRead([notification.id])
                } else {
                  await markFacultyNotificationsAsRead([
                    notification.id,
                  ])
                }

                setFacultyNotifications((current) =>
                  current.map((item) =>
                    item.id === notification.id
                      ? { ...item, read: true }
                      : item,
                  ),
                )
              } catch (error) {
                console.error(
                  'Failed to mark notification as read',
                  error,
                )
              }
            }}
          >
            <span className="notification-status-icon">
              ?
            </span>

            <span className="notification-content">
              <strong>{notification.title}</strong>

              <span className="notification-message">
                {notification.message}
              </span>

              <span className="notification-time">
                {formatNotificationTime(notification.createdAt) || 'Just now'}
              </span>
            </span>
          </button>
        ))
      ) : (
        <div className="notification-empty">
          No unread notifications
        </div>
      )}
    </div>

    <button
      type="button"
      className="notification-footer"
      onClick={() => {
        setNotificationOpen(false)
        setActiveSection('notifications')
      }}
    >
      View all notifications
    </button>
  </div>
) : null}
         
        </div>

        <div className="branch-dashboard-profile-menu-wrap" ref={profileMenuRef}>
          <button
            type="button"
            className="super-admin-profile branch-dashboard-profile-trigger"
            onClick={() => setIsProfileMenuOpen((current) => !current)}
          >
            <span className="super-admin-avatar" aria-hidden="true">
              <span className="super-admin-avatar-mark">
                <ShieldCheck size={18} strokeWidth={2.2} />
              </span>
            </span>
            <div className="super-admin-profile-copy">
              <strong>{facultyName}</strong>
            </div>
            <ChevronDown size={16} strokeWidth={2.2} className="branch-dashboard-profile-caret" aria-hidden="true" />
          </button>

          {isProfileMenuOpen ? (
            <div className="branch-dashboard-profile-menu" role="menu" aria-label="Faculty profile menu">
              <button
                type="button"
                className="branch-dashboard-profile-menu-item"
                onClick={() => {
                  setActiveSection('profile')
                  setIsProfileMenuOpen(false)
                }}
              >
                <CircleUserRound size={16} strokeWidth={2.1} />
                <span>Profile</span>
              </button>
              <button type="button" className="branch-dashboard-profile-menu-item is-danger" onClick={handleLogoutClick}>
                <LogOut size={16} strokeWidth={2.1} />
                <span>Logout</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )

  const normalizedAttendanceSearch = todayWorkAttendanceSearch.trim().toLowerCase()
  const todayWorkAttendanceWindow = resolveBatchAttendanceWindow(
    attendanceBatchTiming,
    attendanceClock,
  )
  const hasUnmarkedAttendance = useMemo(() => {
    const draftAttendance = todayWorkForm.attendanceByStudent || {}

    return studentsFlowVisibleStudents.some((student) => {
      const studentId = getTodayWorkStudentId(student)
      if (!studentId) return false

      const hasDraftStatus = isTodayWorkModalOpen && Object.prototype.hasOwnProperty.call(draftAttendance, studentId)
      const status = hasDraftStatus
        ? draftAttendance[studentId]
        : getCurrentStudentAttendanceStatus(studentAttendanceStatuses, student)

      return !isAttendanceMarkedStatus(status)
    })
  }, [isTodayWorkModalOpen, studentAttendanceStatuses, studentsFlowVisibleStudents, todayWorkForm.attendanceByStudent])
  const temporarySessionWindowLocked = Boolean(temporarySessionContext) && !isTemporarySessionEditable(temporarySessionContext.item, attendanceClock)
  const attendanceWindowLocked = temporarySessionWindowLocked || (todayWorkMode === 'attendance' && !todayWorkAttendanceWindow.isEditable)
  const hasTemporaryAttendanceOverride = Boolean(activeTemporaryAttendanceSession)
  const attendanceWeekTypeLocked = Boolean(selectedStudentsBatch) && (
    activeTemporaryAttendanceSession?.isOriginalRescheduledSession
    || (!hasTemporaryAttendanceOverride && !isAttendanceDayForBatch(selectedStudentsBatch))
  )

  useEffect(() => {
    if (!selectedStudentsBatchId || !todayWorkAttendanceWindow.isReminder || !hasUnmarkedAttendance) {
      attendanceWarningLevelRef.current = 0
      setAttendanceWarningPopup(null)
      return
    }

    if (attendanceWarningLevelRef.current !== todayWorkAttendanceWindow.warningMinutes) {
      attendanceWarningLevelRef.current = todayWorkAttendanceWindow.warningMinutes
      setAttendanceWarningPopup({
        minutes: todayWorkAttendanceWindow.warningMinutes,
        message: todayWorkAttendanceWindow.reason,
      })
    }
  }, [hasUnmarkedAttendance, selectedStudentsBatchId, todayWorkAttendanceWindow.isReminder, todayWorkAttendanceWindow.warningMinutes, todayWorkAttendanceWindow.reason])

  const visibleAttendanceStudents = studentsFlowVisibleStudents.filter((student) => {
    if (!normalizedAttendanceSearch) return true
    return [student?.studentName, student?.studentId, student?.emailAddress]
      .map((value) => String(value || '').toLowerCase())
      .some((value) => value.includes(normalizedAttendanceSearch))
  })
  const markedAttendanceCount = studentsFlowActionableStudents.filter((student) => (
    ['PRESENT', 'ABSENT'].includes(todayWorkForm.attendanceByStudent?.[getTodayWorkStudentId(student)] || '')
  )).length
  const allTodayWorkStudentsPresent = studentsFlowActionableStudents.length > 0 && studentsFlowActionableStudents.every((student) => (
    todayWorkForm.attendanceByStudent?.[getTodayWorkStudentId(student)] === 'PRESENT'
  ))

  return (
    <section className={`super-admin-page ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`.trim()}>
      <div className="super-admin-shell">
        {renderSidebar()}

        <div className="super-admin-main">
          {renderTopbar()}

          <main className="super-admin-content">
              <div className="branch-dashboard-content">
              {facultyWeekOffStatus.isWeekOff ? (
                <section className="faculty-weekoff-readonly-banner" role="status" aria-live="polite">
                  <div className="faculty-weekoff-readonly-icon" aria-hidden="true"><CalendarDays size={22} strokeWidth={2.2} /></div>
                  <div className="faculty-weekoff-readonly-copy">
                    <strong>Today is your Week Off</strong>
                    <span>{facultyWeekOffStatus.temporary ? 'Approved alternate week-off.' : 'Regular weekly-off.'} Attendance, Today&apos;s Work, and Academic Test actions are read-only today.</span>
                  </div>
                </section>
              ) : null}
              {weekOffValidationMessage ? (
                <section className="faculty-weekoff-validation" role="alert">
                  <AlertTriangle size={19} strokeWidth={2.2} aria-hidden="true" />
                  <span>{weekOffValidationMessage}</span>
                  <button type="button" aria-label="Close week-off message" onClick={() => setWeekOffValidationMessage('')}><X size={17} /></button>
                </section>
              ) : null}
              {user && user.mustResetPassword ? (
                <section className="branch-dashboard-password-alert" aria-live="polite">
                  <div className="branch-dashboard-password-alert-copy">
                    <strong>Temporary password still active</strong>
                    <p>
                      You have not reset your temporary password yet. Please reset it now to secure your faculty dashboard account.
                    </p>
                  </div>
                  <Button type="button" onClick={openResetPassword}>
                    Reset Password
                  </Button>
                </section>
              ) : null}

              {activeSection === 'skill-development' ? <FacultySkillDevelopmentPage /> : null}

              {isStudentExamReportRoute ? <FacultyStudentExamReportPage embedded /> : isExamReportsRoute ? <FacultyExamCourseGate title={new URLSearchParams(location.search).get('tab') === 'assessments' ? 'Assessment Report' : 'Syllabus Test Report'}>{({ course, batch }) => <FacultyExamReportsPage embedded selectedCourseId={course.id} selectedBatchId={batch.id || batch.batchId} />}</FacultyExamCourseGate> : isAssessmentsRoute ? <FacultyExamCourseGate title="Syllabus Test Assessment">{({ course, batch }) => <FacultyAssessmentsPage embedded selectedCourseId={course.id} selectedBatchId={batch.id || batch.batchId} />}</FacultyExamCourseGate> : isAcademicTestReportRoute ? <FacultyExamCourseGate title="Academic Test Report">{({ course, batch }) => <AcademicTestReportPage embedded selectedCourseId={course.id} selectedBatchId={batch.id || batch.batchId} />}</FacultyExamCourseGate> : isAcademicTestRoute ? (isAcademicCreateRoute ? <AcademicTestPage mode="faculty" facultyWeekOffBlocked={facultyWeekOffStatus.isWeekOff} onWeekOffBlocked={showWeekOffValidation} facultyBatchStudentCounts={new Map(facultyBatchRows.map((entry) => [getFacultyFlowBatchKey(entry), entry.students]))} autoOpenCreate onCreateClose={() => { const params = new URLSearchParams(location.search); const itemId = params.get('itemId'); const batchId = params.get('batchId'); navigate(`/dashboard/faculty/exams/academic-tests/${encodeURIComponent(itemId || '')}/${encodeURIComponent(batchId || '')}`) }} /> : isAcademicTestListRoute ? <AcademicTestPage mode="faculty" facultyWeekOffBlocked={facultyWeekOffStatus.isWeekOff} onWeekOffBlocked={showWeekOffValidation} /> : location.pathname.replace(/\/+$/, '') === '/dashboard/faculty/exams/academic-tests' ? <FacultyExamCourseGate title="Academic Test">{({ course, batch }) => <AcademicTestPage mode="faculty" facultyWeekOffBlocked={facultyWeekOffStatus.isWeekOff} onWeekOffBlocked={showWeekOffValidation} facultyCourseId={course.id} facultyBatchId={batch.id || batch.batchId} facultyCourseProgressByBatch={facultyAllCourseBatchProgress} facultyBatchStudentCounts={new Map(facultyBatchRows.map((entry) => [getFacultyFlowBatchKey(entry), entry.students]))} />}</FacultyExamCourseGate> : <AcademicTestPreparationPage embedded facultyCourseProgressByBatch={facultyAllCourseBatchProgress} facultyWeekOffBlocked={facultyWeekOffStatus.isWeekOff} onWeekOffBlocked={showWeekOffValidation} />) : isExamsRoute ? <FacultyExamCourseGate title="Syllabus Test">{({ course, batch }) => <FacultyExamsPage embedded selectedCourseId={course.id} selectedBatchId={batch.id || batch.batchId} />}</FacultyExamCourseGate> : null}

              {!isExamsRoute && !isAssessmentsRoute && !isExamReportsRoute && !isAcademicTestRoute && activeSection === 'dashboard' ? (
                <>
                  <div className="branch-dashboard-overview-intro">
                    <p style={{ marginTop: '12px' }}>Welcome back, {facultyName}! Here&apos;s an overview of your active courses, batches, and student attendance metrics.</p>
                  </div>

                  <div className="branch-dashboard-stats">
                    {stats.map((stat) => (
                      <article key={stat.label} className={`branch-dashboard-stat-card branch-dashboard-stat-card--${stat.tone}`}>
                        <div className="branch-dashboard-stat-heading">
                          <span className="branch-dashboard-stat-icon"><stat.icon size={19} strokeWidth={2.1} aria-hidden="true" /></span>
                          <span>{stat.label}</span>
                        </div>
                        <strong style={{ fontSize: '18px' }}>{stat.value}</strong>
                        <small className={stat.highlightNote ? 'faculty-dashboard-weekoff-day' : ''}>{stat.note}</small>
                      </article>
                    ))}
                  </div>

                  <div className="faculty-dashboard-dashboard-grid">
                    <FacultyDashboardOverview
                      overview={dashboardOverview}
                      loading={dashboardOverviewLoading}
                      error={dashboardOverviewError}
                      todayAttendance={todayAttendance}
                      todayAttendanceLoading={todayAttendanceLoading}
                      todayAttendanceError={todayAttendanceError}
                      onRetry={() => window.dispatchEvent(new Event('cispro:faculty-dashboard-refresh'))}
                    />

                    <FacultyDashboardScheduleSections
                      batches={facultyBatchRows}
                      todayWorkEntries={facultyTodayWorkEntries}
                      facultyProfile={facultyProfile || facultySummaryBackfillRecord}
                      loading={dashboardOverviewLoading}
                      onViewAll={() => setActiveSection('my-batches')}
                    />
                  </div>

                </>
              ) : null}

              {activeSection === 'my-courses' ? (
                <FacultyDashboardSection
                  title="Course"
                  className="faculty-course-section"
                >
                  {coursesLoading ? (
                    <div className="faculty-my-batches-loading-card">
                      <strong>Loading course details</strong>
                      <p>We&apos;re pulling the exact course record assigned to you.</p>
                    </div>
                  ) : coursesError ? (
                    <div className="faculty-my-batches-loading-card">
                      <strong>Course details unavailable</strong>
                      <p>{coursesError}</p>
                    </div>
                  ) : assignedCourses.length ? (
                    <div className="faculty-course-course-view">
                      {assignedCourses.length > 1 ? (
                        <div className="faculty-course-switcher" aria-label="Assigned courses">
                          {assignedCourses.map((course) => {
                            const isActive = String(course.id || '').trim() === String(selectedCourse?.id || '').trim()

                            return (
                              <button
                                key={course.id}
                                type="button"
                                className={`faculty-course-switcher-pill ${isActive ? 'is-active' : ''}`.trim()}
                                onClick={() => {
                                  setSelectedCourseId(String(course.id || '').trim())
                                  setExpandedCourseModuleIds([])
                                  setCourseModuleLimit(5)
                                }}
                              >
                                <span>{course.courseCode || 'Course'}</span>
                                <strong>{course.name || course.courseName || 'Course'}</strong>
                              </button>
                            )
                          })}
                        </div>
                      ) : null}

                      <section className="faculty-course-hero">
                        <div className="faculty-course-hero-header">
                          <span className={`faculty-course-hero-status ${String(selectedCourse?.status || 'Active').toLowerCase()}`.trim()}>
                            {selectedCourse?.status || 'Active'}
                          </span>

                          <div className="faculty-course-hero-title-row">
                            <h3 className="faculty-course-hero-title">{selectedCourse?.name || selectedCourse?.courseName || 'Course'}</h3>

                            <button
                              type="button"
                              className="faculty-course-edit-request-btn faculty-course-edit-request-btn--hero"
                              onClick={
                                canOpenCourseEditor
                                  ? openCourseEditModal
                                  : isCourseEditCompleted
                                    ? openCourseRequestModal
                                    : openCourseRequestModal
                              }
                              disabled={isCourseEditSaving || isCourseRequestSaving}
                            >
                              <Pencil size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                              <span>
                                {canOpenCourseEditor
                                  ? 'Open Edit'
                                  : isCourseEditPending
                                    ? 'Request Pending'
                                    : isCourseEditCompleted
                                      ? 'Request Completed'
                                      : 'Edit Request'}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="faculty-course-hero-divider" aria-hidden="true" />

                        <div className="faculty-course-hero-metrics">
                          <div className="faculty-course-hero-metric">
                            <span className="faculty-course-hero-metric-icon tone-blue" aria-hidden="true">
                              <BookOpen size={24} strokeWidth={2.1} />
                            </span>
                            <div>
                              <strong>{selectedCourse?.courseCode || selectedCourse?.id || '-'}</strong>
                              <span>Course Code</span>
                            </div>
                          </div>

                          <div className="faculty-course-hero-metric">
                            <span className="faculty-course-hero-metric-icon tone-green" aria-hidden="true">
                              <Monitor size={24} strokeWidth={2.1} />
                            </span>
                            <div>
                              <strong>{selectedCourse?.mode || '-'}</strong>
                              <span>Mode</span>
                            </div>
                          </div>

                          <div className="faculty-course-hero-metric">
                            <span className="faculty-course-hero-metric-icon tone-purple" aria-hidden="true">
                              <CalendarDays size={24} strokeWidth={2.1} />
                            </span>
                            <div>
                              <strong>{formatCourseDuration(selectedCourse?.duration)}</strong>
                              <span>Duration</span>
                            </div>
                          </div>

                          <div className="faculty-course-hero-metric">
                            <span className="faculty-course-hero-metric-icon tone-orange" aria-hidden="true">
                              <Clock3 size={24} strokeWidth={2.1} />
                            </span>
                            <div>
                              <strong>{formatCourseHours(selectedCourse?.hours)}</strong>
                              <span>Course Hours</span>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="faculty-course-curriculum-shell">
                        <div className="faculty-course-curriculum">
                          <div className="faculty-course-curriculum-toolbar">
                            <div>
                              <p className="faculty-course-section-kicker">MODULES &amp; SUBMODULES</p>
                              <h4>Expand a module to view its submodules</h4>
                            </div>

                            <button type="button" className="faculty-course-expand-all" onClick={toggleAllCourseModules}>
                              {isAllModulesExpanded ? 'Collapse All' : 'Expand All'}
                            </button>
                          </div>

                          {visibleCourseModules.length ? (
                            <div className="faculty-course-table-view">
                              <>
                              <div className="faculty-course-table-shell">
                                <div className="faculty-course-table-head">
                                  <span>S.NO</span>
                                  <span>Module Name</span>
                                  <span>Submodules Count</span>
                                  <span>Progress</span>
                                  <span>Action</span>
                                </div>

                                <div className="faculty-course-table-body">
                                  {visibleCourseModules.map((module, index) => {
                                    const absoluteIndex = index
                                    const moduleKey = String(module?.id || `${selectedCourse?.id || 'course'}-module-${absoluteIndex}`).trim()
                                    const isExpanded = expandedCourseModuleIds.includes(moduleKey)
                                    const submodules = getCourseSubmodules(module)
                                    const moduleName = getCourseModuleName(module, absoluteIndex)
                                    const modulePercent = getModulePercentage(module, absoluteIndex, selectedCourseModules.length)

                                    return (
                                      <div key={moduleKey} className={`faculty-course-table-row ${isExpanded ? 'is-expanded' : ''}`.trim()}>
                                        <div className="faculty-course-table-cell faculty-course-table-cell-index">
                                          {String(absoluteIndex + 1).padStart(2, '0')}
                                        </div>

                                        <div className="faculty-course-table-cell faculty-course-table-cell-name">
                                          <strong>{moduleName}</strong>
                                        </div>

                                        <div className="faculty-course-table-cell faculty-course-table-cell-count">
                                          {submodules.length}
                                        </div>

                                        <div className="faculty-course-table-cell faculty-course-table-cell-progress">
                                          <span>{modulePercent}</span>
                                        </div>

                                        <button
                                          type="button"
                                          className="faculty-course-table-action"
                                          onClick={() => toggleCourseModule(moduleKey)}
                                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${moduleName}`}
                                          aria-expanded={isExpanded}
                                        >
                                          {isExpanded ? (
                                            <ChevronUp size={18} strokeWidth={2.4} />
                                          ) : (
                                            <ChevronRight size={18} strokeWidth={2.4} />
                                          )}
                                        </button>

                                        <div className="faculty-course-table-subtable" aria-hidden={!isExpanded}>
                                            <div className="faculty-course-table-subhead">
                                              <span>Submodule </span>
                                              <span>Submodule Name</span>
                                            </div>

                                          {submodules.length ? submodules.map((submodule, subIndex) => (
                                              <div key={String(submodule?.id || `${moduleKey}-sub-${subIndex}`)} className="faculty-course-table-subrow">
                                                <div className="faculty-course-table-cell faculty-course-table-subcell-index">
                                                  {`${absoluteIndex + 1}.${subIndex + 1}`}
                                                </div>
                                                <div className="faculty-course-table-cell faculty-course-table-subcell-name">
                                                  <i aria-hidden="true" />
                                                  <strong>{getCourseSubmoduleName(submodule, subIndex)}</strong>
                                                </div>
                                              </div>
                                            )) : (
                                              <div className="faculty-course-table-subempty">No submodules added</div>
                                            )}
                                          </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                              {courseModuleLimit < selectedCourseModules.length ? (
                                <div className="faculty-course-table-footer">
                                  <span className="faculty-course-table-summary">
                                    Showing {visibleCourseModules.length} of {selectedCourseModules.length} modules
                                  </span>
                                  <button
                                    type="button"
                                    className="faculty-course-more-sections"
                                    onClick={() => setCourseModuleLimit(selectedCourseModules.length)}
                                  >
                                    {selectedCourseModules.length - courseModuleLimit} more sections
                                    <ChevronDown size={16} strokeWidth={2.4} />
                                  </button>
                                </div>
                              ) : null}
                              </>
                            </div>
                          ) : (
                            <div className="faculty-course-empty-state">
                              No modules found for this course yet.
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="faculty-my-batches-empty">
                      <strong>No assigned courses found</strong>
                      <p>
                        We could not match a branch course to your faculty profile yet. Once the course is assigned,
                        the full course details will appear here.
                      </p>
                    </div>
                  )}
                </FacultyDashboardSection>
              ) : null}

              {activeSection === 'my-batches' ? (
                <FacultyDashboardSection title="My Batches" description="Overview of active learning batches under your instruction.">
                  <div className="faculty-batches-filter-toolbar">
                    <div className="branch-dashboard-section-summary faculty-batches-total-summary">
                      <span>Total batches:</span>
                      <strong>{filteredFacultyBatchRows.length}</strong>
                    </div>
                    <FacultyBatchWeekTypeFilter
                      value={facultyBatchWeekTypeFilter}
                      onChange={setFacultyBatchWeekTypeFilter}
                    />
                  </div>
                  <div className="branch-dashboard-table-shell">
                    <table className="branch-dashboard-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>S.No</th>
                          <th>Batch Name</th>
                          <th>Course Name</th>
                          <th>Week Type</th>
                          <th>Timings</th>
                          <th>Total Students</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedFacultyBatchRows.length ? (
                          paginatedFacultyBatchRows.map((batch, index) => (
                            <tr key={batch.id || batch.code || `${batch.course}-${index}`}>
                              <td>{(safeBatchPage - 1) * batchesPerPage + index + 1}</td>
                              <td><strong className="text-slate-800">{batch.batchName || batch.code || '-'}</strong></td>
                              <td><strong className="text-slate-800">{batch.course}</strong></td>
                              <td>{normalizeFacultyBatchWeekType(batch) === 'WEEKEND' ? 'Weekend' : normalizeFacultyBatchWeekType(batch) === 'WEEKDAY' ? 'Weekday' : '-'}</td>
                              <td>{batch.timing}</td>
                              <td>{batch.students} students</td>
                              <td>
                                <span className={`branch-course-status-pill ${String(batch.status || 'active').toLowerCase().replace(/\s+/g, '-')}`}>
                                  {batch.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>
                              <div className="faculty-my-batches-empty" style={{ padding: '20px 0' }}>
                                <strong>{facultyBatchWeekTypeFilter === 'all' ? 'No batches mapped yet' : `No ${facultyBatchWeekTypeFilter} batches found`}</strong>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {filteredFacultyBatchRows.length > batchesPerPage ? (
                      <div className="faculty-batches-pagination-wrap">
                        <PaginationBar
                          currentPage={safeBatchPage}
                          totalPages={totalBatchPages}
                          onPageChange={setBatchPage}
                          className="faculty-batches-pagination"
                          label="My Batches pagination"
                        />
                      </div>
                    ) : null}
                  </div>
                </FacultyDashboardSection>
              ) : null}

              {activeSection === 'my-calendar' ? (
                <FacultyCalendar
                  faculty={facultyDetails}
                  facultyProfile={facultyProfile || currentFacultyIdentity}
                  assignedBatches={facultyBatchRows}
                  weekOffRequests={facultyWeekOffRequests}
                />
              ) : null}

              {isStudentCalendarRoute ? (
                <StudentCalendarPage
                  studentId={decodeURIComponent(studentCalendarId)}
                  student={location.state?.temporaryStudent || facultyScopedStudents.find((student) => [student?.studentId, student?.id, student?._id].map((value) => String(value || '').trim().toLowerCase()).includes(String(decodeURIComponent(studentCalendarId)).trim().toLowerCase()))}
                  useFacultyCalendar
                  backPath="/dashboard/faculty/my-batches"
                  onBack={() => {
                    setActiveSection('students')
                    navigate('/dashboard/faculty/my-batches')
                  }}
                />
              ) : null}

              {activeSection === 'students' && !isStudentCalendarRoute ? (
                <FacultyDashboardSection
                  title={facultyViewLabel}
                  actions={(
                    <div className="faculty-student-action-buttons">
                      {studentsViewMode === 'active' && studentsFlowLevel === 3 ? (
                        <>
                      <button
                        type="button"
                        className={`faculty-today-work-trigger ${facultyWeekOffStatus.isWeekOff ? 'is-read-only' : ''}`.trim()}
                        disabled={attendanceWeekTypeLocked || !studentsFlowActionableStudents.length}
                        title={attendanceWeekTypeLocked ? `Attendance is disabled today for this ${selectedStudentsBatch?.weekType === 'WEEKEND' ? 'weekend' : 'weekday'} batch` : 'Open Attendance'}
                        onClick={() => openTodayWorkModal('attendance')}
                      >
                        <BookOpen size={16} />
                        <span>Attendance</span>
                      </button>
                      {selectedStudentsBatchCompleted ? (
                        <span className="faculty-batch-completed-label" role="status">
                          Batch Completed
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={`faculty-today-work-trigger faculty-today-work-trigger--progress ${facultyWeekOffStatus.isWeekOff ? 'is-read-only' : ''}`.trim()}
                        onClick={() => openTodayWorkModal('progress')}
                        disabled={!studentsFlowActionableStudents.length}
                      >
                        <BookOpen size={16} />
                        <span>Today's Work</span>
                      </button>
                        </>
                      ) : null}
                    </div>
                  )}
                >
                  {studentsViewMode !== 'active' ? (
                    <div className="faculty-students-flow-stage faculty-student-records-stage">
                      <div className="faculty-student-records-toolbar">
                        <div>
                          <strong>{studentsViewMode === 'discontinued' ? 'Discontinued Student Records' : 'Completed Student Records'}</strong>
                          <span>{studentsViewMode === 'discontinued' ? 'Attendance and academic updates are disabled for these students.' : 'Course progress, paid progress, and academic tests are complete.'}</span>
                        </div>
                        <input
                          type="search"
                          value={studentRecordsSearch}
                          onChange={(event) => setStudentRecordsSearch(event.target.value)}
                          placeholder="Search student records"
                          aria-label="Search completed student records"
                        />
                      </div>
                      {paginatedStudentRecords.length ? (
                        <div className={`branch-dashboard-table-shell faculty-students-table-shell faculty-student-records-shell faculty-student-records-shell--${studentsViewMode}`}>
                          <table className="branch-dashboard-table faculty-student-records-table">
                            <thead>
                              <tr>
                                <th>Student Name</th>
                                <th>Course</th>
                                <th className="faculty-student-batch-column">Batch</th>
                                {studentsViewMode === 'active' ? <th>Faculty</th> : null}
                                <th className="faculty-student-progress-column">Course Progress</th>
                                <th>Course Status</th>
                                <th className="faculty-student-completion-date-column">Completion Date</th>
                                <th className="faculty-student-action-column">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedStudentRecords.map((student) => (
                                (() => {
                                  const lifecycleMetrics = student._facultyLifecycleMetrics || getFacultyStudentLifecycle(student, student._facultyCourse || {})
                                  const courseStatus = student._facultyLifecycle === 'DISCONTINUED'
                                    ? 'DISCONTINUED'
                                    : lifecycleMetrics.isCompleted ? 'COMPLETED' : getCourseStatusFromProgress(student.courseProgress)
                                  const academicProgress = lifecycleMetrics.academicTestProgress
                                  const hasEvaluationSummary = Number.isFinite(Number(academicProgress?.totalEvaluations))
                                  const academicTotalTests = Math.max(0, Number(academicProgress?.totalTests ?? academicProgress?.total ?? 0))
                                  const academicCompletedTests = Math.max(0, Number(academicProgress?.completedTests ?? academicProgress?.completed ?? (academicTotalTests - Number(academicProgress?.pendingTests ?? academicProgress?.pending ?? 0))))
                                  const academicPercentage = Math.min(100, Math.max(0, Number(academicProgress?.percentage ?? academicProgress?.progress ?? (academicTotalTests > 0 ? (academicCompletedTests / academicTotalTests) * 100 : 0))))
                                  let academicTestsLabel = academicProgress && academicTotalTests > 0
                                    ? `${Math.min(academicTotalTests, academicCompletedTests)}/${academicTotalTests} · ${Math.round(academicPercentage)}%`
                                    : courseStatus === 'COMPLETED'
                                      ? '100% Complete'
                                      : academicProgress
                                        ? `${Math.max(0, Number(academicProgress.pendingTests ?? academicProgress.pending ?? 0))} pending`
                                        : '-'
                                  const academicTotalProjects = Math.max(0, Number(academicProgress?.totalProjects ?? 0))
                                  const academicCompletedProjects = Math.max(0, Number(academicProgress?.completedProjects ?? (academicTotalProjects - Number(academicProgress?.pendingProjects ?? 0))))
                                  const academicProjectPercentage = Math.min(100, Math.max(0, Number(academicProgress?.projectPercentage ?? (academicTotalProjects > 0 ? (academicCompletedProjects / academicTotalProjects) * 100 : 100))))
                                  const academicTotalRequirements = hasEvaluationSummary
                                    ? Math.max(0, Number(academicProgress.totalEvaluations))
                                    : academicTotalTests + academicTotalProjects
                                  const academicCompletedRequirements = hasEvaluationSummary
                                    ? Math.min(academicTotalRequirements, Math.max(0, Number(academicProgress.completedEvaluations ?? 0)))
                                    : Math.min(academicTotalRequirements, academicCompletedTests + academicCompletedProjects)
                                  const academicOverallPercentage = hasEvaluationSummary
                                    ? Math.round(Math.min(100, Math.max(0, Number(academicProgress.evaluationPercentage ?? (academicTotalRequirements > 0 ? (academicCompletedRequirements / academicTotalRequirements) * 100 : 0)))))
                                    : academicTotalRequirements > 0
                                      ? Math.round((academicCompletedRequirements / academicTotalRequirements) * 100)
                                    : Math.round(Math.min(academicPercentage, academicProjectPercentage))
                                  const academicSummaryCount = academicTotalRequirements > 0
                                    ? `Academic ${academicCompletedRequirements}/${academicTotalRequirements}`
                                    : academicTestsLabel
                                  const hasAcademicSummary = academicTotalRequirements > 0
                                  const academicMarksTotal = Number(academicProgress?.marksTotal ?? 0)
                                  const academicMarksObtained = Number(academicProgress?.marksObtained ?? 0)
                                  const academicMarksPercentage = academicProgress?.marksPercentage == null
                                    ? null
                                    : Number(academicProgress.marksPercentage)
                                  const academicResultLabels = Array.isArray(academicProgress?.academicResults)
                                    ? academicProgress.academicResults.map((result) => {
                                      const typeLabel = result.testType === 'TEST_AND_PROJECT'
                                        ? 'Test + Project'
                                        : result.testType === 'PROJECT' ? 'Project' : 'Test'
                                      const hasMarks = Number(result.totalMarks || 0) > 0 && (
                                        result.testType === 'PROJECT'
                                          ? result.projectMarks != null
                                          : result.testType === 'TEST_AND_PROJECT'
                                            ? result.testMarks != null && result.projectMarks != null
                                            : result.testMarks != null
                                      )
                                      if (result.testType === 'TEST_AND_PROJECT' && !hasMarks) {
                                        const testLabel = result.testMarks != null
                                          ? `${result.testMarks}/${result.testTotalMarks}`
                                          : 'Pending'
                                        const projectLabel = result.projectMarks != null
                                          ? `${result.projectMarks}/${result.projectTotalMarks} · ${result.projectTotalMarks > 0 ? Number(((result.projectMarks / result.projectTotalMarks) * 100).toFixed(2)) : 0}%`
                                          : 'Pending'
                                        return `Test ${result.testNumber} (${typeLabel}): Test ${testLabel}, Project ${projectLabel}`
                                      }
                                      return `Test ${result.testNumber} (${typeLabel}): ${hasMarks ? `${result.obtainedMarks}/${result.totalMarks} · ${result.percentage ?? 0}%` : 'Pending'}`
                                    })
                                    : []
                                  const academicMarksLabel = academicResultLabels.length
                                    ? academicResultLabels
                                    : academicMarksTotal > 0
                                      ? [`Marks ${academicMarksObtained}/${academicMarksTotal} · ${academicMarksPercentage ?? 0}%`]
                                      : []
                                  const academicResults = Array.isArray(academicProgress?.academicResults) ? academicProgress.academicResults : []
                                  const academicResultFor = (column) => academicResults.find((result) => Number(result.testNumber) === Number(column.testNumber))
                                  const academicTestResults = academicResults.filter((result) => result.testMarks != null && Number(result.testTotalMarks) > 0)
                                  const academicProjectResults = academicResults.filter((result) => result.projectMarks != null && Number(result.projectTotalMarks) > 0)
                                  const overallTestTotal = academicTestResults.reduce((sum, result) => sum + Number(result.testTotalMarks || 0), 0)
                                  const overallTestObtained = academicTestResults.reduce((sum, result) => sum + Number(result.testMarks || 0), 0)
                                  const overallProjectTotal = academicProjectResults.reduce((sum, result) => sum + Number(result.projectTotalMarks || 0), 0)
                                  const overallProjectObtained = academicProjectResults.reduce((sum, result) => sum + Number(result.projectMarks || 0), 0)
                                  const academicCell = (result, type) => {
                                    if (!result) return <span className="faculty-academic-empty">-</span>
                                    const marks = type === 'project' ? result.projectMarks : result.testMarks
                                    const total = type === 'project' ? result.projectTotalMarks : result.testTotalMarks
                                    const percentage = marks != null && Number(total) > 0 ? Number(((Number(marks) / Number(total)) * 100).toFixed(2)) : null
                                    const status = type === 'project' ? result.projectResult : result.testResult
                                    return <span className="faculty-academic-result-cell"><strong>{marks != null && Number(total) > 0 ? `${marks}/${total}` : 'Pending'}</strong>{percentage != null ? <small>{percentage}%</small> : null}{status ? <em className={String(status).toLowerCase()}>{status}</em> : null}</span>
                                  }
                                  const completionDate = student.courseCompletedAt ||
                                    lifecycleMetrics.enrollment?.courseCompletedAt ||
                                    student.courseCompletionDate ||
                                    student.completedAt ||
                                    student.courseEndDate ||
                                    null
                                  return (
                                <tr key={[student.id || student.studentId, student.courseId || student.courseName, student.batchId || student.batchName].filter(Boolean).join('-')}>
                                  <td>
                                    <strong>{student.studentName || '-'}</strong>
                                    <small className="faculty-student-id-under-name">{student.studentId || student.id || '-'}</small>
                                  </td>
                                  <td>{student.courseName || student.course?.name || '-'}</td>
                                  <td className="faculty-student-batch-column">{student.batchName || student.batch || '-'}</td>
                                  {studentsViewMode === 'active' ? <td>{student.facultyName || '-'}</td> : null}
                                  <td className="faculty-student-progress-column">
                                    <div className="faculty-student-progress-meter">
                                      <div className="faculty-student-progress-meter__header"><span>{lifecycleMetrics.courseProgress}%</span></div>
                                      <div className="faculty-student-progress-meter__track" aria-label={`Course progress ${lifecycleMetrics.courseProgress}%`}>
                                        <span style={{ width: `${lifecycleMetrics.courseProgress}%` }} />
                                      </div>
                                    </div>
                                  </td>
                                  <td><span className={`faculty-student-course-status ${courseStatus.toLowerCase()}`}>{courseStatus === 'DISCONTINUED' ? 'Discontinued' : getCourseStatusLabel(courseStatus)}</span></td>
                                  <td className="faculty-student-completion-date-column">{completionDate ? formatStudentDate(completionDate) : '-'}</td>
                                  <td className="faculty-student-action-column">
                                    <button type="button" className="faculty-student-view-action" onClick={() => setAcademicTestModalStudent(student)}>
                                      View
                                    </button>
                                  </td>
                                </tr>
                                  )
                                })()
                              ))}
                            </tbody>
                          </table>
                          {filteredStudentRecords.length > studentRecordsPerPage ? (
                            <div className="faculty-students-pagination-wrap">
                              <PaginationBar
                                currentPage={safeStudentRecordsPage}
                                totalPages={studentRecordsTotalPages}
                                onPageChange={setStudentRecordsPage}
                                className="faculty-students-pagination"
                                label="Student records pagination"
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="faculty-my-batches-empty faculty-students-flow-empty">
                          <strong>{studentRecordsSearch ? 'No matching student records' : studentsViewMode === 'discontinued' ? 'No discontinued student records' : 'No completed student records'}</strong>
                          <p>{studentsViewMode === 'discontinued' ? 'Approved discontinued students will appear here.' : 'Students appear here only when course progress, paid progress, and academic tests are complete.'}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                  {studentsFlowLevel === 1 ? (
                    <div className="faculty-students-flow-stage">
                      {facultyCourseRows.length ? (
                        <div className="branch-dashboard-table-shell faculty-students-table-shell faculty-students-flow-shell faculty-students-courses-shell">
                          <table className="branch-dashboard-table">
                            <thead>
                              <tr>
                                <th style={{ width: '72px' }}>S.No</th>
                                <th>Course Code</th>
                                <th>Course Name</th>
                                <th>Total Batches</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {facultyCourseRows.map((course, index) => (
                                <tr
                                  key={course.id || course.courseId || course.name || index}
                                  className="faculty-students-course-row-clickable"
                                  tabIndex={0}
                                  onClick={() => {
                                    setSelectedStudentsCourseId(getFacultyFlowCourseKey(course))
                                    setSelectedStudentsBatchId('')
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      setSelectedStudentsCourseId(getFacultyFlowCourseKey(course))
                                      setSelectedStudentsBatchId('')
                                    }
                                  }}
                                >
                                  <td>{index + 1}</td>
                                  <td><strong>{course.courseCode || course.id || '-'}</strong></td>
                                  <td>{course.name || course.courseName || '-'}</td>
                                  <td>{course.totalBatches}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="faculty-students-flow-action-btn"
                                      onClick={() => {
                                        setSelectedStudentsCourseId(getFacultyFlowCourseKey(course))
                                        setSelectedStudentsBatchId('')
                                      }}
                                    >
                                      View Batches
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="faculty-my-batches-empty faculty-students-flow-empty">
                          <strong>No assigned courses found</strong>
                          <p>We could not find any course mapped to this faculty yet.</p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {studentsFlowLevel === 2 ? (
                    <div className="faculty-students-flow-stage">
                      <button
                        type="button"
                        className="faculty-students-flow-back-button"
                        onClick={() => {
                          setSelectedStudentsCourseId('')
                          setSelectedStudentsBatchId('')
                          setStudentsBatchSearch('')
                        }}
                      >
                        <ArrowLeft size={16} />
                        <span>Back to Courses</span>
                      </button>

                      <div className="faculty-students-flow-context">
                        <strong>{selectedStudentsCourse?.name || selectedStudentsCourse?.courseName || 'Course'}</strong>
                        <span>{selectedStudentsCourse?.courseCode || selectedStudentsCourse?.id || '-'}</span>
                      </div>

                      <div className="faculty-students-batch-toolbar">
                        <label className="faculty-students-batch-search">
                          <Search size={18} aria-hidden="true" />
                          <input
                            type="search"
                            value={studentsBatchSearch}
                            onChange={(event) => setStudentsBatchSearch(event.target.value)}
                            placeholder="Search batch name"
                            aria-label="Search batches by name"
                          />
                        </label>
                      </div>

                      {filteredStudentsCourseBatches.length ? (
                        <div className="branch-dashboard-table-shell faculty-students-table-shell faculty-students-flow-shell faculty-students-batches-shell">
                          <table className="branch-dashboard-table">
                            <thead>
                              <tr>
                                <th style={{ width: '72px' }}>S.No</th>
                                <th>Batch Name</th>
                                <th>Week Type</th>
                                <th>Students</th>
                                <th>Present</th>
                                <th>Absent</th>
                                <th>Course Progress</th>
                                <th>Academic Test</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedStudentsCourseBatches.map((batch, index) => {
                                const reportBatchProgress = facultyAcademicBatchProgress.get(getFacultyFlowBatchKey(batch)) ||
                                  facultyAcademicBatchProgress.get(normalizeWorkStudentId(getFacultyFlowBatchKey(batch)))
                                const reportCompleted = reportBatchProgress?.reportSent === true &&
                                  Number(reportBatchProgress?.total || 0) > 0 &&
                                  Number(reportBatchProgress?.completed || 0) >= Number(reportBatchProgress.total)
                                const activeBatchStudents = getFacultyBatchProgressStudents(
                                  batch,
                                  selectedStudentsCourse,
                                  facultyLifecycleVisibleStudents,
                                  facultyBackfillRecords,
                                )
                                const batchStudents = reportCompleted ? [] : activeBatchStudents
                                const batchProgress = batchStudents.length
                                  ? (selectedCourseBatchProgress.get(getFacultyFlowBatchKey(batch)) || 0)
                                  : 0
                                const batchAttendanceCounts = batchStudents.reduce((counts, student) => {
                                  const status = getStudentAttendanceStatus(studentAttendanceStatuses, student)
                                  if (status === 'PRESENT') counts.present += 1
                                  if (status === 'ABSENT') counts.absent += 1
                                  return counts
                                }, { present: 0, absent: 0 })
                                const academicBatchStudents = getFacultyBatchStudentRecords(facultyLifecycleVisibleStudents, {
                                  facultyName: currentFacultyIdentity.facultyName,
                                  facultyId: currentFacultyIdentity.facultyId,
                                  courseId: selectedStudentsCourse?.id || selectedStudentsCourse?.courseId || batch?.courseId,
                                  courseName: selectedStudentsCourse?.name || selectedStudentsCourse?.courseName || batch?.courseName,
                                  batchName: batch?.batchName || batch?.name || batch?.code,
                                  batchId: batch?.id || batch?.batchId || batch?.batchEntryId,
                                })
                                const academicProgresses = academicBatchStudents
                                  .map((student) => getFacultyStudentLifecycle(student, selectedStudentsCourse || {}, batch).academicTestProgress)
                                  .filter(Boolean)
                                const academicTotal = academicProgresses.length
                                  ? Math.max(...academicProgresses.map((progress) => Number(progress?.totalEvaluations ?? ((progress?.totalTests || progress?.total || 0) + (progress?.totalProjects || 0))) || 0))
                                  : 0
                                const academicCompleted = academicProgresses.length
                                  ? Math.min(...academicProgresses.map((progress) => Number(progress?.completedEvaluations ?? ((progress?.completedTests || progress?.completed || 0) + (progress?.completedProjects || 0))) || 0), academicTotal)
                                  : 0
                                const resolvedAcademicTotal = batchStudents.length
                                  ? (reportBatchProgress?.total || academicTotal)
                                  : 0
                                const resolvedAcademicCompleted = batchStudents.length
                                  ? (reportBatchProgress ? Math.min(reportBatchProgress.completed, resolvedAcademicTotal) : academicCompleted)
                                  : 0
                                const academicPercentage = resolvedAcademicTotal > 0 ? Math.round((resolvedAcademicCompleted / resolvedAcademicTotal) * 100) : 0

                                return (
                                <tr
                                  key={getFacultyFlowBatchKey(batch) || batch.id || index}
                                  className="faculty-students-flow-row-clickable"
                                  tabIndex={0}
                                  onClick={() => {
                                    setSelectedStudentsBatchId(getFacultyFlowBatchKey(batch))
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      setSelectedStudentsBatchId(getFacultyFlowBatchKey(batch))
                                    }
                                  }}
                                >
                                  <td>{(safeStudentsCourseBatchPage - 1) * studentsCourseBatchesPerPage + index + 1}</td>
                                  <td><strong>{batch.batchName || batch.code || batch.timing || '-'}</strong></td>
                                  <td>{String(batch.weekType || batch.weekdayType || '').toUpperCase() === 'WEEKEND' ? 'Weekend' : String(batch.weekType || batch.weekdayType || '').toUpperCase() === 'WEEKDAY' ? 'Weekday' : '-'}</td>
                                  <td>{batchStudents.length}</td>
                                  <td><span className="faculty-batch-attendance-count faculty-batch-attendance-count--present">{batchAttendanceCounts.present}</span></td>
                                  <td><span className="faculty-batch-attendance-count faculty-batch-attendance-count--absent">{batchAttendanceCounts.absent}</span></td>
                                  <td>
                                    <div className="faculty-batch-progress-cell">
                                      <div className="faculty-batch-progress-bar" aria-hidden="true">
                                        <span style={{ width: `${batchProgress}%` }} />
                                      </div>
                                      <strong>{batchProgress}% Complete</strong>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="faculty-batch-progress-cell" aria-label={`Academic test progress ${resolvedAcademicCompleted} of ${resolvedAcademicTotal}`}>
                                      <div className="faculty-batch-progress-bar" aria-hidden="true">
                                        <span style={{ width: `${academicPercentage}%` }} />
                                      </div>
                                      <strong>{resolvedAcademicCompleted}/{resolvedAcademicTotal}</strong>
                                    </div>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="faculty-students-flow-action-btn is-primary"
                                      onClick={() => {
                                        setSelectedStudentsBatchId(getFacultyFlowBatchKey(batch))
                                      }}
                                    >
                                      View Students
                                    </button>
                                  </td>
                                </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          {filteredStudentsCourseBatches.length > studentsCourseBatchesPerPage ? (
                            <div className="faculty-students-pagination-wrap">
                              <PaginationBar
                                currentPage={safeStudentsCourseBatchPage}
                                totalPages={studentsCourseBatchTotalPages}
                                onPageChange={setStudentsCourseBatchPage}
                                className="faculty-students-pagination"
                                label="Batch list pagination"
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="faculty-my-batches-empty faculty-students-flow-empty">
                          <strong>{studentsBatchSearch.trim() ? 'No matching batches' : 'No batches found'}</strong>
                          <p>{studentsBatchSearch.trim() ? 'Try another batch name.' : 'This course does not have any mapped batches yet.'}</p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {studentsFlowLevel === 3 ? (
                    <>
                      <div className="faculty-students-flow-stage">
                        <button
                          type="button"
                          className="faculty-students-flow-back-button"
                          onClick={() => {
                            setSelectedStudentsBatchId('')
                          }}
                        >
                          <ArrowLeft size={16} />
                          <span>Back to Batches</span>
                        </button>

                        <div className="faculty-students-flow-context">
                          <strong>{selectedStudentsCourse?.name || selectedStudentsCourse?.courseName || 'Course'}</strong>
                          <span>{selectedStudentsCourse?.courseCode || selectedStudentsCourse?.id || '-'}</span>
                          <strong>{selectedStudentsBatch?.batchName || selectedStudentsBatch?.code || selectedStudentsBatch?.timing || 'Batch'}</strong>
                        </div>
                      </div>

                      <div className="branch-dashboard-table-shell faculty-students-table-shell">
                        <table className="branch-dashboard-table faculty-student-progress-table">
                          <thead>
                            <tr>
                              <th style={{ width: '64px' }}>S.No</th>
                              <th>Student ID</th>
                              <th>Student Name</th>
                              <th>Email Address</th>
                              <th>Attendance</th>
                              <th>Paid</th>
                              {/* <th>Module Progress</th> */}
                              <th>Course Progress</th>
                              <th>Academic Test</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedFacultyStudents.length ? (
                              paginatedFacultyStudents.map((student, index) => {
                                const displayIndex = (safeStudentsPage - 1) * studentsPerPage + index + 1
                                const studentIdLabel = String(student.studentId || student.id || '-').trim()
                                const studentName = String(student.studentName || '-').trim()
                                const emailLabel = String(student.emailAddress || '-').trim()
                                const paymentProgress = getStudentPaymentProgress(student, {
                                  courseId: student.courseId || selectedStudentsCourse?.id || selectedStudentsCourse?.courseId,
                                  courseName: student.courseInterested || student.courseName || selectedStudentsCourse?.name || selectedStudentsCourse?.courseName,
                                })
                                const paidAmountLabel = formatCourseAmount(paymentProgress.paidAmount)
                                const selectedCourseId = String(selectedStudentsCourse?.id || selectedStudentsCourse?.courseId || '').trim()
                                const selectedCourseName = String(selectedStudentsCourse?.name || selectedStudentsCourse?.courseName || '').trim().toLowerCase()
                                const selectedStudentEnrollment = [
                                  ...(Array.isArray(student?.courseEnrollments) ? student.courseEnrollments : []),
                                  ...(Array.isArray(student?.courses) ? student.courses : []),
                                ].find((enrollment) => (
                                  (selectedCourseId && String(enrollment?.courseId || enrollment?.id || enrollment?.course?.id || '').trim() === selectedCourseId) ||
                                  (selectedCourseName && String(enrollment?.courseName || enrollment?.name || enrollment?.course?.name || '').trim().toLowerCase() === selectedCourseName)
                                ))
                                const progressStudent = {
                                  ...student,
                                  courseId: selectedCourseId || student?.courseId,
                                  courseName: selectedCourseName || student?.courseName,
                                  batchId: selectedStudentsBatch?.batchId || selectedStudentsBatch?.id || student?.batchId,
                                  batchName: selectedStudentsBatch?.batchName || selectedStudentsBatch?.code || student?.batchName,
                                  batchTiming: selectedStudentsBatch?.timing || selectedStudentsBatch?.batchTiming || student?.batchTiming,
                                }
                                const scopedLifecycle = getFacultyStudentLifecycle(
                                  progressStudent,
                                  selectedStudentsCourse || {},
                                  selectedStudentsBatch || {},
                                )
                                // Attendance is independent from course progress. An absent
                                // student must keep the progress earned on earlier work days.
                                const progressEntries = facultyTodayWorkEntries
                                const workEntry = getFacultyTodayWorkEntriesForStudent(
                                  progressEntries,
                                  progressStudent,
                                  selectedCourseId,
                                )[0] || null
                                const workCourse = workEntry
                                  ? selectedStudentsCourse || courseCatalog.find((course) => String(course?.id || '').trim() === String(workEntry.courseId || '').trim()) || selectedCourse || null
                                  : null
                                const workProgressSummary = workEntry
                                  ? buildFacultyTodayWorkProgressSummary(progressEntries, workCourse || {}, progressStudent)
                                  : null
                                const workProgress = workProgressSummary
                                  ? {
                                      ...getFacultyWorkProgressForEntry(
                                        workProgressSummary.entry || workEntry,
                                        workCourse || {},
                                        Array.isArray(workProgressSummary.selectedSubmoduleIds)
                                          ? workProgressSummary.selectedSubmoduleIds
                                          : [],
                                        student.id || student.studentId || '',
                                      ),
                                      courseProgress: workProgressSummary.courseProgress,
                                      moduleProgress: workProgressSummary.moduleProgress,
                                    }
                                  : null
                                // const workModuleProgressLabel = workProgressSummary
                                //   ? `${getCourseModuleName(workProgressSummary.moduleSummary?.module || workProgress?.module || {})} - ${Math.round(workProgress.moduleProgress)}% Complete`
                                //   : '-'
                                const storedCourseProgress = Number(
                                  selectedStudentEnrollment?.courseProgress ??
                                  selectedStudentEnrollment?.courseCompletionPercentage ??
                                  selectedStudentEnrollment?.progress ??
                                  scopedLifecycle.enrollment?.courseProgress ??
                                  scopedLifecycle.courseProgress ??
                                  student?.courseProgress,
                                )
                                const workCourseProgress = workProgress
                                  ? Math.max(
                                      Math.min(100, Math.max(0, Number(workProgress.courseProgress))),
                                      Number.isFinite(storedCourseProgress) ? Math.min(100, Math.max(0, storedCourseProgress)) : 0,
                                    )
                                  : Number.isFinite(storedCourseProgress)
                                    ? Math.min(100, Math.max(0, storedCourseProgress))
                                    : 0
                                const workCourseProgressLabel = `${Math.round(workCourseProgress)}% Complete`
                                const academicTestProgress = scopedLifecycle.academicTestProgress || {}
                                const academicReportProgress = facultyAcademicReportProgress.get(normalizeWorkStudentId(student.studentId || ''))
                                  || facultyAcademicReportProgress.get(normalizeWorkStudentId(student.id || ''))
                                  || facultyAcademicReportProgress.get(normalizeWorkStudentId(student.emailAddress || ''))
                                const academicTestTotal = Math.max(0, Number(academicTestProgress.totalTests ?? academicTestProgress.total ?? 0))
                                const academicProjectTotal = Math.max(0, Number(academicTestProgress.totalProjects ?? 0))
                                const academicEvaluationTotal = Math.max(
                                  0,
                                  Number(academicTestProgress.totalEvaluations ?? (academicTestTotal + academicProjectTotal)),
                                )
                                const academicTestCompleted = Math.min(
                                  academicEvaluationTotal,
                                  Math.max(
                                    0,
                                    Number(
                                      academicReportProgress?.completedEvaluations ??
                                      (academicTestProgress.academicComplete === true
                                        ? academicEvaluationTotal
                                        : academicTestProgress.completedEvaluations ??
                                          ((academicTestProgress.completedTests ?? academicTestProgress.completed ?? (academicTestTotal - Number(academicTestProgress.pendingTests ?? academicTestProgress.pending ?? 0))) +
                                          (academicTestProgress.completedProjects ?? (academicProjectTotal - Number(academicTestProgress.pendingProjects ?? 0))))),
                                    ),
                                  ),
                                )
                                if (isDiscontinuedStudent(student)) {
                                  return (
                                    <tr key={student.id || student.studentId || `${studentName}-${index}`} className="faculty-student-discontinued-row">
                                      <td>{displayIndex}</td>
                                      <td><strong>{studentIdLabel}</strong></td>
                                      <td>
                                        <div className="faculty-student-discontinued-only">
                                          <div className="faculty-avatar">{getInitials(studentName)}</div>
                                          <strong>{studentName}</strong>
                                        </div>
                                      </td>
                                      <td><span className="faculty-info-link"><Mail size={14} style={{ color: '#94a3b8' }} />{emailLabel}</span></td>
                                      <td>-</td>
                                      <td>-</td>
                                      <td>-</td>
                                      <td><span className="faculty-student-attendance-pill faculty-student-attendance-pill--discontinued">Discontinued</span></td>
                                    </tr>
                                  )
                                }
                                return (
                                  <tr
                                    key={student.id || student.studentId || `${studentName}-${index}`}
                                    className="faculty-students-flow-row-clickable"
                                    tabIndex={0}
                                    onClick={() => openStudentViewDrawer(student)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        openStudentViewDrawer(student)
                                      }
                                    }}
                                  >
                                    <td>{displayIndex}</td>
                                    <td><strong>{studentIdLabel}</strong></td>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="faculty-avatar">
                                          {getInitials(studentName)}
                                        </div>
                                        <strong className="branch-course-name">{studentName}</strong>
                                      </div>
                                    </td>
                                    <td>
                                      <span className="faculty-info-link">
                                        <Mail size={14} style={{ color: '#94a3b8' }} />
                                        {emailLabel}
                                      </span>
                                    </td>
                                    <td>
                                      {getStudentAttendanceStatus(studentAttendanceStatuses, student) ? (
                                        <span className={`faculty-student-attendance-pill faculty-student-attendance-pill--${getStudentAttendanceStatus(studentAttendanceStatuses, student).toLowerCase()}`}>
                                          <span className="faculty-student-attendance-dot" aria-hidden="true" />
                                          {getStudentAttendanceStatus(studentAttendanceStatuses, student) === 'PRESENT' ? 'Present' : 'Absent'}
                                        </span>
                                      ) : (
                                        <span className="faculty-student-attendance-pill faculty-student-attendance-pill--unmarked">
                                          <span className="faculty-student-attendance-dot" aria-hidden="true" />
                                          Unmarked
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <div className="branch-student-paid-cell">
                                        <span className="branch-student-paid-amount">{paidAmountLabel}</span>
                                        <div className="branch-student-paid-progress">
                                          <div className="branch-student-paid-progress-bar" aria-hidden="true">
                                            <span
                                              className="branch-student-paid-progress-fill"
                                              style={{ width: `${paymentProgress.paidInstallmentPercentage}%` }}
                                            />
                                          </div>
                                          <span className="branch-student-paid-progress-label">
                                            {formatPaidPercentage(paymentProgress.paidInstallmentPercentage)}% Paid
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    {/* Module Progress column temporarily hidden. */}
                                    <td>
                                      <div className="branch-student-paid-cell faculty-today-work-summary">
                                        <div className="branch-student-paid-progress">
                                          <div className="branch-student-paid-progress-bar faculty-today-work-progress-bar" aria-hidden="true">
                                            <span
                                              className="branch-student-paid-progress-fill faculty-today-work-progress-fill"
                                              style={{ width: `${workCourseProgress}%` }}
                                            />
                                          </div>
                                          <span className="branch-student-paid-progress-label">
                                            {workCourseProgressLabel}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td>{academicTestCompleted}/{academicEvaluationTotal}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="faculty-students-flow-action-btn is-primary"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          navigate(`/dashboard/faculty/my-batches/students/${encodeURIComponent(student.studentId || student.id || '')}/calendar`)
                                        }}
                                      >
                                        View Calendar
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })
                            ) : (
                              <tr>
                                <td className="faculty-students-empty-cell" colSpan={10}>
                                  <div className="faculty-my-batches-empty">
                                    <strong>No students found</strong>
                                    <p>Students selected with this batch will show up here once they are saved.</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        {studentsFlowVisibleStudents.length > studentsPerPage ? (
                          <div className="faculty-students-pagination-wrap">
                            <PaginationBar
                              currentPage={safeStudentsPage}
                              totalPages={studentsTotalPages}
                              onPageChange={setStudentsPage}
                              className="faculty-students-pagination"
                              label="Students pagination"
                            />
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                    </>
                  )}
                </FacultyDashboardSection>
              ) : null}

              {viewStudentDrawer ? (
                <div className="student-drawer-backdrop">
                  <aside
                    className="student-drawer student-drawer-table-view"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="student-drawer-header student-drawer-table-header">
                      <div className="student-drawer-table-header-copy">
                        <p className="section-kicker">STUDENT DETAILS</p>
                        <h3>{viewStudentDrawer.studentName || 'Student'}</h3>
                        <span className="faculty-students-flow-context" style={{ marginTop: '2px' }}>
                          {viewStudentDrawer.studentId || '-'}
                        </span>
                      </div>

                      <div className="student-drawer-table-actions">
                        <button
                          type="button"
                          className="student-drawer-close student-drawer-close-floating"
                          onClick={closeStudentViewDrawer}
                          aria-label="Close student details"
                        >
                          <X size={18} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>

                    <div className="student-drawer-table-shell">
                      <div className="student-drawer-section-card">
                        <div className="student-drawer-section-head">
                          <div className="student-drawer-section-icon">
                            <UserRound size={18} strokeWidth={2.1} />
                          </div>
                          <div>
                            <h4>Basic Information</h4>
                            <p>Identity and contact details for this student.</p>
                          </div>
                        </div>

                        <div className="student-detail-grid">
                          <div className="student-detail-item">
                            <span>Student ID</span>
                            <strong>{viewStudentDrawer.studentId || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Student Name</span>
                            <strong>{viewStudentDrawer.studentName || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Parent Name</span>
                            <strong>{viewStudentDrawer.parentName || viewStudentDrawer.fatherName || viewStudentDrawer.guardianName || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Email Address</span>
                            <strong>{viewStudentDrawer.emailAddress || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Mobile Number</span>
                            <strong>{viewStudentDrawer.mobileNumber || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Parent / Spouse Number</span>
                            <strong>{viewStudentDrawer.parentSpouseNumber || '-'}</strong>
                          </div>
                          <div className="student-detail-item student-detail-address">
                            <span>Address</span>
                            <strong>
                              {viewStudentDrawer.address
                                ? formatStudentAddress(viewStudentDrawer.address)
                                : '-'}
                            </strong>
                          </div>
                          <div className="student-detail-item">
                            <span>City</span>
                            <strong>{viewStudentDrawer.city || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>State</span>
                            <strong>{viewStudentDrawer.state || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Country</span>
                            <strong>{viewStudentDrawer.country || '-'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="student-drawer-section-card">
                        <div className="student-drawer-section-head">
                          <div className="student-drawer-section-icon">
                            <BookOpen size={18} strokeWidth={2.1} />
                          </div>
                          <div>
                            <h4>Academic Details</h4>
                            <p>Educational and role details captured on the student record.</p>
                          </div>
                        </div>

                        <div className="student-detail-grid">
                          <div className="student-detail-item">
                            <span>Student Status</span>
                            <strong>{viewStudentDrawer.currentStatus || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Qualification</span>
                            <strong>{viewStudentDrawer.qualification || '-'}</strong>
                          </div>
                          {String(viewStudentDrawer.educationLevel || '').trim() ? (
                            <div className="student-detail-item">
                              <span>Education Level</span>
                              <strong>{viewStudentDrawer.educationLevel}</strong>
                            </div>
                          ) : null}
                          {String(viewStudentDrawer.educationStatus || '').trim() ? (
                            <div className="student-detail-item">
                              <span>Education Status</span>
                              <strong>{viewStudentDrawer.educationStatus}</strong>
                            </div>
                          ) : null}
                          {String(viewStudentDrawer.designation || '').trim() ? (
                            <div className="student-detail-item">
                              <span>Designation</span>
                              <strong>{viewStudentDrawer.designation}</strong>
                            </div>
                          ) : null}
                          {String(viewStudentDrawer.passedOutYear || '').trim() ? (
                            <div className="student-detail-item">
                              <span>Passed Out Year</span>
                              <strong>{viewStudentDrawer.passedOutYear}</strong>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="student-drawer-section-card">
                        <div className="student-drawer-section-head">
                          <div className="student-drawer-section-icon">
                            <CalendarDays size={18} strokeWidth={2.1} />
                          </div>
                          <div>
                            <h4>Batch Schedule</h4>
                            <p>Course timing and start information for the selected batch.</p>
                          </div>
                        </div>

                        {(viewStudentDrawer.courseAssignments || []).map((assignment, index) => (
                          <div className="student-course-assignment-block" key={assignment.courseId || `${assignment.courseName}-${index}`}>
                            {(viewStudentDrawer.courseAssignments || []).length > 1 ? <h5>{assignment.courseName || `Course ${index + 1}`}</h5> : null}
                            <div className="student-detail-grid">
                              <div className="student-detail-item">
                                <span>Course Name</span>
                                <strong>{assignment.courseName || '-'}</strong>
                              </div>
                              <div className="student-detail-item">
                                <span>Faculty Name</span>
                                <strong>{assignment.facultyName || '-'}</strong>
                              </div>
                              <div className="student-detail-item">
                                <span>Batch Name</span>
                                <strong>{assignment.batchName || '-'}</strong>
                              </div>
                              <div className="student-detail-item">
                                <span>Batch Timing</span>
                                <strong>{assignment.batchTiming || '-'}</strong>
                              </div>
                              <div className="student-detail-item">
                                <span>Class Schedule</span>
                                <strong>{assignment.classSchedule || '-'}</strong>
                              </div>
                              <div className="student-detail-item">
                                <span>Course Mode</span>
                                <strong>{assignment.courseMode || '-'}</strong>
                              </div>
                              <div className="student-detail-item">
                                <span>Course Start Date</span>
                                <strong>{assignment.startDate ? formatStudentDate(assignment.startDate) : '-'}</strong>
                              </div>
                              <div className="student-detail-item">
                                <span>Course End Date</span>
                                <strong>{assignment.endDate ? formatStudentDate(assignment.endDate) : '-'}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </aside>
                </div>
              ) : null}

              {activeSection === 'leave-requests' ? <FacultyLeaveRequests /> : null}

              {activeSection === 'other-faculty-batches' && hasTemporaryAssignments ? <OtherFacultyBatchesSection onOpenTemporaryWork={openTemporarySessionWork} onAssignmentVisibility={setHasTemporaryAssignments} /> : null}

              {activeSection === 'notifications' ? (
                <section className="faculty-notifications-page">
                  <header className="faculty-notifications-page-header">
                    <div className="faculty-notifications-title-area">
                      <span className="faculty-notifications-eyebrow">NOTIFICATIONS</span>
                      <h1>Notifications</h1>
                      <p>
                        You have <strong>{totalNotificationCount}</strong> notifications to go through
                        {unreadNotificationCount ? <span> and {unreadNotificationCount} unread items</span> : null} for
                        {facultyName}.
                      </p>
                    </div>

                    <div className="faculty-notifications-page-actions">
                      <button
                        type="button"
                        className="faculty-mark-all-btn"
                        onClick={async () => {
                          const unreadItems = unreadNotifications
                          const unreadIds = unreadItems.map((item) => item.id)

                          if (!unreadIds.length) return

                          try {
                            const localUnreadIds = unreadItems
                              .filter((item) => isFacultyProgressNotification(item))
                              .map((item) => item.id)
                            const remoteUnreadIds = unreadItems
                              .filter((item) => !isFacultyProgressNotification(item))
                              .map((item) => item.id)

                            if (localUnreadIds.length) {
                              markNotificationsAsRead(localUnreadIds)
                            }

                            if (remoteUnreadIds.length) {
                              await markFacultyNotificationsAsRead(remoteUnreadIds)
                            }

                            setFacultyNotifications((current) =>
                              current.map((item) => ({
                                ...item,
                                read: remoteUnreadIds.includes(item.id) ? true : item.read,
                              })),
                            )
                          } catch (error) {
                            console.error('Failed to mark all notifications as read', error)
                          }
                        }}
                      >
                        <Bell size={18} strokeWidth={2.2} />
                        Mark all as read
                      </button>

                      <button
                        type="button"
                        className="faculty-back-dashboard-btn"
                        onClick={() => setActiveSection('dashboard')}
                      >
                        <LayoutDashboard size={18} strokeWidth={2.2} />
                        Back to dashboard
                      </button>
                    </div>
                  </header>

                  <div className="faculty-notifications-toolbar">
                    <label className="faculty-notification-search">
                      <input
                        type="search"
                        placeholder="Search notifications"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        aria-label="Search notifications"
                      />
                      <button
                        type="button"
                        className="faculty-notification-search-button"
                        aria-label="Search notifications"
                      >
                        <Search size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                      </button>
                    </label>

                    <label className="faculty-notification-filter">
                      <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                      <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
                        <option value="all">All dates</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                      </select>
                      <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                    </label>

                    <label className="faculty-notification-filter">
                      <span className="faculty-notification-filter-dot" aria-hidden="true">
                        <Dot size={18} strokeWidth={2.4} />
                      </span>
                      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="all">All status</option>
                        <option value="unread">Unread only</option>
                        <option value="read">Read only</option>
                      </select>
                      <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                    </label>
                  </div>

                  <div className="faculty-notifications-feed">
                    {groupedNotifications.length ? (
                      groupedNotifications.map((group) => (
                          <FacultyNotificationGroup
                          key={group.label}
                          label={group.label}
                          items={group.items}
                          onViewNotification={async (notification) => {
                            if (notification.facultySkillAssignmentId) {
                              navigate('/dashboard/faculty/skill-development')
                            } else if (notification.kind === 'FACULTY_REPORT_SHARED' && notification.academicTestId) {
                              navigate('/dashboard/faculty/exams/academic-tests')
                            }
                            if (!notification.read) {
                              try {
                                if (isFacultyProgressNotification(notification)) {
                                  markNotificationsAsRead([notification.id])
                                } else {
                                  await markFacultyNotificationsAsRead([notification.id])
                                }

                                setFacultyNotifications((current) =>
                                  current.map((item) =>
                                    item.id === notification.id
                                      ? {
                                          ...item,
                                          read: !isFacultyProgressNotification(notification) ? true : item.read,
                                        }
                                      : item,
                                  ),
                                )
                              } catch (error) {
                                console.error('Failed to mark notification as read', error)
                              }
                            }
                          }}
                        />
                      ))
                    ) : (
                      <div className="faculty-notifications-empty">
                        <Bell size={36} strokeWidth={1.7} />
                        <h3>No notifications yet</h3>
                        <p>You don't have any notifications at the moment.</p>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {activeSection === 'profile' ? (
                <FacultyDashboardSection title="Faculty Profile" description="Manage your faculty account and professional information.">
                  <article className="faculty-profile-identity-card">
                    <div className="faculty-profile-identity">
                      <div className="faculty-profile-avatar" aria-hidden="true">{initials}</div>
                      <div>
                        <h2>{facultyName}</h2>
                        <p>Faculty Instructor</p>
                        <small>Faculty ID: {facultyDetails.id}</small>
                      </div>
                    </div>
                  </article>

                  <section className="faculty-profile-section" aria-labelledby="faculty-contact-heading">
                    <div className="faculty-profile-section-heading">
                      <h3 id="faculty-contact-heading">Contact Information</h3>
                    </div>
                    <div className="faculty-profile-information-card">
                      <div className="faculty-profile-information-grid">
                        <div className="faculty-profile-information-field">
                          <span>Email Address</span>
                          <strong><Mail size={15} /> {facultyDetails.email}</strong>
                        </div>
                        <div className="faculty-profile-information-field">
                          <span>Contact Number</span>
                          <strong><Phone size={15} /> {facultyDetails.phone}</strong>
                        </div>
                        <div className="faculty-profile-information-field">
                          <span>Location</span>
                          <strong><MapPin size={15} /> {facultyDetails.city}, {facultyDetails.state}, {facultyDetails.country}</strong>
                        </div>
                        <div className="faculty-profile-information-field">
                          <span>Account Status</span>
                          <strong><span className="faculty-profile-status-badge">{facultyDetails.status}</span></strong>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="faculty-profile-section" aria-labelledby="faculty-security-heading">
                    <h3 id="faculty-security-heading">Account &amp; Security</h3>
                    <div className="faculty-profile-security-card">
                      <div className="faculty-profile-security-email">
                        <span>Email</span>
                        <strong>{facultyDetails.email}</strong>
                      </div>
                      <button type="button" onClick={openForgotPassword}>Change Password</button>
                    </div>
                  </section>
                </FacultyDashboardSection>
              ) : null}
            </div>
          </main>
      </div>
    </div>

      {isTodayWorkModalOpen ? (
        <div className="faculty-today-work-backdrop branch-modal-backdrop" role="presentation">
          <div
            className="faculty-today-work-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-today-work-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="faculty-today-work-header">
              <div className="faculty-today-work-title-row">
                <div className="faculty-today-work-title-copy">
                  <span className="faculty-today-work-title-icon" aria-hidden="true">
                    <BookOpen size={20} />
                  </span>
                  <h3 id="faculty-today-work-title">
                    {todayWorkMode === 'attendance' ? 'Mark Attendance' : "Today's Work"}
                  </h3>
                </div>

                <button
                  type="button"
                  className="faculty-today-work-close"
                  aria-label="Close today's work modal"
                  onClick={closeTodayWorkModal}
                >
                  ×
                </button>
              </div>
            </div>

            <form className="faculty-today-work-form" onSubmit={handleTodayWorkSubmit}>
              {todayWorkMode === 'progress' ? (
                <>
              <div className="faculty-today-work-grid">
                <label className="faculty-today-work-field">
                  <span>Course</span>
                  <div className="faculty-today-work-input faculty-today-work-input--locked">
                    <BookOpen size={16} />
                    <strong>{todayWorkCourse?.name || todayWorkCourse?.courseName || 'No course selected'}</strong>
                    <Lock size={16} className="faculty-today-work-lock-icon" />
                  </div>
                  <small className="faculty-today-work-field-note">
                    Auto-applied ({studentsFlowLevel === 3 ? 'selected batch course' : 'your assigned course'})
                  </small>
                </label>

                <label className="faculty-today-work-field">
                  <span>Module</span>
                  <select
                    className="faculty-today-work-select"
                    value={todayWorkForm.moduleId || ''}
                    onChange={(event) => updateTodayWorkModule(event.target.value)}
                    disabled={!todayWorkCourseModules.length || todayWorkSelectedModuleCompleteForSelectedStudents}
                  >
                    {todayWorkCourseModules.length ? (
                      todayWorkCourseModules.map((module, index) => {
                        const moduleId = String(module?.id || `module-${index}`).trim()
                        return (
                          <option key={moduleId || index} value={moduleId}>
                            {getTodayWorkModuleLabel(module, index)}
                          </option>
                        )
                      })
                    ) : (
                      <option value="">No modules found</option>
                    )}
                  </select>
                  <small className="faculty-today-work-field-note">First module is auto-selected</small>
                </label>
              </div>

              {todayWorkMissedItems.length ? (
                <section className="faculty-today-work-panel faculty-today-work-missed-panel">
                  <div className="faculty-today-work-panel-heading">
                    <div>
                      <h4>Pending / Missed Work</h4>
                      <p>These sub-modules were not completed by the student and can be completed separately.</p>
                    </div>
                    <button
                      type="button"
                      className="faculty-today-work-missed-toggle"
                      aria-label={isTodayWorkMissedExpanded ? 'Collapse pending work' : 'Expand pending work'}
                      aria-expanded={isTodayWorkMissedExpanded}
                      onClick={() => setIsTodayWorkMissedExpanded((expanded) => !expanded)}
                    >
                      {isTodayWorkMissedExpanded ? <ChevronDown size={20} strokeWidth={2.4} /> : <ChevronRight size={20} strokeWidth={2.4} />}
                    </button>
                  </div>
                  {isTodayWorkMissedExpanded ? (
                    <div className="faculty-today-work-missed-list">
                      {todayWorkMissedItems.map((item) => (
                        <button
                          type="button"
                          key={item.key}
                          className="faculty-today-work-missed-item"
                          onClick={() => selectTodayWorkMissedItem(item)}
                        >
                          <strong>{item.studentName}</strong>
                          <span>{item.moduleName} · {item.submoduleName}</span>
                          <em className={`faculty-today-work-status faculty-today-work-status-${String(item.status || 'Not Completed')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '')}`}
                          >
                            {item.status || 'Not Completed'}
                          </em>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="faculty-today-work-panel">
                <div className="faculty-today-work-panel-heading">
                  <div>
                    <h4>Sub-modules</h4>
                    <p>{getTodayWorkModuleLabel(todayWorkSelectedModule || {}, todayWorkSelectedModuleIndex)}</p>
                  </div>
                  <button
                    type="button"
                    className="faculty-today-work-link"
                    onClick={() => {
                      if (!todayWorkPendingSubmoduleIds.length) return

                      const allSelected = todayWorkPendingSubmoduleIds.every((submoduleId) =>
                        todayWorkForm.submoduleIds.includes(submoduleId),
                      )

                      if (allSelected) {
                        clearAllTodayWorkSubmodules()
                      } else {
                        selectAllTodayWorkSubmodules()
                      }
                    }}
                    disabled={!todayWorkPendingSubmoduleIds.length || todayWorkSelectedModuleCompleteForSelectedStudents}
                  >
                    {todayWorkPendingSubmoduleIds.length
                      ? todayWorkPendingSubmoduleIds.every((submoduleId) => todayWorkForm.submoduleIds.includes(submoduleId))
                        ? 'Clear All'
                        : 'Select All'
                      : 'Completed'}
                  </button>
                </div>

                <div className="faculty-today-work-submodule-selectbox">
                  <div className="faculty-today-work-submodule-selectbar">
                    <span>
                      {todayWorkForm.submoduleIds.length
                        ? `${todayWorkForm.submoduleIds.length} selected`
                        : todayWorkPendingSubmoduleIds.length
                          ? 'Select Sub-modules'
                          : 'All sub-modules completed'}
                      {todayWorkCompletedSubmoduleIds.length ? ` · ${todayWorkCompletedSubmoduleIds.length} completed` : ''}
                    </span>
                    <ChevronDown size={18} />
                  </div>

                  {todayWorkSelectedModuleSubmodules.length ? (
                    <div className="faculty-today-work-submodule-list">
                      {todayWorkSelectedModuleSubmodules.map((submodule, subIndex) => {
                        const submoduleId = String(
                          submodule?.id || submodule?.submoduleId || `${todayWorkSelectedModule?.id || 'module'}-submodule-${subIndex}`,
                        ).trim()
                        const checked = todayWorkForm.submoduleIds.includes(submoduleId)
                        const selectedWorkStudents = todayWorkForm.applyToAllStudents
                          ? studentsFlowVisibleStudents
                          : todayWorkSelectedStudents
                        const statusStudents = todayWorkMode === 'progress'
                          ? selectedWorkStudents
                          : selectedWorkStudents.length ? selectedWorkStudents : studentsFlowVisibleStudents
                        const persistedModuleStatuses = getPersistedTodayWorkSubmoduleStatuses(
                          facultyTodayWorkEntries,
                          currentFacultyIdentity,
                          '',
                          todayWorkSelectedModule?.id || '',
                          selectedStudentsBatch,
                          statusStudents,
                          todayWorkSelectedModuleSubmodules,
                        )
                        const getStudentSubmoduleStatus = (student) => (
                          todayWorkForm.submoduleStatuses?.[getTodayWorkStudentId(student)]?.[submoduleId]
                          || persistedModuleStatuses?.[getTodayWorkStudentId(student)]?.[submoduleId]
                          || ''
                        )
                        const selectedStatuses = selectedWorkStudents
                          .map(getStudentSubmoduleStatus)
                          .filter(Boolean)
                        const completedForAllStatusStudents = statusStudents.length > 0 && statusStudents.every((student) => (
                          normalizeSubmoduleProgressStatus(getStudentSubmoduleStatus(student)) === 'Completed'
                        ))
                        const currentStatus = completedForAllStatusStudents
                          ? 'Completed'
                          : (selectedStatuses.length && selectedStatuses.every((status) => status === selectedStatuses[0])
                          ? selectedStatuses[0]
                            : selectedStatuses.length
                              ? 'Mixed'
                              : todayWorkForm.submoduleStatusById?.[submoduleId] || '')
                        const lastSelectedSubmoduleId = todayWorkForm.submoduleIds[todayWorkForm.submoduleIds.length - 1] || ''
                        const isManualStatusSubmodule = checked && submoduleId === lastSelectedSubmoduleId
                        // Every selected submodule before the last one is
                        // completed automatically. Only the last selection
                        // exposes the manual In Progress/Completed controls.
                        const displayStatus = checked && !isManualStatusSubmodule ? 'Completed' : currentStatus
                        const submoduleLocked = checked && !isManualStatusSubmodule

                        return (
                          <div
                            key={submoduleId || subIndex}
                            className={`faculty-today-work-submodule-item${checked ? ' is-selected' : ''}`.trim()}
                            onClick={() => {
                              if (!submoduleLocked) toggleTodayWorkSubmodule(submoduleId)
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={submoduleLocked}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleTodayWorkSubmodule(submoduleId)}
                            />
                            <span className="faculty-today-work-submodule-check" aria-hidden="true">
                              ✓
                            </span>
                            <div className="faculty-today-work-submodule-copy">
                              <strong>{getCourseSubmoduleName(submodule, subIndex)}</strong>
                              <span className="faculty-today-work-submodule-status faculty-today-work-submodule-status--pending">
                                {checked ? (displayStatus || 'Choose status') : 'Not selected'}
                              </span>
                            </div>
                            {checked && isManualStatusSubmodule ? (
                              <div className="faculty-today-work-submodule-status-options" onClick={(event) => event.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={submoduleLocked}
                                  className={displayStatus === 'In Progress' ? 'is-active' : ''}
                                  onClick={() => setTodayWorkSubmoduleStatus(submoduleId, 'In Progress')}
                                >
                                  <span className="faculty-today-work-status-radio" aria-hidden="true" />
                                  In Progress
                                </button>
                                <button
                                  type="button"
                                  disabled={submoduleLocked}
                                  className={displayStatus === 'Completed' ? 'is-active' : ''}
                                  onClick={() => setTodayWorkSubmoduleStatus(submoduleId, 'Completed')}
                                >
                                  <span className="faculty-today-work-status-radio" aria-hidden="true" />
                                  Completed
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="faculty-today-work-empty">
                      No sub-modules found for this module yet.
                    </div>
                  )}
                </div>

                {todayWorkForm.submoduleIds.length ? (
                  <div className="faculty-today-work-selected-list faculty-today-work-selected-list--boxed">
                    <span className="faculty-today-work-selected-label">Selected Sub-modules ({todayWorkForm.submoduleIds.length})</span>
                    <div className="faculty-today-work-selected-chips">
                      {todayWorkForm.submoduleIds.map((submoduleId) => {
                        const submodule = todayWorkSelectedModuleSubmodules.find((item, index) => {
                          const itemId = String(item?.id || item?.submoduleId || `${todayWorkSelectedModule?.id || 'module'}-submodule-${index}`).trim()
                          return itemId === submoduleId
                        })

                        return (
                          <button
                            type="button"
                            key={submoduleId}
                            className="faculty-today-work-chip"
                            onClick={() => toggleTodayWorkSubmodule(submoduleId)}
                            aria-label={`Remove ${getCourseSubmoduleName(submodule || {}, 0)}`}
                          >
                            <span>{getCourseSubmoduleName(submodule || {}, 0)}</span>
                            <span aria-hidden="true">×</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
                </>
              ) : null}

              <section className="faculty-today-work-panel">
                <div className="faculty-today-work-panel-heading">
                  <div>
                    <h4>
                      {todayWorkMode === 'attendance' ? 'Student Attendance' : 'Select Students'}
                      {todayWorkMode === 'progress' ? (
                        <span className="faculty-today-work-selected-count">
                          ({studentsFlowVisibleStudents.filter((student) => todayWorkForm.selectedStudentIds.includes(getTodayWorkStudentId(student))).length} selected)
                        </span>
                      ) : null}
                    </h4>
                    {todayWorkMode === 'attendance' ? (
                      todayWorkAttendanceWindow.isReminder ? null : (
                        <p
                          className={attendanceWindowLocked ? 'faculty-today-work-attendance-window-note is-locked' : 'faculty-today-work-attendance-window-note'}
                          role="status"
                          aria-live="polite"
                        >
                          {todayWorkAttendanceWindow.reason || 'Attendance timing is not configured for this batch.'}
                        </p>
                      )
                    ) : (
                      <p>Choose students whose submodule progress should be updated.</p>
                    )}
                  </div>
                  {todayWorkMode === 'attendance' ? (
                    <label
                      className="faculty-today-work-attendance-mark-all"
                      aria-label="Mark all students present"
                    >
                      <input
                        type="checkbox"
                        checked={allTodayWorkStudentsPresent}
                        onChange={toggleMarkAllTodayWorkStudents}
                        disabled={!studentsFlowActionableStudents.length || attendanceWindowLocked}
                      />
                      <span>Mark All Present</span>
                    </label>
                  ) : (
                    <label className="faculty-today-work-select-all">
                      <input
                        type="checkbox"
                        checked={todayWorkPresentStudents.length > 0 && todayWorkPresentStudents.every((student) => todayWorkForm.selectedStudentIds.includes(getTodayWorkStudentId(student)))}
                        onChange={toggleSelectAllTodayWorkStudents}
                        disabled={!todayWorkPresentStudents.length}
                      />
                      <span>Select All Present</span>
                    </label>
                  )}
                </div>

                {todayWorkMode === 'attendance' ? (
                  <label className="faculty-today-work-attendance-search">
                    <Search size={16} aria-hidden="true" />
                    <input
                      type="search"
                      value={todayWorkAttendanceSearch}
                      onChange={(event) => setTodayWorkAttendanceSearch(event.target.value)}
                      placeholder="Search student..."
                      aria-label="Search students"
                    />
                  </label>
                ) : null}

                <div className={`faculty-today-work-student-list${todayWorkMode === 'attendance' ? ' faculty-today-work-attendance-list' : ' faculty-today-work-progress-list'}`}>
                  {(todayWorkMode === 'attendance' ? visibleAttendanceStudents : studentsFlowActionableStudents).map((student, index) => {
                    const studentId = getTodayWorkStudentId(student)
                    const studentName = String(student?.studentName || student?.name || `Student ${index + 1}`).trim()
                    const status = todayWorkForm.attendanceByStudent?.[studentId] || ''
                    const isPresentStudent = status === 'PRESENT'
                    const checked = isPresentStudent && todayWorkForm.selectedStudentIds.includes(studentId)
                    const discontinued = isDiscontinuedStudent(student)

                    return (
                      <div
                        key={studentId || `${studentName}-${index}`}
                        className={`faculty-today-work-student-item${todayWorkMode === 'attendance' ? ' faculty-today-work-attendance-item' : ' faculty-today-work-progress-item'}${checked ? ' is-selected' : ''}`.trim()}
                        style={{ display: 'grid', gridTemplateColumns: todayWorkMode === 'progress' ? 'auto auto minmax(0, 1fr) auto' : 'auto minmax(0, 1fr) auto', alignItems: 'center', gap: '12px', cursor: todayWorkMode === 'progress' && isPresentStudent ? 'pointer' : undefined }}
                        onClick={() => {
                          if (todayWorkMode === 'progress' && isPresentStudent) toggleTodayWorkStudent(studentId)
                        }}
                        onKeyDown={(event) => {
                          if (todayWorkMode === 'progress' && isPresentStudent && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault()
                            toggleTodayWorkStudent(studentId)
                          }
                        }}
                        role={todayWorkMode === 'progress' && isPresentStudent ? 'button' : undefined}
                        tabIndex={todayWorkMode === 'progress' && isPresentStudent ? 0 : undefined}
                      >
                        {todayWorkMode === 'progress' ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!isPresentStudent}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleTodayWorkStudent(studentId)}
                            aria-label={isPresentStudent ? `Select ${studentName} for today's work` : `${studentName} is absent and cannot be selected`}
                          />
                        ) : null}
                        <div className="faculty-avatar">{getInitials(studentName)}</div>
                        <div className="faculty-today-work-student-copy">
                          <strong>{studentName}</strong>
                          <span>{student?.studentId || student?.emailAddress || '-'}</span>
                        </div>
                        {todayWorkMode === 'attendance' ? (
                          discontinued ? <span className="faculty-student-attendance-pill faculty-student-attendance-pill--discontinued">Discontinued</span> : <div className="faculty-today-work-attendance-buttons">
                            <button
                              type="button"
                              className={`faculty-today-work-attendance-button faculty-today-work-attendance-button--present${status === 'PRESENT' ? ' is-active' : ''}`}
                              onClick={() => setTodayWorkAttendance(studentId, 'PRESENT')}
                              disabled={attendanceWindowLocked}
                            >
                              <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                              Present
                            </button>
                            <button
                              type="button"
                              className={`faculty-today-work-attendance-button faculty-today-work-attendance-button--absent${status === 'ABSENT' ? ' is-active' : ''}`}
                              onClick={() => setTodayWorkAttendance(studentId, 'ABSENT')}
                              disabled={attendanceWindowLocked}
                            >
                              <X size={14} strokeWidth={2.5} aria-hidden="true" />
                              Absent
                            </button>
                          </div>
                        ) : (
                          <span className={`faculty-student-attendance-pill faculty-student-attendance-pill--${status.toLowerCase() || 'unmarked'}`}>
                            <i className="faculty-student-attendance-dot" aria-hidden="true" />
                            {status === 'PRESENT' ? 'Present' : status === 'ABSENT' ? 'Absent' : 'Unmarked'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              {todayWorkError ? <div className="faculty-today-work-status">{todayWorkError}</div> : null}

              <div className="faculty-today-work-actions">
                <button type="button" className="faculty-today-work-cancel" onClick={closeTodayWorkModal}>
                  Cancel
                </button>
                <button type="submit" className="faculty-today-work-save" disabled={isTodayWorkSaving || attendanceWindowLocked}>
                  {isTodayWorkSaving
                    ? 'Saving...'
                    : todayWorkMode === 'attendance'
                      ? `Save Attendance (${markedAttendanceCount} / ${studentsFlowActionableStudents.length} marked)`
                      : 'Save Progress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {attendanceWarningPopup ? (
        <div className="faculty-attendance-warning-backdrop" role="presentation">
          <div
            className="faculty-attendance-warning-popup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="faculty-attendance-warning-title"
          >
            <div className="faculty-attendance-warning-popup-icon" aria-hidden="true">
              <AlertTriangle size={22} strokeWidth={2.4} />
            </div>
            <div className="faculty-attendance-warning-popup-copy">
              <strong id="faculty-attendance-warning-title">Attendance Warning</strong>
              <span>{attendanceWarningPopup.message}</span>
            </div>
            <button
              type="button"
              className="faculty-attendance-warning-popup-action"
              onClick={() => {
                setAttendanceWarningPopup(null)
                openTodayWorkModal('attendance')
              }}
            >
              Mark Attendance
            </button>
            <button
              type="button"
              className="faculty-attendance-warning-popup-close"
              aria-label="Dismiss attendance warning"
              onClick={() => setAttendanceWarningPopup(null)}
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      ) : null}

      {batchCompletionPopup ? (
        <div className="faculty-batch-completion-backdrop" role="presentation">
          <div
            className="faculty-batch-completion-popup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="faculty-batch-completion-title"
          >
            <div className="faculty-batch-completion-icon" aria-hidden="true">
              <CheckCircle2 size={28} strokeWidth={2.4} />
            </div>
            <div className="faculty-batch-completion-copy">
              <span className="faculty-batch-completion-kicker">Batch Completed</span>
              <h3 id="faculty-batch-completion-title">{batchCompletionPopup.batchName}</h3>
              <p>All students have moved to Completed Student Records.</p>
            </div>
            <button
              type="button"
              className="faculty-batch-completion-button"
              onClick={() => setBatchCompletionPopup(null)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {attendanceSavedPrompt ? (
        <div className="faculty-today-work-confirm-backdrop branch-modal-backdrop" role="presentation">
          <div
            className="faculty-today-work-confirm-modal faculty-today-work-attendance-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-today-work-attendance-prompt-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="faculty-course-request-success-icon faculty-today-work-attendance-prompt-icon" aria-hidden="true">
              <CheckCircle2 size={30} strokeWidth={2.4} />
            </div>

            <div className="faculty-course-request-success-copy">
              <p className="faculty-course-request-success-kicker">Attendance Saved</p>
              <h3 id="faculty-today-work-attendance-prompt-title">
                {attendanceSavedPrompt.studentNames.join(', ')}
              </h3>
              <p>These pending or missed sub-modules are still available to complete.</p>
              <div className="faculty-today-work-attendance-prompt-list">
                {attendanceSavedPrompt.items.map((item) => (
                  <span key={item.key}>
                    {item.studentName}: {item.moduleName} · {item.submoduleName}
                  </span>
                ))}
              </div>
            </div>

            <div className="faculty-course-request-success-actions faculty-today-work-attendance-prompt-actions">
              <button
                type="button"
                className="faculty-course-request-success-button faculty-today-work-attendance-complete-button"
                onClick={closeTodayWorkModal}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTodayWorkConfirmOpen ? (
        <div className="faculty-today-work-confirm-backdrop branch-modal-backdrop" role="presentation">
          <div
            className="faculty-today-work-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-today-work-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="faculty-course-request-success-icon" aria-hidden="true">
              <CheckCircle2 size={30} strokeWidth={2.4} />
            </div>

            <div className="faculty-course-request-success-copy">
              <p className="faculty-course-request-success-kicker">Confirm Save</p>
              <h3 id="faculty-today-work-confirm-title">Save progress?</h3>
              <p>
                {pendingTodayWorkSubmission?.selectedSubmoduleIds?.length || 0} sub-module
                {(pendingTodayWorkSubmission?.selectedSubmoduleIds?.length || 0) === 1 ? '' : 's'}
                {' '}selected for{' '}
                {pendingTodayWorkSubmission?.selectedStudents?.length || 0} student
                {(pendingTodayWorkSubmission?.selectedStudents?.length || 0) === 1 ? '' : 's'}.
              </p>
            </div>

            <div className="faculty-course-request-success-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center', width: '100%' }}>
              <button
                type="button"
                className="faculty-course-request-success-button"
                onClick={() => {
                  setIsTodayWorkConfirmOpen(false)
                  setPendingTodayWorkSubmission(null)
                }}
                disabled={isTodayWorkSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="faculty-course-request-success-button"
                onClick={handleConfirmTodayWorkSave}
                disabled={isTodayWorkSaving}
              >
                {isTodayWorkSaving ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCourseRequestModalOpen ? (
        <div className="faculty-course-request-backdrop branch-modal-backdrop" role="presentation">
          <div
            className="faculty-course-request-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-course-request-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="faculty-course-request-close"
              aria-label="Close edit request"
              onClick={() => setIsCourseRequestModalOpen(false)}
            >
              ×
            </button>

            <div className="faculty-course-request-header">
              <p className="faculty-course-request-kicker">Edit Request</p>
              <h3 id="faculty-course-request-title">{selectedCourse?.name || selectedCourse?.courseName || 'Course'} request</h3>
              <p className="faculty-course-request-subtitle">
                Request permission to edit only the modules and submodules. Course basic details remain locked.
              </p>
            </div>

            <form className="faculty-course-request-form" onSubmit={handleSendCourseEditRequest}>
              <label className="faculty-course-request-field">
                <span>Request title / reason</span>
                <textarea
                  value={courseRequestForm.reason}
                  onChange={(event) =>
                    setCourseRequestForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Example: Need to update Module 2 and Sub Module 3 content"
                />
              </label>

              <label className="faculty-course-request-field">
                <span>Description</span>
                <textarea
                  value={courseRequestForm.description}
                  onChange={(event) =>
                    setCourseRequestForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe exactly what should be changed in the module / submodule structure."
                />
              </label>

              {courseRequestError ? <div className="faculty-course-request-status">{courseRequestError}</div> : null}

              <div className="faculty-course-request-actions">
                <button type="button" className="faculty-course-request-cancel" onClick={() => setIsCourseRequestModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="faculty-course-request-submit" disabled={isCourseRequestSaving}>
                  {isCourseRequestSaving ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCourseRequestSuccessOpen ? (
        <div
          className="faculty-course-request-success-backdrop branch-modal-backdrop"
          role="presentation"
        >
          <div
            className="faculty-course-request-success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-course-request-success-title"
            aria-describedby="faculty-course-request-success-description"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="faculty-course-request-success-close"
              aria-label="Close confirmation"
              onClick={() => setIsCourseRequestSuccessOpen(false)}
            >
              ×
            </button>

            <div className="faculty-course-request-success-icon" aria-hidden="true">
              <CheckCircle2 size={30} strokeWidth={2.4} />
            </div>

            <div className="faculty-course-request-success-copy">
              <p className="faculty-course-request-success-kicker">Request Sent</p>
              <h3 id="faculty-course-request-success-title">Edit request sent successfully.</h3>
              {/* <p id="faculty-course-request-success-description">
                Your request has been submitted for review. We&apos;ll update you once it is processed.
              </p> */}
            </div>

            <button
              type="button"
              className="faculty-course-request-success-button"
              onClick={() => setIsCourseRequestSuccessOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {isCourseEditSuccessOpen ? (
        <div className="faculty-course-edit-success-backdrop branch-modal-backdrop" role="presentation">
          <div
            className="faculty-course-edit-success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-course-edit-success-title"
            aria-describedby="faculty-course-edit-success-description"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="faculty-course-edit-success-close"
              aria-label="Close confirmation"
              onClick={() => setIsCourseEditSuccessOpen(false)}
            >
              ×
            </button>

            <div className="faculty-course-edit-success-icon" aria-hidden="true">
              <CheckCircle2 size={30} strokeWidth={2.4} />
            </div>

            <div className="faculty-course-edit-success-copy">
              <p className="faculty-course-edit-success-kicker">Request Completed</p>
              <h3 id="faculty-course-edit-success-title">Request completed successfully.</h3>
              
            </div>

            <button
              type="button"
              className="faculty-course-request-success-button"
              onClick={() => setIsCourseEditSuccessOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {isCourseEditModalOpen && courseEditDraft ? (
        <div className="faculty-course-edit-backdrop branch-modal-backdrop" role="presentation">
          <div
            className="faculty-course-edit-modal faculty-course-edit-modal--flow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-course-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="faculty-course-edit-close"
              aria-label="Close course editor"
              onClick={() => setIsCourseEditModalOpen(false)}
            >
              ×
            </button>

            <div className="faculty-course-edit-header faculty-course-edit-header--flow">
              <p className="faculty-course-edit-kicker">Open Edit</p>
              <h3 id="faculty-course-edit-title">{courseEditDraft.courseName}</h3>
             
            </div>

            <div className="faculty-course-edit-flow">
             

              {courseEditView === 'overview' ? (
                <section className="faculty-course-edit-overview">
                  <div className="faculty-course-edit-overview-header">
                    <div>
                      <h4>Modules</h4>
                      <p>{courseEditModules.length} saved</p>
                    </div>
                    <button type="button" className="faculty-course-edit-add-module faculty-course-edit-add-module--top" onClick={addCourseEditModule}>
                      + Add Module
                    </button>
                  </div>

                  <div className="faculty-course-edit-overview-table">
                    <div className="faculty-course-edit-overview-head">
                      <span>Module</span>
                      <span>Module %</span>
                      <span>Submodules</span>
                      <span>Actions</span>
                    </div>

                    <div className="faculty-course-edit-overview-body" onClick={handleCourseEditOverviewBodyClick}>
                      {/* Row click is delegated so the whole row toggles submodules reliably */}
                      {courseEditModules.length ? (
                        courseEditModules.map((module, moduleIndex) => {
                          const submodules = Array.isArray(module.submodules) ? module.submodules : []
                          const moduleId = String(module.id || moduleIndex).trim()
                          const isExpanded = courseEditExpandedModuleIds.includes(moduleId)

                          return (
                            <article
                              key={moduleId || moduleIndex}
                              className="faculty-course-edit-overview-row"
                              data-module-id={moduleId}
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  toggleCourseEditExpandedModule(moduleId)
                                }
                              }}
                            >
                              <div className="faculty-course-edit-overview-main">
                                <div className="faculty-course-edit-overview-module">
                                  <div>
                                    <strong>{module.name || `Module ${moduleIndex + 1}`}</strong>
                                  </div>
                                </div>

                                <div className="faculty-course-edit-overview-percent">
                                  <span>{getModulePercentage(module, moduleIndex, courseEditModules.length)}</span>
                                </div>

                                <div className="faculty-course-edit-overview-submodules">
                                  <span>{submodules.length} Submodules</span>
                                </div>

                                <div className="faculty-course-edit-overview-actions">
                                  <button
                                    type="button"
                                    className="faculty-course-edit-action-btn"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      toggleCourseEditExpandedModule(moduleId)
                                    }}
                                    aria-label={isExpanded ? 'Collapse module' : 'Expand module'}
                                    title={isExpanded ? 'Collapse module' : 'Expand module'}
                                  >
                                    {isExpanded ? <ChevronUp size={18} strokeWidth={2.25} aria-hidden="true" /> : <ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" />}
                                  </button>
                                  <button
                                    type="button"
                                    className="faculty-course-edit-action-btn"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      openCourseEditModule(moduleIndex)
                                    }}
                                    aria-label={`Edit module ${moduleIndex + 1}`}
                                    title={`Edit module ${moduleIndex + 1}`}
                                  >
                                    <Pencil size={17} strokeWidth={2.25} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="faculty-course-edit-action-btn is-danger"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      openCourseEditDeleteConfirm('module', moduleIndex)
                                    }}
                                    disabled={courseEditModules.length === 1}
                                    aria-label={`Delete module ${moduleIndex + 1}`}
                                    title={courseEditModules.length === 1 ? 'At least one module is required' : `Delete module ${moduleIndex + 1}`}
                                  >
                                    <Trash2 size={17} strokeWidth={2.25} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>

                              {isExpanded ? (
                                <div
                                  className="faculty-course-edit-overview-details"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <p className="faculty-course-edit-overview-subtitle">Sub Modules</p>
                                      {submodules.length ? (
                                        <div className="faculty-course-edit-overview-submodule-list">
                                          {submodules.map((submodule, submoduleIndex) => (
                                            <div key={submodule.id || submoduleIndex} className="faculty-course-edit-overview-submodule">
                                              <span className="faculty-course-edit-overview-submodule-index">
                                                {String(submoduleIndex + 1).padStart(2, '0')}
                                              </span>
                                              <strong>{submodule.name || `Submodule ${submoduleIndex + 1}`}</strong>
                                              <span className="faculty-course-edit-overview-submodule-percent">
                                                {getEqualSplitPercentageLabel(submoduleIndex, submodules.length)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                    <div className="faculty-course-edit-empty faculty-course-edit-empty--compact">No submodules yet.</div>
                                  )}
                                </div>
                              ) : null}
                            </article>
                          )
                        })
                      ) : (
                        <div className="faculty-course-edit-empty">No modules found for this course yet.</div>
                      )}
                    </div>
                  </div>
                </section>
              ) : null}

              {courseEditView === 'module' && courseEditActiveModule ? (
                <section className="faculty-course-edit-step-shell">
                  <article className="faculty-course-edit-step-card">
                    <div className="faculty-course-edit-step-title-row">
                      <span className="faculty-course-edit-step-badge">
                        {String(courseEditActiveModuleIndex + 1).padStart(2, '0')}
                      </span>
                      <strong>Module {courseEditActiveModuleIndex + 1}</strong>
                    </div>

                    <label className="faculty-course-edit-field">
                      <span>Module Name <b>*</b></span>
                      <input
                        type="text"
                        className="faculty-course-edit-input faculty-course-edit-input--module"
                        value={courseEditActiveModule.name || ''}
                        onChange={(event) => updateCourseEditModule(courseEditActiveModuleIndex, 'name', event.target.value)}
                        placeholder="Enter module name"
                      />
                    </label>

                    <div className="faculty-course-edit-step-actions">
                      <button type="button" className="faculty-course-edit-cancel" onClick={cancelCourseEditModule}>
                        Cancel
                      </button>
                      <button type="button" className="faculty-course-edit-step-primary" onClick={continueCourseEditModule}>
                        Continue
                      </button>
                    </div>
                  </article>
                </section>
              ) : null}

              {courseEditView === 'submodules' && courseEditActiveModule ? (
                <section className="faculty-course-edit-submodule-shell">
                  <div className="faculty-course-edit-submodule-shell-header">
                    <div>
                      <h4>Sub Modules</h4>
                      <p>{courseEditActiveModule.name || `Module ${courseEditActiveModuleIndex + 1}`}</p>
                    </div>
                    <span className="faculty-course-edit-submodule-count">{courseEditActiveModuleSubmodules.length} saved</span>
                  </div>

                  <div className="faculty-course-edit-submodule-panel">
                    <div className="faculty-course-edit-submodule-list-v2">
                      {courseEditActiveModuleSubmodules.length ? (
                        courseEditActiveModuleSubmodules.map((submodule, submoduleIndex) => {
                          const isEditingCurrent =
                            courseEditInlineSubmodule &&
                            courseEditInlineSubmodule.mode === 'edit' &&
                            courseEditInlineSubmodule.moduleIndex === courseEditActiveModuleIndex &&
                            courseEditInlineSubmodule.submoduleIndex === submoduleIndex

                          return (
                            <div key={submodule.id || submoduleIndex} className="faculty-course-edit-submodule-item-v2">
                              <span className="faculty-course-edit-submodule-check">✓</span>

                              {isEditingCurrent ? (
                                <div className="faculty-course-edit-submodule-editor">
                                  <label className="faculty-course-edit-submodule-editor-label">
                                    Submodule {submoduleIndex + 1} *
                                  </label>
                                  <input
                                    type="text"
                                    className="faculty-course-edit-input"
                                    value={courseEditInlineSubmodule.value}
                                    onChange={(event) =>
                                      setCourseEditInlineSubmodule((current) =>
                                        current ? { ...current, value: event.target.value } : current,
                                      )
                                    }
                                    placeholder="Enter submodule name"
                                  />
                                  {courseEditInlineSubmodule.error && (
  <span className="faculty-course-edit-field-error">
    {courseEditInlineSubmodule.error}
  </span>
)}
                                  <div className="faculty-course-edit-inline-actions">
                                    <button
                                      type="button"
                                      className="faculty-course-edit-inline-save"
                                      onClick={saveCourseEditInlineSubmodule}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="faculty-course-edit-inline-cancel"
                                      onClick={cancelCourseEditInlineSubmodule}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <strong>{submodule.name || `Submodule ${submoduleIndex + 1}`}</strong>
                                  <div className="faculty-course-edit-submodule-actions">
                                    <button
                                      type="button"
                                      className="faculty-course-edit-icon-btn"
                                      onClick={() => startCourseEditSubmoduleEdit(courseEditActiveModuleIndex, submoduleIndex)}
                                      aria-label={`Edit submodule ${submoduleIndex + 1}`}
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      className="faculty-course-edit-icon-btn is-danger"
                                      onClick={() => openCourseEditDeleteConfirm('submodule', courseEditActiveModuleIndex, submoduleIndex)}
                                      aria-label={`Delete submodule ${submoduleIndex + 1}`}
                                    >
                                      🗑
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <div className="faculty-course-edit-empty faculty-course-edit-empty--compact">No submodules yet. Add one below.</div>
                      )}

                      {courseEditInlineSubmodule &&
                      courseEditInlineSubmodule.mode === 'add' &&
                      courseEditInlineSubmodule.moduleIndex === courseEditActiveModuleIndex ? (
                        <div className="faculty-course-edit-submodule-item-v2 faculty-course-edit-submodule-item-v2--editor">
                          <span className="faculty-course-edit-submodule-check">+</span>
                          <div className="faculty-course-edit-submodule-editor">
                            <label className="faculty-course-edit-submodule-editor-label">
                              New Submodule <b>*</b>
                            </label>
                            <input
                              type="text"
                              className="faculty-course-edit-input"
                              value={courseEditInlineSubmodule.value}
                              onChange={(event) =>
                                setCourseEditInlineSubmodule((current) =>
                                  current ? { ...current, value: event.target.value } : current,
                                )
                              }
                              placeholder={courseEditInlineSubmodule.placeholder || 'Enter submodule name'}
                            />
                            {courseEditInlineSubmodule.error && (
  <div className="faculty-course-edit-field-error">
    {courseEditInlineSubmodule.error}
  </div>
)}
                            <div className="faculty-course-edit-inline-actions">
                              <button
                                type="button"
                                className="faculty-course-edit-inline-save"
                                onClick={saveCourseEditInlineSubmodule}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="faculty-course-edit-inline-cancel"
                                onClick={cancelCourseEditInlineSubmodule}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="faculty-course-edit-add-submodule faculty-course-edit-add-submodule--flow"
                      onClick={() => startCourseEditAddSubmodule(courseEditActiveModuleIndex)}
                    >
                      + Add Submodule
                    </button>
                  </div>

                  <div className="faculty-course-edit-step-actions">
                    <button type="button" className="faculty-course-edit-cancel" onClick={() => setCourseEditView('module')}>
                      Back
                    </button>
                    <button
                      type="button"
                      className="faculty-course-edit-step-primary"
                      onClick={() => setCourseEditView('overview')}
                    >
                      Done
                    </button>
                  </div>
                </section>
              ) : null}

              {courseEditDeleteConfirm ? (
                <div className="faculty-course-delete-overlay" role="presentation" onClick={closeCourseEditDeleteConfirm}>
                  <div
                    className="faculty-course-delete-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="faculty-course-delete-title"
                    aria-describedby="faculty-course-delete-text"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="faculty-course-delete-close"
                      aria-label="Close delete confirmation"
                      onClick={closeCourseEditDeleteConfirm}
                    >
                      ×
                    </button>

                    <p className="faculty-course-delete-kicker">Delete Confirmation</p>
                    <h3 id="faculty-course-delete-title">
                      {courseEditDeleteConfirm.type === 'module' ? 'Delete this module?' : 'Delete this submodule?'}
                    </h3>
                    <p id="faculty-course-delete-text" className="faculty-course-delete-text">
                      {courseEditDeleteConfirm.type === 'module'
                        ? 'This will remove the module from the current edit draft. Click OK only if you want to delete it.'
                        : 'This will remove the submodule from the current edit draft. Click OK only if you want to delete it.'}
                    </p>

                    <div className="faculty-course-delete-actions">
                      <button type="button" className="faculty-course-delete-cancel" onClick={closeCourseEditDeleteConfirm}>
                        Cancel
                      </button>
                      <button type="button" className="faculty-course-delete-confirm" onClick={confirmCourseEditDelete}>
                        OK
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {courseEditError ? <div className="faculty-course-edit-status faculty-course-edit-status--error">{courseEditError}</div> : null}

              <div className="faculty-course-edit-actions faculty-course-edit-actions--footer">
                <button type="button" className="faculty-course-edit-cancel" onClick={() => setIsCourseEditModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="faculty-course-edit-save"
                  onClick={handleSaveCourseEditChanges}
                  disabled={isCourseEditSaving}
                >
                  {isCourseEditSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {academicTestModalStudent ? (() => {
        const progress = academicTestModalStudent?._facultyLifecycleMetrics?.academicTestProgress || academicTestModalStudent?.academicTestProgress || {}
        // Course-completed students are reset into a fresh active cycle after
        // the final report is sent. The lifecycle row then contains Pending
        // values, so prefer the immutable academic report history loaded for
        // this modal when it is available.
        const historicalItems = Array.isArray(studentPerformanceDetails?.academic?.items) ? studentPerformanceDetails.academic.items : []
        const historicalResults = historicalItems.map((item) => {
          const match = String(item.testName || '').match(/(\d+)/)
          const testNumber = match ? Number(match[1]) : null
          const isProject = String(item.testType || '').toUpperCase() === 'PROJECT' || /project/i.test(String(item.testName || ''))
          return {
            testNumber,
            testType: isProject ? 'PROJECT' : 'TEST',
            testMarks: !isProject ? item.marksObtained : null,
            testTotalMarks: !isProject ? item.totalMarks : null,
            testResult: !isProject ? item.result : null,
            projectMarks: isProject ? item.marksObtained : item.projectMarks,
            projectTotalMarks: isProject ? item.totalMarks : item.projectTotalMarks,
            projectResult: isProject ? item.result : item.projectResult,
          }
        }).filter((item) => Number.isFinite(item.testNumber))
        const results = historicalResults.length || !Array.isArray(progress.academicResults)
          ? historicalResults
          : progress.academicResults
        const resultFor = (column) => results.find((result) => Number(result.testNumber) === Number(column.testNumber))
        const testResults = results.filter((result) => result.testMarks != null && Number(result.testTotalMarks) > 0)
        const projectResults = results.filter((result) => result.projectMarks != null && Number(result.projectTotalMarks) > 0)
        const testTotal = testResults.reduce((sum, result) => sum + Number(result.testTotalMarks || 0), 0)
        const testObtained = testResults.reduce((sum, result) => sum + Number(result.testMarks || 0), 0)
        const projectTotal = projectResults.reduce((sum, result) => sum + Number(result.projectTotalMarks || 0), 0)
        const projectObtained = projectResults.reduce((sum, result) => sum + Number(result.projectMarks || 0), 0)
        const renderResult = (result, type) => {
          if (!result) return <span className="faculty-academic-empty">-</span>
          const marks = type === 'project' ? result.projectMarks : result.testMarks
          const total = type === 'project' ? result.projectTotalMarks : result.testTotalMarks
          const percentage = marks != null && Number(total) > 0 ? Number(((Number(marks) / Number(total)) * 100).toFixed(2)) : null
          const status = type === 'project' ? result.projectResult : result.testResult
          return <span className="faculty-academic-result-cell"><strong>{marks != null && Number(total) > 0 ? `${marks}/${total}` : 'Pending'}</strong>{percentage != null ? <small>{percentage}%</small> : null}{status ? <em className={String(status).toLowerCase()}>{status}</em> : null}</span>
        }
        return (
          <div className="faculty-academic-modal-backdrop" role="presentation" onClick={() => setAcademicTestModalStudent(null)}>
            <div className="faculty-academic-modal" role="dialog" aria-modal="true" aria-labelledby="faculty-academic-modal-title" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="faculty-academic-modal-close" aria-label="Close academic test details" onClick={() => setAcademicTestModalStudent(null)}>×</button>
              <h2 id="faculty-academic-modal-title">Academic Test Details</h2>
              <p className="faculty-academic-modal-student"><strong>{academicTestModalStudent.studentName}</strong> <span>{academicTestModalStudent.studentId}</span></p>
              {studentPerformanceLoading ? <p className="faculty-academic-modal-loading">Loading syllabus tests and assessments...</p> : null}
              <div className="faculty-academic-modal-table-wrap">
                <table className="faculty-academic-modal-table">
                  <thead><tr>{academicColumnDefinitions.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
                  <tbody><tr>{academicColumnDefinitions.map((column) => (
                    <td key={column.key}>
                      {column.type === 'overall-test'
                        ? <span className="faculty-academic-result-cell"><strong>{testTotal > 0 ? `${Number(((testObtained / testTotal) * 100).toFixed(2))}%` : '-'}</strong></span>
                        : column.type === 'overall-project'
                          ? <span className="faculty-academic-result-cell"><strong>{projectTotal > 0 ? `${Number(((projectObtained / projectTotal) * 100).toFixed(2))}%` : '-'}</strong></span>
                          : renderResult(resultFor(column), column.type)}
                    </td>
                  ))}</tr></tbody>
                </table>
              </div>
              {!studentPerformanceLoading && studentPerformanceDetails ? (
                <div className="faculty-academic-extra-reports">
                  <section className="faculty-academic-extra-report">
                    <div className="faculty-academic-extra-heading"><h3>Syllabus Test Details</h3><span>{studentPerformanceDetails.syllabus?.skills?.length || 0} modules</span></div>
                    {studentPerformanceDetails.syllabus?.skills?.length ? (
                      <div className="faculty-academic-extra-table-wrap"><table className="faculty-academic-extra-table"><thead><tr><th>Module</th><th>Tests</th><th>Marks / Percentage</th></tr></thead><tbody>{studentPerformanceDetails.syllabus.skills.map((skill) => <tr key={skill.moduleId || skill.moduleName}><td>{skill.moduleName || '-'}</td><td>{skill.testCount ?? 0}</td><td>{Array.isArray(skill.tests) && skill.tests.length ? <div className="faculty-academic-syllabus-test-marks">{skill.tests.map((test, index) => <span key={`${test.testName || 'test'}-${index}`}><strong>{test.testName || `Test ${index + 1}`}</strong> {test.marksObtained}/{test.totalMarks} ({test.percentage ?? 0}%)</span>)}<small>Overall: {skill.obtained}/{skill.maximum} ({skill.overallPercentage ?? 0}%)</small></div> : (skill.maximum > 0 ? `${skill.obtained}/${skill.maximum} (${skill.overallPercentage ?? 0}%)` : (skill.overallPercentage == null ? '-' : `${skill.overallPercentage}%`))}</td></tr>)}</tbody></table></div>
                    ) : <p className="faculty-academic-extra-empty">No syllabus test report available.</p>}
                  </section>
                  <section className="faculty-academic-extra-report">
                    <div className="faculty-academic-extra-heading"><h3>Assessment Details</h3><span>{studentPerformanceDetails.assessments.length} modules</span></div>
                    {studentPerformanceDetails.assessments.length ? studentPerformanceDetails.assessments.map((item) => (
                      <div className="faculty-academic-assessment-group" key={`${item.course?.id || ''}-${item.batch?.id || ''}-${item.module?.id || ''}`}>
                        <strong>{item.module?.name || item.module?.title || 'Assessment'}</strong>
                      <div className="faculty-academic-extra-table-wrap"><table className="faculty-academic-extra-table"><thead><tr>{item.report.assessments.filter((assessment) => !assessment.isReassessment || item.student.assessments?.[assessment.originalAssessmentId]?.status !== 'EVALUATED').map((assessment) => <th key={assessment.id}>{assessment.assessmentName}<small>{assessment.totalMarks} marks</small></th>)}<th>Overall</th></tr></thead><tbody><tr>{item.report.assessments.filter((assessment) => !assessment.isReassessment || item.student.assessments?.[assessment.originalAssessmentId]?.status !== 'EVALUATED').map((assessment) => { const result = item.student.assessments?.[assessment.id]; const evaluated = result?.status === 'EVALUATED' && result.marksObtained != null; return <td key={assessment.id}>{evaluated ? `${result.marksObtained}/${result.totalMarks} (${Number(result.percentage || 0).toFixed(2)}%)` : result?.status === 'SUBMITTED' ? 'Submitted · Pending' : result?.status === 'NOT_APPLICABLE' ? 'Not Attempted' : 'Not Submitted'}</td> })}<td>{item.student.overall?.totalMarks ? `${item.student.overall.marksObtained}/${item.student.overall.totalMarks} (${Number(item.student.overall.percentage || 0).toFixed(2)}%)` : 'Not Evaluated'}</td></tr></tbody></table></div>
                      </div>
                    )) : <p className="faculty-academic-extra-empty">No assessment report available.</p>}
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        )
      })() : null}

      {isLogoutConfirmOpen ? (
        <div className="branch-modal-backdrop" role="presentation">
          <div
            className="branch-logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-logout-title"
            aria-describedby="branch-logout-description"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="branch-logout-close"
              aria-label="Close logout confirmation"
              onClick={() => setIsLogoutConfirmOpen(false)}
            >
              ×
            </button>

            <h2 id="branch-logout-title">Are you sure you want to logout?</h2>
            <p id="branch-logout-description" className="branch-logout-description sr-only">
              You can always sign in again if you need access later.
            </p>

            <div className="branch-logout-actions">
              <button type="button" className="branch-logout-cancel" onClick={() => setIsLogoutConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="branch-logout-submit" onClick={handleConfirmLogout}>
                Logout
              </button>
            </div>
          </div>



          
        </div>
      ) : null}
    </section>
  )
}

export { FacultyDashboardPage as FacultyMyBatchesPage }



