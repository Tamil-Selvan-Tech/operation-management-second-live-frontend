import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  Search,
  MoreVertical,
  X,
  CheckCircle2,
  Mail,
  Phone,
  BookOpen,
  UserRound,
  Trash2,
  Edit,
  Eye,
  MapPin,
} from 'lucide-react'
import { getCitiesOfState, getCountries, getStatesOfCountry } from '@countrystatecity/countries-browser'
import '../styles/BranchFacultyPage.css'

// Prefix constant for Faculty ID
const FACULTY_ID_PREFIX = 'FC-'

// Initial seed faculty matching user requirement values
const initialFaculty = [
  {
    id: 'FC-001',
    name: 'Arun Kumar',
    email: 'arun@gmail.com',
    phone: '9876543210',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Chennai',
    address: 'No. 12, Main Street, Chennai',
    status: 'Active',
  },
  {
    id: 'FC-002',
    name: 'Priya Raj',
    email: 'priya.raj@cispro.com',
    phone: '9876543211',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Madurai',
    address: 'No. 45, Bypass Road, Madurai',
    status: 'Active',
  },
  {
    id: 'FC-003',
    name: 'Karthik Raja',
    email: 'karthik.raja@cispro.com',
    phone: '9876543212',
    country: 'India',
    state: 'Tamil Nadu',
    city: 'Coimbatore',
    address: 'No. 78, Cross Cut Road, Coimbatore',
    status: 'Inactive',
  },
]

