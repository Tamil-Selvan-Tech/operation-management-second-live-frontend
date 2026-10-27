import { useEffect, useState } from 'react'
import { ArrowUpRight, BarChart3, Bell, Flame, GraduationCap, Home, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, RefreshCw, UserRound, UserRoundCheck, UserRoundX, UsersRound, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { request } from '../services/apiClient'
import { useAuth } from '../auth/useAuth'
import { LeadManagementPage } from './LeadManagementPage'
import { SalesCrmReportPage } from './SalesCrmReportPage'
import { NotificationBell } from '../components/NotificationBell'
import { SalesAdminNotificationsPage } from './SalesAdminNotificationsPage'
import { SalesAdminAdmissionsPage } from './SalesAdminAdmissionsPage'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/SalesAdminDashboardPage.css'
const DASHBOARD_METRICS = [
  { key: 'newLeads', label: 'New leads', hint: 'Added this month', icon: UsersRound, accent: 'blue' },
  { key: 'totalLeads', label: 'Total leads', hint: 'All active leads', icon: BarChart3, accent: 'slate' },
  { key: 'hotLeads', label: 'HOT leads', hint: 'Ready for follow-up', icon: Flame, accent: 'orange' },
  { key: 'warmLeads', label: 'WARM leads', hint: 'Needs nurturing', icon: UserRoundCheck, accent: 'amber' },
  { key: 'coldLeads', label: 'COLD leads', hint: 'Early-stage leads', icon: UserRoundX, accent: 'violet' },
  { key: 'admissionsCompleted', label: 'Admissions', hint: 'Sales CRM conversions', icon: GraduationCap, accent: 'green' },
]

export function SalesAdminDashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isLeadManagement = location.pathname.endsWith('/leads')
  const isReports = location.pathname.endsWith('/reports')
  const isNotifications = location.pathname.endsWith('/notifications')
  const isAdmissions = location.pathname.includes('/admissions')
  const isDashboard = !isLeadManagement && !isReports && !isNotifications && !isAdmissions
  const [dashboard, setDashboard] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0)
  const [error, setError] = useState('')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  useEffect(() => {
    if (!isDashboard) return undefined
    let active = true
    queueMicrotask(() => {
      if (active) {
        setDashboardLoading(true)
        setError('')
      }
    })
    request('/sales-admins/dashboard')
      .then((response) => { if (active) setDashboard(response?.data || null) })
      .catch((reason) => { if (active) setError(reason?.message || 'Unable to load dashboard') })
      .finally(() => { if (active) setDashboardLoading(false) })
    return () => { active = false }
  }, [isDashboard, dashboardReloadKey])

  const cards = dashboard?.cards || {}
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false)
  const refreshDashboard = () => setDashboardReloadKey((current) => current + 1)

  return (
    <section className={`super-admin-page ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <div className="super-admin-shell">
        {isMobileSidebarOpen ? <button type="button" className="super-admin-sidebar-backdrop" aria-label="Close navigation menu" onClick={closeMobileSidebar} /> : null}
        <aside className={`super-admin-sidebar ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''} ${isMobileSidebarOpen ? 'is-open' : ''}`} aria-label="Sales admin navigation">
          <div className="super-admin-sidebar-brand">
            <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="Cispro logo" />
            <button type="button" className="super-admin-sidebar-collapse-toggle" aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setIsSidebarCollapsed((current) => !current)}>
              {isSidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </button>
            <button type="button" className="super-admin-sidebar-close" aria-label="Close navigation menu" onClick={closeMobileSidebar}><X size={18} /></button>
          </div>
          <nav className="super-admin-sidebar-nav">
            <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${!isLeadManagement ? 'is-active' : ''}`} data-tooltip="Dashboard" onClick={() => { navigate('/dashboard/sales-admin'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><Home size={18} /></span><span>Dashboard</span></button></div>
            <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isLeadManagement ? 'is-active' : ''}`} data-tooltip="Lead Management" onClick={() => { navigate('/dashboard/sales-admin/leads'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><LayoutGrid size={18} /></span><span>Lead Management</span></button></div>
            <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isAdmissions ? 'is-active' : ''}`} data-tooltip="Student Admission" onClick={() => { navigate('/dashboard/sales-admin/admissions'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><GraduationCap size={18} /></span><span>Student Admission</span></button></div>
            <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isReports ? 'is-active' : ''}`} data-tooltip="Monthly Reports" onClick={() => { navigate('/dashboard/sales-admin/reports'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><LayoutGrid size={18} /></span><span>Monthly Reports</span></button></div>
            <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isNotifications ? 'is-active' : ''}`} data-tooltip="Notifications" onClick={() => { navigate('/dashboard/sales-admin/notifications'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><Bell size={18} /></span><span>Notifications</span></button></div>
          </nav>
          <div className="sales-admin-sidebar-account"><span className="sales-admin-sidebar-account-avatar"><UserRound size={18} /></span><span className="sales-admin-sidebar-account-copy"><strong>{user?.name || 'Sales Admin'}</strong><small>{user?.email || 'salesadmin@cispro.com'}</small></span><button type="button" className="sales-admin-sidebar-account-logout" aria-label="Logout" onClick={() => setIsLogoutConfirmOpen(true)}><LogOut size={20} /></button></div>
        </aside>

        <div className="super-admin-main">
          <header className="super-admin-topbar">
            <div className="super-admin-topbar-left"><button type="button" className="super-admin-sidebar-toggle" aria-label="Open navigation menu" onClick={() => setIsMobileSidebarOpen(true)}><LayoutGrid size={19} /></button><h1 className="super-admin-header-title">{isLeadManagement ? 'Lead Management' : isReports ? 'Monthly Reports' : isNotifications ? 'Notifications' : isAdmissions ? 'Student Admission' : 'Sales Admin Dashboard'}</h1></div>
            <div className="super-admin-topbar-right"><NotificationBell /><div className="super-admin-profile"><span className="super-admin-avatar"><span className="super-admin-avatar-mark"><UserRound size={19} /></span></span><div className="super-admin-profile-copy"><strong>{user?.name || 'Sales Admin'}</strong><span>{user?.email || 'salesadmin@cispro.com'}</span></div></div></div>
          </header>

          <main className="super-admin-content">
            {isLeadManagement ? <LeadManagementPage /> : isReports ? <SalesCrmReportPage /> : isNotifications ? <SalesAdminNotificationsPage /> : isAdmissions ? <SalesAdminAdmissionsPage key={location.search} /> : (
              <section className="sales-admin-dashboard-home">
                <header className="sales-admin-dashboard-header">
                  <div className="sales-admin-dashboard-intro">
                    <p className="eyebrow">SALES CRM</p>
                    <h2>Dashboard</h2>
                    <p>Monitor lead movement and admission performance across your assigned branches.</p>
                  </div>
                  <button type="button" className="sales-admin-dashboard-refresh" onClick={refreshDashboard} disabled={dashboardLoading}>
                    <RefreshCw size={16} className={dashboardLoading ? 'is-spinning' : ''} />
                    <span>{dashboardLoading ? 'Refreshing' : 'Refresh'}</span>
                  </button>
                </header>

                {error ? <div className="sales-admin-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={refreshDashboard}>Try again</button></div> : null}

                <section className="sales-admin-dashboard-cards" aria-label="Sales dashboard metrics">
                  {DASHBOARD_METRICS.map(({ key, label, hint, icon: Icon, accent }) => (
                    <article className={`sales-admin-dashboard-metric is-${accent}`} key={key}>
                      <div className="sales-admin-dashboard-metric-top">
                        <span className="sales-admin-dashboard-metric-icon"><Icon size={18} strokeWidth={2.2} /></span>
                        <span className="sales-admin-dashboard-metric-trend" aria-hidden="true"><ArrowUpRight size={14} /></span>
                      </div>
                      <span className="sales-admin-dashboard-metric-label">{label}</span>
                      <strong>{dashboardLoading ? <span className="sales-admin-dashboard-value-skeleton" aria-label="Loading" /> : cards[key] == null || !Number.isFinite(Number(cards[key])) ? '—' : Number(cards[key]).toLocaleString('en-IN')}</strong>
                      <small>{hint}</small>
                    </article>
                  ))}
                </section>

                <section className="sales-admin-dashboard-lead-card">
                  <span className="sales-admin-dashboard-lead-card-icon"><LayoutGrid size={19} /></span>
                  <div className="sales-admin-dashboard-lead-card-copy">
                    <p className="sales-admin-dashboard-card-kicker">WORKSPACE</p>
                    <h2>Lead Management</h2>
                    <p>Manage enquiries, schedule follow-ups, and move qualified leads into admission.</p>
                  </div>
                  <button type="button" onClick={() => navigate('/dashboard/sales-admin/leads')}><span>Open leads</span><ArrowUpRight size={16} /></button>
                </section>
              </section>
            )}
          </main>
        </div>
      </div>
      {isLogoutConfirmOpen ? <div className="sales-admin-modal-backdrop"><div className="sales-admin-confirm-modal sales-admin-logout-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="sales-admin-logout-title"><button type="button" className="sales-admin-logout-confirm-close" aria-label="Close logout confirmation" onClick={() => setIsLogoutConfirmOpen(false)}>&times;</button><h2 id="sales-admin-logout-title">Are you sure you want to logout?</h2><div><button type="button" onClick={() => setIsLogoutConfirmOpen(false)}>Cancel</button><button type="button" className="is-logout-confirm" onClick={() => void signOut()}>Logout</button></div></div></div> : null}
    </section>
  )
}
