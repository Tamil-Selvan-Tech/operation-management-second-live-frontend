import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import {
  LayoutDashboard,
  UserRound,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  LogOut,
  Menu,
  X,
  CircleUserRound,
} from 'lucide-react'

import '../styles/StudentNewDashboardPage.css'
import {
  loadBranchStudents,
  refreshBranchStudents,
} from '../lib/branchStudentStore'
import { getCurrentStudentProfile } from '../services/studentService'
import { listBranchCourses } from '../services/branchCourseService'
import { mergeBranchCoursesWithSnapshot } from '../lib/branchCourseSnapshot'
import { loadCourseRecords } from '../data/courseRecords'
import { StudentCalendarPanel } from '../components/StudentCalendarPanel'

function readStudentSession() {
  if (typeof window === 'undefined') return null

  try {
    return JSON.parse(window.sessionStorage.getItem('cispro.student-session') || 'null')
  } catch {
    return null
  }
}

function matchesStudentSession(student, session) {
  const identifiers = [session?.studentId, session?.emailAddress, session?.email]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  return identifiers.includes(String(student?.studentId || '').trim().toLowerCase()) ||
    identifiers.includes(String(student?.emailAddress || student?.email || '').trim().toLowerCase())
}

function findStudentCourse(student, courses = []) {
  const studentCourseId = String(student?.courseId || student?.course?.id || '').trim()
  const studentCourseCode = String(student?.courseCode || student?.course?.courseCode || student?.course?.code || '').trim().toLowerCase()
  const studentCourseName = String(
    student?.courseName || student?.courseInterested || student?.course?.name || '',
  ).trim().toLowerCase()

  const normalizedCourses = Array.isArray(courses) ? courses : []

  if (studentCourseId) {
    const matchedCourseById = normalizedCourses.find((course) => String(course?.id || course?.branchCourseId || course?.courseId || course?.dbId || '').trim() === studentCourseId)
    if (matchedCourseById) return matchedCourseById
  }

  if (studentCourseCode) {
    const matchedCourseByCode = normalizedCourses.find((course) => String(course?.courseCode || course?.code || '').trim().toLowerCase() === studentCourseCode)
    if (matchedCourseByCode) return matchedCourseByCode
  }

  if (studentCourseName) {
    const matchedCourseByName = normalizedCourses.find((course) => {
      const courseName = String(course?.name || course?.courseName || course?.title || '').trim().toLowerCase()
      return courseName && courseName === studentCourseName
    })
    if (matchedCourseByName) return matchedCourseByName
  }

  return null
}

function getCourseMasterDuration(course = {}) {
  return course?.duration ?? course?.durationMonths ?? course?.courseDuration ?? ''
}

function getPaymentStatus(student) {
  const explicitStatus = String(student?.paymentStatus || student?.feeStatus || '').trim()
  if (explicitStatus) return explicitStatus

  const total = Number(student?.afterDiscount ?? student?.totalAmount ?? 0)
  const paid = Number(student?.paidAmount ?? student?.amountPaid ?? 0)
  if (total > 0 && paid >= total) return 'Paid'
  if (paid > 0) return 'Partially paid'
  return 'Pending'
}

function getAttendance(student) {
  const value = student?.attendancePercentage ?? student?.attendance ?? student?.attendancePercent
  return value === undefined || value === null || value === '' ? 'Not available' : `${value}%`
}

