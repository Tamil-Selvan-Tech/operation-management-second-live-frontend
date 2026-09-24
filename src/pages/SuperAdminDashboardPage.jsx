import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getCitiesOfState, getCountries, getStatesOfCountry } from '@countrystatecity/countries-browser'
import {
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  CircleUserRound,
  CheckCircle2,
  Mail,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MoreVertical,
  ChevronRight,
  MapPin,
  Phone,
  Menu,
  X,
  Shield,
  UserRound,
  Users,
  ChevronDown,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { createBranch, deleteBranch, listBranches, resendBranchInvitation, updateBranch } from '../services/branchService'
import {
  addBranchLoginNotification,
  hasBranchNotification,
} from '../lib/notificationStore'
import { PaginationBar } from '../components/PaginationBar'
import { SuperAdminNotificationBell } from '../components/SuperAdminNotificationBell'
import { BranchDashboardPage } from './BranchDashboardPage'
import { Student360Page } from './Student360Page'
import { request, setImpersonateBranchId } from '../services/apiClient'
import { SuperAdminOverallDashboard } from '../components/SuperAdminOverallDashboard'
import '../styles/SuperAdminDashboardPage.css'

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
      <CircleUserRound size={28} strokeWidth={1.9} />
      <span className="super-admin-sidebar-user-status" />
    </span>
  )
}

function formatToday() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(value) {
  const text = String(value || '').trim()
  if (!text) return '-'

  const date = new Date(`${text}T00:00:00`)
  if (Number.isNaN(date.getTime())) return text

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getResendMailStatus(branch) {
  const status = String(branch?.resendMailStatus || (branch?.welcomeMailSent ? 'Active' : 'Inactive'))
    .trim()
    .toLowerCase()

  return status === 'active' ? 'Active' : 'Inactive'
}

function isResendMailActive(branch) {
  return getResendMailStatus(branch) === 'Active'
}

function getNormalizedBranchStatus(branch = {}) {
  return String(branch?.status || '').trim().toLowerCase() === 'active' ? 'Active' : 'Inactive'
}

function getNormalizedResendMailStatus(branch = {}) {
  return getResendMailStatus(branch)
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }

  return ''
}

function getBranchFilterWidth(value, branches = []) {
  if (value === 'all') return 175
  const selectedBranch = branches.find((branch) => String(branch.id || branch.branchId) === String(value))
  const labelLength = String(selectedBranch?.branchName || selectedBranch?.branchId || '').length
  return Math.min(320, Math.max(175, Math.round(labelLength * 7.4 + 58)))
}

function BranchFilterSelect({ value, branches, onChange, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const selectedBranch = branches.find((branch) => String(branch.id || branch.branchId) === String(value))
  const selectedLabel = value === 'all' ? 'All branches' : (selectedBranch?.branchName || selectedBranch?.branchId || 'Select branch')

  useEffect(() => {
    if (!isOpen) return undefined
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  return (
    <div ref={containerRef} className={`super-admin-branch-filter ${isOpen ? 'is-open' : ''}`.trim()} style={{ width: `${getBranchFilterWidth(value, branches)}px` }}>
      <button type="button" className="super-admin-branch-filter-trigger" aria-label={ariaLabel} aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        <span>{selectedLabel}</span>
        <ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="super-admin-branch-filter-menu" role="listbox" aria-label={ariaLabel}>
          <button type="button" role="option" aria-selected={value === 'all'} className={`super-admin-branch-filter-option ${value === 'all' ? 'is-selected' : ''}`.trim()} onClick={() => { onChange('all'); setIsOpen(false) }}>All branches</button>
          {branches.map((branch) => {
            const branchValue = branch.id || branch.branchId
            const isSelected = String(branchValue) === String(value)
            return <button key={branchValue} type="button" role="option" aria-selected={isSelected} className={`super-admin-branch-filter-option ${isSelected ? 'is-selected' : ''}`.trim()} onClick={() => { onChange(String(branchValue)); setIsOpen(false) }}>{branch.branchName || branch.branchId || 'Unnamed branch'}</button>
          })}
        </div>
      ) : null}
    </div>
  )
}

const DEFAULT_BRANCH_COUNTRY_NAME = 'India'
const DEFAULT_BRANCH_STATE_NAME = 'Tamil Nadu'

function getDefaultBranchCountry(countryOptions = []) {
  return (Array.isArray(countryOptions) ? countryOptions : []).find((item) => {
    const name = String(item?.name || '').trim().toLowerCase()
    const iso2 = String(item?.iso2 || '').trim().toUpperCase()
    return name === DEFAULT_BRANCH_COUNTRY_NAME.toLowerCase() || iso2 === 'IN'
  })
}

function getDefaultBranchState(stateOptions = []) {
  return (Array.isArray(stateOptions) ? stateOptions : []).find((item) => {
    const name = String(item?.name || '').trim().toLowerCase()
    const iso2 = String(item?.iso2 || '').trim().toUpperCase()
    return name === DEFAULT_BRANCH_STATE_NAME.toLowerCase() || iso2 === 'TN'
  })
}

function validateBranchField(field, value) {
  const text = String(value || '').trim()

  switch (field) {
    case 'branchId':
      if (!text) return 'Branch ID is required'
      if (!/^(?:CIS)?[A-Z]{2,12}\d{3}$/.test(text)) return 'Enter a branch code such as SAI001'
      return ''
    case 'branchName':
      if (!text) return 'Branch name is required'
      if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(text)) return 'Branch name must contain letters only'
      return ''
    case 'branchAdminName':
      if (!text) return 'Branch admin name is required'
      if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(text)) return 'Branch admin name must contain letters only'
      return ''
    case 'branchEmail':
      if (!text) return 'Email is required'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'Enter a valid email address'
      return ''
    case 'branchPhone':
      if (!text) return 'Phone number is required'
      if (!/^\d{10}$/.test(text)) return 'Phone number must be exactly 10 digits'
      return ''
    case 'branchCountry':
      if (!text) return 'Country is required'
      return ''
    case 'branchState':
      if (!text) return 'State is required'
      return ''
    case 'branchDistrict':
      if (!text) return 'City is required'
      return ''
    case 'branchAddress':
      if (!text) return 'Address is required'
      return ''
    default:
      return ''
  }
}

function getDuplicateBranchEmailError(branchEmail, existingBranches = [], ignoreBranchId = null) {
  const normalizedEmail = String(branchEmail || '').trim().toLowerCase()
  if (!normalizedEmail) return ''

  const normalizedIgnoreBranchId = ignoreBranchId == null ? null : String(ignoreBranchId).trim().toLowerCase()
  const branchesList = (Array.isArray(existingBranches) ? existingBranches : []).filter(
    (branch) => String(branch?.id || '').trim().toLowerCase() !== normalizedIgnoreBranchId,
  )

  const emailExists = branchesList.some(
    (branch) => String(branch?.branchEmail || '').trim().toLowerCase() === normalizedEmail,
  )

  return emailExists ? 'Email already exists' : ''
}

function getDuplicateBranchPhoneError(branchPhone, existingBranches = [], ignoreBranchId = null) {
  const normalizedPhone = String(branchPhone || '').trim().replace(/\D+/g, '')
  if (!normalizedPhone) return ''

  const normalizedIgnoreBranchId = ignoreBranchId == null ? null : String(ignoreBranchId).trim().toLowerCase()
  const branchesList = (Array.isArray(existingBranches) ? existingBranches : []).filter(
    (branch) => String(branch?.id || '').trim().toLowerCase() !== normalizedIgnoreBranchId,
  )

  const phoneExists = branchesList.some(
    (branch) => String(branch?.branchPhone || '').trim().replace(/\D+/g, '') === normalizedPhone,
  )

  return phoneExists ? 'Branch phone number already exists' : ''
}

function validateBranchForm(form, existingBranches = [], ignoreBranchId = null) {
  const normalizedBranchId = String(form.branchId || '').trim().toLowerCase()
  const normalizedIgnoreBranchId = ignoreBranchId == null ? null : String(ignoreBranchId).trim().toLowerCase()
  const branchesList = (Array.isArray(existingBranches) ? existingBranches : []).filter(
    (branch) => String(branch?.id || '').trim().toLowerCase() !== normalizedIgnoreBranchId,
  )
  const branchIdExists = branchesList.some(
    (branch) => String(branch?.branchId || '').trim().toLowerCase() === normalizedBranchId,
  )
  const duplicateEmailError = getDuplicateBranchEmailError(form.branchEmail, existingBranches, ignoreBranchId)
  const duplicatePhoneError = getDuplicateBranchPhoneError(form.branchPhone, existingBranches, ignoreBranchId)

  return {
    branchId:
      validateBranchField('branchId', form.branchId) ||
      (normalizedBranchId && branchIdExists ? 'Branch ID already exists' : ''),
    branchName: validateBranchField('branchName', form.branchName),
    branchAdminName: validateBranchField('branchAdminName', form.branchAdminName),
    branchEmail: validateBranchField('branchEmail', form.branchEmail) || duplicateEmailError,
    branchPhone: validateBranchField('branchPhone', form.branchPhone) || duplicatePhoneError,
    branchCountry: validateBranchField('branchCountry', form.branchCountry),
    branchState: validateBranchField('branchState', form.branchState),
    branchDistrict: validateBranchField('branchDistrict', form.branchDistrict),
    branchAddress: validateBranchField('branchAddress', form.branchAddress),
  }
}

function getInitialSuperAdminSection(search = '') {
  const params = new URLSearchParams(search)
  const section = params.get('section')
  return ['branches', 'branch-admin', 'faculty', 'students', 'leave-management', 'faculty-leave'].includes(section) ? section : 'dashboard'
}

export function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut, user } = useAuth()
  const [activeSection, setActiveSection] = useState(() => getInitialSuperAdminSection(location.search))
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem('cispro.super-admin-sidebar-collapsed') === 'true' } catch { return false }
  })
  const [isBranchesExpanded, setIsBranchesExpanded] = useState(false)
  const [branches, setBranches] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [allBranchStudents, setAllBranchStudents] = useState([])
  const [allBranchFaculty, setAllBranchFaculty] = useState([])
  const [allBranchLeaves, setAllBranchLeaves] = useState([])
  const [globalFacultyPage, setGlobalFacultyPage] = useState(1)
  const [globalStudentPage, setGlobalStudentPage] = useState(1)
  const [globalLeavePage, setGlobalLeavePage] = useState(1)
  const [globalFacultyBranchFilter, setGlobalFacultyBranchFilter] = useState('all')
  const [globalStudentBranchFilter, setGlobalStudentBranchFilter] = useState('all')
  const [isGlobalManagementLoading, setIsGlobalManagementLoading] = useState(false)
  const [globalManagementError, setGlobalManagementError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false)
