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

export function SuperAdminNotificationBell({ onOpenBranches, onViewActivity }) {
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshNotifications = async () => {
    try {
      const response = await request('/notifications?limit=20&page=1', {
        method: 'GET',
      })
      const data = Array.isArray(response?.data) ? response.data : []
      const mergedNotifications = mergeNotificationsWithStoredState(data)
      saveNotifications(mergedNotifications)
      setNotifications(mergedNotifications)
    } catch {
      setNotifications([])
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
    const intervalId = window.setInterval(() => {
      void refreshNotifications()
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
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

  const notificationCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  )
  const visibleNotifications = useMemo(() => notifications.slice(0, 3), [notifications])

  const handleOpenNotification = async (notification) => {
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
      // Keep the optimistic state if the API is temporarily unavailable.
    } finally {
      void refreshNotifications()
    }

    if (notification.kind?.startsWith('branch-') && typeof onOpenBranches === 'function') {
      onOpenBranches(notification)
      return
    }

    navigate('/dashboard/super-admin')
  }

  const handleMarkAllAsRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })))
    markNotificationsAsRead()

    void request('/notifications/mark-read', {
      method: 'PATCH',
      body: JSON.stringify({ notificationIds: [] }),
    })
      .catch(() => {})
      .finally(() => {
        void refreshNotifications()
      })
  }

  return (
    <div
      ref={menuRef}
      className="notification-menu super-admin-notification-menu"
      onFocusCapture={() => setIsOpen(true)}
    >
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
            {visibleNotifications.length ? (
              visibleNotifications.map((notification) => {
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
                  <span>Branch login and branch invitation alerts will appear here.</span>
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
