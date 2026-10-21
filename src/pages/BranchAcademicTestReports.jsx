import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { getBranchAcademicTestReport, listAcademicTests, listBranchAcademicTestReports } from '../services/academicTestService'
import '../styles/AcademicTestReportPage.css'

const resultClass = (result) => String(result || '').toLowerCase() === 'pass' ? 'is-pass' : String(result || '').toLowerCase() === 'fail' ? 'is-fail' : ''
const display = (value, fallback = '-') => value === null || value === undefined || value === '' ? fallback : value
const normalizeKey = (value) => String(value || '').trim().toLowerCase()

const getBatchReportKey = (item = {}) => {
  const batch = item?.batch || {}
  const course = item?.course || {}
  const batchKey = normalizeKey(batch.id || batch.batchId || item.batchId || batch.batchName || item.batchName)
  const courseKey = normalizeKey(course.id || course.courseId || item.courseId || course.name || item.courseName || batch.courseId || batch.courseName)
  return batchKey ? `batch:${batchKey}` : `${courseKey}|${normalizeKey(batch.batchName || item.batchName)}`
}

const getAcademicTestCount = (row = {}) => {
  if (Array.isArray(row?.items) && row.items.length) return row.items.length
  const value = Number(row?.academicTestCount ?? row?.testCount ?? row?.totalTests ?? 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

const getReportTestIds = (report = {}) => {
  if (Array.isArray(report?.academicTestIds)) return report.academicTestIds
  if (Array.isArray(report?.tests)) return report.tests.map((test) => test?.id || test?.testId || test?.testNumber).filter(Boolean)
  return report?.id ? [report.id] : []
}

function AcademicReportSkeletonRows({ columns, count = 5 }) {
  return Array.from({ length: count }, (_, rowIndex) => <tr key={`academic-report-skeleton-${rowIndex}`} className="academic-report-skeleton-row" aria-hidden="true">{Array.from({ length: columns }, (_, columnIndex) => <td key={columnIndex}><span /></td>)}</tr>)
}

function AcademicReportProgressCell({ progress }) {
  return <div className="academic-report-progress-cell" aria-label={`Test progress: ${progress.completed} of ${progress.total} completed`} style={{ minWidth: 150 }}><div className="academic-report-progress-label" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 800 }}><strong>{progress.completed}/{progress.total}</strong><span>{progress.percentage}%</span></div><div className="academic-report-progress-track" aria-hidden="true" style={{ height: 7, marginTop: 6, overflow: 'hidden', borderRadius: 999, background: '#dbeafe' }}><span style={{ display: 'block', width: `${progress.percentage}%`, height: '100%', borderRadius: 'inherit', background: '#2563eb' }} /></div></div>
}

function TestCell({ test }) {
  const [open, setOpen] = useState(false)
  const final = test.final || {}
  const isScored = (status) => ['SUBMITTED', 'EVALUATED'].includes(String(status || '').toUpperCase())
  return <div className="academic-report-test-cell"><div className="academic-report-final"><strong>{isScored(final.status) ? `${final.marksObtained}/${final.totalMarks}` : final.status === 'NOT_ATTENDED' ? 'Not Attended' : '-'}</strong>{final.percentage != null && <small className="academic-report-cell-percent">{final.percentage}%</small>}<em className={resultClass(final.result)}>{display(final.result)}</em></div>{test.attempts?.length > 1 && <><button type="button" className="academic-report-history-toggle" onClick={() => setOpen((value) => !value)}>{open ? 'Hide history' : `${test.attempts.length} attempts`}<ChevronDown size={14} className={open ? 'is-open' : ''} /></button>{open && <div className="academic-report-history">{test.attempts.map((attempt) => <div className="academic-report-attempt" key={attempt.scheduleId}><span>{attempt.attemptType === 'RETEST' ? `Retest ${attempt.attemptNumber || ''}` : 'Original'}</span><strong>{isScored(attempt.status) ? `${attempt.marksObtained}/${attempt.totalMarks}` : 'Not Attended'}</strong><em className={resultClass(attempt.result)}>{display(attempt.result, '')}</em></div>)}</div>}</>}</div>
}

