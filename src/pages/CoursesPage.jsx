import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createCourse, deleteCourse, listCourses, updateCourse } from '../services/courseService'
import { saveCourseRecords } from '../data/courseRecords'

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

function StatusPill({ status }) {
  return <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4a2.1 2.1 0 0 0-3 0L3 14.5V20h1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m13.5 6.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 7h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.5 7l1 12.5A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function formatDuration(value) {
  if (value === '' || value == null) return '-'
  const normalized = String(value).trim()
  return `${normalized} ${normalized === '1' ? 'month' : 'months'}`
}

function formatHours(value) {
  if (value === '' || value == null) return '-'
  const normalized = String(value).trim()
  return `${normalized} ${normalized === '1' ? 'hour' : 'hours'}`
}

const MAX_CUSTOM_INSTALLMENTS = 12

function normalizeInstallmentCount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 1) return 0
  return Math.min(Math.floor(amount), MAX_CUSTOM_INSTALLMENTS)
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

function buildInstallmentsFromCourse(course, count) {
  const installments = []
  for (let index = 1; index <= count; index += 1) {
    installments.push(String(course?.[`installment${index}`] ?? ''))
  }
  return installments
}

export function CoursesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [courses, setCourses] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({
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
    status: '',
  })
  const [touched, setTouched] = useState({})
  const [saveError, setSaveError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const requestIdRef = useRef(0)

  const pageSize = 5

  const requiredFieldLabels = {
    name: 'Course Name',
    mode: 'Mode',
    duration: 'Duration (Months)',
    hours: 'Hours',
    actualFees: 'Actual Fees',
    registrationFees: 'Registration Fees',
    discount: 'Discount',
    installmentCount: 'Installment Count',
    customInstallmentCount: 'Custom Installment Count',
    status: 'Status',
  }

  const markTouched = (field) => {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }))
  }

  const afterDiscount = useMemo(() => {
    const actualFees = Number(form.actualFees || 0)
    const discount = Number(form.discount || 0)
    if (Number.isNaN(actualFees) || Number.isNaN(discount)) return ''
    return String(Math.max(actualFees - discount, 0))
  }, [form.actualFees, form.discount])

  const validationErrors = useMemo(() => {
    const errors = {}

    if (!form.name.trim()) errors.name = `${requiredFieldLabels.name} is required.`
    if (!form.mode) errors.mode = `${requiredFieldLabels.mode} is required.`
    if (!form.duration) errors.duration = `${requiredFieldLabels.duration} is required.`
    if (form.duration && Number(form.duration) <= 0) errors.duration = 'Duration must be greater than zero.'
    if (!form.hours) errors.hours = `${requiredFieldLabels.hours} is required.`
    if (form.hours && Number(form.hours) <= 0) errors.hours = 'Hours must be greater than zero.'
    if (!form.actualFees) errors.actualFees = `${requiredFieldLabels.actualFees} is required.`
    if (!form.registrationFees) errors.registrationFees = `${requiredFieldLabels.registrationFees} is required.`
    if (!form.discount) errors.discount = `${requiredFieldLabels.discount} is required.`
    if (!form.installmentCount) errors.installmentCount = `${requiredFieldLabels.installmentCount} is required.`
    if (!form.status) errors.status = `${requiredFieldLabels.status} is required.`

    const effectiveInstallmentCount = getEffectiveInstallmentCount(form)
    if (form.installmentCount === 'custom' && !effectiveInstallmentCount) {
      errors.customInstallmentCount = `${requiredFieldLabels.customInstallmentCount} is required.`
    }

    for (let index = 1; index <= effectiveInstallmentCount; index += 1) {
      if (!getInstallmentValue(form, index)) {
        errors[`installment${index}`] = `Installment ${index} is required.`
      }
    }

    if (form.actualFees && form.discount && Number(form.discount) > Number(form.actualFees)) {
      errors.discount = 'Discount must be less than or equal to actual fees.'
    }

    const allRequiredFilled =
      form.name.trim() &&
      form.mode &&
      form.duration &&
      form.hours &&
      form.actualFees &&
      form.registrationFees &&
      form.discount &&
      form.installmentCount &&
      form.status &&
      (form.installmentCount !== 'custom' || effectiveInstallmentCount > 0) &&
      Array.from({ length: effectiveInstallmentCount }, (_, index) => index + 1).every((index) => Boolean(getInstallmentValue(form, index)))

    if (allRequiredFilled) {
      const discountedFee = Number(form.actualFees) - Number(form.discount)
      const installmentTotal = Array.from({ length: effectiveInstallmentCount }, (_, index) => Number(getInstallmentValue(form, index + 1) || 0)).reduce(
        (total, amount) => total + amount,
        0,
      )

      if (installmentTotal !== discountedFee) {
        for (let index = 1; index <= effectiveInstallmentCount; index += 1) {
          errors[`installment${index}`] = `Installment total must match ${discountedFee}.`
        }
      }
    }

    return errors
  }, [form, requiredFieldLabels])

  const totalPages = pagination.totalPages || 1
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const visibleCourses = courses

  const loadCourses = useCallback(
    async ({ page = currentPage, search = searchTerm, filter = activeFilter } = {}) => {
      const requestId = ++requestIdRef.current
      setIsLoading(true)
      setLoadError('')

      try {
        const query = {
          page,
          limit: pageSize,
          search,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }

        if (filter === 'Active' || filter === 'Inactive') {
          query.status = filter
        }

        if (filter === 'Online' || filter === 'Offline') {
          query.mode = filter
        }

        const result = await listCourses(query)

        if (requestId !== requestIdRef.current) return

        const nextCourses = result.data || []
        setCourses(nextCourses)
        saveCourseRecords(nextCourses)
        setPagination(result.meta || { page, limit: pageSize, total: 0, totalPages: 1 })
        setCurrentPage((result.meta?.page || page) ?? 1)
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        setCourses([])
        setPagination({
          page,
          limit: pageSize,
          total: 0,
          totalPages: 1,
        })
        setLoadError(error?.message || 'Unable to load courses right now.')
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [activeFilter, currentPage, pageSize, searchTerm],
  )

  useEffect(() => {
    void loadCourses({ page: currentPage, search: searchTerm, filter: activeFilter })
  }, [activeFilter, currentPage, loadCourses, searchTerm])

  const pageList = useMemo(() => {
    if (totalPages <= 8) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    if (safeCurrentPage <= 5) {
      return [1, 2, 3, 4, 5, 6, 7, 'right-ellipsis', totalPages]
    }

    if (safeCurrentPage >= totalPages - 4) {
      return [1, 'left-ellipsis', totalPages - 6, totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    const pages = [1, 'left-ellipsis']
    const start = safeCurrentPage - 2
    const end = safeCurrentPage + 2
    for (let page = start; page <= end; page += 1) pages.push(page)

    pages.push('right-ellipsis')
    pages.push(totalPages)
    return pages
  }, [safeCurrentPage, totalPages])

  const updateField = (field, value) => {
    if (saveError) setSaveError('')
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateNumericField = (field, value) => {
    updateField(field, value.replace(/[^\d]/g, ''))
  }

  const handleInstallmentCountChange = (value) => {
    if (saveError) setSaveError('')
    setForm((current) => ({
      ...current,
      installmentCount: value,
      customInstallmentCount: value === 'custom' ? current.customInstallmentCount : '',
      extraInstallments: value === 'custom' ? current.extraInstallments : [],
    }))
  }

  const handleCustomInstallmentCountChange = (value) => {
    if (saveError) setSaveError('')
    setForm((current) => ({
      ...current,
      installmentCount: 'custom',
      customInstallmentCount: value.replace(/[^\d]/g, ''),
    }))
  }

  const resetForm = () => {
    setForm({
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
      status: '',
    })
    setTouched({})
    setSaveError('')
    setEditingCourseId(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const closeModalAfterSave = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const openCreateModal = () => {
    setEditingCourseId(null)
    setTouched({})
    setIsModalOpen(true)
  }

  const openEditModal = (course) => {
    setEditingCourseId(course.id)
    setTouched({})
    setSaveError('')
    const installmentCount = normalizeInstallmentCount(course.installmentCount ?? 2)
    const isCustomCount = installmentCount > 3
    const installments = buildInstallmentsFromCourse(course, Math.max(installmentCount, 3))
    setForm({
      name: course.name || '',
      mode: course.mode || '',
      duration: course.duration ?? '',
      hours: course.hours ?? '',
      actualFees: course.actualFees ?? '',
      registrationFees: course.registrationFees ?? '',
      discount: course.discount ?? '',
      installmentCount: isCustomCount ? 'custom' : String(installmentCount || 2),
      customInstallmentCount: isCustomCount ? String(installmentCount) : '',
      installment1: installments[0] ?? '',
      installment2: installments[1] ?? '',
      installment3: installments[2] ?? '',
      extraInstallments: installments.slice(3),
      status: course.status || '',
    })
    setIsModalOpen(true)
  }

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const handleSearchChange = (value) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleFilterChange = (value) => {
    setActiveFilter(value)
    setCurrentPage(1)
  }

  const isValid = Object.keys(validationErrors).length === 0

  const shouldShowError = (field) => Boolean(touched[field] && validationErrors[field])

  const handleSave = async (event) => {
    event?.preventDefault()
    const effectiveInstallmentCount = getEffectiveInstallmentCount(form)
    const allTouched = Object.keys(requiredFieldLabels).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    if (form.installmentCount === 'custom') {
      allTouched.customInstallmentCount = true
    }
    for (let index = 1; index <= effectiveInstallmentCount; index += 1) {
      allTouched[`installment${index}`] = true
    }
    setTouched(allTouched)
    if (!isValid) {
      const firstError = Object.values(validationErrors)[0]
      setSaveError(firstError || 'Please fill all required fields before saving.')
      return
    }

    setSaveError('')
    setIsSaving(true)

    const installmentsPayload = Array.from({ length: effectiveInstallmentCount }, (_, index) => getInstallmentValue(form, index + 1))

    const payload = {
      name: form.name.trim(),
      mode: form.mode,

      duration: Number(form.duration),
      hours: Number(form.hours),
      actualFees: Number(form.actualFees),
      registrationFees: Number(form.registrationFees),
      discount: Number(form.discount),
      installmentCount: Number(form.installmentCount),
      installment1: Number(form.installment1),
      installment2: Number(form.installment2),
      installment3: form.installmentCount === '3' ? Number(form.installment3) : null,
      status: form.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',

      duration: form.duration,
      hours: form.hours,
      actualFees: form.actualFees,
      registrationFees: form.registrationFees,
      discount: form.discount,
      afterDiscount,
      installmentCount: String(effectiveInstallmentCount),
      status: form.status,

    }

    installmentsPayload.forEach((amount, index) => {
      payload[`installment${index + 1}`] = amount
    })

    try {
      if (editingCourseId) {
        await updateCourse(editingCourseId, payload)
      } else {
        await createCourse(payload)
      }

      await loadCourses({ page: editingCourseId ? currentPage : 1, search: searchTerm, filter: activeFilter })
      closeModalAfterSave()
    } catch (error) {
      setSaveError(error?.message || 'Unable to save course right now.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (courseId) => {
    setDeleteTarget(courses.find((course) => course.id === courseId) || null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    try {
      await deleteCourse(deleteTarget.id)
      if (editingCourseId === deleteTarget.id) {
        closeModal()
      }

      closeDeleteModal()
      await loadCourses({ page: currentPage, search: searchTerm, filter: activeFilter })
    } catch (error) {
      setLoadError(error?.message || 'Unable to delete course right now.')
      closeDeleteModal()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="courses-page">
      <div className="courses-topbar">
        <div>
          <p className="eyebrow">Courses</p>
          {/* <h2>Course Management</h2> */}
          <p>Create and manage course details with a clean enterprise workflow.</p>
        </div>

        <div className="courses-topbar-actions">
          <label className="dashboard-search course-search">
            <input
              type="search"
              placeholder="Search course..."
              aria-label="Search courses"
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
            <button type="button" className="dashboard-search-button" aria-label="Search courses">
              Search
            </button>
          </label>
          <button className="button button-solid course-add-button" type="button" onClick={openCreateModal}>
            + Add Course
          </button>
        </div>
      </div>

      <div className="course-toolbar">
        {['All', 'Active', 'Inactive', 'Online', 'Offline'].map((item) => (
          <button
            key={item}
            type="button"
            className={`course-filter-chip ${activeFilter === item ? 'active' : ''}`}
            onClick={() => handleFilterChange(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="course-validation-note course-validation-error" style={{ marginBottom: '1rem' }}>
          {loadError}
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="course-modal-backdrop" role="presentation">
          <form className="course-modal panel-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onSubmit={handleSave}>
            <div className="course-modal-header">
              <div>
                <p className="section-kicker">Course Entry</p>
                <h3>{editingCourseId ? 'Edit Course' : 'Add Course'}</h3>
              </div>
              <span className="detail-badge">Required fields marked *</span>
            </div>

            <div className="course-form-grid">
              <Field label="Course Name" required hint="Required field" error={shouldShowError('name') ? validationErrors.name : ''}>
                <input
                  type="text"
                  placeholder="Enter course name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  onBlur={() => markTouched('name')}
                  aria-invalid={Boolean(shouldShowError('name'))}
                />
              </Field>

              <Field label="Mode" required hint="Online / Offline / Hybrid" error={shouldShowError('mode') ? validationErrors.mode : ''}>
                <select
                  value={form.mode}
                  onChange={(event) => updateField('mode', event.target.value)}
                  onBlur={() => markTouched('mode')}
                  aria-invalid={Boolean(shouldShowError('mode'))}
                >
                  <option value="" disabled>
                    Select mode
                  </option>
                  <option>Online</option>
                  <option>Offline</option>
                  <option>Hybrid</option>
                </select>
              </Field>

              <Field label="Duration (Months)" required hint="Numbers only" error={shouldShowError('duration') ? validationErrors.duration : ''}>
                <div className="course-input-with-suffix">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="6"
                    value={form.duration}
                    onChange={(event) => updateNumericField('duration', event.target.value)}
                    onBlur={() => markTouched('duration')}
                    aria-invalid={Boolean(shouldShowError('duration'))}
                  />
                  <span>{Number(form.duration) === 1 ? 'month' : 'months'}</span>
                </div>
              </Field>

              <Field label="Hours" required hint="Numbers only" error={shouldShowError('hours') ? validationErrors.hours : ''}>
                <div className="course-input-with-suffix">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="180"
                    value={form.hours}
                    onChange={(event) => updateNumericField('hours', event.target.value)}
                    onBlur={() => markTouched('hours')}
                    aria-invalid={Boolean(shouldShowError('hours'))}
                  />
                  <span>{Number(form.hours) === 1 ? 'hour' : 'hours'}</span>
                </div>
              </Field>

              <Field label="Actual Fees" required hint="Numbers only" error={shouldShowError('actualFees') ? validationErrors.actualFees : ''}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="24000"
                  value={form.actualFees}
                  onChange={(event) => updateNumericField('actualFees', event.target.value)}
                  onBlur={() => markTouched('actualFees')}
                  aria-invalid={Boolean(shouldShowError('actualFees'))}
                />
              </Field>

              <Field label="Registration Fees" required hint="Numbers only" error={shouldShowError('registrationFees') ? validationErrors.registrationFees : ''}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="500"
                  value={form.registrationFees}
                  onChange={(event) => updateNumericField('registrationFees', event.target.value)}
                  onBlur={() => markTouched('registrationFees')}
                  aria-invalid={Boolean(shouldShowError('registrationFees'))}
                />
              </Field>

              <Field label="Discount" required hint="Must be less than or equal to actual fees" error={shouldShowError('discount') ? validationErrors.discount : ''}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="2000"
                  value={form.discount}
                  onChange={(event) => updateNumericField('discount', event.target.value)}
                  onBlur={() => markTouched('discount')}
                  aria-invalid={Boolean(shouldShowError('discount'))}
                />
              </Field>

              <Field label="After Discount (Auto Calculate)" hint="Auto calculated from actual fees and discount">
                <input type="text" value={afterDiscount} readOnly />
              </Field>

              <Field label="Installment Count" required hint="Choose 2, 3, or Custom" error={shouldShowError('installmentCount') ? validationErrors.installmentCount : ''}>
                <select
                  value={form.installmentCount}
                  onChange={(event) => handleInstallmentCountChange(event.target.value)}
                  onBlur={() => markTouched('installmentCount')}
                  aria-invalid={Boolean(shouldShowError('installmentCount'))}
                >
                  <option value="2">2 Installments</option>
                  <option value="3">3 Installments</option>
                  <option value="custom">Custom Installment</option>
                </select>
              </Field>

              {form.installmentCount === 'custom' ? (
                <Field
                  label="Custom Installment Count"
                  required
                  hint="Type how many installment fields you need"
                  error={shouldShowError('customInstallmentCount') ? validationErrors.customInstallmentCount : ''}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="4"
                    value={form.customInstallmentCount}
                    onChange={(event) => handleCustomInstallmentCountChange(event.target.value)}
                    onBlur={() => markTouched('customInstallmentCount')}
                    aria-invalid={Boolean(shouldShowError('customInstallmentCount'))}
                  />
                </Field>
              ) : null}

              {Array.from({ length: getEffectiveInstallmentCount(form) }, (_, index) => index + 1).map((installmentNumber) => (
                <Field
                  key={installmentNumber}
                  label={`Installment ${installmentNumber}`}
                  required
                  hint="Numbers only"
                  error={shouldShowError(`installment${installmentNumber}`) ? validationErrors[`installment${installmentNumber}`] : ''}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={installmentNumber === 1 ? '11000' : installmentNumber === 2 ? '11000' : '5500'}
                    value={getInstallmentValue(form, installmentNumber)}
                    onChange={(event) => {
                      const nextValue = event.target.value.replace(/[^\d]/g, '')
                      setForm((current) => {
                        if (saveError) setSaveError('')
                        return setInstallmentValue(current, installmentNumber, nextValue)
                      })
                    }}
                    onBlur={() => markTouched(`installment${installmentNumber}`)}
                    aria-invalid={Boolean(shouldShowError(`installment${installmentNumber}`))}
                  />
                </Field>
              ))}

              <Field label="Status" required hint="Active or Inactive" error={shouldShowError('status') ? validationErrors.status : ''}>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  onBlur={() => markTouched('status')}
                  aria-invalid={Boolean(shouldShowError('status'))}
                >
                  <option value="" disabled>
                    Select status
                  </option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </Field>
            </div>

            {Object.keys(touched).length > 0 && !isValid ? (
              <div className="course-validation-note course-validation-error">
                {saveError || Object.values(validationErrors)[0] || 'Please fill all required fields before saving.'}
              </div>
            ) : null}

            <div className="course-form-actions">
              <button type="button" className="button button-ghost" onClick={resetForm} disabled={isSaving}>
                Reset
              </button>
              <button type="submit" className="button button-solid" disabled={isSaving}>
                {editingCourseId ? 'Update Course' : 'Save Course'}
              </button>
            </div>

            <button type="button" className="course-modal-close" onClick={closeModal} aria-label="Close course form" disabled={isSaving}>
              X
            </button>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="course-modal-backdrop" role="presentation" onClick={closeDeleteModal}>
          <div
            className="course-modal panel-card course-delete-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="course-delete-icon" aria-hidden="true">
              <span>!</span>
            </div>
            <div className="course-modal-header">
              <div>
                <h3>Delete course</h3>
              </div>
            </div>

            <p className="course-delete-text">
              Are you sure you want to delete this course? This action cannot be undone.
            </p>

            <div className="course-form-actions">
              <button type="button" className="button button-ghost" onClick={closeDeleteModal} disabled={isDeleting}>
                Cancel
              </button>
              <button type="button" className="button button-solid course-delete-confirm" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="courses-layout">
        <article className="course-table-card">
          <div className="section-head compact">
            <div>
              <p className="section-kicker course-list-kicker">Course List</p>
          
            </div>
          </div>

          <div className="table-wrap">
            <table className="course-table">
              <thead>
                <tr>
                  <th>Course Name</th>
                  <th>Mode</th>
                  <th>Duration</th>
                  <th>Hours</th>
                  <th>Actual Fees</th>
                  <th>Registration Fees</th>
                  <th>Discount</th>
                  <th>After Discount</th>
                  <th>Installment 1</th>
                  <th>Installment 2</th>
                  <th>Installment 3</th>
                  
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="course-empty-state" colSpan="13">Loading courses...</td>
                  </tr>
                ) : loadError && !visibleCourses.length ? (
                  <tr>
                    <td className="course-empty-state" colSpan="13">{loadError}</td>
                  </tr>
                ) : visibleCourses.length ? (
                  visibleCourses.map((course) => (
                    <tr key={course.id || `${course.name}-${course.mode}`}>
                      <td><strong>{course.name}</strong></td>
                      <td>{course.mode}</td>
                      <td>{formatDuration(course.duration)}</td>
                      <td>{formatHours(course.hours)}</td>
                      <td>{course.actualFees}</td>
                      <td>{course.registrationFees}</td>
                      <td>{course.discount}</td>
                      <td>{course.afterDiscount}</td>
                      <td>{course.installment1}</td>
                      <td>{course.installment2}</td>
                      <td>{course.installment3 || '-'}</td>
                      
                      <td>
                        <StatusPill status={course.status} />
                      </td>
                      <td>
                        <div className="course-row-actions">
                          <button
                            type="button"
                            className="course-row-action course-row-edit"
                            onClick={() => openEditModal(course)}
                            aria-label={`Edit ${course.name || 'course'}`}
                            title="Edit"
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="course-row-action course-row-delete"
                            onClick={() => handleDelete(course.id)}
                            aria-label={`Delete ${course.name || 'course'}`}
                            title="Delete"
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="course-empty-state" colSpan="13">No courses found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="course-pagination">
            <button
              type="button"
              className="pagination-link"
              onClick={() => goToPage(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
            >
              <span aria-hidden="true">←</span>
              <span>Prev</span>
            </button>
            <div className="pagination-pages">
              {pageList.map((page, index) =>
                typeof page === 'number' ? (
                  <button
                    key={page}
                    type="button"
                    className={`pagination-page ${safeCurrentPage === page ? 'active' : ''}`}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={`${page}-${index}`} className="pagination-dots">...</span>
                )
              )}
            </div>
            <button
              type="button"
              className="pagination-link"
              onClick={() => goToPage(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
            >
              <span>Next</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}
