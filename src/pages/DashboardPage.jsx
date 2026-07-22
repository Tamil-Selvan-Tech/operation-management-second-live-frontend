import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { createPortal } from 'react-dom'
import { memo } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Clock3,
  Globe,
  Info,
  LockKeyhole,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { HeaderIdentityChip } from '../components/HeaderIdentityChip'
import { NotificationBell } from '../components/NotificationBell'
import { OperationManagerHeader } from '../components/OperationManagerHeader'
import { roleDashboards } from '../data/authData'
import { loadStudentRecords } from '../data/studentRecords'
import { useMobileMenu } from '../layouts/mobileMenuContext'
import { getCurrentFacultyProfile } from '../services/facultyService'
import { getCurrentStudentProfile, listStudents } from '../services/studentService'

const attendanceComparisonData = [
  { month: 'Jan', attendance: 82, students: 240 },
  { month: 'Feb', attendance: 85, students: 250 },
  { month: 'Mar', attendance: 88, students: 265 },
  { month: 'Apr', attendance: 90, students: 270 },
  { month: 'May', attendance: 92, students: 280 },
  { month: 'Jun', attendance: 87, students: 260 },
  { month: 'Jul', attendance: 85, students: 255 },
  { month: 'Aug', attendance: 83, students: 245 },
  { month: 'Sep', attendance: 86, students: 258 },
  { month: 'Oct', attendance: 89, students: 268 },
  { month: 'Nov', attendance: 84, students: 252 },
  { month: 'Dec', attendance: 91, students: 275 },
]
const attendanceMonthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const revenueFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const revenueSummaryCards = [
  {
    label: 'Total Revenue',
    value: 'â‚¹8,45,000',
    change: '+12.5%',
    accent: 'blue',
    icon: 'wallet',
    tooltip: 'Total Revenue shows the total income collected from all student fee payments across all courses and admissions.',
    details: [
      { label: 'Collected revenue', value: 'â‚¹8,45,000' },
      { label: 'Students added', value: '11 students added' },
      { label: 'Scope', value: 'All paid installments in the dashboard' },
    ],
  },
  {
    label: 'This Month Revenue',
    value: 'â‚¹95,000',
    change: '+8.4%',
    accent: 'green',
    icon: 'calendar',
    tooltip: 'This Month Revenue shows the total income collected during the current month period.',
    details: [
      { label: 'Collected this month', value: 'â‚¹95,000' },
      { label: 'Admissions', value: '10 admissions this month' },
      { label: 'Scope', value: 'Payments captured from the current month' },
    ],
  },
  {
    label: 'This Week Revenue',
    value: 'â‚¹32,000',
    change: '+4.2%',
    accent: 'purple',
    icon: 'trend',
    tooltip: 'This Week Revenue shows the total income collected during the current week.',
    details: [
      { label: 'Collected this week', value: 'â‚¹32,000' },
      { label: 'Admissions', value: '3 admissions this week' },
      { label: 'Scope', value: 'Payments captured from the current week' },
    ],
  },
  {
    label: 'Pending Payments',
    value: 'â‚¹1,20,000',
    change: null,
    accent: 'orange',
    icon: 'target',
    tooltip: 'Pending Payments shows the outstanding amount that is still waiting to be collected.',
    details: [
      { label: 'Pending amount', value: 'â‚¹1,20,000' },
      { label: 'Collection target', value: 'Target for next week' },
      { label: 'Scope', value: 'Outstanding student balances' },
    ],
  },
]

const notificationItems = [
  {
    tone: 'red',
    icon: ReceiptText,
    title: 'Student fee payment updated',
    message: 'Varsha’s full payment has been saved and marked as completed.',
    time: '5 mins ago',
    featured: false,
  },
  {
    tone: 'yellow',
    icon: CreditCard,
    title: 'Installment payment received',
    message: 'A pending installment for the Next.js course has been collected successfully.',
    time: '15 mins ago',
    featured: true,
  },
  {
    tone: 'amber',
    icon: AlertTriangle,
    title: 'Overdue fee reminder',
    message: 'Three student fee payments are still overdue and need review today.',
    time: '1 hour ago',
    featured: false,
  },
  {
    tone: 'blue',
    icon: CalendarDays,
    title: 'Admission update',
    message: 'A new student admission has been added to the dashboard successfully.',
    time: 'Today',
    featured: false,
  },
]

function useMediaQuery(query) {
  const getMatches = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  }

  const [matches, setMatches] = useState(getMatches)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia(query)
    const handleChange = (event) => setMatches(event.matches)
    const frameId = window.requestAnimationFrame(() => {
      setMatches(mediaQuery.matches)
    })

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => {
        window.cancelAnimationFrame(frameId)
        mediaQuery.removeEventListener('change', handleChange)
      }
    }

    mediaQuery.addListener(handleChange)
    return () => {
      window.cancelAnimationFrame(frameId)
      mediaQuery.removeListener(handleChange)
    }
  }, [query])

  return matches
}

function getRollingWindowData(data, monthsBefore = 1, monthsAfter = 4, referenceDate = new Date()) {
  const totalMonths = monthsBefore + monthsAfter + 1
  const startMonthIndex = referenceDate.getMonth() - monthsBefore

  return Array.from({ length: totalMonths }, (_, offset) => {
    const monthIndex = (startMonthIndex + offset + 12) % 12
    const monthName = attendanceMonthOrder[monthIndex]
    return data.find((item) => item.month === monthName) ?? null
  }).filter(Boolean)
}

const STUDENT_RECORD_SYNC_EVENT = 'cispro:students-changed'

function formatCurrency(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function addOneMonth(value, months = 1) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''

  const dueDate = new Date(date)
  dueDate.setMonth(dueDate.getMonth() + months)

  return dueDate.toISOString().slice(0, 10)
}

