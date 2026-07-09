import { useEffect, useMemo, useState } from 'react'

const seedCourses = []
const COURSES_STORAGE_KEY = 'courses-page-courses'

function createCourseId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeCourse(course) {
  return {
    ...course,
    id: course.id || createCourseId(),
    installmentCount: course.installmentCount || '2',
    installment3: course.installment3 || '',
  }
}

function normalizeCourseList(courses) {
  return Array.isArray(courses) ? courses.map(normalizeCourse) : seedCourses
}

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
  const [courses, setCourses] = useState(() => {
    if (typeof window === 'undefined') return seedCourses

    try {
      const storedCourses = window.localStorage.getItem(COURSES_STORAGE_KEY)
      if (!storedCourses) return seedCourses

      const parsedCourses = JSON.parse(storedCourses)
      return normalizeCourseList(parsedCourses)
    } catch {
      return seedCourses
    }
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses.map(normalizeCourse)))
  }, [courses])

  const afterDiscount = useMemo(() => {
    const actualFees = Number(form.actualFees || 0)
    const discount = Number(form.discount || 0)
    if (Number.isNaN(actualFees) || Number.isNaN(discount)) return ''
    return String(Math.max(actualFees - discount, 0))
  }, [form.actualFees, form.discount])

  const filteredCourses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return courses.filter((course) => {
      const matchesSearch =
        !query ||
        [course.name, course.mode, course.duration, course.hours, course.status, course.afterDiscount]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))

      const matchesFilter =
        activeFilter === 'All' ||
        course.status === activeFilter ||
        course.mode === activeFilter

      return matchesSearch && matchesFilter
    })
  }, [courses, searchTerm, activeFilter])

  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const visibleCourses = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize
    return filteredCourses.slice(startIndex, startIndex + pageSize)
  }, [filteredCourses, safeCurrentPage])

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
      duration: course.duration || '',
      hours: course.hours || '',
      actualFees: course.actualFees || '',
      registrationFees: course.registrationFees || '',
      discount: course.discount || '',
      installmentCount: course.installmentCount || '2',
      installment1: course.installment1 || '',
      installment2: course.installment2 || '',
      installment3: course.installment3 || '',
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

  const isValid =
    form.name.trim() &&
    form.mode &&
    form.duration &&
    form.hours &&
    form.actualFees &&
    form.registrationFees &&
    form.discount &&
    form.installmentCount &&
    form.installment1 &&
    form.installment2 &&
    (form.installmentCount === '2' || form.installment3) &&
    form.status &&
    Number(form.discount) <= Number(form.actualFees) &&
    Number(form.duration) > 0 &&
    Number(form.hours) > 0

  const handleSave = (event) => {
    event?.preventDefault()
    setTouched(true)
    if (!isValid) {
      setSaveError('Please fill all required fields before saving.')
      return
    }

    setSaveError('')

    const nextCourse = {
      id: editingCourseId || createCourseId(),
      name: form.name.trim(),
      mode: form.mode,
      duration: form.duration,
      hours: form.hours,
      actualFees: form.actualFees,
      registrationFees: form.registrationFees,
      discount: form.discount,
      afterDiscount,
      installmentCount: form.installmentCount,
      installment1: form.installment1,
      installment2: form.installment2,
      installment3: form.installmentCount === '3' ? form.installment3 : '',
      status: form.status,
    }

    setCourses((current) => {
      if (editingCourseId) {
        return current.map((course) => (course.id === editingCourseId ? nextCourse : course))
      }

      return [nextCourse, ...current]
    })
    closeModal()
    setCurrentPage(1)
  }

  const handleDelete = (courseId) => {
    setDeleteTarget(courses.find((course) => course.id === courseId) || null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setCourses((current) => current.filter((course) => course.id !== deleteTarget.id))

    if (editingCourseId === deleteTarget.id) {
      closeModal()
    }

    closeDeleteModal()
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
              <button type="button" className="button button-ghost" onClick={resetForm}>
                Reset
              </button>
              <button type="submit" className="button button-solid">
                {editingCourseId ? 'Update Course' : 'Save Course'}
              </button>
            </div>

            <button type="button" className="course-modal-close" onClick={closeModal} aria-label="Close course form">
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
              <button type="button" className="button button-ghost" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button type="button" className="button button-solid course-delete-confirm" onClick={confirmDelete}>
                Delete
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
                {visibleCourses.length ? (
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
                    <td className="course-empty-state" colSpan="14">No courses found.</td>
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
