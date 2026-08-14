import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CircleUserRound,
  ChevronDown,
  LayoutDashboard,
  Layers3,
  LogOut,
  RefreshCcw,
  Shield,
  Users,
  Wallet,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { findBranchByEmail } from '../lib/branchAuth'
import { getCurrentBranchProfile } from '../services/branchService'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/BranchDashboardPage.css'

const overviewStats = [
  { label: 'Total Students', value: '246', note: 'Active learners this month' },
  { label: 'Total Courses', value: '18', note: 'Published course catalog' },
  { label: 'Active Batches', value: '11', note: 'Running live batches' },
  { label: 'Pending Payments', value: '14', note: 'Needs follow-up today' },
]

const studentRows = [
  ['Ananya S', 'Batch A-11', 'Paid'],
  ['Rahul P', 'Batch A-08', 'Pending'],
  ['Meena K', 'Batch B-02', 'Paid'],
  ['Arun V', 'Batch C-01', 'Pending'],
]

const courseCards = [
  { name: 'Full Stack Development', batches: 4, students: 78 },
  { name: 'UI/UX Design', batches: 2, students: 34 },
  { name: 'Data Analytics', batches: 3, students: 51 },
  { name: 'Digital Marketing', batches: 2, students: 29 },
]

const batchCards = [
  { title: 'Batch A-11', timing: 'Mon - Fri | 9:00 AM', status: 'Active' },
  { title: 'Batch B-02', timing: 'Tue - Thu | 2:00 PM', status: 'Active' },
  { title: 'Batch C-01', timing: 'Weekend | 11:30 AM', status: 'Review' },
]

const paymentRows = [
  ['Ananya S', '₹12,000', 'Due in 2 days'],
  ['Rahul P', '₹8,500', 'Pending'],
  ['Meena K', '₹15,000', 'Collected'],
  ['Arun V', '₹6,000', 'Pending'],
]

