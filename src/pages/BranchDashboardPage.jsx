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
  RefreshCcw,
  Shield,
  Users,
  Wallet,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { getCurrentBranchProfile } from '../services/branchService'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/BranchDashboardPage.css'

const BRANCH_COURSE_STORAGE_KEY = 'cispro.branch-dashboard.courses'

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

const defaultCourseCards = [
  { name: 'Full Stack Development', batches: 4, students: 78 },
  { name: 'UI/UX Design', batches: 2, students: 34 },
  { name: 'Data Analytics', batches: 3, students: 51 },
  { name: 'Digital Marketing', batches: 2, students: 29 },
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

function formatBranchAdminDisplayName(value) {
  const text = String(value || '').trim()
  if (!text) return 'Branch Admin'

  return text.replace(/^KKJ\s*[-–—:]?\s*/i, '').trim() || 'Branch Admin'
}

function normalizeInstallmentCount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 1) return 0
  return Math.floor(amount)
}

function getEffectiveInstallmentCount(form) {
  if (form.installmentCount === 'custom') {
    return normalizeInstallmentCount(form.customInstallmentCount)
  }

  return normalizeInstallmentCount(form.installmentCount)
}

function getInstallmentValue(form, index) {
  if (index === 1) return form.installment1 ?? ''
  if (index === 2) return form.installment2 ?? ''
  if (index === 3) return form.installment3 ?? ''
  return form.extraInstallments?.[index - 4] ?? ''
}

function setInstallmentValue(form, index, value) {
  if (index === 1) return { ...form, installment1: value }
  if (index === 2) return { ...form, installment2: value }
  if (index === 3) return { ...form, installment3: value }

  const extraIndex = index - 4
  const extraInstallments = [...(form.extraInstallments || [])]
  extraInstallments[extraIndex] = value
  return { ...form, extraInstallments }
}

function buildBranchCoursePayload(form) {
  const finalFee = Math.max(
    Number(form.actualFees || 0) + Number(form.registrationFees || 0) - Number(form.discount || 0),
    0,
  )
  const installmentCount = getEffectiveInstallmentCount(form)
  const installments = Array.from({ length: installmentCount }, (_, index) => getInstallmentValue(form, index + 1))

  const payload = {
    courseCode: String(form.courseCode || '').trim(),
    name: String(form.name || '').trim(),
    mode: form.mode,
    duration: form.duration,
    hours: form.hours,
    actualFees: form.actualFees,
    registrationFees: form.registrationFees,
    discount: form.discount || '0',
    afterDiscount: String(finalFee),
    defaultFinalFee: String(finalFee),
    installmentCount: String(installmentCount),
    installments,
    status: form.status,
  }

  installments.forEach((amount, index) => {
    payload[`installment${index + 1}`] = amount
  })

  return payload
}

function createInitialBranchCourseForm() {
  return {
    courseCode: '',
    name: '',
    mode: '',
    duration: '',
    hours: '',
    actualFees: '',
    registrationFees: '',
    discount: '',
    installmentCount: '2',
    customInstallmentCount: '',
    installment1: '',
    installment2: '',
    installment3: '',
    extraInstallments: [],
    status: 'Active',
  }
}

function apiErrorMessage(error, fallback) {
  return error?.body?.message || error?.body?.error || error?.message || fallback
}

function buildDefaultBranchCourseCards() {
  return defaultCourseCards.map((course) => ({
    id: course.name,
    courseCode: '',
    name: course.name,
    batches: course.batches,
    students: course.students,
    summary: `${course.batches} batches`,
    detail: `${course.students} students`,
  }))
}

