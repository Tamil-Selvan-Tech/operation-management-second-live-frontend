import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronDown, Loader2, PhoneCall, RefreshCcw, Search, X } from 'lucide-react'
import { request } from '../services/apiClient'

const OUTCOME_OPTIONS = [
  { value: 'DISCONTINUE', label: 'Student wants to discontinue' },
  { value: 'CONTINUE', label: 'Student will continue' },
  { value: 'UNABLE_TO_CONTACT', label: 'Unable to contact' },
  { value: 'REJECT', label: 'Reject request' },
]

function getTomorrowDate() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function DiscontinuationFilterSelect({ value, options, onChange, ariaLabel, width = 170 }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const selectedOption = options.find((option) => String(option.value) === String(value)) || options[0]

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [isOpen])

  return (
    <div ref={containerRef} className={`super-admin-branch-filter branch-course-custom-filter ${isOpen ? 'is-open' : ''}`.trim()} style={{ width: `${width}px` }}>
      <button type="button" className="super-admin-branch-filter-trigger" aria-label={ariaLabel} aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        <span>{selectedOption?.label || 'Select'}</span>
        <ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {isOpen ? <div className="super-admin-branch-filter-menu" role="listbox" aria-label={ariaLabel}>
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={String(option.value) === String(value)} className={`super-admin-branch-filter-option ${String(option.value) === String(value) ? 'is-selected' : ''}`.trim()} onClick={() => { onChange(option.value); setIsOpen(false) }}>{option.label}</button>)}
      </div> : null}
    </div>
  )
}

function unwrapRows(response) {
  const payload = response?.data ?? response
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload?.data) ? payload.data : []
}

function formatAmount(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function displayRequestReason(value) {
  return value === 'Long absence follow-up after motivation email' ? 'Long leave mail follow-up' : value || 'Student request'
}

function isLongLeaveRequest(item) {
  return item?.reason === 'Long absence follow-up after motivation email'
}

function latestMotivationMail(item) {
  if (!isLongLeaveRequest(item)) return null
  if (item.latestMotivationMail?.status === 'SENT') return item.latestMotivationMail
  return [...(item.motivationMailHistory || [])]
    .filter((mail) => mail.status === 'SENT')
    .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime())[0] || null
}

function motivationMailStatus(item) {
  const latest = latestMotivationMail(item)
  if (!latest) return statusLabel(item.status)
  const sentDate = latest.sentAt
    ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' })
      .formatToParts(new Date(latest.sentAt))
      .filter((part) => ['day', 'month', 'year'].includes(part.type))
      .map((part) => part.value)
      .join('-')
    : ''
  return <><span>First mail sent</span>{sentDate ? <small className="branch-discontinuation-status-date">{sentDate}</small> : null}</>
}

