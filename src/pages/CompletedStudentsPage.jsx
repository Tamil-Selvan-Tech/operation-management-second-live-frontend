import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, MoreVertical, RefreshCcw, Search, Trash2, Upload, X } from 'lucide-react'
import { deleteCompletedStudent, listCompletedStudentCourses } from '../services/completedStudentService'
import { BranchMonthlyReportModal } from '../components/BranchMonthlyReportModal'
import { CompletedStudentUploadModal } from '../components/CompletedStudentUploadModal'
import '../styles/CompletedStudentsPage.css'

const PAGE_SIZE = 5

function valueOf(value) {
  return value === 0 || value ? String(value) : 'N/A'
}

function formatDate(value) {
  if (!value) return 'N/A'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? valueOf(value) : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return 'N/A'
  const amount = Number(value)
  return Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN')}` : valueOf(value)
}

function attendanceLabel(row) {
  const value = row.attendancePercentage ?? row.attendancePercent
  return value === null || value === undefined || value === '' ? 'N/A' : `${value}%`
}

function academicTestValue(evaluation = {}) {
  const status = String(evaluation.status || evaluation.validationStatus || '').trim().toUpperCase()
  const completed = ['EVALUATED', 'SUBMITTED', 'COMPLETED', 'GRADED'].includes(status)
  const result = String(evaluation.resultStatus || evaluation.result || '').trim().toUpperCase()
  const obtained = Number(evaluation.obtainedMarks ?? evaluation.marksObtained ?? evaluation.marksAwarded)
  const total = Number(evaluation.totalMarks ?? evaluation.projectTotalMarks)
  const rawPercentage = Number(evaluation.percentage ?? evaluation.projectPercentage)
  const percentage = Number.isFinite(rawPercentage)
    ? rawPercentage
    : Number.isFinite(obtained) && Number.isFinite(total) && total > 0
      ? (obtained / total) * 100
      : null
  if (!completed && !Number.isFinite(percentage) && !(Number.isFinite(obtained) && obtained > 0)) return 'Pending'
  const parts = [completed ? 'Completed' : 'Pending']
  if (result) parts.push(result)
  if (Number.isFinite(obtained) && Number.isFinite(total) && total > 0) parts.push(`(${obtained}/${total})`)
  if (Number.isFinite(percentage) && (completed || obtained > 0)) parts.push(`- ${Number(percentage.toFixed(2)).toString()}%`)
  return parts.join(' ')
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '' && String(value).trim().toUpperCase() !== 'N/A'
}

function firstAvailable(...values) {
  return values.find((value) => hasValue(value))
}

function mergeStudentDetails(row = {}, student = {}, enrollment = {}) {
  const merged = { ...student, ...row }
  const fallbackFields = {
    studentId: firstAvailable(row.studentId, student.studentId, student.id),
    studentName: firstAvailable(row.studentName, student.studentName, student.name),
    parentName: firstAvailable(row.parentName, student.parentName),
    parentSpouseNumber: firstAvailable(row.parentSpouseNumber, student.parentSpouseNumber),
    mobileNumber: firstAvailable(row.mobileNumber, row.contactNumber, student.mobileNumber, student.contactNumber, student.phoneNumber),
    emailAddress: firstAvailable(row.emailAddress, row.email, student.emailAddress, student.email),
    linkedInUrl: firstAvailable(row.linkedInUrl, row.linkedinUrl, student.linkedInUrl, student.linkedinUrl),
    currentStatus: firstAvailable(row.currentStatus, student.currentStatus),
    purpose: firstAvailable(row.purpose, student.purpose),
    qualification: firstAvailable(row.qualification, student.qualification),
    educationLevel: firstAvailable(row.educationLevel, student.educationLevel),
    educationStatus: firstAvailable(row.educationStatus, student.educationStatus),
    passedOutYear: firstAvailable(row.passedOutYear, student.passedOutYear),
    designation: firstAvailable(row.designation, student.designation),
    companyName: firstAvailable(row.companyName, student.companyName),
    source: firstAvailable(row.source, student.source, student.databaseSource),
    branchAdminName: firstAvailable(row.branchAdminName, student.branchAdminName),
    courseName: firstAvailable(row.courseName, enrollment.courseName, enrollment.name, enrollment.course?.name, student.courseName, student.courseInterested),
    courseStartDate: firstAvailable(row.courseStartDate, enrollment.courseStartDate, enrollment.startDate, student.courseStartDate, student.startDate),
    courseEndDate: firstAvailable(row.courseEndDate, enrollment.courseEndDate, enrollment.endDate, student.courseEndDate, student.endDate),
    batchName: firstAvailable(row.batchName, enrollment.batchName, enrollment.batch, student.batchName, student.batch?.name),
    facultyName: firstAvailable(row.facultyName, enrollment.facultyName, student.facultyName, student.faculty?.name),
    batchTiming: firstAvailable(row.batchTiming, enrollment.batchTiming, student.batchTiming),
    scheduleType: firstAvailable(row.scheduleType, enrollment.scheduleType, student.scheduleType, student.classSchedule),
    classSchedule: firstAvailable(row.classSchedule, enrollment.classSchedule, student.classSchedule),
    courseMode: firstAvailable(row.courseMode, enrollment.courseMode, student.courseMode, student.mode),
    mode: firstAvailable(row.mode, enrollment.mode, student.mode),
    registrationFees: firstAvailable(row.registrationFees, enrollment.registrationFees, student.registrationFees),
    paymentPlanLabel: firstAvailable(row.paymentPlanLabel, row.paymentPlan, enrollment.paymentPlan, student.paymentPlan),
  }
  Object.entries(fallbackFields).forEach(([key, value]) => {
    if (hasValue(value)) merged[key] = value
  })
  return merged
}

function installmentNumberOf(payment = {}) {
  const explicitNumber = Number(payment?.installmentNumber || payment?.number || payment?.paymentInstallmentNumber)
  if (Number.isFinite(explicitNumber) && explicitNumber > 0) return explicitNumber
  const labelNumber = String(payment?.payAgainst || payment?.description || '').match(/installment\s*(\d+)/i)?.[1]
  return Number(labelNumber || 0)
}

