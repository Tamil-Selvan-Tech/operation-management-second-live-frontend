import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react'
import { getBranchCalendar } from '../services/branchCalendarService'
import '../styles/BranchCalendarPage.css'

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (value) => String(value).padStart(2, '0')
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Pending'

function yearRange(year) { return { from: `${year}-01-01`, to: `${year}-12-31` } }

export default function BranchCalendarPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(new Date().getMonth())
  const [payload, setPayload] = useState({ holidays: [], instituteLeaves: [], attendance: [] })
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true); setError('')
    getBranchCalendar(yearRange(year)).then(setPayload).catch((err) => setError(err?.body?.message || err?.message || 'Unable to load calendar.')).finally(() => setLoading(false))
  }
  useEffect(() => {
    let active = true
    getBranchCalendar(yearRange(year)).then((data) => { if (active) { setPayload(data); setLoading(false) } }).catch((err) => { if (active) { setError(err?.body?.message || err?.message || 'Unable to load calendar.'); setLoading(false) } })
    return () => { active = false }
  }, [year])

  const eventMap = useMemo(() => {
    const map = new Map()
    const add = (date, event) => { if (!date) return; const rows = map.get(date) || []; rows.push(event); map.set(date, rows) }
    ;(payload.holidays || []).forEach((item) => add(item.date, item))
    ;(payload.instituteLeaves || []).forEach((item) => add(item.date, item))
    ;(payload.attendance || []).forEach((item) => add(item.date, { ...item, type: 'ATTENDANCE' }))
    return map
  }, [payload])
  const days = useMemo(() => {
    const first = new Date(year, month, 1); const last = new Date(year, month + 1, 0)
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: last.getDate() }, (_, i) => new Date(year, month, i + 1))]
  }, [month, year])
  const selectedEvents = eventMap.get(selectedDate) || []
  const selectedHoliday = selectedEvents.find((item) => item.type === 'GENERAL_HOLIDAY' || item.type === 'GOVERNMENT_HOLIDAY')
  const selectedLeave = selectedEvents.find((item) => item.type === 'INSTITUTE_LEAVE')
  const selectedAttendance = selectedEvents.find((item) => item.type === 'ATTENDANCE')
  const changeMonth = (amount) => { const next = month + amount; if (next < 0) { setYear((value) => value - 1); setMonth(11) } else if (next > 11) { setYear((value) => value + 1); setMonth(0) } else setMonth(next) }

  return <section className="branch-calendar-page">
    <section className="branch-calendar-card">
      <header className="branch-calendar-topbar"><h1>{monthNames[month]} {year}</h1><div className="branch-calendar-month-nav"><button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button><select aria-label="Calendar year" value={year} onChange={(event) => { setLoading(true); setMonth(0); setYear(Number(event.target.value)) }}>{Array.from({ length: 101 }, (_, index) => 2000 + index).map((value) => <option key={value} value={value}>{monthNames[month]} {value}</option>)}</select><button type="button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button></div></header>
      <div className="branch-calendar-legend"><span><i className="is-scheduled" /> Scheduled</span><span><i className="is-no-class" /> No Class</span><span><i className="is-present" /> Present</span><span><i className="is-absent" /> Absent</span><span><i className="is-general" /> General Holiday</span><span><i className="is-leave" /> Institute Leave</span><span><i className="is-start" /> Login Time</span><span><i className="is-end" /> Logout Time</span></div>
      {error ? <p className="branch-calendar-error">{error}</p> : null}
      <div className="branch-calendar-grid">{weekdays.map((day) => <div className="branch-calendar-weekday" key={day}>{day.toUpperCase()}</div>)}{days.map((date, index) => { if (!date) return <div className="branch-calendar-day is-empty" key={`empty-${index}`} />; const key = dateKey(date); const events = eventMap.get(key) || []; const holiday = events.find((item) => item.type.includes('HOLIDAY')); const leave = events.find((item) => item.type === 'INSTITUTE_LEAVE'); const attendance = events.find((item) => item.type === 'ATTENDANCE'); const hasEvent = holiday || leave || attendance; return <button type="button" className={`branch-calendar-day ${selectedDate === key ? 'is-selected' : ''}`} key={key} onClick={() => setSelectedDate(key)}><div className="branch-calendar-day-head"><b>{date.getDate()}</b><i className={hasEvent ? (attendance ? 'is-present' : leave ? 'is-leave' : 'is-general') : 'is-no-class'} /></div>{holiday ? <span className={`calendar-pill ${holiday.type === 'GOVERNMENT_HOLIDAY' ? 'is-government' : 'is-general'}`}>{holiday.type === 'GOVERNMENT_HOLIDAY' ? 'Government Holiday' : 'General Holiday'}</span> : null}{leave ? <span className="calendar-pill is-leave">Institute Leave</span> : null}{attendance ? <><span className="calendar-pill is-present">Present</span><span className="calendar-pill is-start">Login {formatTime(attendance.firstLoginAt)}</span><span className="calendar-pill is-end">Logout {formatTime(attendance.finalLogoutAt)}</span></> : null}{!hasEvent ? <><span className="calendar-pill is-no-class">No Class</span><small>No class scheduled</small></> : <span className="calendar-view-details">View Details</span>}</button> })}</div>
      <div className="branch-calendar-footer"><label>Year<select value={year} onChange={(event) => { setLoading(true); setMonth(0); setYear(Number(event.target.value)) }}>{Array.from({ length: 101 }, (_, index) => 2000 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><button type="button" className="branch-calendar-refresh" onClick={load} disabled={loading}><RefreshCcw size={15} /> {loading ? 'Loading...' : 'Refresh'}</button><div className="branch-calendar-selected-detail">{selectedHoliday ? <><strong>{selectedDate} · {selectedHoliday.type === 'GOVERNMENT_HOLIDAY' ? 'Government Holiday' : 'General Holiday'}</strong><span>{selectedHoliday.name}</span></> : selectedLeave ? <><strong>{selectedDate} · Institute Leave</strong><span>{selectedLeave.name}</span></> : selectedAttendance ? <><strong>{selectedDate} · Daily Work Log</strong><span>Login {formatTime(selectedAttendance.firstLoginAt)} · Logout {formatTime(selectedAttendance.finalLogoutAt)} · {selectedAttendance.sessions?.length || 0} session(s)</span></> : <span>Select a date to view details.</span>}</div></div>
    </section>
  </section>
}
