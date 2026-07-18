import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clock3, Globe2, IndianRupee, Monitor, Search, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import './FacultyCourseCatalogPage.css'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords } from '../data/courseRecords'
import { loadFacultyRecords } from '../data/facultyRecords'
import { listCourses, normalizeCourseList } from '../services/courseService'
import { listFacultyRecords, normalizeFacultyList } from '../services/facultyService'
import { buildFacultyCourseListPath } from '../lib/facultyFlow'

function apiErrorMessage(error, fallback) {
  return error?.body?.message || error?.message || fallback
}

function loadStoredCourses() {
  return normalizeCourseList(loadCourseRecords())
}

function loadStoredFaculty() {
  return normalizeFacultyList(loadFacultyRecords())
}

function formatCurrency(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatHours(value) {
  if (value === '' || value == null) return '-'
  const normalized = String(value).trim()
  return `${normalized} ${normalized === '1' ? 'hour' : 'hours'}`
}

function StatusPill({ status }) {
  return <span className={`faculty-flow-status-pill ${String(status || 'Inactive').toLowerCase()}`.trim()}>{status || 'Inactive'}</span>
}

function buildPageList(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) pages.push('left-ellipsis')
  for (let page = start; page <= end; page += 1) pages.push(page)
  if (end < totalPages - 1) pages.push('right-ellipsis')
  pages.push(totalPages)

  return pages
}

