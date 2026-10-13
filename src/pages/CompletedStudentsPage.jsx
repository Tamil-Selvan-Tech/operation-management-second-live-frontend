import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, RefreshCcw, Search, X } from 'lucide-react'
import { listCompletedStudentCourses } from '../services/completedStudentService'
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

function hasValue(value) {
  return value !== null && value !== undefined && value !== '' && String(value).trim().toUpperCase() !== 'N/A'
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
  const installments = Array.isArray(primaryCourse.installmentSchedule) && primaryCourse.installmentSchedule.length
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
    const testValue = Number.isFinite(percentage) ? `${percentage}%` : (String(evaluation?.status || '').trim() || 'Not Evaluated')
    const value = evaluationType.includes('TEST') && evaluationType.includes('PROJECT') && Number.isFinite(projectPercentage)
      ? `Test: ${testValue} · Project: ${projectPercentage}%`
      : testValue
    return {
      label: `Academic Test ${index + 1}`,
      value,
    }
  })
}

function buildFields(row) {
  const installmentValues = Array.isArray(row.installmentValues) && row.installmentValues.length
    ? row.installmentValues
    : [row.installment1, row.installment2, row.installment3]
  return [
    ['Student ID', row.studentId], ['Student Name', row.studentName], ['Contact Number', row.mobileNumber], ['Email ID', row.emailAddress],
    ['Course', row.courseName], ['Database Source', row.source], ['Branch Admin Name', row.branchAdminName],
    ['Course Starting Date', formatDate(row.courseStartDate)], ['Course Ending Date', formatDate(row.courseEndDate)],
    ['Weekday / Weekend', row.scheduleType || row.classSchedule], ['Online / Offline', row.courseMode || row.mode],
    ['Batch Timing', row.batchTiming], ['Faculty Name', row.facultyName], ['Attendance Percentage', attendanceLabel(row)],
    ['Course Fees', formatMoney(row.courseFees)], ['Registration Fees', formatMoney(row.registrationFees)], ['Payment Plan', row.paymentPlanLabel], ['Payment Mode', row.paymentModeLabel], ['Receipt Number', row.receiptNumber],
    ...installmentValues.map((amount, index) => [`${index === 0 ? 'First' : index === 1 ? 'Second' : index === 2 ? 'Third' : `${index + 1}th`} Installment`, formatMoney(amount)]),
    ['Paid Amount', formatMoney(row.paidAmount)], ['Pending Amount', formatMoney(row.pendingAmount)],
    ['Student Status', row.studentStatus], ...(hasValue(row.remarks) ? [['Remarks', row.remarks]] : []),
    ...(Array.isArray(row.academicTests) ? row.academicTests.map((test) => [test.label, test.value]) : []),
  ].filter(([label, value]) => !/^(First|Second|Third) Installment$/.test(label) || (value !== null && value !== undefined && value !== ''))
}