function loadBranchCourseCards() {
  if (typeof window === 'undefined') {
    return buildDefaultBranchCourseCards()
  }

  try {
    const raw = window.localStorage.getItem(BRANCH_COURSE_STORAGE_KEY)
    if (!raw) return buildDefaultBranchCourseCards()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) {
      return buildDefaultBranchCourseCards()
    }

    return parsed
      .filter(Boolean)
      .map((course) => ({
        id: String(course.id || course.courseCode || course.name || Date.now()),
        courseCode: String(course.courseCode || '').trim(),
        name: String(course.name || '').trim(),
        batches: Number(course.batches || 0),
        students: Number(course.students || 0),
        summary: String(course.summary || '').trim(),
        detail: String(course.detail || '').trim(),
        mode: String(course.mode || '').trim(),
        duration: String(course.duration || '').trim(),
        hours: String(course.hours || '').trim(),
        actualFees: String(course.actualFees || '').trim(),
        registrationFees: String(course.registrationFees || '').trim(),
        discount: String(course.discount || '').trim(),
        finalFee: String(course.finalFee || '').trim(),
        installmentCount: String(course.installmentCount || '').trim(),
        installments: Array.isArray(course.installments) ? course.installments.map((value) => String(value ?? '')) : [],
        status: String(course.status || 'Active').trim(),
      }))
  } catch {
    return buildDefaultBranchCourseCards()
  }
}

