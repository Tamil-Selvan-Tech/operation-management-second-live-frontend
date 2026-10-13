import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, RefreshCcw, Search, X } from 'lucide-react'
import { listCompletedStudentCourses } from '../services/completedStudentService'
import '../styles/CompletedStudentsPage.css'

const PAGE_SIZE = 20

function valueOf(value) {
  return value === 0 || value ? String(value) : 'N/A'
}

function formatDate(value) {
  if (!value) return 'N/A'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? valueOf(value) : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return 'N/A'
  const amount = Number(value)
  return Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN')}` : valueOf(value)
}

function attendanceLabel(row) {
  const value = row.attendancePercentage ?? row.attendancePercent
  return value === null || value === undefined || value === '' ? 'N/A' : `${value}%`
}

function buildFields(row) {
  return [
    ['Student ID', row.studentId], ['Student Name', row.studentName], ['Contact Number', row.mobileNumber], ['Email ID', row.emailAddress],
    ['Course', row.courseName], ['Database Source', row.source], ['Branch Admin Name', row.branchAdminName],
    ['Course Starting Date', formatDate(row.courseStartDate)], ['Course Ending Date', formatDate(row.courseEndDate)],
    ['Weekday / Weekend', row.scheduleType || row.classSchedule], ['Online / Offline', row.courseMode || row.mode],
    ['Batch Timing', row.batchTiming], ['Faculty Name', row.facultyName], ['Attendance Percentage', attendanceLabel(row)],
    ['Course Fees', formatMoney(row.courseFees)], ['Registration Fees', formatMoney(row.registrationFees)],
    ['First Installment', formatMoney(row.installment1)], ['Second Installment', formatMoney(row.installment2)], ['Third Installment', formatMoney(row.installment3)],
    ['Paid Amount', formatMoney(row.paidAmount)], ['Pending Amount', formatMoney(row.pendingAmount)],
    ['Student Status', row.studentStatus], ['Remarks', row.remarks],
    ...(Array.isArray(row.academicTests) ? row.academicTests.map((test) => [test.label, test.value]) : []),
  ].filter(([label, value]) => {
    const installmentField = /^(First|Second|Third) Installment$/.test(label)
    return !installmentField || (value !== null && value !== undefined && value !== '')
  })
}

function StatusPill({ value }) {
  return <span className={`completed-students-status completed-students-status--${String(value || '').toLowerCase()}`}>{valueOf(value)}</span>
}

