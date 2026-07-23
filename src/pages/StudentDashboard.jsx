import { BookOpen, CalendarDays, ChevronDown, GraduationCap, TrendingUp, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { NotificationBell } from '../components/NotificationBell'
import {
  formatCurrency,
  formatDate,
  getPaidAmount,
  getSecondDueDate,
  getStudentInitials,
  getStudentStatus,
  getThirdDueDate,
  hasThirdInstallment,
  useCurrentStudentProfile,
  StudentSectionCard,
  StudentInfoItem,
} from './studentDashboardUtils.jsx'

const attendanceValuePattern = [92, 96, 88, 93, 90, 94, 91, 95, 89, 92, 94, 90]

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

function getAttendanceSeed(student) {
  const seedSource = `${student?.studentName || ''}-${student?.admissionDate || ''}-${student?.courseInterested || ''}`
  return Array.from(seedSource).reduce((sum, character) => sum + character.charCodeAt(0), 0)
}

function buildStudentAttendanceData(student) {
  const durationMonths = getCourseDurationMonths(student)
  const admissionDate = parseDateValue(student?.admissionDate || student?.firstInstallmentDate || student?.createdAt) || new Date()
  const seed = getAttendanceSeed(student)
  const patternOffset = seed % attendanceValuePattern.length

  const series = Array.from({ length: durationMonths }, (_, index) => {
    const monthDate = addMonths(admissionDate, index)
    const value = attendanceValuePattern[(patternOffset + index) % attendanceValuePattern.length]

    return {
      month: formatMonthYear(monthDate),
      value,
    }
  })

  const rangeStart = formatMonthYear(admissionDate)
  const rangeEnd = formatMonthYear(addMonths(admissionDate, Math.max(durationMonths - 1, 0)))

  return {
    durationMonths,
    rangeLabel: rangeStart === rangeEnd ? rangeStart : `${rangeStart} - ${rangeEnd}`,
    series,
  }
}

function getStartOfWeek(date) {
  const start = new Date(date)
  const day = start.getDay()
  const delta = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + delta)
  start.setHours(0, 0, 0, 0)
  return start
}

function buildWeeklyAttendanceOverview(student) {
  const today = new Date()
  const seed = getAttendanceSeed(student)
  const startOfWeek = getStartOfWeek(today)
  const dailyPattern = [true, true, false, true, true, false, true]
  const offset = seed % dailyPattern.length
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + index)
    const present = dailyPattern[(offset + index) % dailyPattern.length]

    return {
      date,
      present,
      isToday: date.toDateString() === today.toDateString(),
    }
  })

  const presentCount = days.filter((day) => day.present).length
  const absentCount = days.length - presentCount
  const weeklyPercentage = Math.round((presentCount / days.length) * 100)
  const todayEntry = days.find((day) => day.isToday) || days[days.length - 1]
  const todayStatus = todayEntry?.present ? 'Present' : 'Absent'
  const formatDayMonth = (date) =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
    }).format(date)

  return {
    todayStatus,
    todayDateLabel: formatVerboseDate(todayEntry?.date || today),
    weekRangeLabel: `${formatDayMonth(days[0].date)} - ${formatDayMonth(days[6].date)}`,
    presentCount,
    absentCount,
    weeklyPercentage,
    days,
  }
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

function formatStudentHeaderDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function StudentDashboardHeader({ studentName }) {
  const greetingName = getStudentGreetingName(studentName)
  const greetingLabel = getStudentGreetingLabel()
  const todayLabel = formatStudentHeaderDate()

  return (
    <header className="student-dashboard-header">
      <div className="student-dashboard-header-copy">
        <p className="student-dashboard-header-title">
          {greetingLabel}
          {greetingName ? `, ${greetingName}! 👋` : '!'}
        </p>
        <p className="student-dashboard-header-subtitle">Welcome back to your student dashboard.</p>
      </div>

      <div className="student-dashboard-header-actions">
        <NotificationBell />
        <div className="student-dashboard-date-pill" aria-label={todayLabel}>
          <CalendarDays size={18} strokeWidth={2.15} aria-hidden="true" focusable="false" />
          <div>
            <strong>{todayLabel}</strong>
            <span>TODAY</span>
          </div>
        </div>
        <div className="student-dashboard-profile-avatar" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
            <circle cx="32" cy="32" r="30" fill="#d9e8ef" />
            <path
              d="M20 27c0-8 5.8-15 12.6-15 7.2 0 13.4 6.8 13.4 15.3 0 4.6-1.4 8.4-3.7 11.4-1.5-2.7-4.1-4.6-7.3-4.6h-3c-3.2 0-5.8 1.9-7.3 4.6C21.4 35.8 20 32 20 27Z"
              fill="#7a431e"
            />
            <path
              d="M18 43c0-6.4 5.2-11.6 11.6-11.6h4.8C40.8 31.4 46 36.6 46 43v9H18z"
              fill="#f4b58b"
            />
            <path d="M18 43c0-4.7 2.4-8.8 6-11.2v20.4H18z" fill="#2f3138" />
            <path d="M46 43c0-4.7-2.4-8.8-6-11.2v20.4H46z" fill="#2f3138" />
            <path
              d="M24 23c1.6-4.8 5.8-8 10.2-8 3.8 0 7.3 2 9.5 5.2 1.7 2.4 2.2 5.4 1.6 8.4-.5 2.2-1.9 4.8-3.2 6.3-1.1-4.8-3.8-8-8-8h-4c-3.3 0-5.7 1.7-6.1 4.7-1.2-2-1.1-5.1 0-8.6Z"
              fill="#8a4f24"
            />
            <path d="M26 28c2.4-4.9 6.2-7.5 11.8-7.5 3.5 0 6.1 1 8 2.8" fill="none" stroke="#f4b58b" strokeWidth="2" strokeLinecap="round" />
            <path d="M25 34c2.4 3.8 5.4 5.6 7 5.6s4.6-1.8 7-5.6" fill="none" stroke="#f0a97c" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>
      </div>
    </header>
  )
}

function StudentSummaryCard({ icon: Icon, label, value, note, tone = 'blue', badge }) {
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
      {badge ? <span className="student-summary-card-badge">{badge}</span> : null}
    </article>
  )
}

