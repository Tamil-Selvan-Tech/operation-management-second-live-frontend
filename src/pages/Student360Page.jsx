import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getBranchStudent, getStudentAttendanceSummary } from '../services/studentService'
import { getBranchAttendanceOverview } from '../services/attendanceService'
import { attendanceToday } from '../lib/branchAttendanceSummary'
import { getBranchStudentSyllabusReports } from '../services/examService'
import { getBranchStudentAcademicReports } from '../services/academicTestService'
import { buildFacultyTodayWorkProgressSummary } from '../lib/facultyProgress'
import { saveBranchStudent } from '../lib/branchStudentStore'

import './Student360Page.css'

function displayValue(value, fallback = '-') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return displayValue(value)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getPaymentDateValue(payment = {}) {
  return payment.dateRaw || payment.date || payment.paymentDate || payment.paymentDateRaw || payment.paidDate || payment.createdAt || ''
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return '-'
  return `₹${amount.toLocaleString('en-IN')}`
}

function calculateEnrollmentFinalFee(enrollment = {}, baseAmount = 0) {
  const total = Number(baseAmount) || 0
  const discountValue = Number(enrollment.discountValue) || 0
  const discountAmount = String(enrollment.discountType || '').toUpperCase() === 'PERCENTAGE'
    ? total * discountValue / 100
    : discountValue
  return Math.max(Math.round((total - discountAmount) * 100) / 100, 0)
}

function getStudentKeys(student = {}) {
  return [student.id, student._id, student.studentId, student.recordId]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
}

function getPaymentSchedule(student = {}) {
  if (Array.isArray(student.installmentSchedule) && student.installmentSchedule.length) {
    return student.installmentSchedule
  }

  if (Array.isArray(student.paymentPlan?.installments) && student.paymentPlan.installments.length) {
    return student.paymentPlan.installments
  }

  return [1, 2, 3, 4]
    .map((number) => ({
      number,
      amount: student[`installment${number}`],
      dueDate: number === 1 ? student.firstInstallmentDate : student[`${number === 2 ? 'secondDueDate' : number === 3 ? 'thirdDueDate' : 'fourthDueDate'}`],
      status: student[`${number === 1 ? 'first' : number === 2 ? 'second' : number === 3 ? 'third' : 'fourth'}InstallmentStatus`] || 'Pending',
    }))
    .filter((item) => item.amount || item.dueDate)
}

function getAcademicTestProgress(profile = {}, report = {}) {
  const profileProgress = profile?.academicTestProgress || {}
  const reportData = report?.data || report || {}
  const evaluations = Array.isArray(reportData.evaluations) ? reportData.evaluations : null
  const requestedStudentId = String(profile?.studentId || '').trim().toLowerCase()
  const reportStudentId = String(
    reportData.student?.studentId ||
    reportData.student?.student?.studentId ||
    reportData.studentId ||
    '',
  ).trim().toLowerCase()

  // The report endpoint is student-ID scoped. Only use its evaluation count
  // when the response is also for the requested student; this prevents a
  // duplicate student name from leaking another student's progress.
  if (evaluations && (!reportStudentId || !requestedStudentId || reportStudentId === requestedStudentId)) {
    const totalTests = Number(reportData.totalTests ?? profileProgress.totalTests ?? 0)
    const completedTests = evaluations.filter((evaluation) => {
      const status = String(evaluation?.status || '').toUpperCase()
      return status === 'SUBMITTED' || status === 'EVALUATED' || Number.isFinite(Number(evaluation?.percentage))
    }).length
    const safeTotal = Math.max(totalTests, evaluations.length, completedTests)
    const pendingTests = Math.max(0, safeTotal - completedTests)
    return {
      totalTests: safeTotal,
      completedTests,
      pendingTests,
      percentage: safeTotal ? Math.round((completedTests / safeTotal) * 100) : 0,
    }
  }

  return {
    totalTests: Number(profileProgress.totalTests) || 0,
    completedTests: Number(profileProgress.completedTests) || 0,
    pendingTests: Number(profileProgress.pendingTests) || 0,
    percentage: Number(profileProgress.percentage) || 0,
  }
}

function getAttendanceEntries(student = {}) {
  const entries = []
  const sources = [student.attendanceCalendar, student.attendanceRecords, student.calendarAttendanceRecords, student.records, student.attendanceHistory]
  sources.forEach((source) => {
    if (!Array.isArray(source)) return
    source.forEach((entry) => entries.push(entry))
  })

  ;[student.attendanceByDate, student.calendarAttendance].forEach((source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return
    Object.entries(source).forEach(([date, value]) => {
      entries.push({ date, status: typeof value === 'string' ? value : value?.status || value?.attendanceStatus })
    })
  })

  const byDate = new Map()
  entries.forEach((entry) => {
    const date = String(entry?.attendanceDate || entry?.dateKey || entry?.date || entry?.day || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const rawStatus = String(entry?.status || entry?.attendanceStatus || entry?.result || '').trim().toLowerCase()
    const status = rawStatus === 'present'
      ? 'present'
      : rawStatus === 'absent'
        ? 'absent'
        : ['leave', 'excused', 'holiday'].includes(rawStatus)
          ? 'leave'
          : ['unmarked', 'not_recorded', 'not recorded', 'upcoming'].includes(rawStatus)
            ? 'unmarked'
            : ''
    if (status) byDate.set(date, { date, status })
  })
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}

function getCurrentMonthAttendanceCells(attendanceEntries = [], student = {}) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const statusByDate = new Map(attendanceEntries.map((entry) => [entry.date, entry.status]))
  const schedule = String(student.attendanceSchedule || student.classSchedule || student.courseSchedule || '').toLowerCase()
  const isWeekendSchedule = schedule.includes('weekend')
  const weeklyOffDay = String(student.weeklyOffDay || '').trim().toLowerCase()
  const courseStart = String(student.courseStartDate || '').slice(0, 10)
  const courseEnd = String(student.courseEndDate || '').slice(0, 10)

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dateObject = new Date(`${date}T00:00:00`)
    const dayOfWeek = dateObject.getDay()
    const isWithinCourse = (!courseStart || date >= courseStart) && (!courseEnd || date <= courseEnd)
    const isWeeklyOff = weeklyOffDay && dateObject.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === weeklyOffDay
    const isScheduled = isWithinCourse && !isWeeklyOff && (isWeekendSchedule ? [0, 6].includes(dayOfWeek) : [1, 2, 3, 4, 5].includes(dayOfWeek))
    return { date, day, status: isScheduled ? (statusByDate.get(date) || 'unmarked') : 'not-applicable' }
  })
}

function getCourseProgress(student = {}) {
  const value = [
    student.courseProgress,
    student.courseCompletionPercentage,
    student.progress,
    student.course?.courseProgress,
    student.course?.progress,
  ].find((candidate) => candidate !== null && candidate !== undefined && String(candidate).trim() !== '')
  const percentage = Number(value)
  return Number.isFinite(percentage) ? Math.min(100, Math.max(0, percentage)) : 0
}

