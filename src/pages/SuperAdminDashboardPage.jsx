import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Menu,
  MoreVertical,
  Search,
  Shield,
} from 'lucide-react'

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

const seedBranches = [
  {
    id: 1,
    branchId: 'BR-001',
    branchName: 'City Center',
    branchEmail: 'citycenter@company.com',
    branchPhone: '440-231-4037',
    branchAddress: '1157 Stracke Throughway, Guymouth, Nevada, Mauritius, 48423-8359',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 2,
    branchId: 'BR-002',
    branchName: 'Business Park',
    branchEmail: 'businesspark@company.com',
    branchPhone: '1-986-720-8778',
    branchAddress: '62719 Rahul Mountains Suite 492, North Deontae, Montana, Yemen, 76453',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 3,
    branchId: 'BR-003',
    branchName: 'Corporate Center',
    branchEmail: 'corporatecenter@company.com',
    branchPhone: '1-747-315-0801',
    branchAddress: '2129 Marques Lights Apt. 984, West Ronny, Iowa, Canada, 06563',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 4,
    branchId: 'BR-004',
    branchName: 'Metro Hub',
    branchEmail: 'metrohub@company.com',
    branchPhone: '1-408-555-0194',
    branchAddress: '44 Park Lane, San Jose, California, United States, 95112',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 5,
    branchId: 'BR-005',
    branchName: 'North Point',
    branchEmail: 'northpoint@company.com',
    branchPhone: '1-415-555-0188',
    branchAddress: '18 Market Street, San Francisco, California, United States, 94105',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 6,
    branchId: 'BR-006',
    branchName: 'Green Valley',
    branchEmail: 'greenvalley@company.com',
    branchPhone: '1-512-555-0124',
    branchAddress: '1201 Cedar Avenue, Austin, Texas, United States, 78701',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 7,
    branchId: 'BR-007',
    branchName: 'Lake View',
    branchEmail: 'lakeview@company.com',
    branchPhone: '1-206-555-0171',
    branchAddress: '77 Harbor Road, Seattle, Washington, United States, 98101',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 8,
    branchId: 'BR-008',
    branchName: 'Central Gate',
    branchEmail: 'centralgate@company.com',
    branchPhone: '1-312-555-0148',
    branchAddress: '900 W Madison St, Chicago, Illinois, United States, 60607',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 9,
    branchId: 'BR-009',
    branchName: 'River Front',
    branchEmail: 'riverfront@company.com',
    branchPhone: '1-214-555-0117',
    branchAddress: '2601 Elm Street, Dallas, Texas, United States, 75201',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 10,
    branchId: 'BR-010',
    branchName: 'Sunrise Plaza',
    branchEmail: 'sunriseplaza@company.com',
    branchPhone: '1-602-555-0139',
    branchAddress: '500 East Jefferson St, Phoenix, Arizona, United States, 85004',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 11,
    branchId: 'BR-011',
    branchName: 'Harbor Point',
    branchEmail: 'harborpoint@company.com',
    branchPhone: '1-305-555-0166',
    branchAddress: '155 Biscayne Blvd, Miami, Florida, United States, 33132',
    status: 'Active',
    createdAt: '2025-09-10',
  },
  {
    id: 12,
    branchId: 'BR-012',
    branchName: 'Summit Center',
    branchEmail: 'summitcenter@company.com',
    branchPhone: '1-303-555-0155',
    branchAddress: '1900 16th Street Mall, Denver, Colorado, United States, 80202',
    status: 'Active',
    createdAt: '2025-09-10',
  },
]

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
    case 'branchEmail':
      if (!text) return 'Email is required'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'Enter a valid email address'
      return ''
    case 'branchPhone':
      if (!text) return 'Phone number is required'
      if (!/^\d{10}$/.test(text)) return 'Phone number must be exactly 10 digits'
      return ''
    case 'branchAddress':
      if (!text) return 'Address is required'
      if (text.length < 5) return 'Address must be at least 5 characters'
      return ''
    default:
      return ''
  }
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
  const emailExists = branchesList.some(
    (branch) => String(branch?.branchEmail || '').trim().toLowerCase() === normalizedEmail,
  )

  return {
    branchId:
      validateBranchField('branchId', form.branchId) ||
      (normalizedBranchId && branchIdExists ? 'Branch ID already exists' : ''),
    branchName: validateBranchField('branchName', form.branchName),
    branchEmail:
      validateBranchField('branchEmail', form.branchEmail) ||
      (normalizedEmail && emailExists ? 'Email already exists' : ''),
    branchPhone: validateBranchField('branchPhone', form.branchPhone),
    branchAddress: validateBranchField('branchAddress', form.branchAddress),
  }
}