function statusLabel(value) {
  const status = String(value || 'PENDING').toUpperCase()
  if (status === 'CONTACTED_CONTINUE') return 'Continuing course'
  if (status === 'UNABLE_TO_CONTACT') return 'Follow-up required'
  if (status === 'SUPER_ADMIN_REVIEW') return 'Awaiting approval'
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusClass(value) {
  const status = String(value || '').toLowerCase()
  if (status === 'approved' || status === 'contacted_continue') return 'is-success'
  if (status === 'rejected' || status === 'cancelled') return 'is-danger'
  if (status === 'super_admin_review') return 'is-warning'
  return 'is-pending'
}

export function BranchDiscontinuationManagementPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedReadOnly, setSelectedReadOnly] = useState(false)
  const [outcome, setOutcome] = useState('DISCONTINUE')
  const [note, setNote] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [saving, setSaving] = useState(false)

  const loadRequests = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const response = await request('/student-discontinuation')
      setRequests(unwrapRows(response))
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load discontinuation requests.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadRequests()
  }, [])

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return requests.filter((item) => {
      const matchesStatus = statusFilter === 'ALL'
        || (statusFilter === 'LONG_LEAVE' ? isLongLeaveRequest(item) : String(item.status || '').toUpperCase() === statusFilter)
      if (!matchesStatus) return false
      if (!query) return true
      return [
        item.student?.studentName,
        item.student?.studentId,
        item.student?.emailAddress,
        item.student?.courseName,
        item.student?.batchName,
        item.reason,
      ].some((value) => String(value || '').toLowerCase().includes(query))
    })
  }, [requests, search, statusFilter])

  const pendingCount = requests.filter((item) => item.status === 'PENDING').length
  const reviewCount = requests.filter((item) => item.status === 'SUPER_ADMIN_REVIEW').length
  const isMotivationFollowUp = selectedRequest?.reason === 'Long absence follow-up after motivation email'
  const canRecordMotivationOutcome = !isMotivationFollowUp || selectedRequest?.motivationMailComplete
  const canEditSelectedRequest = ['PENDING', 'UNABLE_TO_CONTACT'].includes(selectedRequest?.status) && !selectedReadOnly && canRecordMotivationOutcome
  const availableOutcomeOptions = isMotivationFollowUp
    ? OUTCOME_OPTIONS.filter((option) => option.value !== 'REJECT')
    : OUTCOME_OPTIONS

  const openOutcome = (item, readOnly = false) => {
    setSelectedRequest(item)
    setSelectedReadOnly(readOnly)
    setOutcome(item.status === 'UNABLE_TO_CONTACT' ? 'UNABLE_TO_CONTACT' : item.status === 'PENDING' ? 'DISCONTINUE' : 'CONTINUE')
    setNote('')
    setFollowUpDate(item.nextFollowUpDate || '')
  }

  const saveOutcome = async (event) => {
    event.preventDefault()
    if (!selectedRequest?.id || !canEditSelectedRequest || saving) return
    if (['DISCONTINUE', 'REJECT'].includes(outcome) && !note.trim()) return
    if (['UNABLE_TO_CONTACT', 'CONTINUE'].includes(outcome) && !followUpDate) {
      setError(outcome === 'CONTINUE' ? 'Continue date is required when the student will continue.' : 'Next follow-up date is required when the student cannot be reached.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await request(`/student-discontinuation/${encodeURIComponent(selectedRequest.id)}/branch-review`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision: outcome,
          note: note.trim(),
          nextFollowUpDate: followUpDate,
        }),
      })
      setSelectedRequest(null)
      setSelectedReadOnly(false)
      await loadRequests({ silent: true })
    } catch (saveError) {
      setError(saveError?.message || 'Unable to save contact outcome.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="branch-dashboard-section branch-discontinuation-page">
      <div className="branch-discontinuation-header">
        <div>
          <p className="branch-discontinuation-kicker">STUDENT SUPPORT</p>
          <h2>Discontinuation Management</h2>
          <p>Review student requests, record call outcomes, and forward confirmed discontinuations for approval.</p>
        </div>
        <button type="button" className="branch-discontinuation-refresh" onClick={() => void loadRequests({ silent: true })} disabled={loading || refreshing}>
          <RefreshCcw size={16} className={refreshing ? 'is-spinning' : ''} />
          Refresh
        </button>
      </div>

      <div className="branch-discontinuation-stats" aria-label="Discontinuation request summary">
        {loading ? [1, 2, 3].map((item) => <div className="branch-discontinuation-stat-skeleton" key={item}><span /><strong /></div>) : <>
          <div><span>Total requests</span><strong>{requests.length}</strong><small>All student requests</small></div>
          <div><span>Pending contact</span><strong>{pendingCount}</strong><small>Needs a branch call</small></div>
          <div><span>Awaiting approval</span><strong>{reviewCount}</strong><small>Sent to Super Admin</small></div>
        </>}
      </div>

      <div className={`branch-discontinuation-toolbar${loading ? ' is-loading' : ''}`} aria-busy={loading}>
        {loading ? <>
          <span className="branch-discontinuation-control-skeleton branch-discontinuation-search-skeleton" />
          <span className="branch-discontinuation-control-skeleton branch-discontinuation-filter-skeleton" />
        </> : <>
          <label className="branch-discontinuation-search">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, ID, course or batch" />
          </label>
          <DiscontinuationFilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filter discontinuation requests by status"
            width={178}
            options={[
              { value: 'ALL', label: 'All statuses' },
              { value: 'LONG_LEAVE', label: 'Long leave students' },
              { value: 'PENDING', label: 'Pending contact' },
              { value: 'SUPER_ADMIN_REVIEW', label: 'Awaiting approval' },
              { value: 'CONTACTED_CONTINUE', label: 'Continuing course' },
              { value: 'LEAVE_REQUESTED', label: 'Leave requested' },
              { value: 'UNABLE_TO_CONTACT', label: 'Unable to contact' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
          />
        </>}
      </div>

      {error ? <div className="branch-discontinuation-error" role="alert">{error}</div> : null}

      <div className="branch-discontinuation-table-card">
        {loading ? (
          <div className="branch-discontinuation-loading" role="status" aria-label="Loading discontinuation requests">
            {[1, 2, 3, 4].map((item) => <span key={item} />)}
          </div>
        ) : filteredRequests.length ? (
          <div className="branch-discontinuation-table-wrap">
            <table className="branch-discontinuation-table">
              <thead><tr><th>Student</th><th>Course / Batch</th><th>Outstanding</th><th>Request</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {filteredRequests.map((item) => {
                  const student = item.student || {}
                  const isActionable = ['PENDING', 'UNABLE_TO_CONTACT'].includes(item.status)
                  const isMotivationReady = !isLongLeaveRequest(item) || item.motivationMailComplete
                  return (
                    <tr key={item.id} className="branch-discontinuation-table-row" onClick={() => openOutcome(item, true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openOutcome(item, true) } }} tabIndex={0}>
                      <td><strong>{student.studentName || '-'}</strong><small>{student.studentId || student.emailAddress || '-'}</small><small className="branch-discontinuation-mobile"><PhoneCall size={12} /> {student.mobileNumber || 'Mobile number unavailable'}</small></td>
                      <td><strong>{student.courseName || '-'}</strong><small>{student.batchName || '-'}</small></td>
                      <td><strong>{formatAmount(item.financialSnapshot?.finalOutstandingAmount ?? item.financialSnapshot?.outstandingAmount)}</strong></td>
                      <td className="branch-discontinuation-request-cell"><strong>{displayRequestReason(item.reason)}</strong><small>{item.details || 'No additional details provided.'}</small></td>
                      <td><span className={`branch-discontinuation-status ${isLongLeaveRequest(item) ? 'is-success is-mail-status' : statusClass(item.status)}`}>{motivationMailStatus(item)}</span></td>
                      <td>{isActionable && isMotivationReady ? <button type="button" className="branch-discontinuation-action" onClick={(event) => { event.stopPropagation(); openOutcome(item) }}><PhoneCall size={15} /> Contact Outcome</button> : <button type="button" className="branch-discontinuation-view" onClick={(event) => { event.stopPropagation(); openOutcome(item, true) }}>View details</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="branch-discontinuation-empty"><PhoneCall size={28} /><h3>{search || statusFilter !== 'ALL' ? 'No matching requests' : 'No discontinuation requests yet'}</h3><p>Student requests and long-absence follow-ups will appear here.</p></div>
        )}
      </div>

      {selectedRequest ? (
        <div className="branch-discontinuation-modal-backdrop" role="presentation">
          <form className="branch-discontinuation-modal" role="dialog" aria-modal="true" onSubmit={saveOutcome}>
            <button type="button" className="branch-discontinuation-close" onClick={() => { setSelectedRequest(null); setSelectedReadOnly(false) }} aria-label="Close contact outcome"><X size={19} /></button>
            <p className="branch-discontinuation-kicker">{canEditSelectedRequest ? 'CONTACT OUTCOME' : 'REQUEST DETAILS'}</p>
            <h3>{selectedRequest.student?.studentName || 'Student'} response</h3>
            <p className="branch-discontinuation-modal-copy">{canEditSelectedRequest ? (outcome === 'DISCONTINUE' ? 'Confirm the call notes, then send this request to Super Admin for final approval.' : 'Record the call outcome and next action for this discontinuation request.') : 'Review the student request and the outcome recorded by the Branch Admin.'}</p>
            {canEditSelectedRequest ? <>
              <label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)}>{availableOutcomeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              {outcome !== 'UNABLE_TO_CONTACT' ? <label>{outcome === 'REJECT' ? 'Rejection reason (required)' : `Call notes ${outcome === 'DISCONTINUE' ? '(required)' : '(optional)'}`}<textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder={outcome === 'REJECT' ? 'Explain why this request is being rejected.' : 'Record what the student said and the next action.'} required={['DISCONTINUE', 'REJECT'].includes(outcome)} /></label> : null}
              {outcome === 'DISCONTINUE' ? <div className="branch-discontinuation-finance-summary">
                <div><span>Course progress</span><strong>{Number(selectedRequest.financialSnapshot?.courseProgress || 0)}%</strong></div>
                <div><span>Paid amount</span><strong>{formatAmount(selectedRequest.financialSnapshot?.totalPaid)}</strong></div>
                <div><span>Balance payable</span><strong>{formatAmount(selectedRequest.financialSnapshot?.balanceDue ?? selectedRequest.financialSnapshot?.finalOutstandingAmount)}</strong></div>
                {selectedRequest.financialSnapshot?.refundRequested ? <div><span>Refund eligible</span><strong>{formatAmount(selectedRequest.financialSnapshot?.refundEligibleAmount)}</strong></div> : null}
              </div> : null}
              {['UNABLE_TO_CONTACT', 'CONTINUE'].includes(outcome) ? <label><span className="branch-discontinuation-date-label"><CalendarClock size={15} /> {outcome === 'CONTINUE' ? 'Continue date (required)' : 'Next follow-up date (required)'}</span><input type="date" min={getTomorrowDate()} value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} required /></label> : null}
            </> : <div className="branch-discontinuation-readonly-details">
              <div className="branch-discontinuation-detail-status"><span>Status</span><strong className={`branch-discontinuation-status ${statusClass(selectedRequest.status)}`}>{statusLabel(selectedRequest.status)}</strong></div>
              <div className="branch-discontinuation-readonly-grid">
                <div><span>Course</span><strong>{selectedRequest.student?.courseName || '-'}</strong></div>
                <div><span>Batch</span><strong>{selectedRequest.student?.batchName || '-'}</strong></div>
                <div><span>Call outcome</span><strong>{OUTCOME_OPTIONS.find((option) => option.value === selectedRequest.contactOutcome)?.label || statusLabel(selectedRequest.status)}</strong></div>
                <div><span>Next follow-up</span><strong>{isMotivationFollowUp ? 'First mail sent' : selectedRequest.nextFollowUpDate || 'Not scheduled'}</strong></div>
              </div>
              <div className="branch-discontinuation-readonly-note"><span>Student request</span><strong>{displayRequestReason(selectedRequest.reason)}</strong><p>{selectedRequest.details || 'No additional details provided.'}</p></div>
              {!isMotivationFollowUp ? <div className="branch-discontinuation-readonly-note"><span>Call notes</span><p>{selectedRequest.contactNotes || selectedRequest.branchReviewNote || 'No call notes provided.'}</p></div> : null}
              <div className="branch-discontinuation-finance-summary">
                <div><span>Course progress</span><strong>{Number(selectedRequest.financialSnapshot?.courseProgress || 0)}%</strong></div>
                <div><span>Paid amount</span><strong>{formatAmount(selectedRequest.financialSnapshot?.totalPaid)}</strong></div>
                <div><span>Outstanding</span><strong>{formatAmount(selectedRequest.financialSnapshot?.finalOutstandingAmount ?? selectedRequest.financialSnapshot?.outstandingAmount)}</strong></div>
                {selectedRequest.financialSnapshot?.refundRequested ? <div><span>Refund eligible</span><strong>{formatAmount(selectedRequest.financialSnapshot?.refundEligibleAmount)}</strong></div> : null}
              </div>
            </div>}
            <div className="branch-discontinuation-modal-actions"><button type="button" className="branch-discontinuation-secondary" onClick={() => { setSelectedRequest(null); setSelectedReadOnly(false) }}>{canEditSelectedRequest ? 'Cancel' : 'Close'}</button>{canEditSelectedRequest ? <button type="submit" className="branch-discontinuation-action" disabled={saving}>{saving ? <><Loader2 size={15} className="is-spinning" /> Sending...</> : outcome === 'DISCONTINUE' ? 'Send to Super Admin' : 'Save outcome'}</button> : null}</div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