function AttendanceCalendarSection({ student, studentId, enrollment, isMultiCourseStudent, branchId, onViewCalendar }) {
  const [courseAttendance, setCourseAttendance] = useState({ studentId: '', courseId: '', records: [], error: '' })

  useEffect(() => {
    if (!isMultiCourseStudent || !enrollment?.courseId) return undefined

    let active = true
    getBranchAttendanceOverview(attendanceToday(), branchId)
      .then((overview) => {
        if (!active) return
        const matchingStudents = (overview.students || []).filter((entry) => (
          String(entry.studentId || '').trim().toLowerCase() === String(student.studentId || studentId || '').trim().toLowerCase() ||
          String(entry.id || '').trim() === String(student.id || student._id || '').trim()
        ))
        const selectedCourseRecords = matchingStudents.flatMap((entry) => Array.isArray(entry.records) ? entry.records : [])
          .filter((record) => String(record.courseId || '').trim() === String(enrollment.courseId).trim())
        setCourseAttendance({ studentId, courseId: enrollment.courseId, records: selectedCourseRecords, error: '' })
      })
      .catch((requestError) => {
        if (active) setCourseAttendance({ studentId, courseId: enrollment.courseId, records: [], error: requestError?.message || 'Unable to load course attendance records.' })
      })

    return () => { active = false }
  }, [branchId, enrollment?.courseId, isMultiCourseStudent, student.id, student._id, student.studentId, studentId])

  const hasCurrentCourseData = courseAttendance.studentId === studentId && courseAttendance.courseId === enrollment?.courseId
  const loading = isMultiCourseStudent && !hasCurrentCourseData
  const error = hasCurrentCourseData ? courseAttendance.error : ''
  const courseRecords = hasCurrentCourseData ? courseAttendance.records : []

  const calendarStudent = isMultiCourseStudent ? {
    ...student,
    courseId: enrollment?.courseId,
    courseStartDate: enrollment?.courseStartDate,
    courseEndDate: enrollment?.courseEndDate,
    classSchedule: enrollment?.classSchedule || student.classSchedule,
    weeklyOffDay: enrollment?.weeklyOffDay || student.weeklyOffDay,
    attendanceRecords: courseRecords,
  } : student
  const attendanceEntries = getAttendanceEntries(calendarStudent)
  const attendanceCells = getCurrentMonthAttendanceCells(attendanceEntries, calendarStudent)
  const attendanceSummary = attendanceEntries.reduce((summary, entry) => {
    if (Object.prototype.hasOwnProperty.call(summary, entry.status)) summary[entry.status] += 1
    return summary
  }, { present: 0, absent: 0, leave: 0, unmarked: 0 })

  return (
    <SectionCard title={isMultiCourseStudent ? `Attendance Calendar · ${displayValue(enrollment?.courseName, 'Course')}` : 'Attendance Calendar'} className="student360-anchor-card" actions={<button type="button" className="student360-secondary-button" onClick={() => onViewCalendar?.(student, enrollment)}><CalendarDays size={15} /> Calendar</button>}>
      {loading ? <div className="student360-no-data">Loading selected course attendance...</div> : error ? <div className="student360-no-data student360-attendance-error">{error}</div> : null}
      <div className="student360-attendance-legend">
        <span className="present"><i />Present ({attendanceSummary.present})</span>
        <span className="absent"><i />Absent ({attendanceSummary.absent})</span>
        <span className="excused"><i />Leave ({attendanceSummary.leave})</span>
        <span className="unmarked"><i />Unmarked ({attendanceSummary.unmarked})</span>
        <span className="not-applicable"><i />Disabled / Not Applicable</span>
      </div>
      <div className="student360-attendance-grid">{attendanceCells.map((entry) => <div className={`student360-attendance-cell ${entry.status}`} key={entry.date} title={`${entry.date} · ${entry.status}`}><strong>{entry.day}</strong><small>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}</small></div>)}</div>
    </SectionCard>
  )
}

function getStudentCourseEnrollments(student = {}, branchCourseCards = []) {
  const source = Array.isArray(student.courseEnrollments) && student.courseEnrollments.length
    ? student.courseEnrollments
    : Array.isArray(student.courses) && student.courses.length
      ? student.courses
      : []
  const uniqueCourses = [...new Map(source
    .filter((course) => course && typeof course === 'object')
    .map((course, index) => [
      String(course.courseId || course.id || course.course?.id || course.courseName || course.name || index).trim(),
      course,
    ])).values()]

  if (!uniqueCourses.length) {
    return [{
      courseId: student.courseId || student.course?.id || '',
      courseName: student.courseName || student.courseInterested || student.course?.name || '',
      courseType: student.courseType || student.course?.courseType || '',
      batchName: student.batchName || student.batch || '',
      batchTiming: student.batchTiming || '',
      facultyName: student.facultyName || '',
      courseMode: student.courseMode || student.mode || '',
      classSchedule: student.classSchedule || student.courseSchedule || '',
      courseStartDate: student.courseStartDate || student.startDate || '',
      courseEndDate: student.courseEndDate || student.endDate || '',
      courseDuration: student.courseDuration || student.course?.duration || '',
      courseAmount: student.courseAmount || student.totalCourseAmount || '',
      paymentPlan: student.paymentPlan || '',
      status: student.arrangementStatus || student.status || 'ACTIVE',
      courseProgress: student.courseProgress ?? student.courseCompletionPercentage ?? student.progress,
    }]
  }

  return uniqueCourses.map((course) => {
    const courseId = String(course.courseId || course.id || course.course?.id || '').trim()
    const courseName = String(course.courseName || course.name || course.course?.name || '').trim()
    const catalogCourse = branchCourseCards.find((item) => (
      (courseId && String(item?.id || item?.courseId || '').trim() === courseId) ||
      (courseName && String(item?.name || '').trim().toLowerCase() === courseName.toLowerCase())
    ))
    const isPrimaryCourse = courseId && courseId === String(student.courseId || student.course?.id || '').trim()
    const savedProgress = course.courseProgress ?? course.courseCompletionPercentage ?? course.progress
    return {
      ...course,
      courseId,
      courseName: course.courseName || course.name || course.course?.name || (isPrimaryCourse ? student.courseName || student.courseInterested : '') || '',
      courseType: course.courseType || course.course?.courseType || (isPrimaryCourse ? student.courseType || student.course?.courseType : '') || '',
      batchName: course.batchName || course.batch || (isPrimaryCourse ? student.batchName || student.batch : '') || '',
      batchTiming: course.batchTiming || course.batchTime || (isPrimaryCourse ? student.batchTiming : '') || '',
      weeklyOffDay: course.weeklyOffDay || (isPrimaryCourse ? student.weeklyOffDay : '') || '',
      facultyName: course.facultyName || (isPrimaryCourse ? student.facultyName : '') || '',
      courseMode: course.courseMode || course.mode || (isPrimaryCourse ? student.courseMode : '') || '',
      classSchedule: course.classSchedule || course.scheduleType || course.schedule || (isPrimaryCourse ? student.classSchedule || student.courseSchedule : '') || '',
      courseStartDate: course.courseStartDate || course.startDate || (isPrimaryCourse ? student.courseStartDate : '') || '',
      courseEndDate: course.courseEndDate || course.endDate || (isPrimaryCourse ? student.courseEndDate : '') || '',
      courseDuration: course.courseDuration || course.duration || course.course?.duration || catalogCourse?.duration || (isPrimaryCourse ? student.courseDuration : '') || '',
      courseAmount: course.totalCourseAmount ?? course.courseAmount ?? course.totalAmount ?? (isPrimaryCourse ? student.courseAmount : ''),
      paymentPlan: course.paymentPlan || course.paymentPlanName || (isPrimaryCourse ? student.paymentPlan : '') || '',
      courseProgress: savedProgress ?? (isPrimaryCourse ? getCourseProgress(student) : null),
    }
  })
}