function saveBranchCourseCards(records) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(BRANCH_COURSE_STORAGE_KEY, JSON.stringify(records))
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
  const [addCourseSuccess, setAddCourseSuccess] = useState('')
  const [addCourseForm, setAddCourseForm] = useState(() => createInitialBranchCourseForm())
  const [addCourseTouched, setAddCourseTouched] = useState({})
  const [branchCourseCards, setBranchCourseCards] = useState(() => loadBranchCourseCards())
  const profileMenuRef = useRef(null)

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

  const addCourseAfterDiscount = useMemo(() => {
    const actualFees = Number(addCourseForm.actualFees || 0)
    const registrationFees = Number(addCourseForm.registrationFees || 0)
    const discount = Number(addCourseForm.discount || 0)
    if (Number.isNaN(actualFees) || Number.isNaN(registrationFees) || Number.isNaN(discount)) return ''
    return String(Math.max(actualFees + registrationFees - discount, 0))
  }, [addCourseForm.actualFees, addCourseForm.discount, addCourseForm.registrationFees])

  const addCourseValidationErrors = useMemo(() => {
    const errors = {}

    if (!addCourseForm.courseCode.trim()) errors.courseCode = 'Course Code is required.'
    if (!addCourseForm.name.trim()) errors.name = 'Course Name is required.'
    if (!addCourseForm.mode) errors.mode = 'Mode is required.'
    if (!addCourseForm.duration) errors.duration = 'Duration (Months) is required.'
    if (addCourseForm.duration && Number(addCourseForm.duration) <= 0) errors.duration = 'Duration must be greater than zero.'
    if (!addCourseForm.hours) errors.hours = 'Hours is required.'
    if (addCourseForm.hours && Number(addCourseForm.hours) <= 0) errors.hours = 'Hours must be greater than zero.'
    if (!addCourseForm.actualFees) errors.actualFees = 'Standard Course Fee is required.'
    if (!addCourseForm.registrationFees) errors.registrationFees = 'Registration Fee is required.'
    if (!addCourseForm.installmentCount) errors.installmentCount = 'Fee Plan Template is required.'
    if (!addCourseForm.status) errors.status = 'Status is required.'

    const installmentCount = getEffectiveInstallmentCount(addCourseForm)
    if (addCourseForm.installmentCount === 'custom' && !installmentCount) {
      errors.customInstallmentCount = 'Custom Installment Count is required.'
    }

    for (let index = 1; index <= installmentCount; index += 1) {
      if (!getInstallmentValue(addCourseForm, index)) {
        errors[`installment${index}`] = `Installment ${index} is required.`
      }
    }

    if (addCourseForm.discount && Number(addCourseForm.discount) < 0) {
      errors.discount = 'Discount must be zero or greater.'
    }

    const allRequiredFilled =
      addCourseForm.courseCode.trim() &&
      addCourseForm.name.trim() &&
      addCourseForm.mode &&
      addCourseForm.duration &&
      addCourseForm.hours &&
      addCourseForm.actualFees &&
      addCourseForm.registrationFees &&
      addCourseForm.installmentCount &&
      addCourseForm.status &&
      (addCourseForm.installmentCount !== 'custom' || installmentCount > 0) &&
      Array.from({ length: installmentCount }, (_, index) => index + 1).every((index) => Boolean(getInstallmentValue(addCourseForm, index)))

    if (allRequiredFilled) {
      const finalFee = Number(addCourseForm.actualFees) + Number(addCourseForm.registrationFees) - Number(addCourseForm.discount || 0)
      const installmentTotal = Array.from({ length: installmentCount }, (_, index) => Number(getInstallmentValue(addCourseForm, index + 1) || 0)).reduce(
        (total, amount) => total + amount,
        0,
      )

      if (installmentTotal !== Math.max(finalFee, 0)) {
        for (let index = 1; index <= installmentCount; index += 1) {
          errors[`installment${index}`] = `Installment total must match ${Math.max(finalFee, 0)}.`
        }
      }
    }

    return errors
  }, [addCourseForm])

  const shouldShowAddCourseError = (field) => Boolean(addCourseTouched[field] && addCourseValidationErrors[field])

  const updateAddCourseField = (field, value) => {
    setAddCourseError('')
    setAddCourseSuccess('')
    setAddCourseForm((current) => ({ ...current, [field]: value }))
  }

  const updateAddCourseNumericField = (field, value) => {
    updateAddCourseField(field, value.replace(/[^\d]/g, ''))
  }

  const handleAddCourseInstallmentCountChange = (value) => {
    setAddCourseError('')
    setAddCourseSuccess('')
    setAddCourseForm((current) => ({
      ...current,
      installmentCount: value,
      customInstallmentCount: value === 'custom' ? current.customInstallmentCount : '',
      extraInstallments: value === 'custom' ? current.extraInstallments : [],
    }))
  }

  const handleAddCourseCustomInstallmentCountChange = (value) => {
    setAddCourseError('')
    setAddCourseSuccess('')
    const nextDigits = value.replace(/[^\d]/g, '')
    setAddCourseForm((current) => ({
      ...current,
      installmentCount: 'custom',
      customInstallmentCount: nextDigits,
    }))
  }

  const resetAddCourseForm = () => {
    setAddCourseForm(createInitialBranchCourseForm())
    setAddCourseTouched({})
    setAddCourseError('')
  }

  const openAddCourseModal = () => {
    resetAddCourseForm()
    setIsAddCourseOpen(true)
    setActiveSection('courses')
  }

  const closeAddCourseModal = () => {
    setIsAddCourseOpen(false)
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
    nextTouched.installmentCount = true
    nextTouched.status = true
    if (addCourseForm.installmentCount === 'custom') {
      nextTouched.customInstallmentCount = true
    }
    const installmentCount = getEffectiveInstallmentCount(addCourseForm)
    for (let index = 1; index <= installmentCount; index += 1) {
      nextTouched[`installment${index}`] = true
    }
    setAddCourseTouched(nextTouched)

    if (Object.keys(addCourseValidationErrors).length > 0) {
      setAddCourseError(Object.values(addCourseValidationErrors)[0] || 'Please fill all required fields before saving.')
      return
    }

    setIsAddCourseSaving(true)
    try {
      const duplicateCourse = branchCourseCards.find(
        (course) => String(course.name || '').trim().toLowerCase() === String(addCourseForm.name || '').trim().toLowerCase(),
      )
      const duplicateCourseCode = branchCourseCards.find(
        (course) =>
          String(course.courseCode || '').trim().toLowerCase() === String(addCourseForm.courseCode || '').trim().toLowerCase(),
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
        id: payload.courseCode || payload.name || `branch-course-${Date.now()}`,
        courseCode: payload.courseCode,
        name: payload.name,
        batches: 0,
        students: 0,
        summary: `${payload.mode} | ${payload.duration} months | ${payload.hours} hours`,
        detail: `Final fee ${payload.defaultFinalFee}`,
        mode: payload.mode,
        duration: payload.duration,
        hours: payload.hours,
        actualFees: payload.actualFees,
        registrationFees: payload.registrationFees,
        discount: payload.discount,
        finalFee: payload.defaultFinalFee,
        installmentCount: payload.installmentCount,
        installments: payload.installments,
        status: payload.status,
      }

      const nextCards = [nextCourseCard, ...branchCourseCards]
      setBranchCourseCards(nextCards)
      saveBranchCourseCards(nextCards)
      setAddCourseSuccess(`Course "${addCourseForm.name.trim()}" created successfully.`)
      setIsAddCourseOpen(false)
      setAddCourseForm(createInitialBranchCourseForm())
      setAddCourseTouched({})
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
                <BranchDashboardSection title="Courses" description="A small sample of active course offerings.">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button type="button" className="button button-solid" onClick={openAddCourseModal}>
                      + Add Course
                    </button>
                  </div>
                  {addCourseSuccess ? (
                    <div className="course-validation-note" style={{ marginBottom: '1rem', color: '#166534' }}>
                      <span style={{ color: '#166534' }}>{addCourseSuccess}</span>
                    </div>
                  ) : null}
                  <div className="branch-dashboard-card-grid">
                    {branchCourseCards.map((course) => (
                      <article key={course.id} className="branch-dashboard-info-card">
                        <strong>{course.name}</strong>
                        <span>{course.courseCode || course.summary || `${course.batches || 0} batches`}</span>
                        <small>{course.detail || `${course.students || 0} students`}</small>
                      </article>
                    ))}
                  </div>
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
          <div className="course-modal-backdrop" role="presentation" onClick={closeAddCourseModal}>
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
                  <h3 id="branch-add-course-title">Add Course</h3>
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
                    value={addCourseForm.courseCode}
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
                  hint="Separate fee head; refundable or non-refundable as needed"
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
                  hint="Optional template only"
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

                <Field label="Default Final Fee (Auto Calculated)" hint="Standard fee + registration fee - default discount">
                  <input type="text" value={addCourseAfterDiscount} readOnly />
                </Field>

                <Field
                  label="Fee Plan Template"
                  required
                  hint="Choose 2, 3, or Custom"
                  error={shouldShowAddCourseError('installmentCount') ? addCourseValidationErrors.installmentCount : ''}
                >
                  <select
                    value={addCourseForm.installmentCount}
                    onChange={(event) => handleAddCourseInstallmentCountChange(event.target.value)}
                    onBlur={() => setAddCourseTouched((current) => ({ ...current, installmentCount: true }))}
                    aria-invalid={Boolean(shouldShowAddCourseError('installmentCount'))}
                  >
                    <option value="2">2 Installments</option>
                    <option value="3">3 Installments</option>
                    <option value="custom">Custom Installment</option>
                  </select>
                </Field>

                {addCourseForm.installmentCount === 'custom' ? (
                  <Field
                    label="Enter Custom Installment Count"
                    required
                    hint="Type how many installment fields you need"
                    error={shouldShowAddCourseError('customInstallmentCount') ? addCourseValidationErrors.customInstallmentCount : ''}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.customInstallmentCount}
                      onChange={(event) => handleAddCourseCustomInstallmentCountChange(event.target.value)}
                      onBlur={() => setAddCourseTouched((current) => ({ ...current, customInstallmentCount: true }))}
                      aria-invalid={Boolean(shouldShowAddCourseError('customInstallmentCount'))}
                    />
                  </Field>
                ) : null}

                {Array.from({ length: getEffectiveInstallmentCount(addCourseForm) }, (_, index) => index + 1).map((installmentNumber) => (
                  <Field
                    key={installmentNumber}
                    label={`Enter Installment ${installmentNumber}`}
                    required
                    hint="Numbers only"
                    error={shouldShowAddCourseError(`installment${installmentNumber}`) ? addCourseValidationErrors[`installment${installmentNumber}`] : ''}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={getInstallmentValue(addCourseForm, installmentNumber)}
                      onChange={(event) => {
                        const nextValue = event.target.value.replace(/[^\d]/g, '')
                        setAddCourseForm((current) => setInstallmentValue(current, installmentNumber, nextValue))
                      }}
                      onBlur={() => setAddCourseTouched((current) => ({ ...current, [`installment${installmentNumber}`]: true }))}
                      aria-invalid={Boolean(shouldShowAddCourseError(`installment${installmentNumber}`))}
                    />
                  </Field>
                ))}

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
                  {isAddCourseSaving ? 'Saving...' : 'Save Course'}
                </button>
              </div>

              <button type="button" className="course-modal-close" onClick={closeAddCourseModal} aria-label="Close course form" disabled={isAddCourseSaving}>
                X
              </button>
            </form>
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
