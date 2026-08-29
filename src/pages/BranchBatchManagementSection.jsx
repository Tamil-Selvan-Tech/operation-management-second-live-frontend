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

  const amPmMatch = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (amPmMatch) {
    const hours = Number(amPmMatch[1])
    const minutes = Number(amPmMatch[2])
    const period = String(amPmMatch[3] || '').toUpperCase()

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return text

    const convertedHours =
      period === 'PM'
        ? (hours === 12 ? 12 : hours + 12)
        : (hours === 12 ? 0 : hours)

    const displayHours = convertedHours % 12 || 12
    const displayPeriod = convertedHours >= 12 ? 'PM' : 'AM'
    return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${displayPeriod}`
  }

  const [hoursText, minutesText] = text.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText || '0')

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return text

  const period = hours >= 12 ? 'PM' : 'AM'
  const normalizedHours = hours % 12 || 12
  return `${String(normalizedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`
}

function convertTimeTo24Hour(value = '', meridiem = 'AM') {
  const text = normalizeText(value)
  const match = text.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return text

  let hours = Number(match[1])
  const minutes = String(match[2]).padStart(2, '0')
  const period = String(meridiem || 'AM').toUpperCase()

  if (!Number.isFinite(hours)) return text

  if (period === 'AM') {
    if (hours === 12) hours = 0
  } else if (period === 'PM') {
    if (hours < 12) hours += 12
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`
}

function formatTimeInput(value = '') {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4)
  if (!digits) return ''
  if (digits.length === 1) return `0${digits}`
  if (digits.length === 2) return `${digits}:00`
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
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
    startPeriod: 'AM',
    endTime: '',
    endPeriod: 'AM',
    totalSeats: '',
    status: 'Active',
  }
}

