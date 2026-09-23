import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { getStudentTest, getStudentTestResult, listStudentTests, startStudentTest, submitStudentTest } from '../services/examService'
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

export function StudentExamsPage({ embedded = false }) {
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [active, setActive] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const refresh = async () => {
    try { setTests(await listStudentTests()) } catch (e) { setError(e.message) }
  }

  useEffect(() => {
    let mounted = true
    listStudentTests().then((items) => { if (mounted) setTests(items) }).catch((e) => { if (mounted) setError(e.message) })
    return () => { mounted = false }
  }, [])

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

  const submit = async () => {
    setSubmitting(true)
    try {
      await submitStudentTest(active.id, answers)
      setResult(await getStudentTestResult(active.id))
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

    {showSubmitConfirm && <div className="student-submit-backdrop"><div className="student-submit-modal"><div className="student-submit-icon"><CheckCircle2 size={24} /></div><h2>Submit Test?</h2><p>You have answered {answeredCount} of {active.questions.length} questions. Are you sure you want to submit your test?</p><div><button className="exam-secondary" onClick={() => setShowSubmitConfirm(false)} disabled={submitting}>Cancel</button><button className="exam-primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Test'}</button></div></div></div>}
  </section>

  return <section className={`exam-page ${embedded ? 'exam-page-embedded' : ''}`}>
    <header className="exam-page-header"><button className="exam-back" onClick={() => navigate('/student-new-dashboard')}><ArrowLeft size={18} /> Dashboard</button><div><p className="exam-kicker">STUDENT LEARNING</p><h1>Exam Test &amp; Assessment</h1><p>Only tests assigned to your enrolled batch are shown.</p></div></header>
    {error && <div className="exam-error">{error}</div>}
    {result && <div className="exam-card result-card"><h2>Test result</h2><p>Score: <strong>{result.obtainedMarks}/{result.totalMarks}</strong> · {Number(result.percentage || 0).toFixed(2)}%</p><p>Correct {result.correctAnswers} · Wrong {result.wrongAnswers} · Unanswered {result.unansweredQuestions}</p></div>}
    <div className="exam-card"><div className="exam-table-wrap"><table><thead><tr><th>Test</th><th>Course</th><th>Module</th><th>Date</th><th>Timing</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{tableRows.length ? tableRows.map((test) => <tr key={test.id}><td>MCQ Test</td><td>{test.course?.name}</td><td>{test.module?.title}</td><td>{dateLabel(test.testDate)}</td><td>{test.startTime} - {test.endTime}</td><td>{test.totalMarks}</td><td>{test.attempt?.status === 'SUBMITTED' ? 'Submitted' : test.status}</td><td><button className="exam-link" disabled={test.status !== 'AVAILABLE' || test.attempt?.status === 'SUBMITTED'} onClick={() => open(test)}>{test.attempt?.status === 'SUBMITTED' ? 'Completed' : test.status === 'AVAILABLE' ? 'Start Test' : test.status === 'EXPIRED' ? 'Expired' : 'Upcoming'}</button></td></tr>) : <tr><td colSpan="8" className="exam-empty">No tests available</td></tr>}</tbody></table></div></div>
  </section>
}

export default StudentExamsPage

