import { useCallback, useEffect, useState } from 'react'
import { request } from '../services/apiClient'
import '../styles/InstituteLeavePage.css'

export function FacultySchedulePanel() {
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7))
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) return
    try {
      const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
      const response = await request(`/institute-leaves/faculty-calendar?from=${month}-01&to=${last}`)
      setEvents((response.data ?? response).events || []); setError('')
    } catch (err) { setError(err.message) }
  }, [month])
  useEffect(() => {
    void Promise.resolve().then(load)
    const timer = setInterval(load, 30000)
    window.addEventListener('focus', load)
    window.addEventListener('institute-leave-updated', load)
    return () => { clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('institute-leave-updated', load) }
  }, [load])
  return <section className="institute-leave-page" style={{ marginBottom: 24 }}><div className="institute-leave-header"><h3>Faculty Calendar</h3><label>Month <input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label></div>
    {error ? <p role="alert" className="institute-error">{error}</p> : null}
    <div className="institute-table-scroll"><table><thead><tr><th>Date</th><th>Batch</th><th>Time</th><th>Status</th><th>Hours</th><th>Attendance</th></tr></thead><tbody>{events.map((event, index) => <tr key={`${event.batchRecordId}-${event.date}-${index}`} className={event.code === 'INSTITUTE_LEAVE' ? 'institute-leave-session' : ''}><td>{event.date}</td><td>{event.batchName}</td><td>{event.startTime}–{event.endTime}</td><td>{event.status}{event.isReplacement ? ' · Replacement' : ''}{event.reason ? <small style={{ display: 'block' }}>{event.reason}</small> : null}</td><td>{event.code === 'INSTITUTE_LEAVE' ? `${event.scheduledHours} cancelled` : event.classHours}</td><td>{event.attendanceStatus === 'NOT_APPLICABLE' ? 'Not Applicable' : '—'}</td></tr>)}{!events.length ? <tr><td colSpan="6">No scheduled classes this month.</td></tr> : null}</tbody></table></div>
  </section>
}
