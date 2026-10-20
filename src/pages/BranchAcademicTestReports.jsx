import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { getBranchAcademicTestReport, getBranchAcademicTestReportHistory, listAcademicTests, listBranchAcademicTestReports } from '../services/academicTestService'
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

function LegacyHistorySubmission({ submission, index }) {
  const data = submission?.reportData || {}
  const test = data.tests?.[0] || {}
  return <article className="academic-report-history-card"><div className="academic-report-history-card-heading"><strong>Submission {index + 1}</strong><span>{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '-'}</span><small>{submission.faculty?.fullName || 'Faculty'}{submission.faculty?.email ? ` · ${submission.faculty.email}` : ''}</small></div><div className="academic-report-table-wrap"><table className="academic-report-table academic-report-student-table"><thead><tr><th>Student</th><th>Student ID</th><th>Test {test.testNumber || data.academicTest?.sequence || '-'}</th><th>Percentage</th></tr></thead><tbody>{data.students?.length ? data.students.map((row) => { const result = row.tests?.[0]?.final || {}; const scored = ['SUBMITTED', 'EVALUATED'].includes(String(result.status || '').toUpperCase()); return <tr key={`${submission.id}-${row.student?.id}`}><td><strong>{row.student?.studentName || '-'}</strong><small>{row.student?.emailAddress || '-'}</small></td><td>{row.student?.studentId || '-'}</td><td>{scored ? `${result.marksObtained}/${result.totalMarks}` : result.status === 'NOT_ATTENDED' ? 'Not Attended' : '-'}</td><td>{result.percentage == null ? '-' : `${result.percentage}%`}</td></tr> }) : <tr><td colSpan="4">No student snapshot found.</td></tr>}</tbody></table></div></article>
}

function HistorySubmission({ submission, index }) {
  const data = submission?.reportData || {}
  const tests = data.tests || []
  const projectItems = data.projectItems || []
  return <article className="academic-report-history-card">
    <div className="academic-report-history-card-heading"><strong>Submission {index + 1}</strong><span>{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '-'}</span><small>{submission.faculty?.fullName || 'Faculty'}</small></div>
    <div className="academic-report-table-wrap"><table className="academic-report-table academic-report-student-table"><thead><tr><th>Student</th><th>Student ID</th>{tests.map((test) => <th key={`test-header-${test.testNumber}`}>Test {test.testNumber} Marks</th>)}{projectItems.map((item) => <th key={`project-header-${item.testNumber}`}>Test {item.testNumber} Project</th>)}<th>Overall Test %</th>{projectItems.length > 0 && <th>Overall Project %</th>}</tr></thead><tbody>
      {data.students?.length ? data.students.map((row) => {
        const overallPercentage = row.overallTestPercentage ?? row.overallPercentage
        return <tr key={`${submission.id}-${row.student?.id}`}><td><strong>{row.student?.studentName || '-'}</strong><small>{row.student?.emailAddress || '-'}</small></td><td>{row.student?.studentId || '-'}</td>{tests.map((test) => { const result = (row.tests || []).find((entry) => Number(entry.testNumber) === Number(test.testNumber))?.final || {}; const scored = ['SUBMITTED', 'EVALUATED'].includes(String(result.status || '').toUpperCase()); return <td key={`${submission.id}-${row.student?.id}-test-${test.testNumber}`}>{scored ? `${result.marksObtained}/${result.totalMarks}` : result.status === 'NOT_ATTENDED' ? 'Not Attended' : '-'}</td> })}{projectItems.map((item) => { const project = (row.projects || []).find((entry) => Number(entry.testNumber) === Number(item.testNumber)); return <td key={`${submission.id}-${row.student?.id}-project-${item.testNumber}`}>{project?.marksAwarded == null ? '-' : `${project.marksAwarded}/${project.totalMarks}`} {project?.result && <strong className={resultClass(project.result)}>{project.result}</strong>}</td> })}<td className="academic-report-percent">{overallPercentage == null ? '-' : `${overallPercentage}%`}</td>{projectItems.length > 0 && <td className="academic-report-percent">{row.overallProjectPercentage == null ? '-' : `${row.overallProjectPercentage}%`}</td>}</tr>
      }) : <tr><td colSpan={2 + tests.length + projectItems.length + 1 + (projectItems.length > 0 ? 1 : 0)}>No student snapshot found.</td></tr>}
    </tbody></table></div>
  </article>
}

