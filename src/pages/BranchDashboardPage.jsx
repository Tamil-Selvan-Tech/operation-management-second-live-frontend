import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  Layers3,
  Wallet,
  Users,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { getCurrentBranchProfile } from '../services/branchService'
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

export function BranchDashboardPage() {
  const navigate = useNavigate()
  const { isAuthenticated, role, signOut, user } = useAuth()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [branchProfile, setBranchProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated || role !== 'branch-admin') {
      navigate('/login', { replace: true })
      return
    }

    setIsLoading(true)
    getCurrentBranchProfile()
      .then((result) => {
        setBranchProfile(result)
        setIsLoading(false)
      })
      .catch(async () => {
        setIsLoading(false)
        await signOut()
        navigate('/login', { replace: true })
      })
  }, [isAuthenticated, navigate, role, signOut])

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const branchTitle = branchProfile?.branchName || 'Branch Dashboard'
  const branchAdmin = branchProfile?.branchAdminName || user?.name || 'Branch Admin'
  const branchEmail = branchProfile?.branchEmail || user?.email || 'branch@example.com'
  const branchLocation = branchProfile?.branchAddress || 'Assigned location'

  if (isLoading) {
    return (
      <section className="branch-dashboard-page">
        <div className="branch-dashboard-shell">
          <main className="branch-dashboard-main">
            <header className="branch-dashboard-topbar">
              <div>
                <p className="branch-dashboard-kicker">Branch Dashboard</p>
                <h1>Loading branch profile...</h1>
                <p>Please wait while we load your branch workspace.</p>
              </div>
            </header>
          </main>
        </div>
      </section>
    )
  }

  return (
    <section className="branch-dashboard-page">
      <div className="branch-dashboard-shell">
        <aside className="branch-dashboard-sidebar" aria-label="Branch navigation">
          <div className="branch-dashboard-brand">
            <img className="branch-dashboard-brand-logo" src="/logo1.png" alt="CISPRO logo" />
          </div>

          <nav className="branch-dashboard-nav">
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
                  className={`branch-dashboard-nav-item ${isActive ? 'is-active' : ''}`.trim()}
                  onClick={() => setActiveSection(item.id)}
                >
                  <span className="branch-dashboard-nav-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.15} />
                  </span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="branch-dashboard-footer">
            <div className="branch-dashboard-profile-card">
              <span className="branch-dashboard-avatar" aria-hidden="true">
                <CircleUserRound size={30} strokeWidth={1.9} />
              </span>

              <div className="branch-dashboard-profile-copy">
                <strong>{branchTitle}</strong>
                <span>{branchEmail}</span>
              </div>

              <button type="button" className="branch-dashboard-logout-button" onClick={handleLogout} aria-label="Logout">
                <LogOut size={20} strokeWidth={2.15} />
              </button>
            </div>
          </div>
        </aside>

        <main className="branch-dashboard-main">
          <header className="branch-dashboard-topbar">
            <div>
              <p className="branch-dashboard-kicker">Branch Dashboard</p>
              <h1>{branchTitle}</h1>
              <p>{branchAdmin} · {branchLocation}</p>
            </div>
            <div className="branch-dashboard-topbar-chip">
              <span className="branch-dashboard-status-dot" />
              <span>Logged in as branch admin</span>
            </div>
          </header>

          <div className="branch-dashboard-content">
            {activeSection === 'dashboard' ? (
              <>
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
                    <strong>{branchAdmin}</strong>
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
    </section>
  )
}
