import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Mail,
  Phone,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserX,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { FACULTY_RECORD_SYNC_EVENT, loadFacultyRecords } from '../data/facultyRecords'
import { loadStudentSnapshot } from '../lib/studentSnapshot'
import { NotificationBell } from '../components/NotificationBell'
import { getCurrentStudentAttendanceOverview } from '../services/attendanceService'
import {
  FACULTY_ATTENDANCE_SYNC_EVENT,
  FACULTY_BATCH_ATTENDANCE_SYNC_EVENT,
  getAttendanceDateKey,
  listFacultyBatchAttendanceHistoryStates,
  resolveBatchAttendanceWindow,
  resolveStudentBatchAttendanceStatus,
  resolveTodayFacultyAttendanceStatus,
} from '../lib/facultyAttendanceStore'
import { getFacultyBatchStudentRecords } from '../lib/facultyFlow'
import {
  formatCurrency,
  formatDate,
  getPaidAmount,
  getSecondDueDate,
  getStudentInitials,
  useCurrentStudentProfile,
} from './studentDashboardUtils.jsx'

function useFacultyRecordsSnapshot() {
  const [facultyRecords, setFacultyRecords] = useState(() => loadFacultyRecords())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncFacultyRecords = () => {
      setFacultyRecords(loadFacultyRecords())
    }

    syncFacultyRecords()
    window.addEventListener(FACULTY_RECORD_SYNC_EVENT, syncFacultyRecords)
    window.addEventListener('storage', syncFacultyRecords)

    return () => {
      window.removeEventListener(FACULTY_RECORD_SYNC_EVENT, syncFacultyRecords)
      window.removeEventListener('storage', syncFacultyRecords)
    }
  }, [])

  return facultyRecords
}

function useFacultyAttendanceRefreshToken() {
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncFacultyAttendance = () => {
      setRefreshToken((current) => current + 1)
    }

    window.addEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, syncFacultyAttendance)
    window.addEventListener(FACULTY_BATCH_ATTENDANCE_SYNC_EVENT, syncFacultyAttendance)
    window.addEventListener('storage', syncFacultyAttendance)

    return () => {
      window.removeEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, syncFacultyAttendance)
      window.removeEventListener(FACULTY_BATCH_ATTENDANCE_SYNC_EVENT, syncFacultyAttendance)
      window.removeEventListener('storage', syncFacultyAttendance)
    }
  }, [])

  return refreshToken
}

function parseDateValue(value) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getCourseDurationMonths(student) {
  const possibleValues = [
    student?.course?.duration,
    student?.courseDuration,
    student?.duration,
    student?.course?.courseDuration,
    student?.course?.months,
  ]

  for (const value of possibleValues) {
    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0) {
      return Math.max(1, Math.min(12, Math.round(amount)))
    }
  }

  return 6
}

function addMonths(date, months) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function formatMonthYear(date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatVerboseDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(date)
}

function startOfMonth(date) {
  const next = new Date(date)
  next.setDate(1)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfMonth(date) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1, 0)
  next.setHours(23, 59, 59, 999)
  return next
}

function getDaysInMonth(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  return new Date(year, month + 1, 0).getDate()
}

function getAttendanceRecordKeys(student) {
  const keys = new Set()
  const values = [
    student?.id,
    student?.studentName,
    student?.emailAddress,
    student?.mobileNumber,
  ]

  values.forEach((value) => {
    const normalizedValue = String(value || '').trim().toLowerCase()
    if (normalizedValue) {
      keys.add(normalizedValue)
    }
  })

  return Array.from(keys)
}

function getMonthlyAttendanceStatus(state = {}, student = {}) {
  const records = state?.records && typeof state.records === 'object' ? state.records : {}
  const recordKeys = getAttendanceRecordKeys(student)

  for (const key of recordKeys) {
    const status = normalizeAttendanceDisplayStatus(records[key] || records[String(key).trim()] || '')
    if (status === 'Present' || status === 'Absent') {
      return status
    }
  }

  return ''
}

function getMonthlyAttendanceStatusWithFallback(state = {}, student = {}, studentIndex = -1) {
  const directStatus = getMonthlyAttendanceStatus(state, student)
  if (directStatus) {
    return directStatus
  }

  const records = state?.records && typeof state.records === 'object' && !Array.isArray(state.records) ? state.records : null
  if (!records) return ''

  const orderedStatuses = Object.values(records)
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => value === 'present' || value === 'absent')

  if (studentIndex >= 0 && studentIndex < orderedStatuses.length) {
    const indexedStatus = orderedStatuses[studentIndex]
    if (indexedStatus === 'present') return 'Present'
    if (indexedStatus === 'absent') return 'Absent'
  }

  return ''
}

function getMonthlyAttendanceMatchScore(state = {}, student = {}) {
  const facultyName = String(state?.facultyName || '').trim().toLowerCase()
  const studentFacultyName = String(student?.facultyName || '').trim().toLowerCase()
  const facultyId = String(state?.facultyId || '').trim().toLowerCase()
  const studentFacultyId = String(student?.facultyId || '').trim().toLowerCase()
  const batchName = String(state?.batchName || '').trim().toLowerCase()
  const batchTiming = String(state?.batchTiming || '').trim().toLowerCase()
  const batchId = String(state?.batchId || '').trim().toLowerCase()
  const studentBatchName = String(student?.batchName || student?.batch || '').trim().toLowerCase()
  const studentBatchTiming = String(student?.batchTiming || student?.batchTime || '').trim().toLowerCase()
  const studentBatchId = String(student?.batchId || '').trim().toLowerCase()
  const studentCourseId = String(student?.courseId || '').trim().toLowerCase()
  const studentCourseName = String(student?.courseInterested || student?.courseName || student?.course?.name || '').trim().toLowerCase()
  const stateCourseId = String(state?.courseId || '').trim().toLowerCase()
  const stateCourseName = String(state?.courseName || '').trim().toLowerCase()

  let score = 0

  if (facultyId && studentFacultyId && facultyId === studentFacultyId) score += 100
  if (facultyName && studentFacultyName && facultyName === studentFacultyName) score += 90
  if (batchId && studentBatchId && batchId === studentBatchId) score += 80
  if (batchName && studentBatchName && batchName === studentBatchName) score += 70
  if (batchTiming && studentBatchTiming && batchTiming === studentBatchTiming) score += 60
  if (stateCourseId && studentCourseId && stateCourseId === studentCourseId) score += 40
  if (stateCourseName && studentCourseName && stateCourseName === studentCourseName) score += 30

  return score
}

