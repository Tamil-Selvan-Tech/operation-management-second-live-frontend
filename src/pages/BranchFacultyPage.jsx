import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  Search,
  MoreVertical,
  SlidersHorizontal,

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
import {
  listBranchFaculty,
  createBranchFaculty,
  updateBranchFaculty,
  deleteBranchFaculty,
} from '../services/branchFacultyService'

// Prefix constant for Faculty ID
const FACULTY_ID_PREFIX = 'FC-'

export function BranchFacultyPage() {
  const [facultyList, setFacultyList] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 5

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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
  const [actionMenuPosition, setActionMenuPosition] = useState(null)
  const actionCloseTimer = useRef(null)

  const openActionMenu = (faculty, button) => {
    if (actionCloseTimer.current) {
      clearTimeout(actionCloseTimer.current)
    }

    const rect = button.getBoundingClientRect()

    const menuWidth = 125
    const menuHeight = 115
    const gap = 8

    let left = rect.right - menuWidth
    let top = rect.bottom + gap

    if (left < 8) {
      left = 8
    }

    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8
    }

    // கீழே space இல்லையென்றால் மேலே open ஆகும்
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - gap
    }

    if (top < 8) {
      top = 8
    }

    setActionMenuPosition({
      top,
      left,
    })

    setOpenActionId(faculty.id)
  }

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

  // Load faculty list from backend
  const fetchFaculty = async () => {
    try {
      const res = await listBranchFaculty()
      if (res?.data) {
        // Map backend representation to UI expectation
        const mapped = res.data.map((f) => ({
          dbId: f.id,
          id: f.facultyId,
          name: f.name,
          email: f.email,
          phone: f.phone,
          country: f.country,
          countryCode: f.countryCode,
          state: f.state,
          stateCode: f.stateCode,
          city: f.city,
          address: f.address,
          status: f.status,
        }))
        setFacultyList(mapped)
      }
    } catch (error) {
      console.error('Failed to fetch branch faculty:', error)
    }
  }

  useEffect(() => {
    fetchFaculty()
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
      const parts = (f.id || '').split('-')
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
    const query = searchQuery.trim().toLowerCase()

    if (!query) return facultyList

    return facultyList.filter((faculty) => {
      const searchableText = [
        faculty.id || '',
        faculty.name || '',
        faculty.email || '',
        faculty.phone || '',
        faculty.country || '',
        faculty.state || '',
        faculty.city || '',
        faculty.address || '',
      ].join(' ').toLowerCase()

      return searchableText.includes(query)
    })
  }, [facultyList, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredFaculty.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  useEffect(() => {
    setCurrentPage((prevPage) => Math.min(prevPage, totalPages))
  }, [totalPages])

  const paginatedFaculty = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * rowsPerPage
    return filteredFaculty.slice(startIndex, startIndex + rowsPerPage)
  }, [filteredFaculty, safeCurrentPage])

  // Individual Field Validators
  // =========================================
  // Field Validators
  // =========================================

  const validateIdDigits = (digits, currentId, allFaculty) => {
    if (!digits.trim()) return 'This field is required.'

    if (!/^\d{3}$/.test(digits)) {
      return 'Faculty ID must be exactly 3 numbers.'
    }

    const fullId = `${FACULTY_ID_PREFIX}${digits}`

    const isDuplicate = allFaculty.some(
      (f) => f.id === fullId && f.id !== currentId
    )

    if (isDuplicate) {
      return 'Faculty ID already exists.'
    }

    return ''
  }


  const validateName = (name) => {
    if (!name.trim()) return 'This field is required.'

    if (!/^[A-Za-z\s]+$/.test(name)) {
      return 'Faculty Name must contain letters and spaces only.'
    }

    return ''
  }

  const validateEmail = (email, currentId, allFaculty) => {
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      return 'This field is required.'
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return 'Invalid email format.'
    }

    const isDuplicate = allFaculty.some(
      (f) =>
        f.email?.trim().toLowerCase() === trimmedEmail.toLowerCase() &&
        f.id !== currentId
    )

    if (isDuplicate) {
      return 'Email already exists.'
    }

    return ''
  }

  const validatePhone = (phone, currentId, allFaculty) => {
    if (!phone.trim()) return 'This field is required.'

    if (!/^\d{10}$/.test(phone.trim())) {
      return 'Phone number must be exactly 10 digits.'
    }

    const isDuplicate = allFaculty.some(
      (f) =>
        f.phone.trim() === phone.trim() &&
        f.id !== currentId
    )

    if (isDuplicate) {
      return 'Phone number already exists.'
    }

    return ''
  }


  const validateCountry = (country) => {
    if (!country) return 'This field is required.'
    return ''
  }


  const validateState = (state) => {
    if (!state) return 'This field is required.'
    return ''
  }


  const validateCity = (city) => {
    if (!city) return 'This field is required.'
    return ''
  }


  const validateAddress = (address) => {
    if (!address.trim()) return 'This field is required.'
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
    setModalForm((prev) => ({
      ...prev,
      email: val,
    }))

    const trimmedEmail = val.trim()

    // Empty field
    if (!trimmedEmail) {
      setErrors((prev) => ({
        ...prev,
        email: 'This field is required.',
      }))
      setTouched((prev) => ({
        ...prev,
        email: true,
      }))
      return
    }

    // Check email format first
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrors((prev) => ({
        ...prev,
        email: 'Invalid email format.',
      }))
      setTouched((prev) => ({
        ...prev,
        email: true,
      }))
      return
    }

    // Check duplicate email
    const isDuplicate = facultyList.some(
      (f) =>
        f.email?.trim().toLowerCase() === trimmedEmail.toLowerCase() &&
        f.id !== editingId
    )

    setErrors((prev) => ({
      ...prev,
      email: isDuplicate ? 'Email already exists.' : '',
    }))

    setTouched((prev) => ({
      ...prev,
      email: true,
    }))
  }

  const handlePhoneChange = (val) => {
    const cleanPhone = val
      .replace(/\D/g, '')
      .substring(0, 10)

    setModalForm((prev) => ({
      ...prev,
      phone: cleanPhone,
    }))

    let error = ''

    if (!cleanPhone) {
      error = 'This field is required.'
    } else if (cleanPhone.length < 10) {
      error = 'Phone number must be exactly 10 digits.'
    } else {
      const isDuplicate = facultyList.some(
        (f) =>
          f.phone?.trim() === cleanPhone &&
          f.id !== editingId
      )

      if (isDuplicate) {
        error = 'Phone number already exists.'
      }
    }

    setErrors((prev) => ({
      ...prev,
      phone: error,
    }))

    setTouched((prev) => ({
      ...prev,
      phone: true,
    }))
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

    const handleClose = () => {
      setOpenActionId('')
      setActionMenuPosition(null)
    }

    window.addEventListener('click', handleClose)

    return () => {
      window.removeEventListener('click', handleClose)
    }
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
      country: 'India',
      countryCode: 'IN',
      state: 'Tamil Nadu',
      stateCode: 'TN',
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

  const handleFormSubmit = async (e) => {
    e.preventDefault()

    const idDigitsErr = validateIdDigits(
      modalForm.idDigits,
      editingId,
      facultyList
    )
    const nameErr = validateName(modalForm.name)
    const emailErr = validateEmail(
      modalForm.email,
      editingId,
      facultyList
    )
    const phoneErr = validatePhone(
      modalForm.phone,
      editingId,
      facultyList
    )
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

    const hasErrors = Object.values(nextErrors).some(Boolean)

    if (hasErrors) return

    const fullId = `${FACULTY_ID_PREFIX}${modalForm.idDigits}`

    const payload = {
      facultyId: fullId,
      name: modalForm.name,
      email: modalForm.email,
      phone: modalForm.phone,
      country: modalForm.country,
      countryCode: modalForm.countryCode,
      state: modalForm.state,
      stateCode: modalForm.stateCode,
      city: modalForm.city,
      address: modalForm.address,
      status: modalForm.status,
    }

    try {
      setIsSubmitting(true)

      if (editingId) {
        const targetFaculty = facultyList.find(
          (f) => f.id === editingId
        )

        if (targetFaculty?.dbId) {
          await updateBranchFaculty(
            targetFaculty.dbId,
            payload
          )
        }

        await fetchFaculty()

        setIsModalOpen(false)

        setSuccessAlert({
          title: '✓ Faculty Updated Successfully',
          message: 'Faculty details have been updated successfully.',
        })
      } else {
        await createBranchFaculty(payload)

        await fetchFaculty()

        setIsModalOpen(false)

        setSuccessAlert({
          title: '✓ Faculty Added Successfully',
          message: 'New faculty has been onboarded successfully.',
        })
      }
    } catch (err) {
      console.error(err)

      setErrors((prev) => ({
        ...prev,
        email:
          err?.body?.message ||
          'Error saving faculty. Please try again.',
      }))
    } finally {
      setIsSubmitting(false)
    }
  }
  // Delete Action Trigger
  const triggerDelete = (faculty, e) => {
    if (e) e.stopPropagation()
    setDeleteConfirmTarget(faculty)
    setOpenActionId('')
  }

  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return

    try {
      setIsDeleting(true)

      if (deleteConfirmTarget.dbId) {
        await deleteBranchFaculty(deleteConfirmTarget.dbId)
      }

      await fetchFaculty()

      setDeleteConfirmTarget(null)

      setSuccessAlert({
        title: '✓ Faculty Deleted Successfully',
        message: 'Faculty has been deleted successfully.',
      })
    } catch (error) {
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (<div className="branch-dashboard-section">

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

    {/* Search + Filter Bar */}
    <div className="faculty-search-filter-bar">

      {/* Search */}
      <div className="faculty-search-wrapper" style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Search faculty..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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

    {/* Table */}
    <div className="faculty-table-shell">
      <div className="faculty-table-scroll">
        <table className="branch-dashboard-table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Faculty ID</th>
              <th>Name</th>

              <th>Phone</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedFaculty.length > 0 ? (
              paginatedFaculty.map((faculty, index) => {
                const normStatus = String(faculty.status || 'Active').toLowerCase()
                const rowNumber = (safeCurrentPage - 1) * rowsPerPage + index + 1
                return (
                  <tr key={faculty.id} style={{ cursor: 'pointer' }} onClick={() => setViewFaculty(faculty)}>
                    <td>{rowNumber}</td>
                    <td>
                      <strong style={{ color: '#0f172a', fontSize: '0.82rem', fontFamily: 'monospace' }}>{faculty.facultyId || faculty.id}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="faculty-avatar">{String(faculty.name || '').charAt(0).toUpperCase()}</span>
                        <strong className="branch-course-name" style={{ maxWidth: '130px' }}>{faculty.name}</strong>
                      </div>
                    </td>

                    <td>
                      <span className="faculty-info-link">
                        <Phone size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                        {faculty.phone}
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
                        onMouseEnter={(e) => {
                          e.stopPropagation()
                          if (actionCloseTimer.current) {
                            clearTimeout(actionCloseTimer.current)
                          }
                          openActionMenu(faculty, e.currentTarget)
                        }}
                        onMouseLeave={() => {
                          actionCloseTimer.current = setTimeout(() => {
                            setOpenActionId('')
                            setActionMenuPosition(null)
                          }, 200)
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (openActionId === faculty.id) {
                            setOpenActionId('')
                            setActionMenuPosition(null)
                          } else {
                            openActionMenu(faculty, e.currentTarget)
                          }
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </td>
                    {openActionId &&
                      actionMenuPosition &&
                      typeof document !== 'undefined' &&
                      createPortal(
                        <div
                          className="branch-course-actions-menu"
                          role="menu"
                          style={{
                            position: 'fixed',
                            top: `${actionMenuPosition.top}px`,
                            left: `${actionMenuPosition.left}px`,
                            zIndex: 999999,
                          }}
                          onMouseEnter={() => {
                            if (actionCloseTimer.current) {
                              clearTimeout(actionCloseTimer.current)
                            }
                          }}
                          onMouseLeave={() => {
                            actionCloseTimer.current = setTimeout(() => {
                              setOpenActionId('')
                              setActionMenuPosition(null)
                            }, 200)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(() => {
                            const selectedFaculty = filteredFaculty.find(
                              (item) => item.id === openActionId
                            )

                            if (!selectedFaculty) return null

                            return (
                              <>
                                <button
                                  type="button"
                                  className="branch-course-actions-menu-item"
                                  onClick={() => {
                                    setViewFaculty(selectedFaculty)
                                    setOpenActionId('')
                                    setActionMenuPosition(null)
                                  }}
                                >
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <Eye size={14} />
                                    View
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  className="branch-course-actions-menu-item"
                                  onClick={(e) => {
                                    openEditModal(selectedFaculty, e)
                                    setActionMenuPosition(null)
                                  }}
                                >
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <Edit size={14} />
                                    Edit
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  className="branch-course-actions-menu-item is-danger"
                                  onClick={(e) => {
                                    triggerDelete(selectedFaculty, e)
                                    setActionMenuPosition(null)
                                  }}
                                >
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <Trash2 size={14} />
                                    Delete
                                  </span>
                                </button>
                              </>
                            )
                          })()}
                        </div>,
                        document.body
                      )}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan="7" className="branch-course-empty-state">
                  No faculty found matching search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    {totalPages > 1 && (
      <div className="faculty-pagination">
        <button
          type="button"
          className="faculty-pagination-button"
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={safeCurrentPage === 1}
        >
          Previous
        </button>

        <div className="faculty-pagination-pages">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              type="button"
              className={`faculty-pagination-page ${page === safeCurrentPage ? 'is-active' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="faculty-pagination-button"
          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          disabled={safeCurrentPage === totalPages}
        >
          Next
        </button>
      </div>
    )}

    {/* Add / Edit modal using 2-column layout matching design specs screenshot */}
    {
      isModalOpen && typeof document !== 'undefined'
        ? createPortal(
          <div role="presentation" className="faculty-portal-backdrop">
            <form
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleFormSubmit}
              className="faculty-modal-card"
              noValidate
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

                    />
                  </div>
                  {((touched.idDigits || modalForm.idDigits) && errors.idDigits) ? (
                    <small className="faculty-error-message">
                      {errors.idDigits}
                    </small>
                  ) : null}
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

                  />
                  {((touched.name || modalForm.name) && errors.name) ? (
                    <small className="faculty-error-message">
                      {errors.name}
                    </small>
                  ) : null}
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

                  />
                  {((touched.email || modalForm.email) && errors.email) ? (
                    <small className="faculty-error-message">
                      {errors.email}
                    </small>
                  ) : null}
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

                  />
                  {((touched.phone || modalForm.phone) && errors.phone) ? (
                    <small className="faculty-error-message">
                      {errors.phone}
                    </small>
                  ) : null}
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

                  >
                    <option value="">Select Country</option>
                    {countryOptions.map((c) => (
                      <option key={c.iso2} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {((touched.country || modalForm.country) && errors.country) ? (
                    <small className="faculty-error-message">
                      {errors.country}
                    </small>
                  ) : null}
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

                  >
                    <option value="">Select State</option>
                    {stateOptions.map((s) => (
                      <option key={s.iso2} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {((touched.state || modalForm.state) && errors.state) ? (
                    <small className="faculty-error-message">
                      {errors.state}
                    </small>
                  ) : null}
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

                  >
                    <option value="">Select City</option>
                    {cityOptions.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {((touched.city || modalForm.city) && errors.city) ? (
                    <small className="faculty-error-message">
                      {errors.city}
                    </small>
                  ) : null}
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

                  />
                  {((touched.address || modalForm.address) && errors.address) ? (
                    <small className="faculty-error-message">
                      {errors.address}
                    </small>
                  ) : null}
                </div>
              </div>

              {/* Divider above buttons */}
              <div className="faculty-modal-divider" />

              {/* Action Buttons */}
              {/* Action Buttons */}
              <div className="faculty-modal-actions">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="faculty-btn-cancel"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="faculty-btn-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? (editingId ? 'Saving...' : 'Submitting...')
                    : (editingId ? 'Save Changes' : 'Submit')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )
        : null
    }


    {/* Right Drawer Slide-out for Viewing Faculty Details */}
    {
      viewFaculty && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="branch-course-drawer-backdrop"
            role="presentation"
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
              cursor: 'default',
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


                </div>
              </div>
            </aside>
          </div>,
          document.body
        )
        : null
    }

    {/* Delete Confirmation Modal */}
    {
      deleteConfirmTarget && typeof document !== 'undefined'
        ? createPortal(
          <div role="presentation" className="faculty-portal-backdrop">
            <div className="faculty-delete-modal-card" role="dialog" aria-modal="true" aria-labelledby="faculty-delete-title" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close delete confirmation"
                onClick={() => setDeleteConfirmTarget(null)}
              >
                <X size={20} strokeWidth={2} />
              </button>



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
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
        : null
    }

    {/* Success alert popups with exact text specified by user */}
    {
      successAlert && typeof document !== 'undefined'
        ? createPortal(
          <div className="faculty-success-backdrop">
            <div
              className="faculty-success-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="faculty-success-title"
            >
              {/* Success Icon */}
              <div className="faculty-success-icon-wrapper">
                <div className="faculty-success-icon">
                  <CheckCircle2 size={34} strokeWidth={2.5} />
                </div>
              </div>

              {/* Content */}
              <div className="faculty-success-content">
                <span className="faculty-success-label">
                  Success
                </span>

                <h2 id="faculty-success-title">
                  {successAlert.title.replace('✓ ', '')}
                </h2>

                <p>
                  {successAlert.message}
                </p>
              </div>

              {/* Button */}
              <button
                type="button"
                className="faculty-success-ok-btn"
                onClick={() => setSuccessAlert(null)}
              >
                OK
              </button>
            </div>
          </div>,
          document.body
        )
        : null
    }

  </div >
  )
}
