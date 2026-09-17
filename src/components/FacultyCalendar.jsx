import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CalendarOff, CheckCircle2, ChevronLeft, ChevronRight, Flag, RefreshCw, Sparkles, Timer, X } from 'lucide-react'
import { getFacultyCalendar, getFacultyLeaveRequests } from '../services/facultyCalendarService'
import { getFacultyAttendanceStatus } from '../services/attendanceService'
import { FACULTY_ATTENDANCE_SYNC_EVENT } from '../lib/facultyAttendanceStore'
import { statusStyle } from '../config/facultyCalendarStatusColors'
import '../styles/FacultyCalendar.css'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_LABELS = {
  CLASS: 'Class Day', SCHEDULED: 'Class Day', INSTITUTE_LEAVE: 'Class Cancelled',
  HOLIDAY: 'General Holiday', FACULTY_WEEKLY_OFF: 'Week Off', NO_CLASS: 'No Class Day',
  PRESENT: 'Present', ABSENT: 'Absent',
  LEAVE: 'Leave', HALF_DAY: 'Half Day Leave', PERMISSION: 'Permission', REASSIGNED: 'Reassigned Class', COMBINED: 'Combined Class', RESCHEDULED: 'Rescheduled', RESCHEDULED_ORIGINAL: 'Rescheduled',
}

function isoDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
function hasLoginOnDate(status, dateKey) {
  const loginAt = status?.firstLoginAt || status?.loginAt || status?.currentSession?.loginAt
  const loginDate = loginAt ? new Date(loginAt) : null
  if (!loginDate || Number.isNaN(loginDate.getTime()) || isoDate(loginDate) !== dateKey) return false

  const recordedDate = String(status?.attendanceDate || status?.date || '').slice(0, 10)
  return !recordedDate || recordedDate === dateKey
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
  if (code === 'FACULTY_PRESENT') return 'PRESENT'
  if (code === 'FACULTY_ABSENT') return 'ABSENT'
  return code === 'FACULTY_LEAVE' ? (String(event?.durationType || '').toUpperCase() === 'HALF_DAY' ? 'HALF_DAY' : 'LEAVE') : code
}
function timing(event) {
  const start = event?.startTime || event?.fromTime || ''
  const end = event?.endTime || event?.toTime || ''
  return start && end ? `${start} – ${end}` : event?.batchTiming || 'Scheduled time'
}