function BranchDashboardSection({ title, description, children }) {
  return (
    <section className="branch-dashboard-section">
      <div className="branch-dashboard-section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  )
}

function AvatarBadge() {
  return (
    <span className="super-admin-avatar" aria-hidden="true">
      <span className="super-admin-avatar-mark">
        <Shield size={18} strokeWidth={2.2} />
      </span>
    </span>
  )
}

function SidebarUserAvatar() {
  return (
    <span className="super-admin-sidebar-user-avatar" aria-hidden="true">
      <CircleUserRound size={34} strokeWidth={1.9} />
      <span className="super-admin-sidebar-user-status" />
    </span>
  )
}

function buildFallbackBranchProfile(user, session) {
  const branchEmail = String(user?.email || session?.user?.email || '').trim().toLowerCase()
  const registryBranch = findBranchByEmail(branchEmail)

  if (registryBranch) {
    return registryBranch
  }

  return {
    branchName: 'Branch Dashboard',
    branchAdminName: user?.name || 'Branch Admin',
    branchEmail: branchEmail || 'branch@example.com',
    branchAddress: 'Assigned location',
    mustResetPassword: Boolean(user?.mustResetPassword || session?.user?.mustResetPassword),
  }
}

function formatBranchAdminDisplayName(value) {
  const text = String(value || '').trim()
  if (!text) return 'Branch Admin'

  return text.replace(/^KKJ\s*[-–—:]?\s*/i, '').trim() || 'Branch Admin'
}

export function BranchDashboardPage() {
  const navigate = useNavigate()
  const { isAuthenticated, role, signOut, user, session } = useAuth()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [branchProfile, setBranchProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated || role !== 'branch-admin') {
      navigate('/login', { replace: true })
      return
    }

    getCurrentBranchProfile()
      .then((result) => {
        setBranchProfile(result)
        setIsLoading(false)
      })
      .catch(() => {
        setBranchProfile(buildFallbackBranchProfile(user, session))
        setIsLoading(false)
      })
  }, [isAuthenticated, navigate, role, session, user])

  useEffect(() => {
    if (!isProfileMenuOpen) return undefined

    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (profileMenuRef.current?.contains(target)) return
      setIsProfileMenuOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isProfileMenuOpen])

  const openLogoutConfirm = () => {
    setIsProfileMenuOpen(false)
    setIsLogoutConfirmOpen(true)
  }

  const closeLogoutConfirm = () => {
    setIsLogoutConfirmOpen(false)
  }

  const handleConfirmLogout = async () => {
    closeLogoutConfirm()
    setIsProfileMenuOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  const branchTitle = branchProfile?.branchName || 'Branch Dashboard'
  const branchAdmin = branchProfile?.branchAdminName || user?.name || 'Branch Admin'
  const branchAdminDisplay = formatBranchAdminDisplayName(branchAdmin)
  const branchEmail = branchProfile?.branchEmail || user?.email || 'branch@example.com'
  const branchLocation = branchProfile?.branchAddress || 'Assigned location'
  const registryBranch = findBranchByEmail(branchEmail)
  const mustResetPassword = Boolean(
    session?.user?.mustResetPassword ??
      user?.mustResetPassword ??
      branchProfile?.mustResetPassword ??
      registryBranch?.mustResetPassword,
  )

  const openResetPassword = () => {
    setIsProfileMenuOpen(false)
    navigate('/reset-password?branchReset=1')
  }

  const openForgotPassword = () => {
    setIsProfileMenuOpen(false)
    const suffix = branchEmail ? `?email=${encodeURIComponent(branchEmail)}` : ''
    navigate(`/forgot-password${suffix}`)
  }

  const openProfile = () => {
    setIsProfileMenuOpen(false)
    setActiveSection('profile')
  }

  const renderSidebar = () => (
    <aside className="super-admin-sidebar" aria-label="Branch navigation">
      <div className="super-admin-sidebar-brand">
        <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="CISPRO logo" />
      </div>

      <nav className="super-admin-sidebar-nav">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'students', label: 'Students', icon: Users },
          { id: 'courses', label: 'Courses', icon: BookOpen },
          { id: 'batches', label: 'Batches', icon: Layers3 },
          { id: 'payments', label: 'Payments', icon: Wallet },
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
            <strong>{branchTitle}</strong>
          </div>

          <button
            type="button"
            className="super-admin-sidebar-logout-button"
            onClick={openLogoutConfirm}
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
      <div className="super-admin-topbar-left">
        <div className="branch-dashboard-topbar-copy">
          <p className="branch-dashboard-kicker">Branch Dashboard</p>
          <p>{branchAdminDisplay}</p>
        </div>
      </div>

      <div className="super-admin-topbar-right">
        <button type="button" className="super-admin-notification-button" aria-label="Notifications">
          <Bell size={22} strokeWidth={2.1} />
          <span className="super-admin-notification-badge">8</span>
        </button>

        <div ref={profileMenuRef} className="branch-dashboard-profile-menu-wrap">
          <button
            type="button"
            className="super-admin-profile branch-dashboard-profile-trigger"
            onClick={() => setIsProfileMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
          >
            <AvatarBadge />
            <div className="super-admin-profile-copy">
              <strong>{branchAdminDisplay}</strong>
            </div>
            <ChevronDown size={16} strokeWidth={2.2} className="branch-dashboard-profile-caret" aria-hidden="true" />
          </button>

          {isProfileMenuOpen ? (
            <div className="branch-dashboard-profile-menu" role="menu" aria-label="Branch profile menu">
              <button type="button" role="menuitem" className="branch-dashboard-profile-menu-item" onClick={openProfile}>
                <CircleUserRound size={16} strokeWidth={2.1} />
                <span>Profile</span>
              </button>

              {mustResetPassword ? (
                <button
                  type="button"
                  role="menuitem"
                  className="branch-dashboard-profile-menu-item"
                  onClick={openResetPassword}
                >
                  <RefreshCcw size={16} strokeWidth={2.1} />
                  <span>Reset Password</span>
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className="branch-dashboard-profile-menu-item"
                  onClick={openForgotPassword}
                >
                  <RefreshCcw size={16} strokeWidth={2.1} />
                  <span>Forgot Password</span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                className="branch-dashboard-profile-menu-item is-danger"
                onClick={openLogoutConfirm}
              >
                <LogOut size={16} strokeWidth={2.1} />
                <span>Logout</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )

  if (isLoading) {
    return (
      <section className="super-admin-page">
        <div className="super-admin-shell">
          {renderSidebar()}

          <div className="super-admin-main">
            {renderTopbar()}

            <main className="super-admin-content">
              <div className="branch-dashboard-content">
                <div className="super-admin-hero-copy">
                  <p className="branch-dashboard-kicker">Branch Dashboard</p>
                  <h1>Loading branch profile...</h1>
                  <p>Please wait while we load your branch workspace.</p>
                </div>
              </div>
            </main>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="super-admin-page">
      <div className="super-admin-shell">
        {renderSidebar()}

        <div className="super-admin-main">
          {renderTopbar()}

          <main className="super-admin-content">
            <div className="branch-dashboard-content">
              {activeSection === 'dashboard' ? (
                <>
                  {mustResetPassword ? (
                    <section className="branch-dashboard-password-alert" aria-live="polite">
                      <div className="branch-dashboard-password-alert-copy">
                        <strong>Temporary password still active</strong>
                        <p>
                          You have not reset your temporary password yet. Please reset it now to secure your branch dashboard account.
                        </p>
                      </div>
                      <Button type="button" onClick={openResetPassword}>
                        Reset Password
                      </Button>
                    </section>
                  ) : null}

                  <div className="branch-dashboard-stats">
                    {overviewStats.map((stat) => (
                      <article key={stat.label} className="branch-dashboard-stat-card">
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                        <small>{stat.note}</small>
                      </article>
                    ))}
                  </div>

                  <BranchDashboardSection title="Today" description="A quick snapshot of branch activity.">
                    <div className="branch-dashboard-activity-grid">
                      <article className="branch-dashboard-panel">
                        <strong>Attendance</strong>
                        <p>224 students checked in before 10:00 AM.</p>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong>Revenue</strong>
                        <p>₹1.84L collected in the last 7 days.</p>
                      </article>
                      <article className="branch-dashboard-panel">
                        <strong>Follow-ups</strong>
                        <p>14 pending payment reminders scheduled for today.</p>
                      </article>
                    </div>
                  </BranchDashboardSection>
                </>
              ) : null}

              {activeSection === 'students' ? (
                <BranchDashboardSection title="Students" description="Dummy student list for the branch.">
                  <div className="branch-dashboard-table-shell">
                    <table className="branch-dashboard-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Batch</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentRows.map(([name, batch, status]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{batch}</td>
                            <td>{status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'courses' ? (
                <BranchDashboardSection title="Courses" description="A small sample of active course offerings.">
                  <div className="branch-dashboard-card-grid">
                    {courseCards.map((course) => (
                      <article key={course.name} className="branch-dashboard-info-card">
                        <strong>{course.name}</strong>
                        <span>{course.batches} batches</span>
                        <small>{course.students} students</small>
                      </article>
                    ))}
                  </div>
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'batches' ? (
                <BranchDashboardSection title="Batches" description="Current batch schedule overview.">
                  <div className="branch-dashboard-card-grid">
                    {batchCards.map((batch) => (
                      <article key={batch.title} className="branch-dashboard-info-card">
                        <strong>{batch.title}</strong>
                        <span>{batch.timing}</span>
                        <small>{batch.status}</small>
                      </article>
                    ))}
                  </div>
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'payments' ? (
                <BranchDashboardSection title="Payments" description="Pending and collected payment snapshot.">
                  <div className="branch-dashboard-table-shell">
                    <table className="branch-dashboard-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Amount</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentRows.map(([name, amount, note]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{amount}</td>
                            <td>{note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BranchDashboardSection>
              ) : null}

              {activeSection === 'profile' ? (
                <BranchDashboardSection title="Profile" description="Branch profile and login details.">
                  <div className="branch-dashboard-profile-grid">
                    <article className="branch-dashboard-profile-panel">
                      <span>Branch Name</span>
                      <strong>{branchTitle}</strong>
                    </article>
                    <article className="branch-dashboard-profile-panel">
                      <span>Branch Admin</span>
                      <strong>{branchAdminDisplay}</strong>
                    </article>
                    <article className="branch-dashboard-profile-panel">
                      <span>Email</span>
                      <strong>{branchEmail}</strong>
                    </article>
                    <article className="branch-dashboard-profile-panel">
                      <span>Location</span>
                      <strong>{branchLocation}</strong>
                    </article>
                  </div>
                </BranchDashboardSection>
              ) : null}
            </div>
          </main>
        </div>

        {isLogoutConfirmOpen ? (
          <div className="branch-modal-backdrop" role="presentation" onClick={closeLogoutConfirm}>
            <div
              className="branch-success-modal super-admin-logout-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-logout-title"
              aria-describedby="branch-logout-description"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="branch-modal-close"
                aria-label="Close logout confirmation"
                onClick={closeLogoutConfirm}
              >
                X
              </button>

              <div className="super-admin-logout-icon" aria-hidden="true">
                <LogOut size={28} strokeWidth={2.1} />
              </div>

              <h2 id="branch-logout-title">Are you sure you want to logout?</h2>
              

              <div className="branch-modal-actions">
                <button type="button" className="branch-modal-cancel" onClick={closeLogoutConfirm}>
                  Cancel
                </button>
                <button type="button" className="branch-modal-submit" onClick={handleConfirmLogout}>
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
