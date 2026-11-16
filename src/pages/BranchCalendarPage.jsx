import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  LogIn,
  LogOut,
  X,
} from 'lucide-react'
import { getBranchCalendar } from '../services/branchCalendarService'
import '../styles/BranchCalendarPage.css'

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (value) => String(value).padStart(2, '0')
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Pending'
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
const tamilHolidayNames = [
  [/ஆங்கில.*புத்தாண்டு/, "New Year's Day"],
  [/திருவள்ளுவர்.*(நாள்|தினம்)/, 'Thiruvalluvar Day'],
  [/உழவர்.*திருநாள்/, 'Uzhavar Thirunal'],
  [/காணும்.*பொங்கல்/, 'Kaanum Pongal'],
  [/பொங்கல்/, 'Pongal'],
  [/தைப்பூச/, 'Thaipusam'],
  [/தமிழ்.*புத்தாண்டு/, 'Tamil New Year'],
  [/தெலுங்கு.*புத்தாண்டு/, 'Telugu New Year'],
  [/மகாவீர்.*ஜெயந்தி/, 'Mahavir Jayanti'],
  [/புனித.*வெள்ளி/, 'Good Friday'],
  [/மே தினம்/, 'May Day'],
  [/குடியரசு தினம்/, 'Republic Day'],
  [/சுதந்திர தினம்/, 'Independence Day'],
  [/விநாயகர்.*சதுர்த்தி/, 'Vinayaka Chaturthi'],
  [/காந்தி ஜெயந்தி/, 'Gandhi Jayanti'],
  [/ஆயுத பூஜை/, 'Ayudha Puja'],
  [/விஜயதசமி/, 'Vijayadashami'],
  [/தீபாவளி/, 'Diwali'],
  [/மிலாது நபி/, 'Milad-un-Nabi'],
  [/கிறிஸ்துமஸ்/, 'Christmas Day'],
]
const officialHolidayNamesByDate = {
  '2027-01-01': "New Year's Day",
  '2027-01-15': 'Pongal',
  '2027-01-16': 'Thiruvalluvar Day',
  '2027-01-17': 'Uzhavar Thirunal',
  '2027-01-22': 'Thai Poosam',
  '2027-01-26': 'Republic Day',
  '2027-03-10': 'Ramzan (Idu’l Fitr)',
  '2027-03-26': 'Good Friday',
  '2027-04-01': 'Annual Closing of Accounts',
  '2027-04-07': "Telugu New Year's Day",
  '2027-04-14': "Tamil New Year's Day / Dr. B. R. Ambedkar's Birthday",
  '2027-04-19': 'Mahaveer Jayanthi',
  '2027-05-01': 'May Day',
  '2027-05-17': 'Bakrid (Idul Zuha)',
  '2027-06-15': 'Muharram (Yaom-E-Shahadath)',
  '2027-08-15': 'Independence Day / Milad-un-Nabi',
  '2027-08-25': 'Krishna Jayanthi',
  '2027-09-04': 'Vinayakar Chathurthi',
  '2027-10-02': 'Gandhi Jayanthi',
  '2027-10-08': 'Ayutha Pooja',
  '2027-10-09': 'Vijaya Dasami',
  '2027-10-28': 'Deepavali',
  '2027-12-25': 'Christmas',
}
function englishHolidayName(value, date) {
  if (officialHolidayNamesByDate[date]) return officialHolidayNamesByDate[date]
  const source = String(value || '').trim()
  const match = tamilHolidayNames.find(([pattern]) => pattern.test(source))
  if (match) return match[1]
  if (/[஀-௿]/.test(source)) return 'Holiday'
  return source || 'Holiday'
}

function yearRange(year) { return { from: `${year}-01-01`, to: `${year}-12-31` } }

function getMonthDays(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  return [...Array(first.getDay()).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => new Date(year, month, index + 1))]
}

