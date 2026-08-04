import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Check, Clock3, Eye, FileDown, Layers3, Mail, MoreVertical, PencilLine, Phone, Save, Trash2, UserRound, UsersRound, X } from 'lucide-react'
import { Button } from '../components/Button'
import { OperationManagerHeader } from '../components/OperationManagerHeader'
import { OperationManagerWorkspaceHeader } from '../components/OperationManagerWorkspaceHeader'
import { SearchBar } from '../components/SearchBar'
import { PaginationBar } from '../components/PaginationBar'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords } from '../data/courseRecords'
import { FACULTY_RECORD_SYNC_EVENT, loadFacultyRecords } from '../data/facultyRecords'
import { listCourses, normalizeCourseList } from '../services/courseService'
import {
  createFacultyRecord,
  deleteFacultyRecord,
  listFacultyRecords,
  normalizeFacultyList,
  updateFacultyRecord,
} from '../services/facultyService'
import { roleDashboards } from '../data/authData'
import { useAuth } from '../auth/useAuth'
import { FACULTY_ATTENDANCE_SYNC_EVENT, resolveTodayFacultyAttendanceStatus, formatAttendanceTimeLabel } from '../lib/facultyAttendanceStore'
import { saveFacultySnapshot } from '../lib/facultySnapshot'
import { buildFacultyCourseCatalogPath, getFacultyCourseIds } from '../lib/facultyFlow'
import { FacultyAttendanceReportModal } from '../components/FacultyAttendanceReportModal'
import { useMobileMenu } from '../layouts/mobileMenuContext'

function createEmptyForm() {
  return {
    facultyName: '',
    facultyEmail: '',
    facultyPhone: '',
    courseId: '',
    courseIds: [],
    status: 'Active',
    batchCourseId: '',
    batchEntries: [],
    batchName: '',
    batchTiming: '',
    batchTimingCustomStart: '',
    batchTimingCustomStartMeridiem: 'AM',
    batchTimingCustomEnd: '',
    batchTimingCustomEndMeridiem: 'PM',
  }
}

const BATCH_TIMING_OPTIONS = [
  '09.30 AM - 11.30 AM',
  '12.00 PM - 2.00 PM',
  '2.30 PM - 3.30 PM',
  '4.00 PM - 6.00 PM',
  '6.30 PM - 7.30 PM',
]
const FACULTY_WIZARD_STEPS = [
  {
    key: 'faculty',
    step: '01',
    title: 'Faculty Information',
    subtitle: 'Active Course Mapping',
    description: 'Enter the faculty details and map them to an active course.',
  },
  {
    key: 'batch',
    step: '02',
    title: 'Batch Management',
    subtitle: 'Add New Batch',
    description: 'Create one or more batches before saving the faculty record.',
  },
]
const FACULTY_STEP_ONE_FIELDS = ['facultyName', 'facultyEmail', 'facultyPhone', 'courseId', 'status']

function createEmptyBatchTimingState() {
  return {
    batchTimingPreset: '',
    batchTimingCustomStart: '',
    batchTimingCustomStartMeridiem: 'AM',
    batchTimingCustomEnd: '',
    batchTimingCustomEndMeridiem: 'PM',
  }
}

function parseBatchTimingState(batchTiming = '') {
  const normalizedTiming = String(batchTiming || '').trim()

  if (BATCH_TIMING_OPTIONS.includes(normalizedTiming)) {
    return {
      ...createEmptyBatchTimingState(),
      batchTimingPreset: normalizedTiming,
    }
  }

  const customMatch = normalizedTiming.match(/^(\d{1,2}[:.]\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}[:.]\d{2})\s*(AM|PM)$/i)
  if (customMatch) {
    return {
      batchTimingPreset: 'Custom',
      batchTimingCustomStart: customMatch[1].replace('.', ':'),
      batchTimingCustomStartMeridiem: customMatch[2].toUpperCase(),
      batchTimingCustomEnd: customMatch[3].replace('.', ':'),
      batchTimingCustomEndMeridiem: customMatch[4].toUpperCase(),
    }
  }

  return createEmptyBatchTimingState()
}

function formatBatchTimingState(entry = {}) {
  const preset = String(entry.batchTimingPreset || '').trim()
  if (preset && preset !== 'Custom') return preset

  const start = String(entry.batchTimingCustomStart || '').trim()
  const startMeridiem = String(entry.batchTimingCustomStartMeridiem || 'AM').trim()
  const end = String(entry.batchTimingCustomEnd || '').trim()
  const endMeridiem = String(entry.batchTimingCustomEndMeridiem || 'PM').trim()
  if (!start || !end) return ''

  return `${start} ${startMeridiem} - ${end} ${endMeridiem}`
}

function getBatchSequenceNoFromName(batchName = '') {
  const normalizedBatchName = String(batchName || '').trim()
  if (!normalizedBatchName) return 0

  const match = normalizedBatchName.match(/\bbatch\s*(\d+)\b/i)
  if (!match) return 0

  const sequenceNo = Number(match[1])
  return Number.isFinite(sequenceNo) && sequenceNo > 0 ? sequenceNo : 0
}

function getBatchTimingPresetValue(entry = {}) {
  const preset = String(entry.batchTimingPreset || '').trim()
  if (preset) return preset

  return parseBatchTimingState(entry.batchTiming).batchTimingPreset || ''
}

function getSuggestedBatchName(facultyName, batchEntries = [], fallback = '') {
  const baseName = String(facultyName || '').trim()
  const preferred = String(fallback || '').trim()

  if (preferred) {
    return preferred
  }

  if (!baseName) {
    return ''
  }

  const usedNames = new Set(
    batchEntries
      .map((entry) => String(entry?.batchName || '').trim().toLowerCase())
      .filter(Boolean),
  )

  for (let index = 1; index <= 100; index += 1) {
    const nextName = `${baseName} batch ${index}`
    if (!usedNames.has(nextName.toLowerCase())) {
      return nextName
    }
  }

  return `${baseName} batch ${batchEntries.length + 1}`
}

function getBatchTimingValidationError(form) {
  const batchTiming = String(form?.batchTiming || '').trim()
  const batchTimingCustomStart = String(form?.batchTimingCustomStart || '').trim()
  const batchTimingCustomEnd = String(form?.batchTimingCustomEnd || '').trim()

  if (!batchTiming) {
    return 'Batch timing is required.'
  }

  if (batchTiming === 'Custom' && (!batchTimingCustomStart || !batchTimingCustomEnd)) {
    return 'Batch timing is required.'
  }

  return ''
}

function resolveBatchEntryFromForm(form, batchEntries = [], entryId = '') {
  const batchName = getSuggestedBatchName(form.facultyName, batchEntries, form.batchName)
  const batchTiming = String(form.batchTiming || '').trim()
  const batchTimingCustomStart = String(form.batchTimingCustomStart || '').trim()
  const batchTimingCustomStartMeridiem = String(form.batchTimingCustomStartMeridiem || 'AM').trim()
  const batchTimingCustomEnd = String(form.batchTimingCustomEnd || '').trim()
  const batchTimingCustomEndMeridiem = String(form.batchTimingCustomEndMeridiem || 'PM').trim()
  const batchCourseId = String(form.batchCourseId || form.courseIds[0] || form.courseId || '').trim()

  const resolvedBatchTiming =
    batchTiming === 'Custom'
      ? batchTimingCustomStart && batchTimingCustomEnd
        ? `${batchTimingCustomStart} ${batchTimingCustomStartMeridiem} - ${batchTimingCustomEnd} ${batchTimingCustomEndMeridiem}`
        : ''
      : batchTiming

  if (!batchName || !batchTiming || !resolvedBatchTiming || !batchCourseId) {
    return null
  }

  return {
    id: String(entryId || '').trim() || createBatchEntryId(),
    batchName,
    batchTiming: resolvedBatchTiming,
    courseId: batchCourseId,
    sequenceNo: getBatchSequenceNoFromName(batchName) || getBatchSequenceNoFromName(form.batchName) || 1,
    ...parseBatchTimingState(resolvedBatchTiming),
  }
}

function sameBatchEntry(a, b) {
  return (
    String(a?.batchName || '').trim().toLowerCase() === String(b?.batchName || '').trim().toLowerCase() &&
    String(a?.batchTiming || '').trim().toLowerCase() === String(b?.batchTiming || '').trim().toLowerCase()
  )
}

function hasDuplicateBatchName(batchEntries = [], batchName = '', courseId = '', ignoreEntryId = '') {
  const normalizedBatchName = String(batchName || '').trim().toLowerCase()
  const normalizedCourseId = String(courseId || '').trim()
  if (!normalizedBatchName) return false

  const normalizedIgnoreEntryId = String(ignoreEntryId || '').trim()
  return Array.isArray(batchEntries)
    ? batchEntries.some((entry) => {
        if (normalizedIgnoreEntryId && String(entry?.id || '').trim() === normalizedIgnoreEntryId) return false
        if (normalizedCourseId && String(entry?.courseId || '').trim() !== normalizedCourseId) return false
        return String(entry?.batchName || '').trim().toLowerCase() === normalizedBatchName
      })
    : false
}

function getAvailableBatchTimingOptions(batchEntries = [], ignoreEntryId = '') {
  const normalizedIgnoreEntryId = String(ignoreEntryId || '').trim()
  const usedPresetTimings = new Set(
    batchEntries
      .filter((entry) => {
        if (!normalizedIgnoreEntryId) return true
        return String(entry?.id || '').trim() !== normalizedIgnoreEntryId
      })
      .map((entry) => getBatchTimingPresetValue(entry))
      .filter((timing) => BATCH_TIMING_OPTIONS.includes(timing)),
  )

  return BATCH_TIMING_OPTIONS.filter((option) => !usedPresetTimings.has(option))
}

function getBatchEntriesForCourse(batchEntries = [], courseId = '') {
  const normalizedCourseId = String(courseId || '').trim()
  if (!normalizedCourseId) return []

  return Array.isArray(batchEntries)
    ? batchEntries.filter((entry) => String(entry?.courseId || '').trim() === normalizedCourseId)
    : []
}

function getCourseNameById(courseId, courseOptions = []) {
  const normalizedCourseId = String(courseId || '').trim()
  if (!normalizedCourseId) return ''
  return courseOptions.find((course) => String(course?.id || '').trim() === normalizedCourseId)?.name || ''
}

function useFacultyAttendanceRefreshToken() {
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncFacultyAttendance = () => {
      setRefreshToken((current) => current + 1)
    }

    window.addEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, syncFacultyAttendance)
    window.addEventListener('storage', syncFacultyAttendance)

    return () => {
      window.removeEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, syncFacultyAttendance)
      window.removeEventListener('storage', syncFacultyAttendance)
    }
  }, [])

  return refreshToken
}

function getGroupedBatchEntriesByCourse(batchEntries = [], courseOptions = [], courseIds = []) {
  const normalizedEntries = Array.isArray(batchEntries) ? batchEntries : []
  const normalizedCourseIds = Array.isArray(courseIds)
    ? courseIds.map((courseId) => String(courseId || '').trim()).filter(Boolean)
    : []

  const groups = new Map()
  const courseLookup = new Map(courseOptions.map((course) => [String(course?.id || '').trim(), String(course?.name || '').trim()]))

  const ensureGroup = (groupKey, courseId, courseName) => {
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        courseId,
        courseName,
        entries: [],
      })
    }

    return groups.get(groupKey)
  }

  normalizedCourseIds.forEach((courseId) => {
    const courseName = courseLookup.get(courseId) || getCourseNameById(courseId, courseOptions) || courseId
    ensureGroup(courseId, courseId, courseName)
  })

  normalizedEntries.forEach((entry, index) => {
    const resolvedCourseId =
      String(entry?.courseId || '').trim() ||
      getCourseIdByName(entry?.courseName || '', courseOptions) ||
      ''
    const resolvedCourseName =
      getCourseNameById(resolvedCourseId, courseOptions) ||
      String(entry?.courseName || '').trim() ||
      'Unassigned'
    const groupKey = resolvedCourseId || `__entry_${index}`
    const group = ensureGroup(groupKey, resolvedCourseId, resolvedCourseName)
    group.entries.push(entry)
  })

  return Array.from(groups.values())
    .filter((group) => group.entries.length)
    .map((group) => ({
      ...group,
      entries: group.entries.slice().sort((left, right) => {
        const leftName = String(left?.batchName || '').toLowerCase()
        const rightName = String(right?.batchName || '').toLowerCase()
        return leftName.localeCompare(rightName)
      }),
    }))
}

