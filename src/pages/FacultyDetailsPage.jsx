import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, ChevronRight, GraduationCap, Mail, Menu, Phone, UsersRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords } from '../data/courseRecords'
import { loadFacultyRecords } from '../data/facultyRecords'
import { mergeFacultyWithSnapshot } from '../lib/facultySnapshot'
import { loadStudentSnapshot, mergeStudentsWithSnapshot, saveStudentSnapshot } from '../lib/studentSnapshot'
import { listCourses, normalizeCourseList } from '../services/courseService'
import { listFacultyRecords, normalizeFacultyList } from '../services/facultyService'
import { listStudents } from '../services/studentService'
import {
  buildFacultyCoursePath,
  enrichStudentsWithFacultyReferences,
  getFacultyBatchEntriesForCourse,
  getFacultyCourses,
  getFacultyTotals,
  getMatchingStudents,
} from '../lib/facultyFlow'
import { FACULTY_ATTENDANCE_SYNC_EVENT, resolveAnyCurrentFacultyAttendanceStatus } from '../lib/facultyAttendanceStore'
import { useMobileMenu } from '../layouts/mobileMenuContext'

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
  return loadStudentSnapshot() || []
}

function useFacultyAttendanceRefreshToken() {
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncFacultyAttendance = () => {
      setRefreshToken((current) => current + 1)
    }

    window.addEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, syncFacultyAttendance)
    window.addEventListener('storage', syncFacultyAttendance)

    return () => {
      window.removeEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, syncFacultyAttendance)
      window.removeEventListener('storage', syncFacultyAttendance)
    }
  }, [])

  return refreshToken
}