function clockMinutes(value) {
  const raw = String(value || '').trim()
  const numeric = Number(raw)
  if (/^\d+$/.test(raw) && Number.isFinite(numeric) && numeric <= 1439) return numeric
  const match = raw.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return null
  let hour = Number(match[1]); const minute = Number(match[2]); const period = match[3]?.toUpperCase()
  if (period === 'PM' && hour < 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return hour * 60 + minute
}

function halfDayFinished(event, date) {
  const end = clockMinutes(event?.halfDayEnd)
  if (end === null) return false
  const today = isoDate(new Date())
  if (date < today) return true
  if (date > today) return false
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() >= end
}

function SummaryCard({ icon: Icon, label, value, note, tone = 'blue' }) {
  return <article className={`faculty-calendar-summary-card faculty-calendar-summary-card--${tone}`}>
    <span className="faculty-calendar-summary-icon"><Icon size={20} strokeWidth={2.2} /></span>
    <div><span>{label}</span><strong>{value ?? '—'}</strong>{note ? <small>{note}</small> : null}</div>
  </article>
}

function DayStatus({ status, detail, onSelect }) {
  return <button type="button" style={statusStyle(status)} className={`faculty-calendar-event faculty-calendar-event--${status.toLowerCase()}`} onClick={onSelect}>
    <span>{STATUS_LABELS[status] || status}</span>
    {detail ? <small>{detail}</small> : null}
  </button>
}

function holidayName(event) {
  return String(event?.holidayName || event?.name || (normalizeStatus(event) === 'HOLIDAY' ? event?.reason : '') || '').trim()
}

function CellBatchPreview({ batch, date, onSelect }) {
  const start = String(batch.courseStartDate || batch.startDate || '').slice(0, 10)
  const isStartDate = date === start
  const dateLabel = isStartDate ? 'Course Start' : 'Course End'
  return <button type="button" className="faculty-calendar-cell-batch" onClick={onSelect}>
    <strong>{batch.batchName || batch.batchId || 'Batch'}</strong>
    <small>{dateLabel}</small>
  </button>
}

export function FacultyCalendar({ faculty, facultyProfile }) {
  const [calendar, setCalendar] = useState(null)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [month, setMonth] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workLogStatus, setWorkLogStatus] = useState(null)
  const facultyId = faculty?.id || facultyProfile?.facultyId || ''

  const permanentBatches = useMemo(() => (facultyProfile?.batchEntries || []).filter((batch) => String(batch?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'), [facultyProfile])
  const range = useMemo(() => {
    const starts = permanentBatches.map((b) => b.courseStartDate || b.startDate).filter(Boolean).sort()
    const ends = permanentBatches.map((b) => b.courseEndDate || b.endDate).filter(Boolean).sort()
    const today = isoDate(new Date())
    const fallbackEnd = new Date()
    fallbackEnd.setFullYear(fallbackEnd.getFullYear() + 1)
    return { start: starts[0] || today, end: ends.at(-1) || isoDate(fallbackEnd) }
  }, [permanentBatches])
  const batches = useMemo(() => {
    const source = [...permanentBatches, ...(Array.isArray(calendar?.batches) ? calendar.batches : [])]
    const merged = new Map()
    source.forEach((batch) => {
      const key = String(batch?.id || batch?.batchId || batch?.batchName || '')
      const previous = merged.get(key) || {}
      merged.set(key, {
        ...previous,
        ...batch,
        studentCount: Number(batch?.studentCount || batch?.studentsCount || 0) > 0
          ? Number(batch.studentCount || batch.studentsCount)
          : Number(previous.studentCount || previous.studentsCount || 0),
      })
    })
    return [...merged.values()]
  }, [calendar, permanentBatches])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const todayDate = isoDate(new Date())
      const attendanceStart = range.start && range.start > todayDate ? todayDate : range.start
      const [nextCalendar, requests, nextWorkLogStatus] = await Promise.all([
        getFacultyCalendar({ startDate: attendanceStart, endDate: range.end }),
        getFacultyLeaveRequests(),
        getFacultyAttendanceStatus({ facultyId }),
      ])
      setCalendar(nextCalendar || { events: [] })
      setLeaveRequests(requests)
      setWorkLogStatus(nextWorkLogStatus || null)
      const initial = parseDate(nextCalendar?.events?.[0]?.date || range.start) || new Date()
      setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1))
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load your calendar.')
    } finally { setLoading(false) }
  }, [facultyId, range.end, range.start])
  useEffect(() => {
    if (!facultyProfile) return undefined
    const timer = window.setTimeout(() => { load() }, 0)
    return () => window.clearTimeout(timer)
  }, [facultyProfile, load])

  useEffect(() => {
    const handleAttendanceChange = () => { void load() }
    window.addEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, handleAttendanceChange)
    return () => window.removeEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, handleAttendanceChange)
  }, [load])

  const events = useMemo(() => {
    const source = (Array.isArray(calendar?.events) ? calendar.events : [])
      .filter((event) => normalizeStatus(event) !== 'PRESENT')
    const today = isoDate(new Date())
    const workLogPresent = hasLoginOnDate(workLogStatus, today)
    const workLogEvent = workLogPresent
      ? [{ date: today, code: 'PRESENT', status: 'Present', loginAt: workLogStatus?.firstLoginAt || workLogStatus?.loginAt || workLogStatus?.currentSession?.loginAt, facultyId }]
      : []
    const approved = leaveRequests.filter((item) => String(item?.status || '').toUpperCase() === 'APPROVED')
    const leaveEvents = approved.flatMap((item) => {
      const from = parseDate(item.fromDate); const to = parseDate(item.toDate || item.fromDate)
      if (!from || !to) return []
      const rows = []; for (let cursor = from; cursor <= to; cursor.setDate(cursor.getDate() + 1)) rows.push({ ...item, date: isoDate(cursor), code: item.durationType === 'PERMISSION' ? 'PERMISSION' : item.durationType === 'HALF_DAY' ? 'HALF_DAY' : 'LEAVE', status: 'Approved' })
      return rows
    })
    const existingLeaveKeys = new Set(source.map((event) => `${event?.id || ''}:${event?.date || ''}:${normalizeStatus(event)}`))
    const result = [...source, ...workLogEvent, ...leaveEvents.filter((event) => !existingLeaveKeys.has(`${event?.id || ''}:${event?.date || ''}:${normalizeStatus(event)}`))]
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
    return result.map((event) => normalizeStatus(event) === 'FACULTY_WEEKLY_OFF'
      ? { ...event, reason: '' }
      : normalizeStatus(event) === 'HOLIDAY' && !event.name && !event.holidayName
        ? { ...event, name: holidayName(event) }
        : event)
  }, [batches, calendar, facultyId, leaveRequests, range.end, range.start, workLogStatus])

  const days = useMemo(() => {
    if (!month) return []
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))]
  }, [month])
  const eventsByDate = useMemo(() => {
    const grouped = events.reduce((map, event) => { const key = String(event.date || '').slice(0, 10); const status = normalizeStatus(event); if (status === 'FACULTY_WEEKLY_OFF' && map[key]?.some((item) => normalizeStatus(item) === status)) return map; (map[key] ||= []).push(event); return map }, {})
    Object.keys(grouped).forEach((date) => {
      const dateEvents = grouped[date]
      const hasClass = dateEvents.some((event) => ['CLASS', 'SCHEDULED', 'COMPLETED', 'PRESENT', 'REASSIGNED', 'COMBINED', 'RESCHEDULED', 'RESCHEDULED_ORIGINAL'].includes(normalizeStatus(event)))
      const hasHalfDay = dateEvents.some((event) => normalizeStatus(event) === 'HALF_DAY')
      if (hasClass || hasHalfDay) {
        grouped[date] = dateEvents.filter((event) => normalizeStatus(event) !== 'NO_CLASS' && (!hasHalfDay || normalizeStatus(event) !== 'LEAVE'))
      }
    })
    return grouped
  }, [events])
  const batchLookup = useMemo(() => new Map(batches.map((batch) => [String(batch.id || batch.batchId || '').trim(), batch])), [batches])
  const getBatchForEvent = (event) => {
    const eventRecordId = String(event?.batchRecordId || '').trim()
    const eventBatchId = String(event?.batchId || '').trim().toLowerCase()
    const eventBatchName = String(event?.batchName || '').trim().toLowerCase()
    return batchLookup.get(eventRecordId)
      || batches.find((batch) => String(batch?.batchId || '').trim().toLowerCase() === eventBatchId)
      || batches.find((batch) => String(batch?.batchName || '').trim().toLowerCase() === eventBatchName)
      || {}
  }
  const statusesByDate = useMemo(() => Object.fromEntries(Object.entries(eventsByDate).map(([date, dateEvents]) => {
    const rawStatuses = Array.from(new Set(dateEvents.map(normalizeStatus)))
    const hasHalfDay = rawStatuses.includes('HALF_DAY')
    if (!hasHalfDay) return [date, rawStatuses]
    const leaveCompleted = dateEvents.some((event) => normalizeStatus(event) === 'HALF_DAY' && halfDayFinished(event, date))
    const statuses = rawStatuses.filter((status) => status !== 'NO_CLASS' && status !== 'LEAVE' && (!leaveCompleted || status !== 'HALF_DAY'))
    if (leaveCompleted && !statuses.some((status) => ['CLASS', 'SCHEDULED', 'COMPLETED', 'PRESENT'].includes(status))) statuses.push('CLASS')
    return [date, statuses]
  })), [eventsByDate])
  const batchesByDate = useMemo(() => Object.fromEntries(Object.keys(eventsByDate).map((date) => {
    const eventBatches = eventsByDate[date]
      .filter((event) => event.batchRecordId || event.batchId)
      .map((event) => batchLookup.get(String(event.batchRecordId || event.batchId).trim()) || event)
    const fallbackBatches = batches.filter((batch) => {
      const start = String(batch.courseStartDate || batch.startDate || '').slice(0, 10)
      const end = String(batch.courseEndDate || batch.endDate || '').slice(0, 10)
      return start && end && date >= start && date <= end
    })
    const unique = new Map()
    ;[...eventBatches, ...fallbackBatches].forEach((batch) => unique.set(String(batch.id || batch.batchId || batch.batchName || ''), batch))
    return [date, [...unique.values()]]
  })), [batchLookup, batches, eventsByDate])
  const boundaryBatchesByDate = useMemo(() => Object.fromEntries(Object.entries(batchesByDate).map(([date, dateBatches]) => [
    date,
    [...new Map(dateBatches.filter((batch) => {
      const start = String(batch.courseStartDate || batch.startDate || '').slice(0, 10)
      const end = String(batch.courseEndDate || batch.endDate || '').slice(0, 10)
      return date === start || date === end
    }).map((batch) => [String(batch.batchName || batch.batchId || batch.id || '').trim().toLowerCase(), batch])).values()],
  ])), [batchesByDate])
  const courses = new Set(batches.map((batch) => batch.courseName || batch.courseId).filter(Boolean))
  const today = isoDate(new Date())
  const calendarMonths = useMemo(() => {
    const start = parseDate(range.start); const end = parseDate(range.end)
    if (!start || !end) return []
    const months = []; const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) { months.push(new Date(cursor)); cursor.setMonth(cursor.getMonth() + 1) }
    return months
  }, [range.end, range.start])
  const classCount = events.filter((event) => ['CLASS', 'SCHEDULED', 'COMPLETED', 'REASSIGNED', 'COMBINED', 'RESCHEDULED', 'RESCHEDULED_ORIGINAL'].includes(normalizeStatus(event))).length
  const viewedMonthKey = month ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}` : ''
  const holidayCount = new Set(events.filter((event) => normalizeStatus(event) === 'HOLIDAY' && String(event.date || '').startsWith(viewedMonthKey)).map((event) => String(event.date).slice(0, 10))).size
  const weeklyOffCount = events.filter((event) => normalizeStatus(event) === 'FACULTY_WEEKLY_OFF').length
  const hasCalendarData = Boolean(calendar && !loading && !error)
  const selectedBoundaryBatches = selected ? boundaryBatchesByDate[selected.date] || [] : []
  useEffect(() => {
    if (!selected || !selectedBoundaryBatches.length) return
    const currentKeys = new Set(selected.events.map((event) => String(event.batchName || event.batchId || '').trim().toLowerCase()).filter(Boolean))
    const missing = selectedBoundaryBatches
      .filter((batch) => !currentKeys.has(String(batch.batchName || batch.batchId || '').trim().toLowerCase()))
      .map((batch) => ({ ...batch, date: selected.date, code: 'CLASS', status: 'Class Day', batchName: batch.batchName || batch.batchId }))
    if (missing.length) setSelected((current) => ({ ...current, events: [...current.events, ...missing] }))
  }, [selected?.date, selectedBoundaryBatches])

  if (!batches.length && !loading) return <section className="faculty-calendar-page"><div className="faculty-calendar-empty"><CalendarDays size={40} /><h2>No batches assigned</h2><p>Your calendar will appear once a batch is assigned to you.</p></div></section>
  return <section className="faculty-calendar-page">
    <h1 className="faculty-calendar-page-title">Course Calendar</h1>
    <header className="faculty-calendar-header"><div><span className="faculty-calendar-eyebrow">FACULTY SCHEDULE</span><h1>My Calendar</h1><p>{faculty?.name || facultyProfile?.facultyName || 'Faculty'} · {faculty?.id || facultyProfile?.facultyId || 'Faculty ID unavailable'}</p></div><button type="button" className="faculty-calendar-refresh" onClick={load} disabled={loading}><RefreshCw size={17} /> Refresh</button></header>
    {error ? <div className="faculty-calendar-error">{error}</div> : null}
    <div className="faculty-calendar-summary-grid">
      <SummaryCard icon={CalendarDays} label="Faculty Name" value={faculty?.name || facultyProfile?.facultyName} note="Assigned faculty" />
      <SummaryCard icon={Flag} label="Calendar Start Date" value={displayDate(range.start, { day: '2-digit', month: 'short', year: 'numeric' })} note="Earliest assigned batch" tone="purple" />
      <SummaryCard icon={CheckCircle2} label="Calendar End Date" value={displayDate(range.end, { day: '2-digit', month: 'short', year: 'numeric' })} note="Latest assigned batch" tone="green" />
      <SummaryCard icon={Sparkles} label="Assigned Courses" value={hasCalendarData ? courses.size : null} note={hasCalendarData ? `${classCount} scheduled events` : 'Loading schedule…'} />
      <SummaryCard icon={CheckCircle2} label="Assigned Batches" value={hasCalendarData ? batches.length : null} note="Active teaching batches" tone="green" />
      <SummaryCard icon={Timer} label="General Holidays" value={hasCalendarData ? holidayCount : null} note="Selected month" tone="red" />
      <SummaryCard icon={CalendarOff} label="Weekly Off Days" value={hasCalendarData ? weeklyOffCount : null} note={batches.map((batch) => batch.weeklyOffDay).filter(Boolean).join(', ') || 'No weekly off configured'} tone="red" />
    </div>
    <div className="faculty-calendar-card"><div className="faculty-calendar-panel-head"><div><span className="faculty-calendar-eyebrow">FACULTY CALENDAR</span><h2>{month?.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</h2><p>Use the arrows or month tabs to browse your complete teaching schedule.</p></div><div className="faculty-calendar-navigation"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} disabled={!calendarMonths.length || month <= calendarMonths[0]}><ChevronLeft /></button><div><strong>{month?.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</strong><span>{Math.max(1, calendarMonths.findIndex((item) => item.getFullYear() === month?.getFullYear() && item.getMonth() === month?.getMonth()) + 1)} / {calendarMonths.length || 1}</span></div><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} disabled={!calendarMonths.length || month >= calendarMonths.at(-1)}><ChevronRight /></button></div></div>
      <div className="faculty-calendar-month-strip">{calendarMonths.map((item) => <button key={item.toISOString()} type="button" className={item.getFullYear() === month?.getFullYear() && item.getMonth() === month?.getMonth() ? 'is-active' : ''} onClick={() => setMonth(item)}>{item.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</button>)}</div>
      <div className="faculty-calendar-legend">{[['CLASS', 'Class Day'], ['NO_CLASS', 'No Class'], ['FACULTY_WEEKLY_OFF', 'Week Off'], ['HOLIDAY', 'General Holiday'], ['PRESENT', 'Present'], ['ABSENT', 'Absent'], ['INSTITUTE_LEAVE', 'Class Cancel'], ['LEAVE', 'Leave'], ['HALF_DAY', 'Half Day Leave'], ['PERMISSION', 'Permission'], ['REASSIGNED', 'Reassigned Class'], ['COMBINED', 'Combined Class'], ['RESCHEDULED', 'Rescheduled']].map(([key, label]) => <span key={key} style={statusStyle(key)} className={`faculty-calendar-legend-item faculty-calendar-legend-item--${key.toLowerCase()}`}><i />{label}</span>)}</div>
      <div className="faculty-calendar-weekdays">{DAY_NAMES.map((day) => <span key={day}>{day}</span>)}</div><div className="faculty-calendar-grid">{days.map((date, index) => date ? <div key={isoDate(date)} className={`faculty-calendar-day ${isoDate(date) === today ? 'is-today' : ''}`}><button type="button" className="faculty-calendar-date" onClick={() => setSelected({ date: isoDate(date), events: eventsByDate[isoDate(date)] || [] })}><b>{date.getDate()}</b><em>{DAY_NAMES[date.getDay()]}</em></button><div>{(statusesByDate[isoDate(date)] || []).map((status) => { const statusEvent = (eventsByDate[isoDate(date)] || []).find((event) => normalizeStatus(event) === status); return <DayStatus key={status} status={status} detail={status === 'HOLIDAY' ? holidayName(statusEvent) : status === 'PRESENT' && statusEvent?.loginAt ? `Login: ${new Date(statusEvent.loginAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''} onSelect={() => setSelected({ date: isoDate(date), events: eventsByDate[isoDate(date)] || [] })} /> })}</div><div className="faculty-calendar-cell-batches">{(boundaryBatchesByDate[isoDate(date)] || []).slice(0, 3).map((batch, batchIndex) => <CellBatchPreview key={batch.id || batch.batchId || batchIndex} batch={batch} date={isoDate(date)} onSelect={() => setSelected({ date: isoDate(date), events: eventsByDate[isoDate(date)] || [] })} />)}{(boundaryBatchesByDate[isoDate(date)] || []).length > 3 ? <button type="button" className="faculty-calendar-more" onClick={() => setSelected({ date: isoDate(date), events: eventsByDate[isoDate(date)] || [] })}>+{boundaryBatchesByDate[isoDate(date)].length - 3} more</button> : null}</div><button type="button" className="faculty-calendar-day-open" onClick={() => setSelected({ date: isoDate(date), events: eventsByDate[isoDate(date)] || [] })}>View details</button></div> : <div key={`empty-${index}`} className="faculty-calendar-day is-empty" />)}</div>
      {loading ? <div className="faculty-calendar-loading">Loading schedule…</div> : null}
    </div>
    {selected ? <div className="faculty-calendar-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><aside className="faculty-calendar-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button type="button" className="faculty-calendar-modal-close" onClick={() => setSelected(null)}><X /></button><span className="faculty-calendar-eyebrow">VIEW DETAILS</span><h2>{displayDate(selected.date)}</h2><div className="faculty-calendar-drawer-status">{(statusesByDate[selected.date] || ['NO_CLASS']).map((status) => <span key={status} className={`faculty-calendar-drawer-pill faculty-calendar-drawer-pill--${status.toLowerCase()}`}>{STATUS_LABELS[status] || status}</span>)}</div>{selected.events.some((event) => ['CLASS', 'SCHEDULED', 'COMPLETED', 'REASSIGNED', 'COMBINED', 'RESCHEDULED', 'RESCHEDULED_ORIGINAL'].includes(normalizeStatus(event))) ? <><h3 className="faculty-calendar-drawer-section-title">Batch Details</h3><div className="faculty-calendar-batch-grid">{selected.events.filter((event) => ['CLASS', 'SCHEDULED', 'COMPLETED', 'REASSIGNED', 'COMBINED', 'RESCHEDULED', 'RESCHEDULED_ORIGINAL'].includes(normalizeStatus(event))).map((event, index) => { const batch = getBatchForEvent(event); return <article className="faculty-calendar-batch-card" key={`${event.batchRecordId || event.batchId || index}-${event.startTime || ''}`}><strong>{event.courseName || batch.courseName || event.courseCode || 'Course'}</strong><h4>{event.batchName || batch.batchName || 'Batch'}</h4><dl><dt>Batch ID</dt><dd>{event.batchId || batch.batchId || '—'}</dd><dt>Time</dt><dd>{timing(event)}</dd><dt>Mode</dt><dd>{event.mode || batch.mode || '—'}</dd><dt>Type</dt><dd>{event.weekType || batch.weekType || '—'}</dd><dt>Students</dt><dd>{event.studentCount ?? batch.studentCount ?? '—'}</dd><dt>Start</dt><dd>{displayDate(event.courseStartDate || batch.courseStartDate)}</dd><dt>End</dt><dd>{displayDate(event.courseEndDate || batch.courseEndDate)}</dd><dt>Status</dt><dd>{STATUS_LABELS[normalizeStatus(event)] || event.status || '—'}</dd>{event.originalFacultyName ? <><dt>Original Faculty</dt><dd>{event.originalFacultyName}</dd></> : null}{event.replacementFacultyName || event.combinedFacultyName ? <><dt>Assigned Faculty</dt><dd>{event.replacementFacultyName || event.combinedFacultyName}</dd></> : null}{event.assignmentType ? <><dt>Assignment</dt><dd>{event.assignmentType === 'COMBINED' ? 'Combined Class' : 'Replacement/Reassignment'}</dd></> : null}</dl></article> })}</div></> : null}{selected.events.filter((event) => !['CLASS', 'SCHEDULED', 'COMPLETED', 'REASSIGNED', 'COMBINED', 'RESCHEDULED', 'RESCHEDULED_ORIGINAL'].includes(normalizeStatus(event))).map((event, index) => <article className="faculty-calendar-detail" key={`${event.id || event.code}-${index}`}><strong>{STATUS_LABELS[normalizeStatus(event)] || event.status || 'Calendar event'}</strong>{event.holidayName || event.name ? <p>Holiday: {event.holidayName || event.name}</p> : null}{['PRESENT', 'ABSENT'].includes(normalizeStatus(event)) ? <><p>Login: {event.loginAt ? new Date(event.loginAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Not logged in'}</p><p>Faculty ID: {event.facultyId || '—'}</p></> : null}{event.durationType ? <p>Duration: {event.durationType.replace('_', ' ')}</p> : null}{event.permissionStart || event.halfDayStart ? <p>From: {event.permissionStart || event.halfDayStart} · To: {event.permissionEnd || event.halfDayEnd || '—'}</p> : null}<p>Status: {event.status || '—'}</p>{event.reason ? <p>Reason: {event.reason}</p> : null}</article>)}{!selected.events.length ? <p className="faculty-calendar-drawer-empty">No classes are scheduled for this date.</p> : null}</aside></div> : null}
  </section>
}
