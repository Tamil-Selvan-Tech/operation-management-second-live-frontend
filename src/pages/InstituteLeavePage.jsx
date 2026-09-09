import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Plus, X } from 'lucide-react'
import { request } from '../services/apiClient'
import '../styles/InstituteLeavePage.css'

const unwrap = response => response?.data ?? response
export function InstituteLeavePage() {
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [cancel, setCancel] = useState(null)
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
  const close = () => { if (!busy) { setForm(null); setDetail(null); setCancel(null) } }
  async function save(event) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      await request(`/institute-leaves${cancel ? `/${cancel.id}` : form?.id ? `/${form.id}` : ''}`, {
        method: cancel ? 'DELETE' : form.id ? 'PATCH' : 'POST',
        ...(cancel ? {} : { body: JSON.stringify({ leaveDate: form.leaveDate, reason: form.reason }) }),
      })
      setForm(null); setCancel(null)
      setMessage(cancel ? 'Institute Leave cancelled. Schedules restored.' : 'Institute Leave saved. Calendars and affected-user notifications updated.')
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
  return <section className="institute-leave-page">
    <header className="institute-leave-header"><div><p className="section-kicker">Management</p><h2>Institute Leave</h2><p>Declare leave and review affected classes.</p></div>
      <button className="institute-primary" onClick={() => { setError(''); setForm({ leaveDate: '', reason: '' }) }} disabled={!data}><Plus size={18} /> Declare Leave</button></header>
    {error && !open ? <p role="alert" className="institute-error">{error}</p> : null}
    {message ? <p role="status" className="institute-success">{message}</p> : null}
    <div className="institute-leave-stats">{[['Today’s Leave', 'today'], ['Upcoming Leave', 'upcoming'], ['This Month', 'thisMonth'], ['Affected Classes', 'affectedClasses']].map(([label, key]) => <article key={key}><CalendarDays size={22} /><strong>{data?.summary?.[key] ?? '—'}</strong><span>{label}</span></article>)}</div>
    <div className="institute-leave-filters"><input aria-label="Search leave history" placeholder="Search date or reason" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Leave status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Cancelled</option></select></div>
    <div className="institute-table-scroll"><table><caption>Leave history</caption><thead><tr><th>Date</th><th>Reason</th><th>Status</th><th>Affected classes</th><th>Actions</th></tr></thead><tbody>
      {leaves.map(leave => <tr key={leave.id}><td>{leave.leaveDate}</td><td>{leave.reason}</td><td>{leave.status === 'ACTIVE' ? 'Active' : 'Cancelled'}</td><td>{leave.affectedClassCount}</td><td><div className="institute-row-actions"><button onClick={() => view(leave)}>View</button>{leave.canEdit ? <><button onClick={() => { setError(''); setForm(leave) }}>Edit</button><button onClick={() => { setError(''); setCancel(leave) }}>Cancel</button></> : null}</div></td></tr>)}
      {!leaves.length ? <tr><td colSpan="5">{data ? 'No leaves found.' : 'Loading leave history…'}</td></tr> : null}
    </tbody></table></div>
    <dialog ref={dialog} className="institute-dialog" onCancel={event => { event.preventDefault(); close() }}>
      <div className="institute-leave-header"><h3>{detail ? 'Leave details' : cancel ? 'Cancel Institute Leave' : form?.id ? 'Edit Institute Leave' : 'Declare Leave'}</h3><button type="button" aria-label="Close" onClick={close} disabled={busy}><X size={20} /></button></div>
      {error ? <p role="alert" className="institute-error">{error}</p> : null}
      {form ? <form onSubmit={save}><label>Leave Date *<input type="date" required min={data?.today} value={form.leaveDate} onChange={e => setForm({ ...form, leaveDate: e.target.value })} /></label><label>Reason *<textarea required maxLength={1000} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></label><button className="institute-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Leave'}</button></form> : null}
      {cancel ? <form onSubmit={save}><p>Cancel leave on {cancel.leaveDate} and restore the affected future classes?</p><p>{cancel.reason}</p><button className="institute-primary" disabled={busy}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</button></form> : null}
      {detail ? <div><p><strong>{detail.leaveDate}</strong> · {detail.status === 'ACTIVE' ? 'Active' : 'Cancelled'}</p><p>{detail.reason}</p><p>{detail.affectedClassCount} classes · {detail.affectedStudentCount} students · {detail.affectedFacultyCount} faculty</p><p>Declared: {new Date(detail.declaredAt).toLocaleString(undefined, { timeZone: data?.timezone })} ({data?.timezone})</p><div className="institute-table-scroll"><table><thead><tr><th>Student</th><th>Batch</th><th>Time</th><th>Hours</th></tr></thead><tbody>{(detail.affectedClasses || []).map((item, index) => <tr key={`${item.studentId}-${index}`}><td>{item.studentName}</td><td>{item.batchName}</td><td>{item.startTime}–{item.endTime}</td><td>{item.scheduledHours}</td></tr>)}</tbody></table></div>{!detail.affectedClassCount ? <p>No scheduled classes affected.</p> : null}</div> : null}
    </dialog>
  </section>
}
