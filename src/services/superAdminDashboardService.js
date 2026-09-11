import { request, setImpersonateBranchId } from './apiClient'
import { loadBranchPaymentHistoryEntries } from '../lib/branchPaymentHistoryStore'

const CURRENCY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const toNumber = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const dateValue = (value) => {
  if (!value) return ''
  const date = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1)
const keyForDate = (date) => date.toISOString().slice(0, 10)

function installmentEntries(student) {
  const schedule = Array.isArray(student.installmentSchedule) && student.installmentSchedule.length
    ? student.installmentSchedule
    : Array.isArray(student.paymentPlan?.installments) ? student.paymentPlan.installments : null
  if (schedule) {
    return schedule.map((entry) => ({
      amount: toNumber(entry.amount ?? entry.installmentAmount),
      paidAmount: toNumber(entry.paidAmount ?? entry.amountPaid),
      status: String(entry.status || '').trim() || (toNumber(entry.paidAmount ?? entry.amountPaid) >= toNumber(entry.amount ?? entry.installmentAmount) ? 'Paid' : 'Pending'),
      dueDate: entry.dueDate || entry.date || '',
      paidAt: entry.paymentDate || entry.paidAt || entry.paidDate || entry.datePaid || entry.paidOn || '',
    }))
  }
  const entries = [
    { amountKey: 'firstInstallmentAmount', amount: student.firstInstallmentAmount ?? student.installment1, status: student.firstInstallmentStatus, dueDate: student.firstInstallmentDate || student.admissionDate, paidAt: student.firstInstallmentPaidAt },
    { amountKey: 'secondInstallmentAmount', amount: student.secondInstallmentAmount ?? student.installment2, status: student.secondInstallmentStatus, dueDate: student.secondDueDate, paidAt: student.secondInstallmentPaidAt },
  ]
  const hasThird = Boolean(student.thirdInstallmentAmount || student.installment3 || student.thirdDueDate)
  if (hasThird) entries.push({ amountKey: 'thirdInstallmentAmount', amount: student.thirdInstallmentAmount ?? student.installment3, status: student.thirdInstallmentStatus, dueDate: student.thirdDueDate, paidAt: student.thirdInstallmentPaidAt })
  return entries.map((entry) => ({ ...entry, amount: toNumber(entry.amount), paidAmount: String(entry.status || '').toLowerCase() === 'paid' ? toNumber(entry.amount) : toNumber(student[`${entry.amountKey}Paid`]), status: String(entry.status || 'Pending').trim() }))
}

function normalizePayload(payload) {
  const value = payload?.data ?? payload
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

async function loadAllBranchStudents(branch) {
  const branchId = branch.id || branch.branchId
  const rows = []
  let page = 1
  let hasNextPage
  setImpersonateBranchId(branchId)
  try {
    do {
      const response = await request(`/branch-students?page=${page}&limit=100&sortBy=createdAt&sortOrder=desc&branchId=${encodeURIComponent(branchId)}`)
      const payload = response?.data ?? response
      const data = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.records) ? payload.records : []
      rows.push(...data)
      const meta = response?.meta || payload?.meta || payload?.pagination || payload?.pageInfo
      hasNextPage = page < Number(meta?.totalPages || 1)
      page += 1
    } while (hasNextPage && page <= 100)
  } finally {
    setImpersonateBranchId(null)
  }
  return rows.map((student) => ({ ...student, branchId: student.branchId || branchId }))
}