export default function BranchAcademicTestReports() {
  const [reports, setReports] = useState([])
  const [academicTestRows, setAcademicTestRows] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentSearch, setStudentSearch] = useState('')

  useEffect(() => { Promise.all([listBranchAcademicTestReports(), listAcademicTests()]).then(([reportRows, testRows]) => { setReports(Array.isArray(reportRows) ? reportRows : []); setAcademicTestRows(Array.isArray(testRows) ? testRows : []) }).catch((err) => setError(err.message || 'Unable to load reports.')).finally(() => setLoading(false)) }, [])

  const reportProgressByKey = useMemo(() => {
    const totals = new Map()
    academicTestRows.forEach((row) => {
      const total = getAcademicTestCount(row)
      const course = row?.course || {}
      const courseKey = normalizeKey(course.id || course.courseId || row?.courseId || course.name || row?.courseName)
      const assignedBatches = Array.isArray(row?.batches) && row.batches.length ? row.batches : [row?.batch || row]
      assignedBatches.forEach((batch) => {
        const batchId = normalizeKey(batch?.id || batch?.batchId)
        const batchKey = batchId ? `batch:${batchId}` : `${courseKey}|${normalizeKey(batch?.batchName)}`
        if (courseKey && batchKey) totals.set(batchKey, (totals.get(batchKey) || 0) + total)
      })
    })
    const completed = new Map()
    reports.forEach((item) => { const key = getBatchReportKey(item); if (!key || key === '|') return; const ids = completed.get(key) || new Set(); getReportTestIds(item).forEach((id) => ids.add(String(id))); completed.set(key, ids) })
    const result = new Map()
    new Set([...totals.keys(), ...completed.keys()]).forEach((key) => { const total = totals.get(key) || completed.get(key)?.size || 0; const done = Math.min(total, completed.get(key)?.size || 0); result.set(key, { total, completed: done, percentage: total ? Math.round((done / total) * 100) : 0 }) })
    return result
  }, [academicTestRows, reports])

  const openReport = async (id) => { try { setError(''); setStudentSearch(''); setLoading(true); setReport(await getBranchAcademicTestReport(id)) } catch (err) { setError(err.message || 'Unable to load report.') } finally { setLoading(false) } }
  const tests = report?.tests || []
  const hasProject = Boolean(report?.hasProject)
  const studentQuery = studentSearch.trim().toLowerCase()
  const visibleStudents = (report?.students || []).filter((row) => !studentQuery || [row.student?.studentName, row.student?.studentId].some((field) => String(field || '').toLowerCase().includes(studentQuery)))

  if (loading && !report) return <section className="academic-report-page is-embedded branch-academic-report"><div className="academic-report-heading"><div><p className="academic-report-kicker">BRANCH ADMIN WORKSPACE</p><h1>Academic Test Report</h1><p>Reports sent by faculty for completed Academic Tests.</p></div></div><section className="academic-report-card academic-report-loading-card"><div className="academic-report-card-title"><h2>Received Reports</h2><span className="academic-report-skeleton-short" /></div><div className="academic-report-table-wrap"><table className="academic-report-table"><thead><tr><th>Batch</th><th>Batch ID</th><th>Course</th><th>Faculty</th><th>Tests</th><th>Test Progress</th><th>Sent At</th><th>Action</th></tr></thead><tbody><AcademicReportSkeletonRows columns={8} /></tbody></table></div></section></section>

  return <section className="academic-report-page is-embedded branch-academic-report"><div className="academic-report-heading"><div><p className="academic-report-kicker">BRANCH ADMIN WORKSPACE</p><h1>Academic Test Report</h1><p>Reports sent by faculty for completed Academic Tests.</p></div>{report && <button type="button" className="academic-report-back" onClick={() => setReport(null)}><ArrowLeft size={16} /> All reports</button>}</div>{error && <div className="academic-report-error">{error}</div>}{!report ? <section className="academic-report-card"><div className="academic-report-card-title"><h2>Received Reports</h2><span>{reports.length} reports</span></div><div className="academic-report-table-wrap"><table className="academic-report-table"><thead><tr><th>Batch</th><th>Batch ID</th><th>Course</th><th>Faculty</th><th>Tests</th><th>Test Progress</th><th>Sent At</th><th>Action</th></tr></thead><tbody>{reports.length ? reports.map((item) => <tr key={item.id}><td>{item.batch?.batchName || '-'}</td><td>{item.batch?.batchId || '-'}</td><td>{item.batch?.courseName || item.course?.name || '-'}</td><td>{item.faculty?.fullName || '-'}</td><td>{getReportTestIds(item).length}</td><td><AcademicReportProgressCell progress={reportProgressByKey.get(getBatchReportKey(item)) || { total: 0, completed: 0, percentage: 0 }} /></td><td>{item.sentAt ? new Date(item.sentAt).toLocaleDateString() : '-'}</td><td><button type="button" className="academic-report-primary" onClick={() => openReport(item.id)}>View Students</button></td></tr>) : <tr><td colSpan="8">No Academic Test reports received.</td></tr>}</tbody></table></div></section> : <section className="academic-report-card"><div className="academic-report-card-title"><div><h2>{report.batch?.batchName || '-'}</h2><p>{report.batch?.batchId || '-'} · {report.course?.name || report.batch?.courseName || '-'}</p></div><span>{report.students?.length || 0} students</span></div><div className="academic-report-table-wrap"><table className="academic-report-table academic-report-student-table"><thead><tr><th>Student</th><th>Student ID</th>{tests.map((test) => <th key={test.testNumber}>Test {test.testNumber}</th>)}{hasProject && <th>Project</th>}<th>Overall Test %</th>{hasProject && <th>Overall Project %</th>}</tr></thead><tbody>{loading ? <tr><td colSpan={tests.length + 4}>Loading...</td></tr> : visibleStudents.length ? visibleStudents.map((row) => <tr key={row.student.id}><td><strong>{row.student.studentName}</strong><small>{row.student.emailAddress}</small></td><td>{row.student.studentId}</td>{row.tests.map((test) => <td key={test.testNumber}><TestCell test={test} /></td>)}{hasProject && <td>{row.project?.marksAwarded == null ? '-' : `${row.project.marksAwarded}/${row.project.totalMarks}`}</td>}<td className="academic-report-percent">{row.overallTestPercentage == null ? '-' : `${row.overallTestPercentage}%`}</td>{hasProject && <td className="academic-report-percent">{row.overallProjectPercentage == null ? '-' : `${row.overallProjectPercentage}%`}</td>}</tr>) : <tr><td colSpan={tests.length + 4}>No students found.</td></tr>}</tbody></table></div></section>}</section>
}
