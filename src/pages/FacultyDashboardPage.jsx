import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, BookOpen, Building2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Check, Clock3, FileDown, GraduationCap, Info, Layers3, LogOut, Mail, Menu, Phone, Save, ShieldCheck, UsersRound, X } from 'lucide-react'
import { createPortal } from 'react-dom'

import { NotificationBell } from '../components/NotificationBell'
import { roleDashboards } from '../data/authData'
import { FACULTY_RECORD_SYNC_EVENT, loadFacultyRecords } from '../data/facultyRecords'
import { loadFacultySnapshot, mergeFacultyWithSnapshot, saveFacultySnapshot } from '../lib/facultySnapshot'
import { loadStudentSnapshot, saveStudentSnapshot } from '../lib/studentSnapshot'
import {
  getAttendanceDateKey,
  loadFacultyBatchAttendanceState,
  loadFacultyAttendanceState,
  resolveBatchAttendanceWindow,
  resolveTodayFacultyAttendanceStatus,
  normalizeAttendanceSessions,
  formatAttendanceTimeLabel,
  saveFacultyBatchAttendanceState,
} from '../lib/facultyAttendanceStore'
import { enrichStudentsWithFacultyReferences, getFacultyBatchEntriesForCourse, getFacultyBatchStudentRecords, getFacultyCourseIds, getFacultyCourses, getMatchingStudents, getUniqueStudentCountForFacultyRecords, getUniqueStudentCountForFacultyScope, sortByNameThenTiming } from '../lib/facultyFlow'
import { markFacultyStudentAttendance } from '../services/attendanceService'
import { getFacultyMyBatchesSummary } from '../services/dashboardService'
import { getCurrentFacultyProfile } from '../services/facultyService'
import { useMobileMenu } from '../layouts/mobileMenuContext'
import { FacultyAttendanceFlow } from '../components/FacultyAttendanceFlow'
import { StudentAttendanceReportModal } from '../components/StudentAttendanceReportModal'

function getInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'ST'
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)
}

function formatDisplayDate(value) {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDisplayTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function formatMinutesLabel(value = 0) {
  const count = Math.max(0, Math.floor(Number(value) || 0))
  return `${count} minute${count === 1 ? '' : 's'}`
}

function FacultyProfileStat({ icon: Icon, label, value, tone = 'blue' }) {
  return (
    <div className={`profile-modal-stat tone-${tone}`}>
      <span className="profile-modal-stat-icon" aria-hidden="true">
        <Icon size={14} strokeWidth={2.4} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value || '-'}</strong>
      </div>
    </div>
  )
}

function FacultyProfileRow({ icon: Icon, label, value }) {
  return (
    <div className="profile-modal-info-row faculty-profile-info-row">
      <span className="profile-modal-info-label">
        <Icon size={15} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        {label}
      </span>
      <strong>{value || '-'}</strong>
    </div>
  )
}

function FacultyProfileDrawer({ faculty, batchOptions = [], isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') return null

  const profileName = faculty?.facultyName || 'Faculty'
  const initials = getInitials(profileName)
  const statusLabel = String(faculty?.status || 'Active').trim() || 'Active'
  const statusTone = statusLabel.toLowerCase() === 'active' ? 'is-active' : 'is-inactive'
  const email = String(faculty?.facultyEmail || faculty?.email || '').trim()
  const phone = String(faculty?.facultyPhone || faculty?.phone || '').trim()
  const facultyId = String(faculty?.id || '').trim()
  const courseIds = Array.isArray(faculty?.courseIds) ? faculty.courseIds.map((courseId) => String(courseId || '').trim()).filter(Boolean) : []
  const courseName = String(faculty?.courseName || faculty?.course?.name || '').trim()
  const courseLabel = courseName || (courseIds.length ? courseIds.join(', ') : 'Not assigned')
  const batchCount = Number(faculty?.batchCount || batchOptions.length || 0) || (Array.isArray(faculty?.batchEntries) ? faculty.batchEntries.length : 0)
  const attendanceState = loadFacultyAttendanceState(facultyId, profileName, initials)
  const attendanceSessions = normalizeAttendanceSessions(attendanceState)
  const latestSession = attendanceSessions.length ? attendanceSessions[attendanceSessions.length - 1] : null
  const lastLoginLabel = latestSession?.loginTimestamp ? formatAttendanceTimeLabel(new Date(Number(latestSession.loginTimestamp))) : ''
  const logoutLabel = latestSession?.logoutTimestamp ? formatAttendanceTimeLabel(new Date(Number(latestSession.logoutTimestamp))) : ''
  const earlyLogoutLabel =
    String(latestSession?.logoutType || '').trim().toLowerCase() === 'early' ? 'Early Logout' : ''
  const workReportLabel = String(latestSession?.workReport || latestSession?.workCompleted || '').trim()

  return createPortal(
    <div className="profile-drawer-backdrop faculty-profile-backdrop" role="presentation">
      <div
        className="profile-drawer faculty-profile-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="faculty-profile-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="profile-modal-cover faculty-profile-hero">
          <button type="button" className="course-modal-close profile-modal-close" onClick={onClose} aria-label="Close profile card">
            <X size={18} strokeWidth={2.5} aria-hidden="true" focusable="false" />
          </button>

          <div className="faculty-profile-title-block">
            <h3 id="faculty-profile-modal-title">{profileName}</h3>
            <div className="faculty-profile-role-row">
              <span className="faculty-profile-role">Faculty</span>
              <span className={`faculty-profile-state ${statusTone}`.trim()}>{statusLabel}</span>
            </div>
            <p className="profile-modal-email faculty-profile-email">
              <Mail size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              {email || 'No email address added'}
            </p>
          </div>
        </div>

        <div className="profile-modal-body faculty-profile-body">
          <div className="profile-modal-grid faculty-profile-stat-grid">
            <FacultyProfileStat icon={BadgeCheck} label="Role" value="Faculty" tone="blue" />
            <FacultyProfileStat icon={ShieldCheck} label="Status" value={statusLabel} tone="green" />
            <FacultyProfileStat icon={Building2} label="Course" value={courseLabel} tone="violet" />
            <FacultyProfileStat icon={Layers3} label="Batches" value={batchCount} tone="amber" />
          </div>

          <div className="profile-modal-info-list faculty-profile-info-list">
            <FacultyProfileRow icon={Phone} label="Mobile Number" value={phone || 'Not added'} />
            <FacultyProfileRow icon={Mail} label="Email Address" value={email || 'Not added'} />
            {lastLoginLabel ? <FacultyProfileRow icon={Clock3} label="Last Login" value={lastLoginLabel} /> : null}
            {logoutLabel ? <FacultyProfileRow icon={LogOut} label="Logout Time" value={logoutLabel} /> : null}
            {earlyLogoutLabel ? <FacultyProfileRow icon={X} label={earlyLogoutLabel} value={logoutLabel || 'Not logged out yet'} /> : null}
            {workReportLabel ? <FacultyProfileRow icon={FileDown} label="Work Report" value={workReportLabel} /> : null}
          </div>

          <div className="faculty-profile-divider" />
        </div>
      </div>
    </div>,
    document.body,
  )
}

function useCurrentFacultyProfile() {
  const [faculty, setFaculty] = useState(() => loadFacultySnapshot())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await getCurrentFacultyProfile()
        if (!active) return
        setFaculty((current) => {
          const nextFaculty = preferFacultyProfileSnapshot(current, result)
          saveFacultySnapshot(nextFaculty)
          return nextFaculty
        })
      } catch {
        if (!active) return
        setFaculty((current) => {
          saveFacultySnapshot(current)
          return current
        })
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [])

  return { faculty, isLoading }
}

function useFacultyStudents() {
  const [students, setStudents] = useState(() => loadStudentSnapshot())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const syncStudents = () => {
      setStudents(loadStudentSnapshot())
      setIsLoading(false)
    }

    syncStudents()

    window.addEventListener('cispro:students-changed', syncStudents)
    window.addEventListener('storage', syncStudents)

    return () => {
      window.removeEventListener('cispro:students-changed', syncStudents)
      window.removeEventListener('storage', syncStudents)
    }
  }, [])

  return { students, isLoading }
}

function useFacultyBatchesSummary() {
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await getFacultyMyBatchesSummary()
        if (!active) return
        setSummary(result || null)
      } catch {
        if (!active) return
        setSummary(null)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [])

  return { summary, isLoading }
}

function preferFacultyProfileSnapshot(current = null, next = null) {
  if (!current && !next) return null
  if (!current) return next
  if (!next) return current

  return {
    ...current,
    ...next,
    batchEntries: Array.isArray(next.batchEntries) && next.batchEntries.length ? next.batchEntries : Array.isArray(current.batchEntries) ? current.batchEntries : [],
    courseIds: Array.isArray(next.courseIds) && next.courseIds.length ? next.courseIds : Array.isArray(current.courseIds) ? current.courseIds : [],
    courseAssignments:
      Array.isArray(next.courseAssignments) && next.courseAssignments.length ? next.courseAssignments : Array.isArray(current.courseAssignments) ? current.courseAssignments : [],
    batchCount: Number(next.batchCount || current.batchCount || 0) || 0,
  }
}

function useFacultyRecords() {
  const [facultyRecords, setFacultyRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const syncFacultyRecords = () => {
      const nextRecord = loadFacultyRecords()
      setFacultyRecords(nextRecord ? [nextRecord] : [])
      setIsLoading(false)
    }

    syncFacultyRecords()

    window.addEventListener(FACULTY_RECORD_SYNC_EVENT, syncFacultyRecords)
    window.addEventListener('storage', syncFacultyRecords)

    return () => {
      window.removeEventListener(FACULTY_RECORD_SYNC_EVENT, syncFacultyRecords)
      window.removeEventListener('storage', syncFacultyRecords)
    }
  }, [])

  return { facultyRecords, isLoading }
}

