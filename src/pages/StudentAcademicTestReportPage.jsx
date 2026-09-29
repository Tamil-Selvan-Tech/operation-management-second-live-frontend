import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getMyAcademicReport } from '../services/academicTestService'
import '../styles/AcademicTestReportPage.css'
import '../styles/AcademicTestReportPercent.css'

const resultClass = (result) => String(result || '').toLowerCase() === 'pass' ? 'is-pass' : String(result || '').toLowerCase() === 'fail' ? 'is-fail' : ''

function TestCell({ test }) {
  const [open, setOpen] = useState(false)
  const final = test?.final || {}
  return <div className="academic-report-test-cell"><div className="academic-report-final"><strong>{final.status === 'SUBMITTED' ? `${final.marksObtained}/${final.totalMarks}` : final.status === 'NOT_ATTENDED' ? 'Not Attended' : '-'}</strong>{final.percentage != null && <small className="academic-report-cell-percent">{final.percentage}%</small>}<em className={resultClass(final.result)}>{final.result || ''}</em></div>{test?.attempts?.length > 1 && <><button type="button" className="academic-report-history-toggle" onClick={() => setOpen((current) => !current)}>{open ? 'Hide history' : `${test.attempts.length} attempts`}<ChevronDown size={14} className={open ? 'is-open' : ''} /></button>{open && <div className="academic-report-history">{test.attempts.map((attempt) => <div className="academic-report-attempt" key={attempt.scheduleId}><span>{attempt.attemptType === 'RETEST' ? `Retest ${attempt.attemptNumber || ''}` : 'Original'}</span><strong>{attempt.status === 'SUBMITTED' ? `${attempt.marksObtained}/${attempt.totalMarks}` : attempt.status === 'NOT_ATTENDED' ? 'Not Attended' : 'Not Submitted'}</strong><em className={resultClass(attempt.result)}>{attempt.result || ''}</em></div>)}</div>}</>}</div>
}

export default function StudentAcademicTestReportPage({ embedded = false }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { getMyAcademicReport().then(setReport).catch((err) => setError(err.message || 'Unable to load your report.')).finally(() => setLoading(false)) }, [])
  const student = report?.student
  const tests = student?.tests || []
  const hasProject = Boolean(student?.project)
  return <main className={`academic-report-page student-academic-report-page ${embedded ? 'is-embedded' : ''}`}><div className="academic-report-heading"><div><p className="academic-report-kicker">STUDENT ACADEMIC TEST REPORT</p><h1>{student?.student?.studentName || 'My Academic Test Report'}</h1><p>{report?.batch?.batchName || '-'} · {report?.course?.name || '-'} · {report?.totalTests || 0} tests</p></div></div>{error && <div className="academic-report-error">{error}</div>}{loading ? <section className="academic-report-card"><div className="academic-report-card-title"><h2>Loading report...</h2></div></section> : student ? <section className="academic-report-card"><div className="academic-report-card-title"><div><h2>{report.batch?.batchName || 'Academic Test Report'}</h2><p>{report.batch?.batchId || '-'} · {report.course?.name || '-'}</p></div><span>{report.totalTests || tests.length} tests</span></div><div className="academic-report-table-wrap"><table className="academic-report-table academic-report-student-table"><thead><tr><th>Student</th><th>Student ID</th>{tests.map((test) => <th key={test.testNumber}>Test {test.testNumber}</th>)}{hasProject && <th>Project</th>}<th>Overall Test %</th>{hasProject && <th>Overall Project %</th>}</tr></thead><tbody><tr><td><strong>{student.student?.studentName}</strong><small>{student.student?.emailAddress}</small></td><td>{student.student?.studentId}</td>{tests.map((test) => <td key={test.testNumber}><TestCell test={test} /></td>)}{hasProject && <td><div className="academic-report-final"><strong>{student.project.marksAwarded == null ? '-' : `${student.project.marksAwarded}/${student.project.totalMarks}`}</strong>{student.project.percentage != null && <small className="academic-report-cell-percent">{student.project.percentage}%</small>}<em className={resultClass(student.project.result)}>{student.project.result || ''}</em></div></td>}<td className="academic-report-percent">{student.overallTestPercentage == null ? '-' : `${student.overallTestPercentage}%`}</td>{hasProject && <td className="academic-report-percent">{student.overallProjectPercentage == null ? '-' : `${student.overallProjectPercentage}%`}</td>}</tr></tbody></table></div></section> : <section className="academic-report-card"><div className="academic-report-card-title"><h2>No report available yet.</h2></div></section>}</main>
}
