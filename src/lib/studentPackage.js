const DAY_MS = 24 * 60 * 60 * 1000

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function asDate(value) {
  if (!value) return null
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function isoDate(date) {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isTrainingDay(date, weekType = 'WEEKDAY') {
  const day = date.getDay()
  return String(weekType).toUpperCase() === 'WEEKEND' ? day === 0 || day === 6 : day !== 0 && day !== 6
}

function addTrainingDays(startDate, trainingDays, weekType) {
  const start = asDate(startDate)
  if (!start || trainingDays <= 0) return isoDate(start)

  let date = start
  let completed = 0
  while (completed < trainingDays) {
    if (isTrainingDay(date, weekType)) completed += 1
    if (completed < trainingDays) date = new Date(date.getTime() + DAY_MS)
  }
  return isoDate(date)
}

export function calculateCourseDuration(course = {}) {
  const totalHours = Math.max(number(course.totalHours ?? course.courseHours ?? course.hours), 0)
  const dailyHours = Math.max(number(course.dailyHours ?? course.hoursPerDay ?? 2), 0.01)
  return Math.ceil(totalHours / dailyHours)
}

export function calculateCourseEndDate(course = {}) {
  const startDate = course.startDate || course.courseStartDate
  return addTrainingDays(startDate, calculateCourseDuration(course), course.weekType || course.weekdayType)
}

export function buildStudentPackage(courses = [], mode = 'PARALLEL', options = {}) {
  const packageMode = String(mode || 'PARALLEL').toUpperCase() === 'SEQUENTIAL' ? 'SEQUENTIAL' : 'PARALLEL'
  let sequentialStart = options.startDate || ''
  const normalizedCourses = (Array.isArray(courses) ? courses : []).map((course, index) => {
    const fee = Math.max(number(course.fee ?? course.afterDiscount ?? course.actualFees), 0)
    const totalHours = Math.max(number(course.totalHours ?? course.courseHours ?? course.hours), 0)
    const startDate = packageMode === 'SEQUENTIAL'
      ? sequentialStart || course.startDate || course.courseStartDate || options.startDate || ''
      : course.startDate || course.courseStartDate || options.startDate || ''
    const endDate = course.endDate || course.courseEndDate || calculateCourseEndDate({ ...course, startDate, totalHours })
    if (packageMode === 'SEQUENTIAL' && endDate) {
      const nextStart = asDate(endDate)
      nextStart.setTime(nextStart.getTime() + DAY_MS)
      sequentialStart = isoDate(nextStart)
    }
    return {
      ...course,
      courseId: String(course.courseId || course.id || `course-${index + 1}`),
      courseName: course.courseName || course.name || '',
      fee,
      totalHours,
      startDate,
      endDate,
      progress: Math.min(100, Math.max(0, number(course.progress ?? course.courseProgress))),
    }
  })

  const totalFee = normalizedCourses.reduce((sum, course) => sum + course.fee, 0)
  const finalEndDate = normalizedCourses.reduce((latest, course) => {
    if (!course.endDate) return latest
    return !latest || course.endDate > latest ? course.endDate : latest
  }, '')

  return {
    packageMode,
    courses: normalizedCourses,
    totalFee,
    finalEndDate,
  }
}

export function buildPackageInstallments(packageData = {}, count = 4, options = {}) {
  const totalFee = Math.max(number(packageData.totalFee), 0)
  const installmentCount = Math.max(1, Math.min(12, Math.floor(number(count, 1))))
  const amount = Math.floor((totalFee * 100) / installmentCount) / 100
  const schedule = []
  let allocated = 0

  for (let index = 0; index < installmentCount; index += 1) {
    const installmentAmount = index === installmentCount - 1
      ? Math.max(totalFee - allocated, 0)
      : amount
    allocated += installmentAmount
    const milestone = Math.round(((index + 1) / installmentCount) * 100)
    const packageStart = asDate(options.startDate)
    const packageEnd = asDate(packageData.finalEndDate)
    const durationDays = number(options.durationDays) || (packageStart && packageEnd
      ? Math.max(1, Math.ceil((packageEnd.getTime() - packageStart.getTime()) / DAY_MS) + 1)
      : 0)
    const dueDate = packageData.finalEndDate && options.startDate && durationDays
      ? addTrainingDays(options.startDate, Math.max(1, Math.ceil(durationDays * (milestone / 100))), options.weekType)
      : ''
    schedule.push({
      installmentNumber: index + 1,
      amount: installmentAmount,
      paidAmount: 0,
      milestonePercentage: milestone,
      dueDate,
      status: installmentAmount > 0 ? 'Pending' : 'Paid',
    })
  }
  return schedule
}

export function applyPackagePayment(schedule = [], paymentAmount = 0) {
  let remaining = Math.max(number(paymentAmount), 0)
  const next = (Array.isArray(schedule) ? schedule : []).map((item, index) => {
    const amount = Math.max(number(item.amount ?? item.installmentAmount), 0)
    const alreadyPaid = Math.min(Math.max(number(item.paidAmount ?? item.amountPaid), 0), amount)
    const outstanding = Math.max(amount - alreadyPaid, 0)
    const applied = Math.min(outstanding, remaining)
    remaining -= applied
    const paidAmount = alreadyPaid + applied
    return {
      ...item,
      installmentNumber: Number(item.installmentNumber || index + 1),
      amount,
      paidAmount,
      status: paidAmount >= amount ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending',
    }
  })
  return { schedule: next, carryForward: remaining }
}

export function getPackagePaymentSummary(packageData = {}, schedule = []) {
  const totalAmount = Math.max(number(packageData.totalFee), 0)
  const paidAmount = (Array.isArray(schedule) ? schedule : []).reduce((sum, item) => sum + Math.max(number(item.paidAmount ?? item.amountPaid), 0), 0)
  return { totalAmount, paidAmount, balance: Math.max(totalAmount - paidAmount, 0) }
}

export function getPackageProgressAlert(packageData = {}, schedule = [], threshold = 70) {
  const coursesAtThreshold = (Array.isArray(packageData.courses) ? packageData.courses : [])
    .filter((course) => number(course.progress ?? course.courseProgress) >= threshold)
  if (!coursesAtThreshold.length) return null

  const pendingInstallment = (Array.isArray(schedule) ? schedule : [])
    .find((item) => number(item.paidAmount ?? item.amountPaid) < number(item.amount ?? item.installmentAmount))
  if (!pendingInstallment) return null

  const names = coursesAtThreshold.map((course) => course.courseName || course.name || 'Course')
  return {
    type: 'PACKAGE_PAYMENT_DUE',
    courseIds: coursesAtThreshold.map((course) => course.courseId || course.id),
    message: names.length > 1
      ? `Payment Pending – Your ${names.join(' and ')} courses have reached ${threshold}% progress. Please complete the pending installment payment.`
      : `Payment Due: Your ${names[0]} course progress has reached ${threshold}%. Please complete the pending installment payment.`,
    installmentNumber: pendingInstallment.installmentNumber,
    amountDue: Math.max(number(pendingInstallment.amount) - number(pendingInstallment.paidAmount ?? pendingInstallment.amountPaid), 0),
  }
}
