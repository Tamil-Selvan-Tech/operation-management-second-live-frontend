import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react'
import { getFacultyCalendar, getFacultyLeaveRequests } from '../services/facultyCalendarService'
import '../styles/FacultyCalendar.css'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_LABELS = {
  CLASS: 'Class Day', SCHEDULED: 'Class Day', INSTITUTE_LEAVE: 'Class Cancelled',
  HOLIDAY: 'Government Holiday', FACULTY_WEEKLY_OFF: 'Week Off', NO_CLASS: 'No Class Day',
  LEAVE: 'Leave', HALF_DAY: 'Half Day Leave', PERMISSION: 'Permission', REASSIGNED: 'Reassigned Class',
}

function isoDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
function parseDate(value) {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}
function displayDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat('en-IN', options).format(date) : '—'
}
function normalizeStatus(event) {
  const code = String(event?.code || event?.type || event?.status || '').toUpperCase().replace(/[- ]/g, '_')
  return code === 'FACULTY_LEAVE' ? (String(event?.durationType || '').toUpperCase() === 'HALF_DAY' ? 'HALF_DAY' : 'LEAVE') : code
}
function timing(event) {
  const start = event?.startTime || event?.fromTime || ''
  const end = event?.endTime || event?.toTime || ''
  return start && end ? `${start} – ${end}` : event?.batchTiming || 'Scheduled time'
}

function CalendarEvent({ event, onSelect }) {
  const status = normalizeStatus(event)
  return <button type="button" className={`faculty-calendar-event faculty-calendar-event--${status.toLowerCase()}`} onClick={() => onSelect({ date: event.date, events: [event] })}>
    <span>{STATUS_LABELS[status] || event?.status || 'Calendar event'}</span>
    {event?.courseName || event?.batchName ? <small>{event.courseName || ''}{event.batchName ? ` · ${event.batchName}` : ''}</small> : null}
    {event?.startTime || event?.batchTiming ? <small>{timing(event)}</small> : null}
  </button>
}

