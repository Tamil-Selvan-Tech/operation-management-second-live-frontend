import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Bell,
  Building2,
  CheckCircle2,
  CircleUserRound,
  ChevronDown,
  CalendarDays,
  Dot,
  LogOut,
  Mail,
  Menu,
  X,
  Shield,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { SearchBar } from '../components/SearchBar'
import { request } from '../services/apiClient'
import {
  loadNotifications,
  markNotificationsAsRead,
  mergeNotificationsWithStoredState,
  saveNotifications,
  subscribeNotifications,
} from '../lib/notificationStore'
import { SuperAdminNotificationBell } from '../components/SuperAdminNotificationBell'
import '../styles/SuperAdminDashboardPage.css'

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
      <CircleUserRound size={28} strokeWidth={1.9} />
      <span className="super-admin-sidebar-user-status" />
    </span>
  )
}

function formatNotificationTime(createdAt) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} mins ago`
  if (diffHours < 24) return `${diffHours} hrs ago`
  if (diffDays < 7) return `${diffDays} days ago`

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatGroupLabel(createdAt) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return 'Older'

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

  if (dateKey === todayKey) return 'Today'

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`
  if (dateKey === yesterdayKey) return 'Yesterday'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function NotificationIcon({ kind }) {
  if (kind === 'branch-created') {
    return <BadgeCheck size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
  }

  if (kind === 'branch-mail') {
    return <Mail size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
  }

  if (kind === 'branch-login') {
    return <CheckCircle2 size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
  }

  return <Bell size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
}

function normalizeNotificationItem(notification = {}) {
  const createdAt = String(notification.createdAt || '').trim()
  const timeValue = createdAt || new Date().toISOString()

  return {
    id: String(notification.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    kind: String(notification.kind || 'general').trim() || 'general',
    tone: String(notification.tone || 'blue').trim() || 'blue',
    title: String(notification.title || 'Notification').trim(),
    message: String(notification.message || '').trim(),
    actionLabel: String(notification.actionLabel || '').trim(),
    createdAt: timeValue,
    read: Boolean(notification.read),
    targetBranchId: String(notification.targetBranchId || '').trim(),
    targetBranchEmail: String(notification.targetBranchEmail || '').trim(),
    targetBranchName: String(notification.targetBranchName || '').trim(),
    facultyId: String(notification.facultyId || '').trim(),
    facultyEmail: String(notification.facultyEmail || '').trim(),
    facultyName: String(notification.facultyName || '').trim(),
  }
}

function groupNotifications(notifications = []) {
  const groups = new Map()
  const orderedNotifications = [...notifications].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )

  orderedNotifications.forEach((notification) => {
    const label = formatGroupLabel(notification.createdAt)
    if (!groups.has(label)) {
      groups.set(label, [])
    }

    groups.get(label).push(notification)
  })

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }))
}

function isWithinSelectedDateRange(createdAt, range) {
  if (range === 'all') return true

  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return false

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const itemStartOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((startOfToday.getTime() - itemStartOfDay.getTime()) / 86400000)

  if (range === 'today') {
    return diffDays === 0
  }

  if (range === 'yesterday') {
    return diffDays === 1
  }

  if (range === '7d') {
    return diffDays >= 0 && diffDays < 7
  }

  if (range === '30d') {
    return diffDays >= 0 && diffDays < 30
  }

  return true
}

function NotificationItem({ item, onView }) {
  return (
    <article className={`notifications-item ${item.read ? '' : 'is-unread'}`.trim()}>
      <span className={`notifications-item-icon tone-${item.tone}`} aria-hidden="true">
        <NotificationIcon kind={item.kind} />
      </span>

      <div className="notifications-item-copy">
        <div className="notifications-item-title-row">
          <h3>{item.title}</h3>
        </div>
        <p>{item.message}</p>
      </div>

      <div className="notifications-item-meta">
        <small className="notifications-item-time">{formatNotificationTime(item.createdAt)}</small>
        <button type="button" className="notifications-item-view-button" onClick={() => onView(item)}>
          View
        </button>
      </div>
    </article>
  )
}