function getCourseIdByName(courseName, courseOptions = []) {
  const normalizedCourseName = String(courseName || '').trim().toLowerCase()
  if (!normalizedCourseName) return ''
  return courseOptions.find((course) => String(course?.name || '').trim().toLowerCase() === normalizedCourseName)?.id || ''
}

function getFacultyAttendanceReasonLabel(attendance = {}) {
  if (String(attendance?.logoutType || '').trim().toLowerCase() !== 'early') return ''
  const reason = String(attendance?.logoutReason || '').trim()
  return reason ? `Reason: ${reason}` : ''
}

function getFacultyAttendanceWorkedDurationLabel(attendance = {}) {
  const loginDateTime = attendance?.loginDateTime instanceof Date ? attendance.loginDateTime : attendance?.loginDateTime ? new Date(attendance.loginDateTime) : null
  if (!loginDateTime || Number.isNaN(loginDateTime.getTime())) return '-'

  const logoutDateTime = attendance?.logoutDateTime instanceof Date ? attendance.logoutDateTime : attendance?.logoutDateTime ? new Date(attendance.logoutDateTime) : null
  const endDateTime = logoutDateTime && !Number.isNaN(logoutDateTime.getTime()) ? logoutDateTime : new Date()
  const diffMs = Math.max(0, endDateTime.getTime() - loginDateTime.getTime())
  const totalMinutes = Math.max(1, Math.floor(diffMs / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${hours}h ${minutes}m`
}

function getFacultyAttendanceOverviewBadgeLabel(attendance = {}) {
  if (attendance?.logoutDateTime) return 'Logout'
  if (attendance?.loginDateTime) return 'Login'
  return 'Login'
}

function getFacultyAttendanceOverviewBadgeTone(attendance = {}) {
  return attendance?.logoutDateTime ? 'is-absent' : 'is-present'
}

function apiErrorMessage(error, fallback) {
  return error?.body?.message || error?.message || fallback
}

function FacultyField({ label, required = false, error, icon, children, className = '' }) {
  return (
    <label className={`course-field faculty-field ${icon ? 'faculty-field-has-icon' : ''} ${className}`.trim()}>
      <span>
        {label}
        {required ? <b>*</b> : null}
      </span>
      <div className="faculty-field-control">
        {icon ? <span className="faculty-field-icon">{icon}</span> : null}
        {children}
      </div>
      {error ? <small className="course-field-error">{error}</small> : null}
    </label>
  )
}

function getCourseSelectionNames(courseSource = [], courseOptions = []) {
  const record = Array.isArray(courseSource) ? null : courseSource || null
  const normalizedIds = Array.isArray(courseSource)
    ? courseSource.map((id) => String(id || '').trim()).filter(Boolean)
    : getFacultyCourseIds(courseSource, courseOptions)
  if (!normalizedIds.length) return []

  const optionsById = new Map(courseOptions.map((course) => [String(course?.id || '').trim(), String(course?.name || '').trim()]))
  const batchCourseNamesById = new Map()

  if (record && Array.isArray(record.batchEntries)) {
    record.batchEntries.forEach((entry) => {
      const courseId = String(entry?.courseId || '').trim()
      if (!courseId || batchCourseNamesById.has(courseId)) return

      batchCourseNamesById.set(courseId, String(entry?.courseName || '').trim())
    })
  }

  return normalizedIds
    .map((courseId, index) =>
      optionsById.get(courseId) ||
      batchCourseNamesById.get(courseId) ||
      (index === 0 ? String(record?.courseName || '').trim() : '') ||
      courseId,
    )
    .filter(Boolean)
}

function getCoursePreviewNames(courseSource = [], courseOptions = []) {
  const courseNames = getCourseSelectionNames(courseSource, courseOptions)
  return {
    primaryCourseName: courseNames[0] || '',
    extraCourseNames: courseNames.slice(1),
  }
}

function mergeCourseOptions(courseOptions = [], courseLabelOverrides = {}) {
  const mergedOptions = new Map()

  courseOptions.forEach((course) => {
    const courseId = String(course?.id || '').trim()
    if (!courseId) return

    mergedOptions.set(courseId, {
      ...course,
      id: courseId,
      name: String(course?.name || '').trim() || courseId,
    })
  })

  Object.entries(courseLabelOverrides || {}).forEach(([courseId, courseName]) => {
    const normalizedCourseId = String(courseId || '').trim()
    if (!normalizedCourseId) return

    const normalizedCourseName = String(courseName || '').trim()
    const existingCourse = mergedOptions.get(normalizedCourseId)

    if (existingCourse) {
      if (!String(existingCourse.name || '').trim() && normalizedCourseName) {
        mergedOptions.set(normalizedCourseId, {
          ...existingCourse,
          name: normalizedCourseName,
        })
      }
      return
    }

    mergedOptions.set(normalizedCourseId, {
      id: normalizedCourseId,
      name: normalizedCourseName || normalizedCourseId,
      status: 'active',
    })
  })

  return Array.from(mergedOptions.values())
}

function upsertFacultyRecordById(records = [], nextRecord = null) {
  if (!nextRecord) return Array.isArray(records) ? records : []

  const normalizedNextId = String(nextRecord.id || '').trim()
  if (!normalizedNextId) {
    return [nextRecord, ...(Array.isArray(records) ? records : [])]
  }

  const nextRecords = Array.isArray(records) ? records.filter((record) => String(record?.id || '').trim() !== normalizedNextId) : []
  return [nextRecord, ...nextRecords]
}

function CourseCheckboxSelect({
  label,
  required = false,
  error,
  icon,
  selectedCourseIds = [],
  courseOptions = [],
  courseLabelOverrides = {},
  isLoading = false,
  disabled = false,
  placeholder = 'Select course',
  onChange,
  onBlur,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)
  const normalizedSelectedIds = Array.isArray(selectedCourseIds) ? selectedCourseIds.map((id) => String(id || '').trim()).filter(Boolean) : []
  const selectedIdSet = new Set(normalizedSelectedIds)
  const resolvedCourseOptions = useMemo(
    () => mergeCourseOptions(courseOptions, courseLabelOverrides),
    [courseLabelOverrides, courseOptions],
  )
  const selectedCourseNames = resolvedCourseOptions
    .filter((course) => selectedIdSet.has(String(course?.id || '').trim()))
    .map((course) => String(course?.name || '').trim())
    .filter(Boolean)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
        onBlur?.()
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        onBlur?.()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onBlur])

  const toggleCourse = (courseId) => {
    const nextIds = selectedIdSet.has(courseId)
      ? normalizedSelectedIds.filter((id) => id !== courseId)
      : [...normalizedSelectedIds, courseId]

    onChange?.(nextIds)
  }

  return (
    <div className={`course-field faculty-field faculty-course-multi ${compact ? 'compact' : ''}`.trim()} ref={wrapperRef}>
      <span>
        {label}
        {required ? <b>*</b> : null}
      </span>

      <div className="faculty-course-multi-control">
        <button
          ref={triggerRef}
          type="button"
          className="faculty-course-multi-trigger"
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled || isLoading}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {icon ? <span className="faculty-course-multi-icon">{icon}</span> : null}
          <span className={`faculty-course-multi-value ${selectedCourseNames.length ? '' : 'placeholder'}`.trim()}>
            {isLoading ? 'Loading courses...' : selectedCourseNames.length ? selectedCourseNames.join(', ') : placeholder}
          </span>
          <span className="faculty-course-multi-caret" aria-hidden="true" />
        </button>

        {isOpen ? (
          <div className="faculty-course-multi-menu" role="listbox" aria-multiselectable="true">
            {!isLoading && resolvedCourseOptions.length ? (
              resolvedCourseOptions.map((course) => {
                const courseId = String(course?.id || '').trim()
                const checked = selectedIdSet.has(courseId)

                return (
                  <label key={courseId} className={`faculty-course-option ${checked ? 'is-selected' : ''}`.trim()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCourse(courseId)}
                      disabled={disabled}
                    />
                    <span>{course?.name || 'Unnamed course'}</span>
                  </label>
                )
              })
            ) : (
              <div className="faculty-course-empty">{isLoading ? 'Loading courses...' : 'No active courses available'}</div>
            )}
          </div>
        ) : null}
      </div>

      {error ? <small className="course-field-error">{error}</small> : null}
    </div>
  )
}

export function FacultyInlineEditorTable({
  form,
  existingRecord,
  isCoursesLoading,
  activeCourseOptions,
  courseLabelOverrides,
  validationErrors,
  shouldShowError,
  updateField,
  markTouched,
  addBatchEntry,
  onChangeCourseIds,
  setForm,
  onRequestBatchDelete,
  onCancel,
  onSubmitIntent,
  isSubmitting,
}) {
  const availableBatchTimingOptions = getAvailableBatchTimingOptions(
    Array.isArray(form.batchEntries) && form.batchEntries.length ? form.batchEntries : existingRecord?.batchEntries || [],
  )

  const fallbackBatchEntries = useMemo(() => {
    if (Array.isArray(form.batchEntries) && form.batchEntries.length) return form.batchEntries
    if (!Array.isArray(existingRecord?.batchEntries) || !existingRecord.batchEntries.length) return []

    return existingRecord.batchEntries.map((entry) => ({
      id: entry.id || createBatchEntryId(),
      batchName: String(entry.batchName || '').trim(),
      batchTiming: String(entry.batchTiming || '').trim(),
      courseId: String(entry.courseId || existingRecord?.courseId || existingRecord?.courseIds?.[0] || '').trim(),
      courseName: String(entry.courseName || existingRecord?.courseName || '').trim(),
      ...parseBatchTimingState(entry.batchTiming),
    }))
  }, [existingRecord, form.batchEntries])

  const editableBatchEntries = fallbackBatchEntries
  const groupedEditableBatchEntries = useMemo(
    () => getGroupedBatchEntriesByCourse(editableBatchEntries, activeCourseOptions, form.courseIds),
    [editableBatchEntries, activeCourseOptions, form.courseIds],
  )

  const updateBatchEntry = (entryId, field, value) => {
    setForm((current) => ({
      ...current,
      batchEntries: current.batchEntries.map((entry) =>
        entry.id === entryId ? { ...entry, [field]: value } : entry,
      ),
    }))
  }

  const updateBatchTimingEntry = (entryId, nextTiming) => {
    setForm((current) => ({
      ...current,
      batchEntries: current.batchEntries.map((entry) => {
        if (entry.id !== entryId) return entry

        if (nextTiming === 'Custom') {
          return {
            ...entry,
            batchTimingPreset: 'Custom',
          }
        }

        return {
          ...entry,
          batchTimingPreset: nextTiming,
          batchTimingCustomStart: '',
          batchTimingCustomStartMeridiem: 'AM',
          batchTimingCustomEnd: '',
          batchTimingCustomEndMeridiem: 'PM',
        }
      }),
    }))
  }

  const updateBatchTimingCustomField = (entryId, field, value) => {
    setForm((current) => ({
      ...current,
      batchEntries: current.batchEntries.map((entry) =>
        entry.id === entryId ? { ...entry, batchTimingPreset: 'Custom', [field]: value } : entry,
      ),
    }))
  }

  return (
    <>
      <div className="faculty-view-table-shell faculty-view-table-shell-edit">
        <table className="faculty-details-table faculty-details-table-edit">
          <tbody>
            <tr>
              <th>Faculty Name</th>
              <td>
                <input
                  className="faculty-inline-input"
                  type="text"
                  placeholder="Enter faculty name"
                  value={form.facultyName}
                  onChange={(event) => {
                    const value = event.target.value
                    const autoBatchName = value.trim() ? getSuggestedBatchName(value.trim(), form.batchEntries) : ''
                    updateField('facultyName', value)
                    updateField('batchName', autoBatchName)
                  }}
                  onBlur={() => markTouched('facultyName')}
                  aria-invalid={Boolean(shouldShowError('facultyName'))}
                />
              </td>
              <th>Status</th>
              <td>
                <select
                  className="faculty-inline-input"
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  onBlur={() => markTouched('status')}
                  aria-invalid={Boolean(shouldShowError('status'))}
                >
                  <option value="">Select status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </td>
            </tr>
            <tr>
              <th>Faculty Email</th>
              <td>
                <input
                  className="faculty-inline-input"
                  type="email"
                  placeholder="Enter faculty email"
                  value={form.facultyEmail}
                  onChange={(event) => updateField('facultyEmail', event.target.value)}
                  onBlur={() => markTouched('facultyEmail')}
                  aria-invalid={Boolean(shouldShowError('facultyEmail'))}
                />
              </td>
              <th>Faculty Phone Number</th>
              <td>
                <input
                  className="faculty-inline-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter faculty phone number"
                  value={form.facultyPhone}
                  onChange={(event) => updateField('facultyPhone', event.target.value.replace(/\D/g, '').slice(0, 10))}
                  onBlur={() => markTouched('facultyPhone')}
                  aria-invalid={Boolean(shouldShowError('facultyPhone'))}
                />
              </td>
            </tr>
            <tr>
              <th>Course</th>
              <td>
                  <CourseCheckboxSelect
                    compact
                    label="Select course"
                    icon={<BookOpen />}
                    error={shouldShowError('courseId') ? validationErrors.courseId : ''}
                    selectedCourseIds={form.courseIds}
                    courseOptions={activeCourseOptions}
                    courseLabelOverrides={courseLabelOverrides}
                    isLoading={isCoursesLoading}
                    placeholder={isCoursesLoading ? 'Loading courses...' : 'Select course'}
                    onChange={onChangeCourseIds}
                    onBlur={() => markTouched('courseId')}
                  />
              </td>
              <th>Total Batches</th>
              <td>{form.batchEntries.length}</td>
            </tr>
          </tbody>
        </table>

        <div className="faculty-view-batch-section">
          <div className="faculty-view-batch-header">
            <div>
              <h4>Batch Details</h4>
              <p>Edit the batch rows directly in the table below.</p>
            </div>
          </div>

          <table className="faculty-batch-details-table faculty-batch-details-table-edit">
            <thead>
              <tr>
                <th>S.NO</th>
                <th>Batch Name</th>
                <th>Batch Timing</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {groupedEditableBatchEntries.map((group) => (
                <Fragment key={group.groupKey}>
                  <tr className="faculty-batch-group-divider-row">
                    <td colSpan={4}>
                      <div className="faculty-batch-group-divider-copy">
                        <strong>{group.courseName || 'Course'}</strong>
                        <span>{group.entries.length} Batches</span>
                      </div>
                    </td>
                  </tr>
                  {group.entries.map((entry, index) => (
                    <tr key={entry.id || `${group.groupKey}-${index}`}>
                      <td>{index + 1}</td>
                      <td className="faculty-batch-edit-name-cell">
                        <input
                          className="faculty-inline-input"
                          type="text"
                          value={entry.batchName || ''}
                          onChange={(event) => updateBatchEntry(entry.id, 'batchName', event.target.value)}
                        />
                      </td>
                      <td>
                        <div className="faculty-inline-batch-timing">
                          <select
                            className="faculty-inline-input"
                            value={entry.batchTimingPreset || parseBatchTimingState(entry.batchTiming).batchTimingPreset || ''}
                            onChange={(event) => updateBatchTimingEntry(entry.id, event.target.value)}
                          >
                            <option value="">Select timing</option>
                            {BATCH_TIMING_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                            <option value="Custom">Custom</option>
                          </select>

                          {(entry.batchTimingPreset || parseBatchTimingState(entry.batchTiming).batchTimingPreset) === 'Custom' ? (
                            <div className="faculty-inline-custom-timing">
                              <div className="faculty-inline-custom-timing-side">
                                <input
                                  className="faculty-inline-input"
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="09:30"
                                  value={entry.batchTimingCustomStart || ''}
                                  onChange={(event) =>
                                    updateBatchTimingCustomField(entry.id, 'batchTimingCustomStart', event.target.value)
                                  }
                                />
                                <select
                                  className="faculty-inline-input"
                                  value={entry.batchTimingCustomStartMeridiem || 'AM'}
                                  onChange={(event) =>
                                    updateBatchTimingCustomField(entry.id, 'batchTimingCustomStartMeridiem', event.target.value)
                                  }
                                >
                                  <option value="AM">AM</option>
                                  <option value="PM">PM</option>
                                </select>
                              </div>
                              <span aria-hidden="true">-</span>
                              <div className="faculty-inline-custom-timing-side">
                                <input
                                  className="faculty-inline-input"
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="06:30"
                                  value={entry.batchTimingCustomEnd || ''}
                                  onChange={(event) =>
                                    updateBatchTimingCustomField(entry.id, 'batchTimingCustomEnd', event.target.value)
                                  }
                                />
                                <select
                                  className="faculty-inline-input"
                                  value={entry.batchTimingCustomEndMeridiem || 'PM'}
                                  onChange={(event) =>
                                    updateBatchTimingCustomField(entry.id, 'batchTimingCustomEndMeridiem', event.target.value)
                                  }
                                >
                                  <option value="AM">AM</option>
                                  <option value="PM">PM</option>
                                </select>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <button type="button" className="faculty-row-action danger" onClick={() => onRequestBatchDelete(entry)}>
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="faculty-batch-inline-add-row">
                <td>+</td>
                <td>
                  <input
                    className="faculty-inline-input"
                    type="text"
                    placeholder="Enter batch name"
                    value={form.batchName || getSuggestedBatchName(form.facultyName, form.batchEntries)}
                    onChange={(event) => updateField('batchName', event.target.value)}
                    onFocus={() =>
                      updateField('batchName', form.batchName || getSuggestedBatchName(form.facultyName, form.batchEntries))
                    }
                  />
                </td>
                <td>
                  <div className="faculty-inline-batch-timing">
                    <select
                      className="faculty-inline-input"
                      value={form.batchTiming}
                      onChange={(event) => {
                        const nextTiming = event.target.value
                        updateField('batchTiming', nextTiming)
                        if (nextTiming !== 'Custom') {
                          updateField('batchTimingCustomStart', '')
                          updateField('batchTimingCustomStartMeridiem', 'AM')
                          updateField('batchTimingCustomEnd', '')
                          updateField('batchTimingCustomEndMeridiem', 'PM')
                        }
                      }}
                    >
                      <option value="">Select timing</option>
                      {availableBatchTimingOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value="Custom">Custom</option>
                    </select>

                    {form.batchTiming === 'Custom' ? (
                      <div className="faculty-inline-custom-timing">
                        <div className="faculty-inline-custom-timing-side">
                          <input
                            className="faculty-inline-input"
                            type="text"
                            inputMode="numeric"
                            placeholder="09:30"
                            value={form.batchTimingCustomStart}
                            onChange={(event) => updateField('batchTimingCustomStart', event.target.value)}
                          />
                          <select
                            className="faculty-inline-input"
                            value={form.batchTimingCustomStartMeridiem}
                            onChange={(event) => updateField('batchTimingCustomStartMeridiem', event.target.value)}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                        <span aria-hidden="true">-</span>
                        <div className="faculty-inline-custom-timing-side">
                          <input
                            className="faculty-inline-input"
                            type="text"
                            inputMode="numeric"
                            placeholder="06:30"
                            value={form.batchTimingCustomEnd}
                            onChange={(event) => updateField('batchTimingCustomEnd', event.target.value)}
                          />
                          <select
                            className="faculty-inline-input"
                            value={form.batchTimingCustomEndMeridiem}
                            onChange={(event) => updateField('batchTimingCustomEndMeridiem', event.target.value)}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>
                  <button type="button" className="faculty-batch-add faculty-batch-inline-add-button" onClick={addBatchEntry}>
                    Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {shouldShowError('batchEntries') ? <small className="course-field-error">{validationErrors.batchEntries}</small> : null}
        </div>
      </div>

      <div className="faculty-form-actions faculty-form-actions-large faculty-inline-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" onClick={onSubmitIntent} disabled={isSubmitting} className="faculty-save-button">
          <Save />
          <span>{isSubmitting ? 'Updating...' : 'Save Changes'}</span>
        </Button>
      </div>
    </>
  )
}

function createBatchEntryId(index = 0) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`
}

function getPrefilledForm(record = null, courseOptions = []) {
  if (!record) return createEmptyForm()

  const derivedCourseIds = getFacultyCourseIds(record, courseOptions)
  const batchEntries = Array.isArray(record.batchEntries)
    ? record.batchEntries.map((entry) => {
        const timingState = parseBatchTimingState(entry.batchTiming)
        const derivedCourseId =
          String(entry.courseId || '').trim() ||
          getCourseIdByName(entry.courseName || '', courseOptions) ||
          String(derivedCourseIds[0] || record.courseId || '').trim()

        return {
          id: entry.id || createBatchEntryId(),
          batchName: String(entry.batchName || '').trim(),
          batchTiming: String(entry.batchTiming || '').trim(),
          courseId: derivedCourseId,
          courseName: String(entry.courseName || getCourseNameById(derivedCourseId, courseOptions) || record.courseName || '').trim(),
          sequenceNo: Number(entry.sequenceNo || getBatchSequenceNoFromName(entry.batchName || '') || 1) || 1,
          ...timingState,
        }
      })
    : record.batch
      ? [
          {
            id: `${record.id || 'batch'}-legacy`,
            batchName: String(record.batch || '').trim(),
            batchTiming: String(record.batchTiming || '').trim(),
            courseId:
              String(record.courseId || '').trim() ||
              getCourseIdByName(record.courseName || '', courseOptions) ||
              String(record.courseIds?.[0] || '').trim(),
            courseName: String(record.courseName || '').trim(),
            sequenceNo: Number(getBatchSequenceNoFromName(record.batch || '') || 1) || 1,
            ...parseBatchTimingState(record.batchTiming),
          },
        ]
      : []

  return {
    facultyName: record.facultyName || '',
    facultyEmail: record.facultyEmail || '',
    facultyPhone: record.facultyPhone || '',
    courseId: derivedCourseIds[0] || record.courseId || '',
    courseIds: derivedCourseIds,
    status: String(record.status || 'Active'),
    batchCourseId: String(record.batchCourseId || derivedCourseIds[0] || record.courseId || ''),
    batchEntries,
    batchName: '',
    batchTiming: '',
    batchTimingCustomStart: '',
    batchTimingCustomStartMeridiem: 'AM',
    batchTimingCustomEnd: '',
    batchTimingCustomEndMeridiem: 'PM',
  }
}

export function FacultyManagementPage() {
  const { role } = useAuth()
  const openMenu = useMobileMenu()
  const navigate = useNavigate()
  const isBusinessOwner = role === 'business-owner'
  const headerTitle = isBusinessOwner ? 'Business Owner Dashboard' : 'Operation Manager Dashboard'
  const headerEyebrow = isBusinessOwner ? 'Business Owner' : 'Operation Manager'
  const headerSummary = isBusinessOwner
    ? "Welcome back! Here's what's happening with your business today."
    : roleDashboards['operation-manager'].summary
  const headerInitials = isBusinessOwner ? 'BW' : 'OM'
  const headerProfileTitle = isBusinessOwner ? 'Business Head' : 'Operation Manager'
  const headerEmail = isBusinessOwner ? 'business.owner@cispro.com' : 'operation.manager@cispro.com'

  const [records, setRecords] = useState([])
  const [courseOptions, setCourseOptions] = useState([])
  const [isCoursesLoading, setIsCoursesLoading] = useState(true)
  const [isFacultyLoading, setIsFacultyLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [editingFacultyId, setEditingFacultyId] = useState('')
  const [selectedFacultyRecord, setSelectedFacultyRecord] = useState(null)
  const [facultyWizardStep, setFacultyWizardStep] = useState(1)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState(null)
  const [editingBatchEntryId, setEditingBatchEntryId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [openActionMenuId, setOpenActionMenuId] = useState('')
  const [openActionMenuPlacement, setOpenActionMenuPlacement] = useState('bottom')
  const [openActionMenuPosition, setOpenActionMenuPosition] = useState({ top: 0, right: 0 })
  const [openActionMenuMode, setOpenActionMenuMode] = useState('')
  const [openCoursePopoverId, setOpenCoursePopoverId] = useState('')
  const [openCoursePopoverMode, setOpenCoursePopoverMode] = useState('')
  const actionMenuCloseTimerRef = useRef(null)
  const actionMenuButtonRefs = useRef(new Map())
  const facultyAttendanceRefreshToken = useFacultyAttendanceRefreshToken()
  const [attendanceReportRequest, setAttendanceReportRequest] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(createEmptyForm())
  const [touched, setTouched] = useState({})
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [showCourseValidationError, setShowCourseValidationError] = useState(false)
  const [showBatchTimingError, setShowBatchTimingError] = useState(false)
  const [actionError, setActionError] = useState('')
  const itemsPerPage = 5
  const submitIntentRef = useRef(false)

  const activeCourseOptions = useMemo(
    () => courseOptions.filter((course) => String(course?.status || '').toLowerCase() === 'active'),
    [courseOptions],
  )

  const selectedFacultyBatchGroups = useMemo(() => {
    if (!selectedFacultyRecord) return []

    return getGroupedBatchEntriesByCourse(
      selectedFacultyRecord.batchEntries || [],
      activeCourseOptions,
      getFacultyCourseIds(selectedFacultyRecord, activeCourseOptions),
    )
  }, [activeCourseOptions, selectedFacultyRecord])
  void facultyAttendanceRefreshToken
  const selectedFacultyAttendance = resolveTodayFacultyAttendanceStatus({
    facultyId: selectedFacultyRecord?.id || selectedFacultyRecord?.facultyId || '',
    facultyName: selectedFacultyRecord?.facultyName || '',
  })
  const selectedFacultyAttendanceReasonLabel = getFacultyAttendanceReasonLabel(selectedFacultyAttendance)

  const validationErrors = useMemo(() => {
    const nextErrors = {}
    const normalizedEmail = form.facultyEmail.trim().toLowerCase()
    const duplicateEmail = normalizedEmail
      ? records.find((record) => {
          if (record.id === editingFacultyId) return false
          return String(record.facultyEmail || '').trim().toLowerCase() === normalizedEmail
        })
      : null

    if (!form.facultyName.trim()) nextErrors.facultyName = 'Faculty name is required.'
    if (!form.facultyEmail.trim()) nextErrors.facultyEmail = 'Faculty email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.facultyEmail.trim())) {
      nextErrors.facultyEmail = 'Enter a valid email address.'
    } else if (duplicateEmail) {
      nextErrors.facultyEmail = 'Email already exists.'
    }
    if (!form.facultyPhone.trim()) nextErrors.facultyPhone = 'Faculty phone number is required.'
    else if (!/^\d{10}$/.test(form.facultyPhone.trim())) nextErrors.facultyPhone = 'Enter a valid 10-digit phone number.'
    if (!Array.isArray(form.courseIds) || !form.courseIds.length) nextErrors.courseId = 'Please select at least one active course.'
    if (!form.status.trim()) nextErrors.status = 'Please select faculty status.'
    if (
      form.batchName.trim() &&
      hasDuplicateBatchName(
        form.batchEntries,
        form.batchName,
        form.batchCourseId || form.courseIds[0] || form.courseId || '',
        editingBatchEntryId,
      )
    ) {
      nextErrors.batchName = 'Batch names must be unique within the same course.'
    }

    const batchTimingError = getBatchTimingValidationError(form)
    if (batchTimingError) {
      nextErrors.batchTiming = batchTimingError
    }

    const editingBatchEntry = editingBatchEntryId
      ? form.batchEntries.find((entry) => String(entry?.id || '').trim() === String(editingBatchEntryId).trim()) || null
      : null
    const pendingBatchEntry = resolveBatchEntryFromForm(
      form,
      getBatchEntriesForCourse(form.batchEntries, String(form.batchCourseId || form.courseIds[0] || form.courseId || '').trim()),
      editingBatchEntry?.id || '',
    )
    const selectedCourseIds = Array.isArray(form.courseIds) ? form.courseIds : []
    const hasBatchForEveryCourse =
      selectedCourseIds.length > 0 &&
      selectedCourseIds.every((courseId) => {
        const courseBatchEntries = getBatchEntriesForCourse(form.batchEntries, courseId)
        const hasPendingForThisCourse =
          pendingBatchEntry &&
          String(pendingBatchEntry.courseId || '').trim() === String(courseId || '').trim() &&
          !courseBatchEntries.some((entry) => sameBatchEntry(entry, pendingBatchEntry))

        return courseBatchEntries.length + (hasPendingForThisCourse ? 1 : 0) > 0
      })

    if (facultyWizardStep === 2 && !hasBatchForEveryCourse) {
      nextErrors.batchEntries = 'Add at least one batch for each selected course.'
    }

    return nextErrors
  }, [editingBatchEntryId, editingFacultyId, facultyWizardStep, form, records])

  const totalFaculty = records.length
  const latestFaculty = records[0] || null
  const isViewMode = modalMode === 'view'
  const isEditMode = modalMode === 'edit'
  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return records

    return records.filter((record) => {
      const facultyName = String(record.facultyName || '').toLowerCase()
      const courseName = String(record.courseName || '').toLowerCase()
      const courseNames = getCourseSelectionNames(record, activeCourseOptions).join(' ').toLowerCase()
      const batchNames = Array.isArray(record.batchEntries)
        ? record.batchEntries.map((entry) => String(entry.batchName || '').toLowerCase()).join(' ')
        : ''

      return facultyName.includes(normalizedQuery) || courseName.includes(normalizedQuery) || courseNames.includes(normalizedQuery) || batchNames.includes(normalizedQuery)
    })
  }, [activeCourseOptions, records, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage))
  const currentPageSafe = Math.min(currentPage, totalPages)
  const paginatedRecords = useMemo(() => {
    const start = (currentPageSafe - 1) * itemsPerPage
    return filteredRecords.slice(start, start + itemsPerPage)
  }, [currentPageSafe, filteredRecords])

  const shouldShowError = (field) => {
    if (field === 'batchTiming') {
      return showBatchTimingError && validationErrors.batchTiming
    }

    if (field === 'courseId') {
      return showCourseValidationError && validationErrors.courseId
    }

    return showValidationErrors && touched[field] && validationErrors[field]
  }
  const currentWizardStep = facultyWizardStep
  const isFacultyStepOne = currentWizardStep === 1
  const isFacultyStepTwo = currentWizardStep === 2
  const stepOneHasErrors = FACULTY_STEP_ONE_FIELDS.some((field) => Boolean(validationErrors[field]))
  const selectedCourseIds = Array.isArray(form.courseIds) ? form.courseIds : []
  const activeBatchCourseId =
    selectedCourseIds.includes(String(form.batchCourseId || '').trim()) ? String(form.batchCourseId || '').trim() : selectedCourseIds[0] || ''
  const activeBatchCourseName = getCourseNameById(activeBatchCourseId, activeCourseOptions)
  const activeBatchEntries = getBatchEntriesForCourse(form.batchEntries, activeBatchCourseId)
  const availableBatchTimingOptions = getAvailableBatchTimingOptions(activeBatchEntries, editingBatchEntryId)
  const editingBatchEntry = editingBatchEntryId
    ? activeBatchEntries.find((entry) => String(entry?.id || '').trim() === String(editingBatchEntryId).trim()) || null
    : null

  const resetBatchEditor = () => {
    setEditingBatchEntryId('')
    updateField('batchName', '')
    updateField('batchTiming', '')
    updateField('batchTimingCustomStart', '')
    updateField('batchTimingCustomStartMeridiem', 'AM')
    updateField('batchTimingCustomEnd', '')
    updateField('batchTimingCustomEndMeridiem', 'PM')
  }

  const startBatchEdit = (entry) => {
    if (!entry) return

    const timingState = parseBatchTimingState(entry.batchTiming)
    const resolvedTimingPreset = timingState.batchTimingPreset || (String(entry.batchTiming || '').trim() ? 'Custom' : '')

    setEditingBatchEntryId(String(entry.id || '').trim())
    updateField('batchCourseId', String(entry.courseId || activeBatchCourseId || form.courseIds[0] || form.courseId || '').trim())
    updateField('batchName', String(entry.batchName || '').trim())
    updateField('batchTiming', resolvedTimingPreset)
    updateField('batchTimingCustomStart', timingState.batchTimingCustomStart || '')
    updateField('batchTimingCustomStartMeridiem', timingState.batchTimingCustomStartMeridiem || 'AM')
    updateField('batchTimingCustomEnd', timingState.batchTimingCustomEnd || '')
    updateField('batchTimingCustomEndMeridiem', timingState.batchTimingCustomEndMeridiem || 'PM')
    setActionError('')
  }
  const selectedCourseLabelOverrides = useMemo(() => {
    const overrides = {}
    const selectedIds = Array.isArray(form.courseIds) ? form.courseIds.map((courseId) => String(courseId || '').trim()).filter(Boolean) : []
    if (!selectedIds.length) return overrides

    const batchEntries = Array.isArray(form.batchEntries) && form.batchEntries.length
      ? form.batchEntries
      : Array.isArray(selectedFacultyRecord?.batchEntries)
        ? selectedFacultyRecord.batchEntries
        : []

    selectedIds.forEach((courseId, index) => {
      const batchEntry = batchEntries.find((entry) => String(entry?.courseId || '').trim() === courseId)
      const courseName =
        getCourseNameById(courseId, activeCourseOptions) ||
        String(batchEntry?.courseName || '').trim() ||
        (index === 0 ? String(selectedFacultyRecord?.courseName || '').trim() : '') ||
        `Course ${index + 1}`

      overrides[courseId] = courseName
    })

    return overrides
  }, [activeCourseOptions, form.batchEntries, form.courseIds, selectedFacultyRecord])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const syncOpenActionMenuPlacement = (buttonElement) => {
    if (!buttonElement) return

    const rect = buttonElement.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const estimatedMenuHeight = 184
    const nextPlacement = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
    const nextTop =
      nextPlacement === 'top'
        ? Math.max(12, rect.top - estimatedMenuHeight - 10)
        : Math.min(window.innerHeight - estimatedMenuHeight - 12, rect.bottom + 10)
    const nextRight = Math.max(12, window.innerWidth - rect.right)

    setOpenActionMenuPlacement(nextPlacement)
    setOpenActionMenuPosition({ top: nextTop, right: nextRight })
  }

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!event.target.closest('.faculty-row-actions')) {
        setOpenActionMenuId('')
        setOpenActionMenuPlacement('bottom')
        setOpenActionMenuPosition({ top: 0, right: 0 })
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenActionMenuId('')
        setOpenActionMenuPlacement('bottom')
        setOpenActionMenuPosition({ top: 0, right: 0 })
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!event.target.closest('.faculty-course-popover')) {
        setOpenCoursePopoverId('')
        setOpenCoursePopoverMode('')
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenCoursePopoverId('')
        setOpenCoursePopoverMode('')
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const updateCourseIds = (nextCourseIds) => {
    const normalizedCourseIds = Array.isArray(nextCourseIds)
      ? nextCourseIds.map((courseId) => String(courseId || '').trim()).filter(Boolean)
      : []
    const currentBatchCourseId = String(form.batchCourseId || '').trim()
    const nextBatchCourseId = normalizedCourseIds.includes(currentBatchCourseId) ? currentBatchCourseId : normalizedCourseIds[0] || ''

    setForm((current) => ({
      ...current,
      courseIds: normalizedCourseIds,
      courseId: normalizedCourseIds[0] || '',
      batchCourseId: nextBatchCourseId,
    }))
  }

  const setActiveBatchCourse = (courseId) => {
    const normalizedCourseId = String(courseId || '').trim()
    if (!normalizedCourseId) return

    setForm((current) => ({
      ...current,
      batchCourseId: normalizedCourseId,
      batchName: '',
      batchTiming: '',
      batchTimingCustomStart: '',
      batchTimingCustomStartMeridiem: 'AM',
      batchTimingCustomEnd: '',
      batchTimingCustomEndMeridiem: 'PM',
    }))
  }

  const scheduleCloseActionMenu = () => {
    if (actionMenuCloseTimerRef.current) {
      window.clearTimeout(actionMenuCloseTimerRef.current)
    }

    actionMenuCloseTimerRef.current = window.setTimeout(() => {
      setOpenActionMenuId('')
      actionMenuCloseTimerRef.current = null
    }, 140)
  }

  const markTouched = (field) => {
    setShowValidationErrors(true)
    setTouched((current) => ({ ...current, [field]: true }))
  }

  const addBatchEntry = () => {
    const activeCourseId = form.batchCourseId || form.courseIds[0] || form.courseId || ''
    if (
      form.batchName.trim() &&
      hasDuplicateBatchName(form.batchEntries, form.batchName, activeCourseId, editingBatchEntryId)
    ) {
      setActionError('Batch names must be unique within the same course.')
      setTouched((current) => ({ ...current, batchName: true }))
      return
    }

    const batchTimingError = getBatchTimingValidationError(form)
    if (batchTimingError) {
      setShowBatchTimingError(true)
      setTouched((current) => ({ ...current, batchTiming: true }))
      setActionError('')
      return
    }

    setShowBatchTimingError(false)

    const nextBatchEntry = resolveBatchEntryFromForm(form, activeBatchEntries, editingBatchEntryId || '')

    if (!nextBatchEntry) {
      return
    }

    setActionError('')
    setForm((current) => ({
      ...current,
      batchEntries: editingBatchEntryId
        ? current.batchEntries.map((entry) =>
            String(entry.id || '').trim() === String(editingBatchEntryId).trim()
              ? {
                  ...entry,
                  ...nextBatchEntry,
                  id: entry.id,
                  sequenceNo: entry.sequenceNo ?? nextBatchEntry.sequenceNo ?? 1,
                }
              : entry,
          )
        : [...current.batchEntries, nextBatchEntry],
      batchName: getSuggestedBatchName(
        current.facultyName,
        editingBatchEntryId
          ? current.batchEntries.map((entry) =>
              String(entry.id || '').trim() === String(editingBatchEntryId).trim()
                ? {
                    ...entry,
                    ...nextBatchEntry,
                    id: entry.id,
                  }
                : entry,
            )
          : [...activeBatchEntries, nextBatchEntry],
      ),
      batchTiming: '',
      batchTimingCustomStart: '',
      batchTimingCustomStartMeridiem: 'AM',
      batchTimingCustomEnd: '',
      batchTimingCustomEndMeridiem: 'PM',
      batchCourseId: current.batchCourseId || current.courseIds[0] || current.courseId || '',
    }))
    setShowBatchTimingError(false)
    setEditingBatchEntryId('')
  }

  const goToNextFacultyStep = () => {
    setShowValidationErrors(true)
    const nextTouched = {
      facultyName: true,
      facultyEmail: true,
      facultyPhone: true,
      status: true,
    }
    setTouched((current) => ({ ...current, ...nextTouched }))

    if (!Array.isArray(form.courseIds) || !form.courseIds.length) {
      setShowCourseValidationError(true)
      setActionError('Please select a course before continuing.')
      return
    }

    setShowCourseValidationError(false)
    if (stepOneHasErrors) return

    setActionError('')
    setFacultyWizardStep(2)
  }

  const goToPreviousFacultyStep = () => {
    setActionError('')
    setFacultyWizardStep(1)
  }

  const loadCourseOptions = async () => {
    setIsCoursesLoading(true)

    try {
      const result = await listCourses({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
      const normalizedCourses = normalizeCourseList(result.data || loadCourseRecords())
      setCourseOptions(normalizedCourses)
      setActionError('')
    } catch (error) {
      setCourseOptions(normalizeCourseList(loadCourseRecords()))
      setActionError(apiErrorMessage(error, 'Failed to load active courses from the backend.'))
    } finally {
      setIsCoursesLoading(false)
    }
  }

  const loadFacultyOptions = async () => {
    setIsFacultyLoading(true)
    try {
      const result = await listFacultyRecords({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
      const fetchedRecords = Array.isArray(result.data) ? result.data : []
      setRecords(normalizeFacultyList(fetchedRecords))
      setActionError('')
    } catch (error) {
      setRecords(normalizeFacultyList(loadFacultyRecords()))
      setActionError(apiErrorMessage(error, 'Failed to load faculty records from the backend.'))
    } finally {
      setIsFacultyLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void Promise.all([loadCourseOptions(), loadFacultyOptions()])
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!isModalOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isModalOpen])

  useEffect(() => {
    const refreshCourses = () => {
      void loadCourseOptions()
    }

    window.addEventListener(COURSE_RECORD_SYNC_EVENT, refreshCourses)

    return () => window.removeEventListener(COURSE_RECORD_SYNC_EVENT, refreshCourses)
  }, [])

  const closeModal = () => {
    setIsModalOpen(false)
    setIsSubmitting(false)
    setActionError('')
    setForm(createEmptyForm())
    setTouched({})
    setShowValidationErrors(false)
    setShowCourseValidationError(false)
    setShowBatchTimingError(false)
    setModalMode('create')
    setEditingFacultyId('')
    setSelectedFacultyRecord(null)
    setFacultyWizardStep(1)
    setBatchDeleteTarget(null)
    setEditingBatchEntryId('')
    setOpenActionMenuId('')
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
    setOpenCoursePopoverId('')
    setOpenCoursePopoverMode('')
  }

  const openCreateModal = () => {
    setActionError('')
    setForm(createEmptyForm())
    setTouched({})
    setShowValidationErrors(false)
    setShowCourseValidationError(false)
    setShowBatchTimingError(false)
    setModalMode('create')
    setEditingFacultyId('')
    setSelectedFacultyRecord(null)
    setFacultyWizardStep(1)
    setEditingBatchEntryId('')
    setIsModalOpen(true)
    setOpenActionMenuId('')
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
    setOpenCoursePopoverId('')
    setOpenCoursePopoverMode('')
  }

  const openViewModal = (record) => {
    setActionError('')
    setForm(getPrefilledForm(record, activeCourseOptions))
    setTouched({})
    setShowValidationErrors(false)
    setShowCourseValidationError(false)
    setShowBatchTimingError(false)
    setModalMode('view')
    setEditingFacultyId(record.id)
    setSelectedFacultyRecord(record)
    setFacultyWizardStep(1)
    setEditingBatchEntryId('')
    setIsModalOpen(true)
    setOpenActionMenuId('')
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
    setOpenCoursePopoverId('')
    setOpenCoursePopoverMode('')
  }

  const openEditModal = (record) => {
    setActionError('')
    setForm(getPrefilledForm(record, activeCourseOptions))
    setTouched({})
    setShowValidationErrors(false)
    setShowCourseValidationError(false)
    setShowBatchTimingError(false)
    setModalMode('edit')
    setEditingFacultyId(record.id)
    setSelectedFacultyRecord(record)
    setFacultyWizardStep(1)
    setEditingBatchEntryId('')
    setIsModalOpen(true)
    setOpenActionMenuId('')
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
    setOpenCoursePopoverId('')
    setOpenCoursePopoverMode('')
  }

  const openDeleteModal = (record) => {
    setActionError('')
    setDeleteTarget(record)
    setOpenActionMenuId('')
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
  }

  const closeBatchDeleteModal = () => {
    setBatchDeleteTarget(null)
  }

  const handleBatchDeleteConfirmed = () => {
    if (!batchDeleteTarget) return

    if (String(editingBatchEntryId || '').trim() === String(batchDeleteTarget.id || '').trim()) {
      resetBatchEditor()
    }

    setForm((current) => ({
      ...current,
      batchEntries: current.batchEntries.filter((entry) => entry.id !== batchDeleteTarget.id),
    }))

    if (selectedFacultyRecord) {
      setSelectedFacultyRecord((current) =>
        current
          ? {
              ...current,
              batchEntries: Array.isArray(current.batchEntries)
                ? current.batchEntries.filter((entry) => entry.id !== batchDeleteTarget.id)
                : [],
            }
          : current,
      )
    }

    setBatchDeleteTarget(null)
    setActionError('')
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!submitIntentRef.current) {
      return
    }
    submitIntentRef.current = false

    if (isFacultyStepOne) {
      setShowValidationErrors(true)
      goToNextFacultyStep()
      return
    }

    const editingBatchEntry = editingBatchEntryId
      ? form.batchEntries.find((entry) => String(entry?.id || '').trim() === String(editingBatchEntryId).trim()) || null
      : null
    const nextTouched = {
      facultyName: true,
      facultyEmail: true,
      facultyPhone: true,
      batchTiming: true,
      batchEntries: true,
      courseId: true,
      status: true,
    }
    setShowValidationErrors(true)
    setTouched(nextTouched)
    setShowBatchTimingError(Boolean(validationErrors.batchTiming))

    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    setActionError('')

    const pendingBatchEntry = resolveBatchEntryFromForm(
      form,
      getBatchEntriesForCourse(form.batchEntries, String(form.batchCourseId || form.courseIds[0] || form.courseId || '').trim()),
      editingBatchEntry?.id || '',
    )
    const existingBatchEntries = Array.isArray(form.batchEntries) && form.batchEntries.length
      ? form.batchEntries
      : Array.isArray(selectedFacultyRecord?.batchEntries) && selectedFacultyRecord.batchEntries.length
        ? selectedFacultyRecord.batchEntries
        : []
    const resolvedBatchEntries = [...existingBatchEntries]

    if (pendingBatchEntry) {
      const pendingEntryIndex = resolvedBatchEntries.findIndex((entry) => String(entry?.id || '').trim() === String(pendingBatchEntry.id || '').trim())
      if (pendingEntryIndex >= 0) {
        resolvedBatchEntries[pendingEntryIndex] = pendingBatchEntry
      } else if (!resolvedBatchEntries.some((entry) => sameBatchEntry(entry, pendingBatchEntry))) {
        resolvedBatchEntries.push(pendingBatchEntry)
      }
    }

    const payload = {
      facultyName: form.facultyName.trim(),
      facultyEmail: form.facultyEmail.trim(),
      facultyPhone: form.facultyPhone.trim(),
      courseId: form.courseId,
      courseIds: form.courseIds,
      status: String(form.status || 'Active').trim().toUpperCase(),
      batchEntries: resolvedBatchEntries.map((entry) => ({
        batchName: String(entry.batchName || '').trim(),
        batchTiming: formatBatchTimingState(entry),
        courseId: String(entry.courseId || form.batchCourseId || form.courseIds[0] || form.courseId || '').trim(),
        courseName: getCourseNameById(entry.courseId || form.batchCourseId || form.courseIds[0] || form.courseId || '', activeCourseOptions),
        sequenceNo: Number(entry.sequenceNo || getBatchSequenceNoFromName(entry.batchName || '') || 1) || 1,
      })),
    }

    try {
      const savedRecord = isEditMode
        ? await updateFacultyRecord(editingFacultyId, payload)
        : await createFacultyRecord(payload)

      saveFacultySnapshot(savedRecord)
      window.dispatchEvent(new CustomEvent(FACULTY_RECORD_SYNC_EVENT))

      const nextRecords = upsertFacultyRecordById(records, savedRecord)
      setRecords(nextRecords)
      await loadFacultyOptions()
      setCurrentPage(1)
      setSelectedFacultyRecord(savedRecord)
      setEditingBatchEntryId('')
      closeModal()
    } catch (error) {
      setActionError(apiErrorMessage(error, 'Unable to save faculty details right now.'))
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return

    try {
      await deleteFacultyRecord(deleteTarget.id)
      window.dispatchEvent(new CustomEvent(FACULTY_RECORD_SYNC_EVENT))
      await loadFacultyOptions()
      setCurrentPage(1)
      closeDeleteModal()
    } catch (error) {
      setActionError(apiErrorMessage(error, 'Unable to delete faculty right now.'))
    }
  }

  return (
    <section className="faculty-management-page">
      {isBusinessOwner ? (
        <OperationManagerHeader
          className="faculty-management-top-header"
          eyebrow={headerEyebrow}
          title={headerTitle}
          summary={headerSummary}
          initials={headerInitials}
          profileTitle={headerProfileTitle}
          email={headerEmail}
          onOpenMenu={openMenu}
        />
      ) : (
        <div className="operation-manager-dashboard">
          <OperationManagerWorkspaceHeader
            eyebrow={headerEyebrow}
            title={headerTitle}
            summary={headerSummary}
            initials={headerInitials}
            profileTitle={headerProfileTitle}
            email={headerEmail}
            onOpenMenu={openMenu}
          />
        </div>
      )}

      <article className="faculty-management-hero">
        <div className="faculty-management-hero-top">
          <div className="faculty-management-heading">
            <div className="faculty-management-heading-icon" aria-hidden="true">
              <UsersRound size={28} />
            </div>
            <div>
              <h1>Faculty Management</h1>
              <p>Manage faculty records, courses, and batches.</p>

            </div>
          </div>

          <div className="faculty-management-stat">
            <div className="faculty-management-stat-icon" aria-hidden="true">
              <UsersRound size={28} />
            </div>
            <div className="faculty-management-stat-copy">
              <span>Total Faculty</span>
              <strong>{totalFaculty}</strong>
              <small>Faculty members </small>
            </div>
          </div>
        </div>

        <div className="faculty-management-actions">
          <Button type="button" className="faculty-add-button" onClick={openCreateModal}>
            + Add Faculty
          </Button>
          <SearchBar
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value)
              setCurrentPage(1)
            }}
            placeholder="Search faculty..."
            ariaLabel="Search faculty records"
          />
          <Button type="button" className="faculty-add-button" variant="ghost" onClick={() => navigate(buildFacultyCourseCatalogPath())}>
            <span className="faculty-batch-button-content">
              <Layers3 size={16} aria-hidden="true" focusable="false" />
              <span>Batch</span>
            </span>
          </Button>
        </div>
      </article>

      <article className="faculty-list-card">
        <div className="faculty-list-header">
          <div>
            <h3>Faculty List</h3>
            <p>Newly added records appear here immediately.</p>
          </div>
          <div className="faculty-list-header-actions">
            <Button
              type="button"
              variant="ghost"
              className="faculty-report-button"
              onClick={() => setAttendanceReportRequest({ mode: 'all', faculty: null })}
            >
              <FileDown />
              <span>Generate Attendance Report</span>
            </Button>
            {latestFaculty ? (
              <div className="faculty-latest-chip">
                Latest: <strong>{latestFaculty.facultyName}</strong>
              </div>
            ) : null}
          </div>
        </div>

        {actionError ? (
          <div className="faculty-empty-state" role="alert" aria-live="polite">
            <strong>Action failed</strong>
            <p>{actionError}</p>
          </div>
        ) : null}

        {isFacultyLoading ? (
          <div className="faculty-empty-state faculty-loading-text" role="status" aria-live="polite">
            <strong>Loading faculty...</strong>
            <p>Fetching faculty records from the backend.</p>
          </div>
        ) : filteredRecords.length ? (
          <div className="faculty-table-wrap">
            <table className="faculty-table">
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Batch</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record, index) => {
                  const shouldOpenPopoverUpwards = index >= Math.max(0, paginatedRecords.length - 2)

                  return (
                  <tr
                    key={record.id}
                    className={[
                      openActionMenuId === record.id ? 'faculty-row-actions-open' : '',
                      openCoursePopoverId === record.id ? 'faculty-course-popover-open' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <td>
                      <strong>{record.facultyName}</strong>
                      <small>Faculty member</small>
                    </td>
                    <td>{record.facultyEmail}</td>
                    <td>{record.facultyPhone}</td>
                    <td>{Array.isArray(record.batchEntries) ? record.batchEntries.length : Number(record.batchCount || 0) || '-'}</td>
                    <td className="faculty-course-cell">
                      <div className="faculty-course-chip-list">
                        {(() => {
                          const { primaryCourseName, extraCourseNames } = getCoursePreviewNames(record, activeCourseOptions)

                          if (!primaryCourseName) {
                            return <span className="faculty-course-chip faculty-course-chip-empty">{record.courseName || '-'}</span>
                          }

                          return (
                            <div
                              className={`faculty-course-popover ${openCoursePopoverId === record.id ? 'is-open' : ''} ${shouldOpenPopoverUpwards ? 'faculty-course-popover-top' : ''}`.trim()}
                              onMouseEnter={() => {
                                setOpenCoursePopoverId(record.id)
                                setOpenCoursePopoverMode((current) => (current === 'click' && openCoursePopoverId === record.id ? 'click' : 'hover'))
                              }}
                              onMouseLeave={() => {
                                setOpenCoursePopoverMode((currentMode) => {
                                  if (currentMode !== 'hover') return currentMode
                                  setOpenCoursePopoverId((current) => (current === record.id ? '' : current))
                                  return ''
                                })
                              }}
                            >
                              <span className="faculty-course-chip faculty-course-chip-primary">{primaryCourseName}</span>
                              {extraCourseNames.length ? (
                                <button
                                  type="button"
                                  className="faculty-course-chip faculty-course-chip-more"
                                  onClick={() => {
                                    setOpenCoursePopoverId((current) => (current === record.id && openCoursePopoverMode === 'click' ? '' : record.id))
                                    setOpenCoursePopoverMode((current) => (current === 'click' && openCoursePopoverId === record.id ? '' : 'click'))
                                  }}
                                  aria-haspopup="listbox"
                                  aria-expanded={openCoursePopoverId === record.id}
                                  aria-label={`${record.facultyName} has ${extraCourseNames.length} more courses`}
                                >
                                  +{extraCourseNames.length}
                                </button>
                              ) : null}
                              {extraCourseNames.length ? (
                                <div className="faculty-course-popover-panel" aria-label={`${record.facultyName} course list`}>
                                  <ul className="faculty-course-popover-list">
                                    {extraCourseNames.map((courseName, index) => (
                                      <li key={`${courseName}-${index}`} className="faculty-course-popover-item">
                                        {courseName}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          )
                        })()}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${String(record.status || 'Active').toLowerCase()}`}>
                        {record.status || 'Active'}
                      </span>
                    </td>
                    <td className="faculty-actions-cell">
                      <div className="faculty-row-actions">
                        <div
                          className={`faculty-row-actions-wrap ${openActionMenuId === record.id ? 'is-open' : ''}`.trim()}
                          onMouseEnter={() => {
                            if (actionMenuCloseTimerRef.current) {
                              window.clearTimeout(actionMenuCloseTimerRef.current)
                              actionMenuCloseTimerRef.current = null
                            }
                            if (openActionMenuId === record.id) {
                              return
                            }
                            setOpenActionMenuId(record.id)
                            setOpenActionMenuMode('hover')
                            syncOpenActionMenuPlacement(actionMenuButtonRefs.current?.get?.(record.id))
                          }}
                          onMouseLeave={() => {
                            if (openActionMenuMode === 'hover') {
                              scheduleCloseActionMenu()
                            }
                          }}
                        >
                          <button
                            ref={(node) => {
                              if (node) actionMenuButtonRefs.current.set(record.id, node)
                              else actionMenuButtonRefs.current.delete(record.id)
                            }}
                            type="button"
                            className={`faculty-row-action faculty-row-action-toggle ${openActionMenuId === record.id ? 'is-open' : ''}`.trim()}
                            onMouseEnter={() => {
                              if (actionMenuCloseTimerRef.current) {
                                window.clearTimeout(actionMenuCloseTimerRef.current)
                                actionMenuCloseTimerRef.current = null
                              }
                              if (openActionMenuId !== record.id) {
                                setOpenActionMenuId(record.id)
                                setOpenActionMenuMode('hover')
                                syncOpenActionMenuPlacement(actionMenuButtonRefs.current.get(record.id))
                              }
                            }}
                            onClick={(event) => {
                              const nextIsOpen = openActionMenuId !== record.id || openActionMenuMode !== 'click'
                              if (!nextIsOpen) {
                                setOpenActionMenuId('')
                                setOpenActionMenuPlacement('bottom')
                                setOpenActionMenuPosition({ top: 0, right: 0 })
                                setOpenActionMenuMode('')
                                return
                              }

                              setOpenActionMenuId(record.id)
                              setOpenActionMenuMode('click')
                              syncOpenActionMenuPlacement(event.currentTarget)
                            }}
                            aria-label={`Open actions for ${record.facultyName}`}
                            aria-haspopup="menu"
                            aria-expanded={openActionMenuId === record.id}
                          >
                            <MoreVertical />
                          </button>
                        </div>
                        {openActionMenuId === record.id ? (
                          <div
                            className={`faculty-row-action-menu ${openActionMenuPlacement === 'top' ? 'faculty-row-action-menu-top' : 'faculty-row-action-menu-bottom'}`.trim()}
                            role="menu"
                            aria-label={`${record.facultyName} actions`}
                            style={{
                              top: `${openActionMenuPosition.top}px`,
                              right: `${openActionMenuPosition.right}px`,
                              bottom: 'auto',
                              left: 'auto',
                            }}
                            onMouseEnter={() => {
                              if (actionMenuCloseTimerRef.current) {
                                window.clearTimeout(actionMenuCloseTimerRef.current)
                                actionMenuCloseTimerRef.current = null
                              }
                            }}
                            onMouseLeave={() => {
                              if (openActionMenuMode === 'hover') {
                                scheduleCloseActionMenu()
                              }
                            }}
                          >
                            <button
                              type="button"
                              className="faculty-row-action-menu-item"
                              onClick={() => {
                                setOpenActionMenuId('')
                                setOpenActionMenuPlacement('bottom')
                                setOpenActionMenuPosition({ top: 0, right: 0 })
                                openViewModal(record)
                              }}
                              role="menuitem"
                            >
                              <Eye />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              className="faculty-row-action-menu-item"
                              onClick={() => {
                                setOpenActionMenuId('')
                                setOpenActionMenuPlacement('bottom')
                                setOpenActionMenuPosition({ top: 0, right: 0 })
                                openEditModal(record)
                              }}
                              role="menuitem"
                            >
                              <PencilLine />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="faculty-row-action-menu-item danger"
                              onClick={() => {
                                setOpenActionMenuId('')
                                setOpenActionMenuPlacement('bottom')
                                setOpenActionMenuPosition({ top: 0, right: 0 })
                                openDeleteModal(record)
                              }}
                              role="menuitem"
                            >
                              <Trash2 />
                              <span>Delete</span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : searchQuery.trim() ? (
          <div className="faculty-empty-state">
            <strong>No matching faculty found</strong>
            <p>Try a different faculty name, course name, or batch name.</p>
          </div>
        ) : (
          <div className="faculty-empty-state">
            <strong>No faculty records found</strong>
          </div>
        )}

        {filteredRecords.length > itemsPerPage ? (
          <PaginationBar
            className="app-pagination"
            currentPage={currentPageSafe}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            label="Faculty pagination"
          />
        ) : null}

        {filteredRecords.length > itemsPerPage ? (
          <div className="faculty-pagination">
            <button
              type="button"
              className="faculty-pagination-button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPageSafe === 1}
            >
              Prev
            </button>
            <div className="faculty-pagination-status">
              Page <strong>{currentPageSafe}</strong> of <strong>{totalPages}</strong>
            </div>
            <button
              type="button"
              className="faculty-pagination-button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPageSafe === totalPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </article>

      {isModalOpen && !isViewMode ? (
        <div className="course-modal-backdrop faculty-modal-backdrop" role="presentation">
          <form
            className="course-modal panel-card faculty-modal faculty-modal-image"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-modal-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <div className="faculty-modal-top">
              <div className="faculty-modal-top-left">
                <div className="faculty-modal-icon">
                  <UserRound />
                </div>
                <div>
                  <h3 id="faculty-modal-title">{isEditMode ? 'Edit Faculty' : 'Add Faculty'}</h3>
                </div>
              </div>
              <div className="faculty-modal-top-right">
                <span className="faculty-modal-badge">
                  <span className="faculty-modal-badge-dot" />
                  Active Course Mapping
                </span>
                <button type="button" className="faculty-modal-close" onClick={closeModal} aria-label="Close form">
                  <X />
                </button>
              </div>
            </div>

            <div className="faculty-modal-stepper" aria-label="Faculty setup steps">
              {FACULTY_WIZARD_STEPS.map((step, index) => {
                const stepNumber = index + 1
                const isActive = currentWizardStep === stepNumber
                const isCompleted = currentWizardStep > stepNumber

                return (
                  <div
                    key={step.key}
                    className={`faculty-wizard-step ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-complete' : ''}`.trim()}
                  >
                    <div className="faculty-wizard-step-index" aria-hidden="true">
                      {isCompleted ? <Check /> : step.step}
                    </div>
                    <div className="faculty-wizard-step-copy">
                      <strong>{step.title}</strong>
                      <span>{step.subtitle}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {actionError ? (
              <div className="faculty-modal-alert" role="alert" aria-live="polite">
                {actionError}
              </div>
            ) : null}

            <div className="faculty-modal-content">
              {isFacultyStepOne ? (
                <section className="faculty-card faculty-card-info faculty-step-panel">
                  <div className="faculty-card-head">
                    <div className="faculty-card-head-icon">
                      <UserRound />
                    </div>
                    <div>
                      <h4>Faculty Information</h4>
                      <p>Enter the faculty details and map them to an active course.</p>
                    </div>
                  </div>

                  <div className="faculty-field-stack">
                    <div className="faculty-two-column-fields">
                      <FacultyField
                        label="Faculty Name"
                        required
                        icon={<UserRound />}
                        error={shouldShowError('facultyName') ? validationErrors.facultyName : ''}
                      >
                        <input
                          type="text"
                          placeholder="Enter faculty name"
                        value={form.facultyName}
                        onChange={(event) => {
                          const value = event.target.value
                          const autoBatchName = value.trim() ? getSuggestedBatchName(value.trim(), form.batchEntries) : ''
                          setForm((current) => ({
                            ...current,
                            facultyName: value,
                            batchName: autoBatchName,
                          }))
                        }}
                          onBlur={() => markTouched('facultyName')}
                          aria-invalid={Boolean(shouldShowError('facultyName'))}
                        />
                      </FacultyField>

                      <FacultyField
                        label="Faculty Email"
                        required
                        icon={<Mail />}
                        error={shouldShowError('facultyEmail') ? validationErrors.facultyEmail : ''}
                      >
                        <input
                          type="email"
                          placeholder="Enter faculty email"
                          value={form.facultyEmail}
                          onChange={(event) => updateField('facultyEmail', event.target.value)}
                          onBlur={() => markTouched('facultyEmail')}
                          aria-invalid={Boolean(shouldShowError('facultyEmail'))}
                        />
                      </FacultyField>
                    </div>

                    <div className="faculty-two-column-fields">
                      <FacultyField
                        label="Faculty Phone Number"
                        required
                        icon={<Phone />}
                        error={shouldShowError('facultyPhone') ? validationErrors.facultyPhone : ''}
                      >
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="Enter faculty phone number"
                          value={form.facultyPhone}
                          onChange={(event) => updateField('facultyPhone', event.target.value.replace(/\D/g, '').slice(0, 10))}
                          onBlur={() => markTouched('facultyPhone')}
                          aria-invalid={Boolean(shouldShowError('facultyPhone'))}
                        />
                      </FacultyField>

                      <FacultyField
                        label="Select Status"
                        required
                        icon={<UsersRound />}
                        error={shouldShowError('status') ? validationErrors.status : ''}
                      >
                        <select
                          value={form.status}
                          onChange={(event) => updateField('status', event.target.value)}
                          onBlur={() => markTouched('status')}
                          aria-invalid={Boolean(shouldShowError('status'))}
                        >
                          <option value="">Select status</option>
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </FacultyField>
                    </div>

                    <div className="faculty-course-row">
                      <CourseCheckboxSelect
                        label="Select Course"
                        required
                        icon={<BookOpen />}
                        error={shouldShowError('courseId') ? validationErrors.courseId : ''}
                    selectedCourseIds={form.courseIds}
                    courseOptions={activeCourseOptions}
                    courseLabelOverrides={selectedCourseLabelOverrides}
                    isLoading={isCoursesLoading}
                    placeholder={isCoursesLoading ? 'Loading courses...' : 'Select course'}
                    onChange={updateCourseIds}
                        onBlur={() => markTouched('courseId')}
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              {isFacultyStepTwo ? (
                <section className="faculty-card faculty-card-batch faculty-step-panel">
                  <div className="faculty-card-head">
                    <div className="faculty-card-head-icon">
                      <UsersRound />
                    </div>
                    <div>
                      <h4>Batch Management</h4>
                      <p>Add batches for one selected course, then switch to the next course.</p>
                    </div>
                  </div>

                  <div className="faculty-batch-course-strip">
                    <div className="faculty-batch-course-strip-header">
                      <div className="faculty-batch-course-strip-header-copy">
                        <strong>Course Flow</strong>
                        <span>
                          {activeBatchCourseName || 'Select a course'}{' '}
                          {selectedCourseIds.length ? `(${selectedCourseIds.indexOf(activeBatchCourseId) + 1}/${selectedCourseIds.length})` : ''}
                        </span>
                      </div>
                      {selectedCourseIds.length > 1 ? (
                        <button
                          type="button"
                          className="faculty-course-next-button"
                          onClick={() => {
                            const currentIndex = selectedCourseIds.indexOf(activeBatchCourseId)
                            const nextIndex = currentIndex >= 0 ? Math.min(selectedCourseIds.length - 1, currentIndex + 1) : 0
                            setActiveBatchCourse(selectedCourseIds[nextIndex])
                          }}
                          disabled={selectedCourseIds.indexOf(activeBatchCourseId) >= selectedCourseIds.length - 1}
                        >
                          Next Course
                        </button>
                      ) : null}
                    </div>

                    <div className="faculty-batch-course-pills" role="tablist" aria-label="Selected courses">
                      {selectedCourseIds.map((courseId, index) => {
                        const courseName = getCourseNameById(courseId, activeCourseOptions)
                        const isActive = courseId === activeBatchCourseId
                        const count = getBatchEntriesForCourse(form.batchEntries, courseId).length

                        return (
                          <button
                            key={courseId}
                            type="button"
                            className={`faculty-course-pill ${isActive ? 'is-active' : ''}`.trim()}
                            onClick={() => setActiveBatchCourse(courseId)}
                            aria-pressed={isActive}
                          >
                            <span className="faculty-course-pill-icon" aria-hidden="true">
                              <UsersRound />
                            </span>
                            <span className="faculty-course-pill-content">
                              <span>{courseName || `Course ${index + 1}`}</span>
                              <small>
                                {count} batch{count === 1 ? '' : 'es'}
                              </small>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="faculty-batch-subtitle">
                    {activeBatchCourseName ? `Add New Batch for ${activeBatchCourseName}` : 'Add New Batch'}
                  </div>

                  <div className="faculty-batch-input-row">
                    <FacultyField
                      className="faculty-batch-field"
                      label="Batch Name"
                      required
                      icon={<BookOpen />}
                      error={shouldShowError('batchName') ? validationErrors.batchName : ''}
                    >
                      <input
                        type="text"
                        placeholder="Enter batch name"
                        value={form.batchName || getSuggestedBatchName(form.facultyName, activeBatchEntries)}
                        onChange={(event) => updateField('batchName', event.target.value)}
                        onFocus={() => updateField('batchName', form.batchName || getSuggestedBatchName(form.facultyName, activeBatchEntries))}
                      />
                    </FacultyField>

                    <FacultyField
                      className="faculty-batch-field"
                      label="Batch Timing"
                      required
                      icon={<Clock3 />}
                      error={shouldShowError('batchTiming') ? validationErrors.batchTiming : ''}
                    >
                      <select
                        value={form.batchTiming}
                        onChange={(event) => {
                          const nextTiming = event.target.value
                          updateField('batchTiming', nextTiming)
                          setShowBatchTimingError(false)
                          if (nextTiming !== 'Custom') {
                            updateField('batchTimingCustomStart', '')
                            updateField('batchTimingCustomStartMeridiem', 'AM')
                            updateField('batchTimingCustomEnd', '')
                            updateField('batchTimingCustomEndMeridiem', 'PM')
                          }
                        }}
                        onBlur={() => markTouched('batchTiming')}
                        aria-invalid={Boolean(shouldShowError('batchTiming'))}
                      >
                        <option value="">Select timing</option>
                        {availableBatchTimingOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                        <option>Custom</option>
                      </select>
                    </FacultyField>
                  </div>

                  {form.batchTiming === 'Custom' ? (
                    <FacultyField label="Custom Timing" required icon={<Clock3 />}>
                      <div className="faculty-custom-timing-range">
                        <div className="faculty-custom-timing-side">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="09:30"
                            aria-label="Custom timing start time"
                            value={form.batchTimingCustomStart}
                            onChange={(event) => {
                              updateField('batchTimingCustomStart', event.target.value)
                              setShowBatchTimingError(false)
                              if (form.batchTiming === 'Custom') markTouched('batchTiming')
                            }}
                          />
                          <select
                            aria-label="Custom timing start meridiem"
                            value={form.batchTimingCustomStartMeridiem}
                            onChange={(event) => {
                              updateField('batchTimingCustomStartMeridiem', event.target.value)
                              setShowBatchTimingError(false)
                              if (form.batchTiming === 'Custom') markTouched('batchTiming')
                            }}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                        <span aria-hidden="true">-</span>
                        <div className="faculty-custom-timing-side">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="06:30"
                            aria-label="Custom timing end time"
                            value={form.batchTimingCustomEnd}
                            onChange={(event) => {
                              updateField('batchTimingCustomEnd', event.target.value)
                              setShowBatchTimingError(false)
                              if (form.batchTiming === 'Custom') markTouched('batchTiming')
                            }}
                          />
                          <select
                            aria-label="Custom timing end meridiem"
                            value={form.batchTimingCustomEndMeridiem}
                            onChange={(event) => {
                              updateField('batchTimingCustomEndMeridiem', event.target.value)
                              setShowBatchTimingError(false)
                              if (form.batchTiming === 'Custom') markTouched('batchTiming')
                            }}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                      </div>
                    </FacultyField>
                  ) : null}

                  <button type="button" className="faculty-batch-add faculty-batch-add-full" onClick={addBatchEntry}>
                    <span>{editingBatchEntryId ? 'Update Batch' : 'Add Batch'}</span>
                  </button>

                  {editingBatchEntryId ? (
                    <div className="faculty-batch-edit-banner" role="status" aria-live="polite">
                      Editing <strong>{editingBatchEntry?.batchName || 'batch'}</strong>
                      {editingBatchEntry?.batchTiming ? ` at ${editingBatchEntry.batchTiming}` : ''}
                      <button type="button" className="faculty-batch-edit-cancel" onClick={resetBatchEditor}>
                        Cancel edit
                      </button>
                    </div>
                  ) : null}

                  <div className="faculty-batch-list-wrap">
                    <div className="faculty-batch-list-title">
                      <strong>{activeBatchCourseName ? `Batches for ${activeBatchCourseName}` : 'Batches'} ({activeBatchEntries.length})</strong>
                    </div>
                    {activeBatchEntries.length ? (
                      <div className="faculty-batch-list faculty-batch-list-scroll" aria-label="Added batches">
                        {activeBatchEntries.map((entry) => (
                          <div key={entry.id} className="faculty-batch-item faculty-batch-item-image">
                            <div className="faculty-batch-item-copy">
                              <strong>{entry.batchName}</strong>
                              <small>{entry.batchTiming}</small>
                            </div>
                            <button
                              type="button"
                              className="faculty-batch-remove faculty-batch-edit-icon"
                              onClick={() => startBatchEdit(entry)}
                              aria-label={`Edit batch ${entry.batchName || ''}`.trim()}
                              title="Edit batch"
                            >
                              <PencilLine />
                            </button>
                            <button
                              type="button"
                              className="faculty-batch-remove faculty-batch-remove-icon"
                              onClick={() => setBatchDeleteTarget(entry)}
                              aria-label={`Delete batch ${entry.batchName || ''}`.trim()}
                              title="Delete batch"
                            >
                              <Trash2 />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="faculty-batch-empty">No batches added yet</div>
                    )}
                  </div>

                  {shouldShowError('batchEntries') ? <small className="course-field-error">{validationErrors.batchEntries}</small> : null}
                </section>
              ) : null}
            </div>

            <div className="faculty-form-actions faculty-form-actions-large faculty-form-actions-wizard">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              {isFacultyStepTwo ? (
                <Button type="button" variant="ghost" onClick={goToPreviousFacultyStep} disabled={isSubmitting}>
                  Back
                </Button>
              ) : null}
              {!isFacultyStepTwo ? (
                <Button type="button" onClick={goToNextFacultyStep} disabled={isSubmitting} className="faculty-save-button">
                  <span>Next</span>
                </Button>
              ) : (
                <Button
                  type="submit"
                  onClick={() => {
                    submitIntentRef.current = true
                  }}
                  disabled={isSubmitting}
                  className="faculty-save-button"
                >
                  <Save />
                  <span>{isEditMode ? (isSubmitting ? 'Updating...' : 'Update') : isSubmitting ? 'Submitting...' : 'Save Faculty'}</span>
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {isModalOpen && isViewMode && selectedFacultyRecord ? (
        <div className="course-modal-backdrop faculty-modal-backdrop faculty-view-backdrop" role="presentation">
          <aside
            className="course-modal panel-card faculty-view-drawer faculty-view-drawer-image"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-view-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="faculty-view-header">
              <div aria-hidden="true" />
              <h3 id="faculty-view-title">Faculty Details</h3>

              <div className="faculty-view-actions">
                <button type="button" className="faculty-view-close" onClick={closeModal} aria-label="Close faculty details">
                  X
                </button>
              </div>
            </div>

            <div className="faculty-view-table-shell">
              <table className="faculty-details-table">
                <tbody>
                  <tr>
                    <th>Faculty Name</th>
                    <td>{selectedFacultyRecord.facultyName || '-'}</td>
                    <th>Status</th>
                    <td>
                      {(() => {
                        const facultyStatus = String(selectedFacultyRecord.status || 'Active').trim()
                        const statusTone = facultyStatus.toLowerCase() === 'inactive' ? 'inactive' : 'active'

                        return <span className={`status-pill ${statusTone}`.trim()}>{facultyStatus}</span>
                      })()}
                    </td>
                  </tr>
                  <tr>
                    <th>Faculty Email</th>
                    <td>{selectedFacultyRecord.facultyEmail || '-'}</td>
                    <th>Faculty Phone Number</th>
                    <td>{selectedFacultyRecord.facultyPhone || '-'}</td>
                  </tr>
                  <tr>
                    <th>Course</th>
                    <td>
                      <div className="faculty-course-chip-list">
                        {getCourseSelectionNames(selectedFacultyRecord, activeCourseOptions).length ? (
                          getCourseSelectionNames(selectedFacultyRecord, activeCourseOptions).map((courseName) => (
                            <span key={courseName} className="faculty-course-chip">
                              {courseName}
                            </span>
                          ))
                        ) : (
                          <span className="faculty-course-chip faculty-course-chip-empty">{selectedFacultyRecord.courseName || '-'}</span>
                        )}
                      </div>
                    </td>
                    <th>Total Batches</th>
                    <td>
                      {Array.isArray(selectedFacultyRecord.batchEntries) ? selectedFacultyRecord.batchEntries.length : Number(selectedFacultyRecord.batchCount || 0) || 0}
                    </td>
                  </tr>
                </tbody>
              </table>

              <section className="faculty-attendance-overview-card faculty-attendance-overview-panel">
                <div className="faculty-attendance-overview-head">
                  <div>
                    <span className="faculty-attendance-overview-kicker">Today&apos;s Attendance</span>
                    <span className={`status-pill faculty-attendance-pill ${getFacultyAttendanceOverviewBadgeTone(selectedFacultyAttendance)}`.trim()}>
                      {getFacultyAttendanceOverviewBadgeLabel(selectedFacultyAttendance)}
                    </span>
                  </div>
                  <div className="faculty-attendance-overview-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      className="faculty-report-button faculty-attendance-report-button"
                      onClick={() => setAttendanceReportRequest({ mode: 'single', faculty: selectedFacultyRecord })}
                    >
                      <FileDown />
                      <span>Generate Attendance Report</span>
                    </Button>
                  </div>
                </div>

                <div className="faculty-attendance-overview-grid">
                  <div>
                    <span>Login Time</span>
                    <strong>{selectedFacultyAttendance?.loginDateTime ? formatAttendanceTimeLabel(selectedFacultyAttendance.loginDateTime) : '-'}</strong>
                  </div>
                  <div>
                    <span>Logout Time</span>
                    <strong>{selectedFacultyAttendance?.logoutDateTime ? formatAttendanceTimeLabel(selectedFacultyAttendance.logoutDateTime) : '-'}</strong>
                  </div>
                  <div>
                    <span>Worked Duration</span>
                    <strong>{getFacultyAttendanceWorkedDurationLabel(selectedFacultyAttendance)}</strong>
                  </div>
                </div>

                {selectedFacultyAttendanceReasonLabel ? (
                  <div className="faculty-attendance-overview-reason">
                    <span className="faculty-attendance-inline-label">Early Logout Reason</span>
                    <strong>{selectedFacultyAttendanceReasonLabel.replace(/^Reason:\s*/i, '')}</strong>
                  </div>
                ) : null}
              </section>

              <div className="faculty-view-batch-section">
                <div className="faculty-view-batch-header">
                  <div>
                    <h4>Batch Details</h4>
                    <p>All added batches for this faculty appear below.</p>
                  </div>
                </div>

                {selectedFacultyBatchGroups.length ? (
                  <div className="faculty-view-batch-group-list">
                    {selectedFacultyBatchGroups.map((group) => (
                      <div key={group.groupKey || group.courseId || group.courseName} className="faculty-view-batch-group">
                        <h4 className="faculty-view-batch-course-name">{group.courseName || 'Unassigned'}</h4>
                        <table className="faculty-batch-details-table">
                          <thead>
                            <tr>
                              <th>S.NO</th>
                              <th>Batch Name</th>
                              <th>Batch Timing</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.entries.map((entry, index) => (
                              <tr key={entry.id || `${group.courseId || 'course'}-${entry.batchName || 'batch'}-${index}`}>
                                <td>{index + 1}</td>
                                <td>
                                  <strong>{entry.batchName || '-'}</strong>
                                </td>
                                <td>{entry.batchTiming || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="faculty-view-empty">No batches added yet</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="course-modal-backdrop faculty-modal-backdrop" role="presentation">
          <div
            className="course-modal panel-card faculty-modal faculty-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="course-modal-close" onClick={closeDeleteModal} aria-label="Close delete confirmation">
              <X />
            </button>

            <div className="course-modal-header">
              <div>
                <p className="section-kicker">Confirm delete</p>
                <h3 id="faculty-delete-title">
                  Are you sure you want to delete <strong>{deleteTarget.facultyName}</strong>?
                </h3>
              </div>
            </div>

            <p className="faculty-delete-copy">
              This action cannot be undone.
            </p>

            <div className="faculty-form-actions">
              <Button type="button" variant="ghost" onClick={closeDeleteModal}>
                Cancel
              </Button>
              <Button type="button" onClick={handleDeleteConfirmed}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {batchDeleteTarget ? (
        <div className="course-modal-backdrop faculty-modal-backdrop" role="presentation">
          <div
            className="course-modal panel-card faculty-modal faculty-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-batch-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="course-modal-close" onClick={closeBatchDeleteModal} aria-label="Close delete confirmation">
              <X />
            </button>

            <div className="course-modal-header">
              <div>
                <p className="section-kicker">Confirm delete</p>
                <h3 id="faculty-batch-delete-title">Are you sure delete this timing?</h3>
              </div>
            </div>

            <p className="faculty-delete-copy">
              This will remove <strong>{batchDeleteTarget.batchName || 'this batch'}</strong>
              {batchDeleteTarget.batchTiming ? <> timing <strong>{batchDeleteTarget.batchTiming}</strong></> : null}.
            </p>

            <div className="faculty-form-actions">
              <Button type="button" variant="ghost" onClick={closeBatchDeleteModal}>
                Cancel
              </Button>
              <Button type="button" onClick={handleBatchDeleteConfirmed}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {attendanceReportRequest ? (
        <FacultyAttendanceReportModal
          isOpen={Boolean(attendanceReportRequest)}
          mode={attendanceReportRequest.mode}
          faculty={attendanceReportRequest.faculty}
          onClose={() => setAttendanceReportRequest(null)}
        />
      ) : null}
    </section>
  )
}