function getPeriodValue(period = {}, key, fallback = 0) {
  const aliases = key === 'eligible' ? ['eligible', 'eligibleClasses', 'scheduledDays', 'totalScheduledDays', 'scheduledSessions', 'total'] : [key, `${key}Count`, `${key}Days`]
  const value = aliases.map((alias) => period?.[alias]).find((candidate) => candidate !== undefined && candidate !== null && candidate !== '') ?? fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function getPeriodPercentage(period = {}) {
  const value = period?.percentage ?? period?.attendancePercentage ?? period?.presentPercentage ?? period?.presentPercent
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function getPeriod(summary, name) {
  const value = summary?.[name]
  return Array.isArray(value) ? value[value.length - 1] || {} : value || {}
}

function formatAttendancePercentage(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return `${Number(number.toFixed(2))}%`
}

function hasPeriodData(period = {}) {
  return ['percentage', 'attendancePercentage', 'presentPercentage', 'presentPercent', 'eligible', 'eligibleClasses', 'scheduledDays', 'totalScheduledDays', 'total'].some((key) => period?.[key] !== undefined && period?.[key] !== null)
}

function formatAttendanceDate(value) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function buildSelectedCourseAttendanceOverview(overview = {}, student = {}, enrollment = {}) {
  const startDate = String(enrollment.courseStartDate || '').slice(0, 10)
  const endDate = String(enrollment.courseEndDate || '').slice(0, 10)
  const today = attendanceToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null

  const matchingStudents = (overview.students || []).filter((entry) => (
    String(entry.studentId || '').trim().toLowerCase() === String(student.studentId || '').trim().toLowerCase() ||
    String(entry.id || '').trim() === String(student.id || student._id || '').trim()
  ))
  const records = matchingStudents.flatMap((entry) => Array.isArray(entry.records) ? entry.records : [])
    .filter((record) => String(record.courseId || '').trim() === String(enrollment.courseId || '').trim())
  const recordsByDate = new Map(records.map((record) => [String(record.attendanceDate || '').slice(0, 10), String(record.status || '').toUpperCase()]))
  const exclusions = overview.exclusions || {}
  const holidays = new Set((exclusions.holidays || []).map((date) => String(date).slice(0, 10)))
  const leaves = Array.isArray(exclusions.leaves) ? exclusions.leaves : []
  const schedule = String(enrollment.classSchedule || '').toLowerCase()
  const weeklyOffDay = String(enrollment.weeklyOffDay || '').toLowerCase()
  const scheduledDates = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  while (cursor <= end) {
    const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    const day = cursor.getDay()
    const weekdayName = cursor.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const isScheduleDay = schedule.includes('weekend')
      ? day === 0 || day === 6
      : schedule.includes('weekday') || schedule.includes('week day') || !schedule
        ? day >= 1 && day <= 5
        : schedule.split(/[&,]/).some((value) => weekdayName.startsWith(value.trim().toLowerCase().slice(0, 3)))
    const isExcluded = holidays.has(date) || leaves.some((leave) => (
      String(leave.leaveDate || '').slice(0, 10) === date &&
      (!leave.batchId || String(leave.batchId) === String(enrollment.batchId || ''))
    ))
    if (isScheduleDay && !isExcluded && (!weeklyOffDay || weeklyOffDay !== weekdayName)) scheduledDates.push(date)
    cursor.setDate(cursor.getDate() + 1)
  }

  const summarizeRange = (from, to) => {
    const dates = scheduledDates.filter((date) => date >= from && date <= to)
    const present = dates.filter((date) => recordsByDate.get(date) === 'PRESENT').length
    const absent = dates.filter((date) => recordsByDate.get(date) === 'ABSENT').length
    const leave = dates.filter((date) => recordsByDate.get(date) === 'LEAVE').length
    return {
      present,
      absent,
      leave,
      eligible: dates.length,
      scheduledDays: dates.length,
      percentage: dates.length ? Number(((present / dates.length) * 100).toFixed(2)) : 0,
    }
  }

  const todayDate = new Date(`${today}T00:00:00`)
  const weekStartDate = new Date(todayDate)
  weekStartDate.setDate(todayDate.getDate() - (todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1))
  const weekStart = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 6)
  const weekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, '0')}-${String(weekEndDate.getDate()).padStart(2, '0')}`
  const monthStart = `${today.slice(0, 7)}-01`
  const monthEndDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0)
  const monthEnd = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`

  return {
    hasCourseRecords: records.length > 0,
    course: { startDate, endDate, schedule: enrollment.classSchedule || '' },
    weekly: summarizeRange(weekStart, weekEnd),
    currentMonth: summarizeRange(monthStart, monthEnd),
    overall: summarizeRange(startDate, endDate),
  }
}

function AttendanceSection({ studentId, student, enrollment, isMultiCourseStudent, branchId }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(Boolean(studentId))
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!studentId) {
      return undefined
    }

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const result = isMultiCourseStudent
          ? buildSelectedCourseAttendanceOverview(
            await getBranchAttendanceOverview(attendanceToday(), branchId),
            { studentId: student?.studentId || studentId, id: student?.id, _id: student?._id },
            {
              courseId: enrollment?.courseId,
              courseStartDate: enrollment?.courseStartDate,
              courseEndDate: enrollment?.courseEndDate,
              classSchedule: enrollment?.classSchedule,
              weeklyOffDay: enrollment?.weeklyOffDay,
              batchId: enrollment?.batchId,
            },
          )
          : await getStudentAttendanceSummary(studentId)
        if (!result) throw new Error('Selected course attendance schedule is unavailable.')
        if (active) setSummary(result)
      } catch (requestError) {
        if (active) setError(requestError?.message || 'Unable to load attendance.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    const refresh = () => { void load() }
    window.addEventListener('focus', refresh)
    window.addEventListener('cispro:student-calendar-attendance-changed', refresh)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener('cispro:student-calendar-attendance-changed', refresh)
    }
  }, [branchId, enrollment?.batchId, enrollment?.classSchedule, enrollment?.courseEndDate, enrollment?.courseId, enrollment?.courseStartDate, enrollment?.weeklyOffDay, isMultiCourseStudent, student?._id, student?.courseId, student?.course?.id, student?.id, student?.studentId, studentId])

  const source = summary || {}
  const course = source.course || {}
  const weekly = getPeriod(source, 'weekly')
  const monthly = source.currentMonth || getPeriod(source, 'monthly')
  const overall = getPeriod(source, 'overall')
  const cardData = [
    ['Weekly Attendance', weekly],
    ['Monthly Attendance', monthly],
    ['Overall Course Attendance', overall],
  ]

  return (
    <SectionCard title={isMultiCourseStudent ? `Attendance · ${displayValue(enrollment?.courseName, 'Course')}` : 'Attendance'} description={isMultiCourseStudent ? 'Attendance summary for the selected course and its schedule.' : 'Attendance calculated from the active enrollment, course schedule, and daily records.'}>
      {loading ? <div className="student360-no-data">Loading attendance...</div> : error ? <div className="student360-no-data student360-attendance-error">{error}</div> : (
        <>
          <div className="student360-attendance-course-meta">{course.startDate || student?.courseStartDate ? `${formatAttendanceDate(course.startDate || student.courseStartDate)} → ${formatAttendanceDate(course.endDate || student.courseEndDate)}` : 'Course dates unavailable'}<span>{course.schedule || course.scheduleType || student?.classSchedule || 'Schedule unavailable'}</span></div>
          {source.hasCourseRecords === false ? <div className="student360-no-data">No attendance has been recorded for this course yet.</div> : <div className="student360-attendance-summary-cards">
            {cardData.map(([label, period]) => { const available = hasPeriodData(period); return <article className="student360-attendance-summary-card" key={label}><span>{label}</span><strong>{available ? formatAttendancePercentage(getPeriodPercentage(period)) : '—'}</strong><small>{available ? `${getPeriodValue(period, 'present')} / ${getPeriodValue(period, 'eligible', getPeriodValue(period, 'total'))} Classes` : 'No data'}</small></article> })}
          </div>}
        </>
      )}
    </SectionCard>
  )
}

function PerformanceRing({ percentage, size = 'normal' }) {
  const value = Number(percentage)
  const evaluated = Number.isFinite(value)
  const safeValue = evaluated ? Math.min(100, Math.max(0, value)) : 0
  return <div className={`student360-performance-ring ${size === 'small' ? 'is-small' : ''} ${evaluated ? '' : 'is-empty'}`.trim()} style={{ '--ring-value': `${safeValue * 3.6}deg` }}><span>{evaluated ? `${safeValue.toFixed(0)}%` : '—'}</span></div>
}

