import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Plus, Save, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { downloadQuestionPaperPdf, getAcademicTestPreparation, saveAcademicTestProject, saveQuestionPaper, updateAcademicTestProject, updateQuestionPaper } from '../services/academicTestService'
import '../styles/AcademicTestPreparationPage.css'

const emptyQuestion = () => ({ questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: '' })
const includes = (type, part) => part === 'paper' ? type === 'TEST' || type === 'TEST_AND_PROJECT' : type === 'PROJECT' || type === 'TEST_AND_PROJECT'

function StatusBadge({ value }) { return <span className={`academic-preparation-status is-${String(value || 'NOT_PREPARED').toLowerCase().replaceAll('_', '-')}`}>{String(value || 'NOT_PREPARED').replaceAll('_', ' ')}</span> }

export default function AcademicTestPreparationPage() {
  const { itemId, batchId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [questions, setQuestions] = useState([])
  const [marksPerQuestion, setMarksPerQuestion] = useState(1)
  const [project, setProject] = useState({ projectTitle: '', projectDescription: '', projectRequirements: '', projectMarks: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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
  const totalMarks = useMemo(() => questions.length * Number(marksPerQuestion || 0), [questions.length, marksPerQuestion])
  const updateQuestion = (index, field, value) => setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, [field]: value } : question))
  const savePaper = async (status = 'DRAFT') => { setSaving(true); setError(''); setMessage(''); try { const payload = { academicTestItemId: itemId, branchBatchId: batchId, marksPerQuestion, questions, status }; const next = data?.paper?.id ? await updateQuestionPaper(data.paper.id, payload) : await saveQuestionPaper(payload); setData(next); setQuestions(next.paper?.questions || []); setMessage(status === 'PREPARED' ? 'Question paper prepared successfully.' : 'Question paper draft saved.') } catch (e) { setError(e.message || 'Unable to save question paper.') } finally { setSaving(false) } }
  const saveProject = async (status = 'DRAFT') => { setSaving(true); setError(''); setMessage(''); try { const payload = { academicTestItemId: itemId, branchBatchId: batchId, ...project, status }; const next = data?.project?.id ? await updateAcademicTestProject(data.project.id, payload) : await saveAcademicTestProject(payload); setData(next); setProject(next.project || project); setMessage(status === 'PREPARED' ? 'Project prepared successfully.' : 'Project draft saved.') } catch (e) { setError(e.message || 'Unable to save project.') } finally { setSaving(false) } }
  const downloadPdf = async () => { if (!data?.paper?.id) return; try { const file = await downloadQuestionPaperPdf(data.paper.id); const url = URL.createObjectURL(file.blob); const link = document.createElement('a'); link.href = url; link.download = file.fileName || 'academic-test-question-paper.pdf'; link.click(); URL.revokeObjectURL(url) } catch (e) { setError(e.message || 'Unable to download PDF.') } }
  if (loading) return <section className="academic-preparation-page"><p>Loading preparation details...</p></section>
  if (!data) return <section className="academic-preparation-page"><div className="academic-test-error">{error || 'Preparation details not found.'}</div></section>
  return <section className="academic-preparation-page">
    <button type="button" className="academic-preparation-back" onClick={() => navigate('/dashboard/faculty/exams/academic-tests')}><ArrowLeft size={17} /> Back to Academic Tests</button>
    <header className="academic-preparation-header"><div><p className="academic-test-kicker">FACULTY WORKSPACE</p><h1>Prepare Academic Test</h1><p>{data.course.name} ({data.course.courseCode}) · {data.batch.batchName}</p></div><StatusBadge value={data.status} /></header>
    {error && <div className="academic-test-error">{error}</div>}{message && <div className="academic-preparation-message">{message}</div>}
    <div className="academic-preparation-test-tabs" aria-label="Academic tests">{(data.tests || [data]).map((test) => <button type="button" key={test.academicTestItemId} className={test.academicTestItemId === data.academicTestItemId ? 'is-active' : ''} onClick={() => navigate(`/dashboard/faculty/exams/academic-tests/${test.academicTestItemId}/${batchId}`)}>Test {test.sequence}<StatusBadge value={test.status} /></button>)}</div>
    <div className="academic-preparation-meta"><span>Test {data.sequence}</span><span>Required progress: {data.requiredProgress || 0}%</span><span>Type: {data.testType.replaceAll('_', ' + ')}</span><span>Paper: <StatusBadge value={data.paperStatus} /></span>{data.projectStatus && <span>Project: <StatusBadge value={data.projectStatus} /></span>}</div>
    {includes(data.testType, 'paper') && <article className="academic-preparation-card"><div className="academic-preparation-card-heading"><div><h2>Question Paper</h2><p>Total questions: {questions.length} · Total marks: {totalMarks}</p></div><div className="academic-preparation-actions"><button type="button" onClick={downloadPdf} disabled={!data.paper?.id}><Download size={16} /> PDF</button></div></div><label className="academic-preparation-field compact"><span>Marks per question</span><input type="number" min="1" value={marksPerQuestion} onChange={(event) => setMarksPerQuestion(event.target.value)} /></label><div className="academic-preparation-questions">{questions.map((question, index) => <div className="academic-preparation-question" key={question.id || index}><div className="academic-preparation-question-heading"><strong>Question {index + 1}</strong><button type="button" onClick={() => setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))} aria-label={`Delete question ${index + 1}`}><Trash2 size={16} /></button></div><textarea placeholder="Question text" value={question.questionText} onChange={(event) => updateQuestion(index, 'questionText', event.target.value)} /><div className="academic-preparation-options">{[['optionA', 'Option A'], ['optionB', 'Option B'], ['optionC', 'Option C'], ['optionD', 'Option D']].map(([field, label]) => <input key={field} placeholder={label} value={question[field]} onChange={(event) => updateQuestion(index, field, event.target.value)} />)}</div><label className="academic-preparation-field compact"><span>Correct answer</span><select value={question.correctAnswer} onChange={(event) => updateQuestion(index, 'correctAnswer', event.target.value)}><option value="">Select answer</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label></div>)}<button type="button" className="academic-preparation-add" onClick={() => setQuestions((current) => [...current, emptyQuestion()])}><Plus size={16} /> Add question</button></div><div className="academic-preparation-footer"><button type="button" onClick={() => savePaper('DRAFT')} disabled={saving}><Save size={16} /> Save draft</button><button type="button" className="academic-test-primary" onClick={() => savePaper('PREPARED')} disabled={saving}>Prepare paper</button></div></article>}
    {includes(data.testType, 'project') && <article className="academic-preparation-card"><div className="academic-preparation-card-heading"><div><h2>Project Preparation</h2><p>Prepare the project brief for this test.</p></div></div><div className="academic-preparation-project-grid"><label className="academic-preparation-field"><span>Project title</span><input value={project.projectTitle} onChange={(event) => setProject((current) => ({ ...current, projectTitle: event.target.value }))} /></label><label className="academic-preparation-field"><span>Project marks</span><input type="number" min="1" value={project.projectMarks} onChange={(event) => setProject((current) => ({ ...current, projectMarks: event.target.value }))} /></label></div><label className="academic-preparation-field"><span>Description</span><textarea value={project.projectDescription} onChange={(event) => setProject((current) => ({ ...current, projectDescription: event.target.value }))} /></label><label className="academic-preparation-field"><span>Requirements</span><textarea value={project.projectRequirements || ''} onChange={(event) => setProject((current) => ({ ...current, projectRequirements: event.target.value }))} /></label><div className="academic-preparation-footer"><button type="button" onClick={() => saveProject('DRAFT')} disabled={saving}><Save size={16} /> Save draft</button><button type="button" className="academic-test-primary" onClick={() => saveProject('PREPARED')} disabled={saving}>Prepare project</button></div></article>}
  </section>
}
