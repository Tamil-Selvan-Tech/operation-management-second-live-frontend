import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CircleUserRound,
  ChevronDown,
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
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords, saveCourseRecords } from '../data/courseRecords'
import { getCurrentBranchProfile } from '../services/branchService'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/BranchDashboardPage.css'

const overviewStats = [
  { label: 'Total Students', value: '246', note: 'Active learners this month' },
  { label: 'Total Courses', value: '18', note: 'Published course catalog' },
  { label: 'Active Batches', value: '11', note: 'Running live batches' },
  { label: 'Pending Payments', value: '14', note: 'Needs follow-up today' },
]

const studentRows = [
  ['Ananya S', 'Batch A-11', 'Paid'],
  ['Rahul P', 'Batch A-08', 'Pending'],
  ['Meena K', 'Batch B-02', 'Paid'],
  ['Arun V', 'Batch C-01', 'Pending'],
]

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

function BranchDashboardSection({ title, description, children }) {
  return (
    <section className="branch-dashboard-section">
      <div className="branch-dashboard-section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
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
    createdAt: String(course.createdAt || new Date().toISOString()),
  }
}

function buildBranchCoursePayload(form) {
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
  }
}

function apiErrorMessage(error, fallback) {
  return error?.body?.message || error?.body?.error || error?.message || fallback
}

function buildDefaultBranchCourseCards() {
  return []
}

function loadBranchCourseCards() {
  const storedCourses = loadCourseRecords()
  if (storedCourses.length) {
    return storedCourses.map((course, index) => normalizeBranchCourseRecord(course, index))
  }

  if (typeof window === 'undefined') {
    return buildDefaultBranchCourseCards()
  }

  try {
    const raw = window.localStorage.getItem('cispro.branch-dashboard.courses')
    if (!raw) return buildDefaultBranchCourseCards()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) {
      return buildDefaultBranchCourseCards()
    }

    return parsed.filter(Boolean).map((course, index) => normalizeBranchCourseRecord(course, index))
  } catch {
    return buildDefaultBranchCourseCards()
  }
}

function saveBranchCourseCards(records) {
  const nextRecords = Array.isArray(records) ? records.map((record, index) => normalizeBranchCourseRecord(record, index)) : []
  saveCourseRecords(nextRecords)

  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem('cispro.branch-dashboard.courses', JSON.stringify(nextRecords))
  } catch {
    // ignore storage failures
  }
}