export function FacultyCourseCatalogPage() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [facultyRecords, setFacultyRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)

      try {
        const [courseResult, facultyResult] = await Promise.all([
          listCourses({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ data: loadStoredCourses() })),
          listFacultyRecords({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ data: loadStoredFaculty() })),
        ])

        setCourses(Array.isArray(courseResult.data) ? courseResult.data : loadStoredCourses())
        setFacultyRecords(Array.isArray(facultyResult.data) ? facultyResult.data : loadStoredFaculty())
        setError('')
      } catch (nextError) {
        setCourses(loadStoredCourses())
        setFacultyRecords(loadStoredFaculty())
        setError(apiErrorMessage(nextError, 'Unable to load course catalog right now.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()

    const syncData = () => void loadData()
    window.addEventListener(COURSE_RECORD_SYNC_EVENT, syncData)
    window.addEventListener('cispro:faculty-changed', syncData)

    return () => {
      window.removeEventListener(COURSE_RECORD_SYNC_EVENT, syncData)
      window.removeEventListener('cispro:faculty-changed', syncData)
    }
  }, [])

  const cards = useMemo(
    () =>
      courses.map((course) => {
        const courseId = String(course?.id || '').trim()
        const facultyCount = facultyRecords.filter((faculty) =>
          (Array.isArray(faculty?.courseIds) && faculty.courseIds.some((id) => String(id || '').trim() === courseId)) ||
          String(faculty?.courseId || '').trim() === courseId ||
          (Array.isArray(faculty?.batchEntries) && faculty.batchEntries.some((entry) => String(entry?.courseId || '').trim() === courseId)),
        ).length

        return {
          ...course,
          facultyCount,
        }
      }),
    [courses, facultyRecords],
  )

  const filteredCards = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return cards

    return cards.filter((course) => {
      const fields = [course.name, course.id, course.mode, course.duration, course.actualFees, course.hours, course.status]
      return fields.some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
    })
  }, [cards, searchTerm])

  const pageSize = 6
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageList = useMemo(() => buildPageList(totalPages, safeCurrentPage), [safeCurrentPage, totalPages])
  const visibleCards = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return filteredCards.slice(start, start + pageSize)
  }, [filteredCards, safeCurrentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <section className="faculty-flow-page faculty-course-catalog-page">
      <div className="faculty-flow-toolbar">
        <Button type="button" variant="ghost" className="faculty-flow-back-button" onClick={() => navigate('/faculty-management')}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </Button>
      </div>

      <article className="faculty-course-catalog-header">
        <div className="faculty-course-catalog-header-copy">
          <p className="faculty-course-catalog-kicker">Courses</p>
          <h2>Course Catalog</h2>
          <p>Search and open the faculty mapping for each course.</p>
        </div>
        <form className="faculty-course-catalog-search" onSubmit={(event) => event.preventDefault()}>
          <span className="faculty-course-catalog-search-icon" aria-hidden="true">
            <Search size={18} />
          </span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search course"
            aria-label="Search course"
          />
        </form>
      </article>

      {error ? (
        <div className="faculty-flow-empty" role="alert">
          <strong>Unable to load courses</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {!isLoading && !filteredCards.length ? (
        <div className="faculty-flow-empty">
          <strong>No courses found</strong>
          <p>{searchTerm.trim() ? 'No matching courses found.' : 'Add courses first, then open the faculty flow.'}</p>
        </div>
      ) : null}

      {visibleCards.length ? (
        <>
          <article className="faculty-flow-section">
            <div className="faculty-flow-catalog-grid">
              {visibleCards.map((course) => (
                <article key={course.id} className="faculty-flow-catalog-card">
                  <div className="faculty-flow-catalog-card-head">
                    <div className="faculty-flow-catalog-card-icon">
                      <Monitor />
                    </div>
                    <div className="faculty-flow-catalog-card-copy">
                      <span className="faculty-flow-catalog-card-label">Course Name</span>
                      <strong>{course.name || course.id || '-'}</strong>
                      <p>View all faculty mapped to this course.</p>
                    </div>
                  </div>

                  <div className="faculty-flow-catalog-divider" aria-hidden="true" />

                  <div className="faculty-flow-catalog-meta-grid">
                    <div className="faculty-flow-catalog-meta-item">
                      <div className="faculty-flow-catalog-meta-icon faculty-flow-catalog-meta-icon-blue">
                        <UsersRound size={20} />
                      </div>
                      <div className="faculty-flow-catalog-meta-copy">
                        <span>Faculty</span>
                        <strong>{course.facultyCount} Faculty</strong>
                        <small>View all faculty mapped to this course.</small>
                      </div>
                    </div>

                    <div className="faculty-flow-catalog-meta-item">
                      <div className="faculty-flow-catalog-meta-icon faculty-flow-catalog-meta-icon-green">
                        <Clock3 size={20} />
                      </div>
                      <div className="faculty-flow-catalog-meta-copy">
                        <span>Duration</span>
                        <strong>{course.duration ? `${course.duration} Months` : '-'}</strong>
                        <small>Course duration</small>
                      </div>
                    </div>

                    <div className="faculty-flow-catalog-meta-item">
                      <div className="faculty-flow-catalog-meta-icon faculty-flow-catalog-meta-icon-orange">
                        <IndianRupee size={20} />
                      </div>
                      <div className="faculty-flow-catalog-meta-copy">
                        <span>Fees</span>
                        <strong>{formatCurrency(course.actualFees)}</strong>
                        <small>Actual course fee</small>
                      </div>
                    </div>

                    <div className="faculty-flow-catalog-meta-item">
                      <div className="faculty-flow-catalog-meta-icon faculty-flow-catalog-meta-icon-purple">
                        <Globe2 size={20} />
                      </div>
                      <div className="faculty-flow-catalog-meta-copy">
                        <span>Mode</span>
                        <strong>{course.mode || '-'}</strong>
                        <small>Online / Offline</small>
                      </div>
                    </div>

                    <div className="faculty-flow-catalog-meta-item">
                      <div className="faculty-flow-catalog-meta-icon faculty-flow-catalog-meta-icon-teal">
                        <span className="faculty-flow-catalog-text-icon">H</span>
                      </div>
                      <div className="faculty-flow-catalog-meta-copy">
                        <span>Hours</span>
                        <strong>{formatHours(course.hours)}</strong>
                        <small>Course hours</small>
                      </div>
                    </div>

                    <div className="faculty-flow-catalog-meta-item">
                      <div className="faculty-flow-catalog-meta-icon faculty-flow-catalog-meta-icon-rose">
                        <span className="faculty-flow-catalog-text-icon">S</span>
                      </div>
                      <div className="faculty-flow-catalog-meta-copy">
                        <span>Status</span>
                        <StatusPill status={course.status} />
                        <small>Course availability</small>
                      </div>
                    </div>
                  </div>

                  <div className="faculty-flow-catalog-card-footer">
                    <Button
                      type="button"
                      variant="ghost"
                      className="faculty-flow-catalog-view-button"
                      onClick={() => navigate(buildFacultyCourseListPath(course.id))}
                    >
                      View
                    </Button>
                  </div>
                </article>
              ))}
            </div>

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
          </article>
        </>
      ) : null}
    </section>
  )
}
