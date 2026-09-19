import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import {
  LayoutDashboard,
  UserRound,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  LogOut,
  Menu,
  X,
  CircleUserRound,
  Bell,
  ChevronDown,
  Download,
  Mail,
  Phone,
  Users,
  GraduationCap,
  Building2,
  BarChart3,
} from 'lucide-react'

import '../styles/StudentNewDashboardPage.css'
import {
  loadBranchStudents,
  refreshBranchStudents,
} from '../lib/branchStudentStore'
import { loadBranchRegistry } from '../lib/branchAuth'
import { getCurrentBranchStudentCalendar, getCurrentStudentProfile } from '../services/studentService'
import { StudentCalendarPanel } from '../components/StudentCalendarPanel'
import { NotificationBell } from '../components/NotificationBell'
import { getStudentCalendarAttendance } from '../lib/studentAttendanceCalendar'
import { saveStudentCalendarSummary } from '../lib/studentCalendarSummary'
import { buildStudentCourseCalendar } from '../lib/studentCalendar'
import { getBranchStudentLedger } from '../services/branchLedgerService'
import { loadBranchPaymentHistoryEntries } from '../lib/branchPaymentHistoryStore'
import html2pdf from 'html2pdf.js'
import { buildModernPaymentReceiptHtml } from '../components/payments/RecordPayment'
import { getNotifications, unwrapNotifications } from '../services/notificationService'

function readStudentSession() {
  if (typeof window === 'undefined') return null

  try {
    return JSON.parse(window.sessionStorage.getItem('cispro.student-session') || 'null')
  } catch {
    return null
  }
}

function matchesStudentSession(student, session) {
  const identifiers = [session?.studentId, session?.emailAddress, session?.email]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  return identifiers.includes(String(student?.studentId || '').trim().toLowerCase()) ||
    identifiers.includes(String(student?.emailAddress || student?.email || '').trim().toLowerCase())
}

function getCourseMasterDuration(course = {}) {
  return course?.duration ?? course?.durationMonths ?? course?.courseDuration ?? ''
}

function getCourseMasterHours(course = {}) {
  return course?.hours ?? course?.totalHours ?? course?.courseHours ?? ''
}

function getPaymentStatus(student) {
  const explicitStatus = String(student?.paymentStatus || student?.feeStatus || '').trim()
  if (explicitStatus) return explicitStatus

  const total = Number(student?.afterDiscount ?? student?.totalAmount ?? 0)
  const paid = Number(student?.paidAmount ?? student?.amountPaid ?? 0)
  if (total > 0 && paid >= total) return 'Paid'
  if (paid > 0) return 'Partially paid'
  return 'Pending'
}

function getAttendance(student) {
  const value = student?.attendancePercentage ?? student?.attendance ?? student?.attendancePercent
  return value === undefined || value === null || value === '' ? 'Not available' : `${value}%`
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || ''
}

function formatValue(value, fallback = 'Not available') {
  return String(value || '').trim() || fallback
}

function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return 'Date not available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN', options)
}

function formatTime(value) {
  if (!value) return 'Time not available'
  const date = new Date(`1970-01-01T${String(value).trim()}`)
  if (!Number.isNaN(date.getTime()) && String(value).includes(':')) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
  return String(value)
}

function getAttendanceSummary(student) {
  const records = [
    ...(Array.isArray(student?.attendanceRecords) ? student.attendanceRecords : []),
    ...(Array.isArray(student?.attendance) ? student.attendance : []),
  ]
  const byDate = student?.attendanceByDate && typeof student.attendanceByDate === 'object'
    ? Object.entries(student.attendanceByDate).map(([date, status]) => ({ date, status }))
    : []
  const allRecords = [...records, ...byDate]
  const counts = allRecords.reduce((result, record) => {
    const status = String(record?.status || record?.attendanceStatus || record?.value || '').trim().toLowerCase()
    if (status.includes('present')) result.present += 1
    else if (status.includes('absent')) result.absent += 1
    else if (status.includes('leave') || status.includes('holiday')) result.leave += 1
    return result
  }, { present: 0, absent: 0, leave: 0 })
  const percentageSource = firstValue(student?.attendancePercentage, student?.attendancePercent, student?.attendance?.percentage)
  const percentage = percentageSource !== ''
    ? Number(percentageSource)
    : counts.present + counts.absent > 0 ? Math.round((counts.present / (counts.present + counts.absent)) * 100) : null
  return { ...counts, percentage: Number.isFinite(percentage) ? percentage : null, records: allRecords }
}

function getModules(student) {
  const candidates = [student?.modules, student?.course?.modules, student?.courseProgress?.modules, student?.learningProgress?.modules]
  return candidates.find(Array.isArray) || []
}

function getModuleProgress(student) {
  const modules = getModules(student)
  const normalized = modules.map((module) => {
    const items = [module?.submodules, module?.topics, module?.lessons].find(Array.isArray) || []
    const completedItems = items.filter((item) => ['completed', 'complete', 'done'].includes(String(item?.status || item?.progressStatus || '').trim().toLowerCase()) || Number(item?.progress) >= 100).length
    const explicit = Number(module?.progress ?? module?.completionPercentage ?? module?.percentage)
    const progress = Number.isFinite(explicit) ? Math.max(0, Math.min(100, explicit)) : items.length ? Math.round((completedItems / items.length) * 100) : null
    return { ...module, items, completedItems, progress }
  })
  const totalItems = normalized.reduce((total, module) => total + module.items.length, 0)
  const completedItems = normalized.reduce((total, module) => total + module.completedItems, 0)
  const completedModules = normalized.filter((module) => module.progress === 100).length
  const overallRaw = firstValue(student?.courseProgress, student?.courseCompletionPercentage, student?.courseProgressPercentage, student?.learningProgress?.percentage)
  const overallSource = overallRaw === '' ? Number.NaN : Number(overallRaw)
  const overall = Number.isFinite(overallSource) ? overallSource : totalItems ? Math.round((completedItems / totalItems) * 100) : null
  const activeModule = normalized.find((module) => module.progress !== null && module.progress < 100)
  const activeItem = activeModule?.items.find((item) => !['completed', 'complete', 'done'].includes(String(item?.status || item?.progressStatus || '').trim().toLowerCase()) && Number(item?.progress || 0) < 100)
  const completedItemsList = normalized.flatMap((module) => module.items.filter((item) => ['completed', 'complete', 'done'].includes(String(item?.status || item?.progressStatus || '').trim().toLowerCase()) || Number(item?.progress) >= 100))
  return { modules: normalized, overall: Number.isFinite(overall) ? Math.max(0, Math.min(100, overall)) : null, completedModules, totalModules: normalized.length, totalItems, completedItems, activeModule, activeItem, latestCompleted: completedItemsList.at(-1) }
}

function getTodayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getCalendarEvents(student) {
  return Array.isArray(student?.calendarEvents) ? student.calendarEvents : []
}

function getEventDate(event) {
  return firstValue(event?.date, event?.startDate, event?.scheduledDate, event?.classDate)
}

function getEventTitle(event) {
  return firstValue(event?.moduleName, event?.topicName, event?.courseName, event?.title, event?.name)
}

function asAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function formatPaymentAmount(value) {
  return `₹${asAmount(value).toLocaleString('en-IN')}`
}

function formatPaymentDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getInstallmentNumber(entry = {}) {
  const value = entry.installmentNumber ?? entry.installmentNo ?? entry.installment ?? entry.installmentIndex
  if (typeof value === 'number') return value
  const match = String(value || '').match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

function buildInstallmentRows(student, paymentEntries) {
  const plan = Array.isArray(student?.installmentSchedule) && student.installmentSchedule.length
    ? student.installmentSchedule
    : Array.isArray(student?.paymentPlan?.installments) ? student.paymentPlan.installments : []
  const fields = [
    ['firstInstallmentAmount', 'firstInstallmentDate', 'firstInstallmentStatus', 'firstInstallmentPaidAt'],
    ['secondInstallmentAmount', 'secondDueDate', 'secondInstallmentStatus', 'secondInstallmentPaidAt'],
    ['thirdInstallmentAmount', 'thirdDueDate', 'thirdInstallmentStatus', 'thirdInstallmentPaidAt'],
    ['fourthInstallmentAmount', 'fourthDueDate', 'fourthInstallmentStatus', 'fourthInstallmentPaidAt'],
  ]
  const count = Math.max(plan.length, fields.filter(([amount, due, status]) => student?.[amount] || student?.[due] || student?.[status]).length)
  return Array.from({ length: count }, (_, index) => {
    const source = plan[index] || {}
    const field = fields[index] || []
    const relatedPayment = paymentEntries.find((entry) => getInstallmentNumber(entry) === index + 1)
    const amount = asAmount(source.amount || source.installmentAmount || source.amountDue || student?.[field[0]] || student?.[`installment${index + 1}`])
    const dueDate = source.dueDate || source.dueOn || student?.[field[1]] || ''
    const paidDate = source.paidDate || source.paymentDate || source.paidAt || student?.[field[3]] || relatedPayment?.dateRaw || ''
    const explicitStatus = source.status || source.paymentStatus || student?.[field[2]] || ''
    const status = explicitStatus || (relatedPayment ? 'Paid' : 'Pending')
    return { number: index + 1, amount, dueDate, paymentMode: source.paymentMode || source.mode || relatedPayment?.paymentMode || '-', paidDate, status }
  })
}

function downloadStudentReceipt(payment, student, totalPaid) {
  const receiptElement = document.createElement('div')
  receiptElement.innerHTML = buildModernPaymentReceiptHtml({
    logoUrl: '/logo1.png', instituteName: 'CISPRO', studentName: student?.studentName || 'Student',
    studentId: student?.studentId || '-', courseName: student?.courseName || student?.courseInterested || '-',
    receiptNumber: payment.receiptNumber || payment.id || 'Receipt', receiptDate: formatPaymentDate(payment.dateRaw || payment.date),
    paymentDate: formatPaymentDate(payment.dateRaw || payment.date), paymentFor: payment.payAgainst || 'Payment',
    paymentMode: payment.paymentMode || '-', transactionReference: payment.transactionReference || '-',
    collectedBy: payment.collectedBy || '-', notes: payment.notes || '-', totalCourseFee: student?.afterDiscount || student?.totalAmount || 0,
    previouslyPaid: Math.max(totalPaid - asAmount(payment.amount), 0), currentPayment: asAmount(payment.amount), totalPaid,
    balance: Math.max(asAmount(student?.afterDiscount || student?.totalAmount) - totalPaid, 0), paymentAlreadyApplied: true,
  })
  receiptElement.style.position = 'fixed'
  receiptElement.style.left = '-10000px'
  document.body.appendChild(receiptElement)
  void html2pdf().set({ margin: 0, filename: `Payment_Receipt_${payment.receiptNumber || payment.id || 'receipt'}.pdf`, html2canvas: { scale: 1.5 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(receiptElement.querySelector('.receipt-page')).save().finally(() => receiptElement.remove())
}

export function StudentNewDashboardPage() {
 const navigate = useNavigate()
 const { session, signOut } = useAuth()
 const [activeSection, setActiveSection] = useState('dashboard')
 const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
 const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
 const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
 const [studentSession] = useState(() => readStudentSession())
 const [student, setStudent] = useState(null)
 const [isLoading, setIsLoading] = useState(true)
 const [loadError, setLoadError] = useState('')
 const [paymentEntries, setPaymentEntries] = useState([])
 const [paymentLoadError, setPaymentLoadError] = useState('')
 const [notifications, setNotifications] = useState([])

 useEffect(() => {
   if (!student?.studentId) {
     return undefined
   }
   let isMounted = true
   const loadPayments = async () => {
     try {
       const identifiers = [...new Set([student.studentId, student.id].map((value) => String(value || '').trim()).filter(Boolean))]
       let ledger = await getBranchStudentLedger(identifiers[0])
       if (!ledger?.entries?.length && identifiers[1]) ledger = await getBranchStudentLedger(identifiers[1])
       if (isMounted) {
         const apiEntries = ledger?.entries || []
         const localEntries = loadBranchPaymentHistoryEntries().filter((entry) => identifiers.includes(String(entry.studentId || '').trim()))
         const entries = apiEntries.length ? apiEntries : localEntries
         setPaymentEntries(entries.filter((entry) => entry.entryType === 'CREDIT' || entry.credit > 0 || (!entry.entryType && asAmount(entry.amount) > 0)))
         setPaymentLoadError('')
       }
     } catch (error) {
       if (isMounted) {
         setPaymentEntries([])
         setPaymentLoadError(error?.message || 'Payment details are temporarily unavailable.')
       }
     }
   }
   void loadPayments()
   const refreshPayments = () => { void loadPayments() }
   window.addEventListener('focus', refreshPayments)
   window.addEventListener('cispro:branch-payment-history-changed', refreshPayments)
   return () => {
     isMounted = false
     window.removeEventListener('focus', refreshPayments)
     window.removeEventListener('cispro:branch-payment-history-changed', refreshPayments)
   }
 }, [student?.studentId, student?.id])

 useEffect(() => {
   let isMounted = true
   const loadNotifications = async () => {
     try {
       const result = unwrapNotifications(await getNotifications({ limit: 20, page: 1 }))
       const identity = String(student?.studentId || student?.id || '').trim().toLowerCase()
       const scoped = result.data.filter((item) => {
         const target = String(item?.studentId || item?.recipientStudentId || '').trim().toLowerCase()
         return !target || !identity || target === identity
       })
       if (isMounted) setNotifications(scoped)
     } catch {
       if (isMounted) setNotifications([])
     }
   }
   if (student) void loadNotifications()
   return () => { isMounted = false }
 }, [student?.studentId, student?.id])

 useEffect(() => {
   let isMounted = true
   const session = readStudentSession()

   const attachCourseMasterData = (studentRecord) => {
     if (!studentRecord) return studentRecord

     const courseMasterDuration = getCourseMasterDuration(studentRecord?.course)
     const courseMasterHours = getCourseMasterHours(studentRecord?.course)

     return {
       ...studentRecord,
       attendanceByDate: { ...(studentRecord.attendanceByDate || {}), ...getStudentCalendarAttendance(studentRecord) },
       courseDuration: courseMasterDuration || studentRecord.courseDuration || studentRecord.duration,
       courseMasterDuration: courseMasterDuration || studentRecord.courseMasterDuration || studentRecord.courseDuration || studentRecord.duration,
       totalHours: courseMasterHours || studentRecord.totalHours || studentRecord.courseHours,
     }
   }

   const attachCalendarData = async (studentRecord) => {
     if (!studentRecord) return studentRecord

     try {
       const calendar = await getCurrentBranchStudentCalendar()
       const calendarStudent = {
         ...studentRecord,
         courseEndDate: calendar?.endDate || studentRecord.courseEndDate || '',
         totalHours: calendar?.totalHours || calendar?.course?.totalHours || studentRecord.totalHours || '',
         hoursPerDay: calendar?.hoursPerDay || studentRecord.hoursPerDay || '',
         requiredTeachingDays: calendar?.requiredTeachingDays || studentRecord.requiredTeachingDays || '',
         actualTeachingDays: calendar?.actualTeachingDays || studentRecord.actualTeachingDays || '',
         calendarDurationDays: calendar?.calendarDurationDays || studentRecord.calendarDurationDays || '',
         courseMode: calendar?.courseMode || calendar?.course?.mode || studentRecord.courseMode || '',
         calendarEvents: Array.isArray(calendar?.events) ? calendar.events : [],
         scheduleSummary: calendar,
       }
       const calculatedCalendar = buildStudentCourseCalendar(calendarStudent)
       saveStudentCalendarSummary(studentRecord, {
         ...calendar,
         presentDays: calculatedCalendar.summary.presentDays,
         absentDays: calculatedCalendar.summary.absentDays,
         courseDays: calculatedCalendar.summary.courseDays,
         noClassDays: calculatedCalendar.summary.noClassDays,
         calendarDurationDays: calendar?.calendarDurationDays || calculatedCalendar.calendarDurationDays,
         events: Array.isArray(calendar?.events) ? calendar.events : [],
       })
       return {
         ...studentRecord,
         courseEndDate: calendar?.endDate || studentRecord.courseEndDate || '',
         totalWorkingDays: calendar?.totalWorkingDays || studentRecord.totalWorkingDays || '',
         totalHours: calendar?.totalHours || calendar?.course?.totalHours || studentRecord.totalHours || '',
         hoursPerDay: calendar?.hoursPerDay || studentRecord.hoursPerDay || '',
         requiredTeachingDays: calendar?.requiredTeachingDays || studentRecord.requiredTeachingDays || '',
         actualTeachingDays: calendar?.actualTeachingDays || studentRecord.actualTeachingDays || '',
         calendarDurationDays: calendar?.calendarDurationDays || studentRecord.calendarDurationDays || '',
         courseMode: calendar?.courseMode || calendar?.course?.mode || studentRecord.courseMode || '',
         calendarEvents: Array.isArray(calendar?.events) ? calendar.events : [],
         scheduleSummary: calendar,
       }
     } catch {
       return studentRecord
     }
   }

   const loadStudent = async () => {
     if (!session) {
       try {
         const currentProfile = await getCurrentStudentProfile()
         const hydratedProfile = attachCourseMasterData(currentProfile)
         const calendarProfile = await attachCalendarData(hydratedProfile)
         if (isMounted) setStudent(calendarProfile)
       } catch (error) {
         if (isMounted) setLoadError(error?.message || 'Student session not found. Please sign in again.')
       } finally {
         if (isMounted) setIsLoading(false)
       }
       return
     }

     const scope = session.branchId || session.branchCode || ''
     const localStudent = loadBranchStudents(scope).find((record) => matchesStudentSession(record, session))

     try {
       const records = await refreshBranchStudents(scope)
       const latestStudent = records.find((record) => matchesStudentSession(record, session))
       const hydratedStudent = attachCourseMasterData(latestStudent || localStudent)
       const calendarStudent = await attachCalendarData(hydratedStudent)
       if (isMounted) {
         setStudent(calendarStudent || null)
         if (!latestStudent && !localStudent) setLoadError('Your student record could not be found.')
       }
      } catch (error) {
       if (isMounted) {
         setStudent(localStudent ? {
           ...localStudent,
           attendanceByDate: { ...(localStudent.attendanceByDate || {}), ...getStudentCalendarAttendance(localStudent) },
           courseMasterDuration: localStudent.course?.duration || localStudent.courseDuration || localStudent.duration || '',
         } : null)
         if (!localStudent) setLoadError(error?.message || 'Unable to load your student details.')
       }
     } finally {
       if (isMounted) setIsLoading(false)
     }
   }

   void loadStudent()
   const refreshCalendar = async () => {
     try {
       const calendar = await getCurrentBranchStudentCalendar()
       if (isMounted) setStudent(current => {
         if (!current) return current
         const refreshedStudent = { ...current, courseEndDate: calendar.endDate, calendarEvents: calendar.events, scheduleSummary: calendar, hoursPerDay: calendar.hoursPerDay, totalHours: calendar.totalHours }
         const calculatedCalendar = buildStudentCourseCalendar(refreshedStudent)
         saveStudentCalendarSummary(current, {
           ...calendar,
           presentDays: calculatedCalendar.summary.presentDays,
           absentDays: calculatedCalendar.summary.absentDays,
           courseDays: calculatedCalendar.summary.courseDays,
           noClassDays: calculatedCalendar.summary.noClassDays,
           calendarDurationDays: calendar?.calendarDurationDays || calculatedCalendar.calendarDurationDays,
           events: Array.isArray(calendar?.events) ? calendar.events : [],
         })
         return refreshedStudent
       })
     } catch (error) { if (isMounted) setLoadError(error.message || 'Unable to refresh calendar') }
   }
   const timer = setInterval(refreshCalendar, 30000)
   window.addEventListener('focus', refreshCalendar)
   window.addEventListener('institute-leave-updated', refreshCalendar)
   const refreshSharedAttendance = () => setStudent(current => current ? { ...current, attendanceByDate: { ...(current.attendanceByDate || {}), ...getStudentCalendarAttendance(current) } } : current)
   window.addEventListener('cispro:student-calendar-attendance-changed', refreshSharedAttendance)
   return () => { isMounted = false; clearInterval(timer); window.removeEventListener('focus', refreshCalendar); window.removeEventListener('institute-leave-updated', refreshCalendar); window.removeEventListener('cispro:student-calendar-attendance-changed', refreshSharedAttendance) }
 }, [])

 const courseName = student?.courseName || student?.courseInterested || student?.course?.name || 'Not assigned'
 const attendance = getAttendance(student)
 const displayName = student?.studentName || studentSession?.studentName || 'Student'
 const totalFee = asAmount(student?.finalFee || student?.courseAmount || student?.totalFee || student?.totalCourseFee || student?.feeAmount || student?.afterDiscount || student?.totalAmount || student?.actualFees || student?.course?.afterDiscount || student?.course?.finalFee)
 const configuredInstallments = Array.isArray(student?.installmentSchedule) && student.installmentSchedule.length
   ? student.installmentSchedule
   : Array.isArray(student?.paymentPlan?.installments) ? student.paymentPlan.installments : []
 const schedulePaidAmount = configuredInstallments.reduce((sum, installment) => sum + asAmount(installment.paidAmount || installment.amountPaid), 0)
 const paidAmount = paymentEntries.length
   ? paymentEntries.reduce((sum, entry) => sum + asAmount(entry.amount || entry.credit), 0)
   : asAmount(student?.paidAmount || student?.amountPaid || student?.totalPaid || schedulePaidAmount)
 const balanceAmount = Math.max(totalFee - paidAmount, 0)
 const paymentProgress = totalFee > 0 ? Math.min(Math.round((paidAmount / totalFee) * 100), 100) : 0
 const paymentStatus = totalFee > 0 && paidAmount >= totalFee ? 'Paid' : paidAmount > 0 ? 'Partially paid' : getPaymentStatus(student)
 const installmentRows = useMemo(() => buildInstallmentRows(student, paymentEntries), [student, paymentEntries])
 const paymentHistoryRows = useMemo(() => [...paymentEntries].sort((a, b) => new Date(b.dateRaw || b.date).getTime() - new Date(a.dateRaw || a.date).getTime()), [paymentEntries])
 const nextInstallment = installmentRows.find((installment) => !['paid', 'completed', 'success'].includes(String(installment.status).toLowerCase()))
 const qualification = student?.qualification || '-'
 const passedOutYear = student?.passedOutYear ?? student?.yearOfPassing ?? '-'
 const branchId = String(student?.branchId || studentSession?.branchId || '').trim()
 const branchRegistryName = useMemo(() => {
   if (!branchId) return ''
   const branch = loadBranchRegistry().find((entry) => [entry.id, entry.branchId].includes(branchId))
   return branch?.branchName || ''
 }, [branchId])
 const branchName = [
   student?.branchName,
   student?.branch?.name,
   student?.branch?.branchName,
   typeof student?.branch === 'string' ? student.branch : '',
   studentSession?.branchName,
   studentSession?.branch?.name,
   studentSession?.branch?.branchName,
   branchRegistryName,
 ].map((value) => String(value || '').trim()).find((value) => value && value !== branchId) || 'CISPRO'
 const batchName = student?.batchName || (typeof student?.batch === 'string' ? student.batch : '') || student?.batch?.name || '-'
 const courseStartDate = student?.courseStartDate || student?.courseStart || student?.startDate || student?.batch?.courseStartDate || student?.batch?.startDate
 const courseProgressValue = student?.courseProgress ?? student?.courseCompletionPercentage ?? student?.courseProgressPercentage
 const courseProgressNumber = Number(courseProgressValue)
 const attendanceSourceValue = student?.attendancePercentage ?? student?.attendance ?? student?.attendancePercent
 const attendanceProgressNumber = Number(attendanceSourceValue)
 const studentStatus = student?.currentStatus || student?.status || '-'
 const attendanceSummary = useMemo(() => getAttendanceSummary(student), [student])
 const learningProgress = useMemo(() => getModuleProgress(student), [student])
 const calendarEvents = useMemo(() => getCalendarEvents(student), [student])
 const todayKey = getTodayKey()
 const upcomingClasses = calendarEvents.filter((event) => {
   const status = String(event?.status || event?.attendanceStatus || '').trim().toLowerCase()
   return getEventDate(event) && String(getEventDate(event)).slice(0, 10) > todayKey && !['no class', 'holiday', 'leave', 'institute leave', 'faculty weekly off'].includes(status)
 }).sort((a, b) => new Date(getEventDate(a)) - new Date(getEventDate(b))).slice(0, 4)
 const facultyName = firstValue(student?.facultyName, student?.faculty?.facultyName, student?.faculty?.name, student?.batch?.faculty)
 const batchTiming = firstValue(student?.batchTiming, student?.batch?.batchTiming, student?.classSchedule, student?.courseSchedule, student?.batch?.startTime && student?.batch?.endTime ? `${student.batch.startTime} - ${student.batch.endTime}` : '')

  const handleMenuClick = (section) => {
    setActiveSection(section)
    setIsMobileSidebarOpen(false)
  }

const handleLogout = () => {
  setIsProfileMenuOpen(false)
  setIsLogoutModalOpen(true)
}

const handleLogoutCancel = () => {
  setIsLogoutModalOpen(false)
}

const handleLogoutConfirm = async () => {
  setIsLogoutModalOpen(false)
  try {
    window.sessionStorage.removeItem('cispro.student-session')
  } catch {
    // Ignore storage errors and continue to the login page.
  }
  await signOut()
  navigate('/login', { replace: true })
}

  return (
    <section className="student-new-page">
      <div className="student-new-shell">

        {/* ─────────────────────────────────────────────
            MOBILE SIDEBAR BACKDROP
        ───────────────────────────────────────────── */}
        {isMobileSidebarOpen ? (
          <button
            type="button"
            className="student-new-sidebar-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        ) : null}

        {/* ─────────────────────────────────────────────
            SIDEBAR
        ───────────────────────────────────────────── */}
        <aside
          className={`student-new-sidebar ${
            isMobileSidebarOpen ? 'is-open' : ''
          }`.trim()}
          aria-label="Student navigation"
        >
          {/* Sidebar Brand */}
          <div className="student-new-sidebar-brand">
            <img
              className="student-new-sidebar-brand-logo"
              src="/logo1.png"
              alt="Elite Admin logo"
            />

            <button
              type="button"
              className="student-new-sidebar-close"
              aria-label="Close navigation menu"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X
                size={18}
                strokeWidth={2.6}
                aria-hidden="true"
                focusable="false"
              />
            </button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="student-new-sidebar-nav">

            {/* MAIN */}
            <div className="student-new-sidebar-section">
              <span className="student-new-sidebar-section-label">
                MAIN
              </span>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'dashboard' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('dashboard')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <LayoutDashboard
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>Dashboard</span>
              </button>
            </div>

            {/* STUDENT */}
            <div className="student-new-sidebar-section">
              <span className="student-new-sidebar-section-label">
                STUDENT
              </span>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'profile' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('profile')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <UserRound
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>My Profile</span>
              </button>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'course' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('course')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <BookOpen
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>My Course</span>
              </button>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'calendar' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('calendar')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <CalendarDays
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>Calendar</span>
              </button>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'payments' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('payments')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <CreditCard
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>Payments</span>
              </button>

              <button
                type="button"
                className={`student-new-sidebar-item ${activeSection === 'notifications' ? 'is-active' : ''}`.trim()}
                onClick={() => navigate('/student-new-dashboard/notifications')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true"><Bell size={18} strokeWidth={2.2} /></span>
                <span>Notifications</span>
              </button>
            </div>
          </nav>

          {/* Sidebar Footer */}
          <div className="student-new-sidebar-footer">
            <div className="student-new-sidebar-profile-card">

              <span
                className="student-new-sidebar-user-avatar"
                aria-hidden="true"
              >
                <CircleUserRound
                  size={28}
                  strokeWidth={1.9}
                />

                <span className="student-new-sidebar-user-status" />
              </span>

              <div className="student-new-sidebar-profile-copy">
                <strong>Student</strong>
                <span>Student Profile</span>
              </div>

              <button
                type="button"
                className="student-new-sidebar-logout-button"
                aria-label="Logout"
                onClick={handleLogout}
              >
                <LogOut
                  size={21}
                  strokeWidth={2.15}
                />
              </button>

            </div>
          </div>
        </aside>

        {/* ─────────────────────────────────────────────
            MAIN AREA
        ───────────────────────────────────────────── */}
        <div className="student-new-main">

          {/* ─────────────────────────────────────────
              HEADER
          ───────────────────────────────────────── */}
          <header className="student-new-topbar">

            <div className="student-new-topbar-left">

              <button
                type="button"
                className="student-new-sidebar-toggle"
                aria-label="Open navigation menu"
                aria-expanded={isMobileSidebarOpen}
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu
                  size={20}
                  strokeWidth={2.4}
                  aria-hidden="true"
                  focusable="false"
                />
              </button>

              <h1 className="student-new-header-title">
                Student Dashboard
              </h1>

            </div>

            <div className="student-new-topbar-right">
              <NotificationBell />

              <div className="student-new-profile">
                <button
                  type="button"
                  className="student-new-profile-trigger"
                  onClick={() => setIsProfileMenuOpen((current) => !current)}
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                >
                  <span className="student-new-profile-avatar" aria-hidden="true">
                    <CircleUserRound size={30} strokeWidth={1.9} />
                  </span>
                  <span className="student-new-profile-copy">
                    <strong>{displayName}</strong>
                    <span>Student</span>
                  </span>
                  <ChevronDown className="student-new-profile-chevron" size={17} strokeWidth={2.2} />
                </button>

                {isProfileMenuOpen ? (
                  <div className="student-new-profile-menu" role="menu">
                    <button type="button" role="menuitem" onClick={handleLogout}>
                      <LogOut size={16} strokeWidth={2.2} />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>

            </div>
          </header>

          {/* ─────────────────────────────────────────
              CONTENT
          ───────────────────────────────────────── */}
          <main className="student-new-content">

            {session?.user?.mustResetPassword ? (
              <section className="student-new-password-notice" role="status">
                <div>
                  <strong>Password reset pending</strong>
                  <p>You are using a temporary password. Reset it to keep your student account secure.</p>
                </div>
                <button type="button" onClick={() => navigate('/forgot-password')}>
                  Reset Password
                </button>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'dashboard' ? (
              <div className="student-new-dashboard student-dashboard-redesign">
                <section className="student-dashboard-welcome">
                  <div><p className="student-new-dashboard-kicker">STUDENT DASHBOARD</p><h1>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {displayName}</h1><p>Here&apos;s an overview of your learning progress.</p></div>
                </section>

                <section className="student-dashboard-summary-grid" aria-label="Student summary">
                  <article className="student-dashboard-summary-card"><span className="student-dashboard-icon"><BookOpen size={21} /></span><div><small>MY COURSE</small><strong>{formatValue(courseName)}</strong><span>{formatValue(batchName)} · Current Course</span></div></article>
                  <article className="student-dashboard-summary-card"><span className="student-dashboard-icon blue"><GraduationCap size={21} /></span><div><small>ASSIGNED FACULTY</small><strong>{formatValue(facultyName)}</strong><span>Current faculty</span></div></article>
                  <article className="student-dashboard-summary-card"><span className="student-dashboard-icon blue"><BarChart3 size={21} /></span><div><small>COURSE PROGRESS</small><strong>{learningProgress.overall === null ? '0%' : `${learningProgress.overall}%`}</strong><span>{learningProgress.totalModules ? `${learningProgress.completedModules} / ${learningProgress.totalModules} Modules` : 'Module completion not available'}</span></div></article>
                  <article className="student-dashboard-summary-card"><span className="student-dashboard-icon green"><CalendarCheck size={21} /></span><div><small>ATTENDANCE</small><strong>{attendanceSummary.percentage === null ? '0%' : `${attendanceSummary.percentage}%`}</strong><span>{attendanceSummary.present || attendanceSummary.absent ? `${attendanceSummary.present} Present / ${attendanceSummary.absent} Absent` : 'Attendance records not available'}</span></div></article>
                  <article className="student-dashboard-summary-card"><span className="student-dashboard-icon amber"><CreditCard size={21} /></span><div><small>PAYMENT PROGRESS</small><strong>{totalFee > 0 ? `${paymentProgress}%` : 'Not available'}</strong><span>{totalFee > 0 ? `${formatPaymentAmount(paidAmount)} paid` : 'Payment data not available'}</span></div></article>
                </section>


                <section className="student-dashboard-panel"><div className="student-dashboard-panel-heading"><div><small>ATTENDANCE</small><h2>Attendance Overview</h2></div><button type="button" onClick={() => handleMenuClick('calendar')}>View Calendar</button></div><div className="student-dashboard-attendance-overview"><div className="student-dashboard-attendance-rate"><strong>{attendanceSummary.percentage === null ? 'Not available' : `${attendanceSummary.percentage}%`}</strong><span>Overall Attendance</span><div className="student-dashboard-progress green"><i style={{ width: `${attendanceSummary.percentage || 0}%` }} /></div></div><div className="student-dashboard-mini-stats"><strong>{attendanceSummary.present}<em>Present</em></strong><strong>{attendanceSummary.absent}<em>Absent</em></strong><strong>{attendanceSummary.leave}<em>Leave</em></strong></div></div>{attendanceSummary.records.length ? <div className="student-dashboard-records">{attendanceSummary.records.slice(-6).reverse().map((record, index) => <span key={`${record.date || record.id || index}-${index}`} className={String(record.status || record.attendanceStatus).toLowerCase().includes('present') ? 'present' : 'absent'}>{String(record.status || record.attendanceStatus || 'Recorded')}</span>)}</div> : <div className="student-dashboard-empty"><CalendarCheck size={22} /><p>Recent attendance records are not available.</p></div>}</section>

                <section className="student-dashboard-panel"><div className="student-dashboard-panel-heading"><div><small>SCHEDULE</small><h2>Upcoming Classes</h2></div><button type="button" onClick={() => handleMenuClick('calendar')}>View Calendar</button></div>{upcomingClasses.length ? <div className="student-dashboard-upcoming-list">{upcomingClasses.map((event, index) => <div key={event.id || `${getEventDate(event)}-${index}`}><strong>{formatDate(getEventDate(event), { day: '2-digit', month: 'short' })}</strong><span>{formatValue(getEventTitle(event))}<small>{formatValue(event.startTime || event.start || event.from)} - {formatValue(event.endTime || event.end || event.to)}</small></span><em>{formatValue(event.facultyName || facultyName)}</em></div>)}</div> : <div className="student-dashboard-empty"><CalendarDays size={22} /><p>No upcoming classes are available.</p></div>}</section>

                <section className="student-dashboard-panel"><div className="student-dashboard-panel-heading"><div><small>UPDATES</small><h2>Notifications</h2></div><button type="button" onClick={() => navigate('/student-new-dashboard/notifications')}>View All</button></div>{notifications.length ? <div className="student-dashboard-notifications">{notifications.slice(0, 5).map((item, index) => <div key={item.id || index}><span className={item.read ? '' : 'unread'}><Bell size={16} /></span><div><strong>{formatValue(item.title)}</strong><p>{formatValue(item.message)}</p><small>{item.createdAt ? formatDate(item.createdAt) : 'Date not available'} · {item.read ? 'Read' : 'Unread'}</small></div></div>)}</div> : <div className="student-dashboard-empty"><Bell size={22} /><p>No notifications found.</p></div>}</section>
              </div>
            ) : null}

            {isLoading ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">STUDENT</p>
                <h1>Loading your details...</h1>
              </section>
            ) : null}

            {!isLoading && loadError ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">STUDENT</p>
                <h1>Student details unavailable</h1>
                <p>{loadError}</p>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'profile' ? (
              <section className="student-new-profile-page">
                <div className="student-new-profile-header-card">
                  <div className="student-new-profile-header-avatar" aria-hidden="true">
                    <CircleUserRound size={30} strokeWidth={1.9} />
                  </div>
                  <div className="student-new-profile-header-copy">
                    <p className="student-new-dashboard-kicker">STUDENT PROFILE</p>
                    <h1>{displayName}</h1>
                    <div className="student-new-profile-header-meta">
                      <span>Student ID: {student?.studentId || '-'}</span>
                      <span>{qualification} <b>•</b> {passedOutYear}</span>
                    </div>
                  </div>
                </div>

                <div className="student-new-profile-layout">
                  <div className="student-new-profile-main-column">
                    <section className="student-new-profile-card">
                      <div className="student-new-profile-card-heading">
                        <span className="student-new-profile-section-icon"><UserRound size={18} /></span>
                        <div><p>STUDENT DETAILS</p><h2>Personal Information</h2></div>
                      </div>
                      <div className="student-new-profile-fields">
                        <div className="student-new-profile-field"><Mail size={16} /><div><span>Email</span><strong>{student?.emailAddress || student?.email || '-'}</strong></div></div>
                        <div className="student-new-profile-field"><Phone size={16} /><div><span>Mobile</span><strong>{student?.mobileNumber || '-'}</strong></div></div>
                        <div className="student-new-profile-field"><Users size={16} /><div><span>Parent / Guardian</span><strong>{student?.parentSpouseNumber || '-'}</strong></div></div>
                      </div>
                    </section>

                    <section className="student-new-profile-card">
                      <div className="student-new-profile-card-heading">
                        <span className="student-new-profile-section-icon"><GraduationCap size={18} /></span>
                        <div><p>EDUCATION</p><h2>Academic Information</h2></div>
                      </div>
                      <div className="student-new-profile-fields student-new-profile-fields-two-column">
                        <div className="student-new-profile-field"><GraduationCap size={16} /><div><span>Qualification</span><strong>{qualification}</strong></div></div>
                        <div className="student-new-profile-field"><CalendarDays size={16} /><div><span>Passed Out Year</span><strong>{passedOutYear}</strong></div></div>
                        <div className="student-new-profile-field"><BookOpen size={16} /><div><span>Course</span><strong>{courseName}</strong></div></div>
                        <div className="student-new-profile-field"><Users size={16} /><div><span>Batch</span><strong>{batchName}</strong></div></div>
                      </div>
                    </section>

                    <section className="student-new-profile-card">
                      <div className="student-new-profile-card-heading">
                        <span className="student-new-profile-section-icon"><Building2 size={18} /></span>
                        <div><p>ENROLLMENT</p><h2>Admission Information</h2></div>
                      </div>
                      <div className="student-new-profile-fields student-new-profile-fields-two-column">
                        <div className="student-new-profile-field"><Building2 size={16} /><div><span>Branch</span><strong>{branchName}</strong></div></div>
                        <div className="student-new-profile-field"><CalendarDays size={16} /><div><span>Admission Date</span><strong>{student?.admissionDate ? formatPaymentDate(student.admissionDate) : '-'}</strong></div></div>
                        {courseStartDate ? <div className="student-new-profile-field"><CalendarDays size={16} /><div><span>Course Start Date</span><strong>{formatPaymentDate(courseStartDate)}</strong></div></div> : null}
                        <div className="student-new-profile-field"><Users size={16} /><div><span>Batch</span><strong>{batchName}</strong></div></div>
                      </div>
                    </section>
                  </div>

                  <aside className="student-new-profile-card student-new-course-summary-card">
                    <div className="student-new-profile-card-heading">
                      <span className="student-new-profile-section-icon"><BarChart3 size={18} /></span>
                      <div><p>OVERVIEW</p><h2>Course Summary</h2></div>
                    </div>
                    <div className="student-new-profile-summary-list">
                      <div><span>Course</span><strong>{courseName}</strong></div>
                      <div><span>Batch</span><strong>{batchName}</strong></div>
                      <div className="student-new-profile-progress-item">
                        <div><span>Course Progress</span><strong>{Number.isFinite(courseProgressNumber) && courseProgressValue !== '' && courseProgressValue !== undefined ? `${courseProgressValue}%` : '-'}</strong></div>
                        <div className="student-new-profile-progress"><i style={{ width: `${Number.isFinite(courseProgressNumber) ? Math.max(0, Math.min(courseProgressNumber, 100)) : 0}%` }} /></div>
                      </div>
                      <div className="student-new-profile-progress-item">
                        <div><span>Attendance</span><strong>{attendance}</strong></div>
                        <div className="student-new-profile-progress"><i style={{ width: `${Number.isFinite(attendanceProgressNumber) ? Math.max(0, Math.min(attendanceProgressNumber, 100)) : 0}%` }} /></div>
                      </div>
                      <div className="student-new-profile-summary-status"><span>Status</span><strong>{studentStatus}</strong></div>
                    </div>
                  </aside>
                </div>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'course' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>My Course</h1>

                <div className="student-new-detail-grid">
                  <div className="student-new-detail-item"><span>Course</span><strong>{courseName}</strong></div>
                  <div className="student-new-detail-item"><span>Faculty</span><strong>{student?.facultyName || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Batch</span><strong>{student?.batchName || student?.batch || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Batch timing</span><strong>{student?.batchTiming || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Course progress</span><strong>{student?.courseProgress ?? student?.courseCompletionPercentage ?? '-'}{student?.courseProgress || student?.courseCompletionPercentage ? '%' : ''}</strong></div>
                </div>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'attendance' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>Attendance</h1>

                <div className="student-new-detail-grid">
                  <div className="student-new-detail-item"><span>Overall attendance</span><strong>{attendance}</strong></div>
                  <div className="student-new-detail-item"><span>Course</span><strong>{courseName}</strong></div>
                  <div className="student-new-detail-item"><span>Current status</span><strong>{student?.currentStatus || student?.status || '-'}</strong></div>
                </div>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'payments' ? (
              <section className="student-new-payment-page">
                <p className="student-new-dashboard-kicker">STUDENT</p>
                <div className="student-new-payment-heading"><div><h1>Payment History</h1><p>{student?.studentName || 'Student'} · {student?.studentId || '-'}</p></div><span className={`student-new-payment-badge ${paymentStatus.toLowerCase().replace(/\s+/g, '-')}`}>{paymentStatus}</span></div>
                {paymentLoadError ? <p className="student-new-payment-note">{paymentLoadError}</p> : null}
                <div className="student-new-payment-summary">
                  <div><span>Payment amount</span><strong>{formatPaymentAmount(totalFee)}</strong><small>Total fee</small></div>
                  <div><span>Paid Amount</span><strong>{formatPaymentAmount(paidAmount)}</strong><small>Collected so far</small></div>
                  <div><span>Balance</span><strong>{formatPaymentAmount(balanceAmount)}</strong><small>Remaining amount</small></div>
                  <div><span>Payment Progress (%)</span><strong>{paymentProgress}%</strong><small>Collected against total fee</small><div className="student-new-payment-progress"><i style={{ width: `${paymentProgress}%` }} /></div></div>
                </div>
                <div className="student-new-payment-card"><h2>Installment Details</h2><p>Each installment shows the due date, payment mode, and status.</p><div className="student-new-payment-table-wrap"><table><thead><tr><th>Installment</th><th>Amount</th><th>Due Date</th><th>Payment Mode</th><th>Paid Date</th><th>Status</th></tr></thead><tbody>{installmentRows.length ? installmentRows.map((row) => <tr key={row.number}><td>{row.number}/{installmentRows.length}</td><td>{formatPaymentAmount(row.amount)}</td><td>{formatPaymentDate(row.dueDate)}</td><td>{row.paymentMode}</td><td>{formatPaymentDate(row.paidDate)}</td><td><span className={`student-new-status ${String(row.status).toLowerCase()}`}>{row.status}</span></td></tr>) : <tr><td colSpan="6" className="student-new-payment-empty">No installment plan has been configured.</td></tr>}</tbody></table></div></div>
                <div className="student-new-payment-card"><h2>Payment History</h2><p>Download any receipt directly from the history rows.</p><div className="student-new-payment-table-wrap"><table><thead><tr><th>Payment Date</th><th>Amount</th><th>Payment Mode</th><th>Installment</th><th>Receipt Download</th><th>Payment Status</th></tr></thead><tbody>{paymentHistoryRows.length ? paymentHistoryRows.map((row) => <tr key={row.id}><td>{formatPaymentDate(row.dateRaw || row.date)}</td><td><strong>{formatPaymentAmount(row.amount || row.credit)}</strong></td><td>{row.paymentMode || '-'}</td><td>{getInstallmentNumber(row) ? `${getInstallmentNumber(row)}/${installmentRows.length || '-'}` : '-'}</td><td><button type="button" className="student-new-receipt-button" onClick={() => downloadStudentReceipt(row, student, paidAmount)}><Download size={14} /> Download</button></td><td><span className="student-new-status paid">{row.status || 'Paid'}</span></td></tr>) : <tr><td colSpan="6" className="student-new-payment-empty">No payments recorded yet.</td></tr>}</tbody></table></div></div>
                {nextInstallment ? <div className="student-new-next-payment"><span>Next Payment</span><strong>{formatPaymentAmount(nextInstallment.amount)}</strong><span>Due Date</span><strong>{formatPaymentDate(nextInstallment.dueDate)}</strong><span>Status</span><strong className="pending">{nextInstallment.status}</strong></div> : null}
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'calendar' ? (
              <StudentCalendarPanel student={student} />
            ) : null}

          </main>
        </div>
      </div>
      {/* =====================================================
    LOGOUT CONFIRMATION MODAL
===================================================== */}
{isLogoutModalOpen ? (
  <div
    className="student-new-logout-overlay"
    role="presentation"
  >
    <div
      className="student-new-logout-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-logout-title"
      onClick={(event) => event.stopPropagation()}
    >
      {/* Close Button */}
      <button
        type="button"
        className="student-new-logout-close"
        aria-label="Close logout confirmation"
        onClick={handleLogoutCancel}
      >
        <X
          size={22}
          strokeWidth={2}
        />
      </button>

      {/* Message */}
      <div className="student-new-logout-content">
        <h2 id="student-logout-title">
          Are you sure you want
          <br />
          to logout?
        </h2>
      </div>

      {/* Actions */}
      <div className="student-new-logout-actions">

        <button
          type="button"
          className="student-new-logout-cancel"
          onClick={handleLogoutCancel}
        >
          Cancel
        </button>

        <button
          type="button"
          className="student-new-logout-confirm"
          onClick={handleLogoutConfirm}
        >
          Logout
        </button>

      </div>
    </div>
  </div>
) : null}
    </section>
  )
}

export default StudentNewDashboardPage
