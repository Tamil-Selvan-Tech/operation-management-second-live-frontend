import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Mail, Menu, Phone, UsersRound } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppLoadingState } from '../components/AppLoadingState'
import { Button } from '../components/Button'
import { SearchBar } from '../components/SearchBar'
import { PaginationBar } from '../components/PaginationBar'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords } from '../data/courseRecords'
import { loadFacultyRecords } from '../data/facultyRecords'
import { mergeFacultyWithSnapshot } from '../lib/facultySnapshot'
import { loadStudentSnapshot, mergeStudentsWithSnapshot, saveStudentSnapshot } from '../lib/studentSnapshot'
import { listCourses, normalizeCourseList } from '../services/courseService'
import { listFacultyRecords, normalizeFacultyList } from '../services/facultyService'
import { listStudents } from '../services/studentService'
import {
  buildFacultyCoursePath,
  buildFacultyCourseCatalogPath,
  enrichStudentsWithFacultyReferences,
  getFacultyBatchEntriesForCourse,
  getFacultyCourseIds,
  getFacultyCourseName,
  getUniqueStudentCountForFacultyRecords,
  sortByNameThenTiming,
} from '../lib/facultyFlow'
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

export function FacultyCourseFacultyPage() {
  const { courseId = '' } = useParams()
  const navigate = useNavigate()
  const openMenu = useMobileMenu()

  const [facultyRecords, setFacultyRecords] = useState([])
  const [courseOptions, setCourseOptions] = useState([])
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

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
        setError(apiErrorMessage(nextError, 'Unable to load faculty records right now.'))
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

  const backfilledStudents = useMemo(
    () => enrichStudentsWithFacultyReferences(students, facultyRecords, courseOptions),
    [courseOptions, facultyRecords, students],
  )

  useEffect(() => {
    if (backfilledStudents === students) return
    saveStudentSnapshot(backfilledStudents)
  }, [backfilledStudents, students])

  const selectedCourse = useMemo(
    () => courseOptions.find((course) => String(course?.id || '').trim() === String(courseId || '').trim()) || null,
    [courseId, courseOptions],
  )

  const matchedFaculty = useMemo(() => {
    const normalizedCourseId = String(courseId || '').trim()
    if (!normalizedCourseId) return []

    return facultyRecords
      .filter((record) => getFacultyCourseIds(record, courseOptions).includes(normalizedCourseId))
      .map((record) => {
        const mergedRecord = mergeFacultyWithSnapshot(record) || record
        const batchEntries = getFacultyBatchEntriesForCourse(mergedRecord, normalizedCourseId, courseOptions)
        const courseName = selectedCourse?.name || getFacultyCourseName(normalizedCourseId, courseOptions) || normalizedCourseId
        const studentCount = getUniqueStudentCountForFacultyRecords(backfilledStudents, {
          facultyId: mergedRecord.id || '',
          facultyName: mergedRecord.facultyName || '',
          batchEntries,
        })

        return {
          ...mergedRecord,
          batchEntries: sortByNameThenTiming(batchEntries),
          studentCount,
          courseName,
        }
      })
      .sort((left, right) => String(left.facultyName || '').localeCompare(String(right.facultyName || '')))
  }, [backfilledStudents, courseOptions, courseId, facultyRecords, selectedCourse])

  const filteredFaculty = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return matchedFaculty

    return matchedFaculty.filter((record) => String(record.facultyName || '').toLowerCase().includes(normalizedSearch))
  }, [matchedFaculty, searchTerm])

  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(filteredFaculty.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const visibleFaculty = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return filteredFaculty.slice(start, start + pageSize)
  }, [filteredFaculty, safeCurrentPage])

  const pageList = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const pages = [1]
    const start = Math.max(2, safeCurrentPage - 1)
    const end = Math.min(totalPages - 1, safeCurrentPage + 1)

    if (start > 2) pages.push('left-ellipsis')
    for (let page = start; page <= end; page += 1) pages.push(page)
    if (end < totalPages - 1) pages.push('right-ellipsis')
    pages.push(totalPages)
    return pages
  }, [safeCurrentPage, totalPages])

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <section className="faculty-flow-page faculty-course-faculty-page">
      <div className="faculty-flow-toolbar">
        <button
          type="button"
          className="mobile-menu-button faculty-flow-mobile-menu-button"
          onClick={openMenu}
          aria-label="Open navigation menu"
        >
          <Menu />
        </button>
        <Button type="button" variant="ghost" className="faculty-flow-back-button" onClick={() => navigate(buildFacultyCourseCatalogPath())}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </Button>
        <Link to="/faculty-management" className="faculty-flow-link-button faculty-flow-toolbar-link">
          Faculty Management
        </Link>
      </div>

      {error ? (
        <div className="faculty-flow-empty" role="alert">
          <strong>Unable to load faculty</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <article className="faculty-flow-hero panel-card">
        <div className="faculty-flow-hero-main">
          <div className="faculty-flow-avatar" aria-hidden="true">
            <BookOpen />
          </div>
          <div className="faculty-flow-hero-copy">
            <p className="faculty-flow-kicker">Faculty List</p>
            <h2>{isLoading ? 'Loading course...' : selectedCourse?.name || courseId || 'Course'}</h2>
            <p>
              {isLoading
                ? 'Please wait while we fetch the faculty mapping for this course.'
                : 'Choose a faculty member to view the batches mapped under this course.'}
            </p>
          </div>
        </div>

        <div className="faculty-flow-stats" aria-label="Course summary">
          <div className="faculty-flow-stat">
            <span>Total Faculty</span>
            <strong>{isLoading ? '—' : matchedFaculty.length}</strong>
          </div>
          <div className="faculty-flow-stat">
            <span>Total Students</span>
            <strong>
              {isLoading ? '—' : matchedFaculty.reduce((sum, record) => sum + Number(record.studentCount || 0), 0)}
            </strong>
          </div>
        </div>
      </article>

      {isLoading ? (
        <div className="faculty-flow-loading-slot">
          <AppLoadingState
            title="Loading faculty members..."
            description="Please wait while we fetch the faculty mapping for this course."
            className="faculty-flow-inline-loading"
          />
        </div>
      ) : null}

      {!isLoading && !selectedCourse ? (
        <div className="faculty-flow-empty">
          <strong>Course not found</strong>
          <p>The selected course is missing or has been removed.</p>
        </div>
      ) : null}

      {!isLoading && selectedCourse ? (
        <article className="faculty-flow-section">
          <div className="faculty-course-faculty-toolbar">
            <div className="faculty-course-faculty-summary">
              <p className="faculty-course-faculty-kicker">Faculty Records</p>
              <h3>Faculty Members</h3>
              <p>Search by faculty name and open any record to view batches.</p>
            </div>
            <SearchBar
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value)
                setCurrentPage(1)
              }}
              placeholder="Search faculty name"
              ariaLabel="Search faculty name"
            />
          </div>

          <div className="faculty-flow-course-grid">
            {visibleFaculty.length ? (
              visibleFaculty.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className="faculty-flow-course-card"
                  onClick={() => navigate(buildFacultyCoursePath(record.id, courseId))}
                >
                  <div className="faculty-flow-course-left">
                    <div className="faculty-flow-course-icon">
                      <UsersRound />
                    </div>
                    <div className="faculty-flow-course-copy">
                      <strong>{record.facultyName || '-'}</strong>
                      <span className="faculty-flow-course-badge">
                        <Mail size={14} />
                        {record.facultyEmail || '-'}
                      </span>
                      <p>{record.batchEntries.length} Batch{record.batchEntries.length === 1 ? '' : 'es'}</p>
                    </div>
                  </div>
                  <div className="faculty-flow-course-overview">
                    <div className="faculty-flow-overview-card">
                      <div className="faculty-flow-overview-icon faculty-flow-overview-icon-blue">
                        <Phone size={18} />
                      </div>
                      <div>
                        <span>Phone</span>
                        <strong>{record.facultyPhone || '-'}</strong>
                      </div>
                    </div>
                    <div className="faculty-flow-overview-card">
                      <div className="faculty-flow-overview-icon faculty-flow-overview-icon-green">
                        <UsersRound size={18} />
                      </div>
                      <div>
                        <span>Students</span>
                        <strong>{record.studentCount}</strong>
                      </div>
                    </div>
                  </div>
                  <span className="faculty-flow-course-view-label" aria-hidden="true">
                    View
                  </span>
                </button>
              ))
            ) : (
              <div className="faculty-flow-empty">
                <strong>{searchTerm.trim() ? 'No matching faculty found' : 'No faculty mapped yet'}</strong>
                <p>{searchTerm.trim() ? 'Try a different faculty name.' : 'This course does not have any faculty records assigned.'}</p>
              </div>
            )}
          </div>

          <PaginationBar
            className="app-pagination"
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            pageList={pageList}
            onPageChange={goToPage}
            label="Faculty course faculty pagination"
          />

          {filteredFaculty.length ? (
            <div className="faculty-course-pagination">
              <button type="button" className="pagination-link" onClick={() => goToPage(safeCurrentPage - 1)} disabled={safeCurrentPage === 1}>
                <span aria-hidden="true">&lt;</span>
                <span>Prev</span>
              </button>
              <div className="pagination-pages">
                {pageList.map((page, index) =>
                  typeof page === 'number' ? (
                    <button
                      key={page}
                      type="button"
                      className={`pagination-page ${safeCurrentPage === page ? 'active' : ''}`}
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={`${page}-${index}`} className="pagination-dots">...</span>
                  ),
                )}
              </div>
              <button type="button" className="pagination-link" onClick={() => goToPage(safeCurrentPage + 1)} disabled={safeCurrentPage === totalPages}>
                <span>Next</span>
                <span aria-hidden="true">&gt;</span>
              </button>
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  )
}