const statusFilterRef = useRef(null)
  const [isBranchManagementExpanded, setIsBranchManagementExpanded] = useState(false)
  const [isUserRoleManagementExpanded, setIsUserRoleManagementExpanded] = useState(true)
  const [isAcademicOperationsExpanded, setIsAcademicOperationsExpanded] = useState(true)
  const [isSidebarFlyoutDismissed, setIsSidebarFlyoutDismissed] = useState(false)
  const [countryOptions, setCountryOptions] = useState([])
  const [stateOptions, setStateOptions] = useState([])
  const [cityOptions, setCityOptions] = useState([])
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isResendConfirmOpen, setIsResendConfirmOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isSuperAdminProfileOpen, setIsSuperAdminProfileOpen] = useState(false)
  const [viewTargetBranch, setViewTargetBranch] = useState(null)
  
  // Immersive Dashboard viewing states
  const [viewDashboardBranch, setViewDashboardBranch] = useState(null)
  const [isViewDashboardConfirmOpen, setIsViewDashboardConfirmOpen] = useState(false)
  const [embeddedBranch, setEmbeddedBranch] = useState(null)
  const [superAdminStudentView, setSuperAdminStudentView] = useState(null)
  const [isExitDashboardConfirmOpen, setIsExitDashboardConfirmOpen] = useState(false)

  const [editingBranchId, setEditingBranchId] = useState(null)
  const [deleteTargetBranch, setDeleteTargetBranch] = useState(null)
  const [resendTargetBranch, setResendTargetBranch] = useState(null)
  const [actionMenuBranchId, setActionMenuBranchId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [successMessage, setSuccessMessage] = useState('')
  const [successTitle, setSuccessTitle] = useState('Action completed successfully')
  const [branchErrors, setBranchErrors] = useState({})
  const [actionError, setActionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const previousBranchSnapshotRef = useRef(null)
  const actionMenuCloseTimerRef = useRef(null)
  const [form, setForm] = useState({
    branchId: '',
    branchName: '',
    status: 'Active',
    branchAdminName: '',
    branchEmail: '',
    branchPhone: '',
    branchCountryCode: '',
    branchCountry: '',
    branchStateCode: '',
    branchState: '',
    branchDistrict: '',
    branchAddress: '',
  })
  const loadBranches = useCallback(async () => {
    try {
      const result = await listBranches({
        page: 1,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      const nextBranches = Array.isArray(result?.data) ? result.data : []
      const previousSnapshot = previousBranchSnapshotRef.current

      if (previousSnapshot) {
        nextBranches.forEach((branch) => {
          const previousBranch = previousSnapshot.get(String(branch.id))
          if (!previousBranch) return

          const nextStatus = getNormalizedBranchStatus(branch)
          const previousStatus = previousBranch.status
          if (previousStatus !== 'Active' && nextStatus === 'Active') {
            addBranchLoginNotification(branch)
          }

        })
      }

      nextBranches.forEach((branch) => {
        const hasRecentLoginStamp = Boolean(String(branch?.lastLoginAt || '').trim())
        if (!hasRecentLoginStamp) return

        if (getNormalizedBranchStatus(branch) === 'Active' && !hasBranchNotification('branch-login', branch)) {
          addBranchLoginNotification(branch)
        }

      })

      previousBranchSnapshotRef.current = new Map(
        nextBranches.map((branch) => [
          String(branch.id),
          {
            status: getNormalizedBranchStatus(branch),
            resendMailStatus: getNormalizedResendMailStatus(branch),
          },
        ]),
      )

      setBranches(nextBranches)
    } catch {
      setBranches([])
    }
  }, [])
  const isOverlayOpen =
    isAddBranchOpen ||
    isSuccessOpen ||
    isDeleteConfirmOpen ||
    isResendConfirmOpen ||
    isLogoutConfirmOpen ||
    Boolean(viewTargetBranch) ||
    isViewDashboardConfirmOpen ||
    isExitDashboardConfirmOpen ||
    isMobileSidebarOpen

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadBranches()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [loadBranches])

  useEffect(() => {
    if (!branches.length) {
      setAllBranchStudents([])
      return undefined
    }

    let cancelled = false
    const loadStudents = async () => {
      const results = await Promise.all(
        branches
          .map(async (branch) => {
            const branchId = branch.id || branch.branchId
            if (!branchId) return []

            try {
              const rows = []
              let page = 1
              let totalPages = 1

              do {
                const response = await request(`/branch-students?page=${page}&limit=100&sortBy=createdAt&sortOrder=desc&branchId=${encodeURIComponent(branchId)}`, {
                  impersonateBranchId: branchId,
                })
                const payload = response?.data ?? response
                const pageRows = Array.isArray(payload)
                  ? payload
                  : Array.isArray(payload?.data)
                    ? payload.data
                    : Array.isArray(payload?.items)
                      ? payload.items
                      : Array.isArray(payload?.records)
                        ? payload.records
                        : []
                rows.push(...pageRows)
                const meta = response?.meta || payload?.meta || payload?.pagination || payload?.pageInfo
                totalPages = Math.max(1, Number(meta?.totalPages || 1))
                page += 1
              } while (page <= totalPages && page <= 100)

              return rows.map((student) => ({
                ...student,
                branchId: student.branchId || student.branchCode || branchId,
                branchCode: student.branchCode || student.branchId || branch.branchCode || branch.branchId,
                branchRecord: branch,
              }))
            } catch {
              return []
            }
          }),
      )

      if (!cancelled) setAllBranchStudents(results.flat())
    }

    void loadStudents()
    return () => {
      cancelled = true
    }
  }, [branches])

  useEffect(() => {
    if (!branches.length) {
      setAllBranchFaculty([])
      setAllBranchLeaves([])
      return undefined
    }

    let cancelled = false
    const loadGlobalManagementData = async () => {
      setIsGlobalManagementLoading(true)
      setGlobalManagementError('')
      try {
        const facultyResponse = await request('/branch-faculty?page=1&limit=1000&sortBy=createdAt&sortOrder=desc')
        const facultyPayload = facultyResponse?.data ?? facultyResponse
        const facultyRows = Array.isArray(facultyPayload)
          ? facultyPayload
          : Array.isArray(facultyPayload?.data) ? facultyPayload.data : []

        const leaveResults = await Promise.all(branches.map(async (branch) => {
          const branchId = branch.id || branch.branchId
          if (!branchId) return []
          try {
            const facultyLeaveResponse = await request('/faculty-leave-requests/branch', { impersonateBranchId: branchId })
            const facultyLeaves = facultyLeaveResponse?.data?.requests || facultyLeaveResponse?.requests || []
            return facultyLeaves.map((item) => ({ ...item, leaveCategory: 'Faculty Leave Request', branchRecord: branch }))
          } catch {
            return []
          }
        }))

        if (!cancelled) {
          setAllBranchFaculty(facultyRows.map((item) => ({
            ...item,
            branchRecord: branches.find((branch) => [branch.id, branch.branchId, branch.branchCode]
              .map((value) => String(value || '').trim().toLowerCase())
              .includes(String(item.branchId || item.branchCode || item.branch?.id || item.branch?.branchId || '').trim().toLowerCase())) || null,
          })))
          setAllBranchLeaves(leaveResults.flat())
        }
      } catch (error) {
        if (!cancelled) {
          setAllBranchFaculty([])
          setAllBranchLeaves([])
          setGlobalManagementError(error?.message || 'Unable to load global management data.')
        }
      } finally {
        if (!cancelled) setIsGlobalManagementLoading(false)
      }
    }

    void loadGlobalManagementData()
    return () => { cancelled = true }
  }, [branches])

  useEffect(() => {
  const handleWindowFocus = () => {
    void loadBranches()
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void loadBranches()
    }
  }

  window.addEventListener('focus', handleWindowFocus)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.removeEventListener('focus', handleWindowFocus)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [loadBranches])

useEffect(() => {
  if (!isStatusFilterOpen) return undefined

  const handleOutsideClick = (event) => {
    const target = event.target

    if (!(target instanceof Element)) return

    if (!statusFilterRef.current?.contains(target)) {
      setIsStatusFilterOpen(false)
    }
  }

  document.addEventListener('pointerdown', handleOutsideClick)

  return () => {
    document.removeEventListener('pointerdown', handleOutsideClick)
  }
}, [isStatusFilterOpen])
  useEffect(() => {
    let cancelled = false

    getCountries()
      .then((items) => {
        if (cancelled) return

        const nextCountries = Array.isArray(items)
          ? [...items].sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
          : []

        setCountryOptions(nextCountries)
      })
      .catch(() => {
        if (!cancelled) {
          setCountryOptions([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!form.branchCountryCode) {
      queueMicrotask(() => {
        setStateOptions([])
        setCityOptions([])
      })
      return undefined
    }

    let cancelled = false

    getStatesOfCountry(form.branchCountryCode)
      .then((items) => {
        if (cancelled) return

        const nextStates = Array.isArray(items)
          ? [...items].sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
          : []

        setStateOptions(nextStates)
      })
      .catch(() => {
        if (!cancelled) {
          setStateOptions([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [form.branchCountryCode])

  useEffect(() => {
    if (!form.branchCountryCode || !form.branchStateCode) {
      queueMicrotask(() => {
        setCityOptions([])
      })
      return undefined
    }

    let cancelled = false

    getCitiesOfState(form.branchCountryCode, form.branchStateCode)
      .then((items) => {
        if (cancelled) return

        const nextCities = Array.isArray(items)
          ? [...items].sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
          : []

        setCityOptions(nextCities)
      })
      .catch(() => {
        if (!cancelled) {
          setCityOptions([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [form.branchCountryCode, form.branchStateCode])

  useEffect(() => {
    if (!isAddBranchOpen || editingBranchId !== null || form.branchCountryCode || !countryOptions.length) return undefined

    const defaultCountry = getDefaultBranchCountry(countryOptions)
    if (!defaultCountry) return undefined

    queueMicrotask(() => {
      setForm((current) => {
        if (current.branchCountryCode) return current
        return {
          ...current,
          branchCountryCode: defaultCountry.iso2 || '',
          branchCountry: defaultCountry.name || DEFAULT_BRANCH_COUNTRY_NAME,
        }
      })
    })

    return undefined
  }, [countryOptions, editingBranchId, form.branchCountryCode, isAddBranchOpen])

  useEffect(() => {
    if (
      !isAddBranchOpen ||
      editingBranchId !== null ||
      !form.branchCountryCode ||
      form.branchStateCode ||
      !stateOptions.length
    ) {
      return undefined
    }

    if (String(form.branchCountryCode || '').trim().toUpperCase() !== 'IN') return undefined

    const defaultState = getDefaultBranchState(stateOptions)
    if (!defaultState) return undefined

    queueMicrotask(() => {
      setForm((current) => {
        if (current.branchStateCode) return current
        return {
          ...current,
          branchStateCode: defaultState.iso2 || '',
          branchState: defaultState.name || DEFAULT_BRANCH_STATE_NAME,
        }
      })
    })

    return undefined
  }, [editingBranchId, form.branchCountryCode, form.branchStateCode, isAddBranchOpen, stateOptions])

  useEffect(() => {
    if (form.branchCountryCode || !form.branchCountry || !countryOptions.length) return undefined

    const matchedCountry = countryOptions.find((item) => String(item?.name || '') === String(form.branchCountry || ''))
    if (!matchedCountry) return undefined

    queueMicrotask(() => {
      setForm((current) => ({
        ...current,
        branchCountryCode: matchedCountry.iso2 || '',
      }))
    })
    return undefined
  }, [countryOptions, form.branchCountry, form.branchCountryCode])

  useEffect(() => {
    if (!form.branchCountryCode || form.branchCountry || !countryOptions.length) return undefined

    const matchedCountry = countryOptions.find((item) => String(item?.iso2 || '') === String(form.branchCountryCode || ''))
    if (!matchedCountry) return undefined

    queueMicrotask(() => {
      setForm((current) => ({
        ...current,
        branchCountry: matchedCountry.name || '',
      }))
    })
    return undefined
  }, [countryOptions, form.branchCountry, form.branchCountryCode])

  useEffect(() => {
    if (form.branchStateCode || !form.branchState || !stateOptions.length) return undefined

    const matchedState = stateOptions.find((item) => String(item?.name || '') === String(form.branchState || ''))
    if (!matchedState) return undefined

    queueMicrotask(() => {
      setForm((current) => ({
        ...current,
        branchStateCode: matchedState.iso2 || '',
      }))
    })
    return undefined
  }, [stateOptions, form.branchState, form.branchStateCode])

  useEffect(() => {
    if (!form.branchStateCode || form.branchState || !stateOptions.length) return undefined

    const matchedState = stateOptions.find((item) => String(item?.iso2 || '') === String(form.branchStateCode || ''))
    if (!matchedState) return undefined

    queueMicrotask(() => {
      setForm((current) => ({
        ...current,
        branchState: matchedState.name || '',
      }))
    })
    return undefined
  }, [stateOptions, form.branchState, form.branchStateCode])

  useEffect(() => {
    if (
      !isAddBranchOpen &&
      !isSuccessOpen &&
      !isDeleteConfirmOpen &&
      !isResendConfirmOpen &&
      !isLogoutConfirmOpen &&
      !viewTargetBranch &&
      !isMobileSidebarOpen
    ) {
      return undefined
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAddBranchOpen(false)
        setIsSuccessOpen(false)
        setIsDeleteConfirmOpen(false)
        setIsResendConfirmOpen(false)
        setIsLogoutConfirmOpen(false)
        setViewTargetBranch(null)
        setDeleteTargetBranch(null)
        setResendTargetBranch(null)
        setEditingBranchId(null)
        setIsMobileSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    isAddBranchOpen,
    isSuccessOpen,
    isDeleteConfirmOpen,
    isResendConfirmOpen,
    isLogoutConfirmOpen,
    viewTargetBranch,
    isMobileSidebarOpen,
  ])

  useEffect(() => {
    document.body.classList.toggle('super-admin-sidebar-open', isMobileSidebarOpen)

    return () => {
      document.body.classList.remove('super-admin-sidebar-open')
    }
  }, [isMobileSidebarOpen])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setActiveSection(getInitialSuperAdminSection(location.search))
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [location.search])

  useEffect(() => {
    if (!isOverlayOpen) {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      return undefined
    }

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight

    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = scrollBarWidth > 0 ? `${scrollBarWidth}px` : previousPaddingRight

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [isOverlayOpen])

  useEffect(() => {
    if (!actionMenuBranchId) return undefined

    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.branch-actions-wrap')) return
      setActionMenuBranchId(null)
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [actionMenuBranchId])

 

  const rowsPerPage = 5
  const totalBranches = branches.length
  const activeBranches = branches.filter((branch) => String(branch?.status || '').trim().toLowerCase() === 'active').length

const filteredBranches = useMemo(() => {
  const query = searchTerm.trim().toLowerCase()

  return branches.filter((branch) => {
    const matchesSearch =
      !query ||
      [branch.branchId, branch.branchName].some((value) =>
        String(value || '').toLowerCase().includes(query),
      )

    const branchStatus = getNormalizedBranchStatus(branch)

    const matchesStatus =
      statusFilter === 'All' || branchStatus === statusFilter

    return matchesSearch && matchesStatus
  })
}, [branches, searchTerm, statusFilter])

  const matchingStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return []

    return allBranchStudents
      .filter((student) => {
        const studentId = String(student.studentId || student.studentCode || student.id || '').trim().toLowerCase()
        const studentName = String(student.studentName || student.name || '').trim().toLowerCase()
        return studentId.includes(query) || studentName.includes(query)
      })
      .slice(0, 8)
  }, [allBranchStudents, searchTerm])

  const globalRowsPerPage = 10
  const globalBranchFilterOptions = useMemo(() => (
    [...branches].sort((first, second) => String(first.branchName || first.branchId || '').localeCompare(String(second.branchName || second.branchId || '')))
  ), [branches])
  const filteredGlobalFaculty = useMemo(() => {
    if (globalFacultyBranchFilter === 'all') return allBranchFaculty
    const selectedBranchKey = String(globalFacultyBranchFilter).trim().toLowerCase()
    return allBranchFaculty.filter((faculty) => [
      faculty.branchId,
      faculty.branchCode,
      faculty.branch?.id,
      faculty.branch?.branchId,
      faculty.branchRecord?.id,
      faculty.branchRecord?.branchId,
      faculty.branchRecord?.branchCode,
    ].map((value) => String(value || '').trim().toLowerCase()).includes(selectedBranchKey))
  }, [allBranchFaculty, globalFacultyBranchFilter])
  const filteredGlobalStudents = useMemo(() => {
    if (globalStudentBranchFilter === 'all') return allBranchStudents
    const selectedBranchKey = String(globalStudentBranchFilter).trim().toLowerCase()
    return allBranchStudents.filter((student) => [
      student.branchId,
      student.branchCode,
      student.branch?.id,
      student.branch?.branchId,
      student.branchRecord?.id,
      student.branchRecord?.branchId,
      student.branchRecord?.branchCode,
    ].map((value) => String(value || '').trim().toLowerCase()).includes(selectedBranchKey))
  }, [allBranchStudents, globalStudentBranchFilter])
  const globalFacultyTotalPages = Math.max(1, Math.ceil(filteredGlobalFaculty.length / globalRowsPerPage))
  const globalStudentTotalPages = Math.max(1, Math.ceil(filteredGlobalStudents.length / globalRowsPerPage))
  const globalLeaveTotalPages = Math.max(1, Math.ceil(allBranchLeaves.length / globalRowsPerPage))
  const safeGlobalFacultyPage = Math.min(globalFacultyPage, globalFacultyTotalPages)
  const safeGlobalStudentPage = Math.min(globalStudentPage, globalStudentTotalPages)
  const safeGlobalLeavePage = Math.min(globalLeavePage, globalLeaveTotalPages)
  const paginatedGlobalFaculty = filteredGlobalFaculty.slice((safeGlobalFacultyPage - 1) * globalRowsPerPage, safeGlobalFacultyPage * globalRowsPerPage)
  const paginatedGlobalStudents = filteredGlobalStudents.slice((safeGlobalStudentPage - 1) * globalRowsPerPage, safeGlobalStudentPage * globalRowsPerPage)
  const paginatedGlobalLeaves = allBranchLeaves.slice((safeGlobalLeavePage - 1) * globalRowsPerPage, safeGlobalLeavePage * globalRowsPerPage)

  const openStudent360FromSearch = (student) => {
    const studentKey = student?.studentId || student?.studentCode || student?.id || student?._id || ''
    if (!studentKey) return

    const branchKey = String(
      student?.branchId ||
      student?.branchCode ||
      student?.branch?.id ||
      student?.branch?.branchId ||
      student?.branchRecord?.id ||
      student?.branchRecord?.branchId ||
      '',
    ).trim().toLowerCase()
    const branch = branches.find((item) => [item.id, item.branchId, item.branchCode]
      .map((value) => String(value || '').trim().toLowerCase())
      .includes(branchKey))
      || student?.branchRecord
      || {
        id: student?.branchId || student?.branchCode,
        branchId: student?.branchId || student?.branchCode,
        branchCode: student?.branchCode || student?.branchId,
        branchName: student?.branch?.branchName || student?.branchName || 'Branch',
      }

    setSearchTerm('')
    setEmbeddedBranch(branch)
    setImpersonateBranchId(branch.id || branch.branchId)
    navigate({
      pathname: location.pathname,
      search: `?section=student-360&student=${encodeURIComponent(studentKey)}`,
    })
  }

  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedBranches = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * rowsPerPage
    return filteredBranches.slice(startIndex, startIndex + rowsPerPage)
  }, [filteredBranches, rowsPerPage, safeCurrentPage])

  const openAddBranch = () => {
    setBranchErrors({})
    setEditingBranchId(null)
    setActionMenuBranchId(null)
    setIsMobileSidebarOpen(false)
    setSuccessTitle('Create branch invitation sent')
    setSuccessMessage('')
    setActionError('')
    const defaultCountry = getDefaultBranchCountry(countryOptions)
    setForm({
      branchId: '',
      branchName: '',
      status: 'Active',
      branchAdminName: '',
      branchEmail: '',
      branchPhone: '',
      branchCountryCode: defaultCountry?.iso2 || '',
      branchCountry: defaultCountry?.name || '',
      branchStateCode: '',
      branchState: '',
      branchDistrict: '',
      branchAddress: '',
    })
    setIsAddBranchOpen(true)
  }

  const openEditBranch = (branch) => {
    setBranchErrors({})
    setEditingBranchId(branch.id)
    setActionMenuBranchId(null)
    setIsMobileSidebarOpen(false)
    setActionError('')
    setForm({
      branchId: branch.branchId || '',
      branchName: branch.branchName || '',
      status: branch.status ? getNormalizedBranchStatus(branch) : 'Active',
      branchAdminName: branch.branchAdminName || '',
      branchEmail: branch.branchEmail || '',
      branchPhone: String(branch.branchPhone || '').replace(/\D+/g, '').slice(0, 10),
      branchCountryCode: branch.branchCountryCode || '',
      branchCountry: branch.branchCountry || '',
      branchStateCode: branch.branchStateCode || '',
      branchState: branch.branchState || '',
      branchDistrict: branch.branchCity || branch.branchDistrict || '',
      branchAddress: branch.branchAddress || '',
    })
    setIsAddBranchOpen(true)
  }

  const openViewBranch = (branch) => {
    setViewTargetBranch(branch)
    setActionMenuBranchId(null)
    setIsMobileSidebarOpen(false)
  }

  const closeBranchModal = () => {
    setIsAddBranchOpen(false)
    setEditingBranchId(null)
    setBranchErrors({})
    setActionError('')
  }

  const openDeleteConfirm = (branch) => {
    setDeleteTargetBranch(branch)
    setIsDeleteConfirmOpen(true)
    setActionMenuBranchId(null)
    setIsMobileSidebarOpen(false)
  }

  const openResendMail = (branch) => {
    setActionMenuBranchId(null)
    setResendTargetBranch(branch)
    setIsResendConfirmOpen(true)
    setIsMobileSidebarOpen(false)
  }

  const closeDeleteConfirm = () => {
    setIsDeleteConfirmOpen(false)
    setDeleteTargetBranch(null)
  }

  const closeResendConfirm = () => {
    setIsResendConfirmOpen(false)
    setResendTargetBranch(null)
  }

  const closeLogoutConfirm = () => {
    setIsLogoutConfirmOpen(false)
  }

  const closeViewBranch = () => {
    setViewTargetBranch(null)
  }

  // View Dashboard Handlers
  const openViewDashboardConfirm = (branch) => {
    setViewDashboardBranch(branch)
    setIsViewDashboardConfirmOpen(true)
    setActionMenuBranchId(null)
  }

  const handleActiveBranchView = (branch) => {
    setActiveSection('branch-admin')
    setIsMobileSidebarOpen(false)
    openViewDashboardConfirm(branch)
  }

  const handleConfirmViewDashboard = () => {
    setEmbeddedBranch(viewDashboardBranch)
    setImpersonateBranchId(viewDashboardBranch?.id || viewDashboardBranch?.branchId || null)
    setIsViewDashboardConfirmOpen(false)
    setViewDashboardBranch(null)
  }

  const closeViewDashboardConfirm = () => {
    setIsViewDashboardConfirmOpen(false)
    setViewDashboardBranch(null)
  }

  const handleExitDashboardClick = () => {
    setIsExitDashboardConfirmOpen(true)
  }

  const handleConfirmExitDashboard = () => {
    setEmbeddedBranch(null)
    setImpersonateBranchId(null)
    setIsExitDashboardConfirmOpen(false)
  }

  const closeExitDashboardConfirm = () => {
    setIsExitDashboardConfirmOpen(false)
  }

  const openSuperAdminStudent360 = ({ student, branch }) => {
    if (!student) return
    setSuperAdminStudentView({ student, branch })
  }

  const handleDeleteBranch = async () => {
    if (!deleteTargetBranch) return

    try {
      setIsDeleting(true)
      await deleteBranch(deleteTargetBranch.id)
      setBranches((current) => current.filter((branch) => branch.id !== deleteTargetBranch.id))
      setDeleteTargetBranch(null)
      setIsDeleteConfirmOpen(false)
    } catch (error) {
      setActionError(error?.body?.message || error?.message || 'Unable to delete branch right now.')
      setIsDeleteConfirmOpen(false)
      setDeleteTargetBranch(null)
      setIsSuccessOpen(true)
      setSuccessTitle('Delete failed')
      setSuccessMessage(error?.body?.message || error?.message || 'Unable to delete branch right now.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSendMail = async () => {
    if (!resendTargetBranch) return

    try {
      const result = await resendBranchInvitation(resendTargetBranch.id)
      if (result?.branch?.id) {
        setBranches((current) => current.map((branch) => (branch.id === result.branch.id ? result.branch : branch)))
        previousBranchSnapshotRef.current = new Map(
          (previousBranchSnapshotRef.current || new Map()).entries(),
        )
        previousBranchSnapshotRef.current.set(String(result.branch.id), {
          status: getNormalizedBranchStatus(result.branch),
          resendMailStatus: getNormalizedResendMailStatus(result.branch),
        })
      }
      setIsResendConfirmOpen(false)
      setSuccessTitle('Mail sent successfully')
      setSuccessMessage(`Invitation mail has been sent to ${resendTargetBranch.branchEmail}.`)
      setIsSuccessOpen(true)
    } catch (error) {
      setIsResendConfirmOpen(false)
      setSuccessTitle('Mail sending failed')
      setSuccessMessage(error?.body?.message || error?.message || 'Unable to send invitation mail right now.')
      setIsSuccessOpen(true)
    } finally {
      setResendTargetBranch(null)
    }
  }

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value)
    setCurrentPage(1)
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setBranchErrors((current) => ({ ...current, [field]: '' }))
  }

  const updateBranchName = (value) => {
    const nextValue = value.replace(/[^A-Za-z ]+/g, '')
    updateField('branchName', nextValue)
  }

  const updateBranchAdminName = (value) => {
    const nextValue = value.replace(/[^A-Za-z ]+/g, '')
    updateField('branchAdminName', nextValue)
  }

  const updateBranchEmail = (value) => {
    const nextValue = String(value || '')
    setForm((current) => ({ ...current, branchEmail: nextValue }))
    setBranchErrors((current) => ({
      ...current,
      branchEmail:
        validateBranchField('branchEmail', nextValue) ||
        getDuplicateBranchEmailError(nextValue, branches, editingBranchId),
    }))
  }

  const updateBranchPhone = (value) => {
    const rawText = String(value || '')
    const nextValue = rawText.replace(/\D+/g, '').slice(0, 10)
    setForm((current) => ({ ...current, branchPhone: nextValue }))
    setBranchErrors((current) => ({
      ...current,
      branchPhone:
        validateBranchField('branchPhone', nextValue) ||
        getDuplicateBranchPhoneError(nextValue, branches, editingBranchId),
    }))
  }

  const updateBranchCountry = (countryCode) => {
    const nextCountryCode = String(countryCode || '').trim()
    const country = countryOptions.find((item) => String(item?.iso2 || '') === nextCountryCode)
    setForm((current) => ({
      ...current,
      branchCountryCode: nextCountryCode,
      branchCountry: country?.name || '',
      branchState: '',
      branchStateCode: '',
      branchDistrict: '',
    }))
    setBranchErrors((current) => ({
      ...current,
      branchCountry: '',
      branchState: '',
      branchDistrict: '',
    }))
  }

  const updateBranchState = (stateCode) => {
    const nextStateCode = String(stateCode || '').trim()
    const state = stateOptions.find((item) => String(item?.iso2 || '') === nextStateCode)
    setForm((current) => ({
      ...current,
      branchStateCode: nextStateCode,
      branchState: state?.name || '',
      branchDistrict: '',
    }))
    setBranchErrors((current) => ({
      ...current,
      branchState: '',
      branchDistrict: '',
    }))
  }

  const updateBranchDistrict = (value) => {
    const district = String(value || '').trim()
    setForm((current) => ({
      ...current,
      branchDistrict: district,
    }))
    setBranchErrors((current) => ({
      ...current,
      branchDistrict: '',
    }))
  }

  const handleAddBranch = async (event) => {
    event.preventDefault()

    const branchId = String(form.branchId || '').trim().toUpperCase()
    const nextForm = {
      ...form,
      branchId,
    }
    const nextErrors = validateBranchForm(nextForm, branches, editingBranchId)
    setBranchErrors(nextErrors)
    setActionError('')

    if (Object.values(nextErrors).some(Boolean)) {
      return
    }

    const cleanedPhone = String(nextForm.branchPhone || '').trim()
    const nextBranchData = {
      branchId,
      branchName: nextForm.branchName.trim(),
      status: nextForm.status === 'Inactive' ? 'Inactive' : 'Active',
      branchAdminName: nextForm.branchAdminName.trim(),
      branchEmail: nextForm.branchEmail.trim(),
      branchPhone: cleanedPhone,
      branchCountryCode: nextForm.branchCountryCode.trim(),
      branchCountry: nextForm.branchCountry.trim(),
      country: nextForm.branchCountry.trim(),
      branchStateCode: nextForm.branchStateCode.trim(),
      branchState: nextForm.branchState.trim(),
      state: nextForm.branchState.trim(),
      branchCity: nextForm.branchDistrict.trim(),
      city: nextForm.branchDistrict.trim(),
      branchDistrict: nextForm.branchDistrict.trim(),
      district: nextForm.branchDistrict.trim(),
      branchAddress: nextForm.branchAddress.trim(),
    }

    try {
      setIsSubmitting(true)

      if (editingBranchId !== null) {
        const updatedBranch = await updateBranch(editingBranchId, nextBranchData)
        setBranches((current) => current.map((item) => (item.id === editingBranchId ? updatedBranch : item)))
        setIsAddBranchOpen(false)
        setEditingBranchId(null)
        setSuccessTitle('Branch updated successfully')
        setSuccessMessage(`${updatedBranch.branchName} has been updated in the table.`)
        setIsSuccessOpen(true)
        return
      }

      const nextBranch = await createBranch({
        ...nextBranchData,
        createdAt: formatToday(),
      })

      setBranches((current) => [nextBranch, ...current])
      setIsAddBranchOpen(false)
      setEditingBranchId(null)
      setSuccessTitle('Invitation email sent')
      setSuccessMessage('Login credentials have been sent to the registered email.')
      setIsSuccessOpen(true)
    } catch (error) {
      const errorMessage = String(error?.body?.message || error?.message || 'Unable to save branch right now.')
      if (/phone/i.test(errorMessage) && /exist|duplicate|already/i.test(errorMessage)) {
        setBranchErrors((current) => ({
          ...current,
          branchPhone: errorMessage,
        }))
        setActionError('')
        return
      }

      setActionError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmLogout = async () => {
    closeLogoutConfirm()
    try {
      await signOut()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const profileEmail = user?.email || 'superadmin.manager@cispro.com'
  const selectedBranch = viewTargetBranch
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false)

  useEffect(() => {
    try { window.localStorage.setItem('cispro.super-admin-sidebar-collapsed', String(isSidebarCollapsed)) } catch { /* ignore storage failures */ }
  }, [isSidebarCollapsed])

  if (embeddedBranch) {
    return (
      <div className="sa-embedded-wrapper">
        <div className="sa-embedded-banner">
          <button type="button" className="sa-embedded-exit-btn" onClick={handleExitDashboardClick}>
            <LogOut size={16} strokeWidth={2.3} />
            Exit Dashboard
          </button>
        </div>

        <BranchDashboardPage embeddedMode={true} branchData={embeddedBranch} />


        {isExitDashboardConfirmOpen ? (
          <div className="branch-modal-backdrop" role="presentation" style={{ zIndex: 9999 }}>
            <div
              className="branch-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="exit-dashboard-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="branch-delete-header">
                <div className="branch-delete-icon" aria-hidden="true">
                  <LogOut size={24} strokeWidth={2.1} />
                </div>
                <h2 id="exit-dashboard-title">Exit Dashboard</h2>
              </div>
              
              <p>
                Are you sure you want to leave <strong>{embeddedBranch.branchName}</strong>'s dashboard and return to the Super Admin panel?
              </p>

              <div className="branch-delete-actions">
                <button type="button" className="branch-delete-cancel" onClick={closeExitDashboardConfirm}>
                  Cancel
                </button>
                <button type="button" className="sa-view-dashboard-btn" onClick={handleConfirmExitDashboard} style={{ background: '#0f4fb8', color: '#fff', border: 'none' }}>
                  Exit Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (superAdminStudentView) {
    return (
      <section className="super-admin-page">
        <div className="super-admin-shell">
          {isMobileSidebarOpen ? (
            <button
              type="button"
              className="super-admin-sidebar-backdrop"
              aria-label="Close navigation menu"
              onClick={closeMobileSidebar}
            />
          ) : null}
          <aside className={`super-admin-sidebar ${isMobileSidebarOpen ? 'is-open' : ''}`.trim()} aria-label="Super admin navigation">
            <div className="super-admin-sidebar-brand">
              <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="Elite Admin logo" />
              <button type="button" className="super-admin-sidebar-close" aria-label="Close navigation menu" onClick={closeMobileSidebar}>
                <X size={18} strokeWidth={2.6} />
              </button>
            </div>
            <nav className="super-admin-sidebar-nav">
              <button type="button" className="super-admin-sidebar-item is-active" onClick={() => { setSuperAdminStudentView(null); navigate('/dashboard/super-admin') }}>
                <span className="super-admin-sidebar-icon"><LayoutDashboard size={18} strokeWidth={2.2} /></span>
                <span>Dashboard</span>
              </button>
              <span className="super-admin-sidebar-section-label">User &amp; Role Management</span>
              <button type="button" className="super-admin-sidebar-item" onClick={() => { setSuperAdminStudentView(null); setActiveSection('branches'); navigate('/dashboard/super-admin?section=branches') }}>
                <span className="super-admin-sidebar-icon"><Building2 size={18} strokeWidth={2.2} /></span>
                <span>Branch Management</span>
              </button>
              <span className="super-admin-sidebar-section-label">Academic Operations</span>
              <button type="button" className="super-admin-sidebar-item" onClick={() => { setSuperAdminStudentView(null); setActiveSection('students'); navigate('/dashboard/super-admin?section=students') }}>
                <span className="super-admin-sidebar-icon"><Users size={18} strokeWidth={2.2} /></span>
                <span>Student Management</span>
              </button>
              <button type="button" className="super-admin-sidebar-item" onClick={() => { setSuperAdminStudentView(null); setActiveSection('faculty'); navigate('/dashboard/super-admin?section=faculty') }}>
                <span className="super-admin-sidebar-icon"><UserRound size={18} strokeWidth={2.2} /></span>
                <span>Faculty Management</span>
              </button>
            </nav>
          </aside>
          <main className="super-admin-main">
            <header className="super-admin-topbar">
              <div className="super-admin-topbar-left">
                <button type="button" className="super-admin-sidebar-toggle" aria-label="Open navigation menu" onClick={() => setIsMobileSidebarOpen(true)}>
                  <Menu size={20} strokeWidth={2.4} />
                </button>
                <h1 className="super-admin-header-title">Super Admin Dashboard</h1>
              </div>
              <div className="super-admin-topbar-right">
                <SuperAdminNotificationBell onOpenBranches={() => { setSuperAdminStudentView(null); setActiveSection('branches') }} onViewActivity={() => navigate('/dashboard/super-admin/notifications')} />
                <div className="super-admin-profile">
                  <div className="super-admin-profile-trigger"><AvatarBadge /><div className="super-admin-profile-copy"><strong>Super Admin</strong><span>{profileEmail}</span></div></div>
                </div>
              </div>
            </header>
            <div className="super-admin-content">
              <Student360Page
                student={superAdminStudentView.student}
                branch={superAdminStudentView.branch}
                backLabel="Back to Dashboard"
                onBack={() => {
                  setSuperAdminStudentView(null)
                  navigate('/dashboard/super-admin')
                }}
                onEdit={() => setSuperAdminStudentView(null)}
              />
            </div>
          </main>
        </div>
      </section>
    )
  }

  return (
    <section className={`super-admin-page ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`.trim()}>
      <div className="super-admin-shell">
        {isMobileSidebarOpen ? (
          <button
            type="button"
            className="super-admin-sidebar-backdrop"
            aria-label="Close navigation menu"
            onClick={closeMobileSidebar}
          />
        ) : null}

        <aside
          className={`super-admin-sidebar ${isMobileSidebarOpen ? 'is-open' : ''}`.trim()}
          aria-label="Super admin navigation"
        >
          <div className="super-admin-sidebar-brand">
            <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="Elite Admin logo" />
            <button type="button" className="super-admin-sidebar-collapse-toggle" data-tooltip={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'} aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setIsSidebarCollapsed((current) => !current)}>
              {isSidebarCollapsed ? <PanelLeftOpen size={19} strokeWidth={2.3} /> : <PanelLeftClose size={19} strokeWidth={2.3} />}
            </button>
            <button
              type="button"
              className="super-admin-sidebar-close"
              aria-label="Close navigation menu"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X size={18} strokeWidth={2.6} aria-hidden="true" focusable="false" />
            </button>
          </div>

          <nav className="super-admin-sidebar-nav">
            <div className="super-admin-sidebar-section">
              <button
                type="button"
                className={`super-admin-sidebar-item ${activeSection === 'dashboard' ? 'is-active' : ''}`.trim()}
                data-tooltip="Dashboard"
                onClick={() => {
                  setActiveSection('dashboard')
                  setIsMobileSidebarOpen(false)
                }}
              >
                <span className="super-admin-sidebar-icon" aria-hidden="true">
                  <LayoutDashboard size={18} strokeWidth={2.2} />
                </span>
                <span>Dashboard</span>
              </button>
            </div>

            <div className="super-admin-sidebar-section">
              <div
                className={`super-admin-sidebar-branch-nav ${isSidebarFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()}
                onMouseLeave={() => setIsSidebarFlyoutDismissed(false)}
              >
                <div className={`super-admin-sidebar-item ${activeSection === 'branches' ? 'is-active' : ''}`.trim()} data-tooltip="Branch Management">
                  <button
                    type="button"
                    className="super-admin-sidebar-branch-link"
                    onClick={() => {
                      if (activeSection !== 'branches') {
                        setActiveSection('branches')
                        setIsBranchManagementExpanded(false)
                      } else {
                        setIsBranchManagementExpanded((current) => !current)
                      }
                      setIsMobileSidebarOpen(false)
                    }}
                  >
                    <span className="super-admin-sidebar-icon" aria-hidden="true"><Shield size={18} strokeWidth={2.2} /></span>
                    <span>Branch Management</span>
                  </button>
                  <button type="button" className="super-admin-sidebar-branch-toggle" aria-label={`${isBranchManagementExpanded ? 'Collapse' : 'Expand'} branch management`} aria-expanded={isBranchManagementExpanded} onClick={() => setIsBranchManagementExpanded((current) => !current)}>
                    <ChevronDown size={16} strokeWidth={2.3} className={isBranchManagementExpanded ? 'is-expanded' : ''} aria-hidden="true" />
                  </button>
                </div>
                {(isBranchManagementExpanded || isSidebarCollapsed) ? (
                  <div className="super-admin-sidebar-branch-list" aria-label="Active branches">
                    <div className="super-admin-sidebar-branch-list-title">Branch Management</div>
                    {branches.filter((branch) => getNormalizedBranchStatus(branch) === 'Active').map((branch) => (
                      <button key={branch.id || branch.branchId} type="button" className="super-admin-sidebar-branch-name" onClick={() => { setIsSidebarFlyoutDismissed(true); handleActiveBranchView(branch) }}>
                        <span className="super-admin-sidebar-branch-dot" aria-hidden="true" />
                        <span>{branch.branchName || branch.branchId || 'Active branch'}</span>
                      </button>
                    ))}
                    {!branches.some((branch) => getNormalizedBranchStatus(branch) === 'Active') ? <span className="super-admin-sidebar-branch-empty">No active branches</span> : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="super-admin-sidebar-section super-admin-sidebar-section-user-role">
              <div
                className={`super-admin-sidebar-collapsed-group ${isSidebarFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()}
                onMouseEnter={() => setIsSidebarFlyoutDismissed(false)}
                onMouseLeave={() => setIsSidebarFlyoutDismissed(true)}
              >
                <button
                  type="button"
                  className="super-admin-sidebar-collapsed-group-trigger"
                  data-tooltip="User & Role Management"
                  aria-label="User & Role Management"
                >
                  <Users size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <div className="super-admin-sidebar-collapsed-group-flyout">
                  <div className="super-admin-sidebar-collapsed-group-title">User &amp; Role Management</div>
                  <button type="button" className="super-admin-sidebar-subitem" onClick={() => { setIsSidebarFlyoutDismissed(true); setIsBranchManagementExpanded(false); setActiveSection('branch-admin'); setIsMobileSidebarOpen(false) }}>
                    <span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><Shield size={15} strokeWidth={2.1} /></span>
                    <span>Branch Admin</span>
                  </button>
                  <button type="button" className="super-admin-sidebar-subitem" onClick={() => { setIsSidebarFlyoutDismissed(true); setIsBranchManagementExpanded(false); setActiveSection('faculty'); setIsMobileSidebarOpen(false) }}>
                    <span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><UserRound size={15} strokeWidth={2.1} /></span>
                    <span>Faculty Management</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                className={`super-admin-sidebar-section-toggle ${['branch-admin', 'faculty'].includes(activeSection) ? 'is-active' : ''}`.trim()}
                aria-expanded={isUserRoleManagementExpanded}
                onClick={() => setIsUserRoleManagementExpanded((current) => !current)}
              >
                <span className="super-admin-sidebar-section-toggle-label"><Users size={16} strokeWidth={2.2} aria-hidden="true" /><span>User &amp; Role Management</span></span>
                <ChevronDown size={15} strokeWidth={2.4} className={isUserRoleManagementExpanded ? 'is-expanded' : ''} aria-hidden="true" />
              </button>
              {(isUserRoleManagementExpanded || isSidebarCollapsed) ? (
                <>
                  <div
                    className={`super-admin-sidebar-branch-nav super-admin-sidebar-branch-admin-nav ${isSidebarFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()}
                    onMouseLeave={() => setIsSidebarFlyoutDismissed(false)}
                  >
                  <div className={`super-admin-sidebar-item ${activeSection === 'branch-admin' ? 'is-active' : ''}`.trim()} data-tooltip="Branch Admin">
                  <button
                    type="button"
                    className="super-admin-sidebar-branch-link"
                    onClick={() => { setActiveSection('branch-admin'); setIsBranchManagementExpanded(false); setIsMobileSidebarOpen(false) }}
                  >
                    <span className="super-admin-sidebar-icon" aria-hidden="true"><Shield size={18} strokeWidth={2.2} /></span>
                    <span>Branch Admin</span>
                  </button>
                  <button
                    type="button"
                    className="super-admin-sidebar-branch-toggle"
                    aria-label={`${isBranchManagementExpanded ? 'Collapse' : 'Expand'} branch management`}
                    aria-expanded={isBranchManagementExpanded}
                    onClick={() => setIsBranchManagementExpanded((current) => !current)}
                  >
                    <ChevronDown size={16} strokeWidth={2.3} className={isBranchManagementExpanded ? 'is-expanded' : ''} aria-hidden="true" />
                  </button>
                </div>
                {(isBranchManagementExpanded || isSidebarCollapsed) ? (
                  <div className="super-admin-sidebar-branch-list" aria-label="Active branches">
                    <div className="super-admin-sidebar-branch-list-title">Branch Management</div>
                    {branches.filter((branch) => getNormalizedBranchStatus(branch) === 'Active').map((branch) => (
                      <button
                        key={branch.id || branch.branchId}
                        type="button"
                        className="super-admin-sidebar-branch-name"
                        onClick={() => { setIsSidebarFlyoutDismissed(true); handleActiveBranchView(branch) }}
                      >
                        <span className="super-admin-sidebar-branch-dot" aria-hidden="true" />
                        <span>{branch.branchName || branch.branchId || 'Active branch'}</span>
                      </button>
                    ))}
                    {!branches.some((branch) => getNormalizedBranchStatus(branch) === 'Active') ? (
                      <span className="super-admin-sidebar-branch-empty">No active branches</span>
                    ) : null}
                  </div>
                ) : null}
                  </div>
                  <button
                    type="button"
                    className={`super-admin-sidebar-item super-admin-sidebar-user-role-faculty ${activeSection === 'faculty' ? 'is-active' : ''}`.trim()}
                    data-tooltip="Faculty Management"
                    onClick={() => { setIsSidebarFlyoutDismissed(true); setIsBranchManagementExpanded(false); setActiveSection('faculty'); setIsMobileSidebarOpen(false) }}
                  >
                    <span className="super-admin-sidebar-icon" aria-hidden="true"><UserRound size={18} strokeWidth={2.2} /></span>
                    <span>Faculty Management</span>
                  </button>
                </>
              ) : null}
            </div>

            <div className="super-admin-sidebar-section super-admin-sidebar-section-academic">
              <div
                className={`super-admin-sidebar-collapsed-group ${isSidebarFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()}
                onMouseEnter={() => setIsSidebarFlyoutDismissed(false)}
                onMouseLeave={() => setIsSidebarFlyoutDismissed(true)}
              >
                <button
                  type="button"
                  className="super-admin-sidebar-collapsed-group-trigger"
                  data-tooltip="Academic Operations"
                  aria-label="Academic Operations"
                >
                  <LayoutGrid size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <div className="super-admin-sidebar-collapsed-group-flyout">
                  <div className="super-admin-sidebar-collapsed-group-title">Academic Operations</div>
                  <button type="button" className="super-admin-sidebar-subitem" onClick={() => { setIsSidebarFlyoutDismissed(true); setActiveSection('students'); setIsMobileSidebarOpen(false) }}>
                    <span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><Users size={15} strokeWidth={2.1} /></span>
                    <span>Student Management</span>
                  </button>
                  <div className="super-admin-sidebar-collapsed-group-nested">
                    <button
                      type="button"
                      className="super-admin-sidebar-subitem super-admin-sidebar-collapsed-group-nested-toggle"
                      aria-expanded={isBranchesExpanded}
                      onClick={() => {
                        setIsBranchesExpanded((current) => !current)
                      }}
                    >
                      <span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><CalendarDays size={15} strokeWidth={2.1} /></span>
                      <span>Leave Management</span>
                      <ChevronDown size={14} className={isBranchesExpanded ? 'is-expanded' : ''} aria-hidden="true" />
                    </button>
                    {isBranchesExpanded ? (
                      <div className="super-admin-sidebar-collapsed-group-nested-items">
                        <button type="button" className="super-admin-sidebar-branch-name" onClick={() => { setIsSidebarFlyoutDismissed(true); setActiveSection('faculty-leave'); setIsMobileSidebarOpen(false) }}>
                          <span className="super-admin-sidebar-branch-dot" aria-hidden="true" />
                          <span>Faculty Leave Request</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`super-admin-sidebar-section-toggle ${['students', 'leave-management', 'faculty-leave'].includes(activeSection) ? 'is-active' : ''}`.trim()}
                aria-expanded={isAcademicOperationsExpanded}
                onClick={() => setIsAcademicOperationsExpanded((current) => !current)}
              >
                <span className="super-admin-sidebar-section-toggle-label"><LayoutGrid size={16} strokeWidth={2.2} aria-hidden="true" /><span>Academic Operations</span></span>
                <ChevronDown size={15} strokeWidth={2.4} className={isAcademicOperationsExpanded ? 'is-expanded' : ''} aria-hidden="true" />
              </button>
              {(isAcademicOperationsExpanded || isSidebarCollapsed) ? <>
              <button
                type="button"
                className={`super-admin-sidebar-item super-admin-sidebar-academic-students ${activeSection === 'students' ? 'is-active' : ''}`.trim()}
                data-tooltip="Student Management"
                onClick={() => { setActiveSection('students'); setIsMobileSidebarOpen(false) }}
              >
                <span className="super-admin-sidebar-icon" aria-hidden="true"><Users size={18} strokeWidth={2.2} /></span>
                <span>Student Management</span>
              </button>
              <div
                className={`super-admin-sidebar-branch-nav super-admin-sidebar-academic-leave ${isSidebarFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()}
                onMouseLeave={() => setIsSidebarFlyoutDismissed(false)}
              >
                <div className={`super-admin-sidebar-item ${['leave-management', 'faculty-leave'].includes(activeSection) ? 'is-active' : ''}`.trim()} data-tooltip="Leave Management">
                  <button
                    type="button"
                    className="super-admin-sidebar-branch-link"
                    onClick={() => setIsBranchesExpanded((current) => !current)}
                  >
                    <span className="super-admin-sidebar-icon" aria-hidden="true"><CalendarDays size={18} strokeWidth={2.2} /></span>
                    <span>Leave Management</span>
                  </button>
                  <button
                    type="button"
                    className="super-admin-sidebar-branch-toggle"
                    aria-label={`${isBranchesExpanded ? 'Collapse' : 'Expand'} leave management`}
                    aria-expanded={isBranchesExpanded}
                    onClick={() => setIsBranchesExpanded((current) => !current)}
                  >
                    <ChevronDown size={16} strokeWidth={2.3} className={isBranchesExpanded ? 'is-expanded' : ''} aria-hidden="true" />
                  </button>
                </div>
                {(isBranchesExpanded || isSidebarCollapsed) ? (
                  <div className="super-admin-sidebar-branch-list" aria-label="Leave management">
                    <div className="super-admin-sidebar-branch-list-title">Leave Management</div>
                    <button type="button" className="super-admin-sidebar-branch-name" onClick={() => { setIsSidebarFlyoutDismissed(true); setActiveSection('faculty-leave'); setIsMobileSidebarOpen(false) }}>
                      <span className="super-admin-sidebar-branch-dot" aria-hidden="true" /><span>Faculty Leave Request</span>
                    </button>
                  </div>
                ) : null}
              </div>
              </> : null}
            </div>

            <div className="super-admin-sidebar-section">
              <button
                type="button"
                className="super-admin-sidebar-item"
                data-tooltip="Notifications"
                onClick={() => { setIsMobileSidebarOpen(false); navigate('/dashboard/super-admin/notifications') }}
              >
                <span className="super-admin-sidebar-icon" aria-hidden="true"><Bell size={18} strokeWidth={2.2} /></span>
                <span>Notifications</span>
              </button>
            </div>
          </nav>

          <div className="super-admin-sidebar-footer">
            <div className="super-admin-sidebar-profile-card">
              <SidebarUserAvatar />

              <div className="super-admin-sidebar-profile-copy">
                <span>{profileEmail}</span>
              </div>

              <button
                type="button"
                className="super-admin-sidebar-logout-button"
                aria-label="Logout"
                onClick={() => {
                  setIsLogoutConfirmOpen(true)
                  setIsMobileSidebarOpen(false)
                }}
              >
                <LogOut size={22} strokeWidth={2.15} />
              </button>
            </div>
          </div>
        </aside>

        <div className="super-admin-main">
          <header className="super-admin-topbar">
            <div className="super-admin-topbar-left">
              <button
                type="button"
                className="super-admin-sidebar-toggle"
                aria-label="Open navigation menu"
                aria-expanded={isMobileSidebarOpen}
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu size={20} strokeWidth={2.4} aria-hidden="true" focusable="false" />
              </button>
              <h1 className="super-admin-header-title">Super Admin Dashboard</h1>
            </div>

            <div className="super-admin-topbar-right">
             <SuperAdminNotificationBell
  onOpenBranches={() => setActiveSection('branches')}
  onViewActivity={() => navigate('/dashboard/super-admin/notifications')}
  onOpenBranch={(branchId) => {
    setActiveSection('branches')

    const branch = branches.find(
      (item) => String(item.id) === String(branchId)
    )

    if (branch) {
      setViewTargetBranch(branch)
    }
  }}
/>

             <div className="super-admin-profile">
  <button
    type="button"
    className="super-admin-profile-trigger"
    onClick={() => setIsSuperAdminProfileOpen((current) => !current)}
    aria-haspopup="dialog"
    aria-expanded={isSuperAdminProfileOpen}
  >
    <AvatarBadge />

    <div className="super-admin-profile-copy">
      <strong>Super Admin</strong>
      <span>{profileEmail}</span>
    </div>
  </button>

  {isSuperAdminProfileOpen ? (
    <div className="super-admin-profile-dropdown">
      <button
  type="button"
  className="super-admin-profile-close"
  aria-label="Close profile"
  onClick={() => setIsSuperAdminProfileOpen(false)}
>
  <X size={18} strokeWidth={2.4} />
</button>
      <div className="super-admin-profile-dropdown-header">
        <AvatarBadge />

        <div>
          <strong>Super Admin</strong>
          <span>Administrator</span>
        </div>
      </div>

      <div className="super-admin-profile-details">
        <div className="super-admin-profile-detail">
          <Mail size={16} strokeWidth={2} />
          <div>
            <span>Email</span>
            <strong>{profileEmail}</strong>
          </div>
        </div>

        <div className="super-admin-profile-detail">
          <Shield size={16} strokeWidth={2} />
          <div>
            <span>Role</span>
            <strong>Super Admin</strong>
          </div>
        </div>
      </div>

      <div className="super-admin-profile-dropdown-actions">
        <button
          type="button"
          onClick={() => {
            setIsSuperAdminProfileOpen(false)
            setIsLogoutConfirmOpen(true)
          }}
        >
          <LogOut size={16} strokeWidth={2.2} />
          Logout
        </button>
      </div>
    </div>
  ) : null}
</div>
            </div>
          </header>

          <main className="super-admin-content">
            {activeSection === 'branches' ? (
              <section className="branch-management-panel">
                <div className="branch-management-header">
                  <div className="branch-management-title-block">
                    <p className="branch-management-kicker">Dashboard</p>
                    <h1>Branch Management</h1>
                  </div>

                  <div className="branch-management-actions">
                    <button type="button" className="branch-add-button" onClick={openAddBranch}>
                      <span>+</span>
                      <span>Create Branch</span>
                    </button>

                    <p className="branch-management-subtitle">
                      Total branches: <strong>{totalBranches}</strong>
                    </p>
                  </div>
                </div>
                {/* search */}
<div className="branch-management-toolbar">
  <div className="branch-toolbar-left">

    <div className="branch-search-wrap">
    <div className="branch-search">
      

      <input
        type="text"
        value={searchTerm}
        onChange={handleSearchChange}
        placeholder="Search branch or student"
        aria-label="Search branches or students"
      />

      <button type="button" className="branch-search-button">
        Search
      </button>
    </div>
    {searchTerm.trim() && matchingStudents.length ? (
      <div className="super-admin-student-search-results" role="listbox" aria-label="Student search results">
        {matchingStudents.map((student) => {
          const branch = branches.find((item) => [item.id, item.branchId, item.branchCode]
            .map((value) => String(value || '').trim().toLowerCase())
            .includes(String(student.branchId || '').trim().toLowerCase()))
          return (
            <button
              type="button"
              key={`${student.branchId || 'branch'}-${student.id || student.studentId || student.studentCode}`}
              onMouseDown={(event) => {
                event.preventDefault()
                openStudent360FromSearch(student)
              }}
            >
              <strong>{student.studentName || student.name || 'Student'}</strong>
              <span>{student.studentId || student.id || '-'} · {branch?.branchName || 'Branch'}</span>
            </button>
          )
        })}
      </div>
    ) : null}
    </div>

    <div
  ref={statusFilterRef}
  className={`branch-status-filter ${isStatusFilterOpen ? 'is-open' : ''}`}
>
      <button
        type="button"
        className="branch-status-filter-trigger"
        onClick={() => setIsStatusFilterOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={isStatusFilterOpen}
      >
        <span>{statusFilter}</span>

        <ChevronRight
          size={16}
          strokeWidth={2.2}
          className="branch-status-filter-chevron"
        />
      </button>

      {isStatusFilterOpen ? (
        <div className="branch-status-filter-menu" role="menu">
          {['All', 'Active', 'Inactive'].map((status) => (
            <button
              key={status}
              type="button"
              role="menuitem"
              className={`branch-status-filter-option ${
                statusFilter === status ? 'is-selected' : ''
              }`}
              onClick={() => {
                setStatusFilter(status)
                setCurrentPage(1)
                setIsStatusFilterOpen(false)
              }}
            >
              {status}
            </button>
          ))}
        </div>
      ) : null}
    </div>

  </div>
</div>

                <div className="branch-table-shell">
                  <table className="branch-table">
                    <thead>
                      <tr>
                        <th className="branch-table-col-index">S.No</th>
                        <th className="branch-table-col-id">Branch ID</th>
                        <th className="branch-table-col-name">Branch Name</th>
                        <th className="branch-table-col-admin">Branch Admin Name</th>
                        <th style={{ textAlign: 'center' }}>Students</th>
                        <th className="branch-table-col-dashboard" style={{ textAlign: 'center' }}>Branch View</th>
                        <th className="branch-table-col-actions" style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBranches.map((branch, index) => {
                        const isUpwardMenu = index >= paginatedBranches.length - 2
                        const resendMailStatus = getResendMailStatus(branch)
                        const isResendMailActiveBranch = resendMailStatus === 'Active'
                        const openBranchDetails = () => openViewBranch(branch)

                        return (
                          <tr
                            key={branch.id}
                            className="branch-table-row"
                            role="button"
                            tabIndex={0}
                            aria-label={`View details for branch ${branch.branchName || branch.branchId || ''}`.trim()}
                            onClick={openBranchDetails}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openBranchDetails()
                              }
                            }}
                          >
                            <td className="branch-table-col-index">{(safeCurrentPage - 1) * rowsPerPage + index + 1}</td>
                            <td className="branch-table-col-id">
                              <div className="branch-inline-view-cell">
                                <span
                                  className={`branch-status-badge ${isResendMailActiveBranch ? 'is-active' : 'is-inactive'}`.trim()}
                                  aria-label={`Resend mail ${resendMailStatus}`}
                                  role="img"
                                >
                                  <span className="branch-status-dot" aria-hidden="true" />
                                  <span
                                    className={`branch-status-tooltip ${isResendMailActiveBranch ? 'is-active' : 'is-inactive'}`.trim()}
                                    aria-hidden="true"
                                  >
                                    {resendMailStatus}
                                  </span>
                                </span>
                                <strong>{branch.branchId}</strong>
                              </div>
                            </td>
                            <td className="branch-table-col-name">
                              <strong>{branch.branchName}</strong>
                            </td>
                            <td className="branch-table-col-admin">
                              <div className="branch-table-detail-cell">
                                <strong>{branch.branchAdminName || 'Branch admin not set'}</strong>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <strong>{branch.studentCount ?? 0}</strong>
                            </td>
                            <td className="branch-table-col-dashboard" style={{ textAlign: 'center' }}>
                              {getNormalizedBranchStatus(branch) === 'Active' ? (
                                <button 
                                  type="button" 
                                  className="sa-view-dashboard-btn"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openViewDashboardConfirm(branch)
                                  }}
                                >
                                  <LayoutDashboard size={14} strokeWidth={2.3} />
                                  View
                                </button>
                              ) : (
                                <span className="branch-contact-email" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Inactive</span>
                              )}
                            </td>
                            <td
                              className="branch-table-col-actions"
                              style={{ textAlign: 'center' }}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <div
                                className={`branch-actions branch-actions-wrap ${isUpwardMenu ? 'is-upward' : ''} ${actionMenuBranchId === branch.id ? 'is-open' : ''}`.trim()}
                                onMouseEnter={() => {
                                  if (actionMenuCloseTimerRef.current) {
                                    clearTimeout(actionMenuCloseTimerRef.current)
                                  }
                                  setActionMenuBranchId(branch.id)
                                }}
                                onMouseLeave={() => {
                                  actionMenuCloseTimerRef.current = setTimeout(() => {
                                    setActionMenuBranchId(null)
                                  }, 200)
                                }}
                              >
                                <button
                                  type="button"
                                  className="branch-actions-trigger"
                                  aria-label={`Open actions for ${branch.branchName}`}
                                  aria-haspopup="menu"
                                  aria-expanded={actionMenuBranchId === branch.id}
                                  onClick={() => setActionMenuBranchId(branch.id)}
                                >
                                  <MoreVertical size={18} strokeWidth={2.3} />
                                </button>

                                <div
                                  className="branch-actions-menu"
                                  role="menu"
                                  aria-label={`${branch.branchName} actions`}
                                >
                                  <button type="button" role="menuitem" onClick={() => openViewBranch(branch)}>
                                    View
                                  </button>
                                  <button type="button" role="menuitem" onClick={() => openEditBranch(branch)}>
                                    Edit
                                  </button>
                                  {!isResendMailActiveBranch ? (
                                    <button type="button" role="menuitem" className="is-warning" onClick={() => openResendMail(branch)}>
                                      Resend Mail
                                    </button>
                                  ) : null}
                                  <button type="button" role="menuitem" className="is-danger" onClick={() => openDeleteConfirm(branch)}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  <div className="branch-card-list" aria-label="Branch cards">
                    {paginatedBranches.map((branch, index) => {
                      const isUpwardMenu = index >= paginatedBranches.length - 2

                      return (
                        <article className="branch-card" key={branch.id}>
                          <div className="branch-card-header">
                            <div className="branch-card-title">
                              <span className="branch-card-kicker">Branch {branch.branchId || '-'}</span>
                              <h3>{branch.branchName || 'Untitled branch'}</h3>
                            </div>

                            <div className="branch-card-header-actions">
                              <span className={`branch-status-pill ${String(branch.status || '').trim().toLowerCase() === 'active' ? 'is-active' : ''}`.trim()}>
                                {branch.status || 'Unknown'}
                              </span>

                              <div
                                className={`branch-actions branch-actions-wrap ${isUpwardMenu ? 'is-upward' : ''} ${actionMenuBranchId === branch.id ? 'is-open' : ''}`.trim()}
                                onMouseEnter={() => {
                                  if (actionMenuCloseTimerRef.current) {
                                    clearTimeout(actionMenuCloseTimerRef.current)
                                  }
                                  setActionMenuBranchId(branch.id)
                                }}
                                onMouseLeave={() => {
                                  actionMenuCloseTimerRef.current = setTimeout(() => {
                                    setActionMenuBranchId(null)
                                  }, 200)
                                }}
                              >
                                <button
                                  type="button"
                                  className="branch-actions-trigger"
                                  aria-label={`Open actions for ${branch.branchName}`}
                                  aria-haspopup="menu"
                                  aria-expanded={actionMenuBranchId === branch.id}
                                  onClick={() => setActionMenuBranchId(branch.id)}
                                >
                                  <MoreVertical size={18} strokeWidth={2.3} />
                                </button>

                                <div
                                  className="branch-actions-menu"
                                  role="menu"
                                  aria-label={`${branch.branchName} actions`}
                                >
                                  <button type="button" role="menuitem" onClick={() => openViewBranch(branch)}>
                                    View
                                  </button>
                                  <button type="button" role="menuitem" onClick={() => openEditBranch(branch)}>
                                    Edit
                                  </button>
                                  <button type="button" role="menuitem" className="is-danger" onClick={() => openDeleteConfirm(branch)}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <dl className="branch-card-details">
                            <div>
                              <dt>Admin</dt>
                              <dd>{branch.branchAdminName || 'Branch admin not set'}</dd>
                            </div>
                            <div>
                              <dt>Location</dt>
                              <dd>{branch.branchAddress || '-'}</dd>
                            </div>
                            <div>
                              <dt>Contact</dt>
                              <dd>
                                <span>{branch.branchEmail || '-'}</span>
                                <span>{branch.branchPhone || '-'}</span>
                              </dd>
                            </div>
                            <div>
                              <dt>Dashboard</dt>
                              <dd>
                                {getNormalizedBranchStatus(branch) === 'Active' ? (
                                  <button 
                                    type="button" 
                                    className="sa-view-dashboard-btn"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      openViewDashboardConfirm(branch)
                                    }}
                                  >
                                    <LayoutDashboard size={14} strokeWidth={2.3} />
                                    View
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Inactive</span>
                                )}
                              </dd>
                            </div>
                          </dl>

                          <div className="branch-card-actions">
                            <button
                              type="button"
                              className="branch-inline-view-arrow"
                              onClick={() => openViewBranch(branch)}
                              aria-label={`View details for branch ID ${branch.branchId || ''}`.trim()}
                              title="View details"
                            >
                              <ChevronRight size={16} strokeWidth={2.4} />
                            </button>
                            <div className="branch-resend-inline-cell">
                              {isResendMailActive(branch) ? (
                                <span className="branch-mail-status-pill is-active">Active</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="branch-resend-inline-button"
                                    onClick={() => openResendMail(branch)}
                                  >
                                    Resend Mail
                                  </button>
                                  <span className="branch-mail-status-pill">Inactive</span>
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>

                  <div className="branch-table-footer">
                    <span className="branch-table-footer-summary">
                      Showing {filteredBranches.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1}
                      {' '}to{' '}
                      {Math.min(safeCurrentPage * rowsPerPage, filteredBranches.length)}
                      {' '}of {filteredBranches.length} branches
                    </span>

                    <PaginationBar
                      className="super-admin-pagination"
                      currentPage={safeCurrentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      label="Branch pagination"
                      previousLabel="Prev"
                      nextLabel="Next"
                      showSummary={false}
                    />
                  </div>
                </div>
              </section>
            ) : activeSection === 'branch-admin' ? (
              <section className="super-admin-global-panel">
                <div className="super-admin-global-header">
                  <div><p className="branch-management-kicker">User &amp; Role Management</p><h1>Branch Admin</h1></div>
                  <span className="super-admin-global-count">{filteredBranches.length} branch admins</span>
                </div>
                <div className="super-admin-global-table-wrap">
                  <table className="super-admin-global-table">
                    <thead><tr><th>S.No</th><th>Branch ID</th><th>Admin Name</th><th>Mobile Number</th><th>Branch</th><th>Branch Address</th></tr></thead>
                    <tbody>
                      {paginatedBranches.map((branch, index) => <tr key={branch.id || branch.branchId} role="button" tabIndex={0} className="super-admin-global-table-row-action" aria-label={`View ${branch.branchName || branch.branchId || 'branch'} details`} onClick={() => openViewBranch(branch)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openViewBranch(branch) } }}><td>{(safeCurrentPage - 1) * rowsPerPage + index + 1}</td><td><strong>{branch.branchId || '-'}</strong></td><td><strong>{branch.branchAdminName || 'Branch admin not set'}</strong><small>{branch.branchAdminEmail || branch.branchEmail || '-'}</small></td><td>{branch.branchAdminPhone || branch.adminPhone || branch.branchPhone || '-'}</td><td><strong>{branch.branchName || '-'}</strong></td><td>{branch.branchAddress || '-'}</td></tr>)}
                      {!filteredBranches.length ? <tr><td colSpan="6" className="super-admin-global-empty">No branch admin records found.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
                {filteredBranches.length > rowsPerPage ? <PaginationBar className="super-admin-pagination" currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={setCurrentPage} label="Branch admin pagination" previousLabel="Prev" nextLabel="Next" /> : null}
              </section>
            ) : activeSection === 'faculty' ? (
              <section className="super-admin-global-panel">
                <div className="super-admin-global-header">
                  <div><p className="branch-management-kicker">Academic Operations</p><h1>Faculty Management</h1><p>All faculty members across every active branch.</p></div>
                  <div className="super-admin-global-header-actions"><div className="super-admin-global-filter-field"><BranchFilterSelect value={globalFacultyBranchFilter} branches={globalBranchFilterOptions} onChange={(nextValue) => { setGlobalFacultyBranchFilter(nextValue); setGlobalFacultyPage(1) }} ariaLabel="Filter faculty by branch" /></div><span className="super-admin-global-count">{filteredGlobalFaculty.length} faculty</span></div>
                </div>
                {isGlobalManagementLoading ? <div className="super-admin-global-state">Loading faculty records...</div> : globalManagementError ? <div className="super-admin-global-state is-error">{globalManagementError}</div> : (
                  <><div className="super-admin-global-table-wrap"><table className="super-admin-global-table"><thead><tr><th>S.No</th><th>Faculty</th><th>Faculty ID</th><th>Branch</th><th>Branch Admin</th><th>Courses</th><th>Status</th></tr></thead><tbody>
                    {paginatedGlobalFaculty.map((faculty, index) => <tr key={faculty.id || `${faculty.branchId}-${faculty.facultyId}`}><td>{(safeGlobalFacultyPage - 1) * globalRowsPerPage + index + 1}</td><td><strong>{faculty.name || '-'}</strong><small>{faculty.email || '-'}</small></td><td>{faculty.facultyId || '-'}</td><td><strong>{faculty.branch?.branchName || faculty.branchName || faculty.branchRecord?.branchName || '-'}</strong><small>{faculty.branch?.branchId || faculty.branchRecord?.branchId || '-'}</small></td><td>{faculty.branch?.branchAdminName || faculty.branchAdminName || faculty.branchRecord?.branchAdminName || '-'}</td><td>{(faculty.courses || []).map((course) => course.name).filter(Boolean).join(', ') || faculty.course?.name || '-'}</td><td><span className={`super-admin-global-status ${String(faculty.status || '').toLowerCase() === 'active' ? 'is-active' : 'is-inactive'}`}>{faculty.status || '-'}</span></td></tr>)}
                    {!filteredGlobalFaculty.length ? <tr><td colSpan="7" className="super-admin-global-empty">No faculty records found for this branch.</td></tr> : null}
                  </tbody></table></div>
                  {filteredGlobalFaculty.length > globalRowsPerPage ? <PaginationBar className="super-admin-pagination" currentPage={safeGlobalFacultyPage} totalPages={globalFacultyTotalPages} onPageChange={setGlobalFacultyPage} label="Faculty pagination" previousLabel="Prev" nextLabel="Next" /> : null}</>
                )}
              </section>
            ) : activeSection === 'students' ? (
              <section className="super-admin-global-panel">
                <div className="super-admin-global-header"><div><p className="branch-management-kicker">Academic Operations</p><h1>Student Management</h1><p>All students registered across every active branch.</p></div><div className="super-admin-global-header-actions"><div className="super-admin-global-filter-field"><BranchFilterSelect value={globalStudentBranchFilter} branches={globalBranchFilterOptions} onChange={(nextValue) => { setGlobalStudentBranchFilter(nextValue); setGlobalStudentPage(1) }} ariaLabel="Filter students by branch" /></div><span className="super-admin-global-count">{filteredGlobalStudents.length} students</span></div></div>
                <div className="super-admin-global-table-wrap"><table className="super-admin-global-table"><thead><tr><th>S.No</th><th>Student</th><th>Student ID</th><th>Branch</th><th>Course</th><th>Batch</th><th>Status</th></tr></thead><tbody>
                  {paginatedGlobalStudents.map((student, index) => <tr key={student.id || `${student.branchId}-${student.studentId}`}><td>{(safeGlobalStudentPage - 1) * globalRowsPerPage + index + 1}</td><td><strong>{student.studentName || student.name || '-'}</strong><small>{student.emailAddress || student.email || '-'}</small></td><td>{student.studentId || student.studentCode || '-'}</td><td><strong>{student.branchRecord?.branchName || student.branchName || '-'}</strong><small>{student.branchRecord?.branchId || student.branchId || '-'}</small></td><td>{student.courseName || student.course?.name || student.courseInterested || '-'}</td><td>{student.batchName || '-'}</td><td><span className={`super-admin-global-status ${String(student.recordStatus || student.currentStatus || '').toLowerCase() === 'active' ? 'is-active' : 'is-inactive'}`}>{student.recordStatus || student.currentStatus || '-'}</span></td></tr>)}
                  {!filteredGlobalStudents.length ? <tr><td colSpan="7" className="super-admin-global-empty">No student records found for this branch.</td></tr> : null}
                </tbody></table></div>
                {filteredGlobalStudents.length > globalRowsPerPage ? <PaginationBar className="super-admin-pagination" currentPage={safeGlobalStudentPage} totalPages={globalStudentTotalPages} onPageChange={setGlobalStudentPage} label="Student pagination" previousLabel="Prev" nextLabel="Next" /> : null}
              </section>
            ) : ['leave-management', 'faculty-leave'].includes(activeSection) ? (
              <section className="super-admin-global-panel">
                <div className="super-admin-global-header"><div><p className="branch-management-kicker">Academic Operations</p><h1>Faculty Leave Management</h1><p>Faculty leave requests across every active branch.</p></div><span className="super-admin-global-count">{allBranchLeaves.length} requests</span></div>
                <div className="super-admin-global-table-wrap"><table className="super-admin-global-table"><thead><tr><th>S.No</th><th>Type</th><th>Person / Reason</th><th>Branch</th><th>Date</th><th>Status</th></tr></thead><tbody>
                  {paginatedGlobalLeaves.map((item, index) => <tr key={item.id || `${item.leaveCategory}-${index}`}><td>{(safeGlobalLeavePage - 1) * globalRowsPerPage + index + 1}</td><td><strong>{item.leaveCategory}</strong></td><td><strong>{item.facultyName || item.reason || 'Leave'}</strong><small>{item.facultyId || item.leaveDate || item.fromDate || '-'}</small></td><td><strong>{item.branchRecord?.branchName || '-'}</strong><small>{item.branchRecord?.branchId || '-'}</small></td><td>{item.leaveDate || item.fromDate || '-'}{item.toDate && item.toDate !== item.fromDate ? ` to ${item.toDate}` : ''}</td><td><span className="super-admin-global-status">{item.status || '-'}</span></td></tr>)}
                  {!allBranchLeaves.length ? <tr><td colSpan="6" className="super-admin-global-empty">No leave records found.</td></tr> : null}
                </tbody></table></div>
                {allBranchLeaves.length > globalRowsPerPage ? <PaginationBar className="super-admin-pagination" currentPage={safeGlobalLeavePage} totalPages={globalLeaveTotalPages} onPageChange={setGlobalLeavePage} label="Faculty leave pagination" previousLabel="Prev" nextLabel="Next" /> : null}
              </section>
            ) : (
              <>
              <SuperAdminOverallDashboard branches={branches} userKey={user?.id || user?.email || 'super-admin'} onOpenStudent360={openSuperAdminStudent360} />
              {/* Legacy branch summary intentionally replaced by the consolidated overview. */}
              {branches.length < 0 && <div className="super-admin-dashboard-overview">
                <div className="super-admin-dashboard-intro">
                  <h1>Dashboard</h1>
                  <p>Welcome back! Here’s an overview of your operations and today’s activities.</p>
                </div>

                <div className="super-admin-stats-grid" aria-label="Dashboard branch summary">
                  <article
                    className="super-admin-stat-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveSection('branches')
                      setStatusFilter('All')
                      setCurrentPage(1)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setActiveSection('branches')
                        setStatusFilter('All')
                        setCurrentPage(1)
                      }
                    }}
                    aria-label="View all branches"
                  >
                    <span className="super-admin-stat-icon" aria-hidden="true">
                      <Building2 size={20} strokeWidth={2.1} />
                    </span>
                    <div className="super-admin-stat-copy">
                      <span className="super-admin-stat-label">Total branches</span>
                      <strong className="super-admin-stat-value">{totalBranches}</strong>
                      <span className="super-admin-stat-note">All branches</span>
                    </div>
                  </article>

                  <article
                    className="super-admin-stat-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveSection('branches')
                      setStatusFilter('Active')
                      setCurrentPage(1)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setActiveSection('branches')
                        setStatusFilter('Active')
                        setCurrentPage(1)
                      }
                    }}
                    aria-label="View active branches"
                  >
                    <span className="super-admin-stat-icon is-success" aria-hidden="true">
                      <CheckCircle2 size={20} strokeWidth={2.1} />
                    </span>
                    <div className="super-admin-stat-copy">
                      <span className="super-admin-stat-label">Active branches</span>
                      <strong className="super-admin-stat-value">{activeBranches}</strong>
                      <span className="super-admin-stat-note">Currently active</span>
                    </div>
                  </article>
                </div>
              </div>}
              </>
            )}
          </main>
        </div>
      </div>

      {selectedBranch ? (
        <div className="branch-view-drawer-backdrop" role="presentation">
          <aside
            className="branch-view-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-view-title"
            aria-describedby="branch-view-description"
          >
            <div className="branch-view-drawer-header">
              <div className="branch-view-drawer-title-block">
                <h2 id="branch-view-title">BRANCH DETAILS</h2>
                <p id="branch-view-description">Complete information about this branch</p>
              </div>

              <div className="branch-view-drawer-header-actions">
                <span className={`branch-view-status-chip ${String(selectedBranch.status || '').trim().toLowerCase() === 'active' ? 'is-active' : 'is-inactive'}`.trim()}>
                  {selectedBranch.status || 'Unknown'}
                </span>
                <button
  type="button"
  className="branch-view-close"
  onClick={closeViewBranch}
  aria-label="Close branch details"
>
  <X size={22} strokeWidth={2.5} aria-hidden="true" />
</button>
              </div>
            </div>

            <div className="branch-view-drawer-body">
              <section className="branch-view-info-card">
                <div className="branch-view-info-card-header">
                  <span className="branch-view-info-icon" aria-hidden="true">
                    <Building2 size={18} strokeWidth={2.2} />
                  </span>
                  <h3>Branch Information</h3>
                </div>

                <div className="branch-view-info-rows">
                  {[
                    { label: 'Branch ID', icon: <BadgeCheck size={18} strokeWidth={2.1} />, value: selectedBranch.branchId || '-' },
                    { label: 'Branch Name', icon: <Building2 size={18} strokeWidth={2.1} />, value: selectedBranch.branchName || '-' },
                    { label: 'Branch Admin', icon: <CircleUserRound size={18} strokeWidth={2.1} />, value: selectedBranch.branchAdminName || '-' },
                    { label: 'Email', icon: <Mail size={18} strokeWidth={2.1} />, value: selectedBranch.branchEmail || '-' },
                    { label: 'Phone', icon: <Phone size={18} strokeWidth={2.1} />, value: selectedBranch.branchPhone || '-' },
                    { label: 'Address', icon: <MapPin size={18} strokeWidth={2.1} />, value: selectedBranch.branchAddress || '-' },
                    {
                      label: 'City',
                      icon: <MapPin size={18} strokeWidth={2.1} />,
                      value:
                        pickFirstNonEmpty(
                          selectedBranch.branchDistrict,
                          selectedBranch.branchCity,
                          selectedBranch.district,
                          selectedBranch.city,
                        ) || '-',
                    },
                    {
                      label: 'State',
                      icon: <MapPin size={18} strokeWidth={2.1} />,
                      value: pickFirstNonEmpty(selectedBranch.branchState, selectedBranch.state) || '-',
                    },
                    {
                      label: 'Country',
                      icon: <MapPin size={18} strokeWidth={2.1} />,
                      value: pickFirstNonEmpty(selectedBranch.branchCountry, selectedBranch.country) || '-',
                    },
                    { label: 'Created Date', icon: <CalendarDays size={18} strokeWidth={2.1} />, value: formatDisplayDate(selectedBranch.createdAt) },
                  ].map((item) => (
                    <div className="branch-view-info-row" key={item.label}>
                      <div className="branch-view-info-label">
                        {item.icon ? <span className="branch-view-row-icon" aria-hidden="true">{item.icon}</span> : <span className="branch-view-row-icon is-placeholder" aria-hidden="true" />}
                        <span>{item.label}</span>
                      </div>
                      <div className="branch-view-info-separator">:</div>
                      <div className="branch-view-info-value">
                        {item.label === 'Status' ? (
                          <span className={`branch-view-status-chip ${String(item.value || '').trim().toLowerCase() === 'active' ? 'is-active' : 'is-inactive'}`.trim()}>
                            {item.value}
                          </span>
                        ) : (
                          item.value
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {isAddBranchOpen ? (
        <div className="branch-modal-backdrop" role="presentation">
          <form className="branch-modal" role="dialog" aria-modal="true" noValidate onClick={(event) => event.stopPropagation()} onSubmit={handleAddBranch}>
           <button
  type="button"
  className="branch-modal-close"
  aria-label="Close add branch form"
  onClick={closeBranchModal}
>
  <X size={22} strokeWidth={2.5} aria-hidden="true" />
</button>

            <h2>{editingBranchId !== null ? 'Edit branch information' : 'Create Branch'}</h2>

            {actionError ? <p className="branch-field-error">{actionError}</p> : null}

            <div className="branch-form-grid">
              <label className="branch-field">
                <span>Branch ID</span>
                <input
                  type="text"
                  value={form.branchId}
                  onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value.toUpperCase() }))}
                  placeholder="SAI001"
                  maxLength={16}
                />
                {branchErrors.branchId ? <small className="branch-field-error">{branchErrors.branchId}</small> : null}
              </label>

              <label className="branch-field">
                <span>Branch Name</span>
                <input
                  type="text"
                  value={form.branchName}
                  onChange={(event) => updateBranchName(event.target.value)}
                  placeholder="Enter branch name"
                  inputMode="text"
                  maxLength={50}
                />
                {branchErrors.branchName ? <small className="branch-field-error">{branchErrors.branchName}</small> : null}
              </label>

              <label className="branch-field">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  className="branch-location-select"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>

              <label className="branch-field">
                <span>Branch Admin Name</span>
                <input
                  type="text"
                  value={form.branchAdminName}
                  onChange={(event) => updateBranchAdminName(event.target.value)}
                  placeholder="Enter branch admin name"
                  inputMode="text"
                  maxLength={50}
                />
                {branchErrors.branchAdminName ? <small className="branch-field-error">{branchErrors.branchAdminName}</small> : null}
              </label>

              <label className="branch-field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.branchEmail}
                  onChange={(event) => updateBranchEmail(event.target.value)}
                  placeholder="Enter email"
                  className="branch-email-input"
                />
                {branchErrors.branchEmail ? <small className="branch-field-error">{branchErrors.branchEmail}</small> : null}
              </label>

              <label className="branch-field">
                <span>Phone Number</span>
                <input
                  type="tel"
                  value={form.branchPhone}
                  onChange={(event) => updateBranchPhone(event.target.value)}
                  placeholder="Enter phone number"
                  inputMode="numeric"
                  maxLength={10}
                />
                {branchErrors.branchPhone ? <small className="branch-field-error">{branchErrors.branchPhone}</small> : null}
              </label>

              <label className="branch-field">
                <span>Country</span>
                <select
                  value={form.branchCountryCode}
                  onChange={(event) => updateBranchCountry(event.target.value)}
                  className="branch-location-select"
                >
                  <option value="">Select Country</option>
                  {countryOptions.map((country) => (
                    <option key={country.iso2} value={country.iso2}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {branchErrors.branchCountry ? <small className="branch-field-error">{branchErrors.branchCountry}</small> : null}
              </label>

              <label className="branch-field">
                <span>State</span>
                <select
                  value={form.branchStateCode}
                  onChange={(event) => updateBranchState(event.target.value)}
                  className="branch-location-select"
                  disabled={!form.branchCountryCode}
                >
                  <option value="">
                    {form.branchCountryCode ? 'Select State' : 'Select Country first'}
                  </option>
                  {stateOptions.map((state) => (
                    <option key={state.iso2} value={state.iso2}>
                      {state.name}
                    </option>
                  ))}
                  {form.branchCountryCode && stateOptions.length === 0 ? (
                    <option value="" disabled>
                      No states available
                    </option>
                  ) : null}
                </select>
                {branchErrors.branchState ? <small className="branch-field-error">{branchErrors.branchState}</small> : null}
              </label>

              <label className="branch-field">
                <span>City</span>
                <select
                  value={form.branchDistrict}
                  onChange={(event) => updateBranchDistrict(event.target.value)}
                  className="branch-location-select"
                  disabled={!form.branchStateCode}
                >
                  <option value="">
                    {form.branchStateCode ? 'Select City' : 'Select State first'}
                  </option>
                  {cityOptions.map((city) => (
                    <option key={String(city.id || city.name)} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                  {form.branchStateCode && cityOptions.length === 0 ? (
                    <option value="" disabled>
                      No cities available
                    </option>
                  ) : null}
                </select>
                {branchErrors.branchDistrict ? <small className="branch-field-error">{branchErrors.branchDistrict}</small> : null}
              </label>

              <label className="branch-field">
                <span>Address</span>
                <input
                  type="text"
                  value={form.branchAddress}
                  onChange={(event) => updateField('branchAddress', event.target.value)}
                  placeholder="Enter address"
                  maxLength={160}
                />
                {branchErrors.branchAddress ? <small className="branch-field-error">{branchErrors.branchAddress}</small> : null}
              </label>
            </div>

            <div className="branch-modal-actions">
              <button type="button" className="branch-modal-cancel" onClick={closeBranchModal}>
                Cancel
              </button>
              <button type="submit" className="branch-modal-submit">
               {isSubmitting ? 'Submitting...' : editingBranchId !== null ? 'Save changes' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isSuccessOpen ? (
        <div className="branch-modal-backdrop" role="presentation" onClick={(event) => event.stopPropagation()}>
          <div className="branch-success-modal" role="dialog" aria-modal="true" aria-labelledby="branch-success-title">
           <button
  type="button"
  className="branch-success-close"
  onClick={() => setIsSuccessOpen(false)}
  aria-label="Close"
>
  <X size={22} strokeWidth={2.5} />
</button>

            <div className="branch-success-hero" aria-hidden="true">
              <span className="branch-success-hero-icon">{String.fromCharCode(10003)}</span>
              <span className="branch-success-hero-ring" />
            </div>

            <div className="branch-success-copy">
              <h2 id="branch-success-title">{successTitle}</h2>
              <p>{successMessage}</p>
            </div>

            <div className="branch-success-actions">
              <button type="button" className="branch-success-secondary" onClick={() => setIsSuccessOpen(false)}>
                Close
              </button>
              <button type="button" className="branch-success-primary" onClick={() => setIsSuccessOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isResendConfirmOpen ? (
        <div className="branch-modal-backdrop" role="presentation" onClick={closeResendConfirm}>
          <div className="branch-delete-modal branch-resend-modal" role="dialog" aria-modal="true" aria-labelledby="resend-mail-title">
            <button
              type="button"
              className="branch-modal-close"
              aria-label="Close resend confirmation"
              onClick={closeResendConfirm}
            >
              X
            </button>

            <div className="branch-delete-icon branch-resend-icon" aria-hidden="true">
              !
            </div>

            <h2 id="resend-mail-title">Resend invitation mail?</h2>
            <p>
              {resendTargetBranch
                ? `Resend invitation mail to ${resendTargetBranch.branchEmail}?`
                : 'Resend invitation mail to this branch?'}
            </p>

            <div className="branch-delete-actions">
              <button type="button" className="branch-delete-cancel" onClick={closeResendConfirm}>
                Cancel
              </button>
              <button type="button" className="branch-delete-danger" onClick={handleSendMail}>
                Send Mail
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteConfirmOpen ? (
        <div className="branch-modal-backdrop" role="presentation">
          <div className="branch-delete-modal" role="dialog" aria-modal="true" aria-labelledby="branch-delete-title">
          <button
  type="button"
  className="branch-modal-close"
  aria-label="Close delete confirmation"
  onClick={closeDeleteConfirm}
>
  <X size={22} strokeWidth={2.5} aria-hidden="true" />
</button>

            <div className="branch-delete-icon" aria-hidden="true">
              !
            </div>

            <h2 id="branch-delete-title">Confirm delete</h2>
            <p>
              {deleteTargetBranch
                ? `Are you sure you want to delete ${deleteTargetBranch.branchName}?`
                : 'Are you sure you want to delete this branch?'}
            </p>

            <div className="branch-delete-actions">
              <button type="button" className="branch-delete-cancel" onClick={closeDeleteConfirm}>
                Cancel
              </button>
              <button type="button" className="branch-delete-danger" onClick={handleDeleteBranch} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLogoutConfirmOpen ? (
        <div className="branch-modal-backdrop" role="presentation">
          <div
            className="super-admin-logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="super-admin-logout-title"
            aria-describedby="super-admin-logout-description"
            onClick={(event) => event.stopPropagation()}
          >
           <button
  type="button"
  className="super-admin-logout-close"
  aria-label="Close logout confirmation"
  onClick={closeLogoutConfirm}
>
  <X size={22} strokeWidth={2.5} aria-hidden="true" />
</button>

            <h2 id="super-admin-logout-title">Are you sure you want to logout?</h2>

            <div className="super-admin-logout-actions">
              <button type="button" className="super-admin-logout-cancel" onClick={closeLogoutConfirm}>
                Cancel
              </button>
              <button type="button" className="super-admin-logout-submit" onClick={handleConfirmLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isViewDashboardConfirmOpen && viewDashboardBranch ? (
        <div className="branch-modal-backdrop" role="presentation">
          <div
            className="branch-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-dashboard-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="branch-delete-header">
              <div className="branch-delete-icon" aria-hidden="true">
                <LayoutDashboard size={24} strokeWidth={2.1} />
              </div>
              <h2 id="view-dashboard-title">View Dashboard</h2>
            </div>
            
            <p>
              Are you sure you want to view <strong>{viewDashboardBranch.branchName}</strong>'s dashboard? You will be able to manage this branch's data.
            </p>

            <div className="branch-delete-actions">
              <button type="button" className="branch-delete-cancel" onClick={closeViewDashboardConfirm}>
                Cancel
              </button>
              <button type="button" className="sa-view-dashboard-btn" onClick={handleConfirmViewDashboard} style={{ background: '#0f4fb8', color: '#fff', border: 'none' }}>
                View Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  )
}
