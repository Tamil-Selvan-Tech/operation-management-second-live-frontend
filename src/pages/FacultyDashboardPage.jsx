import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FACULTY_BATCH_ATTENDANCE_SYNC_EVENT,
  getAttendanceDateKey,
  loadFacultyBatchAttendanceState,
  loadFacultyAttendanceState,
  resolveBatchAttendanceWindow,
  resolveTodayFacultyAttendanceStatus,
  normalizeAttendanceSessions,
  formatAttendanceTimeLabel,
  saveFacultyBatchAttendanceState,
} from '../lib/facultyAttendanceStore'
import { enrichStudentsWithFacultyReferences, getFacultyBatchEntriesForCourse, getFacultyBatchStudentRecords, getFacultyCourseIds, getFacultyCourses, getMatchingStudents, getUniqueStudentCountForFacultyRecords, getUniqueStudentCountForFacultyScope, sortByNameThenTiming } from '../lib/facultyFlow'
import { markFacultyStudentAttendance } from '../services/attendanceService'
import { getFacultyMyBatchesSummary } from '../services/dashboardService'
import { getCurrentFacultyProfile } from '../services/facultyService'
import { useMobileMenu } from '../layouts/mobileMenuContext'
import { FacultyAttendanceFlow } from '../components/FacultyAttendanceFlow'
import { StudentAttendanceReportModal } from '../components/StudentAttendanceReportModal'

function getInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'ST'
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)
}

