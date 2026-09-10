import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
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
import { FACULTY_ATTENDANCE_SYNC_EVENT, getAttendanceDateKey } from '../lib/facultyAttendanceStore'
import { getMatchingStudents } from '../lib/facultyFlow'
import { getCurrentFacultyAttendanceOverview } from '../services/attendanceService'
import { calculateBatchCourseEndDate } from '../lib/batchAllocation'
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

function extractAttendanceStatuses(payload = {}) {
  const source = payload?.data ?? payload
  const rows = [
    ...(Array.isArray(source) ? source : []),
    ...(Array.isArray(source?.students) ? source.students : []),
    ...(Array.isArray(source?.attendance) ? source.attendance : []),
    ...(Array.isArray(source?.attendanceRecords) ? source.attendanceRecords : []),
  ]
  const statuses = {}

  rows.forEach((row) => {
    const studentId = normalizeMatchKey(
      row?.studentId || row?.studentCode || row?.id || row?.student?.studentId || row?.student?.studentCode || row?.student?.id,
    )
    const rawStatus = String(row?.attendanceStatus || row?.attendanceStatusLabel || row?.status || '').trim().toUpperCase()
    if (!studentId || !['PRESENT', 'ABSENT'].includes(rawStatus)) return
    statuses[studentId] = rawStatus
  })

  return statuses
}

function normalizeId(value = '') {
  return normalizeText(value).toLowerCase()
}

function getStudentIdentityKey(student = {}) {
  return normalizeId(
    student?.studentId ||
    student?.id ||
    student?._id ||
    student?.recordId ||
    student?._recordId ||
    student?.originalStudentId ||
    student?._originalStudentId ||
    `${student?.courseId || ''}|${student?.batchGroupId || ''}|${student?.batchId || ''}|${student?.batchName || ''}|${student?.facultyId || ''}|${student?.studentName || ''}|${student?.admissionDate || ''}`,
  )
}

