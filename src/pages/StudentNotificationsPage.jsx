import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bell, BookOpen, CalendarDays, CheckCheck, CircleAlert, CircleUserRound, CreditCard, LayoutDashboard, LogOut, Menu, UserRound, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { request } from '../services/apiClient'
import { NotificationBell } from '../components/NotificationBell'
import '../styles/StudentNewDashboardPage.css'
import '../styles/StudentNotificationsPage.css'

function unwrap(response) {
  return response?.data && !Array.isArray(response.data) ? response : response
}

export function StudentNotificationsPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const handleLogout = async () => {
    try { window.sessionStorage.removeItem('cispro.student-session') } catch { /* Ignore storage errors. */ }
    await signOut()
    navigate('/login', { replace: true })
  }

  const load = useCallback(async () => {
    try {
      const response = await request('/notifications?limit=100&page=1')
      const body = unwrap(response)
      setItems(Array.isArray(body?.data) ? body.data : [])
      setUnreadCount(Number(body?.meta?.unreadCount || 0))
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
    const timer = setInterval(load, 30000)
    window.addEventListener('focus', load)
    window.addEventListener('institute-leave-updated', load)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', load)
      window.removeEventListener('institute-leave-updated', load)
    }
  }, [load])

  const visibleItems = useMemo(() => items.filter((item) => {
    const text = `${item.title || ''} ${item.message || ''}`.toLowerCase()
    return (!query || text.includes(query.toLowerCase()))
      && (filter === 'all' || (filter === 'unread' ? !item.read : item.read))
  }), [filter, items, query])

  const markAllRead = async () => {
    try {
      await request('/notifications/mark-read', {
        method: 'PATCH',
        body: JSON.stringify({ notificationIds: items.map((item) => item.id) }),
      })
      await load()
    } catch (err) { setError(err.message || 'Unable to update notifications') }
  }

  return <div className="student-notifications-layout">
    {isMobileSidebarOpen ? <button type="button" className="student-new-sidebar-backdrop" aria-label="Close navigation menu" onClick={() => setIsMobileSidebarOpen(false)} /> : null}
    <aside className={`student-new-sidebar ${isMobileSidebarOpen ? 'is-open' : ''}`.trim()} aria-label="Student navigation">
      <div className="student-new-sidebar-brand">
        <img className="student-new-sidebar-brand-logo" src="/logo1.png" alt="CISPRO logo" />
        <button type="button" className="student-new-sidebar-close" aria-label="Close navigation menu" onClick={() => setIsMobileSidebarOpen(false)}><X size={18} strokeWidth={2.6} /></button>
      </div>
      <nav className="student-new-sidebar-nav">
        <div className="student-new-sidebar-section">
          <span className="student-new-sidebar-section-label">MAIN</span>
          <button type="button" className="student-new-sidebar-item" onClick={() => navigate('/student-new-dashboard')}><span className="student-new-sidebar-icon"><LayoutDashboard size={18} strokeWidth={2.2} /></span><span>Dashboard</span></button>
        </div>
        <div className="student-new-sidebar-section">
          <span className="student-new-sidebar-section-label">STUDENT</span>
          <button type="button" className="student-new-sidebar-item" onClick={() => navigate('/student-new-dashboard')}><span className="student-new-sidebar-icon"><UserRound size={18} strokeWidth={2.2} /></span><span>My Profile</span></button>
          <button type="button" className="student-new-sidebar-item" onClick={() => navigate('/student-new-dashboard')}><span className="student-new-sidebar-icon"><BookOpen size={18} strokeWidth={2.2} /></span><span>My Course</span></button>
          <button type="button" className="student-new-sidebar-item" onClick={() => navigate('/student-new-dashboard')}><span className="student-new-sidebar-icon"><CalendarDays size={18} strokeWidth={2.2} /></span><span>Calendar</span></button>
          <button type="button" className="student-new-sidebar-item" onClick={() => navigate('/student-new-dashboard')}><span className="student-new-sidebar-icon"><CreditCard size={18} strokeWidth={2.2} /></span><span>Payments</span></button>
          <button type="button" className="student-new-sidebar-item is-active" aria-current="page"><span className="student-new-sidebar-icon"><Bell size={18} strokeWidth={2.2} /></span><span>Notifications</span></button>
        </div>
      </nav>
      <div className="student-new-sidebar-footer"><div className="student-new-sidebar-profile-card"><span className="student-new-sidebar-user-avatar"><CircleUserRound size={28} strokeWidth={1.9} /><span className="student-new-sidebar-user-status" /></span><div className="student-new-sidebar-profile-copy"><strong>Student</strong><span>Student Profile</span></div><button type="button" className="student-new-sidebar-logout-button" aria-label="Logout" onClick={handleLogout}><LogOut size={21} strokeWidth={2.15} /></button></div></div>
    </aside>
    <main className="student-notifications-page">
      <header className="student-notifications-topbar">
        <button type="button" className="student-new-sidebar-toggle" aria-label="Open navigation menu" aria-expanded={isMobileSidebarOpen} onClick={() => setIsMobileSidebarOpen(true)}><Menu size={20} strokeWidth={2.4} /></button>
        <h2>Student Dashboard</h2>
        <div className="student-notifications-topbar-profile"><NotificationBell /><span className="student-notifications-avatar"><CircleUserRound size={28} /></span><div><strong>{user?.fullName || user?.name || 'Student'}</strong><small>Student</small></div></div>
      </header>
    <header className="student-notifications-header">
      <div><h1>Notifications</h1><p>You have <strong>{items.length}</strong> notifications{unreadCount ? <> and <strong>{unreadCount}</strong> unread items</> : null}.</p></div>
      <div className="student-notifications-actions"><button type="button" onClick={() => navigate('/student-new-dashboard')}><ArrowLeft size={16} /> Back to dashboard</button><button type="button" onClick={markAllRead} disabled={!unreadCount}><CheckCheck size={16} /> Mark all as read</button></div>
    </header>
    <div className="student-notifications-filters"><label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notifications" aria-label="Search notifications" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter notification status"><option value="all">All status</option><option value="unread">Unread only</option><option value="read">Read only</option></select></div>
    {error ? <p className="student-notifications-error" role="alert">{error}</p> : null}
    <section className="student-notifications-list" aria-label="All notifications">
      {loading ? <p className="student-notifications-empty">Loading notifications…</p> : null}
      {!loading && !visibleItems.length ? <p className="student-notifications-empty">No notifications found.</p> : null}
      {visibleItems.map((item) => <article key={item.id} className={`student-notification-card ${item.read ? '' : 'is-unread'}`.trim()}><span className="student-notification-icon"><Bell size={20} /></span><div><div className="student-notification-title"><h2>{item.title}</h2><time>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.message}</p></div>{!item.read ? <span className="student-notification-unread"><CircleAlert size={14} /> Unread</span> : null}</article>)}
    </section>
    </main>
  </div>
}
