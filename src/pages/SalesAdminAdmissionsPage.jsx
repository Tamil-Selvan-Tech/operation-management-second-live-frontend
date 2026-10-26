import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpen, Building2, CalendarDays, Clock3, CreditCard, GraduationCap, IndianRupee, Layers3, RefreshCw, Search, Send, UserRound, UserRoundCheck, Users, Wallet, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { request } from '../services/apiClient'
import { createSalesAdminBatchRequest, listSalesAdminBatchRequests } from '../services/salesCrmBatchRequestService'
import '../styles/SalesAdminAdmissionsPage.css'

const BranchDashboardPage = lazy(() => import('./BranchDashboardPage').then(({ BranchDashboardPage: Page }) => ({ default: Page })))
const statusOptions = [['ALL', 'All admissions'], ['PENDING_HOT', 'My pending HOT admissions'], ['PENDING', 'Pending'], ['IN_PROGRESS', 'In Progress'], ['ADMITTED', 'Admitted']]

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
  const studentFields = [
    ['Student ID', student.studentId],
    ['Student Name', student.studentName],
    ['Phone Number', student.mobileNumber],
    ['Branch', student.branchName],
    ['Course', student.courseName],
    ['Faculty', student.facultyName],
    ['Batch', student.batchName],
    ['Training Mode', student.courseMode],
    ['Class Schedule', student.classSchedule],
    ['Admission Date', student.admissionDate],
  ]
  const courseFields = [
    ['Course Name', student.courseName],
    ['Branch Name', student.branchName],
    ['Assigned Faculty', student.facultyName],
    ['Assigned Batch', student.batchName],
    ['Training Mode', student.courseMode],
    ['Weekday / Weekend Schedule', student.classSchedule],
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

export function SalesAdminAdmissionsPage() {
  const location = useLocation()
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ hotLeads: 0, pendingAdmissions: 0, completedAdmissions: 0, totalCollections: 0 })
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(() => new URLSearchParams(location.search).get('status') === 'PENDING_HOT' ? 'PENDING_HOT' : 'ALL')
  const [branchId, setBranchId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [search, setSearch] = useState('')
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
  const [requestSaving, setRequestSaving] = useState(false)
  const [requestError, setRequestError] = useState('')
  const isStudentModalOpen = Boolean(viewStudent)

  useEffect(() => {
    if (!isStudentModalOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [isStudentModalOpen])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', status })
      if (branchId) params.set('branchId', branchId)
      if (courseId) params.set('courseId', courseId)
      if (search.trim()) params.set('search', search.trim())
      const [result, requests] = await Promise.all([
        request(`/sales-admins/admissions?${params}`),
        listSalesAdminBatchRequests(),
      ])
      setRows(Array.isArray(result.data) ? result.data : [])
      setMeta(result.meta || { page: 1, totalPages: 1, total: 0 })
      setSummary(result.summary || { hotLeads: 0, pendingAdmissions: 0, completedAdmissions: 0, totalCollections: 0 })
      setBranches(Array.isArray(result.filters?.branches) ? result.filters.branches : [])
      setCourses(Array.isArray(result.filters?.courses) ? result.filters.courses : [])
      setBatchRequests(requests)
    } catch (reason) {
      setError(reason?.message || 'Unable to load student admissions.')
    } finally {
      setLoading(false)
    }
  }, [branchId, courseId, page, search, status])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => { void load() }, 30000)
    window.addEventListener('focus', load)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', load) }
  }, [load])

  useEffect(() => {
    let active = true
    request('/sales-admins/admissions/pending-reminder')
      .then((response) => {
        if (active && response?.data?.notificationCreated) window.dispatchEvent(new Event('institute-leave-updated'))
      })
      .catch((reason) => console.warn('Unable to refresh the pending HOT admission reminder:', reason?.message || reason))
    return () => { active = false }
  }, [])

  const startAdmission = async (leadId) => {
    setError('')
    try {
      const result = unwrap(await request(`/sales-admins/admissions/leads/${encodeURIComponent(leadId)}/start`, { method: 'POST' }))
      let lead = result.lead
      if (lead && !lead.admissionContext) {
        const details = unwrap(await request(`/sales-admins/admissions/leads/${encodeURIComponent(leadId)}`))
        lead = details.lead || lead
      }
      setActiveLead(lead)
      setSuccess(null)
    } catch (reason) {
      setError(reason?.message || 'Unable to start this admission.')
    }
  }

  const openAvailableBatches = async (lead) => {
    setBatchDialogLead(lead)
    setBatchDialogData(null)
    setBatchDialogError('')
    setBatchDialogLoading(true)
    try {
      const response = unwrap(await request(`/sales-admins/admissions/leads/${encodeURIComponent(lead.id)}/available-batches`))
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
      const response = unwrap(await request(`/sales-admins/admissions/students/${encodeURIComponent(row.admissionStudent.id)}/fee-details`))
      setViewStudent((current) => current ? { ...current, feeDetails: response.feeDetails || response } : current)
    } catch (reason) {
      setFeeDetailsError(reason?.message || 'Unable to load student fee details.')
    } finally {
      setFeeDetailsLoading(false)
    }
  }

  const sendBatchRequest = async () => {
    if (!requestingLead || requestSaving) return
    setRequestSaving(true)
    setRequestError('')
    try {
      await createSalesAdminBatchRequest(requestingLead.id)
      setRequestingLead(null)
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

  const handleComplete = async (student) => {
    setSuccess({ ...student, sourceLeadId: activeLead?.leadId || student.sourceLeadId, branchName: activeLead?.branch?.branchName || student.branchName })
    setActiveLead(null)
    setPage(1)
    await load()
  }

  if (activeLead) return <AdmissionForm lead={activeLead} onCancel={() => { setActiveLead(null); void load() }} onComplete={handleComplete} />

  return <section className="sales-admissions-page">
    <header className="sales-admissions-header"><div><p className="eyebrow">SALES CRM</p><h1>Student Admission</h1><p>Manage HOT leads and complete student admissions.</p></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'is-spinning' : ''} />Refresh</button></header>
    <div className="sales-admissions-summary">
      <article><span><GraduationCap size={18} /></span><div><small>Total HOT Leads</small><strong>{summary.hotLeads}</strong></div></article>
      <article><span><BookOpen size={18} /></span><div><small>Pending Admissions</small><strong>{summary.pendingAdmissions}</strong></div></article>
      <article><span><UserRoundCheck size={18} /></span><div><small>Completed Admissions</small><strong>{summary.completedAdmissions}</strong></div></article>
      <article><span>₹</span><div><small>Total Admission Collections</small><strong>{money(summary.totalCollections)}</strong></div></article>
    </div>
    {success ? <div className="sales-admission-success" role="status"><UserRoundCheck size={19} /><div><strong>Student Admission Completed Successfully</strong><span>{success.studentName} · Student ID {success.studentId} · Original Lead ID {success.sourceLead?.leadId || activeLead?.leadId || success.sourceLeadId}</span><span>{success.branchName || activeLead?.branchName || activeLead?.branch?.branchName || '—'} · {success.courseName || '—'} · {success.facultyName || 'Faculty pending'} · {success.batchName || 'Batch pending'}</span><span>Total Fee {money(success.courseAmount)} · Amount Paid {money((success.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0))} · Remaining {money(Math.max(Number(success.courseAmount || 0) - (success.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0), 0))}</span></div><button type="button" onClick={() => setSuccess(null)}>Dismiss</button></div> : null}
    {error ? <div className="sales-admission-error" role="alert"><AlertCircle size={18} />{error}<button type="button" onClick={() => void load()}>Retry</button></div> : null}
    <div className="sales-admissions-filters">
      <label className="sales-admissions-search"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search lead, student, phone or student ID" /></label>
      <select aria-label="Admission status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Branch" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }}><option value="">All authorized branches</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.branchName}</option>)}</select>
      <select aria-label="Course" value={courseId} onChange={(event) => { setCourseId(event.target.value); setPage(1) }}><option value="">All courses</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.name}</option>)}</select>
    </div>
    <div className="sales-admissions-table-wrap"><table><thead><tr><th>Lead / Student ID</th><th>Student</th><th>Phone</th><th>Branch</th><th>Course</th><th>Training</th><th>Schedule</th><th>Stage</th><th>Lead Payment</th><th>Available Batches</th><th>Admission</th><th>Assigned To</th><th>Actions</th></tr></thead><tbody>
    {loading ? <tr><td colSpan="13" className="sales-admissions-state">Loading admissions…</td></tr> : rows.length ? rows.map((row) => { const batchRequest = requestsForLead(row)[0]; const hasOpenRequest = batchRequest && batchRequest.status !== 'RESOLVED'; const noBatches = Number(row.availableBatchCount) === 0; return <tr key={row.leadId}><td><strong>{row.leadId}</strong><small>Student: {row.studentId || '—'}</small></td><td>{row.studentName}</td><td>{row.phoneNumber || '—'}</td><td>{row.branchName || '—'}</td><td>{row.courseName || row.otherCourse || '—'}</td><td>{row.trainingMode || '—'}</td><td>{row.classSchedule || '—'}</td><td><span className="sales-admission-stage">{row.stage}</span></td><td>{String(row.paymentStatus || 'NOT PAID').replace(/[_-]+/g, ' ')}{row.paymentAmount != null ? <small>{money(row.paymentAmount)} entered</small> : null}</td><td><span className={`sales-admission-batch-count${Number(row.availableBatchCount) > 0 ? ' is-available' : ''}`}>{row.availableBatchCount == null ? 'Unavailable' : `${row.availableBatchCount} Available`}</span></td><td><span className={`sales-admission-status is-${String(row.admissionStatus || 'PENDING').toLowerCase().replace('_', '-')}`}>{String(row.admissionStatus || 'PENDING').replace('_', ' ')}</span></td><td>{row.assignedAdminName || '—'}</td><td className="sales-admission-actions"><button type="button" className="sales-admission-view-batches" onClick={() => void openAvailableBatches(row)}><Layers3 size={14} />View Batches</button>{noBatches && row.canRequestBatch && row.admissionStatus !== 'ADMITTED' && !hasOpenRequest ? <button type="button" className="sales-admission-send-request" onClick={() => { setRequestError(''); setRequestingLead(row) }}><Send size={14} />Send Request</button> : null}{row.admissionStatus === 'ADMITTED' ? <button type="button" className="sales-admission-view" onClick={() => void openStudentDetails(row)}>View Student</button> : <button type="button" className="sales-admission-start" onClick={() => void startAdmission(row.id)}>{row.admissionStatus === 'IN_PROGRESS' ? 'Continue Admission' : 'Start Admission'}</button>}</td></tr> }) : <tr><td colSpan="13" className="sales-admissions-state"><GraduationCap size={27} /><strong>No admissions found</strong><span>HOT leads within your authorized branches will appear here.</span></td></tr>}
    </tbody></table></div>
    <footer className="sales-admissions-pagination"><span>Page {meta.page || 1} of {meta.totalPages || 1} · {meta.total || 0} leads</span><div><button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" disabled={loading || page >= (meta.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
    {viewStudent ? <StudentDetailsModal student={viewStudent} loading={feeDetailsLoading} error={feeDetailsError} onClose={() => setViewStudent(null)} onRetry={() => void openStudentDetails({ admissionStudent: viewStudent, branchName: viewStudent.branchName })} /> : null}
    {requestingLead ? <div className="sales-admission-view-backdrop" role="presentation" onClick={() => !requestSaving && setRequestingLead(null)}><section className="sales-admission-request-dialog" role="dialog" aria-modal="true" aria-labelledby="sales-admission-request-title" onClick={(event) => event.stopPropagation()}><button type="button" className="sales-admission-request-close" aria-label="Close" onClick={() => !requestSaving && setRequestingLead(null)}><X size={18} /></button><span>BRANCH BATCH REQUEST</span><h2 id="sales-admission-request-title">Request a suitable batch?</h2><p>Send this request to the Branch Admin. They will be notified and can create or assign a matching batch.</p><dl><dt>Student</dt><dd>{requestingLead.studentName}</dd><dt>Student / Lead ID</dt><dd>{requestingLead.studentId || requestingLead.leadId}</dd><dt>Branch</dt><dd>{requestingLead.branchName || '—'}</dd><dt>Course</dt><dd>{requestingLead.courseName || requestingLead.otherCourse || '—'}</dd><dt>Training / Schedule</dt><dd>{[requestingLead.trainingMode, requestingLead.classSchedule].filter(Boolean).join(' · ') || '—'}</dd></dl>{requestError ? <div className="sales-admission-request-error" role="alert">{requestError}</div> : null}<footer><button type="button" disabled={requestSaving} onClick={() => setRequestingLead(null)}>Cancel</button><button type="button" disabled={requestSaving} onClick={() => void sendBatchRequest()}><Send size={15} />{requestSaving ? 'Sending…' : 'Confirm Request'}</button></footer></section></div> : null}
    {batchDialogLead ? <div className="sales-admission-batches-backdrop" role="presentation" onClick={() => setBatchDialogLead(null)}><section className="sales-admission-batches-dialog" role="dialog" aria-modal="true" aria-labelledby="sales-admission-batches-title" onClick={(event) => event.stopPropagation()}><header><div><span>BRANCH BATCH MANAGEMENT</span><h2 id="sales-admission-batches-title">Available Batches</h2><p>{batchDialogData?.courseName || batchDialogLead.courseName || batchDialogLead.otherCourse || 'Course'} · {batchDialogData?.branchName || batchDialogLead.branchName || 'Branch'}</p></div><button type="button" aria-label="Close available batches" onClick={() => setBatchDialogLead(null)}><X size={19} /></button></header><div className="sales-admission-batches-meta"><span><strong>Mode</strong>{batchDialogData?.trainingMode || batchDialogLead.trainingMode || '—'}</span><span><strong>Schedule</strong>{batchDialogData?.schedule || batchDialogLead.classSchedule || '—'}</span><span><strong>Available</strong>{batchDialogData?.availableBatchCount ?? '—'} batch{batchDialogData?.availableBatchCount === 1 ? '' : 'es'}</span></div><div className="sales-admission-batches-content">{batchDialogLoading ? <div className="sales-admission-batches-state"><RefreshCw className="is-spinning" size={19} />Loading current batch availability…</div> : batchDialogError ? <div className="sales-admission-batches-state is-error"><AlertCircle size={20} />{batchDialogError}<button type="button" onClick={() => void openAvailableBatches(batchDialogLead)}>Retry</button></div> : batchDialogData?.batches?.length ? <div className="sales-admission-batch-list">{batchDialogData.batches.map((batch) => <article key={batch.id}><div className="sales-admission-batch-heading"><div><strong>{batch.batchId || batch.id}</strong><span>{batch.batchName || 'Batch'}</span></div><span className="sales-admission-batch-status">{batch.displayStatus || 'RUNNING'}</span></div><div className="sales-admission-batch-details"><span><Users size={14} /><b>Faculty</b>{(batch.faculty || []).length ? batch.faculty.map((item) => item.name).join(', ') : '—'}</span><span><Clock3 size={14} /><b>Timing</b>{batch.batchTiming || '—'}</span><span><Building2 size={14} /><b>Schedule / Mode</b>{[batch.schedule, batch.trainingMode].filter(Boolean).join(' · ') || '—'}</span></div><div className="sales-admission-seat-summary"><span>{batch.occupiedSeats} / {batch.totalSeats} seats occupied</span><strong>{batch.availableSeats} available</strong></div><div className="sales-admission-seat-track" aria-label={`${batch.occupiedSeats} of ${batch.totalSeats} seats occupied`}><span style={{ width: `${batch.totalSeats > 0 ? Math.min(100, (batch.occupiedSeats / batch.totalSeats) * 100) : 0}%` }} /></div></article>)}</div> : <div className="sales-admission-batches-state"><Layers3 size={22} /><strong>No Available Batches</strong><span>No running batches with available seats were found for this course, branch, and selected schedule.</span></div>}</div><footer><span>{batchDialogData?.availableBatchCount ?? 0} eligible batch{batchDialogData?.availableBatchCount === 1 ? '' : 'es'}</span><button type="button" onClick={() => setBatchDialogLead(null)}>Close</button></footer></section></div> : null}
  </section>
}
