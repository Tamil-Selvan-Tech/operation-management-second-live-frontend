import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Clock3, MoreVertical, Send, X } from 'lucide-react'
import { request } from '../services/apiClient'
import { FacultyWeekOffRequests } from './FacultyWeekOffRequests'

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

function displayTime(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return value || '-'
  let hour = Number(match[1])
  if (hour > 23) return value || '-'
  const period = match[3] ? match[3].toUpperCase() : hour >= 12 ? 'PM' : 'AM'
  if (match[3]) {
    if (hour < 1 || hour > 12) return value || '-'
  } else {
    hour = hour % 12 || 12
  }
  return `${String(hour).padStart(2, '0')}:${match[2]} ${period}`
}

function requestDateTime(item) {
  if (item.durationType === 'HALF_DAY') return `${displayTime(item.halfDayStart)} - ${displayTime(item.halfDayEnd)}`
  if (item.durationType === 'PERMISSION') return `${displayTime(item.permissionStart)} - ${displayTime(item.permissionEnd)}`
  return '-'
}

function requestDates(item) {
  return `${formatDate(item.fromDate)}${item.fromDate !== item.toDate ? ` - ${formatDate(item.toDate)}` : ''}`
}

function fullDayCount(fromDate, toDate) {
  if (!fromDate || !toDate || toDate < fromDate) return ''
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${toDate}T00:00:00`)
  const count = Math.round((to - from) / 86400000) + 1
  return Number.isFinite(count) && count > 0 ? count : ''
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
  const [editingRequest, setEditingRequest] = useState(null)
  const [openActionMenu, setOpenActionMenu] = useState(null)
  const [cancelRequest, setCancelRequest] = useState(null)
  const [delegatedSessions, setDelegatedSessions] = useState([])
  const [delegatedTarget, setDelegatedTarget] = useState(null)
  const [delegatedMode, setDelegatedMode] = useState('REPLACEMENT')
  const [delegatedEligible, setDelegatedEligible] = useState({ faculty: [], combineSessions: [], source: null })
  const [replacementBatches, setReplacementBatches] = useState([])
  const [combineFacultyId, setCombineFacultyId] = useState('')
  const [delegatedForm, setDelegatedForm] = useState({ replacementFacultyId: '', replacementStartTime: '', replacementEndTime: '', targetSessionId: '' })
  const [delegatedError, setDelegatedError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await request('/faculty-leave-requests/me')
      const requestRows = response?.data?.requests || response?.data?.data?.requests || response?.requests || response?.data?.leaves || response?.leaves || (Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [])
      setRequests(Array.isArray(requestRows) ? requestRows : [])
      const delegatedResponse = await request('/faculty-leave-requests/me/delegated-emergency')
      const delegatedRows = delegatedResponse?.data?.sessions || delegatedResponse?.sessions || []
      setDelegatedSessions(Array.isArray(delegatedRows) ? delegatedRows : [])
    } catch (loadError) {
      console.error('Unable to load faculty leave requests:', loadError)
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

  async function openDelegatedResolution(session, mode) {
    setDelegatedError('')
    setDelegatedTarget(session)
    setDelegatedMode(mode)
    setCombineFacultyId('')
    setReplacementBatches([])
    setDelegatedForm({ replacementFacultyId: '', replacementBatchRecordId: '', replacementStartTime: session.originalStartTime || '', replacementEndTime: session.originalEndTime || '', targetSessionId: '' })
    try {
      const response = await request(`/faculty-leave-requests/${session.leaveRequestId}/sessions/${session.id}/delegated-eligible-faculty?assignmentType=${mode}`)
      const data = response?.data || response || {}
      setDelegatedEligible({ faculty: data.faculty || [], combineSessions: data.combineSessions || [], source: data.source || null })
      setReplacementBatches(data.replacementBatches || [])
    } catch (resolutionError) {
      setDelegatedError(resolutionError.message || 'Unable to load eligible faculty')
    }
  }

  async function saveDelegatedResolution() {
    if (!delegatedTarget) return
    setSaving(true)
    setDelegatedError('')
    try {
      const payload = delegatedMode === 'REPLACEMENT'
        ? { assignmentType: 'REPLACEMENT', replacementFacultyId: delegatedForm.replacementFacultyId, replacementBatchRecordId: delegatedForm.replacementBatchRecordId, replacementDate: delegatedTarget.sessionDate, replacementStartTime: delegatedForm.replacementStartTime, replacementEndTime: delegatedForm.replacementEndTime }
        : { assignmentType: 'COMBINED', targetSessionId: delegatedForm.targetSessionId }
      await request(`/faculty-leave-requests/${delegatedTarget.leaveRequestId}/sessions/${delegatedTarget.id}/delegated-resolve`, { method: 'POST', body: JSON.stringify(payload) })
      setDelegatedTarget(null)
      await load()
    } catch (resolutionError) {
      setDelegatedError(resolutionError.message || 'Unable to save this session resolution')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    function closeActionMenu(event) {
      if (!event.target.closest('.faculty-leave-action-menu')) {
        setOpenActionMenu(null)
      }
    }
    document.addEventListener('mousedown', closeActionMenu)
    return () => document.removeEventListener('mousedown', closeActionMenu)
  }, [])

  useEffect(() => {
    if (!delegatedTarget || delegatedMode !== 'REPLACEMENT' || !delegatedForm.replacementFacultyId) return
    let active = true
    const query = new URLSearchParams({ assignmentType: 'REPLACEMENT', replacementFacultyId: delegatedForm.replacementFacultyId, replacementStartTime: delegatedForm.replacementStartTime || '', replacementEndTime: delegatedForm.replacementEndTime || '' })
    request(`/faculty-leave-requests/${delegatedTarget.leaveRequestId}/sessions/${delegatedTarget.id}/delegated-eligible-faculty?${query.toString()}`)
      .then(response => { if (active) setReplacementBatches(response?.data?.replacementBatches || response?.replacementBatches || []) })
      .catch(() => { if (active) setReplacementBatches([]) })
    return () => { active = false }
  }, [delegatedTarget, delegatedMode, delegatedForm.replacementFacultyId, delegatedForm.replacementStartTime, delegatedForm.replacementEndTime])

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

  function openCreateForm() {
    setEditingRequest(null)
    setForm(emptyForm)
    setFieldErrors({})
    setError('')
    setSuccess('')
    setIsApplyLeaveOpen(true)
  }

  function openEditForm(item) {
    setEditingRequest(item)
    setForm({ ...emptyForm, ...item, permissionHours: item.permissionHours == null ? '' : String(item.permissionHours) })
    setOpenActionMenu(null)
    setFieldErrors({})
    setError('')
    setSuccess('')
    setIsApplyLeaveOpen(true)
  }

  async function confirmCancelRequest() {
    if (!cancelRequest) return
    setSaving(true)
    setError('')
    try {
      await request(`/faculty-leave-requests/${cancelRequest.id}/cancel`, { method: 'POST' })
      setCancelRequest(null)
      setSuccess('Leave request cancelled successfully.')
      await load()
    } catch (cancelError) {
      setError(cancelError.message || 'Unable to cancel leave request')
    } finally {
      setSaving(false)
    }
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
      const payload = { ...form, toDate: form.durationType === 'PERMISSION' ? form.fromDate : form.toDate, halfDayStart: form.durationType === 'HALF_DAY' ? form.halfDayStart : null, halfDayEnd: form.durationType === 'HALF_DAY' ? form.halfDayEnd : null, permissionHours: form.durationType === 'PERMISSION' ? calculatedPermissionHours : null, permissionStart: form.durationType === 'PERMISSION' ? form.permissionStart : null, permissionEnd: form.durationType === 'PERMISSION' ? form.permissionEnd : null }
      await request(editingRequest ? `/faculty-leave-requests/${editingRequest.id}` : '/faculty-leave-requests', { method: editingRequest ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      setForm(emptyForm)
      setEditingRequest(null)
      setIsApplyLeaveOpen(false)
      setSuccess(editingRequest ? 'Leave request updated and sent to your Branch Admin.' : 'Leave request submitted to your Branch Admin.')
      await load()
    } catch (saveError) {
      setError(saveError.message || 'Unable to submit leave request')
    } finally {
      setSaving(false)
    }
  }

  function renderDelegatedTime(field, label) {
    const parts = clockParts(delegatedForm[field])
    return <label>{label}<div className="faculty-delegated-time-selects"><select value={parts.hour} onChange={event => setDelegatedForm(current => ({ ...current, [field]: clockValue({ ...parts, hour: event.target.value }) }))}><option value="">HH</option>{CLOCK_HOURS.map(value => <option key={value} value={value}>{value}</option>)}</select><select value={parts.minute} onChange={event => setDelegatedForm(current => ({ ...current, [field]: clockValue({ ...parts, minute: event.target.value }) }))}><option value="">MM</option>{CLOCK_MINUTES.map(value => <option key={value} value={value}>{value}</option>)}</select><select value={parts.period} onChange={event => setDelegatedForm(current => ({ ...current, [field]: clockValue({ ...parts, period: event.target.value }) }))}><option value="AM">AM</option><option value="PM">PM</option></select></div></label>
  }

  return <section className="faculty-leave-page">
    <header className="faculty-leave-page-header">
      <div><span className="faculty-leave-eyebrow">FACULTY LEAVE</span><h1>Leave Requests</h1><p>Submit a request and track its status with your Branch Admin.</p></div>
      <div className="faculty-leave-page-header-actions"><span className="faculty-leave-header-icon"><CalendarDays size={24} /></span><button type="button" className="faculty-leave-apply-button" onClick={openCreateForm}><Send size={16} /> Apply Leave</button></div>
    </header>
    {success && !isApplyLeaveOpen ? <p className="faculty-leave-feedback is-success" role="status">{success}</p> : null}
    {error && !isApplyLeaveOpen ? <p className="faculty-leave-feedback is-error" role="alert">{error}</p> : null}

    <div className="faculty-leave-layout">
      {isApplyLeaveOpen ? <div className="faculty-leave-modal-backdrop" role="presentation"><div className="faculty-leave-modal" role="dialog" aria-modal="true" aria-labelledby="faculty-leave-modal-title"><form className="faculty-leave-form-card" onSubmit={submit} noValidate>
        <div className="faculty-leave-card-heading"><div><h2 id="faculty-leave-modal-title">{editingRequest ? 'Edit Leave Request' : 'Apply Leave'}</h2><p>Provide the dates and class period you will be unavailable.</p></div><button type="button" className="faculty-leave-close-button" aria-label="Close Apply Leave" onClick={() => setIsApplyLeaveOpen(false)}><X size={20} /></button></div>
        {error ? <p className="faculty-leave-feedback is-error" role="alert">{error}</p> : null}
        {success ? <p className="faculty-leave-feedback is-success" role="status">{success}</p> : null}
        <div className="faculty-leave-form-grid">
          <label>Leave Type *<select value={form.leaveType} onChange={event => update('leaveType', event.target.value)}><option value="PLANNED">Planned</option><option value="UNPLANNED">Unplanned</option><option value="EMERGENCY">Emergency</option></select></label>
          <label>Day Type *<select value={form.durationType} onChange={event => { const nextDuration = event.target.value; update('durationType', nextDuration); if (nextDuration === 'HALF_DAY' || nextDuration === 'PERMISSION') { update('fromDate', today()); update('toDate', today()) } if (nextDuration !== 'HALF_DAY') { update('halfDayStart', ''); update('halfDayEnd', '') }; if (nextDuration !== 'PERMISSION') { update('permissionStart', ''); update('permissionEnd', ''); update('permissionHours', '') } }}><option value="FULL_DAY">Full Day</option><option value="HALF_DAY">Half Day</option><option value="PERMISSION">Permission</option></select></label>
          {form.durationType === 'HALF_DAY' || form.durationType === 'PERMISSION' ? <label>Date *<input type="date" min={today()} value={form.fromDate} onChange={event => { update('fromDate', event.target.value); update('toDate', event.target.value) }} />{fieldErrors.fromDate ? <small className="faculty-leave-field-error">{fieldErrors.fromDate}</small> : null}</label> : <><label>From Date *<input type="date" min={today()} value={form.fromDate} onChange={event => { update('fromDate', event.target.value); if (!form.toDate) update('toDate', event.target.value) }} />{fieldErrors.fromDate ? <small className="faculty-leave-field-error">{fieldErrors.fromDate}</small> : null}</label><label>To Date *<input type="date" min={form.fromDate || today()} value={form.toDate} onChange={event => update('toDate', event.target.value)} />{fieldErrors.toDate ? <small className="faculty-leave-field-error">{fieldErrors.toDate}</small> : null}</label><label>Duration *<input type="text" value={fullDayCount(form.fromDate, form.toDate) ? `${fullDayCount(form.fromDate, form.toDate)} Day${fullDayCount(form.fromDate, form.toDate) === 1 ? '' : 's'}` : ''} readOnly aria-readonly="true" placeholder="Select dates" /></label></>}
          {form.durationType === 'HALF_DAY' ? <div className="faculty-leave-full-width faculty-leave-clock-picker"><div className="faculty-leave-clock-picker-heading"><strong>Half-Day Timing *</strong></div><div className="faculty-leave-clock-range">{renderClock('start', 'START')}<span className="faculty-leave-clock-separator">-</span>{renderClock('end', 'END')}</div>{fieldErrors.halfDayStart || fieldErrors.halfDayEnd ? <small className="faculty-leave-field-error">{fieldErrors.halfDayStart || fieldErrors.halfDayEnd}</small> : null}</div> : null}
          {form.durationType === 'PERMISSION' ? <><div className="faculty-leave-full-width faculty-leave-clock-picker"><div className="faculty-leave-clock-range">{renderPermissionClock('start', 'START')}<span className="faculty-leave-clock-separator">-</span>{renderPermissionClock('end', 'END')}</div>{fieldErrors.permissionStart || fieldErrors.permissionEnd ? <small className="faculty-leave-field-error">{fieldErrors.permissionStart || fieldErrors.permissionEnd}</small> : null}</div><label className="faculty-leave-full-width">Total Hours<input type="text" value={permissionHours() ? `${permissionHours()} Hours` : ''} readOnly aria-readonly="true" placeholder="Automatically calculated" /></label></> : null}
          <label className="faculty-leave-full-width">Reason *<textarea maxLength={1000} rows={4} value={form.reason} onChange={event => update('reason', event.target.value)} placeholder="Tell your Branch Admin why you need leave" />{fieldErrors.reason ? <small className="faculty-leave-field-error">{fieldErrors.reason}</small> : null}</label>
        </div>
        <div className="faculty-leave-form-actions"><span>Requests are sent as Pending.</span><div className="faculty-leave-modal-actions"><button type="button" className="faculty-leave-cancel-button" onClick={() => setIsApplyLeaveOpen(false)} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving...' : editingRequest ? 'Save Changes' : 'Submit Request'}</button></div></div>
      </form>

      </div></div> : null}

      {delegatedSessions.length ? <section className="faculty-emergency-delegated-card"><div className="faculty-leave-card-heading"><div><span className="faculty-leave-eyebrow">EMERGENCY LEAVE</span><h2>Session Action Required</h2><p>These affected sessions were delegated to you by your Branch Admin.</p></div></div><div className="faculty-emergency-session-list">{delegatedSessions.map(session => <article key={session.id} className="faculty-emergency-session"><div><strong>{session.batchName || session.batchId}</strong><span>{session.courseName || 'Course'} · {formatDate(session.sessionDate)} · {displayTime(session.originalStartTime)} - {displayTime(session.originalEndTime)}</span></div><div className="faculty-emergency-session-actions"><button type="button" onClick={() => openDelegatedResolution(session, 'REPLACEMENT')}>Replace</button><button type="button" onClick={() => openDelegatedResolution(session, 'COMBINED')}>Combine</button></div></article>)}</div></section> : null}

      <div className="faculty-leave-history-card">
        <div className="faculty-leave-card-heading"><div><h2>My Requests</h2><p>Newest requests appear first.</p></div><Clock3 size={20} /></div>
        {loading ? <div className="faculty-leave-empty faculty-leave-table-state">Loading leave requests...</div> : <div className="faculty-leave-table-wrap"><table className="faculty-leave-table"><caption className="sr-only">My leave requests</caption><thead><tr><th scope="col">S.No</th><th scope="col">Leave Type</th><th scope="col">Day Type</th><th scope="col">Date</th><th scope="col">Duration</th><th scope="col">Reason</th><th scope="col">Status</th><th scope="col">Applied Date</th><th scope="col">Actions</th></tr></thead><tbody>{requests.map((item, index) => { const isPending = String(item.status || 'PENDING').toUpperCase() === 'PENDING'; const isActionMenuVisible = openActionMenu === item.id; return <tr key={`table-${item.id}`}><td>{index + 1}</td><td>{item.leaveType || '-'}</td><td>{requestDuration(item)}</td><td>{requestDates(item)}</td><td>{item.durationType === 'FULL_DAY' ? `${item.durationDays || fullDayCount(item.fromDate, item.toDate) || '-'} Day${Number(item.durationDays || fullDayCount(item.fromDate, item.toDate)) === 1 ? '' : 's'}` : requestDateTime(item)}</td><td className="faculty-leave-reason-cell">{item.reason || '-'}</td><td><span className={`faculty-leave-status status-${String(item.status || 'PENDING').toLowerCase()}`}>{item.status || 'PENDING'}</span></td><td>{formatAppliedDate(item.appliedAt || item.createdAt || item.submittedAt)}</td><td><div className={`faculty-leave-action-menu${index === 0 ? ' is-first-row' : ''}`}><button type="button" className="faculty-leave-action-trigger" aria-label={`Actions for request ${index + 1}`} aria-expanded={isActionMenuVisible} onClick={() => setOpenActionMenu(item.id)}><MoreVertical size={19} /></button>{isActionMenuVisible ? <div className="faculty-leave-action-dropdown" role="menu"><button type="button" role="menuitem" disabled={!isPending} onClick={() => isPending && openEditForm(item)}>Edit</button><button type="button" role="menuitem" disabled={!isPending} onClick={() => { if (isPending) { setCancelRequest(item); setOpenActionMenu(null) } }}>Cancel</button></div> : null}</div></td></tr> })}{!requests.length ? <tr><td colSpan="9" className="faculty-leave-table-empty">No leave requests</td></tr> : null}</tbody></table></div>}
      </div>
    </div>
    {cancelRequest ? <div className="faculty-leave-warning-popup" role="presentation"><div className="faculty-leave-warning-card faculty-leave-confirm-card" role="dialog" aria-modal="true" aria-labelledby="cancel-leave-title"><button type="button" className="faculty-leave-confirm-close" aria-label="Close cancel confirmation" onClick={() => setCancelRequest(null)} disabled={saving}><X size={19} /></button><strong id="cancel-leave-title">Cancel Leave Request?</strong><p>Are you sure you want to cancel this leave request?</p><p className="faculty-leave-cancel-details">{requestDates(cancelRequest)} · {requestDuration(cancelRequest)}</p><div className="faculty-leave-confirm-actions"><button type="button" className="faculty-leave-cancel-button" onClick={() => setCancelRequest(null)} disabled={saving}>Keep Request</button><button type="button" onClick={confirmCancelRequest} disabled={saving}>{saving ? 'Cancelling...' : 'Confirm Cancel'}</button></div></div></div> : null}
    {warningMessage ? <div className="faculty-leave-warning-popup" role="alertdialog" aria-modal="true"><div className="faculty-leave-warning-card"><strong>Half-Day Duration Limit</strong><p>{warningMessage}</p><button type="button" onClick={() => setWarningMessage('')}>OK</button></div></div> : null}
    {delegatedTarget ? <div className="faculty-leave-warning-popup" role="presentation"><div className="faculty-leave-warning-card faculty-delegated-resolution-card" role="dialog" aria-modal="true"><button type="button" className="faculty-leave-confirm-close" aria-label="Close resolution" onClick={() => setDelegatedTarget(null)} disabled={saving}><X size={19} /></button><strong>{delegatedMode === 'REPLACEMENT' ? 'Replace Affected Session' : 'Combine Affected Session'}</strong><p>{delegatedTarget.batchName} · {formatDate(delegatedTarget.sessionDate)} · {displayTime(delegatedTarget.originalStartTime)} - {displayTime(delegatedTarget.originalEndTime)}</p>{delegatedError ? <p className="faculty-leave-feedback is-error" role="alert">{delegatedError}</p> : null}{delegatedMode === 'REPLACEMENT' ? <><label>Replacement Faculty<select value={delegatedForm.replacementFacultyId} onChange={event => setDelegatedForm(current => ({ ...current, replacementFacultyId: event.target.value }))}><option value="">Select same-course faculty</option>{delegatedEligible.faculty.map(item => <option key={item.facultyId} value={item.facultyId}>{item.name} ({item.facultyId})</option>)}</select></label><label>Start Time<input type="time" value={delegatedForm.replacementStartTime} onChange={event => setDelegatedForm(current => ({ ...current, replacementStartTime: event.target.value }))} /></label><label>End Time<input type="time" value={delegatedForm.replacementEndTime} onChange={event => setDelegatedForm(current => ({ ...current, replacementEndTime: event.target.value }))} /></label></> : <label>Compatible Batch<select value={delegatedForm.targetSessionId} onChange={event => setDelegatedForm(current => ({ ...current, targetSessionId: event.target.value }))}><option value="">Select compatible batch</option>{delegatedEligible.combineSessions.map(item => <option key={item.id} value={item.id}>{item.batchName} · {displayTime(item.originalStartTime)} - {displayTime(item.originalEndTime)}</option>)}</select></label>}<div className="faculty-leave-confirm-actions"><button type="button" className="faculty-leave-cancel-button" onClick={() => setDelegatedTarget(null)} disabled={saving}>Cancel</button><button type="button" onClick={saveDelegatedResolution} disabled={saving || (delegatedMode === 'REPLACEMENT' ? !delegatedForm.replacementFacultyId : !delegatedForm.targetSessionId)}>{saving ? 'Saving...' : 'Save'}</button></div></div></div> : null}
    {delegatedTarget && delegatedMode === 'REPLACEMENT' && replacementBatches.length ? <div className="faculty-delegated-batch-summary"><strong>Selected faculty batches</strong><select value={delegatedForm.replacementBatchRecordId} onChange={event => setDelegatedForm(current => ({ ...current, replacementBatchRecordId: event.target.value }))}><option value="">Select batch</option>{replacementBatches.map(batch => <option key={batch.id} value={batch.id}>{batch.batchName} · {batch.courseName} · {displayTime(batch.startTime)} - {displayTime(batch.endTime)}{batch.availabilityStatus === 'ALREADY_SCHEDULED' ? ' · Already Scheduled' : ''}</option>)}</select>{replacementBatches.map(batch => <div key={`info-${batch.id}`}><span>{batch.batchName} · {batch.courseName} · {displayTime(batch.startTime)} - {displayTime(batch.endTime)}</span><em className={batch.availabilityStatus === 'ALREADY_SCHEDULED' ? 'is-conflict' : ''}>{batch.availabilityStatus === 'ALREADY_SCHEDULED' ? 'Already Scheduled' : 'Available'}</em></div>)}<div className="faculty-delegated-time-section">{renderDelegatedTime('replacementStartTime', 'Start Time')}{renderDelegatedTime('replacementEndTime', 'End Time')}</div></div> : null}
    {delegatedTarget && delegatedError ? <p className="faculty-delegated-timing-error" role="alert">{delegatedError}</p> : null}
    {delegatedTarget && !delegatedEligible.faculty.length ? <p className="faculty-delegated-no-faculty" role="status">No faculty available</p> : null}
    {delegatedTarget && delegatedMode === 'COMBINED' && delegatedEligible.combineSessions.length ? <div className="faculty-delegated-combine-summary"><strong>Current affected batch progress</strong><span>Module: {delegatedEligible.source?.moduleName || '—'} · Progress: {delegatedEligible.source?.moduleProgress ?? delegatedEligible.source?.courseProgress ?? 0}%</span><label>Select faculty<select value={combineFacultyId} onChange={event => { setCombineFacultyId(event.target.value); setDelegatedForm(current => ({ ...current, targetSessionId: '' })) }}><option value="">Select matching faculty</option>{delegatedEligible.faculty.map(item => <option key={item.facultyId} value={item.facultyId}>{item.name} ({item.facultyId})</option>)}</select></label><label>Matching batch<select value={delegatedForm.targetSessionId} onChange={event => setDelegatedForm(current => ({ ...current, targetSessionId: event.target.value }))}><option value="">Select matching batch</option>{delegatedEligible.combineSessions.filter(item => !combineFacultyId || item.facultyId === combineFacultyId).map(item => <option key={item.id} value={item.id}>{item.batchName} · {item.facultyName || 'Faculty'} · {item.moduleName || 'Module'} · {item.moduleProgress ?? item.courseProgress ?? 0}% · {displayTime(item.originalStartTime)} - {displayTime(item.originalEndTime)}</option>)}</select></label></div> : null}
    <FacultyWeekOffRequests />
  </section>
}
