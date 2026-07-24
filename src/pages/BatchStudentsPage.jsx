import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
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
  getFacultyBatchEntryById,
  getFacultyCourseName,
  getFacultyBatchStudentRecords,
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
  return loadStudentSnapshot() || []
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

function formatCurrency(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function getStudentInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'ST'

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)
}

function DetailRow({ label, value, tone = '', valueClassName = '', icon: Icon = UserRound, iconTone = 'blue' }) {
  return (
    <div className="batch-student-detail-row" data-tone={iconTone}>
      <div className="batch-student-detail-icon" aria-hidden="true">
        <Icon />
      </div>
      <span>{label}</span>
      <strong className={`${tone ? `tone-${tone}` : ''} ${valueClassName}`.trim()}>{value || '-'}</strong>
    </div>
  )
}

function getBatchStudentDetailItems(selectedStudent, selectedStudentCourse, selectedFaculty, courseName, batchName, batchTiming) {
  return [
    { label: 'Student Name', value: selectedStudent.studentName, icon: UserRound, iconTone: 'blue' },
    { label: 'Email Address', value: selectedStudent.emailAddress, valueClassName: 'student-inline-email', icon: Mail, iconTone: 'blue' },
    { label: 'Mobile Number', value: selectedStudent.mobileNumber, icon: Phone, iconTone: 'green' },
    { label: 'Parent / Spouse Number', value: selectedStudent.parentSpouseNumber, icon: UsersRound, iconTone: 'green' },
    { label: 'Location', value: selectedStudent.location, icon: MapPin, iconTone: 'purple' },
    { label: 'Course Interested', value: selectedStudent.courseInterested || selectedStudentCourse?.name || courseName, icon: BookOpen, iconTone: 'purple' },
    { label: 'Faculty Name', value: selectedStudent.facultyName || selectedFaculty?.facultyName, icon: GraduationCap, iconTone: 'orange' },
    { label: 'Batch', value: `${batchName}${batchTiming && batchTiming !== '-' ? ` (${batchTiming})` : ''}`, icon: CalendarDays, iconTone: 'orange' },
    { label: 'Qualification', value: selectedStudent.qualification, icon: BadgeCheck, iconTone: 'cyan' },
    { label: 'Passed Out Year', value: selectedStudent.passedOutYear, icon: GraduationCap, iconTone: 'cyan' },
    { label: 'Current Status', value: selectedStudent.currentStatus, icon: UsersRound, iconTone: 'pink' },
    { label: 'Designation', value: selectedStudent.designation, icon: FileText, iconTone: 'pink' },
    { label: 'Admission Date', value: formatDate(selectedStudent.admissionDate), icon: CalendarDays, iconTone: 'amber' },
    { label: 'Total Course Fee', value: formatCurrency(selectedStudent.totalAmount || selectedStudent.actualFees || selectedStudent.afterDiscount), icon: CircleDollarSign, iconTone: 'amber' },
    { label: 'Discount', value: formatCurrency(selectedStudent.discount), icon: FileText, iconTone: 'violet' },
    { label: 'Final Fee', value: formatCurrency(selectedStudent.afterDiscount), icon: CircleDollarSign, iconTone: 'violet' },
    { label: 'Payment Mode', value: selectedStudent.paymentMode || selectedStudent.paymentType || '-', icon: BadgeCheck, iconTone: 'blue' },
    { label: 'Source', value: selectedStudent.source, icon: FileText, iconTone: 'green' },
    { label: 'Remarks', value: selectedStudent.remarks, icon: FileText, iconTone: 'pink' },
    { label: '1st Installment Status', value: selectedStudent.firstInstallmentStatus, icon: BadgeCheck, iconTone: 'green', tone: String(selectedStudent.firstInstallmentStatus || 'Pending') === 'Paid' ? 'success' : 'warning' },
    { label: '2nd Installment Status', value: selectedStudent.secondInstallmentStatus, icon: BadgeCheck, iconTone: 'green', tone: String(selectedStudent.secondInstallmentStatus || 'Pending') === 'Paid' ? 'success' : 'warning' },
    { label: '3rd Installment Status', value: selectedStudent.thirdInstallmentStatus, icon: BadgeCheck, iconTone: 'green', tone: String(selectedStudent.thirdInstallmentStatus || 'Pending') === 'Paid' ? 'success' : 'warning' },
  ]
}

