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




