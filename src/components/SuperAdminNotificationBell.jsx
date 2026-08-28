import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Bell,
  CheckCircle2,
  Mail,
  X,
  Shield,
} from 'lucide-react'

import { request } from '../services/apiClient'
import {
  markNotificationsAsRead,
  loadNotifications,
  mergeNotificationsWithStoredState,
  saveNotifications,
} from '../lib/notificationStore'

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

function getNotificationIcon(kind) {
  switch (kind) {
    case 'branch-login':
      return CheckCircle2
    case 'branch-mail':
      return Mail
    case 'branch-created':
      return BadgeCheck
    default:
      return Shield
  }
}
export function SuperAdminNotificationBell({
  onOpenBranches,
  onViewActivity,
  onOpenBranch,
}) {
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) => String(notification.kind || '').trim().toLowerCase() !== 'branch-faculty-login',
      ),
    [notifications],
  )

  const refreshNotifications = async () => {
    try {
      const response = await request('/notifications?limit=20&page=1', {
        method: 'GET',
      })
      const data = Array.isArray(response?.data) ? response.data : []
      const mergedNotifications = mergeNotificationsWithStoredState(data)

      const storedViewedIds = JSON.parse(
        localStorage.getItem('superAdminDropdownViewedNotifications') || '[]',
      )

      const viewedIds = new Set(
        Array.isArray(storedViewedIds)
          ? storedViewedIds.map(String)
          : [],
      )

      const notificationsWithDropdownState = mergedNotifications.map((notification) => ({
        ...notification,
        dropdownViewed: viewedIds.has(String(notification.id)),
      }))

      saveNotifications(notificationsWithDropdownState, { emit: false })
      setNotifications(notificationsWithDropdownState)
    } catch {
      setNotifications(mergeNotificationsWithStoredState(loadNotifications()))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshNotifications()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [])

  useEffect(() => {
    const handleFocus = () => {
      void refreshNotifications()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    document.body.classList.toggle('super-admin-notification-menu-open', isOpen)

    return () => {
      document.body.classList.remove('super-admin-notification-menu-open')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (menuRef.current?.contains(target)) return
      setIsOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])

  const notificationCount = useMemo(
    () => visibleNotifications.filter((notification) => !notification.dropdownViewed).length,
    [visibleNotifications],
  )
  const visibleDropdownNotifications = useMemo(
    () => visibleNotifications.filter((notification) => !notification.dropdownViewed).slice(0, 2),
    [visibleNotifications],
  )
  const handleOpenNotification = async (notification) => {
  setIsOpen(false)

  setNotifications((current) =>
    current.map((item) =>
      item.id === notification.id
        ? { ...item, dropdownViewed: true }
        : item,
    ),
  )

const storedViewedIds = JSON.parse(
  localStorage.getItem('superAdminDropdownViewedNotifications') || '[]',
)

const viewedIds = new Set(
  Array.isArray(storedViewedIds)
    ? storedViewedIds.map(String)
    : [],
)

viewedIds.add(String(notification.id))

localStorage.setItem(
  'superAdminDropdownViewedNotifications',
  JSON.stringify([...viewedIds]),
)
  

  try {
  await request('/notifications/mark-read', {
    method: 'PATCH',
    body: JSON.stringify({ notificationIds: [notification.id] }),
  })
} catch {
  // Keep the optimistic state if the API is temporarily unavailable.
}

  if (notification.kind?.startsWith('branch-') && typeof onOpenBranches === 'function') {
    onOpenBranches(notification)
    return
  }

  navigate('/dashboard/super-admin')
}

 
const handleMarkAllAsRead = () => {
  const visibleIds = visibleNotifications.map((item) => item.id)
  if (!visibleIds.length) return
  setNotifications((current) =>
    current.map((item) =>
      visibleIds.includes(item.id)
        ? { ...item, read: true, dropdownViewed: true }
        : item,
    ),
  )

  const storedViewedIds = JSON.parse(
    localStorage.getItem('superAdminDropdownViewedNotifications') || '[]',
  )

  const viewedIds = new Set(
    Array.isArray(storedViewedIds)
      ? storedViewedIds.map(String)
      : [],
  )

  visibleNotifications.forEach((notification) => {
    viewedIds.add(String(notification.id))
  })

  localStorage.setItem(
    'superAdminDropdownViewedNotifications',
    JSON.stringify([...viewedIds]),
  )

  markNotificationsAsRead(visibleIds.length ? visibleIds : null)

  void request('/notifications/mark-read', {
    method: 'PATCH',
    body: JSON.stringify({ notificationIds: visibleIds }),
  }).catch(() => {})
}
  return (
    <div ref={menuRef} className="notification-menu super-admin-notification-menu">
      <button
        className="icon-chip notification-chip"
        type="button"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Bell size={20} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        <b>{isLoading ? '...' : notificationCount}</b>
      </button>

      {isOpen ? (
        <div
          className="super-admin-notification-backdrop"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {isOpen ? (
        <div className="notification-dropdown" role="menu" aria-label="Notifications">
          <div className="notification-dropdown-head">
            <strong>Notifications</strong>
            <div className="notification-dropdown-head-actions">
              <button type="button" className="notification-mark-read" onClick={handleMarkAllAsRead}>
                Mark all as read
              </button>
              <button
                type="button"
                className="notification-dropdown-close"
                aria-label="Close notifications"
                onClick={() => setIsOpen(false)}
              >
                <X size={16} strokeWidth={2.4} aria-hidden="true" focusable="false" />
              </button>
            </div>
          </div>

          <div className="notification-dropdown-list">
            {visibleDropdownNotifications.length ? (
              visibleDropdownNotifications.map((notification) => {
                const Icon = getNotificationIcon(notification.kind)
                return (
                  <button
                    type="button"
                    key={notification.id}
                    className={`notification-dropdown-item ${notification.read ? 'is-muted' : 'is-highlighted'}`.trim()}
                    onClick={() => handleOpenNotification(notification)}
                  >
                    <span className={`notification-badge ${notification.tone}`} aria-hidden="true">
                      <Icon size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                    </span>
                    <div className="notification-copy">
                      <p>{notification.title}</p>
                      <span>{notification.message}</span>
                      <small>{formatNotificationTime(notification.createdAt)}</small>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="notification-dropdown-item is-muted" role="presentation">
                <span className="notification-badge blue" aria-hidden="true">
                  <Shield size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                </span>
                <div className="notification-copy">
                  <p>No notifications yet</p>
                 
                  <small>Waiting for activity</small>
                </div>
              </div>
            )}
          </div>

          <button
            className="notification-dropdown-footer"
            type="button"
            onClick={() => {
              setIsOpen(false)
              if (typeof onViewActivity === 'function') {
                onViewActivity()
                return
              }

              if (typeof onOpenBranches === 'function') {
                onOpenBranches()
                return
              }

              navigate('/dashboard/super-admin/notifications')
            }}
          >
            View branch activity
          </button>
        </div>
      ) : null}
    </div>
  )
}
