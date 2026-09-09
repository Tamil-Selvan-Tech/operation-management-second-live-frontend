import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bell, BookOpen, CalendarDays, CheckCheck, CircleAlert, CircleUserRound, CreditCard, LayoutDashboard, Search, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { request } from '../services/apiClient'
import { NotificationBell } from '../components/NotificationBell'
import '../styles/StudentNotificationsPage.css'

function unwrap(response) {
  return response?.data && !Array.isArray(response.data) ? response : response
}

export function StudentNotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [month, setMonth] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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
    const createdMonth = String(item.createdAt || '').slice(0, 7)
    return (!query || text.includes(query.toLowerCase()))
      && (filter === 'all' || (filter === 'unread' ? !item.read : item.read))
      && (!month || createdMonth === month)
  }), [filter, items, month, query])

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
    <aside className="student-notifications-sidebar" aria-label="Student navigation">
      <div className="student-notifications-sidebar-brand"><img src="/logo1.png" alt="CISPRO logo" /></div>
      <nav className="student-notifications-sidebar-nav">
        <span className="student-notifications-sidebar-label">MAIN</span>
        <button type="button" onClick={() => navigate('/student-new-dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
        <span className="student-notifications-sidebar-label">STUDENT</span>
        <button type="button" onClick={() => navigate('/student-new-dashboard')}><UserRound size={18} /> My Profile</button>
        <button type="button" onClick={() => navigate('/student-new-dashboard')}><BookOpen size={18} /> My Course</button>
        <button type="button" onClick={() => navigate('/student-new-dashboard')}><CalendarDays size={18} /> Calendar</button>
        <button type="button" onClick={() => navigate('/student-new-dashboard')}><CreditCard size={18} /> Payments</button>
        <button type="button" className="is-active" aria-current="page"><Bell size={18} /> Notifications</button>
      </nav>
      <div className="student-notifications-sidebar-profile"><span>STUDENT</span><strong>Student Profile</strong></div>
    </aside>
    <main className="student-notifications-page">
      <header className="student-notifications-topbar">
        <h2>Student Dashboard</h2>
        <div className="student-notifications-topbar-profile"><NotificationBell /><span className="student-notifications-avatar"><CircleUserRound size={28} /></span><div><strong>{user?.fullName || user?.name || 'Student'}</strong><small>Student</small></div></div>
      </header>
    <header className="student-notifications-header">
      <div><p className="student-notifications-eyebrow">Student Dashboard</p><h1>Notifications</h1><p>You have <strong>{items.length}</strong> notifications{unreadCount ? <> and <strong>{unreadCount}</strong> unread items</> : null}.</p></div>
      <div className="student-notifications-actions"><button type="button" onClick={() => navigate('/student-new-dashboard')}><ArrowLeft size={16} /> Back to dashboard</button><button type="button" onClick={markAllRead} disabled={!unreadCount}><CheckCheck size={16} /> Mark all as read</button></div>
    </header>
    <div className="student-notifications-filters"><label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notifications" aria-label="Search notifications" /></label><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Filter by month" /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter notification status"><option value="all">All status</option><option value="unread">Unread only</option><option value="read">Read only</option></select></div>
    {error ? <p className="student-notifications-error" role="alert">{error}</p> : null}
    <section className="student-notifications-list" aria-label="All notifications">
      {loading ? <p className="student-notifications-empty">Loading notifications…</p> : null}
      {!loading && !visibleItems.length ? <p className="student-notifications-empty">No notifications found.</p> : null}
      {visibleItems.map((item) => <article key={item.id} className={`student-notification-card ${item.read ? '' : 'is-unread'}`.trim()}><span className="student-notification-icon"><Bell size={20} /></span><div><div className="student-notification-title"><h2>{item.title}</h2><time>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.message}</p></div>{!item.read ? <span className="student-notification-unread"><CircleAlert size={14} /> Unread</span> : null}</article>)}
    </section>
    </main>
  </div>
}
