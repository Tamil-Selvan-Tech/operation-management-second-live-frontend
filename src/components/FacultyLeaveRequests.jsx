import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Clock3, Send, X } from 'lucide-react'
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

function formatAppliedDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function requestDuration(item) {
  if (item.durationType === 'HALF_DAY') return 'Half Day'
  if (item.durationType === 'PERMISSION') return 'Permission'
  if (item.fromDate && item.toDate) {
    const from = new Date(`${item.fromDate}T00:00:00`)
    const to = new Date(`${item.toDate}T00:00:00`)
    const dayCount = Math.round((to - from) / 86400000) + 1
    if (Number.isFinite(dayCount) && dayCount > 0) return `${dayCount} Day${dayCount === 1 ? '' : 's'}`
  }
  return 'Full Day'
}

function requestDateTime(item) {
  if (item.durationType === 'HALF_DAY') return `${item.halfDayStart || '-'} - ${item.halfDayEnd || '-'}`
  if (item.durationType === 'PERMISSION') return `${item.permissionStart || '-'} - ${item.permissionEnd || '-'}`
  return '-'
}

function requestDates(item) {
  return `${formatDate(item.fromDate)}${item.fromDate !== item.toDate ? ` - ${formatDate(item.toDate)}` : ''}`
}

export function FacultyLeaveRequests() {
  const [form, setForm] = useState(emptyForm)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [success, setSuccess] = useState('')
  const [scheduleSlots, setScheduleSlots] = useState([])
  const [warningMessage, setWarningMessage] = useState('')
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false)

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
    setFieldErrors(current => ({ ...current, [field]: '' }))
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
    setFieldErrors({})
    setSuccess('')
    if (form.durationType === 'PERMISSION' && (!form.fromDate || !form.reason.trim())) {
      setFieldErrors({ fromDate: !form.fromDate ? 'This field is required' : '', reason: !form.reason.trim() ? 'This field is required' : '' })
      setError('Date and Reason are required for permission leave.')
      return
    }
    if (form.durationType !== 'PERMISSION' && (!form.fromDate || !form.toDate || !form.reason.trim())) {
      setFieldErrors({ fromDate: !form.fromDate ? 'This field is required' : '', toDate: !form.toDate ? 'This field is required' : '', reason: !form.reason.trim() ? 'This field is required' : '' })
      setError('From date, To date, and Reason are required.')
      return
    }
    if (form.toDate < form.fromDate) {
      setFieldErrors({ toDate: 'To date cannot be before From date.' })
      setError('To date cannot be before From date.')
      return
    }
    if (form.durationType === 'HALF_DAY' && (!form.halfDayStart || !form.halfDayEnd)) {
      setFieldErrors({ halfDayStart: !form.halfDayStart ? 'This field is required' : '', halfDayEnd: !form.halfDayEnd ? 'This field is required' : '' })
      setError('Select the half-day start and end time.')
      return
    }
    const calculatedPermissionHours = permissionHours()
    if (form.durationType === 'PERMISSION' && (!form.permissionStart || !form.permissionEnd)) {
      setFieldErrors({ permissionStart: !form.permissionStart ? 'This field is required' : '', permissionEnd: !form.permissionEnd ? 'This field is required' : '' })
      setError('Select the permission start and end time.')
      return
    }
    if (form.durationType === 'PERMISSION' && !calculatedPermissionHours) {
      setFieldErrors({ permissionEnd: 'End time must be after the start time.' })
      setError('End time must be after the start time.')
      return
    }
    setSaving(true)
    try {
      await request('/faculty-leave-requests', { method: 'POST', body: JSON.stringify({ ...form, toDate: form.durationType === 'PERMISSION' ? form.fromDate : form.toDate, halfDayStart: form.durationType === 'HALF_DAY' ? form.halfDayStart : null, halfDayEnd: form.durationType === 'HALF_DAY' ? form.halfDayEnd : null, permissionHours: form.durationType === 'PERMISSION' ? calculatedPermissionHours : null, permissionStart: form.durationType === 'PERMISSION' ? form.permissionStart : null, permissionEnd: form.durationType === 'PERMISSION' ? form.permissionEnd : null }) })
      setForm(emptyForm)
      setIsApplyLeaveOpen(false)
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
      <div className="faculty-leave-page-header-actions"><span className="faculty-leave-header-icon"><CalendarDays size={24} /></span><button type="button" className="faculty-leave-apply-button" onClick={() => setIsApplyLeaveOpen(true)}><Send size={16} /> Apply Leave</button></div>
    </header>

    <div className="faculty-leave-layout">
      {isApplyLeaveOpen ? <div className="faculty-leave-modal-backdrop" role="presentation"><div className="faculty-leave-modal" role="dialog" aria-modal="true" aria-labelledby="faculty-leave-modal-title"><form className="faculty-leave-form-card" onSubmit={submit} noValidate>
        <div className="faculty-leave-card-heading"><div><h2 id="faculty-leave-modal-title">Apply Leave</h2><p>Provide the dates and class period you will be unavailable.</p></div><button type="button" className="faculty-leave-close-button" aria-label="Close Apply Leave" onClick={() => setIsApplyLeaveOpen(false)}><X size={20} /></button></div>
        {error ? <p className="faculty-leave-feedback is-error" role="alert">{error}</p> : null}
        {success ? <p className="faculty-leave-feedback is-success" role="status">{success}</p> : null}
        <div className="faculty-leave-form-grid">
          <label>Leave Type *<select value={form.leaveType} onChange={event => update('leaveType', event.target.value)}><option value="PLANNED">Planned</option><option value="UNPLANNED">Unplanned</option><option value="EMERGENCY">Emergency</option></select></label>
          <label>Day Type *<select value={form.durationType} onChange={event => { const nextDuration = event.target.value; update('durationType', nextDuration); if (nextDuration === 'HALF_DAY' || nextDuration === 'PERMISSION') { update('fromDate', today()); update('toDate', today()) } if (nextDuration !== 'HALF_DAY') { update('halfDayStart', ''); update('halfDayEnd', '') }; if (nextDuration !== 'PERMISSION') { update('permissionStart', ''); update('permissionEnd', ''); update('permissionHours', '') } }}><option value="FULL_DAY">Full Day</option><option value="HALF_DAY">Half Day</option><option value="PERMISSION">Permission</option></select></label>
          {form.durationType === 'HALF_DAY' || form.durationType === 'PERMISSION' ? <label>Date *<input type="date" min={today()} value={form.fromDate} onChange={event => { update('fromDate', event.target.value); update('toDate', event.target.value) }} />{fieldErrors.fromDate ? <small className="faculty-leave-field-error">{fieldErrors.fromDate}</small> : null}</label> : <><label>From Date *<input type="date" min={today()} value={form.fromDate} onChange={event => { update('fromDate', event.target.value); if (!form.toDate) update('toDate', event.target.value) }} />{fieldErrors.fromDate ? <small className="faculty-leave-field-error">{fieldErrors.fromDate}</small> : null}</label><label>To Date *<input type="date" min={form.fromDate || today()} value={form.toDate} onChange={event => update('toDate', event.target.value)} />{fieldErrors.toDate ? <small className="faculty-leave-field-error">{fieldErrors.toDate}</small> : null}</label></>}
          {form.durationType === 'HALF_DAY' ? <div className="faculty-leave-full-width faculty-leave-clock-picker"><div className="faculty-leave-clock-picker-heading"><strong>Half-Day Timing *</strong></div><div className="faculty-leave-clock-range">{renderClock('start', 'START')}<span className="faculty-leave-clock-separator">-</span>{renderClock('end', 'END')}</div>{fieldErrors.halfDayStart || fieldErrors.halfDayEnd ? <small className="faculty-leave-field-error">{fieldErrors.halfDayStart || fieldErrors.halfDayEnd}</small> : null}</div> : null}
          {form.durationType === 'PERMISSION' ? <><div className="faculty-leave-full-width faculty-leave-clock-picker"><div className="faculty-leave-clock-range">{renderPermissionClock('start', 'START')}<span className="faculty-leave-clock-separator">-</span>{renderPermissionClock('end', 'END')}</div>{fieldErrors.permissionStart || fieldErrors.permissionEnd ? <small className="faculty-leave-field-error">{fieldErrors.permissionStart || fieldErrors.permissionEnd}</small> : null}</div><label className="faculty-leave-full-width">Total Hours<input type="text" value={permissionHours() ? `${permissionHours()} Hours` : ''} readOnly aria-readonly="true" placeholder="Automatically calculated" /></label></> : null}
          <label className="faculty-leave-full-width">Reason *<textarea maxLength={1000} rows={4} value={form.reason} onChange={event => update('reason', event.target.value)} placeholder="Tell your Branch Admin why you need leave" />{fieldErrors.reason ? <small className="faculty-leave-field-error">{fieldErrors.reason}</small> : null}</label>
        </div>
        <div className="faculty-leave-form-actions"><span>Requests are sent as Pending.</span><div className="faculty-leave-modal-actions"><button type="button" className="faculty-leave-cancel-button" onClick={() => setIsApplyLeaveOpen(false)} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button></div></div>
      </form>

      </div></div> : null}

      <div className="faculty-leave-history-card">
        <div className="faculty-leave-card-heading"><div><h2>My Requests</h2><p>Newest requests appear first.</p></div><Clock3 size={20} /></div>
        {loading ? <div className="faculty-leave-empty faculty-leave-table-state">Loading leave requests...</div> : requests.length ? <div className="faculty-leave-table-wrap"><table className="faculty-leave-table"><caption className="sr-only">My leave requests</caption><thead><tr><th scope="col">S.No</th><th scope="col">Leave Type</th><th scope="col">Day Type</th><th scope="col">Date</th><th scope="col">Duration</th><th scope="col">Reason</th><th scope="col">Status</th><th scope="col">Applied Date</th></tr></thead><tbody>{requests.map((item, index) => <tr key={`table-${item.id}`}><td>{index + 1}</td><td>{item.leaveType || '-'}</td><td>{requestDuration(item)}</td><td>{requestDates(item)}</td><td>{requestDateTime(item)}</td><td className="faculty-leave-reason-cell">{item.reason || '-'}</td><td><span className={`faculty-leave-status status-${String(item.status || 'PENDING').toLowerCase()}`}>{item.status || 'PENDING'}</span></td><td>{formatAppliedDate(item.appliedAt || item.createdAt || item.submittedAt)}</td></tr>)}</tbody></table></div> : <div className="faculty-leave-empty faculty-leave-table-state">No Data</div>}
      </div>
    </div>
    {warningMessage ? <div className="faculty-leave-warning-popup" role="alertdialog" aria-modal="true"><div className="faculty-leave-warning-card"><strong>Half-Day Duration Limit</strong><p>{warningMessage}</p><button type="button" onClick={() => setWarningMessage('')}>OK</button></div></div> : null}
  </section>
}