export function CompletedStudentsPage({ completedStudents = [] } = {}) {
  const [tab, setTab] = useState('COMPLETED')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sortBy, setSortBy] = useState('studentName')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ data: [], meta: null, loading: true, error: '' })
  const [counts, setCounts] = useState({ COMPLETED: null, DISCONTINUED: null })
  const [selected, setSelected] = useState(null)

  const load = useCallback(async (lifecycle = tab, requestedPage = page) => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const result = await listCompletedStudentCourses({ lifecycle, search: appliedSearch, sortBy, sortOrder, page: requestedPage, limit: PAGE_SIZE })
      const normalizedCompleted = Array.isArray(completedStudents) ? completedStudents : []
      const apiRows = lifecycle === 'COMPLETED'
        ? result.data.filter((row) => normalizedCompleted.some((student) => String(student.studentId || student.id || '').trim().toLowerCase() === String(row.studentId || '').trim().toLowerCase()))
        : result.data
      const apiStudentIds = new Set(apiRows.map((row) => String(row.studentId || '').trim().toLowerCase()))
      const supplementalRows = lifecycle === 'COMPLETED'
        ? normalizedCompleted
          .filter((student) => !apiStudentIds.has(String(student.studentId || student.id || '').trim().toLowerCase()))
          .map((student) => ({
            recordId: student.recordId || student.id || student.studentId,
            studentId: student.studentId || student.id,
            studentName: student.studentName || student.name,
            courseName: student.courseName || student.courseInterested || student.course?.name,
            courseStartDate: student.courseStartDate || student.startDate,
            courseEndDate: student.courseEndDate || student.endDate,
            batchName: student.batchName || student.batch?.name,
            facultyName: student.facultyName || student.faculty?.name,
            totalFees: student.finalFee || student.totalAmount || student.courseAmount,
            paidAmount: student.paidAmount || student.totalPaid,
            pendingAmount: student.pendingAmount,
            lifecycleStatus: 'COMPLETED',
          }))
        : []
      const data = [...apiRows, ...supplementalRows]
      setState({ ...result, data, loading: false, error: '' })
      setCounts((current) => ({ ...current, [lifecycle]: lifecycle === 'COMPLETED' ? data.length : (result.meta?.total ?? result.data.length) }))
    } catch (error) {
      setState({ data: [], meta: null, loading: false, error: error?.message || 'Unable to load student records.' })
    }
  }, [appliedSearch, completedStudents, page, sortBy, sortOrder, tab])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const switchTab = (nextTab) => {
    setTab(nextTab)
    setPage(1)
  }

  const totalPages = Math.max(1, Number(state.meta?.totalPages || Math.ceil(Number(state.meta?.total || 0) / PAGE_SIZE) || 1))

  return (
    <section className="completed-students-page">
      <header className="completed-students-header">
        <div><p className="completed-students-kicker">ACADEMIC OPERATION</p><h1>Completed Students</h1><p>Review course records that are completed or discontinued from the persisted branch data.</p></div>
        <button type="button" className="completed-students-refresh" onClick={() => void load()} disabled={state.loading}><RefreshCcw size={17} className={state.loading ? 'is-spinning' : ''} /> Refresh</button>
      </header>

      <div className="completed-students-tabs" role="tablist" aria-label="Student course lifecycle">
        {['COMPLETED', 'DISCONTINUED'].map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => switchTab(item)}><span>{item === 'COMPLETED' ? 'Completed Students' : 'Discontinued Students'}</span><strong>{counts[item] ?? '—'}</strong></button>)}
      </div>

      <div className="completed-students-toolbar">
        <label className="completed-students-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setAppliedSearch(search.trim()); setPage(1) } }} placeholder="Search student, ID, course or email" /></label>
        <button type="button" className="completed-students-search-button" onClick={() => { setAppliedSearch(search.trim()); setPage(1) }}>Search</button>
        <select value={`${sortBy}:${sortOrder}`} onChange={(event) => { const [nextSort, nextOrder] = event.target.value.split(':'); setSortBy(nextSort); setSortOrder(nextOrder); setPage(1) }} aria-label="Sort records"><option value="studentName:asc">Name A-Z</option><option value="studentName:desc">Name Z-A</option><option value="courseName:asc">Course A-Z</option><option value="courseStartDate:desc">Newest course</option></select>
      </div>

      {state.error ? <div className="completed-students-error" role="alert">{state.error}</div> : null}
      <div className="completed-students-table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Dates</th><th>Batch / Faculty</th><th>Attendance</th><th>Total Fees</th><th>Paid</th><th>Pending</th><th>Status</th><th>Details</th></tr></thead><tbody>
        {state.loading ? <tr><td colSpan="10" className="completed-students-state">Loading records…</td></tr> : state.data.length ? state.data.map((row) => <tr key={row.recordId || `${row.studentId}-${row.courseId}`}><td><strong>{valueOf(row.studentName)}</strong><small>{valueOf(row.studentId)}</small></td><td>{valueOf(row.courseName)}</td><td>{formatDate(row.courseStartDate)}<small>to {formatDate(row.courseEndDate)}</small></td><td>{valueOf(row.batchName)}<small>{valueOf(row.facultyName)}</small></td><td>{attendanceLabel(row)}</td><td>{formatMoney(row.totalFees)}</td><td>{formatMoney(row.paidAmount)}</td><td>{formatMoney(row.pendingAmount)}</td><td><StatusPill value={row.lifecycleStatus || tab} /></td><td><button type="button" className="completed-students-view" onClick={() => setSelected(row)}><Eye size={16} /> View</button></td></tr>) : <tr><td colSpan="10" className="completed-students-state"><CheckCircle2 size={22} /><strong>No {tab === 'COMPLETED' ? 'completed' : 'discontinued'} course records found.</strong><span>Records will appear here when the persisted course status changes.</span></td></tr>}
      </tbody></table></div>

      <footer className="completed-students-pagination"><span>{state.meta?.total ? `Showing page ${state.meta.page} of ${totalPages}` : 'No records'}</span><div><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || state.loading}><ChevronLeft size={17} /></button><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || state.loading}><ChevronRight size={17} /></button></div></footer>

      {selected ? <div className="completed-students-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="completed-students-modal" role="dialog" aria-modal="true" aria-labelledby="completed-student-details-title" onClick={(event) => event.stopPropagation()}><button type="button" className="completed-students-modal-close" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button><p className="completed-students-kicker">COURSE RECORD</p><h2 id="completed-student-details-title">{valueOf(selected.studentName)}</h2><div className="completed-students-detail-grid">{buildFields(selected).map(([label, value]) => <div key={label}><span>{label}</span><strong>{valueOf(value)}</strong></div>)}</div></section></div> : null}
    </section>
  )
}

export default CompletedStudentsPage