export function BatchStudentsPage() {
  const { facultyId = '', courseId = '', batchId = '' } = useParams()
  const navigate = useNavigate()

  const [facultyRecords, setFacultyRecords] = useState([])
  const [courseOptions, setCourseOptions] = useState([])
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

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
    () => mergeFacultyWithSnapshot(facultyRecords.find((record) => String(record?.id || '').trim() === String(facultyId || '').trim()) || null),
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
      getFacultyBatchStudentRecords(students, {
        facultyName: selectedFaculty?.facultyName || '',
        courseId,
        courseName,
        batchName,
      }),
    [batchName, courseId, courseName, selectedFaculty, students],
  )
  const visibleStudents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    if (!normalizedSearch) return matchingStudents

    return matchingStudents.filter((student) => String(student?.studentName || '').toLowerCase().includes(normalizedSearch))
  }, [matchingStudents, searchQuery])
  const totalPages = Math.max(1, Math.ceil(visibleStudents.length / pageSize))
  const currentPageSafe = Math.min(currentPage, totalPages)
  const paginatedStudents = useMemo(() => {
    const start = (currentPageSafe - 1) * pageSize
    return visibleStudents.slice(start, start + pageSize)
  }, [currentPageSafe, pageSize, visibleStudents])

  const selectedStudentCourse = useMemo(
    () =>
      courseOptions.find((course) => String(course?.id || '').trim() === String(selectedStudent?.courseId || courseId || '').trim()) ||
      selectedCourse ||
      null,
    [courseId, courseOptions, selectedCourse, selectedStudent],
  )

  return (
    <section className="faculty-flow-page faculty-batch-students-page">
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
          <strong>Unable to load students</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <article className="faculty-flow-hero panel-card">
        <div className="faculty-flow-hero-main">
          <div className="faculty-flow-avatar" aria-hidden="true">
            <UsersRound />
          </div>
          <div className="faculty-flow-hero-copy">
            <p className="faculty-flow-kicker">Batch Students</p>
            <h2>{isLoading ? 'Loading students...' : batchName}</h2>
            <div className="faculty-flow-contact">
              <span>
                <UserRound size={16} />
                {isLoading ? 'Faculty: Loading...' : `Faculty: ${selectedFaculty?.facultyName || '-'}`}
              </span>
              <span>
                <BookOpen size={16} />
                {isLoading ? 'Course: Loading...' : `Course: ${courseName}`}
              </span>
              <span>
                <Phone size={16} />
                {isLoading ? 'Timing: Loading...' : `Timing: ${batchTiming}`}
              </span>
              <span>
                <Mail size={16} />
                {isLoading ? 'Total Students: Loading...' : `Total Students: ${matchingStudents.length}`}
              </span>
            </div>
          </div>
        </div>
      </article>

      {isLoading ? (
        <div className="faculty-flow-loading-slot">
          <AppLoadingState
            title="Loading students..."
            description="Please wait while we fetch the batch student details."
            className="faculty-flow-inline-loading"
          />
        </div>
      ) : null}

      {!isLoading && (!selectedFaculty || !selectedBatch) ? (
        <div className="faculty-flow-empty">
          <strong>Batch not found</strong>
          <p>The selected batch is missing or has been removed.</p>
        </div>
      ) : null}

      {!isLoading && selectedFaculty && selectedBatch ? (
      <article className="faculty-flow-section">
        <div className="faculty-flow-section-header">
          <div>
            <h3>Students in {batchName}</h3>
            <p>These students match the selected faculty, course, and batch.</p>
          </div>
          <SearchBar
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value)
              setCurrentPage(1)
            }}
            placeholder="Search student..."
            ariaLabel="Search students in batch"
          />
        </div>

          {paginatedStudents.length ? (
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
                  {paginatedStudents.map((student, index) => (
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
                          onClick={() => setSelectedStudent(student)}
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
              <strong>{searchQuery.trim() ? 'No matching students found' : 'No students found'}</strong>
              <p>
                {searchQuery.trim()
                  ? 'Try a different student name.'
                  : 'No student records match this faculty, course, and batch combination.'}
              </p>
            </div>
          )}

          {visibleStudents.length > pageSize ? (
            <PaginationBar
              className="app-pagination"
              currentPage={currentPageSafe}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              label="Batch student pagination"
            />
          ) : null}
        </article>
      ) : null}

      {selectedStudent ? (
        <div className="course-modal-backdrop student-modal-backdrop batch-student-modal-backdrop" role="presentation" onClick={() => setSelectedStudent(null)}>
          <div className="course-modal panel-card student-modal batch-student-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="course-modal-close batch-student-modal-close"
              onClick={() => setSelectedStudent(null)}
              aria-label="Close student details"
            >
              x
            </button>

            <div className="batch-student-modal-header">
              <div className="batch-student-modal-header-main">
                <div className="batch-student-avatar" aria-hidden="true">
                  {getStudentInitials(selectedStudent.studentName)}
                </div>
                <div className="batch-student-modal-header-copy">
                  <p className="section-kicker">Student Details</p>
                  <h3>{selectedStudent.studentName || '-'}</h3>
                  <p>All student information stays on this batch page.</p>
                </div>
              </div>
              <div className={`batch-student-status ${String(selectedStudent.status || 'Inactive').toLowerCase()}`}>
                <BadgeCheck size={16} />
                <span>{selectedStudent.status || 'Inactive'}</span>
              </div>
            </div>

            <div className="batch-student-modal-grid">
              {getBatchStudentDetailItems(selectedStudent, selectedStudentCourse, selectedFaculty, courseName, batchName, batchTiming).map((item) => (
                <DetailRow
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  tone={item.tone || ''}
                  valueClassName={item.valueClassName || ''}
                  icon={item.icon}
                  iconTone={item.iconTone}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
