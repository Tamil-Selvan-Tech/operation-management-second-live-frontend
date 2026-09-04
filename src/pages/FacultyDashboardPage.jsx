import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
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
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Lock,
  X,
} from 'lucide-react'
import {
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
import { markFacultyStudentAttendance } from '../services/attendanceService'
import { getFacultyMyBatchesSummary } from '../services/dashboardService'
import { PaginationBar } from '../components/PaginationBar'
import { listCourses } from '../services/courseService'
import { getCurrentFacultyProfile } from '../services/facultyService'
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
import { StudentAttendanceReportModal } from '../components/StudentAttendanceReportModal'
import { useAuth } from '../auth/useAuth'
import { loadFacultyRegistry } from '../lib/facultyAuth'
import { BRANCH_STUDENTS_KEY, loadBranchStudents } from '../lib/branchStudentStore'
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
import { getStudentPaymentProgress } from '../lib/studentPaymentProgress'
import { Button } from '../components/Button'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/BranchDashboardPage.css'
import '../styles/FacultyDashboardPage.css'
import {
  buildProgressComparisonNotification,
  syncProgressComparisonNotifications,
} from '../lib/progressComparisonNotification'

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

  const date = new Date(`${value}T00:00:00`)
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
    String(batch?.id || batch?.batchId || batch?.batchEntryId || '').trim() ||
    normalizeCourseKey(batch?.code || batch?.batchCode || batch?.batchName || batch?.batch || '') ||
    normalizeCourseKey(batch?.timing || batch?.batchTiming || '')
  )
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

  return {
    ...student,
    studentId: String(student?.studentId || student?.id || '').trim(),
    studentName: String(student?.studentName || '').trim(),
    emailAddress: String(student?.emailAddress || '').trim(),
    mobileNumber: String(student?.mobileNumber || student?.phoneNumber || student?.phone || student?.studentPhone || '').trim(),
    parentSpouseNumber: String(student?.parentSpouseNumber || '').trim(),
    address: String(student?.address || student?.location || '').trim(),
    qualification: String(student?.qualification || '').trim(),
    designation: String(student?.designation || '').trim(),
    courseName,
    batchName,
    batchTiming,
    classSchedule,
    courseStartDate,
    facultyName: String(student?.facultyName || context?.facultyName || '').trim(),
  }
}

