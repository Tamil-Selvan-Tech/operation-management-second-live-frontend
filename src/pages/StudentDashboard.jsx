import { Activity, ArrowUpRight, BookOpen, CalendarDays, ChevronDown, ClipboardList, GraduationCap, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
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
  const profileName = studentName || 'Student'
  const profileInitials = getStudentInitials(profileName)

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
        <div className="student-dashboard-date-pill" aria-label={todayLabel}>
          <CalendarDays size={18} strokeWidth={2.15} aria-hidden="true" focusable="false" />
          <div>
            <strong>{todayLabel}</strong>
            <span>TODAY</span>
          </div>
        </div>
        <div className="student-dashboard-profile-chip" aria-label={profileName}>
          <span className="student-dashboard-profile-initials" aria-hidden="true">
            {profileInitials}
          </span>
          <span className="student-dashboard-profile-name">{profileName}</span>
          <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
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
    background: `conic-gradient(#2f80ed 0% ${payment.paidPercent}%, #f97316 ${payment.paidPercent}% 100%)`,
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
