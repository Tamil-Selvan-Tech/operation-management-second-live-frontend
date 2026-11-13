import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Eye, Pencil, RefreshCw, X } from 'lucide-react'
import {
  getFacultyHistoricalAttendanceSession,
  getFacultyAttendanceBatches,
  getFacultyPreviousAttendance,
  updateFacultyHistoricalAttendance,
} from '../services/attendanceService'
import '../styles/FacultyPreviousAttendance.css'

const SESSION_STATUSES = new Set(['COMPLETED', 'MISSING', 'WEEK OFF', 'HOLIDAY', 'LEAVE', 'RESCHEDULED'])
const NO_ACTION_STATUSES = new Set(['WEEK OFF', 'HOLIDAY', 'LEAVE', 'RESCHEDULED'])

function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }
function monthRange(value) {
  const [year, month] = value.split('-').map(Number)
  const start = `${value}-01`
  const end = new Date(year, month, 0).toISOString().slice(0, 10)
  return { start, end }
}
function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function unwrapRows(payload) {
  const source = payload?.history || payload?.sessions || payload?.rows || payload?.data || payload
  return Array.isArray(source) ? source : []
}
function normalizeRow(row = {}) {
  const status = String(row.sessionStatus || row.attendanceStatus || row.status || 'MISSING').trim().toUpperCase().replaceAll('_', ' ')
  return {
    ...row,
    id: row.id || row.sessionId || `${row.attendanceDate || row.date}-${row.batchId || row.batchName}`,
    attendanceDate: String(row.attendanceDate || row.date || '').slice(0, 10),
    batchName: row.batchName || row.batch?.batchName || '-',
    courseName: row.courseName || row.course?.name || '-',
    batchTiming: row.batchTiming || row.timing || '-',
    originalFacultyName: row.originalFacultyName || row.originalFaculty || '-',
    handledBy: row.handledBy || row.actualFacultyName || row.facultyName || row.originalFacultyName || '-',
    sessionStatus: SESSION_STATUSES.has(status) ? status : 'MISSING',
    todayWorkStatus: row.todayWorkStatus || (row.todayWorkSubmitted ? 'SUBMITTED' : 'NOT SUBMITTED'),
  }
}

function StatusBadge({ value }) { return <span className={`faculty-previous-status faculty-previous-status--${String(value).toLowerCase().replaceAll(' ', '-')}`}>{value}</span> }
function displayStudentAttendanceStatus(student = {}) {
  const status = String(student.status || student.attendanceStatus || 'UNMARKED').trim().toUpperCase()
  return status === 'LATE' ? 'PRESENT' : status
}
function displayStudentAttendanceType(student = {}) {
  const type = String(student.attendanceType || '').trim().toUpperCase()
  if (type && type !== 'UNMARKED') return type
  const status = String(student.status || student.attendanceStatus || '').trim().toUpperCase()
  if (status === 'LATE') return 'LATE ATTENDANCE'
  if (status === 'PRESENT' || status === 'ABSENT') return 'NORMAL'
  return 'UNMARKED'
}