function buildFallbackOverview(branches, studentsByBranch) {
  const now = new Date()
  const today = keyForDate(now)
  const currentMonth = monthStart(now)
  const activeBranches = branches.filter((branch) => String(branch?.status || '').toLowerCase() === 'active')
  const students = activeBranches.flatMap((branch) => studentsByBranch.get(String(branch.id || branch.branchId)) || [])
  const paymentHistory = activeBranches.flatMap((branch) => loadBranchPaymentHistoryEntries(branch.id || branch.branchId))
  const paymentHistoryByStudent = new Map()
  paymentHistory.forEach((payment) => {
    const studentId = String(payment.studentId || '').trim()
    if (!studentId) return
    const entries = paymentHistoryByStudent.get(studentId) || []
    entries.push(payment)
    paymentHistoryByStudent.set(studentId, entries)
  })
  const uniqueStudents = new Map()
  students.forEach((student, index) => {
    const key = String(student.id || student._id || student.studentId || `${student.branchId}-${index}`)
    if (!uniqueStudents.has(key)) uniqueStudents.set(key, student)
  })

  const result = {
    totalBranches: activeBranches.length,
    totalStudents: uniqueStudents.size,
    totalAdmissions: students.length,
    thisMonthAdmissions: 0,
    totalPayment: 0,
    thisMonthPayment: 0,
    totalOutstanding: 0,
    thisMonthDue: 0,
    todayDue: 0,
    overdueAmount: 0,
    dueStudents: new Set(),
    todayCollection: 0,
    admissionsByMonth: [],
    dailyPaymentData: [],
    weeklyPaymentData: [],
    monthlyPaymentData: [],
  }

  const admissionBuckets = Array.from({ length: 2 }, (_, index) => {
    const date = addMonths(currentMonth, index - 1)
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('en-US', { month: 'short' }), value: 0 }
  })
  const dailyBuckets = Array.from({ length: 7 }, (_, index) => { const date = addDays(now, index - 6); return { key: keyForDate(date), label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: 0 } })
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const weeklyBuckets = [
    { startDay: 1, endDay: 7 },
    { startDay: 8, endDay: 14 },
    { startDay: 15, endDay: 21 },
    { startDay: 22, endDay: daysInCurrentMonth },
  ].map((range, index) => ({
    key: `${now.getFullYear()}-${now.getMonth()}-${range.startDay}`,
    label: `Week ${index + 1}`,
    start: new Date(now.getFullYear(), now.getMonth(), range.startDay),
    end: new Date(now.getFullYear(), now.getMonth(), range.endDay),
    value: 0,
  }))
  const monthlyBuckets = Array.from({ length: 2 }, (_, index) => { const date = addMonths(currentMonth, index - 1); return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('en-US', { month: 'short' }), value: 0 } })

  students.forEach((student) => {
    const admissionDate = dateValue(student.admissionDate || student.createdAt || student.firstInstallmentDate)
    const admission = admissionDate ? new Date(`${admissionDate}T00:00:00`) : null
    if (admission && admission.getFullYear() === now.getFullYear() && admission.getMonth() === now.getMonth()) result.thisMonthAdmissions += 1
    const admissionBucket = admissionBuckets.find((item) => item.key === `${admission?.getFullYear()}-${admission?.getMonth()}`)
    if (admissionBucket) admissionBucket.value += 1

    const installments = installmentEntries(student)
    const studentKeys = [student.id, student._id, student.studentId]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
    const historyPayments = studentKeys.flatMap((key) => paymentHistoryByStudent.get(key) || [])
    const paymentEvents = historyPayments.length ? historyPayments : installments.filter((entry) => entry.paidAmount > 0 || entry.status.toLowerCase() === 'paid').map((entry) => ({ amount: entry.paidAmount || entry.amount, paidAt: entry.paidAt || admissionDate }))
    const paidForStudent = paymentEvents.reduce((sum, payment) => sum + toNumber(payment.amount), 0)
    paymentEvents.forEach((payment) => {
        const paidDate = dateValue(payment.paidAt || payment.paymentDate || payment.dateRaw || admissionDate)
        const paid = paidDate ? new Date(`${paidDate}T00:00:00`) : null
        result.totalPayment += toNumber(payment.amount)
        if (paid && paid.getFullYear() === now.getFullYear() && paid.getMonth() === now.getMonth()) result.thisMonthPayment += toNumber(payment.amount)
        if (paid && paidDate === today) result.todayCollection += toNumber(payment.amount)
        const dayBucket = dailyBuckets.find((item) => item.key === paidDate)
        if (dayBucket) dayBucket.value += toNumber(payment.amount)
        const weekBucket = weeklyBuckets.find((item) => paid && paid >= item.start && paid <= item.end)
        if (weekBucket) weekBucket.value += toNumber(payment.amount)
        const monthBucket = monthlyBuckets.find((item) => item.key === `${paid?.getFullYear()}-${paid?.getMonth()}`)
        if (monthBucket) monthBucket.value += toNumber(payment.amount)
    })

    const planned = toNumber(student.finalFee || student.courseAmount || student.totalAmount || student.afterDiscount) || installments.reduce((sum, entry) => sum + entry.amount, 0)
    result.totalOutstanding += Math.max(planned - paidForStudent, 0)
    installments.forEach((entry) => {
      const unpaidAmount = Math.max(entry.amount - entry.paidAmount, 0)
      if (!unpaidAmount) return
      const dueDate = dateValue(entry.dueDate)
      if (!dueDate) return
      if (dueDate.slice(0, 7) === today.slice(0, 7)) result.thisMonthDue += unpaidAmount
      if (dueDate === today) result.todayDue += unpaidAmount
      if (dueDate < today) result.overdueAmount += unpaidAmount
      if (dueDate <= today) result.dueStudents.add(String(student.id || student.studentId || `${student.branchId}-${admissionDate}`))
    })
  })

  result.admissionsByMonth = admissionBuckets
  result.dailyPaymentData = dailyBuckets
  result.weeklyPaymentData = weeklyBuckets
  result.monthlyPaymentData = monthlyBuckets
  result.dueStudents = result.dueStudents.size
  return result
}

export async function getSuperAdminOverview(branches = []) {
  try {
    const response = await request('/dashboard/super-admin/overview')
    const payload = normalizePayload(response)
    if (payload) return payload
  } catch (error) {
    // Older backend deployments may not expose the consolidated endpoint, or
    // may reject it while still allowing the existing branch/student APIs.
    // In both cases use the safe branch-level aggregation below.
    if (![403, 404, 405].includes(Number(error?.status))) throw error
  }

  const activeBranches = branches.filter((branch) => String(branch?.status || '').toLowerCase() === 'active')
  const studentsByBranch = new Map()
  // Impersonation is held by the shared API client, so branch requests must be
  // serialized to keep each request scoped to the correct branch.
  for (const branch of activeBranches) {
    studentsByBranch.set(String(branch.id || branch.branchId), await loadAllBranchStudents(branch))
  }
  return buildFallbackOverview(branches, studentsByBranch)
}

export function formatOverviewCurrency(value) {
  return CURRENCY.format(toNumber(value))
}