function getModalSections(fields) {
  const sectionDefinitions = [
    { title: 'Student Information', match: (label) => ['Student ID', 'Student Name', 'Contact Number', 'Email ID', 'Database Source', 'Branch Admin Name', 'Student Status'].includes(label) },
    { title: 'Course & Schedule', match: (label) => ['Course', 'Course Starting Date', 'Course Ending Date', 'Weekday / Weekend', 'Online / Offline', 'Batch Timing', 'Faculty Name', 'Attendance Percentage'].includes(label) },
    { title: 'Fees & Payment', match: (label) => ['Course Fees', 'Registration Fees', 'Payment Plan', 'Payment Mode', 'Receipt Number', 'Paid Amount', 'Pending Amount'].includes(label) || /Installment$/.test(label) },
    { title: 'Academic Performance', match: (label) => label.startsWith('Academic Test') || label.startsWith('Project') },
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

export function CompletedStudentsPage({ academicProgressByStudent = new Map(), branchAdminName = '', completedStudents = [], completedStudentsLoading = false, courseCatalog = [], paymentHistoryRecords = [], students = [] } = {}) {
  const [tab, setTab] = useState('COMPLETED')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sortBy, setSortBy] = useState('studentName')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ data: [], meta: null, loading: true, error: '' })
  const [counts, setCounts] = useState({ COMPLETED: null, DISCONTINUED: null })
  const [selected, setSelected] = useState(null)

  const load = useCallback(async (lifecycle = tab, requestedPage = page) => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      if (lifecycle === 'COMPLETED') {
        if (completedStudentsLoading) {
          setState({ data: [], meta: { page: 1, total: 0, totalPages: 1 }, loading: true, error: '' })
          return
        }
        const currentStudents = Array.isArray(students) ? students : []
        const completedSource = Array.isArray(completedStudents) ? completedStudents : []
        const localRows = completedSource.map((student) => {
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
          const financials = currentStudentFinancials(matchedStudent, courseId, courseName)
          const allStudentPayments = (Array.isArray(paymentHistoryRecords) ? paymentHistoryRecords : []).filter((payment) => String(payment?.studentId || '').trim().toLowerCase() === String(matchedStudent.studentId || matchedStudent.id || '').trim().toLowerCase())
          const coursePayments = allStudentPayments.filter((payment) => String(payment?.course || payment?.courseName || '').trim().toLowerCase() === String(courseName).trim().toLowerCase())
          const studentPayments = coursePayments.length ? coursePayments : allStudentPayments
          const firstInstallmentPayment = studentPayments.find((payment) => {
            const explicitNumber = Number(payment?.installmentNumber || payment?.number)
            const labelNumber = String(payment?.payAgainst || payment?.description || '').match(/installment\s*(\d+)/i)?.[1]
            return explicitNumber === 1 || Number(labelNumber) === 1
          }) || studentPayments[0] || {}
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
            paymentPlanLabel: displayPaymentPlan,
            paymentModeLabel: firstInstallmentPayment.paymentMode || firstInstallmentPayment.mode || matchedStudent.paymentMode || 'Installment',
            receiptNumber: firstInstallmentPayment.receiptNumber || firstInstallmentPayment.receiptNo || firstInstallmentPayment.receipt || firstInstallmentPayment.receiptId || firstInstallmentPayment.id || '',
            studentStatus: matchedStudent.studentStatus || matchedStudent.studentLifecycleStatus || matchedStudent.lifecycleStatus || 'Active',
            academicTests: getAcademicTestsForRow(academicProgressByStudent, matchedStudent.studentId || matchedStudent.id, courseId, courseName),
            registrationFees: matchedStudent.registrationFees ?? catalogCourse?.registrationFees ?? catalogCourse?.registrationFee,
            totalFees: financials.totalFees,
            paidAmount: financials.paidAmount || financials.totalFees,
            pendingAmount: financials.paidAmount ? financials.pendingAmount : 0,
            lifecycleStatus: 'COMPLETED',
          }
        }).filter((row) => !appliedSearch || [row.studentName, row.studentId, row.courseName, row.emailAddress].some((value) => String(value || '').toLowerCase().includes(appliedSearch.toLowerCase())))
        localRows.sort((left, right) => {
          const leftValue = String(left[sortBy] || left.studentName || '')
          const rightValue = String(right[sortBy] || right.studentName || '')
          const comparison = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' })
          return sortOrder === 'desc' ? -comparison : comparison
        })
        const start = (requestedPage - 1) * PAGE_SIZE
        const data = localRows.slice(start, start + PAGE_SIZE)
        setState({ data, meta: { page: requestedPage, total: localRows.length, totalPages: Math.max(1, Math.ceil(localRows.length / PAGE_SIZE)) }, loading: false, error: '' })
        setCounts((current) => ({ ...current, COMPLETED: localRows.length }))
        return
      }
      const result = await listCompletedStudentCourses({ lifecycle, search: appliedSearch, sortBy, sortOrder, page: requestedPage, limit: PAGE_SIZE })
      const normalizedCompleted = Array.isArray(completedStudents) ? completedStudents : []
      const sourceStudents = [
        ...normalizedCompleted,
        ...(Array.isArray(students) ? students : []),
      ].filter((student, index, list) => list.findIndex((item) => String(item.studentId || item.id || '').trim().toLowerCase() === String(student.studentId || student.id || '').trim().toLowerCase()) === index)
      const hasCompletionSync = normalizedCompleted.length > 0
      const apiRows = lifecycle === 'COMPLETED' && hasCompletionSync
        ? result.data.filter((row) => normalizedCompleted.some((student) => String(student.studentId || student.id || '').trim().toLowerCase() === String(row.studentId || '').trim().toLowerCase()))
        : result.data
      const syncedApiRows = apiRows.map((row) => {
        const student = sourceStudents.find((item) => String(item.studentId || item.id || '').trim().toLowerCase() === String(row.studentId || '').trim().toLowerCase())
        if (!student && lifecycle !== 'COMPLETED') return row
        const financials = currentStudentFinancials(student || {})
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
          ...row,
          totalFees: resolvedTotalFees || financials.totalFees,
          paidAmount: resolvedPaidAmount,
          pendingAmount: resolvedPendingAmount,
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
      const data = [...syncedApiRows, ...supplementalRows]
      setState({ ...result, data, loading: false, error: '' })
      setCounts((current) => ({ ...current, [lifecycle]: lifecycle === 'COMPLETED' ? data.length : (result.meta?.total ?? result.data.length) }))
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
      setState({
        data: fallbackData,
        meta: { page: 1, total: fallbackData.length, totalPages: 1 },
        loading: false,
        error: fallbackData.length ? '' : (error?.message || 'Unable to load student records.'),
      })
      setCounts((current) => ({ ...current, [lifecycle]: fallbackData.length }))
    }
  }, [academicProgressByStudent, appliedSearch, branchAdminName, completedStudents, completedStudentsLoading, courseCatalog, page, paymentHistoryRecords, sortBy, sortOrder, students, tab])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const switchTab = (nextTab) => {
    setTab(nextTab)
    setPage(1)
  }

  const totalPages = Math.max(1, Number(state.meta?.totalPages || Math.ceil(Number(state.meta?.total || 0) / PAGE_SIZE) || 1))

  return (
    <section className="completed-students-page">
      <header className="completed-students-header">
        <div><p className="completed-students-kicker">ACADEMIC OPERATION</p><h1>Completed Students</h1><p>Review course records that are completed or discontinued from the persisted branch data.</p></div>
        <button type="button" className="completed-students-refresh" onClick={() => void load()} disabled={state.loading}><RefreshCcw size={17} className={state.loading ? 'is-spinning' : ''} /> Refresh</button>
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
      <div className="completed-students-table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Dates</th><th>Batch / Faculty</th><th>Attendance</th><th>Total Fees</th><th>Paid</th><th>Pending</th><th>Status</th><th>Details</th></tr></thead><tbody>
        {state.loading ? <tr><td colSpan="10" className="completed-students-state">Loading records…</td></tr> : state.data.length ? state.data.map((row) => <tr key={row.recordId || `${row.studentId}-${row.courseId}`} onClick={() => setSelected(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(row) } }} role="button" tabIndex={0}><td><strong>{valueOf(row.studentName)}</strong><small>{valueOf(row.studentId)}</small></td><td>{valueOf(row.courseName)}</td><td>{formatDate(row.courseStartDate)}<small>to {formatDate(row.courseEndDate)}</small></td><td>{valueOf(row.batchName)}<small>{valueOf(row.facultyName)}</small></td><td>{attendanceLabel(row)}</td><td>{formatMoney(row.totalFees)}</td><td>{formatMoney(row.paidAmount)}</td><td>{formatMoney(row.pendingAmount)}</td><td><StatusPill value={row.lifecycleStatus || tab} /></td><td><button type="button" className="completed-students-view" onClick={(event) => { event.stopPropagation(); setSelected(row) }}><Eye size={16} /> View</button></td></tr>) : <tr><td colSpan="10" className="completed-students-state"><CheckCircle2 size={22} /><strong>No {tab === 'COMPLETED' ? 'completed' : 'discontinued'} course records found.</strong><span>Records will appear here when the persisted course status changes.</span></td></tr>}
      </tbody></table></div>

      <footer className="completed-students-pagination"><span>{state.meta?.total ? `Showing page ${state.meta.page} of ${totalPages}` : 'No records'}</span><div><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || state.loading}><ChevronLeft size={17} /></button><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || state.loading}><ChevronRight size={17} /></button></div></footer>

      {selected ? <div className="completed-students-modal-backdrop" role="presentation"><section className="completed-students-modal" role="dialog" aria-modal="true" aria-labelledby="completed-student-details-title"><header className="completed-students-modal-header"><div><p className="completed-students-kicker">COURSE RECORD</p><h2 id="completed-student-details-title">{valueOf(selected.studentName)}</h2><span>{valueOf(selected.studentId)}{selected.courseName ? ` · ${selected.courseName}` : ''}</span></div><button type="button" className="completed-students-modal-close" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button></header><div className="completed-students-modal-body">{getModalSections(buildFields(selected)).map((section) => <section className="completed-students-modal-section" key={section.title}><h3>{section.title}</h3><dl>{section.fields.map(([label, value]) => <div className="completed-students-modal-field" key={label}><dt>{label}</dt><dd>{valueOf(value)}</dd></div>)}</dl></section>)}</div></section></div> : null}

    </section>
  )
}

export default CompletedStudentsPage
