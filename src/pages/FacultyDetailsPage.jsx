import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Mail, Phone, UsersRound, ChevronRight } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords } from '../data/courseRecords'
import { loadFacultyRecords } from '../data/facultyRecords'
import { listCourses, normalizeCourseList } from '../services/courseService'
import { listFacultyRecords, normalizeFacultyList } from '../services/facultyService'
import {
  buildFacultyCoursePath,
  getFacultyCourses,
  getFacultyTotals,
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

export function FacultyDetailsPage() {
  const { facultyId = '' } = useParams()
  const navigate = useNavigate()

  const [facultyRecords, setFacultyRecords] = useState([])
  const [courseOptions, setCourseOptions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)

      try {
        const [facultyResult, courseResult] = await Promise.all([
          listFacultyRecords({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ data: loadStoredFaculty() })),
          listCourses({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ data: loadStoredCourses() })),
        ])

        setFacultyRecords(Array.isArray(facultyResult.data) ? facultyResult.data : loadStoredFaculty())
        setCourseOptions(Array.isArray(courseResult.data) ? courseResult.data : loadStoredCourses())
        setError('')
      } catch (nextError) {
        setFacultyRecords(loadStoredFaculty())
        setCourseOptions(loadStoredCourses())
        setError(apiErrorMessage(nextError, 'Unable to load faculty details right now.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()

    const syncFaculty = () => void loadData()
    window.addEventListener(COURSE_RECORD_SYNC_EVENT, syncFaculty)
    window.addEventListener('cispro:faculty-changed', syncFaculty)

    return () => {
      window.removeEventListener(COURSE_RECORD_SYNC_EVENT, syncFaculty)
      window.removeEventListener('cispro:faculty-changed', syncFaculty)
    }
  }, [])

  const selectedFaculty = useMemo(
    () => facultyRecords.find((record) => String(record?.id || '').trim() === String(facultyId || '').trim()) || null,
    [facultyId, facultyRecords],
  )

  const facultyCourses = useMemo(() => getFacultyCourses(selectedFaculty || {}, courseOptions), [courseOptions, selectedFaculty])
  const totals = useMemo(() => getFacultyTotals(selectedFaculty || {}), [selectedFaculty])

  return (
    <section className="faculty-flow-page">
      <div className="faculty-flow-toolbar">
        <Button type="button" variant="ghost" className="faculty-flow-back-button" onClick={() => navigate('/faculty-management')}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </Button>
      </div>

      {error ? (
        <div className="faculty-flow-empty" role="alert">
          <strong>Unable to load faculty</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {!isLoading && !selectedFaculty ? (
        <div className="faculty-flow-empty">
          <strong>Faculty not found</strong>
          <p>The selected faculty record is missing or has been removed.</p>
          <Button type="button" onClick={() => navigate('/faculty-management')}>
            Go back
          </Button>
        </div>
      ) : null}

      {selectedFaculty ? (
        <>
          <article className="faculty-flow-hero panel-card">
            <div className="faculty-flow-hero-main">
              <div className="faculty-flow-avatar" aria-hidden="true">
                <UsersRound />
              </div>
              <div className="faculty-flow-hero-copy">
                <p className="faculty-flow-kicker">Faculty Details</p>
                <h2>{selectedFaculty.facultyName || '-'}</h2>
                <div className="faculty-flow-contact">
                  <span>
                    <Mail size={16} />
                    {selectedFaculty.facultyEmail || '-'}
                  </span>
                  <span>
                    <Phone size={16} />
                    {selectedFaculty.facultyPhone || '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="faculty-flow-stats" aria-label="Faculty summary">
              <div className="faculty-flow-stat">
                <span>Total Courses</span>
                <strong>{totals.courseCount}</strong>
              </div>
              <div className="faculty-flow-stat">
                <span>Total Batches</span>
                <strong>{totals.batchCount}</strong>
              </div>
            </div>
          </article>

          <article className="faculty-flow-section">
            <div className="faculty-flow-section-header">
              <div>
                <h3>Courses Handled</h3>
                <p>Click on any course to view its batches.</p>
              </div>
            </div>

            {facultyCourses.length ? (
              <div className="faculty-flow-course-grid">
                {facultyCourses.map((course) => (
                  <button
                    key={course.courseId}
                    type="button"
                    className="faculty-flow-course-card"
                    onClick={() => navigate(buildFacultyCoursePath(selectedFaculty.id, course.courseId))}
                  >
                    <div className="faculty-flow-course-icon">
                      <BookOpen />
                    </div>
                    <div className="faculty-flow-course-copy">
                      <strong>{course.courseName || course.courseId}</strong>
                      <span>
                        {course.batchCount} Batch{course.batchCount === 1 ? '' : 'es'}
                      </span>
                    </div>
                    <ChevronRight className="faculty-flow-course-chevron" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="faculty-flow-empty">
                <strong>No courses mapped yet</strong>
                <p>This faculty does not have any assigned courses.</p>
              </div>
            )}
          </article>
        </>
      ) : null}
    </section>
  )
}
