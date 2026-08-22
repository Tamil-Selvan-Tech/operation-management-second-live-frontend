import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
} from 'lucide-react'
import {
  FACULTY_BATCH_ATTENDANCE_SYNC_EVENT,
  getAttendanceDateKey,
  loadFacultyBatchAttendanceState,
  loadFacultyAttendanceState,
  resolveBatchAttendanceWindow,
  resolveTodayFacultyAttendanceStatus,
  normalizeAttendanceSessions,
  formatAttendanceTimeLabel,
  saveFacultyBatchAttendanceState,
} from '../lib/facultyAttendanceStore'
import { enrichStudentsWithFacultyReferences, getFacultyBatchEntriesForCourse, getFacultyBatchStudentRecords, getFacultyCourseIds, getFacultyCourses, getMatchingStudents, getUniqueStudentCountForFacultyRecords, getUniqueStudentCountForFacultyScope, sortByNameThenTiming } from '../lib/facultyFlow'
import { markFacultyStudentAttendance } from '../services/attendanceService'
import { getFacultyMyBatchesSummary } from '../services/dashboardService'
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
import { saveBranchCourseSnapshot } from '../lib/branchCourseSnapshot'
import {
} from '../lib/courseEditRequestStore'
import { Button } from '../components/Button'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/BranchDashboardPage.css'
import '../styles/FacultyDashboardPage.css'

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