function buildFacultyCourseOptions(facultyRecords = [], fallbackFaculty = null) {
  const seen = new Map()
  const pushOption = (courseId = '', courseName = '') => {
    const normalizedCourseId = String(courseId || '').trim()
    const normalizedCourseName = String(courseName || '').trim()
    const key = normalizedCourseId || normalizedCourseName.toLowerCase()
    if (!key) return

    const existing = seen.get(key)
    if (!existing || (!existing.name && normalizedCourseName)) {
      seen.set(key, {
        id: normalizedCourseId || key,
        name: normalizedCourseName || normalizedCourseId || 'Course',
        courseName: normalizedCourseName || normalizedCourseId || 'Course',
        title: normalizedCourseName || normalizedCourseId || 'Course',
      })
    }
  }

  const records = Array.isArray(facultyRecords) ? facultyRecords : []

  records.forEach((record) => {
    const courseId = String(record?.courseId || '').trim()
    const courseName = String(record?.courseName || '').trim()
    pushOption(courseId, courseName)

    if (Array.isArray(record?.courseIds)) {
      record.courseIds.forEach((value) => pushOption(String(value || '').trim(), courseName))
    }

    if (Array.isArray(record?.courseAssignments)) {
      record.courseAssignments.forEach((assignment) => pushOption(assignment?.courseId, assignment?.courseName || courseName))
    }

    if (Array.isArray(record?.batchEntries)) {
      record.batchEntries.forEach((entry) => pushOption(entry?.courseId, entry?.courseName || courseName))
    }
  })

  if (fallbackFaculty) {
    pushOption(fallbackFaculty.courseId, fallbackFaculty.courseName)
    if (Array.isArray(fallbackFaculty.courseIds)) {
      fallbackFaculty.courseIds.forEach((courseId) => pushOption(courseId, fallbackFaculty.courseName))
    }
  }

  return Array.from(seen.values())
}

function getFacultyGreetingName(facultyName) {
  const value = String(facultyName || '').trim()
  if (!value) return ''
  return value.split(/\s+/)[0] || ''
}

function getFacultyGreetingLabel() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function formatFacultyMonthYear(date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function buildFacultyAttendanceSeed(value = '') {
  return Array.from(String(value || '')).reduce((sum, character) => sum + character.charCodeAt(0), 0)
}

function buildBatchProgressValue(seed = '', index = 0) {
  const value = buildFacultyAttendanceSeed(`${seed}-${index}`)
  return 52 + (value % 39)
}

function buildBatchTestScores(seed = '', index = 0) {
  const base = buildFacultyAttendanceSeed(`${seed}-${index}`)
  const first = 48 + (base % 17)
  const second = Math.min(98, first + 6 + (base % 8))
  const third = Math.min(99, second + 4 + (base % 6))
  return [first, second, third]
}

function getFacultyIdentityKey(record = {}) {
  return {
    id: String(record?.id || record?._id || record?.facultyId || '').trim().toLowerCase(),
    email: String(record?.facultyEmail || record?.email || '').trim().toLowerCase(),
    name: String(record?.facultyName || '').trim().toLowerCase(),
  }
}

function isSameFacultyRecord(left = {}, right = {}) {
  const leftKey = getFacultyIdentityKey(left)
  const rightKey = getFacultyIdentityKey(right)

  return Boolean(
    (leftKey.id && leftKey.id === rightKey.id) ||
      (leftKey.email && leftKey.email === rightKey.email) ||
      (leftKey.name && leftKey.name === rightKey.name),
  )
}

function buildFacultyAttendanceSeries({ facultyName = '', batchKey = '' } = {}) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(2026, 6 + index, 1)
    return date
  })
  const seed = buildFacultyAttendanceSeed(`${facultyName}-${batchKey}`)
  const basePattern = [91, 89, 93, 90, 88, 92]
  const offset = seed % basePattern.length

  return months.map((date, index) => ({
    label: formatFacultyMonthYear(date),
    value: basePattern[(offset + index) % basePattern.length],
  }))
}

function formatBatchOptionLabel(batchName = '', courseName = '') {
  const normalizedBatchName = String(batchName || '').trim()
  const normalizedCourseName = String(courseName || '').trim()

  if (!normalizedBatchName && !normalizedCourseName) return 'Batch'
  if (!normalizedCourseName) return normalizedBatchName || 'Batch'
  if (!normalizedBatchName) return normalizedCourseName

  return `${normalizedBatchName} - ${normalizedCourseName}`
}

function getFacultyBatchOptions(faculty) {
  const entries = Array.isArray(faculty?.batchEntries) ? faculty.batchEntries : []
  const seen = new Set()

  return sortByNameThenTiming(
    entries.filter((entry) => {
      const batchName = String(entry?.batchName || '').trim()
      const batchTiming = String(entry?.batchTiming || '').trim()
      const courseId = String(entry?.courseId || '').trim()
      const courseName = String(entry?.courseName || '').trim()
      const batchId = String(entry?.id || '').trim()
      const uniqueKey = [batchId || batchName, batchTiming, courseId || courseName]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .join('|')

      if (!uniqueKey || seen.has(uniqueKey)) {
        return false
      }

      seen.add(uniqueKey)
      return true
    }),
  ).map((entry, index) => {
    const label = String(entry?.batchName || '').trim()
    const timing = String(entry?.batchTiming || '').trim()
    const courseId = String(entry?.courseId || '').trim()
    const courseName = String(entry?.courseName || '').trim()
    const fallbackKey = `${label || 'batch'}-${timing || 'timing'}-${index}`

    return {
      id: String(entry?.id || fallbackKey).trim() || fallbackKey,
      label: formatBatchOptionLabel(label || `Batch ${index + 1}`, courseName),
      batchName: label || `Batch ${index + 1}`,
      timing,
      courseId,
      courseName,
      sequenceNo: Number(entry?.sequenceNo || index + 1) || index + 1,
    }
  })
}

function getBatchProgressValue(studentCount = 0, totalStudents = 0) {
  if (!totalStudents) return 0
  return Math.max(10, Math.min(100, Math.round((studentCount / totalStudents) * 100)))
}

function normalizeAttendanceChoice(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'present') return 'Present'
  if (normalized === 'absent') return 'Absent'
  return ''
}

function buildBatchAttendanceDraft(students = [], savedRecords = {}) {
  return Array.isArray(students)
    ? students.reduce((accumulator, student, index) => {
        const studentId = String(student?.id || `${student?.studentName || 'student'}-${index}`).trim()
        if (!studentId) return accumulator
        accumulator[studentId] = normalizeAttendanceChoice(savedRecords?.[studentId] || student?.attendance || '')
        return accumulator
      }, {})
    : {}
}

function getBatchAttendanceProgress(attendanceDraft = {}) {
  const statuses = Object.values(attendanceDraft || {})
  const markedCount = statuses.filter(Boolean).length
  const presentCount = statuses.filter((status) => status === 'Present').length
  const absentCount = statuses.filter((status) => status === 'Absent').length

  return {
    markedCount,
    presentCount,
    absentCount,
    totalCount: statuses.length,
    isComplete: statuses.length > 0 && markedCount === statuses.length,
  }
}

function FacultySummaryCard({
  icon: Icon,
  label,
  value,
  note,
  tone = 'blue',
  tooltip,
  tooltipId,
  isTooltipOpen,
  onToggleTooltip,
  onOpenTooltip,
  onCloseTooltip,
}) {
  return (
    <article className={`student-summary-card faculty-summary-card tone-${tone} ${isTooltipOpen ? 'is-tooltip-open' : ''}`.trim()}>
      <div className="student-summary-card-icon faculty-summary-card-icon" aria-hidden="true">
        <Icon size={26} strokeWidth={2.2} />
      </div>
      <div className="student-summary-card-copy faculty-summary-card-copy">
        <span className="student-summary-card-label faculty-summary-card-label">{label}</span>
        <strong className="student-summary-card-value faculty-summary-card-value">{value ?? '-'}</strong>
        {note ? <small className="student-summary-card-note faculty-summary-card-note">{note}</small> : null}
      </div>
      <div className="faculty-summary-card-actions">
        <button
          type="button"
          className={`faculty-summary-info-button ${isTooltipOpen ? 'is-open' : ''}`.trim()}
          aria-label={`${label} details`}
          aria-describedby={tooltipId}
          aria-expanded={isTooltipOpen}
          onClick={onToggleTooltip}
          onMouseEnter={onOpenTooltip}
          onMouseLeave={onCloseTooltip}
          onFocus={onOpenTooltip}
          onBlur={onCloseTooltip}
        >
          <Info size={13} strokeWidth={2.5} aria-hidden="true" focusable="false" />
          <div className="faculty-summary-tooltip" id={tooltipId} role="tooltip" aria-label={`${label} details`}>
            <strong>{label}</strong>
            <p>{tooltip}</p>
          </div>
        </button>
      </div>
    </article>
  )
}