export function SuperAdminDashboardPage() {
  const [activeSection, setActiveSection] = useState('branches')
  const [branches, setBranches] = useState(seedBranches)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [editingBranchId, setEditingBranchId] = useState(null)
  const [deleteTargetBranch, setDeleteTargetBranch] = useState(null)
  const [actionMenuBranchId, setActionMenuBranchId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [successMessage, setSuccessMessage] = useState('')
  const [branchErrors, setBranchErrors] = useState({})
  const [form, setForm] = useState({
    branchId: '',
    branchName: '',
    branchEmail: '',
    branchPhone: '',
    branchAddress: '',
  })

  useEffect(() => {
    if (!isAddBranchOpen && !isSuccessOpen && !isDeleteConfirmOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAddBranchOpen(false)
        setIsSuccessOpen(false)
        setIsDeleteConfirmOpen(false)
        setDeleteTargetBranch(null)
        setEditingBranchId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isAddBranchOpen, isSuccessOpen, isDeleteConfirmOpen])

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

  useEffect(() => {
    setCurrentPage((current) => {
      const clampedPage = Math.min(Math.max(1, current), totalPages)
      return clampedPage === current ? current : clampedPage
    })
  }, [totalPages])

  const openAddBranch = () => {
    setBranchErrors({})
    setEditingBranchId(null)
    setActionMenuBranchId(null)
    setForm({
      branchId: '',
      branchName: '',
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
    setForm({
      branchId: branch.branchId || '',
      branchName: branch.branchName || '',
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
  }

  const openDeleteConfirm = (branch) => {
    setDeleteTargetBranch(branch)
    setIsDeleteConfirmOpen(true)
    setActionMenuBranchId(null)
  }

  const closeDeleteConfirm = () => {
    setIsDeleteConfirmOpen(false)
    setDeleteTargetBranch(null)
  }

  const handleDeleteBranch = () => {
    if (!deleteTargetBranch) return

    setBranches((current) => current.filter((item) => item.id !== deleteTargetBranch.id))
    setDeleteTargetBranch(null)
    setIsDeleteConfirmOpen(false)
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

  const updateBranchPhone = (value) => {
    const rawText = String(value || '')
    const nextValue = rawText.replace(/\D+/g, '').slice(0, 10)
    setForm((current) => ({ ...current, branchPhone: nextValue }))
    setBranchErrors((current) => ({ ...current, branchPhone: '' }))
  }

  const handleAddBranch = (event) => {
    event.preventDefault()

    const nextErrors = validateBranchForm(form, branches, editingBranchId)
    setBranchErrors(nextErrors)

    if (Object.values(nextErrors).some(Boolean)) {
      return
    }

    const cleanedPhone = String(form.branchPhone || '').trim()
    const nextBranchData = {
      branchId: form.branchId.trim(),
      branchName: form.branchName.trim(),
      branchEmail: form.branchEmail.trim(),
      branchPhone: cleanedPhone,
      branchAddress: form.branchAddress.trim(),
    }

    if (editingBranchId !== null) {
      const editedBranch = branches.find((item) => item.id === editingBranchId)
      const updatedBranch = {
        ...(editedBranch || {}),
        ...nextBranchData,
      }

      setBranches((current) =>
        current.map((item) => (item.id === editingBranchId ? updatedBranch : item)),
      )
      setIsAddBranchOpen(false)
      setEditingBranchId(null)
      setSuccessMessage(`${updatedBranch.branchName} has been updated in the table.`)
      setIsSuccessOpen(true)
      return
    }

    const nextBranch = {
      id: branches.length ? Math.max(...branches.map((item) => Number(item.id) || 0)) + 1 : 1,
      ...nextBranchData,
      status: 'Active',
      createdAt: formatToday(),
    }

    setBranches((current) => [nextBranch, ...current])
    setIsAddBranchOpen(false)
    setEditingBranchId(null)
    setSuccessMessage(`${nextBranch.branchName} has been added to the table.`)
    setIsSuccessOpen(true)
  }

  return (
    <section className="super-admin-page">
      <div className="super-admin-shell">
        <aside className="super-admin-sidebar" aria-label="Super admin navigation">
          <div className="super-admin-sidebar-brand">
            <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="Elite Admin logo" />
          </div>

          <nav className="super-admin-sidebar-nav">
            <button type="button" className="super-admin-sidebar-item" onClick={() => setActiveSection('dashboard')}>
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
              <ChevronRight size={14} strokeWidth={2.4} className="super-admin-sidebar-caret" />
            </button>
          </nav>
        </aside>

        <div className="super-admin-main">
          <header className="super-admin-topbar">
            <div className="super-admin-topbar-left">
              <button type="button" className="super-admin-icon-button" aria-label="Open menu">
                <Menu size={22} strokeWidth={2.2} />
              </button>

              <div className="super-admin-brand">
                <img className="super-admin-brand-logo" src="/logo1.png" alt="Super Admin logo" />
                <span className="super-admin-brand-title">Elite Admin</span>
              </div>
            </div>

            <button type="button" className="super-admin-branch-chip" aria-label="Select branch">
              <Building2 size={18} strokeWidth={2.1} />
              <span>All Branches</span>
              <ChevronDown size={18} strokeWidth={2.2} />
            </button>

            <div className="super-admin-topbar-right">
              <button type="button" className="super-admin-notification-button" aria-label="Notifications">
                <Bell size={22} strokeWidth={2.1} />
                <span className="super-admin-notification-badge">8</span>
              </button>

              <div className="super-admin-profile">
                <AvatarBadge />
                <div className="super-admin-profile-copy">
                  <strong>Super Admin</strong>
                  <span>superadmin@example.com</span>
                </div>
                <ChevronDown size={18} strokeWidth={2.2} className="super-admin-profile-chevron" />
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

                  <button type="button" className="branch-add-button" onClick={openAddBranch}>
                    <span>+</span>
                    <span>Add Branch</span>
                  </button>
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
                        <th>Address</th>
                        <th>Contact</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBranches.map((branch, index) => (
                        <tr key={branch.id}>
                          <td>{(safeCurrentPage - 1) * rowsPerPage + index + 1}</td>
                          <td><strong>{branch.branchId}</strong></td>
                          <td><strong>{branch.branchName}</strong></td>
                          <td>{branch.branchAddress}</td>
                          <td className="branch-contact-cell">
                            <span className="branch-contact-email">{branch.branchEmail}</span>
                            <span className="branch-contact-phone">{branch.branchPhone}</span>
                          </td>
                          <td className="branch-created-at-cell">{branch.createdAt}</td>
                          <td>
                            <div
                              className={`branch-actions branch-actions-wrap ${actionMenuBranchId === branch.id ? 'is-open' : ''}`.trim()}
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
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
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
              <div className="super-admin-hero-copy">
                <p className="eyebrow">Super Admin</p>
                <h1>Control Center</h1>
                <p>Dummy super admin dashboard for login validation and role checks.</p>
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

            <h2>{editingBranchId !== null ? 'Edit branch information' : 'Branch information'}</h2>

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
                <span>Address</span>
                <input
                  type="text"
                  value={form.branchAddress}
                  onChange={(event) => updateField('branchAddress', event.target.value)}
                  placeholder="Enter address"
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
               {editingBranchId !== null ? 'Save changes' : 'Submit'}
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
              <h2 id="branch-success-title">Branch created successfully</h2>
              <p>{successMessage}</p>
            </div>

            <div className="branch-success-actions">
              <button type="button" className="branch-success-secondary" onClick={() => setIsSuccessOpen(false)}>
                View table
              </button>
              <button type="button" className="branch-success-primary" onClick={() => setIsSuccessOpen(false)}>
                OK
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
              <button type="button" className="branch-delete-danger" onClick={handleDeleteBranch}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
