import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarOff, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Eye, Filter, Pencil, RefreshCw, RotateCcw, X } from 'lucide-react'
import {
  getFacultyHistoricalAttendanceSession,
  getFacultyAttendanceBatches,
  getFacultyPreviousAttendance,
  updateFacultyHistoricalAttendance,
} from '../services/attendanceService'
import '../styles/FacultyPreviousAttendance.css'
import { FacultySessionStudentsTable } from './FacultySessionStudentsTable'

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
function formatTime(value) {
  const source = String(value || '').trim()
  const match = source.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return source || '-'
  let hour = Number(match[1])
  const minute = match[2]
  const period = match[3]?.toUpperCase()
  if (period) return `${String(hour).padStart(2, '0')}:${minute} ${period}`
  const meridiem = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${String(hour).padStart(2, '0')}:${minute} ${meridiem}`
}
function formatTiming(value) {
  const source = String(value || '').trim()
  const parts = source.split(/\s*(?:-|–|—)\s*/)
  return parts.length === 2 ? `${formatTime(parts[0])} - ${formatTime(parts[1])}` : formatTime(source)
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
    batchTiming: formatTiming(row.batchTiming || row.timing || '-'),
    originalFacultyName: row.originalFacultyName || row.originalFaculty || '-',
    handledBy: row.handledBy || row.actualFacultyName || row.facultyName || row.originalFacultyName || '-',
    assignmentType: [row.assignmentType || 'NORMAL', row.handledBy ? `Handled: ${row.handledBy}` : ''].filter(Boolean).join(' · '),
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
  const month = monthKey(new Date())
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({})
  const [historyStart, setHistoryStart] = useState('')
  const showAllHistory = true
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilterMode, setDateFilterMode] = useState('all')
  const [fromDateFilter, setFromDateFilter] = useState('')
  const [toDateFilter, setToDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [batchFilter, setBatchFilter] = useState('ALL')
  const [page, setPage] = useState(1)
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

  const batchOptions = useMemo(() => [...new Set(rows.map((row) => row.batchName).filter((value) => value && value !== '-'))].sort((left, right) => left.localeCompare(right)), [rows])
  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesDate = dateFilterMode === 'range'
      ? (!fromDateFilter || row.attendanceDate >= fromDateFilter) && (!toDateFilter || row.attendanceDate <= toDateFilter)
      : true
    const matchesStatus = statusFilter === 'ALL' || row.sessionStatus === statusFilter
    const matchesBatch = batchFilter === 'ALL' || row.batchName === batchFilter
    return matchesDate && matchesStatus && matchesBatch
  }), [batchFilter, dateFilterMode, fromDateFilter, rows, statusFilter, toDateFilter])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 5))
  const safePage = Math.min(page, totalPages)
  const paginatedRows = useMemo(() => filteredRows.slice((safePage - 1) * 5, safePage * 5), [filteredRows, safePage])
  const resetFilters = () => {
    setFromDateFilter(''); setToDateFilter(''); setDateFilterMode('all'); setStatusFilter('ALL'); setBatchFilter('ALL'); setPage(1)
  }
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

  useEffect(() => { setPage(1) }, [batchFilter, dateFilterMode, fromDateFilter, statusFilter, toDateFilter])

  return <section className="faculty-previous-attendance">
    <div className="faculty-previous-attendance-header"><div><span className="faculty-previous-eyebrow">FACULTY ATTENDANCE</span><h2>Previous Attendance</h2></div><button type="button" className="faculty-previous-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'faculty-previous-spin' : ''} /> Refresh</button></div>
    <div className="faculty-previous-stat-grid">
      {[
        ['Completed Sessions', derivedStats.completed, 'completed', CheckCircle2],
        ['Missing Sessions', derivedStats.missing, 'missing', AlertCircle],
        ['Non-working Days', derivedStats.nonWorking, 'non-working', CalendarOff],
        ['Today Work Submitted', derivedStats.todayWork, 'work', ClipboardCheck],
      ].map(([label, value, tone, Icon]) => <article key={label} className={`faculty-previous-stat faculty-previous-stat--${tone}`}><div className="faculty-previous-stat-icon"><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong></div></article>)}
    </div>
    <div className="faculty-previous-filter-panel">
      <div className="faculty-previous-filter-heading"><Filter size={16} /><span>Filter attendance history</span><button type="button" onClick={resetFilters}><RotateCcw size={14} /> Reset</button></div>
      <div className="faculty-previous-filter-grid">
        <label><span>Date mode</span><select value={dateFilterMode} onChange={(event) => { setDateFilterMode(event.target.value); setFromDateFilter(''); setToDateFilter('') }}><option value="all">All dates</option><option value="range">Date range</option></select></label>
        {dateFilterMode === 'range' ? <><label><span>From date</span><input type="date" value={fromDateFilter} onChange={(event) => setFromDateFilter(event.target.value)} /></label><label><span>To date</span><input type="date" min={fromDateFilter || undefined} value={toDateFilter} onChange={(event) => setToDateFilter(event.target.value)} /></label></> : null}
        <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All status</option>{['COMPLETED', 'MISSING', 'WEEK OFF', 'HOLIDAY', 'LEAVE', 'RESCHEDULED'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label><span>Batch</span><select value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)}><option value="ALL">All batches</option>{batchOptions.map((batch) => <option key={batch} value={batch}>{batch}</option>)}</select></label>
      </div>
    </div>
    {error ? <div className="faculty-previous-error" role="alert">{error}</div> : null}
    {loading ? <div className="faculty-previous-table-wrap faculty-previous-table-skeleton"><table className="faculty-previous-table"><thead><tr><th>Attendance Date</th><th>Batch</th><th>Course</th><th>Timing</th><th>Original Faculty</th><th>Handled By</th><th>Leave / Assignment</th><th>Attendance</th><th>Marked By</th><th>Status</th><th>Today Work</th><th>Action</th></tr></thead><tbody>{Array.from({ length: 5 }, (_, index) => <tr key={`attendance-skeleton-${index}`}>{Array.from({ length: 12 }, (_, cellIndex) => <td key={`attendance-skeleton-${index}-${cellIndex}`}><span className="faculty-previous-skeleton-line" /></td>)}</tr>)}</tbody></table></div> : !filteredRows.length ? <div className="faculty-previous-empty"><strong>No attendance sessions match these filters</strong><span>Try clearing one or more filters.</span></div> : <>
      <div className="faculty-previous-table-wrap"><table className="faculty-previous-table"><thead><tr><th>Attendance Date</th><th>Batch</th><th>Course</th><th>Timing</th><th>Original Faculty</th><th>Handled By</th><th>Leave / Assignment</th><th>Attendance</th><th>Marked By</th><th>Status</th><th>Today Work</th><th>Action</th></tr></thead><tbody>{paginatedRows.map((row) => <tr key={row.id} className="faculty-previous-clickable-row" onClick={() => void openSession(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openSession(row) } }} role="button" tabIndex={0}><td>{formatDate(row.attendanceDate)}</td><td><strong>{row.batchName}</strong></td><td>{row.courseName}</td><td>{row.batchTiming}</td><td>{row.originalFacultyName}</td><td>{[row.leaveType, row.assignmentType].filter(Boolean).join(" · ") || "-"}</td><td><StatusBadge value={row.attendanceType || "-"} /></td><td>{row.markedBy || "-"}</td><td><StatusBadge value={row.sessionStatus} /></td><td><StatusBadge value={row.todayWorkStatus} /></td><td><div className="faculty-previous-actions"><button type="button" onClick={(event) => { event.stopPropagation(); void openSession(row) }} title="View session"><Eye size={16} /> View</button></div></td></tr>)}</tbody></table></div>
      <div className="faculty-previous-pagination"><span>Showing {((safePage - 1) * 5) + 1}–{Math.min(safePage * 5, filteredRows.length)} of {filteredRows.length} records</span><div><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}><ChevronLeft size={15} /> Previous</button><strong>Page {safePage} of {totalPages}</strong><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>Next <ChevronRight size={15} /></button></div></div>
    </>}
    {selected ? <div className="faculty-previous-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><aside className="faculty-previous-modal faculty-previous-session-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button type="button" className="faculty-previous-modal-close" onClick={() => setSelected(null)} aria-label="Close"><X /></button><span className="faculty-previous-eyebrow">SESSION DETAILS</span><h3>{selected.batchName}</h3><p>{formatDate(selected.attendanceDate)} · {selected.courseName} · {selected.batchTiming}</p>{selected.loading ? <div className="faculty-previous-empty">Loading student attendance…</div> : selected.error ? <div className="faculty-previous-error">{selected.error}</div> : <><dl className="faculty-previous-detail-grid"><dt>Session status</dt><dd><StatusBadge value={selected.sessionStatus} /></dd><dt>Original Faculty</dt><dd>{selected.originalFacultyName}</dd><dt>Handled By</dt><dd>{selected.handledBy}</dd></dl><div className="faculty-previous-student-table-wrap"><table className="faculty-previous-student-table"><thead><tr><th>S.No</th><th>Student ID</th><th>Student Name</th><th>Attendance</th><th>Attendance Type</th><th>Marked At</th><th>Action</th></tr></thead><tbody>{(selected.students || selected.attendance || []).map((student, index) => { const studentId = student.studentId || student.id || ''; const rawStatus = String(student.status || student.attendanceStatus || '').toUpperCase(); const isEditing = studentEdit?.studentId === studentId; return <tr key={studentId || index}><td>{index + 1}</td><td>{studentId || '-'}</td><td><strong>{student.studentName || student.name || '-'}</strong></td><td>{isEditing ? <select className="faculty-previous-inline-select" value={studentEdit.status} onChange={(event) => setStudentEdit((current) => ({ ...current, status: event.target.value }))}><option value="PRESENT">PRESENT</option><option value="ABSENT">ABSENT</option></select> : <StatusBadge value={displayStudentAttendanceStatus(student)} />}</td><td>{displayStudentAttendanceType(student)}</td><td>{student.markedAt ? new Date(student.markedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td><td>{isEditing ? <div className="faculty-previous-inline-actions"><button type="button" onClick={() => void saveStudentEdit()} disabled={studentEdit.saving}>{studentEdit.saving ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => setStudentEdit(null)}>Cancel</button></div> : <button type="button" className="faculty-previous-row-edit" onClick={() => setStudentEdit({ studentId, status: rawStatus === 'ABSENT' ? 'ABSENT' : 'PRESENT', saving: false, error: '' })}><Pencil size={14} /> Edit</button>}</td></tr> })}</tbody></table>{studentEdit?.error ? <div className="faculty-previous-error">{studentEdit.error}</div> : null}</div></>}</aside></div> : null}
    {editor ? <div className="faculty-previous-modal-backdrop" role="presentation"><aside className="faculty-previous-modal" role="dialog" aria-modal="true"><button type="button" className="faculty-previous-modal-close" onClick={() => setEditor(null)} aria-label="Close"><X /></button><span className="faculty-previous-eyebrow">HISTORICAL CORRECTION</span><h3>Edit {editor.batchName}</h3><p>Original attendance date: {formatDate(editor.attendanceDate)}</p><div className="faculty-previous-students">{(editor.students || editor.attendance || []).map((student, index) => <label key={student.studentId || student.id || index} className="faculty-previous-student"><span>{student.studentName || student.name || student.studentId}</span><select value={student.status || student.attendanceStatus || 'UNMARKED'} onChange={(event) => setEditor((current) => ({ ...current, students: (current.students || current.attendance || []).map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value } : item) }))}><option>PRESENT</option><option>ABSENT</option><option>LATE</option><option>UNMARKED</option></select></label>)}</div><textarea value={editor.editReason || ''} onChange={(event) => setEditor((current) => ({ ...current, editReason: event.target.value }))} placeholder="Correction reason" /><button type="button" className="faculty-previous-save" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save correction'}</button>{editor.error ? <div className="faculty-previous-error">{editor.error}</div> : null}</aside></div> : null}
    {selected ? <div className="faculty-previous-modal-backdrop" role="presentation"><aside className="faculty-previous-modal faculty-previous-session-modal faculty-previous-session-modal-v2" role="dialog" aria-modal="true"><button type="button" className="faculty-previous-modal-close" onClick={() => setSelected(null)} aria-label="Close"><X /></button><span className="faculty-previous-eyebrow">SESSION DETAILS</span><h3>{selected.batchName}</h3><p>{formatDate(selected.attendanceDate)} · {selected.courseName} · {selected.batchTiming}</p>{selected.loading ? <div className="faculty-previous-student-skeleton">{Array.from({ length: 5 }, (_, index) => <div key={index}><span /><span /><span /></div>)}</div> : selected.error ? <div className="faculty-previous-error">{selected.error}</div> : <FacultySessionStudentsTable students={selected.students || selected.attendance || []} studentEdit={studentEdit} setStudentEdit={setStudentEdit} saveStudentEdit={saveStudentEdit} StatusBadge={StatusBadge} />}</aside></div> : null}
  </section>
}