export function SuperAdminNotificationsPage() {
  const navigate = useNavigate()
  const { signOut, user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const refreshTimerRef = useRef(null)

  const profileEmail = user?.email || 'superadmin.manager@cispro.com'
  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) => String(notification.kind || '').trim().toLowerCase() !== 'branch-faculty-login',
      ),
    [notifications],
  )

  const loadAllNotifications = async () => {
    try {
      const response = await request('/notifications?limit=100&page=1', {
        method: 'GET',
      })

      const data = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.notifications)
          ? response.notifications
          : Array.isArray(response)
            ? response
            : []

      const mergedNotifications = mergeNotificationsWithStoredState(data.map(normalizeNotificationItem))
      saveNotifications(mergedNotifications, { emit: false })
      setNotifications(mergedNotifications)
    } catch {
      setNotifications(mergeNotificationsWithStoredState(loadNotifications().map(normalizeNotificationItem)))
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadAllNotifications()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeNotifications(() => {
      void loadAllNotifications()
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!isLogoutConfirmOpen && !isMobileSidebarOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsLogoutConfirmOpen(false)
        setIsMobileSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isLogoutConfirmOpen, isMobileSidebarOpen])

  useEffect(() => {
    document.body.classList.toggle('super-admin-sidebar-open', isMobileSidebarOpen)

    return () => {
      document.body.classList.remove('super-admin-sidebar-open')
    }
  }, [isMobileSidebarOpen])

  const unreadCount = useMemo(() => visibleNotifications.filter((item) => !item.read).length, [visibleNotifications])
  const totalCount = visibleNotifications.length
  const filteredNotifications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return visibleNotifications.filter((item) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'read' && item.read) ||
        (statusFilter === 'unread' && !item.read)

      const matchesDate = isWithinSelectedDateRange(item.createdAt, dateFilter)

      const searchableText = [
        item.title,
        item.message,
        item.kind,
        item.actionLabel,
        item.targetBranchName,
        item.targetBranchEmail,
        item.facultyName,
        item.facultyEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !query || searchableText.includes(query)

      return matchesStatus && matchesDate && matchesSearch
    })
  }, [dateFilter, searchTerm, statusFilter, visibleNotifications])

  const groupedNotifications = useMemo(() => groupNotifications(filteredNotifications), [filteredNotifications])

  const markAllAsRead = async () => {
    const visibleIds = visibleNotifications.map((item) => item.id)
    if (!visibleIds.length) return
    setNotifications((current) =>
      current.map((item) =>
        visibleIds.includes(item.id) ? { ...item, read: true } : item,
      ),
    )
    markNotificationsAsRead(visibleIds.length ? visibleIds : null)

    try {
      await request('/notifications/mark-read', {
        method: 'PATCH',
        body: JSON.stringify({ notificationIds: visibleIds }),
      })
    } catch {
      markNotificationsAsRead(visibleIds.length ? visibleIds : null)
    } finally {
      void loadAllNotifications()
    }
  }

  const markSingleAsRead = async (notification) => {
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    )
    markNotificationsAsRead([notification.id])

    try {
      await request('/notifications/mark-read', {
        method: 'PATCH',
        body: JSON.stringify({ notificationIds: [notification.id] }),
      })
    } catch {
      markNotificationsAsRead([notification.id])
    } finally {
      void loadAllNotifications()
    }
  }

  const handleViewNotification = async (notification) => {
    await markSingleAsRead(notification)

    if (notification.kind?.startsWith('branch-')) {
      navigate('/dashboard/super-admin?section=branches')
    }
  }

  const handleConfirmLogout = async () => {
    setIsLogoutConfirmOpen(false)
    try {
      await signOut()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <section className="super-admin-page">
      <div className="super-admin-shell">
        {isMobileSidebarOpen ? (
          <button
            type="button"
            className="super-admin-sidebar-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`super-admin-sidebar ${isMobileSidebarOpen ? 'is-open' : ''}`.trim()}
          aria-label="Super admin navigation"
        >
          <div className="super-admin-sidebar-brand">
            <img className="super-admin-sidebar-brand-logo" src="/logo1.png" alt="Elite Admin logo" />
            <button
              type="button"
              className="super-admin-sidebar-close"
              aria-label="Close navigation menu"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X size={18} strokeWidth={2.6} aria-hidden="true" focusable="false" />
            </button>
          </div>

          <nav className="super-admin-sidebar-nav">
            <div className="super-admin-sidebar-section">
              <span className="super-admin-sidebar-section-label">MAIN</span>
              <button
                type="button"
                className="super-admin-sidebar-item"
                onClick={() => {
                  setIsMobileSidebarOpen(false)
                  navigate('/dashboard/super-admin')
                }}
              >
                <span className="super-admin-sidebar-icon" aria-hidden="true">
                  <Building2 size={18} strokeWidth={2.2} />
                </span>
                <span>Dashboard</span>
              </button>
            </div>

            <div className="super-admin-sidebar-section">
              <span className="super-admin-sidebar-section-label">MANAGEMENT</span>
              <button
                type="button"
                className="super-admin-sidebar-item"
                onClick={() => {
                  setIsMobileSidebarOpen(false)
                  navigate('/dashboard/super-admin?section=branches')
                }}
              >
                <span className="super-admin-sidebar-icon" aria-hidden="true">
                  <Building2 size={18} strokeWidth={2.2} />
                </span>
                <span>Branches</span>
              </button>
            </div>
          </nav>

          <div className="super-admin-sidebar-footer">
            <div className="super-admin-sidebar-profile-card">
              <SidebarUserAvatar />

              <div className="super-admin-sidebar-profile-copy">
                <span>{profileEmail}</span>
              </div>

              <button
                type="button"
                className="super-admin-sidebar-logout-button"
                aria-label="Logout"
                onClick={() => {
                  setIsLogoutConfirmOpen(true)
                  setIsMobileSidebarOpen(false)
                }}
              >
                <LogOut size={22} strokeWidth={2.15} />
              </button>
            </div>
          </div>
        </aside>

        <div className="super-admin-main">
          <header className="super-admin-topbar">
            <div className="super-admin-topbar-left">
              <button
                type="button"
                className="super-admin-sidebar-toggle"
                aria-label="Open navigation menu"
                aria-expanded={isMobileSidebarOpen}
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu size={20} strokeWidth={2.4} aria-hidden="true" focusable="false" />
              </button>
              <h1 className="super-admin-header-title">Super Admin Dashboard</h1>
            </div>

            <div className="super-admin-topbar-right">
              <SuperAdminNotificationBell
                onOpenBranches={() => navigate('/dashboard/super-admin?section=branches')}
                onViewActivity={() => navigate('/dashboard/super-admin/notifications')}
              />

              <div className="super-admin-profile">
                <AvatarBadge />
                <div className="super-admin-profile-copy">
                  <strong>Super Admin</strong>
                </div>
              </div>
            </div>
          </header>

          <main className="super-admin-content">
            <section className="notifications-page">
              <header className="notifications-page-header">
                <div className="notifications-page-copy">
                  <p className="eyebrow">Notifications</p>
                  <h2>Notifications</h2>
                  <p>
                    You have <strong>{isRefreshing ? '...' : totalCount}</strong> notifications to go through
                    {unreadCount ? <span> and {unreadCount} unread items</span> : null} for Super Admin.
                  </p>
                </div>

                <div className="notifications-page-actions">
                  <button type="button" className="notifications-mark-read" onClick={markAllAsRead}>
                    <Bell size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                    Mark all as read
                  </button>

                  <button
                    type="button"
                    className="notifications-back-button"
                    onClick={() => navigate('/dashboard/super-admin')}
                  >
                    <Building2 size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                    Back to dashboard
                  </button>
                </div>
              </header>

              <div className="notifications-search-row">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search notifications"
                  ariaLabel="Search notifications"
                  className="notifications-search-bar"
                />

                <div className="notifications-filter-set">
                  <label className="notifications-filter-field">
                    <span className="notifications-filter-icon" aria-hidden="true">
                      <CalendarDays size={16} strokeWidth={2.2} />
                    </span>
                    <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
                      <option value="all">All dates</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                    </select>
                    <span className="notifications-filter-chevron" aria-hidden="true">
                      <ChevronDown size={16} strokeWidth={2.2} />
                    </span>
                  </label>

                  <label className="notifications-filter-field notifications-filter-field--status">
                    <span className="notifications-filter-icon notifications-filter-icon--status" aria-hidden="true">
                      <Dot size={22} strokeWidth={3.2} />
                    </span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="all">All status</option>
                      <option value="unread">Unread</option>
                      <option value="read">Read</option>
                    </select>
                    <span className="notifications-filter-chevron" aria-hidden="true">
                      <ChevronDown size={16} strokeWidth={2.2} />
                    </span>
                  </label>
                </div>
              </div>

              {groupedNotifications.length ? (
                <div className="notifications-feed">
                  {groupedNotifications.map((group) => (
                    <section key={group.label} className="notifications-group">
                      <p className="notifications-group-label">{group.label}</p>
                      <div className="notifications-group-list">
                        {group.items.map((item) => (
                          <NotificationItem key={item.id} item={item} onView={handleViewNotification} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="notifications-empty-state">
                  <span className="notifications-empty-state-icon" aria-hidden="true">
                    <Bell size={22} strokeWidth={2.2} />
                  </span>
                  <div>
                    <h3>{searchTerm.trim() ? 'No matching notifications' : 'No notifications yet'}</h3>
                    <p>
                      {searchTerm.trim()
                        ? 'Try a different keyword, date, or status.'
                        : 'Branch login, invitation, and activity updates will appear here automatically.'}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>

      {isLogoutConfirmOpen ? (
        <div className="super-admin-logout-modal" role="dialog" aria-modal="true" aria-labelledby="super-admin-logout-title">
          <h2 id="super-admin-logout-title">Are you sure you want to logout?</h2>
          <div className="super-admin-logout-actions">
            <button type="button" className="super-admin-logout-cancel" onClick={() => setIsLogoutConfirmOpen(false)}>
              Cancel
            </button>
            <button type="button" className="super-admin-logout-submit" onClick={handleConfirmLogout}>
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
