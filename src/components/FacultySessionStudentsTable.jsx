import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'

function status(value) {
  return String(value || 'UNMARKED').trim().toUpperCase()
}

function attendanceStatus(student) {
  return status(student.status || student.attendanceStatus)
}

function attendanceType(student) {
  const type = status(student.attendanceType)
  if (type !== 'UNMARKED') return type
  return attendanceStatus(student) === 'LATE' ? 'LATE ATTENDANCE' : attendanceStatus(student) === 'PRESENT' || attendanceStatus(student) === 'ABSENT' ? 'NORMAL' : 'UNMARKED'
}

export function FacultySessionStudentsTable({ students = [], studentEdit, setStudentEdit, saveStudentEdit, StatusBadge }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => students.filter((student) => {
    const id = String(student.studentId || student.id || '')
    const name = String(student.studentName || student.name || '')
    const matchesSearch = `${id} ${name}`.toLowerCase().includes(query.trim().toLowerCase())
    const current = attendanceStatus(student) === 'LATE' ? 'PRESENT' : attendanceStatus(student)
    return matchesSearch && (filter === 'ALL' || current === filter)
  }), [filter, query, students])
  const totalPages = Math.max(1, Math.ceil(filtered.length / 5))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * 5, safePage * 5)

  return <>
    <div className="faculty-session-student-filters">
      <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search student ID or name..." aria-label="Search student ID or name" />
      <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }} aria-label="Filter attendance status"><option value="ALL">All status</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option></select>
    </div>
    <div className="faculty-previous-student-table-wrap"><table className="faculty-previous-student-table"><thead><tr><th>S.No</th><th>Student ID</th><th>Student Name</th><th>Attendance</th><th>Attendance Type</th><th>Marked At</th><th>Action</th></tr></thead><tbody>{visible.map((student, index) => { const studentId = student.studentId || student.id || ''; const rawStatus = attendanceStatus(student); const editing = studentEdit?.studentId === studentId; return <tr key={studentId || index}><td>{((safePage - 1) * 5) + index + 1}</td><td>{studentId || '-'}</td><td><strong>{student.studentName || student.name || '-'}</strong></td><td>{editing ? <select className="faculty-previous-inline-select" value={studentEdit.status} onChange={(event) => setStudentEdit((current) => ({ ...current, status: event.target.value }))}><option value="PRESENT">PRESENT</option><option value="ABSENT">ABSENT</option></select> : <StatusBadge value={rawStatus === 'LATE' ? 'PRESENT' : rawStatus} />}</td><td>{attendanceType(student)}</td><td>{student.markedAt ? new Date(student.markedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td><td>{editing ? <div className="faculty-previous-inline-actions"><button type="button" onClick={() => void saveStudentEdit()} disabled={studentEdit.saving}>{studentEdit.saving ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => setStudentEdit(null)}>Cancel</button></div> : <button type="button" className="faculty-previous-row-edit" onClick={() => setStudentEdit({ studentId, status: rawStatus === 'ABSENT' ? 'ABSENT' : 'PRESENT', saving: false, error: '' })}><Pencil size={14} /> Edit</button>}</td></tr> })}</tbody></table>{!visible.length ? <div className="faculty-previous-empty">No students match these filters.</div> : null}</div>
    <div className="faculty-previous-pagination"><span>Showing {filtered.length ? ((safePage - 1) * 5) + 1 : 0}–{Math.min(safePage * 5, filtered.length)} of {filtered.length} students</span><div><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>Previous</button><strong>Page {safePage} of {totalPages}</strong><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>Next</button></div></div>
  </>
}
