import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, ChevronRight, Mail, Phone, UsersRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLoadingState } from '../components/AppLoadingState'
import { Button } from '../components/Button'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords } from '../data/courseRecords'
import { loadFacultyRecords } from '../data/facultyRecords'
import { loadStudentRecords } from '../data/studentRecords'
import { listCourses, normalizeCourseList } from '../services/courseService'
import { listFacultyRecords, normalizeFacultyList } from '../services/facultyService'
import { listStudents, normalizeStudentList } from '../services/studentService'
import {
  buildFacultyBatchPath,
  buildFacultyCourseListPath,
  getFacultyBatchEntriesForCourse,
  getFacultyBatchStudentRecords,
  getFacultyCourseName,
  sortByNameThenTiming,
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

export function CourseBatchesPage() {
  const { facultyId = '', courseId = '' } = useParams()
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
        setError(apiErrorMessage(nextError, 'Unable to load batches right now.'))
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

  const courseName = selectedCourse?.name || getFacultyCourseName(courseId, courseOptions) || selectedCourse?.id || '-'
  const batches = useMemo(
    () => sortByNameThenTiming(getFacultyBatchEntriesForCourse(selectedFaculty || {}, courseId)),
    [courseId, selectedFaculty],
  )
  const batchStudentCounts = useMemo(
    () =>
      batches.map((batch) =>
        getFacultyBatchStudentRecords(students, {
          facultyName: selectedFaculty?.facultyName || '',
          courseId,
          courseName,
          batchName: batch.batchName,
        }).length,
      ),
    [batches, courseId, courseName, selectedFaculty, students],
  )
  const totalStudents = batchStudentCounts.reduce((sum, count) => sum + count, 0)
  const totalBatches = batches.length

  return (
    <section className="faculty-flow-page faculty-course-batches-page">
      <div className="faculty-flow-toolbar">
        <Button type="button" variant="ghost" className="faculty-flow-back-button" onClick={() => navigate(buildFacultyCourseListPath(courseId))}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </Button>
        <button
          type="button"
          className="faculty-flow-link-button faculty-flow-toolbar-link"
          onClick={() => navigate('/faculty-management')}
        >
          Faculty Management
        </button>
      </div>

      {error ? (
        <div className="faculty-flow-empty" role="alert">
          <strong>Unable to load batches</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <article className="faculty-flow-hero panel-card">
        <div className="faculty-flow-hero-main">
          <div className="faculty-flow-avatar" aria-hidden="true">
            <BookOpen />
          </div>
          <div className="faculty-flow-hero-copy">
            <p className="faculty-flow-kicker">Course Batches</p>
            <h2>{isLoading ? 'Loading batches...' : courseName}</h2>
            <div className="faculty-flow-contact">
              <span>
                <UsersRound size={16} />
                {isLoading ? 'Faculty: Loading...' : `Faculty: ${selectedFaculty?.facultyName || '-'}`}
              </span>
              <span>
                <Mail size={16} />
                {isLoading ? 'Loading email...' : (selectedFaculty?.facultyEmail || '-')}
              </span>
              <span>
                <Phone size={16} />
                {isLoading ? 'Loading phone...' : (selectedFaculty?.facultyPhone || '-')}
              </span>
            </div>
          </div>
        </div>

        <div className="faculty-flow-stats" aria-label="Course summary">
          <div className="faculty-flow-stat">
            <span>Total Batches</span>
            <strong>{isLoading ? '—' : totalBatches}</strong>
          </div>
          <div className="faculty-flow-stat">
            <span>Total Students</span>
            <strong>{isLoading ? '—' : totalStudents}</strong>
          </div>
        </div>
      </article>

      {isLoading ? (
        <div className="faculty-flow-loading-slot">
          <AppLoadingState
            title="Loading batches..."
            description="Please wait while we fetch the batches and related student records."
            className="faculty-flow-inline-loading"
          />
        </div>
      ) : null}

      {!isLoading && !selectedFaculty ? (
        <div className="faculty-flow-empty">
          <strong>Faculty not found</strong>
          <p>The selected faculty record is missing or has been removed.</p>
        </div>
      ) : null}

      {!isLoading && selectedFaculty ? (
        <article className="faculty-flow-section">
          <div className="faculty-flow-section-header">
            <div>
              <h3>Batches for {courseName}</h3>
              <p>Click on any batch to view students.</p>
            </div>
          </div>

          {batches.length ? (
            <div className="faculty-flow-table-wrap">
              <table className="faculty-flow-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Batch Name</th>
                    <th>Batch Timing</th>
                    <th>Students</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch, index) => {
                    const studentCount = batchStudentCounts[index] || 0

                    return (
                      <tr key={batch.id || `${batch.batchName}-${index}`}>
                        <td>{index + 1}</td>
                        <td>
                          <button
                            type="button"
                            className="faculty-flow-link-button"
                            onClick={() => navigate(buildFacultyBatchPath(selectedFaculty.id, courseId, batch.id))}
                          >
                            {batch.batchName || '-'}
                          </button>
                        </td>
                        <td>{batch.batchTiming || '-'}</td>
                        <td>{studentCount}</td>
                        <td>
                          <button
                            type="button"
                            className="faculty-flow-mini-button"
                            onClick={() => navigate(buildFacultyBatchPath(selectedFaculty.id, courseId, batch.id))}
                          >
                            View Students
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="faculty-flow-empty">
              <strong>No batches mapped for this course</strong>
              <p>Add a batch under this course from the faculty record to continue.</p>
            </div>
          )}
        </article>
      ) : null}
    </section>
  )
}