function getMonthlyAttendanceEntriesFromState(state = {}, student = {}, studentIndex = -1) {
  const status = getMonthlyAttendanceStatusWithFallback(state, student, studentIndex)
  const dateKey = String(state?.dateKey || '').trim()

  if (!dateKey || (status !== 'Present' && status !== 'Absent')) {
    return null
  }

  return {
    dateKey,
    status,
    updatedAt: Number(state?.updatedAt || 0) || 0,
    score: getMonthlyAttendanceMatchScore(state, student),
  }
}

function getFacultyBatchStudentIndex(student = {}) {
  const roster = getFacultyBatchStudentRecords(loadStudentSnapshot(), {
    facultyId: student?.facultyId,
    facultyName: student?.facultyName,
    courseId: student?.courseId,
    courseName: student?.courseInterested || student?.courseName || student?.course?.name,
    batchId: student?.batchId || student?.batchEntryId,
    batchName: student?.batchName || student?.batch,
    batchTiming: student?.batchTiming || student?.batchTime,
  })

  const targetId = String(student?.id || '').trim().toLowerCase()
  const targetEmail = String(student?.emailAddress || '').trim().toLowerCase()
  const targetMobile = String(student?.mobileNumber || '').trim().toLowerCase()
  const targetName = String(student?.studentName || '').trim().toLowerCase()

  return roster.findIndex((candidate) => {
    const candidateId = String(candidate?.id || '').trim().toLowerCase()
    const candidateEmail = String(candidate?.emailAddress || '').trim().toLowerCase()
    const candidateMobile = String(candidate?.mobileNumber || '').trim().toLowerCase()
    const candidateName = String(candidate?.studentName || '').trim().toLowerCase()

    return (
      (targetId && candidateId && targetId === candidateId) ||
      (targetEmail && candidateEmail && targetEmail === candidateEmail) ||
      (targetMobile && candidateMobile && targetMobile === candidateMobile) ||
      (targetName && candidateName && targetName === candidateName)
    )
  })
}

function buildMonthlyAttendanceSummary(student, attendanceEntries = [], currentAttendance = null, today = new Date()) {
  const durationMonths = getCourseDurationMonths(student)
  const admissionDate = parseDateValue(student?.admissionDate || student?.firstInstallmentDate || student?.createdAt) || today
  const courseStartDate = startOfMonth(admissionDate)
  const courseEndDate = endOfMonth(addMonths(courseStartDate, Math.max(durationMonths - 1, 0)))
  const todayDateKey = getAttendanceDateKey(today)
  const monthMap = new Map()

  const normalizedEntries = Array.isArray(attendanceEntries)
    ? attendanceEntries
        .map((entry) => {
          const dateKey = String(entry?.dateKey || '').trim()
          const status = normalizeAttendanceDisplayStatus(entry?.status)
          if (!dateKey || (status !== 'Present' && status !== 'Absent')) {
            return null
          }

          return {
            dateKey,
            status,
            updatedAt: Number(entry?.updatedAt || 0) || 0,
            score: Number(entry?.score || 0) || 0,
          }
        })
        .filter(Boolean)
    : []

  const sortedHistory = normalizedEntries
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return String(left.dateKey).localeCompare(String(right.dateKey))
    })

  sortedHistory.forEach((entry) => {
    if (monthMap.has(entry.dateKey)) {
      const existing = monthMap.get(entry.dateKey)
      const existingScore = Number(existing?.score || 0)
      const existingUpdatedAt = Number(existing?.updatedAt || 0)
      const nextUpdatedAt = Number(entry.updatedAt || 0)
      if (entry.score > existingScore || nextUpdatedAt >= existingUpdatedAt) {
        monthMap.set(entry.dateKey, {
          status: entry.status,
          score: entry.score,
          updatedAt: nextUpdatedAt,
        })
      }
      return
    }

    monthMap.set(entry.dateKey, {
      status: entry.status,
      score: entry.score,
      updatedAt: Number(entry.updatedAt || 0) || 0,
    })
  })

  const currentStatus = normalizeAttendanceDisplayStatus(currentAttendance?.status)
  const currentAttendanceDateKey = String(currentAttendance?.dateKey || '').trim()
  if (currentAttendanceDateKey && (currentStatus === 'Present' || currentStatus === 'Absent') && !monthMap.has(currentAttendanceDateKey)) {
    monthMap.set(currentAttendanceDateKey, {
      status: currentStatus,
      score: 999,
      updatedAt: Number(currentAttendance?.updatedAt || 0) || 0,
    })
  }

  const series = Array.from({ length: durationMonths }, (_, index) => {
    const monthDate = addMonths(courseStartDate, index)
    const monthStart = startOfMonth(monthDate)
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    const totalDaysInMonth = getDaysInMonth(monthDate)
    const inRangeEntries = Array.from(monthMap.entries()).filter(([dateKey]) => dateKey >= monthKey && dateKey <= `${monthKey}-31`)
    const presentCount = inRangeEntries.filter(([, entry]) => entry?.status === 'Present').length
    const absentCount = inRangeEntries.filter(([, entry]) => entry?.status === 'Absent').length
    const markedCount = presentCount + absentCount
    const value = markedCount > 0 ? Math.round((presentCount / totalDaysInMonth) * 100) : 0
    const displayValue = markedCount > 0 ? `${value}%` : ''
    const isFutureMonth = monthStart.getTime() > today.getTime()

    return {
      month: formatMonthYear(monthDate),
      value,
      displayValue,
      markedCount,
      presentCount,
      absentCount,
      isFutureMonth,
      hasData: markedCount > 0,
      dateKey: monthKey,
      isCurrentMonth: monthKey === todayDateKey.slice(0, 7),
    }
  })

  const rangeStart = formatMonthYear(courseStartDate)
  const rangeEnd = formatMonthYear(courseEndDate)

  return {
    durationMonths,
    rangeLabel: rangeStart === rangeEnd ? rangeStart : `${rangeStart} - ${rangeEnd}`,
    series,
  }
}