function PerformanceSection({ studentId, branchId = '' }) {
  const [data, setData] = useState({ skills: [], academic: [] })
  const [loading, setLoading] = useState(Boolean(studentId))
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError('')
    const [syllabusResult, academicResult] = await Promise.allSettled([
      getBranchStudentSyllabusReports(studentId, branchId),
      getBranchStudentAcademicReports(studentId, branchId),
    ])
    const syllabus = syllabusResult.status === 'fulfilled' ? (syllabusResult.value?.data || syllabusResult.value || {}) : null
    const academic = academicResult.status === 'fulfilled' ? (academicResult.value?.data || academicResult.value || {}) : null
    if (!syllabus && !academic) setError('Unable to load performance data.')
    setData({ skills: syllabus?.skills || [], academic: academic?.evaluations || [] })
    setLoading(false)
  }, [studentId, branchId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return <section className="student360-card student360-performance-card">
    <div className="student360-performance-header"><div><span className="student360-performance-kicker">PERFORMANCE</span><h2>Student Performance</h2><p>Track module skills and academic evaluation results.</p></div><button type="button" className="student360-performance-refresh" onClick={() => void load()} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button></div>
    {loading ? <div className="student360-no-data">Loading performance...</div> : error ? <div className="student360-performance-error"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div> : <div className="student360-performance-sections">
      <section className="student360-performance-block student360-skills-block"><div className="student360-subsection-heading"><div><h3>Skills</h3><p>Module-wise skill performance based on submitted reports.</p></div><span>{data.skills.length} module{data.skills.length === 1 ? '' : 's'}</span></div>{data.skills.length ? <div className="student360-skill-grid">{data.skills.map((skill) => <article className="student360-skill-card" key={skill.moduleId || skill.moduleName}><div className="student360-skill-card-top"><div><span className="student360-skill-label">MODULE SKILL</span><h4>{skill.moduleName}</h4></div><PerformanceRing percentage={skill.overallPercentage} /></div><div className="student360-skill-footer"><span>{skill.testCount} submitted test{skill.testCount === 1 ? '' : 's'}</span><strong><i />Report Submitted</strong></div></article>)}</div> : <div className="student360-no-data">No module reports available yet.</div>}</section>
      <section className="student360-performance-block student360-academic-block"><div className="student360-subsection-heading"><div><h3>Academic Performance</h3><p>Fixed evaluations and their latest submitted results.</p></div><span>{data.academic.length} evaluation{data.academic.length === 1 ? '' : 's'}</span></div>{data.academic.length ? <div className="student360-academic-grid">{data.academic.map((evaluation) => { const evaluated = Number.isFinite(Number(evaluation.percentage)); const submitted = String(evaluation.status || '').toUpperCase() === 'SUBMITTED' || evaluated; const marks = evaluation.marksObtained != null && evaluation.totalMarks != null ? `${evaluation.marksObtained} / ${evaluation.totalMarks}` : ''; return <article className="student360-academic-card" key={evaluation.evaluationId || evaluation.name}><PerformanceRing percentage={evaluation.percentage} size="small" /><div className="student360-academic-copy"><span className="student360-academic-label">{evaluation.type || 'Evaluation'}</span><h4>{evaluation.name}</h4>{marks ? <span className="student360-academic-marks">{marks} marks</span> : null}<strong className={submitted ? 'is-submitted' : ''}><i />{submitted ? 'Report Submitted' : 'Not Evaluated'}</strong></div><span className="student360-academic-value">{evaluated ? `${Number(evaluation.percentage).toFixed(2).replace(/\.00$/, '')}%` : 'Not Evaluated'}</span></article> })}</div> : <div className="student360-no-data">No academic evaluations configured yet.</div>}</section>
    </div>}
  </section>
}

function DetailItem({ label, value, icon: Icon, className = '' }) {
  return (
    <div className={`student360-detail-item ${className}`.trim()}>
      {Icon ? <span className="student360-detail-icon"><Icon size={16} strokeWidth={2} aria-hidden="true" /></span> : null}
      <div>
        <span>{label}</span>
        <strong>{displayValue(value)}</strong>
      </div>
    </div>
  )
}

