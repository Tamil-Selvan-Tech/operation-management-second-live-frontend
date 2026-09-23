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

  useEffect(() => {
    getFacultyStudentExamReport(moduleId, batchId).then(setReport).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [moduleId, batchId])

  if (loading) return <section className={`exam-reports-page ${embedded ? 'exam-page-embedded' : ''}`}><p className="exam-muted">Loading student report...</p></section>
  if (error || !report) return <section className={`exam-reports-page ${embedded ? 'exam-page-embedded' : ''}`}><div className="exam-error">{error || 'Unable to load student report.'}</div><button className="exam-secondary" onClick={() => navigate('/dashboard/faculty/exams/reports')}>Back to Reports</button></section>

  return <section className={`exam-reports-page ${embedded ? 'exam-page-embedded' : ''}`}><button className="exam-back" onClick={() => navigate('/dashboard/faculty/exams/reports')}><ArrowLeft size={18} /> Reports</button><div className="exam-reports-header"><div><p className="exam-kicker">CONSOLIDATED STUDENT REPORT</p><h1>{report.module.name} - {report.batch.name}</h1><p>{report.course?.name || '-'} - {report.batch.timing || '-'}</p></div></div><div className="exam-report-meta"><div><span>Batch ID</span><strong>{report.batch.batchId || '-'}</strong></div><div><span>Total Tests</span><strong>{report.totalTests}</strong></div><div><span>Total Questions</span><strong>{report.totalMcqs}</strong></div><div><span>Total Students</span><strong>{report.totalStudents}</strong></div></div><div className="exam-card exam-student-report-card"><div className="exam-card-heading"><h2>Student Performance</h2></div><div className="exam-report-table-wrap"><table><thead><tr><th className="exam-sticky-col">Student</th><th className="exam-sticky-id">Student ID</th>{report.tests.map((test) => <th key={test.id} title={test.name}><span className="exam-test-header">{test.name}</span><small>{test.maximumMarks} marks</small></th>)}<th>Overall %</th></tr></thead><tbody>{report.students.length ? report.students.map((student) => <tr key={student.studentId}><td className="exam-sticky-col"><strong>{student.studentName}</strong><small>{student.emailAddress || ''}</small></td><td className="exam-sticky-id">{student.studentId}</td>{student.tests.map((result) => <td key={result.testId}>{result.status === 'SUBMITTED' ? <div className="test-result-cell"><div className="test-marks">{result.obtainedMarks} / {result.maximumMarks}</div><div className="test-percentage">{Number(result.percentage || 0).toFixed(2)}%</div></div> : <span className="exam-not-attempted">Not Attempted</span>}</td>)}<td><div className="overall-result-cell"><div className="overall-marks">{student.totalMaximumMarks ? `${student.totalObtainedMarks} / ${student.totalMaximumMarks}` : 'No submitted tests'}</div><div className="overall-percentage">{Number(student.overallPercentage || 0).toFixed(2)}%</div></div></td></tr>) : <tr><td colSpan={report.tests.length + 3} className="exam-empty">No students found for this batch.</td></tr>}</tbody></table></div></div></section>
}

export default FacultyStudentExamReportPage
