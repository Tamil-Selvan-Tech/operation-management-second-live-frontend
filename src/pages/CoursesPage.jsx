import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createCourse,
  deleteCourse,
  listCourses,
  normalizeCourseList,
  updateCourse,
} from '../services/courseService'

function Field({ label, hint, children, required = false }) {
  return (
    <label className="course-field">
      <span>
        {label}
        {required ? <b>*</b> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
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
    installment1: '',
    installment2: '',
    installment3: '',
    status: '',
  })
  const [touched, setTouched] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const requestIdRef = useRef(0)

  const pageSize = 5

  const afterDiscount = useMemo(() => {
    const actualFees = Number(form.actualFees || 0)
    const discount = Number(form.discount || 0)
    if (Number.isNaN(actualFees) || Number.isNaN(discount)) return ''
    return String(Math.max(actualFees - discount, 0))
  }, [form.actualFees, form.discount])

  const validationError = useMemo(() => {
    if (!form.name.trim() || !form.mode || !form.duration || !form.hours || !form.actualFees || !form.registrationFees || !form.discount || !form.installmentCount || !form.installment1 || !form.installment2 || !form.status) {
      return 'Please fill all required fields before saving.'
    }

    if (form.installmentCount === '3' && !form.installment3) {
      return 'Please fill Installment 3 before saving.'
    }

    if (Number(form.discount) > Number(form.actualFees)) {
      return 'Discount cannot be greater than actual fees.'
    }

    if (Number(form.duration) <= 0) {
      return 'Duration must be greater than zero.'
    }

    if (Number(form.hours) <= 0) {
      return 'Hours must be greater than zero.'
    }

    const discountedFee = Number(form.actualFees) - Number(form.discount)
    const installmentTotal =
      Number(form.installment1 || 0) +
      Number(form.installment2 || 0) +
      (form.installmentCount === '3' ? Number(form.installment3 || 0) : 0)

    if (installmentTotal !== discountedFee) {
      return `Installment totals must match the discounted fee. Current total is ${installmentTotal}, expected ${discountedFee}.`
    }

    return ''
  }, [form])

  const totalPages = pagination.totalPages || 1
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const visibleCourses = courses

  const loadCourses = useCallback(
    async ({ page = currentPage, search = searchTerm, filter = activeFilter } = {}) => {
      const requestId = ++requestIdRef.current
      const params = {
        page,
        limit: pageSize,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }

      const trimmedSearch = search.trim()
      if (trimmedSearch) {
        params.search = trimmedSearch
      }

      if (filter === 'Active' || filter === 'Inactive') {
        params.status = filter
      } else if (filter === 'Online' || filter === 'Offline') {
        params.mode = filter
      }

      setIsLoading(true)
      setLoadError('')

      try {
        const result = await listCourses(params)
        if (requestId !== requestIdRef.current) return
        const nextCourses = normalizeCourseList(result.data)
        const nextMeta = result.meta || {
          page,
          limit: pageSize,
          total: nextCourses.length,
          totalPages: 1,
        }

        setCourses(nextCourses)
        setPagination({
          page: nextMeta.page || page,
          limit: nextMeta.limit || pageSize,
          total: nextMeta.total || nextCourses.length,
          totalPages: nextMeta.totalPages || 1,
        })

        if (page > (nextMeta.totalPages || 1) && (nextMeta.total || 0) > 0) {
          setCurrentPage(nextMeta.totalPages || 1)
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        setCourses([])
        setPagination({
          page,
          limit: pageSize,
          total: 0,
          totalPages: 1,
        })
        setLoadError(error?.body?.message || error?.message || 'Unable to load courses right now.')
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [activeFilter, currentPage, pageSize, searchTerm],
  )

  useEffect(() => {
    const run = async () => {
      await loadCourses({ page: currentPage, search: searchTerm, filter: activeFilter })
    }

    void run()
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
      installment1: '',
      installment2: '',
      installment3: '',
      status: '',
    })
    setTouched(false)
    setSaveError('')
    setEditingCourseId(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (course) => {
    setEditingCourseId(course.id)
    setTouched(false)
    setSaveError('')
    setForm({
      name: course.name || '',
      mode: course.mode || '',
      duration: course.duration ?? '',
      hours: course.hours ?? '',
      actualFees: course.actualFees ?? '',
      registrationFees: course.registrationFees ?? '',
      discount: course.discount ?? '',
      installmentCount: String(course.installmentCount ?? '2'),
      installment1: course.installment1 ?? '',
      installment2: course.installment2 ?? '',
      installment3: course.installment3 ?? '',
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

  const isValid = !validationError

  const handleSave = async (event) => {
    event?.preventDefault()
    setTouched(true)
    if (!isValid) {
      setSaveError(validationError)
      return
    }

    setSaveError('')
    setIsSaving(true)

    const payload = {
      name: form.name.trim(),
      mode: form.mode,
      duration: form.duration,
      hours: form.hours,
      actualFees: form.actualFees,
      registrationFees: form.registrationFees,
      discount: form.discount,
      installmentCount: form.installmentCount,
      installment1: form.installment1,
      installment2: form.installment2,
      installment3: form.installmentCount === '3' ? form.installment3 : null,
      status: form.status,
    }

    try {
      const nextPage = editingCourseId ? currentPage : 1
      if (editingCourseId) {
        await updateCourse(editingCourseId, payload)
      } else {
        await createCourse(payload)
      }

      setCurrentPage(nextPage)
      if (editingCourseId || currentPage === 1) {
        await loadCourses({ page: nextPage, search: searchTerm, filter: activeFilter })
      }
      closeModal()
    } catch (error) {
      setSaveError(error?.body?.message || error?.message || 'Unable to save course right now.')
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
      setLoadError(error?.body?.message || error?.message || 'Unable to delete course right now.')
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
        <div className="course-modal-backdrop" role="presentation" onClick={closeModal}>
          <form className="course-modal panel-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onSubmit={handleSave}>
            <div className="course-modal-header">
              <div>
                <p className="section-kicker">Course Entry</p>
                <h3>{editingCourseId ? 'Edit Course' : 'Add Course'}</h3>
              </div>
              <span className="detail-badge">Required fields marked *</span>
            </div>

            <div className="course-form-grid">
              <Field label="Course Name" required hint="Required field">
                <input
                  type="text"
                  placeholder="Enter course name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </Field>

              <Field label="Mode" required hint="Online / Offline / Hybrid">
                <select value={form.mode} onChange={(event) => updateField('mode', event.target.value)}>
                  <option value="" disabled>
                    Select mode
                  </option>
                  <option>Online</option>
                  <option>Offline</option>
                  <option>Hybrid</option>
                </select>
              </Field>

              <Field label="Duration (Months)" required hint="Numbers only">
                <div className="course-input-with-suffix">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="6"
                    value={form.duration}
                    onChange={(event) => updateNumericField('duration', event.target.value)}
                  />
                  <span>{Number(form.duration) === 1 ? 'month' : 'months'}</span>
                </div>
              </Field>

              <Field label="Hours" required hint="Numbers only">
                <div className="course-input-with-suffix">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="180"
                    value={form.hours}
                    onChange={(event) => updateNumericField('hours', event.target.value)}
                  />
                  <span>{Number(form.hours) === 1 ? 'hour' : 'hours'}</span>
                </div>
              </Field>

              <Field label="Actual Fees" required hint="Numbers only">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="24000"
                  value={form.actualFees}
                  onChange={(event) => updateNumericField('actualFees', event.target.value)}
                />
              </Field>

              <Field label="Registration Fees" required hint="Numbers only">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="500"
                  value={form.registrationFees}
                  onChange={(event) => updateNumericField('registrationFees', event.target.value)}
                />
              </Field>

              <Field label="Discount" required hint="Must be less than or equal to actual fees">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="2000"
                  value={form.discount}
                  onChange={(event) => updateNumericField('discount', event.target.value)}
                />
              </Field>

              <Field label="After Discount (Auto Calculate)" hint="Auto calculated from actual fees and discount">
                <input type="text" value={afterDiscount} readOnly />
              </Field>

              <Field label="Installment Count" required hint="Choose 2 for basic courses or 3 for special courses">
                <select value={form.installmentCount} onChange={(event) => updateField('installmentCount', event.target.value)}>
                  <option value="2">2 Installments</option>
                  <option value="3">3 Installments</option>
                </select>
              </Field>

              <Field label="Installment 1" required hint="Numbers only">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="11000"
                  value={form.installment1}
                  onChange={(event) => updateNumericField('installment1', event.target.value)}
                />
              </Field>

              <Field label="Installment 2" required hint="Numbers only">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="11000"
                  value={form.installment2}
                  onChange={(event) => updateNumericField('installment2', event.target.value)}
                />
              </Field>

              {form.installmentCount === '3' ? (
                <Field label="Installment 3" required hint="Numbers only">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="5500"
                    value={form.installment3}
                    onChange={(event) => updateNumericField('installment3', event.target.value)}
                  />
                </Field>
              ) : null}

              <Field label="Status" required hint="Active or Inactive">
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  <option value="" disabled>
                    Select status
                  </option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </Field>
            </div>

            {touched && !isValid ? (
              <div className="course-validation-note course-validation-error">
                {saveError || 'Please fill all required fields before saving.'}
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
        <article className="panel-card course-table-card">
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