export function FacultyCalendar({ faculty, facultyProfile }) {
  const [calendar, setCalendar] = useState(null)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [month, setMonth] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const batches = useMemo(() => (facultyProfile?.batchEntries || []).filter((batch) => String(batch?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'), [facultyProfile])
  const range = useMemo(() => {
    const starts = batches.map((b) => b.courseStartDate || b.startDate).filter(Boolean).sort()
    const ends = batches.map((b) => b.courseEndDate || b.endDate).filter(Boolean).sort()
    return { start: starts[0] || '', end: ends.at(-1) || '' }
  }, [batches])

  async function load() {
    setLoading(true); setError('')
    try {
      const [nextCalendar, requests] = await Promise.all([
        getFacultyCalendar({ startDate: range.start, endDate: range.end }),
        getFacultyLeaveRequests(),
      ])
      setCalendar(nextCalendar || { events: [] })
      setLeaveRequests(requests)
      const initial = parseDate(nextCalendar?.events?.[0]?.date || range.start) || new Date()
      setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1))
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load your calendar.')
    } finally { setLoading(false) }
  }
  useEffect(() => { if (facultyProfile) load() }, [facultyProfile, range.start, range.end])

  const events = useMemo(() => {
    const source = Array.isArray(calendar?.events) ? calendar.events : []
    const approved = leaveRequests.filter((item) => String(item?.status || '').toUpperCase() === 'APPROVED')
    const leaveEvents = approved.flatMap((item) => {
      const from = parseDate(item.fromDate); const to = parseDate(item.toDate || item.fromDate)
      if (!from || !to) return []
      const rows = []; for (let cursor = from; cursor <= to; cursor.setDate(cursor.getDate() + 1)) rows.push({ ...item, date: isoDate(cursor), code: item.durationType === 'PERMISSION' ? 'PERMISSION' : item.durationType === 'HALF_DAY' ? 'HALF_DAY' : 'LEAVE', status: 'Approved' })
      return rows
    })
    const existingLeaveKeys = new Set(source.map((event) => `${event?.id || ''}:${event?.date || ''}:${normalizeStatus(event)}`))
    const result = [...source, ...leaveEvents.filter((event) => !existingLeaveKeys.has(`${event?.id || ''}:${event?.date || ''}:${normalizeStatus(event)}`))]
    if (range.start && range.end) {
      const existingDates = new Set(result.map((event) => String(event.date || '').slice(0, 10)))
      const cursor = parseDate(range.start)
      const end = parseDate(range.end)
      while (cursor && end && cursor <= end) {
        const date = isoDate(cursor)
        if (!existingDates.has(date)) {
          const weekday = DAY_NAMES[cursor.getDay()].toUpperCase()
          const weeklyOff = batches.find((batch) => String(batch.weeklyOffDay || '').toUpperCase() === weekday)
          result.push({ date, code: weeklyOff ? 'FACULTY_WEEKLY_OFF' : 'NO_CLASS', reason: weeklyOff?.weeklyOffDay || '' })
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return result
  }, [batches, calendar, leaveRequests, range.end, range.start])

  const days = useMemo(() => {
    if (!month) return []
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))]
  }, [month])
  const eventsByDate = useMemo(() => events.reduce((map, event) => { const key = String(event.date || '').slice(0, 10); (map[key] ||= []).push(event); return map }, {}), [events])
  const courses = new Set(batches.map((batch) => batch.courseName || batch.courseId).filter(Boolean))
  const today = isoDate(new Date())

  if (!batches.length) return <section className="faculty-calendar-page"><div className="faculty-calendar-empty"><CalendarDays size={40} /><h2>No batches assigned</h2><p>Your calendar will appear once a batch is assigned to you.</p></div></section>
  return <section className="faculty-calendar-page">
    <header className="faculty-calendar-header"><div><span className="faculty-calendar-eyebrow">FACULTY SCHEDULE</span><h1>My Calendar</h1><p>{faculty?.name || facultyProfile?.facultyName || 'Faculty'} · {faculty?.id || facultyProfile?.facultyId || 'Faculty ID unavailable'}</p></div><button type="button" className="faculty-calendar-refresh" onClick={load} disabled={loading}><RefreshCw size={17} /> Refresh</button></header>
    {error ? <div className="faculty-calendar-error">{error}</div> : null}
    <div className="faculty-calendar-summary"><div><span>Total Courses</span><strong>{courses.size}</strong></div><div><span>Assigned Batches</span><strong>{batches.length}</strong></div><div><span>Active Batches</span><strong>{batches.length}</strong></div><div><span>Calendar Range</span><strong>{displayDate(range.start, { day: '2-digit', month: 'short' })} – {displayDate(range.end, { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div></div>
    <div className="faculty-calendar-card"><div className="faculty-calendar-toolbar"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button><h2>{month?.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button><button type="button" className="faculty-calendar-today" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button></div>
      <div className="faculty-calendar-legend">{Object.entries(STATUS_LABELS).filter(([key]) => !['CLASS', 'SCHEDULED'].includes(key)).map(([key, label]) => <span key={key} className={`faculty-calendar-legend-item faculty-calendar-legend-item--${key.toLowerCase()}`}><i />{label}</span>)}</div>
      <div className="faculty-calendar-weekdays">{DAY_NAMES.map((day) => <span key={day}>{day}</span>)}</div><div className="faculty-calendar-grid">{days.map((date, index) => date ? <div key={isoDate(date)} className={`faculty-calendar-day ${isoDate(date) === today ? 'is-today' : ''}`}><button type="button" className="faculty-calendar-date" onClick={() => setSelected({ date: isoDate(date), events: eventsByDate[isoDate(date)] || [] })}>{date.getDate()}</button><div>{(eventsByDate[isoDate(date)] || []).map((event, eventIndex) => <CalendarEvent key={`${event.id || event.code}-${eventIndex}`} event={event} onSelect={setSelected} />)}</div></div> : <div key={`empty-${index}`} className="faculty-calendar-day is-empty" />)}</div>
      {loading ? <div className="faculty-calendar-loading">Loading schedule…</div> : null}
    </div>
    {selected ? <div className="faculty-calendar-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><aside className="faculty-calendar-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button type="button" className="faculty-calendar-modal-close" onClick={() => setSelected(null)}><X /></button><span className="faculty-calendar-eyebrow">DAY DETAILS</span><h2>{displayDate(selected.date)}</h2>{selected.events.length ? selected.events.map((event, index) => <article className="faculty-calendar-detail" key={index}><strong>{STATUS_LABELS[normalizeStatus(event)] || event.status || 'Calendar event'}</strong><p>{event.courseName || event.batchName || event.reason || 'No additional details'}</p>{event.batchId ? <p>Batch: {event.batchId}</p> : null}<p>{timing(event)}</p>{event.reason ? <p>Reason: {event.reason}</p> : null}{event.status ? <p>Status: {event.status}</p> : null}</article>) : <p>No scheduled class or approved leave on this date.</p>}</aside></div> : null}
  </section>
}