export function FacultyPreviousAttendance() {
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({})
  const [historyStart, setHistoryStart] = useState('')
  const [showAllHistory, setShowAllHistory] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selected, setSelected] = useState(null)
  const [editor, setEditor] = useState(null)
  const [saving, setSaving] = useState(false)
  const [studentEdit, setStudentEdit] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const range = showAllHistory && historyStart
        ? { from: historyStart, to: new Date().toISOString().slice(0, 10) }
        : monthRange(month)
      const payload = await getFacultyPreviousAttendance(range)
      setRows(unwrapRows(payload).map(normalizeRow))
      setStats(payload?.statistics || payload?.summary || {})
    } catch (requestError) {
      setRows([])
      setStats({})
      setError(requestError?.message || 'Previous attendance is not available right now.')
    } finally { setLoading(false) }
  }, [historyStart, month, showAllHistory])

  useEffect(() => {
    let active = true
    getFacultyAttendanceBatches()
      .then((payload) => {
        const batches = Array.isArray(payload) ? payload : payload?.batches || []
        const starts = batches.map((batch) => String(batch?.courseStartDate || '').slice(0, 10)).filter(Boolean).sort()
        if (active) setHistoryStart(starts[0] || '')
      })
      .catch(() => {})
    return () => { active = false }
  }, [])
  useEffect(() => { void load() }, [load])

  const filteredRows = useMemo(() => selectedDate ? rows.filter((row) => row.attendanceDate === selectedDate) : rows, [rows, selectedDate])
  const derivedStats = useMemo(() => ({
    completed: stats.completed ?? rows.filter((row) => row.sessionStatus === 'COMPLETED').length,
    missing: stats.missing ?? rows.filter((row) => row.sessionStatus === 'MISSING').length,
    nonWorking: stats.nonWorking ?? rows.filter((row) => ['WEEK OFF', 'HOLIDAY', 'LEAVE'].includes(row.sessionStatus)).length,
    todayWork: stats.todayWork ?? rows.filter((row) => String(row.todayWorkStatus).startsWith('SUBMITTED')).length,
  }), [rows, stats])

  const openSession = async (row, edit = false) => {
    if (edit) setEditor({ ...row, loading: true })
    else setSelected({ ...row, loading: true })
    try {
      const detail = await getFacultyHistoricalAttendanceSession(row.id)
      const session = { ...row, ...(detail?.session || detail || {}), loading: false }
      if (edit && !NO_ACTION_STATUSES.has(row.sessionStatus)) {
        setSelected(null)
        setEditor(session)
      } else if (!edit) setSelected(session)
    } catch (requestError) {
      const failed = { ...row, loading: false, error: requestError?.message || 'Unable to load session details.' }
      if (edit) setEditor(failed)
      else setSelected(failed)
    }
  }

  const save = async () => {
    if (!editor?.id) return
    setSaving(true)
    try {
      await updateFacultyHistoricalAttendance(editor.id, { attendance: editor.students || [], editReason: editor.editReason || 'Historical attendance correction' })
      setEditor(null); await load()
    } catch (requestError) { setEditor((current) => ({ ...current, error: requestError?.message || 'Unable to save attendance.' })) } finally { setSaving(false) }
  }

  const saveStudentEdit = async () => {
    if (!studentEdit?.studentId || !selected?.id) return
    setStudentEdit((current) => ({ ...current, saving: true, error: '' }))
    try {
      await updateFacultyHistoricalAttendance(selected.id, {
        attendance: [{ studentId: studentEdit.studentId, status: studentEdit.status }],
        editReason: 'Historical attendance correction',
      })
      const detail = await getFacultyHistoricalAttendanceSession(selected.id)
      setSelected((current) => ({ ...current, ...(detail?.session || detail || {}) }))
      setStudentEdit(null)
      await load()
    } catch (requestError) {
      setStudentEdit((current) => ({ ...current, saving: false, error: requestError?.message || 'Unable to save attendance.' }))
    }
  }

  const moveMonth = (delta) => {
    const [year, currentMonth] = month.split('-').map(Number)
    setMonth(monthKey(new Date(year, currentMonth - 1 + delta, 1))); setSelectedDate(''); setShowAllHistory(false)
  }

  return <section className="faculty-previous-attendance">
    <div className="faculty-previous-attendance-header"><div><span className="faculty-previous-eyebrow">FACULTY ATTENDANCE</span><h2>Previous Attendance</h2><p>Review month-wise batch sessions. Today Attendance remains unchanged above.</p></div><button type="button" className="faculty-previous-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'faculty-previous-spin' : ''} /> Refresh</button></div>
    <div className="faculty-previous-toolbar"><button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft /></button><label><CalendarDays size={17} /><input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setSelectedDate(''); setShowAllHistory(false) }} /></label><button type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight /></button></div>
    <div className="faculty-previous-stat-grid">{[['Completed Sessions', derivedStats.completed, 'completed'], ['Missing Sessions', derivedStats.missing, 'missing'], ['Non-working Days', derivedStats.nonWorking, 'non-working'], ['Today Work Submitted', derivedStats.todayWork, 'work']].map(([label, value, tone]) => <article key={label} className={`faculty-previous-stat faculty-previous-stat--${tone}`}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <div className="faculty-previous-calendar"><button type="button" className={showAllHistory && !selectedDate ? 'is-active' : ''} onClick={() => { setSelectedDate(''); setShowAllHistory(true) }}>All history</button><button type="button" className={!showAllHistory && !selectedDate ? 'is-active' : ''} onClick={() => { setSelectedDate(''); setShowAllHistory(false) }}>Selected month</button>{Array.from(new Set(rows.map((row) => row.attendanceDate))).sort().map((date) => <button key={date} type="button" className={selectedDate === date ? 'is-active' : ''} onClick={() => setSelectedDate(date)}>{formatDate(date)}</button>)}</div>
    {error ? <div className="faculty-previous-error" role="alert">{error}</div> : null}
    {loading ? <div className="faculty-previous-empty">Loading attendance history…</div> : !filteredRows.length ? <div className="faculty-previous-empty"><strong>No attendance sessions for this month</strong><span>Only saved database records are shown here.</span></div> : <div className="faculty-previous-table-wrap"><table className="faculty-previous-table"><thead><tr><th>Attendance Date</th><th>Batch</th><th>Course</th><th>Timing</th><th>Original Faculty</th><th>Handled By</th><th>Status</th><th>Today Work</th><th>Action</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id}><td>{formatDate(row.attendanceDate)}</td><td><strong>{row.batchName}</strong></td><td>{row.courseName}</td><td>{row.batchTiming}</td><td>{row.originalFacultyName}</td><td>{row.handledBy}</td><td><StatusBadge value={row.sessionStatus} /></td><td><StatusBadge value={row.todayWorkStatus} /></td><td><div className="faculty-previous-actions"><button type="button" onClick={() => void openSession(row)} title="View session"><Eye size={16} /> View</button>{!NO_ACTION_STATUSES.has(row.sessionStatus) ? <button type="button" onClick={() => void openSession(row, true)} title="Edit session"><Pencil size={16} /> Edit</button> : null}</div></td></tr>)}</tbody></table></div>}
    {selected ? <div className="faculty-previous-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><aside className="faculty-previous-modal faculty-previous-session-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button type="button" className="faculty-previous-modal-close" onClick={() => setSelected(null)} aria-label="Close"><X /></button><span className="faculty-previous-eyebrow">SESSION DETAILS</span><h3>{selected.batchName}</h3><p>{formatDate(selected.attendanceDate)} · {selected.courseName} · {selected.batchTiming}</p>{selected.loading ? <div className="faculty-previous-empty">Loading student attendance…</div> : selected.error ? <div className="faculty-previous-error">{selected.error}</div> : <><dl className="faculty-previous-detail-grid"><dt>Session status</dt><dd><StatusBadge value={selected.sessionStatus} /></dd><dt>Original Faculty</dt><dd>{selected.originalFacultyName}</dd><dt>Handled By</dt><dd>{selected.handledBy}</dd><dt>Today Work</dt><dd>{selected.todayWorkStatus}</dd></dl><div className="faculty-previous-student-table-wrap"><table className="faculty-previous-student-table"><thead><tr><th>S.No</th><th>Student ID</th><th>Student Name</th><th>Attendance</th><th>Attendance Type</th><th>Marked At</th><th>Action</th></tr></thead><tbody>{(selected.students || selected.attendance || []).map((student, index) => { const studentId = student.studentId || student.id || ''; const rawStatus = String(student.status || student.attendanceStatus || '').toUpperCase(); const isEditing = studentEdit?.studentId === studentId; return <tr key={studentId || index}><td>{index + 1}</td><td>{studentId || '-'}</td><td><strong>{student.studentName || student.name || '-'}</strong></td><td>{isEditing ? <select className="faculty-previous-inline-select" value={studentEdit.status} onChange={(event) => setStudentEdit((current) => ({ ...current, status: event.target.value }))}><option value="PRESENT">PRESENT</option><option value="ABSENT">ABSENT</option></select> : <StatusBadge value={displayStudentAttendanceStatus(student)} />}</td><td>{displayStudentAttendanceType(student)}</td><td>{student.markedAt ? new Date(student.markedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td><td>{isEditing ? <div className="faculty-previous-inline-actions"><button type="button" onClick={() => void saveStudentEdit()} disabled={studentEdit.saving}>{studentEdit.saving ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => setStudentEdit(null)}>Cancel</button></div> : <button type="button" className="faculty-previous-row-edit" onClick={() => setStudentEdit({ studentId, status: rawStatus === 'ABSENT' ? 'ABSENT' : 'PRESENT', saving: false, error: '' })}><Pencil size={14} /> Edit</button>}</td></tr> })}</tbody></table>{studentEdit?.error ? <div className="faculty-previous-error">{studentEdit.error}</div> : null}</div></>}</aside></div> : null}
    {editor ? <div className="faculty-previous-modal-backdrop" role="presentation"><aside className="faculty-previous-modal" role="dialog" aria-modal="true"><button type="button" className="faculty-previous-modal-close" onClick={() => setEditor(null)} aria-label="Close"><X /></button><span className="faculty-previous-eyebrow">HISTORICAL CORRECTION</span><h3>Edit {editor.batchName}</h3><p>Original attendance date: {formatDate(editor.attendanceDate)}</p><div className="faculty-previous-students">{(editor.students || editor.attendance || []).map((student, index) => <label key={student.studentId || student.id || index} className="faculty-previous-student"><span>{student.studentName || student.name || student.studentId}</span><select value={student.status || student.attendanceStatus || 'UNMARKED'} onChange={(event) => setEditor((current) => ({ ...current, students: (current.students || current.attendance || []).map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value } : item) }))}><option>PRESENT</option><option>ABSENT</option><option>LATE</option><option>UNMARKED</option></select></label>)}</div><textarea value={editor.editReason || ''} onChange={(event) => setEditor((current) => ({ ...current, editReason: event.target.value }))} placeholder="Correction reason" /><button type="button" className="faculty-previous-save" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save correction'}</button>{editor.error ? <div className="faculty-previous-error">{editor.error}</div> : null}</aside></div> : null}
  </section>
}

