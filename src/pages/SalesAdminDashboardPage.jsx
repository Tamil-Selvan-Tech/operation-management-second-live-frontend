import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowUpRight, BarChart3, Bell, BookOpen, CalendarClock, CalendarDays, CheckCircle2, CircleX, Clock3, Flame, GraduationCap, Home, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, Percent, RefreshCw, UserRound, UserRoundCheck, UserRoundX, UsersRound, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { request } from '../services/apiClient'
import { useAuth } from '../auth/useAuth'
import { LeadManagementPage } from './LeadManagementPage'
import { SalesCrmReportPage } from './SalesCrmReportPage'
import { NotificationBell } from '../components/NotificationBell'
import { SalesAdminNotificationsPage } from './SalesAdminNotificationsPage'
import { SalesAdminAdmissionsPage } from './SalesAdminAdmissionsPage'
import { SalesAdminProfilePage } from './SalesAdminProfilePage'
import '../styles/SuperAdminDashboardPage.css'
import '../styles/SalesAdminDashboardPage.css'
const DASHBOARD_METRICS = [
  { key: 'newLeads', label: 'New leads', hint: 'Selected date range', icon: UsersRound, accent: 'blue' },
  { key: 'totalLeads', label: 'Total leads', hint: 'All active leads', icon: BarChart3, accent: 'slate' },
  { key: 'hotLeads', label: 'HOT leads', hint: 'In selected date range', icon: Flame, accent: 'orange' },
  { key: 'warmLeads', label: 'WARM leads', hint: 'In selected date range', icon: UserRoundCheck, accent: 'amber' },
  { key: 'coldLeads', label: 'COLD leads', hint: 'In selected date range', icon: UserRoundX, accent: 'violet' },
  { key: 'closedLeads', label: 'CLOSED leads', hint: 'In selected date range', icon: CircleX, accent: 'slate' },
  { key: 'admissionsCompleted', label: 'Admissions completed', hint: 'In selected date range', icon: GraduationCap, accent: 'green' },
  { key: 'followUpsDueToday', label: 'Follow-ups scheduled', hint: 'In selected date range', icon: CalendarClock, accent: 'blue' },
  { key: 'overdueFollowUps', label: 'Overdue follow-ups', hint: 'Scheduled in selected range', icon: AlertTriangle, accent: 'orange' },
  { key: 'pendingAdmissions', label: 'Pending admissions', hint: 'Selected-range HOT leads', icon: BookOpen, accent: 'amber' },
  { key: 'conversionRate', label: 'Conversion rate', hint: 'Selected-range leads', icon: Percent, accent: 'green', percent: true },
]

function formatDashboardDate(value) {
  const datePart = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${datePart}T00:00:00.000Z`))
}

function formatUpcomingFollowUpDate(value) {
  const dateKey = String(value || '').slice(0, 10)
  const today = new Date()
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  if (dateKey === toDateInputValue(today)) return `Today · ${formatDashboardDate(value)}`
  if (dateKey === toDateInputValue(tomorrow)) return `Tomorrow · ${formatDashboardDate(value)}`
  return formatDashboardDate(value)
}

function formatLeadStage(value) {
  const stage = String(value || '').toLowerCase()
  return stage ? `${stage[0].toUpperCase()}${stage.slice(1)}` : 'Stage unavailable'
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateRangeForPreset(preset, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === 'TODAY') return { from: toDateInputValue(today), to: toDateInputValue(today) }
  if (preset === 'THIS_WEEK') {
    const from = new Date(today)
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7))
    return { from: toDateInputValue(from), to: toDateInputValue(today) }
  }
  if (preset === 'THIS_YEAR') return { from: `${now.getFullYear()}-01-01`, to: toDateInputValue(today) }
  if (preset === 'CUSTOM') return { from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInputValue(today) }
  return { from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInputValue(today) }
}

function currentWeekDateKeys(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return toDateInputValue(date)
  })
}

function formatChartDate(value) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`))
}

