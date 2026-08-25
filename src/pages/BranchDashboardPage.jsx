
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

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
import { ProfileDrawer } from '../components/ProfileDrawer'
import { roleDashboards } from '../data/authData'
import { useMobileMenu } from '../layouts/mobileMenuContext'
import { listStudents } from '../services/studentService'
import { StudentDashboard } from './StudentDashboard'
import { Navigate } from 'react-router-dom'

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
  const today = getTodayValue()
  const monthStart = getMonthStartValue(now)
  const weekStart = getWeekStartValue(now)

  // Last week range
  const weekStartRef = new Date(weekStart + 'T00:00:00')
  const lastWeekStartObj = new Date(weekStartRef)
  lastWeekStartObj.setDate(lastWeekStartObj.getDate() - 7)
  const lastWeekStart = getLocalDateValue(lastWeekStartObj)
  const lastWeekEndObj = new Date(weekStartRef)
  lastWeekEndObj.setDate(lastWeekEndObj.getDate() - 1)
  const lastWeekEnd = getLocalDateValue(lastWeekEndObj)

  // Last month range
  const monthStartRef = new Date(monthStart + 'T00:00:00')
  const lastMonthStartObj = new Date(monthStartRef)
  lastMonthStartObj.setMonth(lastMonthStartObj.getMonth() - 1)
  const lastMonthStart = getLocalDateValue(lastMonthStartObj)
  const lastMonthEndObj = new Date(monthStartRef)
  lastMonthEndObj.setDate(lastMonthEndObj.getDate() - 1)
  const lastMonthEnd = getLocalDateValue(lastMonthEndObj)

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
      let paidTotalBeforeWeekStart = 0

      for (const entry of entries) {
        if (String(entry.status || '').trim() !== 'Paid') continue

        paidTotalForStudent += entry.amount
        summary.totalRevenue += entry.amount

        const paymentDate = entry.paidAt || admissionDate || entry.dueDate

        if (paymentDate < weekStart) {
          paidTotalBeforeWeekStart += entry.amount
          summary.lastWeekCumulativeRevenue += entry.amount
        }

        if (isWithinRange(paymentDate, lastMonthStart, lastMonthEnd)) {
          summary.lastMonthRevenue += entry.amount
        }

        if (isWithinRange(paymentDate, lastWeekStart, lastWeekEnd)) {
          summary.lastWeekRevenue += entry.amount
        }

        if (isWithinRange(paymentDate, monthStart, today)) {
          summary.thisMonthRevenue += entry.amount
        }

        if (isWithinRange(paymentDate, weekStart, today)) {
          summary.thisWeekRevenue += entry.amount
        }
      }

      summary.pendingPayments += Math.max(plannedTotal - paidTotalForStudent, 0)
      summary.lastWeekPendingPayments += Math.max(plannedTotal - paidTotalBeforeWeekStart, 0)

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
      lastWeekCumulativeRevenue: 0,
      lastMonthRevenue: 0,
      lastWeekRevenue: 0,
      lastWeekPendingPayments: 0,
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