function createInitialDraft(sequenceStart, count = 1) {
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
  const [fieldErrors, setFieldErrors] = useState({
    courseId: '',
    facultyId: '',
    rows: [],
  })
  const [detailGroup, setDetailGroup] = useState(null)
  const [deleteRowTarget, setDeleteRowTarget] = useState(null)
  const [draft, setDraft] = useState(() => createInitialDraft(getNextBatchSequenceNumber(loadBranchBatchGroups(branchId)), 1))
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

  const nextSequenceStart = useMemo(() => getNextBatchSequenceNumber(batchGroups), [batchGroups])

  const resetDraft = useCallback(() => {
    setCreateError('')
    setFieldErrors({ courseId: '', facultyId: '', rows: [] })
    setDraft(createInitialDraft(getNextBatchSequenceNumber(loadBranchBatchGroups(branchId)), 1))
  }, [branchId])

  const openCreateModal = useCallback(() => {
    const sequenceStart = getNextBatchSequenceNumber(loadBranchBatchGroups(branchId))
    setCreateError('')
    setFieldErrors({ courseId: '', facultyId: '', rows: [] })
    setDraft(createInitialDraft(sequenceStart, 1))
    setIsCreateOpen(true)
  }, [branchId])

  const closeCreateModal = useCallback(() => {
    if (isSaving) return
    setIsCreateOpen(false)
    setDeleteRowTarget(null)
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
    if (field === 'courseId') {
      setFieldErrors((current) => ({
        ...current,
        courseId: '',
        facultyId: '',
      }))
    }
    if (field === 'facultyId') {
      setFieldErrors((current) => ({
        ...current,
        facultyId: '',
      }))
    }
  }, [])

  const handleRowChange = useCallback((index, field, value) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row

        if (field === 'startTime' || field === 'endTime') {
          return { ...row, [field]: formatTimeInput(value) }
        }

        return { ...row, [field]: value }
      }),
    }))
    setFieldErrors((current) => ({
      ...current,
      rows: current.rows.map((rowErrors, rowIndex) => {
        if (rowIndex !== index) return rowErrors
        return {
          ...rowErrors,
          ...(field === 'batchName' ? { batchName: '' } : {}),
          ...(field === 'startTime' || field === 'endTime' || field === 'startPeriod' || field === 'endPeriod' ? { timing: '' } : {}),
          ...(field === 'totalSeats' ? { totalSeats: '' } : {}),
          ...(field === 'status' ? { status: '' } : {}),
        }
      }),
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
    setFieldErrors((current) => ({
      ...current,
      rows: [...current.rows, { batchName: '', timing: '', totalSeats: '', status: '' }],
    }))
  }, [])

  const handleRemoveRow = useCallback((index) => {
    setDeleteRowTarget({ index, row: draft.rows[index] || null })
  }, [draft.rows])

  const confirmDeleteRow = useCallback(() => {
    if (!deleteRowTarget) return

    setDraft((current) => {
      return {
        ...current,
        rows: current.rows.filter((_, rowIndex) => rowIndex !== deleteRowTarget.index),
      }
    })
    setFieldErrors((current) => ({
      ...current,
      rows: current.rows.filter((_, rowIndex) => rowIndex !== deleteRowTarget.index),
    }))

    setDeleteRowTarget(null)
  }, [deleteRowTarget])

  const cancelDeleteRow = useCallback(() => {
    setDeleteRowTarget(null)
  }, [])

  const handleSaveBatches = useCallback(
    (event) => {
      event.preventDefault()
      setCreateError('')

      const nextErrors = {
        courseId: draft.courseId ? '' : 'This field is required',
        facultyId: draft.facultyId ? '' : 'This field is required',
        rows: draft.rows.map(() => ({
          batchName: '',
          timing: '',
          totalSeats: '',
          status: '',
        })),
      }

      if (!draft.rows.length) {
        setCreateError('Please add at least one batch row.')
        setFieldErrors(nextErrors)
        return
      }

      draft.rows.forEach((row, index) => {
        if (!normalizeText(row.batchName)) nextErrors.rows[index].batchName = 'This field is required'
        if (!normalizeText(row.startTime) || !normalizeText(row.endTime)) nextErrors.rows[index].timing = 'This field is required'
        if (!toNumber(row.totalSeats)) nextErrors.rows[index].totalSeats = 'This field is required'
        if (!normalizeText(row.status)) nextErrors.rows[index].status = 'This field is required'
      })

      const hasFieldErrors =
        Boolean(nextErrors.courseId) ||
        Boolean(nextErrors.facultyId) ||
        nextErrors.rows.some((rowErrors) =>
          Boolean(rowErrors.batchName || rowErrors.timing || rowErrors.totalSeats || rowErrors.status),
        )

      if (hasFieldErrors) {
        setFieldErrors(nextErrors)
        return
      }

      setFieldErrors(nextErrors)

      const selectedCourseRecord = activeCourses.find((course) => course.id === draft.courseId) || null
      const selectedFacultyRecord = availableFacultyOptions.find((faculty) => faculty.id === draft.facultyId) || null

      try {
        setIsSaving(true)
        setFieldErrors(nextErrors)
        const cleanedRows = draft.rows.map((row, index) => {
          const batchName = normalizeText(row.batchName)
          const startTime = normalizeText(row.startTime)
          const endTime = normalizeText(row.endTime)
          const startPeriod = normalizeText(row.startPeriod || 'AM').toUpperCase()
          const endPeriod = normalizeText(row.endPeriod || 'AM').toUpperCase()
          const totalSeats = toNumber(row.totalSeats)
          const status = normalizeStatus(row.status || 'Active')

          if (!batchName || !startTime || !endTime || !totalSeats) {
            throw new Error(`Please complete batch row ${index + 1}.`)
          }

          return {
            id: row.batchId,
            batchId: row.batchId,
            batchName,
            startTime: convertTimeTo24Hour(startTime, startPeriod),
            endTime: convertTimeTo24Hour(endTime, endPeriod),
            batchTiming: buildBatchTiming({
              startTime: formatClockLabel(`${startTime} ${startPeriod}`),
              endTime: formatClockLabel(`${endTime} ${endPeriod}`),
            }),
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
        setFieldErrors({ courseId: '', facultyId: '', rows: [] })
        setDraft(createInitialDraft(getNextBatchSequenceNumber(loadBranchBatchGroups(branchId)), 1))
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
      <div className="branch-modal-backdrop batch-modal-backdrop" role="presentation">
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
                {fieldErrors.courseId ? <small className="batch-management-field-error">{fieldErrors.courseId}</small> : null}
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
                {fieldErrors.facultyId ? <small className="batch-management-field-error">{fieldErrors.facultyId}</small> : null}
              </label>
            </div>

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
                      {fieldErrors.rows[index]?.batchName ? (
                        <small className="batch-management-field-error">{fieldErrors.rows[index].batchName}</small>
                      ) : null}
                    </div>

                    <div className="batch-management-row-timing">
                      <div className="batch-management-time-group">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="09:00"
                          value={row.startTime}
                          onChange={(event) => handleRowChange(index, 'startTime', event.target.value)}
                        />
                        <select value={row.startPeriod} onChange={(event) => handleRowChange(index, 'startPeriod', event.target.value)}>
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                      <span>-</span>
                      <div className="batch-management-time-group">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="11:00"
                          value={row.endTime}
                          onChange={(event) => handleRowChange(index, 'endTime', event.target.value)}
                        />
                        <select value={row.endPeriod} onChange={(event) => handleRowChange(index, 'endPeriod', event.target.value)}>
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                      {fieldErrors.rows[index]?.timing ? (
                        <small className="batch-management-row-error">{fieldErrors.rows[index].timing}</small>
                      ) : null}
                    </div>

                    <div className="batch-management-row-seats-wrap">
                      <input
                        className="batch-management-row-seats"
                        type="number"
                        min="1"
                        placeholder="20"
                        value={row.totalSeats}
                        onChange={(event) => handleRowChange(index, 'totalSeats', event.target.value)}
                      />
                      {fieldErrors.rows[index]?.totalSeats ? (
                        <small className="batch-management-field-error">{fieldErrors.rows[index].totalSeats}</small>
                      ) : null}
                    </div>

                    <div className="batch-management-row-status-wrap">
                      <select
                        className="batch-management-row-status"
                        value={row.status}
                        onChange={(event) => handleRowChange(index, 'status', event.target.value)}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                      {fieldErrors.rows[index]?.status ? (
                        <small className="batch-management-field-error">{fieldErrors.rows[index].status}</small>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="batch-management-row-remove"
                      onClick={() => handleRemoveRow(index)}
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
              <button type="button" className="button button-ghost" disabled={isSaving}>
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

  const renderDeleteConfirmModal = () => {
    if (!deleteRowTarget || typeof document === 'undefined') return null

    const targetRow = deleteRowTarget.row || {}

    return createPortal(
      <div className="branch-modal-backdrop batch-modal-backdrop" role="presentation">
        <div
          className="course-modal panel-card batch-delete-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-delete-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className="course-modal-close batch-delete-close" onClick={cancelDeleteRow} aria-label="Close delete confirmation">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <div className="batch-delete-confirm-head">
            <p className="batch-delete-confirm-kicker">DELETE BATCH</p>
            <h3 id="batch-delete-title">Are you sure you want to delete this batch row?</h3>
            <p className="batch-delete-confirm-subtitle">
              {targetRow.batchName || targetRow.batchId
                ? `${targetRow.batchName || targetRow.batchId} will be removed from this form.`
                : 'This batch row will be removed from this form.'}
            </p>
          </div>

          <div className="batch-delete-confirm-divider" />

          <div className="batch-delete-confirm-actions">
            <button type="button" className="button button-ghost" onClick={cancelDeleteRow}>
              Cancel
            </button>
            <button type="button" className="button button-solid is-danger" onClick={confirmDeleteRow}>
              Delete
            </button>
          </div>
        </div>
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
      {renderDeleteConfirmModal()}
      {renderDetailModal()}
    </section>
  )
}
