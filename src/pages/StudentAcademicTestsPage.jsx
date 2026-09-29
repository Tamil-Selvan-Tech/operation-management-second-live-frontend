import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { getStudentAcademicTest, getStudentAcademicTestResult, listStudentAcademicTests, startStudentAcademicTest, submitStudentAcademicProject, submitStudentAcademicTest } from '../services/academicTestService'
import '../styles/ExamsPage.css'
import '../styles/StudentAcademicTestsPage.css'

const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '-'
const projectStatus = (test) => {
  if (test.status === 'CANCELLED') return 'CANCELLED'
  if (!test.projectStartDate || !test.projectEndDate) return 'NOT_AVAILABLE'
  const today = new Date().toISOString().slice(0, 10)
  if (today < test.projectStartDate) return 'UPCOMING'
  if (today > test.projectEndDate) return 'EXPIRED'
  return 'AVAILABLE'
}

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
  const [activeTab, setActiveTab] = useState('test')
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [academicPage, setAcademicPage] = useState(1)
  const [projectSubmittingId, setProjectSubmittingId] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectSubmitTarget, setProjectSubmitTarget] = useState(null)
  const [projectFile, setProjectFile] = useState(null)
  const [projectLink, setProjectLink] = useState('')

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
      setActiveQuestionIndex(0)
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

  const submitProject = async (test) => {
    if (!projectFile) { setError('Project file is required.'); return }
    setProjectSubmittingId(test.id)
    setError('')
    try {
      const submission = await submitStudentAcademicProject(test.id, projectFile, projectLink)
      setTests((current) => current.map((item) => item.id === test.id ? { ...item, projectSubmission: submission } : item))
      setProjectSubmitTarget(null); setProjectFile(null); setProjectLink('')
    } catch (e) { setError(e.message || 'Unable to submit project.') } finally { setProjectSubmittingId('') }
  }

  const answeredCount = active ? active.questions.filter((question) => Boolean(answers[question.id])).length : 0
  const resultTest = selectedResultTest
  const resultTotalMarks = selectedResult?.totalMarks ?? resultTest?.totalMarks ?? 0
  const testRows = tests.filter((test) => ['TEST', 'TEST_AND_PROJECT'].includes(test.testType))
  const projectRows = tests.filter((test) => ['PROJECT', 'TEST_AND_PROJECT'].includes(test.testType) && !test.isRetest)
  const academicRows = activeTab === 'project' ? projectRows : testRows
  const academicPageCount = Math.max(1, Math.ceil(academicRows.length / 5))
  const academicPageRows = academicRows.slice((academicPage - 1) * 5, academicPage * 5)
  useEffect(() => { setAcademicPage(1) }, [activeTab])
  useEffect(() => { if (academicPage > academicPageCount) setAcademicPage(academicPageCount) }, [academicPage, academicPageCount])
  useEffect(() => {
    if (!active) return undefined
    const updateTimer = () => {
      const end = new Date(`${active.testDate}T${active.endTime}:00`).getTime()
      setRemainingSeconds(Number.isFinite(end) ? Math.max(0, Math.floor((end - Date.now()) / 1000)) : 0)
    }
    updateTimer()
    const timer = window.setInterval(updateTimer, 1000)
    return () => window.clearInterval(timer)
  }, [active])

  if (active) { const question = active.questions[activeQuestionIndex]; const formatTimer = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`; return <section className={`academic-student-page academic-student-test-page ${embedded ? 'academic-student-page-embedded' : ''}`}>
    <div className="academic-student-test-hero"><button type="button" className="academic-student-exit" onClick={() => setActive(null)}><ArrowLeft size={17} /> Exit Test</button><div className="academic-student-test-hero-main"><div><p className="academic-student-kicker">TEST IN PROGRESS</p><h1>{active.course?.name || '-'} <span>·</span> {active.testName || 'Academic Test'}</h1><div className="academic-student-test-badges"><span>{active.totalQuestions} Questions</span><span>{active.totalMarks} Marks</span></div></div><div className="academic-student-timer"><Clock3 size={24} /><small>TIME REMAINING</small><strong>{formatTimer}</strong></div></div></div>
    <div className="academic-student-question-progress"><strong>Question {activeQuestionIndex + 1} of {active.questions.length}</strong><span>{answeredCount} answered</span></div>
    <div className="academic-student-test-layout"><aside className="academic-student-question-nav"><div><strong>Questions</strong><b>{answeredCount}/{active.questions.length}</b></div><div className="academic-student-question-numbers">{active.questions.map((item, index) => <button key={item.id} type="button" className={`${index === activeQuestionIndex ? 'is-current ' : ''}${answers[item.id] ? 'is-answered' : ''}`} onClick={() => setActiveQuestionIndex(index)}>{index + 1}</button>)}</div><div className="academic-student-question-legend"><span><i className="is-current" />Current</span><span><i className="is-answered" />Answered</span><span><i />Not answered</span></div></aside><div className="academic-student-question-card"><div className="academic-student-question-heading"><p>QUESTION {activeQuestionIndex + 1}</p><span>{active.marksPerQuestion} marks</span></div><h2>{question?.questionText || '-'}</h2><div className="academic-student-options">{['A', 'B', 'C', 'D'].map((letter) => <label key={letter}><input type="radio" name={question?.id} checked={answers[question?.id] === letter} onChange={() => setAnswers((current) => ({ ...current, [question.id]: letter }))} /><b>{letter}.</b><span>{question?.[`option${letter}`]}</span></label>)}</div><div className="academic-student-question-actions"><button type="button" disabled={activeQuestionIndex === 0} onClick={() => setActiveQuestionIndex((index) => index - 1)}><ChevronLeft size={18} /> Previous</button>{activeQuestionIndex === active.questions.length - 1 ? <button type="button" disabled={remainingSeconds <= 0} onClick={() => setShowSubmitConfirm(true)}>Submit Test</button> : <button type="button" onClick={() => setActiveQuestionIndex((index) => index + 1)}>Next <ChevronRight size={18} /></button>}</div></div></div>
    {showSubmitConfirm && createPortal(<div className="student-submit-backdrop"><div className="student-submit-modal">
      <div className="student-submit-icon"><CheckCircle2 size={24} /></div><h2>Submit Test?</h2>
      <p>You have answered {answeredCount} of {active.questions.length} questions. Once submitted, your answers cannot be changed.</p>
      <div><button type="button" className="exam-secondary" onClick={() => setShowSubmitConfirm(false)} disabled={submitting}>Review Answers</button><button type="button" className="exam-primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Confirm Submit'}</button></div>
    </div></div>, document.body)}
  </section> }

  return <section className={`academic-student-page ${embedded ? 'academic-student-page-embedded' : ''}`}>
    <header><p>EXAM CENTER & RESULT</p><h1>Academic Test</h1><span>Only tests assigned to your batch are shown.</span></header>
    {error && <div className="academic-student-error">{error}</div>}
    {resultError && <div className="academic-student-error">{resultError}</div>}
    {projectRows.length > 0 && <div className="academic-student-tabs" role="tablist" aria-label="Academic test type"><button type="button" className={activeTab === 'test' ? 'active' : ''} onClick={() => setActiveTab('test')}>Test</button><button type="button" className={activeTab === 'project' ? 'active' : ''} onClick={() => setActiveTab('project')}>Project</button></div>}
    <div className="academic-student-card"><div className="academic-student-table-wrap"><table>{activeTab === 'project' ? <><thead><tr><th>Test Name</th><th>Course</th><th>Project Start Date</th><th>Project End Date</th><th>Total Project Mark</th><th>Status</th><th>Project Details</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="8">Loading Academic Tests...</td></tr> : projectRows.length ? academicPageRows.map((test) => {
        const submitted = ['SUBMITTED', 'GRADED'].includes(test.projectSubmission?.status)
        const status = submitted ? 'Submitted' : projectStatus(test)
        const available = status === 'AVAILABLE' && test.projectStatus === 'PREPARED'
        return <tr key={test.id}><td>{test.testName || 'Academic Test'}</td><td>{test.course?.name || '-'}</td><td>{dateLabel(test.projectStartDate)}</td><td>{dateLabel(test.projectEndDate)}</td><td>{test.projectMarks ?? 0}</td><td>{status === 'CANCELLED' ? 'Cancelled' : status === 'EXPIRED' ? 'Expired' : status === 'UPCOMING' ? 'Upcoming' : status === 'NOT_AVAILABLE' ? 'Not Available' : status}</td><td><button type="button" className="academic-student-link academic-student-view-project" onClick={() => setSelectedProject(test)}>View Project</button></td><td>{submitted ? <button type="button" className="academic-student-link" disabled>Submitted</button> : <button type="button" className="academic-student-link" disabled={!available || projectSubmittingId === test.id} onClick={() => { setProjectSubmitTarget(test); setError('') }}>{available ? 'Submit Project' : status === 'EXPIRED' ? 'Expired' : status === 'CANCELLED' ? 'Project Cancelled' : 'Upcoming'}</button>}</td></tr>
      }) : <tr><td colSpan="8">No Projects available.</td></tr>}
    </tbody></> : <><thead><tr><th>Test Name</th><th>Course</th><th>Date</th><th>Timing</th><th>Total Questions</th><th>Total Marks</th><th>Status</th><th>Result</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="9">Loading Academic Tests...</td></tr> : testRows.length ? academicPageRows.map((test) => {
        const submitted = test.submission?.status === 'SUBMITTED'
        const notAttended = test.submission?.status === 'NOT_ATTENDED'
        const actionDisabled = !submitted && test.status !== 'AVAILABLE'
        return <tr key={test.id}><td>{test.testName || 'Academic Test'}</td><td>{test.course?.name || '-'}</td><td>{dateLabel(test.testDate)}</td><td>{test.startTime} - {test.endTime}</td><td>{test.totalQuestions}</td><td>{test.totalMarks}</td><td>{submitted ? 'Submitted' : notAttended ? 'Not Attended' : test.status === 'CANCELLED' ? 'Cancelled' : test.status === 'EXPIRED' ? 'Expired' : test.status}</td><td><span className={`academic-student-result-value is-${String(test.submission?.resultStatus || 'none').toLowerCase()}`}>{test.submission?.resultStatus || '-'}</span></td><td>{submitted ? <button type="button" className="academic-student-link" onClick={() => viewResult(test)}>{resultLoading && selectedResultTest?.id === test.id ? 'Loading...' : 'View Result'}</button> : <button type="button" className="academic-student-link" disabled={actionDisabled} onClick={() => start(test)}>{test.status === 'AVAILABLE' ? 'Start Test' : notAttended ? 'Not Attended' : test.status === 'CANCELLED' ? 'Test Cancelled' : test.status === 'EXPIRED' ? 'Expired' : 'Upcoming'}</button>}</td></tr>
      }) : <tr><td colSpan="9">No Academic Tests available.</td></tr>}
    </tbody></>}</table></div>{academicRows.length > 5 && <div className="academic-student-pagination"><button type="button" disabled={academicPage === 1} onClick={() => setAcademicPage((page) => page - 1)}>Previous</button><span>Page {academicPage} of {academicPageCount}</span><button type="button" disabled={academicPage === academicPageCount} onClick={() => setAcademicPage((page) => page + 1)}>Next</button></div>}</div>
    {projectSubmitTarget && createPortal(<div className="exam-modal-backdrop student-project-modal-backdrop"><div className="exam-modal student-project-modal" onClick={(event) => event.stopPropagation()}>
      <div className="exam-card-heading"><div><p className="exam-kicker">SUBMIT PROJECT</p><h2>{projectSubmitTarget.projectTitle || projectSubmitTarget.testName}</h2><p>Upload your project file. File is required; link is optional.</p></div><button type="button" className="exam-icon-button" onClick={() => { setProjectSubmitTarget(null); setProjectFile(null); setProjectLink('') }} aria-label="Close project submission">×</button></div>
      <div className="student-project-submit-form"><label>Project file <input type="file" accept=".pdf,.doc,.docx,.zip,.jpg,.jpeg,.png" required onChange={(event) => setProjectFile(event.target.files?.[0] || null)} /></label><small>Maximum file size: 20 MB</small><label>Project link (optional) <input type="url" value={projectLink} onChange={(event) => setProjectLink(event.target.value)} placeholder="https://..." /></label><button type="button" className="academic-student-primary" disabled={!projectFile || projectSubmittingId === projectSubmitTarget.id} onClick={() => submitProject(projectSubmitTarget)}>{projectSubmittingId === projectSubmitTarget.id ? 'Uploading...' : 'Submit Project'}</button></div>
    </div></div>, document.body)}
    {selectedProject && createPortal(<div className="exam-modal-backdrop student-project-modal-backdrop"><div className="exam-modal student-project-modal" onClick={(event) => event.stopPropagation()}>
      <div className="exam-card-heading"><div><p className="exam-kicker">PROJECT DETAILS</p><h2>{selectedProject.projectTitle || selectedProject.testName || 'Project'}</h2><p>{selectedProject.course?.name || '-'} · {dateLabel(selectedProject.projectStartDate)} - {dateLabel(selectedProject.projectEndDate)}</p></div><button type="button" className="exam-icon-button" onClick={() => setSelectedProject(null)} aria-label="Close project details">×</button></div>
      <div className="student-project-details"><div><span>Project Marks</span><strong>{selectedProject.projectMarks ?? 0}</strong></div><section><h3>Description</h3><p>{selectedProject.projectDescription || 'No description provided.'}</p></section><section><h3>Requirements</h3><p>{selectedProject.projectRequirements || 'No requirements provided.'}</p></section></div>
    </div></div>, document.body)}
    {selectedResult && createPortal(<div className="exam-modal-backdrop student-result-modal-backdrop" onClick={() => setSelectedResult(null)}><div className="exam-modal student-result-modal" onClick={(event) => event.stopPropagation()}>
      <div className="exam-card-heading"><div><p className="exam-kicker">ACADEMIC TEST RESULT</p><h2>{resultTest?.testName || 'Academic Test'}</h2><p>{resultTest?.course?.name || '-'} · {dateLabel(resultTest?.testDate)} · {resultTest?.startTime || '-'} - {resultTest?.endTime || '-'}</p></div><button type="button" className="exam-icon-button" onClick={() => setSelectedResult(null)} aria-label="Close result">×</button></div>
      <div className="student-result-grid"><div><span>Total Questions</span><strong>{selectedResult.totalQuestions ?? resultTest?.totalQuestions ?? 0}</strong></div><div><span>Answered</span><strong>{selectedResult.attemptedCount ?? 0}</strong></div><div><span>Unanswered</span><strong>{selectedResult.unmarkedCount ?? 0}</strong></div><div><span>Correct</span><strong>{selectedResult.correctCount ?? 0}</strong></div><div><span>Wrong</span><strong>{selectedResult.wrongCount ?? 0}</strong></div><div><span>Total Marks</span><strong>{resultTotalMarks}</strong></div></div>
      <div className="student-result-score"><span>Score</span><strong>{selectedResult.obtainedMarks ?? 0} / {resultTotalMarks}</strong><b>{Number(selectedResult.percentage || 0).toFixed(2)}%</b></div><p className="student-result-status">Status: <strong>Submitted</strong>{selectedResult.resultStatus && <> · Result: <strong className={`academic-student-result-value is-${String(selectedResult.resultStatus).toLowerCase()}`}>{selectedResult.resultStatus}</strong></>}</p>
    </div></div>, document.body)}
  </section>
}
