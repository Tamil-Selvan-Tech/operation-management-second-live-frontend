import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpen, Building2, CalendarDays, Check, Clock3, CreditCard, GraduationCap, IndianRupee, Layers3, RefreshCw, Search, Send, UserRound, UserRoundCheck, Users, Wallet, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { request } from '../services/apiClient'
import { loadSession } from '../lib/session'
import { createSalesAdminBatchRequest, listSalesAdminBatchRequests, resendSalesAdminBatchRequest } from '../services/salesCrmBatchRequestService'
import '../styles/SalesAdminAdmissionsPage.css'
import '../styles/BranchAdmissionsHub.css'

const BranchDashboardPage = lazy(() => import('./BranchDashboardPage').then(({ BranchDashboardPage: Page }) => ({ default: Page })))
const statusOptions = [['ALL', 'All admissions'], ['PENDING', 'Pending'], ['IN_PROGRESS', 'In Progress'], ['PENDING_BRANCH_APPROVAL', 'Waiting for Branch Approval'], ['REJECTED', 'Rejected'], ['ADMITTED', 'Admitted']]

function AdmissionsTableSkeleton({ columns = 13 }) {
  return Array.from({ length: 5 }, (_, index) => (
    <tr key={`admission-skeleton-${index}`} className="sales-admissions-skeleton-row" aria-hidden="true">
      <td colSpan={columns}><div className="sales-admissions-skeleton-grid">{Array.from({ length: columns }, (_, cellIndex) => <i key={cellIndex} />)}</div></td>
    </tr>
  ))
}

function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'
}

function unwrap(response) {
  return response?.data ?? response ?? {}
}

function AdmissionForm({ lead, onCancel, onComplete }) {
  return <div className="sales-admission-form-shell">
    <button type="button" className="sales-admission-back-link" onClick={onCancel}><ArrowLeft size={16} /> Back to admissions</button>
    <div className="sales-admission-form-heading"><div><span>SALES CRM · STUDENT ADMISSION</span><h2>{lead.studentName}</h2><p>{lead.leadId} · {lead.branch?.branchName || 'Branch'}</p></div><GraduationCap size={25} /></div>
    <Suspense fallback={<div className="sales-admissions-state">Loading the student admission form…</div>}>
      <BranchDashboardPage
        embeddedMode
        branchData={lead.branch}
        initialSection="students"
        admissionOnlyMode
        admissionLead={lead}
        onAdmissionCancel={onCancel}
        onAdmissionComplete={onComplete}
      />
    </Suspense>
  </div>
}

function StudentDetailsModal({ student, loading, error, onClose, onRetry }) {
  const details = student.feeDetails
  const courseEnrollment = student.courseEnrollments?.[0] || {}
  const email = student.emailAddress || student.email
  const courseName = student.courseName || courseEnrollment.courseName
  const facultyName = student.facultyName || courseEnrollment.facultyName
  const batchName = student.batchName || courseEnrollment.batchName
  const batchTiming = student.batchTiming || student.batchTime || courseEnrollment.batchTiming || courseEnrollment.timing
  const courseMode = student.courseMode || courseEnrollment.mode
  const classSchedule = student.classSchedule || courseEnrollment.scheduleType
  const studentFields = [
    ['Student ID', student.studentId],
    ['Student Name', student.studentName],
    ['Email', email],
    ['Phone Number', student.mobileNumber],
    ['Branch', student.branchName],
    ['Admission Date', student.admissionDate],
  ]
  const courseFields = [
    ['Course Name', courseName],
    ['Branch Name', student.branchName],
    ['Assigned Faculty', facultyName],
    ['Assigned Batch', batchName],
    ['Training Mode', courseMode],
    ['Weekday / Weekend Schedule', classSchedule],
    ['Batch Timing', batchTiming],
  ]

  const renderFields = (fields) => fields.map(([label, value]) => <div className="sales-admission-detail-item" key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)

  return <div className="sales-admission-view-backdrop" role="presentation" onClick={onClose}>
    <section className="sales-admission-view-dialog" role="dialog" aria-modal="true" aria-labelledby="sales-admission-view-title" onClick={(event) => event.stopPropagation()}>
      <header className="sales-admission-modal-header">
        <div className="sales-admission-modal-identity">
          <span className="sales-admission-modal-avatar"><UserRound size={19} /></span>
          <div><span className="sales-admission-modal-eyebrow">ADMITTED STUDENT</span><h2 id="sales-admission-view-title">{student.studentName}</h2><p>Student ID: {student.studentId || '—'}</p></div>
        </div>
        <div className="sales-admission-modal-header-actions"><span className="sales-admission-admitted-badge">ADMITTED</span><button type="button" onClick={onClose} aria-label="Close student details"><X size={19} /></button></div>
      </header>

      <div className="sales-admission-modal-body">
        <section className="sales-admission-modal-section">
          <h3><UserRound size={17} />Student Information</h3>
          <div className="sales-admission-detail-grid">{renderFields(studentFields)}</div>
        </section>

        <section className="sales-admission-modal-section">
          <h3><GraduationCap size={18} />Course &amp; Batch Details</h3>
          <div className="sales-admission-detail-grid is-two-column">{renderFields(courseFields)}</div>
        </section>

        <section className="sales-admission-modal-section sales-admission-fee-section">
          <h3><Wallet size={17} />Fee Details</h3>
          {loading ? <p className="sales-admission-modal-state" role="status">Loading current payment details…</p> : error ? <div className="sales-admission-modal-state is-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Retry</button></div> : details ? <>
            <div className="sales-admission-fee-summary">
              <article><span><IndianRupee size={16} /></span><small>Total Course Fee</small><strong>{money(details.totalCourseFee)}</strong></article>
              <article><span><CreditCard size={16} /></span><small>Total Amount Paid</small><strong>{money(details.totalAmountPaid)}</strong></article>
              <article><span><Wallet size={16} /></span><small>Remaining Balance</small><strong>{money(details.overallOutstandingBalance)}</strong></article>
            </div>
            <div className="sales-admission-fee-detail-grid">
              {renderFields([
                ['Course Name', details.courseName || student.courseName],
                ['Total Course Fee', money(details.totalCourseFee)],
                ['First Installment Amount', money(details.firstInstallmentAmount)],
                ['Initial Amount Paid', money(details.initialAmountPaid)],
                ['First Installment Amount Paid', money(details.firstInstallmentAmountPaid)],
                ['Remaining First Installment Balance', money(details.firstInstallmentBalance)],
                ['Total Amount Paid', money(details.totalAmountPaid)],
                ['Remaining Course Balance', money(details.overallOutstandingBalance)],
                ...(Number(details.excessCredit) > 0 ? [['Excess Payment / Credit', money(details.excessCredit)]] : []),
              ])}
            </div>
          </> : <p className="sales-admission-modal-state">Fee details are unavailable.</p>}
        </section>

        <section className="sales-admission-modal-section sales-admission-course-date-section">
          <h3><CalendarDays size={17} />Admission</h3>
          <div className="sales-admission-detail-grid is-two-column">{renderFields([['Admission Date', student.admissionDate], ['Admission Status', 'Admitted']])}</div>
        </section>
      </div>
    </section>
  </div>
}