export function BranchDashboardPage() {
  const navigate = useNavigate()
  const { isAuthenticated, role, signOut, user, session } = useAuth()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [branchProfile, setBranchProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false)
  const [isAddCourseSaving, setIsAddCourseSaving] = useState(false)
  const [addCourseError, setAddCourseError] = useState('')
  const [courseSaveSuccess, setCourseSaveSuccess] = useState(null)
  const [addCourseForm, setAddCourseForm] = useState(() => createInitialBranchCourseForm())
  const [addCourseTouched, setAddCourseTouched] = useState({})
  const [branchCourseCards, setBranchCourseCards] = useState(() => loadBranchCourseCards())
  const [branchCoursePage, setBranchCoursePage] = useState(1)
  const [editingCourseId, setEditingCourseId] = useState('')
  const [openCourseActionMenuId, setOpenCourseActionMenuId] = useState('')
  const [courseDeleteTarget, setCourseDeleteTarget] = useState(null)
  const [viewCourse, setViewCourse] = useState(null)
  const profileMenuRef = useRef(null)
  const courseActionMenuRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated || role !== 'branch-admin') {
      navigate('/login', { replace: true })
      return
    }

    getCurrentBranchProfile()
      .then((result) => {
        setBranchProfile(result)
        setIsLoading(false)
      })
      .catch(() => {
        setBranchProfile(buildFallbackBranchProfile(user, session))
        setIsLoading(false)
      })
  }, [isAuthenticated, navigate, role, session, user])

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
    if (!openCourseActionMenuId) return undefined

    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (courseActionMenuRef.current?.contains(target)) return
      setOpenCourseActionMenuId('')
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenCourseActionMenuId('')
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [openCourseActionMenuId])

  useEffect(() => {
    const syncCourses = () => {
      setBranchCourseCards(loadBranchCourseCards())
    }

    syncCourses()
    window.addEventListener(COURSE_RECORD_SYNC_EVENT, syncCourses)

    return () => window.removeEventListener(COURSE_RECORD_SYNC_EVENT, syncCourses)
  }, [])

  const openLogoutConfirm = () => {
    setIsProfileMenuOpen(false)
    setIsLogoutConfirmOpen(true)
  }

  const closeLogoutConfirm = () => {
    setIsLogoutConfirmOpen(false)
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
    setActiveSection('profile')
  }

  const totalBranchCoursePages = Math.max(1, Math.ceil(branchCourseCards.length / BRANCH_COURSES_PER_PAGE))
  const safeBranchCoursePage = Math.min(branchCoursePage, totalBranchCoursePages)
  const visibleBranchCourses = useMemo(() => {
    const start = (safeBranchCoursePage - 1) * BRANCH_COURSES_PER_PAGE
    return branchCourseCards.slice(start, start + BRANCH_COURSES_PER_PAGE)
  }, [branchCourseCards, safeBranchCoursePage])
  const editingCourseRecord = useMemo(
    () => branchCourseCards.find((course) => String(course.id || '').trim() === String(editingCourseId || '').trim()) || null,
    [branchCourseCards, editingCourseId],
  )

  const addCourseFinalFee = useMemo(() => {
    const actualFees = Number(addCourseForm.actualFees || 0)
    const registrationFees = Number(addCourseForm.registrationFees || 0)
    const discount = Number(addCourseForm.discount || 0)

    if (Number.isNaN(actualFees) || Number.isNaN(registrationFees) || Number.isNaN(discount)) return ''
    return String(Math.max(actualFees + registrationFees - discount, 0))
  }, [addCourseForm.actualFees, addCourseForm.discount, addCourseForm.registrationFees])

  const addCourseValidationErrors = useMemo(() => {
    const errors = {}

    const normalizedCourseCode = normalizeBranchCourseCode(addCourseForm.courseCode)
    const hasCourseCodeSuffix = normalizedCourseCode.length > COURSE_CODE_PREFIX.length

    if (!hasCourseCodeSuffix) errors.courseCode = 'Course Code is required.'
    if (!addCourseForm.name.trim()) errors.name = 'Course Name is required.'
    if (!addCourseForm.mode) errors.mode = 'Mode is required.'
    if (!addCourseForm.duration) errors.duration = 'Duration (Months) is required.'
    if (addCourseForm.duration && Number(addCourseForm.duration) <= 0) errors.duration = 'Duration must be greater than zero.'
    if (!addCourseForm.hours) errors.hours = 'Hours is required.'
    if (addCourseForm.hours && Number(addCourseForm.hours) <= 0) errors.hours = 'Hours must be greater than zero.'
    if (!addCourseForm.actualFees) errors.actualFees = 'Standard Course Fee is required.'
    if (!addCourseForm.registrationFees) errors.registrationFees = 'Registration Fee is required.'
    if (!addCourseForm.status) errors.status = 'Status is required.'

    if (addCourseForm.discount && Number(addCourseForm.discount) < 0) {
      errors.discount = 'Discount must be zero or greater.'
    }

    return errors
  }, [addCourseForm])

  const shouldShowAddCourseError = (field) => Boolean(addCourseTouched[field] && addCourseValidationErrors[field])

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

  const resetAddCourseForm = () => {
    setAddCourseForm(
      editingCourseRecord ? buildBranchCourseFormFromRecord(editingCourseRecord) : createInitialBranchCourseForm(),
    )
    setAddCourseTouched({})
    setAddCourseError('')
  }

  const openAddCourseModal = () => {
    resetAddCourseForm()
    setEditingCourseId('')
    setCourseSaveSuccess(null)
    setIsAddCourseOpen(true)
    setActiveSection('courses')
  }

  const openViewCourseDrawer = (course) => {
  setViewCourse(course)
  setOpenCourseActionMenuId('')
}

