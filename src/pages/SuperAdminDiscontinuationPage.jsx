import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Search, X } from 'lucide-react'
import { request } from '../services/apiClient'

function unwrapRows(response) {
  const payload = response?.data ?? response
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.requests)) return payload.requests
  return []
}

function formatAmount(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function getStudent(requestItem) {
  return requestItem?.branchStudent || requestItem?.student || {}
}

function getFinancialValue(requestItem, key) {
  return requestItem?.financialSnapshot?.[key] ?? requestItem?.[key] ?? 0
}

export function SuperAdminDiscontinuationPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [decision, setDecision] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const loadRequests = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const response = await request('/student-discontinuation?status=SUPER_ADMIN_REVIEW')
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
    const term = search.trim().toLowerCase()
    if (!term) return requests
    return requests.filter((item) => {
      const student = getStudent(item)
      return [
        student.studentName,
        student.studentId,
        student.emailAddress,
        student.courseName,
        student.batchName,
        item.branchId,
        item.reason,
      ].some((value) => String(value || '').toLowerCase().includes(term))
    })
  }, [requests, search])

  const closeDetails = () => {
    if (saving) return
    setSelected(null)
    setDecision('')
    setNote('')
  }

  const openDetails = (item, nextDecision = '') => {
    setSelected(item)
    setDecision(nextDecision)
    setNote('')
    setError('')
  }

  const submitDecision = async (event) => {
    event.preventDefault()
    if (!selected || saving) return
    if (decision === 'REJECT' && !note.trim()) {
      setError('Rejection reason is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await request(`/student-discontinuation/${encodeURIComponent(selected.id)}/super-review`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          note: note.trim(),
          waiverAmount: '0',
          refundEligibleAmount: String(getFinancialValue(selected, 'refundEligibleAmount') || 0),
          financeNote: '',
        }),
      })
      closeDetails()
      await loadRequests({ silent: true })
    } catch (saveError) {
      setError(saveError?.message || 'Unable to save the decision.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="super-admin-global-panel super-admin-discontinuation-page">
      <div className="super-admin-global-header">
        <div>
          <p className="branch-management-kicker">Leave Management</p>
          <h1>Student Discontinuation</h1>
          <p>Review requests sent by Branch Admin and make the final decision.</p>
        </div>
        <div className="super-admin-global-header-actions super-admin-discontinuation-actions">
          <label className="super-admin-student-search" htmlFor="super-admin-discontinuation-search">
            <Search size={16} aria-hidden="true" />
            <input id="super-admin-discontinuation-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, ID or course" />
          </label>
          <button type="button" className="super-admin-discontinuation-refresh" onClick={() => void loadRequests({ silent: true })} disabled={loading || refreshing}>{refreshing ? <Loader2 size={15} className="is-spinning" /> : 'Refresh'}</button>
          <span className="super-admin-global-count">{filteredRequests.length} pending</span>
        </div>
      </div>

      {error ? <div className="super-admin-global-state is-error">{error}</div> : null}

      {loading ? <div className="super-admin-discontinuation-loading" aria-label="Loading discontinuation requests"><span /><span /><span /></div> : (
        <div className="super-admin-global-table-wrap super-admin-discontinuation-table-wrap">
          <table className="super-admin-global-table super-admin-discontinuation-table">
            <thead><tr><th>Student</th><th>Course / Batch</th><th>Outstanding</th><th>Branch</th><th>Action</th></tr></thead>
            <tbody>
              {filteredRequests.map((item) => {
                const student = getStudent(item)
                return <tr key={item.id} className="super-admin-global-table-row-action" onClick={() => openDetails(item)}>
                  <td><strong>{student.studentName || '-'}</strong><small>{student.studentId || student.emailAddress || '-'}</small></td>
                  <td><strong>{student.courseName || '-'}</strong><small>{student.batchName || '-'}</small></td>
                  <td><strong>{formatAmount(getFinancialValue(item, 'finalOutstandingAmount') || getFinancialValue(item, 'outstandingAmount'))}</strong><small>{item.reason || 'Discontinuation request'}</small></td>
                  <td><strong>{item.branchName || item.branchId || '-'}</strong></td>
                  <td><div className="super-admin-discontinuation-row-actions"><button type="button" className="super-admin-discontinuation-view" onClick={(event) => { event.stopPropagation(); openDetails(item) }}>View details</button><button type="button" className="super-admin-discontinuation-approve" onClick={(event) => { event.stopPropagation(); openDetails(item, 'APPROVE') }}>Approve</button></div></td>
                </tr>
              })}
              {!filteredRequests.length ? <tr><td colSpan="5" className="super-admin-global-empty">{search.trim() ? 'No matching discontinuation requests found.' : 'No requests are awaiting final approval.'}</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}

      {selected ? <div className="super-admin-discontinuation-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails() }}>
        <div className="super-admin-discontinuation-modal" role="dialog" aria-modal="true" aria-labelledby="super-admin-discontinuation-title">
          <button type="button" className="super-admin-discontinuation-close" aria-label="Close details" onClick={closeDetails}><X size={19} /></button>
          <p className="branch-management-kicker">Final review</p>
          <h2 id="super-admin-discontinuation-title">{getStudent(selected).studentName || 'Student'} discontinuation</h2>
          <p className="super-admin-discontinuation-modal-copy">Branch Admin has reviewed this request. Choose whether to approve or reject it.</p>
          <div className="super-admin-discontinuation-detail-grid"><div><span>Student ID</span><strong>{getStudent(selected).studentId || '-'}</strong></div><div><span>Course</span><strong>{getStudent(selected).courseName || '-'}</strong></div><div><span>Reason</span><strong>{selected.reason || '-'}</strong></div><div><span>Paid amount</span><strong>{formatAmount(getFinancialValue(selected, 'totalPaid'))}</strong></div><div><span>Outstanding amount</span><strong>{formatAmount(getFinancialValue(selected, 'finalOutstandingAmount') || getFinancialValue(selected, 'outstandingAmount'))}</strong></div><div><span>Refund eligible</span><strong>{formatAmount(getFinancialValue(selected, 'refundEligibleAmount'))}</strong></div></div>
          {decision ? null : <div className="super-admin-discontinuation-modal-actions"><button type="button" className="super-admin-discontinuation-danger" onClick={() => setDecision('REJECT')}>Reject</button><button type="button" className="super-admin-discontinuation-approve" onClick={() => setDecision('APPROVE')}>Approve &amp; discontinue</button></div>}
        </div>
      </div> : null}

      {selected && decision ? <div className="super-admin-discontinuation-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDecision('') }}>
        <form className="super-admin-discontinuation-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="super-admin-discontinuation-confirm-title" onSubmit={submitDecision}>
          <button type="button" className="super-admin-discontinuation-confirm-close" aria-label="Close confirmation" onClick={() => { setDecision(''); setNote('') }} disabled={saving}><X size={18} /></button>
          <p className="branch-management-kicker">{decision === 'REJECT' ? 'Review decision' : 'Final approval'}</p>
          <h2 id="super-admin-discontinuation-confirm-title">{decision === 'REJECT' ? 'Reject discontinuation?' : 'Approve discontinuation?'}</h2>
          <p>{decision === 'REJECT' ? 'Add a clear reason so the Branch Admin and student understand why this request was rejected.' : 'This will approve the Branch Admin-reviewed request and schedule the student account deactivation according to the configured policy.'}</p>
          <div className="super-admin-discontinuation-confirm-summary"><span>Student</span><strong>{getStudent(selected).studentName || '-'}</strong><span>{decision === 'REJECT' ? 'Request reason' : 'Outstanding amount'}</span><strong>{decision === 'REJECT' ? (selected.reason || '-') : formatAmount(getFinancialValue(selected, 'finalOutstandingAmount') || getFinancialValue(selected, 'outstandingAmount'))}</strong></div>
          {decision === 'REJECT' ? <label className="super-admin-discontinuation-confirm-note">Rejection reason<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain why this request is being rejected." rows={4} required /></label> : null}
          <div className="super-admin-discontinuation-modal-actions"><button type="button" className="super-admin-discontinuation-secondary" onClick={() => { setDecision(''); setNote('') }} disabled={saving}>Cancel</button><button type="submit" className={decision === 'REJECT' ? 'super-admin-discontinuation-danger' : 'super-admin-discontinuation-approve'} disabled={saving}>{saving ? <Loader2 size={16} className="is-spinning" /> : decision === 'REJECT' ? 'Confirm rejection' : 'Confirm approval'}</button></div>
        </form>
      </div> : null}
    </section>
  )
}
