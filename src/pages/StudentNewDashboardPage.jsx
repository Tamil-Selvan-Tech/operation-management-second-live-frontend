import { useState } from 'react'
import {
  LayoutDashboard,
  UserRound,
  BookOpen,
  CalendarCheck,
  CreditCard,
  LogOut,
  Menu,
  X,
  CircleUserRound,
} from 'lucide-react'

import '../styles/StudentNewDashboardPage.css'

export function StudentNewDashboardPage() {
 const [activeSection, setActiveSection] = useState('dashboard')
const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

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

const handleLogoutConfirm = () => {
  setIsLogoutModalOpen(false)

  // Actual logout logic
  console.log('Student logout confirmed')

  // Example:
  // localStorage.removeItem('token')
  // localStorage.removeItem('user')
  // navigate('/login')
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
                  activeSection === 'attendance' ? 'is-active' : ''
                }`.trim()}
                onClick={() => handleMenuClick('attendance')}
              >
                <span className="student-new-sidebar-icon" aria-hidden="true">
                  <CalendarCheck
                    size={18}
                    strokeWidth={2.2}
                  />
                </span>

                <span>Attendance</span>
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
                  <strong>Student Profile</strong>
                  <span>Student</span>
                </div>

              </div>

            </div>
          </header>

          {/* ─────────────────────────────────────────
              CONTENT
          ───────────────────────────────────────── */}
          <main className="student-new-content">

            {activeSection === 'dashboard' ? (
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
                      Welcome, Student. Here&apos;s an overview of your
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
                        React JS
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
                        85%
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
                        Paid
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
                          React JS Course
                        </strong>

                        <span>
                          Your current course is active.
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
                          Your current attendance is 85%.
                        </span>
                      </div>

                      <span className="student-new-recent-status">
                        85%
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
                          Your latest payment information.
                        </span>
                      </div>

                      <span className="student-new-recent-status">
                        Paid
                      </span>

                    </div>

                  </div>

                </section>

              </div>
            ) : null}

            {activeSection === 'profile' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>My Profile</h1>

                <p>
                  Student profile information will appear here.
                </p>
              </section>
            ) : null}

            {activeSection === 'course' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>My Course</h1>

                <p>
                  Course information will appear here.
                </p>
              </section>
            ) : null}

            {activeSection === 'attendance' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>Attendance</h1>

                <p>
                  Attendance information will appear here.
                </p>
              </section>
            ) : null}

            {activeSection === 'payments' ? (
              <section className="student-new-placeholder-page">
                <p className="student-new-dashboard-kicker">
                  STUDENT
                </p>

                <h1>Payments</h1>

                <p>
                  Payment information will appear here.
                </p>
              </section>
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