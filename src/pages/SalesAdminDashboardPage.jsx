import { useEffect, useState } from 'react'
import { Bell, GraduationCap, Home, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, UserRound, X } from 'lucide-react'
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

export function SalesAdminDashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isLeadManagement = location.pathname.endsWith('/leads')
  const isReports = location.pathname.endsWith('/reports')
  const isNotifications = location.pathname.endsWith('/notifications')
  const isAdmissions = location.pathname.includes('/admissions')
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  useEffect(() => {
    let active = true
    request('/sales-admins/dashboard')
      .then((response) => { if (active) { setDashboard(response?.data || null); window.dispatchEvent(new Event('institute-leave-updated')) } })
      .catch((reason) => { if (active) setError(reason?.message || 'Unable to load dashboard') })
    return () => { active = false }
  }, [])

  const cards = dashboard?.cards || {}
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false)

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
            {isLeadManagement ? <LeadManagementPage /> : isReports ? <SalesCrmReportPage /> : isNotifications ? <SalesAdminNotificationsPage /> : isAdmissions ? <SalesAdminAdmissionsPage key={location.search} /> : <><header className="sales-admin-dashboard-header"><div><p className="eyebrow">SALES ADMIN WORKSPACE</p><h1>Sales Admin Dashboard</h1><p>Manage sales activity across your assigned branches.</p></div></header>{error ? <p role="alert">{error}</p> : null}<section className="sales-admin-dashboard-cards">{[['New leads', cards.newLeads], ['Total leads', cards.totalLeads], ['HOT leads', cards.hotLeads], ['WARM leads', cards.warmLeads], ['COLD leads', cards.coldLeads], ['Admissions', cards.admissionsCompleted]].map(([label, value]) => <article className="panel-card" key={label}><span>{label}</span><strong>{value == null ? 'Unavailable' : value}</strong></article>)}</section><section className="panel-card sales-admin-dashboard-lead-card"><h2>Lead Management</h2><p>Open Lead Management from the sidebar to manage enquiries and follow-ups.</p></section></>}
          </main>
        </div>
      </div>
      {isLogoutConfirmOpen ? <div className="sales-admin-modal-backdrop"><div className="sales-admin-confirm-modal sales-admin-logout-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="sales-admin-logout-title"><button type="button" className="sales-admin-logout-confirm-close" aria-label="Close logout confirmation" onClick={() => setIsLogoutConfirmOpen(false)}>&times;</button><h2 id="sales-admin-logout-title">Are you sure you want to logout?</h2><div><button type="button" onClick={() => setIsLogoutConfirmOpen(false)}>Cancel</button><button type="button" className="is-logout-confirm" onClick={() => void signOut()}>Logout</button></div></div></div> : null}
    </section>
  )
}
