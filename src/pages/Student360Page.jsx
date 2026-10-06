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
import { useCallback, useEffect, useState } from 'react'
import { getBranchStudent, getStudentAttendanceSummary } from '../services/studentService'
import { getBranchStudentSyllabusReports } from '../services/examService'
import { getBranchStudentAcademicReports } from '../services/academicTestService'
import { buildFacultyTodayWorkProgressSummary } from '../lib/facultyProgress'

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

function getAttendanceEntries(student = {}) {
  const entries = []
  const sources = [student.attendanceCalendar, student.attendanceRecords, student.records, student.attendanceHistory]
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

function AttendanceSection({ studentId, student }) {
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
        const result = await getStudentAttendanceSummary(studentId)
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
  }, [studentId])

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
    <SectionCard title="Attendance" description="Attendance calculated from the active enrollment, course schedule, and daily records.">
      {loading ? <div className="student360-no-data">Loading attendance...</div> : error ? <div className="student360-no-data student360-attendance-error">{error}</div> : (
        <>
          <div className="student360-attendance-course-meta">{course.startDate || student?.courseStartDate ? `${formatAttendanceDate(course.startDate || student.courseStartDate)} → ${formatAttendanceDate(course.endDate || student.courseEndDate)}` : 'Course dates unavailable'}<span>{course.schedule || course.scheduleType || student?.classSchedule || 'Schedule unavailable'}</span></div>
          <div className="student360-attendance-summary-cards">
            {cardData.map(([label, period]) => { const available = hasPeriodData(period); return <article className="student360-attendance-summary-card" key={label}><span>{label}</span><strong>{available ? formatAttendancePercentage(getPeriodPercentage(period)) : '—'}</strong><small>{available ? `${getPeriodValue(period, 'present')} / ${getPeriodValue(period, 'eligible', getPeriodValue(period, 'total'))} Classes` : 'No data'}</small></article> })}
          </div>
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

function PerformanceSection({ studentId }) {
  const [data, setData] = useState({ skills: [], academic: [] })
  const [loading, setLoading] = useState(Boolean(studentId))
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError('')
    const [syllabusResult, academicResult] = await Promise.allSettled([
      getBranchStudentSyllabusReports(studentId),
      getBranchStudentAcademicReports(studentId),
    ])
    const syllabus = syllabusResult.status === 'fulfilled' ? (syllabusResult.value?.data || syllabusResult.value || {}) : null
    const academic = academicResult.status === 'fulfilled' ? (academicResult.value?.data || academicResult.value || {}) : null
    if (!syllabus && !academic) setError('Unable to load performance data.')
    setData({ skills: syllabus?.skills || [], academic: academic?.evaluations || [] })
    setLoading(false)
  }, [studentId])

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

function DetailItem({ label, value, icon: Icon }) {
  return (
    <div className="student360-detail-item">
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
  paymentHistory = [],
  onBack,
  backLabel = 'Back to Students',
  onEdit,
  onViewCalendar,
  onDownloadAttendance,
  onDownloadPaymentReceipt,
}) {
  const [studentRecord, setStudentRecord] = useState(null)
  const [academicProgressState, setAcademicProgressState] = useState({ studentId: '', data: null, error: '' })

  useEffect(() => {
    let active = true
    if (!studentId) return undefined
    getBranchStudent(studentId)
      .then((result) => {
        if (active) {
          setStudentRecord({ studentId, data: result })
          setAcademicProgressState({ studentId, data: result?.academicTestProgress || { totalTests: 0, completedTests: 0, pendingTests: 0, percentage: 0 }, error: '' })
        }
      })
      .catch((error) => {
        if (active) setAcademicProgressState({ studentId, data: null, error: error?.message || 'Unable to load academic test progress.' })
      })
    return () => { active = false }
  }, [studentId])

  const student = studentRecord?.studentId === studentId ? studentRecord.data : initialStudent
  const academicTestProgress = academicProgressState.studentId === studentId ? academicProgressState.data : null
  const academicTestProgressError = academicProgressState.studentId === studentId ? academicProgressState.error : ''

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
  const attendanceEntries = getAttendanceEntries(student)
  const attendanceCells = getCurrentMonthAttendanceCells(attendanceEntries, student)
  const courseProgress = getCourseProgress(student)
  const courseEnrollments = getStudentCourseEnrollments(student, branchCourseCards)
  const isMultiCourseStudent = courseEnrollments.length > 1
  const totalFee = Number(student.finalFee ?? student.courseAmount ?? student.totalAmount ?? student.afterDiscount ?? 0)
  const paidAmount = schedule.length
    ? schedule.reduce((sum, item) => sum + Number(item.paidAmount ?? item.amountPaid ?? 0), 0)
    : Number(student.paidAmount ?? student.totalPaid ?? student.amountPaid ?? 0)
  const feeProgress = totalFee > 0 ? Math.min(100, Math.max(0, (paidAmount / totalFee) * 100)) : 0
  const studentPayments = paymentHistory.filter((payment) => {
    const paymentKeys = getStudentKeys({ studentId: payment.studentId })
    return paymentKeys.some((key) => studentKeys.includes(key))
  })
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
  const attendanceSummary = attendanceEntries.reduce((summary, entry) => {
    if (Object.prototype.hasOwnProperty.call(summary, entry.status)) summary[entry.status] += 1
    return summary
  }, { present: 0, absent: 0, leave: 0, unmarked: 0 })
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

      <section id="overview" className={`student360-summary-grid ${isMultiCourseStudent ? 'has-multi-course' : ''}`}>
        {isMultiCourseStudent ? courseEnrollments.map((enrollment, index) => {
          const hasSavedProgress = enrollment.courseProgress !== null && enrollment.courseProgress !== undefined && String(enrollment.courseProgress).trim() !== ''
          const catalogCourse = branchCourseCards.find((course) => (
            String(course?.id || course?.courseId || '').trim() === String(enrollment.courseId || '').trim() ||
            String(course?.name || '').trim().toLowerCase() === String(enrollment.courseName || '').trim().toLowerCase()
          ))
          const workProgress = !hasSavedProgress && catalogCourse
            ? buildFacultyTodayWorkProgressSummary(facultyTodayWorkEntries, catalogCourse, {
              ...student,
              courseId: enrollment.courseId,
              courseName: enrollment.courseName,
            })?.courseProgress
            : null
          const enrollmentProgress = Number(hasSavedProgress ? enrollment.courseProgress : workProgress)
          const hasEnrollmentProgress = (hasSavedProgress || workProgress !== null) && Number.isFinite(enrollmentProgress)
          const safeEnrollmentProgress = hasEnrollmentProgress ? Math.min(100, Math.max(0, enrollmentProgress)) : 0
          return (
            <article className="student360-summary-card student360-course-enrollment-card" key={enrollment.courseId || `${enrollment.courseName}-${index}`}>
              <span className="student360-summary-icon blue"><BookOpen size={19} /></span>
              <div className="student360-course-enrollment-copy">
                <span>Course {index + 1}{enrollment.status ? ` · ${displayValue(enrollment.status)}` : ''}</span>
                <strong>{displayValue(enrollment.courseName, 'Course not assigned')}</strong>
                <div className="student360-course-enrollment-facts">
                  <div><span>Batch</span><strong>{displayValue(enrollment.batchName)}</strong></div>
                  <div><span>Timing</span><strong>{displayValue(enrollment.batchTiming)}</strong></div>
                  <div><span>Faculty</span><strong>{displayValue(enrollment.facultyName)}</strong></div>
                  <div><span>Mode / Schedule</span><strong>{displayValue([enrollment.courseMode, enrollment.classSchedule].filter(Boolean).join(' · '))}</strong></div>
                  <div><span>Duration</span><strong>{displayValue(enrollment.courseDuration)}</strong></div>
                  <div><span>Course Fee</span><strong>{formatCurrency(enrollment.courseAmount)}</strong></div>
                  <div><span>Payment Plan</span><strong>{displayValue(enrollment.paymentPlan)}</strong></div>
                  <div><span>Course Dates</span><strong>{enrollment.courseStartDate || enrollment.courseEndDate ? `${formatDate(enrollment.courseStartDate)} – ${formatDate(enrollment.courseEndDate)}` : '-'}</strong></div>
                </div>
                <div className="student360-course-enrollment-progress">
                  <span>Course Progress</span>
                  <strong>{hasEnrollmentProgress ? `${Math.round(safeEnrollmentProgress)}%` : 'Not recorded'}</strong>
                  <div className="student360-summary-progress-track"><span style={{ width: `${safeEnrollmentProgress}%` }} /></div>
                </div>
              </div>
            </article>
          )
        }) : (
          <>
            <article className="student360-summary-card"><span className="student360-summary-icon blue"><BookOpen size={19} /></span><div><span>Course</span><strong>{displayValue(student.courseInterested || student.courseName)}</strong><small className="student360-course-type">{displayValue(student.courseType || student.course?.courseType, 'Course type not set')}</small></div></article>
            <article className="student360-summary-card"><span className="student360-summary-icon cyan"><GraduationCap size={19} /></span><div><span>Batch</span><strong>{displayValue(student.batchName || student.batch)}</strong><small>{displayValue(student.batchTiming || student.classSchedule, 'Schedule not set')}</small></div></article>
            <article className="student360-summary-card"><span className="student360-summary-icon indigo"><UserRound size={19} /></span><div><span>Faculty</span><strong>{displayValue(student.facultyName)}</strong><small>Assigned faculty</small></div></article>
            <article className="student360-summary-card student360-summary-progress-card"><span className="student360-summary-icon green"><CheckCircle2 size={19} /></span><div><span>Course Progress</span><strong>{Math.round(courseProgress)}%</strong><div className="student360-summary-progress-track"><span style={{ width: `${courseProgress}%` }} /></div><small>{student.courseEndDate ? `End date: ${formatDate(student.courseEndDate)}` : 'End date not set'}</small></div></article>
          </>
        )}
        <article className="student360-summary-card student360-summary-academic-progress-card"><span className="student360-summary-icon violet"><GraduationCap size={19} /></span><div><span>Academic Test Progress</span>{academicTestProgress ? <><strong>{academicTestProgress.completedTests} / {academicTestProgress.totalTests} Completed</strong><div className="student360-summary-progress-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(academicTestProgress.percentage) || 0))}%` }} /></div><small>{academicTestProgress.totalTests ? `${academicTestProgress.pendingTests} Pending · ${academicTestProgress.percentage}%` : 'No Academic Tests · 0%'}</small></> : <><strong className="student360-summary-loading">{academicTestProgressError ? 'Unavailable' : 'Loading...'}</strong><small>{academicTestProgressError || 'Academic test progress'}</small></>}</div></article>
      </section>

      <div className="student360-content-grid">
        <div className="student360-main-column">
          <AttendanceSection studentId={studentId || student.studentId} student={student} />
          <PerformanceSection studentId={studentId || student.studentId} />
          {/* Keep the existing monthly calendar available through the dedicated Calendar action. */}
          <SectionCard title="Attendance Calendar" className="student360-anchor-card" actions={<button type="button" className="student360-secondary-button" onClick={() => onViewCalendar?.(student)}><CalendarDays size={15} /> Calendar</button>}>
            <div className="student360-attendance-legend">
              <span className="present"><i />Present ({attendanceSummary.present})</span>
              <span className="absent"><i />Absent ({attendanceSummary.absent})</span>
              <span className="excused"><i />Leave ({attendanceSummary.leave})</span>
              <span className="unmarked"><i />Unmarked ({attendanceSummary.unmarked})</span>
              <span className="not-applicable"><i />Disabled / Not Applicable</span>
            </div>
            <div className="student360-attendance-grid">{attendanceCells.map((entry) => <div className={`student360-attendance-cell ${entry.status}`} key={entry.date} title={`${entry.date} · ${entry.status}`}><strong>{entry.day}</strong><small>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}</small></div>)}</div>
          </SectionCard>
        </div>

        <aside className="student360-side-column">
          <SectionCard title="Personal Information" description="Contact and identity details recorded for this student." className="student360-anchor-card" id="personal">
            <div className="student360-detail-grid">
              <DetailItem label="Parent Name" value={student.parentName} icon={UserRound} />
              <DetailItem label="Email Address" value={student.emailAddress} icon={Mail} />
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
              {isMultiCourseStudent ? courseEnrollments.flatMap((enrollment, index) => ([
                <DetailItem key={`${enrollment.courseId}-name`} label={`Course ${index + 1}`} value={enrollment.courseName} icon={BookOpen} />,
                <DetailItem key={`${enrollment.courseId}-start`} label={`${enrollment.courseName || `Course ${index + 1}`} · Start Date`} value={formatDate(enrollment.courseStartDate)} icon={CalendarDays} />,
                <DetailItem key={`${enrollment.courseId}-end`} label={`${enrollment.courseName || `Course ${index + 1}`} · End Date`} value={formatDate(enrollment.courseEndDate)} icon={CalendarDays} />,
                <DetailItem key={`${enrollment.courseId}-schedule`} label={`${enrollment.courseName || `Course ${index + 1}`} · Schedule / Mode`} value={[enrollment.classSchedule, enrollment.courseMode].filter(Boolean).join(' · ')} />,
                <DetailItem key={`${enrollment.courseId}-batch`} label={`${enrollment.courseName || `Course ${index + 1}`} · Batch`} value={`${displayValue(enrollment.batchName)}${enrollment.batchTiming ? ` · ${enrollment.batchTiming}` : ''}`} />,
                <DetailItem key={`${enrollment.courseId}-faculty`} label={`${enrollment.courseName || `Course ${index + 1}`} · Faculty`} value={enrollment.facultyName} />,
              ])) : (
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
    </main>
  )
}