function FacultySummaryStrip({ cards = [], ariaLabel = 'Faculty summary cards', className = '' }) {
  const [activeTooltipIndex, setActiveTooltipIndex] = useState(null)
  const stripRef = useRef(null)

  useEffect(() => {
    if (activeTooltipIndex === null) return undefined

    const handlePointerDown = (event) => {
      if (stripRef.current?.contains(event.target)) return
      setActiveTooltipIndex(null)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveTooltipIndex(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTooltipIndex])

  return (
    <div ref={stripRef} className={`student-summary-strip faculty-summary-strip ${className}`.trim()} aria-label={ariaLabel}>
      {cards.map((card, index) => {
        const tooltipId = `faculty-summary-tooltip-${index}`
        const isTooltipOpen = activeTooltipIndex === index

        return (
          <FacultySummaryCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            note={card.note}
            tone={card.tone}
            tooltip={card.tooltip}
            tooltipId={tooltipId}
            isTooltipOpen={isTooltipOpen}
            onToggleTooltip={() => setActiveTooltipIndex((current) => (current === index ? null : index))}
            onOpenTooltip={() => setActiveTooltipIndex(index)}
            onCloseTooltip={() => setActiveTooltipIndex((current) => (current === index ? null : current))}
          />
        )
      })}
    </div>
  )
}

function FacultyAttendanceCard({ faculty, batches = [] }) {
  const [selectedBatchId, setSelectedBatchId] = useState('all')
  const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const batchOptions = batches
  const selectedBatch = batchOptions.find((batch) => batch.id === selectedBatchId) || null
  const selectedBatchLabel = selectedBatch ? selectedBatch.label : 'All Batches'
  const selectedBatchKey = selectedBatch ? selectedBatch.id : 'all'
  const attendanceSeries = useMemo(
    () =>
      buildFacultyAttendanceSeries({
        facultyName: faculty?.facultyName || '',
        batchKey: selectedBatchKey,
      }),
    [faculty?.facultyName, selectedBatchKey],
  )
  const chartMax = 100

  useEffect(() => {
    if (!isBatchMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsBatchMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsBatchMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isBatchMenuOpen])

  const rangeLabel = 'Jul 2026 - Dec 2026'

  return (
    <section className="faculty-attendance-card panel-card">
      <div className="faculty-attendance-head">
        <div className="faculty-attendance-head-copy">
          <h3>Monthly Attendance</h3>
          <p>Track attendance percentage across months</p>
        </div>

        <div className="faculty-attendance-filters">
          <div ref={menuRef} className="faculty-batch-dropdown-wrap">
            <button
              type="button"
              className="faculty-batch-dropdown-trigger"
              onClick={() => setIsBatchMenuOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={isBatchMenuOpen}
            >
              <UsersRound size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              <span>{selectedBatchLabel === 'All Batches' ? 'All Batches' : selectedBatchLabel}</span>
              <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
            </button>

            {isBatchMenuOpen ? (
              <div className="faculty-batch-dropdown-menu" role="listbox" aria-label="Faculty batches">
                <button
                  type="button"
                  className={`faculty-batch-dropdown-item ${selectedBatchId === 'all' ? 'is-active' : ''}`.trim()}
                  onClick={() => {
                    setSelectedBatchId('all')
                    setIsBatchMenuOpen(false)
                  }}
                >
                  <UsersRound size={14} strokeWidth={2.4} aria-hidden="true" focusable="false" />
                  <span>All Batches</span>
                  {selectedBatchId === 'all' ? <Check size={14} strokeWidth={2.5} aria-hidden="true" focusable="false" /> : null}
                </button>

                {batchOptions.map((batch) => (
                  <button
                    key={batch.id}
                    type="button"
                    className={`faculty-batch-dropdown-item ${selectedBatchId === batch.id ? 'is-active' : ''}`.trim()}
                    onClick={() => {
                      setSelectedBatchId(batch.id)
                      setIsBatchMenuOpen(false)
                    }}
                  >
                    <span className="faculty-batch-dropdown-dot" aria-hidden="true" />
                    <span>{batch.label}</span>
                    {selectedBatchId === batch.id ? <Check size={14} strokeWidth={2.5} aria-hidden="true" focusable="false" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" className="faculty-range-chip" aria-label={rangeLabel}>
            <CalendarDays size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            <span>{rangeLabel}</span>
            <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
          </button>
        </div>
      </div>

      <div className="faculty-attendance-chart" aria-label="Monthly attendance chart">
        <div className="faculty-attendance-axis faculty-attendance-axis-left" aria-hidden="true">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>

        <div className="faculty-attendance-plot">
          <div className="faculty-attendance-grid-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="faculty-attendance-bars" style={{ gridTemplateColumns: `repeat(${attendanceSeries.length}, minmax(0, 1fr))` }}>
            {attendanceSeries.map((item) => (
              <div key={item.label} className="faculty-attendance-group">
                <strong className="faculty-attendance-value">{item.value}%</strong>
                <div className="faculty-attendance-bar-wrap">
                  <div className="faculty-attendance-bar" style={{ height: `${(item.value / chartMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="faculty-attendance-months" style={{ gridTemplateColumns: `repeat(${attendanceSeries.length}, minmax(0, 1fr))` }}>
            {attendanceSeries.map((item) => (
              <span key={item.label}>{item.label}</span>
            ))}
          </div>
        </div>

        <div className="faculty-attendance-axis faculty-attendance-axis-right" aria-hidden="true">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>
      </div>
    </section>
  )
}

function FacultyBatchProgressCard({ batches = [] }) {
  const visibleBatches = batches.slice(0, 6)

  return (
    <section className="faculty-batch-progress-card panel-card">
      <div className="faculty-batch-progress-head">
        <div className="faculty-batch-progress-head-copy">
          <h3>Course Completion Progress</h3>
          <p>Batch name details and progress overview</p>
        </div>
        <button type="button" className="faculty-range-chip" aria-label="View by weeks">
          <span>View By: Weeks</span>
          <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
        </button>
      </div>

      <div className="faculty-batch-progress-list" role="list" aria-label="Batch completion progress">
        {visibleBatches.length ? (
          visibleBatches.map((batch, index) => {
            const progress = buildBatchProgressValue(batch.label, index)
            return (
              <article key={batch.id} className="faculty-batch-progress-row" role="listitem">
                <div className="faculty-batch-progress-name">
                  <span className="faculty-batch-progress-avatar" aria-hidden="true">
                    <UsersRound size={16} strokeWidth={2.3} />
                  </span>
                  <div>
                    <strong>{batch.label}</strong>
                    <span>{batch.timing || 'Batch schedule'}</span>
                  </div>
                </div>

                <div className="faculty-batch-progress-track" aria-hidden="true">
                  <div className="faculty-batch-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <div className="faculty-batch-progress-completion">
                  <strong>{progress}%</strong>
                  <span>{progress >= 90 ? 'Completed' : `Week ${Math.max(1, Math.ceil(progress / 10))} / 12`}</span>
                </div>
              </article>
            )
          })
        ) : (
          <div className="faculty-batch-progress-empty">
            <strong>No batches added yet</strong>
            <p>Add batch names in Faculty Management to show the progress list here.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function FacultyBatchPerformanceCard({ batches = [] }) {
  const visibleBatches = batches.slice(0, 6)
  const testLabels = ['Test 1', 'Test 2', 'Test 3']
  const legendTones = ['blue', 'green', 'violet']

  return (
    <section className="faculty-batch-performance-card panel-card">
        <div className="faculty-batch-performance-head">
          <div className="faculty-batch-performance-head-copy">
            <h3>Batch Test Performance (%)</h3>
            <p>Batch test performance comparison</p>
          </div>
          <div className="faculty-batch-performance-legend" aria-hidden="true">
            {testLabels.map((label, index) => (
              <span key={label} className="faculty-batch-performance-legend-item">
                <span className={`faculty-batch-performance-legend-dot tone-${legendTones[index]}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="faculty-batch-performance-chart" aria-label="Batch test performance chart">
          <div className="faculty-batch-performance-axis faculty-batch-performance-axis-left" aria-hidden="true">
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
          </div>

          <div className="faculty-batch-performance-plot">
            <div className="faculty-batch-performance-grid" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="faculty-batch-performance-bars" style={{ gridTemplateColumns: `repeat(${visibleBatches.length || 6}, minmax(0, 1fr))` }}>
              {(visibleBatches.length ? visibleBatches : Array.from({ length: 6 }, (_, index) => ({ id: `fallback-${index}`, label: `Batch ${index + 1}` }))).map((batch, batchIndex) => {
                const scores = buildBatchTestScores(batch.label, batchIndex)
                return (
                  <div key={batch.id} className="faculty-batch-performance-group">
                    <div className="faculty-batch-performance-triple">
                      {scores.map((score, scoreIndex) => (
                        <div key={`${batch.id}-${scoreIndex}`} className="faculty-batch-performance-bar-wrap">
                          <strong>{score}</strong>
                          <div
                            className={`faculty-batch-performance-bar tone-${legendTones[scoreIndex]}`}
                            style={{ height: `${score}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    <span className="faculty-batch-performance-label">{batch.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
    </section>
  )
}

export function FacultyDashboardPage({ dashboard = roleDashboards.faculty }) {
  const openMenu = useMobileMenu()
  const { faculty: latestFaculty, isLoading } = useCurrentFacultyProfile()
  const { facultyRecords, isLoading: isFacultyRecordsLoading } = useFacultyRecords()
  const { students, isLoading: isStudentsLoading } = useFacultyStudents()
  const { summary: batchesSummary, isLoading: isBatchesSummaryLoading } = useFacultyBatchesSummary()
  const activeFaculty = latestFaculty || null
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const backfilledStudents = useMemo(
    () => enrichStudentsWithFacultyReferences(students, facultyRecords),
    [facultyRecords, students],
  )

  useEffect(() => {
    if (backfilledStudents === students) return
    saveStudentSnapshot(backfilledStudents)
  }, [backfilledStudents, students])

  const profileName = activeFaculty?.facultyName || latestFaculty?.facultyName || 'Faculty'
  const profileInitials = getInitials(profileName)
  const facultyAttendanceId = activeFaculty?.id || latestFaculty?.id || ''
  const resolvedFaculty = useMemo(() => {
    const matchingRecord = Array.isArray(facultyRecords)
      ? facultyRecords.find((record) => isSameFacultyRecord(record, latestFaculty || activeFaculty || {})) || null
      : null

    return mergeFacultyWithSnapshot(matchingRecord || latestFaculty || activeFaculty || null)
  }, [activeFaculty, facultyRecords, latestFaculty])
  const profileFaculty = resolvedFaculty || activeFaculty || latestFaculty || null

  useEffect(() => {
    if (!profileFaculty) return
    saveFacultySnapshot(profileFaculty)
  }, [profileFaculty])

  const facultyAttendanceStatus = useMemo(
    () => resolveTodayFacultyAttendanceStatus(facultyAttendanceId || profileName),
    [facultyAttendanceId, profileName],
  )
  const greetingName = getFacultyGreetingName(profileFaculty?.facultyName || activeFaculty?.facultyName || latestFaculty?.facultyName)
  const greetingLabel = getFacultyGreetingLabel()
  const batchNames = useMemo(
    () =>
      Array.isArray(profileFaculty?.batchEntries)
        ? profileFaculty.batchEntries.map((entry) => String(entry?.batchName || '').trim()).filter(Boolean)
        : [],
    [profileFaculty],
  )
  const batchOptions = getFacultyBatchOptions(profileFaculty || {})
  const profileDrawer = (
    <FacultyProfileDrawer
      faculty={profileFaculty}
      batchOptions={batchOptions}
      isOpen={isProfileOpen}
      onClose={() => setIsProfileOpen(false)}
    />
  )
  const profileChip = (
    <button
      type="button"
      className="student-dashboard-profile-chip student-dashboard-profile-chip-button faculty-dashboard-profile-chip-button"
      onClick={() => setIsProfileOpen(true)}
      aria-label={`Open ${profileName} profile card`}
      aria-haspopup="dialog"
      aria-expanded={isProfileOpen}
    >
      <span className="student-dashboard-profile-initials" aria-hidden="true">
        {profileInitials}
      </span>
      <span className="student-dashboard-profile-name">{profileName}</span>
      <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
    </button>
  )
  const facultyCourseIds = getFacultyCourseIds(profileFaculty || {})
  const courseScopedStudentCount = useMemo(
    () =>
      getUniqueStudentCountForFacultyScope(backfilledStudents, {
        facultyName: profileFaculty?.facultyName || activeFaculty?.facultyName || latestFaculty?.facultyName || '',
        facultyId: profileFaculty?.id || activeFaculty?.id || latestFaculty?.id || '',
        courseId: profileFaculty?.courseId || facultyCourseIds[0] || '',
        courseName: profileFaculty?.courseName || '',
        batchNames,
        batchIds: Array.isArray(profileFaculty?.batchEntries) ? profileFaculty.batchEntries.map((entry) => String(entry?.id || '').trim()).filter(Boolean) : [],
      }),
    [activeFaculty, backfilledStudents, batchNames, facultyCourseIds, latestFaculty, profileFaculty],
  )
  const batchLinkedStudentCount = useMemo(
    () =>
      getUniqueStudentCountForFacultyRecords(backfilledStudents, {
        facultyName: profileFaculty?.facultyName || activeFaculty?.facultyName || latestFaculty?.facultyName || '',
        facultyId: profileFaculty?.id || activeFaculty?.id || latestFaculty?.id || '',
        batchEntries: profileFaculty?.batchEntries || activeFaculty?.batchEntries || latestFaculty?.batchEntries || [],
      }),
    [activeFaculty, backfilledStudents, latestFaculty, profileFaculty],
  )
  const matchingStudents = useMemo(
    () =>
      getMatchingStudents(backfilledStudents, {
        facultyName: profileFaculty?.facultyName || activeFaculty?.facultyName || '',
        facultyId: profileFaculty?.id || activeFaculty?.id || latestFaculty?.id || '',
        courseId: profileFaculty?.courseId || facultyCourseIds[0] || '',
        courseName: profileFaculty?.courseName || '',
      }),
    [activeFaculty, backfilledStudents, facultyCourseIds, latestFaculty, profileFaculty],
  )
  const totalStudents = Number(batchesSummary?.totalStudents || 0) || batchLinkedStudentCount || courseScopedStudentCount || matchingStudents.length
  const dashboardTotalBatchCount = Number(batchesSummary?.totalBatches || 0) || (Array.isArray(profileFaculty?.batchEntries)
    ? profileFaculty.batchEntries.length
    : Number(profileFaculty?.batchCount || 0) || 0)
  const summaryCards = [
    {
      icon: GraduationCap,
      label: 'Total Courses',
      value: facultyCourseIds.length || (profileFaculty?.courseName ? 1 : 0),
      note: 'Courses you are teaching',
      tone: 'blue',
      tooltip: 'Shows how many courses are assigned to your faculty profile and currently visible in your dashboard.',
    },
    {
      icon: UsersRound,
      label: 'Total Students',
      value: totalStudents,
      note: 'Students across all courses',
      tone: 'green',
      tooltip: 'Shows the total unique students linked to your courses and batches.',
    },
    {
      icon: Layers3,
      label: 'Total Batches',
      value: dashboardTotalBatchCount,
      note: 'Batches running',
      tone: 'violet',
      tooltip: 'Shows the batch groups currently running under your assigned courses.',
    },
    {
      icon: BookOpen,
      label: 'Attendance',
      value: facultyAttendanceStatus.status,
      note: facultyAttendanceStatus.reason,
      tone: facultyAttendanceStatus.status === 'Present' ? 'green' : 'orange',
      tooltip: 'Shows your live attendance state for today. Present means you are currently logged in and active.',
    },
  ]

  if (isLoading) {
    return (
      <section className="student-dashboard-page">
        <header className="student-dashboard-header">
          <div className="student-dashboard-header-copy">
            <p className="student-dashboard-header-title">Loading Faculty Dashboard...</p>
            <p className="student-dashboard-header-subtitle">Please wait while we fetch your dashboard details.</p>
          </div>
          <div className="student-dashboard-header-actions">
            <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
            {profileChip}
          </div>
        </header>
        <article className="panel-card student-dashboard-empty">
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
          <div className="student-empty-state">
            <strong>Loading faculty profile...</strong>
            <p>Please wait while we fetch your dashboard details.</p>
          </div>
        </article>
      </section>
    )
  }

  if (!latestFaculty) {
    return (
      <section className="student-dashboard-page">
        <header className="student-dashboard-header">
          <div className="student-dashboard-header-copy">
            <p className="student-dashboard-header-title">Faculty Dashboard</p>
            <p className="student-dashboard-header-subtitle">Welcome back to your faculty dashboard.</p>
          </div>
          <div className="student-dashboard-header-actions">
            <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
            {profileChip}
          </div>
        </header>
        <article className="panel-card student-dashboard-empty">
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
          <div className="student-empty-state">
            <strong>No faculty profile found</strong>
            <p>Please contact the operation manager to create or activate your faculty record.</p>
          </div>
        </article>
        {profileDrawer}
      </section>
    )
  }

  return (
    <section className="student-dashboard-page faculty-dashboard-page">
      <header className="student-dashboard-header faculty-dashboard-header">
        <button
          type="button"
          className="mobile-menu-button faculty-dashboard-mobile-menu-button"
          onClick={openMenu}
          aria-label="Open navigation menu"
        >
          <Menu />
        </button>
        <div className="student-dashboard-header-copy">
          <p className="student-dashboard-header-title">
            {greetingLabel}
            {greetingName ? `, ${greetingName}!` : '!'}
          </p>
          <p className="student-dashboard-header-subtitle">Welcome back to your faculty dashboard.</p>
        </div>

        <div className="student-dashboard-header-actions">
          <NotificationBell />
          <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
          {profileChip}
        </div>
      </header>

      <FacultySummaryStrip cards={summaryCards} ariaLabel="Faculty summary cards" />

      <div className="faculty-dashboard-analytics-grid">
        <FacultyAttendanceCard faculty={profileFaculty || activeFaculty || latestFaculty} batches={batchOptions} />
        <FacultyBatchProgressCard batches={batchOptions} />
      </div>

      <FacultyBatchPerformanceCard batches={batchOptions} />
      {profileDrawer}

    </section>
  )
}

export function FacultyMyBatchesPage() {
  const openMenu = useMobileMenu()
  const { faculty: latestFaculty, isLoading } = useCurrentFacultyProfile()
  const { facultyRecords, isLoading: isFacultyRecordsLoading } = useFacultyRecords()
  const { students, isLoading: isStudentsLoading } = useFacultyStudents()
  const { summary: batchesSummary, isLoading: isBatchesSummaryLoading } = useFacultyBatchesSummary()
  const [selectedBatchContext, setSelectedBatchContext] = useState(null)
  const [selectedBatchView, setSelectedBatchView] = useState('details')
  const [selectedBatchAttendanceDraft, setSelectedBatchAttendanceDraft] = useState({})
  const [selectedBatchAttendanceMessage, setSelectedBatchAttendanceMessage] = useState('')
  const [selectedBatchAttendanceState, setSelectedBatchAttendanceState] = useState(null)
  const [selectedBatchAttendanceMode, setSelectedBatchAttendanceMode] = useState('regular')
  const [selectedBulkAttendance, setSelectedBulkAttendance] = useState('')
  const [attendanceSavePopup, setAttendanceSavePopup] = useState(null)
  const [attendanceReminderPopup, setAttendanceReminderPopup] = useState(null)
  const [attendanceReportRequest, setAttendanceReportRequest] = useState(null)
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date())
  const attendanceReminderShownRef = useRef(new Set())
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const profileName = latestFaculty?.facultyName || 'Faculty'
  const profileInitials = getInitials(profileName)
  const greetingName = getFacultyGreetingName(latestFaculty?.facultyName)
  const greetingLabel = getFacultyGreetingLabel()
  const activeFaculty = latestFaculty || null
  const facultyAttendanceId = activeFaculty?.id || latestFaculty?.id || ''
  const resolvedFaculty = useMemo(() => {
    const matchingRecord = Array.isArray(facultyRecords)
      ? facultyRecords.find((record) => isSameFacultyRecord(record, latestFaculty || activeFaculty || {})) || null
      : null

    return mergeFacultyWithSnapshot(matchingRecord || latestFaculty || activeFaculty || null)
  }, [activeFaculty, facultyRecords, latestFaculty])
  const profileFaculty = resolvedFaculty || activeFaculty || latestFaculty || null

  useEffect(() => {
    const tick = () => setCurrentDateTime(new Date())
    tick()

    const intervalId = window.setInterval(tick, 30000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!profileFaculty) return
    saveFacultySnapshot(profileFaculty)
  }, [profileFaculty])

  const displayFaculty = profileFaculty || activeFaculty || latestFaculty
  const courseOptions = useMemo(
    () => buildFacultyCourseOptions(facultyRecords, displayFaculty || latestFaculty || activeFaculty || null),
    [activeFaculty, displayFaculty, facultyRecords, latestFaculty],
  )
  const profileDrawer = (
    <FacultyProfileDrawer
      faculty={profileFaculty}
      batchOptions={getFacultyBatchOptions(displayFaculty || {})}
      isOpen={isProfileOpen}
      onClose={() => setIsProfileOpen(false)}
    />
  )
  const profileChip = (
    <button
      type="button"
      className="student-dashboard-profile-chip student-dashboard-profile-chip-button faculty-dashboard-profile-chip-button"
      onClick={() => setIsProfileOpen(true)}
      aria-label={`Open ${profileName} profile card`}
      aria-haspopup="dialog"
      aria-expanded={isProfileOpen}
    >
      <span className="student-dashboard-profile-initials" aria-hidden="true">
        {profileInitials}
      </span>
      <span className="student-dashboard-profile-name">{profileName}</span>
      <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
    </button>
  )

  const facultyBackfillPool = useMemo(() => {
    const pool = []
    if (displayFaculty) pool.push(displayFaculty)
    if (Array.isArray(facultyRecords) && facultyRecords.length) pool.push(...facultyRecords)
    return pool
  }, [displayFaculty, facultyRecords])

  const backfilledStudents = useMemo(
    () => enrichStudentsWithFacultyReferences(students, facultyBackfillPool, courseOptions),
    [courseOptions, facultyBackfillPool, students],
  )

  useEffect(() => {
    if (backfilledStudents === students) return
    saveStudentSnapshot(backfilledStudents)
  }, [backfilledStudents, students])

  const facultyCourseIds = getFacultyCourseIds(displayFaculty || {}, courseOptions)
  const batchSummaryEntries = useMemo(
    () => (Array.isArray(batchesSummary?.batchCounts) ? batchesSummary.batchCounts : []),
    [batchesSummary],
  )

  const getBatchSummaryForRow = useCallback((batch = {}, batchIndex = -1) => {
    const rowBatchId = String(batch?.id || '').trim().toLowerCase()
    const rowBatchName = String(batch?.batchName || batch?.label || '').trim().toLowerCase()

    const normalizeStudentRecords = (entry = null) => ({
      studentCount: Number(entry?.studentCount || entry?.studentRecords?.length || 0) || 0,
      studentRecords: Array.isArray(entry?.studentRecords) ? entry.studentRecords : [],
    })

    if (rowBatchId) {
      const idMatch = batchSummaryEntries.find((entry) => String(entry?.batchId || '').trim().toLowerCase() === rowBatchId)
      if (idMatch) return normalizeStudentRecords(idMatch)
    }

    if (rowBatchName) {
      const nameMatch = batchSummaryEntries.find((entry) =>
        Array.isArray(entry?.studentRecords)
          ? entry.studentRecords.some((student) => String(student?.batchName || '').trim().toLowerCase() === rowBatchName)
          : false,
      )

      if (nameMatch) return normalizeStudentRecords(nameMatch)
    }

    const fallbackEntry = batchSummaryEntries[Number(batchIndex) || 0]
    if (fallbackEntry) return normalizeStudentRecords(fallbackEntry)

    return { studentCount: 0, studentRecords: [] }
  }, [batchSummaryEntries])

  const facultyCourseGroups = useMemo(() => {
    if (!displayFaculty) return []

    const getSavedBatchAttendanceCounts = (state = null) => {
      const records = state && typeof state.records === 'object' && !Array.isArray(state.records) ? state.records : {}
      const statuses = Object.values(records).map((value) => normalizeAttendanceChoice(value))
      return {
        present: statuses.filter((status) => status === 'Present').length,
        absent: statuses.filter((status) => status === 'Absent').length,
      }
    }

    const courseRecords = getFacultyCourses(displayFaculty, courseOptions)
    const fallbackCourseName = String(displayFaculty?.courseName || '').trim()
    const fallbackCourseId = String(displayFaculty?.courseId || '').trim()
    const batchEntries = Array.isArray(displayFaculty?.batchEntries) ? displayFaculty.batchEntries : []

    const resolvedCourses =
      courseRecords.length > 0
        ? courseRecords
        : fallbackCourseName || fallbackCourseId
          ? [
              {
                courseId: fallbackCourseId,
                courseName: fallbackCourseName || fallbackCourseId || 'Course',
                batchCount: batchEntries.length,
              },
            ]
          : []

    return resolvedCourses.map((course, courseIndex) => {
      const batches = sortByNameThenTiming(getFacultyBatchEntriesForCourse(displayFaculty, course.courseId, courseOptions)).map((batch, batchIndex) => {
        const batchName = String(batch?.batchName || '').trim() || `Batch ${Number(batch?.sequenceNo || batchIndex + 1) || batchIndex + 1}`
        const batchTiming = String(batch?.batchTiming || '').trim()
        const batchSummary = getBatchSummaryForRow(batch, batchIndex)
        const localStudentRecords = getFacultyBatchStudentRecords(backfilledStudents, {
          facultyName: displayFaculty?.facultyName || latestFaculty?.facultyName || '',
          facultyId: displayFaculty?.id || latestFaculty?.id || '',
          courseId: course.courseId,
          courseName: course.courseName,
          batchName: batchName,
          batchId: batch?.id || '',
        })
        const studentRecords = Array.isArray(batchSummary.studentRecords) && batchSummary.studentRecords.length ? batchSummary.studentRecords : localStudentRecords
        const studentCount = Number(batchSummary.studentCount || studentRecords.length || localStudentRecords.length || 0) || 0
        const savedAttendanceState = loadFacultyBatchAttendanceState(
          displayFaculty?.id || latestFaculty?.id || '',
          displayFaculty?.facultyName || latestFaculty?.facultyName || '',
          profileInitials,
          batch?.id || '',
          batchName,
          batchTiming,
        )
        const attendanceCounts = getSavedBatchAttendanceCounts(savedAttendanceState)
        const present = attendanceCounts.present
        const absent = attendanceCounts.absent
        const progress = getBatchProgressValue(present, studentCount)

        return {
          ...batch,
          id: String(batch?.id || `${course.courseId || 'course'}-${batchName}-${batchIndex}`).trim(),
          label: batchName,
          timing: batchTiming,
          sequenceNo: Number(batch?.sequenceNo || batchIndex + 1) || batchIndex + 1,
          studentRecords,
          studentCount,
          present,
          absent,
          progress,
          progressLabel: progress >= 90 ? 'Completed' : `Week ${Math.max(1, Math.ceil(progress / 10))} / 12`,
        }
      })

      const groupProgress = batches.length
        ? Math.round(batches.reduce((sum, batch) => sum + batch.progress, 0) / batches.length)
        : 0

      return {
        ...course,
        courseIndex,
        batches,
        totalStudents: batches.reduce((sum, batch) => sum + Number(batch.studentCount || 0), 0),
        groupProgress,
      }
    })
  }, [backfilledStudents, courseOptions, displayFaculty, getBatchSummaryForRow, latestFaculty?.facultyName, latestFaculty?.id, profileInitials])

  let pageAttendanceReminder = null
  if (facultyCourseGroups.length) {
    const facultyId = displayFaculty?.id || latestFaculty?.id || ''
    const facultyName = displayFaculty?.facultyName || latestFaculty?.facultyName || ''

    for (const group of facultyCourseGroups) {
      for (const batch of Array.isArray(group.batches) ? group.batches : []) {
        const batchTiming = String(batch?.timing || '').trim()
        const batchWindow = resolveBatchAttendanceWindow(batchTiming, currentDateTime)
        if (!batchWindow.isReminder) continue

        const savedAttendanceState = loadFacultyBatchAttendanceState(
          facultyId,
          facultyName,
          profileInitials,
          batch?.id || '',
          batch?.label || '',
          batchTiming,
        )

        if (savedAttendanceState) continue

        pageAttendanceReminder = {
          group,
          batch,
          batchWindow,
          courseName: String(group.courseName || group.courseId || 'Course').trim(),
          batchName: String(batch?.label || 'Batch').trim(),
          batchTiming,
          remainingMinutes: batchWindow.minutesUntilEnd,
          endTimeLabel: formatDisplayTime(batchWindow.endDateTime || currentDateTime),
        }
        break
      }

      if (pageAttendanceReminder) {
        break
      }
    }
  }

  const openCourseAttendanceReport = (group) => {
    if (!group) return

    const nextStudents = Array.isArray(group.batches)
      ? group.batches.flatMap((batch) => (Array.isArray(batch.studentRecords) ? batch.studentRecords : []))
      : []
    const uniqueBatchIds = Array.from(
      new Set(
        (Array.isArray(group.batches) ? group.batches : [])
          .map((batch) => String(batch?.batchId || batch?.id || '').trim())
          .filter(Boolean),
      ),
    )
    const singleBatchRecord = uniqueBatchIds.length === 1
      ? (Array.isArray(group.batches)
          ? group.batches.find((batch) => String(batch?.batchId || batch?.id || '').trim() === uniqueBatchIds[0]) || null
          : null)
      : null

    setAttendanceReportRequest({
      mode: singleBatchRecord ? 'batch' : 'course',
      courseId: String(group.courseId || '').trim(),
      courseName: String(group.courseName || group.courseId || 'Course').trim(),
      batchId: String(singleBatchRecord?.batchId || singleBatchRecord?.id || '').trim(),
      batchName: String(singleBatchRecord?.batchName || '').trim(),
      students: nextStudents,
    })
  }

  const totalBatchCount = Number(batchesSummary?.totalBatches || 0) || facultyCourseGroups.reduce((sum, group) => sum + group.batches.length, 0)
  const totalStudents = Number(batchesSummary?.totalStudents || 0) || facultyCourseGroups.reduce((sum, group) => sum + Number(group.totalStudents || 0), 0)

  const averageProgress = totalBatchCount
    ? Math.round(
        facultyCourseGroups.reduce((sum, group) => sum + group.batches.reduce((batchSum, batch) => batchSum + batch.progress, 0), 0) /
          totalBatchCount,
      )
    : 0
  const summaryCards = [
    {
      icon: GraduationCap,
      label: 'Courses',
      value: facultyCourseGroups.length || facultyCourseIds.length || (profileFaculty?.courseName ? 1 : 0),
      note: 'You teach',
      tone: 'blue',
      tooltip: 'Shows the courses that have one or more batches assigned to you in this workspace.',
    },
    {
      icon: Layers3,
      label: 'Total Batches',
      value: totalBatchCount,
      note: 'Across all courses',
      tone: 'green',
      tooltip: 'Shows all active batches that belong to your assigned courses.',
    },
    {
      icon: UsersRound,
      label: 'Total Students',
      value: totalStudents,
      note: 'Across all batches',
      tone: 'violet',
      tooltip: 'Shows the total unique students linked to the batches you can manage here.',
    },
    {
      icon: BookOpen,
      label: 'Avg Course Progress',
      value: `${averageProgress}%`,
      note: 'Overall average',
      tone: 'orange',
      tooltip: 'Shows the average completion progress across all of your batches.',
    },
  ]

  const selectedBatchStudents = useMemo(() => {
    if (!selectedBatchContext) return []

    return Array.isArray(selectedBatchContext.students)
      ? selectedBatchContext.students.map((student, index) => ({
          id: String(student?.id || `${selectedBatchContext.batchName || 'batch'}-${index}`).trim(),
          studentName: String(student?.studentName || '-').trim(),
          initials: getInitials(student?.studentName),
          emailAddress: String(student?.emailAddress || '-').trim(),
          mobileNumber: String(student?.mobileNumber || '-').trim(),
          course: String(student?.courseInterested || student?.courseName || selectedBatchContext.courseName || '-').trim(),
          facultyName: String(student?.facultyName || selectedBatchContext.facultyName || '-').trim(),
          batchName: String(student?.batchName || student?.batch || selectedBatchContext.batchName || '-').trim(),
          location: String(student?.location || '-').trim(),
          qualification: String(student?.qualification || '-').trim(),
          passedOutYear: String(student?.passedOutYear || '-').trim(),
          currentStatus: String(student?.currentStatus || '-').trim(),
          admissionDate: formatDisplayDate(student?.admissionDate),
          status: String(student?.status || 'Inactive').trim(),
        }))
      : []
  }, [selectedBatchContext])
  const selectedBatchStudentCount = selectedBatchStudents.length
  const selectedBatchVisibleCount = Math.min(selectedBatchStudentCount, 8)
  const selectedBatchWindow = useMemo(
    () => resolveBatchAttendanceWindow(selectedBatchContext?.batchTiming || '', currentDateTime),
    [currentDateTime, selectedBatchContext?.batchTiming],
  )
  const selectedBatchAttendanceSummary = useMemo(
    () => getBatchAttendanceProgress(selectedBatchAttendanceDraft),
    [selectedBatchAttendanceDraft],
  )
  const hasSelectedBatchAttendanceSubmitted = Boolean(selectedBatchAttendanceState)
  const isSelectedBatchAttendanceLateMode = selectedBatchAttendanceMode === 'late'
  const isSelectedBatchAttendanceEditable =
    Boolean(selectedBatchContext) &&
    !hasSelectedBatchAttendanceSubmitted &&
    (isSelectedBatchAttendanceLateMode ? selectedBatchWindow.isLateAvailable : selectedBatchWindow.isEditable)
  const selectedBatchActionButtonLabel =
    hasSelectedBatchAttendanceSubmitted || selectedBatchWindow.phase !== 'closed' ? 'Attendance' : 'Late Attendance'
  const selectedBatchStatusLabel = hasSelectedBatchAttendanceSubmitted
    ? String(selectedBatchAttendanceState?.submissionMode || '').trim().toLowerCase() === 'late'
      ? 'Late Submitted'
      : 'Attendance Submitted'
    : isSelectedBatchAttendanceLateMode
      ? 'Late Attendance'
    : selectedBatchWindow.statusLabel
  const selectedBatchWindowMessage = hasSelectedBatchAttendanceSubmitted
    ? String(selectedBatchAttendanceState?.submissionMode || '').trim().toLowerCase() === 'late'
      ? 'Late attendance already submitted for today.'
      : 'Attendance already submitted for today.'
    : isSelectedBatchAttendanceLateMode
      ? selectedBatchAttendanceMessage || selectedBatchWindow.reason
      : selectedBatchWindow.isEditable || selectedBatchWindow.isReminder
        ? selectedBatchAttendanceMessage || selectedBatchWindow.reason
        : selectedBatchWindow.reason
  const selectedBatchStatusToneClass =
    hasSelectedBatchAttendanceSubmitted || selectedBatchWindow.isEditable || selectedBatchWindow.isReminder || isSelectedBatchAttendanceLateMode
      ? 'active'
      : 'locked'
  const selectedBatchCurrentTimeLabel = formatDisplayTime(currentDateTime)
  const selectedBatchLateByLabel = selectedBatchWindow.phase === 'closed' ? formatMinutesLabel(selectedBatchWindow.lateByMinutes) : ''

  const openSelectedBatchAttendance = (mode = 'regular') => {
    if (!selectedBatchContext) return

    const normalizedMode = mode === 'late' ? 'late' : 'regular'
    setSelectedBatchAttendanceMode(normalizedMode)
    setSelectedBatchView('attendance')
    setAttendanceReminderPopup(null)
    setSelectedBatchAttendanceMessage(
      normalizedMode === 'late'
        ? `This attendance is being submitted after the batch end time and will be recorded as Late Attendance.`
        : selectedBatchWindow.reason,
    )
  }

  useEffect(() => {
    if (!selectedBatchContext || hasSelectedBatchAttendanceSubmitted || !selectedBatchWindow.isReminder || isSelectedBatchAttendanceLateMode) {
      return undefined
    }

    const reminderKey = `${selectedBatchContext.batchId || ''}:${selectedBatchWindow.dateKey || ''}:${selectedBatchContext.batchTiming || ''}`
    if (attendanceReminderShownRef.current.has(reminderKey)) {
      return undefined
    }

    attendanceReminderShownRef.current.add(reminderKey)
    setAttendanceReminderPopup({
      title: 'Attendance Reminder',
      courseName: selectedBatchContext.courseName || 'Course',
      batchName: selectedBatchContext.batchName || 'Batch',
      batchTiming: selectedBatchContext.batchTiming || '',
      endTime: selectedBatchWindow.endDateTime || null,
      remainingMinutes: selectedBatchWindow.minutesUntilEnd || 5,
    })

    return undefined
  }, [
    hasSelectedBatchAttendanceSubmitted,
    isSelectedBatchAttendanceLateMode,
    selectedBatchContext,
    selectedBatchWindow.dateKey,
    selectedBatchWindow.endDateTime,
    selectedBatchWindow.isReminder,
    selectedBatchWindow.minutesUntilEnd,
  ])

  useEffect(() => {
    if (!attendanceReminderPopup) return undefined

    if (!selectedBatchContext || hasSelectedBatchAttendanceSubmitted || isSelectedBatchAttendanceLateMode || !selectedBatchWindow.isReminder) {
      const timeoutId = window.setTimeout(() => {
        setAttendanceReminderPopup(null)
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }

    return undefined
  }, [
    attendanceReminderPopup,
    hasSelectedBatchAttendanceSubmitted,
    isSelectedBatchAttendanceLateMode,
    selectedBatchContext,
    selectedBatchWindow.isReminder,
  ])

  const openBatchStudents = (group, batch) => {
    if (!group || !batch) return

    const nextContext = {
      courseId: String(group.courseId || '').trim(),
      courseName: String(group.courseName || group.courseId || 'Course').trim(),
      facultyId: String(activeFaculty?.id || '').trim(),
      facultyName: String(activeFaculty?.facultyName || latestFaculty?.facultyName || '').trim(),
      batchId: String(batch.id || '').trim(),
      batchName: String(batch.label || '').trim(),
      batchTiming: String(batch.timing || '').trim(),
      students: Array.isArray(batch.studentRecords) ? batch.studentRecords : [],
    }

    const savedState = loadFacultyBatchAttendanceState(
      nextContext.facultyId || facultyAttendanceId,
      nextContext.facultyName || latestFaculty?.facultyName || '',
      profileInitials,
      nextContext.batchId || '',
      nextContext.batchName || '',
      nextContext.batchTiming || '',
    )

    const batchWindow = resolveBatchAttendanceWindow(nextContext.batchTiming || '', currentDateTime)
    const isSubmitted = Boolean(savedState)
    const isLateSubmitted = String(savedState?.submissionMode || '').trim().toLowerCase() === 'late'

    setSelectedBatchContext(nextContext)
    setSelectedBatchAttendanceState(savedState)
    setSelectedBatchAttendanceMode(isLateSubmitted ? 'late' : 'regular')
    setSelectedBatchView(batchWindow.isEditable ? 'attendance' : 'details')
    setSelectedBatchAttendanceDraft(buildBatchAttendanceDraft(nextContext.students || [], savedState?.records || savedState?.attendance || {}))
    setSelectedBulkAttendance('')
    setAttendanceSavePopup(null)
    setAttendanceReminderPopup(null)
    setSelectedBatchAttendanceMessage(
      isSubmitted
        ? isLateSubmitted
          ? 'Late attendance already submitted for today.'
          : 'Attendance already submitted for today.'
        : batchWindow.reason,
    )
  }

  const closeBatchStudents = () => {
    setSelectedBatchContext(null)
    setSelectedBatchView('details')
    setSelectedBatchAttendanceDraft({})
    setSelectedBatchAttendanceMessage('')
    setSelectedBatchAttendanceState(null)
    setSelectedBatchAttendanceMode('regular')
    setSelectedBulkAttendance('')
    setAttendanceSavePopup(null)
    setAttendanceReminderPopup(null)
    setAttendanceReportRequest(null)
  }

  const updateStudentAttendance = (studentId, status) => {
    if (!selectedBatchContext || !isSelectedBatchAttendanceEditable) return

    const normalizedStatus = normalizeAttendanceChoice(status)
    if (!normalizedStatus) return

    setSelectedBatchAttendanceDraft((current) => ({
      ...current,
      [studentId]: normalizedStatus,
    }))
    setSelectedBatchAttendanceMessage('')
  }

  const setBulkAttendance = (status) => {
    if (!selectedBatchContext || !isSelectedBatchAttendanceEditable) return

    const normalizedStatus = normalizeAttendanceChoice(status)
    if (!normalizedStatus) return

    const nextDraft = {}
    selectedBatchStudents.forEach((student) => {
      nextDraft[student.id] = normalizedStatus
    })

    setSelectedBatchAttendanceDraft(nextDraft)
    setSelectedBulkAttendance(normalizedStatus)
    setSelectedBatchAttendanceMessage(`${normalizedStatus} has been applied to all students.`)
  }

  const saveBatchAttendance = async () => {
    if (!selectedBatchContext || !isSelectedBatchAttendanceEditable) return

    const progress = getBatchAttendanceProgress(selectedBatchAttendanceDraft)
    if (!progress.isComplete) {
      setSelectedBatchAttendanceMessage('Please mark Present or Absent for every student before saving.')
      return
    }

    const students = selectedBatchStudents.map((student) => ({
      studentId: student.id,
      status: String(selectedBatchAttendanceDraft?.[student.id] || '').trim().toUpperCase(),
    }))
    const submissionMode = isSelectedBatchAttendanceLateMode ? 'late' : 'regular'
    const submittedAt = currentDateTime.toISOString()

    try {
      await markFacultyStudentAttendance({
        date: getAttendanceDateKey(currentDateTime),
        facultyId: selectedBatchContext.facultyId || facultyAttendanceId,
        facultyName: selectedBatchContext.facultyName || latestFaculty?.facultyName || '',
        courseId: selectedBatchContext.courseId || '',
        courseName: selectedBatchContext.courseName || '',
        batchId: selectedBatchContext.batchId || '',
        batchName: selectedBatchContext.batchName || '',
        batchTiming: selectedBatchContext.batchTiming || '',
        submissionMode: submissionMode.toUpperCase(),
        submittedAt,
        students,
      })

      const savedPayload = {
        dateKey: getAttendanceDateKey(currentDateTime),
        facultyId: selectedBatchContext.facultyId || facultyAttendanceId,
        facultyName: selectedBatchContext.facultyName || latestFaculty?.facultyName || '',
        profileInitials,
        batchId: selectedBatchContext.batchId || '',
        batchName: selectedBatchContext.batchName || '',
        batchTiming: selectedBatchContext.batchTiming || '',
        records: selectedBatchAttendanceDraft,
        updatedAt: currentDateTime.getTime(),
        submittedAt,
        submissionMode,
      }

      saveFacultyBatchAttendanceState(
        selectedBatchContext.facultyId || facultyAttendanceId,
        selectedBatchContext.facultyName || latestFaculty?.facultyName || '',
        profileInitials,
        selectedBatchContext.batchId || '',
        selectedBatchContext.batchName || '',
        selectedBatchContext.batchTiming || '',
        savedPayload,
      )

      setSelectedBatchAttendanceState(savedPayload)
      setSelectedBatchAttendanceMessage(
        submissionMode === 'late' ? 'Late attendance saved successfully for today.' : 'Attendance saved successfully for today.',
      )
      setSelectedBulkAttendance('')
      setAttendanceSavePopup({
        title: submissionMode === 'late' ? 'Late Attendance Saved' : 'Attendance Saved',
        message:
          submissionMode === 'late'
            ? 'Late attendance has been saved successfully for today.'
            : 'Attendance has been saved successfully for today.',
      })
    } catch (error) {
      setSelectedBatchAttendanceMessage(error?.body?.message || error?.message || 'Unable to save attendance right now.')
    }
  }

  const closeAttendanceSavePopup = () => {
    setAttendanceSavePopup(null)
    setSelectedBatchView('details')
  }

  if (isLoading || isBatchesSummaryLoading || isFacultyRecordsLoading || isStudentsLoading) {
    return (
      <section className="student-dashboard-page faculty-dashboard-page faculty-my-batches-page">
        <header className="student-dashboard-header faculty-dashboard-header">
          <div className="student-dashboard-header-copy">
            <p className="student-dashboard-header-title">
              {greetingLabel}
              {greetingName ? `, ${greetingName}!` : '!'}
            </p>
            <p className="student-dashboard-header-subtitle">Welcome back to your faculty dashboard.</p>
          </div>

          <div className="student-dashboard-header-actions">
            <NotificationBell />
            <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
            {profileChip}
          </div>
        </header>

        <section className="panel-card faculty-my-batches-loading-card">
          <strong>Loading batches...</strong>
          <p>Please wait while we fetch your faculty, course, and student data.</p>
        </section>
        {profileDrawer}
      </section>
    )
  }

  return (
    <section className="student-dashboard-page faculty-dashboard-page faculty-my-batches-page">
      <header className="student-dashboard-header faculty-dashboard-header">
        <button
          type="button"
          className="mobile-menu-button faculty-dashboard-mobile-menu-button"
          onClick={openMenu}
          aria-label="Open navigation menu"
        >
          <Menu />
        </button>
        <div className="student-dashboard-header-copy">
          <p className="student-dashboard-header-title">
            {greetingLabel}
            {greetingName ? `, ${greetingName}!` : '!'}
          </p>
          <p className="student-dashboard-header-subtitle">Welcome back to your faculty dashboard.</p>
        </div>

        <div className="student-dashboard-header-actions">
          <NotificationBell />
          <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
          {profileChip}
        </div>
      </header>

      {pageAttendanceReminder ? (
        <div className="faculty-my-batches-reminder-banner" role="alert" aria-live="polite">
          <div className="faculty-my-batches-reminder-banner-icon" aria-hidden="true">
            <Clock3 size={18} strokeWidth={2.4} />
          </div>
          <div className="faculty-my-batches-reminder-banner-copy">
            <div className="faculty-my-batches-reminder-banner-copy-head">
              <span className="faculty-my-batches-reminder-banner-kicker">Reminder</span>
              <strong>Attendance closing soon</strong>
            </div>
            <span className="faculty-my-batches-reminder-banner-text">
              {pageAttendanceReminder.courseName} - {pageAttendanceReminder.batchName}
              {pageAttendanceReminder.batchTiming ? ` (${pageAttendanceReminder.batchTiming})` : ''} ends in {formatMinutesLabel(pageAttendanceReminder.remainingMinutes)}.
            </span>
            <div className="faculty-my-batches-reminder-banner-chips">
              <span className="faculty-my-batches-reminder-banner-chip">Closes at {pageAttendanceReminder.endTimeLabel}</span>
              <span className="faculty-my-batches-reminder-banner-chip is-muted">
                Only {formatMinutesLabel(pageAttendanceReminder.remainingMinutes)} left
              </span>
            </div>
          </div>
          <button
            type="button"
            className="faculty-my-batches-reminder-banner-button"
            onClick={() => openBatchStudents(pageAttendanceReminder.group, pageAttendanceReminder.batch)}
          >
            Open Attendance
          </button>
        </div>
      ) : null}

      <FacultySummaryStrip cards={summaryCards} ariaLabel="My batches summary cards" className="faculty-my-batches-summary-grid" />

      <div className="faculty-my-batches-groups">
        {facultyCourseGroups.length ? (
          facultyCourseGroups.map((group) => (
            <section key={group.courseId || group.courseName || group.courseIndex} className="panel-card faculty-batch-group-card">
              <div className="faculty-batch-group-head">
                <div className="faculty-batch-group-brand">
                  <span className="faculty-batch-group-avatar" aria-hidden="true">
                    {getInitials(group.courseName || group.courseId || 'Course')}
                  </span>
                  <div>
                    <div className="faculty-batch-group-title-row">
                      <strong>{group.courseName || group.courseId || 'Course'}</strong>
                      <span className="faculty-batch-group-pill">{group.batches.length} Batches</span>
                    </div>
                    <div className="faculty-batch-group-subcopy">
                      <span>Total Students: {group.totalStudents}</span>
                      <span>Course Progress: {group.groupProgress}%</span>
                    </div>
                  </div>
                </div>

                <div className="faculty-batch-group-actions">
                  <button
                    type="button"
                    className="faculty-course-report-button"
                    aria-label={`${group.courseName || 'Course'} attendance report`}
                    onClick={() => openCourseAttendanceReport(group)}
                  >
                    <FileDown size={14} strokeWidth={2.1} aria-hidden="true" focusable="false" />
                    <span>Generate Attendance Report</span>
                  </button>
                </div>
              </div>

              <div className="faculty-batch-table" role="table" aria-label={`${group.courseName || 'Course'} batch details`}>
                <div className="faculty-batch-table-head" role="row">
                  <span>Batch Details</span>
                  <span>Students</span>
                  <span>Schedule</span>
                  <span>Progress</span>
                  <span>Today&apos;s Attendance</span>
                  <span>Actions</span>
                </div>

                {group.batches.map((batch) => (
                  <div key={batch.id} className="faculty-batch-table-row" role="row">
                    <div className="faculty-batch-table-cell faculty-batch-table-batch" role="cell">
                      <div>
                        <strong>{batch.label}</strong>
                        <span>{batch.progress >= 90 ? 'Completed' : 'Active'}</span>
                      </div>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-students" role="cell">
                      <UsersRound size={14} strokeWidth={2.1} aria-hidden="true" focusable="false" />
                      <strong>{batch.studentCount}</strong>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-schedule" role="cell">
                      <CalendarDays size={14} strokeWidth={2.1} aria-hidden="true" focusable="false" />
                      <div>
                        <strong>{batch.timing || '-'}</strong>
                        <span>Batch {batch.sequenceNo}</span>
                      </div>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-progress" role="cell">
                      <strong>{batch.progress}%</strong>
                      <div className="faculty-batch-table-track" aria-hidden="true">
                        <div className="faculty-batch-table-fill" style={{ width: `${batch.progress}%` }} />
                      </div>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-attendance" role="cell">
                      <span className="faculty-batch-table-present">
                        <UsersRound size={12} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                        {batch.present} Present
                      </span>
                      <span className="faculty-batch-table-absent">
                        <UsersRound size={12} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                        {batch.absent} Absent
                      </span>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-actions" role="cell">
                      <button type="button" aria-label={`${batch.label} student details`} onClick={() => openBatchStudents(group, batch)}>
                        <UsersRound size={14} strokeWidth={2.1} aria-hidden="true" focusable="false" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="panel-card faculty-my-batches-loading-card">
            <strong>No batches assigned yet</strong>
            <p>Add batches in Faculty Management to show them here.</p>
          </section>
        )}
      </div>

      {profileDrawer}

      {selectedBatchContext ? (
        <div className="course-modal-backdrop student-modal-backdrop batch-student-modal-backdrop" role="presentation">
          <div
            className="course-modal panel-card student-modal batch-student-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="course-modal-close batch-student-modal-close"
              onClick={closeBatchStudents}
              aria-label="Close batch students"
            >
              <X size={16} />
            </button>

            <div className="batch-student-modal-header">
              <div className="batch-student-modal-header-main">
                <div className="batch-student-avatar" aria-hidden="true">
                  {getInitials(selectedBatchContext.courseName || 'Course')}
                </div>
                <div className="batch-student-modal-header-copy">
                  <p className="section-kicker">Batch Students</p>
                  <h3>{selectedBatchContext.courseName}</h3>
                  <p>
                    Faculty: {selectedBatchContext.facultyName || '-'} | Batch: {selectedBatchContext.batchName || '-'}
                    {selectedBatchContext.batchTiming ? ` (${selectedBatchContext.batchTiming})` : ''}
                  </p>
                </div>
              </div>

              <div className="batch-student-modal-header-actions">
                <button
                  type="button"
                  className="batch-student-report-button"
                  onClick={() =>
                    setAttendanceReportRequest({
                      mode: 'batch',
                      courseId: String(selectedBatchContext.courseId || '').trim(),
                      courseName: String(selectedBatchContext.courseName || 'Course').trim(),
                      batchId: String(selectedBatchContext.batchId || '').trim(),
                      batchName: String(selectedBatchContext.batchName || '').trim(),
                      students: Array.isArray(selectedBatchContext.students) ? selectedBatchContext.students : [],
                    })
                  }
                >
                  <FileDown size={16} />
                  <span>Generate Attendance Report</span>
                </button>
                <div className={`batch-student-status ${selectedBatchStatusToneClass}`.trim()}>
                  <Clock3 size={16} />
                  <span>{selectedBatchStatusLabel}</span>
                </div>
                <button
                  type="button"
                  className={`batch-student-view-button ${selectedBatchActionButtonLabel === 'Late Attendance' ? 'secondary' : ''} ${selectedBatchView === 'attendance' ? 'is-active' : ''}`.trim()}
                  onClick={() => openSelectedBatchAttendance(selectedBatchActionButtonLabel === 'Late Attendance' ? 'late' : 'regular')}
                  disabled={!selectedBatchStudents.length || (!hasSelectedBatchAttendanceSubmitted && selectedBatchWindow.phase === 'pre-open')}
                >
                  <Check size={16} />
                  <span>{selectedBatchActionButtonLabel}</span>
                </button>
              </div>
            </div>

            {selectedBatchView === 'attendance' && isSelectedBatchAttendanceLateMode ? (
              <div className="batch-late-attendance-card" role="presentation">
                <div className="batch-late-attendance-head">
                  <strong>{selectedBatchContext.courseName}</strong>
                  <span className="batch-late-attendance-badge">Late Attendance</span>
                </div>

                <div className="batch-student-modal-header-meta batch-late-attendance-meta">
                  <span>
                    <strong>Scheduled time</strong>
                    <small>{selectedBatchContext.batchTiming || '-'}</small>
                  </span>
                  <span>
                    <strong>Current time</strong>
                    <small>{selectedBatchCurrentTimeLabel}</small>
                  </span>
                  <span>
                    <strong>Late by</strong>
                    <small>{selectedBatchLateByLabel || '-'}</small>
                  </span>
                </div>

                <div className="batch-late-attendance-warning" role="note" aria-label="Late submission warning">
                  <div className="batch-late-attendance-warning-title">
                    <span className="batch-late-attendance-warning-icon" aria-hidden="true">
                      <Clock3 size={16} strokeWidth={2.4} />
                    </span>
                    <strong>Late submission warning</strong>
                  </div>
                  <p>This attendance is being submitted after the batch end time and will be recorded as <b>Late Attendance</b>.</p>
                </div>

                <div className="batch-late-attendance-footer">
                  <button
                    type="button"
                    className="batch-late-attendance-submit"
                    onClick={saveBatchAttendance}
                    disabled={!isSelectedBatchAttendanceEditable || !selectedBatchAttendanceSummary.isComplete}
                  >
                    <Check size={16} />
                    <span>Submit Late Attendance</span>
                  </button>
                </div>
              </div>
            ) : null}

            {selectedBatchWindowMessage ? (
              <p
                className={`batch-student-window-note ${
                  hasSelectedBatchAttendanceSubmitted || isSelectedBatchAttendanceEditable ? 'is-open' : selectedBatchWindow.phase === 'closed' ? 'is-late' : 'is-locked'
                }`.trim()}
              >
                {selectedBatchWindowMessage}
              </p>
            ) : null}

            {selectedBatchStudents.length ? (
              <div className="batch-student-table-shell">
                {selectedBatchView === 'attendance' ? (
                  <div className="batch-student-attendance-actions" aria-label="Attendance shortcuts">
                    <button
                      type="button"
                      className={`batch-student-attendance-action ${selectedBulkAttendance === 'Present' ? 'is-selected' : ''}`.trim()}
                      onClick={() => setBulkAttendance('Present')}
                      disabled={!isSelectedBatchAttendanceEditable}
                      aria-pressed={selectedBulkAttendance === 'Present'}
                    >
                      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: selectedBulkAttendance === 'Present' ? '&#9745;' : '&#9744;' }} />
                      <span>Mark All as Present</span>
                    </button>
                    <button
                      type="button"
                      className={`batch-student-attendance-action ${selectedBulkAttendance === 'Absent' ? 'is-selected' : ''}`.trim()}
                      onClick={() => setBulkAttendance('Absent')}
                      disabled={!isSelectedBatchAttendanceEditable}
                      aria-pressed={selectedBulkAttendance === 'Absent'}
                    >
                      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: selectedBulkAttendance === 'Absent' ? '&#9745;' : '&#9744;' }} />
                      <span>Mark All as Absent</span>
                    </button>
                  </div>
                ) : null}

                <div className="faculty-flow-table-wrap batch-student-table-wrap">
                  <table className="faculty-flow-table batch-student-table">
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Email Address</th>
                        <th>Mobile Number</th>
                        <th>Location</th>
                        <th>Qualification</th>
                        <th>Passed Out Year</th>
                        <th>Current Status</th>
                        <th>Admission Date</th>
                        <th>Status</th>
                        {selectedBatchView === 'attendance' ? <th className="batch-student-attendance-header">Attendance</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBatchStudents.map((student, index) => {
                        const studentStatus = String(student.status || 'Inactive').trim()
                        const studentStatusClass = studentStatus.toLowerCase().replace(/\s+/g, '-')
                        const attendanceValue = normalizeAttendanceChoice(selectedBatchAttendanceDraft?.[student.id] || '')

                        return (
                          <tr key={student.id || `${student.studentName}-${index}`}>
                            <td className="batch-student-table-name-cell">
                              <div className="batch-student-table-name">
                                <div className="batch-student-table-name-copy">
                                  <strong>{student.studentName}</strong>
                                </div>
                              </div>
                            </td>
                            <td className="batch-student-table-email-cell">{student.emailAddress}</td>
                            <td>{student.mobileNumber}</td>
                            <td>{student.location}</td>
                            <td>{student.qualification}</td>
                            <td>{student.passedOutYear}</td>
                            <td>{student.currentStatus}</td>
                            <td>{student.admissionDate}</td>
                            <td>
                              <span className={`status-pill ${studentStatusClass}`.trim()}>{studentStatus}</span>
                            </td>
                            {selectedBatchView === 'attendance' ? (
                              <td className="batch-student-attendance-cell">
                                <label className={`batch-student-attendance-option ${attendanceValue === 'Present' ? 'is-selected' : ''}`.trim()}>
                                  <input
                                    type="radio"
                                    name={`attendance-${student.id}`}
                                    checked={attendanceValue === 'Present'}
                                    disabled={!isSelectedBatchAttendanceEditable}
                                    onChange={() => updateStudentAttendance(student.id, 'Present')}
                                    aria-label={`Mark ${student.studentName} present`}
                                  />
                                  <span>Present</span>
                                </label>
                                <label className={`batch-student-attendance-option ${attendanceValue === 'Absent' ? 'is-selected' : ''}`.trim()}>
                                  <input
                                    type="radio"
                                    name={`attendance-${student.id}`}
                                    checked={attendanceValue === 'Absent'}
                                    disabled={!isSelectedBatchAttendanceEditable}
                                    onChange={() => updateStudentAttendance(student.id, 'Absent')}
                                    aria-label={`Mark ${student.studentName} absent`}
                                  />
                                  <span>Absent</span>
                                </label>
                              </td>
                            ) : null}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="batch-student-table-footer" aria-label="Batch student pagination">
                  <div className="batch-student-table-summary">
                    <strong>
                      {selectedBatchAttendanceSummary.markedCount} / {selectedBatchStudentCount} marked
                    </strong>
                    <span>
                      {selectedBatchAttendanceSummary.presentCount} present, {selectedBatchAttendanceSummary.absentCount} absent
                      {selectedBatchView === 'attendance' ? ` | Showing ${selectedBatchVisibleCount} of ${selectedBatchStudentCount}` : ''}
                    </span>
                  </div>

                  <div className="batch-student-table-footer-actions">
                    <div className="batch-student-pagination" aria-hidden="true">
                      <button type="button" className="batch-student-pagination-link" disabled>
                        <ChevronLeft size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
                        <span>Back</span>
                      </button>
                      <div className="batch-student-pagination-pages">
                        <button type="button" className="batch-student-pagination-page active" aria-current="page" disabled>
                          1
                        </button>
                        <button type="button" className="batch-student-pagination-page" disabled>
                          2
                        </button>
                        <button type="button" className="batch-student-pagination-page" disabled>
                          3
                        </button>
                        <button type="button" className="batch-student-pagination-page" disabled>
                          4
                        </button>
                      </div>
                      <button type="button" className="batch-student-pagination-link" disabled>
                        <span>Next</span>
                        <ChevronRight size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
                      </button>
                      <span className="batch-student-pagination-count">1 of 4</span>
                    </div>

                    {selectedBatchView === 'attendance' && !isSelectedBatchAttendanceLateMode ? (
                      <button
                        type="button"
                        className="batch-student-save-button"
                        onClick={saveBatchAttendance}
                        disabled={!isSelectedBatchAttendanceEditable || !selectedBatchAttendanceSummary.isComplete}
                      >
                        <Save size={14} />
                        <span>Save</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="faculty-flow-empty">
                <strong>No students found for this batch</strong>
                <p>Try another batch or check whether the student data is mapped correctly.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {attendanceSavePopup ? (
        <div className="batch-attendance-popup-backdrop" role="presentation">
          <div
            className="batch-attendance-popup panel-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="batch-attendance-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="batch-attendance-popup-icon" aria-hidden="true">
              <Check size={20} strokeWidth={2.6} />
            </div>
            <div className="batch-attendance-popup-copy">
              <h3 id="batch-attendance-popup-title">{attendanceSavePopup.title}</h3>
              <p>{attendanceSavePopup.message}</p>
            </div>
            <button type="button" className="batch-attendance-popup-button" onClick={closeAttendanceSavePopup}>
              OK
            </button>
          </div>
        </div>
      ) : null}

      {attendanceReminderPopup ? (
        <div className="batch-attendance-popup-backdrop" role="presentation">
          <div
            className="batch-attendance-popup panel-card batch-attendance-reminder-popup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="batch-attendance-reminder-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="batch-reminder-head">
              <span className="batch-reminder-pill">Reminder</span>
              <h3 id="batch-attendance-reminder-title">{attendanceReminderPopup.title}</h3>
            </div>
            <div className="batch-reminder-divider" aria-hidden="true" />
            <div className="batch-reminder-body">
              <strong>{attendanceReminderPopup.courseName}</strong>
              <p>You haven&apos;t marked attendance for this batch.</p>
              <div className="batch-reminder-note">
                <div className="batch-reminder-note-title">
                  <span className="batch-reminder-note-icon" aria-hidden="true">
                    <Clock3 size={16} strokeWidth={2.4} />
                  </span>
                  <strong>This batch ends in {formatMinutesLabel(attendanceReminderPopup.remainingMinutes)}.</strong>
                </div>
                <p>Please submit attendance before {formatDisplayTime(attendanceReminderPopup.endTime || selectedBatchWindow.endDateTime || currentDateTime)}.</p>
              </div>
            </div>
            <button
              type="button"
              className="batch-attendance-popup-button batch-attendance-reminder-button"
              onClick={() => {
                setAttendanceReminderPopup(null)
                openSelectedBatchAttendance('regular')
              }}
            >
              Mark Attendance
            </button>
          </div>
        </div>
      ) : null}

      {attendanceReportRequest ? (
        <StudentAttendanceReportModal
          key={`${attendanceReportRequest.mode || 'all'}-${attendanceReportRequest.courseId || ''}-${attendanceReportRequest.batchId || ''}-${attendanceReportRequest.courseName || ''}-${attendanceReportRequest.batchName || ''}`}
          isOpen={Boolean(attendanceReportRequest)}
          mode={attendanceReportRequest.mode}
          facultyId={facultyAttendanceId}
          courseId={attendanceReportRequest.courseId}
          courseName={attendanceReportRequest.courseName}
          batchId={attendanceReportRequest.batchId}
          batchName={attendanceReportRequest.batchName}
          students={attendanceReportRequest.students}
          onClose={() => setAttendanceReportRequest(null)}
        />
      ) : null}

    </section>
  )
}


