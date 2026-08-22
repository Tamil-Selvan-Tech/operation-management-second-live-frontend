import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Layers3,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Pencil,
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
import { getCurrentFacultyProfile } from '../services/facultyService'
import { listBranchCourses } from '../services/branchCourseService'
import {
  getFacultyNotifications,
  markFacultyNotificationsAsRead,
} from '../services/facultyNotificationService'
import { useMobileMenu } from '../layouts/mobileMenuContext'
import { FacultyAttendanceFlow } from '../components/FacultyAttendanceFlow'
import { StudentAttendanceReportModal } from '../components/StudentAttendanceReportModal'
import { useAuth } from '../auth/useAuth'
import { loadFacultyRegistry } from '../lib/facultyAuth'
import {
  loadBranchCourseSnapshot,
  mergeBranchCoursesWithSnapshot,
  saveBranchCourseSnapshot,
  subscribeBranchCourseSnapshot,
} from '../lib/branchCourseSnapshot'
import {
  addCourseEditRequest,
  loadCourseEditRequests,
  recordCourseEditChange,
  subscribeCourseEditRequests,
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

function formatCoursePercentage(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const rounded = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
  return `${rounded}%`
}

function distributeCoursePercentages(count = 0) {
  const total = Math.max(0, Math.floor(Number(count) || 0))
  if (!total) return []

  const base = 100 / total
  const percentages = []
  let used = 0

  for (let index = 0; index < total; index += 1) {
    const remaining = 100 - used
    const value = index === total - 1 ? remaining : base
    const rounded = Number(value.toFixed(2))
    percentages.push(rounded)
    used += rounded
  }

  return percentages
}

function findDataScienceCourse(courses = []) {
  const list = Array.isArray(courses) ? courses : []
  if (!list.length) return null

  return list.find((course) => {
    const name = String(course?.name || course?.courseName || '').trim().toLowerCase()
    const code = String(course?.courseCode || '').trim().toLowerCase()
    return name === 'data science' || name.includes('data science') || code.includes('data science')
  }) || null
}

function buildCourseHierarchySummary(models = []) {
  const normalizedModels = Array.isArray(models)
    ? models.map((model) => ({
        ...model,
        id: String(model?.id || '').trim(),
        name: String(model?.name || '').trim(),
        submodels: Array.isArray(model?.submodels)
          ? model.submodels.map((submodel) => ({
              ...submodel,
              id: String(submodel?.id || '').trim(),
              name: String(submodel?.name || '').trim(),
            }))
          : [],
      }))
    : []

  const modelPercentages = distributeCoursePercentages(normalizedModels.length)

  return normalizedModels.map((model, modelIndex) => {
    const submodels = Array.isArray(model.submodels) ? model.submodels : []
    const submodelPercentages = distributeCoursePercentages(submodels.length)

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

function cloneCourseHierarchyDraft(models = []) {
  return Array.isArray(models)
    ? models.map((model, modelIndex) => ({
        id: String(model?.id || `module-${modelIndex + 1}`),
        name: String(model?.name || '').trim(),
        submodels: Array.isArray(model?.submodels)
          ? model.submodels.map((submodel, submodelIndex) => ({
              id: String(submodel?.id || `submodule-${modelIndex + 1}-${submodelIndex + 1}`),
              name: String(submodel?.name || '').trim(),
            }))
          : [],
      }))
    : []
}

function createEmptyCourseModuleDraft(moduleIndex = 0) {
  return {
    id: `module-${Date.now()}-${moduleIndex + 1}`,
    name: '',
    submodels: [],
  }
}

function createEmptyCourseSubmoduleDraft(moduleIndex = 0, submoduleIndex = 0) {
  return {
    id: `submodule-${Date.now()}-${moduleIndex + 1}-${submoduleIndex + 1}`,
    name: '',
  }
}

function CourseHierarchyList({ models = [] }) {
  const [expandedModelIds, setExpandedModelIds] = useState(() => [])

  if (!Array.isArray(models) || !models.length) {
    return (
      <div className="faculty-course-empty-state">
        No modules added for this course.
      </div>
    )
  }

  const allExpanded = expandedModelIds.length === models.length && models.length > 0
  const toggleModel = (modelId) => {
    const normalizedId = String(modelId || '').trim()
    if (!normalizedId) return

    setExpandedModelIds((current) =>
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId],
    )
  }

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedModelIds([])
      return
    }

    setExpandedModelIds(models.map((model, index) => String(model.id || `module-${index + 1}`)))
  }

  return (
    <div className="faculty-course-curriculum">
      <div className="faculty-course-curriculum-toolbar">
        <div>
          <p className="faculty-course-section-kicker">Modules &amp; Submodules</p>
          <h4>Expand a module to view its submodules</h4>
        </div>
        <button type="button" className="faculty-course-expand-all" onClick={toggleAll}>
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="faculty-course-module-grid">
      {models.map((model, modelIndex) => {
        const submodels = Array.isArray(model?.submodels) ? model.submodels : []
        const moduleName = model.name || `Module ${modelIndex + 1}`
        const moduleId = String(model.id || `module-${modelIndex + 1}`)
        const isExpanded = expandedModelIds.includes(moduleId)

        return (
          <article key={moduleId} className={`faculty-course-module-card ${isExpanded ? 'is-expanded' : ''}`.trim()}>
            <button
              type="button"
              className="faculty-course-module-trigger"
              onClick={() => toggleModel(moduleId)}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${moduleName}`}
            >
              <span className="faculty-course-module-index">{String(modelIndex + 1).padStart(2, '0')}</span>
              <span className="faculty-course-module-copy">
                <strong>{moduleName}</strong>
              </span>
              <span className="faculty-course-module-percent">{formatCoursePercentage(model.percentage)}</span>
              <span className="faculty-course-module-chevron" aria-hidden="true">
                <ChevronDown size={18} strokeWidth={2.3} />
              </span>
            </button>

            {isExpanded ? (
              <div className="faculty-course-submodule-list">
                {submodels.length ? (
                  submodels.map((submodel, submodelIndex) => (
                    <div
                      key={submodel.id || `${submodel.name || 'submodule'}-${submodelIndex}`}
                      className="faculty-course-submodule-item"
                    >
                      <div className="faculty-course-submodule-step">
                        <span className="faculty-course-submodule-dot" />
                        <span className="faculty-course-submodule-copy">
                          <span>01.{String(submodelIndex + 1).padStart(2, '0')}</span>
                          <strong>{submodel.name || `Submodule ${submodelIndex + 1}`}</strong>
                        </span>
                      </div>
                      <span className="faculty-course-submodule-percent">{formatCoursePercentage(submodel.percentage)}</span>
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
    </div>
  )
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

  if (normalizedKind.includes('login') || normalizedKind.includes('assigned') || normalizedKind.includes('active')) {
    return CheckCircle2
  }

  return Bell
}

function normalizeFacultyNotification(notification = {}) {
  const kind = String(notification.kind || 'general').trim() || 'general'
  const createdAt =
    String(notification.createdAt || notification.createdOn || notification.updatedAt || '').trim() ||
    new Date().toISOString()

  return {
    id: String(notification.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    kind,
    tone:
      String(notification.tone || (kind.includes('invite') ? 'amber' : kind.includes('login') ? 'green' : 'blue'))
        .trim() || 'blue',
    title: String(notification.title || 'Notification').trim(),
    message: String(notification.message || '').trim(),
    actionLabel: String(notification.actionLabel || '').trim() || 'View',
    categoryLabel: String(notification.categoryLabel || 'Faculty').trim() || 'Faculty',
    createdAt,
    time: formatNotificationTime(createdAt),
    read: Boolean(notification.read),
  }
}

function groupFacultyNotifications(notifications = []) {
  const groups = new Map()
  const orderedNotifications = [...notifications].sort(
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
          <p>{description}</p>
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
  const [isCourseEditRequestOpen, setIsCourseEditRequestOpen] = useState(false)
  const [courseEditRequestText, setCourseEditRequestText] = useState('')
  const [courseEditRequests, setCourseEditRequests] = useState(() => loadCourseEditRequests())
  const [isCourseEditEditorOpen, setIsCourseEditEditorOpen] = useState(false)
  const [courseEditEditorStage, setCourseEditEditorStage] = useState('table')
  const [courseEditActiveModuleIndex, setCourseEditActiveModuleIndex] = useState(0)
  const [courseEditActiveSubmoduleIndex, setCourseEditActiveSubmoduleIndex] = useState(0)
  const [courseEditExpandedModuleIds, setCourseEditExpandedModuleIds] = useState(() => [])
  const [courseEditEditingSubmoduleIndex, setCourseEditEditingSubmoduleIndex] = useState(null)
  const [courseEditDraftModels, setCourseEditDraftModels] = useState([])
  const [courseEditSaveMessage, setCourseEditSaveMessage] = useState('')
  const [courseEditModuleNameError, setCourseEditModuleNameError] = useState('')
  const profileMenuRef = useRef(null)
  const notificationRef = useRef(null)

  // Retrieve logged-in faculty details dynamically from registry or fallback to session
  const facultyDetails = useMemo(() => {
    const registry = loadFacultyRegistry()
    const email = String(user?.email || '').trim().toLowerCase()
    const matched = Array.isArray(registry) ? registry.find((f) => String(f.email || '').toLowerCase() === email) : null
    if (matched) return matched

    return {
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
  }, [user])

  const facultyName = facultyDetails.name
  const initials = useMemo(() => {
    return facultyName
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
  const [branchCourseCards, setBranchCourseCards] = useState([])


  useEffect(() => {
  const loadNotifications = async () => {
    try {
      const response =
        await getFacultyNotifications()

      setFacultyNotifications(
        Array.isArray(response?.data)
          ? response.data
          : [],
      )
    } catch (error) {
      console.error(
        'Failed to load faculty notifications',
        error,
      )
    }
  }

  loadNotifications()
}, [])

  useEffect(() => {
    const unsubscribe = subscribeCourseEditRequests(() => {
      setCourseEditRequests(loadCourseEditRequests())
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

    const loadBranchCourses = async () => {
      try {
        const response = await listBranchCourses({
          page: 1,
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })

        const nextCourses = mergeBranchCoursesWithSnapshot(
          Array.isArray(response?.data) && response.data.length ? response.data : loadBranchCourseSnapshot(),
        )
        if (!isMounted) return
        setBranchCourseCards(Array.isArray(nextCourses) ? nextCourses : [])
      } catch (error) {
        if (!isMounted) return
        console.error('Failed to load branch courses for faculty page', error)
        setBranchCourseCards(mergeBranchCoursesWithSnapshot(loadBranchCourseSnapshot()))
      }
    }

    loadBranchCourses()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeBranchCourseSnapshot(() => {
      void (async () => {
        try {
          const response = await listBranchCourses({
            page: 1,
            limit: 100,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          })

          const nextCourses = mergeBranchCoursesWithSnapshot(
            Array.isArray(response?.data) && response.data.length ? response.data : loadBranchCourseSnapshot(),
          )
          setBranchCourseCards(Array.isArray(nextCourses) ? nextCourses : [])
        } catch {
          setBranchCourseCards(mergeBranchCoursesWithSnapshot(loadBranchCourseSnapshot()))
        }
      })()
    })

    return unsubscribe
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
  const selectedCourse = useMemo(() => findDataScienceCourse(branchCourseCards), [branchCourseCards])
  const selectedCourseModels = useMemo(
    () => buildCourseHierarchySummary(selectedCourse?.models || selectedCourse?.courseModels || selectedCourse?.modules || []),
    [selectedCourse],
  )
  const selectedCourseEditRequest = useMemo(() => {
    const courseId = String(selectedCourse?.id || '').trim()
    const facultyId = String(facultyDetails.id || user?.id || '').trim()
    const facultyEmail = String(facultyDetails.email || user?.email || '').trim().toLowerCase()

    if (!courseId) return null

    return courseEditRequests
      .filter((request) => {
        if (String(request.courseId || '').trim() !== courseId) return false
        const requestFacultyId = String(request.facultyId || '').trim()
        const requestFacultyEmail = String(request.facultyEmail || '').trim().toLowerCase()

        if (facultyId && requestFacultyId && requestFacultyId === facultyId) return true
        if (facultyEmail && requestFacultyEmail && requestFacultyEmail === facultyEmail) return true
        return !facultyId && !facultyEmail
      })
      .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())[0] || null
  }, [courseEditRequests, facultyDetails.email, facultyDetails.id, selectedCourse, user?.email, user?.id])
  const selectedCourseEditButtonLabel =
    selectedCourseEditRequest?.requestStatus === 'accepted'
      ? 'Open Edit'
      : selectedCourseEditRequest?.requestStatus === 'pending'
        ? 'Request Pending'
        : 'Edit Request'
  const courseEditPreviewModels = useMemo(
    () => buildCourseHierarchySummary(courseEditDraftModels),
    [courseEditDraftModels],
  )
  const courseEditActiveModule = courseEditPreviewModels[courseEditActiveModuleIndex] || null
  const courseEditActiveModuleDraft = courseEditDraftModels[courseEditActiveModuleIndex] || null
  const courseEditActiveSubmodules = Array.isArray(courseEditActiveModule?.submodels) ? courseEditActiveModule.submodels : []

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

  const openCourseEditRequest = () => {
    setCourseEditRequestText(selectedCourseEditRequest?.message || '')
    setIsCourseEditRequestOpen(true)
  }

  const closeCourseEditRequest = () => {
    setIsCourseEditRequestOpen(false)
    setCourseEditRequestText('')
  }

  const openCourseEditEditor = () => {
    const nextDraftModels = cloneCourseHierarchyDraft(selectedCourseModels)
    setCourseEditDraftModels(nextDraftModels)
    setCourseEditEditorStage('table')
    setCourseEditActiveModuleIndex(0)
    setCourseEditActiveSubmoduleIndex(0)
    setCourseEditExpandedModuleIds(nextDraftModels.map((module) => String(module.id || '').trim()).filter(Boolean))
    setCourseEditEditingSubmoduleIndex(null)
    setCourseEditSaveMessage('')
    setIsCourseEditEditorOpen(true)
  }

  const closeCourseEditEditor = () => {
    setIsCourseEditEditorOpen(false)
    setCourseEditEditorStage('table')
    setCourseEditActiveModuleIndex(0)
    setCourseEditActiveSubmoduleIndex(0)
    setCourseEditExpandedModuleIds([])
    setCourseEditEditingSubmoduleIndex(null)
    setCourseEditSaveMessage('')
  }

  const handleCourseEditRequestSubmit = (event) => {
    event.preventDefault()
    const request = addCourseEditRequest({
      courseId: selectedCourse?.id || '',
      courseCode: selectedCourse?.courseCode || '',
      courseName: selectedCourse?.name || 'Data Science',
      facultyId: facultyDetails.id || user?.id || '',
      facultyName: facultyName || 'Faculty',
      facultyEmail: facultyDetails.email || user?.email || '',
      message: courseEditRequestText,
    })

    setCourseEditRequests((current) => [request, ...current.filter((item) => item.id !== request.id)])
    setIsCourseEditRequestOpen(false)
    setCourseEditRequestText('')
  }

  const handleCourseEditHeroAction = () => {
    if (selectedCourseEditRequest?.requestStatus === 'accepted') {
      openCourseEditEditor()
      return
    }

    openCourseEditRequest()
  }

  const updateCourseEditDraftModuleName = (moduleIndex, value) => {
    setCourseEditDraftModels((current) =>
      current.map((module, index) =>
        index === moduleIndex
          ? {
              ...module,
              name: value,
            }
          : module,
      ),
    )
  }

  const addCourseEditDraftModule = () => {
    const nextModule = createEmptyCourseModuleDraft(courseEditDraftModels.length)
    setCourseEditDraftModels((current) => [...current, nextModule])
    setCourseEditExpandedModuleIds((current) => [...current, String(nextModule.id || '').trim()].filter(Boolean))
    setCourseEditActiveModuleIndex(courseEditDraftModels.length)
    setCourseEditEditorStage('module')
  }

  const removeCourseEditDraftModule = (moduleIndex) => {
    const removedModuleId = String(courseEditDraftModels[moduleIndex]?.id || '').trim()
    setCourseEditDraftModels((current) => current.filter((_, index) => index !== moduleIndex))
    setCourseEditExpandedModuleIds((current) => current.filter((moduleId) => moduleId && moduleId !== removedModuleId))
    setCourseEditActiveModuleIndex((current) => Math.max(0, Math.min(current, Math.max(courseEditDraftModels.length - 2, 0))))
    setCourseEditEditingSubmoduleIndex(null)
  }

  const addCourseEditDraftSubmodule = (moduleIndex) => {
    const targetSubmoduleIndex = Array.isArray(courseEditDraftModels[moduleIndex]?.submodels)
      ? courseEditDraftModels[moduleIndex].submodels.length
      : 0
    setCourseEditDraftModels((current) =>
      current.map((module, index) =>
        index === moduleIndex
          ? {
              ...module,
              submodels: [...(Array.isArray(module.submodels) ? module.submodels : []), createEmptyCourseSubmoduleDraft(moduleIndex, (module.submodels || []).length)],
            }
          : module,
      ),
    )
    setCourseEditActiveSubmoduleIndex(targetSubmoduleIndex)
    setCourseEditEditingSubmoduleIndex(targetSubmoduleIndex)
  }

  const updateCourseEditDraftSubmoduleName = (moduleIndex, submoduleIndex, value) => {
    setCourseEditDraftModels((current) =>
      current.map((module, index) =>
        index === moduleIndex
          ? {
              ...module,
              submodels: (Array.isArray(module.submodels) ? module.submodels : []).map((submodel, innerIndex) =>
                innerIndex === submoduleIndex
                  ? {
                      ...submodel,
                      name: value,
                    }
                  : submodel,
              ),
            }
          : module,
      ),
    )
  }

  const removeCourseEditDraftSubmodule = (moduleIndex, submoduleIndex) => {
    setCourseEditDraftModels((current) =>
      current.map((module, index) =>
        index === moduleIndex
          ? {
              ...module,
              submodels: (Array.isArray(module.submodels) ? module.submodels : []).filter((_, innerIndex) => innerIndex !== submoduleIndex),
            }
          : module,
      ),
    )
    setCourseEditEditingSubmoduleIndex((current) => {
      if (current === submoduleIndex) return null
      if (typeof current === 'number' && current > submoduleIndex) return current - 1
      return current
    })
    setCourseEditActiveSubmoduleIndex((current) => {
      if (current === submoduleIndex) return 0
      if (typeof current === 'number' && current > submoduleIndex) return current - 1
      return current
    })
  }

  const openCourseEditModule = (moduleIndex) => {
    const safeIndex = Math.max(0, Math.min(Number(moduleIndex) || 0, courseEditPreviewModels.length - 1))
    setCourseEditActiveModuleIndex(safeIndex)
    setCourseEditActiveSubmoduleIndex(0)
    setCourseEditEditingSubmoduleIndex(null)
    setCourseEditEditorStage('module')
  }

  const continueToCourseEditSubmodules = () => {
    const moduleName = String(courseEditActiveModuleDraft?.name || '').trim()
    if (!moduleName) {
      setCourseEditModuleNameError('Module Name is mandatory.')
      return
    }

    setCourseEditModuleNameError('')
    setCourseEditActiveSubmoduleIndex(0)
    setCourseEditEditingSubmoduleIndex(null)
    setCourseEditEditorStage('submodule')
  }

  const backToCourseEditTable = () => {
    setCourseEditEditorStage('table')
    setCourseEditEditingSubmoduleIndex(null)
    setCourseEditModuleNameError('')
  }

  const toggleCourseEditModuleExpanded = (moduleId) => {
    const normalizedId = String(moduleId || '').trim()
    if (!normalizedId) return

    setCourseEditExpandedModuleIds((current) =>
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId],
    )
  }

  const editCourseEditSubmodule = (submoduleIndex) => {
    setCourseEditEditingSubmoduleIndex(submoduleIndex)
  }

  const addCourseEditSubmoduleAndEdit = () => {
    const targetModule = courseEditDraftModels[courseEditActiveModuleIndex]
    const nextSubmoduleIndex = Array.isArray(targetModule?.submodels) ? targetModule.submodels.length : 0
    addCourseEditDraftSubmodule(courseEditActiveModuleIndex)
    setCourseEditActiveSubmoduleIndex(nextSubmoduleIndex)
    setCourseEditEditingSubmoduleIndex(nextSubmoduleIndex)
  }

  const saveCourseEditModuleDraft = () => {
    const nextModule = courseEditDraftModels[courseEditActiveModuleIndex]
    if (!nextModule) return

    const nextModels = courseEditDraftModels.map((module, index) => {
      if (index !== courseEditActiveModuleIndex) return module

      const nextSubmodels = Array.isArray(module.submodels) ? module.submodels : []
      return {
        ...module,
        name: String(module.name || '').trim(),
        submodels: nextSubmodels
          .map((submodel) => ({
            ...submodel,
            name: String(submodel.name || '').trim(),
          }))
          .filter((submodel) => Boolean(submodel.name)),
      }
    })

    setCourseEditDraftModels(nextModels)
    setCourseEditEditorStage('table')
    setCourseEditEditingSubmoduleIndex(null)
    setCourseEditSaveMessage('Module saved. You can continue editing or save all changes.')
  }

  const handleCourseEditSave = () => {
    if (!selectedCourse?.id) return
    if (!selectedCourseEditRequest?.id) return

    const normalizedModels = cloneCourseHierarchyDraft(courseEditDraftModels)
      .map((model) => ({
        ...model,
        name: String(model.name || '').trim(),
        submodels: Array.isArray(model.submodels)
          ? model.submodels
              .map((submodel) => ({
                ...submodel,
                name: String(submodel.name || '').trim(),
              }))
              .filter((submodel) => Boolean(submodel.name))
          : [],
      }))
      .filter((model) => Boolean(model.name))

    const nextCourse = {
      ...selectedCourse,
      models: normalizedModels,
      courseModels: normalizedModels,
      modules: normalizedModels,
    }

    const nextCourses = branchCourseCards.map((course) =>
      String(course.id || '').trim() === String(selectedCourse.id || '').trim() ? nextCourse : course,
    )

    saveBranchCourseSnapshot(nextCourses)
    setBranchCourseCards(nextCourses)
    recordCourseEditChange(selectedCourseEditRequest.id, 'Updated modules and submodules.')
    setCourseEditSaveMessage('Saved. Branch admin updated.')
    setCourseEditEditorStage('table')
  }

  const renderSidebar = () => (
    <aside className="super-admin-sidebar" aria-label="Faculty navigation">
      <div className="super-admin-sidebar-brand">
        <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="CISPRO logo" />
      </div>

      <nav className="super-admin-sidebar-nav">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'my-batches', label: 'My Batches', icon: Layers3 },
          { id: 'courses', label: 'Course', icon: BookOpen },
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
              ✓
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

              {activeSection === 'courses' ? (
                <FacultyDashboardSection title="Course" description="Data Science course details from the branch course catalog.">
                  {selectedCourse ? (
                    <>
                      <div className="faculty-course-hero">
                        <div className="faculty-course-hero-content">
                          <div className="faculty-course-hero-topline">
                            <span className={`faculty-course-hero-status ${String(selectedCourse.status || 'Active').toLowerCase()}`.trim()}>
                              {selectedCourse.status || 'Active'}
                            </span>
                            <span className="faculty-course-hero-kicker">Branch course snapshot</span>
                            <button type="button" className="faculty-course-edit-request-btn" onClick={handleCourseEditHeroAction}>
                              {selectedCourseEditButtonLabel}
                            </button>
                          </div>
                          <h3>{selectedCourse.name || 'Data Science'}</h3>
                          <div className="faculty-course-hero-tags">
                            <span>Code {selectedCourse.courseCode || '-'}</span>
                            <span>{selectedCourse.mode || 'Mode not set'}</span>
                            <span>{selectedCourse.duration ? `${selectedCourse.duration} month${String(selectedCourse.duration) === '1' ? '' : 's'}` : 'Duration not set'}</span>
                            <span>{selectedCourse.hours ? `${selectedCourse.hours} hour${String(selectedCourse.hours) === '1' ? '' : 's'}` : 'Hours not set'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="faculty-course-curriculum-shell">
                        <CourseHierarchyList models={selectedCourseModels} />
                      </div>
                    </>
                  ) : (
                    <div className="faculty-course-empty-state faculty-course-empty-hero">
                      <strong>No Data Science course found</strong>
                      <p>The faculty course tab is waiting for the branch course catalog to load.</p>
                    </div>
                  )}
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
                                  {student.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
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

      {isCourseEditRequestOpen ? (
        <div className="branch-modal-backdrop faculty-course-request-backdrop" role="presentation">
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
              onClick={closeCourseEditRequest}
            >
              ×
            </button>

            <div className="faculty-course-request-header">
              <div>
                <p className="faculty-course-request-kicker">Edit Request</p>
                <h3 id="faculty-course-request-title">{selectedCourse?.name || 'Data Science'}</h3>
                <p className="faculty-course-request-subtitle">
                  Send a short note to the branch admin for module and submodule updates.
                </p>
              </div>
            </div>

            <form className="faculty-course-request-form" onSubmit={handleCourseEditRequestSubmit}>
              <label className="faculty-course-request-field">
                <span>Requested changes</span>
                <textarea
                  value={courseEditRequestText}
                  onChange={(event) => setCourseEditRequestText(event.target.value)}
                  placeholder="Add or update modules and submodules for this course."
                  rows={4}
                />
              </label>

              <div className="faculty-course-request-actions">
                <button
                  type="button"
                  className="faculty-course-request-cancel"
                  onClick={() => {
                    setCourseEditRequestText('')
                  }}
                >
                  Clear
                </button>
                <button type="submit" className="faculty-course-request-submit">
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCourseEditEditorOpen ? (
        <div className="branch-modal-backdrop faculty-course-edit-backdrop" role="presentation">
          <div
            className="faculty-course-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-course-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="faculty-course-edit-close"
              aria-label="Close course editor"
              onClick={closeCourseEditEditor}
            >
              Ã—
            </button>

            <div className="faculty-course-edit-header">
              <div>
                <p className="faculty-course-edit-kicker">Open Edit</p>
                <h3 id="faculty-course-edit-title">{selectedCourse?.name || 'Data Science'}</h3>
                <p className="faculty-course-edit-subtitle">
                  Update modules and submodules only. Other course details stay locked.
                </p>
              </div>
            </div>

            <div className="faculty-course-edit-body">
              {courseEditEditorStage === 'table' ? (
                <div className="faculty-course-edit-table-shell">
                  <div className="faculty-course-edit-table-toolbar">
                    <div>
                      <p className="faculty-course-edit-table-label">Modules</p>
                      <p className="faculty-course-edit-table-subtitle">
                        {courseEditPreviewModels.length} saved
                      </p>
                    </div>
                    <button type="button" className="faculty-course-edit-add-module" onClick={addCourseEditDraftModule}>
                      + Add Module
                    </button>
                  </div>

                  {courseEditPreviewModels.length ? (
                    <div className="faculty-course-edit-table" role="table" aria-label="Module overview">
                      <div className="faculty-course-edit-table-head" role="row">
                        <div role="columnheader">MODULE</div>
                        <div role="columnheader">MODULE %</div>
                        <div role="columnheader">SUBMODULES</div>
                        <div role="columnheader">ACTIONS</div>
                      </div>

                      <div className="faculty-course-edit-table-body">
                        {courseEditPreviewModels.map((module, moduleIndex) => {
                          const submodules = Array.isArray(module.submodels) ? module.submodels : []
                          const isExpanded = courseEditExpandedModuleIds.includes(module.id)

                          return (
                            <article
                              key={module.id || moduleIndex}
                              className={`faculty-course-edit-row ${isExpanded ? 'is-expanded' : ''}`.trim()}
                            >
                              <div className="faculty-course-edit-row-main">
                                <div className="faculty-course-edit-row-module">
                                  <div className="faculty-course-edit-badge">{String(moduleIndex + 1).padStart(2, '0')}</div>
                                  <div>
                                    <span>MODULE {moduleIndex + 1}</span>
                                    <strong>{module.name || `Module ${moduleIndex + 1}`}</strong>
                                  </div>
                                </div>
                                <div className="faculty-course-edit-row-percent">
                                  <span>{formatCoursePercentage(module.percentage)}</span>
                                </div>
                                <div className="faculty-course-edit-row-submodules">
                                  <span>{submodules.length} Submodules</span>
                                </div>
                                <div className="faculty-course-edit-row-actions">
                                  <button
                                    type="button"
                                    className="faculty-course-edit-action-btn"
                                    onClick={() => toggleCourseEditModuleExpanded(module.id)}
                                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} module ${moduleIndex + 1}`}
                                  >
                                    <ChevronDown size={16} strokeWidth={2.3} />
                                  </button>
                                  <button
                                    type="button"
                                    className="faculty-course-edit-action-btn"
                                    onClick={() => openCourseEditModule(moduleIndex)}
                                    aria-label={`Edit module ${moduleIndex + 1}`}
                                  >
                                    <Pencil size={14} strokeWidth={2.4} />
                                  </button>
                                  <button
                                    type="button"
                                    className="faculty-course-edit-action-btn is-danger"
                                    onClick={() => removeCourseEditDraftModule(moduleIndex)}
                                    aria-label={`Remove module ${moduleIndex + 1}`}
                                  >
                                    <Trash2 size={14} strokeWidth={2.4} />
                                  </button>
                                </div>
                              </div>

                              {isExpanded ? (
                                <div className="faculty-course-edit-row-details">
                                  {submodules.length ? (
                                    <div className="faculty-course-edit-mini-list">
                                      {submodules.map((submodel, submoduleIndex) => (
                                        <div key={submodel.id || submoduleIndex} className="faculty-course-edit-mini-item">
                                          <span className="faculty-course-edit-mini-index">
                                            01.{String(submoduleIndex + 1).padStart(2, '0')}
                                          </span>
                                          <strong>{submodel.name || `Submodule ${submoduleIndex + 1}`}</strong>
                                          <span className="faculty-course-edit-mini-percent">
                                            {formatCoursePercentage(submodel.percentage)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="faculty-course-edit-empty">No submodules added yet.</div>
                                  )}
                                </div>
                              ) : null}
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="faculty-course-edit-empty">
                      No modules yet. Add one to start editing the curriculum.
                    </div>
                  )}

                  {courseEditSaveMessage ? (
                    <div className="faculty-course-edit-status" role="status" aria-live="polite">
                      {courseEditSaveMessage}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {courseEditEditorStage === 'module' && courseEditActiveModuleDraft ? (
                <div className="faculty-course-edit-step-shell">
                  <div className="faculty-course-edit-step-card">
                    <div className="faculty-course-edit-step-title-row">
                      <div className="faculty-course-edit-step-badge">{String(courseEditActiveModuleIndex + 1)}</div>
                      <strong>Module {courseEditActiveModuleIndex + 1}</strong>
                    </div>
                    <label className="faculty-course-edit-field">
                      <span>
                        Module Name <span className="faculty-course-edit-required">*</span>
                      </span>
                      <input
                        type="text"
                        value={courseEditActiveModuleDraft.name}
                        onChange={(event) => updateCourseEditDraftModuleName(courseEditActiveModuleIndex, event.target.value)}
                        placeholder="Module name"
                        className="faculty-course-edit-input faculty-course-edit-input--module"
                      />
                    </label>
                    {courseEditModuleNameError ? <div className="faculty-course-edit-field-error">{courseEditModuleNameError}</div> : null}
                    <div className="faculty-course-edit-step-actions">
                      <button type="button" className="faculty-course-edit-cancel faculty-course-edit-step-cancel" onClick={backToCourseEditTable}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="faculty-course-edit-step-primary"
                        onClick={continueToCourseEditSubmodules}
                        disabled={!String(courseEditActiveModuleDraft.name || '').trim()}
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {courseEditEditorStage === 'submodule' && courseEditActiveModule ? (
                <div className="faculty-course-edit-step-shell">
                  <div className="faculty-course-edit-submodule-head">
                    <div className="faculty-course-edit-step-title-row">
                      <div className="faculty-course-edit-step-badge">{String(courseEditActiveModuleIndex + 1)}</div>
                      <strong>{courseEditActiveModule.name || `Module ${courseEditActiveModuleIndex + 1}`}</strong>
                    </div>
                    <div className="faculty-course-edit-submodule-count">
                      {courseEditActiveSubmodules.length} saved
                    </div>
                  </div>

                  <div className="faculty-course-edit-submodule-section">
                    <div className="faculty-course-edit-submodule-heading-row">
                      <h4>Sub Modules</h4>
                    </div>

                    <div className="faculty-course-edit-submodule-list">
                        {courseEditActiveSubmodules.length ? (
                        courseEditActiveSubmodules.map((submodel, submoduleIndex) => {
                          const isEditing = courseEditEditingSubmoduleIndex === submoduleIndex
                          const isActive = courseEditActiveSubmoduleIndex === submoduleIndex

                          return (
                            <div
                              key={submodel.id || submoduleIndex}
                              className={`faculty-course-edit-submodule-item ${isEditing ? 'is-editing' : ''} ${isActive ? 'is-active' : ''}`.trim()}
                            >
                              <span className="faculty-course-edit-submodule-check">✓</span>

                              {isEditing ? (
                                <input
                                  type="text"
                                  value={submodel.name}
                                  onChange={(event) =>
                                    updateCourseEditDraftSubmoduleName(courseEditActiveModuleIndex, submoduleIndex, event.target.value)
                                  }
                                  className="faculty-course-edit-input faculty-course-edit-input--submodule"
                                  placeholder="Submodule name"
                                />
                              ) : (
                                <strong>{submodel.name || `Submodule ${submoduleIndex + 1}`}</strong>
                              )}

                              <div className="faculty-course-edit-submodule-actions">
                                <button
                                  type="button"
                                  className="faculty-course-edit-icon-btn"
                                  onClick={() => editCourseEditSubmodule(submoduleIndex)}
                                  aria-label={`Edit submodule ${submoduleIndex + 1}`}
                                >
                                  <Pencil size={14} strokeWidth={2.4} />
                                </button>
                                <button
                                  type="button"
                                  className="faculty-course-edit-icon-btn is-danger"
                                  onClick={() => removeCourseEditDraftSubmodule(courseEditActiveModuleIndex, submoduleIndex)}
                                  aria-label={`Remove submodule ${submoduleIndex + 1}`}
                                >
                                  <Trash2 size={14} strokeWidth={2.4} />
                                </button>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="faculty-course-edit-empty">No submodules yet. Add one below.</div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="faculty-course-edit-add-submodule"
                      onClick={addCourseEditSubmoduleAndEdit}
                    >
                      + Add Submodule
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="faculty-course-edit-actions">
              {courseEditEditorStage === 'module' ? (
                <button type="button" className="faculty-course-edit-cancel" onClick={backToCourseEditTable}>
                  Back
                </button>
              ) : null}
              {courseEditEditorStage === 'submodule' ? (
                <button type="button" className="faculty-course-edit-cancel" onClick={() => setCourseEditEditorStage('module')}>
                  Back
                </button>
              ) : null}
              <button type="button" className="faculty-course-edit-cancel" onClick={closeCourseEditEditor}>
                Close
              </button>
              {courseEditEditorStage === 'submodule' ? (
                <button type="button" className="faculty-course-edit-save" onClick={saveCourseEditModuleDraft}>
                  Save Module
                </button>
              ) : null}
              {courseEditEditorStage === 'table' ? (
                <button type="button" className="faculty-course-edit-save" onClick={handleCourseEditSave}>
                  Save Changes
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export { FacultyDashboardPage as FacultyMyBatchesPage }

