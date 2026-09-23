import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { getStudentTest, getStudentTestResult, listStudentAssessmentReports, listStudentTests, startStudentTest, submitStudentTest } from '../services/examService'
import '../styles/ExamsPage.css'

const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '-'
const letters = ['A', 'B', 'C', 'D']

function scheduleDateTime(date, value) {
  const match = String(value || '').trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/)
  if (!match || !date) return null
  let hour = Number(match[1])
  if (match[3] === 'PM' && hour < 12) hour += 12
  if (match[3] === 'AM' && hour === 12) hour = 0
  const parsed = new Date(`${date}T${String(hour).padStart(2, '0')}:${match[2]}:00+05:30`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatRemaining(seconds) {
  if (seconds == null) return '--:--:--'
  const value = Math.max(0, seconds)
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const secs = value % 60
  return [hours, minutes, secs].map((part) => String(part).padStart(2, '0')).join(':')
}

function StudentAssessmentReportTableView({ embedded, student, navigate, loading, error, reports, selectedModuleId, onSelectModule }) {
  const module = reports?.modules?.find((item) => item.moduleId === selectedModuleId) || reports?.modules?.[0]
  return <section className={`exam-page ${embedded ? 'exam-page-embedded' : ''}`}>
    <header className="exam-page-header"><button className="exam-back" onClick={() => navigate('/student-new-dashboard')}><ArrowLeft size={18} /> Dashboard</button><div><p className="exam-kicker">STUDENT LEARNING</p><h1>Exam Test &amp; Assessment</h1><p>Only tests assigned to your enrolled batch are shown.</p></div></header>
    <div className="student-report-tabs"><button type="button" onClick={() => navigate('/student-new-dashboard/exams?tab=reports&report=tests')}>Test Report</button><button type="button" className="is-active">Assessment Report</button></div>
    {error && <div className="exam-error">{error}</div>}
    <div className="exam-card student-reports-card"><div className="exam-card-heading"><div><h2>Assessment Report</h2><p>Module-wise results for evaluated assessments.</p></div></div>{loading ? <div className="exam-muted">Loading assessment reports...</div> : reports?.modules?.length ? <><div className="student-assessment-module-tabs">{reports.modules.map((item) => <button type="button" key={item.moduleId} className={item.moduleId === module?.moduleId ? 'is-active' : ''} onClick={() => onSelectModule(item.moduleId)}>{item.moduleName}</button>)}</div>{module && <div className="exam-table-wrap"><table className="student-module-report-table student-assessment-report-table"><thead><tr><th>Student Name</th><th>Batch Name</th><th>Course Name</th><th>Module Name</th><th>Total Assessments</th>{module.assessments.map((item, index) => <th key={item.assessmentId}>{item.assessmentName || `Assessment ${index + 1}`}<small>{item.totalMarks} marks</small></th>)}<th>Overall Marks</th><th>Overall Percentage</th></tr></thead><tbody><tr><td>{reports.student?.name || student?.studentName || 'Student'}</td><td>{module.batchName || '-'}</td><td>{module.courseName || '-'}</td><td><strong>{module.moduleName}</strong></td><td><strong>{module.totalAssessments}</strong></td>{module.assessments.map((item) => <td key={item.assessmentId}>{item.status === 'EVALUATED' ? <div className="student-module-test-cell"><strong>{item.marksObtained} / {item.totalMarks}</strong><b>{Number(item.percentage || 0).toFixed(2)}%</b></div> : <span className="exam-muted-cell">{item.status === 'PENDING_EVALUATION' ? 'Pending Evaluation' : 'Not Submitted'}</span>}</td>)}<td>{module.overallTotalMarks ? `${module.overallMarksObtained} / ${module.overallTotalMarks}` : 'Pending Evaluation'}</td><td>{module.overallPercentage != null ? <strong className="student-module-overall">{module.overallPercentage.toFixed(2)}%</strong> : <span className="exam-muted-cell">Pending Evaluation</span>}</td></tr></tbody></table></div>}</> : <div className="exam-muted">No assessment reports available.</div>}</div>
  </section>
}

export function StudentExamsPage({ embedded = false, student = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const requestedTab = query.get('tab') === 'reports' ? 'reports' : 'tests'
  const requestedReportTab = query.get('report') === 'assessments' ? 'assessments' : 'tests'
  const [tests, setTests] = useState([])
  const [active, setActive] = useState(null)
  const [answers, setAnswers] = useState({})
  const [selectedResult, setSelectedResult] = useState(null)
  const [selectedResultTest, setSelectedResultTest] = useState(null)
  const [resultCache, setResultCache] = useState({})
  const [resultLoading, setResultLoading] = useState(false)
  const [resultError, setResultError] = useState('')
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const examTab = requestedTab
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportPage, setReportPage] = useState(1)
  const [testsPage, setTestsPage] = useState(1)
  const [assessmentReports, setAssessmentReports] = useState(null)
  const [assessmentReportLoading, setAssessmentReportLoading] = useState(false)
  const [assessmentReportError, setAssessmentReportError] = useState('')
  const [selectedAssessmentModuleId, setSelectedAssessmentModuleId] = useState('')

  const refresh = async () => {
    try { setTests(await listStudentTests()) } catch (e) { setError(e.message) }
  }

  useEffect(() => {
    let mounted = true
    listStudentTests().then((items) => { if (mounted) setTests(items) }).catch((e) => { if (mounted) setError(e.message) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (examTab !== 'reports' || !tests.length) return undefined
    const submittedTests = tests.filter((test) => test.attempt?.status === 'SUBMITTED')
    if (!submittedTests.length) return undefined
    let mounted = true
    const loadReports = async () => {
      setReportLoading(true)
      setReportError('')
      try {
        const items = await Promise.all(submittedTests.map((test) => getStudentTestResult(test.id)))
        if (mounted) setResultCache((current) => submittedTests.reduce((next, test, index) => ({ ...next, [test.id]: items[index] }), current))
      } catch (e) {
        if (mounted) setReportError(e.message || 'Unable to load test reports.')
      } finally {
        if (mounted) setReportLoading(false)
      }
    }
    loadReports()
    return () => { mounted = false }
  }, [examTab, tests])

  useEffect(() => {
    if (examTab !== 'reports' || requestedReportTab !== 'assessments') return undefined
    let mounted = true
    setAssessmentReportLoading(true)
    setAssessmentReportError('')
    listStudentAssessmentReports().then((data) => {
      if (!mounted) return
      setAssessmentReports(data)
      setSelectedAssessmentModuleId((current) => current && data.modules.some((item) => item.moduleId === current) ? current : data.modules[0]?.moduleId || '')
    }).catch((e) => { if (mounted) setAssessmentReportError(e.message || 'Unable to load assessment reports.') }).finally(() => { if (mounted) setAssessmentReportLoading(false) })
    return () => { mounted = false }
  }, [examTab, requestedReportTab])

  useEffect(() => {
    if (!active) return undefined
    const update = () => {
      const end = scheduleDateTime(active.testDate, active.endTime)
      setTimeRemaining(end ? Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000)) : null)
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [active])

  const open = async (row) => {
    try {
      setError('')
      const detail = await getStudentTest(row.id)
      if (detail.status !== 'AVAILABLE') return setError(detail.status === 'EXPIRED' ? 'Test time expired.' : 'Test is not available yet.')
      await startStudentTest(row.id)
      setActive(detail)
      setAnswers({})
      setCurrentIndex(0)
      setShowSubmitConfirm(false)
    } catch (e) { setError(e.message) }
  }

  const exitTest = () => {
    setActive(null)
    setAnswers({})
    setCurrentIndex(0)
    setShowSubmitConfirm(false)
    setError('')
    refresh()
  }

  const viewResult = async (test) => {
    setResultError('')
    setSelectedResultTest(test)
    if (resultCache[test.id]) {
      setSelectedResult(resultCache[test.id])
      return
    }
    setResultLoading(true)
    try {
      const nextResult = await getStudentTestResult(test.id)
      setResultCache((current) => ({ ...current, [test.id]: nextResult }))
      setSelectedResult(nextResult)
    } catch (e) {
      setResultError(e.message || 'Unable to load this test result.')
    } finally {
      setResultLoading(false)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      await submitStudentTest(active.id, answers)
      const submittedResult = await getStudentTestResult(active.id)
      setResultCache((current) => ({ ...current, [active.id]: submittedResult }))
      setTests((current) => current.map((test) => test.id === active.id
        ? { ...test, attempt: { ...(test.attempt || {}), ...submittedResult, status: 'SUBMITTED' } }
        : test))
      exitTest()
    } catch (e) { setError(e.message) } finally {
      setSubmitting(false)
      setShowSubmitConfirm(false)
    }
  }

  const answeredCount = active ? active.questions.filter((question) => Boolean(answers[question.id])).length : 0
  const currentQuestion = active?.questions[currentIndex]
  const progress = active?.questions.length ? ((currentIndex + 1) / active.questions.length) * 100 : 0
  const timerClass = timeRemaining != null && timeRemaining <= 300 ? 'is-warning' : ''
  const tableRows = useMemo(() => tests, [tests])
  const testsPageCount = Math.max(1, Math.ceil(tableRows.length / 5))
  const currentTestsPage = Math.min(testsPage, testsPageCount)
  const pagedTableRows = tableRows.slice((currentTestsPage - 1) * 5, currentTestsPage * 5)
  const moduleReports = useMemo(() => {
    const groups = new Map()
    tests.filter((test) => test.attempt?.status === 'SUBMITTED').forEach((test) => {
      const resultItem = resultCache[test.id]
      if (!resultItem) return
      const module = resultItem.exam?.module || test.module || {}
      const course = resultItem.exam?.branchCourse || test.course || {}
      const batch = resultItem.schedule?.branchBatch || test.batch || {}
      const moduleName = module.title || module.name || '-'
      const key = `${course.id || course.name || '-'}:${module.id || moduleName}:${batch.id || batch.name || '-'}`
      if (!groups.has(key)) groups.set(key, { courseName: course.name || '-', moduleName, batchName: batch.name || batch.batchName || batch.batchId || student?.batchName || '-', tests: [], obtained: 0, maximum: 0 })
      const group = groups.get(key)
      const obtained = Number(resultItem.obtainedMarks || 0)
      const maximum = Number(resultItem.totalMarks || test.totalMarks || 0)
      group.tests.push({ name: resultItem.exam?.title || test.title || test.name || 'MCQ Test', obtained, maximum, percentage: maximum ? (obtained / maximum) * 100 : 0 })
      group.obtained += obtained
      group.maximum += maximum
    })
    return Array.from(groups.values()).map((group) => ({ ...group, overall: group.maximum ? (group.obtained / group.maximum) * 100 : 0 }))
  }, [resultCache, student, tests])
  const reportTestColumns = useMemo(() => Array.from({ length: Math.max(0, ...moduleReports.map((group) => group.tests.length)) }, (_, index) => index + 1), [moduleReports])
  const reportPageCount = Math.max(1, Math.ceil(moduleReports.length / 5))
  const currentReportPage = Math.min(reportPage, reportPageCount)
  const pagedModuleReports = moduleReports.slice((currentReportPage - 1) * 5, currentReportPage * 5)

  if (examTab === 'reports' && requestedReportTab === 'assessments') return <StudentAssessmentReportTableView embedded={embedded} student={student} navigate={navigate} loading={assessmentReportLoading} error={assessmentReportError} reports={assessmentReports} selectedModuleId={selectedAssessmentModuleId} onSelectModule={setSelectedAssessmentModuleId} />
  if (examTab === 'reports' && requestedReportTab === 'assessments') return <section className={`exam-page ${embedded ? 'exam-page-embedded' : ''}`}>
    <header className="exam-page-header"><button className="exam-back" onClick={() => navigate('/student-new-dashboard')}><ArrowLeft size={18} /> Dashboard</button><div><p className="exam-kicker">STUDENT LEARNING</p><h1>Exam Test &amp; Assessment</h1><p>Only tests assigned to your enrolled batch are shown.</p></div></header>
    <div className="student-report-tabs"><button type="button" onClick={() => navigate('/student-new-dashboard/exams?tab=reports&report=tests')}>Test Report</button><button type="button" className="is-active">Assessment Report</button></div>
    {assessmentReportError && <div className="exam-error">{assessmentReportError}</div>}
    <div className="exam-card student-reports-card"><div className="exam-card-heading"><div><h2>Assessment Report</h2><p>Separate module-wise assessment results.</p></div></div>{assessmentReportLoading ? <div className="exam-muted">Loading assessment reports...</div> : assessmentReports?.modules?.length ? assessmentReports.modules.map((module) => <section className="student-assessment-module-section" key={module.moduleId}><div className="student-assessment-module-heading"><h3>{module.moduleName}</h3><span>{module.totalAssessments} Assessment{module.totalAssessments === 1 ? '' : 's'}</span></div><div className="student-assessment-module-context">{assessmentReports.student?.name || student?.studentName || 'Student'} · {module.batchName || '-'} · {module.courseName || '-'}</div><div className="exam-table-wrap"><table className="student-assessment-row-table"><thead><tr><th>Assessment Name</th><th>Total Marks</th><th>Marks Obtained</th><th>Percentage</th><th>Status</th></tr></thead><tbody>{module.assessments.map((item, index) => <tr key={item.assessmentId}><td><strong>{item.assessmentName || `Assessment ${index + 1}`}</strong></td><td>{item.totalMarks}</td><td>{item.status === 'EVALUATED' ? `${item.marksObtained} / ${item.totalMarks}` : '-'}</td><td>{item.status === 'EVALUATED' ? `${Number(item.percentage || 0).toFixed(2)}%` : '-'}</td><td>{item.status === 'EVALUATED' ? 'Evaluated' : item.status === 'PENDING_EVALUATION' ? 'Pending Evaluation' : 'Not Submitted'}</td></tr>)}</tbody><tfoot><tr><th>Overall</th><th>{module.overallTotalMarks || '-'}</th><th>{module.overallTotalMarks ? `${module.overallMarksObtained} / ${module.overallTotalMarks}` : '-'}</th><th>{module.overallPercentage != null ? `${module.overallPercentage.toFixed(2)}%` : '-'}</th><th>{module.overallPercentage != null ? 'Evaluated' : 'Pending Evaluation'}</th></tr></tfoot></table></div></section>) : <div className="exam-muted">No assessment reports available.</div>}</div>
  </section>

  if (active) return <section className={`exam-page student-test-page ${embedded ? 'exam-page-embedded' : ''}`}>
    <div className="student-test-shell">
      <header className="student-test-header">
        <div className="student-test-heading">
          <button className="exam-back" onClick={exitTest}><ArrowLeft size={17} /> Exit Test</button>
          <p className="exam-kicker">TEST IN PROGRESS</p>
          <h1>{active.course?.name || 'Course'} <span>·</span> {active.module?.title || 'Module'}</h1>
          <div className="student-test-meta"><span>{active.totalQuestions} Questions</span><span>{active.totalMarks} Marks</span></div>
        </div>
        <div className={`student-test-timer ${timerClass}`}><Clock3 size={20} /><div><span>TIME REMAINING</span><strong>{formatRemaining(timeRemaining)}</strong></div></div>
      </header>

      <div className="student-test-progress-row">
        <div><strong>Question {currentIndex + 1} of {active.questions.length}</strong><span>{answeredCount} answered</span></div>
        <div className="student-test-progress"><span style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="student-test-layout">
        <aside className="student-question-navigator">
          <div className="student-section-heading"><h2>Questions</h2><span>{answeredCount}/{active.questions.length}</span></div>
          <div className="student-question-numbers">
            {active.questions.map((question, index) => <button key={question.id} className={`${index === currentIndex ? 'is-current' : ''} ${answers[question.id] ? 'is-answered' : ''}`} onClick={() => setCurrentIndex(index)} aria-label={`Go to question ${index + 1}`}>{answers[question.id] ? <CheckCircle2 size={14} /> : index + 1}</button>)}
          </div>
          <div className="student-question-legend"><span><i className="legend-current" /> Current</span><span><i className="legend-answered" /> Answered</span><span><i className="legend-unanswered" /> Not answered</span></div>
        </aside>

        <main className="student-question-card">
          <div className="student-question-card-top"><span>QUESTION {currentIndex + 1}</span><strong>{active.marksPerQuestion} marks</strong></div>
          <h2>{currentQuestion?.question}</h2>
          <div className="student-answer-options">
            {letters.map((letter) => <label key={letter} className={answers[currentQuestion.id] === letter ? 'is-selected' : ''}>
              <input type="radio" name={currentQuestion.id} value={letter} checked={answers[currentQuestion.id] === letter} onChange={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: letter }))} />
              <span className="student-answer-radio" /><span><b>{letter}.</b> {currentQuestion[`option${letter}`]}</span>
            </label>)}
          </div>
          <div className="student-question-actions">
            <button className="exam-secondary" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}><ChevronLeft size={17} /> Previous</button>
            {currentIndex < active.questions.length - 1 ? <button className="exam-primary" onClick={() => setCurrentIndex((index) => Math.min(active.questions.length - 1, index + 1))}>Next <ChevronRight size={17} /></button> : <button className="exam-primary student-submit-button" onClick={() => setShowSubmitConfirm(true)}>Submit Test</button>}
          </div>
        </main>
      </div>
    </div>

    {showSubmitConfirm && createPortal(
      <div className="student-submit-backdrop">
        <div className="student-submit-modal">
          <div className="student-submit-icon"><CheckCircle2 size={24} /></div>
          <h2>Submit Test?</h2>
          <p>You have answered {answeredCount} of {active.questions.length} questions. Are you sure you want to submit your test?</p>
          <div>
            <button className="exam-secondary" onClick={() => setShowSubmitConfirm(false)} disabled={submitting}>Cancel</button>
            <button className="exam-primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Test'}</button>
          </div>
        </div>
      </div>,
      document.body,
    )}
  </section>

  return <section className={`exam-page ${embedded ? 'exam-page-embedded' : ''}`}>
    <header className="exam-page-header"><button className="exam-back" onClick={() => navigate('/student-new-dashboard')}><ArrowLeft size={18} /> Dashboard</button><div><p className="exam-kicker">STUDENT LEARNING</p><h1>Exam Test &amp; Assessment</h1><p>Only tests assigned to your enrolled batch are shown.</p></div></header>
    {error && <div className="exam-error">{error}</div>}
    {resultError && <div className="exam-error">{resultError}</div>}
    {examTab === 'reports' && <div className="student-report-tabs"><button type="button" className={requestedReportTab === 'tests' ? 'is-active' : ''} onClick={() => navigate('/student-new-dashboard/exams?tab=reports&report=tests')}>Test Report</button><button type="button" onClick={() => navigate('/student-new-dashboard/exams?tab=reports&report=assessments')}>Assessment Report</button></div>}
    {examTab === 'tests' ? <div className="exam-card"><div className="exam-table-wrap"><table><thead><tr><th>Test</th><th>Course</th><th>Module</th><th>Date</th><th>Timing</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{tableRows.length ? pagedTableRows.map((test) => {
      const submitted = test.attempt?.status === 'SUBMITTED'
      return <tr key={test.id}><td>{test.title || test.name || 'MCQ Test'}</td><td>{test.course?.name}</td><td>{test.module?.title}</td><td>{dateLabel(test.testDate)}</td><td>{test.startTime} - {test.endTime}</td><td>{test.totalMarks}</td><td>{submitted ? 'Submitted' : test.status}</td><td>{submitted ? <button className="exam-link" onClick={() => viewResult(test)} disabled={resultLoading && selectedResultTest?.id === test.id}>{resultLoading && selectedResultTest?.id === test.id ? 'Loading...' : 'View Result'}</button> : <button className="exam-link" disabled={test.status !== 'AVAILABLE'} onClick={() => open(test)}>{test.status === 'AVAILABLE' ? 'Start Test' : test.status === 'EXPIRED' ? 'Expired' : 'Upcoming'}</button>}</td></tr>
    }) : <tr><td colSpan="8" className="exam-empty">No tests available</td></tr>}</tbody></table></div></div> : <div className="exam-card student-reports-card"><div className="exam-card-heading"><div><h2>Reports</h2><p>Module-wise results for submitted tests.</p></div></div>{reportError && <div className="exam-error">{reportError}</div>}{reportLoading ? <div className="exam-muted">Loading reports...</div> : moduleReports.length ? <><div className="exam-table-wrap"><table className="student-module-report-table"><thead><tr><th>Student Name</th><th>Batch Name</th><th>Course Name</th><th>Module Name</th><th>Total Tests</th>{reportTestColumns.map((number) => <th key={number}>Test {number}</th>)}<th>Overall Percentage</th></tr></thead><tbody>{pagedModuleReports.map((group) => <tr key={`${group.courseName}-${group.moduleName}-${group.batchName}`}><td>{student?.studentName || student?.name || 'Student'}</td><td>{group.batchName}</td><td>{group.courseName}</td><td><strong>{group.moduleName}</strong></td><td><strong>{group.tests.length}</strong></td>{reportTestColumns.map((number) => { const test = group.tests[number - 1]; return <td key={number}>{test ? <div className="student-module-test-cell"><strong>{test.obtained} / {test.maximum}</strong><b>{test.percentage.toFixed(2)}%</b></div> : <span className="exam-muted-cell">—</span>}</td> })}<td><strong className="student-module-overall">{group.overall.toFixed(2)}%</strong></td></tr>)}</tbody></table></div><div className="student-report-pagination"><span>Page {currentReportPage} of {reportPageCount}</span><button className="exam-secondary" disabled={currentReportPage === 1} onClick={() => setReportPage((page) => Math.max(1, page - 1))}>Previous</button><button className="exam-primary" disabled={currentReportPage === reportPageCount} onClick={() => setReportPage((page) => Math.min(reportPageCount, page + 1))}>Next</button></div></> : <div className="exam-muted">No submitted test reports available.</div>}</div>}
    {examTab === 'tests' && tableRows.length ? <div className="student-report-pagination student-tests-pagination"><span>Page {currentTestsPage} of {testsPageCount}</span><button className="exam-secondary" disabled={currentTestsPage === 1} onClick={() => setTestsPage((page) => Math.max(1, page - 1))}>Previous</button><button className="exam-primary" disabled={currentTestsPage === testsPageCount} onClick={() => setTestsPage((page) => Math.min(testsPageCount, page + 1))}>Next</button></div> : null}
    {selectedResult && createPortal(
      <div className="exam-modal-backdrop student-result-modal-backdrop">
        <div className="exam-modal student-result-modal" onClick={(event) => event.stopPropagation()}>
          <div className="exam-card-heading"><div><h2>{selectedResult.exam?.title || selectedResultTest?.title || selectedResultTest?.name || 'MCQ Test'}</h2><p>{selectedResult.exam?.branchCourse?.name || selectedResultTest?.course?.name || '-'} · {selectedResult.exam?.module?.title || selectedResultTest?.module?.title || '-'}</p><p>{dateLabel(selectedResult.schedule?.testDate || selectedResultTest?.testDate)} · {selectedResult.schedule?.startTime || selectedResultTest?.startTime || '-'} - {selectedResult.schedule?.endTime || selectedResultTest?.endTime || '-'}</p></div><button className="exam-icon-button" onClick={() => setSelectedResult(null)} aria-label="Close result">×</button></div>
          <div className="student-result-grid"><div><span>Total Questions</span><strong>{selectedResult.totalQuestions ?? selectedResultTest?.totalQuestions ?? 0}</strong></div><div><span>Answered</span><strong>{selectedResult.attemptedQuestions ?? 0}</strong></div><div><span>Unanswered</span><strong>{selectedResult.unansweredQuestions ?? 0}</strong></div><div><span>Correct</span><strong>{selectedResult.correctAnswers ?? 0}</strong></div><div><span>Wrong</span><strong>{selectedResult.wrongAnswers ?? 0}</strong></div><div><span>Total Marks</span><strong>{selectedResult.totalMarks ?? selectedResultTest?.totalMarks ?? 0}</strong></div></div>
          <div className="student-result-score"><span>Score</span><strong>{selectedResult.obtainedMarks ?? 0} / {selectedResult.totalMarks ?? selectedResultTest?.totalMarks ?? 0}</strong><b>{Number(selectedResult.percentage || 0).toFixed(2)}%</b></div>
          <p className="student-result-status">Status: <strong>{selectedResult.status === 'SUBMITTED' ? 'Submitted' : selectedResult.status || 'Submitted'}</strong></p>
        </div>
      </div>,
      document.body,
    )}
  </section>
}

export default StudentExamsPage