export function StudentNewDashboardPage() {
 const navigate = useNavigate()
 const { session, signOut } = useAuth()
 const [activeSection, setActiveSection] = useState('dashboard')
 const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
 const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
 const [studentSession] = useState(() => readStudentSession())
 const [student, setStudent] = useState(null)
 const [isLoading, setIsLoading] = useState(true)
 const [loadError, setLoadError] = useState('')

 useEffect(() => {
   let isMounted = true
   const session = readStudentSession()

   const attachCourseMasterData = async (studentRecord) => {
     if (!studentRecord) return studentRecord

     try {
       const result = await listBranchCourses({
         page: 1,
         limit: 100,
         sortBy: 'createdAt',
         sortOrder: 'desc',
       })
       let branchCourses = mergeBranchCoursesWithSnapshot(result?.data || [])
       const courseCatalog = [
         ...branchCourses,
         ...loadCourseRecords(),
       ]
       let course = findStudentCourse(studentRecord, courseCatalog)

       if (!course) {
         const search = String(
           studentRecord?.courseName || studentRecord?.courseInterested || studentRecord?.course?.name ||
           studentRecord?.courseCode || studentRecord?.course?.courseCode || '',
         ).trim()

         if (search) {
           const searchedResult = await listBranchCourses({
             page: 1,
             limit: 100,
             search,
           })
           branchCourses = mergeBranchCoursesWithSnapshot(searchedResult?.data || [])
           course = findStudentCourse(studentRecord, [
             ...branchCourses,
             ...loadCourseRecords(),
           ])
         }
       }
       if (!course) {
         const nestedDuration = getCourseMasterDuration(studentRecord?.course)
         return nestedDuration
           ? { ...studentRecord, courseMasterDuration: nestedDuration }
           : studentRecord
       }

       const courseMasterDuration = getCourseMasterDuration(course)

       return {
         ...studentRecord,
         course: {
           ...(studentRecord.course && typeof studentRecord.course === 'object' ? studentRecord.course : {}),
           ...course,
         },
         courseId: course.id || course.branchCourseId || course.courseId || course.dbId || studentRecord.courseId,
         courseCode: course.courseCode || studentRecord.courseCode,
         courseName: course.name || studentRecord.courseName || studentRecord.courseInterested,
         courseDuration: courseMasterDuration || studentRecord.courseDuration || studentRecord.duration,
         courseMasterDuration: courseMasterDuration || studentRecord.courseMasterDuration || studentRecord.courseDuration || studentRecord.duration,
         courseSchedule: course.schedule || course.courseSchedule || studentRecord.courseSchedule || studentRecord.classSchedule,
       }
     } catch {
       return studentRecord
     }
   }

   const loadStudent = async () => {
     if (!session) {
       try {
         const currentProfile = await getCurrentStudentProfile()
         const hydratedProfile = await attachCourseMasterData(currentProfile)
         if (isMounted) setStudent(hydratedProfile)
       } catch (error) {
         if (isMounted) setLoadError(error?.message || 'Student session not found. Please sign in again.')
       } finally {
         if (isMounted) setIsLoading(false)
       }
       return
     }

     const scope = session.branchId || session.branchCode || ''
     const localStudent = loadBranchStudents(scope).find((record) => matchesStudentSession(record, session))

     try {
       const records = await refreshBranchStudents(scope)
       const latestStudent = records.find((record) => matchesStudentSession(record, session))
       const hydratedStudent = await attachCourseMasterData(latestStudent || localStudent)
       if (isMounted) {
         setStudent(hydratedStudent || null)
         if (!latestStudent && !localStudent) setLoadError('Your student record could not be found.')
       }
      } catch (error) {
       if (isMounted) {
         setStudent(localStudent ? { ...localStudent, courseMasterDuration: localStudent.course?.duration || localStudent.courseDuration || localStudent.duration || '' } : null)
         if (!localStudent) setLoadError(error?.message || 'Unable to load your student details.')
       }
     } finally {
       if (isMounted) setIsLoading(false)
     }
   }

   void loadStudent()
   return () => { isMounted = false }
 }, [])

 const courseName = student?.courseName || student?.courseInterested || student?.course?.name || 'Not assigned'
 const attendance = getAttendance(student)
 const paymentStatus = getPaymentStatus(student)
 const displayName = student?.studentName || studentSession?.studentName || 'Student'
 const detailItems = useMemo(() => [
   ['Student ID', student?.studentId],
   ['Email', student?.emailAddress || student?.email],
   ['Mobile', student?.mobileNumber],
   ['Parent / Guardian', student?.parentSpouseNumber],
   ['Qualification', student?.qualification],
   ['Passed out year', student?.passedOutYear],
   ['Branch', student?.branchCode || student?.branchId],
   ['Admission date', student?.admissionDate],
 ], [student])

  const handleMenuClick = (section) => {
    setActiveSection(section)
    setIsMobileSidebarOpen(false)
  }

const handleLogout = () => {
  setIsLogoutModalOpen(true)
}

const handleLogoutCancel = () => {
  setIsLogoutModalOpen(false)
}

const handleLogoutConfirm = async () => {
  setIsLogoutModalOpen(false)
  try {
    window.sessionStorage.removeItem('cispro.student-session')
  } catch {
    // Ignore storage errors and continue to the login page.
  }
  await signOut()
  navigate('/login', { replace: true })
}

  return (
    <section className="student-new-page">
      <div className="student-new-shell">

        {/* ─────────────────────────────────────────────
            MOBILE SIDEBAR BACKDROP
        ───────────────────────────────────────────── */}
        {isMobileSidebarOpen ? (
          <button
            type="button"
            className="student-new-sidebar-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        ) : null}

        {/* ─────────────────────────────────────────────
            SIDEBAR
        ───────────────────────────────────────────── */}
        <aside
          className={`student-new-sidebar ${
            isMobileSidebarOpen ? 'is-open' : ''
          }`.trim()}
          aria-label="Student navigation"
        >
          {/* Sidebar Brand */}
          <div className="student-new-sidebar-brand">
            <img
              className="student-new-sidebar-brand-logo"
              src="/logo1.png"
              alt="Elite Admin logo"
            />

            <button
              type="button"
              className="student-new-sidebar-close"
              aria-label="Close navigation menu"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X
                size={18}
                strokeWidth={2.6}
                aria-hidden="true"
                focusable="false"
              />
            </button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="student-new-sidebar-nav">

            {/* MAIN */}
            <div className="student-new-sidebar-section">
              <span className="student-new-sidebar-section-label">
                MAIN
              </span>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'dashboard' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('dashboard')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <LayoutDashboard
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>Dashboard</span>
              </button>
            </div>

            {/* STUDENT */}
            <div className="student-new-sidebar-section">
              <span className="student-new-sidebar-section-label">
                STUDENT
              </span>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'profile' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('profile')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <UserRound
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>My Profile</span>
              </button>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'course' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('course')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <BookOpen
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>My Course</span>
              </button>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'calendar' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('calendar')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <CalendarDays
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>Calendar</span>
              </button>

              <button
                type="button"
                className={`student-new-sidebar-item ${
                  activeSection === 'payments' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('payments')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <CreditCard
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>Payments</span>
              </button>
            </div>
          </nav>

          {/* Sidebar Footer */}
          <div className="student-new-sidebar-footer">
            <div className="student-new-sidebar-profile-card">

              <span
                className="student-new-sidebar-user-avatar"
                aria-hidden="true"
              >
                <CircleUserRound
                  size={28}
                  strokeWidth={1.9}
                />

                <span className="student-new-sidebar-user-status" />
              </span>

              <div className="student-new-sidebar-profile-copy">
                <strong>Student</strong>
                <span>Student Profile</span>
              </div>

              <button
                type="button"
                className="student-new-sidebar-logout-button"
                aria-label="Logout"
                onClick={handleLogout}
              >
                <LogOut
                  size={21}
                  strokeWidth={2.15}
                />
              </button>

            </div>
          </div>
        </aside>

        {/* ─────────────────────────────────────────────
            MAIN AREA
        ───────────────────────────────────────────── */}
        <div className="student-new-main">

          {/* ─────────────────────────────────────────
              HEADER
          ───────────────────────────────────────── */}
          <header className="student-new-topbar">

            <div className="student-new-topbar-left">

              <button
                type="button"
                className="student-new-sidebar-toggle"
                aria-label="Open navigation menu"
                aria-expanded={isMobileSidebarOpen}
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu
                  size={20}
                  strokeWidth={2.4}
                  aria-hidden="true"
                  focusable="false"
                />
              </button>

              <h1 className="student-new-header-title">
                Student Dashboard
              </h1>

            </div>

            <div className="student-new-topbar-right">

              <div className="student-new-profile">

                <span
                  className="student-new-profile-avatar"
                  aria-hidden="true"
                >
                  <CircleUserRound
                    size={30}
                    strokeWidth={1.9}
                  />
                </span>

                <div className="student-new-profile-copy">
                  <strong>{displayName}</strong>
                  <span>Student</span>
                </div>

              </div>

            </div>
          </header>

          {/* ─────────────────────────────────────────
              CONTENT
          ───────────────────────────────────────── */}
          <main className="student-new-content">

            {session?.user?.mustResetPassword ? (
              <section className="student-new-password-notice" role="status">
                <div>
                  <strong>Password reset pending</strong>
                  <p>You are using a temporary password. Reset it to keep your student account secure.</p>
                </div>
                <button type="button" onClick={() => navigate('/forgot-password')}>
                  Reset Password
                </button>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'dashboard' ? (
              <div className="student-new-dashboard">

                {/* Dashboard Intro */}
                <section className="student-new-dashboard-intro">
                  <div>
                    <p className="student-new-dashboard-kicker">
                      Dashboard
                    </p>

                    <h1>
                      Student Dashboard
                    </h1>

                    <p>
                      Welcome, {displayName}. Here&apos;s an overview of your
                      learning activities.
                    </p>
                  </div>
                </section>

                {/* Summary Cards */}
                <section
                  className="student-new-stats-grid"
                  aria-label="Student summary"
                >

                  {/* Course Card */}
                  <article className="student-new-stat-card">

                    <span
                      className="student-new-stat-icon"
                      aria-hidden="true"
                    >
                      <BookOpen
                        size={22}
                        strokeWidth={2.1}
                      />
                    </span>

                    <div className="student-new-stat-copy">
                      <span className="student-new-stat-label">
                        My Course
                      </span>

                      <strong className="student-new-stat-value">
                        {courseName}
                      </strong>

                      <span className="student-new-stat-note">
                        Current course
                      </span>
                    </div>

                  </article>

                  {/* Attendance Card */}
                  <article className="student-new-stat-card">

                    <span
                      className="student-new-stat-icon is-success"
                      aria-hidden="true"
                    >
                      <CalendarCheck
                        size={22}
                        strokeWidth={2.1}
                      />
                    </span>

                    <div className="student-new-stat-copy">
                      <span className="student-new-stat-label">
                        Attendance
                      </span>

                      <strong className="student-new-stat-value">
                        {attendance}
                      </strong>

                      <span className="student-new-stat-note">
                        Overall attendance
                      </span>
                    </div>

                  </article>

                  {/* Payments Card */}
                  <article className="student-new-stat-card">

                    <span
                      className="student-new-stat-icon is-payment"
                      aria-hidden="true"
                    >
                      <CreditCard
                        size={22}
                        strokeWidth={2.1}
                      />
                    </span>

                    <div className="student-new-stat-copy">
                      <span className="student-new-stat-label">
                        Payments
                      </span>

                      <strong className="student-new-stat-value">
                        {paymentStatus}
                      </strong>

                      <span className="student-new-stat-note">
                        Payment status
                      </span>
                    </div>

                  </article>

                </section>

                {/* Recent Information */}
                <section className="student-new-recent-card">

                  <div className="student-new-section-header">
                    <div>
                      <p className="student-new-section-kicker">
                        INFORMATION
                      </p>

                      <h2>
                        Recent Information
                      </h2>
                    </div>
                  </div>

                  <div className="student-new-recent-list">

                    <div className="student-new-recent-item">

                      <span className="student-new-recent-icon">
                        <BookOpen
                          size={18}
                          strokeWidth={2.1}
                        />
                      </span>

                      <div className="student-new-recent-copy">
                        <strong>
                        {courseName}
                        </strong>

                        <span>
                          {student?.batchName || student?.batch || 'Your assigned course details.'}
                        </span>
                      </div>

                      <span className="student-new-recent-status">
                        Active
                      </span>

                    </div>

                    <div className="student-new-recent-item">

                      <span className="student-new-recent-icon">
                        <CalendarCheck
                          size={18}
                          strokeWidth={2.1}
                        />
                      </span>

                      <div className="student-new-recent-copy">
                        <strong>
                          Attendance
                        </strong>

                        <span>
                          Your current attendance is {attendance}.
                        </span>
                      </div>

                      <span className="student-new-recent-status">
                        {attendance}
                      </span>

                    </div>

                    <div className="student-new-recent-item">

                      <span className="student-new-recent-icon">
                        <CreditCard
                          size={18}
                          strokeWidth={2.1}
                        />
                      </span>

                      <div className="student-new-recent-copy">
                        <strong>
                          Payment
                        </strong>

                        <span>
                          Payment status: {paymentStatus}.
                        </span>
                      </div>

                      <span className="student-new-recent-status">
                        {paymentStatus}
                      </span>

                    </div>

                  </div>

                </section>

              </div>
            ) : null}

            {isLoading ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">STUDENT</p>
                <h1>Loading your details...</h1>
              </section>
            ) : null}

            {!isLoading && loadError ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">STUDENT</p>
                <h1>Student details unavailable</h1>
                <p>{loadError}</p>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'profile' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>My Profile</h1>

                <div className="student-new-detail-grid">
                  {detailItems.map(([label, value]) => (
                    <div className="student-new-detail-item" key={label}>
                      <span>{label}</span>
                      <strong>{value || '-'}</strong>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'course' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>My Course</h1>

                <div className="student-new-detail-grid">
                  <div className="student-new-detail-item"><span>Course</span><strong>{courseName}</strong></div>
                  <div className="student-new-detail-item"><span>Faculty</span><strong>{student?.facultyName || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Batch</span><strong>{student?.batchName || student?.batch || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Batch timing</span><strong>{student?.batchTiming || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Course progress</span><strong>{student?.courseProgress ?? student?.courseCompletionPercentage ?? '-'}{student?.courseProgress || student?.courseCompletionPercentage ? '%' : ''}</strong></div>
                </div>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'attendance' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>Attendance</h1>

                <div className="student-new-detail-grid">
                  <div className="student-new-detail-item"><span>Overall attendance</span><strong>{attendance}</strong></div>
                  <div className="student-new-detail-item"><span>Course</span><strong>{courseName}</strong></div>
                  <div className="student-new-detail-item"><span>Current status</span><strong>{student?.currentStatus || student?.status || '-'}</strong></div>
                </div>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'payments' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>Payments</h1>

                <div className="student-new-detail-grid">
                  <div className="student-new-detail-item"><span>Payment status</span><strong>{paymentStatus}</strong></div>
                  <div className="student-new-detail-item"><span>Payment mode</span><strong>{student?.paymentMode || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Total fee</span><strong>{student?.afterDiscount || student?.totalAmount || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Registration fee</span><strong>{student?.registrationFees || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>First installment</span><strong>{student?.firstInstallmentAmount || student?.installment1 || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Second installment</span><strong>{student?.secondInstallmentAmount || student?.installment2 || '-'}</strong></div>
                  <div className="student-new-detail-item"><span>Third installment</span><strong>{student?.thirdInstallmentAmount || student?.installment3 || '-'}</strong></div>
                </div>
              </section>
            ) : null}

            {!isLoading && !loadError && activeSection === 'calendar' ? (
              <StudentCalendarPanel student={student} />
            ) : null}

          </main>
        </div>
      </div>
      {/* =====================================================
    LOGOUT CONFIRMATION MODAL
===================================================== */}
{isLogoutModalOpen ? (
  <div
    className="student-new-logout-overlay"
    role="presentation"
  >
    <div
      className="student-new-logout-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-logout-title"
      onClick={(event) => event.stopPropagation()}
    >
      {/* Close Button */}
      <button
        type="button"
        className="student-new-logout-close"
        aria-label="Close logout confirmation"
        onClick={handleLogoutCancel}
      >
        <X
          size={22}
          strokeWidth={2}
        />
      </button>

      {/* Message */}
      <div className="student-new-logout-content">
        <h2 id="student-logout-title">
          Are you sure you want
          <br />
          to logout?
        </h2>
      </div>

      {/* Actions */}
      <div className="student-new-logout-actions">

        <button
          type="button"
          className="student-new-logout-cancel"
          onClick={handleLogoutCancel}
        >
          Cancel
        </button>

        <button
          type="button"
          className="student-new-logout-confirm"
          onClick={handleLogoutConfirm}
        >
          Logout
        </button>

      </div>
    </div>
  </div>
) : null}
    </section>
  )
}

export default StudentNewDashboardPage