function getBatchSeatSummary(batch = {}, students = []) {
  const matchingStudents = getMatchingStudents(students, {
    facultyId: batch?.facultyId || '',
    facultyName: batch?.facultyName || '',
    courseId: batch?.courseId || '',
    courseName: batch?.courseName || '',
    batchGroupId: batch?.batchGroupId || '',
    batchId: batch?.batchId || batch?.id || '',
    batchName: batch?.batchName || '',
    batchTiming: batch?.batchTiming || '',
  })

  const uniqueStudents = new Set()
  matchingStudents.forEach((student) => {
    const studentKey = getStudentIdentityKey(student)
    if (!studentKey) return
    uniqueStudents.add(studentKey)
  })

  const totalSeats = Math.max(Number(batch?.totalSeats || 0) || 0, 0)
  const usedSeats = uniqueStudents.size
  const remainingSeats = Math.max(totalSeats - usedSeats, 0)

  return {
    totalSeats,
    usedSeats,
    remainingSeats,
  }
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

const TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const TIME_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'))

function getTimePickerParts(time = '', period = 'AM', fallbackHour = '09') {
  const parsed = parseStoredTimeParts(`${time || ''} ${period || ''}`.trim())
  const [hour = '', minute = ''] = String(parsed.time || '').split(':')

  if (!String(time || '').trim() && !String(period || '').trim()) {
    return {
      hour: '',
      minute: '',
      period: '',
    }
  }

  return {
    hour: hour || fallbackHour,
    minute: minute || '00',
    period: parsed.period || period || 'AM',
  }
}

function parseTimeToMinutes(value = '', period = '') {
  const text = normalizeText(value)
  if (!text) return null

  const amPmMatch = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (amPmMatch) {
    let hours = Number(amPmMatch[1])
    const minutes = Number(amPmMatch[2])
    const meridiem = String(amPmMatch[3] || '').toUpperCase()

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

    if (meridiem === 'AM') {
      if (hours === 12) hours = 0
    } else if (hours < 12) {
      hours += 12
    }

    return hours * 60 + minutes
  }

  const clockMatch = text.match(/^(\d{1,2}):(\d{2})$/)
  if (!clockMatch) return null

  let hours = Number(clockMatch[1])
  const minutes = Number(clockMatch[2])
  const meridiem = String(period || '').trim().toUpperCase()

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  if (meridiem === 'AM') {
    if (hours === 12) hours = 0
  } else if (meridiem === 'PM') {
    if (hours < 12) hours += 12
  } else if (hours > 23 || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

function formatRangeLabel(startValue = '', startPeriod = '', endValue = '', endPeriod = '') {
  const startLabel = formatClockLabel(`${startValue} ${startPeriod}`.trim())
  const endLabel = formatClockLabel(`${endValue} ${endPeriod}`.trim())
  return `${startLabel}${startLabel && endLabel ? ' - ' : ''}${endLabel}`.trim()
}

function isSameFacultyGroup(group = {}, facultyId = '', facultyName = '') {
  const targetFacultyId = normalizeMatchKey(facultyId)
  const targetFacultyName = normalizeMatchKey(facultyName)
  const groupFacultyId = normalizeMatchKey(group?.facultyId || group?.branchFacultyId || '')
  const groupFacultyName = normalizeMatchKey(group?.facultyName || group?.branchFacultyName || '')

  const facultyIdMatches = Boolean(targetFacultyId && groupFacultyId && targetFacultyId === groupFacultyId)
  const facultyNameMatches = Boolean(targetFacultyName && groupFacultyName && targetFacultyName === groupFacultyName)

  // IDs can differ between course mappings and the faculty master record, so
  // a matching faculty name must also identify the same faculty.
  return Boolean(targetFacultyId || targetFacultyName) && (facultyIdMatches || facultyNameMatches)
}

function getBatchTimingClashMessage() {
  return 'Time Clash! This faculty is already assigned to another batch during the selected time.'
}

function getBatchTimingRange(batch = {}) {
  const startMinutes = parseTimeToMinutes(batch?.startTime || '', batch?.startPeriod || '')
  const endMinutes = parseTimeToMinutes(batch?.endTime || '', batch?.endPeriod || '')

  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
    return null
  }

  return {
    batchId: normalizeText(batch?.batchId || batch?.id || ''),
    batchName: normalizeText(batch?.batchName || ''),
    startMinutes,
    endMinutes,
    label: normalizeText(
      batch?.batchTiming ||
      formatRangeLabel(batch?.startTime || '', batch?.startPeriod || '', batch?.endTime || '', batch?.endPeriod || ''),
    ),
  }
}

function findTimingConflict(startMinutes, endMinutes, ranges = []) {
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null

  return (Array.isArray(ranges) ? ranges : []).find((range) => {
    if (!range) return false
    return startMinutes < range.endMinutes && endMinutes > range.startMinutes
  }) || null
}

function isStartTimeOptionDisabled(hour, minute, period, ranges = []) {
  const candidateMinutes = parseTimeToMinutes(`${hour}:${minute}`, period)
  if (!Number.isFinite(candidateMinutes)) return false

  return (Array.isArray(ranges) ? ranges : []).some((range) => {
    if (!range) return false
    return candidateMinutes >= range.startMinutes && candidateMinutes < range.endMinutes
  })
}

function getCourseLabel(course = {}) {
  return normalizeText(course?.name || course?.courseName || course?.courseCode || '')
}

function getFacultyLabel(faculty = {}) {
  return normalizeText(faculty?.name || faculty?.facultyName || faculty?.fullName || faculty?.facultyId || '')
}

function resolveFacultyIdForGroup(group = {}, facultyOptions = []) {
  const directFacultyId = normalizeText(group?.facultyId || group?.branchFacultyId || group?.facultyUserId || '')
  if (directFacultyId) return directFacultyId

  const facultyName = normalizeMatchKey(group?.facultyName || '')
  if (!facultyName) return ''

  const matchedFaculty = (Array.isArray(facultyOptions) ? facultyOptions : []).find((faculty) => {
    const optionId = normalizeMatchKey(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || faculty?.userId || '')
    const optionName = normalizeMatchKey(getFacultyLabel(faculty))

    return optionName === facultyName || optionId === facultyName
  })

  return normalizeText(matchedFaculty?.id || matchedFaculty?.facultyId || matchedFaculty?.facultyUserId || '')
}

function resolveFacultyNameForGroup(group = {}, facultyOptions = []) {
  const directFacultyName = normalizeText(group?.facultyName || group?.branchFacultyName || '')
  if (directFacultyName) return directFacultyName

  const facultyId = normalizeMatchKey(group?.facultyId || group?.branchFacultyId || '')
  if (!facultyId) return ''

  const matchedFaculty = (Array.isArray(facultyOptions) ? facultyOptions : []).find((faculty) => {
    const optionId = normalizeMatchKey(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || faculty?.userId || '')
    return optionId === facultyId
  })

  return getFacultyLabel(matchedFaculty)
}

function isFacultyNameFallbackValue(value = '') {
  return String(value || '').trim().startsWith('faculty-name:')
}

function getFacultyNameFromFallbackValue(value = '') {
  const text = String(value || '').trim()
  return text.startsWith('faculty-name:') ? text.slice('faculty-name:'.length) : ''
}

function createBatchRow(batchId = '') {
  return {
    batchId,
    batchName: '',
    startTime: '09:00',
    startPeriod: 'AM',
    endTime: '11:00',
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
    facultyName: '',
    weekType: '',
    mode: '',
    courseStartDate: '',
    courseEndDate: '',
    rows,
    nextSequence: sequenceStart + rowCount,
  }
}

function createDraftFromGroup(group = {}, sequenceStart = 1, groupSequence = 1, facultyOptions = []) {
  const batches = Array.isArray(group.batches) ? group.batches : []
  const rows = batches.length
    ? [batches[0]].map((batch) => {
        const startParts = parseStoredTimeParts(`${batch.startTime || ''} ${batch.startPeriod || ''}`.trim())
        const endParts = parseStoredTimeParts(`${batch.endTime || ''} ${batch.endPeriod || ''}`.trim())

        return {
          batchId: normalizeText(batch.batchId || makeBatchId(sequenceStart)),
          batchName: normalizeText(batch.batchName || ''),
          startTime: startParts.time,
          startPeriod: startParts.period,
          endTime: endParts.time,
          endPeriod: endParts.period,
          totalSeats: normalizeText(batch.totalSeats || ''),
          weekType: normalizeText(batch.weekType || group.weekType).toUpperCase(),
          mode: normalizeText(batch.mode || group.mode).toUpperCase(),
          courseStartDate: normalizeText(batch.courseStartDate || group.courseStartDate),
          courseEndDate: normalizeText(batch.courseEndDate || group.courseEndDate),
          status: normalizeStatus(batch.status || 'Active'),
        }
      })
    : [createBatchRow(makeBatchId(sequenceStart))]

  return {
    batchGroupId: normalizeText(group.batchGroupId || makeBatchGroupId(groupSequence)),
    courseId: normalizeText(group.courseId || ''),
    facultyId: resolveFacultyIdForGroup(group, facultyOptions),
    facultyName: resolveFacultyNameForGroup(group, facultyOptions),
    weekType: normalizeText(group.weekType || rows[0]?.weekType).toUpperCase(),
    mode: normalizeText(group.mode || rows[0]?.mode).toUpperCase(),
    courseStartDate: normalizeText(group.courseStartDate || rows[0]?.courseStartDate),
    courseEndDate: normalizeText(group.courseEndDate || rows[0]?.courseEndDate),
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

function isInactiveBatchGroup(group = {}) {
  return getBatchGroupStatus(group).toLowerCase() === 'inactive'
}

function normalizeMatchKey(value = '') {
  return normalizeId(value)
}

function getBatchSeatMapKey(batch = {}, group = {}) {
  const groupKey = normalizeMatchKey(group?.batchGroupId || group?.id || batch?.batchGroupId || '')
  const batchKey = normalizeMatchKey(batch?.batchId || batch?.id || '')
  return `${groupKey}|${batchKey}`
}

function getPrimaryBatchForGroup(group = {}) {
  const batches = Array.isArray(group?.batches) ? group.batches : []
  const primaryBatch = batches[0] || {}

  return {
    ...primaryBatch,
    batchId: normalizeText(primaryBatch?.batchId || group?.batchId || group?.batchGroupId || group?.id || ''),
    batchName: normalizeText(primaryBatch?.batchName || group?.batchName || ''),
    batchTiming: normalizeText(primaryBatch?.batchTiming || group?.batchTiming || ''),
    totalSeats: Number(primaryBatch?.totalSeats || group?.totalSeats || 0) || 0,
    status: normalizeStatus(primaryBatch?.status || group?.status || 'Active'),
  }
}

function getBatchDisplayKey(group = {}) {
  const primaryBatch = getPrimaryBatchForGroup(group)
  return normalizeMatchKey(primaryBatch.batchId || group?.batchId || group?.batchGroupId || group?.id || '')
}

function buildSingleBatchDisplayGroup(group = {}) {
  const primaryBatch = getPrimaryBatchForGroup(group)
  const batchId = primaryBatch.batchId || normalizeText(group?.batchId || group?.batchGroupId || group?.id || '')

  return {
    ...group,
    id: String(group?.id || batchId || group?.batchGroupId || '').trim(),
    batchGroupId: String(group?.batchGroupId || group?.id || batchId || '').trim(),
    batchId,
    batchName: primaryBatch.batchName || group?.batchName || '',
    batchTiming: primaryBatch.batchTiming || group?.batchTiming || '',
    totalSeats: primaryBatch.totalSeats || group?.totalSeats || 0,
    status: primaryBatch.status || group?.status || 'Active',
    batches: batchId ? [primaryBatch] : [],
    batchCount: 1,
    displayBatch: primaryBatch,
  }
}

export function BranchBatchManagementSection({
  branchId = '',
  branchCourses = [],
  branchFacultyRecords = [],
  facultyList = [],
  branchStudents = [],
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
  const [detailAttendanceStatuses, setDetailAttendanceStatuses] = useState({})
  const [editingGroup, setEditingGroup] = useState(null)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState(null)
  const [draft, setDraft] = useState(() => createInitialDraft(1, 1))
  const [courseSearch, setCourseSearch] = useState('')
  const [facultySearch, setFacultySearch] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [batchTablePage, setBatchTablePage] = useState(1)
  const [actionMenuOpenId, setActionMenuOpenId] = useState('')
  const [actionMenuPosition, setActionMenuPosition] = useState(null)
  const [saveSuccessPopup, setSaveSuccessPopup] = useState(null)
  const actionMenuCloseTimerRef = useRef(null)

  const refreshBatchGroups = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await listBranchBatches()
      const backendGroups = Array.isArray(result?.data) ? result.data : []
      const localGroups = loadBranchBatchGroups(branchId)
      const mergedGroups = [
        ...backendGroups,
        ...localGroups.filter((localGroup) => {
          if (!isInactiveBatchGroup(localGroup)) {
            return false
          }

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

  useEffect(() => {
    return () => {
      if (actionMenuCloseTimerRef.current) {
        clearTimeout(actionMenuCloseTimerRef.current)
        actionMenuCloseTimerRef.current = null
      }
    }
  }, [])

  const openActionMenu = useCallback((group, button) => {
    if (!button || typeof window === 'undefined') return

    if (actionMenuCloseTimerRef.current) {
      clearTimeout(actionMenuCloseTimerRef.current)
      actionMenuCloseTimerRef.current = null
    }

    const rect = button.getBoundingClientRect()
    const menuWidth = 180
    const menuHeight = 176
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

  const closeActionMenu = useCallback(() => {
    if (actionMenuCloseTimerRef.current) {
      clearTimeout(actionMenuCloseTimerRef.current)
      actionMenuCloseTimerRef.current = null
    }

    setActionMenuOpenId('')
    setActionMenuPosition(null)
  }, [])

  const scheduleCloseActionMenu = useCallback(() => {
    if (actionMenuCloseTimerRef.current) {
      clearTimeout(actionMenuCloseTimerRef.current)
    }

    actionMenuCloseTimerRef.current = setTimeout(() => {
      setActionMenuOpenId('')
      setActionMenuPosition(null)
      actionMenuCloseTimerRef.current = null
    }, 140)
  }, [])

  const activeCourses = useMemo(() => {
    return (Array.isArray(branchCourses) ? branchCourses : [])
      .filter((course) => normalizeStatus(course?.status || '').toLowerCase() === 'active')
      .map((course) => ({
        id: normalizeText(course?.id || ''),
        name: getCourseLabel(course),
        assignedFaculty: Array.isArray(course?.assignedFaculty) ? course.assignedFaculty : [],
        code: normalizeText(course?.courseCode || ''),
        hours: course?.hours ?? '',
        duration: course?.duration ?? '',
      }))
      .filter((course) => course.id && course.name)
  }, [branchCourses])

  const activeFaculty = useMemo(() => {
    const source = Array.isArray(branchFacultyRecords) && branchFacultyRecords.length ? branchFacultyRecords : facultyList

    return source
      .map((faculty) => {
        const id = normalizeText(faculty?.id || faculty?.facultyId || faculty?.facultyUserId || faculty?.userId || '')
        const facultyCode = normalizeText(
          faculty?.facultyId || faculty?.code || faculty?.facultyCode || (id.match(/^FC[-_]?\d+$/i) ? id : ''),
        )
        const name = getFacultyLabel(faculty)
        const status = normalizeStatus(faculty?.status || faculty?.recordStatus || 'Active')

        return {
          id,
          facultyCode,
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

  const resolvedDraftFacultyId = isFacultyNameFallbackValue(draft.facultyId) ? '' : normalizeText(draft.facultyId)
  const resolvedDraftFacultyName = isFacultyNameFallbackValue(draft.facultyId)
    ? getFacultyNameFromFallbackValue(draft.facultyId) || normalizeText(draft.facultyName)
    : normalizeText(draft.facultyName)

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

  const courseSearchResults = useMemo(() => {
    const query = courseSearch.trim().toLowerCase()
    if (!query || draft.courseId) return []
    return activeCourses
      .filter((course) => [course.id, course.code, course.name]
        .some((value) => String(value || '').toLowerCase().includes(query)))
      .slice(0, 8)
  }, [activeCourses, courseSearch, draft.courseId])

  const facultySearchResults = useMemo(() => {
    const query = facultySearch.trim().toLowerCase()
    if (!query || !draft.courseId || resolvedDraftFacultyId) return []

    const isFacultyIdSearch = /^fc(?:[-_ ]?\d+)?$/i.test(query) || /^\d+$/.test(query)
    const normalizedQueryId = query.replace(/^fc[-_ ]?/i, '').replace(/^0+(?=\d)/, '')

    return availableFacultyOptions
      .filter((faculty) => {
        if (isFacultyIdSearch) {
          const facultyCode = String(faculty.facultyCode || '').trim().toLowerCase()
          const facultyCodeId = facultyCode.replace(/^fc[-_ ]?/i, '').replace(/^0+(?=\d)/, '')
          return facultyCodeId === normalizedQueryId
        }

        return String(faculty.name || '').toLowerCase().includes(query)
      })
      .slice(0, 8)
  }, [availableFacultyOptions, draft.courseId, facultySearch, resolvedDraftFacultyId])

  const selectedFacultyRecord = useMemo(
    () => availableFacultyOptions.find((faculty) => faculty.id === resolvedDraftFacultyId) || null,
    [availableFacultyOptions, resolvedDraftFacultyId],
  )

  const currentBranchBatchGroups = useMemo(
    () => batchGroups.filter((group) => !branchId || normalizeId(group.branchId) === normalizeId(branchId)),
    [batchGroups, branchId],
  )

  const editingGroupKey = normalizeText(editingGroup?.id || editingGroup?.batchGroupId || editingGroup?.batchId || '')

  const occupiedTimingRanges = useMemo(() => {
    if (!resolvedDraftFacultyId && !resolvedDraftFacultyName) return []

    return currentBranchBatchGroups.flatMap((group) => {
      const groupKey = normalizeText(group?.id || group?.batchGroupId || group?.batchId || '')
      if (editingGroupKey && groupKey === editingGroupKey) return []
      if (!isSameFacultyGroup(group, resolvedDraftFacultyId, resolvedDraftFacultyName)) return []

      return (Array.isArray(group?.batches) ? group.batches : [])
        .map((batch) => {
          if (normalizeStatus(batch?.status || '').toLowerCase() === 'inactive') return null
          return getBatchTimingRange(batch)
        })
        .filter(Boolean)
    })
  }, [currentBranchBatchGroups, editingGroupKey, resolvedDraftFacultyId, resolvedDraftFacultyName])

  const batchSeatSummaryMap = useMemo(() => {
    const counts = new Map()

    currentBranchBatchGroups.forEach((group) => {
      const batches = Array.isArray(group?.batches) ? group.batches : []

      batches.forEach((batch) => {
        const key = getBatchSeatMapKey(batch, group)
        if (!key) return

        counts.set(key, getBatchSeatSummary({
          ...batch,
          batchGroupId: String(group?.batchGroupId || group?.id || '').trim(),
          courseId: String(group?.courseId || group?.branchCourseId || '').trim(),
          courseName: String(group?.courseName || '').trim(),
          facultyId: String(group?.facultyId || group?.branchFacultyId || '').trim(),
          facultyName: String(group?.facultyName || '').trim(),
        }, branchStudents))
      })
    })

    return counts
  }, [branchStudents, currentBranchBatchGroups])

  const nextBatchSequenceStart = useMemo(() => getNextBatchSequenceNumber(currentBranchBatchGroups), [currentBranchBatchGroups])
  const nextBatchGroupSequenceStart = useMemo(() => getNextBatchGroupSequenceNumber(currentBranchBatchGroups), [currentBranchBatchGroups])

  const resetDraft = useCallback(() => {
    setCreateError('')
    setFieldErrors({ courseId: '', facultyId: '', rows: [] })
    setDraft(createInitialDraft(nextBatchSequenceStart, nextBatchGroupSequenceStart, 1))
    setEditingGroup(null)
  }, [nextBatchGroupSequenceStart, nextBatchSequenceStart])

  const openCreateModal = useCallback(() => {
    const groupSequenceStart = getNextBatchGroupSequenceNumber(currentBranchBatchGroups)
    setCreateError('')
    setFieldErrors({ courseId: '', facultyId: '', rows: [] })
    setSaveSuccessPopup(null)
    setDraft(createInitialDraft(nextBatchSequenceStart, groupSequenceStart, 1))
    setEditingGroup(null)
    setCourseSearch('')
    setFacultySearch('')
    setActionMenuOpenId('')
    setActionMenuPosition(null)
    setIsCreateOpen(true)
  }, [currentBranchBatchGroups, nextBatchSequenceStart])

  const openEditModal = useCallback(
    (group) => {
      const nextGroupSequence = getNextBatchGroupSequenceNumber(currentBranchBatchGroups)
      setCreateError('')
      setFieldErrors({ courseId: '', facultyId: '', rows: [] })
      setEditingGroup(group)
      const nextDraft = createDraftFromGroup(group, 1, nextGroupSequence, availableFacultyOptions)
      setDraft(nextDraft)
      setCourseSearch(String(group?.courseName || nextDraft.courseId || '').trim())
      setFacultySearch(String(group?.facultyName || nextDraft.facultyName || '').trim())
      setIsCreateOpen(true)
      setActionMenuOpenId('')
      setActionMenuPosition(null)
    },
    [availableFacultyOptions, currentBranchBatchGroups],
  )

  const closeCreateModal = useCallback(() => {
    if (isSaving) return
    setIsCreateOpen(false)
    setEditingGroup(null)
    setActionMenuOpenId('')
    setActionMenuPosition(null)
    resetDraft()
  }, [isSaving, resetDraft])

  const closeDetailModal = useCallback(() => {
    setDetailGroup(null)
    setDetailAttendanceStatuses({})
  }, [])

  const loadDetailAttendance = useCallback(async (group) => {
    const detailBatch = getPrimaryBatchForGroup(group)
    try {
      const overview = await getCurrentFacultyAttendanceOverview({
        date: getAttendanceDateKey(),
        facultyId: String(group?.facultyId || group?.branchFacultyId || '').trim(),
        courseId: String(group?.courseId || group?.branchCourseId || '').trim(),
        batchId: String(detailBatch?.batchId || detailBatch?.id || '').trim(),
      })
      setDetailAttendanceStatuses(extractAttendanceStatuses(overview))
    } catch {
      setDetailAttendanceStatuses({})
    }
  }, [])

  const toggleGroupStudents = useCallback(
    (group) => {
      setDetailGroup(group)
      setDetailAttendanceStatuses({})
      void loadDetailAttendance(group)
    },
    [loadDetailAttendance],
  )

  useEffect(() => {
    if (!detailGroup || typeof window === 'undefined') return undefined
    const refreshAttendance = () => {
      void loadDetailAttendance(detailGroup)
    }
    window.addEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, refreshAttendance)
    window.addEventListener('storage', refreshAttendance)
    return () => {
      window.removeEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, refreshAttendance)
      window.removeEventListener('storage', refreshAttendance)
    }
  }, [detailGroup, loadDetailAttendance])

  const renderActionMenu = () => {
    if (!actionMenuOpenId || !actionMenuPosition || typeof document === 'undefined') return null

    const activeGroup = displayGroups.find((group) => String(group.id || group.batchGroupId || group.batchId || '') === actionMenuOpenId)
    if (!activeGroup) return null

    return createPortal(
      <div
        className="batch-management-actions batch-management-actions-portal"
        role="presentation"
        onClick={(event) => event.stopPropagation()}
        onMouseEnter={() => {
          if (actionMenuCloseTimerRef.current) {
            clearTimeout(actionMenuCloseTimerRef.current)
            actionMenuCloseTimerRef.current = null
          }
        }}
        onMouseLeave={scheduleCloseActionMenu}
        style={{
          position: 'fixed',
          top: `${actionMenuPosition.top}px`,
          left: `${actionMenuPosition.left}px`,
          width: '180px',
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
            onClick={() => {
              toggleGroupStudents(activeGroup)
              closeActionMenu()
            }}
          >
            <UsersRound size={14} strokeWidth={2.2} aria-hidden="true" />
            View Students
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
      ...(field === 'courseId' ? { facultyId: '', facultyName: '', weekType: '', mode: '', courseStartDate: '', courseEndDate: '' } : {}),
      ...(['weekType', 'mode', 'courseStartDate'].includes(field)
        ? { courseEndDate: calculateBatchCourseEndDate(field === 'courseStartDate' ? value : current.courseStartDate, field === 'weekType' ? value : current.weekType, field === 'mode' ? value : current.mode, selectedCourse?.hours || selectedCourse?.duration) }
        : {}),
      ...(field === 'facultyId'
        ? {
            facultyName:
              availableFacultyOptions.find((faculty) => normalizeText(faculty.id) === normalizeText(value))?.name ||
              current.facultyName ||
              '',
          }
        : {}),
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
  }, [availableFacultyOptions, selectedCourse])

  const handleCourseSearchChange = useCallback((value) => {
    const nextValue = String(value || '')
    setCourseSearch(nextValue)
    setFacultySearch('')

    if (!nextValue.trim() || draft.courseId) {
      handleDraftChange('courseId', '')
    }
  }, [draft.courseId, handleDraftChange])

  const selectCourseFromSearch = useCallback((course) => {
    handleDraftChange('courseId', course.id)
    setCourseSearch(course.name)
    setFacultySearch('')
  }, [handleDraftChange])

  const handleFacultySearchChange = useCallback((value) => {
    const nextValue = String(value || '')
    setFacultySearch(nextValue)

    if (!nextValue.trim() || resolvedDraftFacultyId) {
      handleDraftChange('facultyId', '')
    }
  }, [handleDraftChange, resolvedDraftFacultyId])

  const selectFacultyFromSearch = useCallback((faculty) => {
    handleDraftChange('facultyId', faculty.id)
    setFacultySearch(faculty.name)
  }, [handleDraftChange])

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

  const closeDeleteConfirmModal = useCallback(() => {
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
        weekType: draft.weekType ? '' : 'This field is required',
        mode: draft.mode ? '' : 'This field is required',
        courseStartDate: draft.courseStartDate ? '' : 'This field is required',
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
        Boolean(nextErrors.weekType || nextErrors.mode || nextErrors.courseStartDate) ||
        nextErrors.rows.some((rowErrors) =>
          Boolean(rowErrors.batchName || rowErrors.timing || rowErrors.totalSeats || rowErrors.status),
        )

      if (hasFieldErrors) {
        setFieldErrors(nextErrors)
        return
      }

      setFieldErrors(nextErrors)

      const selectedCourseRecord = activeCourses.find((course) => course.id === draft.courseId) || null
      const resolvedFacultyId = resolvedDraftFacultyId
      const resolvedFacultyName = resolvedDraftFacultyName
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

        const draftTimingRanges = cleanedRows.map((row) => ({
          ...row,
          startMinutes: parseTimeToMinutes(row.startTime, row.startPeriod),
          endMinutes: parseTimeToMinutes(row.endTime, row.endPeriod),
          label: formatRangeLabel(row.startTime, row.startPeriod, row.endTime, row.endPeriod),
        }))

        draftTimingRanges.forEach((rowTiming, index) => {
          if (!Number.isFinite(rowTiming.startMinutes) || !Number.isFinite(rowTiming.endMinutes) || rowTiming.endMinutes <= rowTiming.startMinutes) {
            nextErrors.rows[index].timing = 'Please choose a valid time range.'
            return
          }

          const existingConflict = findTimingConflict(rowTiming.startMinutes, rowTiming.endMinutes, occupiedTimingRanges)
          const draftConflict = findTimingConflict(rowTiming.startMinutes, rowTiming.endMinutes, draftTimingRanges.slice(0, index))
          const conflict = existingConflict || draftConflict

          if (conflict) {
            nextErrors.rows[index].timing = getBatchTimingClashMessage()
          }
        })

        const hasTimingOverlap = nextErrors.rows.some((rowErrors) => Boolean(rowErrors.timing))
        if (hasTimingOverlap) {
          setFieldErrors(nextErrors)
          setCreateError(getBatchTimingClashMessage())
          return
        }

        const payload = {
          courseId: selectedCourseRecord?.id || '',
          facultyId: selectedFacultyRecord?.id || existingGroup?.facultyId || resolvedFacultyId || '',
          weekType: draft.weekType,
          mode: draft.mode,
          courseStartDate: draft.courseStartDate,
          courseEndDate: draft.courseEndDate,
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
          id: String(savedGroup?.id || existingGroup?.id || cleanedRows[0]?.batchId || '').trim(),
          batchId: String(savedGroup?.batchId || existingGroup?.batchId || cleanedRows[0]?.batchId || '').trim(),
          branchId: String(savedGroup?.branchId || existingGroup?.branchId || branchId || '').trim(),
          courseId: String(payload.courseId || existingGroup?.courseId || '').trim(),
          courseName: String(selectedCourseRecord?.name || existingGroup?.courseName || '').trim(),
          facultyId: String(payload.facultyId || existingGroup?.facultyId || '').trim(),
          facultyName: String(selectedFacultyRecord?.name || existingGroup?.facultyName || resolvedFacultyName || '').trim(),
          status: normalizeStatus(savedGroup?.status || cleanedRows[0]?.status || existingGroup?.status || 'Active'),
          rows: cleanedRows,
          batches: cleanedRows,
        }

        const localBranchGroups = loadBranchBatchGroups(branchId)
        const nextLocalGroups = [
          normalizedSavedGroup,
          ...localBranchGroups.filter((group) => {
            if (!isInactiveBatchGroup(group)) {
              return false
            }

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
        setDraft(createInitialDraft(getNextBatchSequenceNumber(latestBranchGroups), latestGroupSequence, 1))
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
    [
      activeCourses,
      batchGroups,
      branchId,
      currentBranchBatchGroups,
      draft.courseId,
      draft.facultyId,
      draft.weekType,
      draft.mode,
      draft.courseStartDate,
      draft.courseEndDate,
      draft.rows,
      editingGroup,
      occupiedTimingRanges,
      refreshBatchGroups,
      resolvedDraftFacultyId,
      resolvedDraftFacultyName,
      selectedFacultyRecord,
    ],
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

  const displayGroups = []
  const uniqueDisplayGroupKeys = new Set()

  filteredGroups.forEach((group) => {
    const displayGroup = buildSingleBatchDisplayGroup(group)
    const key = getBatchDisplayKey(displayGroup)
    if (!key || uniqueDisplayGroupKeys.has(key)) return
    uniqueDisplayGroupKeys.add(key)
    displayGroups.push(displayGroup)
  })

  const batchRowsPerPage = 5
  const totalBatchPages = Math.max(1, Math.ceil(displayGroups.length / batchRowsPerPage))
  const safeBatchTablePage = Math.min(Math.max(1, batchTablePage), totalBatchPages)
  const paginatedGroups = displayGroups.slice(
    (safeBatchTablePage - 1) * batchRowsPerPage,
    safeBatchTablePage * batchRowsPerPage,
  )

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
          noValidate
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
                <span>Course Name *</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="search"
                    value={courseSearch}
                    onChange={(event) => handleCourseSearchChange(event.target.value)}
                    onBlur={() => window.setTimeout(() => setFieldErrors((current) => ({ ...current, courseId: current.courseId })), 120)}
                    placeholder={activeCourses.length ? 'Search by course ID or name' : 'No courses available'}
                    disabled={!activeCourses.length}
                    autoComplete="off"
                  />
                  {courseSearchResults.length ? (
                    <div role="listbox" className="batch-search-results">
                      {courseSearchResults.map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          role="option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCourseFromSearch(course)}
                        >
                          <strong>{course.name}</strong>
                          <small>{course.code || course.id}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {fieldErrors.courseId ? <small className="batch-management-field-error">{fieldErrors.courseId}</small> : null}
              </label>

              <label className="batch-management-field">
                <span>Faculty Name *</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="search"
                    value={facultySearch}
                    onChange={(event) => handleFacultySearchChange(event.target.value)}
                    placeholder={draft.courseId ? 'Search by faculty ID or name' : 'Select course first'}
                    disabled={!draft.courseId}
                    autoComplete="off"
                  />
                  {facultySearchResults.length ? (
                    <div role="listbox" className="batch-search-results">
                      {facultySearchResults.map((faculty) => (
                        <button
                          key={faculty.id}
                          type="button"
                          role="option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectFacultyFromSearch(faculty)}
                        >
                          <strong>{faculty.name}</strong>
                          <small>{faculty.facultyCode || faculty.id}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {fieldErrors.facultyId ? <small className="batch-management-field-error">{fieldErrors.facultyId}</small> : null}
                
              </label>
            </div>

            <div className="batch-management-form-grid">
              <label className="batch-management-field"><span>Week Type *</span><select value={draft.weekType} onChange={(event) => handleDraftChange('weekType', event.target.value)}><option value="">Select week type</option><option value="WEEKDAY">Weekday</option><option value="WEEKEND">Weekend</option></select>{fieldErrors.weekType ? <small className="batch-management-field-error">{fieldErrors.weekType}</small> : null}</label>
              <label className="batch-management-field"><span>Mode *</span><select value={draft.mode} onChange={(event) => handleDraftChange('mode', event.target.value)}><option value="">Select mode</option><option value="OFFLINE">Offline</option><option value="ONLINE">Online</option></select>{fieldErrors.mode ? <small className="batch-management-field-error">{fieldErrors.mode}</small> : null}</label>
              <label className="batch-management-field"><span>Course Start Date *</span><input type="date" value={draft.courseStartDate} onChange={(event) => handleDraftChange('courseStartDate', event.target.value)} />{fieldErrors.courseStartDate ? <small className="batch-management-field-error">{fieldErrors.courseStartDate}</small> : null}</label>
              <label className="batch-management-field"><span>Course End Date</span><input type="date" value={draft.courseEndDate} readOnly /></label>
            </div>

            <div className="batch-management-details">
              <div className="batch-management-details-head">
                <div>
                  <h4>Batch Details</h4>
                  <p>Create one batch with a single course and faculty.</p>
                </div>
              </div>

              <div className="batch-management-details-grid">
                <div className="batch-management-details-grid-head">
                  <span>Batch Name</span>
                  <span>Batch Timing</span>
                  <span>Total Seats</span>
                  <span>Status</span>
                </div>

                {draft.rows.map((row, index) => (
                  <div key={row.batchId} className="batch-management-row">
                    {(() => {
                      const startParts = getTimePickerParts(row.startTime, row.startPeriod, '09')
                      const endParts = getTimePickerParts(row.endTime, row.endPeriod, '11')

                      return (
                        <>
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
                              <div className="batch-management-time-title">Start</div>
                              <div className="batch-management-time-controls">
                                <label className="batch-management-time-select">
                                  <span className="sr-only">Start hour</span>
                                  <select
                                    value={startParts.hour}
                                    onChange={(event) => handleRowChange(index, 'startTime', `${event.target.value || '09'}:${startParts.minute || '00'}`)}
                                    aria-label="Start hour"
                                  >
                                    <option value="" />
                                    {TIME_HOUR_OPTIONS.map((hour) => (
                                      <option
                                        key={hour}
                                        value={hour}
                                        disabled={isStartTimeOptionDisabled(hour, startParts.minute || '00', startParts.period || row.startPeriod || 'AM', occupiedTimingRanges)}
                                      >
                                        {hour}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="batch-management-time-select">
                                  <span className="sr-only">Start minute</span>
                                  <select
                                    value={startParts.minute}
                                    onChange={(event) => handleRowChange(index, 'startTime', `${startParts.hour || '09'}:${event.target.value || '00'}`)}
                                    aria-label="Start minute"
                                  >
                                    <option value="" />
                                    {TIME_MINUTE_OPTIONS.map((minute) => (
                                      <option
                                        key={minute}
                                        value={minute}
                                        disabled={isStartTimeOptionDisabled(startParts.hour || '09', minute, startParts.period || row.startPeriod || 'AM', occupiedTimingRanges)}
                                      >
                                        {minute}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="batch-management-time-select">
                                  <span className="sr-only">Start AM/PM</span>
                                  <select value={row.startPeriod || ''} onChange={(event) => handleRowChange(index, 'startPeriod', event.target.value || 'AM')} aria-label="Start AM or PM">
                                    <option value="" />
                                    <option
                                      value="AM"
                                      disabled={isStartTimeOptionDisabled(startParts.hour || '09', startParts.minute || '00', 'AM', occupiedTimingRanges)}
                                    >
                                      AM
                                    </option>
                                    <option
                                      value="PM"
                                      disabled={isStartTimeOptionDisabled(startParts.hour || '09', startParts.minute || '00', 'PM', occupiedTimingRanges)}
                                    >
                                      PM
                                    </option>
                                  </select>
                                </label>
                              </div>
                            </div>
                            <span>-</span>
                            <div className="batch-management-time-group">
                              <div className="batch-management-time-title">End</div>
                              <div className="batch-management-time-controls">
                                <label className="batch-management-time-select">
                                  <span className="sr-only">End hour</span>
                                  <select
                                    value={endParts.hour}
                                    onChange={(event) => handleRowChange(index, 'endTime', `${event.target.value || '11'}:${endParts.minute || '00'}`)}
                                    aria-label="End hour"
                                  >
                                    <option value="" />
                                    {TIME_HOUR_OPTIONS.map((hour) => (
                                      <option key={hour} value={hour}>{hour}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="batch-management-time-select">
                                  <span className="sr-only">End minute</span>
                                  <select
                                    value={endParts.minute}
                                    onChange={(event) => handleRowChange(index, 'endTime', `${endParts.hour || '11'}:${event.target.value || '00'}`)}
                                    aria-label="End minute"
                                  >
                                    <option value="" />
                                    {TIME_MINUTE_OPTIONS.map((minute) => (
                                      <option key={minute} value={minute}>{minute}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="batch-management-time-select">
                                  <span className="sr-only">End AM/PM</span>
                                  <select value={row.endPeriod || ''} onChange={(event) => handleRowChange(index, 'endPeriod', event.target.value || 'AM')} aria-label="End AM or PM">
                                    <option value="" />
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                </label>
                              </div>
                            </div>
                            {fieldErrors.rows[index]?.timing ? (
                              <small className="batch-management-row-error">{fieldErrors.rows[index].timing}</small>
                            ) : null}
                          </div>

                          <div className="batch-management-row-seats-wrap">
                            <div className="batch-management-time-title">Seats</div>
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
                            <div className="batch-management-time-title">Status</div>
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

                        </>
                      )
                    })()}
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
                {isSaving ? (isEditingBatch ? 'Updating...' : 'Creating...') : isEditingBatch ? 'Update Batch' : 'Create Batch'}
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
    const targetGroup = deleteGroupTarget
    if (!targetGroup) return null

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
            <h3 id="batch-delete-title">Are you sure you want to delete this batch?</h3>
            <p className="batch-delete-confirm-subtitle">
              <><strong>{targetGroup.courseName || targetGroup.batchId || 'This batch'}</strong> will be removed.</>
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
              onClick={confirmDeleteGroup}
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
    const detailBatch = getPrimaryBatchForGroup(detailGroup)
    const detailBatchKey = getBatchSeatMapKey(detailBatch, detailGroup)
    const detailStudents = getMatchingStudents(branchStudents, {
      facultyId: detailGroup?.facultyId || detailGroup?.branchFacultyId || '',
      facultyName: detailGroup?.facultyName || '',
      courseId: detailGroup?.courseId || detailGroup?.branchCourseId || '',
      courseName: detailGroup?.courseName || '',
      batchGroupId: detailGroup?.batchGroupId || detailGroup?.id || '',
      batchId: detailBatch?.batchId || detailBatch?.id || '',
      batchName: detailBatch?.batchName || '',
      batchTiming: detailBatch?.batchTiming || '',
    })
    const detailStatus = normalizeStatus(detailGroup.status || 'Active')
    const detailStatusClass = String(detailStatus).toLowerCase()

    return createPortal(
      <div className="branch-modal-backdrop batch-modal-backdrop" role="presentation">
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
                <h3 id="batch-detail-title">{detailGroup.batchId || detailGroup.batchGroupId}</h3>
                <span className={`batch-detail-status-pill ${detailStatusClass}`}>{detailStatus}</span>
              </div>

              <div className="batch-detail-hero-meta">
                <span>Course: <strong>{detailGroup.courseName || '-'}</strong></span>
                <span>Faculty: <strong>{detailGroup.facultyName || '-'}</strong></span>
              </div>
            </div>
          </div>

          <div className={`batch-detail-list batch-students-modal-list ${detailStudents.length === 1 ? 'has-single-student' : ''}`.trim()}>
            <h4 className="batch-detail-list-title">Assigned Learners</h4>
            <strong className="batch-students-modal-count">
              {detailStudents.length} student{detailStudents.length === 1 ? '' : 's'} in this batch
            </strong>
            {detailStudents.length ? (
              <div className="batch-detail-students-list">
                {detailStudents.map((student, index) => {
                  const attendanceKey = normalizeMatchKey(student?.studentId || student?.id || student?._id || '')
                  const attendanceStatus = detailAttendanceStatuses[attendanceKey] || 'UNMARKED'
                  return (
                    <div className="batch-detail-student-row" key={getStudentIdentityKey(student) || `${detailBatchKey}-${index}`}>
                    <span className="batch-detail-student-number">{String(index + 1).padStart(2, '0')}</span>
                    <div className="batch-detail-student-copy">
                      <span>{student?.studentId || student?.id || 'Student ID unavailable'}</span>
                      <strong>{student?.studentName || student?.name || 'Unnamed student'}</strong>
                    </div>
                    <span className={`batch-detail-student-attendance ${attendanceStatus.toLowerCase()}`}>
                      {attendanceStatus === 'PRESENT' ? 'Present' : attendanceStatus === 'ABSENT' ? 'Absent' : 'Unmarked'}
                    </span>
                    <div className="batch-detail-student-progress">
                      <div className="batch-detail-student-progress-label">
                        <span>Course Progress</span>
                        <strong>{Number(student?.courseProgress ?? student?.progress ?? 0) || 0}%</strong>
                      </div>
                      <div className="batch-detail-student-progress-track" aria-hidden="true">
                        <span style={{ width: `${Math.min(Math.max(Number(student?.courseProgress ?? student?.progress ?? 0) || 0, 0), 100)}%` }} />
                      </div>
                    </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="batch-detail-students-empty">No students assigned to this batch yet.</div>
            )}
          </div>
        </section>
      </div>,
      document.body,
    )
  }

  const renderBatchRow = (group) => {
    const primaryBatch = group.displayBatch || (Array.isArray(group.batches) ? group.batches[0] : null) || {}
    const batchKey = getBatchSeatMapKey(primaryBatch, group)
    const batchStatusClass = String(normalizeStatus(primaryBatch.status || group.status || 'Active')).toLowerCase()
    const rawSeatSummary = batchSeatSummaryMap.get(batchKey) || getBatchSeatSummary({
      ...primaryBatch,
      batchGroupId: String(group?.batchGroupId || group?.id || '').trim(),
      courseId: String(group?.courseId || group?.branchCourseId || '').trim(),
      courseName: String(group?.courseName || '').trim(),
      facultyId: String(group?.facultyId || group?.branchFacultyId || '').trim(),
      facultyName: String(group?.facultyName || '').trim(),
    }, branchStudents)
    // Capacity belongs to this batch record; never inherit the total from a
    // stale/colliding summary entry.
    const batchTotalSeats = Math.max(Number(primaryBatch?.totalSeats || 0) || 0, 0)
    const baseSeatSummary = {
      ...rawSeatSummary,
      totalSeats: batchTotalSeats,
      remainingSeats: Math.max(batchTotalSeats - rawSeatSummary.usedSeats, 0),
    }
    const batchStudents = getMatchingStudents(branchStudents, {
      facultyId: group?.facultyId || group?.branchFacultyId || '',
      facultyName: group?.facultyName || '',
      courseId: group?.courseId || group?.branchCourseId || '',
      courseName: group?.courseName || '',
      batchGroupId: group?.batchGroupId || group?.id || '',
      batchId: primaryBatch?.batchId || primaryBatch?.id || '',
      batchName: primaryBatch?.batchName || '',
      batchTiming: primaryBatch?.batchTiming || '',
    })
    const seatSummary = {
      ...baseSeatSummary,
      usedSeats: batchStudents.length,
      remainingSeats: Math.max(batchTotalSeats - batchStudents.length, 0),
    }
    const groupKey = String(group.id || group.batchGroupId || group.batchId || primaryBatch.batchId || '')
    const statusLabel = isInactiveBatchGroup(group) ? 'Inactive' : 'Active'

    return (
      <Fragment key={groupKey}>
        <tr
          className="batch-management-table-row"
        >
          <td className="batch-management-table-cell batch-management-table-batch">
            <div className="batch-management-table-batch-copy">
              <span
                className={`batch-management-status-dot ${batchStatusClass === 'active' || batchStatusClass === 'open' ? 'is-active' : 'is-inactive'}`.trim()}
                data-status={batchStatusClass === 'active' || batchStatusClass === 'open' ? 'Active' : 'Inactive'}
                aria-label={batchStatusClass === 'active' || batchStatusClass === 'open' ? 'Active' : 'Inactive'}
              />
              <div>
                <strong>{primaryBatch.batchId || group.batchId || '-'}</strong>
                <span>{primaryBatch.batchName || primaryBatch.batchId || '-'}</span>
              </div>
            </div>
          </td>
          <td className="batch-management-table-cell batch-management-table-course">
            <strong>{group.courseName || '-'}</strong>
          </td>
          <td className="batch-management-table-cell batch-management-table-faculty">
            <strong>{group.facultyName || '-'}</strong>
          </td>
          <td className="batch-management-table-cell batch-management-table-schedule">
            <strong>{formatClockLabel(primaryBatch.startTime)} - {formatClockLabel(primaryBatch.endTime)}</strong>
            <span>Timing</span>
          </td>
          <td className="batch-management-table-cell batch-management-table-seats">
            <strong>{seatSummary.usedSeats}/{seatSummary.totalSeats || 0}</strong>
            <div className="batch-management-table-track" aria-hidden="true">
              <span style={{ width: `${seatSummary.totalSeats ? Math.min((seatSummary.usedSeats / seatSummary.totalSeats) * 100, 100) : 0}%` }} />
            </div>
            <span>{seatSummary.remainingSeats} left</span>
            <small>{primaryBatch.weekType === 'WEEKEND' ? 'Weekend' : 'Weekday'} · {primaryBatch.mode === 'ONLINE' ? 'Online' : 'Offline'}</small>
          </td>
          <td className="batch-management-table-cell batch-management-table-students">
            <strong>{batchStudents.length}</strong>
          </td>
          <td className="batch-management-table-cell batch-management-table-status">
            <span className={`batch-management-status-pill ${statusLabel.toLowerCase()}`}>{statusLabel}</span>
          </td>
          <td className="batch-management-table-cell batch-management-actions-cell">
            <div className="batch-management-actions" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="batch-management-actions-trigger"
                aria-label={`Open actions for ${primaryBatch.batchName || group.batchId || 'batch'}`}
                onClick={(event) => {
                  const actionId = String(group.id || group.batchGroupId || group.batchId || '')
                  if (actionMenuOpenId === actionId) closeActionMenu()
                  else openActionMenu(group, event.currentTarget)
                }}
              >
                <MoreVertical size={16} strokeWidth={2.3} aria-hidden="true" />
              </button>
            </div>
          </td>
        </tr>
      </Fragment>
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
            placeholder="Search batch"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setBatchTablePage(1)
            }}
          />
          <button type="submit" className="button button-solid batch-management-search-button">
            Search
          </button>
        </div>
      </form>

      <div className="batch-management-table-shell">
        <div className="batch-management-table-wrap">
          <table className="batch-management-table" aria-label="Batch management table">
            <thead>
              <tr className="batch-management-table-head">
                <th>Batch</th>
                <th>Course</th>
                <th>Faculty</th>
                <th>Timing</th>
                <th>Seats</th>
                <th>Students</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedGroups.length ? (
                paginatedGroups.map(renderBatchRow)
              ) : (
                <tr>
                  <td colSpan={8} className="batch-management-empty-cell">
                    {isLoading ? 'Loading batches...' : 'No batches created yet. Use Create Batch to add the first batch.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