function mergeAttendanceEntries(...entryGroups) {
  const mergedEntries = new Map()

  entryGroups.flat().forEach((entry) => {
    if (!entry?.dateKey) return

    const existing = mergedEntries.get(entry.dateKey)
    if (
      !existing ||
      Number(entry.score || 0) > Number(existing.score || 0) ||
      Number(entry.updatedAt || 0) >= Number(existing.updatedAt || 0)
    ) {
      mergedEntries.set(entry.dateKey, entry)
    }
  })

  return Array.from(mergedEntries.values())
}

function getStudentGreetingName(studentName) {
  const value = String(studentName || '').trim()
  if (!value) return ''
  return value.split(/\s+/)[0] || ''
}

function getStudentGreetingLabel() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function getAttendanceStatusTone(status) {
  if (status === 'Present') return 'is-present'
  if (status === 'Unmarked') return 'is-unmarked'
  return 'is-absent'
}

function normalizeAttendanceDisplayStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  if (status === 'present') return 'Present'
  if (status === 'absent') return 'Absent'
  return 'Unmarked'
}

function getTodayAttendanceIcon(status) {
  if (status === 'Present') {
    return <UserCheck size={24} strokeWidth={2.4} aria-hidden="true" focusable="false" />
  }

  if (status === 'Unmarked') {
    return <UserMinus size={24} strokeWidth={2.4} aria-hidden="true" focusable="false" />
  }

  return <UserX size={24} strokeWidth={2.4} aria-hidden="true" focusable="false" />
}

function normalizeAttendanceStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  if (status === 'present') return 'Present'
  if (status === 'absent') return 'Absent'
  return ''
}

function preferAttendanceState(...states) {
  const validStates = states.filter(Boolean)
  if (!validStates.length) return null

  const presentState = validStates.find((state) => normalizeAttendanceStatus(state?.status) === 'Present')
  if (presentState) {
    return {
      ...presentState,
      status: 'Present',
    }
  }

  return validStates[0]
}