function SectionCard({ title, description, actions, children, className = '', id }) {
  return (
    <section id={id} className={`student360-card ${className}`.trim()}>
      <div className="student360-card-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="student360-card-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function Student360Page({
  studentId = '',
  student: initialStudent = null,
  facultyTodayWorkEntries = [],
  branchCourseCards = [],
  branchBatchGroups = [],
  isAssignmentBatchFull,
  resolveCourseEndDate,
  branch = null,
  paymentHistory = [],
  onBack,
  backLabel = 'Back to Students',
  onEdit,
  onViewCalendar,
  onDownloadAttendance,
  onDownloadPaymentReceipt,
}) {
  const resolvedStudentId = String(studentId || initialStudent?.studentId || initialStudent?.studentCode || initialStudent?.id || initialStudent?._id || '').trim()
  const performanceBranchId = String(branch?.id || branch?.branchId || initialStudent?.branchId || '').trim()
  const initialStudentRef = useRef(initialStudent)
  const [studentRecord, setStudentRecord] = useState(null)
  const [academicProgressState, setAcademicProgressState] = useState({ studentId: '', data: null, error: '' })
  const [courseSelection, setCourseSelection] = useState({ studentId: '', courseKey: '' })
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [assignmentForm, setAssignmentForm] = useState({ schedule: '', mode: '', batchId: '', startDate: '', endDate: '', totalCourseAmount: '', paymentPlanId: '' })

  useEffect(() => {
    initialStudentRef.current = initialStudent
  }, [initialStudent])

  useEffect(() => {
    if (!assignmentModalOpen) return undefined
    document.body.classList.add('student360-assignment-open')
    return () => document.body.classList.remove('student360-assignment-open')
  }, [assignmentModalOpen])

  useEffect(() => {
    let active = true
    if (!resolvedStudentId) return undefined
    Promise.allSettled([
      getBranchStudent(resolvedStudentId),
      getBranchStudentAcademicReports(resolvedStudentId, performanceBranchId),
    ])
      .then(([profileResult, reportResult]) => {
        if (!active) return
        const result = profileResult.status === 'fulfilled' ? profileResult.value : initialStudentRef.current
        if (!result) throw profileResult.reason || new Error('Student profile is unavailable.')
        const academicReport = reportResult.status === 'fulfilled' ? reportResult.value : null
        setStudentRecord({ studentId: resolvedStudentId, data: result })
        setAcademicProgressState({ studentId: resolvedStudentId, data: getAcademicTestProgress(result, academicReport), error: '' })
      })
      .catch((error) => {
        if (active) setAcademicProgressState({ studentId: resolvedStudentId, data: null, error: error?.message || 'Unable to load academic test progress.' })
      })
    return () => { active = false }
  }, [resolvedStudentId, performanceBranchId])

  const student = studentRecord?.studentId === resolvedStudentId ? studentRecord.data : initialStudent
  const academicTestProgress = academicProgressState.studentId === resolvedStudentId ? academicProgressState.data : null
  const academicTestProgressError = academicProgressState.studentId === resolvedStudentId ? academicProgressState.error : ''

  if (!student) {
    return (
      <section className="student360-page student360-empty-state">
        <button type="button" className="student360-back-button" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" /> {backLabel}
        </button>
        <div className="student360-empty-card">
          <UserRound size={28} aria-hidden="true" />
          <h1>Student profile unavailable</h1>
          <p>The selected student could not be found in this branch.</p>
        </div>
      </section>
    )
  }

  const studentName = displayValue(student.studentName, 'Student')
  const studentKeys = getStudentKeys(student)
  const schedule = getPaymentSchedule(student)
  const courseProgress = getCourseProgress(student)
  const courseEnrollments = getStudentCourseEnrollments(student, branchCourseCards)
  const isMultiCourseStudent = courseEnrollments.length > 1
  const getEnrollmentKey = (enrollment, index) => String(enrollment.courseId || `${enrollment.courseName}-${index}`)
  const primaryCourseIndex = courseEnrollments.findIndex((enrollment) => (
    String(enrollment.courseId || '').trim() === String(student.courseId || student.course?.id || '').trim()
  ))
  const selectedCourseKey = courseSelection.studentId === resolvedStudentId ? courseSelection.courseKey : ''
  const explicitCourseIndex = courseEnrollments.findIndex((enrollment, index) => getEnrollmentKey(enrollment, index) === selectedCourseKey)
  const selectedCourseIndex = explicitCourseIndex >= 0 ? explicitCourseIndex : Math.max(primaryCourseIndex, 0)
  const selectedCourse = courseEnrollments[selectedCourseIndex]
  const selectedCourseCatalog = isMultiCourseStudent
    ? branchCourseCards.find((course) => (
      String(course?.id || course?.courseId || '').trim() === String(selectedCourse.courseId || '').trim() ||
      String(course?.name || '').trim().toLowerCase() === String(selectedCourse.courseName || '').trim().toLowerCase()
    ))
    : null
  const priorCoursesCompleted = selectedCourseIndex > 0 && courseEnrollments.slice(0, selectedCourseIndex).every((enrollment) => {
    const isPrimaryEnrollment = String(enrollment.courseId || '') === String(student.courseId || student.course?.id || '')
    const savedProgress = enrollment.courseProgress ?? (isPrimaryEnrollment ? student.courseProgress : null)
    const priorCatalogCourse = branchCourseCards.find((course) => (
      String(course?.id || course?.courseId || '').trim() === String(enrollment.courseId || '').trim() ||
      String(course?.name || '').trim().toLowerCase() === String(enrollment.courseName || '').trim().toLowerCase()
    ))
    const workProgress = priorCatalogCourse
      ? buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, priorCatalogCourse, {
        ...student,
        courseId: enrollment.courseId,
        courseName: enrollment.courseName,
      })?.courseProgress
      : null
    const progressValues = [savedProgress, workProgress].map(Number).filter(Number.isFinite)
    return Boolean(enrollment.courseCompletedAt || (isPrimaryEnrollment && student.courseCompletedAt)) || Math.max(0, ...progressValues) >= 100
  })
  const isSelectedCoursePending = String(selectedCourse.status || '').toUpperCase() === 'PENDING'
  const isAwaitingSelectedCourseSchedule = isSelectedCoursePending && priorCoursesCompleted
  const selectedCourseRealBatches = branchBatchGroups
    .filter((group) => String(group?.courseId || group?.branchCourseId || '').trim() === String(selectedCourse.courseId || '').trim())
    .filter((group) => String(group?.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
    .flatMap((group) => (Array.isArray(group?.batches) ? group.batches : []).map((batch) => ({
      ...batch,
      courseId: String(group?.courseId || group?.branchCourseId || '').trim(),
      courseName: String(group?.courseName || selectedCourse.courseName || '').trim(),
      batchGroupId: String(group?.batchGroupId || group?.id || '').trim(),
      batchId: String(batch?.batchId || batch?.id || '').trim(),
      batchName: String(batch?.batchName || '').trim(),
      weekType: String(batch?.weekType || group?.weekType || '').toUpperCase(),
      mode: String(batch?.mode || group?.mode || '').toUpperCase(),
      batchTiming: String(batch?.batchTiming || [batch?.startTime && `${batch.startTime} ${batch.startPeriod || ''}`, batch?.endTime && `${batch.endTime} ${batch.endPeriod || ''}`].filter(Boolean).join(' - ')).trim(),
      facultyId: String(batch?.facultyId || group?.facultyId || group?.branchFacultyId || '').trim(),
      facultyName: String(batch?.facultyName || group?.facultyName || '').trim(),
      courseStartDate: batch?.courseStartDate || group?.courseStartDate || '',
      courseEndDate: batch?.courseEndDate || group?.courseEndDate || '',
      weeklyOffDay: batch?.weeklyOffDay || group?.weeklyOffDay || '',
    })))
    .filter((batch) => batch.batchId && batch.batchTiming && (batch.facultyId || batch.facultyName) && String(batch.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
  const availableSchedules = [...new Set(selectedCourseRealBatches.map((batch) => batch.weekType).filter(Boolean))]
  const scheduleBatches = selectedCourseRealBatches.filter((batch) => !assignmentForm.schedule || batch.weekType === assignmentForm.schedule.toUpperCase())
  const availableModes = [...new Set(scheduleBatches.map((batch) => batch.mode).filter(Boolean))]
  const matchingAssignmentBatches = scheduleBatches.filter((batch) => !assignmentForm.mode || batch.mode === assignmentForm.mode.toUpperCase())
  const selectedAssignmentBatch = matchingAssignmentBatches.find((batch) => batch.batchId === assignmentForm.batchId)
  const selectedCoursePaymentPlans = Array.isArray(selectedCourseCatalog?.paymentPlans) ? selectedCourseCatalog.paymentPlans : []
  const selectedAssignmentPaymentPlan = selectedCoursePaymentPlans.find((plan) => String(plan.id || '').trim() === String(assignmentForm.paymentPlanId || '').trim())
  const firstCourseEnrollment = courseEnrollments[0] || {}
  const selectedCourseDiscountType = String(selectedCourse.discountType || firstCourseEnrollment.discountType || 'FIXED').toUpperCase()
  const selectedCourseDiscountValue = Number(selectedCourse.discountValue ?? firstCourseEnrollment.discountValue ?? 0) || 0
  const selectedCourseFee = Number(String(assignmentForm.totalCourseAmount || '').replace(/,/g, '')) || 0
  const selectedCourseFinalFee = calculateEnrollmentFinalFee({ discountType: selectedCourseDiscountType, discountValue: selectedCourseDiscountValue }, selectedCourseFee)
  const selectedCourseDiscountAmount = Math.max(Math.round((selectedCourseFee - selectedCourseFinalFee) * 100) / 100, 0)
  const selectedPaymentInstallmentCount = Math.max(1, Number(selectedAssignmentPaymentPlan?.installmentCount || selectedAssignmentPaymentPlan?.installments?.length || 1))
  const assignmentEndDate = selectedAssignmentBatch
    ? (assignmentForm.endDate || resolveCourseEndDate?.(assignmentForm.startDate, selectedAssignmentBatch, selectedCourseCatalog) || selectedAssignmentBatch.courseEndDate || '')
    : ''
  const selectableAssignmentBatches = matchingAssignmentBatches.filter((batch) => !isAssignmentBatchFull?.(batch))
  const selectedCourseProgressSummary = isMultiCourseStudent && selectedCourseCatalog
    ? buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, selectedCourseCatalog, {
      ...student,
      courseId: selectedCourse.courseId,
      courseName: selectedCourse.courseName,
    })
    : null
  const selectedSavedProgress = selectedCourse?.courseProgress
  const selectedWorkProgress = selectedCourseProgressSummary?.courseProgress
  const hasSelectedCourseProgress = (selectedSavedProgress !== null && selectedSavedProgress !== undefined && String(selectedSavedProgress).trim() !== '') || (selectedWorkProgress !== null && selectedWorkProgress !== undefined)
  const selectedCourseProgress = Number(hasSelectedCourseProgress ? (selectedSavedProgress ?? selectedWorkProgress) : NaN)
  const selectedCourseProgressValue = Number.isFinite(selectedCourseProgress)
    ? Math.min(100, Math.max(0, selectedCourseProgress))
    : null
  const totalFee = Number(student.finalFee ?? student.courseAmount ?? student.totalAmount ?? student.afterDiscount ?? 0)
  const paidAmount = schedule.length
    ? schedule.reduce((sum, item) => sum + Number(item.paidAmount ?? item.amountPaid ?? 0), 0)
    : Number(student.paidAmount ?? student.totalPaid ?? student.amountPaid ?? 0)
  const feeProgress = totalFee > 0 ? Math.min(100, Math.max(0, (paidAmount / totalFee) * 100)) : 0
  const studentPayments = paymentHistory.filter((payment) => {
    const paymentKeys = getStudentKeys({ studentId: payment.studentId })
    return paymentKeys.some((key) => studentKeys.includes(key))
  })
  const openScheduleBatchModal = () => {
    setAssignmentError('')
    const defaultFee = selectedCourse.totalCourseAmount ?? selectedCourse.courseAmount ?? selectedCourseCatalog?.amount ?? selectedCourseCatalog?.actualFees ?? selectedCourseCatalog?.afterDiscount ?? ''
    const defaultPlan = selectedCourse.paymentPlanId || selectedCourseCatalog?.paymentPlans?.[0]?.id || ''
    setAssignmentForm({ schedule: '', mode: '', batchId: '', startDate: String(selectedCourse.courseStartDate || '').slice(0, 10), endDate: String(selectedCourse.courseEndDate || '').slice(0, 10), totalCourseAmount: String(defaultFee || ''), paymentPlanId: String(defaultPlan || '') })
    setAssignmentModalOpen(true)
  }
  const saveScheduleBatchAssignment = async (event) => {
    event.preventDefault()
    if (!selectedAssignmentBatch || !assignmentForm.startDate || !assignmentEndDate || !(selectedCourseFee > 0) || !selectedAssignmentPaymentPlan) {
      setAssignmentError('Select a schedule, mode, available batch, course fee, payment plan and course dates.')
      return
    }
    const existingInstallments = schedule.map((item, index) => ({
      installmentNumber: index + 1,
      amount: Number(item.amount ?? item.installmentAmount ?? 0),
      dueDate: String(item.dueDate || item.date || '').slice(0, 10),
      status: item.status || 'Pending',
      paymentMethod: item.paymentMethod || null,
      remarks: item.remarks || null,
      paidAt: item.paidAt || null,
    }))
    const feeParts = Array.from({ length: selectedPaymentInstallmentCount }, (_, index) => {
      const baseAmount = Math.floor(selectedCourseFinalFee / selectedPaymentInstallmentCount)
      const amount = index === selectedPaymentInstallmentCount - 1
        ? selectedCourseFinalFee - baseAmount * (selectedPaymentInstallmentCount - 1)
        : baseAmount
      const dueDate = new Date(`${assignmentForm.startDate}T00:00:00`)
      dueDate.setMonth(dueDate.getMonth() + index)
      return {
        installmentNumber: existingInstallments.length + index + 1,
        amount,
        dueDate: `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`,
        status: 'Pending',
      }
    })
    const enrollment = {
      ...selectedCourse,
      courseId: selectedCourse.courseId,
      courseName: selectedCourse.courseName,
      batchId: selectedAssignmentBatch.batchId,
      batchName: selectedAssignmentBatch.batchName,
      batchTiming: selectedAssignmentBatch.batchTiming,
      batchGroupId: selectedAssignmentBatch.batchGroupId || '',
      facultyId: selectedAssignmentBatch.facultyId,
      facultyName: selectedAssignmentBatch.facultyName,
      scheduleType: selectedAssignmentBatch.weekType,
      classSchedule: selectedAssignmentBatch.weekType === 'WEEKEND' ? 'Weekend' : 'Weekday',
      weekType: selectedAssignmentBatch.weekType,
      mode: selectedAssignmentBatch.mode,
      courseMode: selectedAssignmentBatch.mode,
      startDate: assignmentForm.startDate,
      courseStartDate: assignmentForm.startDate,
      endDate: assignmentEndDate,
      courseEndDate: assignmentEndDate,
      totalCourseAmount: selectedCourseFee,
      courseAmount: selectedCourseFee,
      discountType: selectedCourseDiscountType,
      discountValue: selectedCourseDiscountValue,
      discountAmount: Math.round((selectedCourseFee - selectedCourseFinalFee) * 100) / 100,
      finalCourseAmount: selectedCourseFinalFee,
      totalAmount: selectedCourseFinalFee,
      afterDiscount: selectedCourseFinalFee,
      paymentPlanId: selectedAssignmentPaymentPlan.id,
      paymentPlan: selectedAssignmentPaymentPlan.templateName || selectedAssignmentPaymentPlan.name || '',
      weeklyOffDay: selectedAssignmentBatch.weeklyOffDay || '',
      status: 'ACTIVE',
    }
    const nextEnrollments = courseEnrollments.map((item, index) => index === selectedCourseIndex ? enrollment : item)
    setAssignmentSaving(true)
    setAssignmentError('')
    try {
      const savedStudent = await saveBranchStudent({
        ...student,
        _recordId: student._recordId || student.recordId || student.id || student._id,
        _isExistingRecord: true,
        arrangementType: student.arrangementType || 'SEQUENTIAL',
        firstCourseId: student.firstCourseId || courseEnrollments[0]?.courseId || '',
        courseEnrollments: nextEnrollments,
        courses: nextEnrollments,
        installmentSchedule: [...existingInstallments, ...feeParts],
      })
      setStudentRecord({ studentId: resolvedStudentId, data: savedStudent })
      setAssignmentModalOpen(false)
    } catch (error) {
      setAssignmentError(error?.message || 'Unable to assign the selected schedule and batch.')
    } finally {
      setAssignmentSaving(false)
    }
  }
  const ledgerEntries = studentPayments.length
    ? studentPayments
    : schedule
      .filter((item) => Number(item.paidAmount ?? item.amountPaid ?? 0) > 0 || String(item.status || '').toLowerCase() === 'paid')
      .map((item, index) => ({
        id: item.id || `installment-${index + 1}`,
        amount: item.paidAmount ?? item.amountPaid ?? item.amount,
        date: item.paidDate || item.paymentDate || item.date,
        paymentMode: item.paymentMode || item.mode,
        installmentNumber: item.installmentNumber || item.number || index + 1,
      }))
  const initials = studentName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const status = displayValue(student.status || student.currentStatus, 'Active')

  return (
    <main className="student360-page">
      <div className="student360-page-toolbar">
        <button type="button" className="student360-back-button" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" /> {backLabel}
        </button>
        <span className="student360-breadcrumb">Students / Student 360°</span>
      </div>

      <section className="student360-profile-card">
        <div className="student360-avatar" aria-hidden="true">{initials || 'ST'}</div>
        <div className="student360-profile-main">
          <div className="student360-eyebrow">STUDENT 360° PROFILE</div>
          <div className="student360-title-row">
            <div>
              <h1>{studentName}</h1>
              <p className="student360-header-id">{displayValue(student.studentId)}</p>
              <p>{displayValue(student.studentId)} · {isMultiCourseStudent ? `Courses: ${courseEnrollments.map((enrollment) => displayValue(enrollment.courseName, 'Course')).join(', ')}` : displayValue(student.courseInterested || student.courseName, 'Course not assigned')}</p>
            </div>
            <span className="student360-status"><span />{status}</span>
          </div>
        </div>
        <div className="student360-profile-actions">
          <button type="button" className="student360-secondary-button student360-attendance-button" onClick={() => onDownloadAttendance?.(student)}><Download size={16} /> Attendance</button>
          <button type="button" className="student360-primary-button" onClick={() => onEdit?.(student)}><Edit3 size={16} /> Edit Student</button>
        </div>
      </section>

      {isMultiCourseStudent ? (
        <div className="student360-course-tabs" role="tablist" aria-label="Student courses">
          {courseEnrollments.map((enrollment, index) => {
            const enrollmentKey = getEnrollmentKey(enrollment, index)
            const isSelected = enrollmentKey === getEnrollmentKey(selectedCourse, selectedCourseIndex)
            return (
              <button
                key={enrollmentKey}
                id={`student360-course-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls="student360-selected-course-panel"
                className={`student360-course-tab${isSelected ? ' is-active' : ''}`}
                onClick={() => setCourseSelection({ studentId: resolvedStudentId, courseKey: enrollmentKey })}
              >
                <span>Course {index + 1}</span>
                <strong>{displayValue(enrollment.courseName, 'Course')}</strong>
              </button>
            )
          })}
        </div>
      ) : null}

      <section id="overview" className={`student360-summary-grid ${isMultiCourseStudent ? 'has-multi-course' : ''}`}>
        {isMultiCourseStudent ? (
          <>
            <article id="student360-selected-course-panel" role="tabpanel" aria-labelledby={`student360-course-tab-${selectedCourseIndex}`} className="student360-summary-card">
              <span className="student360-summary-icon blue"><BookOpen size={19} /></span>
              <div><span>Course</span><strong>{displayValue(selectedCourse.courseName, 'Course not assigned')}</strong><small className="student360-course-type">{displayValue(selectedCourseCatalog?.courseType || selectedCourse.courseType, 'Course type not set')}</small></div>
            </article>
            <article className="student360-summary-card"><span className="student360-summary-icon cyan"><GraduationCap size={19} /></span><div><span>Batch</span><strong>{isAwaitingSelectedCourseSchedule ? 'Pending assignment' : displayValue(selectedCourse.batchName)}</strong>{isAwaitingSelectedCourseSchedule ? <small>Schedule &amp; batch pending</small> : <><small>{[selectedCourse.classSchedule || selectedCourse.scheduleType, selectedCourse.courseMode || selectedCourse.mode].filter(Boolean).join(' · ') || 'Schedule not set'}</small><small>{displayValue(selectedCourse.batchTiming, 'Timing not set')}</small></>}</div></article>
            <article className="student360-summary-card"><span className="student360-summary-icon indigo"><UserRound size={19} /></span><div><span>Faculty</span><strong>{isAwaitingSelectedCourseSchedule ? 'Awaiting assignment' : displayValue(selectedCourse.facultyName)}</strong><small>{isAwaitingSelectedCourseSchedule ? 'Assigned with batch schedule' : 'Assigned faculty'}</small></div></article>
            <article className="student360-summary-card student360-summary-progress-card"><span className="student360-summary-icon green"><CheckCircle2 size={19} /></span><div><span>Course Progress</span><strong>{selectedCourseProgressValue === null ? 'Not recorded' : `${Math.round(selectedCourseProgressValue)}%`}</strong><div className="student360-summary-progress-track"><span style={{ width: `${selectedCourseProgressValue ?? 0}%` }} /></div><small>{selectedCourse.courseStartDate ? `Start: ${formatDate(selectedCourse.courseStartDate)}` : 'Start date not set'}</small><small>{selectedCourse.courseEndDate ? `End: ${formatDate(selectedCourse.courseEndDate)}` : 'End date not set'}</small></div></article>
          </>
        ) : (
          <>
            <article className="student360-summary-card"><span className="student360-summary-icon blue"><BookOpen size={19} /></span><div><span>Course</span><strong>{displayValue(student.courseInterested || student.courseName)}</strong><small className="student360-course-type">{displayValue(student.courseType || student.course?.courseType, 'Course type not set')}</small></div></article>
            <article className="student360-summary-card"><span className="student360-summary-icon cyan"><GraduationCap size={19} /></span><div><span>Batch</span><strong>{displayValue(student.batchName || student.batch)}</strong><small>{displayValue(student.batchTiming || student.classSchedule, 'Schedule not set')}</small></div></article>
            <article className="student360-summary-card"><span className="student360-summary-icon indigo"><UserRound size={19} /></span><div><span>Faculty</span><strong>{displayValue(student.facultyName)}</strong><small>Assigned faculty</small></div></article>
            <article className="student360-summary-card student360-summary-progress-card"><span className="student360-summary-icon green"><CheckCircle2 size={19} /></span><div><span>Course Progress</span><strong>{Math.round(courseProgress)}%</strong><div className="student360-summary-progress-track"><span style={{ width: `${courseProgress}%` }} /></div><small>{student.courseEndDate ? `End date: ${formatDate(student.courseEndDate)}` : 'End date not set'}</small></div></article>
          </>
        )}
        <article className={`student360-summary-card student360-summary-academic-progress-card${isSelectedCoursePending ? ' is-upcoming-course' : ''}`}><span className="student360-summary-icon violet"><GraduationCap size={19} /></span><div><span>Academic Test Progress</span>{academicTestProgress ? <><strong>{academicTestProgress.completedTests} / {academicTestProgress.totalTests} Completed</strong><div className="student360-summary-progress-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(academicTestProgress.percentage) || 0))}%` }} /></div><small>{academicTestProgress.totalTests ? `${academicTestProgress.pendingTests} Pending · ${academicTestProgress.percentage}%` : 'No Academic Tests · 0%'}</small></> : <><strong className="student360-summary-loading">{academicTestProgressError ? 'Unavailable' : 'Loading...'}</strong><small>{academicTestProgressError || 'Academic test progress'}</small></>}</div>{isSelectedCoursePending ? priorCoursesCompleted ? <button type="button" className="student360-upcoming-badge student360-schedule-batch-trigger" onClick={openScheduleBatchModal}>Schedule &amp; Batch</button> : <span className="student360-upcoming-badge">Upcoming</span> : null}</article>
      </section>

      <div className="student360-content-grid">
        <div className="student360-main-column">
          <AttendanceSection
            studentId={resolvedStudentId || student.studentId}
            student={student}
            enrollment={selectedCourse}
            isMultiCourseStudent={isMultiCourseStudent}
            branchId={branch?.id || branch?.branchId || ''}
          />
          <PerformanceSection studentId={resolvedStudentId || student.studentId} branchId={performanceBranchId || student?.branchId || ''} />
          <AttendanceCalendarSection
            student={student}
            studentId={resolvedStudentId || student.studentId}
            enrollment={selectedCourse}
            isMultiCourseStudent={isMultiCourseStudent}
            branchId={branch?.id || branch?.branchId || ''}
            onViewCalendar={onViewCalendar}
          />
        </div>

        <aside className="student360-side-column">
          <SectionCard title="Personal Information" description="Contact and identity details recorded for this student." className="student360-anchor-card" id="personal">
            <div className="student360-detail-grid">
              <DetailItem label="Parent Name" value={student.parentName} icon={UserRound} />
              <DetailItem label="Email Address" value={student.emailAddress} icon={Mail} className="student360-email-item" />
              <DetailItem label="Mobile Number" value={student.mobileNumber} icon={Phone} />
              <DetailItem label="Parent / Spouse Number" value={student.parentSpouseNumber} icon={Phone} />
              <DetailItem label="Address" value={student.location || [student.city, student.state].filter(Boolean).join(', ')} icon={MapPin} />
              <DetailItem label="Country" value={student.country} icon={MapPin} />
            </div>
          </SectionCard>

          <SectionCard title="Education & Enrollment" description="Academic background and current learning assignment." className="student360-anchor-card" id="enrollment">
            <div className="student360-detail-grid">
              <DetailItem label="Qualification" value={student.qualification} icon={GraduationCap} />
              <DetailItem label="Passed Out Year" value={student.passedOutYear} icon={GraduationCap} />
              {String(student.designation || '').trim() ? <DetailItem label="Designation" value={student.designation} /> : null}
              {isMultiCourseStudent ? (() => {
                const courseNumber = selectedCourseIndex + 1
                const courseLabel = selectedCourse.courseName || `Course ${courseNumber}`
                return <>
                  <DetailItem label={`Course ${courseNumber}`} value={courseLabel} icon={BookOpen} />
                  <DetailItem label={`${courseLabel} · Start Date`} value={formatDate(selectedCourse.courseStartDate)} icon={CalendarDays} />
                  <DetailItem label={`${courseLabel} · End Date`} value={formatDate(selectedCourse.courseEndDate)} icon={CalendarDays} />
                  <DetailItem label={`${courseLabel} · Schedule / Mode`} value={[selectedCourse.classSchedule, selectedCourse.courseMode].filter(Boolean).join(' · ')} />
                  <DetailItem label={`${courseLabel} · Batch`} value={`${displayValue(selectedCourse.batchName)}${selectedCourse.batchTiming ? ` · ${selectedCourse.batchTiming}` : ''}`} />
                  <DetailItem label={`${courseLabel} · Faculty`} value={selectedCourse.facultyName} />
                </>
              })() : (
                <>
                  <DetailItem label="Course Start Date" value={formatDate(student.courseStartDate)} icon={CalendarDays} />
                  <DetailItem label="Course End Date" value={formatDate(student.courseEndDate)} icon={CalendarDays} />
                  <DetailItem label="Class Schedule" value={student.classSchedule || student.courseSchedule} />
                  <DetailItem label="Course Mode" value={student.courseMode} />
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Fee & Payment Overview" description="Existing payment information for this student." className="student360-anchor-card">
            <div className="student360-fee-total"><span>Total Fee</span><strong>{formatCurrency(totalFee)}</strong></div>
            <div className="student360-fee-stats"><div><span>Paid</span><strong>{formatCurrency(paidAmount)}</strong></div><div><span>Balance</span><strong>{formatCurrency(Math.max(totalFee - paidAmount, 0))}</strong></div></div>
            <div className="student360-progress-label"><span>Fee Progress</span><strong>{Math.round(feeProgress)}%</strong></div>
            <div className="student360-progress-track"><span style={{ width: `${feeProgress}%` }} /></div>
            <div className="student360-fee-status"><Wallet size={15} /> {displayValue(student.paymentMode, 'Installment')} · {totalFee > 0 && paidAmount >= totalFee ? 'Completed' : 'Pending'}</div>
          </SectionCard>

          <SectionCard title="Installment Schedule" description="Due dates and current status." className="student360-anchor-card">
            {schedule.length ? <div className="student360-installment-list">{schedule.map((item, index) => <div className="student360-installment-row" key={`${item.id || item.number || index}`}><div><strong>Installment {item.installmentNumber || item.number || index + 1}</strong><span>{formatDate(item.dueDate || item.date)}</span></div><strong>{formatCurrency(item.amount ?? item.installmentAmount)}</strong><span className={`student360-payment-status ${String(item.status || 'Pending').toLowerCase()}`}>{item.status || 'Pending'}</span></div>)}</div> : <div className="student360-no-data">No installment schedule found.</div>}
          </SectionCard>

          <SectionCard title="Fee Ledger & Invoices" description="Recorded payments and downloadable receipts." className="student360-fee-ledger-card" id="payments">
            <div className="student360-ledger-heading"><div><span>Total: {formatCurrency(totalFee)} ({feeProgress >= 100 ? '100% Cleared' : `${Math.round(feeProgress)}% Cleared`})</span><strong>{feeProgress >= 100 ? 'Paid in Full' : 'Payment in Progress'}</strong></div><span className={`student360-ledger-pill ${feeProgress >= 100 ? 'is-paid' : ''}`}>{feeProgress >= 100 ? 'Paid in Full' : 'Pending'}</span></div>
            {ledgerEntries.length ? <div className="student360-payment-list">{ledgerEntries.slice(0, 6).map((payment, index) => <div className="student360-payment-row student360-ledger-row" key={payment.id || `${payment.date}-${payment.amount}`}><div className="student360-ledger-number">{payment.installmentNumber || index + 1}</div><div><strong>{formatDate(getPaymentDateValue(payment))}</strong><span>{displayValue(payment.paymentMode || payment.mode, 'Payment')}</span></div><strong>{formatCurrency(payment.amount)} <b className="student360-payment-check">✓</b></strong><button type="button" className="student360-receipt-icon" title="Download receipt" aria-label="Download receipt" onClick={() => onDownloadPaymentReceipt?.(payment, student)}><Download size={15} /></button></div>)}</div> : <div className="student360-no-data">No payment history found.</div>}
            {ledgerEntries.length ? <button type="button" className="student360-invoice-button" onClick={() => onDownloadPaymentReceipt?.(ledgerEntries[0], student)}><FileText size={16} /> Download Tax Invoice Receipts</button> : null}
          </SectionCard>
        </aside>
      </div>
      {assignmentModalOpen ? createPortal((
        <div className="student360-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !assignmentSaving) setAssignmentModalOpen(false) }}>
          <section className="student360-assignment-modal" role="dialog" aria-modal="true" aria-labelledby="student360-assignment-title">
            <div className="student360-assignment-heading"><div><span>SEQUENTIAL COURSE</span><h2 id="student360-assignment-title">Schedule &amp; Batch Assignment</h2><p>Assign this course using an existing active batch.</p></div><button type="button" aria-label="Close" onClick={() => setAssignmentModalOpen(false)} disabled={assignmentSaving}>×</button></div>
            <form onSubmit={saveScheduleBatchAssignment}>
              <div className="student360-assignment-fields">
                <label>Course Name<input value={selectedCourse.courseName || ''} readOnly /></label>
                <label>Course Schedule<select required value={assignmentForm.schedule} onChange={(event) => setAssignmentForm((form) => ({ ...form, schedule: event.target.value, mode: '', batchId: '' }))}><option value="">Select schedule</option>{availableSchedules.map((scheduleName) => <option key={scheduleName} value={scheduleName}>{scheduleName === 'WEEKEND' ? 'Weekend' : 'Weekday'}</option>)}</select></label>
                <label>Course Mode<select required value={assignmentForm.mode} onChange={(event) => setAssignmentForm((form) => ({ ...form, mode: event.target.value, batchId: '' }))} disabled={!assignmentForm.schedule}><option value="">Select mode</option>{availableModes.map((mode) => <option key={mode} value={mode}>{mode.charAt(0) + mode.slice(1).toLowerCase()}</option>)}</select></label>
                <label>Select Batch<select required value={assignmentForm.batchId} onChange={(event) => { const batch = selectableAssignmentBatches.find((item) => item.batchId === event.target.value); const startDate = String(batch?.courseStartDate || assignmentForm.startDate || '').slice(0, 10); setAssignmentForm((form) => ({ ...form, batchId: event.target.value, startDate, endDate: String(batch?.courseEndDate || resolveCourseEndDate?.(startDate, batch, selectedCourseCatalog) || form.endDate || '').slice(0, 10) })) }} disabled={!assignmentForm.mode || !selectableAssignmentBatches.length}><option value="">{assignmentForm.mode ? 'Select available batch' : 'Select schedule and mode first'}</option>{selectableAssignmentBatches.map((batch) => <option key={batch.batchId} value={batch.batchId}>{batch.batchName} · {batch.batchTiming || 'Timing unavailable'}</option>)}</select></label>
                <label>Batch Timing<input value={selectedAssignmentBatch?.batchTiming || ''} readOnly placeholder="Auto-filled from selected batch" /></label>
                <label>Faculty<input value={selectedAssignmentBatch?.facultyName || ''} readOnly placeholder="Auto-filled from selected batch" /></label>
                <label>Total Course Amount<input type="number" min="1" required value={assignmentForm.totalCourseAmount} onChange={(event) => setAssignmentForm((form) => ({ ...form, totalCourseAmount: event.target.value }))} /></label>
                <label>Discount Type<input value={selectedCourseDiscountType === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount'} readOnly /></label>
                <label>Discount Value ({selectedCourseDiscountType === 'PERCENTAGE' ? '%' : '₹'})<input value={selectedCourseDiscountValue} readOnly /></label>
                <label>Discount Amount<input value={formatCurrency(selectedCourseDiscountAmount)} readOnly /></label>
                <label>Final Course Amount<input value={formatCurrency(selectedCourseFinalFee)} readOnly /></label>
                <label>Payment Plan<select required value={assignmentForm.paymentPlanId} onChange={(event) => setAssignmentForm((form) => ({ ...form, paymentPlanId: event.target.value }))}><option value="">Select payment plan</option>{selectedCoursePaymentPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.templateName || plan.name || 'Payment plan'}</option>)}</select></label>
                <label>Start Date<input type="date" required value={assignmentForm.startDate} onChange={(event) => { const startDate = event.target.value; setAssignmentForm((form) => ({ ...form, startDate, endDate: String(resolveCourseEndDate?.(startDate, selectedAssignmentBatch, selectedCourseCatalog) || selectedAssignmentBatch?.courseEndDate || form.endDate || '').slice(0, 10) })) }} /></label>
                <label>End Date<input type="date" required value={String(assignmentEndDate || '').slice(0, 10)} onChange={(event) => setAssignmentForm((form) => ({ ...form, endDate: event.target.value }))} /></label>
              </div>
              {assignmentError ? <p className="student360-assignment-error" role="alert">{assignmentError}</p> : null}
              {!selectedCourseRealBatches.length ? <p className="student360-assignment-hint">No active course batches with timing and faculty assignment are available.</p> : null}
              <div className="student360-assignment-actions"><button type="button" className="student360-secondary-button" onClick={() => setAssignmentModalOpen(false)} disabled={assignmentSaving}>Cancel</button><button type="submit" className="student360-primary-button" disabled={assignmentSaving || !selectedAssignmentBatch || !selectedCoursePaymentPlans.length}>{assignmentSaving ? 'Saving…' : 'Save Assignment'}</button></div>
            </form>
          </section>
        </div>
      ), document.body) : null}
    </main>
  )
}