export default function BranchAcademicTestReports() {
  const [reports, setReports] = useState([])
  const [academicTestRows, setAcademicTestRows] = useState([])
  const [report, setReport] = useState(null)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [showHistoryList, setShowHistoryList] = useState(false)

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

  const openReport = async (id) => { try { setError(''); setHistory(null); setStudentSearch(''); setLoading(true); setReport(await getBranchAcademicTestReport(id)) } catch (err) { setError(err.message || 'Unable to load report.') } finally { setLoading(false) } }
  const openHistory = async (id) => { try { setError(''); setReport(null); setLoading(true); setHistory(await getBranchAcademicTestReportHistory(id)) } catch (err) { setError(err.message || 'Unable to load report history.') } finally { setLoading(false) } }
  const tests = report?.tests || []
  const hasProject = Boolean(report?.hasProject)
  const studentQuery = studentSearch.trim().toLowerCase()
  const visibleStudents = (report?.students || []).filter((row) => !studentQuery || [row.student?.studentName, row.student?.studentId].some((field) => String(field || '').toLowerCase().includes(studentQuery)))
  const activeReports = reports.filter((item) => String(item.status || 'ACTIVE').toUpperCase() !== 'COMPLETED')
  const historyReports = reports.filter((item) => String(item.status || '').toUpperCase() === 'COMPLETED')
  const renderReportList = () => {
    const rows = showHistoryList ? historyReports : activeReports
    return <><div className="academic-report-section-heading"><div><h2>{showHistoryList ? 'Report History' : 'Active Reports'}</h2><p>{showHistoryList ? 'Completed batch cycles and their submitted test history.' : 'Reports currently active for the batch cycle.'}</p></div><div className="academic-report-section-actions"><span>{rows.length} reports</span><button type="button" className="academic-report-back" onClick={() => setShowHistoryList((value) => !value)}>{showHistoryList ? 'Active Reports' : 'View History'}</button></div></div><section className="academic-report-card"><div className="academic-report-table-wrap"><table className="academic-report-table"><thead><tr><th>Batch Name</th><th>Batch ID</th><th>Status</th><th>Course</th><th>Test</th><th>Latest Submitted</th><th>Faculty</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map((item) => <tr key={item.id}><td>{item.batch?.batchName || '-'}</td><td>{item.batch?.batchId || '-'}</td><td><strong>{item.status || (showHistoryList ? 'COMPLETED' : 'ACTIVE')}</strong></td><td>{item.course?.name || item.batch?.courseName || '-'}</td><td>Test {item.testNumber || '-'}</td><td>{item.latestSubmittedAt ? new Date(item.latestSubmittedAt).toLocaleString() : '-'}</td><td>{item.faculty?.fullName || '-'}</td><td><button type="button" className="academic-report-primary" onClick={() => showHistoryList ? openHistory(item.historyId || item.id) : openReport(item.shareId || item.id)}>{showHistoryList ? 'View History' : 'View Students'}</button></td></tr>) : <tr><td colSpan="8">{showHistoryList ? 'No completed report history found.' : 'No active Academic Test reports found.'}</td></tr>}</tbody></table></div></section></>
  }
  if (!report && !history && !loading) return <section className="academic-report-page is-embedded branch-academic-report"><div className="academic-report-heading"><div><p className="academic-report-kicker">BRANCH ADMIN WORKSPACE</p><h1>Academic Test Report</h1><p>Reports sent by faculty for completed Academic Tests.</p></div></div>{error && <div className="academic-report-error">{error}</div>}{renderReportList()}</section>

  if (loading && !report) return <section className="academic-report-page is-embedded branch-academic-report"><div className="academic-report-heading"><div><p className="academic-report-kicker">BRANCH ADMIN WORKSPACE</p><h1>Academic Test Report</h1><p>Reports sent by faculty for completed Academic Tests.</p></div></div><section className="academic-report-card academic-report-loading-card"><div className="academic-report-card-title"><h2>Received Reports</h2><span className="academic-report-skeleton-short" /></div><div className="academic-report-table-wrap"><table className="academic-report-table"><thead><tr><th>Batch</th><th>Batch ID</th><th>Course</th><th>Faculty</th><th>Tests</th><th>Test Progress</th><th>Sent At</th><th>Action</th></tr></thead><tbody><AcademicReportSkeletonRows columns={8} /></tbody></table></div></section></section>

  return <section className="academic-report-page is-embedded branch-academic-report"><div className="academic-report-heading"><div><p className="academic-report-kicker">BRANCH ADMIN WORKSPACE</p><h1>Academic Test Report</h1><p>Reports sent by faculty for completed Academic Tests.</p></div>{(report || history) && <button type="button" className="academic-report-back" onClick={() => { setReport(null); setHistory(null) }}><ArrowLeft size={16} /> All reports</button>}</div>{error && <div className="academic-report-error">{error}</div>}{!report && !history ? <section className="academic-report-card"><div className="academic-report-card-title"><h2>Received Reports</h2><span>{reports.length} histories</span></div><div className="academic-report-table-wrap"><table className="academic-report-table"><thead><tr><th>Batch</th><th>Batch ID</th><th>Cycle</th><th>Course</th><th>Test</th><th>Submissions</th><th>Latest Submitted</th><th>Action</th></tr></thead><tbody>{reports.length ? reports.map((item) => <tr key={item.id}><td>{item.batch?.batchName || '-'}</td><td>{item.batch?.batchId || '-'}</td><td>{item.cycle?.cycleName || `Cycle ${item.cycle?.cycleNumber || '-'}`}<small>{item.cycle?.status || ''}</small></td><td>{item.batch?.courseName || item.course?.name || '-'}</td><td>Test {item.testNumber || '-'}</td><td>{item.submissionCount || 0}</td><td>{item.latestSubmittedAt ? new Date(item.latestSubmittedAt).toLocaleString() : '-'}</td><td><button type="button" className="academic-report-primary" onClick={() => openHistory(item.historyId || item.id)}>View History</button></td></tr>) : <tr><td colSpan="8">No Academic Test reports received.</td></tr>}</tbody></table></div></section> : history ? <section className="academic-report-card"><div className="academic-report-card-title"><div><h2>{history.batch?.batchName || '-'}</h2><p>{history.batch?.batchId || '-'} · {history.cycle?.cycleName || `Cycle ${history.cycle?.cycleNumber || '-'}`} · {history.batch?.courseName || '-'} · Test {history.academicTest?.sequence || '-'}</p></div><span>{history.submissions?.length || 0} submissions</span></div>{history.submissions?.length ? history.submissions.map((submission, index) => <HistorySubmission key={submission.id} submission={submission} index={history.submissions.length - index - 1} />) : <p>No submissions found.</p>}</section> : <section className="academic-report-card"><div className="academic-report-card-title"><div><h2>{report.batch?.batchName || '-'}</h2><p>{report.batch?.batchId || '-'} · {report.course?.name || report.batch?.courseName || '-'}</p></div><span>{report.students?.length || 0} students</span></div><div className="academic-report-table-wrap"><table className="academic-report-table academic-report-student-table"><thead><tr><th>Student</th><th>Student ID</th>{tests.map((test) => <th key={test.testNumber}>Test {test.testNumber}</th>)}{hasProject && <th>Project</th>}<th>Overall Test %</th>{hasProject && <th>Overall Project %</th>}</tr></thead><tbody>{loading ? <tr><td colSpan={tests.length + 4}>Loading...</td></tr> : visibleStudents.length ? visibleStudents.map((row) => <tr key={row.student.id}><td><strong>{row.student.studentName}</strong><small>{row.student.emailAddress}</small></td><td>{row.student.studentId}</td>{row.tests.map((test) => <td key={test.testNumber}><TestCell test={test} /></td>)}{hasProject && <td>{row.project?.marksAwarded == null ? '-' : `${row.project.marksAwarded}/${row.project.totalMarks}`}</td>}<td className="academic-report-percent">{row.overallTestPercentage == null ? '-' : `${row.overallTestPercentage}%`}</td>{hasProject && <td className="academic-report-percent">{row.overallProjectPercentage == null ? '-' : `${row.overallProjectPercentage}%`}</td>}</tr>) : <tr><td colSpan={tests.length + 4}>No students found.</td></tr>}</tbody></table></div></section>}</section>
}
