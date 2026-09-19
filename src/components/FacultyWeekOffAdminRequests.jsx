import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  approveWeekOffRequest,
  getBranchWeekOffRequests,
  getWeekOffRequestById,
  rejectWeekOffRequest,
} from '../services/facultyWeekOffService'

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(value, weekday = false) {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return `${weekday ? `${date.toLocaleDateString('en-GB', { weekday: 'long' })}, ` : ''}${dateFormat.format(date)}`
}

export function FacultyWeekOffAdminRequests() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)
  const [modalMode, setModalMode] = useState('approve')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectReasonError, setRejectReasonError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setItems(await getBranchWeekOffRequests())
    } catch (loadError) {
      setError(loadError.message || 'Unable to load week-off requests')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = items.filter((item) => !status || String(item.status).toUpperCase() === status)

  async function openReview(item, mode) {
    try {
      setSelected(await getWeekOffRequestById(item.id))
      setModalMode(mode)
      setRejectReason('')
      setRejectReasonError('')
      setError('')
    } catch (detailError) {
      setError(detailError.message || 'Unable to load request')
    }
  }

  function closeReview() {
    setSelected(null)
    setRejectReason('')
    setRejectReasonError('')
  }

  async function review(action) {
    if (!selected) return
    if (action === 'reject' && !rejectReason.trim()) {
      setRejectReasonError('This field is required')
      return
    }

    setBusy(true)
    setError('')
    setRejectReasonError('')
    try {
      if (action === 'approve') await approveWeekOffRequest(selected.id)
      else await rejectWeekOffRequest(selected.id, rejectReason.trim())
      closeReview()
      await load()
    } catch (reviewError) {
      setError(reviewError.message || 'Unable to update request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="faculty-request-readonly-panel">
      <header className="institute-leave-header">
        <div>
          <p className="section-kicker">BRANCH ADMIN</p>
          <h2>Week-Off Requests</h2>
          <p>Review temporary, week-specific overrides. The recurring faculty weekly-off is never changed.</p>
        </div>
        <select aria-label="Week-off request status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </header>

      {error ? <p role="alert" className="institute-error">{error}</p> : null}

      <div className="institute-table-scroll">
        <table>
          <caption>Temporary week-off requests</caption>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Faculty</th>
              <th>Requested Week</th>
              <th>Current Week-Off</th>
              <th>Requested Week-Off</th>
              <th>Reason</th>
              <th>Applied Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item, index) => {
              const pending = String(item.status || 'PENDING').toUpperCase() === 'PENDING'
              return (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td><strong>{item.facultyName || '-'}</strong><small>{item.facultyId || '-'}</small></td>
                  <td>{formatDate(item.requestedWeekStartDate || item.weekStartDate)} - {formatDate(item.requestedWeekEndDate || item.weekEndDate)}</td>
                  <td>{formatDate(item.defaultWeekOffDate, true)}</td>
                  <td>{formatDate(item.requestedWeekOffDate, true)}</td>
                  <td>{item.reason || '-'}</td>
                  <td>{formatDate(item.createdAt || item.appliedAt)}</td>
                  <td><span className={`faculty-leave-status status-${String(item.status || 'PENDING').toLowerCase()}`}>{item.status || 'PENDING'}</span></td>
                  <td>
                    <button type="button" className="institute-primary" onClick={() => openReview(item, 'approve')} disabled={!pending}>Approve</button>
                    <button type="button" onClick={() => openReview(item, 'reject')} disabled={!pending}>Reject</button>
                  </td>
                </tr>
              )
            })}
            {!visible.length ? <tr><td colSpan="9">No week-off requests found.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="institute-success-popup" role="dialog" aria-modal="true">
          <div className="approval-confirmation-card weekoff-review-card">
            <button type="button" className="approval-confirmation-close" aria-label="Close" onClick={closeReview}>
              <X size={20} />
            </button>
            <strong>Temporary Week-Off Request</strong>

            <dl className="weekoff-review-details">
              <dt>Current Week-Off</dt>
              <dd>{formatDate(selected.defaultWeekOffDate, true)}</dd>
              <dt>Requested Week-Off</dt>
              <dd>{formatDate(selected.requestedWeekOffDate, true)}</dd>
              <dt>Reason</dt>
              <dd>{selected.reason || '-'}</dd>
            </dl>

            {modalMode === 'reject' ? (
              <>
                <label className="weekoff-rejection-field">
                  Rejection Reason *
                  <textarea
                    value={rejectReason}
                    aria-invalid={Boolean(rejectReasonError)}
                    onChange={(event) => {
                      setRejectReason(event.target.value)
                      if (event.target.value.trim()) setRejectReasonError('')
                    }}
                    placeholder="Enter rejection reason"
                    rows="3"
                  />
                  {rejectReasonError ? <small className="weekoff-rejection-error" role="alert">{rejectReasonError}</small> : null}
                </label>
                <div className="institute-confirm-actions">
                  <button type="button" onClick={closeReview} disabled={busy}>Cancel</button>
                  <button type="button" className="institute-primary" onClick={() => review('reject')} disabled={busy}>Reject</button>
                </div>
              </>
            ) : (
              <div className="institute-confirm-actions">
                <button type="button" className="institute-primary" onClick={() => review('approve')} disabled={busy}>
                  {busy ? 'Saving...' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
