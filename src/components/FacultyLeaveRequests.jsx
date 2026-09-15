import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Clock3, Send, UserRound } from 'lucide-react'
import { request } from '../services/apiClient'

const MAX_HALF_DAY_MINUTES = 5 * 60
const emptyForm = { leaveType: 'PLANNED', fromDate: '', toDate: '', durationType: 'FULL_DAY', halfDayStart: '', halfDayEnd: '', permissionHours: '', permissionStart: '', permissionEnd: '', reason: '' }

function formatBatchTime(value, period) {
  const [hourText, minuteText] = String(value || '').split(':')
  const hour = Number(hourText)
  if (!Number.isInteger(hour) || !minuteText) return value || '-'
  const normalizedHour = hour % 12 || 12
  return `${normalizedHour}:${minuteText} ${String(period || '').toUpperCase()}`
}

const CLOCK_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const CLOCK_MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

function clockParts(value, period) {
  const [hourText, minute = '00'] = String(value || '').split(':')
  const hour = Number(hourText)
  if (!Number.isInteger(hour)) return { hour: '', minute, period: period || 'AM' }
  return { hour: String(hour % 12 || 12).padStart(2, '0'), minute, period: String(period || (hour >= 12 ? 'PM' : 'AM')).toUpperCase() }
}

function clockMinutes(parts) {
  let hour = Number(parts.hour)
  if (!Number.isInteger(hour)) return null
  if (parts.period === 'AM' && hour === 12) hour = 0
  if (parts.period === 'PM' && hour !== 12) hour += 12
  return hour * 60 + Number(parts.minute || 0)
}