function StudentMonthlyAttendanceChart({ student }) {
  const attendance = useMemo(() => buildStudentAttendanceData(student), [student])
  const weekly = useMemo(() => buildWeeklyAttendanceOverview(student), [student])

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
                <div key={item.month} className="student-attendance-group">
                  <strong className="student-attendance-value">{item.value}%</strong>
                  <div className="student-attendance-bar-wrap">
                    <div className="student-attendance-bar" style={{ height: `${item.value}%` }} />
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
          <div className={`student-attendance-today-status ${weekly.todayStatus === 'Present' ? 'is-present' : 'is-absent'}`}>
            <div className="student-attendance-today-icon" aria-hidden="true">
              {weekly.todayStatus === 'Present' ? 'P' : 'A'}
            </div>
            <div className="student-attendance-today-copy">
              <strong>{weekly.todayStatus}</strong>
              <span>{weekly.todayStatus === 'Present' ? 'You are marked present today' : 'You are marked absent today'}</span>
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

function StudentDashboardContent({ dashboard }) {
  const { student: latestStudent, isLoading } = useCurrentStudentProfile()

  if (isLoading) {
    return (
      <section className="student-dashboard-page">
        <StudentDashboardHeader studentName={null} />
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
        <StudentDashboardHeader studentName={null} />
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

  const status = getStudentStatus(latestStudent)
  const totalAmount = Number(latestStudent.totalAmount || latestStudent.afterDiscount || 0)
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
      badge: 'View',
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
      <StudentDashboardHeader studentName={latestStudent.studentName} />

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
          />
        ))}
      </div>

      <StudentMonthlyAttendanceChart student={latestStudent} />

      <article className="student-dashboard-hero">
        <div className="student-dashboard-hero-top">
          <div className="student-dashboard-avatar">{getStudentInitials(latestStudent.studentName)}</div>
          <div className="student-dashboard-hero-main">
            <div className="student-dashboard-name-row">
              <h2>{latestStudent.studentName}</h2>
              <span className={`student-status-pill ${status.tone}`}>{status.label}</span>
            </div>
            <div className="student-dashboard-id-row">
              <div>
                <span>Course</span>
                <strong>{latestStudent.courseInterested || '-'}</strong>
              </div>
              <div>
                <span>Batch</span>
                <strong>{latestStudent.batch || '-'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="student-dashboard-hero-side">
          <div>
            <span>Email</span>
            <strong className="student-inline-email">{latestStudent.emailAddress || '-'}</strong>
          </div>
          <div>
            <span>Mobile</span>
            <strong>{latestStudent.mobileNumber || '-'}</strong>
          </div>
          <div>
            <span>Admission Date</span>
            <strong>{formatDate(latestStudent.admissionDate)}</strong>
          </div>
          <div className="student-dashboard-hero-actions">
            <span>Need help signing in?</span>
            <Link to="/forgot-password" className="text-link">
              Forgot password?
            </Link>
            <small>We will send a reset link to your registered email address.</small>
          </div>
        </div>
      </article>

      <div className="student-dashboard-grid">
        <StudentSectionCard title="Basic Information" subtitle="Primary contact and location details">
          <div className="student-dashboard-info-grid">
            <StudentInfoItem label="Student Name" value={latestStudent.studentName} />
            <StudentInfoItem label="Mobile Number" value={latestStudent.mobileNumber} />
            <StudentInfoItem label="Email Address" value={latestStudent.emailAddress} valueClassName="student-inline-email" />
            <StudentInfoItem label="Parent / Spouse Number" value={latestStudent.parentSpouseNumber} />
            <StudentInfoItem label="Location" value={latestStudent.location} fullWidth />
          </div>
        </StudentSectionCard>

        <StudentSectionCard title="Education Details" subtitle="Course and academic background">
          <div className="student-dashboard-info-grid">
            <StudentInfoItem label="Course Interested" value={latestStudent.courseInterested} />
            <StudentInfoItem label="Faculty Name" value={latestStudent.facultyName} />
            <StudentInfoItem label="Batch" value={latestStudent.batch} />
            <StudentInfoItem label="Qualification" value={latestStudent.qualification} />
            <StudentInfoItem label="Passed Out Year" value={latestStudent.passedOutYear} />
            <StudentInfoItem label="Current Status" value={latestStudent.currentStatus} />
            <StudentInfoItem label="Designation" value={latestStudent.designation || '-'} />
            <StudentInfoItem label="Source" value={latestStudent.source || '-'} />
          </div>
        </StudentSectionCard>

        <StudentSectionCard title="Admission Details" subtitle="Fee setup and enrollment tracking">
          <div className="student-dashboard-info-grid">
            <StudentInfoItem label="Admission Date" value={formatDate(latestStudent.admissionDate)} />
            <StudentInfoItem label="Total Course Fee" value={formatCurrency(latestStudent.totalAmount || latestStudent.afterDiscount)} />
            <StudentInfoItem label="Discount" value={formatCurrency(latestStudent.discount)} />
            <StudentInfoItem label="Final Fee" value={formatCurrency(latestStudent.afterDiscount)} />
            <StudentInfoItem label="Counselor Name" value={latestStudent.counselorName || '-'} />
            <StudentInfoItem label="Remarks" value={latestStudent.remarks || '-'} fullWidth />
          </div>
        </StudentSectionCard>

        <StudentSectionCard title="Installment Details" subtitle="Payment progress and due dates">
          <div className="student-dashboard-info-grid">
            <StudentInfoItem label="1st Installment Amount" value={formatCurrency(latestStudent.firstInstallmentAmount || latestStudent.installment1)} />
            <StudentInfoItem label="1st Installment Date" value={formatDate(latestStudent.firstInstallmentDate || latestStudent.admissionDate)} />
            <StudentInfoItem label="1st Installment Status" value={latestStudent.firstInstallmentStatus || 'Pending'} />
            <StudentInfoItem label="2nd Installment Amount" value={formatCurrency(latestStudent.secondInstallmentAmount || latestStudent.installment2)} />
            <StudentInfoItem label="2nd Due Date" value={formatDate(getSecondDueDate(latestStudent))} />
            <StudentInfoItem label="2nd Installment Status" value={latestStudent.secondInstallmentStatus || 'Pending'} />
            {hasThirdInstallment(latestStudent) ? (
              <>
                <StudentInfoItem label="3rd Installment Amount" value={formatCurrency(latestStudent.thirdInstallmentAmount || latestStudent.installment3)} />
                <StudentInfoItem label="3rd Due Date" value={formatDate(getThirdDueDate(latestStudent))} />
                <StudentInfoItem label="3rd Installment Status" value={latestStudent.thirdInstallmentStatus || 'Pending'} />
              </>
            ) : null}
            <StudentInfoItem label="Paid Amount" value={formatCurrency(paidAmount)} />
            <StudentInfoItem label="Due Amount" value={formatCurrency(dueAmount)} />
          </div>
        </StudentSectionCard>

        <StudentSectionCard title="Lead Information" subtitle="Counseling and source tracking">
          <div className="student-dashboard-info-grid">
            <StudentInfoItem label="How did you know about our Institute?" value={latestStudent.source} />
            <StudentInfoItem label="Remarks" value={latestStudent.remarks || '-'} fullWidth />
          </div>
        </StudentSectionCard>
      </div>
    </section>
  )
}

export function StudentDashboard({ dashboard }) {
  return <StudentDashboardContent dashboard={dashboard} />
}
