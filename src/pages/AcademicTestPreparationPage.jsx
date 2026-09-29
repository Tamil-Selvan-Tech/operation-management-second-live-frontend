import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Ban, CalendarClock, Download, Eye, MoreVertical, Plus, Save, Trash2, X } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { cancelFacultyScheduledAcademicTest, downloadQuestionPaperPdf, getAcademicTestPreparation, getFacultyAcademicTestResults, listFacultyScheduledAcademicTests, saveAcademicTestProject, saveQuestionPaper, scheduleFacultyAcademicTestRetest, updateAcademicTestProject, updateFacultyScheduledAcademicTest, updateQuestionPaper } from '../services/academicTestService'
import '../styles/AcademicTestPreparationPage.css'
import '../styles/AcademicTestSchedule.css'
import AcademicTimePicker from '../components/AcademicTimePicker'

const emptyQuestion = () => ({ questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: '' })
const includes = (type, part) => part === 'paper' ? type === 'TEST' || type === 'TEST_AND_PROJECT' : type === 'PROJECT' || type === 'TEST_AND_PROJECT'

function StatusBadge({ value }) { const label = String(value || 'NOT_PREPARED').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()); return <span className={`academic-preparation-status is-${String(value || 'NOT_PREPARED').toLowerCase().replaceAll('_', '-')}`}>{label}</span> }
const scheduleDateLabel = (value) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '-'
const scheduleTimeLabel = (value) => { const [hours, minutes] = String(value || '').split(':').map(Number); if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value || '-'; const period = hours >= 12 ? 'PM' : 'AM'; return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}` }
const scheduleIsStarted = (schedule) => { const startTime = schedule?.rawStartTime || schedule?.startTime; return schedule && startTime ? new Date(`${schedule.testDate}T${startTime}:00+05:30`).getTime() <= Date.now() : false }
const scheduleIsEnded = (schedule) => { const endTime = schedule?.rawEndTime || schedule?.endTime; return schedule && endTime ? new Date(`${schedule.testDate}T${endTime}:00+05:30`).getTime() < Date.now() : false }
const studentStatusLabel = (entry) => entry.status === 'SUBMITTED' ? 'Submitted' : scheduleIsEnded(entry.schedule) ? 'Not Attended' : scheduleIsStarted(entry.schedule) ? 'In Progress' : 'Not Started'
const academicRetestError = (error, fallback = 'Unable to complete the retest action.') => /originalScheduleId|retestStudentId|Unknown argument|Prisma/i.test(String(error?.message || '')) ? 'Retest is not ready on the server yet. Please refresh the page and try again after the latest backend update is deployed.' : (error?.message || fallback)
const validateQuestionPaper = (questions, marksPerQuestion, status) => {
  if (!Number.isInteger(Number(marksPerQuestion)) || Number(marksPerQuestion) < 1) return 'Marks per question must be at least 1.'
  if (status === 'PREPARED' && !questions.length) return 'Add at least one question before preparing the paper.'
  if (status === 'PREPARED') {
    const incompleteIndex = questions.findIndex((question) => !question.questionText?.trim() || !question.optionA?.trim() || !question.optionB?.trim() || !question.optionC?.trim() || !question.optionD?.trim() || !['A', 'B', 'C', 'D'].includes(question.correctAnswer))
    if (incompleteIndex >= 0) return `Complete all fields for question ${incompleteIndex + 1}.`
  }
  return ''
}

function ScheduleEditorModal({ schedule, form, saving, onChange, onClose, onSave }) {
  return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal" role="dialog" aria-modal="true" aria-labelledby="academic-schedule-title"><div className="academic-preparation-modal-heading"><div><p className="academic-test-kicker">TEST SCHEDULE</p><h2 id="academic-schedule-title">Edit Test Schedule</h2><span>{schedule.batch?.batchName || 'Selected batch'}</span></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close"><X size={19} /></button></div><div className="academic-preparation-schedule-grid"><label>Test date<input type="date" min={new Date().toISOString().slice(0, 10)} value={form.testDate} onChange={(event) => onChange({ ...form, testDate: event.target.value })} /></label><AcademicTimePicker label="Start time" value={form.startTime} onChange={(value) => onChange({ ...form, startTime: value })} /><AcademicTimePicker label="End time" value={form.endTime} onChange={(value) => onChange({ ...form, endTime: value })} /></div><p className="academic-preparation-modal-note">Date and time can be changed only before the test starts. Students will receive the updated schedule when they refresh their test list.</p><div className="academic-preparation-modal-actions"><button type="button" onClick={onClose} disabled={saving}>Keep Schedule</button><button type="button" className="academic-test-primary" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save Schedule'}</button></div></div></div>
}

function LegacyScheduleResultModal({ result, loading, onClose, onScheduleRetest }) {
  if (loading) return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-result-modal"><p className="academic-test-kicker">TEST RESULTS</p><h2>Loading student results...</h2></div></div>
  if (!result) return null
  const schedule = result.test
  const scheduleMeta = result.scheduleMeta || {}
  return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-result-modal" role="dialog" aria-modal="true" aria-labelledby="academic-result-title"><div className="academic-preparation-modal-heading"><div><p className="academic-test-kicker">TEST RESULTS</p><h2 id="academic-result-title">{schedule.testName || 'Academic Test'}</h2><span>{scheduleMeta.batch?.batchName || '-'} · {schedule.course?.name || '-'} · {scheduleDateLabel(schedule.testDate)} · {schedule.startTime} - {schedule.endTime}</span></div><button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><div className="academic-preparation-result-summary"><div><span>Total Questions</span><strong>{schedule.totalQuestions || 0}</strong></div><div><span>Total Marks</span><strong>{schedule.totalMarks || 0}</strong></div><div><span>Students</span><strong>{result.students.length}</strong></div><div><span>Submitted</span><strong>{result.students.filter((entry) => entry.status === 'SUBMITTED').length}</strong></div></div><div className="academic-preparation-result-table-wrap"><table className="academic-preparation-result-table"><thead><tr><th>Student</th><th>Student ID</th><th>Status</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Unanswered</th><th>Marks</th><th>Percentage</th></tr></thead><tbody>{result.students.length ? result.students.map((entry) => <tr key={entry.student.id}><td><strong>{entry.student.studentName || '-'}</strong><small>{entry.student.emailAddress || '-'}</small></td><td>{entry.student.studentId || '-'}</td><td><span className={`academic-preparation-result-status is-${studentStatusLabel({ ...entry, schedule }).toLowerCase().replaceAll(' ', '-')}`}>{studentStatusLabel({ ...entry, schedule })}</span></td><td>{entry.attemptedCount ?? 0}</td><td>{entry.correctCount ?? 0}</td><td>{entry.wrongCount ?? 0}</td><td>{entry.unmarkedCount ?? schedule.totalQuestions}</td><td>{entry.obtainedMarks == null ? '-' : `${entry.obtainedMarks} / ${entry.totalMarks || schedule.totalMarks}`}</td><td>{entry.percentage == null ? '-' : `${Number(entry.percentage).toFixed(2)}%`}</td></tr>) : <tr><td colSpan="9" className="academic-test-empty">No active students found for this batch.</td></tr>}</tbody></table></div></div></div>
}

function CurrentLegacyScheduleResultModal({ result, loading, onClose, onScheduleRetest }) {
  if (loading) return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-result-modal"><p className="academic-test-kicker">TEST RESULTS</p><h2>Loading student results...</h2></div></div>
  if (!result) return null
  const schedule = result.test
  const scheduleMeta = result.scheduleMeta || {}
  return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-result-modal" role="dialog" aria-modal="true" aria-labelledby="academic-result-title"><div className="academic-preparation-modal-heading"><div><p className="academic-test-kicker">TEST RESULTS</p><h2 id="academic-result-title">{schedule.testName || 'Academic Test'}</h2><span>{scheduleMeta.batch?.batchName || '-'} · {schedule.course?.name || '-'} · {scheduleDateLabel(schedule.testDate)} · {schedule.startTime} - {schedule.endTime}</span></div><button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><div className="academic-preparation-result-summary"><div><span>Total Questions</span><strong>{schedule.totalQuestions || 0}</strong></div><div><span>Total Marks</span><strong>{schedule.totalMarks || 0}</strong></div><div><span>Students</span><strong>{result.students.length}</strong></div><div><span>Submitted</span><strong>{result.students.filter((entry) => entry.status === 'SUBMITTED').length}</strong></div></div><div className="academic-preparation-result-table-wrap"><table className="academic-preparation-result-table"><thead><tr><th>Student</th><th>Student ID</th><th>Status</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Unanswered</th><th>Marks</th><th>Percentage</th><th>Actions</th></tr></thead><tbody>{result.students.length ? result.students.map((entry) => { const status = studentStatusLabel({ ...entry, schedule }); const canRetest = status === 'Not Attended' && !entry.retest; return <tr key={entry.student.id}><td><strong>{entry.student.studentName || '-'}</strong><small>{entry.student.emailAddress || '-'}</small></td><td>{entry.student.studentId || '-'}</td><td><span className={`academic-preparation-result-status is-${status.toLowerCase().replaceAll(' ', '-')}`}>{entry.retest ? 'Retest Scheduled' : status}</span></td><td>{entry.attemptedCount ?? 0}</td><td>{entry.correctCount ?? 0}</td><td>{entry.wrongCount ?? 0}</td><td>{entry.unmarkedCount ?? schedule.totalQuestions}</td><td>{entry.obtainedMarks == null ? '-' : `${entry.obtainedMarks} / ${entry.totalMarks || schedule.totalMarks}`}</td><td>{entry.percentage == null ? '-' : `${Number(entry.percentage).toFixed(2)}%`}</td><td>{canRetest ? <button type="button" className="academic-preparation-retest-button" onClick={() => onScheduleRetest(entry)}>Assign Retest</button> : entry.retest ? <small>{entry.retest.schedule?.testDate} · {entry.retest.schedule?.startTime} - {entry.retest.schedule?.endTime}</small> : '-'}</td></tr> }) : <tr><td colSpan="10" className="academic-test-empty">No active students found for this batch.</td></tr>}</tbody></table></div></div></div>
}

const retestScheduleLabel = (schedule) => schedule ? `${scheduleDateLabel(schedule.testDate)} | ${scheduleTimeLabel(schedule.startTime)} - ${scheduleTimeLabel(schedule.endTime)}` : 'Schedule unavailable'

function ScheduleResultModal({ result, loading, onClose, onScheduleRetest }) {
  if (loading) return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-result-modal"><p className="academic-test-kicker">TEST RESULTS</p><h2>Loading student results...</h2></div></div>
  if (!result) return null

  const schedule = result.test
  const scheduleMeta = result.scheduleMeta || {}
  const submittedCount = result.students.filter((entry) => entry.status === 'SUBMITTED').length

  return <div className="academic-preparation-modal-backdrop">
    <div className="academic-preparation-modal academic-preparation-result-modal" role="dialog" aria-modal="true" aria-labelledby="academic-result-title">
      <div className="academic-preparation-modal-heading">
        <div>
          <p className="academic-test-kicker">TEST RESULTS</p>
          <h2 id="academic-result-title">{schedule.testName || 'Academic Test'}</h2>
          <span>{scheduleMeta.batch?.batchName || '-'} | {schedule.course?.name || '-'} | {scheduleDateLabel(schedule.testDate)} | {scheduleTimeLabel(schedule.startTime)} - {scheduleTimeLabel(schedule.endTime)}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
      </div>
      <div className="academic-preparation-result-summary">
        <div><span>Total Questions</span><strong>{schedule.totalQuestions || 0}</strong></div>
        <div><span>Total Marks</span><strong>{schedule.totalMarks || 0}</strong></div>
        <div><span>Students</span><strong>{result.students.length}</strong></div>
        <div><span>Submitted</span><strong>{submittedCount}</strong></div>
      </div>
      <div className="academic-preparation-result-table-wrap">
        <table className="academic-preparation-result-table">
          <thead><tr><th>Student</th><th>Student ID</th><th>Status</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Unanswered</th><th>Marks</th><th>Percentage</th></tr></thead>
          <tbody>
            {result.students.length ? result.students.map((entry) => {
              const status = studentStatusLabel({ ...entry, schedule })
              const retest = entry.retest
              const retestCompleted = retest?.submission?.status === 'SUBMITTED'
              const display = retestCompleted ? retest.submission : entry
              const canRetest = status === 'Not Attended' && !retest
              const displayStatus = retestCompleted ? 'Retest Completed' : retest ? 'Retest Assigned' : status
              const statusClass = displayStatus.toLowerCase().replaceAll(' ', '-')
              return <tr key={entry.student.id}>
                <td><strong>{entry.student.studentName || '-'}</strong><small>{entry.student.emailAddress || '-'}</small></td>
                <td>{entry.student.studentId || '-'}</td>
                <td><span className={`academic-preparation-result-status is-${statusClass}`}>{displayStatus}</span></td>
                <td>{display.attemptedCount ?? 0}</td>
                <td>{display.correctCount ?? 0}</td>
                <td>{display.wrongCount ?? 0}</td>
                <td>{display.unmarkedCount ?? schedule.totalQuestions}</td>
                <td>{display.obtainedMarks == null ? '-' : `${display.obtainedMarks} / ${display.totalMarks || schedule.totalMarks}`}</td>
                <td>
                  {display.percentage == null && !retest ? '-' : display.percentage == null ? null : `${Number(display.percentage).toFixed(2)}%`}
                  {canRetest && <button type="button" className="academic-preparation-retest-button" onClick={() => onScheduleRetest(entry)}>Assign Retest</button>}
                  {retest && !retestCompleted && <span className="academic-preparation-retest-chip" data-tooltip={`Retest scheduled date: ${scheduleDateLabel(retest.schedule?.testDate)}\nRetest scheduled time: ${scheduleTimeLabel(retest.schedule?.startTime)} - ${scheduleTimeLabel(retest.schedule?.endTime)}`} aria-label={`Retest scheduled date: ${scheduleDateLabel(retest.schedule?.testDate)}; Retest scheduled time: ${scheduleTimeLabel(retest.schedule?.startTime)} - ${scheduleTimeLabel(retest.schedule?.endTime)}`}>Retest Assigned</span>}
                </td>
              </tr>
            }) : <tr><td colSpan="9" className="academic-test-empty">No active students found for this batch.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </div>
}

function StudentResultModal({ entry, schedule, onClose }) {
  const status = studentStatusLabel({ ...entry, schedule })
  return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-student-result-modal" role="dialog" aria-modal="true" aria-labelledby="academic-student-result-title"><div className="academic-preparation-modal-heading"><div><p className="academic-test-kicker">STUDENT RESULT</p><h2 id="academic-student-result-title">{entry.student.studentName || 'Student'}</h2><span>{entry.student.studentId || '-'} · {entry.student.emailAddress || '-'}</span></div><button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><div className="academic-preparation-student-result-status"><span>Status</span><strong>{status}</strong></div><div className="academic-preparation-result-summary"><div><span>Attempted</span><strong>{entry.attemptedCount ?? 0}</strong></div><div><span>Correct</span><strong>{entry.correctCount ?? 0}</strong></div><div><span>Wrong</span><strong>{entry.wrongCount ?? 0}</strong></div><div><span>Unanswered</span><strong>{entry.unmarkedCount ?? schedule.totalQuestions}</strong></div><div><span>Marks</span><strong>{entry.obtainedMarks == null ? '-' : `${entry.obtainedMarks} / ${entry.totalMarks || schedule.totalMarks}`}</strong></div><div><span>Percentage</span><strong>{entry.percentage == null ? '-' : `${Number(entry.percentage).toFixed(2)}%`}</strong></div></div><div className="academic-preparation-modal-actions"><button type="button" onClick={onClose}>Close</button></div></div></div>
}

function ScheduleRowActionMenu({ createLabel, onView, onEdit, onEditSchedule, onCancel }) {
  return <div className="academic-evaluation-actions academic-schedule-actions"><button type="button" className="academic-evaluation-create" onClick={onEdit}>{createLabel}</button>{onView && <button type="button" className="academic-evaluation-result" onClick={onView}>View Result</button>}</div>
}

function RetestStudentActions({ result, onSchedule }) {
  const candidates = result.students.filter((entry) => studentStatusLabel({ ...entry, schedule: result.test }) === 'Not Attended' && !entry.retest)
  if (!candidates.length) return null
  return <aside className="academic-preparation-retest-panel"><strong>Retest candidates</strong><span>Students who did not attend the test</span>{candidates.map((entry) => <button type="button" key={entry.student.id} onClick={() => onSchedule(entry)}>Schedule Retest · {entry.student.studentName || entry.student.studentId}</button>)}</aside>
}

function RetestEditorModal({ target, testName, form, saving, error, onChange, onClose, onSave }) {
  return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-retest-modal" role="dialog" aria-modal="true" aria-labelledby="academic-retest-title"><div className="academic-preparation-modal-heading"><div><p className="academic-test-kicker">ACADEMIC TEST RETEST</p><h2 id="academic-retest-title">{testName || 'Academic Test'} - Schedule Retest</h2><span>{target.student.studentName || '-'} · {target.student.studentId || '-'}</span></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close"><X size={19} /></button></div>{error && <div className="academic-test-error">{error}</div>}<p className="academic-preparation-modal-note">This retest is assigned only to this student for <strong>{testName || 'this test'}</strong>. The original test result remains unchanged.</p><div className="academic-preparation-schedule-grid"><label>Retest date<input type="date" min={new Date().toISOString().slice(0, 10)} value={form.testDate} onChange={(event) => onChange({ ...form, testDate: event.target.value })} /></label><AcademicTimePicker label="Start time" value={form.startTime} onChange={(value) => onChange({ ...form, startTime: value })} /><AcademicTimePicker label="End time" value={form.endTime} onChange={(value) => onChange({ ...form, endTime: value })} /></div><div className="academic-preparation-modal-actions"><button type="button" onClick={onClose} disabled={saving}>Keep Result</button><button type="button" className="academic-test-primary" onClick={onSave} disabled={saving}>{saving ? 'Scheduling...' : 'Schedule Retest'}</button></div></div></div>
}

export default function AcademicTestPreparationPage() {
  const { itemId, batchId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [questions, setQuestions] = useState([])
  const [marksPerQuestion, setMarksPerQuestion] = useState(1)
  const [project, setProject] = useState({ projectTitle: '', projectDescription: '', projectRequirements: '', projectMarks: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saveConfirmation, setSaveConfirmation] = useState(null)
  const [prepareConfirmOpen, setPrepareConfirmOpen] = useState(false)
  const [showBuilder, setShowBuilder] = useState(() => searchParams.get('view') === 'builder')
  const [scheduledTests, setScheduledTests] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [scheduleEditor, setScheduleEditor] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({ testDate: '', startTime: '10:00', endTime: '11:00' })
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelBlocked, setCancelBlocked] = useState(false)
  const [resultActionOpen, setResultActionOpen] = useState(false)
  const [retestTarget, setRetestTarget] = useState(null)
  const [retestForm, setRetestForm] = useState({ testDate: '', startTime: '10:00', endTime: '11:00' })
  const [retestSaving, setRetestSaving] = useState(false)
  const [retestError, setRetestError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const next = await getAcademicTestPreparation(itemId, batchId)
      setData(next); setQuestions(next.paper?.questions || []); setMarksPerQuestion(next.paper?.marksPerQuestion || 1); setProject(next.project || { projectTitle: '', projectDescription: '', projectRequirements: '', projectMarks: 0 })
    } catch (e) { setError(e.message || 'Unable to load preparation details.') } finally { setLoading(false) }
  }
  // Loading this route synchronizes the editor with the selected test item/batch.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load() }, [itemId, batchId])
  useEffect(() => {
    listFacultyScheduledAcademicTests().then(setScheduledTests).catch((e) => setError(e.message || 'Unable to load scheduled tests.')).finally(() => setScheduleLoading(false))
  }, [itemId, batchId])
  const totalMarks = useMemo(() => questions.length * Number(marksPerQuestion || 0), [questions.length, marksPerQuestion])
  const updateQuestion = (index, field, value) => setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, [field]: value } : question))
  const performSavePaper = async (status = 'DRAFT') => { const validationError = validateQuestionPaper(questions, marksPerQuestion, status); if (validationError) { setSaveConfirmation(null); setMessage(''); setError(validationError); return } setSaving(true); setSaveConfirmation(null); setError(''); setMessage(''); try { const payload = { academicTestItemId: itemId, branchBatchId: batchId, marksPerQuestion, questions, status }; const next = data?.paper?.id ? await updateQuestionPaper(data.paper.id, payload) : await saveQuestionPaper(payload); const savedQuestions = next.paper?.questions || []; const resultMessage = status === 'PREPARED' ? `Question paper prepared successfully. ${savedQuestions.length} question${savedQuestions.length === 1 ? '' : 's'} saved.` : `Question paper draft saved. ${savedQuestions.length} question${savedQuestions.length === 1 ? '' : 's'} saved.`; setData(next); setQuestions(savedQuestions); setMessage(resultMessage); setSaveConfirmation({ status, count: savedQuestions.length }); if (status === 'PREPARED') { setShowBuilder(false); navigate(`/dashboard/faculty/exams/academic-tests/${itemId}/${batchId}`) } } catch (e) { setError(e.message || 'Unable to save question paper.') } finally { setSaving(false) } }
  const savePaper = (status = 'DRAFT') => status === 'PREPARED' ? setPrepareConfirmOpen(true) : performSavePaper(status)
  const saveProject = async (status = 'DRAFT') => { setSaving(true); setError(''); setMessage(''); try { const payload = { academicTestItemId: itemId, branchBatchId: batchId, ...project, status }; const next = data?.project?.id ? await updateAcademicTestProject(data.project.id, payload) : await saveAcademicTestProject(payload); setData(next); setProject(next.project || project); setMessage(status === 'PREPARED' ? 'Project prepared successfully.' : 'Project draft saved.') } catch (e) { setError(e.message || 'Unable to save project.') } finally { setSaving(false) } }
  const downloadPdf = async () => { if (!data?.paper?.id) return; try { const file = await downloadQuestionPaperPdf(data.paper.id); const url = URL.createObjectURL(file.blob); const link = document.createElement('a'); link.href = url; link.download = file.fileName || 'academic-test-question-paper.pdf'; link.click(); URL.revokeObjectURL(url) } catch (e) { setError(e.message || 'Unable to download PDF.') } }
  const scheduleFor = (test) => scheduledTests.find((schedule) => String(schedule.academicTestItemId) === String(test.academicTestItemId) && String(schedule.batch?.id || schedule.branchBatchId) === String(batchId))
  const openResult = async (schedule) => { setResultLoading(true); setResultActionOpen(false); setError(''); try { const next = await getFacultyAcademicTestResults(schedule.id); setResult({ ...next, test: { ...next.test, rawStartTime: next.test?.startTime, rawEndTime: next.test?.endTime, startTime: scheduleTimeLabel(next.test?.startTime), endTime: scheduleTimeLabel(next.test?.endTime) }, scheduleMeta: schedule }) } catch (e) { setError(academicRetestError(e, 'Unable to load student results.')) } finally { setResultLoading(false) } }
  const openRetest = (entry) => { setRetestError(''); setRetestTarget(entry); setRetestForm({ testDate: '', startTime: '10:00', endTime: '11:00' }) }
  const saveRetest = async () => { if (!retestTarget || !result?.scheduleMeta) return; setRetestSaving(true); setRetestError(''); try { await scheduleFacultyAcademicTestRetest(result.scheduleMeta.id, { studentId: retestTarget.student.id, ...retestForm }); setRetestTarget(null); await openResult(result.scheduleMeta) } catch (e) { setRetestError(academicRetestError(e, 'Unable to schedule retest.')) } finally { setRetestSaving(false) } }
  const openScheduleEditor = (schedule) => { setScheduleEditor(schedule); setScheduleForm({ testDate: schedule.testDate || '', startTime: schedule.startTime || '10:00', endTime: schedule.endTime || '11:00' }) }
  const saveSchedule = async () => { if (!scheduleEditor) return; setScheduleSaving(true); setError(''); try { await updateFacultyScheduledAcademicTest(scheduleEditor.id, scheduleForm); setScheduleEditor(null); setScheduledTests(await listFacultyScheduledAcademicTests()); setMessage('Academic Test schedule updated successfully.') } catch (e) { setError(e.message || 'Unable to update test schedule.') } finally { setScheduleSaving(false) } }
  const cancelSchedule = async () => { if (!cancelTarget) return; setScheduleSaving(true); setError(''); try { await cancelFacultyScheduledAcademicTest(cancelTarget.id); setCancelTarget(null); setScheduledTests(await listFacultyScheduledAcademicTests()); setMessage('Academic Test cancelled successfully.') } catch (e) { setError(e.message || 'Unable to cancel test.') } finally { setScheduleSaving(false) } }
  if (loading) return <section className="academic-preparation-page"><p>Loading preparation details...</p></section>
  if (!data) return <section className="academic-preparation-page"><div className="academic-test-error">{error || 'Preparation details not found.'}</div></section>
  const openBuilder = (test) => { setSaveConfirmation(null); setMessage(''); setError(''); setShowBuilder(true); navigate(`/dashboard/faculty/exams/academic-tests/${test.academicTestItemId}/${batchId}?view=builder`) }
  const tests = (data.tests || [data]).filter((test) => !scheduleFor(test)?.isRetest)
  // The API exposes a derived status (UPCOMING/AVAILABLE/EXPIRED), not the
  // database status (SCHEDULED). A future test can therefore be edited even
  // when its derived status is UPCOMING.
  const resultCanManage = Boolean(result && result.scheduleMeta?.status !== 'CANCELLED' && !scheduleIsStarted(result.test))
  if (resultLoading) return <ScheduleResultModal result={null} loading onClose={() => setResult(null)} />
  if (result && retestTarget) return <RetestEditorModal target={retestTarget} testName={result.test?.testName || `Test ${result.test?.testNumber || ''}`.trim()} form={retestForm} saving={retestSaving} error={retestError} onChange={setRetestForm} onClose={() => setRetestTarget(null)} onSave={saveRetest} />
  if (result) return <><ScheduleResultModal result={result} loading={false} onClose={() => setResult(null)} onScheduleRetest={openRetest} /><div className="academic-preparation-result-actions-overlay"><button type="button" className="academic-preparation-result-menu-button" aria-label="Open test actions" onClick={() => setResultActionOpen((current) => !current)}><MoreVertical size={19} /></button>{resultActionOpen && <div className="academic-preparation-result-menu"><button type="button" disabled={!resultCanManage} onClick={() => { const schedule = result.scheduleMeta; setResult(null); if (schedule?.academicTestItemId) openBuilder({ academicTestItemId: schedule.academicTestItemId }) }}>Edit</button><button type="button" disabled={!resultCanManage} onClick={() => { const schedule = result.scheduleMeta; setResult(null); if (schedule) openScheduleEditor(schedule) }}>Edit Schedule</button><button type="button" className="is-danger" onClick={() => { const schedule = result.scheduleMeta; setResult(null); if (schedule) { if (scheduleIsStarted(schedule)) { setCancelBlocked(true); setCancelTarget(schedule) } else { setError(''); setCancelTarget(schedule) } } }}>Cancel</button></div>}</div></>
  if (cancelBlocked) return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-confirm-modal"><p className="academic-test-kicker">TEST STARTED</p><h2>Cannot cancel this test</h2><p className="academic-preparation-modal-note">The exam has already started, so its schedule cannot be cancelled.</p><div className="academic-preparation-modal-actions"><button type="button" className="academic-test-primary" onClick={() => { setCancelBlocked(false); setCancelTarget(null) }}>Close</button></div></div></div>
  if (scheduleEditor) return <ScheduleEditorModal schedule={scheduleEditor} form={scheduleForm} saving={scheduleSaving} onChange={setScheduleForm} onClose={() => setScheduleEditor(null)} onSave={saveSchedule} />
  if (cancelTarget) return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-confirm-modal"><p className="academic-test-kicker">CANCEL TEST</p><h2>Cancel this scheduled test?</h2>{error && <div className="academic-test-error">{error}</div>}<p className="academic-preparation-modal-note">Students will no longer be able to attend this schedule.</p><div className="academic-preparation-modal-actions"><button type="button" onClick={() => setCancelTarget(null)} disabled={scheduleSaving}>Keep Test</button><button type="button" className="academic-evaluation-cancel" onClick={cancelSchedule} disabled={scheduleSaving}>{scheduleSaving ? 'Cancelling...' : 'Cancel Test'}</button></div></div></div>
  if (prepareConfirmOpen) return <div className="academic-preparation-modal-backdrop"><div className="academic-preparation-modal academic-preparation-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="academic-prepare-confirm-title"><p className="academic-test-kicker">PREPARE QUESTION PAPER</p><h2 id="academic-prepare-confirm-title">Prepare and publish this paper?</h2><p className="academic-preparation-modal-note">After saving, this question paper will be marked as Prepared and you will return to the Academic Test list.</p>{error && <div className="academic-test-error" role="alert">{error}</div>}<div className="academic-preparation-modal-actions"><button type="button" onClick={() => { setPrepareConfirmOpen(false); setError('') }} disabled={saving}>Review Paper</button><button type="button" className="academic-test-primary" onClick={() => { setPrepareConfirmOpen(false); performSavePaper('PREPARED') }} disabled={saving}>{saving ? 'Saving...' : 'Prepare & Save'}</button></div></div></div>
  if (saveConfirmation && showBuilder) return <><section className="academic-preparation-page">{error && <div className="academic-test-error">{error}</div>}{message && <div className="academic-preparation-message">{message}</div>}<div className="academic-preparation-card"><div className="academic-preparation-card-heading"><div><p className="academic-test-kicker">FACULTY WORKSPACE</p><h1>Prepare Academic Test</h1><p>Question paper saved successfully.</p></div><StatusBadge value={saveConfirmation.status} /></div><div className="academic-preparation-save-confirmation"><strong>{saveConfirmation.status === 'PREPARED' ? 'Question paper prepared successfully' : 'Question paper draft saved successfully'}</strong><span>{saveConfirmation.count} question{saveConfirmation.count === 1 ? '' : 's'} saved and available for this test.</span><button type="button" className="academic-test-primary" onClick={() => setSaveConfirmation(null)}>Continue Editing</button></div></div></section></>
  if (!showBuilder) return <section className="academic-preparation-page"><button type="button" className="academic-preparation-back" onClick={() => navigate('/dashboard/faculty/exams/academic-tests?view=list')}><ArrowLeft size={17} /> Back to Academic Tests</button><header className="academic-preparation-header"><div><p className="academic-test-kicker">FACULTY WORKSPACE</p><h1>Question Paper Preparation</h1><p>Manage and prepare evaluations for each batch.</p></div></header>{error && <div className="academic-test-error" role="alert">{error}</div>}{message && <div className="academic-preparation-message" role="status" aria-live="polite">{message}</div>}<div className="academic-evaluation-card"><div className="academic-evaluation-table-wrap"><table className="academic-evaluation-table"><thead><tr><th>Batch Name</th><th>Batch ID</th><th>Course</th><th>Evaluation Type</th><th>Total Marks</th><th>Status</th><th>Actions</th></tr></thead><tbody>{tests.map((test) => { const totalMarks = test.testType === 'TEST_AND_PROJECT' ? Number(test.paper?.totalMarks || 0) + Number(test.project?.projectMarks || 0) : test.testType === 'PROJECT' ? test.project?.projectMarks || '-' : test.paper?.totalMarks || '-'; const evaluationType = test.testType === 'PROJECT' ? `Project ${test.sequence}` : test.testType === 'TEST_AND_PROJECT' ? 'Test + Project' : `Test ${test.sequence}`; const createLabel = test.testType === 'PROJECT' ? 'Create Project' : test.testType === 'TEST_AND_PROJECT' ? 'Create Evaluation' : 'Create Question Paper'; const schedule = scheduleFor(test); return <tr key={test.academicTestItemId}><td>{data.batch.batchName || '-'}</td><td>{data.batch.batchId || data.batch.id || '-'}</td><td>{data.course.name || '-'}<small>{data.course.courseCode || ''}</small></td><td>{evaluationType}</td><td>{totalMarks}</td><td><StatusBadge value={test.status} /></td><td><ScheduleRowActionMenu createLabel={createLabel} onView={schedule ? () => openResult(schedule) : null} onEdit={() => openBuilder(test)} /></td></tr> })}</tbody></table></div></div></section>
  return <section className="academic-preparation-page">
    <button type="button" className="academic-preparation-back" onClick={() => { setShowBuilder(false); navigate(`/dashboard/faculty/exams/academic-tests/${itemId}/${batchId}`) }}><ArrowLeft size={17} /> Question Paper Preparation</button>
    <header className="academic-preparation-header"><div><p className="academic-test-kicker">FACULTY WORKSPACE</p><h1>Prepare Academic Test</h1><p>{data.course.name} ({data.course.courseCode}) · {data.batch.batchName}</p></div><StatusBadge value={data.status} /></header>
    {error && <div className="academic-test-error" role="alert">{error}</div>}{message && <div className="academic-preparation-message" role="status" aria-live="polite">{message}</div>}
    <div className="academic-preparation-meta"><span>Test {data.sequence}</span><span>Required progress: {data.requiredProgress || 0}%</span><span>Type: {data.testType.replaceAll('_', ' + ')}</span><span>Paper: <StatusBadge value={data.paperStatus} /></span>{data.projectStatus && <span>Project: <StatusBadge value={data.projectStatus} /></span>}</div>
    {includes(data.testType, 'paper') && <article className="academic-preparation-card"><div className="academic-preparation-card-heading"><div><h2>Question Paper</h2><p>Total questions: {questions.length} · Total marks: {totalMarks}</p></div><div className="academic-preparation-actions"><button type="button" onClick={downloadPdf} disabled={!data.paper?.id}><Download size={16} /> PDF</button></div></div><label className="academic-preparation-field compact"><span>Marks per question</span><input type="number" min="1" value={marksPerQuestion} onChange={(event) => setMarksPerQuestion(event.target.value)} /></label><div className="academic-preparation-questions">{questions.map((question, index) => <div className="academic-preparation-question" key={question.id || index}><div className="academic-preparation-question-heading"><strong>Question {index + 1}</strong><button type="button" onClick={() => setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))} aria-label={`Delete question ${index + 1}`}><Trash2 size={16} /></button></div><textarea placeholder="Question text" value={question.questionText} onChange={(event) => updateQuestion(index, 'questionText', event.target.value)} /><div className="academic-preparation-options">{[['optionA', 'Option A'], ['optionB', 'Option B'], ['optionC', 'Option C'], ['optionD', 'Option D']].map(([field, label]) => <input key={field} placeholder={label} value={question[field]} onChange={(event) => updateQuestion(index, field, event.target.value)} />)}</div><label className="academic-preparation-field compact"><span>Correct answer</span><select value={question.correctAnswer} onChange={(event) => updateQuestion(index, 'correctAnswer', event.target.value)}><option value="">Select answer</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label></div>)}<button type="button" className="academic-preparation-add" onClick={() => setQuestions((current) => [...current, emptyQuestion()])}><Plus size={16} /> Add question</button></div><div className="academic-preparation-footer"><button type="button" onClick={() => savePaper('DRAFT')} disabled={saving}><Save size={16} /> Save draft</button><button type="button" className="academic-test-primary" onClick={() => savePaper('PREPARED')} disabled={saving}>Prepare paper</button></div></article>}
    {includes(data.testType, 'project') && <article className="academic-preparation-card"><div className="academic-preparation-card-heading"><div><h2>Project Preparation</h2><p>Prepare the project brief for this test.</p></div></div><div className="academic-preparation-project-grid"><label className="academic-preparation-field"><span>Project title</span><input value={project.projectTitle} onChange={(event) => setProject((current) => ({ ...current, projectTitle: event.target.value }))} /></label><label className="academic-preparation-field"><span>Project marks</span><input type="number" min="1" value={project.projectMarks} onChange={(event) => setProject((current) => ({ ...current, projectMarks: event.target.value }))} /></label></div><label className="academic-preparation-field"><span>Description</span><textarea value={project.projectDescription} onChange={(event) => setProject((current) => ({ ...current, projectDescription: event.target.value }))} /></label><label className="academic-preparation-field"><span>Requirements</span><textarea value={project.projectRequirements || ''} onChange={(event) => setProject((current) => ({ ...current, projectRequirements: event.target.value }))} /></label><div className="academic-preparation-footer"><button type="button" onClick={() => saveProject('DRAFT')} disabled={saving}><Save size={16} /> Save draft</button><button type="button" className="academic-test-primary" onClick={() => saveProject('PREPARED')} disabled={saving}>Prepare project</button></div></article>}
  </section>
}