function diffInDays(a, b) {
  const start = new Date(`${a}T00:00:00`)
  const end = new Date(`${b}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const ms = 24 * 60 * 60 * 1000
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / ms))
}

function getTodayValue() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStudentInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'ST'
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)
}

function hasThirdInstallment(student) {
  return Boolean(
    String(student?.course?.installmentCount ?? '') === '3' ||
      student?.installment3 ||
      student?.thirdInstallmentAmount ||
      student?.thirdDueDate,
  )
}

function getSecondDueDate(student) {
  return student?.secondDueDate || addOneMonth(student?.admissionDate)
}

function getThirdDueDate(student) {
  if (!hasThirdInstallment(student)) return ''
  return student?.thirdDueDate || addOneMonth(getSecondDueDate(student))
}

function getStudentStatus(student) {
  const dueDate = hasThirdInstallment(student) ? getThirdDueDate(student) || getSecondDueDate(student) : getSecondDueDate(student)
  const secondPaid = String(student?.secondInstallmentStatus || 'Pending') === 'Paid'
  const thirdPaid = hasThirdInstallment(student) ? String(student?.thirdInstallmentStatus || 'Pending') === 'Paid' : true
  const firstPaid = String(student?.firstInstallmentStatus || 'Pending') === 'Paid'
  const overdueDays = (hasThirdInstallment(student) ? thirdPaid : secondPaid) ? 0 : diffInDays(dueDate, getTodayValue())

  if (firstPaid && secondPaid && thirdPaid) return { label: 'Complete', tone: 'success' }
  if (overdueDays > 0) return { label: `Overdue Â· ${overdueDays} Days`, tone: 'danger' }
  if (firstPaid) return { label: 'Pending', tone: 'warning' }

  return { label: 'Pending', tone: 'warning' }
}

function getPaidAmount(student) {
  const first = String(student?.firstInstallmentStatus || 'Pending') === 'Paid' ? Number(student?.installment1 || student?.firstInstallmentAmount || 0) : 0
  const second = String(student?.secondInstallmentStatus || 'Pending') === 'Paid' ? Number(student?.installment2 || student?.secondInstallmentAmount || 0) : 0
  const third =
    hasThirdInstallment(student) && String(student?.thirdInstallmentStatus || 'Pending') === 'Paid'
      ? Number(student?.thirdInstallmentAmount || student?.installment3 || 0)
      : 0
  return first + second + third
}

function toNumber(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function getLocalDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateValue(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return getLocalDateValue(date)
}

function getMonthStartValue(reference = new Date()) {
  const date = new Date(reference)
  date.setDate(1)
  return getLocalDateValue(date)
}

function getWeekStartValue(reference = new Date()) {
  const date = new Date(reference)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return getLocalDateValue(date)
}

function isWithinRange(value, start, end) {
  const date = getDateValue(value)
  if (!date) return false
  return date >= start && date <= end
}

function getInstallmentEntries(student) {
  const firstDueDate = student?.firstInstallmentDate || student?.admissionDate || ''
  const secondDueDate = getSecondDueDate(student)
  const thirdDueDate = getThirdDueDate(student)

  const entries = [
    {
      amount: toNumber(student?.firstInstallmentAmount || student?.installment1 || 0),
      status: String(student?.firstInstallmentStatus || 'Pending'),
      paidAt: student?.firstInstallmentPaidAt || '',
      dueDate: firstDueDate,
    },
    {
      amount: toNumber(student?.secondInstallmentAmount || student?.installment2 || 0),
      status: String(student?.secondInstallmentStatus || 'Pending'),
      paidAt: student?.secondInstallmentPaidAt || '',
      dueDate: secondDueDate,
    },
  ]

  if (hasThirdInstallment(student)) {
    entries.push({
      amount: toNumber(student?.thirdInstallmentAmount || student?.installment3 || 0),
      status: String(student?.thirdInstallmentStatus || 'Pending'),
      paidAt: student?.thirdInstallmentPaidAt || '',
      dueDate: thirdDueDate,
    })
  }

  return entries.filter((entry) => entry.amount > 0)
}

function calculateRevenueSummary(students) {
  const now = new Date()
  const monthStart = getMonthStartValue(now)
  const weekStart = getWeekStartValue(now)
  const today = getTodayValue()

  return students.reduce(
    (summary, student) => {
      const admissionDate = student?.admissionDate || student?.firstInstallmentDate || student?.createdAt || ''
      const entries = getInstallmentEntries(student)
      const plannedTotal = toNumber(student?.totalAmount || student?.afterDiscount) || entries.reduce((total, entry) => total + entry.amount, 0)

      summary.totalStudents += 1

      if (isWithinRange(admissionDate, monthStart, today)) {
        summary.thisMonthStudents += 1
      }

      if (isWithinRange(admissionDate, weekStart, today)) {
        summary.thisWeekStudents += 1
      }

      let paidTotalForStudent = 0

      for (const entry of entries) {
        if (String(entry.status || '').trim() !== 'Paid') continue

        paidTotalForStudent += entry.amount
        summary.totalRevenue += entry.amount

        const paymentDate = entry.paidAt || admissionDate || entry.dueDate

        if (isWithinRange(paymentDate, monthStart, today)) {
          summary.thisMonthRevenue += entry.amount
        }

        if (isWithinRange(paymentDate, weekStart, today)) {
          summary.thisWeekRevenue += entry.amount
        }
      }

      summary.pendingPayments += Math.max(plannedTotal - paidTotalForStudent, 0)

      return summary
    },
    {
      totalRevenue: 0,
      thisMonthRevenue: 0,
      thisWeekRevenue: 0,
      pendingPayments: 0,
      totalStudents: 0,
      thisMonthStudents: 0,
      thisWeekStudents: 0,
    },
  )
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getDateObject(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getChartMax(data, fallback = 10000) {
  const maxValue = data.reduce((highest, item) => Math.max(highest, item.actual, item.expected), 0)
  const base = Math.max(maxValue, fallback)
  return Math.ceil(base / 10000) * 10000
}

function buildRevenueTicks(chartMax) {
  return [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round((chartMax * fraction) / 1000) * 1000)
}

function getWeekBuckets(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return [
    { label: 'Week 1', start: 1, end: Math.min(7, daysInMonth) },
    { label: 'Week 2', start: 8, end: Math.min(14, daysInMonth) },
    { label: 'Week 3', start: 15, end: Math.min(21, daysInMonth) },
    { label: 'Week 4', start: 22, end: daysInMonth },
  ]
}

function getCurrentWeekIndex(referenceDate = new Date()) {
  const day = referenceDate.getDate()
  return getWeekBuckets(referenceDate).findIndex((bucket) => day >= bucket.start && day <= bucket.end)
}

function buildMonthlyRevenueComparison(students, referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const buckets = MONTH_LABELS.map((month, monthIndex) => ({
    month,
    monthIndex,
    actual: 0,
    expected: 0,
  }))

  for (const student of students) {
    for (const entry of getInstallmentEntries(student)) {
      const amount = toNumber(entry.amount)
      if (!amount) continue

      const paidAt = getDateObject(entry.paidAt)
      if (entry.status === 'Paid' && paidAt && paidAt.getFullYear() === year) {
        buckets[paidAt.getMonth()].actual += amount
        continue
      }

      const dueDate = getDateObject(entry.dueDate)
      if (!dueDate || dueDate.getFullYear() !== year) {
        continue
      }

      buckets[dueDate.getMonth()].expected += amount
    }
  }

  return buckets.map(({ month, actual, expected }) => ({ month, actual, expected }))
}

function buildWeeklyRevenueComparison(students, referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const currentWeekIndex = getCurrentWeekIndex(referenceDate)
  const buckets = getWeekBuckets(referenceDate).map((bucket, index) => ({
    week: index === currentWeekIndex ? `${bucket.label} (Current)` : bucket.label,
    actual: 0,
    expected: 0,
    start: bucket.start,
    end: bucket.end,
    isCurrent: index === currentWeekIndex,
  }))

  for (const student of students) {
    for (const entry of getInstallmentEntries(student)) {
      const amount = toNumber(entry.amount)
      if (!amount) continue

      const paidAt = getDateObject(entry.paidAt)
      if (entry.status === 'Paid' && paidAt && paidAt.getFullYear() === year && paidAt.getMonth() === month) {
        const paidDay = paidAt.getDate()
        const paidIndex = buckets.findIndex((bucket) => paidDay >= bucket.start && paidDay <= bucket.end)
        if (paidIndex >= 0) {
          buckets[paidIndex].actual += amount
        }
        continue
      }

      const dueDate = getDateObject(entry.dueDate)
      if (!dueDate || dueDate.getFullYear() !== year || dueDate.getMonth() !== month) {
        continue
      }

      const dueDay = dueDate.getDate()
      const dueIndex = buckets.findIndex((bucket) => dueDay >= bucket.start && dueDay <= bucket.end)
      if (dueIndex >= 0 && dueIndex >= currentWeekIndex) {
        buckets[dueIndex].expected += amount
      }
    }
  }

  return buckets.map(({ week, actual, expected, isCurrent }) => ({ week, actual, expected, isCurrent }))
}

function useBackendStudents() {
  const [records, setRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await listStudents({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
        if (!active) return
        setRecords(result.data || [])
      } catch {
        if (!active) return
        setRecords(loadStudentRecords())
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    const syncRecords = () => {
      void run()
    }

    void run()
    window.addEventListener(STUDENT_RECORD_SYNC_EVENT, syncRecords)
    window.addEventListener('storage', syncRecords)

    return () => {
      active = false
      window.removeEventListener(STUDENT_RECORD_SYNC_EVENT, syncRecords)
      window.removeEventListener('storage', syncRecords)
    }
  }, [])

  return { records, isLoading }
}

function useCurrentStudentProfile() {
  const [student, setStudent] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await getCurrentStudentProfile()
        if (!active) return
        setStudent(result)
      } catch {
        if (!active) return
        setStudent(loadStudentRecords()[0] || null)
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

  return { student, isLoading }
}

function BusinessOwnerDashboard({ dashboard, revenueSummary, isRevenueLoading, revenueStudents }) {
  const openMenu = useMobileMenu()

  return (
    <section className="business-owner-dashboard">
      <OperationManagerHeader
        className="operation-manager-header-plain"
        eyebrow="Business Owner"
        title={dashboard.title}
        summary=""
        initials="BW"
        profileTitle="Business Head"
        email="business.owner@cispro.com"
        onOpenMenu={openMenu}
      />

      <MemoRevenueSummaryRow summary={revenueSummary} isLoading={isRevenueLoading} />
      <MemoRevenueDashboards students={revenueStudents} />
      <MemoAttendanceComparisonChart />
    </section>
  )
}

function formatRevenue(value) {
  return revenueFormatter.format(value)
}

function buildRevenueSummaryCards(summary, isLoading) {
  const formatValue = (value) => {
    if (isLoading) return 'Loading...'
    return formatRevenue(value ?? 0)
  }

  return [
    {
      label: 'Total Revenue',
      value: formatValue(summary?.totalRevenue),
      change: null,
      accent: 'blue',
      icon: 'wallet',
      details: [
        { label: 'Collected revenue', value: formatValue(summary?.totalRevenue) },
        { label: 'Students added', value: isLoading ? 'Loading...' : `${summary?.totalStudents || 0} students added` },
        { label: 'Scope', value: isLoading ? 'Loading...' : 'All paid installments across active records' },
      ],
    },
    {
      label: 'This Month Revenue',
      value: formatValue(summary?.thisMonthRevenue),
      change: null,
      accent: 'green',
      icon: 'calendar',
      details: [
        { label: 'Collected this month', value: formatValue(summary?.thisMonthRevenue) },
        { label: 'Admissions', value: isLoading ? 'Loading...' : `${summary?.thisMonthStudents || 0} admissions this month` },
        { label: 'Scope', value: isLoading ? 'Loading...' : 'Payments received from the current month window' },
      ],
    },
    {
      label: 'This Week Revenue',
      value: formatValue(summary?.thisWeekRevenue),
      change: null,
      accent: 'purple',
      icon: 'trend',
      details: [
        { label: 'Collected this week', value: formatValue(summary?.thisWeekRevenue) },
        { label: 'Admissions', value: isLoading ? 'Loading...' : `${summary?.thisWeekStudents || 0} admissions this week` },
        { label: 'Scope', value: isLoading ? 'Loading...' : 'Payments received from the current week window' },
      ],
    },
    {
      label: 'Pending Payments',
      value: formatValue(summary?.pendingPayments ?? summary?.expectedNextWeekRevenue),
      change: null,
      accent: 'orange',
      icon: 'target',
      details: [
        {
          label: 'Pending amount',
          value: formatValue(summary?.pendingPayments ?? summary?.expectedNextWeekRevenue),
        },
        { label: 'Collection target', value: isLoading ? 'Loading...' : 'Target for next week' },
        { label: 'Scope', value: isLoading ? 'Loading...' : 'Outstanding student balances' },
      ],
    },
  ]
}

function DashboardNotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const visibleItems = showAll ? notificationItems : notificationItems.slice(0, 2)

  return (
    <div
      className="notification-menu"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        setIsOpen(false)
        setShowAll(false)
      }}
    >
      <button
        className="icon-chip notification-chip"
        type="button"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Bell size={20} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        <b>{notificationItems.length}</b>
      </button>

      {isOpen ? (
        <div className="notification-dropdown" role="menu" aria-label="Notifications">
          <div className="notification-dropdown-head">
            <strong>Notifications</strong>
            <button type="button" className="notification-mark-read">
              Mark all as read
            </button>
          </div>

          <div className="notification-dropdown-list">
            {visibleItems.map((item) => {
              const Icon = item.icon
              return (
                <article
                  key={`${item.title}-${item.time}`}
                  className={`notification-dropdown-item ${item.featured ? 'is-highlighted' : ''}`.trim()}
                >
                  <span className={`notification-badge ${item.tone}`} aria-hidden="true">
                    <Icon size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                  </span>
                  <div className="notification-copy">
                    <p>{item.title}</p>
                    <span>{item.message}</span>
                    <small>{item.time}</small>
                  </div>
                </article>
              )
            })}
          </div>

          <button
            className="notification-dropdown-footer"
            type="button"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? 'Show less' : 'View all notifications'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function getEdgeAwareTooltipStyle(activeIndex, totalItems) {
  if (activeIndex === null) return null

  if (activeIndex < 2) {
    return { left: '12px', transform: 'none' }
  }

  if (activeIndex > totalItems - 3) {
    return { left: 'auto', right: '12px', transform: 'none' }
  }

  return { left: '50%', transform: 'translateX(-50%)' }
}

function SummaryIcon({ kind }) {
  if (kind === 'wallet') {
    return <Wallet size={20} strokeWidth={2.1} aria-hidden="true" focusable="false" />
  }

  if (kind === 'calendar') {
    return <CalendarDays size={20} strokeWidth={2.1} aria-hidden="true" focusable="false" />
  }

  if (kind === 'trend') {
    return <TrendingUp size={20} strokeWidth={2.1} aria-hidden="true" focusable="false" />
  }

  if (kind === 'target') {
    return <Target size={20} strokeWidth={2.1} aria-hidden="true" focusable="false" />
  }

  return (
    <Info size={20} strokeWidth={2.1} aria-hidden="true" focusable="false" />
  )
}

function RevenueSummaryRow({ summary = null, isLoading = false }) {
  const cards = useMemo(
    () => (summary || isLoading ? buildRevenueSummaryCards(summary, isLoading) : revenueSummaryCards),
    [isLoading, summary],
  )
  const [activeTooltipIndex, setActiveTooltipIndex] = useState(null)
  const rowRef = useRef(null)

  useEffect(() => {
    if (activeTooltipIndex === null) return

    const handlePointerDown = (event) => {
      if (rowRef.current?.contains(event.target)) return
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
    <section ref={rowRef} className="revenue-summary-row" aria-label="Revenue summary">
      {cards.map((card, index) => {
        const tooltipId = `revenue-summary-tooltip-${index}`
        const isTooltipOpen = activeTooltipIndex === index

        return (
          <article key={card.label} className={`revenue-summary-card ${isTooltipOpen ? 'is-tooltip-open' : ''}`}>
          <div className={`revenue-summary-icon ${card.accent}`} aria-hidden="true">
            <SummaryIcon kind={card.icon} />
          </div>
          <div className="revenue-summary-content">
            <strong className="revenue-summary-label">{card.label}</strong>
            <div className="revenue-summary-value">{card.value}</div>
          </div>
          <button
            type="button"
            className={`revenue-summary-info-button ${isTooltipOpen ? 'is-open' : ''}`}
            aria-describedby={tooltipId}
            aria-label={`${card.label} details`}
            aria-expanded={isTooltipOpen}
            onClick={() => setActiveTooltipIndex((current) => (current === index ? null : index))}
            onMouseEnter={() => setActiveTooltipIndex(index)}
            onMouseLeave={() => setActiveTooltipIndex(null)}
            onFocus={() => setActiveTooltipIndex(index)}
            onBlur={() => setActiveTooltipIndex(null)}
          >
            <Info size={13} strokeWidth={2.5} aria-hidden="true" focusable="false" />
            <div className="revenue-summary-tooltip" id={tooltipId} role="tooltip" aria-label={`${card.label} details`}>
              <strong>{card.label}</strong>
              <p>{card.tooltip}</p>
              <div className="revenue-summary-tooltip-list">
                {(card.details || []).map((detail) => (
                  <div key={detail.label} className="revenue-summary-tooltip-item">
                    <span>{detail.label}</span>
                    <strong>{detail.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </button>
        </article>
        )
      })}
    </section>
  )
}

const MemoBusinessOwnerDashboard = memo(BusinessOwnerDashboard)

const MemoRevenueSummaryRow = memo(RevenueSummaryRow)

function MonthlyRevenueChart({ data = [] }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const isCompactMobile = useMediaQuery('(max-width: 640px)')
  const visibleMonthlyData = useMemo(
    () => (isCompactMobile ? getRollingWindowData(data, 1, 4) : data),
    [data, isCompactMobile],
  )
  const chartMax = getChartMax(visibleMonthlyData, 10000)
  const ticks = buildRevenueTicks(chartMax)
  const activePoint = activeIndex === null ? null : visibleMonthlyData[activeIndex]
  const tooltipStyle = getEdgeAwareTooltipStyle(activeIndex, visibleMonthlyData.length)

  return (
    <article className="panel-card revenue-comparison-card revenue-monthly-card">
      <div className="revenue-comparison-header">
        <div className="revenue-comparison-header-copy">
          <h3>Monthly Revenue vs Expected Revenue (Current Year)</h3>
          <div className="revenue-legend" aria-hidden="true">
            <span className="revenue-legend-item">
              <span className="revenue-legend-swatch monthly" />
              Actual Revenue
            </span>
            <span className="revenue-legend-item">
              <span className="revenue-legend-swatch expected" />
              Expected Revenue
            </span>
          </div>
        </div>
        <ChartInfoTrigger
          label="Monthly Revenue details"
          description="Current-year actual revenue and expected revenue by month, based on paid dates and due dates."
        />
      </div>

      <div className="revenue-comparison-body">
        <div className="revenue-axis-y" aria-hidden="true">
          {ticks
            .slice()
            .reverse()
            .map((tick) => (
              <span key={tick}>{formatRevenue(tick)}</span>
            ))}
        </div>

        <div className="revenue-plot" onMouseLeave={() => setActiveIndex(null)}>
          <div className="revenue-grid-lines" aria-hidden="true">
            {ticks.slice(1).map((tick) => (
              <span key={tick} />
            ))}
          </div>

          {activePoint ? (
            <div className="revenue-tooltip" style={tooltipStyle || undefined}>
              <strong>{activePoint.month}</strong>
              <div className="revenue-tooltip-row">
                <span className="revenue-tooltip-label">
                  <span className="revenue-tooltip-dot monthly" />
                  Actual Revenue
                </span>
                <span className="revenue-tooltip-value">{formatRevenue(activePoint.actual)}</span>
              </div>
              <div className="revenue-tooltip-row">
                <span className="revenue-tooltip-label">
                  <span className="revenue-tooltip-dot expected" />
                  Expected Revenue
                </span>
                <span className="revenue-tooltip-value">{formatRevenue(activePoint.expected)}</span>
              </div>
            </div>
          ) : null}

          <div className="revenue-groups" style={{ gridTemplateColumns: `repeat(${visibleMonthlyData.length}, minmax(0, 1fr))` }}>
            {visibleMonthlyData.map((item, index) => {
              const monthlyHeight = `${chartMax ? (item.actual / chartMax) * 100 : 0}%`
              const expectedHeight = `${chartMax ? (item.expected / chartMax) * 100 : 0}%`
              const isActive = index === activeIndex

              return (
                <button
                  key={item.month}
                  type="button"
                  className={`revenue-month-group ${isActive ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  aria-label={`${item.month}. Actual Revenue ${formatRevenue(item.actual)}. Expected Revenue ${formatRevenue(item.expected)}.`}
                >
                  <span className="revenue-bars" aria-hidden="true">
                    <span className="revenue-bar monthly" style={{ height: monthlyHeight }} />
                    <span className="revenue-bar expected" style={{ height: expectedHeight }} />
                  </span>
                  <span className="revenue-month-label">{item.month}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="chart-card-footer" aria-hidden="true">
        <span>View Details</span>
        <ChevronRight size={16} strokeWidth={2.4} />
      </div>
    </article>
  )
}

function WeeklyRevenueChart({ data = [] }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const chartMax = getChartMax(data, 10000)
  const activePoint = activeIndex === null ? null : data[activeIndex]
  const tooltipTop =
    activeIndex === null
      ? '50%'
      : `${Math.min(82, Math.max(18, ((activeIndex + 0.5) / Math.max(data.length, 1)) * 100))}%`

  return (
    <article className="panel-card revenue-comparison-card revenue-weekly-card">
      <div className="revenue-comparison-header">
        <div className="revenue-comparison-header-copy">
          <h3>Weekly Revenue vs Expected Revenue (Current Month)</h3>
          <div className="revenue-legend revenue-weekly-legend" aria-hidden="true">
            <span className="revenue-legend-item">
              <span className="revenue-legend-swatch monthly" />
              Actual Revenue
            </span>
            <span className="revenue-legend-item">
              <span className="revenue-legend-swatch expected" />
              Expected Revenue
            </span>
          </div>
        </div>
        <ChartInfoTrigger
          label="Weekly Revenue details"
          description="Actual revenue and expected revenue by week, based on paid dates and due dates in the current month."
        />
      </div>

      <div className="revenue-weekly-body">
        <div className="revenue-weekly-axis-y" aria-hidden="true">
          {data.map((item) => (
            <span key={item.week}>{item.week}</span>
          ))}
        </div>

        <div className="revenue-weekly-plot" onMouseLeave={() => setActiveIndex(null)}>
          <div className="revenue-weekly-grid-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>

          {activePoint ? (
            <div className="revenue-tooltip revenue-weekly-tooltip" style={{ top: tooltipTop }}>
              <strong>{activePoint.week}</strong>
              <div className="revenue-tooltip-row">
                <span className="revenue-tooltip-label">
                  <span className="revenue-tooltip-dot monthly" />
                  Actual Revenue
                </span>
                <span className="revenue-tooltip-value">{formatRevenue(activePoint.actual)}</span>
              </div>
              <div className="revenue-tooltip-row">
                <span className="revenue-tooltip-label">
                  <span className="revenue-tooltip-dot expected" />
                  Expected Revenue
                </span>
                <span className="revenue-tooltip-value">{formatRevenue(activePoint.expected)}</span>
              </div>
            </div>
          ) : null}

          <div className="revenue-weekly-groups">
            {data.map((item, index) => {
              const weeklyWidth = `${chartMax ? (item.actual / chartMax) * 100 : 0}%`
              const expectedWidth = `${chartMax ? (item.expected / chartMax) * 100 : 0}%`
              const isActive = index === activeIndex

              return (
                <button
                  key={item.week}
                  type="button"
                  className={`revenue-week-row ${isActive ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  aria-label={`${item.week}. Actual Revenue ${formatRevenue(item.actual)}. Expected Revenue ${formatRevenue(item.expected)}.`}
                >
                  <span className="revenue-week-bars" aria-hidden="true">
                    <span className="revenue-week-bar monthly" style={{ width: weeklyWidth }} />
                    <span className="revenue-week-bar expected" style={{ width: expectedWidth }} />
                  </span>
                  <span className="revenue-week-values">
                    <strong>{formatRevenue(item.actual)}</strong>
                    <span>{formatRevenue(item.expected)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="chart-card-footer" aria-hidden="true">
        <span>View Details</span>
        <ChevronRight size={16} strokeWidth={2.4} />
      </div>
    </article>
  )
}

function ChartInfoTrigger({ label, description }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return
      setIsOpen(false)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <button
      ref={triggerRef}
      type="button"
      className={`chart-info-trigger ${isOpen ? 'is-open' : ''}`}
      aria-label={label}
      aria-expanded={isOpen}
      onClick={() => setIsOpen((current) => !current)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      <Info size={17} strokeWidth={2.4} aria-hidden="true" focusable="false" />
      <div className="chart-info-tooltip" role="tooltip">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
    </button>
  )
}

function RevenueDashboards({ students = [] }) {
  const monthlyRevenueData = useMemo(() => buildMonthlyRevenueComparison(students), [students])
  const weeklyRevenueData = useMemo(() => buildWeeklyRevenueComparison(students), [students])

  return (
    <div className="revenue-comparison-grid">
      <WeeklyRevenueChart data={weeklyRevenueData} />
      <MonthlyRevenueChart data={monthlyRevenueData} />
    </div>
  )
}

const MemoRevenueDashboards = memo(RevenueDashboards)

function AttendanceComparisonChart() {
  const isCompactMobile = useMediaQuery('(max-width: 640px)')
  const visibleAttendanceData = useMemo(
    () => (isCompactMobile ? getRollingWindowData(attendanceComparisonData, 1, 4) : attendanceComparisonData),
    [isCompactMobile],
  )

  return (
    <article className="panel-card attendance-card">
      <div className="attendance-header">
        <div className="attendance-header-row">
          <div className="attendance-header-title">Attendance (%)</div>
          <button type="button" className="attendance-period-chip" aria-label="Attendance period">
            <span>This Month</span>
            <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <div className="attendance-legend" aria-hidden="true">
          <span className="revenue-legend-item">
            <span className="attendance-legend-swatch attendance" />
            Attendance (%)
          </span>
          <span className="revenue-legend-item">
            <span className="attendance-legend-swatch students" />
            Present Students
          </span>
        </div>
      </div>

      <div className="attendance-chart" aria-label="Attendance comparison chart">
        <div className="attendance-left-axis">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>

        <div className="attendance-plot">
          <div className="attendance-grid-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="attendance-bars-row" style={{ gridTemplateColumns: `repeat(${visibleAttendanceData.length}, minmax(0, 1fr))` }}>
            {visibleAttendanceData.map((item) => (
              <div key={item.month} className="attendance-group">
                <div className="attendance-series">
                  <strong className="attendance-series-value">{item.attendance}%</strong>
                  <div className="attendance-bar attendance" style={{ height: `${item.attendance}%` }} />
                </div>
                <div className="attendance-series">
                  <strong className="attendance-series-value">{item.students}</strong>
                  <div className="attendance-bar students" style={{ height: `${(item.students / 500) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="attendance-months-row" style={{ gridTemplateColumns: `repeat(${visibleAttendanceData.length}, minmax(0, 1fr))` }}>
            {visibleAttendanceData.map((item) => (
              <span key={item.month}>{item.month}</span>
            ))}
          </div>
        </div>

        <div className="attendance-right-axis">
          <span>500</span>
          <span>375</span>
          <span>250</span>
          <span>125</span>
          <span>0</span>
        </div>
      </div>

      <div className="chart-card-footer" aria-hidden="true">
        <span>View Details</span>
        <ChevronRight size={16} strokeWidth={2.4} />
      </div>
    </article>
  )
}

const MemoAttendanceComparisonChart = memo(AttendanceComparisonChart)

function StudentInfoItem({ label, value, fullWidth = false, valueClassName = '' }) {
  return (
    <div className={`student-dashboard-info-item ${fullWidth ? 'student-dashboard-info-item-full' : ''}`.trim()}>
      <span>{label}</span>
      <strong className={valueClassName}>{value || '-'}</strong>
    </div>
  )
}

function StudentSectionCard({ title, subtitle, kicker = 'Student Data', children }) {
  return (
    <article className="student-section-card">
      <div className="student-section-card-head">
        <div>
          <p className="section-kicker">{kicker}</p>
          <h3>{title}</h3>
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </article>
  )
}

function StudentDashboard({ dashboard }) {
  const { student: latestStudent, isLoading } = useCurrentStudentProfile()

  if (isLoading) {
    return (
      <section className="student-dashboard-page">
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

  return (
    <section className="student-dashboard-page">
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

function useCurrentFacultyProfile() {
  const [faculty, setFaculty] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await getCurrentFacultyProfile()
        if (!active) return
        setFaculty(result)
      } catch {
        if (!active) return
        setFaculty(null)
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

function getFacultyStatus(record) {
  const status = String(record?.status || 'Inactive').trim()
  if (status === 'Active') return { label: 'Active', tone: 'success' }
  return { label: 'Inactive', tone: 'warning' }
}

function FacultyDashboard({ dashboard }) {
  const { faculty: latestFaculty, isLoading } = useCurrentFacultyProfile()

  if (isLoading) {
    return (
      <section className="student-dashboard-page">
        <article className="panel-card student-dashboard-empty">
          <p className="eyebrow">Faculty Dashboard</p>
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
        <article className="panel-card student-dashboard-empty">
          <p className="eyebrow">Faculty Dashboard</p>
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
          <div className="student-empty-state">
            <strong>No faculty profile found</strong>
            <p>Please contact the operation manager to create or activate your faculty record.</p>
          </div>
        </article>
      </section>
    )
  }

  const status = getFacultyStatus(latestFaculty)
  const batchNames = Array.isArray(latestFaculty.batchEntries)
    ? latestFaculty.batchEntries.map((entry) => String(entry.batchName || '').trim()).filter(Boolean)
    : []

  return (
    <section className="student-dashboard-page">
      <article className="student-dashboard-hero">
        <div className="student-dashboard-hero-top">
          <div className="student-dashboard-avatar">
            {getStudentInitials(latestFaculty.facultyName || 'Faculty')}
          </div>
          <div className="student-dashboard-hero-main">
            <div className="student-dashboard-name-row">
              <h2>{latestFaculty.facultyName}</h2>
              <span className={`student-status-pill ${status.tone}`}>{status.label}</span>
            </div>
            <div className="student-dashboard-id-row">
              <div>
                <span>Course</span>
                <strong>{latestFaculty.courseName || latestFaculty.course?.name || '-'}</strong>
              </div>
              <div>
                <span>Batches</span>
                <strong>{batchNames.length || 0}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="student-dashboard-hero-side">
          <div>
            <span>Email</span>
            <strong>{latestFaculty.facultyEmail || '-'}</strong>
          </div>
          <div>
            <span>Phone</span>
            <strong>{latestFaculty.facultyPhone || '-'}</strong>
          </div>
          <div>
            <span>Created On</span>
            <strong>{formatDate(latestFaculty.createdAt)}</strong>
          </div>
        </div>
      </article>

      <div className="student-dashboard-grid">
        <StudentSectionCard title="Faculty Information" subtitle="Primary faculty profile and contact details" kicker="Faculty Data">
          <div className="student-dashboard-info-grid">
            <StudentInfoItem label="Faculty Name" value={latestFaculty.facultyName} />
            <StudentInfoItem label="Faculty Email" value={latestFaculty.facultyEmail} />
            <StudentInfoItem label="Faculty Phone" value={latestFaculty.facultyPhone} />
            <StudentInfoItem label="Course" value={latestFaculty.courseName || latestFaculty.course?.name || '-'} />
            <StudentInfoItem label="Status" value={latestFaculty.status} />
            <StudentInfoItem label="Created On" value={formatDate(latestFaculty.createdAt)} />
          </div>
        </StudentSectionCard>

        <StudentSectionCard title="Assigned Batches" subtitle="Batch schedule and timing details" kicker="Faculty Data">
          <div className="student-dashboard-info-grid">
            {batchNames.length ? (
              latestFaculty.batchEntries.map((entry) => (
                <div key={entry.id || `${entry.batchName}-${entry.batchTiming}`} className="student-dashboard-info-item">
                  <span>{entry.batchName || 'Batch'}</span>
                  <strong>{entry.batchTiming || '-'}</strong>
                </div>
              ))
            ) : (
              <div className="student-dashboard-info-item student-dashboard-info-item-full">
                <span>Batch assignments</span>
                <strong>No batches assigned yet</strong>
              </div>
            )}
          </div>
        </StudentSectionCard>
      </div>
    </section>
  )
}

function OperationManagerDashboard({ dashboard, revenueSummary, isRevenueLoading, revenueStudents }) {
  const openMenu = useMobileMenu()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileDetails = {
    role: 'Operation Manager',
    status: 'Active',
    workspace: 'Cispro Ops',
    accessLevel: 'Operation Manager',
    primaryEmail: 'operation.manager@cispro.com',
    passwordMasked: 'ChangeMe123!',
    resetPasswordText: 'Send Reset Link',
    lastLogin: 'Today, 10:25 AM',
    initials: 'OM',
  }

  useEffect(() => {
    if (!isProfileOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isProfileOpen])

  return (
    <section className="business-owner-dashboard operation-manager-dashboard">
      <div className="business-topbar">
        <button
          type="button"
          className="mobile-menu-button dashboard-mobile-menu-button"
          onClick={openMenu}
          aria-label="Open navigation menu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M4 12h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="operation-manager-mobile-brand" aria-hidden="true">
          <img className="operation-manager-mobile-brand-logo" src="/logo1.png" alt="" />
          <div className="operation-manager-mobile-brand-copy">
            <strong>Cispro Ops</strong>
          </div>
        </div>
        <div className="business-topbar-copy">
          <p className="eyebrow">Operation Manager</p>
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
        </div>

        <div className="business-topbar-actions">
          <label className="dashboard-search">
            <span aria-hidden="true">âŒ•</span>
            <input type="search" placeholder="Search..." aria-label="Search dashboard" />
          </label>
          <DashboardNotificationBell />
          <HeaderIdentityChip
            initials={profileDetails.initials}
            title={profileDetails.role}
            email={profileDetails.primaryEmail}
            className="operation-manager-profile-chip"
            onClick={() => setIsProfileOpen(true)}
            ariaLabel="Open Operation Manager profile"
          />
        </div>
      </div>

      <MemoRevenueSummaryRow summary={revenueSummary} isLoading={isRevenueLoading} />
      <MemoRevenueDashboards students={revenueStudents} />
      <MemoAttendanceComparisonChart />

      {isProfileOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="profile-drawer-backdrop" role="presentation">
              <div
                className="profile-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="profile-modal-cover profile-drawer-cover">
                  <button
                    type="button"
                    className="course-modal-close profile-modal-close"
                    onClick={() => setIsProfileOpen(false)}
                    aria-label="Close profile card"
                  >
                    <X size={18} strokeWidth={2.5} aria-hidden="true" focusable="false" />
                  </button>

                  <div className="profile-modal-cover-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="profile-modal-avatar-wrap">
                    <div className="profile-modal-avatar" aria-hidden="true">
                      {profileDetails.initials}
                    </div>
                    <span className="profile-modal-status-dot" aria-hidden="true" />
                  </div>
                </div>

                <div className="profile-modal-body profile-drawer-body">
                  <p className="profile-modal-eyebrow">Profile</p>
                  <h3 id="profile-modal-title">{profileDetails.role}</h3>
                  <p className="profile-modal-email">{profileDetails.primaryEmail}</p>

                  <div className="profile-modal-grid">
                    <div className="profile-modal-stat tone-blue">
                      <span className="profile-modal-stat-icon" aria-hidden="true">
                        <BadgeCheck size={16} />
                      </span>
                      <div>
                        <span>Role</span>
                        <strong>{profileDetails.role}</strong>
                      </div>
                    </div>
                    <div className="profile-modal-stat tone-green">
                      <span className="profile-modal-stat-icon" aria-hidden="true">
                        <ShieldCheck size={16} />
                      </span>
                      <div>
                        <span>Status</span>
                        <strong>{profileDetails.status}</strong>
                      </div>
                    </div>
                    <div className="profile-modal-stat tone-violet">
                      <span className="profile-modal-stat-icon" aria-hidden="true">
                        <Building2 size={16} />
                      </span>
                      <div>
                        <span>Workspace</span>
                        <strong>{profileDetails.workspace}</strong>
                      </div>
                    </div>
                    <div className="profile-modal-stat tone-amber">
                      <span className="profile-modal-stat-icon" aria-hidden="true">
                        <Globe size={16} />
                      </span>
                      <div>
                        <span>Access Level</span>
                        <strong>{profileDetails.accessLevel}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="profile-modal-info-list">
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <LockKeyhole size={15} />
                        Password
                      </span>
                      <strong>{profileDetails.passwordMasked}</strong>
                    </div>
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <RefreshCcw size={15} />
                        Reset Password
                      </span>
                      <strong>{profileDetails.resetPasswordText}</strong>
                    </div>
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <Clock3 size={15} />
                        Last Login
                      </span>
                      <strong>{profileDetails.lastLogin}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}

const MemoOperationManagerDashboard = memo(OperationManagerDashboard)

function GenericDashboard({ role }) {
  const dashboard = roleDashboards[role]

  return (
    <section className="dashboard-grid">
      <div className="dashboard-hero-plain">
        <div>
          <p className="eyebrow">{dashboard.accent} lane</p>
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
        </div>
      </div>

      {dashboard.cards.map((card) => (
        <article key={card} className="info-card">
          <span className="dot" style={{ backgroundColor: dashboard.color }} />
          <h3>{card}</h3>
          <p>Placeholder card for role-specific work and permissions validation.</p>
        </article>
      ))}
    </section>
  )
}

function ManagementDashboard({ role, dashboard }) {
  const { records: revenueStudents, isLoading: isRevenueLoading } = useBackendStudents()
  const revenueSummary = useMemo(() => calculateRevenueSummary(revenueStudents), [revenueStudents])

  if (role === 'business-owner') {
    return (
      <MemoBusinessOwnerDashboard
        dashboard={dashboard}
        revenueSummary={revenueSummary}
        isRevenueLoading={isRevenueLoading}
        revenueStudents={revenueStudents}
      />
    )
  }

  return (
    <MemoOperationManagerDashboard
      dashboard={dashboard}
      revenueSummary={revenueSummary}
      isRevenueLoading={isRevenueLoading}
      revenueStudents={revenueStudents}
    />
  )
}

export function DashboardPage({ role }) {
  const dashboard = roleDashboards[role]

  if (role === 'business-owner') {
    return <ManagementDashboard role={role} dashboard={dashboard} />
  }

  if (role === 'operation-manager') {
    return <ManagementDashboard role={role} dashboard={dashboard} />
  }

  if (role === 'student') {
    return <StudentDashboard dashboard={dashboard} />
  }

  if (role === 'faculty') {
    return <FacultyDashboard dashboard={dashboard} />
  }

  return <GenericDashboard role={role} />
}