export default function BranchCalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState('')
  const [payload, setPayload] = useState({ holidays: [], instituteLeaves: [], attendance: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getBranchCalendar(yearRange(year)).then((data) => {
      if (active) { setPayload(data || {}); setLoading(false) }
    }).catch((err) => {
      if (active) { setError(err?.body?.message || err?.message || 'Unable to load calendar.'); setLoading(false) }
    })
    return () => { active = false }
  }, [year])

  const events = useMemo(() => {
    const rows = []
    ;(payload.holidays || []).forEach((item) => { const holidayName = englishHolidayName(item.name, item.date); rows.push({ ...item, eventType: item.type, label: holidayName, color: 'purple', name: holidayName, description: item.type === 'GOVERNMENT_HOLIDAY' ? 'Holiday declared by Government.' : 'Branch general holiday.' }) })
    ;(payload.instituteLeaves || []).forEach((item) => rows.push({ ...item, eventType: 'INSTITUTE_LEAVE', label: 'Institute Leave', color: 'orange', name: item.name, description: 'Institute-wide leave declared for this branch.' }))
    ;(payload.attendance || []).forEach((item) => {
      if (item.firstLoginAt) rows.push({ ...item, id: `${item.date}-login`, date: item.date, eventType: 'LOGIN', label: 'Login Time', color: 'blue', name: `Login · ${formatTime(item.firstLoginAt)}`, description: 'Branch Admin login record.' })
      // A website logout is resumable and must not appear as final Work Log logout.
      if (item.finalLogoutAt) rows.push({ ...item, id: `${item.date}-logout`, date: item.date, eventType: 'LOGOUT', label: 'Logout Time', color: 'green', name: `Logout · ${formatTime(item.finalLogoutAt)}`, description: 'Branch Admin logout record.' })
    })
    return rows
  }, [payload])

  const eventMap = useMemo(() => {
    const map = new Map()
    events.forEach((event) => { const list = map.get(event.date) || []; list.push(event); map.set(event.date, list) })
    return map
  }, [events])

  const days = useMemo(() => getMonthDays(year, month), [month, year])

  const selectedEvents = eventMap.get(selectedDate) || []
  const monthPrefix = `${year}-${pad(month + 1)}`
  const summary = {
    holidays: (payload.holidays || []).filter((event) => event.date?.startsWith(monthPrefix)).length,
    leaves: (payload.instituteLeaves || []).filter((event) => event.date?.startsWith(monthPrefix)).length,
    logins: (payload.attendance || []).filter((event) => event.date?.startsWith(monthPrefix) && event.firstLoginAt).length,
    logouts: (payload.attendance || []).filter((event) => event.date?.startsWith(monthPrefix) && event.finalLogoutAt).length,
  }

  const changeMonth = (amount) => {
    const next = month + amount
    if (next < 0) { setYear((value) => value - 1); setMonth(11) }
    else if (next > 11) { setYear((value) => value + 1); setMonth(0) }
    else setMonth(next)
  }
  const setCalendarDate = (date) => { const key = dateKey(date); setSelectedDate(key); setYear(date.getFullYear()); setMonth(date.getMonth()) }

  const renderDay = (date, index) => {
    if (!date) return <div className="branch-calendar-day is-empty" key={`empty-${index}`} />
    const key = dateKey(date)
    const dayEvents = eventMap.get(key) || []
    const isToday = key === dateKey(now)
    const isSelected = key === selectedDate
    return <button type="button" className={`branch-calendar-day ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`} key={key} onClick={() => setCalendarDate(date)}>
      <div className="branch-calendar-day-head"><b>{date.getDate()}</b>{dayEvents.length ? <span className={`branch-calendar-day-dot is-${dayEvents[0].color}`} /> : null}</div>
      {dayEvents.slice(0, 4).map((event) => <span className={`calendar-pill is-${event.color}`} key={`${event.id}-${event.eventType}`}>{event.name}</span>)}
      {dayEvents.length > 4 ? <span className="branch-calendar-more">+{dayEvents.length - 4} more</span> : null}
      {dayEvents.length ? <span className="branch-calendar-view-details"><Eye size={12} /> View Details</span> : null}
    </button>
  }

  return <section className="branch-calendar-page">
    <header className="branch-calendar-heading"><div><p>CALENDAR MANAGEMENT</p><h1><CalendarDays size={22} /> Branch Calendar</h1><span>View holidays, institute leaves, and daily login/logout records.</span></div></header>
    <div className="branch-calendar-summary-grid">
      <article className="calendar-summary-card is-purple"><span className="calendar-summary-icon-wrap"><CalendarDays size={19} strokeWidth={2.2} /></span><div><span>This Month</span><strong>{String(summary.holidays).padStart(2, '0')}</strong><small>General Holidays</small></div></article>
      <article className="calendar-summary-card is-orange"><span className="calendar-summary-icon-wrap"><Building2 size={19} strokeWidth={2.2} /></span><div><span>This Month</span><strong>{String(summary.leaves).padStart(2, '0')}</strong><small>Institute Leaves</small></div></article>
      <article className="calendar-summary-card is-blue"><span className="calendar-summary-icon-wrap"><LogIn size={19} strokeWidth={2.2} /></span><div><span>Attendance</span><strong>{summary.logins}</strong><small>Login Records</small></div></article>
      <article className="calendar-summary-card is-green"><span className="calendar-summary-icon-wrap"><LogOut size={19} strokeWidth={2.2} /></span><div><span>Attendance</span><strong>{summary.logouts}</strong><small>Logout Records</small></div></article>
    </div>

    <div className={`branch-calendar-workspace ${selectedEvents.length ? 'has-details' : ''}`}>
      <section className="branch-calendar-card">
        <header className="branch-calendar-title-row"><h1><CalendarDays size={22} /> {monthNames[month]} {year}</h1><div className="branch-calendar-header-actions"><button type="button" className="calendar-nav-button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button><select className="calendar-month-select" aria-label="Month selector" value={`${year}-${month}`} onChange={(event) => { const [nextYear, nextMonth] = event.target.value.split('-').map(Number); setYear(nextYear); setMonth(nextMonth) }}>{Array.from({ length: 101 }, (_, index) => 2000 + index).flatMap((value) => monthNames.map((name, monthIndex) => <option key={`${value}-${monthIndex}`} value={`${value}-${monthIndex}`}>{name} {value}</option>))}</select><button type="button" className="calendar-nav-button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button></div></header>
        <div className="branch-calendar-legend"><span><i className="is-purple" /> General Holiday</span><span><i className="is-orange" /> Institute Leave</span><span><i className="is-blue" /> Login Time</span><span><i className="is-green" /> Logout Time</span></div>
        {error ? <p className="branch-calendar-error">{error}</p> : null}
        <div className="branch-calendar-grid">{weekdays.map((day) => <div className="branch-calendar-weekday" key={day}>{day.toUpperCase()}</div>)}{days.map(renderDay)}</div>
        {loading ? <div className="branch-calendar-loading">Loading calendar...</div> : null}
      </section>

      {selectedEvents.length ? <><div className="branch-calendar-drawer-backdrop" aria-hidden="true" /><aside className="branch-calendar-details-panel"><header><span><CalendarDays size={18} /> Date Details</span><button type="button" aria-label="Close details" onClick={() => setSelectedDate('')}><X size={19} /></button></header><div className="calendar-details-body"><h2>{selectedDate ? formatDate(selectedDate) : ''}</h2>{selectedEvents.map((event) => <article className={`calendar-detail-event is-${event.color}`} key={`${event.id}-${event.eventType}`}><strong><span className={`calendar-detail-dot is-${event.color}`} />{event.label}</strong><div className="calendar-detail-section"><span>Event Name</span><b>{event.name}</b></div></article>)}</div></aside></> : null}
    </div>
  </section>
}
