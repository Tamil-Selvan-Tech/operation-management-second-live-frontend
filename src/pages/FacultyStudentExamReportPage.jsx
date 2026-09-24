import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getFacultyStudentExamReport } from '../services/examService'
import '../styles/FacultyExamReports.css'

export function FacultyStudentExamReportPage({ embedded = false }) {
  const navigate = useNavigate()
  const { moduleId, batchId } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentPage, setStudentPage] = useState(1)

  useEffect(() => {
    getFacultyStudentExamReport(moduleId, batchId).then(setReport).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [moduleId, batchId])

  if (loading) return <section className={`exam-reports-page ${embedded ? 'exam-page-embedded' : ''}`}><p className="exam-muted">Loading student report...</p></section>
  if (error || !report) return <section className={`exam-reports-page ${embedded ? 'exam-page-embedded' : ''}`}><div className="exam-error">{error || 'Unable to load student report.'}</div><button className="exam-secondary" onClick={() => navigate('/dashboard/faculty/exams/reports')}>Back to Reports</button></section>

  const pageSize = 5
  const pageCount = Math.max(1, Math.ceil(report.students.length / pageSize))
  const safePage = Math.min(studentPage, pageCount)
  const pagedStudents = report.students.slice((safePage - 1) * pageSize, safePage * pageSize)

  return <section className={`exam-reports-page ${embedded ? 'exam-page-embedded' : ''}`}><button className="exam-back" onClick={() => navigate('/dashboard/faculty/exams/reports')}><ArrowLeft size={18} /> Reports</button><div className="exam-reports-header"><div><p className="exam-kicker">CONSOLIDATED STUDENT REPORT</p><h1>{report.module.name} - {report.batch.name}</h1><p>{report.course?.name || '-'} - {report.batch.timing || '-'}</p></div></div><div className="exam-report-meta"><div><span>Batch ID</span><strong>{report.batch.batchId || '-'}</strong></div><div><span>Total Tests</span><strong>{report.totalTests}</strong></div><div><span>Total Questions</span><strong>{report.totalMcqs}</strong></div><div><span>Total Students</span><strong>{report.totalStudents}</strong></div></div><div className="exam-card exam-student-report-card"><div className="exam-card-heading"><h2>Student Performance</h2></div><div className="exam-report-table-wrap"><table><thead><tr><th className="exam-sticky-col">Student</th>{report.tests.map((test) => <th key={test.id} title={test.name}><span className="exam-test-header">{test.name}</span><small>{test.maximumMarks} marks</small></th>)}<th>Overall %</th></tr></thead><tbody>{pagedStudents.length ? pagedStudents.map((student) => <tr key={student.studentId}><td className="exam-sticky-col"><strong>{student.studentName}</strong><small>{student.studentId || '-'}</small></td>{student.tests.map((result) => <td key={result.testId}>{result.status === 'NOT_APPLICABLE' ? <span className="exam-not-attempted">-</span> : result.status === 'SUBMITTED' ? <div className="test-result-cell"><div className="test-marks">{result.obtainedMarks} / {result.maximumMarks}</div><div className="test-percentage">{Number(result.percentage || 0).toFixed(2)}%</div></div> : <span className="exam-not-attempted">Not Attempted</span>}</td>)}<td><div className="overall-result-cell"><div className="overall-marks">{student.totalMaximumMarks ? `${student.totalObtainedMarks} / ${student.totalMaximumMarks}` : 'No submitted tests'}</div><div className="overall-percentage">{Number(student.overallPercentage || 0).toFixed(2)}%</div></div></td></tr>) : <tr><td colSpan={report.tests.length + 2} className="exam-empty">No students found for this batch.</td></tr>}</tbody></table></div>{pageCount > 1 && <div className="assessment-reports-pagination"><span>Page {safePage} of {pageCount}</span><div><button type="button" onClick={() => setStudentPage((page) => page - 1)} disabled={safePage === 1}>Previous</button><button type="button" onClick={() => setStudentPage((page) => page + 1)} disabled={safePage === pageCount}>Next</button></div></div>}</div></section>
}

export default FacultyStudentExamReportPage