function installmentLabel(number) {
  if (number === 1) return 'First'
  if (number === 2) return 'Second'
  if (number === 3) return 'Third'
  return `${number}th`
}

function currentStudentFinancials(student = {}, courseId = '', courseName = '') {
  const courseEntries = Array.isArray(student.courseEnrollments) && student.courseEnrollments.length
    ? student.courseEnrollments
    : Array.isArray(student.courses) ? student.courses : []
  const normalizedCourseId = String(courseId || '').trim().toLowerCase()
  const normalizedCourseName = String(courseName || '').trim().toLowerCase()
  const primaryCourse = courseEntries.find((course) => {
    const entryId = String(course?.courseId || course?.id || course?.course?.id || '').trim().toLowerCase()
    const entryName = String(course?.courseName || course?.name || course?.course?.name || '').trim().toLowerCase()
    return (normalizedCourseId && entryId === normalizedCourseId) || (normalizedCourseName && entryName === normalizedCourseName)
  }) || courseEntries[0] || {}
  const sharedInstallments = Array.isArray(student.installmentSchedule) ? student.installmentSchedule : []
  const isParallelPackage = courseEntries.length > 1 && String(student.arrangementType || student.enrollmentType || '').trim().toUpperCase() === 'PARALLEL'
  const courseAmounts = courseEntries.map((course) => Number(
    course?.finalCourseAmount ?? course?.finalFee ?? course?.totalCourseAmount ?? course?.courseAmount
    ?? course?.courseFee ?? course?.totalAmount ?? course?.afterDiscount ?? 0,
  ) || 0)
  const selectedCourseIndex = Math.max(0, courseEntries.indexOf(primaryCourse))
  const parallelInstallments = isParallelPackage && sharedInstallments.length
    ? sharedInstallments.map((installment) => {
        const totalAmount = courseAmounts.reduce((sum, amount) => sum + amount, 0)
        const sharedAmount = Number(installment?.amount ?? installment?.installmentAmount ?? 0) || 0
        const sharedPaid = Number(installment?.paidAmount ?? installment?.amountPaid ?? 0) || 0
        const allocations = Array.isArray(installment?.courseAllocations) ? installment.courseAllocations : []
        const allocation = allocations.find((item) => (
          (courseId && String(item?.courseId || '').trim().toLowerCase() === String(courseId).trim().toLowerCase())
          || String(item?.courseName || '').trim().toLowerCase() === String(courseName).trim().toLowerCase()
        ))
        const allocatedAmount = allocation
          ? Number(allocation.allocatedAmount ?? allocation.amount ?? 0) || 0
          : Math.round((sharedAmount * (courseAmounts[selectedCourseIndex] || 0)) / Math.max(totalAmount, 1))
        const allocatedPaid = allocation
          ? Math.min(allocatedAmount, Number(allocation.paidAmount ?? allocation.amountPaid ?? 0) || 0)
          : Math.min(allocatedAmount, Math.round((sharedPaid * (courseAmounts[selectedCourseIndex] || 0)) / Math.max(totalAmount, 1)))
        return { ...installment, amount: allocatedAmount, paidAmount: allocatedPaid }
      }).filter((installment) => Number(installment.amount) > 0)
    : []
  const installments = isParallelPackage
    ? parallelInstallments
    : Array.isArray(primaryCourse.installmentSchedule) && primaryCourse.installmentSchedule.length
    ? primaryCourse.installmentSchedule
      : Array.isArray(primaryCourse.paymentPlan?.installments)
        ? primaryCourse.paymentPlan.installments
        : Array.isArray(student.installmentSchedule) && student.installmentSchedule.length
          ? student.installmentSchedule
          : Array.isArray(student.paymentPlan?.installments) ? student.paymentPlan.installments : []
  const totalFees = Number(primaryCourse.finalCourseAmount ?? primaryCourse.finalFee ?? primaryCourse.totalCourseAmount
    ?? primaryCourse.courseAmount ?? primaryCourse.courseFee ?? primaryCourse.finalAmount ?? primaryCourse.amount ?? primaryCourse.totalAmount
    ?? student.finalFee ?? student.finalAmount ?? student.courseAmount ?? student.courseFees ?? student.totalFee ?? student.totalAmount ?? student.afterDiscount ?? 0)
  const paidAmount = installments.length
    ? installments.reduce((sum, item) => sum + Number(item.paidAmount ?? item.amountPaid ?? 0), 0)
    : Number(student.paidAmount ?? student.totalPaid ?? student.amountPaid ?? primaryCourse.paidAmount ?? primaryCourse.totalPaid ?? 0)
  return {
    totalFees: totalFees || null,
    paidAmount,
    pendingAmount: Math.max(totalFees - paidAmount, 0),
    installments,
  }
}

