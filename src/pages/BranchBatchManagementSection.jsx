import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Plus, X, Trash2 } from 'lucide-react'
import {
  getNextBatchSequenceNumber,
  loadBranchBatchGroups,
  makeBatchId,
  subscribeBranchBatchGroups,
  upsertBranchBatchGroup,
} from '../lib/branchBatchStore'
import '../styles/BranchBatchManagementSection.css'

function normalizeText(value = '') {
  return String(value || '').trim()
}

function normalizeStatus(value = '') {
  const text = normalizeText(value)
  if (!text) return 'Active'
  const lower = text.toLowerCase()
  if (['active', 'open', 'full', 'inactive', 'closed'].includes(lower)) {
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }
  return text
}

function normalizeId(value = '') {
  return normalizeText(value).toLowerCase()
}

function toNumber(value = '') {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function formatClockLabel(value = '') {
  const text = normalizeText(value)
  if (!text) return ''

  const [hoursText, minutesText] = text.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText || '0')

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return text

  const period = hours >= 12 ? 'PM' : 'AM'
  const normalizedHours = hours % 12 || 12
  return `${String(normalizedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`
}

function getCourseLabel(course = {}) {
  return normalizeText(course?.name || course?.courseName || course?.courseCode || '')
}

function getFacultyLabel(faculty = {}) {
  return normalizeText(faculty?.name || faculty?.facultyName || faculty?.fullName || faculty?.facultyId || '')
}

function createBatchRow(batchId = '') {
  return {
    batchId,
    batchName: '',
    startTime: '',
    endTime: '',
    totalSeats: '',
    status: 'Active',
  }
}

function createInitialDraft(sequenceStart, count = 2) {
  const rowCount = Math.max(1, count)
  const rows = Array.from({ length: rowCount }, (_, index) => createBatchRow(makeBatchId(sequenceStart + index)))

  return {
    courseId: '',
    facultyId: '',
    rows,
    nextSequence: sequenceStart + rowCount,
  }
}

function buildBatchTiming(row = {}) {
  const startTime = normalizeText(row.startTime)
  const endTime = normalizeText(row.endTime)
  return `${startTime}${startTime && endTime ? ' - ' : ''}${endTime}`.trim()
}

function getBatchGroupStatus(group = {}) {
  return normalizeStatus(group?.status || group?.batches?.[0]?.status || 'Active')
}