export function SalesAdminAdmissionsPage({ readOnlySalesAdmin = false, salesAdminId = '', unifiedBranchView = false, sourceFilter = 'ALL', branchAdminName = '' }) {
  const location = useLocation()
  const [rows, setRows] = useState([])
  const [branchAdmissions, setBranchAdmissions] = useState([])
  const [branchAdmissionsError, setBranchAdmissionsError] = useState('')
  const [summary, setSummary] = useState({ hotLeads: 0, pendingAdmissions: 0, completedAdmissions: 0, totalCollections: 0 })
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(() => new URLSearchParams(location.search).get('status') === 'PENDING_HOT' ? 'PENDING_HOT' : 'ALL')
  const [branchId, setBranchId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [branches, setBranches] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeLead, setActiveLead] = useState(null)
  const [success, setSuccess] = useState(null)
  const [viewStudent, setViewStudent] = useState(null)
  const [feeDetailsLoading, setFeeDetailsLoading] = useState(false)
  const [feeDetailsError, setFeeDetailsError] = useState('')
  const [batchDialogLead, setBatchDialogLead] = useState(null)
  const [batchDialogData, setBatchDialogData] = useState(null)
  const [batchDialogLoading, setBatchDialogLoading] = useState(false)
  const [batchDialogError, setBatchDialogError] = useState('')
  const [batchRequests, setBatchRequests] = useState([])
  const [requestingLead, setRequestingLead] = useState(null)
  const [requestingBatchRequest, setRequestingBatchRequest] = useState(null)
  const [requestSaving, setRequestSaving] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [processingApproval, setProcessingApproval] = useState(null)
  const [startingAdmissionId, setStartingAdmissionId] = useState(null)
  // The unified Admission table is rendered only for the Branch Admin review
  // surface. Do not depend on the session role shape here; combined-role
  // sessions may expose a roleAccess value instead of a plain BRANCH_ADMIN role.
  const canReviewBranchApprovals = unifiedBranchView
  const [readOnly, setReadOnly] = useState(() => readOnlySalesAdmin || String(loadSession()?.user?.status || '').toUpperCase() === 'INACTIVE' || loadSession()?.user?.active === false)
  const loadInFlightRef = useRef(false)
  const isStudentModalOpen = Boolean(viewStudent)
  const blockInactiveAction = () => {
    if (!readOnly) return false
    window.dispatchEvent(new CustomEvent('cispro:inactive-account-action-blocked', { detail: { message: 'Your account is currently inactive. You have view-only access. Please contact the Super Admin to reactivate your account.' } }))
    return true
  }

  useEffect(() => {
    request('/sales-admins/me').then((response) => {
      const user = response?.data || response?.user || response
      setReadOnly(readOnlySalesAdmin || String(user?.status || '').toUpperCase() === 'INACTIVE' || user?.active === false)
    }).catch(() => {})
  }, [readOnlySalesAdmin])

  useEffect(() => {
    if (!isStudentModalOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [isStudentModalOpen])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (loadInFlightRef.current) return
    loadInFlightRef.current = true
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const params = new URLSearchParams({ page: unifiedBranchView ? '1' : String(page), limit: unifiedBranchView ? '100' : '5', status: unifiedBranchView ? 'ALL' : status, sortBy, sortOrder: sortBy === 'studentName' ? 'asc' : 'desc', ...(salesAdminId ? { salesAdminId } : {}) })
      if (branchId) params.set('branchId', branchId)
      if (courseId) params.set('courseId', courseId)
      if (search.trim()) params.set('search', search.trim())
      const [result, requests, branchResult] = await Promise.all([
        request(`/sales-admins/admissions?${params}`),
        listSalesAdminBatchRequests(salesAdminId).catch((reason) => {
          console.warn('Unable to load admission batch requests:', reason?.message || reason)
          return []
        }),
        unifiedBranchView ? request('/branches/me/sales-admin-admissions').catch((reason) => ({ __error: reason?.message || 'Branch admissions could not be loaded.' })) : Promise.resolve(null),
      ])
      let allRows = Array.isArray(result.data) ? result.data : []
      if (unifiedBranchView && Number(result.meta?.totalPages) > 1) {
        const remainingPages = Array.from({ length: Number(result.meta.totalPages) - 1 }, (_, index) => index + 2)
        const additionalResults = await Promise.all(remainingPages.map((pageNumber) => {
          const pageParams = new URLSearchParams(params)
          pageParams.set('page', String(pageNumber))
          return request(`/sales-admins/admissions?${pageParams}`)
        }))
        allRows = allRows.concat(...additionalResults.map((pageResult) => Array.isArray(pageResult.data) ? pageResult.data : []))
      }
      setRows(allRows)
      const branchAdmissionList = Array.isArray(branchResult?.admissions) ? branchResult.admissions : Array.isArray(branchResult?.data?.admissions) ? branchResult.data.admissions : []
      const currentBranch = branchResult?.branch || branchResult?.data?.branch || {}
      setBranchAdmissions(branchAdmissionList.map((student) => ({ ...student, branchId: currentBranch.id || '', branchName: student.branchName || currentBranch.branchName || '' })))
      setBranchAdmissionsError(branchResult?.__error || '')
      setMeta(result.meta || { page: 1, totalPages: 1, total: 0 })
      setSummary(result.summary || { hotLeads: 0, pendingAdmissions: 0, completedAdmissions: 0, totalCollections: 0 })
      setBranches(Array.isArray(result.filters?.branches) ? result.filters.branches : [])
      setCourses(Array.isArray(result.filters?.courses) ? result.filters.courses : [])
      setBatchRequests(requests)
    } catch (reason) {
      if (!silent) setError(reason?.message || 'Unable to load student admissions.')
    } finally {
      loadInFlightRef.current = false
      if (!silent) setLoading(false)
    }
  }, [branchId, courseId, page, search, sortBy, status, salesAdminId, unifiedBranchView])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load({ silent: true })
    }, 30000)
    return () => window.clearInterval(timer)
  }, [load])
  useEffect(() => {
    let active = true
    request(`/sales-admins/admissions/pending-reminder` + (salesAdminId ? `?salesAdminId=` + encodeURIComponent(salesAdminId) : ''))
      .then((response) => {
        if (active && (response?.data?.notificationCreated || response?.data?.notificationUpdated || response?.data?.notificationRemoved)) window.dispatchEvent(new Event('lead-notification-updated'))
      })
      .catch((reason) => console.warn('Unable to refresh the pending HOT admission reminder:', reason?.message || reason))
    return () => { active = false }
  }, [salesAdminId])

  const startAdmission = async (leadId) => {
    if (blockInactiveAction()) return
    if (startingAdmissionId) return
    setStartingAdmissionId(leadId)
    setError('')
    try {
      const result = unwrap(await request(`/sales-admins/admissions/leads/${encodeURIComponent(leadId)}/start` + (salesAdminId ? `?salesAdminId=` + encodeURIComponent(salesAdminId) : ''), { method: 'POST' }))
      let lead = result.lead
      if (lead && !lead.admissionContext) {
        const details = unwrap(await request(`/sales-admins/admissions/leads/${encodeURIComponent(leadId)}` + (salesAdminId ? `?salesAdminId=` + encodeURIComponent(salesAdminId) : '')))
        lead = details.lead || lead
      }
      setActiveLead(lead)
      setSuccess(null)
    } catch (reason) {
      setError(reason?.message || 'Unable to start this admission.')
    } finally {
      setStartingAdmissionId(null)
    }
  }

  const reviewBranchAdmission = async (row, action) => {
    if (!unifiedBranchView || !row?.id || processingApproval) return
    let reason = ''
    if (action === 'reject') {
      reason = window.prompt(`Reason for rejecting ${row.studentName || 'this admission'} (optional):`, '')
      if (reason === null) return
    }
    setProcessingApproval({ id: row.id, action })
    setError('')
    try {
      const endpoint = `/sales-admins/admissions/approval-requests/${encodeURIComponent(row.id)}/${action}`
      const result = unwrap(await request(endpoint, { method: 'POST', ...(action === 'reject' ? { body: JSON.stringify({ reason }) } : {}) }))
      setSuccess({ pendingApproval: false, studentName: row.studentName, studentId: action === 'approve' ? result?.student?.studentId : row.leadId, branchName: row.branchName, approvalAction: action })
      await load({ silent: true })
      window.dispatchEvent(new Event('branch-student-admission-updated'))
    } catch (reasonError) {
      setError(reasonError?.message || `Unable to ${action} this admission.`)
    } finally {
      setProcessingApproval(null)
    }
  }

  const openAvailableBatches = async (lead) => {
    setBatchDialogLead(lead)
    setBatchDialogData(null)
    setBatchDialogError('')
    setBatchDialogLoading(true)
    try {
      const suffix = salesAdminId ? `?salesAdminId=${encodeURIComponent(salesAdminId)}` : ''
      const response = unwrap(await request(`/sales-admins/admissions/leads/${encodeURIComponent(lead.id)}/available-batches${suffix}`))
      setBatchDialogData(response)
    } catch (reason) {
      setBatchDialogError(reason?.message || 'Unable to load available batches.')
    } finally {
      setBatchDialogLoading(false)
    }
  }

  const openStudentDetails = async (row) => {
    if (!row.admissionStudent) return
    setViewStudent({ ...row.admissionStudent, branchName: row.branchName, feeDetails: null })
    setFeeDetailsError('')
    setFeeDetailsLoading(true)
    try {
      const response = unwrap(await request(`/sales-admins/admissions/students/${encodeURIComponent(row.admissionStudent.id)}/fee-details` + (salesAdminId ? `?salesAdminId=` + encodeURIComponent(salesAdminId) : '')))
      setViewStudent((current) => current ? { ...current, feeDetails: response.feeDetails || response } : current)
    } catch (reason) {
      setFeeDetailsError(reason?.message || 'Unable to load student fee details.')
    } finally {
      setFeeDetailsLoading(false)
    }
  }

  const sendBatchRequest = async () => {
    if (blockInactiveAction()) return
    if (!requestingLead || requestSaving) return
    setRequestSaving(true)
    setRequestError('')
    try {
      if (requestingBatchRequest?.id) await resendSalesAdminBatchRequest(requestingBatchRequest.id, salesAdminId)
      else await createSalesAdminBatchRequest(requestingLead.id, salesAdminId)
      setRequestingLead(null)
      setRequestingBatchRequest(null)
      await load()
    } catch (reason) {
      setRequestError(reason?.message || 'Unable to send the batch request.')
    } finally {
      setRequestSaving(false)
    }
  }

  const requestsForLead = (row) => batchRequests.filter((item) =>
    String(item.leadRecordId || '') === String(row.id || '') && String(item.courseId || '') === String(row.courseId || ''),
  )

  const branchRows = useMemo(() => branchAdmissions.map((student) => ({
    ...student,
    kind: 'BRANCH',
    sourceKind: String(student.salesAdminRole || '').toUpperCase() === 'SALES_ADMIN' ? 'SALES' : 'BRANCH',
    phoneNumber: student.phone || '',
    classSchedule: student.schedule || '',
    branchName: student.branchName || '',
    stage: 'ADMITTED',
    admissionStatus: 'ADMITTED',
    assignedAdminName: student.salesAdminName || 'Branch Admin',
    sourceAdminName: branchAdminName || 'Branch Admin',
    admissionStudent: {
      id: student.id,
      studentId: student.studentId,
      studentName: student.studentName,
      emailAddress: student.email,
      mobileNumber: student.phone,
      branchName: student.branchName,
      admissionDate: student.admissionDate,
      courseName: student.courseName,
      facultyName: student.facultyName,
      batchName: student.batchName,
      batchTiming: student.batchTiming,
      courseMode: student.trainingMode,
      classSchedule: student.schedule,
    },
  })), [branchAdminName, branchAdmissions])

  const unifiedData = useMemo(() => {
    if (!unifiedBranchView) return { rows: [], totalCount: 0, allRows: [] }
    const branchLeadIds = new Set(branchRows.map((row) => String(row.leadId || '')).filter(Boolean))
    const salesRows = rows
      .filter((row) => !(row.admissionStatus === 'ADMITTED' && branchLeadIds.has(String(row.leadId || ''))))
      .map((row) => ({ ...row, kind: 'SALES', sourceKind: String(row.assignedToRole || '').toUpperCase() === 'SALES_ADMIN' ? 'SALES' : 'BRANCH' }))
    const namedSalesAdmin = sourceFilter.startsWith('SALES_ADMIN:') ? decodeURIComponent(sourceFilter.slice('SALES_ADMIN:'.length)).trim().toLowerCase() : ''
    const branchOriginRows = [...branchRows.filter((row) => row.sourceKind !== 'SALES'), ...salesRows.filter((row) => row.sourceKind !== 'SALES')]
    const admittedSalesRows = branchRows.filter((row) => row.sourceKind === 'SALES')
    const allSalesRows = [...admittedSalesRows, ...salesRows.filter((row) => row.sourceKind === 'SALES')]
    let combined = sourceFilter === 'BRANCH' ? branchOriginRows : namedSalesAdmin ? allSalesRows.filter((row) => String(row.assignedAdminName || '').trim().toLowerCase() === namedSalesAdmin) : sourceFilter === 'SALES' ? allSalesRows : [...branchRows, ...salesRows]
    if (branchId) combined = combined.filter((row) => row.kind !== 'BRANCH' || String(row.branchId || '') === branchId)
    if (courseId) {
      const selectedCourseName = courses.find((course) => String(course.id) === courseId)?.name
      combined = combined.filter((row) => row.kind !== 'BRANCH' || String(row.courseId || '') === courseId || (selectedCourseName && row.courseName === selectedCourseName))
    }
    if (search.trim()) {
      const needle = search.trim().toLowerCase()
      combined = combined.filter((row) => row.kind !== 'BRANCH' || [row.studentId, row.studentName, row.phone, row.email, row.leadId, row.courseName].some((value) => String(value || '').toLowerCase().includes(needle)))
    }
    const totalCount = combined.length
    const allRows = combined.slice()
    if (status !== 'ALL') {
      const normalizedStatus = String(status).toUpperCase()
      combined = combined.filter((row) => {
        const rowStatus = String(row.admissionStatus || 'PENDING').toUpperCase()
        if (normalizedStatus === 'ADMITTED') return rowStatus === 'ADMITTED'
        if (normalizedStatus === 'PENDING_HOT') return ['PENDING', 'IN_PROGRESS'].includes(rowStatus)
        return rowStatus === normalizedStatus
      })
    }
    combined.sort((left, right) => {
      if (sortBy === 'studentName') return String(left.studentName || '').localeCompare(String(right.studentName || ''))
      if (sortBy === 'admissionStatus') return String(left.admissionStatus || '').localeCompare(String(right.admissionStatus || ''))
      return new Date(right.admissionDate || right.updatedAt || right.createdAt || 0) - new Date(left.admissionDate || left.updatedAt || left.createdAt || 0)
    })
    return { rows: combined, totalCount, allRows }
  }, [branchId, branchRows, courseId, courses, rows, search, sortBy, sourceFilter, status, unifiedBranchView])
  const unifiedRows = unifiedData.rows
  const unifiedTotalHotCount = unifiedData.totalCount
  const unifiedAllRows = unifiedData.allRows
  const unifiedPageSize = 5
  const unifiedTotalPages = Math.max(1, Math.ceil(unifiedRows.length / unifiedPageSize))
  const unifiedPageRows = unifiedRows.slice((page - 1) * unifiedPageSize, page * unifiedPageSize)
  const admissionMetrics = unifiedBranchView
    ? [
      { key: 'ALL', label: 'Total HOT Leads', value: unifiedTotalHotCount, icon: GraduationCap },
      { key: 'PENDING_HOT', label: 'Pending Admissions', value: unifiedAllRows.filter((row) => ['PENDING', 'IN_PROGRESS', 'PENDING_BRANCH_APPROVAL', 'REJECTED'].includes(String(row.admissionStatus || 'PENDING'))).length, icon: BookOpen },
      { key: 'ADMITTED', label: 'Completed Admissions', value: unifiedAllRows.filter((row) => String(row.admissionStatus || '').toUpperCase() === 'ADMITTED').length, icon: UserRoundCheck },
      { key: 'COLLECTIONS', label: 'Total Admission Collections', value: summary.totalCollections, icon: IndianRupee, money: true },
    ]
    : [
      { key: 'ALL', label: 'Total HOT Leads', value: summary.hotLeads, icon: GraduationCap },
      { key: 'PENDING_HOT', label: 'Pending Admissions', value: summary.pendingAdmissions, icon: BookOpen },
      { key: 'ADMITTED', label: 'Completed Admissions', value: summary.completedAdmissions, icon: UserRoundCheck },
      { key: 'COLLECTIONS', label: 'Total Admission Collections', value: summary.totalCollections, icon: IndianRupee, money: true },
    ]
  const selectMetric = (metric) => {
    if (metric === 'COLLECTIONS') return
    setStatus(metric)
    setPage(1)
  }

  const handleComplete = async (student) => {
    setSuccess({ ...student, sourceLeadId: activeLead?.leadId || student.sourceLeadId, branchName: activeLead?.branch?.branchName || student.branchName })
    setActiveLead(null)
    setPage(1)
    await load()
  }

  if (activeLead) return <AdmissionForm lead={activeLead} onCancel={() => { setActiveLead(null); void load() }} onComplete={handleComplete} />

  return <section className="sales-admissions-page">
    {!unifiedBranchView ? <header className="sales-admissions-header"><div><p className="eyebrow">SALES CRM</p><h1>Student Admission</h1><p>Manage HOT leads and complete student admissions.</p></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'is-spinning' : ''} />Refresh</button></header> : null}
    <div className="sales-admissions-summary">
      {admissionMetrics.map(({ key, label, value, icon: Icon, money: isMoney }) => <article key={key} role={key === 'COLLECTIONS' ? undefined : 'button'} tabIndex={key === 'COLLECTIONS' ? undefined : 0} className={status === key ? 'is-selected' : ''} onClick={() => selectMetric(key)} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && key !== 'COLLECTIONS') { event.preventDefault(); selectMetric(key) } }}><span><Icon size={18} /></span><div><small>{label}</small><strong>{loading ? <i className={`sales-admissions-count-skeleton${isMoney ? ' is-wide' : ''}`} aria-label="Loading count" /> : isMoney ? money(value) : value}</strong></div></article>)}
    </div>    {success ? <div className="sales-admission-success" role="status"><UserRoundCheck size={19} /><div><strong>{success.approvalAction === 'approve' ? 'Admission approved' : success.approvalAction === 'reject' ? 'Admission rejected' : success.pendingApproval ? 'Admission Submitted for Branch Approval' : 'Student Admission Completed Successfully'}</strong><span>{success.studentName || 'Student'} · {success.pendingApproval ? 'Original Lead ID' : 'Student ID'} {success.studentId || success.sourceLead?.leadId || activeLead?.leadId || success.sourceLeadId}</span>{success.approvalAction === 'approve' ? <span>Student record created and added to Student Management.</span> : success.approvalAction === 'reject' ? <span>The Sales Admin can review the rejection and resubmit the admission.</span> : success.pendingApproval ? <span>Branch Admin approval is pending. The student will appear in Student Management after approval.</span> : <><span>{success.branchName || activeLead?.branchName || activeLead?.branch?.branchName || '—'} · {success.courseName || '—'} · {success.facultyName || 'Faculty pending'} · {success.batchName || 'Batch pending'}</span><span>Total Fee {money(success.courseAmount)} · Amount Paid {money((success.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0))} · Remaining {money(Math.max(Number(success.courseAmount || 0) - (success.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0), 0))}</span></>}</div><button type="button" onClick={() => setSuccess(null)}>Dismiss</button></div> : null}
    {error ? <div className="sales-admission-error" role="alert"><AlertCircle size={18} />{error}<button type="button" onClick={() => void load()}>Retry</button></div> : null}
    {unifiedBranchView && branchAdmissionsError ? <div className="sales-admission-error" role="status">Branch admissions are unavailable: {branchAdmissionsError}</div> : null}
    <div className="sales-admissions-filters">
      <label className="sales-admissions-search"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search lead, student, phone or student ID" /></label>
      <select aria-label="Admission status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>{status === 'PENDING_HOT' ? <option value="PENDING_HOT" hidden>My pending HOT admissions</option> : null}{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      {!unifiedBranchView ? <select aria-label="Branch" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }}><option value="">All branches</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.branchName}</option>)}</select> : null}
      <select aria-label="Course" value={courseId} onChange={(event) => { setCourseId(event.target.value); setPage(1) }}><option value="">All courses</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.name}</option>)}</select>
      <select aria-label="Sort admissions" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1) }}><option value="createdAt">Newest first</option><option value="studentName">Student name</option><option value="admissionStatus">Admission status</option></select>
    </div>
    {unifiedBranchView ? <div className="sales-admissions-table-wrap sales-admissions-unified-table-wrap"><table><thead><tr><th>Lead / Student ID</th><th>Student</th><th>Phone</th><th>Branch</th><th>Course</th><th>Admission Status</th><th>Assigned To</th><th>Admission Date</th><th>Source</th><th>Actions</th></tr></thead><tbody>
      {loading ? <AdmissionsTableSkeleton columns={10} /> : unifiedPageRows.length ? unifiedPageRows.map((row) => {
        const branchRow = row.kind === 'BRANCH'
        const sourceIsBranchAdmin = row.sourceKind !== 'SALES' && (
          !branchAdminName || String(row.sourceAdminName || branchAdminName).trim().toLowerCase() === String(branchAdminName).trim().toLowerCase()
        )
        const batchRequest = requestsForLead(row)[0]
        const hasOpenRequest = batchRequest && batchRequest.status !== 'RESOLVED'
        const noBatches = Number(row.availableBatchCount) === 0
        const waitingApproval = row.admissionStatus === 'PENDING_BRANCH_APPROVAL'
        const rejected = row.admissionStatus === 'REJECTED'
        return <tr key={`${row.kind}-${row.id || row.leadId}`}>
          <td><strong>{row.leadId || row.studentId || '—'}</strong><small>Student: {row.studentId || '—'}</small></td>
          <td>{row.studentName || '—'}</td><td>{row.phoneNumber || row.phone || '—'}</td><td>{row.branchName || '—'}</td><td>{row.courseName || row.otherCourse || '—'}</td>
          <td><span className={`sales-admission-status is-${String(row.admissionStatus || 'PENDING').toLowerCase().replaceAll('_', '-')}`}>{String(row.admissionStatus || 'PENDING').replaceAll('_', ' ')}</span></td>
          <td>{row.assignedAdminName || '—'}</td><td>{row.admissionDate ? new Date(row.admissionDate).toLocaleDateString('en-GB') : '—'}</td>
          <td><span className={`sales-admission-source-badge is-${sourceIsBranchAdmin ? 'branch' : 'sales'}`}><strong>{sourceIsBranchAdmin ? 'Branch Admin' : 'Sales Admin'}</strong><span>{sourceIsBranchAdmin ? (row.sourceAdminName || branchAdminName || 'Branch Admin') : (row.assignedAdminName || 'Sales Admin')}</span></span></td>
          <td className="sales-admission-actions">{branchRow ? <button type="button" className="sales-admission-view" onClick={() => void openStudentDetails(row)}>View Student</button> : <>
            {!unifiedBranchView && !waitingApproval && row.availableBatchCount > 0 ? <button type="button" className="sales-admission-view-batches" onClick={() => void openAvailableBatches(row)}><Layers3 size={14} />View Batches</button> : null}
            {!unifiedBranchView && !waitingApproval && noBatches && row.canRequestBatch && row.admissionStatus !== 'ADMITTED' ? <button type="button" className="sales-admission-send-request" onClick={() => { setRequestError(''); setRequestingBatchRequest(batchRequest || null); setRequestingLead(row) }}><Send size={14} />{hasOpenRequest ? 'Resend Request' : 'Send Request'}</button> : null}
            {row.admissionStatus === 'ADMITTED' ? <button type="button" className="sales-admission-view" onClick={() => void openStudentDetails(row)}>View Student</button> : waitingApproval && canReviewBranchApprovals ? <><button type="button" className="sales-admission-reject" disabled={Boolean(processingApproval)} onClick={() => void reviewBranchAdmission(row, 'reject')}>{processingApproval?.id === row.id && processingApproval.action === 'reject' ? 'Rejecting…' : 'Reject'}</button><button type="button" className="sales-admission-approve" disabled={Boolean(processingApproval)} onClick={() => void reviewBranchAdmission(row, 'approve')}><Check size={14} />{processingApproval?.id === row.id && processingApproval.action === 'approve' ? 'Approving…' : 'Approve'}</button></> : waitingApproval ? <button type="button" className="sales-admission-start" disabled>Waiting for Approval</button> : <button type="button" className="sales-admission-start" disabled={Boolean(startingAdmissionId)} onClick={() => void startAdmission(row.id)}>{startingAdmissionId === row.id ? <><RefreshCw size={14} className="is-spinning" />Loading…</> : row.admissionStatus === 'IN_PROGRESS' ? 'Continue Admission' : rejected ? 'Resubmit Admission' : 'Start Admission'}</button>}
          </>}</td>
        </tr>
      }) : <tr><td colSpan="10" className="sales-admissions-state"><GraduationCap size={27} /><strong>No admissions found</strong><span>Try changing the source, status, or search filters.</span></td></tr>}
    </tbody></table></div> : <div className="sales-admissions-table-wrap"><table><thead><tr><th>Lead / Student ID</th><th>Student</th><th>Phone</th><th>Branch</th><th>Course</th><th>Training</th><th>Schedule</th><th>Stage</th><th>Lead Payment</th><th>Available Batches</th><th>Admission</th><th>Assigned To</th><th>Actions</th></tr></thead><tbody>
    {loading ? <AdmissionsTableSkeleton /> : rows.length ? rows.map((row) => { const batchRequest = requestsForLead(row)[0]; const hasOpenRequest = batchRequest && batchRequest.status !== 'RESOLVED'; const noBatches = Number(row.availableBatchCount) === 0; const waitingApproval = row.admissionStatus === 'PENDING_BRANCH_APPROVAL'; const rejected = row.admissionStatus === 'REJECTED'; return <tr key={row.leadId}><td><strong>{row.leadId}</strong><small>Student: {row.studentId || '—'}</small></td><td>{row.studentName}</td><td>{row.phoneNumber || '—'}</td><td>{row.branchName || '—'}</td><td>{row.courseName || row.otherCourse || '—'}</td><td>{row.trainingMode || '—'}</td><td>{row.classSchedule || '—'}</td><td><span className="sales-admission-stage">{row.stage}</span></td><td>{String(row.paymentStatus || 'NOT PAID').replace(/[_-]+/g, ' ')}{row.paymentAmount != null ? <small>{money(row.paymentAmount)} entered</small> : null}</td><td><span className={`sales-admission-batch-count${Number(row.availableBatchCount) > 0 ? ' is-available' : ''}`}>{row.availableBatchCount == null ? 'Unavailable' : `${row.availableBatchCount} Available`}</span></td><td><span className={`sales-admission-status is-${String(row.admissionStatus || 'PENDING').toLowerCase().replace('_', '-')}`}>{String(row.admissionStatus || 'PENDING').replace(/_/g, ' ')}</span></td><td>{row.assignedAdminName || '—'}</td><td className="sales-admission-actions"><button type="button" className="sales-admission-view-batches" onClick={() => void openAvailableBatches(row)}><Layers3 size={14} />View Batches</button>{noBatches && row.canRequestBatch && row.admissionStatus !== 'ADMITTED' && !waitingApproval ? <button type="button" className="sales-admission-send-request" onClick={() => { setRequestError(''); setRequestingBatchRequest(batchRequest || null); setRequestingLead(row) }}><Send size={14} />{hasOpenRequest ? 'Resend Request' : 'Send Request'}</button> : null}{row.admissionStatus === 'ADMITTED' ? <button type="button" className="sales-admission-view" onClick={() => void openStudentDetails(row)}>View Student</button> : waitingApproval ? <button type="button" className="sales-admission-start" disabled>Waiting for Approval</button> : <button type="button" className="sales-admission-start" disabled={Boolean(startingAdmissionId)} onClick={() => void startAdmission(row.id)}>{startingAdmissionId === row.id ? <><RefreshCw size={14} className="is-spinning" />Loading…</> : row.admissionStatus === 'IN_PROGRESS' ? 'Continue Admission' : rejected ? 'Resubmit Admission' : 'Start Admission'}</button>}</td></tr> }) : <tr><td colSpan="13" className="sales-admissions-state"><GraduationCap size={27} /><strong>No admissions found</strong><span>HOT leads within your authorized branches will appear here.</span></td></tr>}
    </tbody></table></div>}
    <footer className="sales-admissions-pagination"><span>Page {page} of {unifiedBranchView ? unifiedTotalPages : meta.totalPages || 1} · {unifiedBranchView ? unifiedRows.length : meta.total || 0} admissions</span><div><button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" disabled={loading || page >= (unifiedBranchView ? unifiedTotalPages : meta.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
    {viewStudent ? <StudentDetailsModal student={viewStudent} loading={feeDetailsLoading} error={feeDetailsError} onClose={() => setViewStudent(null)} onRetry={() => void openStudentDetails({ admissionStudent: viewStudent, branchName: viewStudent.branchName })} /> : null}
    {requestingLead ? <div className="sales-admission-view-backdrop" role="presentation" onClick={() => !requestSaving && setRequestingLead(null)}><section className="sales-admission-request-dialog" role="dialog" aria-modal="true" aria-labelledby="sales-admission-request-title" onClick={(event) => event.stopPropagation()}><button type="button" className="sales-admission-request-close" aria-label="Close" onClick={() => !requestSaving && setRequestingLead(null)}><X size={18} /></button><span>BRANCH BATCH REQUEST</span><h2 id="sales-admission-request-title">Request a suitable batch?</h2><p>Send this request to the Branch Admin. They will be notified and can create or assign a matching batch.</p><dl><dt>Student</dt><dd>{requestingLead.studentName}</dd><dt>Student / Lead ID</dt><dd>{requestingLead.studentId || requestingLead.leadId}</dd><dt>Branch</dt><dd>{requestingLead.branchName || '—'}</dd><dt>Course</dt><dd>{requestingLead.courseName || requestingLead.otherCourse || '—'}</dd><dt>Training / Schedule</dt><dd>{[requestingLead.trainingMode, requestingLead.classSchedule].filter(Boolean).join(' · ') || '—'}</dd></dl>{requestError ? <div className="sales-admission-request-error" role="alert">{requestError}</div> : null}<footer><button type="button" disabled={requestSaving} onClick={() => setRequestingLead(null)}>Cancel</button><button type="button" disabled={requestSaving} onClick={() => void sendBatchRequest()}><Send size={15} />{requestSaving ? 'Sending…' : 'Confirm Request'}</button></footer></section></div> : null}
    {batchDialogLead ? <div className="sales-admission-batches-backdrop" role="presentation" onClick={() => setBatchDialogLead(null)}><section className="sales-admission-batches-dialog" role="dialog" aria-modal="true" aria-labelledby="sales-admission-batches-title" onClick={(event) => event.stopPropagation()}><header><div><span>BRANCH BATCH MANAGEMENT</span><h2 id="sales-admission-batches-title">Available Batches</h2><p>{batchDialogData?.courseName || batchDialogLead.courseName || batchDialogLead.otherCourse || 'Course'} · {batchDialogData?.branchName || batchDialogLead.branchName || 'Branch'}</p></div><button type="button" aria-label="Close available batches" onClick={() => setBatchDialogLead(null)}><X size={19} /></button></header><div className="sales-admission-batches-meta"><span><strong>Mode</strong>{batchDialogData?.trainingMode || batchDialogLead.trainingMode || '—'}</span><span><strong>Schedule</strong>{batchDialogData?.schedule || batchDialogLead.classSchedule || '—'}</span><span><strong>Available</strong>{batchDialogData?.availableBatchCount ?? '—'} batch{batchDialogData?.availableBatchCount === 1 ? '' : 'es'}</span></div><div className="sales-admission-batches-content">{batchDialogLoading ? <div className="sales-admission-batches-state"><RefreshCw className="is-spinning" size={19} />Loading current batch availability…</div> : batchDialogError ? <div className="sales-admission-batches-state is-error"><AlertCircle size={20} />{batchDialogError}<button type="button" onClick={() => void openAvailableBatches(batchDialogLead)}>Retry</button></div> : batchDialogData?.batches?.length ? <div className="sales-admission-batch-list">{batchDialogData.batches.map((batch) => <article key={batch.id}><div className="sales-admission-batch-heading"><div><strong>{batch.batchId || batch.id}</strong><span>{batch.batchName || 'Batch'}</span></div><span className="sales-admission-batch-status">{batch.displayStatus || 'RUNNING'}</span></div><div className="sales-admission-batch-details"><span><Users size={14} /><b>Faculty</b>{(batch.faculty || []).length ? batch.faculty.map((item) => item.name).join(', ') : '—'}</span><span><Clock3 size={14} /><b>Timing</b>{batch.batchTiming || '—'}</span><span><Building2 size={14} /><b>Schedule / Mode</b>{[batch.schedule, batch.trainingMode].filter(Boolean).join(' · ') || '—'}</span></div><div className="sales-admission-seat-summary"><span>{batch.occupiedSeats} / {batch.totalSeats} seats occupied</span><strong>{batch.availableSeats} available</strong></div><div className="sales-admission-seat-track" aria-label={`${batch.occupiedSeats} of ${batch.totalSeats} seats occupied`}><span style={{ width: `${batch.totalSeats > 0 ? Math.min(100, (batch.occupiedSeats / batch.totalSeats) * 100) : 0}%` }} /></div></article>)}</div> : <div className="sales-admission-batches-state"><Layers3 size={22} /><strong>No Available Batches</strong><span>No running batches with available seats were found for this course, branch, and selected schedule.</span></div>}</div><footer><span>{batchDialogData?.availableBatchCount ?? 0} eligible batch{batchDialogData?.availableBatchCount === 1 ? '' : 'es'}</span><button type="button" onClick={() => setBatchDialogLead(null)}>Close</button></footer></section></div> : null}
  </section>
}