export function FacultyDetailsPage() {
  const { facultyId = '' } = useParams()
  const navigate = useNavigate()
  const openMenu = useMobileMenu()
  const facultyAttendanceRefreshToken = useFacultyAttendanceRefreshToken()

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
        const nextStudents = mergeStudentsWithSnapshot(studentResult.data)
        saveStudentSnapshot(nextStudents)
        setStudents(nextStudents.length ? nextStudents : loadStoredStudents())
        setError('')
      } catch (nextError) {
        setFacultyRecords(loadStoredFaculty())
        setCourseOptions(loadStoredCourses())
        setStudents(loadStoredStudents())
        setError(apiErrorMessage(nextError, 'Unable to load faculty details right now.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()

    const syncFaculty = () => void loadData()
    window.addEventListener(COURSE_RECORD_SYNC_EVENT, syncFaculty)
    window.addEventListener('cispro:faculty-changed', syncFaculty)
    window.addEventListener('cispro:students-changed', syncFaculty)

    return () => {
      window.removeEventListener(COURSE_RECORD_SYNC_EVENT, syncFaculty)
      window.removeEventListener('cispro:faculty-changed', syncFaculty)
      window.removeEventListener('cispro:students-changed', syncFaculty)
    }
  }, [])

  const backfilledStudents = useMemo(
    () => enrichStudentsWithFacultyReferences(students, facultyRecords, courseOptions),
    [courseOptions, facultyRecords, students],
  )

  useEffect(() => {
    if (backfilledStudents === students) return
    saveStudentSnapshot(backfilledStudents)
  }, [backfilledStudents, students])

  const selectedFaculty = useMemo(
    () => mergeFacultyWithSnapshot(facultyRecords.find((record) => String(record?.id || '').trim() === String(facultyId || '').trim()) || null),
    [facultyId, facultyRecords],
  )

  const facultyCourses = useMemo(() => {
    const baseCourses = getFacultyCourses(selectedFaculty || {}, courseOptions)

    return baseCourses.map((course) => {
      const courseBatches = getFacultyBatchEntriesForCourse(selectedFaculty || {}, course.courseId, courseOptions)
      const courseStudents = courseBatches.reduce(
        (sum, batch) =>
          sum +
          getMatchingStudents(backfilledStudents, {
            facultyId: selectedFaculty?.id || '',
            facultyName: selectedFaculty?.facultyName || '',
            courseId: course.courseId,
            courseName: course.courseName,
            batchName: batch.batchName,
            batchId: batch.id,
          }).length,
        0,
      )

      return {
        ...course,
        studentCount: courseStudents,
        batchTiming: courseBatches[0]?.batchTiming || '-',
      }
    })
  }, [backfilledStudents, courseOptions, selectedFaculty])
  const totals = useMemo(() => getFacultyTotals(selectedFaculty || {}, courseOptions), [courseOptions, selectedFaculty])
  const isActive = String(selectedFaculty?.status || 'Active').toLowerCase() === 'active'
  void facultyAttendanceRefreshToken
  const facultyAttendance = resolveAnyCurrentFacultyAttendanceStatus(selectedFaculty?.facultyName || '')

  return (
    <section className="faculty-flow-page">
      <div className="faculty-flow-toolbar">
        <button
          type="button"
          className="mobile-menu-button faculty-flow-mobile-menu-button"
          onClick={openMenu}
          aria-label="Open navigation menu"
        >
          <Menu />
        </button>
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
              <div className="faculty-flow-avatar faculty-flow-avatar-large" aria-hidden="true">
                <UsersRound />
              </div>
              <div className="faculty-flow-hero-copy">
                <p className="faculty-flow-kicker">Faculty Details</p>
                <div className="faculty-flow-title-row">
                  <h2>{selectedFaculty.facultyName || '-'}</h2>
                  <div className="faculty-attendance-stack">
                    <span className={`faculty-flow-status-pill ${isActive ? 'is-active' : 'is-inactive'}`.trim()}>
                      {selectedFaculty.status || 'Active'}
                    </span>
                    <div className="faculty-attendance-inline">
                      <span className="faculty-attendance-inline-label">Today&apos;s Attendance</span>
                      <span className={`status-pill faculty-attendance-pill ${facultyAttendance.status === 'Present' ? 'is-present' : 'is-absent'}`.trim()}>
                        {facultyAttendance.status || 'Absent'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="faculty-flow-contact">
                  <span>
                    <span className="faculty-flow-contact-dot faculty-flow-contact-dot-blue">
                      <Mail size={14} />
                    </span>
                    {selectedFaculty.facultyEmail || '-'}
                  </span>
                  <span>
                    <span className="faculty-flow-contact-dot faculty-flow-contact-dot-blue">
                      <Phone size={14} />
                    </span>
                    {selectedFaculty.facultyPhone || '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="faculty-flow-stats faculty-flow-stats-split" aria-label="Faculty summary">
              <div className="faculty-flow-stat faculty-flow-stat-courses">
                <div className="faculty-flow-stat-icon">
                  <GraduationCap />
                </div>
                <div>
                  <span>Total Courses</span>
                  <strong>{totals.courseCount}</strong>
                  <small>Courses Assigned</small>
                </div>
              </div>
              <div className="faculty-flow-stat faculty-flow-stat-batches">
                <div className="faculty-flow-stat-icon faculty-flow-stat-icon-purple">
                  <UsersRound />
                </div>
                <div>
                  <span>Total Batches</span>
                  <strong>{totals.batchCount}</strong>
                  <small>Batches Assigned</small>
                </div>
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
                    <div className="faculty-flow-course-left">
                      <div className="faculty-flow-course-icon">
                        <BookOpen />
                      </div>
                      <div className="faculty-flow-course-copy">
                        <strong>{course.courseName || course.courseId}</strong>
                        <span className="faculty-flow-course-badge">
                          <UsersRound size={14} />
                          {course.batchCount} Batch{course.batchCount === 1 ? '' : 'es'}
                        </span>
                        <p>View all batches and students under this course.</p>
                      </div>
                    </div>
                    <div className="faculty-flow-course-overview">
                      <div className="faculty-flow-overview-card">
                        <div className="faculty-flow-overview-icon faculty-flow-overview-icon-blue">
                          <UsersRound size={18} />
                        </div>
                        <div>
                          <span>Students</span>
                          <strong>{course.studentCount}</strong>
                        </div>
                      </div>
                      <div className="faculty-flow-overview-card">
                        <div className="faculty-flow-overview-icon faculty-flow-overview-icon-green">
                          <Phone size={18} />
                        </div>
                        <div>
                          <span>Timing</span>
                          <strong>{course.batchTiming}</strong>
                        </div>
                      </div>
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
