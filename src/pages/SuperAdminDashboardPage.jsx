import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCitiesOfState, getCountries, getStatesOfCountry } from '@countrystatecity/countries-browser'
import {
  Bell,
  BadgeCheck,
  Building2,
  CircleUserRound,
  CheckCircle2,
  CalendarDays,
  Mail,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  ChevronRight,
  MapPin,
  Phone,
  Search,
  Shield,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import {
  createBranch,
  deleteBranch,
  listBranches,
  resendBranchInvitation,
  updateBranch,
} from '../services/branchService'
import { PaginationBar } from '../components/PaginationBar'
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
      <CircleUserRound size={34} strokeWidth={1.9} />
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

function formatBranchLocation(branch) {
  const parts = [
    String(branch?.branchAddress || '').trim(),
    String(branch?.branchCity || branch?.branchDistrict || '').trim(),
    String(branch?.branchState || '').trim(),
    String(branch?.branchCountry || '').trim(),
  ].filter(Boolean)

  return parts.length ? parts.join(', ') : '-'
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

const BRANCH_ID_PREFIX = 'BR-'
const DEFAULT_BRANCH_COUNTRY_NAME = 'India'

function formatBranchIdNumber(value) {
  return String(value || '').padStart(3, '0')
}

function getNextBranchId(existingBranches = []) {
  const highestBranchNumber = (Array.isArray(existingBranches) ? existingBranches : []).reduce((highest, branch) => {
    const match = String(branch?.branchId || '')
      .trim()
      .match(/^BR-(\d+)$/i)

    if (!match) return highest

    const branchNumber = Number(match[1])
    if (!Number.isFinite(branchNumber)) return highest

    return Math.max(highest, branchNumber)
  }, 0)

  return `${BRANCH_ID_PREFIX}${formatBranchIdNumber(highestBranchNumber + 1)}`
}

function getDefaultBranchCountry(countryOptions = []) {
  return (Array.isArray(countryOptions) ? countryOptions : []).find((item) => {
    const name = String(item?.name || '').trim().toLowerCase()
    const iso2 = String(item?.iso2 || '').trim().toUpperCase()
    return name === DEFAULT_BRANCH_COUNTRY_NAME.toLowerCase() || iso2 === 'IN'
  })
}

function validateBranchField(field, value) {
  const text = String(value || '').trim()

  switch (field) {
    case 'branchId':
      if (!text) return 'Branch ID is required'
      if (!/^BR-\d{3}$/.test(text)) return 'Branch ID must follow BR-001 format'
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

  return {
    branchId:
      validateBranchField('branchId', form.branchId) ||
      (normalizedBranchId && branchIdExists ? 'Branch ID already exists' : ''),
    branchName: validateBranchField('branchName', form.branchName),
    branchAdminName: validateBranchField('branchAdminName', form.branchAdminName),
    branchEmail: validateBranchField('branchEmail', form.branchEmail) || duplicateEmailError,
    branchPhone: validateBranchField('branchPhone', form.branchPhone),
    branchCountry: validateBranchField('branchCountry', form.branchCountry),
    branchState: validateBranchField('branchState', form.branchState),
    branchDistrict: validateBranchField('branchDistrict', form.branchDistrict),
    branchAddress: validateBranchField('branchAddress', form.branchAddress),
  }
}

export function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const { signOut, user } = useAuth()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [branches, setBranches] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [stateOptions, setStateOptions] = useState([])
  const [cityOptions, setCityOptions] = useState([])
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isResendConfirmOpen, setIsResendConfirmOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [viewTargetBranch, setViewTargetBranch] = useState(null)
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
  const [form, setForm] = useState({
    branchId: '',
    branchName: '',
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
      setBranches(Array.isArray(result?.data) ? result.data : [])
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
    isMobileSidebarOpen

  useEffect(() => {
    void loadBranches()
  }, [loadBranches])

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
    if (!query) return branches

    return branches.filter((branch) => {
      return [branch.branchId, branch.branchName].some((value) =>
        String(value || '').toLowerCase().includes(query),
      )
    })
  }, [branches, searchTerm])

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
    setForm({
      branchId: getNextBranchId(branches),
      branchName: '',
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

  const updateBranchPhone = (value) => {
    const rawText = String(value || '')
    const nextValue = rawText.replace(/\D+/g, '').slice(0, 10)
    setForm((current) => ({ ...current, branchPhone: nextValue }))
    setBranchErrors((current) => ({ ...current, branchPhone: '' }))
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

    const branchId = editingBranchId !== null ? String(form.branchId || '').trim() : getNextBranchId(branches)
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
      branchAdminName: nextForm.branchAdminName.trim(),
      branchEmail: nextForm.branchEmail.trim(),
      branchPhone: cleanedPhone,
      branchCountryCode: nextForm.branchCountryCode.trim(),
      branchCountry: nextForm.branchCountry.trim(),
      branchStateCode: nextForm.branchStateCode.trim(),
      branchState: nextForm.branchState.trim(),
      branchCity: nextForm.branchDistrict.trim(),
      branchDistrict: nextForm.branchDistrict.trim(),
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
        status: 'Active',
        createdAt: formatToday(),
      })

      setBranches((current) => [nextBranch, ...current])
      setIsAddBranchOpen(false)
      setEditingBranchId(null)
      setSuccessTitle('Invitation email sent')
      setSuccessMessage('Login credentials have been sent to the registered email.')
      setIsSuccessOpen(true)
    } catch (error) {
      setActionError(error?.body?.message || error?.message || 'Unable to save branch right now.')
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

        <aside
          className={`super-admin-sidebar ${isMobileSidebarOpen ? 'is-open' : ''}`.trim()}
          aria-label="Super admin navigation"
        >
          <div className="super-admin-sidebar-brand">
            <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="Elite Admin logo" />
          </div>

          <nav className="super-admin-sidebar-nav">
            <button
              type="button"
              className={`super-admin-sidebar-item ${activeSection === 'dashboard' ? 'is-active' : ''}`.trim()}
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
            <button
              type="button"
              className={`super-admin-sidebar-item ${activeSection === 'branches' ? 'is-active' : ''}`.trim()}
              onClick={() => {
                setActiveSection('branches')
                setIsMobileSidebarOpen(false)
              }}
            >
              <span className="super-admin-sidebar-icon" aria-hidden="true">
                <Building2 size={18} strokeWidth={2.2} />
              </span>
              <span>Branches</span>
            </button>
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
            <div className="super-admin-topbar-right">
              <button type="button" className="super-admin-notification-button" aria-label="Notifications">
                <Bell size={22} strokeWidth={2.1} />
                <span className="super-admin-notification-badge">8</span>
              </button>

              <div className="super-admin-profile">
                <AvatarBadge />
                <div className="super-admin-profile-copy">
                  <strong>Super Admin</strong>
                  <span>{profileEmail}</span>
                </div>
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

                <div className="branch-management-toolbar">
                  <div className="branch-search">
                    <span className="branch-search-icon" aria-hidden="true">
                      <Search size={16} strokeWidth={2.2} />
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      placeholder="Search..."
                      aria-label="Search branches"
                    />
                    <button type="button" className="branch-search-button">
                      Search
                    </button>
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
                        <th className="branch-table-col-contact">Contact</th>
                        <th className="branch-table-col-created">Created At</th>
                        <th className="branch-table-col-actions">Actions</th>
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
                                <strong>{branch.branchId}</strong>
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
                              </div>
                            </td>
                            <td className="branch-table-col-name">
                              <strong>{branch.branchName}</strong>
                            </td>
                            <td className="branch-table-col-admin">
                              <span>{branch.branchAdminName || 'Branch admin not set'}</span>
                            </td>
                            <td className="branch-table-col-contact branch-contact-cell">
                              <span className="branch-contact-email">{branch.branchEmail}</span>
                              <span className="branch-contact-phone">{branch.branchPhone}</span>
                            </td>
                            <td className="branch-table-col-created branch-created-at-cell">{branch.createdAt}</td>
                            <td
                              className="branch-table-col-actions"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <div
                                className={`branch-actions branch-actions-wrap ${isUpwardMenu ? 'is-upward' : ''} ${actionMenuBranchId === branch.id ? 'is-open' : ''}`.trim()}
                                onMouseEnter={() => setActionMenuBranchId(branch.id)}
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
                                onMouseEnter={() => setActionMenuBranchId(branch.id)}
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
                              <dt>Created At</dt>
                              <dd>{branch.createdAt ? formatDisplayDate(branch.createdAt) : '-'}</dd>
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
            ) : (
              <div className="super-admin-dashboard-overview">
                <div className="super-admin-dashboard-intro">
                  <p className="eyebrow">Super Admin</p>
                </div>

                <div className="super-admin-stats-grid" aria-label="Dashboard branch summary">
                  <article className="super-admin-stat-card">
                    <span className="super-admin-stat-icon" aria-hidden="true">
                      <Building2 size={20} strokeWidth={2.1} />
                    </span>
                    <div className="super-admin-stat-copy">
                      <span className="super-admin-stat-label">Total branches</span>
                      <strong className="super-admin-stat-value">{totalBranches}</strong>
                      <span className="super-admin-stat-note">All branches</span>
                    </div>
                  </article>

                  <article className="super-admin-stat-card">
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
              </div>
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
                  X
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
                    { label: 'Location', icon: <MapPin size={18} strokeWidth={2.1} />, value: formatBranchLocation(selectedBranch) },
                    { label: 'Email', icon: <Mail size={18} strokeWidth={2.1} />, value: selectedBranch.branchEmail || '-' },
                    { label: 'Phone', icon: <Phone size={18} strokeWidth={2.1} />, value: selectedBranch.branchPhone || '-' },
                    { label: 'Status', icon: <CheckCircle2 size={18} strokeWidth={2.1} />, value: selectedBranch.status || '-' },
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
              X
            </button>

            <h2>{editingBranchId !== null ? 'Edit branch information' : 'Create Branch'}</h2>

            {actionError ? <p className="branch-field-error">{actionError}</p> : null}

            <div className="branch-form-grid">
              <label className="branch-field">
                <span>Branch ID</span>
                <input
                  type="text"
                  value={editingBranchId !== null ? form.branchId : getNextBranchId(branches)}
                  placeholder="Auto-generated"
                  readOnly
                  aria-readonly="true"
                  tabIndex={-1}
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
                  onChange={(event) => updateField('branchEmail', event.target.value)}
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

              <label className="branch-field branch-field-full">
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
              className="branch-modal-close"
              aria-label="Close success popup"
              onClick={() => setIsSuccessOpen(false)}
            >
              X
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
              X
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
        <div className="branch-modal-backdrop" role="presentation" onClick={closeLogoutConfirm}>
          <div
            className="branch-success-modal super-admin-logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="super-admin-logout-title"
            aria-describedby="super-admin-logout-description"
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

            <h2 id="super-admin-logout-title">Are you sure you want to logout?</h2>
           

            <div className="branch-modal-actions super-admin-logout-actions">
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
    </section>
  )
}
