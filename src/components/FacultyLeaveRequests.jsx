import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Clock3, Send, UserRound } from 'lucide-react'
import { request } from '../services/apiClient'

const emptyForm = { leaveType: 'PLANNED', fromDate: '', toDate: '', durationType: 'FULL_DAY', halfDayPeriod: '', reason: '' }

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function FacultyLeaveRequests() {
  const [form, setForm] = useState(emptyForm)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await request('/faculty-leave-requests/me')
      setRequests(response?.data?.requests || response?.requests || [])
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your leave requests')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setError('')
    setSuccess('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!form.fromDate || !form.toDate || !form.reason.trim()) {
      setError('From date, To date, and Reason are required.')
      return
    }
    if (form.toDate < form.fromDate) {
      setError('To date cannot be before From date.')
      return
    }
    if (form.durationType === 'HALF_DAY' && !form.halfDayPeriod) {
      setError('Select Morning or Afternoon for half-day leave.')
      return
    }
    setSaving(true)
    try {
      await request('/faculty-leave-requests', { method: 'POST', body: JSON.stringify({ ...form, halfDayPeriod: form.durationType === 'HALF_DAY' ? form.halfDayPeriod : null }) })
      setForm(emptyForm)
      setSuccess('Leave request submitted to your Branch Admin.')
      await load()
    } catch (saveError) {
      setError(saveError.message || 'Unable to submit leave request')
    } finally {
      setSaving(false)
    }
  }

  return <section className="faculty-leave-page">
    <header className="faculty-leave-page-header">
      <div><span className="faculty-leave-eyebrow">FACULTY LEAVE</span><h1>Leave Requests</h1><p>Submit a request and track its status with your Branch Admin.</p></div>
      <span className="faculty-leave-header-icon"><CalendarDays size={24} /></span>
    </header>

    <div className="faculty-leave-layout">
      <form className="faculty-leave-form-card" onSubmit={submit} noValidate>
        <div className="faculty-leave-card-heading"><div><h2>Apply Leave</h2><p>Provide the dates and class period you will be unavailable.</p></div><Send size={20} /></div>
        {error ? <p className="faculty-leave-feedback is-error" role="alert">{error}</p> : null}
        {success ? <p className="faculty-leave-feedback is-success" role="status">{success}</p> : null}
        <div className="faculty-leave-form-grid">
          <label>Leave Type *<select value={form.leaveType} onChange={event => update('leaveType', event.target.value)}><option value="PLANNED">Planned</option><option value="UNPLANNED">Unplanned</option><option value="EMERGENCY">Emergency</option></select></label>
          <label>Duration *<select value={form.durationType} onChange={event => update('durationType', event.target.value)}><option value="FULL_DAY">Full Day</option><option value="HALF_DAY">Half Day</option></select></label>
          <label>From Date *<input type="date" min={today()} value={form.fromDate} onChange={event => { update('fromDate', event.target.value); if (!form.toDate) update('toDate', event.target.value) }} /></label>
          <label>To Date *<input type="date" min={form.fromDate || today()} value={form.toDate} onChange={event => update('toDate', event.target.value)} /></label>
          {form.durationType === 'HALF_DAY' ? <label className="faculty-leave-full-width">Half-Day Period *<select value={form.halfDayPeriod} onChange={event => update('halfDayPeriod', event.target.value)}><option value="">Select period</option><option value="MORNING">Morning (09:00 AM - 01:00 PM)</option><option value="AFTERNOON">Afternoon (02:00 PM - 06:00 PM)</option></select></label> : null}
          <label className="faculty-leave-full-width">Reason *<textarea maxLength={1000} rows={4} value={form.reason} onChange={event => update('reason', event.target.value)} placeholder="Tell your Branch Admin why you need leave" /></label>
        </div>
        <div className="faculty-leave-form-actions"><span>Requests are sent as Pending.</span><button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button></div>
      </form>

      <div className="faculty-leave-history-card">
        <div className="faculty-leave-card-heading"><div><h2>My Request History</h2><p>Newest requests appear first.</p></div><Clock3 size={20} /></div>
        {loading ? <div className="faculty-leave-empty">Loading leave requests...</div> : requests.length ? <div className="faculty-leave-history-list">{requests.map(item => <article key={item.id} className="faculty-leave-history-item"><div className="faculty-leave-history-top"><strong>{formatDate(item.fromDate)}{item.fromDate !== item.toDate ? ` - ${formatDate(item.toDate)}` : ''}</strong><span className={`faculty-leave-status status-${String(item.status || 'PENDING').toLowerCase()}`}>{item.status || 'PENDING'}</span></div><p>{item.leaveType} · {item.durationType === 'HALF_DAY' ? `${item.halfDayPeriod} half day` : 'Full day'}</p><p className="faculty-leave-history-reason">{item.reason}</p><small><UserRound size={13} /> {item.affectedClassCount || 0} affected class{item.affectedClassCount === 1 ? '' : 'es'}</small></article>)}</div> : <div className="faculty-leave-empty">You have not submitted a leave request yet.</div>}
      </div>
    </div>
  </section>
}
