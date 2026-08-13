import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Building2,
  CircleUserRound,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreVertical,
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

function validateBranchField(field, value) {
  const text = String(value || '').trim()

  switch (field) {
    case 'branchId':
      if (!text) return 'Branch ID is required'
      if (!/^[A-Za-z0-9-]+$/.test(text)) return 'Branch ID can contain letters, numbers, and hyphens only'
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
    case 'branchAddress':
      if (!text) return 'Location is required'
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
  const normalizedEmail = String(form.branchEmail || '').trim().toLowerCase()
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
    branchAddress: validateBranchField('branchAddress', form.branchAddress),
  }
}

export function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const { signOut, user } = useAuth()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [branches, setBranches] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isResendConfirmOpen, setIsResendConfirmOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
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
    branchAddress: '',
  })

  useEffect(() => {
    listBranches({
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
      .then((result) => {
        setBranches(Array.isArray(result?.data) ? result.data : [])
      })
      .catch(() => {
        setBranches([])
      })
  }, [])

  useEffect(() => {
    if (!isAddBranchOpen && !isSuccessOpen && !isDeleteConfirmOpen && !isResendConfirmOpen && !isLogoutConfirmOpen) {
      return undefined
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAddBranchOpen(false)
        setIsSuccessOpen(false)
        setIsDeleteConfirmOpen(false)
        setIsResendConfirmOpen(false)
        setIsLogoutConfirmOpen(false)
        setDeleteTargetBranch(null)
        setResendTargetBranch(null)
        setEditingBranchId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isAddBranchOpen, isSuccessOpen, isDeleteConfirmOpen, isResendConfirmOpen, isLogoutConfirmOpen])

  useEffect(() => {
    if (!isAddBranchOpen) return

    const emailValue = String(form.branchEmail || '').trim()

    if (!emailValue) {
      setBranchErrors((current) => {
        if (!current.branchEmail) return current
        return { ...current, branchEmail: '' }
      })
      return
    }

    const emailError = validateBranchField('branchEmail', emailValue)
    const duplicateEmailError = emailError || getDuplicateBranchEmailError(emailValue, branches, editingBranchId)

    setBranchErrors((current) => {
      if (current.branchEmail === duplicateEmailError) return current
      return { ...current, branchEmail: duplicateEmailError }
    })
  }, [branches, editingBranchId, form.branchEmail, isAddBranchOpen])

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
      return [
        branch.branchId,
        branch.branchName,
        branch.branchEmail,
        branch.branchPhone,
        branch.branchAddress,
        branch.status,
      ].some((value) => String(value || '').toLowerCase().includes(query))
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
    setSuccessTitle('Create branch invitation sent')
    setSuccessMessage('')
    setActionError('')
    setForm({
      branchId: '',
      branchName: '',
      branchAdminName: '',
      branchEmail: '',
      branchPhone: '',
      branchAddress: '',
    })
    setIsAddBranchOpen(true)
  }

  const openEditBranch = (branch) => {
    setBranchErrors({})
    setEditingBranchId(branch.id)
    setActionMenuBranchId(null)
    setActionError('')
    setForm({
      branchId: branch.branchId || '',
      branchName: branch.branchName || '',
      branchAdminName: branch.branchAdminName || '',
      branchEmail: branch.branchEmail || '',
      branchPhone: String(branch.branchPhone || '').replace(/\D+/g, '').slice(0, 10),
      branchAddress: branch.branchAddress || '',
    })
    setIsAddBranchOpen(true)
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
  }

  const openResendMail = (branch) => {
    setActionMenuBranchId(null)
    setResendTargetBranch(branch)
    setIsResendConfirmOpen(true)
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
      await resendBranchInvitation(resendTargetBranch.id)
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

  const handleAddBranch = async (event) => {
    event.preventDefault()

    const nextErrors = validateBranchForm(form, branches, editingBranchId)
    setBranchErrors(nextErrors)
    setActionError('')

    if (Object.values(nextErrors).some(Boolean)) {
      return
    }

    const cleanedPhone = String(form.branchPhone || '').trim()
    const nextBranchData = {
      branchId: form.branchId.trim(),
      branchName: form.branchName.trim(),
      branchAdminName: form.branchAdminName.trim(),
      branchEmail: form.branchEmail.trim(),
      branchPhone: cleanedPhone,
      branchAddress: form.branchAddress.trim(),
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

  return (
    <section className="super-admin-page">
      <div className="super-admin-shell">
        <aside className="super-admin-sidebar" aria-label="Super admin navigation">
          <div className="super-admin-sidebar-brand">
            <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="Elite Admin logo" />
          </div>

          <nav className="super-admin-sidebar-nav">
            <button
              type="button"
              className={`super-admin-sidebar-item ${activeSection === 'dashboard' ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveSection('dashboard')}
            >
              <span className="super-admin-sidebar-icon" aria-hidden="true">
                <LayoutDashboard size={18} strokeWidth={2.2} />
              </span>
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              className={`super-admin-sidebar-item ${activeSection === 'branches' ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveSection('branches')}
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
                onClick={() => setIsLogoutConfirmOpen(true)}
              >
                <LogOut size={22} strokeWidth={2.15} />
              </button>
            </div>
          </div>
        </aside>

        <div className="super-admin-main">
          <header className="super-admin-topbar">
            <div className="super-admin-topbar-left">
              <button type="button" className="super-admin-icon-button" aria-label="Open menu">
                <Menu size={22} strokeWidth={2.2} />
              </button>
            </div>

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
                        <th>#</th>
                        <th>Branch ID</th>
                        <th>Name</th>
                        <th>Location</th>
                        <th>Contact</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBranches.map((branch, index) => {
                        const isUpwardMenu = index >= paginatedBranches.length - 2

                        return (
                          <tr key={branch.id}>
                            <td>{(safeCurrentPage - 1) * rowsPerPage + index + 1}</td>
                            <td><strong>{branch.branchId}</strong></td>
                            <td className="branch-name-cell">
                              <strong>{branch.branchName}</strong>
                              <span>{branch.branchAdminName || 'Branch admin not set'}</span>
                            </td>
                            <td>{branch.branchAddress}</td>
                            <td className="branch-contact-cell">
                              <span className="branch-contact-email">{branch.branchEmail}</span>
                              <span className="branch-contact-phone">{branch.branchPhone}</span>
                            </td>
                            <td className="branch-created-at-cell">{branch.createdAt}</td>
                            <td>
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
                                  <button type="button" role="menuitem" onClick={() => openEditBranch(branch)}>
                                    Edit
                                  </button>
                                  <button type="button" role="menuitem" className="is-danger" onClick={() => openDeleteConfirm(branch)}>
                                    Delete
                                  </button>
                                  <button type="button" role="menuitem" className="is-warning" onClick={() => openResendMail(branch)}>
                                    Resend Mail
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  <div className="branch-table-footer">
                    <span>
                      Showing {filteredBranches.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1}
                      {' '}to{' '}
                      {Math.min(safeCurrentPage * rowsPerPage, filteredBranches.length)}
                      {' '}of {filteredBranches.length} branches
                    </span>
                  </div>

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
                  value={form.branchId}
                  onChange={(event) => updateField('branchId', event.target.value.toUpperCase())}
                  placeholder="Enter branch ID"
                  inputMode="text"
                  maxLength={20}
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

              <label className="branch-field branch-field-full">
                <span>Location</span>
                <input
                  type="text"
                  value={form.branchAddress}
                  onChange={(event) => updateField('branchAddress', event.target.value)}
                  placeholder="Enter location"
                  maxLength={120}
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

            <div className="super-admin-logout-icon" aria-hidden="true">
              <LogOut size={28} strokeWidth={2.1} />
            </div>

            <h2 id="super-admin-logout-title">Are you sure you want to logout?</h2>
           

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
    </section>
  )
}