function clockValue(parts) {
  const minutes = clockMinutes(parts)
  return minutes == null ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

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
  const [scheduleSlots, setScheduleSlots] = useState([])
  const [warningMessage, setWarningMessage] = useState('')

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
    try {
      const scheduleResponse = await request('/faculty-leave-requests/me/schedule')
      setScheduleSlots((scheduleResponse?.data?.slots || scheduleResponse?.slots || []).filter(slot => slot.durationMinutes <= MAX_HALF_DAY_MINUTES))
    } catch {
      setScheduleSlots([])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setError('')
    setSuccess('')
  }

  function updateHalfDayPart(side, field, value) {
    const current = clockParts(side === 'start' ? form.halfDayStart : form.halfDayEnd)
    const next = { ...current, [field]: value }
    const other = clockParts(side === 'start' ? form.halfDayEnd : form.halfDayStart)
    const start = side === 'start' ? next : other
    const end = side === 'end' ? next : other
    const startMinutes = clockMinutes(start)
    const endMinutes = clockMinutes(end)
    if (startMinutes != null && endMinutes != null) {
      const duration = endMinutes - startMinutes
      if (duration > MAX_HALF_DAY_MINUTES) {
        setWarningMessage('Half-day leave cannot be more than 5 hours. Please choose a shorter time range.')
        return
      }
      if (duration <= 0) setError('End time must be after the start time.')
    }
    setError('')
    update(side === 'start' ? 'halfDayStart' : 'halfDayEnd', clockValue(next))
  }

  function renderClock(side, label) {
    const parts = clockParts(side === 'start' ? form.halfDayStart : form.halfDayEnd)
    return <div className="faculty-leave-clock-group"><span>{label}</span><div className="faculty-leave-clock-controls"><select aria-label={`${label} hour`} value={parts.hour} onChange={event => updateHalfDayPart(side, 'hour', event.target.value)}><option value="">HH</option>{CLOCK_HOURS.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label={`${label} minute`} value={parts.minute} onChange={event => updateHalfDayPart(side, 'minute', event.target.value)}><option value="">MM</option>{CLOCK_MINUTES.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label={`${label} AM or PM`} value={parts.period} onChange={event => updateHalfDayPart(side, 'period', event.target.value)}><option value="AM">AM</option><option value="PM">PM</option></select></div></div>
  }

  function updatePermissionPart(side, field, value) {
    const current = clockParts(side === 'start' ? form.permissionStart : form.permissionEnd)
    const next = { ...current, [field]: value }
    const other = clockParts(side === 'start' ? form.permissionEnd : form.permissionStart)
    const start = side === 'start' ? next : other
    const end = side === 'end' ? next : other
    const startMinutes = clockMinutes(start)
    const endMinutes = clockMinutes(end)
    update(side === 'start' ? 'permissionStart' : 'permissionEnd', clockValue(next))
    if (startMinutes != null && endMinutes != null && endMinutes <= startMinutes) setError('End time must be after the start time.')
  }

  function renderPermissionClock(side, label) {
    const parts = clockParts(side === 'start' ? form.permissionStart : form.permissionEnd)
    return <div className="faculty-leave-clock-group"><span>{label}</span><div className="faculty-leave-clock-controls"><select aria-label={`${label} hour`} value={parts.hour} onChange={event => updatePermissionPart(side, 'hour', event.target.value)}><option value="">HH</option>{CLOCK_HOURS.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label={`${label} minute`} value={parts.minute} onChange={event => updatePermissionPart(side, 'minute', event.target.value)}><option value="">MM</option>{CLOCK_MINUTES.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label={`${label} AM or PM`} value={parts.period} onChange={event => updatePermissionPart(side, 'period', event.target.value)}><option value="AM">AM</option><option value="PM">PM</option></select></div></div>
  }

  function permissionHours() {
    if (!form.permissionStart || !form.permissionEnd) return ''
    const [startHour, startMinute] = form.permissionStart.split(':').map(Number)
    const [endHour, endMinute] = form.permissionEnd.split(':').map(Number)
    const start = startHour * 60 + startMinute
    const end = endHour * 60 + endMinute
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 60 : ''
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (form.durationType === 'PERMISSION' && (!form.fromDate || !form.reason.trim())) {
      setError('Date and Reason are required for permission leave.')
      return
    }
    if (form.durationType !== 'PERMISSION' && (!form.fromDate || !form.toDate || !form.reason.trim())) {
      setError('From date, To date, and Reason are required.')
      return
    }
    if (form.toDate < form.fromDate) {
      setError('To date cannot be before From date.')
      return
    }
    if (form.durationType === 'HALF_DAY' && (!form.halfDayStart || !form.halfDayEnd)) {
      setError('Select the half-day start and end time.')
      return
    }
    const calculatedPermissionHours = permissionHours()
    if (form.durationType === 'PERMISSION' && (!form.permissionStart || !form.permissionEnd)) {
      setError('Select the permission start and end time.')
      return
    }
    if (form.durationType === 'PERMISSION' && !calculatedPermissionHours) {
      setError('End time must be after the start time.')
      return
    }
    setSaving(true)
    try {
      await request('/faculty-leave-requests', { method: 'POST', body: JSON.stringify({ ...form, toDate: form.durationType === 'PERMISSION' ? form.fromDate : form.toDate, halfDayStart: form.durationType === 'HALF_DAY' ? form.halfDayStart : null, halfDayEnd: form.durationType === 'HALF_DAY' ? form.halfDayEnd : null, permissionHours: form.durationType === 'PERMISSION' ? calculatedPermissionHours : null, permissionStart: form.durationType === 'PERMISSION' ? form.permissionStart : null, permissionEnd: form.durationType === 'PERMISSION' ? form.permissionEnd : null }) })
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
          <label>Duration *<select value={form.durationType} onChange={event => { const nextDuration = event.target.value; update('durationType', nextDuration); if (nextDuration === 'HALF_DAY' || nextDuration === 'PERMISSION') { update('fromDate', today()); update('toDate', today()) } if (nextDuration !== 'HALF_DAY') { update('halfDayStart', ''); update('halfDayEnd', '') }; if (nextDuration !== 'PERMISSION') { update('permissionStart', ''); update('permissionEnd', ''); update('permissionHours', '') } }}><option value="FULL_DAY">Full Day</option><option value="HALF_DAY">Half Day</option><option value="PERMISSION">Permission</option></select></label>
          {form.durationType === 'HALF_DAY' || form.durationType === 'PERMISSION' ? <label>Date *<input type="date" min={today()} value={form.fromDate} onChange={event => { update('fromDate', event.target.value); update('toDate', event.target.value) }} /></label> : <><label>From Date *<input type="date" min={today()} value={form.fromDate} onChange={event => { update('fromDate', event.target.value); if (!form.toDate) update('toDate', event.target.value) }} /></label><label>To Date *<input type="date" min={form.fromDate || today()} value={form.toDate} onChange={event => update('toDate', event.target.value)} /></label></>}
          {form.durationType === 'HALF_DAY' ? <div className="faculty-leave-full-width faculty-leave-clock-picker"><div className="faculty-leave-clock-picker-heading"><strong>Half-Day Timing *</strong></div><div className="faculty-leave-clock-range">{renderClock('start', 'START')}<span className="faculty-leave-clock-separator">-</span>{renderClock('end', 'END')}</div></div> : null}
          {form.durationType === 'PERMISSION' ? <><div className="faculty-leave-full-width faculty-leave-clock-picker"><div className="faculty-leave-clock-range">{renderPermissionClock('start', 'START')}<span className="faculty-leave-clock-separator">-</span>{renderPermissionClock('end', 'END')}</div></div><label className="faculty-leave-full-width">Total Hours<input type="text" value={permissionHours() ? `${permissionHours()} Hours` : ''} readOnly aria-readonly="true" placeholder="Automatically calculated" /></label></> : null}
          <label className="faculty-leave-full-width">Reason *<textarea maxLength={1000} rows={4} value={form.reason} onChange={event => update('reason', event.target.value)} placeholder="Tell your Branch Admin why you need leave" /></label>
        </div>
        <div className="faculty-leave-form-actions"><span>Requests are sent as Pending.</span><button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button></div>
      </form>

      <div className="faculty-leave-history-card">
        <div className="faculty-leave-card-heading"><div><h2>My Request History</h2><p>Newest requests appear first.</p></div><Clock3 size={20} /></div>
        {loading ? <div className="faculty-leave-empty">Loading leave requests...</div> : requests.length ? <div className="faculty-leave-history-list">{requests.map(item => <article key={item.id} className="faculty-leave-history-item"><div className="faculty-leave-history-top"><strong>{formatDate(item.fromDate)}{item.fromDate !== item.toDate ? ` - ${formatDate(item.toDate)}` : ''}</strong><span className={`faculty-leave-status status-${String(item.status || 'PENDING').toLowerCase()}`}>{item.status || 'PENDING'}</span></div><p>{item.leaveType} · {item.durationType === 'HALF_DAY' ? `${item.halfDayStart || '-'} - ${item.halfDayEnd || '-'}` : item.durationType === 'PERMISSION' ? `${item.permissionHours} hour${Number(item.permissionHours) === 1 ? '' : 's'} permission${item.permissionStart ? ` from ${item.permissionStart}` : ''}${item.permissionEnd ? ` to ${item.permissionEnd}` : ''}` : 'Full day'}</p><p className="faculty-leave-history-reason">{item.reason}</p><small><UserRound size={13} /> {item.affectedClassCount || 0} affected class{item.affectedClassCount === 1 ? '' : 'es'}</small></article>)}</div> : <div className="faculty-leave-empty">You have not submitted a leave request yet.</div>}
      </div>
    </div>
    {warningMessage ? <div className="faculty-leave-warning-popup" role="alertdialog" aria-modal="true"><div className="faculty-leave-warning-card"><strong>Half-Day Duration Limit</strong><p>{warningMessage}</p><button type="button" onClick={() => setWarningMessage('')}>OK</button></div></div> : null}
  </section>
}