function FacultyStatusIcon({ status }) {
  if (status === 'Present') {
    return (
      <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false" className="student-faculty-status-icon-svg">
        <circle cx="36" cy="36" r="34" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.22" />
        <circle cx="36" cy="25" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M18 56c2.4-10.2 10-16 18-16s15.6 5.8 18 16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle cx="52" cy="36" r="11" fill="currentColor" opacity="0.18" />
        <path d="m47.5 36.2 3.2 3.2 6-6.2" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (status === 'Absent') {
    return (
      <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false" className="student-faculty-status-icon-svg">
        <circle cx="36" cy="36" r="34" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.22" />
        <circle cx="36" cy="25" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M18 56c2.4-10.2 10-16 18-16s15.6 5.8 18 16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle cx="52" cy="36" r="11" fill="currentColor" opacity="0.18" />
        <path d="m47.6 31.8 8.8 8.8m0-8.8-8.8 8.8" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false" className="student-faculty-status-icon-svg">
      <circle cx="36" cy="36" r="34" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.22" />
      <circle cx="36" cy="25" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M18 56c2.4-10.2 10-16 18-16s15.6 5.8 18 16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="52" cy="36" r="11" fill="currentColor" opacity="0.18" />
      <path d="M47.2 36h9" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  )
}

function StudentDashboardHeader({ studentName, facultyName, facultyAttendanceStatus, onProfileClick }) {
  const greetingName = getStudentGreetingName(studentName)
  const greetingLabel = getStudentGreetingLabel()
  const profileName = studentName || 'Student'
  const profileInitials = getStudentInitials(profileName)
  const statusLabel = facultyAttendanceStatus?.status || 'Absent'
  const mentorName = String(facultyName || facultyAttendanceStatus?.facultyName || 'Not assigned').trim() || 'Not assigned'
  const badgeLabel = statusLabel === 'Present' ? 'Present' : statusLabel === 'Unmarked' ? 'Unmarked' : 'Absent'

  return (
    <header className="student-dashboard-header">
      <div className="student-dashboard-header-copy">
        <p className="student-dashboard-header-title">
          {greetingLabel}
          {greetingName ? `, ${greetingName}! ` : '!'}
        </p>
        <p className="student-dashboard-header-subtitle">Welcome back to your student dashboard.</p>
      </div>

      <div className="student-dashboard-header-actions">
        <NotificationBell />
        <div className={`student-faculty-status-card ${getAttendanceStatusTone(statusLabel)}`.trim()} aria-label={`Faculty ${badgeLabel}`}>
          <div className="student-faculty-status-icon" aria-hidden="true">
            <FacultyStatusIcon status={statusLabel} />
          </div>
          <div className="student-faculty-status-copy">
            <strong>{mentorName}</strong>
            <span>Faculty Mentor</span>
            <span className={`student-faculty-status-pill ${getAttendanceStatusTone(statusLabel)}`.trim()}>{badgeLabel}</span>
          </div>
        </div>
        {onProfileClick ? (
          <button
            type="button"
            className="student-dashboard-profile-chip student-dashboard-profile-chip-button"
            onClick={onProfileClick}
            aria-label={`Open ${profileName} profile card`}
            aria-haspopup="dialog"
          >
            <span className="student-dashboard-profile-initials" aria-hidden="true">
              {profileInitials}
            </span>
            <span className="student-dashboard-profile-name">{profileName}</span>
          </button>
        ) : (
          <div className="student-dashboard-profile-chip" aria-label={profileName}>
            <span className="student-dashboard-profile-initials" aria-hidden="true">
              {profileInitials}
            </span>
            <span className="student-dashboard-profile-name">{profileName}</span>
          </div>
        )}
      </div>
    </header>
  )
}

function StudentProfileStat({ icon: Icon, label, value, tone = 'blue' }) {
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

function StudentProfileRow({ icon: Icon, label, value }) {
  return (
    <div className="profile-modal-info-row student-profile-info-row">
      <span className="profile-modal-info-label">
        <Icon size={15} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        {label}
      </span>
      <strong>{value || '-'}</strong>
    </div>
  )
}

function StudentProfileDrawer({ student, isOpen, onClose }) {
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

  if (!isOpen || typeof document === 'undefined' || !student) return null

  const profileName = student.studentName || 'Student'
  const statusLabel = String(student.status || 'Active').trim() || 'Active'
  const statusTone = statusLabel.toLowerCase() === 'active' ? 'is-active' : 'is-inactive'
  const email = String(student.emailAddress || '').trim()
  const mobileNumber = String(student.mobileNumber || '').trim()
  const parentSpouseNumber = String(student.parentSpouseNumber || '').trim()
  const courseName = String(student.courseInterested || student.course?.name || '').trim()
  const batchName = String(student.batchName || student.batch || student.batchId || '').trim()
  const facultyName = String(student.facultyName || '').trim()
  const admissionDate = formatDate(student.admissionDate)
  const feeStatus = String(student.paymentMode || 'Installment').trim()
  const feeProgress =
    Number(student.afterDiscount || student.totalAmount || 0) > 0
      ? Math.min(100, Math.round((getPaidAmount(student) / Number(student.afterDiscount || student.totalAmount || 0)) * 100))
      : 0

  return createPortal(
    <div className="profile-drawer-backdrop student-profile-backdrop" role="presentation">
      <div
        className="profile-drawer student-profile-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-profile-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="profile-modal-cover student-profile-hero">
          <button type="button" className="course-modal-close profile-modal-close" onClick={onClose} aria-label="Close profile card">
            <X size={18} strokeWidth={2.5} aria-hidden="true" focusable="false" />
          </button>

          <div className="student-profile-title-block">
            <h3 id="student-profile-modal-title">{profileName}</h3>
            <div className="student-profile-role-row">
              <span className="student-profile-role">Student</span>
              <span className={`student-profile-state ${statusTone}`.trim()}>{statusLabel}</span>
            </div>
            <p className="profile-modal-email student-profile-email">
              <Mail size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              {email || 'No email address added'}
            </p>
          </div>
        </div>

        <div className="profile-modal-body student-profile-body">
          <div className="profile-modal-grid student-profile-stat-grid">
            <StudentProfileStat icon={BookOpen} label="Course" value={courseName || 'Not assigned'} tone="violet" />
            <StudentProfileStat icon={GraduationCap} label="Batch" value={batchName || 'Not assigned'} tone="blue" />
            <StudentProfileStat icon={Wallet} label="Fee Progress" value={`${feeProgress}%`} tone="green" />
            <StudentProfileStat icon={CalendarDays} label="Admission" value={admissionDate} tone="amber" />
          </div>

          <div className="profile-modal-info-list student-profile-info-list">
            <StudentProfileRow icon={Phone} label="Mobile Number" value={mobileNumber || 'Not added'} />
            <StudentProfileRow icon={Phone} label="Parent / Spouse" value={parentSpouseNumber || 'Not added'} />
            <StudentProfileRow icon={Wallet} label="Payment Mode" value={feeStatus || 'Not added'} />
          </div>

          <div className="student-profile-divider" />

          <div className="student-profile-section">
            <div className="student-profile-section-row">
              <span className="student-profile-pill tone-violet" aria-hidden="true">
                FG
              </span>
              <div className="student-profile-section-copy">
                <strong>Faculty Mentor</strong>
                <span>{facultyName || 'Not assigned'}</span>
              </div>
              <ChevronRight size={20} strokeWidth={2.2} aria-hidden="true" focusable="false" className="student-profile-chevron" />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function StudentSummaryCard({ icon: Icon, label, value, note, tone = 'blue', badge, status }) {
  return (
    <article className={`student-summary-card tone-${tone}`}>
      <div className="student-summary-card-icon" aria-hidden="true">
        <Icon size={24} strokeWidth={2.2} />
      </div>
      <div className="student-summary-card-copy">
        <span className="student-summary-card-label">{label}</span>
        <strong className="student-summary-card-value">{value || '-'}</strong>
        {note ? <small className="student-summary-card-note">{note}</small> : null}
      </div>
      {status ? <span className={`student-summary-card-badge ${getAttendanceStatusTone(status)}`.trim()}>{status}</span> : null}
      {badge ? <span className="student-summary-card-badge">{badge}</span> : null}
    </article>
  )
}

function buildWeeklyOverviewFromBackend(weeklyOverview = null, today = new Date()) {
  const weekDates = Array.isArray(weeklyOverview?.weekDates) ? weeklyOverview.weekDates.filter(Boolean) : []
  const presentCount = Number(weeklyOverview?.presentCount || 0) || 0
  const absentCount = Number(weeklyOverview?.absentCount || 0) || 0
  const markedCount = presentCount + absentCount
  const unmarkedCount = Math.max(0, 7 - markedCount)
  const weeklyPercentage = Math.round((presentCount / 7) * 100)
  const todayStatus = normalizeAttendanceDisplayStatus(weeklyOverview?.todayStatus)
  const formatDayMonth = (value) => {
    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
  }

  return {
    todayStatus,
    todayDateLabel: formatVerboseDate(today),
    weekRangeLabel:
      weekDates.length >= 2
        ? `${formatDayMonth(weekDates[0])} - ${formatDayMonth(weekDates[weekDates.length - 1])}`
        : '',
    presentCount,
    absentCount,
    weeklyPercentage,
    markedCount,
    unmarkedCount,
  }
}

function StudentMonthlyAttendanceChart({ student, studentAttendanceStatus, monthlyAttendance, weeklyOverview }) {
  const attendance = useMemo(
    () => monthlyAttendance || buildMonthlyAttendanceSummary(student, [], studentAttendanceStatus),
    [monthlyAttendance, student, studentAttendanceStatus],
  )
  const weekly = useMemo(
    () => buildWeeklyOverviewFromBackend(weeklyOverview),
    [weeklyOverview],
  )

  return (
    <article className="student-attendance-layout">
      <div className="student-attendance-main">
        <div className="student-attendance-header">
          <div className="student-attendance-title-row">
            <div className="student-attendance-title">Monthly Attendance</div>
          </div>
          <button type="button" className="student-attendance-chip" aria-label="Course duration">
            <span>{`Course Duration: ${attendance.durationMonths} Months (${attendance.rangeLabel})`}</span>
            <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
          </button>
        </div>

        <div className="student-attendance-chart" aria-label="Monthly attendance chart">
          <div className="student-attendance-axis student-attendance-axis-left" aria-hidden="true">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          <div className="student-attendance-plot">
            <div className="student-attendance-grid-lines" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="student-attendance-bars" style={{ gridTemplateColumns: `repeat(${attendance.series.length}, minmax(0, 1fr))` }}>
              {attendance.series.map((item) => (
                <div key={item.month} className={`student-attendance-group ${item.hasData ? 'has-data' : 'is-empty'}`.trim()}>
                  <strong
                    className="student-attendance-value"
                    aria-label={`${item.month} attendance ${item.hasData ? `${item.value}%` : 'no records yet'}`}
                  >
                    {item.displayValue}
                  </strong>
                  <div className="student-attendance-bar-wrap">
                    <div
                      className="student-attendance-bar"
                      style={{
                        height: item.hasData ? `max(${item.value}%, 12px)` : '8px',
                        opacity: item.hasData ? 1 : 0.25,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="student-attendance-months" style={{ gridTemplateColumns: `repeat(${attendance.series.length}, minmax(0, 1fr))` }}>
              {attendance.series.map((item) => (
                <span key={item.month}>{item.month}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="student-attendance-side">
        <article className="student-attendance-today-card">
          <div className="student-attendance-side-title">Today's Attendance</div>
          <div className={`student-attendance-today-status ${getAttendanceStatusTone(weekly.todayStatus)}`}>
            <div className="student-attendance-today-icon" aria-hidden="true">
              {getTodayAttendanceIcon(weekly.todayStatus)}
            </div>
            <div className="student-attendance-today-copy">
              <strong>{weekly.todayStatus}</strong>
              <span>
                {weekly.todayStatus === 'Present'
                  ? 'You are marked present today'
                  : weekly.todayStatus === 'Unmarked'
                    ? 'Attendance has not been marked yet'
                    : 'You are marked absent today'}
              </span>
            </div>
          </div>
          <div className="student-attendance-today-date">{weekly.todayDateLabel}</div>
        </article>

        <article className="student-attendance-week-card">
          <div className="student-attendance-week-header">
            <div>
              <div className="student-attendance-side-title">This Week Overview</div>
              <div className="student-attendance-week-range">{weekly.weekRangeLabel}</div>
            </div>
          </div>
          <div className="student-attendance-week-stats">
            <div className="student-attendance-mini-stat is-present">
              <strong>{weekly.presentCount}</strong>
              <span>Present</span>
            </div>
            <div className="student-attendance-mini-stat is-absent">
              <strong>{weekly.absentCount}</strong>
              <span>Absent</span>
            </div>
            <div className="student-attendance-mini-stat is-unmarked">
              <strong>{weekly.unmarkedCount}</strong>
              <span>Unmarked</span>
            </div>
          </div>
          <div className="student-attendance-progress-labels">
            <span>Weekly Attendance</span>
            <strong>{weekly.weeklyPercentage}%</strong>
          </div>
          <div className="student-attendance-progress-track" aria-hidden="true">
            <div className="student-attendance-progress-fill" style={{ width: `${weekly.weeklyPercentage}%` }} />
          </div>
        </article>
      </div>
    </article>
  )
}

function StudentPaymentOverview({ student }) {
  const payment = useMemo(() => {
    const totalAmount = Number(student?.afterDiscount || student?.totalAmount || 0)
    const paidAmount = getPaidAmount(student)
    const pendingAmount = Math.max(totalAmount - paidAmount, 0)
    const paidPercent = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0
    const pendingPercent = totalAmount > 0 ? Math.max(0, 100 - paidPercent) : 0

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      paidPercent,
      pendingPercent,
    }
  }, [student])

  const ringStyle = {
    background: `conic-gradient(#5ea1ff 0% ${payment.paidPercent}%, #FFC107 ${payment.paidPercent}% 100%)`,
  }

  const statusTone = payment.pendingAmount > 0 ? 'is-due' : 'is-clear'

  return (
    <article className="student-payment-overview panel-card" aria-label="Payment overview">
      <div className="student-payment-overview-head">
        <div>
          <p className="student-payment-overview-kicker">Payment Overview</p>
          <h3>Final Fee Breakdown</h3>
        </div>
        <span className={`student-payment-overview-chip ${statusTone}`}>
          {payment.totalAmount > 0 ? `${payment.paidPercent}% paid` : 'No fee data'}
        </span>
      </div>

      <div className="student-payment-overview-grid">
        <div className="student-payment-overview-ring" style={ringStyle} aria-hidden="true">
          <div className="student-payment-overview-ring-inner">
            <span>Total Amount</span>
            <strong>{formatCurrency(payment.totalAmount)}</strong>
            <small>{payment.pendingPercent}% pending</small>
          </div>
        </div>

        <div className="student-payment-overview-details">
          <div className="student-payment-overview-item tone-blue">
            <span className="student-payment-overview-dot" />
            <div>
              <strong>Paid Amount</strong>
              <span>{formatCurrency(payment.paidAmount)}</span>
            </div>
          </div>
          <div className="student-payment-overview-item tone-orange">
            <span className="student-payment-overview-dot" />
            <div>
              <strong>Pending Amount</strong>
              <span>{formatCurrency(payment.pendingAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`student-payment-overview-banner ${statusTone}`}>
        <Wallet size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        <div>
          <strong>
            {payment.pendingAmount > 0
              ? `${formatCurrency(payment.pendingAmount)} still pending`
              : 'You are up to date with your payments.'}
          </strong>
          <span>
            {payment.totalAmount > 0
              ? `Paid ${formatCurrency(payment.paidAmount)} out of ${formatCurrency(payment.totalAmount)} final fee.`
              : 'Payment data will appear once the student record is available.'}
          </span>
        </div>
      </div>
    </article>
  )
}

function StudentTestPerformanceTrend({ student }) {
  const trend = useMemo(() => {
    const baseScore = Number(student?.averageScore || 80)
    const offsets = [-8, -4, 2, -1, 7, 3]
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const values = months.map((month, index) => ({
      month,
      score: Math.max(60, Math.min(98, baseScore + offsets[index])),
    }))
    const highest = values.reduce((top, item) => (item.score > top.score ? item : top), values[0])
    const lowest = values.reduce((bottom, item) => (item.score < bottom.score ? item : bottom), values[0])
    const averageScore = Math.round(values.reduce((sum, item) => sum + item.score, 0) / values.length)

    return {
      values,
      highest,
      lowest,
      averageScore,
      testsTaken: Number(student?.testCount || 3),
    }
  }, [student])

  const chartPoints = trend.values.map((item, index) => {
    const x = 40 + index * 84
    const y = 164 - ((item.score - 60) / 38) * 112
    return { x, y }
  })
  const linePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPath = `M ${chartPoints[0].x} 164 ${chartPoints.map((point) => `L ${point.x} ${point.y}`).join(' ')} L ${chartPoints.at(-1).x} 164 Z`

  return (
    <article className="student-test-trend panel-card" aria-label="Test performance trend">
      <div className="student-test-trend-head">
        <h3>Test Performance Trend</h3>
        <button type="button" className="student-test-trend-filter" aria-label="Last 3 tests">
          <span>Last 3 Tests</span>
          <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
        </button>
      </div>

      <div className="student-test-trend-chart" aria-hidden="true">
        <svg viewBox="0 0 520 230" role="presentation" focusable="false">
          <defs>
            <linearGradient id="student-test-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#eff6ff" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((tick) => {
            const y = 190 - (tick / 100) * 120
            return <line key={tick} x1="28" x2="500" y1={y} y2={y} className="student-test-trend-gridline" />
          })}

          <text x="4" y="194" className="student-test-trend-axis">0%</text>
          <text x="0" y="164" className="student-test-trend-axis">25%</text>
          <text x="0" y="134" className="student-test-trend-axis">50%</text>
          <text x="0" y="104" className="student-test-trend-axis">75%</text>
          <text x="0" y="74" className="student-test-trend-axis">100%</text>

          <path d={areaPath} fill="url(#student-test-trend-fill)" opacity="0.9" />
          <polyline points={linePoints} fill="none" stroke="#0f7bda" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

          {trend.values.map((item, index) => {
            const { x, y } = chartPoints[index]
            return (
              <g key={item.month}>
                <circle cx={x} cy={y} r="6.5" fill="#1d4ed8" stroke="#ffffff" strokeWidth="3" />
                <text x={x} y={y - 16} textAnchor="middle" className="student-test-trend-label">
                  {item.score}%
                </text>
                <text x={x} y={214} textAnchor="middle" className="student-test-trend-month">
                  {item.month}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="student-test-trend-metrics">
        <div className="student-test-trend-metric tone-blue">
          <span className="student-test-trend-metric-icon" aria-hidden="true">
            <Activity size={16} strokeWidth={2.3} />
          </span>
          <div>
            <strong>Highest Score</strong>
            <b>{trend.highest.score}%</b>
            <small>{trend.highest.month}</small>
          </div>
        </div>
        <div className="student-test-trend-metric tone-green">
          <span className="student-test-trend-metric-icon" aria-hidden="true">
            <ArrowUpRight size={16} strokeWidth={2.4} />
          </span>
          <div>
            <strong>Average Score</strong>
            <b>{trend.averageScore.toFixed(2)}%</b>
            <small>Last 3 Tests</small>
          </div>
        </div>
        <div className="student-test-trend-metric tone-orange">
          <span className="student-test-trend-metric-icon" aria-hidden="true">
            <TrendingDown size={16} strokeWidth={2.3} />
          </span>
          <div>
            <strong>Lowest Score</strong>
            <b>{trend.lowest.score}%</b>
            <small>{trend.lowest.month}</small>
          </div>
        </div>
        <div className="student-test-trend-metric tone-violet">
          <span className="student-test-trend-metric-icon" aria-hidden="true">
            <ClipboardList size={16} strokeWidth={2.3} />
          </span>
          <div>
            <strong>Tests Taken</strong>
            <b>{trend.testsTaken}</b>
            <small>Total</small>
          </div>
        </div>
      </div>
    </article>
  )
}

function StudentDashboardContent({ dashboard }) {
  const { student: latestStudent, isLoading } = useCurrentStudentProfile()
  const facultyRecords = useFacultyRecordsSnapshot()
  const attendanceRefreshToken = useFacultyAttendanceRefreshToken()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [studentTodayAttendance, setStudentTodayAttendance] = useState(null)
  const [studentMonthlyAttendanceEntries, setStudentMonthlyAttendanceEntries] = useState([])
  const currentBatchWindow = useMemo(
    () => resolveBatchAttendanceWindow(latestStudent?.batchTiming || latestStudent?.batchTime || ''),
    [latestStudent?.batchTiming, latestStudent?.batchTime],
  )
  const batchStudentIndex = useMemo(
    () => (latestStudent ? getFacultyBatchStudentIndex(latestStudent) : -1),
    [latestStudent],
  )

  const studentLocalAttendanceEntries = useMemo(() => {
    if (!latestStudent) return []

    return listFacultyBatchAttendanceHistoryStates()
      .map((state) => getMonthlyAttendanceEntriesFromState(state, latestStudent, batchStudentIndex))
      .filter(Boolean)
  }, [batchStudentIndex, latestStudent])

  const studentAttendanceEntries = useMemo(
    () => mergeAttendanceEntries(studentLocalAttendanceEntries, studentMonthlyAttendanceEntries),
    [studentLocalAttendanceEntries, studentMonthlyAttendanceEntries],
  )

  useEffect(() => {
    let active = true

    const run = async () => {
      if (!latestStudent) {
        if (active) {
          setStudentTodayAttendance(null)
        }
        return
      }

      try {
        const result = await getCurrentStudentAttendanceOverview(getAttendanceDateKey())
        if (!active) return
        setStudentTodayAttendance(result || null)
      } catch {
        if (!active) return
        setStudentTodayAttendance(null)
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [attendanceRefreshToken, latestStudent])

  useEffect(() => {
    let active = true

    const run = async () => {
      if (!latestStudent) {
        if (active) {
          setStudentMonthlyAttendanceEntries([])
        }
        return
      }

      const durationMonths = getCourseDurationMonths(latestStudent)
      const admissionDate = parseDateValue(latestStudent?.admissionDate || latestStudent?.firstInstallmentDate || latestStudent?.createdAt) || new Date()
      const courseStartDate = startOfMonth(admissionDate)
      const today = new Date()
      const todayKey = getAttendanceDateKey(today)

      const monthDates = Array.from({ length: durationMonths }, (_, index) => addMonths(courseStartDate, index))
        .filter((monthDate) => monthDate.getTime() <= today.getTime())

      const apiEntries = []

      for (const monthDate of monthDates) {
        const monthEnd = endOfMonth(monthDate)
        const rangeEnd = monthEnd.getTime() > today.getTime() ? today : monthEnd
        const dayCount = Math.max(1, Math.ceil((rangeEnd.getTime() - startOfMonth(monthDate).getTime()) / (24 * 60 * 60 * 1000)) + 1)

        for (let offset = 0; offset < dayCount; offset += 1) {
          const date = new Date(startOfMonth(monthDate))
          date.setDate(date.getDate() + offset)
          const dateKey = getAttendanceDateKey(date)

          if (dateKey > todayKey) {
            continue
          }

          try {
            const result = await getCurrentStudentAttendanceOverview(dateKey)
            const normalizedStatus = normalizeAttendanceDisplayStatus(result?.status)

            if (normalizedStatus === 'Present' || normalizedStatus === 'Absent') {
              apiEntries.push({
                dateKey,
                status: normalizedStatus,
                updatedAt: Number(result?.updatedAt || 0) || 0,
                score: 1000,
              })
            }
          } catch {
            // Ignore day-level fetch failures and keep building the rest of the chart.
          }
        }
      }

      if (!active) return

      setStudentMonthlyAttendanceEntries(apiEntries)
    }

    void run()

    return () => {
      active = false
    }
  }, [attendanceRefreshToken, latestStudent])

  const facultyAttendance = useMemo(() => {
    try {
      return (
        resolveTodayFacultyAttendanceStatus(latestStudent?.facultyName || '') || {
          status: 'Absent',
          reason: 'No faculty login recorded for today.',
          facultyName: latestStudent?.facultyName || '-',
          batchName: '-',
          batchTiming: '',
        }
      )
    } catch {
      return {
        status: 'Absent',
        reason: 'Attendance data could not be loaded.',
        facultyName: latestStudent?.facultyName || '-',
        batchName: '-',
        batchTiming: '',
        loginDateTime: null,
        batchStartDateTime: null,
        sessions: [],
      }
    }
  }, [latestStudent])

  const studentBatchAttendance = useMemo(() => {
    try {
      return resolveStudentBatchAttendanceStatus(latestStudent || {}, facultyRecords)
    } catch {
      return null
    }
  }, [facultyRecords, latestStudent])

  const studentAttendance = useMemo(() => {
    try {
      const apiAttendanceStatus = normalizeAttendanceDisplayStatus(studentTodayAttendance?.status)
      const currentDayAttendance =
        currentBatchWindow.phase === 'pre-open'
          ? 'Unmarked'
          : apiAttendanceStatus === 'Present' || apiAttendanceStatus === 'Absent'
            ? apiAttendanceStatus
            : 'Unmarked'

      const attendanceFallbackStatus = getMonthlyAttendanceStatusWithFallback(
        studentAttendanceEntries.find((entry) => entry.dateKey === getAttendanceDateKey()),
        latestStudent,
        batchStudentIndex,
      )

      const apiAttendance =
        currentDayAttendance === 'Present' || currentDayAttendance === 'Absent'
          ? {
              ...studentTodayAttendance,
              status: currentDayAttendance,
            }
          : null

      const batchAttendance =
        attendanceFallbackStatus === 'Present' || attendanceFallbackStatus === 'Absent'
          ? {
              status: attendanceFallbackStatus,
              reason: 'Attendance was resolved from saved batch history.',
              facultyName: latestStudent?.facultyName || '-',
              batchName: latestStudent?.batchName || latestStudent?.batch || '-',
              batchTiming: latestStudent?.batchTiming || latestStudent?.batchTime || '',
              dateKey: getAttendanceDateKey(),
              updatedAt: null,
              records: {},
            }
          : null

      return (
        preferAttendanceState(studentBatchAttendance, batchAttendance, apiAttendance) || {
          status: 'Unmarked',
          reason: 'Attendance has not been marked yet.',
          facultyName: latestStudent?.facultyName || '-',
          batchName: latestStudent?.batchName || latestStudent?.batch || '-',
          batchTiming: latestStudent?.batchTiming || latestStudent?.batchTime || '',
          dateKey: getAttendanceDateKey(),
          updatedAt: null,
          records: {},
        }
      )
    } catch {
      return {
        status: 'Absent',
        reason: 'Attendance data could not be loaded.',
        facultyName: latestStudent?.facultyName || '-',
        batchName: latestStudent?.batchName || latestStudent?.batch || '-',
        batchTiming: latestStudent?.batchTiming || latestStudent?.batchTime || '',
        dateKey: getAttendanceDateKey(),
        updatedAt: null,
        records: {},
      }
    }
  }, [
    currentBatchWindow.phase,
    batchStudentIndex,
    latestStudent,
    studentBatchAttendance,
    studentAttendanceEntries,
    studentTodayAttendance,
  ])

  const monthlyAttendance = useMemo(
    () => buildMonthlyAttendanceSummary(latestStudent, studentAttendanceEntries, studentAttendance),
    [latestStudent, studentAttendance, studentAttendanceEntries],
  )

  if (isLoading) {
    return (
      <section className="student-dashboard-page">
        <StudentDashboardHeader studentName={null} facultyName={null} facultyAttendanceStatus={null} onProfileClick={null} />
        <article className="panel-card student-dashboard-empty">
          <p className="eyebrow">Student Dashboard</p>
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
          <div className="student-empty-state">
            <strong>Loading student profile...</strong>
            <p>Please wait while we fetch your dashboard details.</p>
          </div>
        </article>
      </section>
    )
  }

  if (!latestStudent) {
    return (
      <section className="student-dashboard-page">
        <StudentDashboardHeader studentName={null} facultyName={null} facultyAttendanceStatus={null} onProfileClick={null} />
        <article className="panel-card student-dashboard-empty">
          <p className="eyebrow">Student Dashboard</p>
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
          <div className="student-empty-state">
            <strong>No student record found</strong>
            <p>Add a student from Student Management to see the profile view here.</p>
          </div>
        </article>
      </section>
    )
  }

  const totalAmount = Number(latestStudent.afterDiscount || latestStudent.totalAmount || 0)
  const paidAmount = getPaidAmount(latestStudent)
  const dueAmount = Math.max(totalAmount - paidAmount, 0)
  const feeProgress = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0
  const summaryCards = [
    {
      icon: BookOpen,
      label: 'Current Course',
      value: latestStudent.courseInterested || '-',
      note: '',
      tone: 'blue',
      badge: '1 Course',
    },
    {
      icon: Wallet,
      label: 'Fee Status',
      value: dueAmount <= 0 ? 'Paid' : 'Pending',
      note: dueAmount <= 0 ? 'Next Due: -' : `Next Due: ${formatDate(getSecondDueDate(latestStudent))}`,
      tone: 'amber',
      badge: `${feeProgress}%`,
    },
    {
      icon: GraduationCap,
      label: 'Faculty',
      value: latestStudent.facultyName || '-',
      note: latestStudent.batch || 'Asha batch 2',
      tone: 'violet',
      status: facultyAttendance.status,
    },
    {
      icon: TrendingUp,
      label: 'Average Score',
      value: latestStudent.averageScore ? `${latestStudent.averageScore}%` : '82%',
      note: latestStudent.testCount ? `Across ${latestStudent.testCount} Tests` : 'Across 3 Tests',
      tone: 'green',
    },
  ]

  return (
    <section className="student-dashboard-page">
      <StudentDashboardHeader
        studentName={latestStudent.studentName}
        facultyName={latestStudent.facultyName}
        facultyAttendanceStatus={facultyAttendance}
        onProfileClick={() => setIsProfileOpen(true)}
      />

      <StudentProfileDrawer student={latestStudent} isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      <div className="student-summary-strip" aria-label="Student summary cards">
        {summaryCards.map((card) => (
          <StudentSummaryCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            note={card.note}
            tone={card.tone}
            badge={card.badge}
            status={card.status}
          />
        ))}
      </div>

      <StudentMonthlyAttendanceChart
        student={latestStudent}
        studentAttendanceStatus={studentAttendance}
        monthlyAttendance={monthlyAttendance}
        weeklyOverview={studentTodayAttendance?.weeklyOverview || null}
      />

      <div className="student-performance-payment-row">
        <StudentTestPerformanceTrend student={latestStudent} />
        <StudentPaymentOverview student={latestStudent} />
      </div>
    </section>
  )
}

export function StudentDashboard({ dashboard }) {
  return <StudentDashboardContent dashboard={dashboard} />
}