export function BranchFacultyPage() {
  const [facultyList, setFacultyList] = useState(initialFaculty)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalForm, setModalForm] = useState({
    idDigits: '', // Holds 3 numbers after FC-
    name: '',
    email: '',
    phone: '',
    country: '',
    countryCode: '',
    state: '',
    stateCode: '',
    city: '',
    address: '',
    status: 'Active',
  })
  const [editingId, setEditingId] = useState(null)

  // Options for dropdown selectors
  const [countryOptions, setCountryOptions] = useState([])
  const [stateOptions, setStateOptions] = useState([])
  const [cityOptions, setCityOptions] = useState([])
  
  // Validation errors & touched states
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  
  // Custom dialog/alert states
  const [successAlert, setSuccessAlert] = useState(null) // { title, message }
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null) // faculty object
  const [viewFaculty, setViewFaculty] = useState(null) // faculty object for details drawer
  
  // Actions dropdown
  const [openActionId, setOpenActionId] = useState('')

  // Load countries on mount
  useEffect(() => {
    let cancelled = false
    getCountries()
      .then((items) => {
        if (cancelled) return
        const sorted = Array.isArray(items)
          ? [...items].sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
          : []
        setCountryOptions(sorted)
      })
      .catch(() => {
        if (!cancelled) setCountryOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Load states on country code change
  useEffect(() => {
    if (!modalForm.countryCode) {
      setStateOptions([])
      setCityOptions([])
      return undefined
    }
    let cancelled = false
    getStatesOfCountry(modalForm.countryCode)
      .then((items) => {
        if (cancelled) return
        const sorted = Array.isArray(items)
          ? [...items].sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
          : []
        setStateOptions(sorted)
      })
      .catch(() => {
        if (!cancelled) setStateOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [modalForm.countryCode])

  // Load cities on country + state code change
  useEffect(() => {
    if (!modalForm.countryCode || !modalForm.stateCode) {
      setCityOptions([])
      return undefined
    }
    let cancelled = false
    getCitiesOfState(modalForm.countryCode, modalForm.stateCode)
      .then((items) => {
        if (cancelled) return
        const sorted = Array.isArray(items)
          ? [...items].sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
          : []
        setCityOptions(sorted)
      })
      .catch(() => {
        if (!cancelled) setCityOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [modalForm.countryCode, modalForm.stateCode])

  // Map state name to code in Edit mode dynamically
  useEffect(() => {
    if (editingId && modalForm.state && !modalForm.stateCode && stateOptions.length > 0) {
      const stateObj = stateOptions.find((s) => s.name === modalForm.state)
      if (stateObj) {
        setModalForm((prev) => ({
          ...prev,
          stateCode: stateObj.iso2,
        }))
      }
    }
  }, [editingId, modalForm.state, modalForm.stateCode, stateOptions])

  // Helper to generate the next auto-incremented digit suffix (e.g. "004")
  const getNextAvailableIdDigits = (list) => {
    let maxNum = 0
    list.forEach((f) => {
      const parts = f.id.split('-')
      if (parts.length === 2 && parts[0] === FACULTY_ID_PREFIX.replace('-', '')) {
        const num = parseInt(parts[1], 10)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
        }
      }
    })
    const nextNum = maxNum + 1
    return String(nextNum).padStart(3, '0')
  }

  // Filtered list
  const filteredFaculty = useMemo(() => {
    return facultyList.filter((faculty) => {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        faculty.id.toLowerCase().includes(query) ||
        faculty.name.toLowerCase().includes(query) ||
        faculty.email.toLowerCase().includes(query) ||
        faculty.phone.includes(query) ||
        (faculty.country && faculty.country.toLowerCase().includes(query)) ||
        (faculty.state && faculty.state.toLowerCase().includes(query)) ||
        (faculty.city && faculty.city.toLowerCase().includes(query)) ||
        (faculty.address && faculty.address.toLowerCase().includes(query))

      const matchesStatus =
        statusFilter === 'All' || faculty.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [facultyList, searchQuery, statusFilter])

  // Individual Field Validators
  const validateIdDigits = (digits, currentId, allFaculty) => {
    if (!digits) return 'Faculty ID digits are required.'
    if (!/^\d{3}$/.test(digits)) return 'Faculty ID suffix must be exactly 3 numbers.'
    const fullId = `${FACULTY_ID_PREFIX}${digits}`
    const isDuplicate = allFaculty.some((f) => f.id === fullId && f.id !== currentId)
    if (isDuplicate) return `Faculty ID ${fullId} already exists.`
    return ''
  }

  const validateName = (name) => {
    if (!name.trim()) return 'Faculty Name is required.'
    if (!/^[A-Za-z\s]+$/.test(name)) return 'Faculty Name must contain letters and spaces only.'
    return ''
  }

  const validateEmail = (email, currentId, allFaculty) => {
    if (!email.trim()) return 'Email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format.'
    const isDuplicate = allFaculty.some(
      (f) => f.email.toLowerCase() === email.trim().toLowerCase() && f.id !== currentId
    )
    if (isDuplicate) return 'This email address is already registered.'
    return ''
  }

  const validatePhone = (phone, currentId, allFaculty) => {
    if (!phone.trim()) return 'Phone number is required.'
    if (!/^\d{10}$/.test(phone.trim())) return 'Phone number must be exactly 10 digits.'
    const isDuplicate = allFaculty.some((f) => f.phone.trim() === phone.trim() && f.id !== currentId)
    if (isDuplicate) return 'This phone number is already registered.'
    return ''
  }

  const validateCountry = (country) => {
    if (!country) return 'Country is required.'
    return ''
  }

  const validateState = (state) => {
    if (!state) return 'State is required.'
    return ''
  }

  const validateCity = (city) => {
    if (!city) return 'City is required.'
    return ''
  }

  const validateAddress = (address) => {
    if (!address.trim()) return 'Address is required.'
    return ''
  }

  // Live validation triggers on input changes
  const handleIdDigitsChange = (val) => {
    const cleanDigits = val.replace(/\D/g, '').substring(0, 3)
    setModalForm((prev) => ({ ...prev, idDigits: cleanDigits }))
    const err = validateIdDigits(cleanDigits, editingId, facultyList)
    setErrors((prev) => ({ ...prev, idDigits: err }))
  }

  const handleNameChange = (val) => {
    setModalForm((prev) => ({ ...prev, name: val }))
    const err = validateName(val)
    setErrors((prev) => ({ ...prev, name: err }))
  }

  const handleEmailChange = (val) => {
    setModalForm((prev) => ({ ...prev, email: val }))
    const err = validateEmail(val, editingId, facultyList)
    setErrors((prev) => ({ ...prev, email: err }))
  }

  const handlePhoneChange = (val) => {
    const cleanPhone = val.replace(/\D/g, '').substring(0, 10)
    setModalForm((prev) => ({ ...prev, phone: cleanPhone }))
    const err = validatePhone(cleanPhone, editingId, facultyList)
    setErrors((prev) => ({ ...prev, phone: err }))
  }

  const handleCountryChange = (countryName) => {
    const selected = countryOptions.find((c) => c.name === countryName)
    const code = selected ? selected.iso2 : ''
    setModalForm((prev) => ({
      ...prev,
      country: countryName,
      countryCode: code,
      state: '',
      stateCode: '',
      city: '',
    }))
    const err = validateCountry(countryName)
    setErrors((prev) => ({
      ...prev,
      country: err,
      state: '',
      city: '',
    }))
  }

  const handleStateChange = (stateName) => {
    const selected = stateOptions.find((s) => s.name === stateName)
    const code = selected ? selected.iso2 : ''
    setModalForm((prev) => ({
      ...prev,
      state: stateName,
      stateCode: code,
      city: '',
    }))
    const err = validateState(stateName)
    setErrors((prev) => ({
      ...prev,
      state: err,
      city: '',
    }))
  }

  const handleCityChange = (cityName) => {
    setModalForm((prev) => ({
      ...prev,
      city: cityName,
    }))
    const err = validateCity(cityName)
    setErrors((prev) => ({
      ...prev,
      city: err,
    }))
  }

  const handleAddressChange = (addressVal) => {
    setModalForm((prev) => ({
      ...prev,
      address: addressVal,
    }))
    const err = validateAddress(addressVal)
    setErrors((prev) => ({
      ...prev,
      address: err,
    }))
  }

  const handleInputChange = (field, val) => {
    setModalForm((prev) => ({ ...prev, [field]: val }))
  }

  // Close actions menu when clicking outside
  useEffect(() => {
    if (!openActionId) return
    const handleClose = () => setOpenActionId('')
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [openActionId])

  // Open modal for Adding a new Faculty
  const openAddModal = () => {
    const nextDigits = getNextAvailableIdDigits(facultyList)
    setEditingId(null)
    setModalForm({
      idDigits: nextDigits,
      name: '',
      email: '',
      phone: '',
      country: '',
      countryCode: '',
      state: '',
      stateCode: '',
      city: '',
      address: '',
      status: 'Active',
    })
    setErrors({})
    setTouched({})
    setIsModalOpen(true)
  }

  // Open modal for Editing an existing Faculty
  const openEditModal = (faculty, e) => {
    if (e) e.stopPropagation()
    const parts = faculty.id.split('-')
    const digits = parts.length === 2 ? parts[1] : ''
    
    const countryObj = countryOptions.find((c) => c.name === faculty.country)
    const cCode = countryObj ? countryObj.iso2 : ''

    setEditingId(faculty.id)
    setModalForm({
      idDigits: digits,
      name: faculty.name,
      email: faculty.email,
      phone: faculty.phone,
      country: faculty.country || '',
      countryCode: cCode,
      state: faculty.state || '',
      stateCode: '',
      city: faculty.city || '',
      address: faculty.address || '',
      status: faculty.status,
    })
    setErrors({})
    setTouched({})
    setIsModalOpen(true)
    setOpenActionId('')
  }

  // Submit Handler for Add / Edit
  const handleFormSubmit = (e) => {
    e.preventDefault()
    
    const idDigitsErr = validateIdDigits(modalForm.idDigits, editingId, facultyList)
    const nameErr = validateName(modalForm.name)
    const emailErr = validateEmail(modalForm.email, editingId, facultyList)
    const phoneErr = validatePhone(modalForm.phone, editingId, facultyList)
    const countryErr = validateCountry(modalForm.country)
    const stateErr = validateState(modalForm.state)
    const cityErr = validateCity(modalForm.city)
    const addressErr = validateAddress(modalForm.address)

    const nextErrors = {
      idDigits: idDigitsErr,
      name: nameErr,
      email: emailErr,
      phone: phoneErr,
      country: countryErr,
      state: stateErr,
      city: cityErr,
      address: addressErr,
    }

    setErrors(nextErrors)
    setTouched({
      idDigits: true,
      name: true,
      email: true,
      phone: true,
      country: true,
      state: true,
      city: true,
      address: true,
    })

    const hasErrors = Object.values(nextErrors).some((err) => !!err)
    if (hasErrors) return

    const fullId = `${FACULTY_ID_PREFIX}${modalForm.idDigits}`

    if (editingId) {
      // Edit Save Flow
      setFacultyList((prev) =>
        prev.map((f) =>
          f.id === editingId
            ? {
                ...f,
                id: fullId,
                name: modalForm.name,
                email: modalForm.email,
                phone: modalForm.phone,
                country: modalForm.country,
                state: modalForm.state,
                city: modalForm.city,
                address: modalForm.address,
                status: modalForm.status,
              }
            : f
        )
      )
      setSuccessAlert({
        title: '✓ Faculty Updated Successfully',
        message: 'Faculty details have been updated successfully.',
      })
    } else {
      // Add Save Flow
      const newFaculty = {
        id: fullId,
        name: modalForm.name,
        email: modalForm.email,
        phone: modalForm.phone,
        country: modalForm.country,
        state: modalForm.state,
        city: modalForm.city,
        address: modalForm.address,
        status: modalForm.status,
      }
      setFacultyList((prev) => [newFaculty, ...prev])
      setSuccessAlert({
        title: '✓ Faculty Added Successfully',
        message: 'New faculty has been onboarded successfully.',
      })
    }

    setIsModalOpen(false)
  }

  // Delete Action Trigger
  const triggerDelete = (faculty, e) => {
    if (e) e.stopPropagation()
    setDeleteConfirmTarget(faculty)
    setOpenActionId('')
  }

  const confirmDelete = () => {
    if (!deleteConfirmTarget) return
    setFacultyList((prev) => prev.filter((f) => f.id !== deleteConfirmTarget.id))
    setDeleteConfirmTarget(null)
    setSuccessAlert({
      title: '✓ Faculty Deleted Successfully',
      message: 'Faculty has been deleted successfully.',
    })
  }

  return (
    <div className="branch-dashboard-section" style={{ contentVisibility: 'auto' }}>
      <div className="branch-dashboard-section-heading">
        <div className="branch-dashboard-section-heading-copy">
          <h2>Faculty Management</h2>
          <p>Onboard, manage, and view instructors assigned to your branch courses.</p>
        </div>
        <div className="branch-dashboard-section-heading-actions">
          <button
            type="button"
            className="button button-solid"
            onClick={openAddModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> Add Faculty
          </button>
          
          <div className="branch-dashboard-section-summary">
            <span>Total Faculty:</span>
            <strong>{facultyList.length}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="faculty-filter-bar">
        <div className="faculty-search-wrapper">
          <Search size={18} className="faculty-search-icon" />
          <input
            type="text"
            placeholder="Search faculty by ID, name, email or specialization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="faculty-search-input"
          />
        </div>
        
        <div className="faculty-status-filter-wrapper">
          <span className="faculty-status-filter-label">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="faculty-status-filter-select"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="faculty-table-shell">
        <table className="branch-dashboard-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>S.No</th>
              <th>Faculty ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Status</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFaculty.length > 0 ? (
              filteredFaculty.map((faculty, index) => {
                const normStatus = String(faculty.status || 'Active').toLowerCase()
                return (
                  <tr key={faculty.id} style={{ cursor: 'pointer' }} onClick={() => setViewFaculty(faculty)}>
                    <td>{index + 1}</td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{faculty.id}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="faculty-avatar">
                          {faculty.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <strong className="branch-course-name">{faculty.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="faculty-info-link">
                        <Mail size={14} style={{ color: '#94a3b8' }} />
                        {faculty.email}
                      </span>
                    </td>
                    <td>
                      <span className="faculty-info-link">
                        <Phone size={14} style={{ color: '#94a3b8' }} />
                        {faculty.phone}
                      </span>
                    </td>
                    <td>
                      <span className="faculty-info-link">
                        <MapPin size={14} style={{ color: '#94a3b8' }} />
                        {faculty.city}, {faculty.state}
                      </span>
                    </td>
                    <td>
                      <span className={`branch-course-status-pill ${normStatus}`}>
                        {faculty.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="branch-course-actions-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenActionId(openActionId === faculty.id ? '' : faculty.id)
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openActionId === faculty.id && (
                        <div
                          className="branch-course-actions-menu"
                          role="menu"
                          style={{
                            position: 'absolute',
                            right: '30px',
                            top: '5px',
                            zIndex: '50',
                            display: 'block',
                          }}
                        >
                          <button
                            type="button"
                            className="branch-course-actions-menu-item"
                            onClick={() => {
                              setViewFaculty(faculty)
                              setOpenActionId('')
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Eye size={14}/> View</span>
                          </button>
                          <button
                            type="button"
                            className="branch-course-actions-menu-item"
                            onClick={(e) => openEditModal(faculty, e)}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Edit size={14}/> Edit</span>
                          </button>
                          <button
                            type="button"
                            className="branch-course-actions-menu-item is-danger"
                            onClick={(e) => triggerDelete(faculty, e)}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Trash2 size={14}/> Delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan="8" className="branch-course-empty-state">
                  No faculty found matching search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal using 2-column layout matching design specs screenshot */}
      {isModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div role="presentation" onClick={() => setIsModalOpen(false)} className="faculty-portal-backdrop">
              <form
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleFormSubmit}
                className="faculty-modal-card"
              >
                {/* Header */}
                <div className="faculty-modal-header">
                  <h2 className="faculty-modal-title">
                    {editingId ? 'Edit Faculty' : 'Create Faculty'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    aria-label="Close form"
                    className="faculty-modal-close-btn"
                  >
                    ×
                  </button>
                </div>

                {/* 2-Column Grid Layout */}
                <div className="faculty-modal-grid">
                  {/* Faculty ID (Fixed Prefix) */}
                  <div className="faculty-field-group">
                    <span className="faculty-field-label">
                      Faculty ID <b>*</b>
                    </span>
                    <div className="faculty-id-input-container">
                      <span className="faculty-id-prefix-badge">
                        {FACULTY_ID_PREFIX}
                      </span>
                      <input
                        type="text"
                        maxLength={3}
                        placeholder="001"
                        value={modalForm.idDigits}
                        onChange={(e) => handleIdDigitsChange(e.target.value)}
                        onBlur={() => setTouched((prev) => ({ ...prev, idDigits: true }))}
                        className="faculty-id-input"
                        disabled={!!editingId}
                        required
                      />
                    </div>
                    {touched.idDigits && errors.idDigits && (
                      <small className="faculty-error-message">
                        {errors.idDigits}
                      </small>
                    )}
                  </div>

                  {/* Faculty Name */}
                  <div className="faculty-field-group">
                    <span className="faculty-field-label">
                      Faculty Name <b>*</b>
                    </span>
                    <input
                      type="text"
                      placeholder="Enter faculty name"
                      value={modalForm.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                      className="faculty-text-input"
                      required
                    />
                    {touched.name && errors.name && (
                      <small className="faculty-error-message">
                        {errors.name}
                      </small>
                    )}
                  </div>

                  {/* Faculty Email */}
                  <div className="faculty-field-group">
                    <span className="faculty-field-label">
                      Faculty Email <b>*</b>
                    </span>
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={modalForm.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                      className="faculty-text-input"
                      required
                    />
                    {touched.email && errors.email && (
                      <small className="faculty-error-message">
                        {errors.email}
                      </small>
                    )}
                  </div>

                  {/* Faculty Phone Number */}
                  <div className="faculty-field-group">
                    <span className="faculty-field-label">
                      Faculty Phone Number <b>*</b>
                    </span>
                    <input
                      type="text"
                      placeholder="Enter 10 digit number"
                      value={modalForm.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                      className="faculty-text-input"
                      required
                    />
                    {touched.phone && errors.phone && (
                      <small className="faculty-error-message">
                        {errors.phone}
                      </small>
                    )}
                  </div>

                  {/* Country */}
                  <div className="faculty-field-group">
                    <span className="faculty-field-label">
                      Country <b>*</b>
                    </span>
                    <select
                      value={modalForm.country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, country: true }))}
                      className="faculty-select-input"
                      required
                    >
                      <option value="">Select Country</option>
                      {countryOptions.map((c) => (
                        <option key={c.iso2} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {touched.country && errors.country && (
                      <small className="faculty-error-message">
                        {errors.country}
                      </small>
                    )}
                  </div>

                  {/* State */}
                  <div className="faculty-field-group">
                    <span className="faculty-field-label">
                      State <b>*</b>
                    </span>
                    <select
                      value={modalForm.state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, state: true }))}
                      className="faculty-select-input"
                      disabled={!modalForm.countryCode}
                      required
                    >
                      <option value="">Select State</option>
                      {stateOptions.map((s) => (
                        <option key={s.iso2} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {touched.state && errors.state && (
                      <small className="faculty-error-message">
                        {errors.state}
                      </small>
                    )}
                  </div>

                  {/* City */}
                  <div className="faculty-field-group">
                    <span className="faculty-field-label">
                      City <b>*</b>
                    </span>
                    <select
                      value={modalForm.city}
                      onChange={(e) => handleCityChange(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, city: true }))}
                      className="faculty-select-input"
                      disabled={!modalForm.stateCode}
                      required
                    >
                      <option value="">Select City</option>
                      {cityOptions.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {touched.city && errors.city && (
                      <small className="faculty-error-message">
                        {errors.city}
                      </small>
                    )}
                  </div>

                  {/* Status */}
                  <div className="faculty-field-group">
                    <span className="faculty-field-label">
                      Status <b>*</b>
                    </span>
                    <select
                      value={modalForm.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      className="faculty-select-input"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Address */}
                  <div className="faculty-field-group" style={{ gridColumn: '1 / span 2' }}>
                    <span className="faculty-field-label">
                      Address <b>*</b>
                    </span>
                    <textarea
                      placeholder="Enter street address"
                      value={modalForm.address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, address: true }))}
                      className="faculty-textarea-input"
                      required
                    />
                    {touched.address && errors.address && (
                      <small className="faculty-error-message">
                        {errors.address}
                      </small>
                    )}
                  </div>
                </div>

                {/* Divider above buttons */}
                <div className="faculty-modal-divider" />

                {/* Action Buttons */}
                <div className="faculty-modal-actions">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="faculty-btn-cancel"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="faculty-btn-submit">
                    {editingId ? 'Save Changes' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}


      {/* Right Drawer Slide-out for Viewing Faculty Details */}
      {viewFaculty && typeof document !== 'undefined'
        ? createPortal(
            <div 
              className="branch-course-drawer-backdrop" 
              role="presentation" 
              onClick={() => setViewFaculty(null)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(15, 23, 42, 0.45)',
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)',
                zIndex: 1400,
              }}
            >
              <aside
                className="branch-course-view-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="branch-faculty-view-title"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="branch-course-view-drawer-header">
                  <div className="branch-course-header-content">
                    <p className="section-kicker">FACULTY DETAILS</p>
                    <h2 id="branch-faculty-view-title">{viewFaculty.name}</h2>
                    <span className="branch-course-view-code">{viewFaculty.id}</span>
                  </div>

                  <div className="branch-course-view-header-actions">
                    <div className="branch-course-view-header-actions-row">
                      <strong className={`branch-course-status-pill ${String(viewFaculty.status).toLowerCase()}`}>
                        {viewFaculty.status}
                      </strong>

                      <button
                        type="button"
                        className="branch-course-view-close"
                        onClick={() => setViewFaculty(null)}
                        aria-label="Close faculty details"
                      >
                        X
                      </button>
                    </div>

                    <button
                      type="button"
                      className="branch-course-view-edit"
                      onClick={() => {
                        const facultyToEdit = viewFaculty
                        setViewFaculty(null)
                        openEditModal(facultyToEdit)
                      }}
                    >
                      Edit Faculty
                    </button>
                  </div>
                </div>

                {/* Details Table */}
                <div className="branch-course-view-body">
                  <div className="branch-course-view-table" role="table" aria-label="Faculty information details">
                    <div className="branch-course-view-table-header" role="row">
                      <div className="branch-course-view-table-head" role="columnheader">DETAILS</div>
                      <div className="branch-course-view-table-head" role="columnheader">INFORMATION</div>
                    </div>

                    <div className="branch-course-view-row" role="row">
                      <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                        <span>Faculty ID</span>
                      </div>
                      <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                        <strong>{viewFaculty.id}</strong>
                      </div>
                    </div>

                    <div className="branch-course-view-row" role="row">
                      <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                        <span>Faculty Name</span>
                      </div>
                      <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                        <strong>{viewFaculty.name}</strong>
                      </div>
                    </div>

                    <div className="branch-course-view-row" role="row">
                      <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                        <span>Email Address</span>
                      </div>
                      <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                        <strong>{viewFaculty.email}</strong>
                      </div>
                    </div>

                    <div className="branch-course-view-row" role="row">
                      <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                        <span>Phone Number</span>
                      </div>
                      <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                        <strong>{viewFaculty.phone}</strong>
                      </div>
                    </div>

                    <div className="branch-course-view-row" role="row">
                      <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                        <span>Country</span>
                      </div>
                      <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                        <strong>{viewFaculty.country}</strong>
                      </div>
                    </div>

                    <div className="branch-course-view-row" role="row">
                      <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                        <span>State</span>
                      </div>
                      <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                        <strong>{viewFaculty.state}</strong>
                      </div>
                    </div>

                    <div className="branch-course-view-row" role="row">
                      <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                        <span>City</span>
                      </div>
                      <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                        <strong>{viewFaculty.city}</strong>
                      </div>
                    </div>

                    <div className="branch-course-view-row" role="row">
                      <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                        <span>Address</span>
                      </div>
                      <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                        <strong>{viewFaculty.address}</strong>
                      </div>
                    </div>

                    <div className="branch-course-view-row" role="row">
                      <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                        <span>Status</span>
                      </div>
                      <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                        <strong className={`branch-course-status-pill ${String(viewFaculty.status).toLowerCase()}`}>
                          {viewFaculty.status}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>,
            document.body
          )
        : null}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && typeof document !== 'undefined'
        ? createPortal(
            <div role="presentation" className="faculty-portal-backdrop">
              <div className="faculty-delete-modal-card" role="dialog" aria-modal="true" aria-labelledby="faculty-delete-title" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="branch-modal-close"
                  aria-label="Close delete confirmation"
                  onClick={() => setDeleteConfirmTarget(null)}
                >
                  X
                </button>

                <div className="super-admin-logout-icon is-danger" aria-hidden="true">
                  <Trash2 size={28} />
                </div>

                <h2 id="faculty-delete-title" className="faculty-delete-title">Delete Faculty?</h2>
                
                <p className="faculty-delete-copy">
                  Are you sure you want to delete <strong>"{deleteConfirmTarget.name}"</strong>?
                </p>
                <p className="faculty-delete-subcopy">
                  This action cannot be undone.
                </p>

                <div className="faculty-delete-actions">
                  <button
                    type="button"
                    className="branch-modal-cancel"
                    onClick={() => setDeleteConfirmTarget(null)}
                    style={{ flex: 1, padding: '10px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="faculty-btn-delete-confirm"
                    onClick={confirmDelete}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Success alert popups with exact text specified by user */}
      {successAlert && typeof document !== 'undefined'
        ? createPortal(
            <div role="presentation" onClick={() => setSuccessAlert(null)} className="faculty-portal-backdrop">
              <div className="faculty-success-modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="branch-modal-close"
                  aria-label="Close alert"
                  onClick={() => setSuccessAlert(null)}
                >
                  X
                </button>

                <div className="faculty-success-hero" aria-hidden="true">
                  <span className="faculty-success-ring" />
                  <span className="faculty-success-icon-container">
                    <CheckCircle2 size={30} style={{ color: '#22c55e' }} />
                  </span>
                </div>

                <div className="branch-success-copy">
                  <p className="faculty-success-kicker">Success</p>
                  <h2 className="faculty-success-title">{successAlert.title}</h2>
                  <p className="faculty-success-copy">{successAlert.message}</p>
                </div>

                <div className="faculty-success-actions">
                  <button
                    type="button"
                    className="faculty-success-btn-ok"
                    onClick={() => setSuccessAlert(null)}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

    </div>
  )
}