function getStudentIdentityKey(student = {}) {
  const primaryKey =
    String(student?.id || '').trim().toLowerCase() ||
    String(student?.studentId || '').trim().toLowerCase() ||
    String(student?.emailAddress || '').trim().toLowerCase() ||
    String(student?.mobileNumber || '').trim().toLowerCase() ||
    String(student?.studentCode || '').trim().toLowerCase()

  if (primaryKey) return primaryKey

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

function getExactFacultyStudents(students = [], facultyId = '', facultyName = '', facultyEmail = '') {
  const normalizedFacultyId = String(facultyId || '').trim().toLowerCase()
  const normalizedFacultyName = String(facultyName || '').trim().toLowerCase()
  const normalizedFacultyEmail = String(facultyEmail || '').trim().toLowerCase()

  return (Array.isArray(students) ? students : []).filter((student) => {
    const studentFacultyId = String(student?.facultyId || '').trim().toLowerCase()
    const studentFacultyName = String(student?.facultyName || '').trim().toLowerCase()
    const studentFacultyEmail = String(student?.facultyEmail || '').trim().toLowerCase()

    const matchesFacultyId =
      normalizedFacultyId &&
      studentFacultyId &&
      studentFacultyId === normalizedFacultyId

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

function getWorkBatchContext(source = {}) {
  return {
    batchId: normalizeWorkStudentId(source?.batchId || source?.batchEntryId),
    batchGroupId: normalizeWorkStudentId(source?.batchGroupId),
    batchName: normalizeWorkStudentId(source?.batchName || source?.batch),
    batchTiming: normalizeWorkStudentId(source?.batchTiming || source?.batchTime || source?.timing),
  }
}

function doesWorkEntryMatchBatch(entry = {}, source = {}) {
  const entryBatch = getWorkBatchContext(entry)
  const sourceBatch = getWorkBatchContext(source)
  const hasExplicitBatchIdentity = Boolean(
    entryBatch.batchId ||
    entryBatch.batchGroupId ||
    sourceBatch.batchId ||
    sourceBatch.batchGroupId,
  )

  if (entryBatch.batchId && sourceBatch.batchId && entryBatch.batchId === sourceBatch.batchId) return true
  if (entryBatch.batchId && sourceBatch.batchGroupId && entryBatch.batchId === sourceBatch.batchGroupId) return true
  if (entryBatch.batchGroupId && sourceBatch.batchId && entryBatch.batchGroupId === sourceBatch.batchId) return true
  if (entryBatch.batchGroupId && sourceBatch.batchGroupId && entryBatch.batchGroupId === sourceBatch.batchGroupId) return true

  // Older work entries do not contain batch columns. Their studentIds are the
  // batch scope, so do not reject them only because batch metadata is absent.
  if (!entryBatch.batchId && !entryBatch.batchGroupId) return true

  if (hasExplicitBatchIdentity) return false

  const sameName = Boolean(entryBatch.batchName && sourceBatch.batchName && entryBatch.batchName === sourceBatch.batchName)
  const sameTiming = Boolean(entryBatch.batchTiming && sourceBatch.batchTiming && entryBatch.batchTiming === sourceBatch.batchTiming)

  return sameName || sameTiming
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
        .filter((submoduleId) => submoduleId && validSubmoduleIds.has(submoduleId)),
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
    const entryModuleId = String(entry?.moduleId || '').trim()
    if (!entryModuleId) return
    const submoduleSet = moduleCompletionMap.get(entryModuleId)
    const validSubmoduleIds = moduleSubmoduleIdMap.get(entryModuleId)
    if (!submoduleSet) return

    getWorkEntrySubmoduleIds(entry).forEach((submoduleId) => {
      const normalizedSubmoduleId = String(submoduleId || '').trim()
      if (normalizedSubmoduleId && validSubmoduleIds?.has(normalizedSubmoduleId)) {
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

function getFacultyWorkProgressForEntry(entry = {}, course = {}, selectedSubmoduleIds = []) {
  const modules = getCourseModels(course)
  const moduleId = String(entry.moduleId || '').trim()
  const module =
    modules.find((item, index) => String(item?.id || `module-${index}`).trim() === moduleId) ||
    modules[0] ||
    null
  const submodules = getCourseSubmodules(module)
  const totalSubmodules = submodules.length
  const completedSubmodules = Array.isArray(selectedSubmoduleIds)
    ? Array.from(new Set(selectedSubmoduleIds.map((value) => String(value || '').trim()).filter(Boolean))).length
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

function getNextPendingTodayWorkSelection(course = {}, todayWorkEntries = [], facultyIdentity = {}, batch = null) {
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

  facultyEntries.forEach((entry) => {
    const moduleId = String(entry?.moduleId || '').trim()
    const submoduleSet = moduleCompletionMap.get(moduleId)
    if (!submoduleSet) return

    getWorkEntrySubmoduleIds(entry).forEach((submoduleId) => {
      submoduleSet.add(submoduleId)
    })
  })

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

function getFacultyBatchProgressStudents(batch = {}, course = {}, students = [], backfillRecords = []) {
  const batchId = String(batch?.batchId || batch?.id || '').trim().toLowerCase()
  const batchGroupId = String(batch?.batchGroupId || '').trim().toLowerCase()
  const batchName = normalizeCourseKey(batch?.batchName || batch?.code || '')
  const batchTiming = normalizeCourseKey(batch?.timing || '')
  const courseId = String(course?.id || course?.courseId || '').trim().toLowerCase()
  const courseName = normalizeCourseKey(course?.name || course?.courseName || '')

  return dedupeStudentsByIdentity((Array.isArray(students) ? students : []).filter((student) => {
    const context = resolveFacultyBatchContextForStudent(student, backfillRecords)
    const studentCourseId = String(context?.courseId || student?.courseId || '').trim().toLowerCase()
    const studentCourseName = normalizeCourseKey(context?.courseName || student?.courseInterested || student?.courseName || student?.course?.name || '')
    const studentBatchId = String(context?.batchId || student?.batchId || student?.batchEntryId || '').trim().toLowerCase()
    const studentBatchGroupId = String(context?.batchGroupId || student?.batchGroupId || '').trim().toLowerCase()
    const studentBatchName = normalizeCourseKey(context?.batchName || student?.batchName || student?.batch || '')
    const studentBatchTiming = normalizeCourseKey(context?.batchTiming || student?.batchTiming || student?.batchTime || '')

    const matchesCourse =
      (!courseId || !studentCourseId || studentCourseId === courseId) &&
      (!courseName || !studentCourseName || studentCourseName === courseName)
    if (!matchesCourse) return false

    const matchesBatchIdentity = (
      (batchId && (studentBatchId === batchId || studentBatchGroupId === batchId)) ||
      (batchGroupId && (studentBatchId === batchGroupId || studentBatchGroupId === batchGroupId))
    )

    if (matchesBatchIdentity) return true

    // Some older student records do not store the batch ID. Keep those
    // records usable through the unique batch name/timing fallback, while
    // never falling back when a different explicit batch ID is present.
    if ((batchId || batchGroupId) && (studentBatchId || studentBatchGroupId)) {
      return false
    }

    return (batchName && studentBatchName === batchName) || (batchTiming && studentBatchTiming === batchTiming)
  }))
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

function summarizeFacultyEditChanges(previousModules = [], nextModules = [], facultyName = 'Faculty', courseName = 'Course') {
  const previousList = Array.isArray(previousModules) ? previousModules : []
  const nextList = Array.isArray(nextModules) ? nextModules : []
  const resolvedFacultyName = String(facultyName || 'Faculty').trim() || 'Faculty'
  const resolvedCourseName = String(courseName || 'Course').trim() || 'Course'

  const getModuleName = (module = {}, moduleIndex = 0) =>
    String(module?.name || module?.title || module?.moduleName || `Module ${moduleIndex + 1}`).trim() ||
    `Module ${moduleIndex + 1}`

  const getSubmoduleName = (submodule = {}, subIndex = 0) =>
    String(submodule?.name || submodule?.title || submodule?.submoduleName || `Submodule ${subIndex + 1}`).trim() ||
    `Submodule ${subIndex + 1}`

  const getModuleSubmodules = (module = {}) => (Array.isArray(module?.submodules) ? module.submodules : [])

  if (nextList.length > previousList.length) {
    const addedModuleIndex = Math.max(0, nextList.length - 1)
    const addedModule = nextList[addedModuleIndex] || {}
    const addedModuleName = getModuleName(addedModule, addedModuleIndex)
    const addedSubmodule = getModuleSubmodules(addedModule)[0] || null

    if (addedSubmodule) {
      return `${resolvedFacultyName} added a new module "${addedModuleName}" with a new submodule "${getSubmoduleName(addedSubmodule, 0)}" in ${resolvedCourseName}.`
    }

    return `${resolvedFacultyName} added a new module "${addedModuleName}" in ${resolvedCourseName}.`
  }

  if (nextList.length < previousList.length) {
    const deletedModuleIndex = Math.max(0, previousList.length - 1)
    const deletedModule = previousList[deletedModuleIndex] || {}
    return `${resolvedFacultyName} deleted the "${getModuleName(deletedModule, deletedModuleIndex)}" module from ${resolvedCourseName}.`
  }

  for (let moduleIndex = 0; moduleIndex < nextList.length; moduleIndex += 1) {
    const previousModule = previousList[moduleIndex] || {}
    const nextModule = nextList[moduleIndex] || {}
    const previousModuleName = getModuleName(previousModule, moduleIndex)
    const nextModuleName = getModuleName(nextModule, moduleIndex)
    const previousSubmodules = getModuleSubmodules(previousModule)
    const nextSubmodules = getModuleSubmodules(nextModule)

    if (previousModuleName !== nextModuleName) {
      return `${resolvedFacultyName} edited the module name from "${previousModuleName}" to "${nextModuleName}" in ${resolvedCourseName}.`
    }

    if (nextSubmodules.length > previousSubmodules.length) {
      const addedSubmoduleIndex = Math.max(0, nextSubmodules.length - 1)
      const addedSubmodule = nextSubmodules[addedSubmoduleIndex] || {}
      return `${resolvedFacultyName} added a new submodule "${getSubmoduleName(addedSubmodule, addedSubmoduleIndex)}" under the "${nextModuleName}" module in ${resolvedCourseName}.`
    }

    if (nextSubmodules.length < previousSubmodules.length) {
      const deletedSubmoduleIndex = Math.max(0, previousSubmodules.length - 1)
      const deletedSubmodule = previousSubmodules[deletedSubmoduleIndex] || {}
      return `${resolvedFacultyName} deleted the "${getSubmoduleName(deletedSubmodule, deletedSubmoduleIndex)}" submodule from the "${nextModuleName}" module in ${resolvedCourseName}.`
    }

    for (let submoduleIndex = 0; submoduleIndex < nextSubmodules.length; submoduleIndex += 1) {
      const previousSubmoduleName = getSubmoduleName(previousSubmodules[submoduleIndex] || {}, submoduleIndex)
      const nextSubmoduleName = getSubmoduleName(nextSubmodules[submoduleIndex] || {}, submoduleIndex)

      if (previousSubmoduleName !== nextSubmoduleName) {
        return `${resolvedFacultyName} edited the submodule name from "${previousSubmoduleName}" to "${nextSubmoduleName}" under the "${nextModuleName}" module in ${resolvedCourseName}.`
      }
    }
  }

  return `${resolvedFacultyName} updated modules and submodules in ${resolvedCourseName}.`
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
        {items.map((notification) => {
          const Icon = getFacultyNotificationIcon(notification)

          return (
            <article
              key={notification.id}
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
                <p>{notification.message}</p>
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

export function FacultyDashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const userRole = String(user?.role || '').trim().toLowerCase()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const notificationRef = useRef(null)

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
  const [facultyNotifications, setFacultyNotifications] =useState([])
  const [notificationOpen, setNotificationOpen] =useState(false)
  const [notificationStoreVersion, setNotificationStoreVersion] = useState(0)
  const [todayWorkEntries, setTodayWorkEntries] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [facultyProfile, setFacultyProfile] = useState(null)
  const [branchCourses, setBranchCourses] = useState([])
  const [courseCatalog, setCourseCatalog] = useState([])
  const [students, setStudents] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedStudentsCourseId, setSelectedStudentsCourseId] = useState('')
  const [selectedStudentsBatchId, setSelectedStudentsBatchId] = useState('')
  const [viewStudentDrawer, setViewStudentDrawer] = useState(null)
  const [expandedCourseModuleIds, setExpandedCourseModuleIds] = useState([])
  const [courseModuleLimit, setCourseModuleLimit] = useState(5)
  const [batchPage, setBatchPage] = useState(1)
  const [studentsPage, setStudentsPage] = useState(1)
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
    applyToAllStudents: true,
    moduleId: '',
    submoduleIds: [],
    selectedStudentIds: [],
  })
  const [todayWorkError, setTodayWorkError] = useState('')
  const [isTodayWorkSaving, setIsTodayWorkSaving] = useState(false)
  const [isTodayWorkConfirmOpen, setIsTodayWorkConfirmOpen] = useState(false)
  const [pendingTodayWorkSubmission, setPendingTodayWorkSubmission] = useState(null)
  const [courseEditError, setCourseEditError] = useState('')
  const [isCourseRequestSaving, setIsCourseRequestSaving] = useState(false)
  const [isCourseEditSaving, setIsCourseEditSaving] = useState(false)
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [coursesError, setCoursesError] = useState('')



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
          getCurrentFacultyProfile(),
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
        const nextStudents = loadBranchStudents()

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
  }, [])

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
    const sources = [
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
    const sources = [
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
    const branch = facultyDetails?.branch || {}
    return {
      facultyId: String(profile.id || profile.facultyId || profile.facultyUserId || facultyDetails?.id || '').trim(),
      facultyName: String(profile.facultyName || profile.name || facultyDetails?.name || '').trim(),
      facultyEmail: String(profile.facultyEmail || profile.email || facultyDetails?.email || '').trim(),
      branchId: String(profile.branchId || branch.id || facultyDetails?.branchId || facultyDetails?.branch?.id || '').trim(),
      branchCode: String(profile.branchCode || branch.branchId || facultyDetails?.branchCode || facultyDetails?.branch?.branchId || '').trim(),
    }
  }, [facultyDetails, facultyProfile])

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

  const backfilledStudents = useMemo(
    () => enrichStudentsWithFacultyReferences(students, facultyBackfillRecords, courseCatalog),
    [courseCatalog, facultyBackfillRecords, students],
  )

  const facultyScopedStudents = useMemo(() => {
    const facultyId = currentFacultyIdentity.facultyId
    const facultyNameValue = currentFacultyIdentity.facultyName
    const facultyEmailValue = currentFacultyIdentity.facultyEmail

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

    return getExactFacultyStudents(branchScopedStudents, facultyId, facultyNameValue, facultyEmailValue)
  }, [backfilledStudents, currentFacultyIdentity.branchCode, currentFacultyIdentity.branchId, currentFacultyIdentity.facultyEmail, currentFacultyIdentity.facultyId, currentFacultyIdentity.facultyName])

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

        if (!workProgressSummary) return null

        const courseProgress = Number(workProgressSummary.courseProgress)
        const paidProgress = Number(paymentProgress.paidInstallmentPercentage)

        return buildProgressComparisonNotification({
          studentName,
          studentId: studentIdLabel,
          courseProgress,
          paidProgress,
          recipientLabel: 'Faculty Dashboard',
        })
      })
      .filter(Boolean)
  }, [courseCatalog, facultyScopedStudents, facultyTodayWorkEntries, selectedCourse, todayWorkEntriesByStudent])

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
  }, [facultyProgressComparisonNotifications])

  const facultyBatchRows = useMemo(() => {
    const facultyId = currentFacultyIdentity.facultyId
    const facultyNameValue = currentFacultyIdentity.facultyName
    const facultyEmailValue = currentFacultyIdentity.facultyEmail
    const summary = dashboardSummary || {}
    const getBatchStudentCount = (entry = {}) => {
      const normalizedBatchId = String(entry?.id || entry?.batchId || '').trim().toLowerCase()
      const normalizedBatchGroupId = String(entry?.batchGroupId || '').trim().toLowerCase()
      const normalizedBatchName = String(entry?.batchName || entry?.batch || entry?.code || '').trim().toLowerCase()
      const normalizedBatchTiming = String(entry?.batchTiming || entry?.timing || '').trim().toLowerCase()

      const matchedStudents = facultyScopedStudents.filter((student) => {
        const context = resolveFacultyBatchContextForStudent(student, facultyBackfillRecords)
        const resolvedBatch = context?.batchEntry || null

        const studentBatchId = String(student?.batchId || student?.batchEntryId || '').trim().toLowerCase()
        const studentBatchGroupId = String(student?.batchGroupId || '').trim().toLowerCase()
        const studentBatchName = String(student?.batchName || student?.batch || '').trim().toLowerCase()
        const studentBatchTiming = String(student?.batchTiming || student?.batchTime || '').trim().toLowerCase()
        const resolvedBatchId = String(resolvedBatch?.id || '').trim().toLowerCase()
        const resolvedBatchGroupId = String(resolvedBatch?.batchGroupId || '').trim().toLowerCase()
        const resolvedBatchName = String(resolvedBatch?.batchName || resolvedBatch?.batch || '').trim().toLowerCase()
        const resolvedBatchTiming = String(resolvedBatch?.batchTiming || '').trim().toLowerCase()

        if (normalizedBatchId) {
          return (
            (studentBatchId && studentBatchId === normalizedBatchId) ||
            (resolvedBatchId && resolvedBatchId === normalizedBatchId) ||
            (studentBatchGroupId && studentBatchGroupId === normalizedBatchId) ||
            (resolvedBatchGroupId && resolvedBatchGroupId === normalizedBatchId)
          )
        }

        if (normalizedBatchGroupId) {
          return (
            (studentBatchGroupId && studentBatchGroupId === normalizedBatchGroupId) ||
            (resolvedBatchGroupId && resolvedBatchGroupId === normalizedBatchGroupId) ||
            (resolvedBatchId && resolvedBatchId === normalizedBatchGroupId)
          )
        }

        if (normalizedBatchName || normalizedBatchTiming) {
          const batchNameMatches =
            normalizedBatchName &&
            (
              studentBatchName === normalizedBatchName ||
              resolvedBatchName === normalizedBatchName
            )

          const batchTimingMatches =
            normalizedBatchTiming &&
            (
              studentBatchTiming === normalizedBatchTiming ||
              resolvedBatchTiming === normalizedBatchTiming
            )

          return batchNameMatches || batchTimingMatches
        }

        return false
      })

      return dedupeStudentsByIdentity(matchedStudents).length
    }
    const assignedCourseOrder = new Map(
      assignedCourses.map((course, index) => [
        normalizeCourseKey(course?.name || course?.courseName || ''),
        index,
      ]),
    )
    const rawEntries = [
      ...(Array.isArray(facultyProfile?.batchEntries) ? facultyProfile.batchEntries : []),
      ...(Array.isArray(summary?.batchEntries) ? summary.batchEntries : []),
    ]

    const uniqueEntries = Array.from(
      rawEntries.reduce((map, entry) => {
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
          id: String(entry?.id || `${entry?.courseId || 'course'}-${entry?.batchName || entry?.batch || 'batch'}`).trim(),
          courseId: String(entry?.courseId || '').trim(),
          course: String(entry?.courseName || entry?.course || '-').trim() || '-',
          batchId: String(entry?.batchId || entry?.batchEntryId || entry?.id || '').trim(),
          batchName: String(entry?.batchName || entry?.batch || entry?.code || entry?.id || '').trim() || '-',
          code: String(entry?.batchCode || entry?.code || entry?.id || '-').trim() || '-',
          timing: String(entry?.batchTiming || entry?.timing || '-').trim() || '-',
          students: getBatchStudentCount(entry),
          status: String(entry?.status || 'Active').trim() || 'Active',
        }
      })

    if (matchedEntries.length) {
      return matchedEntries
    }

    const groups = new Map()
    facultyScopedStudents.forEach((student) => {
      const batchId = String(student.batchId || student.batchEntryId || '').trim()
      const batchName = String(student.batchName || student.batch || '').trim()
      const courseId = String(student.courseId || '').trim()
      const courseName = String(student.courseInterested || student.courseName || student.course?.name || '-').trim() || '-'
      const batchTiming = String(student.batchTiming || student.batchTime || '-').trim() || '-'
      const key = batchId || `${courseId}-${batchName}-${batchTiming}` || courseName

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          courseId,
          course: courseName,
          batchId: batchId || key,
          batchName,
          code: batchName || batchId || '-',
          timing: batchTiming,
          students: [],
        })
      }

      groups.get(key).students.push(student)
    })

    return Array.from(groups.values()).map((entry) => ({
      ...entry,
      status: 'Active',
      students: getBatchStudentCount(entry),
    }))
  }, [backfilledStudents, currentFacultyIdentity.facultyEmail, currentFacultyIdentity.facultyId, currentFacultyIdentity.facultyName, facultyProfile?.batchEntries, dashboardSummary, facultyScopedStudents])

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

    return facultyCourseRows.find((course) => getFacultyFlowCourseKey(course) === normalizedCourseId) || null
  }, [facultyCourseRows, selectedStudentsCourseId])

  const selectedStudentsCourseBatches = useMemo(() => {
    if (!selectedStudentsCourse) return []

    return facultyBatchRows.filter((batch) => doesFacultyBatchBelongToCourse(batch, selectedStudentsCourse))
  }, [facultyBatchRows, selectedStudentsCourse])

  const selectedStudentsBatch = useMemo(() => {
    const normalizedBatchId = String(selectedStudentsBatchId || '').trim()
    if (!normalizedBatchId) return null

    return selectedStudentsCourseBatches.find((batch) => getFacultyFlowBatchKey(batch) === normalizedBatchId) || null
  }, [selectedStudentsBatchId, selectedStudentsCourseBatches])

  const selectedBatchStudents = useMemo(() => {
    if (!selectedStudentsBatch) return []

    const selectedCourseId = String(selectedStudentsBatch.courseId || selectedStudentsCourse?.id || '').trim().toLowerCase()
    const selectedCourseName = normalizeCourseKey(selectedStudentsCourse?.name || selectedStudentsCourse?.courseName || selectedStudentsBatch.course || '')
    const selectedBatchName = normalizeCourseKey(selectedStudentsBatch.batchName || selectedStudentsBatch.code || '')
    const selectedBatchToken = selectedBatchName.replace(/\s+/g, ' ')
    const selectedBatchTiming = normalizeCourseKey(selectedStudentsBatch.timing || '')
    const selectedBatchId = String(selectedStudentsBatch.batchId || selectedStudentsBatch.id || '').trim().toLowerCase()
    const selectedBatchGroupId = String(selectedStudentsBatch.batchGroupId || '').trim().toLowerCase()

    const matchedStudents = facultyScopedStudents.filter((student) => {
      const context = resolveFacultyBatchContextForStudent(student, facultyBackfillRecords)
      const studentFacultyId = String(context?.facultyId || student?.facultyId || '').trim().toLowerCase()
      const studentFacultyName = normalizeCourseKey(context?.facultyName || student?.facultyName || '')
      const studentCourseId = String(context?.courseId || student?.courseId || '').trim().toLowerCase()
      const studentCourseName = normalizeCourseKey(context?.courseName || student?.courseInterested || student?.courseName || student?.course?.name || '')
      const studentBatchId = String(context?.batchId || student?.batchId || student?.batchEntryId || '').trim().toLowerCase()
      const studentBatchGroupId = String(context?.batchGroupId || student?.batchGroupId || '').trim().toLowerCase()
      const studentBatchName = normalizeCourseKey(context?.batchName || student?.batchName || student?.batch || '')
      const studentBatchToken = studentBatchName.replace(/\s+/g, ' ')
      const studentBatchTiming = normalizeCourseKey(context?.batchTiming || student?.batchTiming || student?.batchTime || '')

      if (currentFacultyIdentity.facultyId && studentFacultyId && studentFacultyId !== String(currentFacultyIdentity.facultyId || '').trim().toLowerCase()) {
        return false
      }

      if (selectedCourseId && studentCourseId && studentCourseId !== selectedCourseId) {
        return false
      }

      if (selectedCourseName && studentCourseName && studentCourseName !== selectedCourseName) {
        return false
      }

      if (selectedBatchId && (studentBatchId || studentBatchGroupId)) {
        if (studentBatchId === selectedBatchId || studentBatchGroupId === selectedBatchId) return true
      }

      if (selectedBatchGroupId && (studentBatchId || studentBatchGroupId)) {
        if (studentBatchId === selectedBatchGroupId || studentBatchGroupId === selectedBatchGroupId) return true
      }

      if (selectedBatchName) {
        const batchMatches =
          studentBatchName === selectedBatchName ||
          studentBatchToken === selectedBatchToken ||
          studentBatchToken === selectedBatchName ||
          studentBatchName === selectedBatchToken

        if (batchMatches) return true
      }

      if (selectedBatchTiming && studentBatchTiming) {
        if (studentBatchTiming === selectedBatchTiming) return true
      }

      return false
    })

    return dedupeStudentsByIdentity(matchedStudents)
  }, [
    currentFacultyIdentity.facultyId,
    currentFacultyIdentity.facultyName,
    facultyBackfillRecords,
    facultyScopedStudents,
    selectedStudentsBatch,
    selectedStudentsCourse?.name,
    selectedStudentsCourse?.courseName,
    selectedStudentsCourse?.id,
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
          batchGroupId: batch?.batchGroupId || student?.batchGroupId || '',
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
        if (!workEntry) return 0

        const progressSummary = buildFacultyTodayWorkProgressSummary(
          facultyTodayWorkEntries,
          selectedStudentsCourse,
          progressStudent,
        )
        const calculatedProgress = Number(progressSummary?.courseProgress)
        return Number.isFinite(calculatedProgress)
          ? Math.min(100, Math.max(0, calculatedProgress))
          : 0
      })
      const averageProgress = progressValues.length
        ? progressValues.reduce((total, value) => total + value, 0) / progressValues.length
        : 0

      progressByBatch.set(getFacultyFlowBatchKey(batch), Math.round(averageProgress))
    })

    return progressByBatch
  }, [
    facultyBackfillRecords,
    facultyScopedStudents,
    facultyTodayWorkEntries,
    selectedStudentsCourse,
    selectedStudentsCourseBatches,
  ])

  const studentsFlowVisibleStudents = selectedStudentsBatch ? selectedBatchStudents : facultyScopedStudents
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
      !facultyCourseRows.some((course) => getFacultyFlowCourseKey(course) === String(selectedStudentsCourseId || '').trim())
    ) {
      setSelectedStudentsCourseId('')
      setSelectedStudentsBatchId('')
    }
  }, [facultyCourseRows, selectedStudentsCourseId])

  useEffect(() => {
    if (
      selectedStudentsBatchId &&
      !selectedStudentsCourseBatches.some((batch) => getFacultyFlowBatchKey(batch) === String(selectedStudentsBatchId || '').trim())
    ) {
      setSelectedStudentsBatchId('')
    }
  }, [selectedStudentsBatchId, selectedStudentsCourseBatches])

  const studentsPerPage = 5
  const studentsTotalPages = Math.max(1, Math.ceil(studentsFlowVisibleStudents.length / studentsPerPage))
  const safeStudentsPage = Math.min(Math.max(1, studentsPage), studentsTotalPages)
  const paginatedFacultyStudents = useMemo(() => {
    const startIndex = (safeStudentsPage - 1) * studentsPerPage
    return studentsFlowVisibleStudents.slice(startIndex, startIndex + studentsPerPage)
  }, [safeStudentsPage, studentsFlowVisibleStudents])

  useEffect(() => {
    setStudentsPage((current) => Math.min(Math.max(1, current), studentsTotalPages))
  }, [studentsTotalPages])

  useEffect(() => {
    setStudentsPage(1)
  }, [selectedStudentsBatchId, selectedStudentsCourseId])

  const batchesPerPage = 5
  const totalBatchPages = Math.max(1, Math.ceil(facultyBatchRows.length / batchesPerPage))
  const safeBatchPage = Math.min(Math.max(1, Number(batchPage) || 1), totalBatchPages)
  const paginatedFacultyBatchRows = useMemo(() => {
    const startIndex = (safeBatchPage - 1) * batchesPerPage
    return facultyBatchRows.slice(startIndex, startIndex + batchesPerPage)
  }, [facultyBatchRows, safeBatchPage])

  useEffect(() => {
    setBatchPage((current) => Math.min(Math.max(1, current), totalBatchPages))
  }, [totalBatchPages])

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
      .filter((submoduleId) => submoduleId && !todayWorkCompletedSubmoduleIds.includes(submoduleId))
  }, [todayWorkCompletedSubmoduleIds, todayWorkSelectedModule?.id, todayWorkSelectedModuleSubmodules])

  const todayWorkSelectedStudents = useMemo(() => {
    const selectedIds = new Set(
      (Array.isArray(todayWorkForm.selectedStudentIds) ? todayWorkForm.selectedStudentIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    )

    return studentsFlowVisibleStudents.filter((student) => {
      const studentId = String(student?.id || student?.studentId || '').trim()
      return selectedIds.has(studentId)
    })
  }, [studentsFlowVisibleStudents, todayWorkForm.selectedStudentIds])

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

  const openTodayWorkModal = () => {
    const activeTodayWorkCourse = todayWorkCourse || null
    const nextSelection = getNextPendingTodayWorkSelection(
      activeTodayWorkCourse || {},
      facultyTodayWorkEntries,
      currentFacultyIdentity,
      selectedStudentsBatch,
    )
    const firstModule = nextSelection.module || todayWorkCourseModules[0] || null
    const firstModuleId = String(nextSelection.moduleId || firstModule?.id || '').trim()

    setTodayWorkForm({
      applyToAllStudents: true,
      moduleId: firstModuleId,
      submoduleIds: Array.isArray(nextSelection.submoduleIds) ? nextSelection.submoduleIds : [],
      selectedStudentIds: studentsFlowVisibleStudents
        .map((student) => String(student?.id || student?.studentId || '').trim())
        .filter(Boolean),
    })
    setTodayWorkError('')
    setIsTodayWorkModalOpen(true)
  }

  const closeTodayWorkModal = () => {
    setIsTodayWorkModalOpen(false)
    setTodayWorkError('')
    setIsTodayWorkSaving(false)
    setIsTodayWorkConfirmOpen(false)
    setPendingTodayWorkSubmission(null)
  }

  const openStudentViewDrawer = (student) => {
    if (!student) return
    setViewStudentDrawer(buildFacultyStudentViewRecord(student, facultyBackfillRecords))
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
      submoduleIds: pendingSubmoduleIds.length ? [pendingSubmoduleIds[0]] : [],
    }))
  }

  const toggleTodayWorkSubmodule = (submoduleId) => {
    const normalizedSubmoduleId = String(submoduleId || '').trim()
    if (!normalizedSubmoduleId) return

    setTodayWorkForm((current) => {
      const currentIds = Array.isArray(current.submoduleIds) ? current.submoduleIds : []
      const hasSubmodule = currentIds.includes(normalizedSubmoduleId)
      return {
        ...current,
        submoduleIds: hasSubmodule
          ? currentIds.filter((id) => id !== normalizedSubmoduleId)
          : [...currentIds, normalizedSubmoduleId],
      }
    })
  }

  const selectAllTodayWorkSubmodules = () => {
    setTodayWorkForm((current) => ({
      ...current,
      submoduleIds: todayWorkPendingSubmoduleIds,
    }))
  }

  const clearAllTodayWorkSubmodules = () => {
    setTodayWorkForm((current) => ({
      ...current,
      submoduleIds: [],
    }))
  }

  const toggleTodayWorkStudent = (studentId) => {
    const normalizedStudentId = String(studentId || '').trim()
    if (!normalizedStudentId) return

    setTodayWorkForm((current) => {
      const currentIds = Array.isArray(current.selectedStudentIds) ? current.selectedStudentIds : []
      const hasStudent = currentIds.includes(normalizedStudentId)
      return {
        ...current,
        selectedStudentIds: hasStudent
          ? currentIds.filter((id) => id !== normalizedStudentId)
          : [...currentIds, normalizedStudentId],
      }
    })
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

    if (!todayWorkForm.applyToAllStudents && !selectedStudents.length) {
      setTodayWorkError('Please select at least one student.')
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
      const savedEntry = await saveFacultyTodayWorkEntry({
        facultyId: currentFacultyIdentity.facultyId,
        facultyProfileId: currentFacultyIdentity.facultyId,
        facultyName: currentFacultyIdentity.facultyName,
        facultyEmail: currentFacultyIdentity.facultyEmail,
        branchId: currentFacultyIdentity.branchId,
        courseId: String(todayWorkCourse.id || '').trim(),
        courseName: String(todayWorkCourse.name || todayWorkCourse.courseName || '').trim(),
        batchId: String(selectedStudentsBatch?.batchId || selectedStudentsBatch?.batchEntryId || '').trim(),
        batchGroupId: String(selectedStudentsBatch?.batchGroupId || '').trim(),
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
          }
        }),
      })

      const nextWorkEntries = [...facultyTodayWorkEntries, savedEntry].filter(Boolean)
      setTodayWorkEntries(nextWorkEntries)
      const progressUpdates = selectedStudents
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
      const payload = {
        branchCourseId: selectedCourse.id,
        modules: normalizedModules,
        courseModels: normalizedModules,
        models: normalizedModules,
      }
      const changeSummary = summarizeFacultyEditChanges(selectedCourseModules, normalizedModules, facultyDetails?.name || facultyDetails?.facultyName || 'Faculty', selectedCourse?.name || selectedCourse?.courseName || 'Course')
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

      addNotification({
        kind: 'branch-course-edit-updated',
        tone: 'amber',
        title: `${selectedCourse?.name || selectedCourse?.courseName || 'Course'} updated`,
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
      })

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
    { label: 'Assigned Courses', value: String(new Set(assignedCourseIds).size || assignedCourses.length || dashboardSummary?.courseIds?.length || 0), note: 'Active courses' },
    { label: 'Total Batches', value: dashboardSummary?.totalBatches ?? '—', note: 'Across all Courses' },
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

  const renderSidebar = () => (
    <aside className="super-admin-sidebar" aria-label="Faculty navigation">
      <div className="super-admin-sidebar-brand">
        <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="CISPRO logo" />
      </div>

      <nav className="super-admin-sidebar-nav">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'my-courses', label: 'My Courses', icon: BookOpen },
          { id: 'my-batches', label: 'My Batches', icon: Layers3 },
          { id: 'students', label: 'Students', icon: Users },
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
              onClick={() => setActiveSection(item.id)}
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
        <h2 className="super-admin-topbar-title" style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: 600 }}>Faculty Dashboard</h2>
      </div>
      <div className="super-admin-topbar-right">
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

  return (
    <section className="super-admin-page">
      <div className="super-admin-shell">
        {renderSidebar()}

        <div className="super-admin-main">
          {renderTopbar()}

          <main className="super-admin-content">
            <div className="branch-dashboard-content">
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

              {activeSection === 'dashboard' ? (
                <>
                  <div className="branch-dashboard-overview-intro">
                    <p style={{ marginTop: '12px' }}>Welcome back, {facultyName}! Here&apos;s an overview of your active courses, batches, and student attendance metrics.</p>
                  </div>

                  <div className="branch-dashboard-stats">
                    {stats.map((stat) => (
                      <article key={stat.label} className="branch-dashboard-stat-card">
                        <span>{stat.label}</span>
                        <strong style={{ fontSize: '18px' }}>{stat.value}</strong>
                        <small>{stat.note}</small>
                      </article>
                    ))}
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
                  <div className="branch-dashboard-table-shell">
                    <table className="branch-dashboard-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>S.No</th>
                          <th>Course Name</th>
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
                              <td><strong className="text-slate-800">{batch.course}</strong></td>
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
                            <td colSpan={5}>
                              <div className="faculty-my-batches-empty" style={{ padding: '20px 0' }}>
                                <strong>No batches mapped yet</strong>
                                <p>When the branch assigns students to your faculty, the matching batches will appear here automatically.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {facultyBatchRows.length > batchesPerPage ? (
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

              {activeSection === 'students' ? (
                <FacultyDashboardSection
                  title={facultyViewLabel}
                  actions={studentsFlowLevel === 3 ? (
                    <button
                      type="button"
                      className="faculty-today-work-trigger"
                      onClick={openTodayWorkModal}
                    >
                      <BookOpen size={16} />
                      <span>Add Today&apos;s Work</span>
                    </button>
                  ) : null}
                >
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
                        }}
                      >
                        <ArrowLeft size={16} />
                        <span>Back to Courses</span>
                      </button>

                      <div className="faculty-students-flow-context">
                        <strong>{selectedStudentsCourse?.name || selectedStudentsCourse?.courseName || 'Course'}</strong>
                        <span>{selectedStudentsCourse?.courseCode || selectedStudentsCourse?.id || '-'}</span>
                      </div>

                      {selectedStudentsCourseBatches.length ? (
                        <div className="branch-dashboard-table-shell faculty-students-table-shell faculty-students-flow-shell faculty-students-batches-shell">
                          <table className="branch-dashboard-table">
                            <thead>
                              <tr>
                                <th style={{ width: '72px' }}>S.No</th>
                                <th>Batch Name</th>
                                <th>Students</th>
                                {/* <th>Module Percentage</th> */}
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedStudentsCourseBatches.map((batch, index) => {
                                // const batchProgress = selectedCourseBatchProgress.get(getFacultyFlowBatchKey(batch)) || 0

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
                                  <td>{index + 1}</td>
                                  <td><strong>{batch.batchName || batch.code || batch.timing || '-'}</strong></td>
                                  <td>{batch.students}</td>
                                  {/*
                                  <td>
                                    <div className="faculty-batch-progress-cell">
                                      <div className="faculty-batch-progress-bar" aria-hidden="true">
                                        <span style={{ width: `${batchProgress}%` }} />
                                      </div>
                                      <strong>{batchProgress}% Complete</strong>
                                    </div>
                                  </td>
                                  */}
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
                        </div>
                      ) : (
                        <div className="faculty-my-batches-empty faculty-students-flow-empty">
                          <strong>No batches found</strong>
                          <p>This course does not have any mapped batches yet.</p>
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
                        <table className="branch-dashboard-table">
                          <thead>
                            <tr>
                              <th style={{ width: '64px' }}>S.No</th>
                              <th>Student ID</th>
                              <th>Student Name</th>
                              <th>Email Address</th>
                              <th>Paid</th>
                              {/* <th>Module Progress</th> */}
                              <th>Course Progress</th>
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
                                const paymentProgress = getStudentPaymentProgress(student)
                                const paidAmountLabel = formatCourseAmount(paymentProgress.paidAmount)
                                const studentKey = normalizeWorkStudentId(student.id || student.studentId || '')
                                const workEntry = todayWorkEntriesByStudent.get(studentKey) || null
                                const workCourse = workEntry
                                  ? courseCatalog.find((course) => String(course?.id || '').trim() === String(workEntry.courseId || '').trim()) || selectedCourse || null
                                  : null
                                const workProgressSummary = workEntry
                                  ? buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, workCourse || {}, student)
                                  : null
                                const workProgress = workProgressSummary
                                  ? {
                                      ...getFacultyWorkProgressForEntry(
                                        workProgressSummary.entry || workEntry,
                                        workCourse || {},
                                        Array.isArray(workProgressSummary.selectedSubmoduleIds)
                                          ? workProgressSummary.selectedSubmoduleIds
                                          : [],
                                      ),
                                      courseProgress: workProgressSummary.courseProgress,
                                      moduleProgress: workProgressSummary.moduleProgress,
                                    }
                                  : null
                                // const workModuleProgressLabel = workProgressSummary
                                //   ? `${getCourseModuleName(workProgressSummary.moduleSummary?.module || workProgress?.module || {})} - ${Math.round(workProgress.moduleProgress)}% Complete`
                                //   : '-'
                                const workCourseProgress = Number.isFinite(Number(workProgress?.courseProgress))
                                  ? Math.min(100, Math.max(0, Number(workProgress.courseProgress)))
                                  : 0
                                const workCourseProgressLabel = `${Math.round(workCourseProgress)}% Complete`

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
                                            {formatPaymentPercentage(paymentProgress.paidInstallmentPercentage)}% Paid
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
                                    <td>
                                      <button
                                        type="button"
                                        className="faculty-students-flow-action-btn is-primary"
                                        onClick={() => openStudentViewDrawer(student)}
                                      >
                                        View
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })
                            ) : (
                              <tr>
                                <td className="faculty-students-empty-cell" colSpan={8}>
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
                            <span>Qualification</span>
                            <strong>{viewStudentDrawer.qualification || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Designation</span>
                            <strong>{viewStudentDrawer.designation || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Course Name</span>
                            <strong>{viewStudentDrawer.courseName || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Faculty Name</span>
                            <strong>{viewStudentDrawer.facultyName || '-'}</strong>
                          </div>
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

                        <div className="student-detail-grid">
                          <div className="student-detail-item">
                            <span>Batch Name</span>
                            <strong>{viewStudentDrawer.batchName || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Batch Timing</span>
                            <strong>{viewStudentDrawer.batchTiming || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Class Schedule</span>
                            <strong>{viewStudentDrawer.classSchedule || '-'}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span>Course Start Date</span>
                            <strong>
                              {viewStudentDrawer.courseStartDate
                                ? formatStudentDate(viewStudentDrawer.courseStartDate)
                                : '-'}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              ) : null}

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
                <FacultyDashboardSection title="Faculty Profile" description="Your dynamic workspace details loaded directly from branch registry.">
                  <div className="faculty-profile-details-card bg-white rounded-2xl border border-slate-200 p-6 max-w-3xl shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-sky-100 text-sky-700 font-bold text-2xl flex items-center justify-center border border-sky-200">
                        {initials}
                      </div>
                      <div>
                        <h2 className="text-[1.35rem] font-bold text-slate-900">{facultyName}</h2>
                        <p className="text-slate-500 text-sm flex items-center gap-1.5 mt-0.5">
                          <UserRound size={14} /> Faculty Instructor
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                      <div className="border-b border-slate-100 pb-3">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Faculty ID</span>
                        <strong className="text-slate-800 text-[1rem]">{facultyDetails.id}</strong>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Contact Number</span>
                        <strong className="text-slate-800 text-[1rem] flex items-center gap-1">
                          <Phone size={14} className="text-slate-400" /> {facultyDetails.phone}
                        </strong>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Email Address</span>
                        <strong className="text-slate-800 text-[1rem] flex items-center gap-1">
                          <Mail size={14} className="text-slate-400" /> {facultyDetails.email}
                        </strong>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Account Status</span>
                        <strong className="text-slate-800 text-[1rem] flex items-center">
                          <span className={`branch-course-status-pill ${String(facultyDetails.status).toLowerCase()}`}>
                            {facultyDetails.status}
                          </span>
                        </strong>
                      </div>
                      <div className="border-b border-slate-100 pb-3 md:col-span-2">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Location</span>
                        <strong className="text-slate-800 text-[1rem] flex items-center gap-1">
                          <MapPin size={14} className="text-slate-400" /> {facultyDetails.city}, {facultyDetails.state}, {facultyDetails.country}
                        </strong>
                      </div>
                      <div className="md:col-span-2 pb-1">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Residential Address</span>
                        <strong className="text-slate-800 text-[1rem] block font-normal leading-relaxed text-slate-600">
                          {facultyDetails.address}
                        </strong>
                      </div>
                    </div>
                  </div>
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
                  <h3 id="faculty-today-work-title">Add Today&apos;s Work</h3>
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
              <label className="faculty-today-work-toggle">
                <input
                  type="checkbox"
                  checked={todayWorkForm.applyToAllStudents}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setTodayWorkForm((current) => ({
                      ...current,
                      applyToAllStudents: checked,
                      selectedStudentIds: checked
                        ? (Array.isArray(current.selectedStudentIds) && current.selectedStudentIds.length
                          ? current.selectedStudentIds
                          : studentsFlowVisibleStudents.map((student) => String(student?.id || student?.studentId || '').trim()).filter(Boolean))
                        : (Array.isArray(current.selectedStudentIds) && current.selectedStudentIds.length
                          ? current.selectedStudentIds
                          : studentsFlowVisibleStudents.map((student) => String(student?.id || student?.studentId || '').trim()).filter(Boolean)),
                    }))
                  }}
                />
                <div>
                  <strong>Update All Students</strong>
                  <span>Selected work will be applied to the students currently visible in this flow.</span>
                </div>
              </label>

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
                    disabled={!todayWorkCourseModules.length}
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

              <section className="faculty-today-work-panel">
                <div className="faculty-today-work-panel-heading">
                  <div>
                    <h4>Sub-modules</h4>
                    <p>{getTodayWorkModuleLabel(todayWorkSelectedModule || {}, 0)}</p>
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
                    disabled={!todayWorkPendingSubmoduleIds.length}
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
                        const isCompleted = todayWorkCompletedSubmoduleIds.includes(submoduleId)
                        const checked = isCompleted || todayWorkForm.submoduleIds.includes(submoduleId)

                        return (
                          <label
                            key={submoduleId || subIndex}
                            className={`faculty-today-work-submodule-item${checked ? ' is-selected' : ''}${isCompleted ? ' is-completed' : ''}`.trim()}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isCompleted}
                              onChange={() => {
                                if (!isCompleted) {
                                  toggleTodayWorkSubmodule(submoduleId)
                                }
                              }}
                            />
                            <span className="faculty-today-work-submodule-check" aria-hidden="true">
                              ✓
                            </span>
                            <div className="faculty-today-work-submodule-copy">
                              <strong>{getCourseSubmoduleName(submodule, subIndex)}</strong>
                              {isCompleted ? (
                                <span className="faculty-today-work-submodule-status faculty-today-work-submodule-status--completed">
                                  Completed
                                </span>
                              ) : (
                                <span className="faculty-today-work-submodule-status faculty-today-work-submodule-status--pending">
                                  Pending
                                </span>
                              )}
                            </div>
                          </label>
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

              {!todayWorkForm.applyToAllStudents ? (
                <section className="faculty-today-work-panel">
                  <div className="faculty-today-work-panel-heading">
                    <div>
                      <h4>Select Students</h4>
                      <p>Choose the learners who should receive this work.</p>
                    </div>
                    <span className="faculty-today-work-panel-chip">
                      {todayWorkSelectedStudents.length} selected
                    </span>
                  </div>

                  {studentsFlowVisibleStudents.length ? (
                    <div className="faculty-today-work-student-list">
                      {studentsFlowVisibleStudents.map((student, index) => {
                        const studentId = String(student?.id || student?.studentId || '').trim()
                        const studentName = String(student?.studentName || student?.name || `Student ${index + 1}`).trim()
                        const studentEmail = String(student?.emailAddress || student?.email || '-').trim()
                        const checked = todayWorkForm.selectedStudentIds.includes(studentId)

                        return (
                          <label key={studentId || `${studentName}-${index}`} className={`faculty-today-work-student-item${checked ? ' is-selected' : ''}`.trim()}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTodayWorkStudent(studentId)}
                            />
                            <div className="faculty-avatar">
                              {getInitials(studentName)}
                            </div>
                            <div className="faculty-today-work-student-copy">
                              <strong>{studentName}</strong>
                              <span>{studentEmail}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="faculty-today-work-empty">
                      No students found for the selected batch yet.
                    </div>
                  )}
                </section>
              ) : (
                <div className="faculty-today-work-all-note">
                  This work will be applied to all {studentsFlowVisibleStudents.length} student{studentsFlowVisibleStudents.length === 1 ? '' : 's'} currently visible in this batch.
                </div>
              )}

              {todayWorkError ? <div className="faculty-today-work-status">{todayWorkError}</div> : null}

              <div className="faculty-today-work-actions">
                <button type="button" className="faculty-today-work-cancel" onClick={closeTodayWorkModal}>
                  Cancel
                </button>
                <button type="submit" className="faculty-today-work-save" disabled={isTodayWorkSaving}>
                  {isTodayWorkSaving ? 'Saving...' : 'Save Work'}
                </button>
              </div>
            </form>
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
              <h3 id="faculty-today-work-confirm-title">Save today&apos;s work?</h3>
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
                {isTodayWorkSaving ? 'Saving...' : 'Save'}
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