function formatDisplayDate(value) {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDisplayTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function formatMinutesLabel(value = 0) {
  const count = Math.max(0, Math.floor(Number(value) || 0))
  return `${count} minute${count === 1 ? '' : 's'}`
}

function FacultyProfileStat({ icon: Icon, label, value, tone = 'blue' }) {
  return (
    <span className="super-admin-sidebar-user-avatar" aria-hidden="true">
      <CircleUserRound size={34} strokeWidth={1.9} />
      <span className="super-admin-sidebar-user-status" />
    </span>
  )
}

function FacultyDashboardSection({ title, description, children }) {
  return (
    <section className="branch-dashboard-section">
      <div className="branch-dashboard-section-heading">
        <div className="branch-dashboard-section-heading-copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export function FacultyDashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const profileMenuRef = useRef(null)

  // Retrieve logged-in faculty details dynamically from registry or fallback to session
  const facultyDetails = useMemo(() => {
    const registry = loadFacultyRegistry()
    const email = String(user?.email || '').trim().toLowerCase()
    const matched = registry.find((f) => f.email.toLowerCase() === email)
    if (matched) return matched

    return {
      id: 'FC-MOCK',
      name: user?.name || 'Faculty Member',
      email: user?.email || 'faculty@cispro.local',
      phone: '9876543210',
      country: 'India',
      state: 'Tamil Nadu',
      city: 'Chennai',
      address: 'Assigned CISPRO Campus location',
      status: 'Active',
    }
  }, [user])

  const facultyName = facultyDetails.name
  const initials = useMemo(() => {
    return facultyName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }, [facultyName])

  // Mock statistics for the faculty member
  const stats = [
    { label: 'Assigned Courses', value: '2', note: 'Active curriculum' },
    { label: 'Total Batches', value: '4', note: 'Across all modes' },
    { label: 'Enrolled Learners', value: '85', note: 'Active students' },
    { label: 'Attendance Rate', value: '96.4%', note: 'Past 30 days' },
  ]

  // Close profile dropdown menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  const handleLogoutClick = () => {
    setIsLogoutConfirmOpen(true)
    setIsProfileMenuOpen(false)
  }

  const handleConfirmLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const renderSidebar = () => (
    <aside className="super-admin-sidebar" aria-label="Faculty navigation">
      <div className="super-admin-sidebar-brand">
        <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="CISPRO logo" />
      </div>

      <nav className="super-admin-sidebar-nav">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'my-batches', label: 'My Batches', icon: Layers3 },
          { id: 'students', label: 'Students', icon: Users },
          { id: 'profile', label: 'Profile', icon: CircleUserRound },
        ].map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={`super-admin-sidebar-item ${isActive ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveSection(item.id)}
            >
              <span className="super-admin-sidebar-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={2.15} />
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="super-admin-sidebar-footer">
        <div className="super-admin-sidebar-profile-card">
          <SidebarUserAvatar />
          <div className="super-admin-sidebar-profile-copy">
            <strong>{facultyName}</strong>
          </div>
          <button
            type="button"
            className="super-admin-sidebar-logout-button"
            onClick={handleLogoutClick}
            aria-label="Logout"
          >
            <LogOut size={22} strokeWidth={2.15} />
          </button>
        </div>
      </div>
    </aside>
  )

  const renderTopbar = () => (
    <header className="super-admin-topbar">
      <div className="super-admin-topbar-right">
        <button type="button" className="super-admin-notification-button" aria-label="Notifications">
          <Bell size={22} strokeWidth={2.1} />
          <span className="super-admin-notification-badge">3</span>
        </button>

        <div className="branch-dashboard-profile-menu-wrap" ref={profileMenuRef}>
          <button
            type="button"
            className="super-admin-profile branch-dashboard-profile-trigger"
            onClick={() => setIsProfileMenuOpen((current) => !current)}
          >
            <span className="super-admin-avatar" aria-hidden="true">
              <span className="super-admin-avatar-mark">
                <ShieldCheck size={18} strokeWidth={2.2} />
              </span>
            </span>
            <div className="super-admin-profile-copy">
              <strong>{facultyName}</strong>
            </div>
            <ChevronDown size={16} strokeWidth={2.2} className="branch-dashboard-profile-caret" aria-hidden="true" />
          </button>

          {isProfileMenuOpen ? (
            <div className="branch-dashboard-profile-menu" role="menu" aria-label="Faculty profile menu">
              <button
                type="button"
                className="branch-dashboard-profile-menu-item"
                onClick={() => {
                  setActiveSection('profile')
                  setIsProfileMenuOpen(false)
                }}
              >
                <CircleUserRound size={16} strokeWidth={2.1} />
                <span>Profile</span>
              </button>
              <button type="button" className="branch-dashboard-profile-menu-item is-danger" onClick={handleLogoutClick}>
                <LogOut size={16} strokeWidth={2.1} />
                <span>Logout</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )

  return (
    <section className="super-admin-page">
      <div className="super-admin-shell">
        {renderSidebar()}

        <div className="super-admin-main">
          {renderTopbar()}

          <main className="super-admin-content">
            <div className="branch-dashboard-content">
              {user && user.mustResetPassword ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: '#fee2e2', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                    <ShieldCheck size={24} style={{ color: '#ef4444' }} />
                  </div>
                  <div>
                    <h3 style={{ color: '#991b1b', margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 700 }}>Action Required: Reset Your Password</h3>
                    <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.95rem' }}>
                      You are currently logging in with a temporary password. For your security, please update your password immediately.
                    </p>
                  </div>
                </div>
              ) : null}

              {activeSection === 'dashboard' ? (
                <>
                  <div className="branch-dashboard-overview-intro">
                    <h1>Dashboard</h1>
                    <p>Welcome back, {facultyName}! Here&apos;s an overview of your active courses, batches, and student attendance metrics.</p>
                  </div>

                  <div className="branch-dashboard-stats">
                    {stats.map((stat) => (
                      <article key={stat.label} className="branch-dashboard-stat-card">
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                        <small>{stat.note}</small>
                      </article>
                    ))}
                  </div>

                  <FacultyDashboardSection title="Today's Classes" description="Schedule of your batches for today.">
                    <div className="branch-dashboard-activity-grid">
                      <article className="branch-dashboard-panel">
                        <strong className="block text-slate-800 text-[1.1rem]">Batch F-01 (React Native)</strong>
                        <p className="text-slate-600 mt-1">Timing: 09:30 AM - 11:30 AM</p>
                        <span className="inline-block mt-3 px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700">Completed</span>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong className="block text-slate-800 text-[1.1rem]">Batch F-02 (Web Development)</strong>
                        <p className="text-slate-600 mt-1">Timing: 02:00 PM - 04:00 PM</p>
                        <span className="inline-block mt-3 px-2 py-0.5 text-xs font-semibold rounded bg-sky-100 text-sky-700">In Progress</span>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong className="block text-slate-800 text-[1.1rem]">Batch F-03 (UI/UX Design)</strong>
                        <p className="text-slate-600 mt-1">Timing: 05:00 PM - 07:00 PM</p>
                        <span className="inline-block mt-3 px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">Scheduled</span>
                      </article>
                    </div>
                  </FacultyDashboardSection>
                </>
              ) : null}

              {activeSection === 'my-batches' ? (
                <FacultyDashboardSection title="My Batches" description="Overview of active learning batches under your instruction.">
                  <div className="branch-dashboard-table-shell">
                    <table className="branch-dashboard-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>S.No</th>
                          <th>Course Name</th>
                          <th>Batch Code</th>
                          <th>Timings</th>
                          <th>Total Students</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { course: 'React Native Development', code: 'RN-B3', timing: 'Mon, Wed, Fri | 09:30 AM', students: '24', status: 'Active' },
                          { course: 'Full-Stack Web Development', code: 'WD-B9', timing: 'Tue, Thu | 02:00 PM', students: '18', status: 'Active' },
                          { course: 'UI/UX Premium Design', code: 'UX-B2', timing: 'Saturday | 10:00 AM', students: '15', status: 'Active' },
                          { course: 'Advanced JavaScript Mastery', code: 'JS-B1', timing: 'Sunday | 11:30 AM', students: '28', status: 'Active' },
                        ].map((batch, index) => (
                          <tr key={batch.code}>
                            <td>{index + 1}</td>
                            <td><strong className="text-slate-800">{batch.course}</strong></td>
                            <td><strong style={{ color: '#0f172a' }}>{batch.code}</strong></td>
                            <td>{batch.timing}</td>
                            <td>{batch.students} students</td>
                            <td>
                              <span className="branch-course-status-pill active">
                                {batch.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </FacultyDashboardSection>
              ) : null}

              {activeSection === 'students' ? (
                <FacultyDashboardSection title="Enrolled Students" description="Learners enrolled in your courses across all active batches.">
                  <div className="branch-dashboard-table-shell">
                    <table className="branch-dashboard-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>S.No</th>
                          <th>Student Name</th>
                          <th>Batch</th>
                          <th>Course</th>
                          <th>Email Address</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'Ananya S', batch: 'RN-B3', course: 'React Native Development', email: 'ananya.s@gmail.com', status: 'Active' },
                          { name: 'Rahul P', batch: 'WD-B9', course: 'Full-Stack Web Development', email: 'rahul.p@gmail.com', status: 'Active' },
                          { name: 'Meena K', batch: 'RN-B3', course: 'React Native Development', email: 'meena.k@gmail.com', status: 'Active' },
                          { name: 'Arun V', batch: 'UX-B2', course: 'UI/UX Premium Design', email: 'arun.v@gmail.com', status: 'Active' },
                          { name: 'Sanjay Kumar', batch: 'JS-B1', course: 'Advanced JavaScript Mastery', email: 'sanjay.k@gmail.com', status: 'Active' },
                        ].map((student, index) => (
                          <tr key={student.name}>
                            <td>{index + 1}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="faculty-avatar">
                                  {student.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                                </div>
                                <strong className="branch-course-name">{student.name}</strong>
                              </div>
                            </td>
                            <td><strong>{student.batch}</strong></td>
                            <td>{student.course}</td>
                            <td>
                              <span className="faculty-info-link">
                                <Mail size={14} style={{ color: '#94a3b8' }} />
                                {student.email}
                              </span>
                            </td>
                            <td>
                              <span className="branch-course-status-pill active">
                                {student.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </FacultyDashboardSection>
              ) : null}

              {activeSection === 'profile' ? (
                <FacultyDashboardSection title="Faculty Profile" description="Your dynamic workspace details loaded directly from branch registry.">
                  <div className="faculty-profile-details-card bg-white rounded-2xl border border-slate-200 p-6 max-w-3xl shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-sky-100 text-sky-700 font-bold text-2xl flex items-center justify-center border border-sky-200">
                        {initials}
                      </div>
                      <div>
                        <h2 className="text-[1.35rem] font-bold text-slate-900">{facultyName}</h2>
                        <p className="text-slate-500 text-sm flex items-center gap-1.5 mt-0.5">
                          <UserRound size={14} /> Faculty Instructor
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                      <div className="border-b border-slate-100 pb-3">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Faculty ID</span>
                        <strong className="text-slate-800 text-[1rem]">{facultyDetails.id}</strong>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Contact Number</span>
                        <strong className="text-slate-800 text-[1rem] flex items-center gap-1">
                          <Phone size={14} className="text-slate-400" /> {facultyDetails.phone}
                        </strong>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Email Address</span>
                        <strong className="text-slate-800 text-[1rem] flex items-center gap-1">
                          <Mail size={14} className="text-slate-400" /> {facultyDetails.email}
                        </strong>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Account Status</span>
                        <strong className="text-slate-800 text-[1rem] flex items-center">
                          <span className={`branch-course-status-pill ${String(facultyDetails.status).toLowerCase()}`}>
                            {facultyDetails.status}
                          </span>
                        </strong>
                      </div>
                      <div className="border-b border-slate-100 pb-3 md:col-span-2">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Location</span>
                        <strong className="text-slate-800 text-[1rem] flex items-center gap-1">
                          <MapPin size={14} className="text-slate-400" /> {facultyDetails.city}, {facultyDetails.state}, {facultyDetails.country}
                        </strong>
                      </div>
                      <div className="md:col-span-2 pb-1">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Residential Address</span>
                        <strong className="text-slate-800 text-[1rem] block font-normal leading-relaxed text-slate-600">
                          {facultyDetails.address}
                        </strong>
                      </div>
                    </div>
                  </div>
                </FacultyDashboardSection>
              ) : null}
            </div>
          </main>
        </div>
      </div>

      {isLogoutConfirmOpen ? (
        <div className="branch-modal-backdrop" role="presentation">
          <div
            className="branch-logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-logout-title"
            aria-describedby="branch-logout-description"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="branch-logout-close"
              aria-label="Close logout confirmation"
              onClick={() => setIsLogoutConfirmOpen(false)}
            >
              ×
            </button>

            <h2 id="branch-logout-title">Are you sure you want to logout?</h2>
            <p id="branch-logout-description" className="branch-logout-description sr-only">
              You can always sign in again if you need access later.
            </p>

            <div className="branch-logout-actions">
              <button type="button" className="branch-logout-cancel" onClick={() => setIsLogoutConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="branch-logout-submit" onClick={handleConfirmLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