function getAcademicTestsForRow(academicProgressByStudent, studentId, courseId, courseName) {
  const index = academicProgressByStudent instanceof Map
    ? academicProgressByStudent.get(String(studentId || '').trim().toLowerCase())
    : null
  if (!index) return []
  const idKey = String(courseId || '').trim().toLowerCase()
  const nameKey = String(courseName || '').trim().toLowerCase()
  const evaluations = index.allByCourse?.[idKey] || index.allByCourse?.[nameKey] || index.byCourse?.[idKey] || index.byCourse?.[nameKey] || []
  const uniqueEvaluations = [...new Map(evaluations.map((evaluation, index) => {
    const type = String(evaluation?.type || evaluation?.testType || evaluation?.evaluationType || '').trim().toUpperCase()
    const name = String(evaluation?.name || evaluation?.title || evaluation?.testName || '').trim().toUpperCase()
    return [`${type}:${name || index}`, evaluation]
  })).values()]
  const hasCombinedEvaluation = uniqueEvaluations.some((evaluation) => {
    const type = String(evaluation?.type || evaluation?.testType || evaluation?.evaluationType || '').trim().toUpperCase()
    return type.includes('TEST') && type.includes('PROJECT')
  })
  const projectEvaluations = uniqueEvaluations.filter((evaluation) => {
    const type = String(evaluation?.type || evaluation?.testType || evaluation?.evaluationType || '').trim().toUpperCase()
    return type.includes('PROJECT') && !type.includes('TEST')
  })
  const countedEvaluations = hasCombinedEvaluation
    ? uniqueEvaluations.filter((evaluation) => {
      const type = String(evaluation?.type || evaluation?.testType || evaluation?.evaluationType || '').trim().toUpperCase()
      const name = String(evaluation?.name || evaluation?.title || evaluation?.testName || '').trim().toUpperCase()
      return !(type.includes('PROJECT') && !type.includes('TEST')) && !(name === 'PROJECT' && !type.includes('TEST'))
    })
    : uniqueEvaluations
  return countedEvaluations.map((evaluation, index) => {
    const percentage = Number(evaluation?.percentage)
    const evaluationType = String(evaluation?.type || evaluation?.testType || evaluation?.evaluationType || '').trim().toUpperCase()
    const projectPercentage = projectEvaluations.length ? Number(projectEvaluations[0]?.percentage) : Number.NaN
    const testValue = academicTestValue({ ...evaluation, percentage })
    const value = evaluationType.includes('TEST') && evaluationType.includes('PROJECT') && Number.isFinite(projectPercentage)
      ? `Test: ${testValue} · Project: ${projectPercentage}%`
      : testValue
    return {
      label: `Academic Test ${index + 1}`,
      value,
    }
  })
}

function getImportedAcademicTests(source = {}) {
  const values = source?.importedAcademicResults && typeof source.importedAcademicResults === 'object' ? source.importedAcademicResults : {}
  return Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([field, value]) => ({ label: field === 'academicProject' ? 'Academic Project' : `Assessment-${String(field.replace('assessment', '')).padStart(2, '0')}`, value: `${value}%` }))
}