export function BranchBatchManagementSection({
  branchId = '',
  branchCourses = [],
  branchFacultyRecords = [],
  facultyList = [],
}) {
  const [batchGroups, setBatchGroups] = useState(() => loadBranchBatchGroups(branchId))
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [detailGroup, setDetailGroup] = useState(null)
  const [draft, setDraft] = useState(() => createInitialDraft(getNextBatchSequenceNumber(loadBranchBatchGroups(branchId)), 2))
  const [searchTerm, setSearchTerm] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [facultyFilter, setFacultyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const syncGroups = () => {
      setBatchGroups(loadBranchBatchGroups(branchId))
    }

    syncGroups()
    return subscribeBranchBatchGroups(syncGroups)
  }, [branchId])

  const activeCourses = useMemo(() => {
    return (Array.isArray(branchCourses) ? branchCourses : [])
      .filter((course) => normalizeStatus(course?.status || '').toLowerCase() === 'active')
      .map((course) => ({
        id: normalizeText(course?.id || ''),
        name: getCourseLabel(course),
        assignedFaculty: Array.isArray(course?.assignedFaculty) ? course.assignedFaculty : [],
        code: normalizeText(course?.courseCode || ''),
      }))
      .filter((course) => course.id && course.name)
  }, [branchCourses])

  const activeFaculty = useMemo(() => {
    const source = Array.isArray(branchFacultyRecords) && branchFacultyRecords.length ? branchFacultyRecords : facultyList

    return source
      .map((faculty) => {
        const id = normalizeText(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || faculty?.userId || '')
        const name = getFacultyLabel(faculty)
        const status = normalizeStatus(faculty?.status || faculty?.recordStatus || 'Active')

        return {
          id,
          name,
          status,
        }
      })
      .filter((faculty) => faculty.id && faculty.name && faculty.status.toLowerCase() === 'active')
  }, [branchFacultyRecords, facultyList])

  const selectedCourse = useMemo(
    () => activeCourses.find((course) => course.id === draft.courseId) || null,
    [activeCourses, draft.courseId],
  )

  const mappedFacultyIds = useMemo(() => {
    const assignedFaculty = Array.isArray(selectedCourse?.assignedFaculty) ? selectedCourse.assignedFaculty : []
    return assignedFaculty
      .map((faculty) => normalizeText(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || faculty?.userId || ''))
      .filter(Boolean)
  }, [selectedCourse])

  const availableFacultyOptions = useMemo(() => {
    if (!mappedFacultyIds.length) return activeFaculty

    const allowed = new Set(mappedFacultyIds.map((id) => normalizeId(id)))
    const mappedOptions = activeFaculty.filter((faculty) => allowed.has(normalizeId(faculty.id)))
    const remainingOptions = activeFaculty.filter((faculty) => !allowed.has(normalizeId(faculty.id)))

    return [...mappedOptions, ...remainingOptions]
  }, [activeFaculty, mappedFacultyIds])

  const selectedFaculty = useMemo(
    () => availableFacultyOptions.find((faculty) => faculty.id === draft.facultyId) || activeFaculty.find((faculty) => faculty.id === draft.facultyId) || null,
    [activeFaculty, availableFacultyOptions, draft.facultyId],
  )

  const nextSequenceStart = useMemo(() => getNextBatchSequenceNumber(batchGroups), [batchGroups])

  const resetDraft = useCallback(() => {
    setCreateError('')
    setDraft(createInitialDraft(getNextBatchSequenceNumber(loadBranchBatchGroups(branchId)), 2))
  }, [branchId])

  const openCreateModal = useCallback(() => {
    const sequenceStart = getNextBatchSequenceNumber(loadBranchBatchGroups(branchId))
    setCreateError('')
    setDraft(createInitialDraft(sequenceStart, 2))
    setIsCreateOpen(true)
  }, [branchId])

  const closeCreateModal = useCallback(() => {
    if (isSaving) return
    setIsCreateOpen(false)
    resetDraft()
  }, [isSaving, resetDraft])

  const closeDetailModal = useCallback(() => {
    setDetailGroup(null)
  }, [])

  const handleDraftChange = useCallback((field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === 'courseId' ? { facultyId: '' } : {}),
    }))
  }, [])

  const handleRowChange = useCallback((index, field, value) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }))
  }, [])

  const handleAddRow = useCallback(() => {
    setDraft((current) => {
      const nextBatchId = makeBatchId(current.nextSequence)
      return {
        ...current,
        rows: [...current.rows, createBatchRow(nextBatchId)],
        nextSequence: current.nextSequence + 1,
      }
    })
  }, [])

  const handleRemoveRow = useCallback((index) => {
    setDraft((current) => {
      if (current.rows.length <= 1) return current
      return {
        ...current,
        rows: current.rows.filter((_, rowIndex) => rowIndex !== index),
      }
    })
  }, [])

  const handleSaveBatches = useCallback(
    (event) => {
      event.preventDefault()
      setCreateError('')

      if (!draft.courseId) {
        setCreateError('Please select a course.')
        return
      }

      if (!draft.facultyId) {
        setCreateError('Please select a faculty.')
        return
      }

      if (!draft.rows.length) {
        setCreateError('Please add at least one batch row.')
        return
      }

      const selectedCourseRecord = activeCourses.find((course) => course.id === draft.courseId) || null
      const selectedFacultyRecord = availableFacultyOptions.find((faculty) => faculty.id === draft.facultyId) || null

      try {
        setIsSaving(true)
        const cleanedRows = draft.rows.map((row, index) => {
          const batchName = normalizeText(row.batchName)
          const startTime = normalizeText(row.startTime)
          const endTime = normalizeText(row.endTime)
          const totalSeats = toNumber(row.totalSeats)
          const status = normalizeStatus(row.status || 'Active')

          if (!batchName || !startTime || !endTime || !totalSeats) {
            throw new Error(`Please complete batch row ${index + 1}.`)
          }

          return {
            id: row.batchId,
            batchId: row.batchId,
            batchName,
            startTime,
            endTime,
            batchTiming: buildBatchTiming({ startTime, endTime }),
            totalSeats,
            status,
          }
        })

        const primaryStatus = cleanedRows[0]?.status || 'Active'
        const record = {
          id: cleanedRows[0]?.batchId,
          batchGroupId: cleanedRows[0]?.batchId,
          batchId: cleanedRows[0]?.batchId,
          branchId,
          courseId: selectedCourseRecord?.id || '',
          courseName: selectedCourseRecord?.name || '',
          courseCode: selectedCourseRecord?.code || '',
          facultyId: selectedFacultyRecord?.id || '',
          facultyName: selectedFacultyRecord?.name || '',
          status: primaryStatus,
          batches: cleanedRows,
          batchCount: cleanedRows.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        upsertBranchBatchGroup(record)
        setBatchGroups(loadBranchBatchGroups(branchId))
        setIsCreateOpen(false)
        setDraft(createInitialDraft(getNextBatchSequenceNumber(loadBranchBatchGroups(branchId)), 2))
      } catch (error) {
        console.error('Failed to create batches:', error)
        setCreateError(error?.message || 'Unable to create batches right now.')
      } finally {
        setIsSaving(false)
      }
    },
    [activeCourses, availableFacultyOptions, branchId, draft.courseId, draft.facultyId, draft.rows],
  )

  const filteredGroups = useMemo(() => {
    const search = normalizeText(searchTerm).toLowerCase()

    return batchGroups
      .filter((group) => {
        if (courseFilter !== 'all' && normalizeText(group.courseId) !== courseFilter) return false
        if (facultyFilter !== 'all' && normalizeText(group.facultyId) !== facultyFilter) return false
        if (statusFilter !== 'all' && normalizeStatus(group.status).toLowerCase() !== statusFilter.toLowerCase()) return false
        if (!search) return true

        const haystack = [
          group.batchId,
          group.courseName,
          group.facultyName,
          group.status,
          ...(Array.isArray(group.batches) ? group.batches.flatMap((batch) => [batch.batchName, batch.batchTiming, batch.status]) : []),
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(search)
      })
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
  }, [batchGroups, courseFilter, facultyFilter, searchTerm, statusFilter])

  const summaryText = useMemo(() => {
    const totalGroups = batchGroups.length
    const totalRows = batchGroups.reduce((count, group) => count + Number(group.batchCount || 0), 0)
    return `${totalGroups} batch group${totalGroups === 1 ? '' : 's'} | ${totalRows} batch row${totalRows === 1 ? '' : 's'}`
  }, [batchGroups])

  const renderCreateModal = () => {
    if (!isCreateOpen || typeof document === 'undefined') return null

    return createPortal(
      <div className="branch-modal-backdrop batch-modal-backdrop" role="presentation" onClick={closeCreateModal}>
        <form
          className="course-modal panel-card batch-management-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-create-title"
          onClick={(event) => event.stopPropagation()}
          onSubmit={handleSaveBatches}
        >
          <button type="button" className="course-modal-close" onClick={closeCreateModal} aria-label="Close batch form">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <div className="course-modal-header batch-management-modal-header">
            <div>
              <p className="section-kicker">Batch Management</p>
              <h3 id="batch-create-title">Create Batch</h3>
              <p className="batch-management-modal-subtitle">
                Select one active course and faculty, then add multiple batch rows in a single submit.
              </p>
            </div>
          </div>

          <div className="batch-management-form-shell">
            <div className="batch-management-form-grid">
              <label className="batch-management-field">
                <span>Batch ID *</span>
                <input type="text" value={draft.rows[0]?.batchId || makeBatchId(nextSequenceStart)} readOnly />
                <small>Each row will auto-generate a unique batch ID.</small>
              </label>

              <label className="batch-management-field">
                <span>Course Name *</span>
                <select value={draft.courseId} onChange={(event) => handleDraftChange('courseId', event.target.value)}>
                  <option value="">Select Course</option>
                  {activeCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="batch-management-field">
                <span>Faculty Name *</span>
                <select value={draft.facultyId} onChange={(event) => handleDraftChange('facultyId', event.target.value)} disabled={!draft.courseId}>
                  <option value="">{draft.courseId ? 'Select Faculty' : 'Select Course first'}</option>
                  {availableFacultyOptions.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedCourse ? (
              <div className="batch-management-context">
                <strong>{selectedCourse.name}</strong>
                <span>{selectedFaculty ? `Faculty: ${selectedFaculty.name}` : 'Choose an active faculty. Mapped faculty appear first.'}</span>
              </div>
            ) : null}

            <div className="batch-management-details">
              <div className="batch-management-details-head">
                <div>
                  <h4>Batch Details</h4>
                  <p>Add one or more rows before submitting.</p>
                </div>
                <button type="button" className="button button-ghost batch-add-row-button" onClick={handleAddRow}>
                  <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                  Add Batch
                </button>
              </div>

              <div className="batch-management-details-grid">
                <div className="batch-management-details-grid-head">
                  <span>Batch Name</span>
                  <span>Batch Timing</span>
                  <span>Total Seats</span>
                  <span>Status</span>
                  <span />
                </div>

                {draft.rows.map((row, index) => (
                  <div key={row.batchId} className="batch-management-row">
                    <div className="batch-management-row-name">
                      <input
                        type="text"
                        placeholder="Morning Batch"
                        value={row.batchName}
                        onChange={(event) => handleRowChange(index, 'batchName', event.target.value)}
                      />
                      <small>ID: {row.batchId}</small>
                    </div>

                    <div className="batch-management-row-timing">
                      <input
                        type="time"
                        value={row.startTime}
                        onChange={(event) => handleRowChange(index, 'startTime', event.target.value)}
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={row.endTime}
                        onChange={(event) => handleRowChange(index, 'endTime', event.target.value)}
                      />
                    </div>

                    <input
                      className="batch-management-row-seats"
                      type="number"
                      min="1"
                      placeholder="20"
                      value={row.totalSeats}
                      onChange={(event) => handleRowChange(index, 'totalSeats', event.target.value)}
                    />

                    <select
                      className="batch-management-row-status"
                      value={row.status}
                      onChange={(event) => handleRowChange(index, 'status', event.target.value)}
                    >
                      <option value="Active">Active</option>
                      <option value="Open">Open</option>
                      <option value="Full">Full</option>
                      <option value="Closed">Closed</option>
                    </select>

                    <button
                      type="button"
                      className="batch-management-row-remove"
                      onClick={() => handleRemoveRow(index)}
                      disabled={draft.rows.length <= 1}
                      aria-label={`Remove batch row ${index + 1}`}
                    >
                      <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {createError ? <div className="batch-management-error" role="alert">{createError}</div> : null}

            <div className="batch-management-footer">
              <button type="button" className="button button-ghost" onClick={closeCreateModal} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="button button-solid" disabled={isSaving}>
                {isSaving ? 'Creating...' : 'Create Batches'}
              </button>
            </div>
          </div>
        </form>
      </div>,
      document.body,
    )
  }

  const renderDetailModal = () => {
    if (!detailGroup || typeof document === 'undefined') return null

    return createPortal(
      <div className="branch-modal-backdrop batch-modal-backdrop" role="presentation" onClick={closeDetailModal}>
        <section
          className="course-modal panel-card batch-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-detail-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className="course-modal-close" onClick={closeDetailModal} aria-label="Close batch details">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <div className="course-modal-header batch-management-modal-header">
            <div>
              <p className="section-kicker">Batch Details</p>
              <h3 id="batch-detail-title">{detailGroup.courseName || detailGroup.batchId}</h3>
              <p className="batch-management-modal-subtitle">
                Faculty: {detailGroup.facultyName || '-'}
              </p>
            </div>
          </div>

          <div className="batch-detail-summary">
            <div><span>Batch ID</span><strong>{detailGroup.batchId}</strong></div>
            <div><span>Course</span><strong>{detailGroup.courseName || '-'}</strong></div>
            <div><span>Faculty</span><strong>{detailGroup.facultyName || '-'}</strong></div>
            <div><span>Total Batches</span><strong>{detailGroup.batchCount || detailGroup.batches?.length || 0}</strong></div>
          </div>

          <div className="batch-detail-list">
            {(Array.isArray(detailGroup.batches) ? detailGroup.batches : []).map((batch) => (
              <article key={batch.batchId} className="batch-detail-card">
                <div className="batch-detail-card-head">
                  <strong>{batch.batchName || batch.batchId}</strong>
                  <span>{batch.batchId}</span>
                </div>
                <div className="batch-detail-card-grid">
                  <div>
                    <span>Timing</span>
                    <strong>
                      {formatClockLabel(batch.startTime)} - {formatClockLabel(batch.endTime)}
                    </strong>
                  </div>
                  <div>
                    <span>Seats</span>
                    <strong>{batch.totalSeats}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{normalizeStatus(batch.status)}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>,
      document.body,
    )
  }

  return (
    <section className="branch-dashboard-section batch-management-section">
      <div className="branch-dashboard-section-heading">
        <div className="branch-dashboard-section-heading-copy">
          <h2>Batch Management</h2>
          <p>{summaryText}</p>
        </div>
        <div className="branch-dashboard-section-heading-actions">
          <button type="button" className="button button-solid" onClick={openCreateModal}>
            <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
            Create Batch
          </button>
        </div>
      </div>

      <div className="batch-management-toolbar">
        <input
          type="search"
          className="batch-management-search"
          placeholder="Search batch, course, faculty"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
          <option value="all">Course</option>
          {activeCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>

        <select value={facultyFilter} onChange={(event) => setFacultyFilter(event.target.value)}>
          <option value="all">Faculty</option>
          {(Array.isArray(branchFacultyRecords) && branchFacultyRecords.length ? branchFacultyRecords : facultyList)
            .map((faculty) => ({
              id: normalizeText(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || faculty?.userId || ''),
              name: getFacultyLabel(faculty),
              status: normalizeStatus(faculty?.status || faculty?.recordStatus || 'Active'),
            }))
            .filter((faculty) => faculty.id && faculty.name && faculty.status.toLowerCase() === 'active')
            .map((faculty) => (
              <option key={faculty.id} value={faculty.id}>
                {faculty.name}
              </option>
            ))}
        </select>

        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Status</option>
          <option value="active">Active</option>
          <option value="open">Open</option>
          <option value="full">Full</option>
          <option value="closed">Closed</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="branch-dashboard-table-shell batch-management-table-shell">
        <table className="branch-dashboard-table batch-management-table">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Course Name</th>
              <th>Faculty Name</th>
              <th>Batch Count</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.length ? (
              filteredGroups.map((group) => (
                <tr key={group.id || group.batchId}>
                  <td>{group.batchId}</td>
                  <td>{group.courseName || '-'}</td>
                  <td>{group.facultyName || '-'}</td>
                  <td>
                    <button type="button" className="batch-management-count-button" onClick={() => setDetailGroup(group)}>
                      {group.batchCount || (Array.isArray(group.batches) ? group.batches.length : 0)}
                      <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </td>
                  <td>
                    <span className={`batch-management-status-pill ${normalizeStatus(group.status).toLowerCase()}`.trim()}>
                      {getBatchGroupStatus(group)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="branch-course-empty-state">
                  No batches created yet. Use Create Batch to add the first group.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {renderCreateModal()}
      {renderDetailModal()}
    </section>
  )
}
