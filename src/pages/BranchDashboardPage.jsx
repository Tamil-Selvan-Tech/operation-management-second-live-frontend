import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getCountries, getStatesOfCountry, getCitiesOfState } from '@countrystatecity/countries-browser'
import {
  Bell,
  BookOpen,
  CircleUserRound,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
   X,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { getCurrentBranchProfile } from '../services/branchService'
import { listBranchFaculty } from '../services/branchFacultyService'
import {
  assignFacultyToBranchCourse,
  createBranchCourse,
  deleteBranchCourse,
  listBranchCourses,
  updateBranchCourse,
} from '../services/branchCourseService'
import {
  loadBranchStudents,
  saveBranchStudent,
  deleteBranchStudent as removeBranchStudent,
  getNextStudentId,
} from '../lib/branchStudentStore'
import { BranchFacultyPage } from './BranchFacultyPage'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/BranchDashboardPage.css'

const BRANCH_STUDENTS_PER_PAGE = 5

const CURRENT_YEAR = new Date().getFullYear()
const PASSED_OUT_YEARS = Array.from({ length: 31 }, (_, i) => String(CURRENT_YEAR - i))

function createInitialStudentForm(branchId) {
  return {
    studentId: getNextStudentId(branchId),
    studentName: '',
    emailAddress: '',
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
    studentName: student.studentName || '',
    emailAddress: student.emailAddress || '',
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

function validateStudentForm(form) {
  const errors = {}
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
  return errors
}

function formatStudentDate(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  const date = new Date(`${text}T00:00:00`)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
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

export function BranchDashboardPage({ embeddedMode = false, branchData = null }) {
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
  const [courseActionError, setCourseActionError] = useState('')
  const [courseSaveSuccess, setCourseSaveSuccess] = useState(null)
  const [addCourseForm, setAddCourseForm] = useState(() => createInitialBranchCourseForm())
  const [addCourseTouched, setAddCourseTouched] = useState({})
  const [branchCourseCards, setBranchCourseCards] = useState([])
  const [courseSearchTerm, setCourseSearchTerm] = useState('')
  const [branchCoursePage, setBranchCoursePage] = useState(1)
  const [editingCourseId, setEditingCourseId] = useState('')
  const [openCourseActionMenuId, setOpenCourseActionMenuId] = useState('')
  const [courseActionMenuPosition, setCourseActionMenuPosition] = useState({ top: 0, left: 0 })
  const [courseDeleteTarget, setCourseDeleteTarget] = useState(null)
  const [viewCourse, setViewCourse] = useState(null)

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
  const [studentForm, setStudentForm] = useState(() => createInitialStudentForm(''))
  const [studentFormTouched, setStudentFormTouched] = useState({})
  const [studentDeleteTarget, setStudentDeleteTarget] = useState(null)
  const [studentActionMenuId, setStudentActionMenuId] = useState('')
  const [studentActionMenuPinned, setStudentActionMenuPinned] = useState(false)
  const [viewStudentDrawer, setViewStudentDrawer] = useState(null)
  const [studentSuccessPopup, setStudentSuccessPopup] = useState(null)
  const [stuCountryOptions, setStuCountryOptions] = useState([])
  const [stuStateOptions, setStuStateOptions] = useState([])
  const [stuCityOptions, setStuCityOptions] = useState([])


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
  const courseActionCloseTimer = useRef(null)

  const loadBranchCourses = useCallback(async () => {
    const result = await listBranchCourses({
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

    setBranchCourseCards(Array.isArray(result?.data) ? result.data : [])
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

  useEffect(() => {
    if (!embeddedMode && (!isAuthenticated || role !== 'branch-admin')) {
      navigate('/login', { replace: true })
      return
    }

    let isMounted = true

    if (embeddedMode && branchData) {
      setBranchProfile(branchData)
      loadBranchCourses().then((coursesResult) => {
        if (!isMounted) return
        if (coursesResult.status === 'fulfilled' || coursesResult.data) {
          setBranchCourseCards(Array.isArray(coursesResult?.data) ? coursesResult.data : [])
        } else {
          setBranchCourseCards([])
        }
        setIsLoading(false)
      }).catch((error) => {
        if (!isMounted) return
        console.error('Failed to load courses in embedded mode:', error)
        setBranchCourseCards([])
        setIsLoading(false)
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
        setBranchCourseCards(Array.isArray(coursesResult.value?.data) ? coursesResult.value.data : [])
      } else {
        setBranchCourseCards([])
      }

      setIsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, loadBranchCourses, loadFacultyList, navigate, role, session, user])

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
    setActiveSection('profile')
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
    setCourseActionMenuPosition({ top: 0, left: 0 })
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
    setCourseActionMenuPosition({ top: 0, left: 0 })
    setIsAddCourseOpen(true)
    setActiveSection('courses')
  }

  const closeAddCourseModal = () => {
    setIsAddCourseOpen(false)
    setEditingCourseId('')
    setOpenCourseActionMenuId('')
    setCourseActionMenuPosition({ top: 0, left: 0 })
  }

  const closeCourseSaveSuccess = () => {
    setCourseSaveSuccess(null)
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
      const savedCourse = editingTargetId
        ? await updateBranchCourse(editingTargetId, payload)
        : await createBranchCourse(payload)

      const normalizedCourse = {
        ...savedCourse,
        batches: Number(savedCourse?.batchCount ?? savedCourse?.batches ?? 0),
        students: Number(savedCourse?.studentCount ?? savedCourse?.students ?? 0),
      }

      const nextCards = editingTargetId
        ? branchCourseCards.map((course) => (String(course.id || '').trim() === editingTargetId ? normalizedCourse : course))
        : [normalizedCourse, ...branchCourseCards]

      setBranchCourseCards(nextCards)
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
  const branchId = branchProfile?.branchId || ''

  const reloadBranchStudents = useCallback(() => {
    if (!branchId) return
    setBranchStudents(loadBranchStudents(branchId))
  }, [branchId])

  useEffect(() => {
    reloadBranchStudents()
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
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
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

  const studentFormValidationErrors = useMemo(() => validateStudentForm(studentForm), [studentForm])
  const shouldShowStudentError = (field) => Boolean(studentFormTouched[field] && studentFormValidationErrors[field])

  const updateStudentField = (field, value) => {
    setStudentForm((c) => ({ ...c, [field]: value }))
  }

  const openAddStudentForm = () => {
    setStudentFormMode('add')
    setStudentForm(createInitialStudentForm(branchId))
    setStudentFormTouched({})
    setIsStudentFormOpen(true)
  }

  const openViewStudentForm = (stu) => {
    setStudentFormMode('view')
    setStudentForm(buildStudentFormFromRecord(stu))
    setStudentFormTouched({})
    // Load the saved country/state for view
    if (stu.countryCode) {
      getStatesOfCountry(stu.countryCode).then((items) => {
        setStuStateOptions(Array.isArray(items) ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))) : [])
      }).catch(() => setStuStateOptions([]))
      if (stu.stateCode) {
        getCitiesOfState(stu.countryCode, stu.stateCode).then((items) => {
          setStuCityOptions(Array.isArray(items) ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))) : [])
        }).catch(() => setStuCityOptions([]))
      }
    }
    setIsStudentFormOpen(true)
  }

  const openEditStudentForm = (stu) => {
    setStudentFormMode('edit')
    setStudentForm(buildStudentFormFromRecord(stu))
    setStudentFormTouched({})
    if (stu.countryCode) {
      getStatesOfCountry(stu.countryCode).then((items) => {
        setStuStateOptions(Array.isArray(items) ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))) : [])
      }).catch(() => setStuStateOptions([]))
      if (stu.stateCode) {
        getCitiesOfState(stu.countryCode, stu.stateCode).then((items) => {
          setStuCityOptions(Array.isArray(items) ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))) : [])
        }).catch(() => setStuCityOptions([]))
      }
    }
    setIsStudentFormOpen(true)
  }

  const handleStudentFormSubmit = (e) => {
    e?.preventDefault()
    if (studentFormMode === 'view') return

    // Touch all fields
    const allTouched = {}
    Object.keys(studentFormValidationErrors).forEach((k) => { allTouched[k] = true })
    allTouched.studentName = true
    allTouched.emailAddress = true
    allTouched.mobileNumber = true
    allTouched.parentSpouseNumber = true
    allTouched.country = true
    allTouched.state = true
    allTouched.city = true
    allTouched.address = true
    allTouched.qualification = true
    allTouched.passedOutYear = true
    allTouched.currentStatus = true
    allTouched.source = true
    allTouched.admissionDate = true
    if (studentForm.currentStatus === 'Employee') allTouched.designation = true
    if (studentForm.passedOutYear === 'Custom') allTouched.passedOutYearCustom = true
    if (studentForm.source === 'Others') allTouched.sourceOther = true
    setStudentFormTouched(allTouched)

    if (Object.keys(studentFormValidationErrors).length > 0) return

    const record = {
      ...studentForm,
      branchId,
      passedOutYear: studentForm.passedOutYear === 'Custom' ? studentForm.passedOutYearCustom : studentForm.passedOutYear,
      source: studentForm.source === 'Others' ? studentForm.sourceOther : studentForm.source,
    }

    saveBranchStudent(record)
    reloadBranchStudents()
    setIsStudentFormOpen(false)

    if (studentFormMode === 'add') {
      setStudentSuccessPopup({ title: 'Student Added', message: 'Student added successfully.' })
    } else {
      setStudentSuccessPopup({ title: 'Student Updated', message: 'Student updated successfully.' })
    }
  }

  const handleStudentDeleteConfirm = () => {
    if (!studentDeleteTarget) return
    removeBranchStudent(studentDeleteTarget.studentId)
    reloadBranchStudents()
    setStudentDeleteTarget(null)
    setStudentSuccessPopup({ title: 'Student Deleted', message: 'Student deleted successfully.' })
    // Adjust page if needed
    const nextCount = branchStudents.length - 1
    const nextPages = Math.max(1, Math.ceil(nextCount / BRANCH_STUDENTS_PER_PAGE))
    setStudentPage((c) => Math.min(c, nextPages))
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
      <div className="branch-dashboard-topbar-title">
        <h1>Branch Dashboard</h1>
      </div>
      <div className="super-admin-topbar-right">
        {!embeddedMode && (
          <button type="button" className="super-admin-notification-button" aria-label="Notifications">
            <Bell size={22} strokeWidth={2.1} />
            <span className="super-admin-notification-badge">8</span>
          </button>
        )}

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
                    <div className="faculty-search-wrapper" style={{ display: 'flex', gap: '8px', width: '340px' }}>
                      <input
                        type="text"
                        placeholder="Search Student..."
                        value={studentSearchTerm}
                        onChange={(e) => { setStudentSearchTerm(e.target.value); setStudentPage(1) }}
                        className="faculty-search-input"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button
                        type="button"
                        className="button button-solid"
                        style={{ padding: '0 20px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Search size={16} />
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
                          visibleBranchStudents.map((stu) => (
                            <tr key={stu.studentId}>
                              <td><strong>{stu.studentId}</strong></td>
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
                                          setViewStudentDrawer(stu)
                                        }}
                                      >
                                        <Eye size={15} />
                                        <span>View</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStudentActionMenuId('')
                                          openEditStudentForm(stu)
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
                                          setStudentDeleteTarget(stu)
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
                          ))
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
                    <div className="faculty-search-wrapper" style={{ display: 'flex', gap: '8px', width: '300px' }}>
                      <input
                        type="text"
                        placeholder="Search courses..."
                        value={courseSearchTerm}
                        onChange={(e) => setCourseSearchTerm(e.target.value)}
                        className="faculty-search-input"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button
                        type="button"
                        className="button button-solid"
                        style={{ padding: '0 20px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Search size={16} />
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

              {/* Details */}
              <div className="branch-course-view-body">

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
        {viewStudentDrawer ? (
          <div
            className="student-drawer-backdrop"
            onClick={() => setViewStudentDrawer(null)}
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
                  className="button button-ghost"
                  onClick={() => setViewStudentDrawer(null)}
                >
                  Close
                </button>

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
            onClick={() => setViewStudentDrawer(null)}
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
                  <div className="student-details-row">
                    <div className="student-details-label">
                      Address
                    </div>
                    <div className="student-details-value">
                      {viewStudentDrawer.address || '-'}
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

              <div className="course-form-grid">
                <Field label="Student ID">
                  <input type="text" value={studentForm.studentId} readOnly disabled />
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

              {studentFormMode !== 'view' && Object.keys(studentFormTouched).length > 0 && Object.keys(studentFormValidationErrors).length > 0 ? (
                <div className="course-validation-note course-validation-error" style={{ color: '#dc2626' }}>
                  <span style={{ color: '#dc2626' }}>
                    {Object.values(studentFormValidationErrors)[0] || 'Please fill all required fields.'}
                  </span>
                </div>
              ) : null}

              <div className="course-form-actions">
                {studentFormMode === 'view' ? (
                  <button type="button" className="button button-ghost" onClick={() => setIsStudentFormOpen(false)}>Close</button>
                ) : (
                  <>
                    <button type="button" className="button button-ghost" onClick={() => setIsStudentFormOpen(false)}>Cancel</button>
                    <button type="submit" className="button button-solid">
                      {studentFormMode === 'add' ? 'Submit' : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>

              <button
  type="button"
  className="course-modal-close"
  onClick={() => setIsStudentFormOpen(false)}
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
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="branch-modal-submit is-danger"
                  onClick={handleStudentDeleteConfirm}
                >
                  Delete
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