export function SalesAdminDashboardPage({ embeddedBranchAdmin = false, onSwitchDashboard }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isLeadManagement = location.pathname.endsWith('/leads')
  const isReports = location.pathname.endsWith('/reports')
  const isNotifications = location.pathname.endsWith('/notifications')
  const isAdmissions = location.pathname.includes('/admissions')
  const isProfile = location.pathname.endsWith('/profile')
  const isDashboard = !isLeadManagement && !isReports && !isNotifications && !isAdmissions && !isProfile
  const [dashboard, setDashboard] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0)
  const [chartTooltip, setChartTooltip] = useState(null)
  const [datePreset, setDatePreset] = useState('THIS_MONTH')
  const [dateRange, setDateRange] = useState(() => dateRangeForPreset('THIS_MONTH'))
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [error, setError] = useState('')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  useEffect(() => {
    if (!isDashboard) return undefined
    if (!dateRange.from || !dateRange.to || dateRange.from > dateRange.to) {
      let active = true
      queueMicrotask(() => { if (active) setDashboardLoading(false) })
      return () => { active = false }
    }
    let active = true
    queueMicrotask(() => {
      if (active) {
        setDashboardLoading(true)
        setError('')
      }
    })
    const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to })
    if (selectedBranchId) params.set('branchId', selectedBranchId)
    request(`/sales-admins/dashboard?${params.toString()}`)
      .then((response) => { if (active) setDashboard(response?.data || null) })
      .catch((reason) => { if (active) setError(reason?.message || 'Unable to load dashboard') })
      .finally(() => { if (active) setDashboardLoading(false) })
    return () => { active = false }
  }, [isDashboard, dashboardReloadKey, dateRange.from, dateRange.to, selectedBranchId])

  const cards = dashboard?.cards || {}
  const assignedBranches = dashboard?.profile?.branches || []
  const upcomingFollowUps = dashboard?.followUps?.upcoming || []
  const chartDataByDate = new Map((dashboard?.chart || []).map((row) => [String(row.date).slice(0, 10), row]))
  const chartRows = currentWeekDateKeys().map((date) => ({ date, leads: 0, admissions: 0, ...chartDataByDate.get(date) }))
  const statusChart = dashboard?.leadStatusChart || []
  const conversionDetails = dashboard?.conversionDetails || {}
  const followUpSummary = dashboard?.followUps || {}
  const branchOverview = dashboard?.branchOverview || []
  const chartMaximum = Math.max(1, ...chartRows.flatMap((row) => [Number(row.leads) || 0, Number(row.admissions) || 0]))
  const statusTotal = statusChart.reduce((sum, row) => sum + (Number(row.count) || 0), 0)
  const statusSlices = statusChart.reduce((state, row) => {
    const value = Number(row.count) || 0
    const start = state.total
    state.total += statusTotal ? (value / statusTotal) * 100 : 0
    const color = row.stage === 'HOT' ? '#ee7b32' : row.stage === 'WARM' ? '#d49a16' : row.stage === 'CLOSED' ? '#64748b' : '#3979e8'
    state.parts.push(`${color} ${start}% ${state.total}%`)
    return state
  }, { total: 0, parts: [] })
  const customRangeInvalid = !dateRange.from || !dateRange.to || dateRange.from > dateRange.to
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false)
  const refreshDashboard = () => setDashboardReloadKey((current) => current + 1)
  const chooseDatePreset = (preset) => { setDatePreset(preset); if (preset !== 'CUSTOM') setDateRange(dateRangeForPreset(preset)) }
  const updateChartTooltip = (event, row) => {
    const wrapper = event.currentTarget.closest('.sales-admin-dashboard-chart-wrap')
    if (!wrapper) return
    const bounds = wrapper.getBoundingClientRect()
    const target = event.type === 'focus' ? event.currentTarget.getBoundingClientRect() : null
    const pointerX = target ? target.left + target.width / 2 - bounds.left : event.clientX - bounds.left
    const pointerY = target ? target.top - bounds.top : event.clientY - bounds.top
    setChartTooltip({ row, left: Math.max(8, Math.min(bounds.width - 174, pointerX + 12)), top: Math.max(8, Math.min(bounds.height - 78, pointerY - 58)) })
  }

  return (
    <section className={`super-admin-page ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''} ${embeddedBranchAdmin ? 'is-embedded-branch-admin' : ''}`}>
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
            <div className="super-admin-sidebar-section"><button type="button" className="super-admin-sidebar-item is-active" data-tooltip="Dashboard" onClick={() => { if (!embeddedBranchAdmin) navigate('/dashboard/sales-admin'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><Home size={18} /></span><span>Dashboard</span></button></div>
            {!embeddedBranchAdmin ? <>
              <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isLeadManagement ? 'is-active' : ''}`} data-tooltip="Lead Management" onClick={() => { navigate('/dashboard/sales-admin/leads'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><LayoutGrid size={18} /></span><span>Lead Management</span></button></div>
              <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isAdmissions ? 'is-active' : ''}`} data-tooltip="Student Admission" onClick={() => { navigate('/dashboard/sales-admin/admissions'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><GraduationCap size={18} /></span><span>Student Admission</span></button></div>
              <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isReports ? 'is-active' : ''}`} data-tooltip="Monthly Reports" onClick={() => { navigate('/dashboard/sales-admin/reports'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><LayoutGrid size={18} /></span><span>Monthly Reports</span></button></div>
              <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isNotifications ? 'is-active' : ''}`} data-tooltip="Notifications" onClick={() => { navigate('/dashboard/sales-admin/notifications'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><Bell size={18} /></span><span>Notifications</span></button></div>
              <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isProfile ? 'is-active' : ''}`} data-tooltip="My Profile" onClick={() => { navigate('/dashboard/sales-admin/profile'); closeMobileSidebar() }}><span className="super-admin-sidebar-icon"><UserRound size={18} /></span><span>My Profile</span></button></div>
            </> : null}
          </nav>
          <div className="sales-admin-sidebar-account"><span className="sales-admin-sidebar-account-avatar"><UserRound size={18} /></span><span className="sales-admin-sidebar-account-copy"><strong>{user?.name || 'Sales Admin'}</strong><small>{user?.email || 'salesadmin@cispro.com'}</small></span>{!embeddedBranchAdmin ? <button type="button" className="sales-admin-sidebar-account-logout" aria-label="Logout" onClick={() => setIsLogoutConfirmOpen(true)}><LogOut size={20} /></button> : null}</div>
        </aside>

        <div className="super-admin-main">
          <header className="super-admin-topbar">
            <div className="super-admin-topbar-left"><button type="button" className="super-admin-sidebar-toggle" aria-label="Open navigation menu" onClick={() => setIsMobileSidebarOpen(true)}><LayoutGrid size={19} /></button><h1 className="super-admin-header-title">{isLeadManagement ? 'Lead Management' : isReports ? 'Monthly Reports' : isNotifications ? 'Notifications' : isAdmissions ? 'Student Admission' : isProfile ? 'My Profile' : 'Sales Admin Dashboard'}</h1></div>
            <div className="super-admin-topbar-right">{!embeddedBranchAdmin ? <NotificationBell /> : null}<div className="super-admin-profile"><span className="super-admin-avatar"><span className="super-admin-avatar-mark"><UserRound size={19} /></span></span><div className="super-admin-profile-copy"><strong>{user?.name || 'Sales Admin'}</strong><span>{user?.email || 'salesadmin@cispro.com'}</span></div></div></div>
          </header>

          <main className="super-admin-content">
            {isLeadManagement ? <LeadManagementPage /> : isReports ? <SalesCrmReportPage /> : isNotifications ? <SalesAdminNotificationsPage /> : isAdmissions ? <SalesAdminAdmissionsPage key={location.search} /> : isProfile ? <SalesAdminProfilePage /> : (
              <section className="sales-admin-dashboard-home">
                <header className="sales-admin-dashboard-header">
                  <div className="sales-admin-dashboard-intro">
                    <p className="eyebrow">SALES CRM</p>
                    <h2>Dashboard</h2>
                    <p>Monitor lead movement and admission performance across your assigned branches.</p>
                  </div>
                  <div className="sales-admin-dashboard-header-actions">
                    {embeddedBranchAdmin ? <button type="button" className="sales-admin-dashboard-refresh sales-admin-dashboard-switch-mode" onClick={onSwitchDashboard}><Home size={16} /><span>Switch Branch Admin</span></button> : null}
                    <button type="button" className="sales-admin-dashboard-refresh" onClick={refreshDashboard} disabled={dashboardLoading}>
                      <RefreshCw size={16} className={dashboardLoading ? 'is-spinning' : ''} />
                      <span>{dashboardLoading ? 'Refreshing' : 'Refresh'}</span>
                    </button>
                  </div>
                </header>

                <section className="sales-admin-dashboard-date-filter" aria-label="Dashboard date filter">
                  <div className="sales-admin-dashboard-date-filter-title"><CalendarDays size={16} /><span>Report period</span></div>
                  <select aria-label="Select report period" value={datePreset} onChange={(event) => chooseDatePreset(event.target.value)}>
                    <option value="TODAY">Today</option>
                    <option value="THIS_WEEK">This week</option>
                    <option value="THIS_MONTH">This month</option>
                    <option value="THIS_YEAR">This year</option>
                    <option value="CUSTOM">Custom date range</option>
                  </select>
                  <label className="sales-admin-dashboard-branch-filter"><span>Branch</span><select aria-label="Filter dashboard by branch" value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}><option value="">All branches</option>{assignedBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select></label>
                  {datePreset === 'CUSTOM' ? <div className="sales-admin-dashboard-date-inputs"><label>From<input aria-label="Report start date" type="date" value={dateRange.from} onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))} /></label><span>to</span><label>To<input aria-label="Report end date" type="date" value={dateRange.to} onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))} /></label></div> : null}
                  <span className="sales-admin-dashboard-date-range-label">{formatDashboardDate(dateRange.from)} – {formatDashboardDate(dateRange.to)}</span>
                  {customRangeInvalid ? <small className="sales-admin-dashboard-range-error">Choose a valid start and end date.</small> : null}
                </section>

                {error ? <div className="sales-admin-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={refreshDashboard}>Try again</button></div> : null}

                <section className="sales-admin-dashboard-cards" aria-label="Sales dashboard metrics">
                  {DASHBOARD_METRICS.map(({ key, label, hint, icon: Icon, accent, percent }) => (
                    <article className={`sales-admin-dashboard-metric is-${accent}`} key={key}>
                      <div className="sales-admin-dashboard-metric-top">
                        <span className="sales-admin-dashboard-metric-icon"><Icon size={18} strokeWidth={2.2} /></span>
                        <span className="sales-admin-dashboard-metric-trend" aria-hidden="true"><ArrowUpRight size={14} /></span>
                      </div>
                      <span className="sales-admin-dashboard-metric-label">{label}</span>
                      <strong>{dashboardLoading ? <span className="sales-admin-dashboard-value-skeleton" aria-label="Loading" /> : cards[key] == null && key === 'closedLeads' ? '0' : cards[key] == null || !Number.isFinite(Number(cards[key])) ? '—' : `${Number(cards[key]).toLocaleString('en-IN')}${percent ? '%' : ''}`}</strong>
                      <small>{hint}</small>
                    </article>
                  ))}
                </section>

                <section className="sales-admin-dashboard-analytics" aria-label="Sales overview charts">
                  <article className="sales-admin-dashboard-panel sales-admin-dashboard-chart-panel">
                    <header className="sales-admin-dashboard-panel-header">
                      <div><span className="sales-admin-dashboard-panel-icon is-blue"><BarChart3 size={17} /></span><div><h2>Sales overview</h2><p>Current week · daily lead and admission counts</p></div></div>
                      <span className="sales-admin-dashboard-total-pill">Current week</span>
                    </header>
                    {dashboardLoading ? <div className="sales-admin-dashboard-chart-skeleton" /> : chartRows.length ? <>
                      <div className="sales-admin-dashboard-chart-legend"><span><i className="is-leads" />Leads</span><span><i className="is-admissions" />Admissions</span></div>
                      <div className="sales-admin-dashboard-chart-wrap">
                        <svg className="sales-admin-dashboard-bar-chart" viewBox="0 0 640 190" preserveAspectRatio="none" role="img" aria-label="Sales overview bar chart comparing leads and completed admissions">
                          {[20, 60, 100, 140].map((y) => <line key={y} x1="30" x2="630" y1={y} y2={y} />)}
                          {chartRows.map((row, index) => {
                            const slot = 600 / chartRows.length
                            const barWidth = Math.max(3, Math.min(12, slot * 0.28))
                            const center = 30 + slot * index + slot / 2
                            const leadHeight = (Number(row.leads || 0) / chartMaximum) * 112
                            const admissionHeight = (Number(row.admissions || 0) / chartMaximum) * 112
                            return <g key={row.date} className="sales-admin-dashboard-chart-point" role="group" tabIndex="0" aria-label={`${formatChartDate(row.date)}: ${Number(row.leads || 0)} leads, ${Number(row.admissions || 0)} admissions`} onMouseEnter={(event) => updateChartTooltip(event, row)} onMouseMove={(event) => updateChartTooltip(event, row)} onMouseLeave={() => setChartTooltip(null)} onFocus={(event) => updateChartTooltip(event, row)} onBlur={() => setChartTooltip(null)}><rect className="is-leads" x={center - barWidth - 1} y={140 - leadHeight} width={barWidth} height={Math.max(leadHeight, row.leads ? 2 : 0)} rx="2" /><rect className="is-admissions" x={center + 1} y={140 - admissionHeight} width={barWidth} height={Math.max(admissionHeight, row.admissions ? 2 : 0)} rx="2" />{chartRows.length <= 14 ? <><text className="data-label is-leads" x={center - barWidth / 2 - 1} y={Math.max(13, 137 - leadHeight)} textAnchor="middle">{Number(row.leads || 0)}</text><text className="data-label is-admissions" x={center + barWidth / 2 + 1} y={Math.max(13, 137 - admissionHeight)} textAnchor="middle">{Number(row.admissions || 0)}</text></> : null}</g>
                          })}
                          {chartRows.filter((_, index) => chartRows.length <= 8 || index === 0 || index === chartRows.length - 1 || index % Math.max(1, Math.ceil(chartRows.length / 6)) === 0).map((row) => {
                            const index = chartRows.indexOf(row)
                            const slot = 600 / chartRows.length
                            return <text key={`label-${row.date}`} x={30 + slot * index + slot / 2} y="166" textAnchor="middle">{formatChartDate(row.date)}</text>
                          })}
                        </svg>
                        {chartTooltip ? <div className="sales-admin-dashboard-chart-tooltip" style={{ left: `${chartTooltip.left}px`, top: `${chartTooltip.top}px` }}><strong>{formatDashboardDate(chartTooltip.row.date)}</strong><div><span><i className="is-leads" />Leads</span><b>{Number(chartTooltip.row.leads || 0).toLocaleString('en-IN')}</b></div><div><span><i className="is-admissions" />Admissions</span><b>{Number(chartTooltip.row.admissions || 0).toLocaleString('en-IN')}</b></div></div> : null}
                      </div>
                    </> : <div className="sales-admin-dashboard-empty"><BarChart3 size={18} /><span>No leads or completed admissions in this period.</span></div>}
                  </article>

                  <article className="sales-admin-dashboard-panel sales-admin-dashboard-status-panel">
                    <header className="sales-admin-dashboard-panel-header"><div><span className="sales-admin-dashboard-panel-icon is-violet"><UsersRound size={17} /></span><div><h2>Lead status</h2><p>Current stage of leads created in the selected range</p></div></div></header>
                    {dashboardLoading ? <div className="sales-admin-dashboard-chart-skeleton" /> : <div className="sales-admin-dashboard-status-content">
                      <div className={`sales-admin-dashboard-status-ring ${statusTotal ? '' : 'is-empty'}`} style={statusTotal ? { background: `conic-gradient(${statusSlices.parts.join(', ')})` } : undefined}><div><strong>{statusTotal.toLocaleString('en-IN')}</strong><span>Leads</span></div></div>
                      <div className="sales-admin-dashboard-status-legend">{statusChart.map((row) => <div key={row.stage}><span><i className={`is-${String(row.stage).toLowerCase()}`} />{formatLeadStage(row.stage)}</span><strong>{Number(row.count).toLocaleString('en-IN')}</strong></div>)}</div>
                    </div>}
                  </article>
                </section>

                <section className="sales-admin-dashboard-detail-grid" aria-label="Admission conversion and follow-up summary">
                  <article className="sales-admin-dashboard-panel sales-admin-dashboard-conversion-panel">
                    <header className="sales-admin-dashboard-panel-header"><div><span className="sales-admin-dashboard-panel-icon is-green"><CheckCircle2 size={17} /></span><div><h2>Admission conversion</h2><p>Conversions among leads created in the selected range</p></div></div><strong className="sales-admin-dashboard-conversion-rate">{Number(conversionDetails.conversionRate ?? cards.conversionRate ?? 0).toLocaleString('en-IN')}%</strong></header>
                    <div className="sales-admin-dashboard-conversion-bar"><span style={{ width: `${Math.min(100, Number(conversionDetails.conversionRate ?? cards.conversionRate ?? 0))}%` }} /></div>
                    <div className="sales-admin-dashboard-conversion-stats"><div><span>Total leads</span><strong>{Number(conversionDetails.totalLeads ?? cards.totalLeads ?? 0).toLocaleString('en-IN')}</strong></div><div><span>Converted</span><strong>{Number(conversionDetails.convertedLeads ?? cards.convertedLeads ?? 0).toLocaleString('en-IN')}</strong></div><div><span>Expected</span><strong>{Number(conversionDetails.expectedAdmissions ?? cards.expectedAdmissions ?? 0).toLocaleString('en-IN')}</strong></div><div><span>Not converted</span><strong>{Number(conversionDetails.notConvertedLeads ?? 0).toLocaleString('en-IN')}</strong></div></div>
                  </article>

                  <article className="sales-admin-dashboard-panel sales-admin-dashboard-followup-summary-panel">
                    <header className="sales-admin-dashboard-panel-header"><div><span className="sales-admin-dashboard-panel-icon is-orange"><Clock3 size={17} /></span><div><h2>Follow-up activities</h2><p>For leads and follow-up dates in the selected range</p></div></div></header>
                    <div className="sales-admin-dashboard-followup-summary"><div className="is-today"><span>Scheduled in range</span><strong>{Number(followUpSummary.dueToday || 0).toLocaleString('en-IN')}</strong></div><div className="is-overdue"><span>Overdue in range</span><strong>{Number(followUpSummary.overdue || 0).toLocaleString('en-IN')}</strong></div><div className="is-upcoming"><span>Upcoming in range</span><strong>{Number(followUpSummary.nextSevenDays || 0).toLocaleString('en-IN')}</strong></div><div className="is-unscheduled"><span>No date set</span><strong>{Number(followUpSummary.withoutSchedule || 0).toLocaleString('en-IN')}</strong></div></div>
                  </article>
                </section>

                <section className="sales-admin-dashboard-detail-grid sales-admin-dashboard-branch-followup" aria-label="Branch sales and upcoming follow-ups">
                  <article className="sales-admin-dashboard-panel sales-admin-dashboard-branch-panel">
                    <header className="sales-admin-dashboard-panel-header"><div><span className="sales-admin-dashboard-panel-icon is-violet"><BarChart3 size={17} /></span><div><h2>Branch-wise sales overview</h2><p>Leads created in the selected date range</p></div></div></header>
                    {dashboardLoading ? <div className="sales-admin-dashboard-list-skeleton"><i /><i /><i /></div> : branchOverview.length ? <div className="sales-admin-dashboard-branch-table-wrap"><table className="sales-admin-dashboard-branch-table"><thead><tr><th>Branch</th><th>Leads</th><th>HOT</th><th>Admissions</th><th>Rate</th></tr></thead><tbody>{branchOverview.map((branch) => <tr key={branch.branchId}><td><strong>{branch.branchName}</strong></td><td>{Number(branch.totalLeads).toLocaleString('en-IN')}</td><td>{Number(branch.hotLeads).toLocaleString('en-IN')}</td><td>{Number(branch.admissionsCompleted).toLocaleString('en-IN')}</td><td>{Number(branch.conversionRate).toLocaleString('en-IN')}%</td></tr>)}</tbody></table></div> : <div className="sales-admin-dashboard-empty"><BarChart3 size={18} /><span>No assigned branches found.</span></div>}
                  </article>

                  <article className="sales-admin-dashboard-panel sales-admin-dashboard-followups">
                    <header className="sales-admin-dashboard-panel-header">
                      <div><span className="sales-admin-dashboard-panel-icon is-blue"><CalendarClock size={17} /></span><div><h2>Upcoming follow-ups</h2><p>Scheduled across your assigned branches</p></div></div>
                      {!embeddedBranchAdmin ? <button type="button" onClick={() => navigate('/dashboard/sales-admin/leads')}>View leads <ArrowUpRight size={14} /></button> : null}
                    </header>
                    {dashboardLoading ? <div className="sales-admin-dashboard-list-skeleton" aria-label="Loading follow-ups"><i /><i /><i /></div> : upcomingFollowUps.length ? (
                      <div className="sales-admin-dashboard-followup-list">
                        {upcomingFollowUps.map((lead) => (
                          <article className="sales-admin-dashboard-followup-row" key={lead.id}>
                            <span className={`sales-admin-dashboard-stage-dot is-${String(lead.stage || '').toLowerCase()}`} aria-hidden="true" />
                            <div className="sales-admin-dashboard-followup-person"><strong>{lead.studentName || 'Unnamed lead'}</strong><span>{[lead.leadId, lead.branch?.branchName, lead.course?.name].filter(Boolean).join(' · ') || 'Lead details unavailable'}</span></div>
                            <span className={`sales-admin-dashboard-followup-stage is-${String(lead.stage || '').toLowerCase()}`}>{formatLeadStage(lead.stage)}</span>
                            <time dateTime={lead.nextFollowUpDate}>{formatUpcomingFollowUpDate(lead.nextFollowUpDate)}{lead.nextFollowUpTimeLabel ? ` · ${lead.nextFollowUpTimeLabel}` : ''}</time>
                          </article>
                        ))}
                      </div>
                    ) : <div className="sales-admin-dashboard-empty"><CalendarClock size={18} /><span>No upcoming follow-ups in the next 7 days.</span></div>}
                  </article>

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
