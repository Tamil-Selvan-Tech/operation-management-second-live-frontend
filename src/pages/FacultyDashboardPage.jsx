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
  Search,
  Dot,
  ShieldCheck,
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
import { loadBranchCourseSnapshot } from '../lib/branchCourseSnapshot'
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

function findDataScienceCourse(courses = []) {
  const list = Array.isArray(courses) ? courses : []
  if (!list.length) return null

  return list.find((course) => {
    const name = String(course?.name || course?.courseName || '').trim().toLowerCase()
    const code = String(course?.courseCode || '').trim().toLowerCase()
    return name === 'data science' || name.includes('data science') || code.includes('data science')
  }) || null
}

function CourseHierarchyList({ models = [] }) {
  if (!Array.isArray(models) || !models.length) {
    return (
      <div className="faculty-course-empty-state">
        No modules added for this course.
      </div>
    )
  }

  return (
    <div className="faculty-course-module-stack">
      {models.map((model, modelIndex) => {
        const submodels = Array.isArray(model?.submodels) ? model.submodels : []
        const moduleName = model.name || `Module ${modelIndex + 1}`

        return (
          <article key={model.id || `${moduleName}-${modelIndex}`} className="faculty-course-module-card">
            <div className="faculty-course-module-head">
              <div className="faculty-course-module-copy">
                <span className="faculty-course-module-index">Module {modelIndex + 1}</span>
                <strong>{moduleName}</strong>
              </div>
              <span className="faculty-course-module-percent">{String(model.percentage || '-')}</span>
            </div>

            {submodels.length ? (
              <div className="faculty-course-submodule-list">
                {submodels.map((submodel, submodelIndex) => (
                  <div
                    key={submodel.id || `${submodel.name || 'submodule'}-${submodelIndex}`}
                    className="faculty-course-submodule-item"
                  >
                    <div className="faculty-course-submodule-copy">
                      <span>Submodule {submodelIndex + 1}</span>
                      <strong>{submodel.name || `Submodule ${submodelIndex + 1}`}</strong>
                    </div>
                    <span className="faculty-course-submodule-percent">{String(submodel.percentage || '-')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="faculty-course-submodule-empty">No submodules added</div>
            )}
          </article>
        )
      })}
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

        const nextCourses = Array.isArray(response?.data) && response.data.length ? response.data : loadBranchCourseSnapshot()
        if (!isMounted) return
        setBranchCourseCards(Array.isArray(nextCourses) ? nextCourses : [])
      } catch (error) {
        if (!isMounted) return
        console.error('Failed to load branch courses for faculty page', error)
        setBranchCourseCards(loadBranchCourseSnapshot())
      }
    }

    loadBranchCourses()

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
    () => (Array.isArray(selectedCourse?.models) ? selectedCourse.models : []),
    [selectedCourse],
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
                          </div>
                          <h3>{selectedCourse.name || 'Data Science'}</h3>
                          <p>
                            Complete details, fees, and curriculum structure for the selected Data Science course from the
                            branch catalog.
                          </p>
                          <div className="faculty-course-hero-tags">
                            <span>Code {selectedCourse.courseCode || '-'}</span>
                            <span>{selectedCourse.mode || 'Mode not set'}</span>
                            <span>{selectedCourse.duration ? `${selectedCourse.duration} month${String(selectedCourse.duration) === '1' ? '' : 's'}` : 'Duration not set'}</span>
                            <span>{selectedCourse.hours ? `${selectedCourse.hours} hour${String(selectedCourse.hours) === '1' ? '' : 's'}` : 'Hours not set'}</span>
                          </div>
                        </div>

                        <div className="faculty-course-hero-aside">
                          <div className="faculty-course-hero-price">
                            <span>Final Fee</span>
                            <strong>{selectedCourse.afterDiscount ? `₹${selectedCourse.afterDiscount}` : '-'}</strong>
                          </div>
                          <div className="faculty-course-hero-mini-grid">
                            <div>
                              <span>Batches</span>
                              <strong>{selectedCourse.batches || 0}</strong>
                            </div>
                            <div>
                              <span>Students</span>
                              <strong>{selectedCourse.students || 0}</strong>
                            </div>
                            <div>
                              <span>Created</span>
                              <strong>{formatDisplayDate(selectedCourse.createdAt)}</strong>
                            </div>
                            <div>
                              <span>Faculty</span>
                              <strong>
                                {Array.isArray(selectedCourse.assignedFaculty) && selectedCourse.assignedFaculty.length
                                  ? selectedCourse.assignedFaculty.map((faculty) => faculty?.name).filter(Boolean).join(', ')
                                  : 'Not Assigned'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="faculty-course-curriculum-shell">
                        <div className="branch-dashboard-section-heading">
                          <div className="branch-dashboard-section-heading-copy">
                            <h2>Modules &amp; Submodules</h2>
                            <p>Complete module structure for the selected Data Science course.</p>
                          </div>
                        </div>
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
    </section>
  )
}

export { FacultyDashboardPage as FacultyMyBatchesPage }

