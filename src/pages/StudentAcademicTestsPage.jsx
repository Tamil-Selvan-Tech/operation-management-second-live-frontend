import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2 } from 'lucide-react'
import { getStudentAcademicTest, getStudentAcademicTestResult, listStudentAcademicTests, startStudentAcademicTest, submitStudentAcademicTest } from '../services/academicTestService'
import '../styles/ExamsPage.css'
import '../styles/StudentAcademicTestsPage.css'

const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '-'

export default function StudentAcademicTestsPage({ embedded = false }) {
  const [tests, setTests] = useState([])
  const [active, setActive] = useState(null)
  const [answers, setAnswers] = useState({})
  const [selectedResult, setSelectedResult] = useState(null)
  const [selectedResultTest, setSelectedResultTest] = useState(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [resultError, setResultError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try { setTests(await listStudentAcademicTests()) } catch (e) { setError(e.message || 'Unable to load Academic Tests.') } finally { if (!silent) setLoading(false) }
  }

  useEffect(() => {
    void load()
    const refreshAvailability = () => { void load({ silent: true }) }
    const intervalId = window.setInterval(refreshAvailability, 15000)
    window.addEventListener('focus', refreshAvailability)
    return () => { window.clearInterval(intervalId); window.removeEventListener('focus', refreshAvailability) }
  }, [])

  const start = async (test) => {
    try {
      setError('')
      const detail = await getStudentAcademicTest(test.id)
      await startStudentAcademicTest(test.id)
      setActive(detail)
      setAnswers({})
      setShowSubmitConfirm(false)
    } catch (e) { setError(e.message || 'This test is not available yet.') }
  }

  const viewResult = async (test, cachedResult = null) => {
    setSelectedResultTest(test)
    setResultError('')
    if (cachedResult) {
      setSelectedResult(cachedResult)
      return
    }
    setSelectedResult(null)
    setResultLoading(true)
    try { setSelectedResult(await getStudentAcademicTestResult(test.id)) } catch (e) { setResultError(e.message || 'Unable to load this test result.') } finally { setResultLoading(false) }
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      await submitStudentAcademicTest(active.id, answers)
      const submittedResult = await getStudentAcademicTestResult(active.id)
      const submittedTest = { ...active, submission: submittedResult, status: 'COMPLETED' }
      setTests((current) => current.map((test) => test.id === active.id ? submittedTest : test))
      setActive(null)
      setAnswers({})
      setShowSubmitConfirm(false)
      await viewResult(submittedTest, submittedResult)
    } catch (e) { setError(e.message || 'Unable to submit test.') } finally { setSubmitting(false) }
  }

  const answeredCount = active ? active.questions.filter((question) => Boolean(answers[question.id])).length : 0
  const resultTest = selectedResultTest
  const resultTotalMarks = selectedResult?.totalMarks ?? resultTest?.totalMarks ?? 0

  if (active) return <section className={`academic-student-page ${embedded ? 'academic-student-page-embedded' : ''}`}>
    <div className="academic-student-test-heading"><h1>{active.testName} · {active.course?.name || '-'}</h1><p>{active.totalQuestions} Questions · {active.totalMarks} Marks · {active.startTime} - {active.endTime}</p></div>
    <div className="academic-student-question-card">
      {active.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.questionText} <small>{active.marksPerQuestion} marks</small></legend>{['A', 'B', 'C', 'D'].map((letter) => <label key={letter}><input type="radio" name={question.id} checked={answers[question.id] === letter} onChange={() => setAnswers((current) => ({ ...current, [question.id]: letter }))} />{letter}. {question[`option${letter}`]}</label>)}</fieldset>)}
      <button type="button" className="academic-student-primary" onClick={() => setShowSubmitConfirm(true)}>Submit Test</button>
    </div>
    {showSubmitConfirm && createPortal(<div className="student-submit-backdrop"><div className="student-submit-modal">
      <div className="student-submit-icon"><CheckCircle2 size={24} /></div><h2>Submit Test?</h2>
      <p>You have answered {answeredCount} of {active.questions.length} questions. Once submitted, your answers cannot be changed.</p>
      <div><button type="button" className="exam-secondary" onClick={() => setShowSubmitConfirm(false)} disabled={submitting}>Review Answers</button><button type="button" className="exam-primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Confirm Submit'}</button></div>
    </div></div>, document.body)}
  </section>

  return <section className={`academic-student-page ${embedded ? 'academic-student-page-embedded' : ''}`}>
    <header><p>EXAM CENTER & RESULT</p><h1>Academic Test</h1><span>Only tests assigned to your batch are shown.</span></header>
    {error && <div className="academic-student-error">{error}</div>}
    {resultError && <div className="academic-student-error">{resultError}</div>}
    <div className="academic-student-card"><div className="academic-student-table-wrap"><table><thead><tr><th>Test Name</th><th>Course</th><th>Date</th><th>Timing</th><th>Total Questions</th><th>Total Marks</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="8">Loading Academic Tests...</td></tr> : tests.length ? tests.map((test) => {
        const submitted = test.submission?.status === 'SUBMITTED'
        const actionDisabled = !submitted && test.status !== 'AVAILABLE'
        return <tr key={test.id}><td>{test.testName || 'Academic Test'}</td><td>{test.course?.name || '-'}</td><td>{dateLabel(test.testDate)}</td><td>{test.startTime} - {test.endTime}</td><td>{test.totalQuestions}</td><td>{test.totalMarks}</td><td>{submitted ? 'Submitted' : test.status === 'CANCELLED' ? 'Cancelled' : test.status === 'EXPIRED' ? 'Expired' : test.status}</td><td>{submitted ? <button type="button" className="academic-student-link" onClick={() => viewResult(test)}>{resultLoading && selectedResultTest?.id === test.id ? 'Loading...' : 'View Result'}</button> : <button type="button" className="academic-student-link" disabled={actionDisabled} onClick={() => start(test)}>{test.status === 'AVAILABLE' ? 'Start Test' : test.status === 'CANCELLED' ? 'Test Cancelled' : test.status === 'EXPIRED' ? 'Expired' : 'Upcoming'}</button>}</td></tr>
      }) : <tr><td colSpan="8">No Academic Tests available.</td></tr>}
    </tbody></table></div></div>
    {selectedResult && createPortal(<div className="exam-modal-backdrop student-result-modal-backdrop" onClick={() => setSelectedResult(null)}><div className="exam-modal student-result-modal" onClick={(event) => event.stopPropagation()}>
      <div className="exam-card-heading"><div><p className="exam-kicker">ACADEMIC TEST RESULT</p><h2>{resultTest?.testName || 'Academic Test'}</h2><p>{resultTest?.course?.name || '-'} · {dateLabel(resultTest?.testDate)} · {resultTest?.startTime || '-'} - {resultTest?.endTime || '-'}</p></div><button type="button" className="exam-icon-button" onClick={() => setSelectedResult(null)} aria-label="Close result">×</button></div>
      <div className="student-result-grid"><div><span>Total Questions</span><strong>{selectedResult.totalQuestions ?? resultTest?.totalQuestions ?? 0}</strong></div><div><span>Answered</span><strong>{selectedResult.attemptedCount ?? 0}</strong></div><div><span>Unanswered</span><strong>{selectedResult.unmarkedCount ?? 0}</strong></div><div><span>Correct</span><strong>{selectedResult.correctCount ?? 0}</strong></div><div><span>Wrong</span><strong>{selectedResult.wrongCount ?? 0}</strong></div><div><span>Total Marks</span><strong>{resultTotalMarks}</strong></div></div>
      <div className="student-result-score"><span>Score</span><strong>{selectedResult.obtainedMarks ?? 0} / {resultTotalMarks}</strong><b>{Number(selectedResult.percentage || 0).toFixed(2)}%</b></div><p className="student-result-status">Status: <strong>Submitted</strong></p>
    </div></div>, document.body)}
  </section>
}
