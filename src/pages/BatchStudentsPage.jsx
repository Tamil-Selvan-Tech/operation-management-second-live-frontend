import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Mail, Phone, UserRound, UsersRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords } from '../data/courseRecords'
import { loadFacultyRecords } from '../data/facultyRecords'
import { loadStudentRecords } from '../data/studentRecords'
import { listCourses, normalizeCourseList } from '../services/courseService'
import { listFacultyRecords, normalizeFacultyList } from '../services/facultyService'
import { listStudents, normalizeStudentList } from '../services/studentService'
import {
  buildFacultyCoursePath,
  buildStudentManagementPath,
  getFacultyBatchEntryById,
  getFacultyCourseName,
  getMatchingStudents,
} from '../lib/facultyFlow'

function apiErrorMessage(error, fallback) {
  return error?.body?.message || error?.message || fallback
}

function loadStoredCourses() {
  return normalizeCourseList(loadCourseRecords())
}

function loadStoredFaculty() {
  return normalizeFacultyList(loadFacultyRecords())
}

function loadStoredStudents() {
  return normalizeStudentList(loadStudentRecords())
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function BatchStudentsPage() {
  const { facultyId = '', courseId = '', batchId = '' } = useParams()
  const navigate = useNavigate()

  const [facultyRecords, setFacultyRecords] = useState([])
  const [courseOptions, setCourseOptions] = useState([])
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)

      try {
        const [facultyResult, courseResult, studentResult] = await Promise.all([
          listFacultyRecords({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ data: loadStoredFaculty() })),
          listCourses({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ data: loadStoredCourses() })),
          listStudents({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ data: loadStoredStudents() })),
        ])

        setFacultyRecords(Array.isArray(facultyResult.data) ? facultyResult.data : loadStoredFaculty())
        setCourseOptions(Array.isArray(courseResult.data) ? courseResult.data : loadStoredCourses())
        setStudents(Array.isArray(studentResult.data) ? studentResult.data : loadStoredStudents())
        setError('')
      } catch (nextError) {
        setFacultyRecords(loadStoredFaculty())
        setCourseOptions(loadStoredCourses())
        setStudents(loadStoredStudents())
        setError(apiErrorMessage(nextError, 'Unable to load batch students right now.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()

    const syncData = () => void loadData()
    window.addEventListener(COURSE_RECORD_SYNC_EVENT, syncData)
    window.addEventListener('cispro:faculty-changed', syncData)
    window.addEventListener('cispro:students-changed', syncData)

    return () => {
      window.removeEventListener(COURSE_RECORD_SYNC_EVENT, syncData)
      window.removeEventListener('cispro:faculty-changed', syncData)
      window.removeEventListener('cispro:students-changed', syncData)
    }
  }, [])

  const selectedFaculty = useMemo(
    () => facultyRecords.find((record) => String(record?.id || '').trim() === String(facultyId || '').trim()) || null,
    [facultyId, facultyRecords],
  )

  const selectedCourse = useMemo(
    () =>
      courseOptions.find((course) => String(course?.id || '').trim() === String(courseId || '').trim()) ||
      null,
    [courseId, courseOptions],
  )

  const selectedBatch = useMemo(
    () => getFacultyBatchEntryById(selectedFaculty || {}, batchId),
    [batchId, selectedFaculty],
  )

  const courseName = selectedCourse?.name || getFacultyCourseName(courseId, courseOptions) || selectedCourse?.id || '-'
  const batchName = selectedBatch?.batchName || '-'
  const batchTiming = selectedBatch?.batchTiming || '-'
  const matchingStudents = useMemo(
    () =>
      getMatchingStudents(students, {
        facultyName: selectedFaculty?.facultyName || '',
        courseId,
        courseName,
        batchName,
      }),
    [batchName, courseId, courseName, selectedFaculty, students],
  )

  return (
    <section className="faculty-flow-page">
      <div className="faculty-flow-toolbar">
        <Button
          type="button"
          variant="ghost"
          className="faculty-flow-back-button"
          onClick={() => navigate(buildFacultyCoursePath(facultyId, courseId))}
        >
          <ArrowLeft size={18} />
          <span>Back</span>
        </Button>
      </div>

      {error ? (
        <div className="faculty-flow-empty" role="alert">
          <strong>Unable to load students</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {!isLoading && (!selectedFaculty || !selectedBatch) ? (
        <div className="faculty-flow-empty">
          <strong>Batch not found</strong>
          <p>The selected batch is missing or has been removed.</p>
        </div>
      ) : null}

      {!isLoading && selectedFaculty && selectedBatch ? (
        <>
          <article className="faculty-flow-hero panel-card">
            <div className="faculty-flow-hero-main">
              <div className="faculty-flow-avatar" aria-hidden="true">
                <UsersRound />
              </div>
              <div className="faculty-flow-hero-copy">
                <p className="faculty-flow-kicker">Batch Students</p>
                <h2>{batchName}</h2>
                <div className="faculty-flow-contact">
                  <span>
                    <UserRound size={16} />
                    Faculty: {selectedFaculty.facultyName || '-'}
                  </span>
                  <span>
                    <BookOpen size={16} />
                    Course: {courseName}
                  </span>
                  <span>
                    <Phone size={16} />
                    Timing: {batchTiming}
                  </span>
                  <span>
                    <Mail size={16} />
                    Total Students: {matchingStudents.length}
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article className="faculty-flow-section">
            <div className="faculty-flow-section-header">
              <div>
                <h3>Students in {batchName}</h3>
                <p>These students match the selected faculty, course, and batch.</p>
              </div>
            </div>

            {matchingStudents.length ? (
              <div className="faculty-flow-table-wrap">
                <table className="faculty-flow-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Admission Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingStudents.map((student, index) => (
                      <tr key={student.id || `${student.studentName}-${index}`}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{student.studentName || '-'}</strong>
                        </td>
                        <td>{student.emailAddress || '-'}</td>
                        <td>{student.mobileNumber || '-'}</td>
                        <td>{formatDate(student.admissionDate)}</td>
                        <td>
                          <span className={`status-pill ${String(student.status || 'Inactive').toLowerCase()}`}>
                            {student.status || 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="faculty-flow-mini-button"
                            onClick={() => navigate(buildStudentManagementPath(student.id))}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="faculty-flow-empty">
                <strong>No students found</strong>
                <p>No student records match this faculty, course, and batch combination.</p>
              </div>
            )}
          </article>
        </>
      ) : null}
    </section>
  )
}