function useRevenueInsightsData() {
  const [summary, setSummary] = useState(null)
  const [monthlyRevenue, setMonthlyRevenue] = useState([])
  const [weeklyRevenue, setWeeklyRevenue] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await listStudents({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
        const students = Array.isArray(result?.data) ? result.data : []
        if (!active) return
        setSummary(calculateRevenueSummary(students))
        setMonthlyRevenue(buildMonthlyRevenueComparison(students))
        setWeeklyRevenue(buildWeeklyRevenueComparison(students))
      } catch {
        if (!active) return
        setSummary(calculateRevenueSummary([]))
        setMonthlyRevenue(buildMonthlyRevenueComparison([]))
        setWeeklyRevenue(buildWeeklyRevenueComparison([]))
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

  return { summary, monthlyRevenue, weeklyRevenue, isLoading }
}

function BusinessOwnerDashboard({ dashboard, revenueSummary, isRevenueLoading, monthlyRevenue, weeklyRevenue }) {
  const openMenu = useMobileMenu()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileDetails = {
    role: 'Business Head',
    status: 'Active',
    workspace: 'Cispro Ops',
    accessLevel: 'Business Owner',
    primaryEmail: 'business.owner@cispro.com',
    passwordMasked: 'ChangeMe123!',
    resetPasswordText: 'Send Reset Link',
    lastLogin: 'Today, 10:25 AM',
    initials: 'BW',
  }
  const profileStatTiles = [
    { icon: BadgeCheck, tone: 'blue', label: 'Status', value: profileDetails.status },
    { icon: Building2, tone: 'green', label: 'Workspace', value: profileDetails.workspace },
    { icon: ShieldCheck, tone: 'violet', label: 'Access Level', value: profileDetails.accessLevel },
    { icon: Clock3, tone: 'amber', label: 'Last Login', value: profileDetails.lastLogin },
  ]
  const profileDetailRows = [
    { icon: LockKeyhole, label: 'Password', value: profileDetails.passwordMasked },
    { icon: RefreshCcw, label: 'Reset Password', value: profileDetails.resetPasswordText },
    { icon: Clock3, label: 'Last Login', value: profileDetails.lastLogin },
  ]

  return (
    <section className="business-owner-dashboard">
      <PremiumDashboardTopbar
        eyebrow="Business Owner"
        title={dashboard.title}
        summary={dashboard.summary || "Welcome back! Here's what's happening with your business today."}
        initials={profileDetails.initials}
        profileTitle={profileDetails.role}
        email={profileDetails.primaryEmail}
        onOpenMenu={openMenu}
        onProfileClick={() => setIsProfileOpen(true)}
        profileAriaLabel="Open Business Owner profile"
      />

      <MemoRevenueSummaryRow summary={revenueSummary} isLoading={isRevenueLoading} />
      <MemoRevenueDashboards monthlyRevenueData={monthlyRevenue} weeklyRevenueData={weeklyRevenue} reverse={true} />
      <MemoAttendanceComparisonChart />
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title={profileDetails.role}
        email={profileDetails.primaryEmail}
        initials={profileDetails.initials}
        statTiles={profileStatTiles}
        detailRows={profileDetailRows}
        ariaLabelledBy="business-owner-profile-title"
      />
    </section>
  )
}

function formatRevenue(value) {
  return revenueFormatter.format(value)
}

function formatRevenueCompact(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount === 0) return ''

  return `₹${(amount / 100000).toFixed(2)}L`
}

function formatRevenueAxisLabel(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  if (amount === 0) return '₹0'

  const lakhs = amount / 100000
  const label = Number.isInteger(lakhs) ? `${lakhs}L` : `${lakhs.toFixed(1)}L`
  return `₹${label}`
}

function buildRevenueSummaryCards(summary, isLoading) {
  const formatValue = (value) => {
    if (isLoading) return 'Loading...'
    return formatRevenue(value ?? 0)
  }

  // 1. Total Revenue comparison
  const lastWeekCum = summary?.lastWeekCumulativeRevenue || 0
  const currentTotal = summary?.totalRevenue || 0
  const totalRevenueDiff = currentTotal - lastWeekCum
  const totalRevenuePct = lastWeekCum > 0 ? (totalRevenueDiff / lastWeekCum) * 100 : 0
  const totalChangeVal = lastWeekCum > 0 || totalRevenueDiff > 0
    ? (totalRevenuePct >= 0 ? '+' : '') + totalRevenuePct.toFixed(1) + '%'
    : '0.0%'
  const totalTone = totalRevenuePct >= 0 ? 'positive' : 'negative'

  // 2. This Month Revenue comparison
  const lastMonthVal = summary?.lastMonthRevenue || 0
  const currentMonthVal = summary?.thisMonthRevenue || 0
  const monthRevenueDiff = currentMonthVal - lastMonthVal
  const monthRevenuePct = lastMonthVal > 0 ? (monthRevenueDiff / lastMonthVal) * 100 : 0
  const monthChangeVal = lastMonthVal > 0 || monthRevenueDiff > 0
    ? (monthRevenuePct >= 0 ? '+' : '') + monthRevenuePct.toFixed(1) + '%'
    : '0.0%'
  const monthTone = monthRevenuePct >= 0 ? 'positive' : 'negative'

  // 3. This Week Revenue comparison
  const lastWeekVal = summary?.lastWeekRevenue || 0
  const currentWeekVal = summary?.thisWeekRevenue || 0
  const weekRevenueDiff = currentWeekVal - lastWeekVal
  const weekRevenuePct = lastWeekVal > 0 ? (weekRevenueDiff / lastWeekVal) * 100 : 0
  const weekChangeVal = lastWeekVal > 0 || weekRevenueDiff > 0
    ? (weekRevenuePct >= 0 ? '+' : '') + weekRevenuePct.toFixed(1) + '%'
    : '0.0%'
  const weekTone = weekRevenuePct >= 0 ? 'positive' : 'negative'

  // 4. Pending Payments comparison
  const lastWeekPendingVal = summary?.lastWeekPendingPayments || 0
  const currentPendingVal = summary?.pendingPayments || 0
  const pendingDiff = currentPendingVal - lastWeekPendingVal
  const pendingPct = lastWeekPendingVal > 0 ? (pendingDiff / lastWeekPendingVal) * 100 : 0
  const pendingChangeVal = lastWeekPendingVal > 0 || pendingDiff !== 0
    ? (pendingPct >= 0 ? '+' : '') + pendingPct.toFixed(1) + '%'
    : '0.0%'
  const pendingTone = pendingPct <= 0 ? 'positive' : 'negative'

  return [
    {
      label: 'Total Revenue',
      value: formatValue(summary?.totalRevenue),
      change: totalChangeVal,
      changeText: 'Than last week',
      changeTone: totalTone,
      accent: 'blue',
      icon: 'wallet',
      tooltip: 'Total Revenue shows the total income collected from all student fee payments across all courses and admissions.',
      details: [
        { label: 'Collected revenue', value: formatValue(summary?.totalRevenue) },
        { label: 'Students added', value: isLoading ? 'Loading...' : `${summary?.totalStudents || 0} students added` },
        { label: 'Scope', value: isLoading ? 'Loading...' : 'All paid installments across active records' },
      ],
    },
    {
      label: 'This Month Revenue',
      value: formatValue(summary?.thisMonthRevenue),
      change: monthChangeVal,
      changeText: 'Than last month',
      changeTone: monthTone,
      accent: 'purple',
      icon: 'calendar',
      tooltip: 'This Month Revenue shows the total income collected during the current month period.',
      details: [
        { label: 'Collected this month', value: formatValue(summary?.thisMonthRevenue) },
        { label: 'Admissions', value: isLoading ? 'Loading...' : `${summary?.thisMonthStudents || 0} admissions this month` },
        { label: 'Scope', value: isLoading ? 'Loading...' : 'Payments received from the current month window' },
      ],
    },
    {
      label: 'This Week Revenue',
      value: formatValue(summary?.thisWeekRevenue),
      change: weekChangeVal,
      changeText: 'Than last week',
      changeTone: weekTone,
      accent: 'amber',
      icon: 'trend',
      tooltip: 'This Week Revenue shows the total income collected during the current week.',
      details: [
        { label: 'Collected this week', value: formatValue(summary?.thisWeekRevenue) },
        { label: 'Admissions', value: isLoading ? 'Loading...' : `${summary?.thisWeekStudents || 0} admissions this week` },
        { label: 'Scope', value: isLoading ? 'Loading...' : 'Payments received from the current week window' },
      ],
    },
    {
      label: 'Pending Payments',
      value: formatValue(summary?.pendingPayments ?? summary?.expectedNextWeekRevenue),
      change: pendingChangeVal,
      changeText: 'Than last week',
      changeTone: pendingTone,
      accent: 'green',
      icon: 'target',
      tooltip: 'Pending Payments shows the outstanding amount that is still waiting to be collected.',
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

function PremiumDashboardTopbar({
  eyebrow,
  title,
  summary,
  initials,
  profileTitle,
  email,
  onOpenMenu,
  onProfileClick,
  profileAriaLabel,
}) {
  return (
    <div className="business-topbar is-business-owner-header !relative !flex min-w-0 flex-col gap-4 rounded-[20px] border border-slate-200 bg-white/95 px-4 py-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] backdrop-blur sm:px-5 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-5">
      <button
        type="button"
        className="mobile-menu-button dashboard-mobile-menu-button !inline-flex !h-10 !w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:!hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M4 12h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="operation-manager-mobile-brand !flex items-center gap-3 lg:!hidden" aria-hidden="true">
        <img
          className="operation-manager-mobile-brand-logo !h-11 !w-11 rounded-xl bg-white p-1 shadow-sm"
          src="/logo1.png"
          alt=""
        />
        <div className="operation-manager-mobile-brand-copy min-w-0">
          <strong className="block text-[1rem] font-extrabold tracking-[-0.02em] text-sky-700">Cispro Ops</strong>
        </div>
      </div>

      <div className="business-topbar-copy !min-w-0 !flex-1 lg:max-w-4xl">
        <p className="eyebrow text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-sky-600">{eyebrow}</p>
        <h2 className="mt-1 text-[1.75rem] font-semibold leading-[1.08] tracking-[-0.03em] text-slate-900 sm:text-[2rem] lg:text-[2.15rem]">
          {title}
        </h2>
        <p className="business-header-subtitle mt-1 max-w-3xl text-sm leading-6 text-slate-500 sm:text-[0.95rem]">
          {summary}
        </p>
      </div>

      <div className="business-topbar-actions !flex min-w-0 flex-wrap items-center gap-3 lg:ml-auto lg:justify-end">
        <DashboardNotificationBell />
        <HeaderIdentityChip
          initials={initials}
          title={profileTitle}
          email={email}
          className="operation-manager-profile-chip"
          onClick={onProfileClick}
          ariaLabel={profileAriaLabel}
        />
      </div>
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
    return <Wallet size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
  }

  if (kind === 'calendar') {
    return <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
  }

  if (kind === 'trend') {
    return <TrendingUp size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
  }

  if (kind === 'target') {
    return <Target size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
  }

  return (
<<<<<<< HEAD
    <Info size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
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
=======
    <section className="super-admin-page">
      <div className="super-admin-shell">
        {renderSidebar()}

        <div className="super-admin-main">
          {renderTopbar()}

          <main className="super-admin-content">
            <div className="branch-dashboard-content">
              {activeSection === 'dashboard' ? (
                <>
                  <div className="branch-dashboard-overview-intro">
                    <h1>Dashboard</h1>
                    <p>Welcome back! Here&apos;s an overview of your operations and today&apos;s activities.</p>
                  </div>

                  {!embeddedMode && mustResetPassword ? (
                    <section className="branch-dashboard-password-alert" aria-live="polite">
                      <div className="branch-dashboard-password-alert-copy">
                        <strong>Temporary password still active</strong>
                        <p>
                          You have not reset your temporary password yet. Please reset it now to secure your branch dashboard account.
                        </p>
                      </div>
                      <Button type="button" onClick={openResetPassword}>
                        Reset Password
                      </Button>
                    </section>
                  ) : null}
                

                  <div className="branch-dashboard-stats">
                    {overviewStats.map((stat) => (
                      <article key={stat.label} className="branch-dashboard-stat-card">
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                        <small>{stat.note}</small>
                      </article>
                    ))}
                  </div>

                  <BranchDashboardSection title="Today" description="A quick snapshot of branch activity.">
                    <div className="branch-dashboard-activity-grid">
                      <article className="branch-dashboard-panel">
                        <strong>Attendance</strong>
                        <p>224 students checked in before 10:00 AM.</p>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong>Revenue</strong>
                        <p>₹1.84L collected in the last 7 days.</p>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong>Follow-ups</strong>
                        <p>14 pending payment reminders scheduled for today.</p>
                      </article>
                    </div>
                  </BranchDashboardSection>
                </>
              ) : null}

              {activeSection === 'notifications' ? (
                <section className="notifications-page branch-notifications-page">
                  <header className="notifications-page-header">
                    <div className="notifications-page-copy">
                      <p className="eyebrow">Notifications</p>
                      <h2>Notifications</h2>
                      <p>
                        You have <strong>{branchNotificationTotalCount}</strong> notifications to go through
                        {branchPageUnreadNotificationCount ? (
                          <span> and {branchPageUnreadNotificationCount} unread items</span>
                        ) : null}{' '}
                        for {branchTitle}.
                      </p>
                    </div>

                    <div className="notifications-page-actions">
                      <button
                        type="button"
                        className="notifications-back-button"
                        onClick={() => goToBranchSection('dashboard')}
                      >
                        <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                        Back to dashboard
                      </button>

                      <button type="button" className="notifications-mark-read" onClick={markAllBranchNotificationsAsRead}>
                        <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                        Mark all as read
                      </button>
                    </div>
                  </header>

                  <div className="notifications-feed">
                    {branchNotificationSections.length ? (
                      branchNotificationSections.map((section) => (
                        <BranchNotificationGroup
                          key={section.label}
                          label={section.label}
                          items={section.items}
                          onView={openBranchNotificationTarget}
                          onAcceptRequest={acceptBranchCourseEditNotification}
                        />
                      ))
                    ) : (
                      <div className="notifications-empty-state">
                        <span className="notifications-empty-state-icon" aria-hidden="true">
                          <Bell size={22} strokeWidth={2.2} />
                        </span>
                        <div>
                          <h3>No notifications yet</h3>
                          <p>Branch login and faculty activity updates will appear here automatically.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {activeSection === 'students' ? (
                <BranchDashboardSection
                  title="Students"
                  description="Manage student registrations for this branch."
                  actions={(
                    <>
                      <button
                        type="button"
                        className="button button-solid"
                        onClick={openAddStudentForm}
                      >
                        + Add Student
                      </button>
                      <div className="branch-dashboard-section-summary">
                        <span>Total students:</span>
                        <strong>{filteredBranchStudents.length}</strong>
                      </div>
                    </>
                  )}
                >
                  <div className="faculty-search-filter-bar" style={{ marginBottom: '16px' }}>
                    <div
                      className="faculty-search-wrapper"
                      style={{
                        display: 'flex',
                        gap: '8px',
                        width: '370px',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search Student"
                        value={studentSearchTerm}
                        onChange={(e) => {
                          setStudentSearchTerm(e.target.value);
                          setStudentPage(1);
                        }}
                        className="faculty-search-input"
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      />

                      <button
                        type="button"
                        className="button button-solid"
                        style={{
                          height: '46px',
                          padding: '0 20px',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        Search
                      </button>
                    </div>
                  </div>
  
     
<div className="branch-course-table-shell">
  <table className="branch-course-table">
    <thead>
      <tr>
        <th>Student ID</th>
        <th>Student Name</th>
        <th>Course</th>
        <th>Total Fee</th>
        <th>Paid</th>
        <th>Next Installment</th>
        <th>Due Date</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>

    <tbody>
      {visibleBranchStudents.length ? (
        visibleBranchStudents.map((stu) => {

          // -----------------------------
          // Installments (correct field: installmentSchedule)
          // -----------------------------
          const installments = Array.isArray(stu.installmentSchedule)
            ? stu.installmentSchedule
            : []

          const totalFee = Number(
            stu.finalFee ?? stu.courseAmount ?? stu.totalAmount ?? stu.afterDiscount ?? 0
          )

          const paidAmount = installments.length
            ? installments.reduce(
                (sum, inst) => sum + Number(inst.paidAmount ?? inst.amountPaid ?? 0),
                0,
              )
            : Number(stu.paidAmount ?? stu.totalPaid ?? stu.amountPaid ?? 0)

          const nextInstallment = installments.find((installment) => {
            const installmentAmount = Number(installment.amount ?? installment.installmentAmount ?? 0)
            const installmentPaid = Number(installment.paidAmount ?? installment.amountPaid ?? 0)
            return installmentPaid < installmentAmount
          })

          const nextInstallmentAmount = nextInstallment
            ? Math.max(
                Number(nextInstallment.amount ?? nextInstallment.installmentAmount ?? 0) -
                  Number(nextInstallment.paidAmount ?? nextInstallment.amountPaid ?? 0),
                0,
              )
            : 0

          const nextDueDate = nextInstallment?.dueDate ?? nextInstallment?.date ?? null

          // -----------------------------
          // Status: Overdue / Upcoming / Completed
          // -----------------------------
          let paymentStatus = 'Upcoming'

          const allInstallmentsPaid =
            installments.length > 0 &&
            installments.every((inst) => {
              const amt = Number(inst.amount ?? inst.installmentAmount ?? 0)
              const paid = Number(inst.paidAmount ?? inst.amountPaid ?? 0)
              return paid >= amt
            })

          if (allInstallmentsPaid || (totalFee > 0 && paidAmount >= totalFee)) {
            paymentStatus = 'Completed'
          } else if (nextDueDate) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const dueDate = new Date(nextDueDate)
            if (!Number.isNaN(dueDate.getTime()) && dueDate < today) {
              paymentStatus = 'Overdue'
            } else {
              paymentStatus = 'Upcoming'
            }
          }

          const formatFee = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`

          const formatDueDate = (date) => {
            if (!date) return '-'
            const parsedDate = new Date(date)
            if (Number.isNaN(parsedDate.getTime())) return '-'
            return parsedDate.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          }

          return (
            <tr key={stu.studentId}>
              <td><strong>{stu.studentId || '-'}</strong></td>
              <td><strong className="branch-course-name">{stu.studentName || '-'}</strong></td>
              <td>
                <span className="branch-student-course">
                  {stu.courseName || stu.courseInterested || stu.course?.name || '-'}
                </span>
              </td>
              <td><strong>{formatFee(totalFee)}</strong></td>
              <td><span className="branch-student-paid">{formatFee(paidAmount)}</span></td>
              <td>
                {nextInstallment ? (
                  <div className="branch-next-installment">
                    <strong>{formatFee(nextInstallmentAmount)}</strong>
                    <span>
                      Installment {nextInstallment.installmentNumber || nextInstallment.number || ''}
                    </span>
                  </div>
                ) : (
                  <span className="branch-no-installment">-</span>
                )}
              </td>
              <td>
                <span className="branch-student-due-date">
                  {formatDueDate(nextDueDate)}
                </span>
              </td>
              <td>
                <span
                  className={`branch-student-payment-status ${paymentStatus
                    .toLowerCase()
                    .replace(/\s+/g, '-')}`}
                >
                  {paymentStatus}
                </span>
              </td>

              {/* Action */}
              <td style={{ textAlign: 'center' }}>
                <div
                  className={`branch-student-actions-cell ${
                    studentActionMenuId === stu.studentId ? 'menu-open' : ''
                  }`}
                  onMouseEnter={() => {
                    if (!studentActionMenuPinned) {
                      setStudentActionMenuId(stu.studentId)
                    }
                  }}
                  onMouseLeave={() => {
                    if (!studentActionMenuPinned) {
                      setStudentActionMenuId('')
                    }
                  }}
                >
                  <button
                    type="button"
                    className="branch-student-more-btn"
                    aria-label="Student actions"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (studentActionMenuId === stu.studentId) {
                        setStudentActionMenuId('')
                        setStudentActionMenuPinned(false)
                      } else {
                        setStudentActionMenuId(stu.studentId)
                        setStudentActionMenuPinned(true)
                      }
                    }}
                  >
                    <MoreVertical size={18} />
                  </button>

                  {studentActionMenuId === stu.studentId ? (
                    <div className="branch-student-actions-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setStudentActionMenuId('')
                          setStudentActionMenuPinned(false)
                          setViewStudentDrawer({ ...stu })
                        }}
                      >
                        <Eye size={15} />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStudentActionMenuId('')
                          setStudentActionMenuPinned(false)
                          openEditStudentForm({ ...stu })
                        }}
                      >
                        <Pencil size={15} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStudentActionMenuId('')
                          setStudentActionMenuPinned(false)
                          setRecordPaymentStudent({ ...stu })
                          goToBranchSection('payments')
                        }}
                      >
                        <Wallet size={15} />
                        <span>Record Payment</span>
                      </button>

                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => {
                          setStudentActionMenuId('')
                          setStudentActionMenuPinned(false)
                          setStudentDeleteTarget({ ...stu })
                        }}
                      >
                        <Trash2 size={15} />
                        <span>Delete</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </td>
            </tr>
          )
        })
      ) : (
        <tr>
          <td colSpan="9" className="branch-course-empty-state">
            No students yet. Use + Add Student to add the first one.
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>
                  {filteredBranchStudents.length > BRANCH_STUDENTS_PER_PAGE ? (
                    <div className="branch-course-pagination">
                      <button
                        type="button"
                        className="branch-course-pagination-button"
                        onClick={() => setStudentPage((c) => Math.max(1, c - 1))}
                        disabled={safeStudentPage === 1}
                      >
                        Prev
                      </button>
                      <div className="branch-course-pagination-pages" role="navigation" aria-label="Student pagination">
                        {Array.from({ length: totalStudentPages }, (_, i) => i + 1).map((pg) => (
                          <button
                            key={pg}
                            type="button"
                            className={`branch-course-pagination-page ${pg === safeStudentPage ? 'is-active' : ''}`.trim()}
                            onClick={() => setStudentPage(pg)}
                            aria-current={pg === safeStudentPage ? 'page' : undefined}
                          >
                            {pg}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="branch-course-pagination-button"
                        onClick={() => setStudentPage((c) => Math.min(totalStudentPages, c + 1))}
                        disabled={safeStudentPage === totalStudentPages}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'courses' ? (
                <BranchDashboardSection
                  title="Courses"
                  description="Add a course and the saved data will appear in the table below with every field from the form."
                  actions={(
                    <>
                      <button
                        type="button"
                        className="button button-solid"
                        onClick={openAddCourseModal}
                      >
                        + Add Course
                      </button>

                      <div className="branch-dashboard-section-summary">
                        <span>Saved courses:</span>
                        <strong>{filteredBranchCourseCards.length}</strong>
                      </div>
                    </>
                  )}
                >
                  <div className="faculty-search-filter-bar" style={{ marginBottom: '16px' }}>
                    <div
                      className="faculty-search-wrapper"
                      style={{
                        display: 'flex',
                        gap: '8px',
                        width: '370px',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search Courses"
                        value={courseSearchTerm}
                        onChange={(e) => setCourseSearchTerm(e.target.value)}
                        className="faculty-search-input"
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      />

                      <button
                        type="button"
                        className="button button-solid"
                        style={{
                          height: '46px',
                          padding: '0 20px',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        Search
                      </button>
                    </div>
                  </div>
                  <div className="branch-course-table-shell">
                    <table className="branch-course-table">
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Course Code</th>
                          <th>Course Name</th>
                          {/* <th>Mode</th>
                          <th>Duration</th>
                          <th>Hours</th> */}
                          {/* <th>Standard Fee</th>
                          <th>Registration Fee</th>
                          <th>Discount</th> */}
                          <th>Final Fee</th>

                          <th>Faculty</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleBranchCourses.length ? (
                          visibleBranchCourses.map((course, index) => {
                            const normalizedStatus = String(course.status || 'Active').toLowerCase()
                            const absoluteIndex = (safeBranchCoursePage - 1) * BRANCH_COURSES_PER_PAGE + index + 1

                            return (
                              <tr
                                key={course.id}
                                onClick={() => openViewCourseDrawer(course)}
                                className="branch-course-clickable-row"
                              >
                                <td>{absoluteIndex}</td>
                                <td>
                                  <div className="branch-course-code-cell">
                                    <strong>{course.courseCode || '-'}</strong>
                                  </div>
                                </td>
                                <td>
                                  <strong className="branch-course-name">{course.name || '-'}</strong>
                                </td>
                                {/* <td>{course.mode || '-'}</td>
                                <td>{course.duration ? `${course.duration} month${course.duration === '1' ? '' : 's'}` : '-'}</td>
                                <td>{course.hours ? `${course.hours} hour${course.hours === '1' ? '' : 's'}` : '-'}</td> */}
                                {/* <td>{formatBranchCourseAmount(course.actualFees)}</td>
                                <td>{formatBranchCourseAmount(course.registrationFees)}</td>
                                <td>{formatBranchCourseAmount(course.discount || '0')}</td> */}
                                <td>{formatBranchCourseFinalFee(course)}</td>

                                <td>
                                  <span className="branch-course-faculty-cell">
                                    {Array.isArray(course.assignedFaculty) && course.assignedFaculty.length > 0 ? (
                                      <span className="branch-course-faculty-summary">
                                        <span className="branch-course-faculty-primary">
                                          {course.assignedFaculty[0]?.name}
                                        </span>

                                        {course.assignedFaculty.length > 1 ? (
                                          <span className="branch-course-faculty-more-wrap">
                                            <button
                                              type="button"
                                              className="branch-course-faculty-more"
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              +{course.assignedFaculty.length - 1}
                                            </button>

                                            <span className="branch-course-faculty-tooltip">
                                              {course.assignedFaculty.slice(1).map((faculty) => (
                                                <span key={faculty.id} className="branch-course-faculty-tooltip-item">
                                                  {faculty.name}
                                                </span>
                                              ))}
                                            </span>
                                          </span>
                                        ) : null}
                                      </span>
                                    ) : (
                                      'Not Assigned'
                                    )}
                                  </span>
                                </td>
                                <td>
                                  <span className={`branch-course-status-pill ${normalizedStatus}`.trim()}>
                                    {course.status || 'Active'}
                                  </span>
                                </td>
                                <td onClick={(event) => event.stopPropagation()}>
                                  <div className="branch-course-actions-wrap">
                                    <button
                                      type="button"
                                      className="branch-course-actions-button"
                                      aria-label={`Course actions for ${course.name || course.courseCode || 'course'}`}
                                      aria-haspopup="menu"
                                      aria-expanded={openCourseActionMenuId === course.id}
                                      onMouseEnter={(e) => {
                                        if (courseActionCloseTimer.current) {
                                          clearTimeout(courseActionCloseTimer.current)
                                        }
                                        setOpenCourseActionMenuId(course.id)
                                        openCourseActionMenu(e.currentTarget)
                                      }}
                                      onMouseLeave={() => {
                                        courseActionCloseTimer.current = setTimeout(() => {
                                          setOpenCourseActionMenuId('')
                                          setCourseActionMenuPosition({ top: 0, left: 0 })
                                        }, 200)
                                      }}
                                      onClick={(e) => {
                                        if (openCourseActionMenuId === course.id) {
                                          setOpenCourseActionMenuId('')
                                          setCourseActionMenuPosition({ top: 0, left: 0 })
                                        } else {
                                          setOpenCourseActionMenuId(course.id)
                                          openCourseActionMenu(e.currentTarget)
                                        }
                                      }}
                                    >
                                      <MoreVertical size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                                    </button>

                                    {openCourseActionMenuId === course.id && courseActionMenuPosition && typeof document !== 'undefined'
                                      ? createPortal(
                                        <div
                                          className="branch-course-actions-menu"
                                          role="menu"
                                          aria-label="Course actions"
                                          style={{
                                            position: 'fixed',
                                            top: `${courseActionMenuPosition.top}px`,
                                            left: `${courseActionMenuPosition.left}px`,
                                            zIndex: 999999,
                                          }}
                                          onMouseEnter={() => {
                                            if (courseActionCloseTimer.current) {
                                              clearTimeout(courseActionCloseTimer.current)
                                            }
                                          }}
                                          onMouseLeave={() => {
                                            courseActionCloseTimer.current = setTimeout(() => {
                                              setOpenCourseActionMenuId('')
                                              setCourseActionMenuPosition({ top: 0, left: 0 })
                                            }, 200)
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            className="branch-course-actions-menu-item"
                                            onClick={() => {
                                              openViewCourseDrawer(course);
                                              setOpenCourseActionMenuId('');
                                              setCourseActionMenuPosition({ top: 0, left: 0 });
                                            }}
                                            role="menuitem"
                                          >
                                            <Eye size={16} />
                                            <span>View</span>
                                          </button>

                                          <button
                                            type="button"
                                            className="branch-course-actions-menu-item"
                                            onClick={() => {
                                              openAssignFacultyModal(course);
                                              setOpenCourseActionMenuId('');
                                              setCourseActionMenuPosition({ top: 0, left: 0 });
                                            }}
                                            role="menuitem"
                                          >
                                            <UserPlus size={16} />
                                            <span>Assign</span>
                                          </button>

                                          <button
                                            type="button"
                                            className="branch-course-actions-menu-item"
                                            onClick={() => {
                                              openEditCourseModal(course);
                                              setOpenCourseActionMenuId('');
                                              setCourseActionMenuPosition({ top: 0, left: 0 });
                                            }}
                                            role="menuitem"
                                          >
                                            <Pencil size={16} />
                                            <span>Edit</span>
                                          </button>

                                          <button
                                            type="button"
                                            className="branch-course-actions-menu-item is-danger"
                                            onClick={() => {
                                              openDeleteCourseConfirm(course);
                                              setOpenCourseActionMenuId('');
                                              setCourseActionMenuPosition({ top: 0, left: 0 });
                                            }}
                                            role="menuitem"
                                          >
                                            <Trash2 size={16} />
                                            <span>Delete</span>
                                          </button>
                                        </div>,
                                        document.body
                                      )
                                      : null}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan="12" className="branch-course-empty-state">
                              No courses saved yet. Use Add Course to create the first one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {branchCourseCards.length > BRANCH_COURSES_PER_PAGE ? (
                    <div className="branch-course-pagination">
                      <button
                        type="button"
                        className="branch-course-pagination-button"
                        onClick={() => setBranchCoursePage((current) => Math.max(1, current - 1))}
                        disabled={safeBranchCoursePage === 1}
                      >
                        Prev
                      </button>

                      <div className="branch-course-pagination-pages" role="navigation" aria-label="Course pagination">
                        {Array.from({ length: totalBranchCoursePages }, (_, index) => index + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            className={`branch-course-pagination-page ${page === safeBranchCoursePage ? 'is-active' : ''}`.trim()}
                            onClick={() => setBranchCoursePage(page)}
                            aria-current={page === safeBranchCoursePage ? 'page' : undefined}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="branch-course-pagination-button"
                        onClick={() => setBranchCoursePage((current) => Math.min(totalBranchCoursePages, current + 1))}
                        disabled={safeBranchCoursePage === totalBranchCoursePages}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'installments' ? (
                <BranchInstallmentTemplatesPage />
              ) : null}

              {activeSection === 'batches' ? (
                <BranchDashboardSection title="Batches" description="Current batch schedule overview.">
                  <div className="branch-dashboard-card-grid">
                    {batchCards.map((batch) => (
                      <article key={batch.title} className="branch-dashboard-info-card">
                        <strong>{batch.title}</strong>
                        <span>{batch.timing}</span>
                        <small>{batch.status}</small>
                      </article>
                    ))}
                  </div>
                </BranchDashboardSection>
              ) : null}
              {activeSection === 'payments' ? (
  recordPaymentStudent ? (
    <BranchDashboardSection
      title="Record Payment"
      description={`Recording payment for ${recordPaymentStudent.studentName || recordPaymentStudent.studentId || 'student'}.`}
      actions={(
        <button
          type="button"
          className="button button-ghost"
          onClick={() => setRecordPaymentStudent(null)}
        >
          <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
          Back to Payments
        </button>
      )}
    >
      <RecordPayment
        student={recordPaymentStudent}
        onClose={() => {
          setRecordPaymentStudent(null)
          void reloadBranchStudents()
        }}
      />
    </BranchDashboardSection>
  ) : (
    <BranchDashboardSection
      title="Payments"
      description="Track collections and pending dues across all students."
      actions={(
        <div className="branch-dashboard-section-summary">
          <span>Total students:</span>
          <strong>{filteredBranchPaymentRows.length}</strong>
        </div>
      )}
    >
      <div className="branch-dashboard-stats" style={{ marginBottom: '20px' }}>
        <article className="branch-dashboard-stat-card">
          <span>Total Collected</span>
          <strong>{formatBranchRupees(branchPaymentStats.totalCollected)}</strong>
          <small>Across all students</small>
        </article>
        <article className="branch-dashboard-stat-card">
          <span>Total Pending</span>
          <strong>{formatBranchRupees(branchPaymentStats.totalPending)}</strong>
          <small>Yet to be collected</small>
        </article>
        <article className="branch-dashboard-stat-card">
          <span>Overdue</span>
          <strong>{branchPaymentStats.overdueCount}</strong>
          <small>Students past due date</small>
        </article>
        <article className="branch-dashboard-stat-card">
          <span>Fully Paid</span>
          <strong>{branchPaymentStats.paidCount}</strong>
          <small>Students cleared in full</small>
        </article>
      </div>

      <div className="faculty-search-filter-bar" style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div className="faculty-search-wrapper" style={{ display: 'flex', gap: '8px', width: '370px' }}>
          <input
            type="text"
            placeholder="Search by student, ID or course"
            value={paymentSearchTerm}
            onChange={(e) => {
              setPaymentSearchTerm(e.target.value)
              setPaymentPage(1)
            }}
            className="faculty-search-input"
            style={{ flex: 1, minWidth: 0 }}
          />
        </div>

        <select
          value={paymentStatusFilter}
          onChange={(e) => {
            setPaymentStatusFilter(e.target.value)
            setPaymentPage(1)
          }}
          style={{ height: '46px', padding: '0 12px', borderRadius: '8px' }}
        >
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="partially-paid">Partially Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className="branch-course-table-shell">
        <table className="branch-course-table">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Student Name</th>
              <th>Course</th>
              <th>Total Fee</th>
              <th>Paid</th>
              <th>Pending</th>
              <th>Next Installment</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleBranchPaymentRows.length ? (
              visibleBranchPaymentRows.map(({ student, summary }) => (
                <tr key={student.studentId}>
                  <td><strong>{student.studentId || '-'}</strong></td>
                  <td><strong className="branch-course-name">{student.studentName || '-'}</strong></td>
                  <td>
                    <span className="branch-student-course">
                      {student.courseName || student.courseInterested || student.course?.name || '-'}
                    </span>
                  </td>
                  <td><strong>{formatBranchRupees(summary.totalFee)}</strong></td>
                  <td><span className="branch-student-paid">{formatBranchRupees(summary.paidAmount)}</span></td>
                  <td>{formatBranchRupees(summary.pendingAmount)}</td>
                  <td>
                    {summary.nextInstallment ? (
                      <div className="branch-next-installment">
                        <strong>{formatBranchRupees(summary.nextInstallmentAmount)}</strong>
                        <span>
                          Installment {summary.nextInstallment.installmentNumber || summary.nextInstallment.number || ''}
                        </span>
                      </div>
                    ) : (
                      <span className="branch-no-installment">-</span>
                    )}
                  </td>
                  <td>
                    <span className="branch-student-due-date">
                      {formatBranchPaymentDate(summary.nextDueDate)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`branch-student-payment-status ${summary.paymentStatus
                        .toLowerCase()
                        .replace(/\s+/g, '-')}`}
                    >
                      {summary.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button button-solid"
                      onClick={() => setRecordPaymentStudent({ ...student })}
                      disabled={summary.paymentStatus === 'Paid'}
                    >
                      Record Payment
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="branch-course-empty-state">
                  No payment records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredBranchPaymentRows.length > BRANCH_PAYMENTS_PER_PAGE ? (
        <div className="branch-course-pagination">
          <button
            type="button"
            className="branch-course-pagination-button"
            onClick={() => setPaymentPage((c) => Math.max(1, c - 1))}
            disabled={safePaymentPage === 1}
          >
            Prev
          </button>
          <div className="branch-course-pagination-pages" role="navigation" aria-label="Payment pagination">
            {Array.from({ length: totalPaymentPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                type="button"
                className={`branch-course-pagination-page ${pg === safePaymentPage ? 'is-active' : ''}`.trim()}
                onClick={() => setPaymentPage(pg)}
                aria-current={pg === safePaymentPage ? 'page' : undefined}
              >
                {pg}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="branch-course-pagination-button"
            onClick={() => setPaymentPage((c) => Math.min(totalPaymentPages, c + 1))}
            disabled={safePaymentPage === totalPaymentPages}
          >
            Next
          </button>
        </div>
      ) : null}
    </BranchDashboardSection>
  )
) : null}


              {activeSection === 'profile' ? (
                <BranchDashboardSection title="Profile" description="Branch profile and login details.">
                  <div className="branch-dashboard-profile-grid">
                    <article className="branch-dashboard-profile-panel">
                      <span>Branch Name</span>
                      <strong>{branchTitle}</strong>
                    </article>
                    <article className="branch-dashboard-profile-panel">
                      <span>Branch Admin</span>
                      <strong>{branchAdminDisplay}</strong>
                    </article>
                    <article className="branch-dashboard-profile-panel">
                      <span>Email</span>
                      <strong>{branchEmail}</strong>
                    </article>
                    <article className="branch-dashboard-profile-panel">
                      <span>Location</span>
                      <strong>{branchLocation}</strong>
                    </article>
                  </div>
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'faculty' ? (
                <BranchFacultyPage />
              ) : null}
            </div>
          </main>
        </div>

        {isAddCourseOpen ? (
          <div className="course-modal-backdrop" role="presentation">
            <form
              className="course-modal panel-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-add-course-title"
              onClick={(event) => event.stopPropagation()}
              onSubmit={handleAddCourseSubmit}
            >
              <div className="course-modal-header">
                <div>
                  <p className="section-kicker">Course Entry</p>
                  <h3 id="branch-add-course-title">{editingCourseId ? 'Edit Course' : 'Add Course'}</h3>
                </div>
                <span className="detail-badge">Required fields marked *</span>
              </div>

              <div className="course-stepper" aria-label="Course creation steps">
                <button
                  type="button"
                  className={`course-stepper-item ${addCourseStep === 1 ? 'is-active' : ''}`.trim()}
                  onClick={() => setAddCourseStep(1)}
                >
                  <span className="course-stepper-icon" aria-hidden="true">
                    <FileText size={20} strokeWidth={2.3} />
                  </span>
                  <strong>Basic Details</strong>
                </button>
                <button
                  type="button"
                  className={`course-stepper-item ${addCourseStep === 2 ? 'is-active' : ''}`.trim()}
                  onClick={() => {
                    handleCourseBasicNext()
                  }}
                  disabled={Object.keys(addCourseValidationErrors.basic).length > 0}
                >
                  <span className="course-stepper-icon" aria-hidden="true">
                    <Layers3 size={20} strokeWidth={2.3} />
                  </span>
                  <strong>Modules & Submodules</strong>
                </button>
                <button
                  type="button"
                  className={`course-stepper-item ${addCourseStep === 3 ? 'is-active' : ''}`.trim()}
                  onClick={() => {
                    if (addCourseStep === 1) {
                      handleCourseBasicNext()
                      return
                    }

                    if (addCourseStep === 2) {
                      handleCourseModulesNext()
                      return
                    }

                    setAddCourseStep(3)
                  }}
                  disabled={Boolean(Object.keys(addCourseValidationErrors.basic).length > 0 || addCourseValidationErrors.hierarchy.modelsError)}
                >
                  <span className="course-stepper-icon" aria-hidden="true">
                    <Wallet size={20} strokeWidth={2.3} />
                  </span>
                  <strong>Payment Plan</strong>
                </button>
              </div>

              <div className="course-step-caption">
                {addCourseStep === 1
                  ? 'Fill the course basics first. Then move to module setup.'
                  : addCourseStep === 2
                    ? 'Add modules and submodules. Continue when the hierarchy is complete.'
                    : 'Choose one or more payment plans. The installment amounts are split automatically from the final fee.'}
              </div>

              {addCourseStep === 1 ? (
                <div className="course-form-grid">
                  <Field
                    label="Course Code"
                    required
                    hint="Recommended unique identifier for reports and integrations"
                    error={shouldShowBasicAddCourseError('courseCode') ? addCourseValidationErrors.basic.courseCode : ''}
                  >
                    <input
                      type="text"
                      placeholder="CIS-001"
                      value={addCourseForm.courseCode || COURSE_CODE_PREFIX}
                      onChange={(event) => updateAddCourseField('courseCode', event.target.value)}
                      onBlur={() => markAddCourseTouched('courseCode')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('courseCode'))}
                    />
                  </Field>

                  <Field
                    label="Course Name"
                    required
                    hint="Required field"
                    error={shouldShowBasicAddCourseError('name') ? addCourseValidationErrors.basic.name : ''}
                  >
                    <input
                      type="text"
                      placeholder="Enter Course Name"
                      value={addCourseForm.name}
                      onChange={(event) => updateAddCourseField('name', event.target.value)}
                      onBlur={() => markAddCourseTouched('name')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('name'))}
                    />
                  </Field>

                  <Field
                    label="Mode"
                    required
                    hint="Online / Offline / Hybrid"
                    error={shouldShowBasicAddCourseError('mode') ? addCourseValidationErrors.basic.mode : ''}
                  >
                    <select
                      value={addCourseForm.mode}
                      onChange={(event) => updateAddCourseField('mode', event.target.value)}
                      onBlur={() => markAddCourseTouched('mode')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('mode'))}
                    >
                      <option value="" disabled>
                        Select Mode
                      </option>
                      <option>Online</option>
                      <option>Offline</option>
                      <option>Hybrid</option>
                    </select>
                  </Field>

                  <Field
                    label="Duration (Months)"
                    required
                    hint="Numbers only"
                    error={shouldShowBasicAddCourseError('duration') ? addCourseValidationErrors.basic.duration : ''}
                  >
                    <div className="course-input-with-suffix">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={addCourseForm.duration}
                        onChange={(event) => updateAddCourseNumericField('duration', event.target.value)}
                        onBlur={() => markAddCourseTouched('duration')}
                        aria-invalid={Boolean(shouldShowBasicAddCourseError('duration'))}
                      />
                      <span>{Number(addCourseForm.duration) === 1 ? 'month' : 'months'}</span>
                    </div>
                  </Field>

                  <Field
                    label="Hours"
                    required
                    hint="Numbers only"
                    error={shouldShowBasicAddCourseError('hours') ? addCourseValidationErrors.basic.hours : ''}
                  >
                    <div className="course-input-with-suffix">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={addCourseForm.hours}
                        onChange={(event) => updateAddCourseNumericField('hours', event.target.value)}
                        onBlur={() => markAddCourseTouched('hours')}
                        aria-invalid={Boolean(shouldShowBasicAddCourseError('hours'))}
                      />
                      <span>{Number(addCourseForm.hours) === 1 ? 'hour' : 'hours'}</span>
                    </div>
                  </Field>

                  <Field
                    label="Standard Course Fee"
                    required
                    hint="Default/base fee before adjustments"
                    error={shouldShowBasicAddCourseError('actualFees') ? addCourseValidationErrors.basic.actualFees : ''}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.actualFees}
                      onChange={(event) => updateAddCourseNumericField('actualFees', event.target.value)}
                      onBlur={() => markAddCourseTouched('actualFees')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('actualFees'))}
                    />
                  </Field>

                  <Field
                    label="Registration Fee"
                    required
                    hint="Registration fee amount"
                    error={shouldShowBasicAddCourseError('registrationFees') ? addCourseValidationErrors.basic.registrationFees : ''}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.registrationFees}
                      onChange={(event) => updateAddCourseNumericField('registrationFees', event.target.value)}
                      onBlur={() => markAddCourseTouched('registrationFees')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('registrationFees'))}
                    />
                  </Field>

                  <Field
                    label="Default Discount"
                    hint="Optional"
                    error={shouldShowBasicAddCourseError('discount') ? addCourseValidationErrors.basic.discount : ''}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={addCourseForm.discount}
                      onChange={(event) => updateAddCourseNumericField('discount', event.target.value)}
                      onBlur={() => markAddCourseTouched('discount')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('discount'))}
                    />
                  </Field>

                  <Field label="Final Fee" hint="Auto calculated from fee + registration - discount">
                    <input type="text" value={addCourseFinalFee} readOnly />
                  </Field>

                  <Field
                    label="Status"
                    required
                    hint="Active or Inactive"
                    error={shouldShowBasicAddCourseError('status') ? addCourseValidationErrors.basic.status : ''}
                  >
                    <select
                      value={addCourseForm.status}
                      onChange={(event) => updateAddCourseField('status', event.target.value)}
                      onBlur={() => markAddCourseTouched('status')}
                      aria-invalid={Boolean(shouldShowBasicAddCourseError('status'))}
                    >
                      <option value="Active">Active</option>
                      <option>Inactive</option>
                    </select>
                  </Field>
                </div>
              ) : addCourseStep === 2 ? (
                <div className="course-model-editor">
                  <div className="course-model-editor-header">
                    <p className="section-kicker">Modules & Submodules</p>
                  </div>

                  <div className="course-model-stage">
                    {courseEditorStage !== 'closed' && activeCourseModel ? (() => {
                      const modelIndex = activeCourseModelIndex
                      const model = activeCourseModel
                      const submodels = Array.isArray(model.submodels) ? model.submodels : []
                      const savedSubmodels = submodels.slice(0, Math.max(selectedSavedSubmodelIndex, 0))
                      const activeSubmodelIndex = Math.min(selectedSavedSubmodelIndex, Math.max(submodels.length - 1, 0))
                      const activeSubmodel = submodels[activeSubmodelIndex] || null
                      const showModuleCancel = modelIndex > 0
                      const showSubmodelCancel = activeSubmodelIndex > 0 || savedSubmodels.length > 0

                      return (
                        <section key={model.id} className="course-model-editor-card is-active is-lead" aria-expanded="true">
                          <div className="course-model-editor-card-header">
                            <div className="course-model-editor-card-heading">
                              <div className="course-model-editor-card-title-row">
                                <div className="course-model-editor-card-badge">{modelIndex + 1}</div>
                                <strong>Module {modelIndex + 1}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="course-model-editor-card-body">
                            {courseEditorStage === 'module' ? (
                              <Field
                                label="Module Name"
                                required
                                error={shouldShowModelNameError(modelIndex) ? addCourseValidationErrors.hierarchy.models?.[modelIndex]?.name : ''}
                              >
                                <input
                                  type="text"
                                  placeholder="Enter module name"
                                  value={model.name || ''}
                                  onChange={(event) => updateAddCourseModelField(modelIndex, 'name', event.target.value)}
                                  onBlur={() => markAddCourseTouched(`model-${modelIndex}-name`)}
                                  aria-invalid={Boolean(shouldShowModelNameError(modelIndex))}
                                />
                              </Field>
                            ) : (
                              <div className="course-module-summary-block">
                                <span className="course-module-summary-label">Module Name</span>
                                <strong>{model.name || `Module ${modelIndex + 1}`}</strong>
                              </div>
                            )}

                            {courseEditorStage === 'submodule' ? (
                              <div className="course-model-editor-submodels">
                                <div className="course-submodel-list-header">
                                  <strong>Sub Modules</strong>
                                  <span>{savedSubmodels.length} saved</span>
                                </div>

                                {savedSubmodels.length ? (
                                  <div className="course-submodule-checklist">
                                    {savedSubmodels.map((submodel, subIndex) => (
                                      <div key={submodel.id} className="course-submodule-checklist-item">
                                        <button
                                          type="button"
                                          className="course-submodule-checklist-item-body"
                                          onClick={() => handleCourseSubmodelEdit(modelIndex, subIndex)}
                                          aria-label={`Edit submodule ${subIndex + 1}`}
                                        >
                                          <span className="course-submodule-checkmark">✓</span>
                                          <div>
                                            <strong>{submodel.name || `Submodule ${subIndex + 1}`}</strong>
                                          </div>
                                        </button>
                                        <div className="course-submodule-checklist-actions">
                                          <button
                                            type="button"
                                            className="course-submodule-checklist-action course-submodule-checklist-edit"
                                            onClick={() => handleCourseSubmodelEdit(modelIndex, subIndex)}
                                            aria-label={`Edit submodule ${subIndex + 1}`}
                                          >
                                            <Pencil size={15} strokeWidth={2.2} />
                                          </button>
                                          <button
                                            type="button"
                                            className="course-submodule-checklist-action course-submodule-checklist-delete"
                                            onClick={() => handleCourseSubmodelDelete(modelIndex, subIndex)}
                                            aria-label={`Delete submodule ${subIndex + 1}`}
                                          >
                                            <Trash2 size={15} strokeWidth={2.2} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {isSubmoduleDraftOpen && activeSubmodel ? (
                                  <div className="course-submodel-row is-active">
                                    <Field
                                      label={`Submodule ${activeSubmodelIndex + 1}`}
                                      required
                                      error={shouldShowSubmodelError(modelIndex, activeSubmodelIndex) ? addCourseValidationErrors.hierarchy.models?.[modelIndex]?.submodels?.[activeSubmodelIndex]?.name : ''}
                                    >
                                      <input
                                        type="text"
                                        placeholder="Enter submodule name"
                                        value={activeSubmodel.name || ''}
                                        ref={activeSubmoduleInputRef}
                                        onChange={(event) => updateAddCourseSubmodelField(modelIndex, activeSubmodelIndex, event.target.value)}
                                        onBlur={() => markAddCourseTouched(`model-${modelIndex}-submodel-${activeSubmodelIndex}-name`)}
                                        aria-invalid={Boolean(shouldShowSubmodelError(modelIndex, activeSubmodelIndex))}
                                      />
                                    </Field>

                                    <div className="course-submodel-footer-actions">
                                      <div className="course-submodel-meta">
                                        <button
                                          type="button"
                                          className="course-inline-action"
                                          onClick={() => handleCourseSubmodelSave(modelIndex)}
                                        >
                                          Save
                                        </button>
                                        {showSubmodelCancel ? (
                                          <button
                                            type="button"
                                            className="course-inline-action course-inline-cancel"
                                            onClick={() => handleCourseSubmodelCancel(modelIndex)}
                                          >
                                            Cancel
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}

                                {shouldShowModelSubmodelsError(modelIndex) ? (
                                  <div className="course-validation-note course-validation-error course-model-inline-error">
                                    <span>{addCourseValidationErrors.hierarchy.models?.[modelIndex]?.submodelsError}</span>
                                  </div>
                                ) : null}
                                {isSubmoduleDraftOpen ? null : (
                                  <button
                                    type="button"
                                    className="button button-ghost course-add-submodel-button"
                                    onClick={() => openCourseSubmodelDraft(modelIndex)}
                                  >
                                    + Add Sub Model
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>

                          <div className="course-model-editor-card-footer">
                            {courseEditorStage === 'module' ? (
                              <>
                                {showModuleCancel ? (
                                  <button
                                    type="button"
                                    className="button button-ghost course-model-editor-card-cancel"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleCourseEditorCancel()
                                    }}
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="button button-solid course-model-editor-card-save-next"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleCourseModelSaveAndNext(modelIndex)
                                  }}
                                >
                                  Continue
                                </button>
                              </>
                            ) : !isSubmoduleDraftOpen ? (
                              <button
                                type="button"
                                className="button button-solid course-model-editor-card-save-next"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleCourseModuleFinalSave(modelIndex)
                                }}
                              >
                                Save Module
                              </button>
                            ) : null}
                          </div>
                        </section>
                      )
                    })() : null}
                  </div>

                  {courseEditorStage === 'closed' ? (
                    <div className="course-added-modules">
                      <div className="course-added-modules-header">
                        <div>
                          <h5>Modules</h5>
                          <span>{savedCourseRows.length} saved</span>
                        </div>
                        <button
                          type="button"
                          className="course-added-module-add-tile course-added-module-add-tile-inline"
                          onClick={addAddCourseModel}
                        >
                          + Add Module
                        </button>
                      </div>

                      {savedCourseRows.length ? (
                        <div className="course-added-modules-table">
                          <div className="course-added-modules-table-header">
                            <span>MODULE</span>
                            <span>MODULE %</span>
                            <span>SUBMODULES</span>
                            <span>ACTIONS</span>
                          </div>

                          <div className="course-added-modules-table-body">
                            {savedCourseRows.map((model, modelIndex) => {
                              const submodels = Array.isArray(model.submodels) ? model.submodels : []
                              const isExpanded = expandedSavedCourseModuleIds.includes(model.id)

                              return (
                                <article
                                  key={model.id}
                                  className={`course-added-modules-row ${modelIndex === selectedSavedModelIndex ? 'is-active' : ''}`}
                                >
                                  <div className="course-added-modules-row-main">
                                    <div className="course-added-modules-row-module">
                                      <span>Module {modelIndex + 1}</span>
                                      <strong>{model.name || `Module ${modelIndex + 1}`}</strong>
                                    </div>

                                    <div className="course-added-modules-row-percentage">
                                      <span className="course-table-percentage">{formatBranchCoursePercentage(model.percentage)}</span>
                                    </div>

                                    <div className="course-added-modules-row-submodules">
                                      <span className="course-table-percentage">{submodels.length} Submodules</span>
                                    </div>

                                    <div className="course-added-modules-row-actions">
                                      <button
                                        type="button"
                                        className="course-added-module-card-toggle"
                                        onClick={() => toggleSavedCourseModule(model.id)}
                                        aria-expanded={isExpanded}
                                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} module ${modelIndex + 1}`}
                                      >
                                        <ChevronDown
                                          size={18}
                                          strokeWidth={2.4}
                                          className={isExpanded ? 'is-open' : ''}
                                          aria-hidden="true"
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        className="course-added-module-card-edit"
                                        onClick={() => selectCourseModel(modelIndex)}
                                        aria-label={`Edit module ${modelIndex + 1}`}
                                      >
                                        <Pencil size={16} strokeWidth={2.2} />
                                      </button>
                                      <button
                                        type="button"
                                        className="course-added-module-card-delete"
                                        onClick={() => openCourseModuleDeleteConfirm(modelIndex)}
                                        disabled={savedCourseRows.length === 1}
                                        aria-label={`Delete module ${modelIndex + 1}`}
                                      >
                                        <Trash2 size={16} strokeWidth={2.2} />
                                      </button>
                                    </div>
                                  </div>

                                  {isExpanded ? (
                                    <div className="course-added-modules-row-details">
                                      <span>Sub Modules</span>
                                      <ul className="course-added-module-card-list">
                                        {submodels.length ? submodels.map((submodel, submodelIndex) => (
                                          <li key={submodel.id}>
                                            <span className="course-added-module-card-list-index">{submodelIndex + 1}</span>
                                            <strong>{submodel.name || `Submodule ${submodelIndex + 1}`}</strong>
                                            <span>{formatBranchCoursePercentage(submodel.percentage)}</span>
                                          </li>
                                        )) : (
                                          <li>No submodules yet</li>
                                        )}
                                      </ul>
                                    </div>
                                  ) : null}
                                </article>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="course-added-modules-empty">
                          <p>No modules added yet. Click "Add Module" to create your first module.</p>
                        </div>
                      )}

                    </div>
                  ) : null}
                </div>
              ) : addCourseStep === 3 ? (
                <div className="course-payment-plan-editor">
                  <div className="course-payment-plan-summary-grid">
                    <Field label="Final Fee" hint="Read only">
                      <input
                        type="text"
                        value={addCourseFinalFee ? formatBranchCourseAmount(addCourseFinalFee) : '-'}
                        readOnly
                      />
                    </Field>

                    <Field
                      label="Select Installment Plan"
                      hint="Choose one or more plans"
                      error={addCoursePaymentPlanVisibleError}
                    >
                      <div
                        ref={paymentPlanDropdownRef}
                        className={`course-payment-plan-dropdown ${isPaymentPlanDropdownOpen ? 'is-open' : ''}`.trim()}
                        aria-invalid={Boolean(addCoursePaymentPlanVisibleError)}
                      >
                        <button
                          type="button"
                          className={`course-payment-plan-dropdown-trigger ${addCoursePaymentPlanSelectedIds.length ? 'has-value' : ''}`.trim()}
                          onClick={() => setIsPaymentPlanDropdownOpen((current) => !current)}
                          aria-expanded={isPaymentPlanDropdownOpen}
                          aria-label="Select Installment Plan"
                        >
                          <span className="course-payment-plan-dropdown-trigger-copy">
                            <strong>
                              {addCoursePaymentPlanSelectedIds.length
                                ? `${addCoursePaymentPlanSelectedIds.length} selected`
                                : 'Select Payment Plan'}
                            </strong>
                            <small>
                              {addCoursePaymentPlanSelectedIds.length
                                ? 'Plans selected'
                                : 'Choose one or more plans'}
                            </small>
                          </span>
                          <ChevronDown size={18} strokeWidth={2.2} className={isPaymentPlanDropdownOpen ? 'is-open' : ''} aria-hidden="true" />
                        </button>

                        {isPaymentPlanDropdownOpen ? (
                          <div className="course-payment-plan-dropdown-panel" role="group" aria-label="Payment plan options">
                            <div
                              className="course-payment-plan-checklist"
                              role="group"
                              aria-label="Select payment plan"
                              aria-invalid={Boolean(addCoursePaymentPlanVisibleError)}
                            >
                              {isBranchInstallmentTemplatesLoading ? (
                                <div className="course-payment-plan-checklist-empty">Loading payment plans...</div>
                              ) : null}

                              {!isBranchInstallmentTemplatesLoading && !addCoursePaymentPlanOptions.length ? (
                                <div className="course-payment-plan-checklist-empty">No payment plans found</div>
                              ) : null}

                              {addCoursePaymentPlanOptions.map((template) => {
                                const templateId = String(template.id || '').trim()
                                const checked = addCoursePaymentPlanSelectedIds.includes(templateId)

                                return (
                                  <label
                                    key={templateId}
                                    className={`course-payment-plan-checklist-item ${checked ? 'is-checked' : ''}`.trim()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(event) => {
                                        markAddCourseTouched('paymentPlans')
                                        const nextSelected = new Set(addCoursePaymentPlanSelectedIds)
                                        if (event.target.checked) {
                                          nextSelected.add(templateId)
                                        } else {
                                          nextSelected.delete(templateId)
                                        }
                                        updateAddCoursePaymentPlanSelections(Array.from(nextSelected))
                                      }}
                                    />
                                    <span className="course-payment-plan-checkmark" aria-hidden="true">
                                      {checked ? <Check size={12} strokeWidth={3} /> : null}
                                    </span>
                                    <span className="course-payment-plan-checklist-copy">
                                      <strong>{template.templateName || `${template.installmentCount || 1} Installments`}</strong>
                                    </span>
                                  </label>
                                )
                              })}

                              <label
                                className={`course-payment-plan-checklist-item ${addCoursePaymentPlanSelectedIds.includes(BRANCH_PAYMENT_PLAN_CUSTOM_VALUE) ? 'is-checked' : ''}`.trim()}
                              >
                                <input
                                  type="checkbox"
                                  checked={addCoursePaymentPlanSelectedIds.includes(BRANCH_PAYMENT_PLAN_CUSTOM_VALUE)}
                                  onChange={(event) => {
                                    markAddCourseTouched('paymentPlans')
                                    const nextSelected = new Set(addCoursePaymentPlanSelectedIds)
                                    if (event.target.checked) {
                                      nextSelected.add(BRANCH_PAYMENT_PLAN_CUSTOM_VALUE)
                                    } else {
                                      nextSelected.delete(BRANCH_PAYMENT_PLAN_CUSTOM_VALUE)
                                    }
                                    updateAddCoursePaymentPlanSelections(Array.from(nextSelected))
                                  }}
                                />
                                <span className="course-payment-plan-checkmark" aria-hidden="true">
                                  {addCoursePaymentPlanSelectedIds.includes(BRANCH_PAYMENT_PLAN_CUSTOM_VALUE) ? <Check size={12} strokeWidth={3} /> : null}
                                </span>
                                <span className="course-payment-plan-checklist-copy">
                                  <strong>Custom</strong>
                                  <small>Manual installment count</small>
                                </span>
                              </label>
                            </div>

                            <div className="course-payment-plan-dropdown-footer">
                              <span>{addCoursePaymentPlanSelectedIds.length} selected</span>
                              <div className="course-payment-plan-footer-actions">
                                <button
                                  type="button"
                                  className="course-payment-plan-save-button"
                                  onClick={saveAddCoursePaymentPlans}
                                  disabled={!addCoursePaymentPlanSelectedIds.length}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="course-payment-plan-clear-button"
                                  onClick={() => {
                                    clearAddCoursePaymentPlans()
                                    setIsPaymentPlanDropdownOpen(true)
                                  }}
                                  disabled={!addCoursePaymentPlanSelectedIds.length}
                                >
                                  Clear All
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                      </div>
                    </Field>

                    {branchInstallmentTemplatesError ? (
                      <div className="course-validation-note">
                        <span>{branchInstallmentTemplatesError}</span>
                      </div>
                    ) : null}
                  </div>

                  {addCourseSavedPaymentPlanDisplayPlans.length ? (
                    <div className="course-payment-plan-saved-section">
                      <div className="course-payment-plan-saved-header">
                        <span>Selected Plans ({addCourseSavedPaymentPlanDisplayPlans.length})</span>
                      </div>

                      <div className="course-payment-plan-saved-list">
                        {addCourseSavedPaymentPlanDisplayPlans.map((plan, planIndex) => {
                          const planId = String(plan.id || `${plan.type}-${planIndex}`).trim()
                          const isOpen = addCourseSavedPaymentPlanId === planId
                          const customInstallmentCountValue = plan.type === 'custom'
                            ? String(addCourseDraftCustomPaymentPlan?.installmentCount || '')
                            : ''
                          const effectiveInstallmentCount = plan.type === 'custom'
                            ? Math.max(0, Number(customInstallmentCountValue || 0) || 0)
                            : Number(plan.installmentCount || 0) || 0
                          const effectiveInstallments = plan.type === 'custom'
                            ? (effectiveInstallmentCount > 0
                              ? buildBranchCoursePaymentPlanInstallments(addCourseFinalFee, effectiveInstallmentCount)
                              : [])
                            : plan.installments
                          const installmentLabel = plan.installmentCountLabel
                            ? `${plan.installmentCountLabel} ${Number(plan.installmentCountLabel) === 1 ? 'Installment' : 'Installments'}`
                            : 'Set count'

                          return (
                            <article key={planId} className={`course-payment-plan-saved-card ${isOpen ? 'is-open' : ''}`.trim()}>
                              <button
                                type="button"
                                className="course-payment-plan-saved-card-trigger"
                                onClick={() => {
                                  setAddCourseSavedPaymentPlanId((current) => (current === planId ? '' : planId))
                                }}
                              >
                                <span className="course-payment-plan-saved-card-copy">
                                  <strong>{plan.templateName || 'Payment Plan'}</strong>
                                  <small>{plan.type === 'custom' ? 'Manual installment count' : 'Installment plan'}</small>
                                </span>
                                <span className="course-payment-plan-saved-card-arrow" aria-hidden="true">
                                  <ChevronRight size={18} strokeWidth={2.2} />
                                </span>
                              </button>

                              {isOpen ? (
                                <div className="course-payment-plan-saved-card-body">
                                  {plan.type === 'custom' ? (
                                    <Field
                                      label="Number of Installments"
                                      required
                                      hint="Enter the number of parts for the final fee split"
                                    >
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={customInstallmentCountValue}
                                        onChange={(event) => {
                                          markAddCourseTouched('paymentPlans')
                                          updateAddCourseCustomPaymentPlanInstallmentCount(event.target.value)
                                        }}
                                      />
                                    </Field>
                                  ) : (
                                    <div className="course-payment-plan-meta">
                                      <span>{plan.dueRule || 'Admission'}</span>
                                    </div>
                                  )}

                                  <div className="course-payment-plan-count-inline">
                                    {installmentLabel}
                                  </div>

                                  {effectiveInstallments.length ? (
                                    <div className="course-payment-plan-table-shell">
                                      <table className="course-payment-plan-table">
                                        <thead>
                                          <tr>
                                            <th>Installment</th>
                                            <th>Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {effectiveInstallments.map((amount, installmentIndex) => (
                                            <tr key={`${plan.id}-${installmentIndex}`}>
                                              <td>Installment {installmentIndex + 1}</td>
                                              <td>{formatBranchCourseAmount(amount)}</td>
                                            </tr>
                                          ))}
                                          <tr className="course-payment-plan-total-row">
                                            <td><strong>Total</strong></td>
                                            <td><strong>{formatBranchCourseAmount(String(getBranchInstallmentAmountTotal(effectiveInstallments)))}</strong></td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="course-payment-plan-checklist-empty">
                                      Enter a custom installment count to split the final fee.
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="course-added-modules-empty">
                      <p>Click Save to show selected payment plans. After that, click a plan to view its installment table.</p>
                    </div>
                  )}
                </div>
              ) : null}

              {addCourseError ? (
                <div className="course-validation-note course-validation-error">
                  <span>{addCourseError}</span>
                </div>
              ) : null}

              <div className="course-form-actions">
                <button type="button" className="button button-ghost" onClick={resetAddCourseForm} disabled={isAddCourseSaving}>
                  Reset
                </button>
                {addCourseStep === 1 ? (
                  <button type="button" className="button button-solid" onClick={handleCourseBasicNext} disabled={isAddCourseSaving}>
                    Next
                  </button>
                ) : addCourseStep === 2 ? (
                  <div className="course-form-actions-group">
                    <button type="button" className="button button-ghost" onClick={() => setAddCourseStep(1)} disabled={isAddCourseSaving}>
                      Back
                    </button>
                    <button type="button" className="button button-solid" onClick={handleCourseModulesNext} disabled={isAddCourseSaving}>
                      Next
                    </button>
                  </div>
                ) : (
                  <div className="course-form-actions-group">
                    <button type="button" className="button button-ghost" onClick={() => setAddCourseStep(2)} disabled={isAddCourseSaving}>
                      Back
                    </button>
                    <button type="submit" className="button button-solid" disabled={isAddCourseSaving}>
                      {isAddCourseSaving ? 'Saving...' : editingCourseId ? 'Update Course' : 'Save Course'}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="course-modal-close"
                onClick={closeAddCourseModal}
                aria-label="Close course form"
                disabled={isAddCourseSaving}
              >
                <X size={22} strokeWidth={2} />
              </button>
            </form>
          </div>
        ) : null}





        {/* STEP 5 — ASSIGN FACULTY MODAL */}
        {isAssignFacultyOpen ? (() => {
          const FACULTY_PER_PAGE = 3
          const totalFacultyPages = Math.max(1, Math.ceil(facultyList.length / FACULTY_PER_PAGE))
          const safeAssignPage = Math.min(assignFacultyPage, totalFacultyPages)
          const facultyStart = (safeAssignPage - 1) * FACULTY_PER_PAGE
          const visibleFaculty = facultyList.slice(facultyStart, facultyStart + FACULTY_PER_PAGE)

          return (
            <div
              className="branch-modal-backdrop"
              role="presentation"

            >
              <div
                className="assign-faculty-modal-v2"
                role="dialog"
                aria-modal="true"
                aria-labelledby="assign-faculty-title"
                onClick={(event) => event.stopPropagation()}
              >
                {/* Close button */}
                <button
                  type="button"
                  className="assign-faculty-v2-close"
                  aria-label="Close assign faculty modal"
                  onClick={closeAssignFacultyModal}
                >
                  <X size={22} strokeWidth={2} />
                </button>

                {/* Header */}
                <div className="assign-faculty-v2-header">
                  <span className="assign-faculty-v2-kicker">ASSIGN FACULTY</span>
                  <h2 id="assign-faculty-title">
                    {assignFacultyCourse?.name || 'Course'}
                  </h2>
                  <div className="assign-faculty-v2-course-meta">
                    <span className="assign-faculty-v2-meta-pill">
                      <Code2 size={13} strokeWidth={2.4} />
                      {assignFacultyCourse?.courseCode || '-'}
                    </span>
                    <span className="assign-faculty-v2-meta-pill">
                      <BookOpen size={13} strokeWidth={2.4} />
                      {assignFacultyCourse?.name || '-'}
                    </span>
                  </div>
                </div>

                {/* Faculty cards — vertical list */}
                <div className="assign-faculty-v2-body">
                  <div className="assign-faculty-v2-label">
                    Select Faculty
                    <span className="assign-faculty-v2-count">
                      {selectedFacultyIds.length} selected
                    </span>
                  </div>

                  {facultyList.length > 0 ? (
                    <div className="assign-faculty-v2-cards">
                      {visibleFaculty.map((faculty) => {
                        const isChecked = selectedFacultyIds.includes(faculty.id)
                        return (
                          <label
                            key={faculty.id}
                            className={`assign-faculty-v2-card ${isChecked ? 'is-selected' : ''}`.trim()}
                          >
                            <input
                              type="checkbox"
                              className="assign-faculty-v2-checkbox"
                              checked={isChecked}
                              onChange={() => toggleFacultySelection(faculty.id)}
                            />
                            <span className="assign-faculty-v2-check-icon">
                              {isChecked ? <CheckCircle2 size={20} strokeWidth={2.4} /> : <CircleDot size={20} strokeWidth={1.8} />}
                            </span>
                            <div className="assign-faculty-v2-card-info">
                              <strong>{faculty.name}</strong>
                              <small>{faculty.id}</small>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="assign-faculty-v2-empty">
                      No faculty found. Add faculty in the Faculty tab first.
                    </div>
                  )}

                  {/* Pagination */}
                  {totalFacultyPages > 1 ? (
                    <div className="assign-faculty-v2-pagination">
                      <button
                        type="button"
                        className="assign-faculty-v2-page-btn"
                        disabled={safeAssignPage === 1}
                        onClick={() => setAssignFacultyPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={16} strokeWidth={2.5} />
                        Prev
                      </button>

                      <div className="assign-faculty-v2-page-dots">
                        {Array.from({ length: totalFacultyPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            className={`assign-faculty-v2-dot ${page === safeAssignPage ? 'is-active' : ''}`.trim()}
                            onClick={() => setAssignFacultyPage(page)}
                            aria-label={`Page ${page}`}
                            aria-current={page === safeAssignPage ? 'page' : undefined}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="assign-faculty-v2-page-btn"
                        disabled={safeAssignPage === totalFacultyPages}
                        onClick={() => setAssignFacultyPage((p) => Math.min(totalFacultyPages, p + 1))}
                      >
                        Next
                        <ChevronRight size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Footer */}
                <div className="assign-faculty-v2-footer">
                  <button
                    type="button"
                    className="assign-faculty-v2-cancel"
                    onClick={closeAssignFacultyModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="assign-faculty-v2-submit"
                    onClick={handleAssignFaculty}
                    disabled={isAssignFacultySaving}
                  >
                    {isAssignFacultySaving ? 'Assigning...' : `Assign Faculty (${selectedFacultyIds.length})`}
                  </button>
                </div>
              </div>
            </div>
          )
        })() : null}


        {/* ASSIGN FACULTY SUCCESS POPUP */}
        {assignFacultySuccess ? (
          <div
            className="branch-modal-backdrop"
            role="presentation"
          >
            <div
              className="assign-faculty-success-popup"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="assign-faculty-success-icon">
                <CheckCircle2 size={40} strokeWidth={2} />
              </div>

              <h3>Faculty Assigned!</h3>

              <p className="assign-faculty-success-course">
                {assignFacultySuccess.courseName}
              </p>

              <p className="assign-faculty-success-detail">
                {assignFacultySuccess.facultyNames.length > 0
                  ? <>Assigned to: <strong>{assignFacultySuccess.facultyNames.join(', ')}</strong></>
                  : 'All faculty removed from this course.'}
              </p>

              <button
                type="button"
                className="assign-faculty-success-btn"
                onClick={() => setAssignFacultySuccess(null)}
              >
                OK
              </button>
            </div>
          </div>
        ) : null}

        {viewCourse ? (
          <div
            className="branch-course-drawer-backdrop"
            role="presentation"
          >
            <aside
              className="branch-course-view-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-course-view-title"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header */}
              <div className="branch-course-view-drawer-header">
                <div className="branch-course-header-content">
                  <p className="section-kicker">COURSE DETAILS</p>
                  <h2 id="branch-course-view-title">{viewCourse.name || 'Course'}</h2>
                  <span className="branch-course-view-code">{viewCourse.courseCode || '-'}</span>
                </div>

                <div className="branch-course-view-header-actions">
                  <div className="branch-course-view-header-actions-row">
                    <strong
                      className={`branch-course-status-pill ${String(viewCourse.status || 'Active').toLowerCase()}`}
                    >
                      {viewCourse.status || 'Active'}
                    </strong>

                    <button
                      type="button"
                      className="branch-course-view-close"
                      onClick={closeViewCourseDrawer}
                      aria-label="Close course details"
                    >
                      <X size={22} strokeWidth={2} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="branch-course-view-edit"
                    onClick={() => {
                      closeViewCourseDrawer()
                      openEditCourseModal(viewCourse)
                    }}
                  >
                    Edit Course
                  </button>
                </div>
              </div>

              <div className="branch-course-view-body">
                <div className="branch-course-view-tabs" role="tablist" aria-label="Course details tabs">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewCourseTab === 'basic'}
                    className={`branch-course-view-tab ${viewCourseTab === 'basic' ? 'is-active' : ''}`}
                    onClick={() => setViewCourseTab('basic')}
                  >
                    Basic Details
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewCourseTab === 'modules'}
                    className={`branch-course-view-tab ${viewCourseTab === 'modules' ? 'is-active' : ''}`}
                    onClick={() => setViewCourseTab('modules')}
                  >
                    Modules &amp; Submodules
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewCourseTab === 'paymentPlans'}
                    className={`branch-course-view-tab ${viewCourseTab === 'paymentPlans' ? 'is-active' : ''}`}
                    onClick={() => setViewCourseTab('paymentPlans')}
                  >
                    Payment Plan
                  </button>
                </div>

                <div className="branch-course-view-content">
                  {viewCourseTab === 'basic' ? (
                    <div className="branch-course-view-table" role="table" aria-label="Course details">
                      <div className="branch-course-view-table-header" role="row">
                        <div className="branch-course-view-table-head" role="columnheader">DETAILS</div>
                        <div className="branch-course-view-table-head" role="columnheader">INFORMATION</div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <Monitor size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Mode</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourse.mode || '-'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <CalendarDays size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Duration</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>
                            {viewCourse.duration
                              ? `${viewCourse.duration} month${viewCourse.duration === '1' ? '' : 's'}`
                              : '-'}
                          </strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <Clock3 size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Hours</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>
                            {viewCourse.hours
                              ? `${viewCourse.hours} hour${viewCourse.hours === '1' ? '' : 's'}`
                              : '-'}
                          </strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <IndianRupee size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Standard Course Fee</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseAmount(viewCourse.actualFees)}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <IndianRupee size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Registration Fee</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseAmount(viewCourse.registrationFees)}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <BadgePercent size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Discount</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseAmount(viewCourse.discount || '0')}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row is-highlight" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <IndianRupee size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Final Fee</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseFinalFee(viewCourse)}</strong>
                        </div>
                      </div>

                      {/* <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <Tag size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Installment Template</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourseInstallmentTemplate.templateName || '-'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <BadgeInfo size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Installment Count</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourseInstallmentTemplate.installmentCount || '-'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <Shield size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Due Rule</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourseInstallmentTemplate.dueRule || '-'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <BadgePercent size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Customizable</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{viewCourseInstallmentTemplate.allowCustomization ? 'Yes' : 'No'}</strong>
                        </div>
                      </div>

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <RefreshCcw size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Installments</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong className="branch-course-view-installment-list">
                            {(Array.isArray(viewCourseInstallmentTemplate.installments) && viewCourseInstallmentTemplate.installments.length)
                              ? viewCourseInstallmentTemplate.installments.map((amount, index) => (
                                <span key={`${viewCourse.id || 'course'}-installment-${index}`}>
                                  {index + 1}. {formatBranchCourseAmount(amount)}
                                </span>
                              ))
                              : '-'}
                          </strong>
                        </div>
                      </div> */}

                      <div className="branch-course-view-row" role="row">
                        <div className="branch-course-view-cell branch-course-view-cell-label" role="cell">
                          <CalendarDays size={20} strokeWidth={2.1} aria-hidden="true" />
                          <span>Created At</span>
                        </div>
                        <div className="branch-course-view-cell branch-course-view-cell-value" role="cell">
                          <strong>{formatBranchCourseDate(viewCourse.createdAt)}</strong>
                        </div>
                      </div>
                    </div>
                  ) : viewCourseTab === 'paymentPlans' ? (
                    <section className="branch-course-view-payment-plan-section" aria-label="Payment plans">
                      <div className="branch-course-view-payment-plan-summary">
                        <span>Final Fee</span>
                        <strong>{formatBranchCourseAmount(viewCourseFinalFeeValue)}</strong>
                      </div>

                      {viewCoursePaymentPlans.length ? (
                        <div className="course-payment-plan-saved-list branch-course-view-payment-plan-list">
                          {viewCoursePaymentPlans.map((plan, planIndex) => {
                            const planId = String(plan.id || `${plan.type}-${planIndex}`).trim()
                            const isOpen = viewCoursePaymentPlanOpenId === planId
                            const rawInstallmentCount = String(plan.installmentCount || '').trim()
                            const installmentCount = Number(rawInstallmentCount || plan.installments?.length || 0) || 0
                            const installments = Array.isArray(plan.installments) && plan.installments.length
                              ? plan.installments
                              : installmentCount > 0
                                ? buildBranchCoursePaymentPlanInstallments(viewCourseFinalFeeValue, installmentCount)
                                : []

                            return (
                              <article key={planId} className={`course-payment-plan-saved-card ${isOpen ? 'is-open' : ''}`.trim()}>
                                <button
                                  type="button"
                                  className="course-payment-plan-saved-card-trigger"
                                  onClick={() => {
                                    setViewCoursePaymentPlanOpenId((current) => (current === planId ? '' : planId))
                                  }}
                                >
                                  <span className="course-payment-plan-saved-card-copy">
                                    <strong>{plan.templateName || 'Payment Plan'}</strong>
                                    <small>{plan.type === 'custom' ? 'Manual installment count' : 'Installment plan'}</small>
                                  </span>
                                  <span className="course-payment-plan-saved-card-arrow" aria-hidden="true">
                                    <ChevronRight size={18} strokeWidth={2.2} />
                                  </span>
                                </button>

                                {isOpen ? (
                                  <div className="course-payment-plan-saved-card-body">
                                    <div className="course-payment-plan-meta">
                                      <span>{plan.dueRule || 'Admission'}</span>
                                      <small>{plan.type === 'custom' ? 'Custom' : 'Template'}</small>
                                    </div>

                                    <div className="course-payment-plan-count-inline">
                                      {rawInstallmentCount
                                        ? `${rawInstallmentCount} ${Number(rawInstallmentCount) === 1 ? 'Installment' : 'Installments'}`
                                        : 'Set count'}
                                    </div>

                                    {installments.length ? (
                                      <div className="course-payment-plan-table-shell">
                                        <table className="course-payment-plan-table">
                                          <thead>
                                            <tr>
                                              <th>Installment</th>
                                              <th>Amount</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {installments.map((amount, installmentIndex) => (
                                              <tr key={`${planId}-${installmentIndex}`}>
                                                <td>Installment {installmentIndex + 1}</td>
                                                <td>{formatBranchCourseAmount(amount)}</td>
                                              </tr>
                                            ))}
                                            <tr className="course-payment-plan-total-row">
                                              <td><strong>Total</strong></td>
                                              <td><strong>{formatBranchCourseAmount(String(getBranchInstallmentAmountTotal(installments)))}</strong></td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <div className="course-payment-plan-checklist-empty">
                                        No installment data available for this plan.
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </article>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="course-added-modules-empty">
                          <p>No payment plans were saved for this course.</p>
                        </div>
                      )}
                    </section>
                  ) : (
                    <section className="branch-course-view-hierarchy" aria-label="Modules and submodules">
                      <div className="branch-course-view-hierarchy-header">
                        <div>
                          <p>Added Modules</p>
                          <strong>{viewCourseModels.length} Total</strong>
                        </div>
                        <span>Click the arrow to expand a module</span>
                      </div>

                      {viewCourseModels.length ? (
                        <div className="branch-course-view-models">
                          <div className="branch-course-view-model-table-header" role="row" aria-hidden="true">
                            <span>Module</span>
                            <span>Module Name</span>
                            <span>Percentage</span>
                            <span>Actions</span>
                          </div>
                          {viewCourseModels.map((model, modelIndex) => {
                            const isExpanded = expandedViewCourseModuleIds.includes(model.id)

                            return (
                              <article key={model.id} className="branch-course-view-model-card">
                                <div className="branch-course-view-model-row" role="row">
                                  <div className="branch-course-view-model-cell branch-course-view-model-cell-module" role="cell">
                                    <span>Module {modelIndex + 1}</span>
                                  </div>

                                  <div className="branch-course-view-model-cell branch-course-view-model-cell-name" role="cell">
                                    <strong>{model.name || `Module ${modelIndex + 1}`}</strong>
                                  </div>

                                  <div className="branch-course-view-model-cell branch-course-view-model-cell-percentage" role="cell">
                                    <b>{formatBranchCoursePercentage(model.percentage)}</b>
                                  </div>

                                  <div className="branch-course-view-model-cell branch-course-view-model-cell-actions" role="cell">
                                    <button
                                      type="button"
                                      className="branch-course-view-module-toggle"
                                      onClick={() => toggleViewCourseModule(model.id)}
                                      aria-expanded={isExpanded}
                                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${model.name || `Module ${modelIndex + 1}`}`}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown size={18} strokeWidth={2.4} aria-hidden="true" />
                                      ) : (
                                        <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {isExpanded ? (
                                  <div className="branch-course-view-submodels">
                                    {model.submodels.length ? (
                                      model.submodels.map((submodel, submodelIndex) => (
                                        <div key={submodel.id} className="branch-course-view-submodel">
                                          <div>
                                            <span>Submodel {submodelIndex + 1}</span>
                                            <strong>{submodel.name || `Submodel ${submodelIndex + 1}`}</strong>
                                          </div>
                                          <strong>{formatBranchCoursePercentage(submodel.percentage)}</strong>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="branch-course-view-submodel is-empty">
                                        <div>
                                          <span>Submodules</span>
                                          <strong>No submodules added</strong>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </article>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="branch-course-view-empty-state">
                          No modules added for this course.
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </div>

              {/* 12. Bottom Buttons */}
              <div className="branch-course-view-footer">

                {/* <button
          type="button"
          className="button button-ghost"
          onClick={closeViewCourseDrawer}
        >
          Close
        </button> */}

              </div>
            </aside>
          </div>
        ) : null}
        {courseSaveSuccess ? (
          <div className="branch-modal-backdrop" role="presentation" onClick={closeCourseSaveSuccess}>
            <div
              className="branch-success-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-course-success-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close success popup"
                onClick={closeCourseSaveSuccess}
              >
                <X size={22} strokeWidth={2} />
              </button>

              <div className="branch-success-hero" aria-hidden="true">
                <span className="branch-success-hero-ring" />
                <span className="branch-success-hero-icon">
                  <CheckCircle2 size={30} strokeWidth={2.1} />
                </span>
              </div>

              <div className="branch-success-copy">
                <p className="branch-success-kicker">Success</p>
                <h2 id="branch-course-success-title">{courseSaveSuccess.title}</h2>
                <p>{courseSaveSuccess.message}</p>
              </div>

              <div className="branch-success-actions">
                <button type="button" className="branch-success-secondary" onClick={closeCourseSaveSuccess}>
                  Close
                </button>
                <button type="button" className="branch-success-primary" onClick={closeCourseSaveSuccess}>
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {courseDeleteTarget ? (
          <div className="branch-modal-backdrop" role="presentation">
            <div
              className="branch-success-modal super-admin-logout-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-delete-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close delete confirmation"
                onClick={closeDeleteCourseConfirm}
              >
                <X size={22} strokeWidth={2} />
              </button>



              <h2 id="branch-delete-title">Delete this course?</h2>
              <p className="branch-delete-copy">
                {courseDeleteTarget.name || courseDeleteTarget.courseCode || 'This course'} will be removed from the table.
              </p>

              {courseActionError ? <p className="branch-delete-copy" style={{ color: '#dc2626' }}>{courseActionError}</p> : null}

              <div className="branch-modal-actions">
                <button type="button" className="branch-modal-cancel" onClick={closeDeleteCourseConfirm}>
                  Cancel
                </button>
                <button type="button" className="branch-modal-submit is-danger" onClick={handleDeleteCourseConfirm}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── STUDENT VIEW DRAWER ── */}
        {courseModuleDeleteTarget ? (
          <div className="branch-modal-backdrop" role="presentation">
            <div
              className="course-module-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="course-module-delete-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close delete confirmation"
                onClick={closeCourseModuleDeleteConfirm}
              >
                <X size={22} strokeWidth={2} />
              </button>

              <p className="course-module-delete-kicker">Delete module</p>
              <h2 id="course-module-delete-title">Are you sure you want to delete this module?</h2>
              <p className="branch-delete-copy">
                {courseModuleDeleteTarget.label} will be removed along with its submodules.
              </p>

              <div className="branch-modal-actions">
                <button
                  type="button"
                  className="branch-modal-cancel"
                  onClick={closeCourseModuleDeleteConfirm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="branch-modal-submit is-danger"
                  onClick={handleCourseModuleDeleteConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {courseSubmoduleDeleteTarget ? (
          <div className="branch-modal-backdrop" role="presentation">
            <div
              className="course-module-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="course-submodule-delete-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close delete confirmation"
                onClick={closeCourseSubmoduleDeleteConfirm}
              >
                <X size={22} strokeWidth={2} />
              </button>

              <p className="course-module-delete-kicker">Delete submodule</p>
              <h2 id="course-submodule-delete-title">Are you sure you want to delete this submodule?</h2>
              <p className="branch-delete-copy">
                {courseSubmoduleDeleteTarget.label} will be removed from this module.
              </p>

              <div className="branch-modal-actions">
                <button
                  type="button"
                  className="branch-modal-cancel"
                  onClick={closeCourseSubmoduleDeleteConfirm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="branch-modal-submit is-danger"
                  onClick={handleCourseSubmoduleDeleteConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {viewStudentDrawer ? (
          <div
            className="student-drawer-backdrop"
          >
            <aside
              className="student-view-drawer"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header */}
              <div className="student-view-drawer-header">
                <div>
                  <p className="student-drawer-kicker" style={{ color: '#2563eb' }}>
                    STUDENT DETAILS
                  </p>

                  <h2>
                    {viewStudentDrawer.studentName || 'Student'}
                  </h2>

                  <span className="student-drawer-id">
                    {viewStudentDrawer.studentId || '-'}
                  </span>
                </div>

                <button
                  type="button"
                  className="student-drawer-close"
                  onClick={() => setViewStudentDrawer(null)}
                  aria-label="Close student details"
                >
                  <X size={22} strokeWidth={2} />
                </button>
              </div>

              {/* Body */}
              <div className="student-view-drawer-body">

                {/* Basic Information */}
                <div className="student-detail-section">
                  <h3>Basic Information</h3>

                  <div className="student-detail-grid">

                    <div className="student-detail-item">
                      <span>Student ID</span>
                      <strong>
                        {viewStudentDrawer.studentId || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Student Name</span>
                      <strong>
                        {viewStudentDrawer.studentName || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Email Address</span>
                      <strong>
                        {viewStudentDrawer.emailAddress || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>LinkedIn URL</span>
                      <strong>
                        {viewStudentDrawer.linkedInUrl ? (
                          <a
                            href={formatExternalUrl(viewStudentDrawer.linkedInUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {viewStudentDrawer.linkedInUrl}
                          </a>
                        ) : '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Mobile Number</span>
                      <strong>
                        {viewStudentDrawer.mobileNumber || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Qualification</span>
                      <strong>
                        {viewStudentDrawer.qualification || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Current Status</span>
                      <strong>
                        {viewStudentDrawer.currentStatus || '-'}
                      </strong>
                    </div>

                  </div>
                </div>

                {/* Contact Information */}
                <div className="student-detail-section">
                  <h3>Contact Information</h3>

                  <div className="student-detail-grid">

                    <div className="student-detail-item">
                      <span>Parent / Spouse Number</span>
                      <strong>
                        {viewStudentDrawer.parentSpouseNumber || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Country</span>
                      <strong>
                        {viewStudentDrawer.country || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>State</span>
                      <strong>
                        {viewStudentDrawer.state || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>City</span>
                      <strong>
                        {viewStudentDrawer.city || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item student-detail-full">
                      <span>Address</span>
                      <strong>
                        {viewStudentDrawer.address || '-'}
                      </strong>
                    </div>

                  </div>
                </div>

                {/* Education */}
                <div className="student-detail-section">
                  <h3>Education Details</h3>

                  <div className="student-detail-grid">

                    <div className="student-detail-item">
                      <span>Qualification</span>
                      <strong>
                        {viewStudentDrawer.qualification || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Passed Out Year</span>
                      <strong>
                        {viewStudentDrawer.passedOutYear || '-'}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Designation</span>
                      <strong>
                        {viewStudentDrawer.designation || '-'}
                      </strong>
                    </div>

                  </div>
                </div>

                {/* Admission Details */}
                <div className="student-detail-section">
                  <h3>Admission Details</h3>

                  <div className="student-detail-grid">

                    <div className="student-detail-item">
                      <span>Admission Date</span>
                      <strong>
                        {formatStudentDate(
                          viewStudentDrawer.admissionDate
                        )}
                      </strong>
                    </div>

                    <div className="student-detail-item">
                      <span>Source</span>
                      <strong>
                        {viewStudentDrawer.source || '-'}
                      </strong>
                    </div>
                    {/* 
                    <div className="student-detail-item student-detail-full">
                      <span>Other Source</span>
                      <strong>
                        {viewStudentDrawer.sourceOther || '-'}
                      </strong>
                    </div> */}

                    <div className="student-detail-item student-detail-full">
                      <span>Remarks</span>
                      <strong>
                        {viewStudentDrawer.remarks || '-'}
                      </strong>
                    </div>

                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="student-view-drawer-footer">
                <button
                  type="button"
                  className="button button-solid"
                  onClick={() => {
                    const student = viewStudentDrawer

                    setViewStudentDrawer(null)
                    openEditStudentForm(student)
                  }}
                >
                  Edit Student
                </button>
              </div>

            </aside>
          </div>
        ) : null}

        {/* ── STUDENT VIEW DRAWER ── */}
        {viewStudentDrawer ? (
          <div
            className="student-drawer-overlay"
          >
            <aside
              className="student-view-drawer"
              onClick={(event) => event.stopPropagation()}
            >

              {/* Drawer Header */}
              <div className="student-drawer-header">

                <div className="student-drawer-title-area">
                  <p className="student-drawer-label">
                    STUDENT DETAILS
                  </p>

                  <h2>
                    {viewStudentDrawer.studentName || '-'}
                  </h2>

                  <span className="student-drawer-id">
                    {viewStudentDrawer.studentId || '-'}
                  </span>
                </div>

                <div className="student-drawer-header-actions">

                  <span
                    className={`student-drawer-status ${(viewStudentDrawer.currentStatus || '')
                      .toLowerCase()
                      .replace(/\s+/g, '-')
                      }`}
                  >
                    <span className="student-status-dot"></span>
                    {viewStudentDrawer.currentStatus || 'Student'}
                  </span>

                  <button
                    type="button"
                    className="student-drawer-edit-btn"
                    onClick={() => {
                      const student = viewStudentDrawer
                      setViewStudentDrawer(null)
                      openEditStudentForm(student)
                    }}
                  >
                    Edit Student
                  </button>

                  <button
                    type="button"
                    className="student-drawer-close"
                    onClick={() => setViewStudentDrawer(null)}
                    aria-label="Close student details"
                  >
                    <X size={22} strokeWidth={2} />
                  </button>

                </div>
              </div>

<div className="student-details-tabs">

  {/* Basic Details */}
  <button
    type="button"
    className={`student-details-tab ${
      studentDetailsTab === 'basic' ? 'active' : ''
    }`}
    onClick={() => setStudentDetailsTab('basic')}
  >
    Basic Details
  </button>

  {/* Education Details */}
  <button
    type="button"
    className={`student-details-tab ${
      studentDetailsTab === 'education' ? 'active' : ''
    }`}
    onClick={() => setStudentDetailsTab('education')}
  >
    Education Details
  </button>

  {/* Course & Payment Details */}
  <button
    type="button"
    className={`student-details-tab ${
      studentDetailsTab === 'payment' ? 'active' : ''
    }`}
    onClick={() => setStudentDetailsTab('payment')}
  >
    Course & Payment Details
  </button>

</div>

              {/* Details Table */}
              <div className="student-drawer-content">

                <div className="student-details-table">

                  <div className="student-details-table-head">
                    <div>DETAILS</div>
                    <div>INFORMATION</div>
                  </div>
                  
{studentDetailsTab === 'basic' ? (
  <>
    {/* Student ID
    <div className="student-details-row">
      <div className="student-details-label">Student ID</div>
      <div className="student-details-value">
        {viewStudentDrawer.studentId || '-'}
      </div>
    </div> */}

    {/* Student Name */}
    {/* <div className="student-details-row">
      <div className="student-details-label">Student Name</div>
      <div className="student-details-value">
        {viewStudentDrawer.studentName || '-'}
      </div>
    </div> */}

    {/* Email */}
    <div className="student-details-row">
      <div className="student-details-label">Email Address</div>
      <div className="student-details-value">
        {viewStudentDrawer.emailAddress || '-'}
      </div>
    </div>

    {/* Phone */}
    <div className="student-details-row">
      <div className="student-details-label">Phone Number</div>
      <div className="student-details-value">
        {viewStudentDrawer.mobileNumber || '-'}
      </div>
    </div>

    {/* Parent / Spouse */}
    <div className="student-details-row">
      <div className="student-details-label">
        Parent / Spouse Number
      </div>
      <div className="student-details-value">
        {viewStudentDrawer.parentSpouseNumber || '-'}
      </div>
    </div>

    {/* Country */}
    <div className="student-details-row">
      <div className="student-details-label">Country</div>
      <div className="student-details-value">
        {viewStudentDrawer.country || '-'}
      </div>
    </div>

    {/* State */}
    <div className="student-details-row">
      <div className="student-details-label">State</div>
      <div className="student-details-value">
        {viewStudentDrawer.state || '-'}
      </div>
    </div>

    {/* City */}
    <div className="student-details-row">
      <div className="student-details-label">City</div>
      <div className="student-details-value">
        {viewStudentDrawer.city || '-'}
      </div>
    </div>

    {/* Address */}
    <div className="student-details-row">
      <div className="student-details-label">Address</div>
      <div className="student-details-value">
        {viewStudentDrawer.address || '-'}
      </div>
    </div>
  </>
) : studentDetailsTab === 'education' ? (
  <>
    {/* Qualification */}
    <div className="student-details-row">
      <div className="student-details-label">Qualification</div>
      <div className="student-details-value">
        {viewStudentDrawer.qualification || '-'}
      </div>
    </div>

    {/* Passed Out Year */}
    <div className="student-details-row">
      <div className="student-details-label">Passed Out Year</div>
      <div className="student-details-value">
        {viewStudentDrawer.passedOutYear || '-'}
      </div>
    </div>

    {/* Designation */}
    <div className="student-details-row">
      <div className="student-details-label">Designation</div>
      <div className="student-details-value">
        {viewStudentDrawer.designation || '-'}
      </div>
    </div>

    {/* LinkedIn */}
    <div className="student-details-row">
      <div className="student-details-label">LinkedIn URL</div>
      <div className="student-details-value">
        {viewStudentDrawer.linkedInUrl ? (
          <a
            href={formatExternalUrl(viewStudentDrawer.linkedInUrl)}
            target="_blank"
            rel="noreferrer"
          >
            {viewStudentDrawer.linkedInUrl}
          </a>
        ) : (
          '-'
        )}
      </div>
    </div>

    {/* Admission Date */}
    <div className="student-details-row">
      <div className="student-details-label">Admission Date</div>
      <div className="student-details-value">
        {viewStudentDrawer.admissionDate
          ? formatStudentDate(viewStudentDrawer.admissionDate)
          : '-'}
      </div>
    </div>

    {/* Source */}
    <div className="student-details-row">
      <div className="student-details-label">Source</div>
      <div className="student-details-value">
        {viewStudentDrawer.source || '-'}
      </div>
    </div>

    {/* Remarks */}
    <div className="student-details-row">
      <div className="student-details-label">Remarks</div>
      <div className="student-details-value">
        {viewStudentDrawer.remarks || '-'}
      </div>
    </div>
  </>
) : (
  <>
    {/* Course */}
    <div className="student-details-row">
      <div className="student-details-label">Course</div>
      <div className="student-details-value">
        {viewStudentDrawer.courseName || '-'}
      </div>
    </div>

    {/* Faculty */}
    <div className="student-details-row">
      <div className="student-details-label">Faculty</div>
      <div className="student-details-value">
        {viewStudentDrawer.facultyName || '-'}
      </div>
    </div>

    {/* Course Amount */}
    <div className="student-details-row">
      <div className="student-details-label">Course Amount</div>
      <div className="student-details-value">
        {viewStudentDrawer.courseAmount
          ? `₹${viewStudentDrawer.courseAmount}`
          : '-'}
      </div>
    </div>

    {/* Payment Plan */}
    <div className="student-details-row">
      <div className="student-details-label">Payment Plan</div>
      <div className="student-details-value">
        {viewStudentDrawer.paymentPlan || '-'}
      </div>
    </div>

  {/* Installment Schedule */}
{Array.isArray(viewStudentDrawer.installmentSchedule) &&
  viewStudentDrawer.installmentSchedule.length > 0 && (
    <div className="student-installment-schedule">
      
      {/* Heading */}
      <div className="student-installment-schedule-title">
        Installment Schedule
      </div>

      {/* Full Width Table */}
      <div className="student-payment-table-wrapper">
        <table className="student-payment-installment-table">
          <thead>
            <tr>
              <th>Installment</th>
              <th>Amount</th>
              <th>Due Date</th>
              {/* <th>Status</th> */}
            </tr>
          </thead>

          <tbody>
            {viewStudentDrawer.installmentSchedule.map((inst, index) => (
              <tr key={`view-inst-${index}`}>
                <td>
                  Installment {inst.installmentNumber}
                </td>

                <td>
                  ₹
                  {(inst.amount || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>

                <td>
                  {inst.dueDate
                    ? new Date(inst.dueDate).toLocaleDateString('en-GB')
                    : '-'}
                </td>

                {/* <td>
                  <span
                    className={`status-badge status-${String(
                      inst.status || 'pending'
                    ).toLowerCase()}`}
                  >
                    {inst.status || 'Pending'}
                  </span>
                </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )}
  </>
)}
                </div>

              </div>
            </aside>
          </div>
        ) : null}
      


        {/* ── STUDENT FORM MODAL ── */}
        {isStudentFormOpen ? (
          <div className="course-modal-backdrop" role="presentation">
            <form
              className="course-modal panel-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-student-form-title"
              onClick={(event) => event.stopPropagation()}
              onSubmit={handleStudentFormSubmit}
              style={{
                maxWidth: 900,
                width: '92%',
                maxHeight: '92vh',
                overflowY: 'auto'
              }}
            >
              <div className="course-modal-header">
                <div>
                  <p className="section-kicker">Student Entry</p>
                  <h3 id="branch-student-form-title">
                    {studentFormMode === 'add' ? 'Add Student' : studentFormMode === 'edit' ? 'Edit Student' : 'View Student'}
                  </h3>
                </div>
                <span className="detail-badge">
                  {studentFormMode === 'view' ? 'Read-only' : 'Required fields marked *'}
                </span>
              </div>

              <div className={`student-stepper ${studentFormMode === 'view' ? 'is-view-mode' : ''}`.trim()}>
                {[
                  { step: 1, title: 'Personal & Education' },
                  { step: 2, title: 'Admission Details & Review' },
                  { step: 3, title: 'Course & Payment Plan' },
                ].map((item) => {
                  const isActive = studentFormStep === item.step
                  const isDone = studentFormStep > item.step
                  const content = (
                    <>
                      <span>{String(item.step).padStart(2, '0')}</span>
                      <div className="student-stepper-copy">
                        <strong>{item.title}</strong>
                      </div>
                    </>
                  )

                  return (
                    <button
                      key={item.step}
                      type="button"
                      className={`student-stepper-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`.trim()}
                      aria-current={isActive ? 'step' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setStudentFormStep(item.step)
                      }}
                    >
                      {content}
                    </button>
                  )
                })}
              </div>

              {studentFormMode !== 'view' && studentActiveStepError ? (
                <div className="course-validation-note course-validation-error" style={{ marginBottom: 12 }}>
                  <span>{studentActiveStepError}</span>
                </div>
              ) : null}

             <div className="student-step-panel">

  {/* =====================================================
      STEP 1 — PERSONAL & EDUCATION
  ====================================================== */}
  {studentFormStep === 1 && (
    <div className="student-step-section">
      <div className="course-form-grid student-form-grid-tight">

        <Field
          label="Student ID"
          required
          error={
            shouldShowStudentError('studentIdSuffix')
              ? studentFormValidationErrors.studentIdSuffix
              : ''
          }
        >
          <div className="student-id-input-group">
            <span className="student-id-prefix" aria-hidden="true">
              {STUDENT_ID_PREFIX}
            </span>

            <input
              type="text"
              inputMode="numeric"
              placeholder="001"
              value={studentForm.studentIdSuffix || ''}
              onChange={(e) =>
                updateStudentField('studentIdSuffix', e.target.value)
              }
              onBlur={() =>
                setStudentFormTouched((c) => ({
                  ...c,
                  studentIdSuffix: true,
                }))
              }
              disabled={studentFormMode === 'view'}
            />
          </div>
        </Field>

        <Field
          label="Student Name"
          required
          error={
            shouldShowStudentError('studentName')
              ? studentFormValidationErrors.studentName
              : ''
          }
        >
          <input
            type="text"
            placeholder="Enter student name"
            value={studentForm.studentName}
            onChange={(e) =>
              updateStudentField(
                'studentName',
                e.target.value.replace(/[^A-Za-z ]/g, '')
              )
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                studentName: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Email Address"
          required
          error={
            shouldShowStudentError('emailAddress')
              ? studentFormValidationErrors.emailAddress
              : ''
          }
        >
          <input
            type="email"
            placeholder="Enter email address"
            value={studentForm.emailAddress}
            onChange={(e) =>
              updateStudentField('emailAddress', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                emailAddress: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Mobile Number"
          required
          error={
            shouldShowStudentError('mobileNumber')
              ? studentFormValidationErrors.mobileNumber
              : ''
          }
        >
          <input
            type="text"
            inputMode="numeric"
            placeholder="10 digit mobile number"
            value={studentForm.mobileNumber}
            onChange={(e) =>
              updateStudentField(
                'mobileNumber',
                e.target.value.replace(/\D/g, '').slice(0, 10)
              )
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                mobileNumber: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Parent / Spouse Number"
          required
          error={
            shouldShowStudentError('parentSpouseNumber')
              ? studentFormValidationErrors.parentSpouseNumber
              : ''
          }
        >
          <input
            type="text"
            inputMode="numeric"
            placeholder="10 digit number"
            value={studentForm.parentSpouseNumber}
            onChange={(e) =>
              updateStudentField(
                'parentSpouseNumber',
                e.target.value.replace(/\D/g, '').slice(0, 10)
              )
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                parentSpouseNumber: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Country"
          required
          error={
            shouldShowStudentError('country')
              ? studentFormValidationErrors.country
              : ''
          }
        >
          <select
            value={studentForm.countryCode}
            onChange={(e) => {
              const code = e.target.value;
              const name =
                stuCountryOptions.find((c) => c.iso2 === code)?.name || '';

              setStudentForm((c) => ({
                ...c,
                countryCode: code,
                country: name,
                stateCode: '',
                state: '',
                city: '',
              }));
            }}
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                country: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          >
            <option value="" disabled>
              Select Country
            </option>

            {stuCountryOptions.map((c) => (
              <option key={c.iso2} value={c.iso2}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="State"
          required
          error={
            shouldShowStudentError('state')
              ? studentFormValidationErrors.state
              : ''
          }
        >
          <select
            value={studentForm.stateCode}
            onChange={(e) => {
              const code = e.target.value;
              const name =
                stuStateOptions.find((s) => s.iso2 === code)?.name || '';

              setStudentForm((c) => ({
                ...c,
                stateCode: code,
                state: name,
                city: '',
              }));
            }}
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                state: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              !studentForm.countryCode
            }
          >
            <option value="" disabled>
              Select State
            </option>

            {stuStateOptions.map((s) => (
              <option key={s.iso2} value={s.iso2}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="City"
          required
          error={
            shouldShowStudentError('city')
              ? studentFormValidationErrors.city
              : ''
          }
        >
          <select
            value={studentForm.city}
            onChange={(e) =>
              updateStudentField('city', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                city: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              !studentForm.stateCode
            }
          >
            <option value="" disabled>
              Select City
            </option>

            {stuCityOptions.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Address"
          required
          error={
            shouldShowStudentError('address')
              ? studentFormValidationErrors.address
              : ''
          }
        >
          <input
            type="text"
            placeholder="Enter full address"
            value={studentForm.address}
            onChange={(e) =>
              updateStudentField('address', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                address: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Qualification"
          required
          error={
            shouldShowStudentError('qualification')
              ? studentFormValidationErrors.qualification
              : ''
          }
        >
          <input
            type="text"
            placeholder="Enter qualification"
            value={studentForm.qualification}
            onChange={(e) =>
              updateStudentField('qualification', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                qualification: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Passed Out Year"
          required
          error={
            shouldShowStudentError('passedOutYear')
              ? studentFormValidationErrors.passedOutYear
              : ''
          }
        >
          <select
            value={studentForm.passedOutYear}
            onChange={(e) =>
              updateStudentField('passedOutYear', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                passedOutYear: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          >
            <option value="" disabled>
              Select Year
            </option>

            {PASSED_OUT_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}

            <option value="Custom">Custom</option>
          </select>
        </Field>

        {studentForm.passedOutYear === 'Custom' && (
          <Field
            label="Specify Year"
            required
            error={
              shouldShowStudentError('passedOutYearCustom')
                ? studentFormValidationErrors.passedOutYearCustom
                : ''
            }
          >
            <input
              type="text"
              placeholder="Enter year"
              value={studentForm.passedOutYearCustom}
              onChange={(e) =>
                updateStudentField(
                  'passedOutYearCustom',
                  e.target.value
                )
              }
              onBlur={() =>
                setStudentFormTouched((c) => ({
                  ...c,
                  passedOutYearCustom: true,
                }))
              }
              disabled={studentFormMode === 'view'}
            />
          </Field>
        )}

      </div>
    </div>
  )}


  {/* =====================================================
      STEP 2 — ADMISSION DETAILS & REVIEW
  ====================================================== */}
  {studentFormStep === 2 && (
    <div className="student-step-section">
      <div className="course-form-grid student-form-grid-tight">

        <Field label="LinkedIn URL">
          <input
            type="text"
            inputMode="url"
            placeholder="https://www.linkedin.com/in/your-profile"
            value={studentForm.linkedInUrl}
            onChange={(e) =>
              updateStudentField('linkedInUrl', e.target.value)
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Current Status"
          required
          error={
            shouldShowStudentError('currentStatus')
              ? studentFormValidationErrors.currentStatus
              : ''
          }
        >
          <select
            value={studentForm.currentStatus}
            onChange={(e) => {
              const val = e.target.value;

              setStudentForm((c) => ({
                ...c,
                currentStatus: val,
                designation:
                  val !== 'Employee' ? '' : c.designation,
              }));
            }}
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                currentStatus: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          >
            <option value="" disabled>
              Select Status
            </option>
            <option value="Student">Student</option>
            <option value="Employee">Employee</option>
            <option value="Other">Other</option>
          </select>
        </Field>

        <Field
          label="Designation"
          required={studentForm.currentStatus === 'Employee'}
          error={
            shouldShowStudentError('designation')
              ? studentFormValidationErrors.designation
              : ''
          }
        >
          <input
            type="text"
            placeholder={
              studentForm.currentStatus === 'Employee'
                ? 'Enter designation'
                : 'Select Employee first'
            }
            value={studentForm.designation}
            onChange={(e) =>
              updateStudentField('designation', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                designation: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              studentForm.currentStatus !== 'Employee'
            }
          />
        </Field>

        <Field
          label="How did you know about our Institute?"
          required
          error={
            shouldShowStudentError('source')
              ? studentFormValidationErrors.source
              : ''
          }
        >
          <select
            value={studentForm.source}
            onChange={(e) =>
              updateStudentField('source', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                source: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          >
            <option value="" disabled>
              Select Source
            </option>
            <option value="Sulekha">Sulekha</option>
            <option value="Justdial">Justdial</option>
            <option value="Website">Website</option>
            <option value="Poster">Poster</option>
            <option value="Others">Others</option>
          </select>
        </Field>

        {studentForm.source === 'Others' && (
          <Field
            label="Please Specify"
            required
            error={
              shouldShowStudentError('sourceOther')
                ? studentFormValidationErrors.sourceOther
                : ''
            }
          >
            <input
              type="text"
              placeholder="How did you hear about us?"
              value={studentForm.sourceOther}
              onChange={(e) =>
                updateStudentField('sourceOther', e.target.value)
              }
              onBlur={() =>
                setStudentFormTouched((c) => ({
                  ...c,
                  sourceOther: true,
                }))
              }
              disabled={studentFormMode === 'view'}
            />
          </Field>
        )}

        <Field label="Remarks">
          <input
            type="text"
            placeholder="Optional remarks"
            value={studentForm.remarks}
            onChange={(e) =>
              updateStudentField('remarks', e.target.value)
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

        <Field
          label="Admission Date"
          required
          error={
            shouldShowStudentError('admissionDate')
              ? studentFormValidationErrors.admissionDate
              : ''
          }
        >
          <input
            type="date"
            value={studentForm.admissionDate}
            onChange={(e) =>
              updateStudentField('admissionDate', e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                admissionDate: true,
              }))
            }
            disabled={studentFormMode === 'view'}
          />
        </Field>

      </div>
    </div>
  )}


  {/* =====================================================
      STEP 3 — COURSE & PAYMENT PLAN
  ====================================================== */}
  {studentFormStep === 3 && (
    <div className="student-step-section">

     

      <div className="course-form-grid student-form-grid-tight">

        <Field
          label="Select Course"
          required
          error={
            shouldShowStudentError('courseId')
              ? studentFormValidationErrors.courseId
              : ''
          }
        >
          <select
            value={studentForm.courseId}
            onChange={(e) =>
              handleStudentCourseChange(e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                courseId: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              !studentCourseOptions.length
            }
          >
            <option value="">Select Course</option>

            {studentCourseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}

            {!studentCourseOptions.length && (
              <option value="" disabled>
                No courses available
              </option>
            )}
          </select>
        </Field>

        <Field
          label="Select Faculty"
          required
          error={
            shouldShowStudentError('facultyName')
              ? studentFormValidationErrors.facultyName
              : ''
          }
        >
          <select
            value={studentForm.facultyId}
            onChange={(e) =>
              handleStudentFacultyChange(e.target.value)
            }
            onBlur={() =>
              setStudentFormTouched((c) => ({
                ...c,
                facultyName: true,
              }))
            }
            disabled={
              studentFormMode === 'view' ||
              !studentForm.courseId ||
              !selectedStudentCourseFacultyOptions.length
            }
          >
            <option value="">Select Faculty</option>

            {selectedStudentCourseFacultyOptions.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>
                {faculty.name}
              </option>
            ))}

            {studentForm.courseId &&
              !selectedStudentCourseFacultyOptions.length && (
                <option value="" disabled>
                  No faculty assigned to this course
                </option>
              )}
          </select>
        </Field>

        <Field
          label="Total Course Amount"
          required
          error={
            shouldShowStudentError('courseAmount')
              ? studentFormValidationErrors.courseAmount
              : ''
          }
        >
          <input
            type="text"
            value={selectedStudentCourseAmount}
            readOnly
            placeholder={
              studentForm.courseId
                ? 'Auto-filled from selected course'
                : 'Select course first'
            }
          />
        </Field>

   <Field label="Payment Plan" required>
  <select
    value={studentForm.paymentPlanId || ''}
    onChange={(e) => {
      const planId = e.target.value

      const selectedPlan =
        selectedStudentCoursePaymentPlans.find(
          (plan) => String(plan.id) === String(planId)
        ) || null

      setStudentForm((current) => ({
        ...current,
        paymentPlanId: planId,
        paymentPlan: selectedPlan?.templateName || '',
      }))
    }}
    disabled={
      studentFormMode === 'view' ||
      !studentForm.courseId ||
      !selectedStudentCoursePaymentPlans.length
>>>>>>> hema_dev
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
            <div className="revenue-summary-card-header">
              <div className="revenue-summary-header-left">
                <div className={`revenue-summary-icon ${card.accent}`} aria-hidden="true">
                  <SummaryIcon kind={card.icon} />
                </div>
                <strong className="revenue-summary-label">{card.label}</strong>
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
                </div>
              </button>
            </div>
            <div className="revenue-summary-value-row">
              {isLoading ? (
                <div className="revenue-summary-loading" aria-label={`Loading ${card.label}`}>
                  <span className={`revenue-summary-loading-ring ${card.accent}`} aria-hidden="true" />
                  <strong>Loading...</strong>
                </div>
              ) : (
                <div
                  className={`revenue-summary-value ${card.label === 'Total Revenue' ? 'is-total-revenue' : ''}`}
                >
                  {card.value}
                </div>
              )}
            </div>
            {card.change ? (
              <>
                <div className="revenue-summary-card-divider" />
                <div className="revenue-summary-trend-row">
                  <span className={`revenue-summary-trend-badge ${card.changeTone || 'positive'}`}>
                    {card.change}
                  </span>
                  <span className="revenue-summary-trend-label">{card.changeText}</span>
                </div>
              </>
            ) : null}
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

  useEffect(() => {
    setActiveIndex(null)
  }, [visibleMonthlyData])

  return (
    <article className="panel-card revenue-comparison-card revenue-monthly-card">
      <div className="revenue-comparison-header">
        <div className="revenue-comparison-header-copy">
          <div className="revenue-card-title-row">
            <div className="revenue-title-group">
              <TrendingUp size={18} strokeWidth={2.4} className="revenue-title-icon" aria-hidden="true" />
              <h3>Monthly Revenue vs Expected Revenue</h3>
            </div>
            {/* existing info icon button already renders separately via ChartInfoTrigger, leave as is */}
          </div>
          <div className="revenue-legend customer-satisfaction-legend" aria-hidden="true">
            <span className="revenue-legend-item tone-blue">
              <span className="revenue-legend-dot blue" />
              Actual Revenue
            </span>
            <span className="revenue-legend-item tone-yellow">
              <span className="revenue-legend-dot yellow" />
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
              <span key={tick}>{formatRevenueAxisLabel(tick)}</span>
            ))}
        </div>

        <div className="revenue-monthly-stack">
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

            <div
              className="revenue-groups"
              style={{ gridTemplateColumns: `repeat(${Math.max(visibleMonthlyData.length, 1)}, minmax(0, 1fr))` }}
            >
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
      </div>

      <div className="chart-card-footer" aria-hidden="true">
        <span>View Details</span>
        <ChevronRight size={16} strokeWidth={2.4} />
      </div>
    </article>
  )
}

function getWeeklyTicks(chartMax) {
  let step = 50000
  if (chartMax > 300000) {
    step = 100000
  } else if (chartMax > 150000) {
    step = 100000
  } else if (chartMax > 80000) {
    step = 50000
  } else if (chartMax > 40000) {
    step = 25000
  } else {
    step = 10000
  }
  const ticksList = []
  for (let val = 0; val <= chartMax; val += step) {
    ticksList.push(val)
  }
  return ticksList
}

function formatWeeklyAxisLabel(value) {
  if (value === 0) return '0'
  if (value % 1000 === 0) {
    return `${value / 1000}K`
  }
  return new Intl.NumberFormat('en-IN').format(value)
}

function WeeklyRevenueChart({ data = [] }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const chartMax = getChartMax(data, 10000)
  const activePoint = activeIndex === null ? null : data[activeIndex]
  const tooltipTop =
    activeIndex === null
      ? '50%'
      : `${Math.min(82, Math.max(18, ((activeIndex + 0.5) / Math.max(data.length, 1)) * 100))}%`

  const widthScale = 1
  const ticks = getWeeklyTicks(chartMax)

  return (
    <article className="panel-card revenue-comparison-card revenue-weekly-card">
      <div className="revenue-comparison-header">
        <div className="revenue-comparison-header-copy">
          <div className="revenue-card-title-row">
            <div className="revenue-title-group">
              <Wallet size={18} strokeWidth={2.4} className="revenue-title-icon" aria-hidden="true" />
              <h3>Weekly Revenue vs Expected Revenue</h3>
            </div>
          </div>
          <div className="revenue-legend customer-satisfaction-legend" aria-hidden="true">
            <span className="revenue-legend-item tone-blue">
              <span className="revenue-legend-dot blue" />
              Actual Revenue
            </span>
            <span className="revenue-legend-item tone-yellow">
              <span className="revenue-legend-dot yellow" />
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
            {ticks.map((tick) => {
              if (tick === 0) return null
              return (
                <span
                  key={tick}
                  style={{
                    position: 'absolute',
                    left: `${(tick / chartMax) * 100 * widthScale}%`,
                    top: 0,
                    bottom: 0,
                    borderLeft: '1px dashed #dde5ef',
                  }}
                />
              )
            })}
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
              const weeklyWidth = `${chartMax ? (item.actual / chartMax) * 100 * widthScale : 0}%`
              const expectedWidth = `${chartMax ? (item.expected / chartMax) * 100 * widthScale : 0}%`
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
                    <span className="revenue-week-bar-group">
                      <span className="revenue-week-bar-label">Actual Revenue</span>
                      <span className="revenue-week-bar monthly" style={{ width: weeklyWidth }} />
                    </span>
                    <span className="revenue-week-bar-group">
                      <span className="revenue-week-bar-label">Expected Revenue</span>
                      <span className="revenue-week-bar expected" style={{ width: expectedWidth }} />
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div />
        <div className="revenue-weekly-axis-x" aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick}
              style={{
                position: 'absolute',
                left: `${(tick / chartMax) * 100 * widthScale}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {formatWeeklyAxisLabel(tick)}
            </span>
          ))}
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

function RevenueDashboards({ monthlyRevenueData = [], weeklyRevenueData = [], reverse = false }) {
  return (
    <div className="revenue-comparison-grid">
      {reverse ? (
        <>
          <MonthlyRevenueChart data={monthlyRevenueData} />
          <WeeklyRevenueChart data={weeklyRevenueData} />
        </>
      ) : (
        <>
          <WeeklyRevenueChart data={weeklyRevenueData} />
          <MonthlyRevenueChart data={monthlyRevenueData} />
        </>
      )}
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
function OperationManagerDashboard({ dashboard, revenueSummary, isRevenueLoading, monthlyRevenue, weeklyRevenue }) {
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
  const profileStatTiles = [
    { icon: BadgeCheck, tone: 'blue', label: 'Role', value: profileDetails.role },
    { icon: ShieldCheck, tone: 'green', label: 'Status', value: profileDetails.status },
    { icon: Building2, tone: 'violet', label: 'Workspace', value: profileDetails.workspace },
    { icon: Globe, tone: 'amber', label: 'Access Level', value: profileDetails.accessLevel },
  ]
  const profileDetailRows = [
    { icon: LockKeyhole, label: 'Password', value: profileDetails.passwordMasked },
    { icon: RefreshCcw, label: 'Reset Password', value: profileDetails.resetPasswordText },
    { icon: Clock3, label: 'Last Login', value: profileDetails.lastLogin },
  ]

  return (
    <section className="business-owner-dashboard operation-manager-dashboard">
      <div className="business-topbar !relative !flex min-w-0 flex-col gap-4 rounded-[20px] border border-slate-200 bg-white/95 px-4 py-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] backdrop-blur sm:px-5 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-5">
        <button
          type="button"
          className="mobile-menu-button dashboard-mobile-menu-button !inline-flex !h-10 !w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:!hidden"
          onClick={openMenu}
          aria-label="Open navigation menu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M4 12h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="operation-manager-mobile-brand !flex items-center gap-3 lg:!hidden" aria-hidden="true">
          <img
            className="operation-manager-mobile-brand-logo !h-11 !w-11 rounded-xl bg-white p-1 shadow-sm"
            src="/logo1.png"
            alt=""
          />
          <div className="operation-manager-mobile-brand-copy min-w-0">
            <strong className="block text-[1rem] font-extrabold tracking-[-0.02em] text-sky-700">Cispro Ops</strong>
          </div>
        </div>

        <div className="business-topbar-copy !min-w-0 !flex-1 lg:max-w-4xl">
          <p className="eyebrow text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-sky-600">
            Operation Manager
          </p>
          <h2 className="mt-1 text-[1.75rem] font-semibold leading-[1.08] tracking-[-0.03em] text-slate-900 sm:text-[2rem] lg:text-[2.15rem]">
            {dashboard.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 sm:text-[0.95rem]">{dashboard.summary}</p>
        </div>

        <div className="business-topbar-actions !flex min-w-0 flex-wrap items-center gap-3 lg:ml-auto lg:justify-end">
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
      <MemoRevenueDashboards monthlyRevenueData={monthlyRevenue} weeklyRevenueData={weeklyRevenue} reverse={true} />
      <MemoAttendanceComparisonChart />
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title={profileDetails.role}
        email={profileDetails.primaryEmail}
        initials={profileDetails.initials}
        statTiles={profileStatTiles}
        detailRows={profileDetailRows}
        ariaLabelledBy="profile-modal-title"
      />
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
  const { summary: revenueSummary, monthlyRevenue, weeklyRevenue, isLoading: isRevenueLoading } = useRevenueInsightsData()

  if (role === 'business-owner') {
    return (
      <MemoBusinessOwnerDashboard
        dashboard={dashboard}
        revenueSummary={revenueSummary}
        isRevenueLoading={isRevenueLoading}
        monthlyRevenue={monthlyRevenue}
        weeklyRevenue={weeklyRevenue}
      />
    )
  }

  return (
    <MemoOperationManagerDashboard
      dashboard={dashboard}
      revenueSummary={revenueSummary}
      isRevenueLoading={isRevenueLoading}
      monthlyRevenue={monthlyRevenue}
      weeklyRevenue={weeklyRevenue}
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
    return <Navigate to="/dashboard/faculty/my-batches" replace />
  }

  return <GenericDashboard role={role} />
}