const closeViewCourseDrawer = () => {
  setViewCourse(null)
}
  const openEditCourseModal = (course) => {
    setEditingCourseId(String(course?.id || '').trim())
    setAddCourseForm(buildBranchCourseFormFromRecord(course))
    setAddCourseTouched({})
    setAddCourseError('')
    setOpenCourseActionMenuId('')
    setIsAddCourseOpen(true)
    setActiveSection('courses')
  }

  const closeAddCourseModal = () => {
    setIsAddCourseOpen(false)
    setEditingCourseId('')
    setOpenCourseActionMenuId('')
  }

  const closeCourseSaveSuccess = () => {
    setCourseSaveSuccess(null)
  }

  const openDeleteCourseConfirm = (course) => {
    setCourseDeleteTarget(course)
    setOpenCourseActionMenuId('')
  }

  const closeDeleteCourseConfirm = () => {
    setCourseDeleteTarget(null)
  }

  const handleDeleteCourseConfirm = () => {
    if (!courseDeleteTarget) return

    const nextCards = branchCourseCards.filter((course) => String(course.id || '').trim() !== String(courseDeleteTarget.id || '').trim())
    setBranchCourseCards(nextCards)
    saveBranchCourseCards(nextCards)

    const nextTotalPages = Math.max(1, Math.ceil(nextCards.length / BRANCH_COURSES_PER_PAGE))
    setBranchCoursePage((current) => Math.min(current, nextTotalPages))
    setCourseDeleteTarget(null)
  }

  const handleAddCourseSubmit = async (event) => {
    event?.preventDefault()
    const nextTouched = Object.keys(addCourseValidationErrors).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    nextTouched.courseCode = true
    nextTouched.name = true
    nextTouched.mode = true
    nextTouched.duration = true
    nextTouched.hours = true
    nextTouched.actualFees = true
    nextTouched.registrationFees = true
    nextTouched.status = true
    setAddCourseTouched(nextTouched)

    if (Object.keys(addCourseValidationErrors).length > 0) {
      setAddCourseError(Object.values(addCourseValidationErrors)[0] || 'Please fill all required fields before saving.')
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
      const nextCourseCard = {
        id: editingTargetId || payload.courseCode || payload.name || `branch-course-${Date.now()}`,
        courseCode: payload.courseCode,
        name: payload.name,
        createdAt:
          branchCourseCards.find((course) => String(course.id || '').trim() === editingTargetId)?.createdAt ||
          new Date().toISOString(),
        batches: 0,
        students: 0,
        summary: `${payload.mode} | ${payload.duration} months | ${payload.hours} hours`,
        mode: payload.mode,
        duration: payload.duration,
        hours: payload.hours,
        actualFees: payload.actualFees,
        registrationFees: payload.registrationFees,
        discount: payload.discount,
        status: payload.status,
      }

      const nextCards = editingTargetId
        ? branchCourseCards.map((course) => (String(course.id || '').trim() === editingTargetId ? nextCourseCard : course))
        : [nextCourseCard, ...branchCourseCards]
      setBranchCourseCards(nextCards)
      saveBranchCourseCards(nextCards)
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
    } catch (error) {
      setAddCourseError(apiErrorMessage(error, 'Unable to save course right now.'))
    } finally {
      setIsAddCourseSaving(false)
    }
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

  const renderSidebar = () => (
    <aside className="super-admin-sidebar" aria-label="Branch navigation">
      <div className="super-admin-sidebar-brand">
        <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="CISPRO logo" />
      </div>

      <nav className="super-admin-sidebar-nav">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'courses', label: 'Courses', icon: BookOpen },
          { id: 'students', label: 'Students', icon: Users },
          { id: 'batches', label: 'Batches', icon: Layers3 },
          { id: 'payments', label: 'Payments', icon: Wallet },
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
      <div className="super-admin-topbar-right">
        <button type="button" className="super-admin-notification-button" aria-label="Notifications">
          <Bell size={22} strokeWidth={2.1} />
          <span className="super-admin-notification-badge">8</span>
        </button>

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
      </div>
    </header>
  )

  if (isLoading) {
    return (
      <section className="super-admin-page">
        <div className="super-admin-shell">
          {renderSidebar()}

          <div className="super-admin-main">
            {renderTopbar()}

            <main className="super-admin-content">
              <div className="branch-dashboard-content">
                <div className="super-admin-hero-copy">
                  <p className="branch-dashboard-kicker">Branch Dashboard</p>
                  <h1>Loading branch profile...</h1>
                  <p>Please wait while we load your branch workspace.</p>
                </div>
              </div>
            </main>
          </div>
        </div>
      </section>
    )
  }

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

                  {mustResetPassword ? (
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

              {activeSection === 'students' ? (
                <BranchDashboardSection title="Students" description="Dummy student list for the branch.">
                  <div className="branch-dashboard-table-shell">
                    <table className="branch-dashboard-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Batch</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentRows.map(([name, batch, status]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{batch}</td>
                            <td>{status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'courses' ? (
                <BranchDashboardSection
                  title="Courses"
                  description="Add a course and the saved data will appear in the table below with every field from the form."
                >
                 
<div className="branch-dashboard-section-toolbar">
  <div className="branch-dashboard-course-actions">
    <button
      type="button"
      className="button button-solid"
      onClick={openAddCourseModal}
    >
      + Add Course
    </button>

    <div className="branch-dashboard-section-summary">
      <span>Saved courses:</span>
      <strong>{branchCourseCards.length}</strong>
    </div>
  </div>
</div>

  
                  <div className="branch-course-table-shell">
                    <table className="branch-course-table">
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Course Code</th>
                          <th>Course Name</th>
                          <th>Mode</th>
                          <th>Duration</th>
                          <th>Hours</th>
                          <th>Standard Fee</th>
                          <th>Registration Fee</th>
                          <th>Discount</th>
                          <th>Final Fee</th>
                          <th>Created At</th>
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
                                <td>{course.mode || '-'}</td>
                                <td>{course.duration ? `${course.duration} month${course.duration === '1' ? '' : 's'}` : '-'}</td>
                                <td>{course.hours ? `${course.hours} hour${course.hours === '1' ? '' : 's'}` : '-'}</td>
                                <td>{formatBranchCourseAmount(course.actualFees)}</td>
                                <td>{formatBranchCourseAmount(course.registrationFees)}</td>
                                <td>{formatBranchCourseAmount(course.discount || '0')}</td>
                                <td>{formatBranchCourseFinalFee(course)}</td>
                                <td>{formatBranchCourseDate(course.createdAt)}</td>
                                <td>
                                  <span className={`branch-course-status-pill ${normalizedStatus}`.trim()}>
                                    {course.status || 'Active'}
                                  </span>
                                </td>
                                <td onClick={(event) => event.stopPropagation()}>
  <div
    className="branch-course-actions-wrap"
    ref={openCourseActionMenuId === course.id ? courseActionMenuRef : null}
  >
                                    <button
                                      type="button"
                                      className="branch-course-actions-button"
                                      aria-label={`Course actions for ${course.name || course.courseCode || 'course'}`}
                                      aria-haspopup="menu"
                                      aria-expanded={openCourseActionMenuId === course.id}
                                      onClick={() =>
                                        setOpenCourseActionMenuId((current) => (current === course.id ? '' : course.id))
                                      }
                                    >
                                      <MoreVertical size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                                    </button>

                                    {openCourseActionMenuId === course.id ? (
  <div className="branch-course-actions-menu" role="menu" aria-label="Course actions">

    <button
      type="button"
      className="branch-course-actions-menu-item"
      onClick={() => openViewCourseDrawer(course)}
      role="menuitem"
    >
      View
    </button>

    <button
      type="button"
      className="branch-course-actions-menu-item"
      onClick={() => openEditCourseModal(course)}
      role="menuitem"
    >
      Edit
    </button>

    <button
      type="button"
      className="branch-course-actions-menu-item is-danger"
      onClick={() => openDeleteCourseConfirm(course)}
      role="menuitem"
    >
      Delete
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

              <div className="course-form-grid">
                <Field
                  label="Enter Course Code"
                  required
                  hint="Recommended unique identifier for reports and integrations"
                  error={shouldShowAddCourseError('courseCode') ? addCourseValidationErrors.courseCode : ''}
                >
                    <input
                      type="text"
                      placeholder="UIUX-06M"
                      value={addCourseForm.courseCode || COURSE_CODE_PREFIX}
                      onChange={(event) => updateAddCourseField('courseCode', event.target.value)}
                      onBlur={() => setAddCourseTouched((current) => ({ ...current, courseCode: true }))}
                      aria-invalid={Boolean(shouldShowAddCourseError('courseCode'))}
                    />
                </Field>

                <Field
                  label="Enter Course Name"
                  required
                  hint="Required field"
                  error={shouldShowAddCourseError('name') ? addCourseValidationErrors.name : ''}
                >
                  <input
                    type="text"
                    placeholder="Enter Course Name"
                    value={addCourseForm.name}
                    onChange={(event) => updateAddCourseField('name', event.target.value)}
                    onBlur={() => setAddCourseTouched((current) => ({ ...current, name: true }))}
                    aria-invalid={Boolean(shouldShowAddCourseError('name'))}
                  />
                </Field>

                <Field
                  label="Select Mode"
                  required
                  hint="Online / Offline / Hybrid"
                  error={shouldShowAddCourseError('mode') ? addCourseValidationErrors.mode : ''}
                >
                  <select
                    value={addCourseForm.mode}
                    onChange={(event) => updateAddCourseField('mode', event.target.value)}
                    onBlur={() => setAddCourseTouched((current) => ({ ...current, mode: true }))}
                    aria-invalid={Boolean(shouldShowAddCourseError('mode'))}
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
                  label="Enter Duration (Months)"
                  required
                  hint="Numbers only"
                  error={shouldShowAddCourseError('duration') ? addCourseValidationErrors.duration : ''}
                >
                  <div className="course-input-with-suffix">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.duration}
                      onChange={(event) => updateAddCourseNumericField('duration', event.target.value)}
                      onBlur={() => setAddCourseTouched((current) => ({ ...current, duration: true }))}
                      aria-invalid={Boolean(shouldShowAddCourseError('duration'))}
                    />
                    <span>{Number(addCourseForm.duration) === 1 ? 'month' : 'months'}</span>
                  </div>
                </Field>

                <Field
                  label="Enter Hours"
                  required
                  hint="Numbers only"
                  error={shouldShowAddCourseError('hours') ? addCourseValidationErrors.hours : ''}
                >
                  <div className="course-input-with-suffix">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.hours}
                      onChange={(event) => updateAddCourseNumericField('hours', event.target.value)}
                      onBlur={() => setAddCourseTouched((current) => ({ ...current, hours: true }))}
                      aria-invalid={Boolean(shouldShowAddCourseError('hours'))}
                    />
                    <span>{Number(addCourseForm.hours) === 1 ? 'hour' : 'hours'}</span>
                  </div>
                </Field>

                <Field
                  label="Enter Standard Course Fee"
                  required
                  hint="Default/base fee before adjustments"
                  error={shouldShowAddCourseError('actualFees') ? addCourseValidationErrors.actualFees : ''}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={addCourseForm.actualFees}
                    onChange={(event) => updateAddCourseNumericField('actualFees', event.target.value)}
                    onBlur={() => setAddCourseTouched((current) => ({ ...current, actualFees: true }))}
                    aria-invalid={Boolean(shouldShowAddCourseError('actualFees'))}
                  />
                </Field>

                <Field
                  label="Enter Registration Fee"
                  required
                  hint="Registration fee amount"
                  error={shouldShowAddCourseError('registrationFees') ? addCourseValidationErrors.registrationFees : ''}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={addCourseForm.registrationFees}
                    onChange={(event) => updateAddCourseNumericField('registrationFees', event.target.value)}
                    onBlur={() => setAddCourseTouched((current) => ({ ...current, registrationFees: true }))}
                    aria-invalid={Boolean(shouldShowAddCourseError('registrationFees'))}
                  />
                </Field>

                <Field
                  label="Enter Default Discount"
                  hint="Optional "
                  error={shouldShowAddCourseError('discount') ? addCourseValidationErrors.discount : ''}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={addCourseForm.discount}
                    onChange={(event) => updateAddCourseNumericField('discount', event.target.value)}
                    onBlur={() => setAddCourseTouched((current) => ({ ...current, discount: true }))}
                    aria-invalid={Boolean(shouldShowAddCourseError('discount'))}
                  />
                </Field>

                <Field label="Final Fee" hint="Auto calculated from fee + registration - discount">
                  <input type="text" value={addCourseFinalFee} readOnly />
                </Field>

                <Field
                  label="Select Status"
                  required
                  hint="Active or Inactive"
                  error={shouldShowAddCourseError('status') ? addCourseValidationErrors.status : ''}
                >
                  <select
                    value={addCourseForm.status}
                    onChange={(event) => updateAddCourseField('status', event.target.value)}
                    onBlur={() => setAddCourseTouched((current) => ({ ...current, status: true }))}
                    aria-invalid={Boolean(shouldShowAddCourseError('status'))}
                  >
                    <option value="Active">Active</option>
                    <option>Inactive</option>
                  </select>
                </Field>
              </div>

              {Object.keys(addCourseTouched).length > 0 && Object.keys(addCourseValidationErrors).length > 0 ? (
                <div className="course-validation-note course-validation-error" style={{ color: '#dc2626' }}>
                  <span style={{ color: '#dc2626' }}>
                    {addCourseError || Object.values(addCourseValidationErrors)[0] || 'Please fill all required fields before saving.'}
                  </span>
                </div>
              ) : addCourseError ? (
                <div className="course-validation-note course-validation-error" style={{ color: '#dc2626' }}>
                  <span style={{ color: '#dc2626' }}>{addCourseError}</span>
                </div>
              ) : null}

              <div className="course-form-actions">
                <button type="button" className="button button-ghost" onClick={resetAddCourseForm} disabled={isAddCourseSaving}>
                  Reset
                </button>
                <button type="submit" className="button button-solid" disabled={isAddCourseSaving}>
                  {isAddCourseSaving ? 'Saving...' : editingCourseId ? 'Update Course' : 'Save Course'}
                </button>
              </div>

              <button type="button" className="course-modal-close" onClick={closeAddCourseModal} aria-label="Close course form" disabled={isAddCourseSaving}>
                X
              </button>
            </form>
          </div>
        ) : null}

{viewCourse ? (
  <div
    className="branch-course-drawer-backdrop"
    role="presentation"
    onClick={closeViewCourseDrawer}
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

    <div className="branch-course-title-row">
      <p className="section-kicker">COURSE DETAILS</p>

      <strong 
  className={`branch-course-status-pill ${String(
    viewCourse.status || 'Active'
  ).toLowerCase()}`}
>
  {viewCourse.status || 'Active'}
</strong>
    </div>

    <h2 id="branch-course-view-title">
      {viewCourse.name || 'Course'}
    </h2>

    <span className="branch-course-view-code">
      {viewCourse.courseCode || '-'}
    </span>

  </div>

  <button
    type="button"
    className="branch-course-view-close"
    onClick={closeViewCourseDrawer}
    aria-label="Close course details"
  >
    X
  </button>
</div>

      {/* Details */}
      <div className="branch-course-view-body">

        <div className="branch-course-view-list">

          {/* 1. Status */}
          {/* <div className="branch-course-view-item">
            <span>Status</span>

            <strong
              className={`branch-course-status-pill ${String(
                viewCourse.status || 'Active'
              ).toLowerCase()}`}
            >
              {viewCourse.status || 'Active'}
            </strong>
          </div> */}

         

          {/* 4. Mode */}
          <div className="branch-course-view-item">
            <span>Mode</span>
            <strong>
              {viewCourse.mode || '-'}
            </strong>
          </div>

          {/* 5. Duration */}
          <div className="branch-course-view-item">
            <span>Duration</span>
            <strong>
              {viewCourse.duration
                ? `${viewCourse.duration} month${
                    viewCourse.duration === '1' ? '' : 's'
                  }`
                : '-'}
            </strong>
          </div>

          {/* 6. Hours */}
          <div className="branch-course-view-item">
            <span>Hours</span>
            <strong>
              {viewCourse.hours
                ? `${viewCourse.hours} hour${
                    viewCourse.hours === '1' ? '' : 's'
                  }`
                : '-'}
            </strong>
          </div>

          {/* 7. Standard Course Fee */}
          <div className="branch-course-view-item">
            <span>Standard Course Fee</span>
            <strong>
              {formatBranchCourseAmount(
                viewCourse.actualFees
              )}
            </strong>
          </div>

          {/* 8. Registration Fee */}
          <div className="branch-course-view-item">
            <span>Registration Fee</span>
            <strong>
              {formatBranchCourseAmount(
                viewCourse.registrationFees
              )}
            </strong>
          </div>

          {/* 9. Discount */}
          <div className="branch-course-view-item">
            <span>Discount</span>
            <strong>
              {formatBranchCourseAmount(
                viewCourse.discount || '0'
              )}
            </strong>
          </div>

          {/* 10. Final Fee */}
          <div className="branch-course-view-item highlight">
            <span>Final Fee</span>
            <strong>
              {formatBranchCourseFinalFee(viewCourse)}
            </strong>
          </div>

          {/* 11. Created At */}
          <div className="branch-course-view-item">
            <span>Created At</span>
            <strong>
              {formatBranchCourseDate(
                viewCourse.createdAt
              )}
            </strong>
          </div>

        </div>
      </div>

      {/* 12. Bottom Buttons */}
      <div className="branch-course-view-footer">

        <button
          type="button"
          className="button button-ghost"
          onClick={closeViewCourseDrawer}
        >
          Close
        </button>

        <button
          type="button"
          className="button button-solid"
          onClick={() => {
            closeViewCourseDrawer();
            openEditCourseModal(viewCourse);
          }}
        >
          Edit Course
        </button>

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
                X
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
                X
              </button>

              <div className="super-admin-logout-icon is-danger" aria-hidden="true">
                <LogOut size={28} strokeWidth={2.1} />
              </div>

              <h2 id="branch-delete-title">Delete this course?</h2>
              <p className="branch-delete-copy">
                {courseDeleteTarget.name || courseDeleteTarget.courseCode || 'This course'} will be removed from the table.
              </p>

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

        {isLogoutConfirmOpen ? (
          <div className="branch-modal-backdrop" role="presentation" onClick={closeLogoutConfirm}>
            <div
              className="branch-success-modal super-admin-logout-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-logout-title"
              aria-describedby="branch-logout-description"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close logout confirmation"
                onClick={closeLogoutConfirm}
              >
                X
              </button>

              <div className="super-admin-logout-icon" aria-hidden="true">
                <LogOut size={28} strokeWidth={2.1} />
              </div>

              <h2 id="branch-logout-title">Are you sure you want to logout?</h2>
              

              <div className="branch-modal-actions">
                <button type="button" className="branch-modal-cancel" onClick={closeLogoutConfirm}>
                  Cancel
                </button>
                <button type="button" className="branch-modal-submit" onClick={handleConfirmLogout}>
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
