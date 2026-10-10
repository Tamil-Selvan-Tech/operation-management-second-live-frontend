import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { listFacultyExamBatches, listFacultyExamCourses } from '../services/examService'
import '../styles/FacultyExamCourseGate.css'

/**
 * Keeps the faculty exam pages consistent: course first, batches second,
 * and only then the page-specific exam workspace.
 */
export default function FacultyExamCourseGate({ title = 'Exams and Result', children }) {
  const [courses, setCourses] = useState([])
  const [courseBatchCounts, setCourseBatchCounts] = useState({})
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [openedBatch, setOpenedBatch] = useState(null)
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [batchLoading, setBatchLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const batchRequestsRef = useRef(new Map())
  const getCourseBatches = (courseId) => {
    const key = String(courseId || '').trim()
    if (!batchRequestsRef.current.has(key)) {
      const request = listFacultyExamBatches(courseId).then((items) => Array.isArray(items) ? items : []).catch((e) => {
        batchRequestsRef.current.delete(key)
        throw e
      })
      batchRequestsRef.current.set(key, request)
    }
    return batchRequestsRef.current.get(key)
  }

  useEffect(() => {
    let mounted = true
    listFacultyExamCourses()
      .then(async (items) => {
        const nextCourses = Array.isArray(items) ? items : []
        if (!mounted) return
        setCourses(nextCourses)
        const counts = await Promise.all(nextCourses.map(async (course) => {
          try {
            const courseBatches = await getCourseBatches(course.id)
            return [course.id, courseBatches.length]
          } catch {
            return [course.id, 0]
          }
        }))
        if (mounted) {
          setCourseBatchCounts(Object.fromEntries(counts))
        }
      })
      .catch((e) => { if (mounted) setError(e.message || 'Unable to load assigned courses.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const openBatches = async (course) => {
    setSelectedCourse(course)
    setOpenedBatch(null)
    setBatches([])
    setBatchLoading(true)
    setError('')
    try {
      const items = await getCourseBatches(course.id)
      setBatches(items)
    } catch (e) {
      setError(e.message || 'Unable to load course batches.')
    } finally {
      setBatchLoading(false)
    }
  }

  useEffect(() => {
    const courseId = String(searchParams.get('courseId') || '').trim()
    const batchId = String(searchParams.get('batchId') || '').trim()
    if (!courseId || !batchId || selectedCourse || !courses.length) return
    const course = courses.find((item) => String(item.id || '').trim() === courseId)
    if (!course) return
    let active = true
    // The query parameters represent an external route selection that must be
    // reflected in the gate before loading the selected batch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCourse(course)
    setBatchLoading(true)
    getCourseBatches(course.id)
      .then((items) => {
        if (!active) return
        const nextBatches = Array.isArray(items) ? items : []
        setBatches(nextBatches)
        const batch = nextBatches.find((item) => [item.id, item.batchId].some((value) => String(value || '').trim() === batchId))
        if (batch) setOpenedBatch({ course, batch })
      })
      .catch((e) => { if (active) setError(e.message || 'Unable to load course batches.') })
      .finally(() => { if (active) setBatchLoading(false) })
    return () => { active = false }
  }, [courses, searchParams, selectedCourse])

  if (openedBatch) {
    return <div className="faculty-exam-course-gate faculty-exam-course-content">
      <button type="button" className="faculty-exam-course-back" onClick={() => setOpenedBatch(null)}><ArrowLeft size={16} /> Back to Batches</button>
      {children(openedBatch)}
    </div>
  }

  if (selectedCourse) {
    return <div className="faculty-exam-course-gate">
      <button type="button" className="faculty-exam-course-back" onClick={() => { setSelectedCourse(null); setOpenedBatch(null); setBatches([]); setError('') }}>
        <ArrowLeft size={16} /> Back to Courses
      </button>
      <div className="faculty-exam-course-heading">
        <div><p>SELECTED COURSE</p><h2>{selectedCourse.name || selectedCourse.courseName || '-'}</h2><span>{selectedCourse.courseCode || selectedCourse.id || '-'}</span></div>
        <strong>{batchLoading ? 'Loading batches...' : `${batches.length} batch${batches.length === 1 ? '' : 'es'}`}</strong>
      </div>
      {error && <div className="faculty-exam-course-error">{error}</div>}
      <div className="faculty-exam-course-card">
        <table><thead><tr><th>S.No</th><th>Batch Name</th><th>Batch ID</th><th>Timing</th><th>Actions</th></tr></thead>
          <tbody>{batchLoading ? <tr><td colSpan="5">Loading batches...</td></tr> : batches.length ? batches.map((batch, index) => <tr key={batch.id || batch.batchId || index}><td>{index + 1}</td><td><strong>{batch.batchName || batch.name || '-'}</strong></td><td>{batch.batchId || batch.id || '-'}</td><td>{batch.batchTiming || ([batch.startTime, batch.endTime].filter(Boolean).join(' - ') || '-')}</td><td><button type="button" className="faculty-exam-course-open" onClick={() => setOpenedBatch({ course: selectedCourse, batch })}>Open {title}<ChevronRight size={15} /></button></td></tr>) : <tr><td colSpan="5">No batches assigned to this course.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  }

  return <div className="faculty-exam-course-gate">
    <div className="faculty-exam-course-heading"><div><p>FACULTY WORKSPACE</p><h2>{title}</h2><span>Select a course to view its assigned batches.</span></div></div>
    {error && <div className="faculty-exam-course-error">{error}</div>}
    <div className="faculty-exam-course-card">
      <table><thead><tr><th>S.No</th><th>Course Code</th><th>Course Name</th><th>Total Batches</th><th>Actions</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan="5">Loading assigned courses...</td></tr> : courses.length ? courses.map((course, index) => <tr key={course.id || course.courseCode || index}><td>{index + 1}</td><td><strong>{course.courseCode || course.id || '-'}</strong></td><td>{course.name || course.courseName || '-'}</td><td>{course.totalBatches ?? course.batchCount ?? courseBatchCounts[course.id] ?? 0}</td><td><button type="button" className="faculty-exam-course-open" onClick={() => openBatches(course)}>View Batches <ChevronRight size={15} /></button></td></tr>) : <tr><td colSpan="5">No assigned courses found.</td></tr>}</tbody>
      </table>
    </div>
  </div>
}