function dedupeStudentCourseRows(rows = []) {
  return [...new Map(rows.map((row) => {
    const studentKey = String(row?.studentId || row?.recordId || row?.studentName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const courseKey = String(row?.courseName || row?.courseId || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return [`${studentKey}::${courseKey}`, row]
  })).values()]
}

function buildFields(row) {
  const paidInstallments = Array.isArray(row.paidInstallments) ? row.paidInstallments : []
  return [
    ['Student ID', row.studentId], ['Student Name', row.studentName], ['Parent Name', row.parentName], ['Contact Number', row.mobileNumber], ['Parent / Spouse Number', row.parentSpouseNumber], ['Email ID', row.emailAddress], ['LinkedIn URL', row.linkedInUrl],
    ['Current Status', row.customCurrentStatus || row.currentStatus], ['Purpose', row.customPurpose || row.purpose],
    ['Qualification', row.qualification], ['Education Level', row.educationLevel], ['Education Status', row.educationStatus], ['Passed Out Year', row.passedOutYear],
    ...(hasValue(row.designation) ? [['Designation', row.designation]] : []),
    ...(hasValue(row.companyName) ? [['Company Name', row.companyName]] : []),
    ['Course', row.courseName], ['Database Source', row.source], ['Branch Admin Name', row.branchAdminName],
    ['Course Starting Date', formatDate(row.courseStartDate)], ['Course Ending Date', formatDate(row.courseEndDate)],
    ['Weekday / Weekend', row.scheduleType || row.classSchedule], ['Online / Offline', row.courseMode || row.mode],
    ['Batch Timing', row.batchTiming], ['Faculty Name', row.facultyName], ['Attendance Percentage', attendanceLabel(row)],
    ['Course Fees', formatMoney(row.courseFees)], ['Registration Fees', formatMoney(row.registrationFees)], ['Payment Plan', row.paymentPlanLabel],
    ...paidInstallments.flatMap((installment) => [
      [`${installmentLabel(installment.number)} Installment`, formatMoney(installment.amount)],
      [`${installmentLabel(installment.number)} Installment Payment Mode`, installment.paymentMode],
      [`${installmentLabel(installment.number)} Installment Receipt Number`, installment.receiptNumber],
    ]),
    ['Paid Amount', formatMoney(row.paidAmount)], ['Pending Amount', formatMoney(row.pendingAmount)],
    ['Student Status', row.studentStatus], ...(hasValue(row.remarks) ? [['Remarks', row.remarks]] : []),
    ...(Array.isArray(row.academicTests) ? row.academicTests.map((test, index) => [test.label || `Academic Test ${index + 1}`, hasValue(test.value) ? test.value : academicTestValue(test)]) : []),
  ]
}

function getModalSections(fields) {
  const sectionDefinitions = [
    { title: 'Student Information', match: (label) => ['Student ID', 'Student Name', 'Parent Name', 'Contact Number', 'Parent / Spouse Number', 'Email ID', 'LinkedIn URL', 'Current Status', 'Purpose', 'Qualification', 'Education Level', 'Education Status', 'Passed Out Year', 'Designation', 'Company Name', 'Database Source', 'Branch Admin Name', 'Student Status'].includes(label) },
    { title: 'Course & Schedule', match: (label) => ['Course', 'Course Starting Date', 'Course Ending Date', 'Weekday / Weekend', 'Online / Offline', 'Batch Timing', 'Faculty Name', 'Attendance Percentage'].includes(label) },
    { title: 'Fees & Payment', match: (label) => ['Course Fees', 'Registration Fees', 'Payment Plan', 'Paid Amount', 'Pending Amount'].includes(label) || /Installment(?: Payment Mode| Receipt Number)?$/.test(label) },
    { title: 'Academic Performance', match: (label) => label.startsWith('Academic Test') || label.startsWith('Assessment-') || label === 'Academic Project' || label.startsWith('Project') },
  ]
  const remaining = fields.filter(([label]) => !sectionDefinitions.some((section) => section.match(label)))
  return [
    ...sectionDefinitions.map((section) => ({ ...section, fields: fields.filter(([label]) => section.match(label)) })).filter((section) => section.fields.length),
    ...(remaining.length ? [{ title: 'Additional Details', fields: remaining }] : []),
  ]
}

function StatusPill({ value }) {
  return <span className={`completed-students-status completed-students-status--${String(value || '').toLowerCase()}`}>{valueOf(value)}</span>
}

export function CompletedStudentsPage({ academicProgressByStudent = new Map(), branchAdminName = '', completedStudents = [], completedStudentsLoading = false, courseCatalog = [], onDeleted, paymentHistoryRecords = [], students = [] } = {}) {
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [tab, setTab] = useState('COMPLETED')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sortBy, setSortBy] = useState('studentName')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ data: [], meta: null, loading: true, error: '' })
  const [counts, setCounts] = useState({ COMPLETED: null, DISCONTINUED: null })
  const [selected, setSelected] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteState, setDeleteState] = useState({ busy: false, error: '' })
  const [actionMenuKey, setActionMenuKey] = useState(null)
  const [actionMenuPosition, setActionMenuPosition] = useState(null)
  const [actionMenuPinned, setActionMenuPinned] = useState(false)
  const openActionMenu = (event, rowKey) => { const rect = event.currentTarget.getBoundingClientRect(); const width = 142; const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)); setActionMenuPosition({ top: rect.bottom + 6, left }); setActionMenuKey(rowKey) }

  const load = useCallback(async (lifecycle = tab, requestedPage = page) => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      // Prefer the backend lifecycle endpoint whenever the active Students
      // list does not contain a local completed source. Completed imports are
      // intentionally excluded from that active list.
      if (false && lifecycle === 'COMPLETED' && Array.isArray(completedStudents) && completedStudents.length > 0) {
        if (completedStudentsLoading) {
          setState({ data: [], meta: { page: 1, total: 0, totalPages: 1 }, loading: true, error: '' })
          return
        }
        const currentStudents = Array.isArray(students) ? students : []
        const completedSource = Array.isArray(completedStudents) ? completedStudents : []
        // Historical imports are explicitly completed even when the normal
        // academic-progress index has no tests for the old course. Include
        // the refreshed student payload as a source of truth for those rows.
        const importedCompletedRows = currentStudents.flatMap((student) => {
          const completedEnrollments = (Array.isArray(student?.courseEnrollments) ? student.courseEnrollments : [])
            .filter((entry) => entry?.courseCompletedAt || entry?.completedAt)
          if (completedEnrollments.length) return completedEnrollments.map((entry) => ({ ...student, ...entry }))
          return student?.courseCompletedAt ? [student] : []
        })
        const sourceRows = [...completedSource, ...importedCompletedRows]
        const localRows = sourceRows.map((student) => {
          const matchedStudent = currentStudents.find((item) => String(item.studentId || item.id || '').trim().toLowerCase() === String(student.studentId || student.id || '').trim().toLowerCase()) || student
          // completedStudents can contain one cloned row per completed course
          // for multi-course students. Keep that course identity instead of
          // falling back to the student's primary (possibly incomplete) course.
          const courseId = student.courseId || student.course?.id || matchedStudent.courseId || matchedStudent.course?.id || ''
          const courseName = student.courseName || student.courseInterested || student.course?.name || matchedStudent.courseName || matchedStudent.courseInterested || matchedStudent.course?.name || ''
          const catalogCourse = (Array.isArray(courseCatalog) ? courseCatalog : []).find((course) => (
            (courseId && String(course?.id || '').trim() === String(courseId).trim())
            || String(course?.name || '').trim().toLowerCase() === String(courseName).trim().toLowerCase()
          ))
          const selectedEnrollment = (Array.isArray(matchedStudent.courseEnrollments) ? matchedStudent.courseEnrollments : []).find((entry) => (
            (courseId && String(entry?.courseId || entry?.id || entry?.course?.id || '').trim() === String(courseId).trim())
            || String(entry?.courseName || entry?.name || entry?.course?.name || '').trim().toLowerCase() === String(courseName).trim().toLowerCase()
          ))
          const selectedPlanId = selectedEnrollment?.paymentPlanId || selectedEnrollment?.paymentPlan?.id || matchedStudent.paymentPlanId
          const configuredPlans = Array.isArray(catalogCourse?.paymentPlans)
            ? catalogCourse.paymentPlans
            : Array.isArray(catalogCourse?.paymentPlanSelections) ? catalogCourse.paymentPlanSelections : []
          const selectedPlan = configuredPlans.find((plan) => [plan?.id, plan?.templateId, plan?.paymentPlanId].some((id) => String(id || '').trim() === String(selectedPlanId || '').trim()))
          // A completed row can be a course-specific clone of a parallel-course
          // student. Prefer that row's financial data so another enrollment's
          // schedule is never used as a fallback for this course.
          const financials = currentStudentFinancials(student, courseId, courseName)
          const allStudentPayments = (Array.isArray(paymentHistoryRecords) ? paymentHistoryRecords : []).filter((payment) => String(payment?.studentId || '').trim().toLowerCase() === String(matchedStudent.studentId || matchedStudent.id || '').trim().toLowerCase())
          const coursePayments = allStudentPayments.filter((payment) => String(payment?.course || payment?.courseName || '').trim().toLowerCase() === String(courseName).trim().toLowerCase())
          const studentPayments = courseName ? coursePayments : allStudentPayments
          const paymentHistoryPaidAmount = coursePayments.reduce((sum, payment) => sum + Number(payment?.amount ?? payment?.paidAmount ?? payment?.amountPaid ?? payment?.credit ?? 0), 0)
          const rawCoursePaidAmount = coursePayments.length ? paymentHistoryPaidAmount : Number(financials.paidAmount || 0)
          const courseTotalFees = Number(financials.totalFees || 0)
          const coursePaidAmount = courseTotalFees > 0
            ? Math.min(rawCoursePaidAmount, courseTotalFees)
            : rawCoursePaidAmount
          const selectedPlanInstallments = Array.isArray(selectedPlan?.installments) ? selectedPlan.installments : []
          const installmentSource = financials.installments.length ? financials.installments : selectedPlanInstallments
          const selectedInstallmentCount = Number(
            selectedEnrollment?.installmentCount
            || selectedEnrollment?.paymentPlanInstallmentCount
            || selectedPlan?.installmentCount
            || matchedStudent.paymentPlanInstallmentCount
            || 0,
          )
          const installmentAmount = (index) => {
            const installment = installmentSource[index]
            return typeof installment === 'number' ? installment : installment?.amount ?? installment?.installmentAmount ?? installment?.value ?? installment?.fee
          }
          const installmentLimit = selectedInstallmentCount > 0 ? selectedInstallmentCount : installmentSource.length
          const installmentValues = installmentSource.slice(0, installmentLimit).map((_, index) => installmentAmount(index)).filter((amount) => amount !== null && amount !== undefined && amount !== '')
          const paidInstallments = installmentSource.slice(0, installmentLimit).map((installment, index) => {
            const number = Number(installment?.installmentNumber || installment?.number || index + 1)
            const matchingPayment = studentPayments.find((payment) => installmentNumberOf(payment) === number)
            const paidAmount = Number(installment?.paidAmount ?? installment?.amountPaid ?? 0)
            const paymentAmount = Number(matchingPayment?.amount ?? matchingPayment?.paidAmount ?? matchingPayment?.amountPaid ?? matchingPayment?.credit ?? 0)
            const amount = installmentAmount(index)
            if (paidAmount <= 0 && paymentAmount <= 0 && !matchingPayment) return null
            return {
              number,
              amount,
              paymentMode: matchingPayment?.paymentMode || matchingPayment?.mode || installment?.paymentMode || installment?.mode || installment?.paymentMethod || 'N/A',
              receiptNumber: matchingPayment?.receiptNumber || matchingPayment?.receiptNo || matchingPayment?.receipt || installment?.receiptNumber || installment?.receiptNo || installment?.receipt || 'N/A',
            }
          }).filter(Boolean)
          const paymentPlanLabel = String(selectedPlan?.type || selectedPlan?.name || selectedPlan?.label || matchedStudent.paymentPlan || '').toLowerCase().replace(/[\s_-]/g, '')
          const isFullPaymentPlan = paymentPlanLabel.includes('fullpayment') || paymentPlanLabel === 'full' || paymentPlanLabel.includes('onetime') || Number(selectedPlan?.installmentCount) === 1
          const displayPaymentPlan = isFullPaymentPlan
            ? 'Full Installment Plan'
            : selectedPlan?.name || selectedPlan?.label || selectedEnrollment?.paymentPlan || matchedStudent.paymentPlan || (selectedInstallmentCount > 0 ? `${selectedInstallmentCount} Installment Plan` : '')
          if (!installmentValues.length && isFullPaymentPlan && financials.totalFees !== null) installmentValues.push(financials.totalFees)
          return {
            ...matchedStudent,
            recordId: matchedStudent.recordId || matchedStudent.id || matchedStudent.studentId,
            studentId: matchedStudent.studentId || matchedStudent.id,
            source: matchedStudent.source || matchedStudent.databaseSource || student.source || student.databaseSource,
            courseId,
            branchAdminName: matchedStudent.branchAdminName || branchAdminName,
            studentName: matchedStudent.studentName || matchedStudent.name,
            courseName,
            courseStartDate: selectedEnrollment?.courseStartDate || selectedEnrollment?.startDate || matchedStudent.courseStartDate || matchedStudent.startDate,
            courseEndDate: selectedEnrollment?.courseEndDate || selectedEnrollment?.endDate || matchedStudent.courseEndDate || matchedStudent.endDate,
            batchName: selectedEnrollment?.batchName || selectedEnrollment?.batch || matchedStudent.batchName || matchedStudent.batch?.name,
            facultyName: selectedEnrollment?.facultyName || matchedStudent.facultyName || matchedStudent.faculty?.name,
            attendancePercentage: matchedStudent.attendancePercentage ?? matchedStudent.attendancePercent ?? 100,
            courseFees: financials.totalFees || matchedStudent.courseFees || matchedStudent.totalFee || matchedStudent.finalFee,
            installment1: installmentAmount(0),
            installment2: installmentAmount(1),
            installment3: installmentAmount(2),
            installmentValues,
            paidInstallments,
            paymentPlanLabel: displayPaymentPlan,
            studentStatus: matchedStudent.studentStatus || matchedStudent.studentLifecycleStatus || matchedStudent.lifecycleStatus || 'Active',
            academicTests: [...getAcademicTestsForRow(academicProgressByStudent, matchedStudent.studentId || matchedStudent.id, courseId, courseName), ...getImportedAcademicTests(selectedEnrollment), ...getImportedAcademicTests(student)],
            registrationFees: matchedStudent.registrationFees ?? catalogCourse?.registrationFees ?? catalogCourse?.registrationFee,
            totalFees: financials.totalFees,
            paidAmount: coursePaidAmount,
            pendingAmount: Math.max(courseTotalFees - coursePaidAmount, 0),
            lifecycleStatus: 'COMPLETED',
          }
        }).filter((row) => !appliedSearch || [row.studentName, row.studentId, row.courseName, row.emailAddress].some((value) => String(value || '').toLowerCase().includes(appliedSearch.toLowerCase())))
        const uniqueLocalRows = dedupeStudentCourseRows(localRows)
        uniqueLocalRows.sort((left, right) => {
          const leftValue = String(left[sortBy] || left.studentName || '')
          const rightValue = String(right[sortBy] || right.studentName || '')
          const comparison = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' })
          return sortOrder === 'desc' ? -comparison : comparison
        })
        const start = (requestedPage - 1) * PAGE_SIZE
        const data = uniqueLocalRows.slice(start, start + PAGE_SIZE)
        setState({ data, meta: { page: requestedPage, total: uniqueLocalRows.length, totalPages: Math.max(1, Math.ceil(uniqueLocalRows.length / PAGE_SIZE)) }, loading: false, error: '' })
        setCounts((current) => ({ ...current, COMPLETED: uniqueLocalRows.length }))
        return
      }
      const result = await listCompletedStudentCourses({ lifecycle, search: appliedSearch, sortBy, sortOrder, page: requestedPage, limit: PAGE_SIZE })
      const normalizedCompleted = Array.isArray(completedStudents) ? completedStudents : []
      const sourceStudents = [
        ...(Array.isArray(students) ? students : []),
        ...normalizedCompleted,
      ].filter((student, index, list) => list.findIndex((item) => String(item.studentId || item.id || '').trim().toLowerCase() === String(student.studentId || student.id || '').trim().toLowerCase()) === index)
        const apiRows = result.data
      const syncedApiRows = apiRows.map((row) => {
        const rowStudentKey = row.studentId || row.id || row.recordId
        const student = sourceStudents.find((item) => String(item.studentId || item.id || item.recordId || '').trim().toLowerCase() === String(rowStudentKey || '').trim().toLowerCase())
        if (!student && lifecycle !== 'COMPLETED') return { ...row, pendingAmount: 0 }
        const courseId = row.courseId || row.course?.id || ''
        const courseName = row.courseName || row.course?.name || ''
        const selectedEnrollment = (Array.isArray(student?.courseEnrollments) ? student.courseEnrollments : []).find((entry) => (
          (courseId && String(entry?.courseId || entry?.id || entry?.course?.id || '').trim().toLowerCase() === String(courseId).trim().toLowerCase())
          || (courseName && String(entry?.courseName || entry?.name || entry?.course?.name || '').trim().toLowerCase() === String(courseName).trim().toLowerCase())
        )) || {}
        const mergedRow = mergeStudentDetails(row, student || {}, selectedEnrollment)
        const financials = currentStudentFinancials(mergedRow, courseId, courseName)
        const resolvedTotalFees = hasValue(row.totalFees) ? Number(row.totalFees) : Number(financials.totalFees || 0)
        const resolvedPaidAmount = hasValue(row.paidAmount)
          ? row.paidAmount
          : financials.paidAmount > 0
            ? financials.paidAmount
            : resolvedTotalFees
        const resolvedPendingAmount = hasValue(row.pendingAmount)
          ? row.pendingAmount
          : Math.max(resolvedTotalFees - Number(resolvedPaidAmount || 0), 0)
        return {
          ...mergedRow,
          totalFees: resolvedTotalFees || financials.totalFees,
          paidAmount: resolvedPaidAmount,
          pendingAmount: lifecycle === 'DISCONTINUED' ? 0 : resolvedPendingAmount,
          attendancePercentage: hasValue(row.attendancePercentage)
            ? row.attendancePercentage
            : student?.attendancePercentage ?? student?.attendancePercent ?? 100,
        }
      })
      const apiStudentIds = new Set(syncedApiRows.map((row) => String(row.studentId || '').trim().toLowerCase()))
      const supplementalRows = lifecycle === 'COMPLETED'
        ? normalizedCompleted
          .filter((student) => !apiStudentIds.has(String(student.studentId || student.id || '').trim().toLowerCase()))
          .map((student) => ({
            recordId: student.recordId || student.id || student.studentId,
            studentId: student.studentId || student.id,
            studentName: student.studentName || student.name,
            courseName: student.courseName || student.courseInterested || student.course?.name,
            courseStartDate: student.courseStartDate || student.startDate,
            courseEndDate: student.courseEndDate || student.endDate,
            batchName: student.batchName || student.batch?.name,
            facultyName: student.facultyName || student.faculty?.name,
            totalFees: student.finalFee || student.totalAmount || student.courseAmount,
            paidAmount: student.paidAmount || student.totalPaid,
            pendingAmount: student.pendingAmount,
            lifecycleStatus: 'COMPLETED',
          }))
        : []
      const data = dedupeStudentCourseRows([...syncedApiRows, ...supplementalRows])
      const mergedMeta = { ...(result.meta || {}), total: Math.max(Number(result.meta?.total || 0), data.length) }
      mergedMeta.totalPages = Math.max(1, Math.ceil(mergedMeta.total / PAGE_SIZE))
      setState({ ...result, meta: mergedMeta, data, loading: false, error: '' })
      setCounts((current) => ({ ...current, [lifecycle]: mergedMeta.total }))
    } catch (error) {
      const fallbackData = lifecycle === 'COMPLETED'
        ? (Array.isArray(completedStudents) ? completedStudents : []).map((student) => {
          const financials = currentStudentFinancials(student)
          return {
            recordId: student.recordId || student.id || student.studentId,
            studentId: student.studentId || student.id,
            studentName: student.studentName || student.name,
            courseName: student.courseName || student.courseInterested || student.course?.name,
            courseStartDate: student.courseStartDate || student.startDate,
            courseEndDate: student.courseEndDate || student.endDate,
            batchName: student.batchName || student.batch?.name,
            facultyName: student.facultyName || student.faculty?.name,
            totalFees: financials.totalFees,
            paidAmount: financials.paidAmount,
            pendingAmount: financials.pendingAmount,
            lifecycleStatus: 'COMPLETED',
          }
        })
        : []
      const uniqueFallbackData = dedupeStudentCourseRows(fallbackData)
      setState({
        data: uniqueFallbackData,
        meta: { page: 1, total: uniqueFallbackData.length, totalPages: 1 },
        loading: false,
        error: uniqueFallbackData.length ? '' : (error?.message || 'Unable to load student records.'),
      })
      setCounts((current) => ({ ...current, [lifecycle]: uniqueFallbackData.length }))
    }
  }, [academicProgressByStudent, appliedSearch, branchAdminName, completedStudents, completedStudentsLoading, courseCatalog, page, paymentHistoryRecords, sortBy, sortOrder, students, tab])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!actionMenuKey) return undefined
    const closeMenu = (event) => {
      if (!event.target.closest('.completed-students-action-menu')) { setActionMenuKey(null); setActionMenuPosition(null); setActionMenuPinned(false) }
    }
    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [actionMenuKey])

  const switchTab = (nextTab) => {
    setTab(nextTab)
    setPage(1)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleteState.busy) return
    setDeleteState({ busy: true, error: '' })
    try {
      const studentId = deleteTarget.studentId || deleteTarget.recordId
      await deleteCompletedStudent(studentId)
      const deletedKey = String(studentId || '').trim().toLowerCase()
      const isDeleted = (row) => String(row?.studentId || row?.recordId || '').trim().toLowerCase() === deletedKey
      setState((current) => {
        const removedCount = current.data.filter(isDeleted).length
        return {
          ...current,
          data: current.data.filter((row) => !isDeleted(row)),
          meta: current.meta ? { ...current.meta, total: Math.max(0, Number(current.meta.total || 0) - removedCount) } : current.meta,
        }
      })
      setCounts((current) => ({ ...current, [tab]: Math.max(0, Number(current[tab] || 0) - 1) }))
      setSelected((current) => current && isDeleted(current) ? null : current)
      setDeleteTarget(null)
      await onDeleted?.()
    } catch (error) {
      setDeleteState({ busy: false, error: error?.message || 'Unable to delete this student. Please try again.' })
      return
    }
    setDeleteState({ busy: false, error: '' })
  }

  const totalPages = Math.max(1, Number(state.meta?.totalPages || Math.ceil(Number(state.meta?.total || 0) / PAGE_SIZE) || 1))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const pageWindowStart = Math.min(Math.max(safePage - 1, 1), Math.max(totalPages - 2, 1))
  const pageNumbers = Array.from({ length: Math.min(3, totalPages) }, (_, index) => pageWindowStart + index)
  const displayRows = dedupeStudentCourseRows(state.data)
  const selectedSections = selected ? getModalSections(buildFields(selected)) : []
  const selectedSection = (title) => selectedSections.find((section) => section.title === title)
  const selectedValue = (label) => buildFields(selected || {}).find(([field]) => field === label)?.[1]

  if (isUploadOpen) {
    return (
      <CompletedStudentUploadModal
        isOpen
        onClose={() => setIsUploadOpen(false)}
        onImported={async () => { await onDeleted?.() }}
      />
    )
  }

  return (
    <section className="completed-students-page">
      <header className="completed-students-header">
        <div><p className="completed-students-kicker">ACADEMIC OPERATION</p><h1>Completed Students</h1><p>Review course records that are completed or discontinued from the persisted branch data.</p></div>
        <div className="completed-students-header-actions"><button type="button" className="completed-students-upload" onClick={() => setIsUploadOpen(true)}><Upload size={17} /> Upload Report</button><button type="button" className="completed-students-report" onClick={() => setIsReportOpen(true)}><Download size={17} /> Student Status Report</button><button type="button" className="completed-students-refresh" onClick={() => void load()} disabled={state.loading}><RefreshCcw size={17} className={state.loading ? 'is-spinning' : ''} /> Refresh</button></div>
      </header>

      <div className="completed-students-tabs" role="tablist" aria-label="Student course lifecycle">
        {['COMPLETED', 'DISCONTINUED'].map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => switchTab(item)}><span>{item === 'COMPLETED' ? 'Completed Students' : 'Discontinued Students'}</span><strong>{counts[item] ?? '—'}</strong></button>)}
      </div>

      <div className="completed-students-toolbar">
        <label className="completed-students-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setAppliedSearch(search.trim()); setPage(1) } }} placeholder="Search student, ID, course or email" /></label>
        <button type="button" className="completed-students-search-button" onClick={() => { setAppliedSearch(search.trim()); setPage(1) }}>Search</button>
        <select value={`${sortBy}:${sortOrder}`} onChange={(event) => { const [nextSort, nextOrder] = event.target.value.split(':'); setSortBy(nextSort); setSortOrder(nextOrder); setPage(1) }} aria-label="Sort records"><option value="studentName:asc">Name A-Z</option><option value="studentName:desc">Name Z-A</option><option value="courseName:asc">Course A-Z</option><option value="courseStartDate:desc">Newest course</option></select>
      </div>

      {state.error ? <div className="completed-students-error" role="alert">{state.error}</div> : null}
      <div className="completed-students-table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Dates</th><th>Batch / Faculty</th><th>Attendance</th><th>Total Fees</th><th>Paid</th><th>Pending</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {state.loading ? <tr><td colSpan="10" className="completed-students-state">Loading records…</td></tr> : displayRows.length ? displayRows.map((row) => { const rowKey = `${row.studentId || row.recordId}-${row.courseName || row.courseId}`; return <tr key={rowKey} onClick={() => setSelected(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(row) } }} role="button" tabIndex={0}><td><strong>{valueOf(row.studentName)}</strong><small>{valueOf(row.studentId)}</small></td><td>{valueOf(row.courseName)}</td><td>{formatDate(row.courseStartDate)}<small>to {formatDate(row.courseEndDate)}</small></td><td>{valueOf(row.batchName)}<small>{valueOf(row.facultyName)}</small></td><td>{attendanceLabel(row)}</td><td>{formatMoney(row.totalFees)}</td><td>{formatMoney(row.paidAmount)}</td><td>{formatMoney(row.pendingAmount)}</td><td><StatusPill value={row.lifecycleStatus || tab} /></td><td className="completed-students-actions"><div className="completed-students-action-menu"><button type="button" className="completed-students-action-trigger" aria-label={`Open actions for ${row.studentName || 'student'}`} aria-expanded={actionMenuKey === rowKey} onMouseEnter={(event) => openActionMenu(event, rowKey)} onMouseLeave={() => { if (actionMenuKey === rowKey && !actionMenuPinned) { setActionMenuKey(null); setActionMenuPosition(null) } }} onClick={(event) => { event.stopPropagation(); if (actionMenuKey === rowKey && actionMenuPinned) { setActionMenuKey(null); setActionMenuPosition(null); setActionMenuPinned(false) } else { setActionMenuPinned(true); openActionMenu(event, rowKey) } }}><MoreVertical size={18} /></button>{actionMenuKey === rowKey ? <div className="completed-students-action-dropdown" role="menu" style={actionMenuPosition ? { top: `${actionMenuPosition.top}px`, left: `${actionMenuPosition.left}px` } : undefined}><button type="button" role="menuitem" onClick={(event) => { event.stopPropagation(); setActionMenuKey(null); setActionMenuPosition(null); setActionMenuPinned(false); setSelected(row) }}><Eye size={15} /> View</button><button type="button" role="menuitem" className="is-danger" onClick={(event) => { event.stopPropagation(); setActionMenuKey(null); setActionMenuPosition(null); setActionMenuPinned(false); setDeleteState({ busy: false, error: '' }); setDeleteTarget(row) }}><Trash2 size={15} /> Delete</button></div> : null}</div></td></tr> }) : <tr><td colSpan="10" className="completed-students-state"><CheckCircle2 size={22} /><strong>No {tab === 'COMPLETED' ? 'completed' : 'discontinued'} course records found.</strong><span>Records will appear here when the persisted course status changes.</span></td></tr>}
      </tbody></table></div>

      <footer className="completed-students-pagination">
        <div className="completed-students-pagination-controls">
          <button type="button" className="completed-students-pagination-nav" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1 || state.loading}><ChevronLeft size={16} /> <span>Previous</span></button>
          <div className="completed-students-pagination-pages" aria-label="Completed students pages">
            {pageNumbers.map((pageNumber) => <button key={pageNumber} type="button" className={pageNumber === safePage ? 'is-active' : ''} onClick={() => setPage(pageNumber)} disabled={state.loading}>{pageNumber}</button>)}
          </div>
          <button type="button" className="completed-students-pagination-nav" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages || state.loading}><span>Next</span> <ChevronRight size={16} /></button>
        </div>
        <span className="completed-students-pagination-summary">{state.meta?.total ? `${safePage} of ${totalPages}` : 'No records'}</span>
      </footer>

      {selected ? <div className="completed-students-modal-backdrop" role="presentation"><section className="completed-students-modal completed-students-view-modal" role="dialog" aria-modal="true" aria-labelledby="completed-student-details-title"><header className="completed-students-modal-header"><div className="completed-students-profile"><div className="completed-students-avatar">{String(selected.studentName || '?').trim().charAt(0).toUpperCase()}</div><div><p className="completed-students-kicker">COURSE RECORD</p><h2 id="completed-student-details-title">{valueOf(selected.studentName)}</h2><span>{valueOf(selected.studentId)}{selected.courseName ? ` · ${selected.courseName}` : ''}</span></div></div><button type="button" className="completed-students-modal-close" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button></header><div className="completed-students-view-summary"><div><span>Current Status</span><strong>{valueOf(selectedValue('Current Status') || selected.currentStatus || selected.studentStatus)}</strong></div><div><span>Purpose</span><strong>{valueOf(selectedValue('Purpose'))}</strong></div><div><span>Student Status</span><strong className="completed-students-summary-status">{valueOf(selectedValue('Student Status') || selected.lifecycleStatus)}</strong></div></div><div className="completed-students-modal-body"><section className="completed-students-modal-section completed-students-view-card completed-students-view-card--full"><h3>Student Information</h3><dl>{selectedSection('Student Information')?.fields.map(([label, value]) => <div className="completed-students-modal-field" key={label}><dt>{label}</dt><dd>{valueOf(value)}</dd></div>)}</dl></section><div className="completed-students-view-grid"><section className="completed-students-modal-section completed-students-view-card"><h3>Course &amp; Schedule</h3><dl>{selectedSection('Course & Schedule')?.fields.map(([label, value]) => <div className="completed-students-modal-field" key={label}><dt>{label}</dt><dd>{valueOf(value)}</dd></div>)}</dl></section><section className="completed-students-modal-section completed-students-view-card"><h3>Fees &amp; Payment</h3><dl>{selectedSection('Fees & Payment')?.fields.map(([label, value]) => <div className="completed-students-modal-field" key={label}><dt>{label}</dt><dd>{valueOf(value)}</dd></div>)}</dl></section></div>{selectedSection('Academic Performance')?.fields.length ? <section className="completed-students-modal-section completed-students-view-card completed-students-view-card--full completed-students-view-card--academic"><h3>Academic Performance</h3><dl>{selectedSection('Academic Performance').fields.map(([label, value]) => <div className="completed-students-modal-field" key={label}><dt>{label}</dt><dd>{valueOf(value)}</dd></div>)}</dl></section> : null}</div></section></div> : null}

      {deleteTarget ? <div className="completed-students-modal-backdrop" role="presentation"><section className="completed-students-modal completed-students-delete-modal" role="dialog" aria-modal="true" aria-labelledby="completed-student-delete-title"><header className="completed-students-modal-header"><div className="completed-students-profile"><div className="completed-students-delete-icon"><Trash2 size={20} /></div><div><p className="completed-students-kicker">PERMANENT ACTION</p><h2 id="completed-student-delete-title">Delete student?</h2><span>{valueOf(deleteTarget.studentName)} · {valueOf(deleteTarget.studentId)}</span></div></div><button type="button" className="completed-students-modal-close" onClick={() => setDeleteTarget(null)} disabled={deleteState.busy} aria-label="Close"><X size={18} /></button></header><div className="completed-students-delete-body"><p>This will permanently delete this student and all related course records, payments, installments, attendance, academic tests/projects, exam attempts, and discontinuation data.</p><strong>This action cannot be undone.</strong>{deleteState.error ? <div className="completed-students-error" role="alert">{deleteState.error}</div> : null}</div><footer className="completed-students-delete-actions"><button type="button" className="completed-students-delete-cancel" onClick={() => setDeleteTarget(null)} disabled={deleteState.busy}>Cancel</button><button type="button" className="completed-students-delete-confirm" onClick={() => void confirmDelete()} disabled={deleteState.busy}>{deleteState.busy ? 'Deleting…' : 'Delete permanently'}</button></footer></section></div> : null}

      <BranchMonthlyReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} reportVariant="student-status" />
    </section>
  )
}

export default CompletedStudentsPage
