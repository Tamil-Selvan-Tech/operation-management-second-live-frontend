import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart3, CalendarCheck2, CalendarClock, CalendarDays, MoreVertical, Plus, UsersRound, X } from 'lucide-react'
import { request } from '../services/apiClient'
import '../styles/InstituteLeavePage.css'

const unwrap = response => response?.data ?? response

function formatClassTime(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return value || '-'
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`
}

function formatDeclaredAt(value, timeZone = 'Asia/Kolkata') {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone,
  }).format(new Date(value))
}

function formatLeaveDate(value) {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value || '-'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
export function InstituteLeavePage() {
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [leavePage, setLeavePage] = useState(1)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [cancel, setCancel] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [successPopup, setSuccessPopup] = useState('')
  const [openActionMenu, setOpenActionMenu] = useState(null)
  const [pinnedActionMenu, setPinnedActionMenu] = useState(false)
  const dialog = useRef(null)
  const load = useCallback(async () => {
    try {
      const response = await request('/institute-leaves')
      setData(unwrap(response))
    } catch (err) { setError(err.message || 'Unable to load Institute Leave') }
  }, [])
  useEffect(() => {
    void Promise.resolve().then(load)
    const timer = setInterval(load, 30000)
    window.addEventListener('focus', load)
    return () => { clearInterval(timer); window.removeEventListener('focus', load) }
  }, [load])
  const open = Boolean(form || detail || cancel)
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  useEffect(() => {
    const closeOnOutsideClick = event => {
      if (!event.target.closest('.institute-action-menu')) {
        setOpenActionMenu(null)
        setPinnedActionMenu(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])
  const close = () => { if (!busy) { setForm(null); setDetail(null); setCancel(null) } }
  async function save(event) {
    event.preventDefault()
    if (form) {
      const nextErrors = {}
      if (!form.leaveDate) nextErrors.leaveDate = 'This field is required'
      if (!String(form.reason || '').trim()) nextErrors.reason = 'This field is required'
      setFieldErrors(nextErrors)
      if (Object.keys(nextErrors).length) return
    }
    setBusy(true); setError(''); setMessage('')
    try {
      await request(`/institute-leaves${cancel ? `/${cancel.id}` : form?.id ? `/${form.id}` : ''}`, {
        method: cancel ? 'DELETE' : form.id ? 'PATCH' : 'POST',
        ...(cancel ? {} : { body: JSON.stringify({ leaveDate: form.leaveDate, reason: form.reason }) }),
      })
      setForm(null); setCancel(null)
      const successText = cancel ? 'Institute Leave cancelled. Schedules restored.' : 'Institute Leave saved successfully. Calendars and notifications updated.'
      setMessage(successText)
      setSuccessPopup(successText)
      window.dispatchEvent(new Event('institute-leave-updated'))
      await load()
    } catch (err) { setError(err.message || 'Unable to save Institute Leave') }
    finally { setBusy(false) }
  }
  async function view(leave) {
    setError('')
    try { setDetail(unwrap(await request(`/institute-leaves/${leave.id}`))) }
    catch (err) { setError(err.message) }
  }
  const leaves = (data?.leaves || []).filter(l => (!status || l.status === status) && `${l.leaveDate} ${l.reason}`.toLowerCase().includes(search.toLowerCase()))
  const leavePageSize = 5
  const leavePageCount = Math.max(1, Math.ceil(leaves.length / leavePageSize))
  const visibleLeaves = leaves.slice((leavePage - 1) * leavePageSize, leavePage * leavePageSize)
  const affectedBatches = detail ? Object.values((detail.affectedClasses || []).reduce((groups, item) => {
    const key = `${item.batchRecordId || item.batchId || item.batchName || 'batch'}:${item.startTime || ''}:${item.endTime || ''}`
    const current = groups[key] || { ...item, affectedStudents: 0 }
    current.affectedStudents += 1
    groups[key] = current
    return groups
  }, {})) : []
  return <section className="institute-leave-page">
    <header className="institute-leave-header"><div className="institute-leave-heading"><span className="institute-heading-icon"><CalendarDays size={34} /></span><div><p className="section-kicker">Management</p><h2>Institute Leave</h2><p>Manage institute-wide leaves and schedule changes</p></div></div>
      <button className="institute-primary" onClick={() => { setError(''); setFieldErrors({}); setForm({ leaveDate: formDate(data?.today), reason: '' }) }} disabled={!data}><Plus size={18} /> Cancel Class</button></header>
    {error && !open ? <p role="alert" className="institute-error">{error}</p> : null}
    {message ? <p role="status" className="institute-success">{message}</p> : null}
    <div className="institute-leave-stats">{[
      { label: "Today's Leave", key: 'today', icon: CalendarCheck2, tone: 'red', note: 'Leave declared today' },
      { label: 'Upcoming Leave', key: 'upcoming', icon: CalendarClock, tone: 'blue', note: 'Next scheduled leave' },
      { label: 'This Month', key: 'thisMonth', icon: BarChart3, tone: 'green', note: 'Leave days' },
      { label: 'Affected Classes', key: 'affectedClasses', icon: UsersRound, tone: 'purple', note: 'Classes affected' },
    ].map(({ label, key, icon: Icon, tone, note }) => <article key={key} className={`leave-stat-card tone-${tone}`}><span className="leave-stat-icon"><Icon size={27} /></span><div className="leave-stat-copy"><span>{label}</span><strong>{data?.summary?.[key] ?? '—'}</strong><small>{note}</small></div><Icon className="leave-stat-watermark" size={58} /></article>)}</div>
    <div className="institute-leave-filters"><input aria-label="Search leave history" placeholder="Search date or reason" value={search} onChange={e => { setSearch(e.target.value); setLeavePage(1) }} /><select aria-label="Leave status" value={status} onChange={e => { setStatus(e.target.value); setLeavePage(1) }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Cancelled</option></select></div>
    <div className="institute-table-scroll"><table><caption>Leave history</caption><thead><tr><th>S.No</th><th>Date</th><th>Reason</th><th>Status</th><th>Affected classes</th><th>Actions</th></tr></thead><tbody>
      {visibleLeaves.map((leave, index) => <tr key={leave.id} className="institute-leave-row-clickable" onClick={event => { if (!event.target.closest('button')) view(leave) }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); view(leave) } }} tabIndex={0}><td>{(leavePage - 1) * leavePageSize + index + 1}</td><td>{formatLeaveDate(leave.leaveDate)}</td><td>{leave.reason}</td><td>{leave.status === 'ACTIVE' ? 'Active' : 'Cancelled'}</td><td>{leave.affectedClassCount}</td><td><div className="institute-action-menu" onMouseEnter={() => { if (!pinnedActionMenu) setOpenActionMenu(leave.id) }} onMouseLeave={() => { if (!pinnedActionMenu) setOpenActionMenu(null) }}><button type="button" className="institute-action-menu-trigger" aria-label={`Actions for ${formatLeaveDate(leave.leaveDate)}`} aria-expanded={openActionMenu === leave.id} onClick={() => { if (openActionMenu === leave.id && pinnedActionMenu) { setOpenActionMenu(null); setPinnedActionMenu(false); return } setOpenActionMenu(leave.id); setPinnedActionMenu(true) }}><MoreVertical size={19} /></button>{openActionMenu === leave.id ? <div className="institute-action-menu-dropdown" role="menu" onMouseEnter={() => setOpenActionMenu(leave.id)}><button type="button" role="menuitem" onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); view(leave) }}>View</button>{leave.status === 'ACTIVE' ? <><button type="button" role="menuitem" onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); setError(''); setForm(leave) }}>Edit</button><button type="button" role="menuitem" onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); setError(''); setCancel(leave) }}>Cancel</button></> : null}</div> : null}</div></td></tr>)}
      {!leaves.length ? <tr><td colSpan="6">{data ? 'No leaves found.' : 'Loading leave history…'}</td></tr> : null}
    </tbody></table></div>
    {leaves.length > leavePageSize ? <div className="institute-pagination"><span>Page {Math.min(leavePage, leavePageCount)} of {leavePageCount}</span><div><button type="button" disabled={leavePage === 1} onClick={() => setLeavePage(page => Math.max(1, page - 1))}>Previous</button><button type="button" disabled={leavePage >= leavePageCount} onClick={() => setLeavePage(page => Math.min(leavePageCount, page + 1))}>Next</button></div></div> : null}
    <dialog ref={dialog} className={`institute-dialog ${cancel ? 'is-confirmation' : ''}`.trim()} onCancel={event => { event.preventDefault(); close() }}>
      <div className="institute-leave-header"><h3>{detail ? 'Leave details' : cancel ? 'Cancel Institute Leave' : form?.id ? 'Edit Institute Leave' : 'Declare Leave'}</h3><button type="button" aria-label="Close" onClick={close} disabled={busy}><X size={20} /></button></div>
      {error ? <p role="alert" className="institute-error">{error}</p> : null}
      {form ? <form onSubmit={save} noValidate><label>Leave Date *<input type="date" min={form.id ? undefined : data?.today} value={form.leaveDate} onChange={e => { setForm({ ...form, leaveDate: e.target.value }); setFieldErrors(current => ({ ...current, leaveDate: '' })) }} />{fieldErrors.leaveDate ? <small className="institute-field-error">{fieldErrors.leaveDate}</small> : null}</label><label>Reason *<textarea maxLength={1000} value={form.reason} onChange={e => { setForm({ ...form, reason: e.target.value }); setFieldErrors(current => ({ ...current, reason: '' })) }} />{fieldErrors.reason ? <small className="institute-field-error">{fieldErrors.reason}</small> : null}</label><button className="institute-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Leave'}</button></form> : null}
      {cancel ? <form onSubmit={save}><p className="institute-confirm-question">Are you sure you want to cancel this leave?</p><p>Leave date: <strong>{formatLeaveDate(cancel.leaveDate)}</strong></p><p>This will restore the affected future classes and recalculate schedules.</p><div className="institute-confirm-actions"><button type="button" onClick={close} disabled={busy}>Keep Leave</button><button className="institute-primary" disabled={busy}>{busy ? 'Cancelling…' : 'Confirm Cancel'}</button></div></form> : null}
      {detail ? <div><p><strong>{formatLeaveDate(detail.leaveDate)}</strong> · {detail.status === 'ACTIVE' ? 'Active' : 'Cancelled'}</p><p>{detail.reason}</p><p>{detail.affectedClassCount} classes · {detail.affectedStudentCount} students · {detail.affectedFacultyCount} faculty</p><p>Declared: {formatDeclaredAt(detail.declaredAt, data?.timezone)}</p><div className="institute-table-scroll"><table><thead><tr><th>Affected Batch</th><th>Class Time</th><th>Students</th><th>Hours</th></tr></thead><tbody>{affectedBatches.map((item, index) => <tr key={`${item.batchRecordId || item.batchName}-${item.startTime}-${index}`}><td><strong>{item.batchName || item.batchId || 'Batch'}</strong></td><td>{formatClassTime(item.startTime)} – {formatClassTime(item.endTime)}</td><td>{item.affectedStudents}</td><td>{item.scheduledHours}</td></tr>)}</tbody></table></div>{!detail.affectedClassCount ? <p>No scheduled batches affected.</p> : null}</div> : null}
    </dialog>
    {successPopup ? <div className="institute-success-popup" role="alertdialog" aria-modal="true"><div><strong>Success</strong><p>{successPopup}</p><button type="button" className="institute-primary" onClick={() => setSuccessPopup('')}>OK</button></div></div> : null}
  </section>
}

function formDate(value) {
  if (value) return value
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
