import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { getAcademicBatchReport, listAcademicReportBatches } from '../services/academicTestService'
import '../styles/AcademicTestReportPage.css'
import '../styles/AcademicTestReportPercent.css'
import '../styles/AcademicTestReportLayout.css'
import '../styles/AcademicTestReportLayoutTight.css'

const value = (item, fallback = '-') => item === null || item === undefined || item === '' ? fallback : item
const resultClass = (result) => String(result || '').toLowerCase() === 'pass' ? 'is-pass' : String(result || '').toLowerCase() === 'fail' ? 'is-fail' : ''

function Attempt({ attempt }) {
  return <div className="academic-report-attempt"><span>{attempt.attemptType === 'RETEST' ? `Retest ${attempt.attemptNumber || ''}` : 'Original'}</span><strong>{attempt.status === 'SUBMITTED' ? `${attempt.marksObtained}/${attempt.totalMarks}` : attempt.status === 'NOT_ATTENDED' ? 'Not Attended' : 'Not Submitted'}</strong>{attempt.percentage !== null && <small>{attempt.percentage}%</small>}<em className={resultClass(attempt.result)}>{value(attempt.result, '')}</em></div>
}

function TestCell({ test, finalOverride = null, showHistory = true }) {
  const [open, setOpen] = useState(false)
  const final = test.final || finalOverride || {}
  return <div className="academic-report-test-cell"><div className="academic-report-final"><strong>{final.status === 'SUBMITTED' ? `${final.marksObtained}/${final.totalMarks}` : final.status === 'NOT_ATTENDED' ? 'Not Attended' : '-'}</strong>{final.percentage !== null && final.percentage !== undefined && <small className="academic-report-cell-percent">{final.percentage}%</small>}<em className={resultClass(final.result)}>{value(final.result)}</em></div>{showHistory && test.attempts?.length > 1 && <><button type="button" className="academic-report-history-toggle" onClick={() => setOpen(!open)}>{open ? 'Hide history' : `${test.attempts.length} attempts`}<ChevronDown size={14} className={open ? 'is-open' : ''} /></button>{open && <div className="academic-report-history">{test.attempts.map((attempt) => <Attempt key={attempt.scheduleId} attempt={attempt} />)}</div>}</>}</div>
}

export default function AcademicTestReportPage({ embedded = false }) {
  const [batches, setBatches] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loadBatches = async () => { try { setLoading(true); setBatches(await listAcademicReportBatches()) } catch (err) { setError(err.message || 'Unable to load report batches.') } finally { setLoading(false) } }
  useEffect(() => { loadBatches() }, [])
  const openBatch = async (batchId) => { try { setError(''); setLoading(true); setReport(await getAcademicBatchReport(batchId)) } catch (err) { setError(err.message || 'Unable to load student report.') } finally { setLoading(false) } }
  const tests = report?.tests || []
  const hasProject = Boolean(report?.hasProject)
  return <main className={`academic-report-page ${embedded ? 'is-embedded' : ''}`}>
    <div className="academic-report-heading"><div><p className="academic-report-kicker">FACULTY WORKSPACE</p><h1>Academic Test Report</h1><p>Review final test attempts, retest history and project performance by batch.</p></div>{report && <button type="button" className="academic-report-back" onClick={() => setReport(null)}><ArrowLeft size={16} /> All batches</button>}</div>
    {error && <div className="academic-report-error">{error}</div>}
    {!report ? <section className="academic-report-card"><div className="academic-report-card-title"><h2>Batch Reports</h2><span>{batches.length} batches</span></div><div className="academic-report-table-wrap"><table className="academic-report-table"><thead><tr><th>Batch ID</th><th>Batch Name</th><th>Course</th><th>Total Tests</th><th>Batch Timing</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="6">Loading reports...</td></tr> : batches.length ? batches.map((batch) => <tr key={batch.id}><td>{batch.batchId}</td><td>{batch.batchName}</td><td>{batch.course?.name || batch.courseName}</td><td>{batch.totalTests}</td><td>{value(batch.batchTiming)}</td><td><button type="button" className="academic-report-primary" onClick={() => openBatch(batch.id)}>View Students</button></td></tr>) : <tr><td colSpan="6">No batches available.</td></tr>}</tbody></table></div></section> : <section className="academic-report-card"><div className="academic-report-card-title"><div><h2>{report.batch.batchName}</h2><p>{report.batch.batchId} · {report.course?.name || '-'} · {value(report.batch.batchTiming)}</p></div><span>{report.students?.length || 0} students</span></div><div className="academic-report-table-wrap"><table className="academic-report-table academic-report-student-table"><thead><tr><th>Student</th><th>Student ID</th>{tests.map((test) => <th key={test.testNumber}>Test {test.testNumber}</th>)}{hasProject && <th>Project</th>}<th>Overall Test %</th>{hasProject && <th>Overall Project %</th>}</tr></thead><tbody>{loading ? <tr><td colSpan={tests.length + 4}>Loading...</td></tr> : report.students?.length ? report.students.map((row) => <tr key={row.student.id}><td><strong>{row.student.studentName}</strong><small>{row.student.emailAddress}</small></td><td>{row.student.studentId}</td>{row.tests.map((test) => <td key={test.testNumber}><TestCell test={test} finalOverride={test.originalFinal} /></td>)}{hasProject && <td><div className="academic-report-final"><strong>{row.project?.marksAwarded == null ? '-' : `${row.project.marksAwarded}/${row.project.totalMarks}`}</strong><em className={resultClass(row.project?.result)}>{value(row.project?.result)}</em></div></td>}<td className="academic-report-percent">{row.overallTestPercentage == null ? '-' : `${row.overallTestPercentage}%`}</td>{hasProject && <td className="academic-report-percent">{row.overallProjectPercentage == null ? '-' : `${row.overallProjectPercentage}%`}</td>}</tr>) : <tr><td colSpan={tests.length + 4}>No students found in this batch.</td></tr>}</tbody></table></div></section>}
  </main>
}