function getCourseFromSource(source = {}) {
  if (!source) return null

  const course = source.course || source
  const courseId = String(course?.id || source?.courseId || '').trim()
  const courseName = String(course?.name || course?.courseName || source?.courseName || '').trim()

  if (!courseId && !courseName) return null

  return {
    ...course,
    id: courseId || courseName,
    courseId: courseId || source?.courseId || '',
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

function summarizeFacultyEditChanges(modules = []) {
  const moduleCount = Array.isArray(modules) ? modules.length : 0
  const submoduleCount = Array.isArray(modules)
    ? modules.reduce((count, module) => count + (Array.isArray(module?.submodules) ? module.submodules.length : 0), 0)
    : 0

  return `${moduleCount} module${moduleCount === 1 ? '' : 's'} and ${submoduleCount} submodule${submoduleCount === 1 ? '' : 's'} updated`
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

function getFacultyNotificationIcon(kind) {
  const normalizedKind = String(kind || '').trim().toLowerCase()

  if (normalizedKind.includes('invite') || normalizedKind.includes('mail')) {
    return Mail
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

  return {
    id: String(source.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    kind,
    tone:
      String(source.tone || (kind.includes('invite') ? 'amber' : kind.includes('login') ? 'green' : isCourseEdit ? 'amber' : 'blue'))
        .trim() || 'blue',
    title: String(source.title || 'Notification').trim(),
    message: String(source.message || '').trim(),
    actionLabel: String(source.actionLabel || '').trim() || 'View',
    categoryLabel: String(source.categoryLabel || (isCourseEdit ? 'Course Edit' : 'Faculty')).trim() || 'Faculty',
    createdAt,
    time: formatNotificationTime(createdAt),
    read: Boolean(source.read),
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
          const Icon = getFacultyNotificationIcon(notification.kind)

          return (
            <article
              key={notification.id}
              className={`faculty-notification-card ${notification.read ? 'is-read' : 'is-unread'}`.trim()}
            >
              <span className={`faculty-notification-icon tone-${notification.tone}`} aria-hidden="true">
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              </span>

              <div className="faculty-notification-copy">
                <div className="faculty-notification-title-row">
                  <h3>{notification.title}</h3>
                  <small>{notification.time}</small>
                </div>
                <p>{notification.message}</p>
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

function FacultyDashboardSection({ title, description, children }) {
  return (
    <section className="branch-dashboard-section">
      <div className="branch-dashboard-section-heading">
        <div className="branch-dashboard-section-heading-copy">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

export function FacultyDashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
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
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [facultyProfile, setFacultyProfile] = useState(null)
  const [branchCourses, setBranchCourses] = useState([])
  const [courseCatalog, setCourseCatalog] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [expandedCourseModuleIds, setExpandedCourseModuleIds] = useState([])
  const [courseEditRequests, setCourseEditRequests] = useState([])
  const [isCourseRequestModalOpen, setIsCourseRequestModalOpen] = useState(false)
  const [isCourseEditModalOpen, setIsCourseEditModalOpen] = useState(false)
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
  const [courseEditError, setCourseEditError] = useState('')
  const [courseActionSuccess, setCourseActionSuccess] = useState('')
  const [isCourseRequestSaving, setIsCourseRequestSaving] = useState(false)
  const [isCourseEditSaving, setIsCourseEditSaving] = useState(false)
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [coursesError, setCoursesError] = useState('')
  const courseActionSuccessTimerRef = useRef(null)

  useEffect(() => {
    if (!courseActionSuccess) return undefined

    if (courseActionSuccessTimerRef.current) {
      window.clearTimeout(courseActionSuccessTimerRef.current)
    }

    courseActionSuccessTimerRef.current = window.setTimeout(() => {
      setCourseActionSuccess('')
      courseActionSuccessTimerRef.current = null
    }, 3500)

    return () => {
      if (courseActionSuccessTimerRef.current) {
        window.clearTimeout(courseActionSuccessTimerRef.current)
        courseActionSuccessTimerRef.current = null
      }
    }
  }, [courseActionSuccess])



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
        const [profileResult, masterCoursesResult, branchCoursesResult] = await Promise.allSettled([
          getCurrentFacultyProfile(),
          listCourses({ page: 1, limit: 100 }),
          listBranchCourses({ page: 1, limit: 100 }),
        ])

        if (!isMounted) return

        const profileData = profileResult.status === 'fulfilled' ? profileResult.value || null : null

        if (profileResult.status === 'fulfilled') {
          setFacultyProfile(profileData)
        }

        const masterCourses =
          masterCoursesResult.status === 'fulfilled' && Array.isArray(masterCoursesResult.value?.data)
            ? masterCoursesResult.value.data
            : []
        const branchCourseList =
          branchCoursesResult.status === 'fulfilled' && Array.isArray(branchCoursesResult.value?.data)
            ? branchCoursesResult.value.data
            : []

        setBranchCourses(branchCourseList)

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

    return () => {
      isMounted = false
    }
  }, [])

  // Close notification dropdown when clicking outside
useEffect(() => {
  const handleOutsideNotificationClick = (event) => {
    if (
      notificationRef.current &&
      !notificationRef.current.contains(event.target)
    ) {
      setNotificationOpen(false)
    }
  }

  if (notificationOpen) {
    document.addEventListener(
      'mousedown',
      handleOutsideNotificationClick,
    )
  }

  return () => {
    document.removeEventListener(
      'mousedown',
      handleOutsideNotificationClick,
    )
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

  const unreadNotifications = useMemo(
    () => facultyNotifications.filter((notification) => !notification.read),
    [facultyNotifications],
  )
  const unreadNotificationCount = unreadNotifications.length
  const normalizedNotifications = useMemo(
    () => facultyNotifications.map((notification) => normalizeFacultyNotification(notification)),
    [facultyNotifications],
  )
  const totalNotificationCount = normalizedNotifications.length

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
          const value = String(entry?.courseId ?? entry?.id ?? entry ?? '').trim()
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

    const matchedCourses = courseCatalog.filter((course) => {
      const courseId = String(course?.id || '').trim()
      const courseName = normalizeCourseKey(course?.name || course?.courseName || '')

      if (courseId && assignedCourseIds.includes(courseId)) {
        return true
      }

      return assignedCourseNames.some((name) => normalizeCourseKey(name) === courseName)
    })

    if (matchedCourses.length) {
      return matchedCourses
    }

    const fallbackName = assignedCourseNames[0]
    if (!fallbackName) return []

    return courseCatalog.filter((course) => normalizeCourseKey(course?.name || course?.courseName || '') === normalizeCourseKey(fallbackName))
  }, [assignedCourseIds, assignedCourseNames, courseCatalog])

  const activeCourseId = selectedCourseId || String(assignedCourses[0]?.id || '').trim()

  const selectedCourse = useMemo(() => {
    if (!assignedCourses.length) return null
    return assignedCourses.find((course) => String(course?.id || '').trim() === activeCourseId) || assignedCourses[0] || null
  }, [activeCourseId, assignedCourses])

  const selectedCourseModules = useMemo(() => getCourseModels(selectedCourse), [selectedCourse])
  const courseEditModules = Array.isArray(courseEditDraft?.modules) ? courseEditDraft.modules : []
  const courseEditActiveModule =
    courseEditModules[courseEditActiveModuleIndex] || courseEditModules[0] || null
  const courseEditActiveModuleSubmodules = Array.isArray(courseEditActiveModule?.submodules)
    ? courseEditActiveModule.submodules
    : []
  const selectedCourseModuleKeys = useMemo(
    () =>
      selectedCourseModules.map((module, index) =>
        String(module?.id || `${selectedCourse?.id || 'course'}-module-${index}`).trim(),
      ),
    [selectedCourse?.id, selectedCourseModules],
  )
  const isAllModulesExpanded =
    selectedCourseModuleKeys.length > 0 &&
    selectedCourseModuleKeys.every((moduleId) => expandedCourseModuleIds.includes(moduleId))

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

  const openCourseRequestModal = () => {
    setCourseActionSuccess('')
    setCourseRequestError('')
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

    setCourseActionSuccess('')
    setCourseEditError('')
    setCourseEditDraft({
      courseId: String(selectedCourse?.id || '').trim(),
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

    if (!selectedCourse?.id) {
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
        branchCourseId: selectedCourse.id,
        courseId: selectedCourse.id,
        courseCode: selectedCourse.courseCode || selectedCourse.id,
        courseName: selectedCourse.name || selectedCourse.courseName || 'Course',
        title: String(courseRequestForm.title || '').trim(),
        reason,
        description,
      })

      const createdRequest = response?.request || response || null
      if (createdRequest) {
        setCourseEditRequests((current) => [
          createdRequest,
          ...current.filter((request) => String(request.id || '').trim() !== String(createdRequest.id || '').trim()),
        ])
      }

      setCourseActionSuccess('Edit request sent successfully.')
      setIsCourseRequestModalOpen(false)
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

      if (response?.request) {
        setCourseEditRequests((current) =>
          current.map((request) =>
            String(request.id || '').trim() === String(response.request.id || '').trim()
              ? response.request
              : request,
          ),
        )
      }

      setCourseActionSuccess('Course modules saved successfully.')
      setIsCourseEditModalOpen(false)
      setCourseEditDraft(null)
    } catch (error) {
      console.error('Failed to save course edit changes', error)
      setCourseEditError('Unable to save changes right now.')
    } finally {
      setIsCourseEditSaving(false)
    }
  }

  const currentCourseEditRequest = (() => {
    const courseId = String(selectedCourse?.id || '').trim()
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
  const isCourseEditCompleted = courseEditStatus === 'completed'

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

  // Mock statistics for the faculty member
  const stats = [
    { label: 'Assigned Courses', value: dashboardSummary?.faculty?.courseName || '—', note: 'Active curriculum' },
    { label: 'Total Batches', value: dashboardSummary?.totalBatches ?? '—', note: 'Across all modes' },
    { label: 'Enrolled Learners', value: dashboardSummary?.totalStudents ?? '—', note: 'Active students' },
    { label: 'Attendance Rate', value: '96.4%', note: 'Past 30 days' },
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
            const unreadIds = facultyNotifications
              .filter((item) => !item.read)
              .map((item) => item.id)

            if (!unreadIds.length) return

            try {
              await markFacultyNotificationsAsRead(unreadIds)

              setFacultyNotifications((current) =>
                current.map((item) => ({
                  ...item,
                  read: true,
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
        unreadNotifications.slice(0, 5).map((notification) => (
          <button
            key={notification.id}
            type="button"
            className="notification-card is-unread"
            onClick={async () => {
              try {
                await markFacultyNotificationsAsRead([
                  notification.id,
                ])

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
                {notification.time || '3 days ago'}
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

                  <FacultyDashboardSection title="Today's Classes" description="Schedule of your batches for today.">
                    <div className="branch-dashboard-activity-grid">
                      <article className="branch-dashboard-panel">
                        <strong className="block text-slate-800 text-[1.1rem]">Batch F-01 (React Native)</strong>
                        <p className="text-slate-600 mt-1">Timing: 09:30 AM - 11:30 AM</p>
                        <span className="inline-block mt-3 px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700">Completed</span>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong className="block text-slate-800 text-[1.1rem]">Batch F-02 (Web Development)</strong>
                        <p className="text-slate-600 mt-1">Timing: 02:00 PM - 04:00 PM</p>
                        <span className="inline-block mt-3 px-2 py-0.5 text-xs font-semibold rounded bg-sky-100 text-sky-700">In Progress</span>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong className="block text-slate-800 text-[1.1rem]">Batch F-03 (UI/UX Design)</strong>
                        <p className="text-slate-600 mt-1">Timing: 05:00 PM - 07:00 PM</p>
                        <span className="inline-block mt-3 px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">Scheduled</span>
                      </article>
                    </div>
                  </FacultyDashboardSection>
                </>
              ) : null}

              {activeSection === 'my-courses' ? (
                <FacultyDashboardSection
                  title="Course"
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
                                onClick={() => setSelectedCourseId(String(course.id || '').trim())}
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
                        {courseActionSuccess ? (
                          <div className="faculty-course-action-success" role="status" aria-live="polite">
                            {courseActionSuccess}
                          </div>
                        ) : null}
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

                          {selectedCourseModules.length ? (
                            <div className="faculty-course-module-grid">
                              {selectedCourseModules.map((module, index) => {
                                const moduleKey = String(module?.id || `${selectedCourse?.id || 'course'}-module-${index}`).trim()
                                const isExpanded = expandedCourseModuleIds.includes(moduleKey)
                                const submodules = Array.isArray(module?.submodules) ? module.submodules : []

                                return (
                                  <article key={moduleKey} className={`faculty-course-module-card ${isExpanded ? 'is-expanded' : ''}`.trim()}>
                                    <button
                                      type="button"
                                      className="faculty-course-module-trigger"
                                      onClick={() => toggleCourseModule(moduleKey)}
                                    >
                                      <span className="faculty-course-module-index">{String(index + 1).padStart(2, '0')}</span>

                                      <span className="faculty-course-module-copy">
                                        <span className="faculty-course-section-kicker" style={{ marginBottom: 6 }}>
                                          MODULE
                                        </span>
                                        <strong>{module?.name || module?.title || `Module ${index + 1}`}</strong>
                                      </span>

                                      <span className="faculty-course-module-percent">
                                        {getModulePercentage(module, index, selectedCourseModules.length)}
                                      </span>

                                      <span className="faculty-course-module-chevron" aria-hidden="true">
                                        <ChevronDown size={18} strokeWidth={2.4} />
                                      </span>
                                    </button>

                                    {isExpanded ? (
                                      <div className="faculty-course-submodule-list">
                                        {submodules.length ? (
                                          submodules.map((submodule, subIndex) => (
                                            <div key={String(submodule?.id || `${moduleKey}-sub-${subIndex}`)} className="faculty-course-submodule-item">
                                              <div className="faculty-course-submodule-step">
                                                <span className="faculty-course-submodule-dot" aria-hidden="true" />
                                                <div className="faculty-course-submodule-copy">
                                                  <span>SUBMODULE {subIndex + 1}</span>
                                                  <strong>{submodule?.name || submodule?.title || `Submodule ${subIndex + 1}`}</strong>
                                                </div>
                                              </div>

                                              <strong className="faculty-course-submodule-percent">
                                                {getModulePercentage(submodule, subIndex, submodules.length)}
                                              </strong>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="faculty-course-submodule-empty">No submodules added</div>
                                        )}
                                      </div>
                                    ) : null}
                                  </article>
                                )
                              })}
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
                          <th>Batch Code</th>
                          <th>Timings</th>
                          <th>Total Students</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { course: 'React Native Development', code: 'RN-B3', timing: 'Mon, Wed, Fri | 09:30 AM', students: '24', status: 'Active' },
                          { course: 'Full-Stack Web Development', code: 'WD-B9', timing: 'Tue, Thu | 02:00 PM', students: '18', status: 'Active' },
                          { course: 'UI/UX Premium Design', code: 'UX-B2', timing: 'Saturday | 10:00 AM', students: '15', status: 'Active' },
                          { course: 'Advanced JavaScript Mastery', code: 'JS-B1', timing: 'Sunday | 11:30 AM', students: '28', status: 'Active' },
                        ].map((batch, index) => (
                          <tr key={batch.code}>
                            <td>{index + 1}</td>
                            <td><strong className="text-slate-800">{batch.course}</strong></td>
                            <td><strong style={{ color: '#0f172a' }}>{batch.code}</strong></td>
                            <td>{batch.timing}</td>
                            <td>{batch.students} students</td>
                            <td>
                              <span className="branch-course-status-pill active">
                                {batch.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </FacultyDashboardSection>
              ) : null}

              {activeSection === 'students' ? (
                <FacultyDashboardSection title="Enrolled Students" description="Learners enrolled in your courses across all active batches.">
                  <div className="branch-dashboard-table-shell">
                    <table className="branch-dashboard-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>S.No</th>
                          <th>Student Name</th>
                          <th>Batch</th>
                          <th>Course</th>
                          <th>Email Address</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'Ananya S', batch: 'RN-B3', course: 'React Native Development', email: 'ananya.s@gmail.com', status: 'Active' },
                          { name: 'Rahul P', batch: 'WD-B9', course: 'Full-Stack Web Development', email: 'rahul.p@gmail.com', status: 'Active' },
                          { name: 'Meena K', batch: 'RN-B3', course: 'React Native Development', email: 'meena.k@gmail.com', status: 'Active' },
                          { name: 'Arun V', batch: 'UX-B2', course: 'UI/UX Premium Design', email: 'arun.v@gmail.com', status: 'Active' },
                          { name: 'Sanjay Kumar', batch: 'JS-B1', course: 'Advanced JavaScript Mastery', email: 'sanjay.k@gmail.com', status: 'Active' },
                        ].map((student, index) => (
                          <tr key={student.name}>
                            <td>{index + 1}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="faculty-avatar">
                                  {String(student?.name || 'ST')
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .substring(0, 2)
                                    .toUpperCase()}
                                </div>
                                <strong className="branch-course-name">{student.name}</strong>
                              </div>
                            </td>
                            <td><strong>{student.batch}</strong></td>
                            <td>{student.course}</td>
                            <td>
                              <span className="faculty-info-link">
                                <Mail size={14} style={{ color: '#94a3b8' }} />
                                {student.email}
                              </span>
                            </td>
                            <td>
                              <span className="branch-course-status-pill active">
                                {student.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </FacultyDashboardSection>
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
                          const unreadIds = facultyNotifications
                            .filter((item) => !item.read)
                            .map((item) => item.id)

                          if (!unreadIds.length) return

                          try {
                            await markFacultyNotificationsAsRead(unreadIds)

                            setFacultyNotifications((current) =>
                              current.map((item) => ({
                                ...item,
                                read: true,
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
                      <Search size={20} strokeWidth={2.2} aria-hidden="true" focusable="false" />
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
                                await markFacultyNotificationsAsRead([notification.id])

                                setFacultyNotifications((current) =>
                                  current.map((item) =>
                                    item.id === notification.id
                                      ? {
                                          ...item,
                                          read: true,
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
              <p className="faculty-course-edit-subtitle">
                Course basic details are locked. You can only change modules and submodules here.
              </p>
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

                    <div className="faculty-course-edit-overview-body">
                      {courseEditModules.length ? (
                        courseEditModules.map((module, moduleIndex) => {
                          const submodules = Array.isArray(module.submodules) ? module.submodules : []
                          const moduleId = String(module.id || moduleIndex).trim()
                          const isExpanded = courseEditExpandedModuleIds.includes(moduleId)

                          return (
                            <article key={moduleId || moduleIndex} className="faculty-course-edit-overview-row">
                              <div className="faculty-course-edit-overview-main">
                                <div className="faculty-course-edit-overview-module">
                                  <span className="faculty-course-edit-overview-badge">
                                    {String(moduleIndex + 1).padStart(2, '0')}
                                  </span>
                                  <div>
                                    <span>MODULE {moduleIndex + 1}</span>
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
                                    onClick={() => toggleCourseEditExpandedModule(moduleId)}
                                    aria-label={isExpanded ? 'Collapse module' : 'Expand module'}
                                  >
                                    {isExpanded ? '⌃' : '⌄'}
                                  </button>
                                  <button
                                    type="button"
                                    className="faculty-course-edit-action-btn"
                                    onClick={() => openCourseEditModule(moduleIndex)}
                                    aria-label={`Edit module ${moduleIndex + 1}`}
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    className="faculty-course-edit-action-btn is-danger"
                                    onClick={() => openCourseEditDeleteConfirm('module', moduleIndex)}
                                    disabled={courseEditModules.length === 1}
                                    aria-label={`Delete module ${moduleIndex + 1}`}
                                  >
                                    🗑
                                  </button>
                                </div>
                              </div>

                              {isExpanded ? (
                                <div className="faculty-course-edit-overview-details">
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



