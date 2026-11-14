import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCitiesOfState, getCountries, getStatesOfCountry } from '@countrystatecity/countries-browser'
import { AlertCircle, BriefcaseBusiness, Building2, CheckCircle2, ChevronDown, LayoutDashboard, Mail, MapPin, Phone, Shield, UserPlus, Users, X } from 'lucide-react'
import { request } from '../services/apiClient'
import '../styles/SalesAdminHistoryOverride.css'
import { deleteBranch, listBranches, updateBranch } from '../services/branchService'
import { listBranchAccessUsers } from '../services/userRoleManagementService'
import '../styles/UserRoleManagementPage.css'

const moduleAccessGroups = [
  { key: 'COMMON', label: 'Common access', modules: [
    { key: 'DASHBOARD', label: 'Dashboard', description: 'Open the role dashboard', locked: true },
    { key: 'NOTIFICATIONS', label: 'Notifications', description: 'View account notifications', locked: true },
    { key: 'PROFILE', label: 'Profile', description: 'View and update profile details', locked: true },
    { key: 'SETTINGS', label: 'Settings', description: 'Manage account settings', locked: true },
  ] },
  { key: 'ACADEMIC', label: 'Academic operations', modules: [
    { key: 'STUDENT_MANAGEMENT', label: 'Student Management', description: 'Manage students and course records' },
    { key: 'ACADEMIC_OPERATIONS', label: 'Academic Operations', description: 'Manage courses, batches and academic workflows' },
    { key: 'FEE_ACCOUNTS', label: 'Fee & Accounts', description: 'Manage payments, installments and account records' },
    { key: 'REPORTS_ANALYTICS', label: 'Reports & Analytics', description: 'View and download operational reports' },
    { key: 'HELPDESK_SUPPORT', label: 'Helpdesk & Support', description: 'Manage support requests' },
  ] },
  { key: 'SALES_CRM', label: 'Sales CRM', modules: [
    { key: 'LEAD_MANAGEMENT', label: 'Lead Management', description: 'Manage leads and follow-ups' },
    { key: 'ADMISSION_MANAGEMENT', label: 'Admission Management', description: 'Manage admissions and conversions' },
    { key: 'SALES_CRM_REPORTS', label: 'Sales CRM Reports', description: 'View sales and conversion reports' },
  ] },
]
const commonModuleKeys = moduleAccessGroups[0].modules.map((module) => module.key)
const academicModuleKeys = moduleAccessGroups.find((group) => group.key === 'ACADEMIC').modules.map((module) => module.key)
const salesCrmModuleKeys = moduleAccessGroups.find((group) => group.key === 'SALES_CRM').modules.map((module) => module.key)
const roleModuleDefaults = {
  BRANCH_ADMIN: [...commonModuleKeys, 'STUDENT_MANAGEMENT', 'ACADEMIC_OPERATIONS', 'FEE_ACCOUNTS', 'REPORTS_ANALYTICS', 'HELPDESK_SUPPORT'],
  BRANCH_ADMIN_SALES_ADMIN: [...commonModuleKeys, 'STUDENT_MANAGEMENT', 'ACADEMIC_OPERATIONS', 'FEE_ACCOUNTS', 'REPORTS_ANALYTICS', 'HELPDESK_SUPPORT', 'LEAD_MANAGEMENT', 'ADMISSION_MANAGEMENT', 'SALES_CRM_REPORTS'],
  SALES_ADMIN: [...commonModuleKeys, 'LEAD_MANAGEMENT', 'ADMISSION_MANAGEMENT', 'SALES_CRM_REPORTS'],
}
const permittedModuleKeys = (accountType) => new Set([
  ...commonModuleKeys,
  ...(accountType === 'SALES_ADMIN' ? salesCrmModuleKeys : academicModuleKeys),
  ...(accountType === 'BRANCH_ADMIN_SALES_ADMIN' ? salesCrmModuleKeys : []),
])
function defaultModuleAccess(accountType = 'BRANCH_ADMIN') { return [...(roleModuleDefaults[accountType] || roleModuleDefaults.BRANCH_ADMIN)] }
function normalizedModuleAccess(value, accountType) {
  const selected = new Set(Array.isArray(value) ? value : defaultModuleAccess(accountType))
  commonModuleKeys.forEach((key) => selected.add(key))
  const permitted = permittedModuleKeys(accountType)
  return moduleAccessGroups.flatMap((group) => group.modules.map((module) => module.key)).filter((key) => selected.has(key) && permitted.has(key))
}
function orderedModuleAccessGroups(accountType, selectedKeys) {
  const selected = new Set(selectedKeys)
  const preferredOrder = accountType === 'SALES_ADMIN' ? ['SALES_CRM', 'ACADEMIC'] : ['ACADEMIC', 'SALES_CRM']
  const commonGroup = moduleAccessGroups.find((group) => group.key === 'COMMON')
  const roleGroups = moduleAccessGroups.filter((group) => group.key !== 'COMMON')
  return [commonGroup, ...roleGroups.sort((left, right) => {
    const leftSelected = left.modules.some((module) => selected.has(module.key))
    const rightSelected = right.modules.some((module) => selected.has(module.key))
    if (leftSelected !== rightSelected) return Number(rightSelected) - Number(leftSelected)
    return preferredOrder.indexOf(left.key) - preferredOrder.indexOf(right.key)
  })]
}

const accountTypes = [
  { value: 'BRANCH_ADMIN', label: 'Branch Admin', description: 'Manage one branch and its operations.', icon: Shield, tone: 'blue' },
  { value: 'BRANCH_ADMIN_SALES_ADMIN', label: 'Branch Admin + Sales Admin', description: 'Manage one branch with Sales CRM access.', icon: Users, tone: 'teal' },
  { value: 'SALES_ADMIN', label: 'Sales Admin', description: 'Manage Sales CRM across assigned branches.', icon: BriefcaseBusiness, tone: 'purple' },
]

const statusOptions = [
  { value: 'ACTIVE', label: 'Active', description: 'The account can sign in.', icon: CheckCircle2, tone: 'teal' },
  { value: 'INACTIVE', label: 'Inactive', description: 'Sign-in is allowed with view-only access.', icon: Shield, tone: 'purple' },
]

const roleFieldConfig = {
  BRANCH_ADMIN: { nameLabel: 'Branch Admin Name', requiresBranch: true, showStatus: true },
  BRANCH_ADMIN_SALES_ADMIN: { nameLabel: 'Branch Admin + Sales Admin Name', requiresBranch: true, showStatus: true },
  SALES_ADMIN: { nameLabel: 'Sales Admin Name', requiresBranch: false, showStatus: true, showSalesId: true },
}

const initialForm = { accountType: 'BRANCH_ADMIN', branchId: '', branchName: '', branchIds: [], salesAdminId: '', fullName: '', email: '', phone: '', country: 'India', state: 'Tamil Nadu', city: '', address: '', status: 'ACTIVE', moduleAccess: defaultModuleAccess('BRANCH_ADMIN') }

function normalizeError(error) {
  return String(error?.message || 'Unable to create the account. Please try again.')
}

function accountTypeLabel(value) {
  return value === 'BRANCH_ADMIN_SALES_ADMIN' ? 'Branch Admin + Sales Admin' : value === 'SALES_ADMIN' ? 'Sales Admin' : 'Branch Admin'
}

// Keep the canonical Sales Admin ID format consistent with the API. Older
// forms used `CISSALE001` (one trailing S); accept that input and normalize it
// to `CISSALES001` before validation and submission.
function normalizeSalesAdminId(value) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (/^CISSALES\d{3,}$/.test(normalized)) return normalized
  if (/^CISSALE\d{3,}$/.test(normalized)) return normalized.replace(/^CISSALE/, 'CISSALES')
  return normalized
}

function historyOperationLabel(value) {
  return value === 'ROLE_UPDATED' ? 'Role Updated' : value === 'EMAIL_VERIFIED' ? 'Email Verified' : value === 'ADMIN_REPLACED' ? 'Admin Replaced' : String(value || 'Account Updated').replaceAll('_', ' ')
}

function formatHistoryDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function AccountTypeSelect({ value, options, onChange, ariaLabel = 'Account type', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef(null)
  const selectedOption = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!selectRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function handleTriggerKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen((current) => !current)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const currentIndex = Math.max(0, options.findIndex((option) => option.value === value))
      const nextIndex = event.key === 'ArrowDown'
        ? (currentIndex + 1) % options.length
        : (currentIndex - 1 + options.length) % options.length
      onChange(options[nextIndex].value)
      setIsOpen(true)
    }
  }

  const SelectedIcon = selectedOption.icon

  return (
    <div ref={selectRef} className={`user-role-custom-select${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="user-role-custom-select-trigger"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className="user-role-custom-select-value">
          <span className="user-role-custom-select-icon"><SelectedIcon size={16} /></span>
          <span>{selectedOption.label}</span>
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="user-role-custom-select-menu" role="listbox" aria-label={`${ariaLabel} options`}>
          {options.map((option) => {
            const Icon = option.icon
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`user-role-custom-select-option${isSelected ? ' is-selected' : ''}`}
                onClick={() => { onChange(option.value); setIsOpen(false) }}
              >
                <span className={`user-role-custom-select-option-icon tone-${option.tone}`}><Icon size={15} /></span>
                <span className="user-role-custom-select-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
                {isSelected ? <span className="user-role-custom-select-check" aria-hidden="true">✓</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function BranchMultiSelect({ value = [], branches = [], onToggle, loading = false, error = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef(null)
  const selectedIds = new Set((Array.isArray(value) ? value : []).map((id) => String(id)))
  const selectedBranches = branches.filter((branch) => selectedIds.has(String(branch.id)))

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!selectRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={selectRef} className={`user-role-branch-multi-select${isOpen ? ' is-open' : ''}`}>
      <button type="button" className="user-role-branch-multi-trigger" onClick={() => setIsOpen((current) => !current)} disabled={loading} aria-haspopup="listbox" aria-expanded={isOpen}>
        <span className="user-role-branch-multi-trigger-copy"><Building2 size={16} /><span>{selectedBranches.length ? `${selectedBranches.length} branch${selectedBranches.length === 1 ? '' : 'es'} selected` : loading ? 'Loading active branches...' : 'Select branch access'}</span></span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {selectedBranches.length ? <div className="user-role-branch-multi-chips">{selectedBranches.map((branch) => <span key={branch.id}>{branch.branchName || branch.branchId}<button type="button" onClick={() => onToggle(branch.id)} aria-label={`Remove ${branch.branchName || branch.branchId}`}><X size={12} /></button></span>)}</div> : null}
      {isOpen ? <div className="user-role-branch-multi-menu" role="listbox" aria-label="Branch access options">
        {branches.length ? branches.map((branch) => {
          const selected = selectedIds.has(String(branch.id))
          return <button key={branch.id} type="button" role="option" aria-selected={selected} className={`user-role-branch-multi-option${selected ? ' is-selected' : ''}`} onClick={() => onToggle(branch.id)}><span className="user-role-branch-multi-option-icon"><Building2 size={15} /></span><span><strong>{branch.branchName || 'Unnamed branch'}</strong><small>{branch.branchId || 'Branch ID unavailable'}</small></span><span className="user-role-branch-multi-check">{selected ? '✓' : ''}</span></button>
        }) : <p className="user-role-branch-multi-empty">No active branches available.</p>}
      </div> : null}
      {error ? <small className="user-role-inline-error">{error}</small> : null}
    </div>
  )
}

export function UserRoleManagementPage({ pageType = 'branch', onViewDashboard: branchDashboardHandler, onViewSalesDashboard }) {
  const isSalesPage = pageType === 'sales'
  const onViewDashboard = isSalesPage ? onViewSalesDashboard : branchDashboardHandler
  const pageTitle = isSalesPage ? 'Sales Admin' : 'Branch Admin'
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [userPage, setUserPage] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [createStep, setCreateStep] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [salesAdminIdTouched, setSalesAdminIdTouched] = useState(false)
  const [salesAdminIdServerError, setSalesAdminIdServerError] = useState('')
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const [creationPopup, setCreationPopup] = useState('')
  const [actionUser, setActionUser] = useState(null)
  const actionOpenModeRef = useRef('')
  useEffect(() => {
    if (!actionUser) actionOpenModeRef.current = ''
  }, [actionUser])
  const [viewUser, setViewUser] = useState(null)
  const [viewTab, setViewTab] = useState('details')
  const [adminHistory, setAdminHistory] = useState([])
  const adminHistoryLoading = false
  const [editingUser, setEditingUser] = useState(null)
  const [roleChangeUser, setRoleChangeUser] = useState(null)
  const [roleChangeType, setRoleChangeType] = useState('BRANCH_ADMIN')
  const [roleChangeSaving, setRoleChangeSaving] = useState(false)
  const [replacementUser, setReplacementUser] = useState(null)
  const [replacementConfirmOpen, setReplacementConfirmOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState(null)
  const [updatePopup, setUpdatePopup] = useState('')
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [statusUser, setStatusUser] = useState(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [branches, setBranches] = useState([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [branchesError, setBranchesError] = useState('')
  const [salesAdminUsers, setSalesAdminUsers] = useState([])
  const [countryOptions, setCountryOptions] = useState([])
  const [stateOptions, setStateOptions] = useState([])
  const [cityOptions, setCityOptions] = useState([])

  useEffect(() => {
    if (!viewUser?.id) return undefined
    const historyPath = viewUser.managedBranch?.id
      ? `/user-role-accounts/branches/${viewUser.managedBranch.id}/admin-history`
      : `/user-role-accounts/users/${viewUser.id}/admin-history`
    let active = true
    request(historyPath)
      .then((response) => { if (active) setAdminHistory(Array.isArray(response?.data) ? response.data : []) })
      .catch(() => { if (active) setAdminHistory([]) })
    return () => { active = false }
  }, [viewUser?.id, viewUser?.managedBranch?.id])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    setUsersError('')
    try {
      setUsers(await listBranchAccessUsers(isSalesPage ? 'SALES_ADMIN' : 'BRANCH_ADMIN'))
    } catch (reason) {
      setUsersError(reason?.message || `Unable to load ${pageTitle.toLowerCase()} accounts.`)
    } finally {
      setUsersLoading(false)
    }
  }, [isSalesPage, pageTitle])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter((user) => {
      const branchRecords = user.managedBranch ? [user.managedBranch] : (user.assignedBranches || [])
      const statusLabel = isSalesPage
        ? (String(user.status || (user.active === false ? 'INACTIVE' : 'ACTIVE')).toUpperCase() === 'INACTIVE' ? 'inactive' : 'active')
        : (branchRecords.some((branch) => String(branch.status || '').toUpperCase() === 'INACTIVE') ? 'inactive' : 'active')
      const matchesStatus = statusFilter === 'all' || statusLabel === statusFilter
      const matchesSearch = !query || [user.userCode, user.fullName, user.email, user.phone, user.managedBranch?.branchName, ...(user.assignedBranches || []).map((branch) => branch.branchName)].some((value) => String(value || '').toLowerCase().includes(query))
      return matchesStatus && matchesSearch
    })
  }, [isSalesPage, search, statusFilter, users])
  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / 5))
  const safeUserPage = Math.min(userPage, userPageCount)
  const paginatedUsers = filteredUsers.slice((safeUserPage - 1) * 5, safeUserPage * 5)

  useEffect(() => {
    const timer = window.setTimeout(() => setUserPage(1), 0)
    return () => window.clearTimeout(timer)
  }, [search, statusFilter])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target?.closest?.('.user-role-actions')) {
        actionOpenModeRef.current = ''
        setActionUser(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    const table = document.querySelector('.user-role-table')
    if (!table) return undefined
    const handleRowClick = (event) => {
      if (event.target?.closest?.('.user-role-actions, .user-role-dashboard-button')) return
      const row = event.target?.closest?.('tbody tr')
      if (!row || !row.parentElement) return
      const rowIndex = Array.from(row.parentElement.children).indexOf(row)
      const user = paginatedUsers[rowIndex]
      if (user) openView(user)
    }
    const handleActionsHover = (event) => {
      if (!event.target?.closest?.('.user-role-actions')) return
      const row = event.target.closest('tbody tr')
      if (!row || !row.parentElement) return
      const rowIndex = Array.from(row.parentElement.children).indexOf(row)
      const user = paginatedUsers[rowIndex]
      if (user && actionOpenModeRef.current !== 'click') {
        actionOpenModeRef.current = 'hover'
        setActionUser(user)
      }
    }
    const handleActionsLeave = (event) => {
      const actions = event.target?.closest?.('.user-role-actions')
      if (actions && !actions.contains(event.relatedTarget) && actionOpenModeRef.current === 'hover') {
        actionOpenModeRef.current = ''
        setActionUser(null)
      }
    }
    table.addEventListener('click', handleRowClick)
    table.addEventListener('mouseover', handleActionsHover)
    table.addEventListener('mouseout', handleActionsLeave)
    return () => {
      table.removeEventListener('click', handleRowClick)
      table.removeEventListener('mouseover', handleActionsHover)
      table.removeEventListener('mouseout', handleActionsLeave)
    }
  }, [paginatedUsers])

  function openEdit(user) {
    const branch = user.managedBranch
    setEditingUser(user)
    setActionUser(null)
    setError('')
    setSuccess('')
    setForm({
      ...initialForm,
      accountType: user.accountType || (user.role === 'SALES_ADMIN' ? 'SALES_ADMIN' : 'BRANCH_ADMIN'),
      branchId: branch?.branchId || '', branchName: branch?.branchName || '',
      branchIds: user.assignedBranchIds || [], salesAdminId: user.role === 'SALES_ADMIN' ? user.userCode || '' : '',
      fullName: branch?.branchAdminName || user.fullName || '', email: branch?.branchEmail || user.email || '', phone: branch?.branchPhone || user.phone || '',
      country: branch?.branchCountry || user.country || '', state: branch?.branchState || user.state || '', city: branch?.branchCity || user.city || '', address: branch?.branchAddress || user.address || '', status: String(isSalesPage ? (user.status || (user.active === false ? 'INACTIVE' : 'ACTIVE')) : (branch?.status || 'ACTIVE')).toUpperCase(), moduleAccess: normalizedModuleAccess(user.moduleAccess, user.accountType || (user.role === 'SALES_ADMIN' ? 'SALES_ADMIN' : 'BRANCH_ADMIN')),
    })
    setCreateStep(1)
    setIsCreateOpen(true)
  }

  function openView(user) {
    setViewTab('details')
    setAdminHistory([])
    setViewUser(user)
  }

  function openReplace(user) {
    const branch = user.managedBranch
    if (!branch) return
    setEditingUser(null)
    setReplacementUser(user)
    setActionUser(null)
    setError('')
    setSuccess('')
    setForm({
      ...initialForm,
      accountType: user.accountType === 'BRANCH_ADMIN_SALES_ADMIN' ? user.accountType : 'BRANCH_ADMIN',
      branchId: branch.branchId || '',
      branchName: branch.branchName || '',
      fullName: '', email: '', phone: '',
      country: branch.branchCountry || 'India',
      state: branch.branchState || 'Tamil Nadu',
      city: '',
      address: '',
      status: 'ACTIVE',
      moduleAccess: defaultModuleAccess(user.accountType === 'BRANCH_ADMIN_SALES_ADMIN' ? user.accountType : 'BRANCH_ADMIN'),
    })
    setCreateStep(1)
    setIsCreateOpen(true)
  }

  function openRoleChange(user) {
    if (!user?.managedBranch?.id) return
    setActionUser(null)
    setRoleChangeUser(user)
    setRoleChangeType(user.accountType === 'BRANCH_ADMIN_SALES_ADMIN' ? 'BRANCH_ADMIN' : 'BRANCH_ADMIN_SALES_ADMIN')
  }

  async function saveRoleChange() {
    if (!roleChangeUser?.managedBranch?.id || !roleChangeType) return
    const currentType = roleChangeUser.accountType === 'BRANCH_ADMIN_SALES_ADMIN' ? 'BRANCH_ADMIN_SALES_ADMIN' : 'BRANCH_ADMIN'
    if (currentType === roleChangeType) {
      setRoleChangeUser(null)
      return
    }
    setRoleChangeSaving(true)
    try {
      await updateBranch(roleChangeUser.managedBranch.id, {
        roleAccess: roleChangeType === 'BRANCH_ADMIN_SALES_ADMIN' ? 'BRANCH_ADMIN_SALES_ADMIN' : 'BRANCH_ADMIN_ONLY',
      })
      await loadUsers()
      setRoleChangeUser(null)
      setUpdatePopup(`${roleChangeType === 'BRANCH_ADMIN_SALES_ADMIN' ? 'Branch Admin + Sales Admin' : 'Branch Admin'} successfully updated`)
    } catch (reason) {
      setUsersError(reason?.message || 'Unable to update the account role.')
    } finally {
      setRoleChangeSaving(false)
    }
  }

  async function deleteSelectedUser() {
    if (!deleteUser) return
    setDeleteSaving(true)
    try {
      if (deleteUser.role === 'SALES_ADMIN') await request(`/sales-admins/${deleteUser.id}`, { method: 'DELETE' })
      else if (deleteUser.managedBranch?.id) await deleteBranch(deleteUser.managedBranch.id)
      setDeleteUser(null)
      await loadUsers()
    } catch (reason) {
      setUsersError(reason?.message || 'Unable to delete the account.')
    } finally { setDeleteSaving(false) }
  }

  const accountIsActive = (user) => isSalesPage
    ? String(user?.status || (user?.active === false ? 'INACTIVE' : 'ACTIVE')).toUpperCase() !== 'INACTIVE'
    : String(user?.managedBranch?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
  const branchIsActive = accountIsActive

  async function updateBranchStatus() {
    if (!statusUser?.id || (!isSalesPage && !statusUser?.managedBranch?.id)) return
    const nextStatus = accountIsActive(statusUser) ? 'INACTIVE' : 'ACTIVE'
    setStatusSaving(true)
    try {
      const updated = isSalesPage
        ? (await request(`/sales-admins/${statusUser.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }))?.data?.user
        : await updateBranch(statusUser.managedBranch.id, { status: nextStatus })
      setUsers((current) => current.map((user) => user.id === statusUser.id
        ? (isSalesPage ? { ...user, ...updated, status: nextStatus, active: nextStatus === 'ACTIVE' } : { ...user, managedBranch: { ...user.managedBranch, ...updated } })
        : user))
      setViewUser((current) => current?.id === statusUser.id
        ? (isSalesPage ? { ...current, ...updated, status: nextStatus, active: nextStatus === 'ACTIVE' } : { ...current, managedBranch: { ...current.managedBranch, ...updated } })
        : current)
      setStatusUser(null)
      setUpdatePopup(isSalesPage
        ? (nextStatus === 'ACTIVE' ? 'Sales Admin Activated Successfully' : 'Sales Admin Made Inactive Successfully')
        : (nextStatus === 'ACTIVE' ? 'Branch Activated Successfully' : 'Branch Made Inactive Successfully'))
    } catch (reason) {
      setStatusUser(null)
      setUsersError(reason?.message || `Unable to update ${isSalesPage ? 'Sales Admin' : 'branch'} status.`)
    } finally { setStatusSaving(false) }
  }

  useEffect(() => {
    if (!isCreateOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) closeCreateForm()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCreateOpen, saving])

  const selectedType = useMemo(() => accountTypes.find((item) => item.value === form.accountType) || accountTypes[0], [form.accountType])
  const roleConfig = roleFieldConfig[form.accountType] || roleFieldConfig.BRANCH_ADMIN
  function getSalesAdminIdError(value = form.salesAdminId) {
    if (!roleConfig.showSalesId) return ''
    const normalized = normalizeSalesAdminId(value)
    if (!normalized) return 'Sales Admin ID is required.'
    if (!/^CISSALES\d{3,}$/.test(normalized)) return 'Enter a valid Sales Admin ID, for example CISSALES001.'
    const salesUsers = isSalesPage ? users : salesAdminUsers
    const duplicate = salesUsers.some((user) => String(user.id) !== String(editingUser?.id || '') && normalizeSalesAdminId(user.userCode) === normalized)
    return duplicate ? 'Sales Admin ID is already in use.' : ''
  }
  function getBasicFieldErrors() {
    const fieldErrors = {}
    if (roleConfig.requiresBranch && !/^(?:CIS)?[A-Z]{2,12}\d{3}$/.test(form.branchId.trim().toUpperCase())) fieldErrors.branchId = 'Enter a valid Branch ID, for example SAI001.'
    if (roleConfig.requiresBranch && !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(form.branchName.trim())) fieldErrors.branchName = 'Branch Name must contain letters only.'
    if (roleConfig.requiresBranch && !form.country.trim()) fieldErrors.country = 'Select a country.'
    if (roleConfig.requiresBranch && !form.state.trim()) fieldErrors.state = 'Select a state.'
    if (roleConfig.requiresBranch && !form.city.trim()) fieldErrors.city = 'Select a city.'
    if (roleConfig.requiresBranch && !form.address.trim()) fieldErrors.address = 'Enter the branch address.'
    if (roleConfig.showSalesId && !form.branchIds.length) fieldErrors.branchIds = 'Select at least one branch for this Sales Admin.'
    const salesIdError = salesAdminIdServerError || getSalesAdminIdError()
    if (salesIdError) fieldErrors.salesAdminId = salesIdError
    if (!form.fullName.trim()) fieldErrors.fullName = 'Full name is required.'
    else if (roleConfig.requiresBranch && !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(form.fullName.trim())) fieldErrors.fullName = 'Branch Admin Name must contain letters only.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) fieldErrors.email = 'Enter a valid email address.'
    if (!/^\d{10}$/.test(form.phone.trim())) fieldErrors.phone = 'Phone number must contain exactly 10 digits.'
    return fieldErrors
  }
  const basicFieldErrors = getBasicFieldErrors()
  const salesAdminIdFieldError = salesAdminIdServerError || ((salesAdminIdTouched || showFieldErrors) ? getSalesAdminIdError() : '')
  const selectedCountryCode = countryOptions.find((country) => country.name === form.country)?.iso2 || ''
  const selectedStateCode = stateOptions.find((state) => state.name === form.state)?.iso2 || ''
  const countrySelectOptions = useMemo(() => countryOptions.length
    ? countryOptions.map((country) => ({ value: country.name, label: country.name, description: country.iso2 || 'Country', icon: MapPin, tone: 'blue' }))
    : [{ value: form.country || '', label: form.country || 'Loading countries...', description: 'Select a country', icon: MapPin, tone: 'blue' }], [countryOptions, form.country])
  const stateSelectOptions = useMemo(() => stateOptions.length
    ? stateOptions.map((state) => ({ value: state.name, label: state.name, description: state.iso2 || 'State', icon: MapPin, tone: 'blue' }))
    : [{ value: form.state || '', label: form.state || (selectedCountryCode ? 'Select state' : 'Select country first'), description: selectedCountryCode ? 'No states available' : 'Choose a country first', icon: MapPin, tone: 'blue' }], [form.state, selectedCountryCode, stateOptions])
  const citySelectOptions = useMemo(() => cityOptions.length
    ? cityOptions.map((city) => ({ value: city.name, label: city.name, description: 'City', icon: MapPin, tone: 'blue' }))
    : [{ value: form.city || '', label: form.city || (selectedStateCode ? 'Select city' : 'Select state first'), description: selectedStateCode ? 'No cities available' : 'Choose a state first', icon: MapPin, tone: 'blue' }], [cityOptions, form.city, selectedStateCode])

  useEffect(() => {
    let active = true
    getCountries().then((items) => {
      if (active) setCountryOptions(Array.isArray(items) ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))) : [])
    }).catch(() => { if (active) setCountryOptions([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedCountryCode) { setStateOptions([]); setCityOptions([]); return undefined }
    let active = true
    getStatesOfCountry(selectedCountryCode).then((items) => {
      if (active) setStateOptions(Array.isArray(items) ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))) : [])
    }).catch(() => { if (active) setStateOptions([]) })
    return () => { active = false }
  }, [selectedCountryCode])

  useEffect(() => {
    if (!selectedCountryCode || !selectedStateCode) { setCityOptions([]); return undefined }
    let active = true
    getCitiesOfState(selectedCountryCode, selectedStateCode).then((items) => {
      if (active) setCityOptions(Array.isArray(items) ? [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))) : [])
    }).catch(() => { if (active) setCityOptions([]) })
    return () => { active = false }
  }, [selectedCountryCode, selectedStateCode])

  useEffect(() => {
    if (!isCreateOpen || form.accountType !== 'SALES_ADMIN') return undefined
    let active = true
    setBranchesLoading(true)
    setBranchesError('')
    listBranches({ page: 1, limit: 100, status: 'ACTIVE', sortBy: 'branchName', sortOrder: 'asc' }).then((result) => {
      if (!active) return
      const activeBranches = Array.isArray(result?.data)
        ? result.data.filter((branch) => String(branch?.status || '').trim().toUpperCase() === 'ACTIVE')
        : []
      const tableBranchIds = new Set(users.flatMap((user) => {
        const branch = user?.managedBranch
        return branch ? [String(branch.id || ''), String(branch.branchId || '')].filter(Boolean) : []
      }))
      const available = isSalesPage
        ? activeBranches
        : activeBranches.filter((branch) => tableBranchIds.has(String(branch.id || '')) || tableBranchIds.has(String(branch.branchId || '')))
      setBranches(available)
      setForm((current) => ({ ...current, branchIds: current.branchIds.filter((id) => available.some((branch) => String(branch.id) === String(id))) }))
    }).catch((reason) => {
      if (!active) return
      setBranches([])
      setBranchesError(reason?.message || 'Unable to load active branches.')
    }).finally(() => { if (active) setBranchesLoading(false) })
    return () => { active = false }
  }, [form.accountType, isCreateOpen, isSalesPage, users])

  useEffect(() => {
    if (!isCreateOpen || form.accountType !== 'SALES_ADMIN' || isSalesPage) return undefined
    let active = true
    listBranchAccessUsers('SALES_ADMIN').then((items) => {
      if (active) setSalesAdminUsers(Array.isArray(items) ? items : [])
    }).catch(() => {
      if (active) setSalesAdminUsers([])
    })
    return () => { active = false }
  }, [form.accountType, isCreateOpen, isSalesPage])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'salesAdminId') setSalesAdminIdServerError('')
    setError('')
    setSuccess('')
  }

  function updateLocation(field, value) {
    setForm((current) => ({ ...current, [field]: value, ...(field === 'country' ? { state: '', city: '' } : field === 'state' ? { city: '' } : {}) }))
    setError('')
    setSuccess('')
  }

  function resetForm() {
    setForm(initialForm)
    setCreateStep(1)
    setSalesAdminIdTouched(false)
    setSalesAdminIdServerError('')
    setShowFieldErrors(false)
    setError('')
    setSuccess('')
  }

  function openCreateForm() {
    setEditingUser(null)
    setReplacementUser(null)
    resetForm()
    setIsCreateOpen(true)
  }

  function closeCreateForm() {
    if (saving) return
    setIsCreateOpen(false)
    setEditingUser(null)
    setReplacementUser(null)
    setReplacementConfirmOpen(false)
    resetForm()
  }

  function selectAccountType(value) {
    setForm((current) => ({ ...current, accountType: value, branchId: value === 'SALES_ADMIN' ? '' : current.branchId, branchName: value === 'SALES_ADMIN' ? '' : current.branchName, branchIds: value === 'SALES_ADMIN' ? current.branchIds : [], moduleAccess: defaultModuleAccess(value) }))
    setCreateStep(1)
    setError('')
    setSuccess('')
  }

  function toggleBranchAccess(branchId) {
    const normalizedId = String(branchId)
    setForm((current) => ({
      ...current,
      branchIds: current.branchIds.includes(normalizedId)
        ? current.branchIds.filter((id) => String(id) !== normalizedId)
        : [...current.branchIds, normalizedId],
    }))
    setError('')
    setSuccess('')
  }

  function validateBasicDetails() {
    return Object.values(getBasicFieldErrors())
  }

  function validate() {
    return validateBasicDetails()
  }

  function continueToModuleAccess(event) {
    event.preventDefault()
    goToStep(2)
  }

  function goToStep(step) {
    if (step === 1) {
      setCreateStep(1)
      return
    }
    setSalesAdminIdTouched(true)
    setShowFieldErrors(true)
    const validationErrors = validateBasicDetails()
    if (validationErrors.length) { setError(''); return }
    setError('')
    setCreateStep(2)
  }

  function toggleModuleAccess(moduleKey) {
    if (commonModuleKeys.includes(moduleKey) || !permittedModuleKeys(form.accountType).has(moduleKey)) return
    setForm((current) => {
      const currentAccess = new Set(normalizedModuleAccess(current.moduleAccess, current.accountType))
      if (currentAccess.has(moduleKey)) currentAccess.delete(moduleKey)
      else currentAccess.add(moduleKey)
      return { ...current, moduleAccess: normalizedModuleAccess([...currentAccess], current.accountType) }
    })
  }

  async function submit(event, bypassReplacementConfirm = false) {
    event.preventDefault()
    setSalesAdminIdTouched(true)
    setShowFieldErrors(true)
    const validationErrors = validate()
    if (validationErrors.length) { setError(''); return }
    if (replacementUser && !bypassReplacementConfirm) { setReplacementConfirmOpen(true); return }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingUser) {
        const originalEmail = editingUser.managedBranch?.branchEmail || editingUser.email || ''
        const emailChanged = form.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase()
        if (emailChanged) await request(`/user-role-accounts/${editingUser.id}/email-change`, { method: 'POST', body: JSON.stringify({ email: form.email.trim() }) })
        const persistedEmail = emailChanged ? originalEmail : form.email.trim()
        if (editingUser.role === 'SALES_ADMIN') {
          await request(`/sales-admins/${editingUser.id}`, { method: 'PATCH', body: JSON.stringify({ fullName: form.fullName.trim(), email: persistedEmail, phone: form.phone.trim(), country: form.country, state: form.state, city: form.city, address: form.address, status: form.status, branchIds: form.branchIds, moduleAccess: normalizedModuleAccess(form.moduleAccess, form.accountType) }) })
        } else {
          await updateBranch(editingUser.managedBranch.id, { branchId: form.branchId.trim().toUpperCase(), branchName: form.branchName.trim(), branchAdminName: form.fullName.trim(), branchEmail: persistedEmail, branchPhone: form.phone.trim(), branchCountryCode: selectedCountryCode, branchCountry: form.country, branchStateCode: selectedStateCode, branchState: form.state, branchCity: form.city.trim(), branchAddress: form.address.trim(), status: form.status, roleAccess: form.accountType === 'BRANCH_ADMIN_SALES_ADMIN' ? 'BRANCH_ADMIN_SALES_ADMIN' : 'BRANCH_ADMIN_ONLY', moduleAccess: normalizedModuleAccess(form.moduleAccess, form.accountType) })
        }
        await loadUsers()
        setEditingUser(null)
        setIsCreateOpen(false)
        setForm(initialForm)
        setUpdatePopup(emailChanged ? `${selectedType.label} updated. Verify the new email address to finish the email change.` : `${selectedType.label} successfully updated`)
        return
      }
      if (replacementUser?.managedBranch?.id) {
        await request(`/user-role-accounts/branches/${replacementUser.managedBranch.id}/replace-admin`, {
          method: 'POST',
          body: JSON.stringify({
            accountType: form.accountType,
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            country: form.country,
            state: form.state,
            city: form.city.trim(),
            address: form.address.trim(),
          }),
        })
        await loadUsers()
        setReplacementUser(null)
        setIsCreateOpen(false)
        setForm(initialForm)
        setUpdatePopup('Branch Admin replaced successfully')
        return
      }
      let payload
      if (form.accountType === 'SALES_ADMIN') {
          payload = { ...form, fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim(), salesAdminId: normalizeSalesAdminId(form.salesAdminId), moduleAccess: normalizedModuleAccess(form.moduleAccess, form.accountType) }
        delete payload.branchId
        delete payload.branchName
      } else {
        payload = {
          accountType: form.accountType,
          branchId: form.branchId.trim().toUpperCase(),
          branchName: form.branchName.trim(),
          branchAdminName: form.fullName.trim(),
          branchEmail: form.email.trim(),
          branchPhone: form.phone.trim(),
          branchCountryCode: selectedCountryCode || (form.country === 'India' ? 'IN' : ''),
          branchCountry: form.country,
          branchStateCode: selectedStateCode || (form.state === 'Tamil Nadu' ? 'TN' : ''),
          branchState: form.state,
          branchCity: form.city.trim(),
          branchAddress: form.address.trim(),
          status: form.status,
          roleAccess: form.accountType === 'BRANCH_ADMIN_SALES_ADMIN' ? 'BRANCH_ADMIN_SALES_ADMIN' : 'BRANCH_ADMIN_ONLY',
          moduleAccess: normalizedModuleAccess(form.moduleAccess, form.accountType),
        }
      }
      const response = await request('/user-role-accounts', { method: 'POST', body: JSON.stringify(payload) })
      const invitationSent = response?.data?.invitationSent !== false
      const accessAssigned = response?.data?.accessAssigned === true
      if (form.accountType !== 'SALES_ADMIN') window.dispatchEvent(new CustomEvent('cispro:branches-changed'))
      await loadUsers()
      setSuccess(invitationSent ? selectedType.label + ' created successfully. ' + (accessAssigned ? 'Branch access assigned.' : 'Assign branch access from the Branch Admin table.') : selectedType.label + ' created successfully, but the invitation email could not be sent.')
      setCreationPopup(`${selectedType.label} successfully created`)
      setIsCreateOpen(false)
      setForm((current) => ({ ...initialForm, accountType: current.accountType }))
    } catch (reason) {
      const message = normalizeError(reason)
      if (/sales admin id is already in use/i.test(message)) {
        setSalesAdminIdTouched(true)
        setSalesAdminIdServerError(message)
        setError('')
      } else setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className={`user-role-page${isSalesPage ? ' is-sales-admin-page' : ''}`} style={isSalesPage ? { '--sales-admin-id': `'${viewUser?.userCode || '-'}'` } : undefined}>
      <header className="user-role-page-header">
        <div><span className="user-role-eyebrow">USER &amp; ROLE MANAGEMENT</span><h1>{pageTitle}</h1><p>Create Branch Admin and Sales Admin accounts from one controlled form.</p></div>
        <div className="user-role-page-header-actions"><div className="user-role-header-badge"><Users size={18} /><span>Super Admin only</span></div><button type="button" className="user-role-create-button" onClick={openCreateForm}><UserPlus size={17} />Create User</button></div>
      </header>

      <div className="user-role-external-table-tools"><div className="user-role-table-tools"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${pageTitle.toLowerCase()} accounts`} aria-label={`Search ${pageTitle} accounts`} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter accounts by status"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select><span>{filteredUsers.length} account{filteredUsers.length === 1 ? '' : 's'}</span></div></div>
      <section className="user-role-table-card" aria-label={`${pageTitle} accounts`}>
        {usersLoading ? <div className="user-role-table-wrap user-role-skeleton-wrap"><table className="user-role-table user-role-skeleton-table"><thead><tr><th>S.No</th><th>User</th><th>{isSalesPage ? 'Sales Admin ID' : 'Branch Admin ID'}</th><th>Account Type</th><th>Branch access</th><th>{isSalesPage ? 'View Sales' : 'View Branch'}</th><th>Actions</th></tr></thead><tbody>{[1, 2, 3].map((row) => <tr key={row}>{[1, 2, 3, 4, 5, 6, 7].map((cell) => <td key={cell}><span className={`user-role-skeleton-line is-cell-${cell}`} /></td>)}</tr>)}</tbody></table></div> : usersError ? <p className="user-role-table-state is-error">{usersError}</p> : <><div className="user-role-table-wrap"><table className="user-role-table"><thead><tr><th>S.No</th><th>User</th><th>{isSalesPage ? 'Sales Admin ID' : 'Branch Admin ID'}</th><th>Account Type</th><th>Branch access</th><th>{isSalesPage ? 'View Sales' : 'View Branch'}</th><th>Actions</th></tr></thead><tbody>{paginatedUsers.map((user, index) => { const branchRecords = user.managedBranch ? [user.managedBranch] : (user.assignedBranches || []); const branchNames = branchRecords.map((branch) => branch.branchName).filter(Boolean); const statusLabel = accountIsActive(user) ? 'Active' : 'Inactive'; const dashboardBranch = branchRecords[0]; const shouldOpenUp = index >= Math.max(0, paginatedUsers.length - 2); return <tr key={user.id} className={actionUser?.id === user.id ? 'is-actions-open' : undefined}><td>{(safeUserPage - 1) * 5 + index + 1}</td><td><strong>{user.fullName || '-'}</strong><small>{user.email || '-'}</small></td><td><span className="user-role-status-indicator"><i className={`user-role-status-dot ${statusLabel === 'Active' ? 'is-active' : 'is-inactive'}`} /><span className="user-role-status-tooltip">{statusLabel}</span></span><strong>{user.userCode || '-'}</strong></td><td>{user.accountType === 'BRANCH_ADMIN_SALES_ADMIN' ? 'Branch Admin + Sales Admin' : user.accountType === 'SALES_ADMIN' ? 'Sales Admin' : 'Branch Admin'}</td><td>{branchNames.join(', ') || 'Unassigned'}</td><td><button type="button" className="user-role-view-button user-role-dashboard-button" disabled={!dashboardBranch} onClick={(event) => { event.stopPropagation(); setViewUser(null); if (dashboardBranch) { const dashboardTarget = (isSalesPage || user.accountType === 'BRANCH_ADMIN_SALES_ADMIN') ? { ...dashboardBranch, salesAdminId: user.id, salesAdminCode: user.userCode, salesAdminName: user.fullName } : dashboardBranch; onViewDashboard?.(dashboardTarget) } }}><LayoutDashboard size={14} />View</button></td><td><div className="user-role-actions"><button type="button" className="user-role-actions-trigger" aria-label={`Actions for ${user.fullName || 'account'}`} onClick={() => { actionOpenModeRef.current = 'click'; setActionUser(user) }}>&#8942;</button>{actionUser?.id === user.id ? <div className={`user-role-actions-menu${shouldOpenUp ? ' is-open-up' : ''}`}><button type="button" onClick={() => { openView(user); setActionUser(null) }}>View</button><button type="button" onClick={() => openEdit(user)}>Edit</button>{user.managedBranch ? <button type="button" onClick={() => openRoleChange(user)}>Change Role</button> : null}{!isSalesPage && user.managedBranch ? <button type="button" onClick={() => openReplace(user)}>Replace Admin</button> : null}<button type="button" className="is-danger" onClick={() => { setDeleteUser(user); setActionUser(null) }}>Delete</button></div> : null}</div></td></tr> })}{!filteredUsers.length ? <tr><td colSpan="7" className="user-role-table-state">No {pageTitle.toLowerCase()} accounts found.</td></tr> : null}</tbody></table></div>{userPageCount > 1 ? <div className="user-role-pagination"><span>Page {safeUserPage} of {userPageCount}</span><div><button type="button" disabled={safeUserPage === 1} onClick={() => setUserPage((page) => Math.max(1, page - 1))}>Previous</button><button type="button" disabled={safeUserPage === userPageCount} onClick={() => setUserPage((page) => Math.min(userPageCount, page + 1))}>Next</button></div></div> : null}</>}
      </section>

      {isCreateOpen ? <div className="user-role-modal-backdrop" role="presentation">
        <section className="user-role-modal" role="dialog" aria-modal="true" aria-labelledby="user-role-modal-title">
      <header className="user-role-modal-header"><div><span className="user-role-eyebrow">USER &amp; ROLE MANAGEMENT</span><h2 id="user-role-modal-title">{replacementUser ? 'Replace Branch Admin' : editingUser ? 'Edit user account' : 'Create user account'}</h2><p>{replacementUser ? `Assign a new administrator to ${replacementUser.managedBranch?.branchName || 'this branch'} without creating a new branch.` : roleConfig.requiresBranch ? 'Choose an account type, enter the branch profile, and complete the account details.' : 'Choose an account type and complete the account details. Sales Admin branch access is managed from the Branch Admin table.'}</p></div><button type="button" className="user-role-modal-close" onClick={closeCreateForm} aria-label="Close user form"><X size={20} /></button></header>
          <form className="user-role-form" onSubmit={createStep === 1 && !replacementUser ? continueToModuleAccess : submit} noValidate>
          <div className="user-role-step-indicator" aria-label="Create user steps">
            <button type="button" className={`user-role-step${createStep === 1 ? ' is-active' : ' is-complete'}`} onClick={() => goToStep(1)} aria-current={createStep === 1 ? 'step' : undefined}><span>1</span><strong>Account details</strong></button>
            <div className="user-role-step-line" />
            <button type="button" className={`user-role-step${createStep === 2 ? ' is-active' : ''}`} onClick={() => goToStep(2)} aria-current={createStep === 2 ? 'step' : undefined}><span>2</span><strong>Module access</strong></button>
          </div>
          {createStep === 1 ? <section className="user-role-card user-role-details-step">
          <div className="user-role-card-heading"><div><span className="user-role-card-kicker">ACCOUNT DETAILS</span><h2>Personal information</h2><p>Enter the login and contact details for this account.</p></div></div>
          <div className="user-role-fields-grid">
            <div className="user-role-field"><span>Account type <b>*</b></span><AccountTypeSelect value={form.accountType} options={editingUser?.role === 'BRANCH_ADMIN' ? accountTypes.filter((option) => option.value !== 'SALES_ADMIN') : accountTypes} onChange={selectAccountType} disabled={Boolean(editingUser && editingUser.role !== 'BRANCH_ADMIN')} /></div>
            {roleConfig.requiresBranch ? <>
              <label className={`user-role-field${showFieldErrors && basicFieldErrors.branchId ? ' has-error' : ''}`}><span>Branch ID <b>*</b></span><div className={`user-role-input-wrap${showFieldErrors && basicFieldErrors.branchId ? ' is-invalid' : ''}`}><Building2 size={17} /><input value={form.branchId} onChange={(event) => update('branchId', event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="CISTES001" maxLength={24} autoComplete="off" aria-invalid={Boolean(showFieldErrors && basicFieldErrors.branchId)} /></div>{showFieldErrors && basicFieldErrors.branchId ? <small className="user-role-inline-error">{basicFieldErrors.branchId}</small> : null}</label>
              <label className={`user-role-field${showFieldErrors && basicFieldErrors.branchName ? ' has-error' : ''}`}><span>Branch Name <b>*</b></span><div className={`user-role-input-wrap${showFieldErrors && basicFieldErrors.branchName ? ' is-invalid' : ''}`}><Building2 size={17} /><input value={form.branchName} onChange={(event) => update('branchName', event.target.value.replace(/[^\p{L} .'-]/gu, ''))} placeholder="Enter branch name" maxLength={80} aria-invalid={Boolean(showFieldErrors && basicFieldErrors.branchName)} /></div>{showFieldErrors && basicFieldErrors.branchName ? <small className="user-role-inline-error">{basicFieldErrors.branchName}</small> : null}</label>
            </> : null}
            {roleConfig.showSalesId ? <label className={`user-role-field user-role-sales-id-field${salesAdminIdFieldError ? ' has-error' : ''}`}><span>Sales Admin ID <b>*</b></span><div className={`user-role-input-wrap${salesAdminIdFieldError ? ' is-invalid' : ''}`}><Shield size={17} /><input value={form.salesAdminId} onChange={(event) => { const nextValue = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (/^CISSALES\d{3,}$/.test(normalizeSalesAdminId(nextValue))) setSalesAdminIdTouched(true); update('salesAdminId', nextValue) }} onBlur={() => { setSalesAdminIdTouched(true); update('salesAdminId', normalizeSalesAdminId(form.salesAdminId)) }} placeholder="CISSALES001" maxLength={20} autoComplete="off" aria-invalid={Boolean(salesAdminIdFieldError)} /></div>{salesAdminIdFieldError ? <small className="user-role-inline-error">{salesAdminIdFieldError}</small> : null}</label> : null}
            {roleConfig.showSalesId ? <div className={`user-role-field user-role-field-wide${showFieldErrors && basicFieldErrors.branchIds ? ' has-error' : ''}`}><span>Branch access <b>*</b></span><BranchMultiSelect value={form.branchIds} branches={branches} loading={branchesLoading} error={branchesError || (showFieldErrors ? basicFieldErrors.branchIds : '')} onToggle={toggleBranchAccess} /></div> : null}
            <label className={`user-role-field${showFieldErrors && basicFieldErrors.fullName ? ' has-error' : ''}`}><span>{roleConfig.nameLabel} <b>*</b></span><div className={`user-role-input-wrap${showFieldErrors && basicFieldErrors.fullName ? ' is-invalid' : ''}`}><Users size={17} /><input value={form.fullName} onChange={(event) => update('fullName', event.target.value.replace(roleConfig.requiresBranch ? /[^A-Za-z ]/g : /[^\p{L} .'-]/gu, ''))} placeholder={`Enter ${roleConfig.nameLabel.toLowerCase()}`} autoComplete="name" aria-invalid={Boolean(showFieldErrors && basicFieldErrors.fullName)} /></div>{showFieldErrors && basicFieldErrors.fullName ? <small className="user-role-inline-error">{basicFieldErrors.fullName}</small> : null}</label>
            <label className={`user-role-field${showFieldErrors && basicFieldErrors.email ? ' has-error' : ''}`}><span>Email address <b>*</b></span><div className={`user-role-input-wrap${showFieldErrors && basicFieldErrors.email ? ' is-invalid' : ''}`}><Mail size={17} /><input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="name@example.com" autoComplete="email" aria-invalid={Boolean(showFieldErrors && basicFieldErrors.email)} /></div>{showFieldErrors && basicFieldErrors.email ? <small className="user-role-inline-error">{basicFieldErrors.email}</small> : null}</label>
            <label className={`user-role-field${showFieldErrors && basicFieldErrors.phone ? ' has-error' : ''}`}><span>Phone number <b>*</b></span><div className={`user-role-input-wrap${showFieldErrors && basicFieldErrors.phone ? ' is-invalid' : ''}`}><Phone size={17} /><input inputMode="numeric" maxLength={10} value={form.phone} onChange={(event) => update('phone', event.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile number" autoComplete="tel" aria-invalid={Boolean(showFieldErrors && basicFieldErrors.phone)} /></div>{showFieldErrors && basicFieldErrors.phone ? <small className="user-role-inline-error">{basicFieldErrors.phone}</small> : null}</label>
            <div className={`user-role-field${showFieldErrors && basicFieldErrors.country ? ' has-error' : ''}`}><span>Country</span><AccountTypeSelect value={form.country} options={countrySelectOptions} onChange={(value) => updateLocation('country', value)} ariaLabel="Country" disabled={!countryOptions.length} />{showFieldErrors && basicFieldErrors.country ? <small className="user-role-inline-error">{basicFieldErrors.country}</small> : null}</div>
            <div className={`user-role-field${showFieldErrors && basicFieldErrors.state ? ' has-error' : ''}`}><span>State</span><AccountTypeSelect value={form.state} options={stateSelectOptions} onChange={(value) => updateLocation('state', value)} ariaLabel="State" disabled={!selectedCountryCode || !stateOptions.length} />{showFieldErrors && basicFieldErrors.state ? <small className="user-role-inline-error">{basicFieldErrors.state}</small> : null}</div>
            <div className={`user-role-field${showFieldErrors && basicFieldErrors.city ? ' has-error' : ''}`}><span>City</span><AccountTypeSelect value={form.city} options={citySelectOptions} onChange={(value) => updateLocation('city', value)} ariaLabel="City" disabled={!selectedStateCode || !cityOptions.length} />{showFieldErrors && basicFieldErrors.city ? <small className="user-role-inline-error">{basicFieldErrors.city}</small> : null}</div>
            <label className={`user-role-field user-role-field-wide${showFieldErrors && basicFieldErrors.address ? ' has-error' : ''}`}><span>Address</span><textarea value={form.address} onChange={(event) => update('address', event.target.value)} rows={3} placeholder="Enter address" aria-invalid={Boolean(showFieldErrors && basicFieldErrors.address)} />{showFieldErrors && basicFieldErrors.address ? <small className="user-role-inline-error">{basicFieldErrors.address}</small> : null}</label>
            {roleConfig.showStatus && !(isSalesPage && editingUser) ? <div className="user-role-field"><span>{roleConfig.requiresBranch ? 'Branch status' : 'Account status'}</span><AccountTypeSelect value={form.status} options={statusOptions} onChange={(value) => update('status', value)} ariaLabel={roleConfig.requiresBranch ? 'Branch status' : 'Account status'} /></div> : null}
          </div>
        </section> : <section className="user-role-card user-role-module-step">
          <div className="user-role-card-heading"><div><span className="user-role-card-kicker">MODULE ACCESS</span><h2>Choose permissions</h2><p>Select the areas this account can open after sign-in. Common access stays enabled for every account.</p></div><span className="user-role-module-role-badge">{selectedType.label}</span></div>
          <div className="user-role-module-groups">
            {orderedModuleAccessGroups(form.accountType, normalizedModuleAccess(form.moduleAccess, form.accountType)).map((group) => <section key={group.key} className="user-role-module-group"><div className="user-role-module-header"><div><strong>{group.label}</strong><span>{group.key === 'COMMON' ? 'Required for every account' : permittedModuleKeys(form.accountType).has(group.modules[0]?.key) ? 'Enabled for this account type' : 'Disabled for this account type'}</span></div></div><div className="user-role-module-list">{group.modules.map((module) => { const checked = normalizedModuleAccess(form.moduleAccess, form.accountType).includes(module.key); const unavailable = !permittedModuleKeys(form.accountType).has(module.key); return <label key={module.key} className={`user-role-module-row${module.locked ? ' is-locked' : ''}${unavailable ? ' is-disabled' : ''}`}><input className="user-role-module-checkbox" type="checkbox" checked={checked} disabled={module.locked || unavailable} onChange={() => toggleModuleAccess(module.key)} /><span className="user-role-module-copy"><strong>{module.label}</strong><small>{module.description}</small></span>{module.locked ? <span className="user-role-lock">Required</span> : unavailable ? <span className="user-role-lock">Unavailable</span> : null}</label> })}</div></section>)}
          </div>
        </section>}
        {error ? <div className="user-role-alert is-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div> : null}
        {success ? <div className="user-role-alert is-success" role="status"><CheckCircle2 size={18} /><span>{success}</span></div> : null}
        <footer className="user-role-form-footer"><button type="button" className="user-role-secondary-button" onClick={createStep === 2 && !replacementUser ? () => setCreateStep(1) : closeCreateForm} disabled={saving}>{createStep === 2 && !replacementUser ? 'Back' : 'Cancel'}</button><button type="submit" className="user-role-primary-button" disabled={saving}>{saving ? (replacementUser ? 'Replacing admin...' : editingUser ? 'Saving changes...' : 'Creating account...') : createStep === 1 && !replacementUser ? 'Continue' : replacementUser ? 'Replace Admin' : editingUser ? <>Save changes</> : <>Create {selectedType.label}</>}</button></footer>
      </form>
        </section>
      </div> : null}
      {replacementConfirmOpen ? <div className="user-role-creation-popup-backdrop" role="presentation"><section className="user-role-creation-popup" role="alertdialog" aria-modal="true"><button type="button" className="user-role-creation-popup-close" onClick={() => setReplacementConfirmOpen(false)} aria-label="Close replacement confirmation"><X size={18} /></button><div className="user-role-creation-popup-icon"><Shield size={28} /></div><h2>Replace Branch Admin?</h2><p>The current administrator will lose access, while the same branch and all existing branch data will remain unchanged.</p><div className="user-role-confirm-actions"><button type="button" className="user-role-secondary-button" onClick={() => setReplacementConfirmOpen(false)}>Cancel</button><button type="button" className="user-role-primary-button" onClick={() => { setReplacementConfirmOpen(false); void submit({ preventDefault() {} }, true) }}>Replace Admin</button></div></section></div> : null}
      {creationPopup ? <div className="user-role-creation-popup-backdrop" role="presentation"><section className="user-role-creation-popup" role="alertdialog" aria-modal="true" aria-labelledby="user-role-creation-popup-title"><button type="button" className="user-role-creation-popup-close" onClick={() => setCreationPopup('')} aria-label="Close confirmation"><X size={18} /></button><div className="user-role-creation-popup-icon"><CheckCircle2 size={28} /></div><h2 id="user-role-creation-popup-title">{creationPopup}</h2><p>The login invitation has been sent successfully.</p><button type="button" className="user-role-primary-button" onClick={() => setCreationPopup('')}>OK</button></section></div> : null}
      {updatePopup ? <div className="user-role-creation-popup-backdrop" role="presentation"><section className="user-role-creation-popup user-role-update-popup" role="alertdialog" aria-modal="true"><button type="button" className="user-role-creation-popup-close" onClick={() => setUpdatePopup('')} aria-label="Close confirmation"><X size={18} /></button><div className="user-role-creation-popup-icon"><CheckCircle2 size={28} /></div><h2>{updatePopup}</h2><button type="button" className="user-role-primary-button" onClick={() => setUpdatePopup('')}>OK</button></section></div> : null}
      {statusUser ? <div className="user-role-creation-popup-backdrop" role="presentation"><section className="user-role-creation-popup" role="alertdialog" aria-modal="true"><button type="button" className="user-role-creation-popup-close" onClick={() => !statusSaving && setStatusUser(null)} aria-label="Close status confirmation"><X size={18} /></button><div className="user-role-creation-popup-icon"><Shield size={28} /></div><h2>{accountIsActive(statusUser) ? (isSalesPage ? 'Make Sales Admin inactive?' : 'Make branch inactive?') : (isSalesPage ? 'Activate Sales Admin?' : 'Activate branch?')}</h2><p>{accountIsActive(statusUser) ? `${isSalesPage ? statusUser.fullName || 'This Sales Admin' : statusUser.managedBranch?.branchName || 'This branch'} will become view-only.` : `${isSalesPage ? statusUser.fullName || 'This Sales Admin' : statusUser.managedBranch?.branchName || 'This branch'} will be allowed to create, edit, and delete data again.`}</p><div className="user-role-confirm-actions"><button type="button" className="user-role-secondary-button" onClick={() => setStatusUser(null)} disabled={statusSaving}>Cancel</button><button type="button" className="user-role-primary-button" onClick={() => void updateBranchStatus()} disabled={statusSaving}>{statusSaving ? 'Updating...' : accountIsActive(statusUser) ? 'Make Inactive' : 'Activate'}</button></div></section></div> : null}
      {roleChangeUser ? <div className="user-role-creation-popup-backdrop" role="presentation"><section className="user-role-creation-popup user-role-role-change-popup" role="dialog" aria-modal="true" aria-labelledby="user-role-change-title"><button type="button" className="user-role-creation-popup-close" onClick={() => !roleChangeSaving && setRoleChangeUser(null)} aria-label="Close role change"><X size={18} /></button><div className="user-role-creation-popup-icon"><Shield size={28} /></div><h2 id="user-role-change-title">Change account role</h2><p>Update {roleChangeUser.fullName || 'this user'}'s account type. The same user and branch will remain unchanged.</p><div className="user-role-role-options">{accountTypes.filter((option) => option.value !== 'SALES_ADMIN').map((option) => <button key={option.value} type="button" className={roleChangeType === option.value ? 'is-selected' : ''} onClick={() => setRoleChangeType(option.value)} disabled={roleChangeSaving}><strong>{option.label}</strong><small>{option.description}</small></button>)}</div><div className="user-role-confirm-actions"><button type="button" className="user-role-secondary-button" onClick={() => setRoleChangeUser(null)} disabled={roleChangeSaving}>Cancel</button><button type="button" className="user-role-primary-button" onClick={() => void saveRoleChange()} disabled={roleChangeSaving}>{roleChangeSaving ? 'Updating...' : 'Update Role'}</button></div></section></div> : null}
      {viewUser ? <aside className="user-role-view-drawer" aria-label="Account details"><header className="user-role-drawer-header"><div><h2>{viewUser.managedBranch ? 'Branch Details' : 'Sales Admin Details'}</h2><p>Complete information about this account</p></div>{viewUser.managedBranch ? <button type="button" className="user-role-drawer-status" onClick={() => setStatusUser(viewUser)} aria-label="Change branch status"><strong>{branchIsActive(viewUser) ? 'Active' : 'Inactive'}</strong><span className={`user-role-status-toggle${branchIsActive(viewUser) ? '' : ' is-inactive'}`} aria-hidden="true"><i /></span></button> : null}<button type="button" className="user-role-drawer-close" onClick={() => setViewUser(null)} aria-label="Close details"><X size={20} /></button></header><div className="user-role-drawer-tabs"><button type="button" className={viewTab === 'details' ? 'is-active' : ''} onClick={() => setViewTab('details')}>Account Details</button>{viewUser.managedBranch ? <button type="button" className={viewTab === 'history' ? 'is-active' : ''} onClick={() => setViewTab('history')}>Change History</button> : null}</div>{viewTab === 'history' && viewUser.managedBranch ? <section className="user-role-drawer-section user-role-audit-section"><h3><span className="user-role-drawer-section-icon"><Shield size={18} /></span>Change History</h3>{adminHistoryLoading ? <p className="user-role-audit-state">Loading change history...</p> : adminHistory.length ? <div className="user-role-audit-list">{adminHistory.map((item) => <article key={item.id} className="user-role-audit-item"><div className="user-role-audit-marker" /><div className="user-role-audit-content"><div className="user-role-audit-heading"><strong>{historyOperationLabel(item.operationType)}</strong><time>{formatHistoryDate(item.createdAt)}</time></div>{item.operationType === 'ROLE_UPDATED' ? <p>{accountTypeLabel(item.previousAccountType)} <span>→</span> {accountTypeLabel(item.newAccountType)}</p> : item.operationType === 'EMAIL_VERIFIED' ? <p>{item.oldEmail || '-'} <span>→</span> {item.newEmail || '-'}</p> : item.operationType === 'ADMIN_REPLACED' ? <p>{item.oldEmail || 'Previous admin'} <span>→</span> {item.newEmail || 'New admin'}</p> : <p>{item.newEmail || item.newAccountType || 'Account details updated'}</p>}<small>Status: {item.status || 'COMPLETED'}</small></div></article>)}</div> : <p className="user-role-audit-state">No change history available for this branch.</p>}</section> : <section className="user-role-drawer-section"><h3><span className="user-role-drawer-section-icon"><Building2 size={18} /></span>{viewUser.managedBranch ? 'Branch Information' : 'Account Information'}</h3><div className="user-role-drawer-fields">{[['Branch ID', viewUser.managedBranch?.branchId || (viewUser.assignedBranches || []).map((branch) => branch.branchId).join(', '), Shield], ['Branch Name', viewUser.managedBranch?.branchName || (viewUser.assignedBranches || []).map((branch) => branch.branchName).join(', '), Building2], ['Branch Admin', viewUser.fullName, Users], ['Email', viewUser.email, Mail], ['Phone', viewUser.phone, Phone], ['Address', viewUser.managedBranch?.branchAddress || viewUser.address, MapPin], ['City', viewUser.managedBranch?.branchCity || viewUser.city, MapPin], ['State', viewUser.managedBranch?.branchState || viewUser.state, MapPin], ['Country', viewUser.managedBranch?.branchCountry || viewUser.country, MapPin], ['Account Type', accountTypeLabel(viewUser.accountType), Shield]].map(([label, value, Icon]) => <div key={label}><span className="user-role-drawer-field-icon"><Icon size={17} /></span><strong>{label}</strong><em>:</em><b>{value || '-'}</b></div>)}</div></section>}</aside> : null}
      {deleteUser ? <div className="user-role-creation-popup-backdrop" role="presentation"><section className="user-role-creation-popup" role="alertdialog" aria-modal="true"><button type="button" className="user-role-creation-popup-close" onClick={() => setDeleteUser(null)} aria-label="Close delete confirmation"><X size={18} /></button><h2>Delete account?</h2><p>Are you sure you want to delete <strong>{deleteUser.fullName || 'this account'}</strong>?</p><div className="user-role-confirm-actions user-role-delete-confirm-actions"><button type="button" className="user-role-secondary-button user-role-delete-cancel" onClick={() => setDeleteUser(null)} disabled={deleteSaving}>Cancel</button><button type="button" className="user-role-danger-button user-role-delete-button" onClick={() => void deleteSelectedUser()} disabled={deleteSaving}>{deleteSaving ? 'Deleting...' : 'Delete'}</button></div></section></div> : null}
      {viewUser && !viewUser.managedBranch ? <button type="button" className={`user-role-sales-history-button${viewTab === 'history' ? ' is-active' : ''}`} onClick={() => setViewTab('history')}>Change History</button> : null}
      {viewUser && !viewUser.managedBranch && viewTab === 'history' ? <section className="user-role-sales-history-panel"><h3>Change History</h3>{adminHistoryLoading ? <p>Loading change history...</p> : adminHistory.length ? adminHistory.map((item) => <article key={item.id}><strong>{historyOperationLabel(item.operationType)}</strong><time>{formatHistoryDate(item.createdAt)}</time><p>{item.operationType === 'EMAIL_VERIFIED' ? `${item.oldEmail || '-'} → ${item.newEmail || '-'}` : item.newEmail || item.newAccountType || 'Account details updated'}</p></article>) : <p>No change history available for this account.</p>}</section> : null}
      {viewUser && isSalesPage ? <button type="button" className="user-role-drawer-status user-role-sales-status-floating" onClick={() => setStatusUser(viewUser)} aria-label="Change Sales Admin status"><strong>{accountIsActive(viewUser) ? 'Active' : 'Inactive'}</strong><span className={`user-role-status-toggle${accountIsActive(viewUser) ? '' : ' is-inactive'}`} aria-hidden="true"><i /></span></button> : null}
    </main>
  )
}

