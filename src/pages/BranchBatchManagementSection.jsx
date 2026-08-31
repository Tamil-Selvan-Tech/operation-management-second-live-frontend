import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { PaginationBar } from '../components/PaginationBar'
import {
  createBranchBatch,
  deleteBranchBatch,
  listBranchBatches,
  updateBranchBatch,
} from '../services/branchBatchService'
import {
  loadBranchBatchGroups,
  saveBranchBatchGroups,
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
  const normalized = formatTimeInput(text)
  const match = normalized.match(/^(\d{2}):(\d{2})$/)
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
  if (digits.length === 1) return `0${digits}:00`
  if (digits.length === 2) return `${digits}:00`
  if (digits.length === 3) return `0${digits.slice(0, 1)}:${digits.slice(1)}`
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
}

function parseStoredTimeParts(value = '') {
  const text = normalizeText(value)
  if (!text) {
    return { time: '', period: 'AM' }
  }

  const withPeriodMatch = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (withPeriodMatch) {
    let hours = Number(withPeriodMatch[1])
    const minutes = String(withPeriodMatch[2]).padStart(2, '0')
    const period = String(withPeriodMatch[3] || 'AM').toUpperCase()

    if (!Number.isFinite(hours)) {
      return { time: '', period }
    }

    if (period === 'AM') {
      if (hours === 12) hours = 0
    } else if (hours < 12) {
      hours += 12
    }

    return {
      time: `${String(hours % 12 || 12).padStart(2, '0')}:${minutes}`,
      period: hours >= 12 ? 'PM' : 'AM',
    }
  }

  const clockMatch = text.match(/^(\d{1,2}):(\d{2})$/)
  if (!clockMatch) {
    return { time: '', period: 'AM' }
  }

  const hours = Number(clockMatch[1])
  const minutes = String(clockMatch[2]).padStart(2, '0')

  if (!Number.isFinite(hours)) {
    return { time: '', period: 'AM' }
  }

  return {
    time: `${String(hours % 12 || 12).padStart(2, '0')}:${minutes}`,
    period: hours >= 12 ? 'PM' : 'AM',
  }
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

function makeBatchId(sequenceNumber = 1) {
  const safeSequence = Math.max(1, Number(sequenceNumber) || 1)
  return `BAT-${String(safeSequence).padStart(3, '0')}`
}

function makeBatchGroupId(sequenceNumber = 1) {
  const safeSequence = Math.max(1, Number(sequenceNumber) || 1)
  return `BBG-${String(safeSequence).padStart(3, '0')}`
}

function getNextBatchSequenceNumber(groups = []) {
  let maxSequence = 0

  const rows = Array.isArray(groups) ? groups.flatMap((group) => {
    if (Array.isArray(group?.batches) && group.batches.length) {
      return group.batches
    }
    return group ? [group] : []
  }) : []

  rows.forEach((row) => {
    const match = String(row?.batchId || '').trim().match(/^BAT-(\d+)$/i)
    if (!match) return
    const value = Number(match[1])
    if (Number.isInteger(value) && value > maxSequence) {
      maxSequence = value
    }
  })

  return maxSequence + 1
}

function getNextBatchGroupSequenceNumber(groups = []) {
  let maxSequence = 0

  const items = Array.isArray(groups) ? groups : []
  items.forEach((group) => {
    const match = String(group?.batchGroupId || group?.id || '').trim().match(/^BBG-(\d+)$/i)
    if (!match) return
    const value = Number(match[1])
    if (Number.isInteger(value) && value > maxSequence) {
      maxSequence = value
    }
  })

  return maxSequence + 1
}

function createInitialDraft(sequenceStart, groupSequence = 1, count = 1) {
  const rowCount = Math.max(1, count)
  const rows = Array.from({ length: rowCount }, (_, index) => createBatchRow(makeBatchId(sequenceStart + index)))

  return {
    batchGroupId: makeBatchGroupId(groupSequence),
    courseId: '',
    facultyId: '',
    rows,
    nextSequence: sequenceStart + rowCount,
  }
}

function createDraftFromGroup(group = {}, sequenceStart = 1, groupSequence = 1) {
  const batches = Array.isArray(group.batches) ? group.batches : []
  const rows = batches.length
    ? batches.map((batch, index) => {
        const startParts = parseStoredTimeParts(`${batch.startTime || ''} ${batch.startPeriod || ''}`.trim())
        const endParts = parseStoredTimeParts(`${batch.endTime || ''} ${batch.endPeriod || ''}`.trim())

        return {
          batchId: normalizeText(batch.batchId || makeBatchId(sequenceStart + index)),
          batchName: normalizeText(batch.batchName || ''),
          startTime: startParts.time,
          startPeriod: startParts.period,
          endTime: endParts.time,
          endPeriod: endParts.period,
          totalSeats: normalizeText(batch.totalSeats || ''),
          status: normalizeStatus(batch.status || 'Active'),
        }
      })
    : [createBatchRow(makeBatchId(sequenceStart))]

  return {
    batchGroupId: normalizeText(group.batchGroupId || makeBatchGroupId(groupSequence)),
    courseId: normalizeText(group.courseId || ''),
    facultyId: normalizeText(group.facultyId || ''),
    rows,
    nextSequence: Math.max(sequenceStart, getNextBatchSequenceNumber([group])),
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
  const [batchGroups, setBatchGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({
    courseId: '',
    facultyId: '',
    rows: [],
  })
  const [detailGroup, setDetailGroup] = useState(null)
  const [editingGroup, setEditingGroup] = useState(null)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState(null)
  const [deleteRowTarget, setDeleteRowTarget] = useState(null)
  const [draft, setDraft] = useState(() => createInitialDraft(1, 1))
  const [searchTerm, setSearchTerm] = useState('')
  const [batchTablePage, setBatchTablePage] = useState(1)
  const [actionMenuOpenId, setActionMenuOpenId] = useState('')
  const [actionMenuPosition, setActionMenuPosition] = useState(null)
  const [saveSuccessPopup, setSaveSuccessPopup] = useState(null)

  const refreshBatchGroups = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await listBranchBatches()
      const backendGroups = Array.isArray(result?.data) ? result.data : []
      const localGroups = loadBranchBatchGroups(branchId)
      const mergedGroups = [
        ...backendGroups,
        ...localGroups.filter((localGroup) => {
          const localKey = String(localGroup?.id || localGroup?.batchGroupId || localGroup?.batchId || '').trim()
          if (!localKey) return true

          return !backendGroups.some((backendGroup) => {
            const backendKey = String(backendGroup?.id || backendGroup?.batchGroupId || backendGroup?.batchId || '').trim()
            return backendKey === localKey
          })
        }),
      ]

      saveBranchBatchGroups(mergedGroups)
      setBatchGroups(mergedGroups)
      return mergedGroups
    } catch (error) {
      console.error('Failed to load branch batches:', error)
      setBatchGroups([])
      return []
    } finally {
      setIsLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    let active = true

    const syncGroups = async () => {
      try {
        const groups = await refreshBatchGroups()
        if (!active) return
        if (Array.isArray(groups)) {
          setBatchGroups(groups)
        }
      } catch (error) {
        if (!active) return
        console.error('Failed to load branch batches:', error)
        setBatchGroups([])
      }
    }

    syncGroups()
    return () => {
      active = false
    }
  }, [branchId, refreshBatchGroups])

  useEffect(() => {
    if (!actionMenuOpenId) return undefined

    const handleDocumentPointerDown = (event) => {
      if (!event.target?.closest?.('.batch-management-actions')) {
        setActionMenuOpenId('')
      }
    }

    const handleDocumentKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActionMenuOpenId('')
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown)
    document.addEventListener('touchstart', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown)
      document.removeEventListener('touchstart', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [actionMenuOpenId])

  const openActionMenu = useCallback((group, button) => {
    if (!button || typeof window === 'undefined') return

    const rect = button.getBoundingClientRect()
    const menuWidth = 170
    const menuHeight = 132
    const gap = 8
    const padding = 8

    let left = rect.right - menuWidth
    let top = rect.bottom + gap

    if (left < padding) {
      left = padding
    }

    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding
    }

    if (top + menuHeight > window.innerHeight - padding) {
      top = rect.top - menuHeight - gap
    }

    if (top < padding) {
      top = padding
    }

    setActionMenuPosition({ top, left })
    setActionMenuOpenId(String(group.id || group.batchGroupId || group.batchId || ''))
  }, [])

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

  const currentBranchBatchGroups = useMemo(
    () => batchGroups.filter((group) => !branchId || normalizeId(group.branchId) === normalizeId(branchId)),
    [batchGroups, branchId],
  )

  const nextBatchSequenceStart = useMemo(() => getNextBatchSequenceNumber(currentBranchBatchGroups), [currentBranchBatchGroups])
  const nextBatchGroupSequenceStart = useMemo(() => getNextBatchGroupSequenceNumber(currentBranchBatchGroups), [currentBranchBatchGroups])

  const resetDraft = useCallback(() => {
    setCreateError('')
    setFieldErrors({ courseId: '', facultyId: '', rows: [] })
    setDraft(createInitialDraft(1, nextBatchGroupSequenceStart, 1))
    setEditingGroup(null)
  }, [nextBatchGroupSequenceStart, nextBatchSequenceStart])

  const openCreateModal = useCallback(() => {
    const groupSequenceStart = getNextBatchGroupSequenceNumber(currentBranchBatchGroups)
    setCreateError('')
    setFieldErrors({ courseId: '', facultyId: '', rows: [] })
    setSaveSuccessPopup(null)
    setDraft(createInitialDraft(1, groupSequenceStart, 1))
    setEditingGroup(null)
    setActionMenuOpenId('')
    setActionMenuPosition(null)
    setIsCreateOpen(true)
  }, [currentBranchBatchGroups])

  const openEditModal = useCallback(
    (group) => {
      const nextGroupSequence = getNextBatchGroupSequenceNumber(currentBranchBatchGroups)
      setCreateError('')
      setFieldErrors({ courseId: '', facultyId: '', rows: [] })
      setEditingGroup(group)
      setDraft(createDraftFromGroup(group, 1, nextGroupSequence))
      setIsCreateOpen(true)
      setActionMenuOpenId('')
      setActionMenuPosition(null)
    },
    [currentBranchBatchGroups],
  )

  const closeCreateModal = useCallback(() => {
    if (isSaving) return
    setIsCreateOpen(false)
    setDeleteRowTarget(null)
    setEditingGroup(null)
    setActionMenuOpenId('')
    setActionMenuPosition(null)
    resetDraft()
  }, [isSaving, resetDraft])

  const closeDetailModal = useCallback(() => {
    setDetailGroup(null)
  }, [])

  const renderActionMenu = () => {
    if (!actionMenuOpenId || !actionMenuPosition || typeof document === 'undefined') return null

    const activeGroup = filteredGroups.find((group) => String(group.id || group.batchGroupId || group.batchId || '') === actionMenuOpenId)
    if (!activeGroup) return null

    return createPortal(
      <div
        className="batch-management-actions batch-management-actions-portal"
        role="presentation"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'fixed',
          top: `${actionMenuPosition.top}px`,
          left: `${actionMenuPosition.left}px`,
          width: '170px',
          zIndex: 1600,
        }}
      >
        <div
          className="batch-management-actions-menu"
          role="menu"
          aria-label={`${activeGroup.courseName || activeGroup.batchId || 'Batch'} actions`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setDetailGroup(activeGroup)
              setActionMenuOpenId('')
              setActionMenuPosition(null)
            }}
          >
            <Eye size={14} strokeWidth={2.2} aria-hidden="true" />
            View
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              openEditModal(activeGroup)
              setActionMenuPosition(null)
            }}
          >
            <Pencil size={14} strokeWidth={2.2} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={() => {
              requestDeleteGroup(activeGroup)
              setActionMenuPosition(null)
            }}
          >
            <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
            Delete
          </button>
        </div>
      </div>,
      document.body,
    )
  }

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
          return { ...row, [field]: String(value ?? '') }
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

  const closeDeleteConfirmModal = useCallback(() => {
    setDeleteRowTarget(null)
    setDeleteGroupTarget(null)
  }, [])

  const requestDeleteGroup = useCallback((group) => {
    setDeleteGroupTarget(group)
    setActionMenuOpenId('')
    setActionMenuPosition(null)
  }, [])

  const confirmDeleteGroup = useCallback(() => {
    if (!deleteGroupTarget) return

    ;(async () => {
      try {
        setIsSaving(true)
        await deleteBranchBatch(deleteGroupTarget.id || deleteGroupTarget.batchGroupId || deleteGroupTarget.batchId)
        await refreshBatchGroups()

        if (detailGroup && String(detailGroup.id || detailGroup.batchGroupId || detailGroup.batchId || '').trim() === String(deleteGroupTarget.id || deleteGroupTarget.batchGroupId || deleteGroupTarget.batchId || '').trim()) {
          setDetailGroup(null)
        }

        if (editingGroup && String(editingGroup.id || editingGroup.batchGroupId || editingGroup.batchId || '').trim() === String(deleteGroupTarget.id || deleteGroupTarget.batchGroupId || deleteGroupTarget.batchId || '').trim()) {
          closeCreateModal()
        }
        closeDeleteConfirmModal()
      } catch (error) {
        console.error('Failed to delete batch:', error)
        setCreateError(error?.message || 'Unable to delete batch right now.')
      } finally {
        setIsSaving(false)
      }
    })()
  }, [closeCreateModal, closeDeleteConfirmModal, deleteGroupTarget, detailGroup, editingGroup, refreshBatchGroups])

  const handleSaveBatches = useCallback(
    async (event) => {
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
      const existingGroup = editingGroup
        ? batchGroups.find((group) => String(group.id || group.batchGroupId || group.batchId || '').trim() === String(editingGroup.id || editingGroup.batchGroupId || editingGroup.batchId || '').trim()) || editingGroup
        : null

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
            batchId: row.batchId,
            batchName,
            startTime: convertTimeTo24Hour(startTime, startPeriod),
            startPeriod,
            endTime: convertTimeTo24Hour(endTime, endPeriod),
            endPeriod,
            batchTiming: buildBatchTiming({
              startTime: formatClockLabel(`${startTime} ${startPeriod}`),
              endTime: formatClockLabel(`${endTime} ${endPeriod}`),
            }),
            totalSeats,
            status,
          }
        })

        const payload = {
          batchGroupId: draft.batchGroupId,
          courseId: selectedCourseRecord?.id || '',
          facultyId: selectedFacultyRecord?.id || '',
          rows: cleanedRows.map((row) => ({
            batchId: row.batchId,
            batchName: row.batchName,
            startTime: row.startTime,
            startPeriod: row.startPeriod,
            endTime: row.endTime,
            endPeriod: row.endPeriod,
            totalSeats: row.totalSeats,
            status: row.status,
          })),
        }

        const savedGroup = existingGroup
          ? await updateBranchBatch(existingGroup.id || existingGroup.batchGroupId || existingGroup.batchId, payload)
          : await createBranchBatch(payload)

        const normalizedSavedGroup = {
          ...existingGroup,
          ...savedGroup,
          id: String(savedGroup?.id || existingGroup?.id || existingGroup?.batchGroupId || draft.batchGroupId || '').trim(),
          batchGroupId: String(savedGroup?.batchGroupId || existingGroup?.batchGroupId || draft.batchGroupId || '').trim(),
          batchId: String(savedGroup?.batchId || existingGroup?.batchId || cleanedRows[0]?.batchId || '').trim(),
          branchId: String(savedGroup?.branchId || existingGroup?.branchId || branchId || '').trim(),
          courseId: String(payload.courseId || existingGroup?.courseId || '').trim(),
          courseName: String(selectedCourseRecord?.name || existingGroup?.courseName || '').trim(),
          facultyId: String(payload.facultyId || existingGroup?.facultyId || '').trim(),
          facultyName: String(selectedFacultyRecord?.name || existingGroup?.facultyName || '').trim(),
          status: normalizeStatus(savedGroup?.status || cleanedRows[0]?.status || existingGroup?.status || 'Active'),
          rows: cleanedRows,
          batches: cleanedRows,
        }

        const localBranchGroups = loadBranchBatchGroups(branchId)
        const nextLocalGroups = [
          normalizedSavedGroup,
          ...localBranchGroups.filter((group) => {
            const groupKey = String(group?.id || group?.batchGroupId || group?.batchId || '').trim()
            const savedKey = String(normalizedSavedGroup.id || normalizedSavedGroup.batchGroupId || normalizedSavedGroup.batchId || '').trim()
            return !groupKey || groupKey !== savedKey
          }),
        ]
        saveBranchBatchGroups(nextLocalGroups)

        const latestGroups = await refreshBatchGroups()
        setIsCreateOpen(false)
        setEditingGroup(null)
        setFieldErrors({ courseId: '', facultyId: '', rows: [] })
        const latestBranchGroups = latestGroups.filter((group) => !branchId || normalizeId(group.branchId) === normalizeId(branchId))
        const latestGroupSequence = getNextBatchGroupSequenceNumber(latestBranchGroups.length ? latestBranchGroups : currentBranchBatchGroups)
        setDraft(createInitialDraft(1, latestGroupSequence, 1))
        setSaveSuccessPopup({
          title: existingGroup ? 'Batch Updated' : 'Batch Created',
          message: existingGroup
            ? 'The batch group has been updated successfully.'
            : 'The batch group has been created successfully.',
        })
      } catch (error) {
        console.error('Failed to save batches:', error)
        setCreateError(error?.message || 'Unable to save batches right now.')
      } finally {
        setIsSaving(false)
      }
    },
    [activeCourses, availableFacultyOptions, batchGroups, draft.batchGroupId, draft.courseId, draft.facultyId, draft.rows, editingGroup, refreshBatchGroups],
  )

  const filteredGroups = batchGroups
    .filter((group) => {
      const search = normalizeText(searchTerm).toLowerCase()
      if (!search) return true

      const haystack = [
        group.batchGroupId,
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

  const batchRowsPerPage = 5
  const totalBatchPages = Math.max(1, Math.ceil(filteredGroups.length / batchRowsPerPage))
  const safeBatchTablePage = Math.min(Math.max(1, batchTablePage), totalBatchPages)
  const paginatedGroups = filteredGroups.slice(
    (safeBatchTablePage - 1) * batchRowsPerPage,
    safeBatchTablePage * batchRowsPerPage,
  )

  useEffect(() => {
    setBatchTablePage(1)
  }, [searchTerm])

  useEffect(() => {
    setBatchTablePage((currentPage) => Math.min(Math.max(1, currentPage), totalBatchPages))
  }, [totalBatchPages])

  const renderCreateModal = () => {
    if (!isCreateOpen || typeof document === 'undefined') return null
    const isEditingBatch = Boolean(editingGroup)

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
              <h3 id="batch-create-title">{isEditingBatch ? 'Edit Batch' : 'Create Batch'}</h3>
            </div>
          </div>

          <div className="batch-management-form-shell">
            <div className="batch-management-form-grid">
              <label className="batch-management-field">
                <span>Batch Group ID *</span>
                <input type="text" value={draft.batchGroupId || ''} readOnly />
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
                      <small>ID: {row.batchId}</small>
                      <input
                        type="text"
                        placeholder=" Batch Name"
                        value={row.batchName}
                        onChange={(event) => handleRowChange(index, 'batchName', event.target.value)}
                      />
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
                {isSaving ? (isEditingBatch ? 'Updating...' : 'Creating...') : isEditingBatch ? 'Update Batches' : 'Create Batches'}
              </button>
            </div>
          </div>
        </form>
      </div>,
      document.body,
    )
  }

  const renderDeleteConfirmModal = () => {
    if (typeof document === 'undefined') return null
    const targetGroup = deleteGroupTarget || deleteRowTarget?.row || null
    if (!targetGroup) return null
    const isGroupDelete = Boolean(deleteGroupTarget)
    const targetRow = deleteRowTarget?.row || {}

    return createPortal(
      <div className="branch-modal-backdrop batch-modal-backdrop" role="presentation">
        <div
          className="course-modal panel-card batch-delete-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-delete-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="course-modal-close batch-delete-close"
            onClick={closeDeleteConfirmModal}
            aria-label="Close delete confirmation"
            disabled={isSaving}
          >
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <div className="batch-delete-confirm-head">
            <p className="batch-delete-confirm-kicker">DELETE BATCH</p>
            <h3 id="batch-delete-title">{isGroupDelete ? 'Are you sure you want to delete this batch group?' : 'Are you sure you want to delete this batch row?'}</h3>
            <p className="batch-delete-confirm-subtitle">
              {isGroupDelete ? (
                <>
                  <strong>{targetGroup.courseName || targetGroup.batchId || 'This batch'}</strong>
                  {' '}
                  with <strong>{targetGroup.batchCount || (Array.isArray(targetGroup.batches) ? targetGroup.batches.length : 0)}</strong>
                  {' '}
                  row{(targetGroup.batchCount || (Array.isArray(targetGroup.batches) ? targetGroup.batches.length : 0)) === 1 ? '' : 's'} will be removed.
                </>
              ) : targetRow.batchName || targetRow.batchId ? (
                `${targetRow.batchName || targetRow.batchId} will be removed from this form.`
              ) : (
                'This batch row will be removed from this form.'
              )}
            </p>
          </div>

          <div className="batch-delete-confirm-divider" />

          <div className="batch-delete-confirm-actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={closeDeleteConfirmModal}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-solid is-danger"
              onClick={isGroupDelete ? confirmDeleteGroup : confirmDeleteRow}
              disabled={isSaving}
            >
              {isSaving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  const renderDetailModal = () => {
    if (!detailGroup || typeof document === 'undefined') return null
    const batchCount = detailGroup.batchCount || detailGroup.batches?.length || 0
    const detailStatus = normalizeStatus(detailGroup.status || 'Active')
    const detailStatusClass = String(detailStatus).toLowerCase()

    return createPortal(
      <div className="branch-modal-backdrop batch-modal-backdrop" role="presentation" onClick={closeDetailModal}>
        <section
          className="course-modal panel-card batch-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-detail-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="course-modal-close batch-detail-close"
            onPointerDown={closeDetailModal}
            onClick={closeDetailModal}
            aria-label="Close batch details"
          >
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <div className="batch-detail-hero">
            <div className="batch-detail-hero-badge" aria-hidden="true">
              <UsersRound size={24} strokeWidth={2.2} />
            </div>

            <div className="batch-detail-hero-copy">
              <div className="batch-detail-hero-topline">
                <h3 id="batch-detail-title">{detailGroup.batchGroupId || detailGroup.batchId}</h3>
                <span className={`batch-detail-status-pill ${detailStatusClass}`}>{detailStatus}</span>
                <span className="batch-detail-count-pill">{batchCount} Batches</span>
              </div>

              <div className="batch-detail-hero-meta">
                <span>Course: <strong>{detailGroup.courseName || '-'}</strong></span>
                <span>Faculty: <strong>{detailGroup.facultyName || '-'}</strong></span>
              </div>
            </div>
          </div>

          <div className="batch-detail-list">
            <h4 className="batch-detail-list-title">Batch List</h4>
            {(Array.isArray(detailGroup.batches) ? detailGroup.batches : []).map((batch) => {
              return (
                <article key={batch.batchId} className="batch-detail-card">
                  <div className="batch-detail-card-icon">
                    <UsersRound size={22} strokeWidth={2.1} aria-hidden="true" />
                  </div>

                  <div className="batch-detail-card-body">
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
                        <strong className={`batch-detail-status-pill ${String(normalizeStatus(batch.status)).toLowerCase()}`}>
                          {normalizeStatus(batch.status)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>,
      document.body,
    )
  }

  const renderSaveSuccessPopup = () => {
    if (!saveSuccessPopup || typeof document === 'undefined') return null

    return createPortal(
      <div className="branch-modal-backdrop batch-modal-backdrop" role="presentation" onClick={() => setSaveSuccessPopup(null)}>
        <div
          className="batch-success-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-success-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className="batch-success-close" aria-label="Close success popup" onClick={() => setSaveSuccessPopup(null)}>
            <X size={20} strokeWidth={2.2} />
          </button>

          <div className="batch-success-hero" aria-hidden="true">
            <span className="batch-success-ring" />
            <span className="batch-success-icon">
              <CheckCircle2 size={30} strokeWidth={2.1} />
            </span>
          </div>

          <div className="batch-success-copy">
            <p className="batch-success-kicker">Success</p>
            <h3 id="batch-success-title">{saveSuccessPopup.title}</h3>
            <p>{saveSuccessPopup.message}</p>
          </div>

          <div className="batch-success-actions">
            <button type="button" className="batch-success-secondary" onClick={() => setSaveSuccessPopup(null)}>
              Close
            </button>
            <button type="button" className="batch-success-primary" onClick={() => setSaveSuccessPopup(null)}>
              OK
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  return (
    <section className="branch-dashboard-section batch-management-section">
      <div className="branch-dashboard-section-heading">
        <div className="branch-dashboard-section-heading-copy">
          <h2>Batch Management</h2>
        </div>
        <div className="branch-dashboard-section-heading-actions">
          <button type="button" className="button button-solid batch-create-button" onClick={openCreateModal}>
            <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
            Create Batch
          </button>
        </div>
      </div>

      <form
        className="batch-management-toolbar"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="batch-management-search-bar">
          <input
            type="search"
            className="batch-management-search"
            placeholder="Search installment plan"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <button type="submit" className="button button-solid batch-management-search-button">
            Search
          </button>
        </div>
      </form>

      <div className="branch-dashboard-table-shell batch-management-table-shell">
        <table className="branch-dashboard-table batch-management-table">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Course Name</th>
              <th>Faculty Name</th>
              <th>Batch Count</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedGroups.length ? (
              paginatedGroups.map((group) => (
                <tr key={group.id || group.batchGroupId || group.batchId}>
                  <td>{group.batchGroupId || group.batchId}</td>
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
                  <td className="batch-management-actions-cell">
                    <div className={`batch-management-actions ${actionMenuOpenId === String(group.id || group.batchGroupId || group.batchId || '') ? 'is-open' : ''}`.trim()}>
                      <button
                        type="button"
                        className="batch-management-actions-trigger"
                        aria-label={`Open actions for ${group.courseName || group.batchGroupId || group.batchId || 'batch'}`}
                        aria-haspopup="menu"
                        aria-expanded={actionMenuOpenId === String(group.id || group.batchGroupId || group.batchId || '')}
                        onClick={(event) => {
                          event.stopPropagation()
                          const actionId = String(group.id || group.batchGroupId || group.batchId || '')
                          if (actionMenuOpenId === actionId) {
                            setActionMenuOpenId('')
                            setActionMenuPosition(null)
                          } else {
                            openActionMenu(group, event.currentTarget)
                          }
                        }}
                      >
                        <MoreVertical size={16} strokeWidth={2.3} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="branch-course-empty-state">
                  {isLoading ? 'Loading batches...' : 'No batches created yet. Use Create Batch to add the first group.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        currentPage={safeBatchTablePage}
        totalPages={totalBatchPages}
        onPageChange={setBatchTablePage}
        className="batch-management-pagination"
        label="Batch table pagination"
        previousLabel="Previous"
        nextLabel="Next"
      />

      {renderActionMenu()}
      {renderCreateModal()}
      {renderDeleteConfirmModal()}
      {renderDetailModal()}
      {renderSaveSuccessPopup()}
    </section>
  )
}
